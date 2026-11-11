import { describe, expect, it } from "vitest";
import { estimateWorkoutCalories, WORKOUT_CALORIE_VERSION, validateWorkoutMinutes } from "../shared/workoutCalories";
import {
  buildWorkoutCalorieReadModel, isLegacyAutomaticCalories, planWorkoutCreation, planWorkoutFinish,
  selectWorkoutWeight, workoutVolume, workoutWeekMonday,
} from "./workoutCalorieService";

const now = new Date("2026-11-11T20:00:00+08:00");
const resistance = Array.from({ length: 12 }, (_, i) => ({ exerciseName: "Bench Press", setNumber: i + 1, reps: 10, weight: 40 }));
const cardio = { exerciseName: "Stationary Bike", duration: 20, calories: 130 };
const session = { id: 1, startTime: new Date("2026-11-11T18:00:00+08:00"), duration: 60, caloriesBurned: 350, totalVolume: 0 };

describe("versioned conservative workout active energy", () => {
  it("uses active, not gross MET energy and no workload bonus", () => {
    const lightLoad = estimateWorkoutCalories({ sets: resistance.map(s => ({ ...s, weight: 1 })), bodyWeightKg: 80, verifiedDurationMinutes: 60 });
    const heavyLoad = estimateWorkoutCalories({ sets: resistance.map(s => ({ ...s, weight: 200 })), bodyWeightKg: 80, verifiedDurationMinutes: 60 });
    expect(lightLoad.activeKcal).toBe(200); // (3.5-1)*80*1h
    expect(heavyLoad.activeKcal).toBe(lightLoad.activeKcal);
    expect(lightLoad.resistanceMet).toBe(3.5);
    expect(lightLoad.version).toBe(WORKOUT_CALORIE_VERSION);
    expect(lightLoad.lowKcal).toBeLessThan(lightLoad.activeKcal);
    expect(lightLoad.highKcal).toBeGreaterThan(lightLoad.activeKcal);
    expect(estimateWorkoutCalories({ sets: resistance, bodyWeightKg: 80, verifiedDurationMinutes: 60, intensity: "vigorous" }).activeKcal).toBe(400);
  });
  it("subtracts cardio minutes from verified mixed duration and counts machine kcal once", () => {
    const result = estimateWorkoutCalories({ sets: [...resistance, cardio], bodyWeightKg: 80, verifiedDurationMinutes: 60 });
    expect(result.resistanceMinutes).toBe(40);
    expect(result.cardioMinutes).toBe(20);
    expect(result.activeKcal).toBe(263);
    expect(result.cardioKcal).toBe(130);
    expect(result.source).toBe("mixed");
    expect(result.energyBasis).toBe("mixed");
  });
  it("explicit resistance flags and timed planks never fall through to cardio inference", () => {
    for (const set of [
      { exerciseName: "Unknown timed hold", duration: 2, category: "strength" },
      { exerciseName: "Unknown timed hold", duration: 2, isCardio: false },
      { exerciseName: "Plank", duration: 2 },
    ]) {
      const result = estimateWorkoutCalories({ sets: [set], bodyWeightKg: 60 });
      expect(result.cardioMinutes).toBe(0);
      expect(result.resistanceMinutes).toBe(2);
      expect(result.activeKcal).toBe(5);
    }
  });
  it("cardio-only never accrues whole-duration strength, minutes are not seconds", () => {
    const result = estimateWorkoutCalories({ sets: [cardio], bodyWeightKg: 80, verifiedDurationMinutes: 60 });
    expect(result.activeKcal).toBe(130);
    expect(result.resistanceMinutes).toBe(0);
    expect(result.effectiveMinutes).toBe(20);
    const estimated = estimateWorkoutCalories({ sets: [{ ...cardio, calories: null }], bodyWeightKg: 60 });
    expect(estimated.activeKcal).toBe(80); // (5-1)*60*(20/60)
    expect(estimated.source).toBe("cardio_estimate");
  });
  it("preserves explicit zero machine calories rather than falling through to an estimate", () => {
    expect(estimateWorkoutCalories({ sets: [{ ...cardio, calories: 0 }] }).activeKcal).toBe(0);
    expect(estimateWorkoutCalories({ sets: resistance, verifiedDurationMinutes: 0 }).activeKcal).toBe(0);
    expect(estimateWorkoutCalories({ sets: [], verifiedDurationMinutes: 60 }).activeKcal).toBe(0);
  });
  it("idle time cannot inflate unverified resistance energy", () => {
    const a = estimateWorkoutCalories({ sets: resistance, availableMinutes: 30 });
    const b = estimateWorkoutCalories({ sets: resistance, availableMinutes: 180 });
    expect(a.activeKcal).toBe(b.activeKcal);
    expect(a.effectiveMinutes).toBe(19.75);
    expect(estimateWorkoutCalories({ sets: [] }).activeKcal).toBe(0);
  });
  it.each([-1, 181, Infinity, NaN])("rejects unsafe new duration %s with actionable units", value => {
    expect(() => validateWorkoutMinutes(value)).toThrow(/分鐘/);
    expect(() => estimateWorkoutCalories({ sets: [cardio], verifiedDurationMinutes: value })).toThrow(/分鐘/);
  });
  it("rejects overlong cardio and conflicting verified total", () => {
    expect(() => estimateWorkoutCalories({ sets: [{ ...cardio, duration: 1200 }] })).toThrow(/分鐘/);
    expect(() => estimateWorkoutCalories({ sets: [cardio], verifiedDurationMinutes: 10 })).toThrow(/有氧分鐘/);
    expect(() => estimateWorkoutCalories({ sets: [{ ...cardio, duration: 100 }, { ...cardio, duration: 100 }] })).toThrow(/總時間/);
  });
  it("manual totals including zero survive estimates", () => {
    const manual = estimateWorkoutCalories({ sets: [...resistance, cardio], manualCalories: 99 });
    expect(manual.activeKcal).toBe(99);
    expect(manual.source).toBe("manual");
    expect(manual.lowKcal).toBe(99);
    expect(manual.highKcal).toBe(99);
    expect(estimateWorkoutCalories({ sets: resistance, manualCalories: 0 }).activeKcal).toBe(0);
  });
  it("is fully deterministic", () => {
    const input = { sets: [...resistance, cardio], bodyWeightKg: 79.1 };
    expect(estimateWorkoutCalories(input)).toEqual(estimateWorkoutCalories(input));
  });
});

describe("weight and non-destructive legacy read correction", () => {
  const weights = [{ date: "2026-11-10", weight: 80 }, { date: "2026-11-12", weight: 90 }, { date: "2026-11-11", weight: null }];
  it("uses latest usable body weight on or before session HK date, never future measurement", () => {
    expect(selectWorkoutWeight("2026-11-11", weights, 65)).toMatchObject({ bodyWeightKg: 80, weightSource: "body_composition", weightDate: "2026-11-10" });
    expect(selectWorkoutWeight("2026-11-09", weights, 65)).toMatchObject({ bodyWeightKg: 65, weightSource: "user_profile" });
    expect(selectWorkoutWeight("2026-11-09", weights)).toMatchObject({ bodyWeightKg: 70, weightSource: "assumed_70kg" });
    const result = buildWorkoutCalorieReadModel(session, resistance, weights);
    expect(result.calorieEstimate.bodyWeightKg).toBe(80);
  });
  it("corrects old multi-hour inflation without mutating source and retains original evidence", () => {
    const legacy = { ...session, duration: 694, caloriesBurned: Math.round(5.5 * 70 * 694 / 60), totalVolume: workoutVolume(resistance) };
    const before = { ...legacy };
    const result = buildWorkoutCalorieReadModel(legacy, [...resistance, cardio], weights);
    expect(result.caloriesBurned).toBeLessThan(250);
    expect(result.rawOriginalCalories).toBe(legacy.caloriesBurned);
    expect(result.rawDuration).toBe(694);
    expect(result.calorieReadModel).toBe("corrected_legacy");
    expect(legacy).toEqual(before);
    expect(result.calorieDetails.warnings.join(" ")).toMatch(/多小時/);
  });
  it("uses stored-volume old-model fingerprint even if sets changed", () => {
    const legacy = { ...session, duration: 60, totalVolume: 6000, caloriesBurned: 420 };
    expect(isLegacyAutomaticCalories(legacy, resistance)).toBe(true);
  });
  it("preserves unidentifiable legacy reported/manual kcal with provenance warning", () => {
    const result = buildWorkoutCalorieReadModel({ ...session, caloriesBurned: 123 }, resistance);
    expect(result.caloriesBurned).toBe(123);
    expect(result.calorieReadModel).toBe("manual_preserved");
    expect(result.calorieDetails.warnings.join(" ")).toMatch(/未能確認/);
  });
  it("legacy explicit zero retains unknown/manual provenance and cannot accrue positive energy", () => {
    const result = buildWorkoutCalorieReadModel({ ...session, caloriesBurned: 0 }, resistance);
    expect(result.caloriesBurned).toBe(0);
    expect(result.calorieReadModel).toBe("manual_preserved");
  });
  it("corrects empty old sessions to zero and includes missing-weight warning", () => {
    const result = buildWorkoutCalorieReadModel(session, []);
    expect(result.caloriesBurned).toBe(0);
    expect(result.calorieEstimate.warnings.join(" ")).toMatch(/70 kg/);
  });
  it("new manual overrides preserve original metadata across rereads", () => {
    const details = estimateWorkoutCalories({ sets: resistance, manualCalories: 77 });
    details.origin = "new"; details.rawOriginalCalories = 350;
    const result = buildWorkoutCalorieReadModel({ ...session, calorieDetails: details, caloriesBurned: 77 }, [...resistance, cardio]);
    expect(result.caloriesBurned).toBe(77);
    expect(result.rawOriginalCalories).toBe(350);
    expect(result.calorieEstimate.source).toBe("manual");
  });
});

describe("HK live/historical timing safety and idempotent finish", () => {
  it("HK ISO-week Monday uses calendar dates and is independent of machine timezone", () => {
    expect(workoutWeekMonday("2026-11-08")).toBe("2026-11-02");
    expect(workoutWeekMonday("2026-11-09")).toBe("2026-11-09");
    expect(workoutWeekMonday("2027-01-01")).toBe("2026-12-28");
  });
  it("starts today's live session now, not noon", () => {
    const plan = planWorkoutCreation({ date: "2026-11-11" }, now);
    expect(plan.startTime).toBe(now);
    expect(plan.calorieDetails.timing.mode).toBe("live");
    expect(plan.caloriesBurned).toBe(0);
  });
  it("uses HK day boundaries independently of UTC calendar day", () => {
    const hkAfterMidnight = new Date("2026-11-11T00:30:00+08:00");
    expect(planWorkoutCreation({ date: "2026-11-11" }, hkAfterMidnight).startTime).toBe(hkAfterMidnight);
  });
  it("rejects malformed and future dates", () => {
    expect(() => planWorkoutCreation({ date: "2026-02-30" }, now)).toThrow(/日期/);
    expect(() => planWorkoutCreation({ date: "2026-11-12" }, now)).toThrow(/未來/);
    expect(() => planWorkoutFinish({ ...session, startTime: "2026-11-12T12:00:00+08:00" }, { duration: 30 }, now)).toThrow(/未來/);
  });
  it("historical finish requires reviewed minutes or explicit timestamps and accepts zero", () => {
    const historical = { ...session, ...planWorkoutCreation({ date: "2026-11-01" }, now) };
    expect(() => planWorkoutFinish(historical, {}, now)).toThrow(/實際訓練分鐘/);
    const reviewed = planWorkoutFinish(historical, { duration: 45 }, now);
    expect(reviewed).toMatchObject({ alreadyFinished: false, verifiedDurationMinutes: 45, mode: "historical" });
    if (!reviewed.alreadyFinished) expect(reviewed.endTime.toISOString()).toBe("2026-11-01T04:45:00.000Z");
    expect(planWorkoutFinish(historical, { duration: 0 }, now)).toMatchObject({ verifiedDurationMinutes: 0 });
    expect(() => planWorkoutFinish(historical, { endTime: "2026-11-01T13:00:00+08:00" }, now)).toThrow(/同時輸入/);
  });
  it("historical creation's explicit duration qualifies for finish", () => {
    const historical = { ...session, ...planWorkoutCreation({ date: "2026-11-01", duration: 45 }, now) };
    expect(planWorkoutFinish(historical, {}, now)).toMatchObject({ verifiedDurationMinutes: 45 });
  });
  it("rejects multi-hour live elapsed until reviewed duration is supplied", () => {
    const live = { ...session, ...planWorkoutCreation({ date: "2026-11-11" }, new Date("2026-11-11T12:00:00+08:00")) };
    expect(() => planWorkoutFinish(live, {}, now)).toThrow(/分鐘/);
    expect(planWorkoutFinish(live, { duration: 30 }, now)).toMatchObject({ verifiedDurationMinutes: 30 });
  });
  it("explicit live review can replace elapsed time with corrected duration and end at now", () => {
    const live = { ...session, ...planWorkoutCreation({ date: "2026-11-11" }, now) };
    const reviewed = planWorkoutFinish(live, { duration: 45 }, now);
    expect(reviewed).toMatchObject({ verifiedDurationMinutes: 45, endTime: now });
  });
  it("rejects missing, negative timestamps and unsafe timestamps", () => {
    expect(() => planWorkoutFinish({ ...session, startTime: null }, {}, now)).toThrow(/缺少/);
    const live = { ...session, ...planWorkoutCreation({ date: "2026-11-11", startTime: "2026-11-11T18:00:00+08:00" }, now) };
    expect(() => planWorkoutFinish(live, { endTime: "2026-11-11T17:00:00+08:00" }, now)).toThrow(/分鐘/);
    expect(() => planWorkoutCreation({ date: "2026-11-11", startTime: "2026-11-11T18:00:00" }, now)).toThrow(/時區/);
  });
  it("already finished is idempotent, even if now is days later", () => {
    const finished = { ...session, endTime: new Date("2026-11-11T19:00:00+08:00") };
    expect(planWorkoutFinish(finished, {}, new Date("2026-11-30T20:00:00+08:00"))).toEqual({ alreadyFinished: true });
  });
});
