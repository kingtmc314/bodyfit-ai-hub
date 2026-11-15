import { describe, expect, it } from "vitest";
import { calorieEstimateSummary, estimateWorkoutCalories, isCardioSet, PREVIOUS_WORKOUT_CALORIE_VERSION, WORKOUT_CALORIE_VERSION } from "../shared/workoutCalories";
import { WORKOUT_VOLUME_ASSUMPTIONS, workoutMovementAssumption } from "../shared/workoutVolumeEnergy";
import { buildWorkoutCalorieReadModel, workoutVolume } from "./workoutCalorieService";

const row = { exerciseName: "Bench Press", reps: 10, weight: 40, duration: 0.5 };
const session = { id: 1, startTime: "2026-11-11T19:00:00+08:00", duration: 694, caloriesBurned: 200 };

describe("explicit kg × reps × logged sets mechanical component", () => {
  it("increases energy with load at identical reps, duration and set count", () => {
    const low = estimateWorkoutCalories({ sets: [row], bodyWeightKg: 80, verifiedDurationMinutes: 30 });
    const high = estimateWorkoutCalories({ sets: [{ ...row, weight: 100 }], bodyWeightKg: 80, verifiedDurationMinutes: 30 });
    expect(high.activeKcal).toBeGreaterThan(low.activeKcal);
    expect(high.volume.externalEnergyKcal).toBeGreaterThan(low.volume.externalEnergyKcal);
    expect(high.effectiveMinutes).toBe(low.effectiveMinutes);
    expect(high.volume.capped).toBe(false);
  });
  it("increases reps at equal explicitly logged work time and exposes kg·rep volume", () => {
    const low = estimateWorkoutCalories({ sets: [row] });
    const high = estimateWorkoutCalories({ sets: [{ ...row, reps: 20 }] });
    expect(high.volume.totalVolumeKgReps).toBe(800);
    expect(high.volume.externalWorkJ).toBeCloseTo(low.volume.externalWorkJ * 2);
    expect(high.volume.resistanceKcal).toBeGreaterThan(low.volume.resistanceKcal);
    expect(high.effectiveMinutes).toBe(low.effectiveMinutes);
  });
  it("counts each row once; setNumber is not an extra multiplier", () => {
    const result = estimateWorkoutCalories({ sets: [1, 2, 3].map(setNumber => ({ ...row, setNumber })) });
    expect(result.volume.totalVolumeKgReps).toBe(1200);
    expect(result.volume.totalReps).toBe(30);
    expect(result.volume.completedSets).toBe(3);
    expect(result.volume.recoveryMinutes).toBe(2.5);
    expect(workoutVolume([1, 2, 3].map(setNumber => ({ ...row, setNumber })))).toBe(1200);
    expect(estimateWorkoutCalories({ sets: [{ ...row, setNumber: 99 }] }).volume.totalVolumeKgReps).toBe(400);
  });
  it("additional sets increase work and energy without double counting", () => {
    const one = estimateWorkoutCalories({ sets: [row] });
    const two = estimateWorkoutCalories({ sets: [row, row] });
    expect(two.volume.totalVolumeKgReps).toBe(one.volume.totalVolumeKgReps * 2);
    expect(two.volume.externalWorkJ).toBeCloseTo(one.volume.externalWorkJ * 2);
    expect(two.volume.resistanceKcal).toBeGreaterThan(one.volume.resistanceKcal);
  });
  it("uses positive displacement and J→kcal/assumed efficiency without a full MET overlay", () => {
    const d = estimateWorkoutCalories({ sets: [row], bodyWeightKg: 80 });
    const a = WORKOUT_VOLUME_ASSUMPTIONS;
    expect(d.volume.externalWorkJ).toBeCloseTo(40 * 10 * a.gravityMPerSecondSquared * 0.35);
    expect(d.volume.externalEnergyKcal).toBeCloseTo(d.volume.externalWorkJ / 4184 / 0.25);
    expect(d.volume.resistanceKcal).toBeCloseTo(d.volume.externalEnergyKcal + d.volume.bodyMovementEnergyKcal
      + d.volume.internalSupportKcal + d.volume.recoveryKcal);
    expect(d.resistanceKcal).toBe(Math.round(d.volume.resistanceKcal));
    expect(d.components[0].source).toBe(WORKOUT_CALORIE_VERSION);
  });
  it("same tonnage can have different assumed mechanical and body-work costs", () => {
    const squat = estimateWorkoutCalories({ sets: [{ ...row, exerciseName: "Squat" }], bodyWeightKg: 80 });
    const curl = estimateWorkoutCalories({ sets: [{ ...row, exerciseName: "Biceps Curl" }], bodyWeightKg: 80 });
    expect(squat.volume.totalVolumeKgReps).toBe(curl.volume.totalVolumeKgReps);
    expect(squat.volume.externalWorkJ).toBeGreaterThan(curl.volume.externalWorkJ);
    expect(squat.volume.bodyMovementWorkJ).toBeGreaterThan(curl.volume.bodyMovementWorkJ);
  });
  it("caps extreme mechanical values and discloses saturation rather than implying accuracy", () => {
    const d = estimateWorkoutCalories({ sets: [{ ...row, weight: 1000, reps: 200 }], bodyWeightKg: 20 });
    expect(d.volume.totalVolumeKgReps).toBe(200000);
    expect(d.volume.capped).toBe(true);
    expect(d.volume.resistanceKcal).toBeLessThanOrEqual(d.volume.capKcal + 1e-9);
    expect(d.warnings.join(" ")).toMatch(/安全上限/);
    expect(d.rangeMeaning).toBe("heuristic_not_confidence_interval");
  });
});

describe("bodyweight, timed strength and incomplete equipment data", () => {
  it.each(["Push-up", "Pull-up", "Squat", "Crunch"])("%s with zero or missing load has meaningful body/support work", exerciseName => {
    for (const weight of [null, 0]) {
      const d = estimateWorkoutCalories({ sets: [{ exerciseName, reps: 12, weight }], bodyWeightKg: 70 });
      expect(d.activeKcal).toBeGreaterThan(0);
      expect(d.volume.totalVolumeKgReps).toBe(0);
      expect(d.volume.externalEnergyKcal).toBe(0);
      expect(d.volume.bodyMovementEnergyKcal).toBeGreaterThan(0);
    }
  });
  it("missing external load is not fabricated and gives warning plus nonzero support", () => {
    const d = estimateWorkoutCalories({ sets: [{ ...row, weight: null }] });
    expect(d.volume.totalVolumeKgReps).toBe(0);
    expect(d.volume.missingLoadSets).toBe(1);
    expect(d.volume.externalWorkJ).toBe(0);
    expect(d.volume.internalSupportKcal).toBeGreaterThan(0);
    expect(d.warnings.join(" ")).toMatch(/缺少負重/);
  });
  it("known timed strength without reps does not infer cardio or invented volume", () => {
    const timed = { exerciseName: "Chest Press Machine", duration: 2, weight: 40 };
    expect(isCardioSet(timed)).toBe(false);
    const d = estimateWorkoutCalories({ sets: [timed] });
    expect(d.cardioMinutes).toBe(0);
    expect(d.activeKcal).toBeGreaterThan(0);
    expect(d.volume.totalReps).toBe(0);
    expect(d.volume.externalWorkJ).toBe(0);
    expect(d.warnings.join(" ")).toMatch(/不反推次數/);
  });
  it("isometric zero external work is not zero metabolic support", () => {
    const low = estimateWorkoutCalories({ sets: [{ exerciseName: "Plank", duration: 2, weight: 0, reps: 10 }], bodyWeightKg: 60 });
    const high = estimateWorkoutCalories({ sets: [{ exerciseName: "Plank", duration: 2, weight: 40, reps: 10 }], bodyWeightKg: 60 });
    expect(high.volume.externalWorkJ).toBe(0);
    expect(high.volume.bodyMovementWorkJ).toBe(0);
    expect(high.activeKcal).toBe(4);
    expect(high.activeKcal).toBe(low.activeKcal);
    expect(high.warnings.join(" ")).toMatch(/等長/);
  });
  it("flags ambiguous equipment and never silently doubles dumbbells or multiplies pulleys", () => {
    const d = estimateWorkoutCalories({ sets: [{ ...row, exerciseName: "Dumbbell Bench Press" }, { ...row, exerciseName: "Cable Curl" }] });
    expect(d.volume.totalVolumeKgReps).toBe(800);
    expect(d.volume.equipmentAmbiguousSets).toBe(2);
    expect(d.warnings.join(" ")).toMatch(/單邊／總重/);
    expect(d.volume.movements.every(m => m.equipmentAmbiguous)).toBe(true);
    expect(workoutMovementAssumption("Unknown machine").movementClass).toBe("generic_strength");
  });
  it("summary exposes volume, assumed movement, component kcal and model version", () => {
    const d = estimateWorkoutCalories({ sets: [row] });
    expect(calorieEstimateSummary(d)).toMatchObject({ modelVersion: WORKOUT_CALORIE_VERSION, totalVolumeKgReps: 400,
      volume: { totalVolumeKgReps: 400, completedSets: 1, assumedEfficiency: 0.25,
        movements: [{ movementClass: "upper_push", displacementM: 0.35 }] } });
  });
  it("leg press has a stable-body machine-lower assumption, not upper press or free squat", () => {
    const machine = workoutMovementAssumption("Leg Press Machine");
    expect(machine).toMatchObject({ movementClass: "machine_lower", displacementM: 0.3, bodyMassFraction: 0.02 });
    expect(machine.bodyMassFraction).toBeLessThan(workoutMovementAssumption("Squat").bodyMassFraction);
    expect(workoutMovementAssumption("腿推機").movementClass).toBe("machine_lower");
    expect(workoutMovementAssumption("Hack Squat").movementClass).toBe("machine_lower");
    expect(estimateWorkoutCalories({ sets: [{ ...row, exerciseName: "Leg Press Machine" }] }).volume.movements[0].movementClass).toBe("machine_lower");
  });
  it.each(["Hip Adduction", "Hip Abduction", "Adductor Machine", "髖內收", "髖外展"])("%s gets hip-isolation, including timed resistance without reps", exerciseName => {
    expect(workoutMovementAssumption(exerciseName)).toMatchObject({ movementClass: "hip_isolation", displacementM: 0.2, bodyMassFraction: 0.02 });
    expect(isCardioSet({ exerciseName, duration: 2 })).toBe(false);
    expect(estimateWorkoutCalories({ sets: [{ exerciseName, duration: 2 }] }).activeKcal).toBeGreaterThan(0);
  });
  it.each(["Assisted Pull-up", "Assisted Dips", "輔助引體向上", "輔助雙槓"])("%s excludes unconfirmed assistance from mechanical work but retains literal volume", exerciseName => {
    const low = estimateWorkoutCalories({ sets: [{ ...row, exerciseName, weight: 20 }] });
    const high = estimateWorkoutCalories({ sets: [{ ...row, exerciseName, weight: 60 }] });
    expect(low.volume.externalWorkJ).toBe(0);
    expect(high.volume.externalWorkJ).toBe(0);
    expect(high.volume.bodyMovementWorkJ).toBe(0);
    expect(high.volume.internalSupportKcal).toBeGreaterThan(0);
    expect(high.activeKcal).toBe(low.activeKcal);
    expect(high.volume.totalVolumeKgReps).toBe(600);
    expect(workoutVolume([{ ...row, exerciseName, weight: 60 }])).toBe(600);
    expect(high.warnings.join(" ")).toMatch(/配重不是新增舉重負荷/);
  });
});

describe("timing, reported values and safe historical reads", () => {
  it("larger reviewed or idle available times never become continuous resistance work", () => {
    const sets = [row, row, row];
    const d = estimateWorkoutCalories({ sets, verifiedDurationMinutes: 10 });
    expect(estimateWorkoutCalories({ sets, verifiedDurationMinutes: 180 }).activeKcal).toBe(d.activeKcal);
    expect(estimateWorkoutCalories({ sets, availableMinutes: 180 }).activeKcal).toBe(d.activeKcal);
    expect(d.resistanceMinutes).toBe(4);
    const short = estimateWorkoutCalories({ sets, verifiedDurationMinutes: 2 });
    expect(short.resistanceMinutes).toBe(2);
    expect(short.volume.resistanceKcal).toBeCloseTo(d.volume.resistanceKcal / 2);
    expect(short.volume.totalVolumeKgReps).toBe(d.volume.totalVolumeKgReps);
    expect(estimateWorkoutCalories({ sets, verifiedDurationMinutes: 0 }).activeKcal).toBe(0);
    expect(estimateWorkoutCalories({ sets: [], verifiedDurationMinutes: 180 }).activeKcal).toBe(0);
  });
  it("mixed cardio occupies its minutes and its report is used exactly once", () => {
    const cardio = { exerciseName: "Stationary Bike", duration: 20, calories: 130 };
    const d = estimateWorkoutCalories({ sets: [row, row, cardio], verifiedDurationMinutes: 21, bodyWeightKg: 80 });
    expect(d.resistanceMinutes).toBe(1);
    expect(d.cardioKcal).toBe(130);
    expect(d.activeKcal).toBe(Math.round(d.volume.resistanceKcal + 130));
    expect(d.volume.totalVolumeKgReps).toBe(800);
    expect(workoutVolume([{ ...cardio, weight: 99, reps: 30 }])).toBe(0);
    expect(estimateWorkoutCalories({ sets: [{ ...cardio, calories: 0 }] }).activeKcal).toBe(0);
    expect(estimateWorkoutCalories({ sets: [row, cardio], manualCalories: 0 }).activeKcal).toBe(0);
  });
  it("unsafe legacy reps/load are excluded, originals untouched, new invalid entries rejected", () => {
    const bad = [{ ...row, weight: Infinity }, { ...row, weight: -30 }, { ...row, reps: 1000000, duration: null }];
    const d = estimateWorkoutCalories({ sets: bad, tolerateInvalid: true });
    expect(Number.isFinite(d.activeKcal)).toBe(true);
    expect(d.volume.totalVolumeKgReps).toBe(0);
    expect(d.volume.completedSets).toBe(2);
    expect(workoutVolume(bad)).toBe(0);
    expect(bad[0].weight).toBe(Infinity);
    expect(() => estimateWorkoutCalories({ sets: bad })).toThrow(/kg/);
  });
  it.each([-1, Infinity, NaN, 10001])("unsafe old unknown/manual kcal %s cannot break all historical reads", caloriesBurned => {
    const s = { ...session, caloriesBurned };
    const d = buildWorkoutCalorieReadModel(s, [row]);
    expect(Number.isFinite(d.caloriesBurned)).toBe(true);
    expect(d.calorieDetails.manualCalories).toBeNull();
    expect(Object.is(d.rawOriginalCalories, caloriesBurned)).toBe(true);
    expect(d.calorieDetails.warnings.join(" ")).toMatch(/原始數值保留/);
    expect(() => estimateWorkoutCalories({ sets: [], manualCalories: caloriesBurned })).toThrow(/手動熱量/);
  });
  it("v1 automatic provenance, reviewed timing, weight override and raw original evidence survive without mutation", () => {
    const { volume, modelVersion, ...prior } = estimateWorkoutCalories({ sets: [row], bodyWeightKg: 80, verifiedDurationMinutes: 45 });
    const v1 = { ...prior, version: PREVIOUS_WORKOUT_CALORIE_VERSION, origin: "new", rawOriginalCalories: 777, manualCalories: null };
    const s = { ...session, calorieDetails: v1 };
    const d = buildWorkoutCalorieReadModel(s, [row]);
    expect(d.calorieReadModel).toBe("current");
    expect(d.calorieDetails.source).toBe("resistance_estimate");
    expect(d.calorieDetails.version).toBe(WORKOUT_CALORIE_VERSION);
    expect(d.rawOriginalCalories).toBe(777);
    expect(d.duration).toBe(45);
    expect(d.timeDetails.source).toBe("reviewed");
    expect(d.calorieDetails.bodyWeightKg).toBe(80);
    expect(d.calorieDetails.weightSource).toBe("session_override");
    expect(d.calorieDetails.manualCalories).toBeNull();
    expect(s.calorieDetails.version).toBe(PREVIOUS_WORKOUT_CALORIE_VERSION);
    expect(s.duration).toBe(694);
  });
  it("v1 manual zero and legacy origin stay distinct from missing manual values", () => {
    const v1 = { ...estimateWorkoutCalories({ sets: [row], manualCalories: 0, verifiedDurationMinutes: 0 }),
      version: PREVIOUS_WORKOUT_CALORIE_VERSION, origin: "legacy", rawOriginalCalories: 77 };
    const d = buildWorkoutCalorieReadModel({ ...session, calorieDetails: v1 }, [row]);
    expect(d.caloriesBurned).toBe(0);
    expect(d.duration).toBe(0);
    expect(d.calorieReadModel).toBe("manual_preserved");
    expect(d.calorieDetails.origin).toBe("legacy");
    expect(d.rawOriginalCalories).toBe(77);
  });
  it("invalid v1 reviewed minutes stay unknown, never converted into reviewed zero or wall time", () => {
    const v1 = { ...estimateWorkoutCalories({ sets: [row] }), version: PREVIOUS_WORKOUT_CALORIE_VERSION,
      timing: { mode: "historical", verifiedDurationMinutes: 694 } };
    const d = buildWorkoutCalorieReadModel({ ...session, calorieDetails: v1 }, [row]);
    expect(d.duration).toBeNull();
    expect(d.calorieDetails.timing.verifiedDurationMinutes).toBeNull();
    expect(d.timeDetails.source).toBe("unknown");
  });
});
