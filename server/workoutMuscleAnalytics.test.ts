import { describe, expect, it } from "vitest";
import {
  getMuscleAnalysisBounds,
  isMuscleAnalysisDate,
  muscleAnalysisHKDate,
} from "../shared/workoutMuscleAnalytics";
import {
  buildWorkoutMuscleAnalysis,
  type MuscleAnalyticsExercise,
  type MuscleAnalyticsSet,
} from "./workoutMuscleAnalytics";

const input = { period: "all" as const, anchorDate: "2026-11-15" };
const session = {
  id: 1,
  startTime: new Date("2026-11-15T00:00:00+08:00"),
  endTime: null,
};
const saved = (
  id: number,
  exerciseName: string,
  rest: Partial<MuscleAnalyticsSet> = {}
): MuscleAnalyticsSet => ({
  id,
  sessionId: 1,
  exerciseName,
  reps: 10,
  weight: 30,
  ...rest,
});
const exercise = (
  id: number,
  name: string,
  rest: Partial<MuscleAnalyticsExercise> = {}
): MuscleAnalyticsExercise => ({
  id,
  name,
  muscleGroup: "other",
  source: "exercises",
  ...rest,
});

describe("Hong Kong muscle analysis calendar boundaries", () => {
  it("moves the UTC day at HK midnight, independent of host timezone", () => {
    expect(muscleAnalysisHKDate("2026-11-14T15:59:59.999Z")).toBe("2026-11-14");
    expect(muscleAnalysisHKDate("2026-11-14T16:00:00.000Z")).toBe("2026-11-15");
  });
  it("uses Monday to Sunday weeks across year boundaries", () => {
    const bounds = getMuscleAnalysisBounds({
      period: "week",
      anchorDate: "2026-01-01",
    });
    expect(bounds.range).toEqual({
      startDate: "2025-12-29",
      endDate: "2026-01-04",
    });
    expect(bounds.startTimeInclusive?.toISOString()).toBe(
      "2025-12-28T16:00:00.000Z"
    );
    expect(bounds.endTimeExclusive?.toISOString()).toBe(
      "2026-01-04T16:00:00.000Z"
    );
    expect(
      getMuscleAnalysisBounds({ period: "week", anchorDate: "2026-11-09" })
        .range
    ).toEqual({ startDate: "2026-11-09", endDate: "2026-11-15" });
    expect(
      getMuscleAnalysisBounds({ period: "week", anchorDate: "2026-11-15" })
        .range
    ).toEqual({ startDate: "2026-11-09", endDate: "2026-11-15" });
  });
  it("handles leap months, December and full calendar years", () => {
    expect(
      getMuscleAnalysisBounds({ period: "month", anchorDate: "2024-02-29" })
        .range
    ).toEqual({ startDate: "2024-02-01", endDate: "2024-02-29" });
    expect(
      getMuscleAnalysisBounds({ period: "month", anchorDate: "2026-02-15" })
        .range
    ).toEqual({ startDate: "2026-02-01", endDate: "2026-02-28" });
    const december = getMuscleAnalysisBounds({
      period: "month",
      anchorDate: "2026-12-31",
    });
    expect(december.range).toEqual({
      startDate: "2026-12-01",
      endDate: "2026-12-31",
    });
    expect(december.endTimeExclusive?.toISOString()).toBe(
      "2026-12-31T16:00:00.000Z"
    );
    const year = getMuscleAnalysisBounds({
      period: "year",
      anchorDate: "2024-06-30",
    });
    expect(year.range).toEqual({
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });
    expect(year.startTimeInclusive?.toISOString()).toBe(
      "2023-12-31T16:00:00.000Z"
    );
    expect(year.endTimeExclusive?.toISOString()).toBe(
      "2024-12-31T16:00:00.000Z"
    );
  });
  it("rejects impossible and non-canonical dates", () => {
    for (const date of [
      "2026-02-29",
      "2026-04-31",
      "2026-13-01",
      "2026-00-01",
      "2026-1-01",
      "2026-01-00",
      "not-a-date",
      "0000-01-01",
      "2026-11-15T00:00:00Z",
    ]) {
      expect(isMuscleAnalysisDate(date)).toBe(false);
      expect(() =>
        getMuscleAnalysisBounds({ period: "week", anchorDate: date })
      ).toThrow();
    }
    expect(isMuscleAnalysisDate("2024-02-29")).toBe(true);
    expect(isMuscleAnalysisDate("0099-02-28")).toBe(true);
  });
  it("uses a half-open HK interval, including final millisecond but excluding next midnight", () => {
    const times = [
      "2026-11-08T15:59:59.999Z",
      "2026-11-08T16:00:00.000Z",
      "2026-11-15T15:59:59.999Z",
      "2026-11-15T16:00:00.000Z",
    ];
    const sessions = times.map((startTime, i) => ({ id: i + 1, startTime }));
    const result = buildWorkoutMuscleAnalysis(
      { period: "week", anchorDate: "2026-11-15" },
      sessions,
      sessions.map(s => saved(s.id, "Bench Press", { sessionId: s.id }))
    );
    expect(result.sessionCount).toBe(2);
    expect(result.setCount).toBe(2);
    expect(result.totalVolumeKg).toBe(600);
  });
  it("all-history includes old and post-anchor sessions, with observed first/last HK dates", () => {
    const sessions = [
      {
        id: 1,
        startTime: "2010-01-01T16:00:00Z",
        endTime: "2010-01-01T17:00:00Z",
      },
      { id: 2, startTime: "2026-11-14T16:00:00Z", finished: true },
      { id: 3, startTime: "2027-02-01T16:00:00Z" },
    ];
    const result = buildWorkoutMuscleAnalysis(input, sessions, []);
    expect(result.range).toEqual({
      startDate: "2010-01-02",
      endDate: "2027-02-02",
    });
    expect(result.sessionCount).toBe(3);
    expect(result.completedSessionCount).toBe(2);
    expect(getMuscleAnalysisBounds(input).startTimeInclusive).toBeNull();
    expect(getMuscleAnalysisBounds(input).endTimeExclusive).toBeNull();
  });
});

describe("saved-set primary attribution and secondary participation", () => {
  it("divides multiple primaries equally and conserves volume without rounding each contribution", () => {
    const result = buildWorkoutMuscleAnalysis(
      input,
      [session],
      [
        saved(1, "Deadlift", { reps: 7, weight: 43 }),
        saved(2, "Squat", { reps: 8, weight: 50 }),
        saved(3, "Bench Press", { reps: 10, weight: 20 }),
      ]
    );
    expect(result.totalVolumeKg).toBe(901);
    expect(result.mappedVolumeKg).toBe(901);
    expect(
      result.muscles.reduce((sum, row) => sum + row.directVolumeKg, 0)
    ).toBeCloseTo(901, 10);
    expect(
      result.muscles.reduce((sum, row) => sum + row.directVolumeSharePct, 0)
    ).toBeCloseTo(100, 10);
    expect(
      result.muscles.reduce((sum, row) => sum + row.allocatedPrimarySetCount, 0)
    ).toBeCloseTo(3, 10);
    expect(
      result.muscles.find(row => row.muscle === "glutes")?.directVolumeKg
    ).toBeCloseTo(301 / 3 + 200, 10);
    expect(result.coverage.exerciseMappedSetCount).toBe(3);
    expect(result.coverage.mappedSetCoveragePct).toBe(100);
    expect(result.totalReps).toBe(25);
  });
  it("keeps secondary-only muscles at zero direct volume and avoids adding secondary kg", () => {
    const result = buildWorkoutMuscleAnalysis(
      input,
      [session],
      [saved(1, "Bench Press"), saved(2, "Bench Press")]
    );
    expect(result.muscles.find(row => row.muscle === "chest")).toMatchObject({
      directVolumeKg: 600,
      primarySetCount: 2,
      allocatedPrimarySetCount: 2,
      secondarySetCount: 0,
      directVolumeSharePct: 100,
    });
    for (const muscle of ["triceps", "shoulders"]) {
      expect(result.muscles.find(row => row.muscle === muscle)).toMatchObject({
        directVolumeKg: 0,
        primarySetCount: 0,
        secondarySetCount: 2,
        secondaryParticipationPct: 100,
      });
    }
    expect(
      result.muscles.reduce((sum, row) => sum + row.directVolumeKg, 0)
    ).toBe(600);
    expect(
      result.muscles.reduce(
        (sum, row) => sum + row.secondaryParticipationPct,
        0
      )
    ).toBe(200);
    expect(result.definitions.secondaryParticipation).toMatch(
      /must not be summed/
    );
    expect(result.definitions.directAttribution).toMatch(
      /not measured activation, growth or fatigue/
    );
  });
  it("counts each persisted set once, even duplicate rows, but preserves same-name distinct saved sets", () => {
    const one = saved(1, "Squat");
    const result = buildWorkoutMuscleAnalysis(
      input,
      [session, session],
      [one, one, saved(2, "Squat"), saved(3, "Bench Press", { sessionId: 999 })]
    );
    expect(result.sessionCount).toBe(1);
    expect(result.setCount).toBe(2);
    expect(result.totalVolumeKg).toBe(600);
  });
  it("resolves persisted exercise ID first, then canonical saved and Chinese names", () => {
    const catalog = [
      exercise(7, "Bench Press", { muscleGroup: "Glutes", nameZh: "臥推" }),
      exercise(8, "Squat", { muscleGroup: "quads" }),
    ];
    const result = buildWorkoutMuscleAnalysis(
      input,
      [session],
      [
        saved(1, "Old label", { exerciseId: 7 }),
        saved(2, "臥推"),
        saved(3, "  bEnCh   PrEsS "),
        saved(4, "Squat", { exerciseId: 999 }),
      ],
      catalog
    );
    expect(
      result.muscles.find(row => row.muscle === "chest")?.directVolumeKg
    ).toBe(900);
    expect(
      result.muscles.find(row => row.muscle === "glutes")?.directVolumeKg
    ).toBe(150);
    expect(result.coverage.exerciseMappedSetCount).toBe(4);
  });
  it("uses custom name metadata without mixing colliding IDs from separate exercise tables", () => {
    const catalog = [
      exercise(1, "Bench Press"),
      exercise(1, "Custom Machine", {
        source: "custom_exercises",
        muscleGroup: "Hamstrings",
      }),
    ];
    const result = buildWorkoutMuscleAnalysis(
      input,
      [session],
      [saved(1, "Custom Machine"), saved(2, "Old name", { exerciseId: 1 })],
      catalog
    );
    expect(
      result.muscles.find(row => row.muscle === "hamstrings")?.directVolumeKg
    ).toBe(300);
    expect(
      result.muscles.find(row => row.muscle === "chest")?.directVolumeKg
    ).toBe(300);
    expect(result.coverage.categoryMappedSetCount).toBe(1);
    expect(result.coverage.exerciseMappedSetCount).toBe(1);
  });
  it("supports expanded canonical category IDs instead of limiting to the old anatomical keys", () => {
    const catalog = [
      exercise(1, "Custom inner thigh", { muscleGroup: "Adductors" }),
      exercise(2, "Custom side hip", { muscleGroup: "glute_medius" }),
      exercise(3, "Custom spinal machine", { muscleGroup: "lower_back" }),
    ];
    const result = buildWorkoutMuscleAnalysis(
      input,
      [session],
      catalog.map(e => saved(e.id, e.name)),
      catalog
    );
    expect(result.muscles.map(row => row.muscle).sort()).toEqual([
      "adductors",
      "glute_medius",
      "lower_back",
    ]);
    expect(result.warnings).toEqual([]);
  });
  it("keeps raw unknown categories and exposes unmapped source coverage without inventing muscles", () => {
    const catalog = [
      exercise(1, "Mystery machine", {
        muscleGroup: "User Special 42",
        category: "Unrecognized type",
      }),
    ];
    const result = buildWorkoutMuscleAnalysis(
      input,
      [session],
      [
        saved(1, "Bench Press"),
        saved(2, "Mystery machine"),
        saved(3, "Mystery machine"),
        saved(4, "Deleted machine"),
      ],
      catalog
    );
    expect(result.totalVolumeKg).toBe(1200);
    expect(result.mappedVolumeKg).toBe(300);
    expect(result.unmappedVolumeKg).toBe(900);
    expect(result.unattributedVolumeKg).toBe(900);
    expect(result.coverage).toMatchObject({
      mappedSetCoveragePct: 25,
      mappedVolumeCoveragePct: 25,
      unmappedSetCount: 3,
      unmappedSourceCount: 2,
    });
    expect(
      result.muscles.reduce((sum, row) => sum + row.directVolumeSharePct, 0)
    ).toBe(25);
    expect(result.muscles.some(row => row.muscle === "user special 42")).toBe(
      false
    );
    expect(
      result.unmappedSources.find(
        source => source.exerciseName === "Mystery machine"
      )
    ).toMatchObject({
      muscleGroup: "User Special 42",
      category: "Unrecognized type",
      setCount: 2,
      volumeKg: 600,
    });
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: "unknown_muscle_category",
        rawCategory: "User Special 42",
        setCount: 2,
      })
    );
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: "unknown_activity_category",
        rawCategory: "Unrecognized type",
        setCount: 2,
      })
    );
  });
});

describe("strength, cardio, timed and missing-load coverage", () => {
  it("preserves valid zero and null weights without assuming body mass or fabricating volume", () => {
    const result = buildWorkoutMuscleAnalysis(
      input,
      [session],
      [
        saved(1, "Push-up", { weight: 0 }),
        saved(2, "Bench Press", { weight: null }),
        saved(3, "Bench Press", { weight: undefined }),
        saved(4, "Bench Press", { weight: 15, reps: null }),
        saved(5, "Bench Press", { weight: 15, reps: 0 }),
      ]
    );
    expect(result.totalVolumeKg).toBe(0);
    expect(result.totalReps).toBe(30);
    expect(result.bodyweightSetCount).toBe(1);
    expect(result.missingWeightSetCount).toBe(2);
    expect(result.coverage.unweightedStrengthSetCount).toBe(5);
    expect(result.coverage.invalidValueSetCount).toBe(0);
    expect(result.muscles.every(row => row.directVolumeSharePct === 0)).toBe(
      true
    );
    expect(result.coverage.mappedSetCoveragePct).toBe(100);
    expect(result.coverage.mappedVolumeCoveragePct).toBe(0);
  });
  it("excludes corrupt load/repetition values, retaining valid reps independently", () => {
    const result = buildWorkoutMuscleAnalysis(
      input,
      [session],
      [
        saved(1, "Bench Press", { weight: -1 }),
        saved(2, "Bench Press", { weight: NaN }),
        saved(3, "Bench Press", { weight: Infinity }),
        saved(4, "Bench Press", { reps: -1 }),
        saved(5, "Bench Press", { reps: 2.5 }),
        saved(6, "Bench Press", { reps: 2, weight: Number.MAX_VALUE }),
      ]
    );
    expect(result.totalVolumeKg).toBe(0);
    expect(result.totalReps).toBe(32);
    expect(result.coverage.invalidValueSetCount).toBe(6);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: "invalid_set_values", setCount: 6 })
    );
  });
  it("keeps timed resistance strength and unknown duration-only activity unclassified, not assumed cardio", () => {
    const catalog = [
      exercise(1, "Custom isometric", {
        muscleGroup: "core",
        category: "strength",
        equipment: "Bodyweight",
      }),
      exercise(2, "Custom cardio", { muscleGroup: "cardio" }),
    ];
    const result = buildWorkoutMuscleAnalysis(
      input,
      [session],
      [
        saved(1, "Plank", { reps: null, weight: null, duration: 2 }),
        saved(2, "Custom isometric", { reps: null, weight: null, duration: 3 }),
        saved(3, "Stationary Bike", { reps: null, weight: null, duration: 20 }),
        saved(4, "Custom cardio", { reps: null, weight: null, duration: 15 }),
        saved(5, "Unknown timed machine", {
          reps: null,
          weight: null,
          duration: 5,
        }),
      ],
      catalog
    );
    expect(result.strengthSetCount).toBe(2);
    expect(result.cardioSetCount).toBe(2);
    expect(result.unclassifiedSetCount).toBe(1);
    expect(result.timedStrengthSetCount).toBe(2);
    expect(result.timedStrengthMinutes).toBe(5);
    expect(result.bodyweightSetCount).toBe(1);
    expect(
      result.muscles.reduce((sum, row) => sum + row.directTimedMinutes, 0)
    ).toBe(5);
    expect(result.totalVolumeKg).toBe(0);
    expect(result.unmappedSources).toHaveLength(1);
    expect(result.unmappedSources[0].reason).toBe("unclassified_activity");
  });
  it("counts anomalous but valid cardio weight × reps once, never attributing it to strength muscles", () => {
    const result = buildWorkoutMuscleAnalysis(
      input,
      [session],
      [saved(1, "Bench Press"), saved(2, "Treadmill")]
    );
    expect(result.totalVolumeKg).toBe(600);
    expect(result.strengthVolumeKg).toBe(300);
    expect(result.cardioVolumeKg).toBe(300);
    expect(result.mappedVolumeKg + result.unattributedVolumeKg).toBe(600);
    expect(
      result.muscles.reduce((sum, row) => sum + row.directVolumeKg, 0)
    ).toBe(300);
    expect(
      result.muscles.reduce((sum, row) => sum + row.directVolumeSharePct, 0)
    ).toBe(50);
  });
  it("includes sets in incomplete sessions and never mutates input or cached totals", () => {
    const sessions = [
      { ...session, totalVolume: 999999, caloriesBurned: 1000 },
    ];
    const sets = [saved(1, "Bench Press")];
    const before = JSON.stringify({ sessions, sets });
    const result = buildWorkoutMuscleAnalysis(input, sessions, sets);
    expect(result.completedSessionCount).toBe(0);
    expect(result.setCount).toBe(1);
    expect(result.totalVolumeKg).toBe(300);
    expect(JSON.stringify({ sessions, sets })).toBe(before);
  });
  it("returns honest empty ranges and finite zero-valued aggregates", () => {
    const all = buildWorkoutMuscleAnalysis(input, [], []);
    expect(all.range).toEqual({ startDate: null, endDate: null });
    expect(all.sessionCount).toBe(0);
    expect(all.setCount).toBe(0);
    expect(all.muscles).toEqual([]);
    expect(all.unmappedSources).toEqual([]);
    expect(all.warnings).toEqual([]);
    expect(all.coverage.mappedSetCoveragePct).toBe(0);
    expect(all.coverage.mappedVolumeCoveragePct).toBe(0);
    const month = buildWorkoutMuscleAnalysis(
      { period: "month", anchorDate: "2026-11-15" },
      [],
      []
    );
    expect(month.range).toEqual({
      startDate: "2026-11-01",
      endDate: "2026-11-30",
    });
  });
});
