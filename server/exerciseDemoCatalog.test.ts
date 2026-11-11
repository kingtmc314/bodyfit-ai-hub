import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import {
  exerciseDemoCatalog,
  exerciseDemoCoverage,
  getExerciseDemo,
  unavailableExerciseDemoNames,
} from "../shared/exerciseDemoCatalog";

function builtins(): Array<{ name: string; equipment: string }> {
  const text = readFileSync(
    new URL("../client/src/pages/Workout.tsx", import.meta.url),
    "utf8"
  );
  const source = ts.createSourceFile(
    "Workout.tsx",
    text,
    ts.ScriptTarget.Latest,
    true
  );
  let result: Array<{ name: string; equipment: string }> = [];
  function visit(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(source) === "BUILT_IN_EXERCISES" &&
      node.initializer &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      result = node.initializer.elements.map(element => {
        if (!ts.isObjectLiteralExpression(element))
          throw new Error("Unexpected builtin exercise shape");
        const fields: Record<string, string> = {};
        for (const property of element.properties) {
          if (
            ts.isPropertyAssignment(property) &&
            ts.isStringLiteral(property.initializer)
          )
            fields[property.name.getText(source)] = property.initializer.text;
        }
        return { name: fields.name, equipment: fields.equipment };
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return result;
}

describe("verified exercise demo catalog", () => {
  it("serves the exact canonical player contract and deliberate spelling aliases", () => {
    const demo = getExerciseDemo("Lat Pulldown", "Cable");
    expect(demo).toMatchObject({
      kind: "video",
      title: "Lat Pulldown",
      author: "FitnessScape",
      license: "CC BY 3.0",
    });
    expect(getExerciseDemo("  LAT PULL DOWN  ", "Cable machine")).toBe(demo);
    expect(getExerciseDemo("lat pulldown", "Machine")).toBeUndefined();
    expect(getExerciseDemo("Lat Pulldown", "Dumbbell")).toBeUndefined();
  });
  it("never substitutes Smith, shoulder press, machine fly, or a different row", () => {
    expect(getExerciseDemo("Bench Press", "Smith Machine")).toBeUndefined();
    expect(getExerciseDemo("Bench Press", "Barbell")?.title).toBe(
      "Bench Press"
    );
    expect(getExerciseDemo("Lat Pulldown", "Cable")?.title).not.toContain(
      "Shoulder"
    );
    expect(getExerciseDemo("Dumbbell Fly", "Dumbbell")).toBeUndefined();
    expect(getExerciseDemo("Cable Crossover", "Cable")).toBeUndefined();
    expect(getExerciseDemo("Rowing Machine", "Machine")).toBeUndefined();
    expect(getExerciseDemo("Leg Extension", "Machine")).toMatchObject({ kind: "youtube", title: "Leg Extension" });
    expect(getExerciseDemo("Leg Extension", "Cable")).toBeUndefined();
    expect(getExerciseDemo("Bench Press Extra", "Barbell")).toBeUndefined();
    expect(getExerciseDemo("My custom lat movement", "Cable")).toBeUndefined();
  });
  it("does not confuse core/abs categories or distinct abdominal motions", () => {
    for (const name of [
      "abs",
      "core",
      "Crunch",
      "Sit-up",
      "Cable Crunch",
      "Russian Twist",
      "Ab Wheel Rollout",
    ]) {
      expect(getExerciseDemo(name)).toBeUndefined();
    }
    // If added later, exact hanging leg raise must not map to hanging knee crunch.
    const hanging = getExerciseDemo("Hanging Leg Raise", "Pull-up Bar");
    expect(hanging === undefined || hanging.title === "Hanging Leg Raise").toBe(
      true
    );
  });
  it("all shipped assets have public HTTPS animated media plus per-media provenance", () => {
    expect(exerciseDemoCatalog.length).toBeGreaterThanOrEqual(15);
    for (const entry of exerciseDemoCatalog) {
      if (entry.kind === 'youtube') {
        expect(entry.url).toBe(`https://www.youtube-nocookie.com/embed/${entry.videoId}`);
        expect(entry.sourceUrl).toBe(`https://www.youtube.com/watch?v=${entry.videoId}`);
        expect(entry.videoId).toMatch(/^[a-zA-Z0-9_-]{11}$/);
        expect(entry.equipment).toBe('Machine');
        expect(entry.license).toContain('官方嵌入');
        expect(entry.license).not.toContain('CC BY');
        expect(entry.licenseUrl).toBe('https://www.youtube.com/t/terms');
      } else {
        expect(entry.url).toMatch(/^https:\/\/.+\.mp4$/);
        expect(entry.kind).toBe("video");
        expect(entry.sourceUrl).toMatch(/^https:\/\/(wger\.de\/api\/v2\/exerciseinfo\/\d+\/|commons\.wikimedia\.org\/wiki\/File:)/);
        expect(entry.license).toMatch(/^CC BY(?:-SA)? (3|4)\.0$/);
        expect(entry.licenseUrl).toMatch(/^https:\/\/creativecommons\.org\/licenses\//);
      }
      expect(entry.author).not.toBe("");
      expect(entry.sourceTitle).not.toBe("");
      expect(entry.originalUrl).toMatch(/^https:\/\//);
      expect(entry.changes).not.toBe("");
      expect(entry.verifiedAt).toBe("2026-11-11");
      expect(getExerciseDemo(entry.name, entry.equipment)).toBe(entry);
      if (entry.muscleGroup === 'abs') expect(entry.name).toBe('Abdominal Crunch');
    }
    expect(new Set(exerciseDemoCatalog.map(entry => entry.name)).size).toBe(
      exerciseDemoCatalog.length
    );
  });
  it("reports the actual builtin count and every unavailable name without claiming seventy", () => {
    const actual = builtins();
    expect(actual.length).toBe(exerciseDemoCoverage.builtinTotal);
    expect(exerciseDemoCatalog.length).toBe(exerciseDemoCoverage.shipped);
    expect(exerciseDemoCatalog.filter(entry => entry.kind === 'youtube')).toHaveLength(4);
    expect(exerciseDemoCatalog.filter(entry => entry.kind === 'video')).toHaveLength(20);
    expect(unavailableExerciseDemoNames.length).toBe(
      exerciseDemoCoverage.unavailable
    );
    expect(
      exerciseDemoCoverage.verified + exerciseDemoCoverage.unavailable
    ).toBe(actual.length);
    const available = actual.filter(exercise =>
      getExerciseDemo(exercise.name, exercise.equipment)
    );
    const missing = actual.filter(
      exercise => !getExerciseDemo(exercise.name, exercise.equipment)
    );
    expect(available.length).toBe(exerciseDemoCoverage.verified);
    expect(missing.map(exercise => exercise.name)).toEqual(
      unavailableExerciseDemoNames
    );
  });
  it('matches common saved machine names without mapping a floor crunch or freeweight fly', () => {
    expect(getExerciseDemo('Chest Press Machine', 'Machine')?.videoId).toBe('VLDg23FqQM0');
    expect(getExerciseDemo('Abdominal Crunch', 'Machine')?.videoId).toBe('o_0WrejFbAw');
    expect(getExerciseDemo('Abdominal Crunch', 'Bodyweight')).toBeUndefined();
    expect(getExerciseDemo('Pectoral Fly', 'Machine')?.videoId).toBe('N-DAB49l-cA');
    expect(getExerciseDemo('Pectoral Fly', 'Dumbbell')).toBeUndefined();
    expect(getExerciseDemo('Leg Extension', 'Machine')?.videoId).toBe('ZyWFzGyFwK0');
    expect(getExerciseDemo('Crunch', 'Machine')).toBeUndefined();
    expect(getExerciseDemo('Incline Press', 'Machine')).toBeUndefined();
    expect(getExerciseDemo('MTS Decline Press', 'Machine')).toBeUndefined();
  });
});
