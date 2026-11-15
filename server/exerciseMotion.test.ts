import { describe, expect, it } from "vitest";
import { EXERCISE_GUIDES, getExerciseGuide } from "../shared/exerciseGuides";
import {
  EXERCISE_MOTIONS,
  getExerciseMotion,
  getMotionApparatus,
  getMotionPose,
  type MotionId,
  type Point3,
} from "../shared/exerciseMotion";

const phaseSamples = [
  0, 0.01, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 0.99, 1,
];
const distance = (a: Point3, b: Point3) =>
  Math.hypot(...a.map((v, i) => v - b[i]));

describe("exact generic simplified motion registry", () => {
  it("aliases canonical types, metadata and matching without duplicating the 18 records", () => {
    expect(EXERCISE_MOTIONS).toBe(EXERCISE_GUIDES);
    expect(getExerciseMotion).toBe(getExerciseGuide);
    expect(EXERCISE_MOTIONS).toHaveLength(18);
    expect(new Set(EXERCISE_MOTIONS.map(s => s.id)).size).toBe(18);
    for (const spec of EXERCISE_MOTIONS) {
      for (const alias of spec.aliases) {
        expect(getExerciseMotion(` ${alias.toUpperCase()} `)).toBe(spec);
        for (const equipment of spec.equipment) {
          expect(getExerciseMotion(alias, equipment.toUpperCase())).toBe(spec);
        }
      }
    }
    expect(getExerciseMotion("  Lat   Pulldown ", " Cable ")?.id).toBe(
      "lat-pulldown"
    );
  });

  it.each([
    ["Unknown Fly", "Machine"],
    ["custom Pec Deck", "Machine"],
    ["Lat Pulldown Plus", "Cable"],
    ["Pec Deck", "Dumbbell"],
    ["Chest Press", "Barbell"],
    ["glutes", "Machine"],
    ["", "Machine"],
  ])("never substitutes unmatched %s / %s", (name, equipment) => {
    expect(getExerciseMotion(name, equipment)).toBeNull();
  });

  it.each(EXERCISE_MOTIONS)(
    "$id has bounded finite movement with safe closed endpoints",
    spec => {
      const start = getMotionPose(spec.id, 0);
      expect(getMotionPose(spec.id, 1)).toEqual(start);
      expect(getMotionPose(spec.id, 0.5)).not.toEqual(start);
      for (const phase of phaseSamples) {
        const pose = getMotionPose(spec.id, phase);
        for (const value of Object.values(pose).flat(2)) {
          if (typeof value === "number") {
            expect(Number.isFinite(value)).toBe(true);
            expect(Math.abs(value)).toBeLessThan(3);
          }
        }
        expect(pose.contraction).toBeGreaterThanOrEqual(0);
        expect(pose.contraction).toBeLessThanOrEqual(1);
        for (const segment of getMotionApparatus(spec.id, pose).segments) {
          for (const value of [...segment.a, ...segment.b]) {
            expect(Number.isFinite(value)).toBe(true);
            expect(Math.abs(value)).toBeLessThan(3);
          }
        }
        const returned = getMotionPose(spec.id, 1 - phase);
        for (const key of ["hands", "knees", "feet", "neck"] as const) {
          const values = pose[key].flat();
          returned[key]
            .flat()
            .forEach((v, i) => expect(v).toBeCloseTo(values[i], 10));
        }
      }
    }
  );

  it("has 18 distinct human paths and 18 distinct apparatus families", () => {
    const human = EXERCISE_MOTIONS.map(({ id }) =>
      JSON.stringify(phaseSamples.map(p => getMotionPose(id, p)))
    );
    const apparatus = EXERCISE_MOTIONS.map(({ id }) =>
      JSON.stringify(getMotionApparatus(id, getMotionPose(id, 0)).segments)
    );
    expect(new Set(human).size).toBe(18);
    expect(new Set(apparatus).size).toBe(18);
  });

  it("lowers the front pull-down bar with stable hips and feet", () => {
    const start = getMotionPose("lat-pulldown", 0);
    const pull = getMotionPose("lat-pulldown", 0.5);
    expect(pull.hands[0][1]).toBeLessThan(start.hands[0][1]);
    expect(pull.hands[0][2]).toBeGreaterThan(0);
    expect(pull.hip).toEqual(start.hip);
    expect(pull.feet).toEqual(start.feet);
  });

  it("separates forward, inclined and declined press directions", () => {
    for (const [id, vertical] of [
      ["chest-press", 0],
      ["incline-press", 1],
      ["decline-press", -1],
    ] as const) {
      const a = getMotionPose(id, 0).hands[0];
      const b = getMotionPose(id, 0.5).hands[0];
      expect(b[2]).toBeGreaterThan(a[2]);
      expect(Math.sign(b[1] - a[1])).toBe(vertical);
    }
    expect(getMotionPose("pec-deck", 0.5).hands[1][0]).toBeLessThan(
      getMotionPose("pec-deck", 0).hands[1][0]
    );
  });

  it("uses stationary knees and an ankle arc for seated extension/curl, not pulldown geometry", () => {
    for (const id of ["leg-extension", "leg-curl"] as const) {
      const start = getMotionPose(id, 0);
      for (const p of phaseSamples) {
        const pose = getMotionPose(id, p);
        expect(pose.hip).toEqual(start.hip);
        expect(pose.knees).toEqual(start.knees);
        expect(distance(pose.knees[0], pose.feet[0])).toBeCloseTo(0.4, 10);
        const parts = getMotionApparatus(id, pose).segments;
        expect(parts.some(s => s.part.startsWith("ankle-roller"))).toBe(true);
        expect(parts.some(s => s.kind === "cable")).toBe(false);
      }
    }
    expect(getMotionPose("leg-extension", 0.5).feet[0][1]).toBeGreaterThan(
      getMotionPose("leg-extension", 0).feet[0][1]
    );
    expect(getMotionPose("leg-curl", 0.5).feet[0][1]).toBeLessThan(
      getMotionPose("leg-curl", 0).feet[0][1]
    );
    expect(getMotionPose("leg-curl", 0.5).feet[0][2]).toBeLessThan(
      getMotionPose("leg-curl", 0).feet[0][2]
    );
  });

  it("keeps curl/extension upper arms on pads and forearms on a fixed elbow arc", () => {
    for (const id of ["biceps-curl", "triceps-extension"] as const) {
      const start = getMotionPose(id, 0);
      for (const phase of phaseSamples) {
        const pose = getMotionPose(id, phase);
        expect(pose.elbows).toEqual(start.elbows);
        expect(distance(pose.elbows[0], pose.hands[0])).toBeCloseTo(0.3, 10);
      }
    }
  });

  it("leg press retains leg lengths, a stable pelvis and a bent-knee endpoint", () => {
    const start = getMotionPose("leg-press", 0);
    const end = getMotionPose("leg-press", 0.5);
    expect(end.feet[0][2]).toBeGreaterThan(start.feet[0][2]);
    for (const phase of phaseSamples) {
      const pose = getMotionPose("leg-press", phase);
      expect(pose.hip).toEqual(start.hip);
      for (const i of [0, 1]) {
        expect(distance(pose.hips[i], pose.knees[i])).toBeCloseTo(0.48, 10);
        expect(distance(pose.knees[i], pose.feet[i])).toBeCloseTo(0.44, 10);
        expect(distance(pose.hips[i], pose.feet[i])).toBeLessThan(0.88);
      }
    }
  });

  it("adduction closes inward pads while abduction opens outward pads with synchronized feet", () => {
    for (const id of ["hip-adduction", "hip-abduction"] as const) {
      const start = getMotionPose(id, 0);
      const end = getMotionPose(id, 0.5);
      if (id === "hip-adduction")
        expect(Math.abs(end.knees[0][0])).toBeLessThan(
          Math.abs(start.knees[0][0])
        );
      else
        expect(Math.abs(end.knees[0][0])).toBeGreaterThan(
          Math.abs(start.knees[0][0])
        );
      for (const phase of phaseSamples) {
        const pose = getMotionPose(id, phase);
        const parts = getMotionApparatus(id, pose).segments;
        for (const i of [0, 1]) {
          const pad = parts.find(s => s.part === `knee-contact-${i}`)!;
          expect(pad.a).toEqual(pose.knees[i]);
          expect(pose.feet[i][0]).toBe(pose.knees[i][0]);
          expect(Math.sign(pad.b[0] - pad.a[0])).toBe(
            (i ? 1 : -1) * (id === "hip-adduction" ? -1 : 1)
          );
        }
      }
    }
  });

  it.each(EXERCISE_MOTIONS)(
    "$id moving handles and pads share the human contact coordinates",
    ({ id }) => {
      for (const phase of phaseSamples) {
        const pose = getMotionPose(id, phase);
        const segments = getMotionApparatus(id, pose).segments;
        if (id === "lat-pulldown") {
          const bar = segments.find(s => s.part === "wide-pull-bar")!;
          expect(bar.a).toEqual(pose.hands[0]);
          expect(bar.b).toEqual(pose.hands[1]);
        } else {
          for (const i of [0, 1])
            expect(segments.find(s => s.part === `hand-grip-${i}`)?.a).toEqual(
              pose.hands[i]
            );
        }
        if (id === "leg-press") {
          for (const i of [0, 1])
            expect(
              segments.find(s => s.part === `foot-contact-${i}`)?.a
            ).toEqual(pose.feet[i]);
        }
        if (id === "leg-curl" || id === "leg-extension") {
          for (const i of [0, 1])
            expect(
              segments.find(s => s.part === `ankle-roller-${i}`)?.a
            ).toEqual(pose.feet[i]);
        }
      }
    }
  );

  it.each([NaN, Infinity, -Infinity, -3, 99])(
    "clamps invalid phase %s",
    phase => {
      for (const { id } of EXERCISE_MOTIONS) {
        expect(getMotionPose(id as MotionId, phase)).toEqual(
          getMotionPose(id, Number.isFinite(phase) && phase > 1 ? 1 : 0)
        );
      }
    }
  );
});
