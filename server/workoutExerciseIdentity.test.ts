import { describe, expect, it } from "vitest";
import { buildUnifiedExerciseCatalog, getCanonicalExerciseName, getExerciseHistoryNames, REVIEWED_EXERCISE_MERGES } from "../shared/workoutExerciseIdentity";

describe("reviewed exercise identity", () => {
  it("folds the exact-name Hip Abduction pair without changing inputs or inventing per-source history", () => {
    const raw = [{ name: "Hip Abduction", equipment: "Machine", muscleGroup: "glute_medius" }, { name: "Hip Abduction", equipment: "Machine", muscleGroup: "glutes", id: 5, isCustom: true, instructions: "Sit with back supported, push outer pads outward." }];
    const original = JSON.stringify(raw);
    const out = buildUnifiedExerciseCatalog(raw, [{ exerciseName: "Hip Abduction", setRows: 15, sessionCount: 4 }]);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Hip Abduction");
    expect(out[0].id).toBe(5);
    expect(JSON.stringify(raw)).toBe(original);
    expect(getExerciseHistoryNames(out[0].name)).toEqual(["Hip Abduction"]);
  });
  it("keeps existing higher-use name, with missing counts not treated as evidence of equivalence", () => {
    const raw = [{ name: "Abdominal Crunch Machine", equipment: "Machine" }, { name: "Abdominal Crunch", equipment: "Machine", id: 12, isCustom: true }];
    const out = buildUnifiedExerciseCatalog(raw, [{ exerciseName: "Abdominal Crunch", setRows: 40, sessionCount: 10 }]);
    expect(out[0].name).toBe("Abdominal Crunch");
    expect(out[0].aliases).toContain("Abdominal Crunch Machine");
    expect(getCanonicalExerciseName(" Abdominal   Crunch Machine ")).toBe("Abdominal Crunch");
    expect(getExerciseHistoryNames("Abdominal Crunch Machine")).toEqual(["Abdominal Crunch", "Abdominal Crunch Machine"]);
  });
  it("uses record count before metadata when both reviewed names have history", () => {
    const out = buildUnifiedExerciseCatalog([{ name: "Triceps Extension", equipment: "Machine", id: 7, isCustom: true }, { name: "Triceps Extension Machine", equipment: "Machine" }], [{ exerciseName: "Triceps Extension", setRows: 20, sessionCount: 5 }, { exerciseName: "Triceps Extension Machine", setRows: 3, sessionCount: 1 }]);
    expect(out[0].name).toBe("Triceps Extension");
  });
  it("preserves Cable as search/filter alias for the compatible general Lat Pulldown", () => {
    const out = buildUnifiedExerciseCatalog([{ name: "Lat Pulldown", equipment: "Cable" }, { name: "Lat Pulldown", equipment: "Machine", id: 4, isCustom: true }]);
    expect(out).toHaveLength(1);
    expect(out[0].equipmentAliases).toEqual(["Cable", "Machine"]);
  });
  it("does not fold dumbbell or cable movements into reviewed machine aliases", () => {
    const out = buildUnifiedExerciseCatalog([{ name: "Triceps Extension", equipment: "Machine" }, { name: "Triceps Extension Machine", equipment: "Machine" }, { name: "Triceps Extension", equipment: "Dumbbell" }, { name: "Tricep Pushdown", equipment: "Cable" }]);
    expect(out).toHaveLength(3);
    expect(out.some(v => v.equipment === "Dumbbell")).toBe(true);
  });
  it("does not merge machine models, angles, support positions or unresolved fly names", () => {
    const names = ["Pec Deck", "Pectoral Fly", "MTS Decline Press", "Iso-Lateral Decline Press", "Decline Press Machine", "Plate Loaded Lat Raise", "Lateral Raise Machine", "Lateral Raise", "Incline Press", "Incline Press Machine", "Hyperextension", "Back Extension", "Standing Calf Raise", "Seated Calf Raise", "Triceps Machine", "Dual Bicep Curl Machine", "Biceps Curl Machine"];
    expect(buildUnifiedExerciseCatalog(names.map(name => ({ name, equipment: "Machine" })))).toHaveLength(names.length);
    for (const name of names) expect(getCanonicalExerciseName(name)).toBe(name);
  });
  it("preserves contradictory same-name high-row descriptions with a readable distinction", () => {
    const out = buildUnifiedExerciseCatalog([{ name: "Iso-Lateral High Row", equipment: "Machine", instructions: "Sit with chest pad" }, { name: "Iso-Lateral High Row", equipment: "Machine", isCustom: true, id: 13, instructions: "Lie prone" }]);
    expect(out).toHaveLength(2);
    expect(out[0].variantLabel).not.toEqual(out[1].variantLabel);
    expect(out.every(v => v.identityNotice?.includes("未合併"))).toBe(true);
  });
  it("has exactly six reviewed groups and no automatic guide-ID merge", () => {
    expect(REVIEWED_EXERCISE_MERGES).toHaveLength(6);
    expect(getExerciseHistoryNames("Leg Curl")).toEqual(["Leg Curl"]);
    expect(getExerciseHistoryNames("Pectoral Fly")).toEqual(["Pectoral Fly"]);
    expect(getExerciseHistoryNames("MTS Decline Press")).toEqual(["MTS Decline Press"]);
  });
});
