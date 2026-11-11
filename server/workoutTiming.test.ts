import { describe, expect, it } from "vitest";
import { estimateWorkoutCalories } from "../shared/workoutCalories";
import { getWorkoutTimeDetails, reviewedWorkoutDurationInput } from "../shared/workoutTiming";
import { buildWorkoutCalorieReadModel, planWorkoutCreation } from "./workoutCalorieService";

const now = new Date("2026-11-11T20:00:00+08:00");
const sets = Array.from({ length: 5 }, () => ({ exerciseName: "Bench Press", reps: 12, weight: 40 }));
const session = { id: 1, startTime: "2026-11-11T19:00:00+08:00", duration: 60, caloriesBurned: null };

describe("actual workout time is independent of calorie effective minutes", () => {
  it("returns original 60 minutes rather than the 8-minute reps heuristic, without promoting it to reviewed", () => {
    const model = buildWorkoutCalorieReadModel(session, sets);
    expect(model.calorieEstimate.effectiveMinutes).toBe(8);
    expect(model.duration).toBe(60);
    expect(model.timeDetails).toEqual({ actualMinutes: 60, source: "original", needsReview: true });
    expect(reviewedWorkoutDurationInput(model)).toBe("");
  });
  it("corrupt 694 minutes is unknown, never replaced by 8 minutes", () => {
    const model = buildWorkoutCalorieReadModel({ ...session, duration: 694 }, sets);
    expect(model.duration).toBeNull();
    expect(model.rawDuration).toBe(694);
    expect(model.timeDetails).toEqual({ actualMinutes: null, source: "unknown", needsReview: true });
    expect(model.calorieEstimate.effectiveMinutes).toBe(8);
    expect(reviewedWorkoutDurationInput(model)).toBe("");
  });
  it("reviewed metadata 45 wins over original/corrupt duration and is the only safe prefill", () => {
    const calorieDetails = estimateWorkoutCalories({ sets, verifiedDurationMinutes: 45 });
    calorieDetails.origin = "legacy";
    const model = buildWorkoutCalorieReadModel({ ...session, duration: 694, calorieDetails }, sets);
    expect(model.duration).toBe(45);
    expect(model.timeDetails).toEqual({ actualMinutes: 45, source: "reviewed", needsReview: false });
    expect(reviewedWorkoutDurationInput(model)).toBe("45");
  });
  it.each([0, 180])("keeps valid original %s minutes unverified", duration => {
    expect(getWorkoutTimeDetails({ ...session, duration })).toEqual({ actualMinutes: duration, source: "original", needsReview: true });
  });
  it.each([null, NaN, Infinity, -1, 181])("unknown or corrupt %s cannot masquerade as actual time", duration => {
    expect(getWorkoutTimeDetails({ ...session, duration }).source).toBe("unknown");
  });
  it("new unreviewed creation stores unknown duration, not a guessed zero or heuristic", () => {
    expect(planWorkoutCreation({ date: "2026-11-11" }, now).duration).toBeNull();
  });
  it("only new live sessions expose real wallclock elapsed, not old noon anchors", () => {
    expect(getWorkoutTimeDetails(session, now).elapsedMinutes).toBeUndefined();
    const live = { ...session, ...planWorkoutCreation({ date: "2026-11-11" }, new Date("2026-11-11T19:00:00+08:00")) };
    expect(getWorkoutTimeDetails(live, now).elapsedMinutes).toBe(60);
    const historical = { ...session, ...planWorkoutCreation({ date: "2026-11-01" }, now) };
    expect(getWorkoutTimeDetails(historical, now).elapsedMinutes).toBeUndefined();
  });
  it("invalid verified metadata cannot be silently reclassified as reviewed zero", () => {
    const calorieDetails = estimateWorkoutCalories({ sets });
    calorieDetails.timing.verifiedDurationMinutes = 694;
    const model = buildWorkoutCalorieReadModel({ ...session, duration: null, calorieDetails }, sets);
    expect(model.duration).toBeNull();
    expect(model.calorieDetails.timing.verifiedDurationMinutes).toBeNull();
  });
});
