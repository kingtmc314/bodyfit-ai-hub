import { describe, expect, it } from "vitest";
import {
  EXERCISE_MOTIONS,
  getExerciseMotion,
  getMotionPose,
  type MotionId,
} from "../shared/exerciseMotion";
import { getExerciseMuscles } from "../shared/exerciseMuscles";
import {
  ANATOMICAL_MUSCLES,
  getExerciseAnatomy,
  getMotionMuscleShapes,
  motionLimbContour,
  motionTorsoContour,
  projectMotionPoint,
} from "../shared/exerciseMotionMuscles";

const specFor = (id: MotionId) =>
  EXERCISE_MOTIONS.find(spec => spec.id === id)!;
const samples = [0, 0.125, 0.25, 0.5, 0.75, 1];

describe("qualitative motion muscle anatomy", () => {
  it.each(EXERCISE_MOTIONS)(
    "$id reuses guide / shared primary-secondary IDs without modifying the pose",
    spec => {
      const exercise = {
        name: spec.name,
        muscleGroup: "",
        equipment: spec.equipment[0],
      };
      const anatomy = getExerciseAnatomy(exercise);
      const existing = getExerciseMuscles(exercise);
      expect(anatomy.primary.map(m => m.id)).toEqual(existing.primary);
      expect(anatomy.secondary.map(m => m.id)).toEqual(existing.secondary);
      for (const phase of samples) {
        const pose = getMotionPose(spec.id, phase),
          before = JSON.stringify(pose);
        const shapes = getMotionMuscleShapes(spec, pose);
        expect(JSON.stringify(pose)).toBe(before);
        expect(
          Array.from(
            new Set(shapes.filter(m => m.role === "primary").map(m => m.id))
          ).sort()
        ).toEqual(spec.primary.slice().sort());
        expect(
          Array.from(
            new Set(shapes.filter(m => m.role === "secondary").map(m => m.id))
          ).sort()
        ).toEqual(spec.secondary.slice().sort());
        for (const shape of shapes) {
          expect(Object.hasOwn(ANATOMICAL_MUSCLES, shape.id)).toBe(true);
          expect(shape.path).toMatch(/^M.*Z$/);
          expect(shape.path).toMatch(/[CQ]/);
          expect(shape.fibers).toContain("Q");
          expect(shape.path + shape.fibers).not.toMatch(/NaN|Infinity/);
          expect(shape.center.every(Number.isFinite)).toBe(true);
          expect(
            shape.anchors.every(anchor =>
              [
                pose.neck,
                pose.hip,
                ...pose.shoulders,
                ...pose.elbows,
                ...pose.hands,
                ...pose.hips,
                ...pose.knees,
                ...pose.feet,
              ].includes(anchor)
            )
          ).toBe(true);
        }
      }
    }
  );

  it("names chest press pectoralis major and triceps, with anterior deltoid as a helper", () => {
    const anatomy = getExerciseAnatomy({
      name: "Chest Press",
      equipment: "Machine",
    });
    expect(anatomy.primary).toMatchObject([
      { id: "chest", zh: "胸大肌", en: "Pectoralis major" },
    ]);
    expect(anatomy.secondary).toMatchObject([
      { id: "triceps", en: "Triceps brachii" },
      { id: "shoulders", en: "Anterior deltoid" },
    ]);
    for (const phase of samples) {
      const pose = getMotionPose("chest-press", phase),
        shapes = getMotionMuscleShapes(specFor("chest-press"), pose);
      for (const i of [0, 1]) {
        expect(
          shapes.find(m => m.id === "triceps" && m.side === i)?.anchors
        ).toEqual([pose.shoulders[i], pose.elbows[i]]);
        expect(
          shapes.find(m => m.id === "shoulders" && m.side === i)?.anchors
        ).toEqual([pose.shoulders[i], pose.elbows[i]]);
      }
    }
    const armStart = getMotionMuscleShapes(
      specFor("chest-press"),
      getMotionPose("chest-press", 0)
    ).find(m => m.id === "triceps")!.path;
    const armEnd = getMotionMuscleShapes(
      specFor("chest-press"),
      getMotionPose("chest-press", 0.5)
    ).find(m => m.id === "triceps")!.path;
    expect(armEnd).not.toEqual(armStart);
  });

  it("keeps gluteus medius on the upper outer hip and adductors on the inner thigh", () => {
    const abduction = getExerciseAnatomy({
      name: "Hip Abduction",
      equipment: "Machine",
    });
    const adduction = getExerciseAnatomy({
      name: "Hip Adduction",
      equipment: "Machine",
    });
    expect(abduction.primary).toMatchObject([
      { id: "glute_medius", zh: "臀中肌", en: "Gluteus medius" },
    ]);
    expect(abduction.secondary.map(m => m.id)).toEqual(["glutes"]);
    expect(adduction.primary).toMatchObject([
      { id: "adductors", zh: "髖內收肌群", en: "Hip adductors" },
    ]);
    expect(adduction.secondary).toEqual([]);
    for (const phase of samples) {
      for (const id of ["hip-abduction", "hip-adduction"] as const) {
        const pose = getMotionPose(id, phase),
          shapes = getMotionMuscleShapes(specFor(id), pose);
        for (const i of [0, 1]) {
          const s = i ? 1 : -1;
          const shape = shapes.find(
            m =>
              m.id ===
                (id === "hip-abduction" ? "glute_medius" : "adductors") &&
              m.side === i
          )!;
          expect(shape.anchors).toEqual([pose.hips[i], pose.knees[i]]);
          if (id === "hip-abduction") {
            expect(
              (shape.center[0] - projectMotionPoint(pose.hips[i])[0]) * s
            ).toBeGreaterThan(0);
            expect(
              Math.abs(shape.center[1] - projectMotionPoint(pose.hips[i])[1])
            ).toBeLessThan(12);
          } else {
            const h = projectMotionPoint(pose.hips[i]),
              k = projectMotionPoint(pose.knees[i]);
            const fraction = 0.02 + (0.76 - 0.02) * 0.45;
            const axisX = h[0] + (k[0] - h[0]) * fraction;
            expect((shape.center[0] - axisX) * s).toBeLessThan(0);
          }
        }
      }
    }
  });

  it("leg extension highlights the stationary anterior thigh, NOT the swinging shin", () => {
    expect(
      getExerciseAnatomy({ name: "Leg Extension", equipment: "Machine" })
        .primary
    ).toMatchObject([{ id: "quads", en: "Quadriceps femoris" }]);
    const spec = specFor("leg-extension");
    const first = getMotionPose(spec.id, 0),
      last = getMotionPose(spec.id, 0.5);
    const a = getMotionMuscleShapes(spec, first),
      b = getMotionMuscleShapes(spec, last);
    expect(a.map(m => m.id)).toEqual([
      "quads",
      "quads",
      "quads",
      "quads",
      "quads",
      "quads",
    ]);
    expect(b.map(m => m.path)).toEqual(a.map(m => m.path));
    expect(last.knees).toEqual(first.knees);
    expect(last.feet).not.toEqual(first.feet);
    for (const shape of b)
      expect(shape.anchors).toEqual([
        last.hips[shape.side],
        last.knees[shape.side],
      ]);
  });

  it("lat pulldown uses broad back-side lats and biceps anchored to the unchanged elbow", () => {
    const anatomy = getExerciseAnatomy({
      name: "Lat Pulldown",
      equipment: "Cable",
    });
    expect(anatomy.primary).toMatchObject([
      { id: "lats", zh: "背闊肌", en: "Latissimus dorsi" },
    ]);
    expect(anatomy.secondary.map(m => m.id)).toEqual([
      "biceps",
      "shoulders",
      "back",
    ]);
    for (const phase of samples) {
      const pose = getMotionPose("lat-pulldown", phase),
        shapes = getMotionMuscleShapes(specFor("lat-pulldown"), pose);
      for (const i of [0, 1]) {
        expect(
          shapes.find(m => m.id === "lats" && m.side === i)?.anchors
        ).toEqual([pose.neck, pose.hip]);
        expect(
          shapes.find(m => m.id === "biceps" && m.side === i)?.anchors
        ).toEqual([pose.shoulders[i], pose.elbows[i]]);
      }
    }
  });

  it("torso contours follow live crunch / extension spine points without changing phase or camera", () => {
    expect(projectMotionPoint([0, 1, 0])).toEqual([185, 145]);
    for (const id of ["ab-crunch", "back-extension"] as const) {
      const a = getMotionPose(id, 0),
        b = getMotionPose(id, 0.5);
      expect(motionTorsoContour(a)).not.toEqual(motionTorsoContour(b));
      const start = getMotionMuscleShapes(specFor(id), a).find(
        m => m.role === "primary"
      )!;
      const end = getMotionMuscleShapes(specFor(id), b).find(
        m => m.role === "primary"
      )!;
      expect(start.path).not.toEqual(end.path);
      expect(motionLimbContour(a.shoulders[0], a.elbows[0], 7, 3)).toMatch(
        /^M.*Z$/
      );
    }
  });

  it.each([
    { name: "Chest Press", equipment: "Dumbbell", muscleGroup: "chest" },
    { name: "Pec Deck", equipment: "Dumbbell", muscleGroup: "chest" },
    { name: "Lat Pulldown custom", equipment: "Cable", muscleGroup: "lats" },
    {
      name: "Hip Abduction custom",
      equipment: "Machine",
      muscleGroup: "glutes",
    },
  ])(
    "known muscles never enable a mismatched / variant motion: $name / $equipment",
    exercise => {
      expect(getExerciseAnatomy(exercise).primary.length).toBeGreaterThan(0);
      expect(getExerciseMotion(exercise.name, exercise.equipment)).toBeNull();
    }
  );
});
