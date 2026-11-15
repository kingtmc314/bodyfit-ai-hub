/** Original, generic educational geometry, not branded machines, measured joint angles,
 * muscle activation or an assessment of the viewer's posture. No asset/network access.
 * Matching and coaching metadata have one source of truth: exerciseGuides.
 */
import {
  EXERCISE_GUIDES,
  getExerciseGuide,
  type ExerciseGuideId,
  type ExerciseGuideSpec,
} from "./exerciseGuides";

export type MotionId = ExerciseGuideId;
export type ExerciseMotionSpec = ExerciseGuideSpec;
export const EXERCISE_MOTIONS = EXERCISE_GUIDES;
/** Deliberately exact: never infer a motion from a muscle group or a partial name. */
export const getExerciseMotion = getExerciseGuide;

export type Point3 = [number, number, number];
type Pair = [Point3, Point3];
export interface MotionPose {
  hip: Point3;
  neck: Point3;
  head: Point3;
  shoulders: Pair;
  elbows: Pair;
  hands: Pair;
  hips: Pair;
  knees: Pair;
  feet: Pair;
  /** Artistic cycle progress only; not a muscle-activation measurement. */
  contraction: number;
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const pair = (fn: (side: number, index: number) => Point3): Pair => [
  fn(-1, 0),
  fn(1, 1),
];

/** A stable two-link bend for a reachable artistic target; no anatomical claim. */
export function elbowBetween(a: Point3, b: Point3, side: number): Point3 {
  const delta = b.map((v, i) => v - a[i]);
  const distance = Math.hypot(...delta);
  const unit = delta.map(v => v / (distance || 1));
  const hint = [side, 0, -0.6];
  const dot = hint.reduce((sum, v, i) => sum + v * unit[i], 0);
  const normal = hint.map((v, i) => v - unit[i] * dot);
  const length = Math.hypot(...normal) || 1;
  const bend = Math.sqrt(Math.max(0, 0.35 ** 2 - distance ** 2 / 4));
  return a.map(
    (v, i) => v + delta[i] / 2 + (normal[i] / length) * bend
  ) as Point3;
}

/** phase 0 → 0.5 is the working stroke; 0.5 → 1 retraces the return stroke.
 * Invalid phases are clamped, not accumulated into unbounded coordinates.
 */
export function getMotionPose(id: MotionId, phase: number): MotionPose {
  const p = Math.max(0, Math.min(1, Number.isFinite(phase) ? phase : 0));
  const t = (1 - Math.cos(2 * Math.PI * p)) / 2;
  let hip: Point3 = [0, 0.84, 0];
  let neck: Point3 = [0, 1.46, 0];
  if (id === "leg-press") {
    hip = [0, 0.7, -0.22];
    neck = [0, 1.31, -0.43];
  } else if (id === "ab-crunch") {
    neck = [0, mix(1.46, 1.3, t), mix(0, 0.32, t)];
  } else if (id === "back-extension") {
    neck = [0, mix(1.28, 1.46, t), mix(0.36, 0, t)];
  }
  const shoulders = pair(s => [s * 0.23, neck[1] - 0.06, neck[2]]);
  const hands = pair(s => {
    switch (id) {
      case "lat-pulldown":
        return [s * 0.48, mix(1.94, 1.35, t), mix(0.1, 0.34, t)];
      case "high-row":
        return [s * mix(0.4, 0.35, t), mix(1.82, 1.15, t), mix(0.4, 0.27, t)];
      case "seated-row":
        return [s * 0.2, 1.15, mix(0.6, 0.2, t)];
      case "chest-press":
        return [s * 0.3, 1.3, mix(0.22, 0.59, t)];
      case "incline-press":
        return [s * 0.3, mix(1.42, 1.65, t), mix(0.2, 0.5, t)];
      case "decline-press":
        return [s * 0.3, mix(1.23, 1.02, t), mix(0.23, 0.48, t)];
      case "shoulder-press":
        return [s * mix(0.45, 0.33, t), mix(1.52, 1.99, t), 0.08];
      case "pec-deck":
        // Bent elbows remain in front of the torso during the closing arc.
        return [s * mix(0.63, 0.12, t), 1.33, mix(0.12, 0.6, t)];
      case "lateral-raise":
        return [s * mix(0.26, 0.69, t), mix(0.92, 1.4, t), 0.12];
      case "biceps-curl":
      case "triceps-extension": {
        // Fixed upper arms on a preacher/arm pad; forearm follows an elbow arc.
        const angle =
          id === "biceps-curl" ? mix(-0.55, 0.95, t) : mix(0.8, -0.8, t);
        return [
          s * 0.27,
          1.13 + Math.sin(angle) * 0.3,
          0.3 + Math.cos(angle) * 0.3,
        ];
      }
      case "ab-crunch":
        return [s * 0.25, neck[1] - 0.16, neck[2] + 0.16];
      case "back-extension":
        return [s * 0.33, 0.9, 0.32];
      default:
        return [s * 0.33, 0.82, 0.15];
    }
  });
  const hips = pair(s => [
    s * (id === "leg-press" ? 0.17 : 0.14),
    hip[1],
    hip[2],
  ]);
  const pressFoot: Point3 = [0, mix(0.31, 0.36, t), mix(0.4, 0.56, t)];
  const knees = pair(s => {
    if (id === "hip-abduction" || id === "hip-adduction") {
      const spread =
        id === "hip-abduction" ? mix(0.15, 0.48, t) : mix(0.48, 0.15, t);
      return [s * spread, 0.48, 0.38];
    }
    if (id === "leg-press") {
      // Solve a two-link leg in the sagittal plane. The plate moves while the
      // hip stays on the pad; the end is deliberately short of full extension.
      const dy = pressFoot[1] - hip[1];
      const dz = pressFoot[2] - hip[2];
      const distance = Math.hypot(dy, dz);
      const along = (0.48 ** 2 - 0.44 ** 2 + distance ** 2) / (2 * distance);
      const bend = Math.sqrt(Math.max(0, 0.48 ** 2 - along ** 2));
      return [
        s * 0.17,
        hip[1] + (dy * along + dz * bend) / distance,
        hip[2] + (dz * along - dy * bend) / distance,
      ];
    }
    if (id === "seated-row") return [s * 0.16, 0.56, 0.41];
    return [s * 0.16, 0.48, 0.39];
  });
  const feet = pair((s, i) => {
    // Seated extension and seated curl pivot about a stationary knee.
    if (id === "leg-extension" || id === "leg-curl") {
      const angle =
        id === "leg-extension" ? mix(-1.5, -0.1, t) : mix(-0.12, -2.05, t);
      return [
        s * 0.16,
        0.48 + Math.sin(angle) * 0.4,
        0.39 + Math.cos(angle) * 0.4,
      ];
    }
    if (id === "leg-press") {
      return [s * 0.17, pressFoot[1], pressFoot[2]];
    }
    if (id === "hip-abduction" || id === "hip-adduction") {
      return [knees[i][0], 0.08, 0.43];
    }
    if (id === "seated-row") return [s * 0.16, 0.12, 0.76];
    return [s * 0.16, 0.08, 0.43];
  });
  const elbows: Pair =
    id === "biceps-curl" || id === "triceps-extension"
      ? pair(s => [s * 0.27, 1.13, 0.3])
      : [
          elbowBetween(shoulders[0], hands[0], -1),
          elbowBetween(shoulders[1], hands[1], 1),
        ];
  return {
    hip,
    neck,
    head: [neck[0], neck[1] + 0.22, neck[2]],
    shoulders,
    elbows,
    hands,
    hips,
    knees,
    feet,
    contraction: t,
  };
}

export type ApparatusKind =
  | "frame"
  | "lever"
  | "cable"
  | "pad"
  | "handle"
  | "footplate";
export interface ApparatusSegment {
  part: string;
  kind: ApparatusKind;
  a: Point3;
  b: Point3;
}
export interface MotionApparatus {
  segments: ApparatusSegment[];
}

/** All moving contact points derive from the same pose as the human. Apparatus
 * families are intentionally distinct, but are not replicas of particular machines.
 */
export function getMotionApparatus(
  id: MotionId,
  pose: MotionPose
): MotionApparatus {
  const segments: ApparatusSegment[] = [];
  const add = (part: string, kind: ApparatusKind, a: Point3, b: Point3) =>
    segments.push({ part, kind, a, b });
  const hip = pose.hip;
  add("base", "frame", [-0.85, 0.03, -0.3], [0.85, 0.03, 0.85]);
  add("seat-post", "frame", [0, 0.03, hip[2]], [0, hip[1] - 0.08, hip[2]]);
  add(
    "seat",
    "pad",
    [-0.29, hip[1] - 0.04, hip[2]],
    [0.29, hip[1] - 0.04, hip[2] + 0.12]
  );
  if (!["seated-row", "high-row", "ab-crunch", "back-extension"].includes(id)) {
    add(
      "back-pad",
      "pad",
      [0, hip[1], hip[2] - 0.12],
      [0, pose.neck[1] - 0.09, pose.neck[2] - 0.12]
    );
  }
  const hand = (i: number) => {
    const h = pose.hands[i];
    add(`hand-grip-${i}`, "handle", h, [h[0], h[1] + 0.07, h[2]]);
  };
  const sideLevers = (pivot: Point3) => {
    for (const i of [0, 1]) {
      const s = i === 0 ? -1 : 1;
      add(
        `arm-pivot-${i}`,
        "frame",
        [s * 0.6, 0.03, -0.25],
        [s * pivot[0], pivot[1], pivot[2]]
      );
      add(
        `arm-lever-${i}`,
        "lever",
        [s * pivot[0], pivot[1], pivot[2]],
        pose.hands[i]
      );
      hand(i);
    }
  };
  switch (id) {
    case "lat-pulldown": {
      add("tower", "frame", [-0.76, 0.03, -0.26], [-0.76, 2.19, -0.26]);
      add("overhead-beam", "frame", [-0.76, 2.19, -0.26], [0, 2.19, 0.15]);
      const h = pose.hands[0];
      add("overhead-cable", "cable", [0, 2.19, 0.15], [0, h[1], h[2]]);
      add("wide-pull-bar", "handle", pose.hands[0], pose.hands[1]);
      add("thigh-restraint", "pad", [-0.3, 0.7, 0.28], [0.3, 0.7, 0.28]);
      break;
    }
    case "seated-row":
      add("low-pulley-stand", "frame", [0, 0.03, 1.05], [0, 1.1, 1.05]);
      for (const i of [0, 1]) {
        const f = pose.feet[i];
        add(
          `row-footplate-${i}`,
          "footplate",
          [f[0], f[1] - 0.03, f[2]],
          [f[0], f[1] + 0.2, f[2] + 0.08]
        );
        add(`row-cable-${i}`, "cable", [0, 1.1, 1.05], pose.hands[i]);
        hand(i);
      }
      break;
    case "chest-press":
      sideLevers([0.6, 1.75, -0.22]);
      break;
    case "incline-press":
      sideLevers([0.58, 1.93, -0.32]);
      add("inclined-support", "frame", [0, 0.25, -0.48], [0, 1.44, -0.17]);
      break;
    case "decline-press":
      sideLevers([0.56, 0.65, -0.24]);
      add(
        "low-press-crossbar",
        "frame",
        [-0.56, 0.65, -0.24],
        [0.56, 0.65, -0.24]
      );
      break;
    case "shoulder-press":
      sideLevers([0.64, 1.27, -0.32]);
      add("overhead-upright", "frame", [0, 0.03, -0.4], [0, 1.95, -0.4]);
      break;
    case "pec-deck":
      // Top-mounted butterfly arms, with forearm pads rather than a pull-down bar.
      sideLevers([0.55, 1.96, -0.1]);
      add("fly-crossbeam", "frame", [-0.55, 1.96, -0.1], [0.55, 1.96, -0.1]);
      for (const i of [0, 1]) {
        add(`fly-forearm-pad-${i}`, "pad", pose.elbows[i], pose.hands[i]);
      }
      break;
    case "high-row":
      sideLevers([0.65, 2.13, 0.72]);
      add("chest-support-post", "frame", [0, 0.03, 0.3], [0, 1.23, 0.3]);
      add("chest-pad", "pad", [0, 1.1, 0.19], [0, 1.34, 0.19]);
      break;
    case "leg-press": {
      const z = pose.feet[0][2];
      add("sled-rail-left", "frame", [-0.43, 0.19, 0.42], [-0.43, 0.5, 1.34]);
      add("sled-rail-right", "frame", [0.43, 0.19, 0.42], [0.43, 0.5, 1.34]);
      add(
        "sled-footplate",
        "footplate",
        [-0.38, pose.feet[0][1], z],
        [0.38, pose.feet[1][1], z]
      );
      add(
        "sled-plate-height",
        "footplate",
        [0, pose.feet[0][1] - 0.1, z],
        [0, pose.feet[0][1] + 0.25, z]
      );
      for (const i of [0, 1]) {
        add(`foot-contact-${i}`, "footplate", pose.feet[i], pose.feet[i]);
        hand(i);
      }
      break;
    }
    case "leg-extension":
    case "leg-curl":
      for (const i of [0, 1]) {
        const k = pose.knees[i];
        add(`knee-pivot-${i}`, "frame", [k[0], 0.03, k[2]], k);
        add(`shin-lever-${i}`, "lever", k, pose.feet[i]);
        add(`ankle-roller-${i}`, "pad", pose.feet[i], [
          pose.feet[i][0] + (i ? 0.07 : -0.07),
          pose.feet[i][1],
          pose.feet[i][2],
        ]);
        hand(i);
      }
      if (id === "leg-curl") {
        add("curl-thigh-lock", "pad", [-0.3, 0.66, 0.23], [0.3, 0.66, 0.23]);
      } else {
        add(
          "extension-front-support",
          "frame",
          [-0.3, 0.15, 0.6],
          [0.3, 0.15, 0.6]
        );
      }
      break;
    case "hip-adduction":
    case "hip-abduction":
      for (const i of [0, 1]) {
        const k = pose.knees[i];
        const offset = (i ? 1 : -1) * (id === "hip-adduction" ? -0.08 : 0.08);
        add(`hip-swing-arm-${i}`, "lever", [pose.hips[i][0], 0.65, 0.03], k);
        add(`knee-contact-${i}`, "pad", k, [k[0] + offset, k[1] + 0.12, k[2]]);
        add(`hip-footrest-${i}`, "footplate", pose.feet[i], [
          pose.feet[i][0],
          pose.feet[i][1],
          pose.feet[i][2] + 0.15,
        ]);
        hand(i);
      }
      break;
    case "biceps-curl":
    case "triceps-extension":
      add("arm-pad-post", "frame", [0, 0.03, 0.3], [0, 1.05, 0.3]);
      for (const i of [0, 1]) {
        add(
          `upper-arm-pad-${i}`,
          "pad",
          [pose.shoulders[i][0], 1.3, 0.13],
          pose.elbows[i]
        );
        add(`elbow-lever-${i}`, "lever", pose.elbows[i], pose.hands[i]);
        hand(i);
      }
      add(
        id === "biceps-curl" ? "curl-front-pivot" : "extension-low-pivot",
        "frame",
        [-0.45, id === "biceps-curl" ? 1.05 : 0.8, 0.32],
        [0.45, id === "biceps-curl" ? 1.05 : 0.8, 0.32]
      );
      break;
    case "lateral-raise":
      for (const i of [0, 1]) {
        const s = i ? 1 : -1;
        add(
          `shoulder-pivot-${i}`,
          "frame",
          [s * 0.39, 0.03, -0.12],
          [s * 0.39, 1.42, -0.12]
        );
        add(`raise-arm-${i}`, "lever", [s * 0.39, 1.42, -0.12], pose.elbows[i]);
        add(`upper-arm-lift-pad-${i}`, "pad", pose.elbows[i], [
          pose.elbows[i][0],
          pose.elbows[i][1] + 0.07,
          pose.elbows[i][2],
        ]);
        hand(i);
      }
      break;
    case "ab-crunch":
      add("crunch-pivot", "frame", [-0.52, 0.03, 0.08], [-0.52, 0.94, 0.08]);
      for (const i of [0, 1]) {
        add(
          `crunch-lever-${i}`,
          "lever",
          [i ? 0.52 : -0.52, 0.94, 0.08],
          pose.hands[i]
        );
        add(`crunch-arm-pad-${i}`, "pad", pose.elbows[i], pose.hands[i]);
        hand(i);
      }
      add("crunch-foot-lock", "pad", pose.feet[0], pose.feet[1]);
      break;
    case "back-extension":
      add("back-pivot", "frame", [-0.46, 0.03, -0.22], [-0.46, 0.87, -0.22]);
      add(
        "back-swing-lever",
        "lever",
        [0, 0.87, -0.22],
        [0, pose.neck[1] - 0.16, pose.neck[2] - 0.1]
      );
      add(
        "moving-back-pad",
        "pad",
        [-0.25, pose.neck[1] - 0.16, pose.neck[2] - 0.1],
        [0.25, pose.neck[1] - 0.16, pose.neck[2] - 0.1]
      );
      add("back-foot-rest", "footplate", pose.feet[0], pose.feet[1]);
      hand(0);
      hand(1);
      break;
  }
  return { segments };
}
