import { getExerciseMuscles } from "./exerciseMuscles";
import { getExerciseGuide } from "./exerciseGuides";
import type { ExerciseMotionSpec, MotionPose, Point3 } from "./exerciseMotion";

/** Qualitative educational anatomy only. Never used by the volume/health engines. */
export const ANATOMICAL_MUSCLES = {
  chest: {
    en: "Pectoralis major",
    zh: "胸大肌",
    locationEn: "Front of the chest",
    locationZh: "胸部前側",
  },
  shoulders: {
    en: "Deltoid",
    zh: "三角肌",
    locationEn: "Cap of the shoulder",
    locationZh: "肩關節外側的肌肉帽",
  },
  triceps: {
    en: "Triceps brachii",
    zh: "肱三頭肌",
    locationEn: "Back of the upper arm",
    locationZh: "上臂後側",
  },
  biceps: {
    en: "Biceps brachii",
    zh: "肱二頭肌",
    locationEn: "Front of the upper arm",
    locationZh: "上臂前側",
  },
  lats: {
    en: "Latissimus dorsi",
    zh: "背闊肌",
    locationEn: "Broad sides of the mid/lower back",
    locationZh: "背部兩側，由腋下延伸至腰背",
  },
  back: {
    en: "Rhomboids / middle trapezius",
    zh: "菱形肌／中斜方肌",
    locationEn: "Between the shoulder blades",
    locationZh: "兩側肩胛骨之間",
  },
  lower_back: {
    en: "Erector spinae",
    zh: "豎脊肌",
    locationEn: "Along both sides of the lumbar spine",
    locationZh: "腰椎兩旁",
  },
  traps: {
    en: "Trapezius",
    zh: "斜方肌",
    locationEn: "Upper back toward the neck",
    locationZh: "上背至頸部兩側",
  },
  forearms: {
    en: "Forearm flexors / extensors",
    zh: "前臂屈肌／伸肌群",
    locationEn: "Between the elbow and wrist",
    locationZh: "手肘至手腕之間",
  },
  abs: {
    en: "Rectus abdominis",
    zh: "腹直肌",
    locationEn: "Front of the abdomen",
    locationZh: "腹部前側",
  },
  obliques: {
    en: "Abdominal obliques",
    zh: "腹斜肌",
    locationEn: "Sides of the abdomen",
    locationZh: "腹部兩側",
  },
  quads: {
    en: "Quadriceps femoris",
    zh: "股四頭肌",
    locationEn: "Front of the thigh, above the knee",
    locationZh: "大腿前側，膝蓋上方",
  },
  hamstrings: {
    en: "Hamstrings",
    zh: "腿後肌群",
    locationEn: "Back of the thigh",
    locationZh: "大腿後側（股二頭肌、半腱肌、半膜肌）",
  },
  glutes: {
    en: "Gluteus maximus",
    zh: "臀大肌",
    locationEn: "Back of the hip / buttock",
    locationZh: "髖部後側、臀部的大塊肌肉",
  },
  glute_medius: {
    en: "Gluteus medius",
    zh: "臀中肌",
    locationEn: "Upper outer hip; partly beneath gluteus maximus",
    locationZh: "髖部外上側，部分位於臀大肌深層",
  },
  adductors: {
    en: "Hip adductors",
    zh: "髖內收肌群",
    locationEn: "Inner thigh (including adductor longus / magnus)",
    locationZh: "大腿內側（包括長收肌／大收肌）",
  },
  calves: {
    en: "Gastrocnemius / soleus",
    zh: "腓腸肌／比目魚肌",
    locationEn: "Back of the lower leg",
    locationZh: "小腿後側",
  },
} as const;
export type AnatomicalMuscleId = keyof typeof ANATOMICAL_MUSCLES;
export type MuscleRole = "primary" | "secondary";
export interface AnatomicalMuscle {
  id: AnatomicalMuscleId;
  role: MuscleRole;
  en: string;
  zh: string;
  locationEn: string;
  locationZh: string;
}
export interface ExerciseAnatomy {
  primary: AnatomicalMuscle[];
  secondary: AnatomicalMuscle[];
  basis: "exercise" | "category";
}
export type AnatomyExerciseInput = {
  name: string;
  muscleGroup?: string;
  equipment?: string;
};

export function getExerciseAnatomy(
  exercise: AnatomyExerciseInput
): ExerciseAnatomy {
  const muscles = getExerciseMuscles({
    ...exercise,
    muscleGroup: exercise.muscleGroup ?? "",
  });
  const guide = getExerciseGuide(exercise.name, exercise.equipment);
  const describe = (ids: string[], role: MuscleRole): AnatomicalMuscle[] =>
    Array.from(new Set(ids))
      .filter((id): id is AnatomicalMuscleId =>
        Object.hasOwn(ANATOMICAL_MUSCLES, id)
      )
      .map(id => {
        const item: AnatomicalMuscle = { id, role, ...ANATOMICAL_MUSCLES[id] };
        if (id === "shoulders" && guide) {
          if (
            [
              "chest-press",
              "incline-press",
              "decline-press",
              "pec-deck",
            ].includes(guide.id)
          ) {
            item.en = "Anterior deltoid";
            item.zh = "前三角肌";
          } else if (guide.id === "lateral-raise") {
            item.en = "Middle deltoid";
            item.zh = "中三角肌";
          } else if (["high-row", "seated-row"].includes(guide.id)) {
            item.en = "Posterior deltoid";
            item.zh = "後三角肌";
          }
        }
        return item;
      });
  return {
    primary: describe(muscles.primary, "primary"),
    secondary: describe(
      muscles.secondary.filter(id => !muscles.primary.includes(id)),
      "secondary"
    ),
    basis: muscles.basis,
  };
}

export type Point2 = [number, number];
/** Identical camera projection to the existing motion; anatomy never substitutes a pose. */
export const projectMotionPoint = (p: Point3): Point2 => [
  185 + p[0] * 108 + p[2] * 78,
  247 - p[1] * 102 - p[2] * 12,
];
const n = (v: number) => Number(v.toFixed(3));
const xy = (p: Point2) => `${n(p[0])} ${n(p[1])}`;
const lerp = (a: Point2, b: Point2, t: number): Point2 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];
const add = (a: Point2, b: Point2, scale = 1): Point2 => [
  a[0] + b[0] * scale,
  a[1] + b[1] * scale,
];
const normal = (a: Point2, b: Point2): Point2 => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
};

/** Closed tapered silhouette, wide muscle belly and narrow joint/tendon ends. */
export function motionLimbContour(
  a3: Point3,
  b3: Point3,
  width: number,
  endWidth: number
): string {
  const a = projectMotionPoint(a3),
    b = projectMotionPoint(b3),
    v = normal(a, b);
  return `M${xy(add(a, v, width * 0.56))} C${xy(add(lerp(a, b, 0.26), v, width))} ${xy(add(lerp(a, b, 0.72), v, endWidth * 1.25))} ${xy(add(b, v, endWidth))} Q${xy(b)} ${xy(add(b, v, -endWidth))} C${xy(add(lerp(a, b, 0.72), v, -endWidth * 1.25))} ${xy(add(lerp(a, b, 0.26), v, -width))} ${xy(add(a, v, -width * 0.56))} Q${xy(a)} ${xy(add(a, v, width * 0.56))} Z`;
}

export interface MotionMuscleShape {
  id: AnatomicalMuscleId;
  role: MuscleRole;
  side: number;
  path: string;
  fibers: string;
  center: Point2;
  /** The exact original 3D joints used to build this shape; also supports regression checks. */
  anchors: [Point3, Point3];
}

/** Muscle bellies, not colored bones. Anatomy stays attached to the existing two-link joints.
 * Posterior/deep regions are an explicitly labelled educational cutaway, not visible skin anatomy.
 */
export function getMotionMuscleShapes(
  spec: ExerciseMotionSpec,
  pose: MotionPose
): MotionMuscleShape[] {
  const shapes: MotionMuscleShape[] = [];
  const primary = new Set(spec.primary);
  const active = new Set([...spec.primary, ...spec.secondary]);
  const push = (
    id: AnatomicalMuscleId,
    side: number,
    path: string,
    fibers: string,
    center: Point2,
    anchors: [Point3, Point3]
  ) => {
    if (active.has(id))
      shapes.push({
        id,
        role: primary.has(id) ? "primary" : "secondary",
        side,
        path,
        fibers,
        center,
        anchors,
      });
  };
  const belly = (
    id: AnatomicalMuscleId,
    side: number,
    a3: Point3,
    b3: Point3,
    width: number,
    offset = 0,
    start = 0.1,
    end = 0.9
  ) => {
    const a0 = projectMotionPoint(a3),
      b0 = projectMotionPoint(b3),
      v = normal(a0, b0);
    const a = add(lerp(a0, b0, start), v, offset),
      b = add(lerp(a0, b0, end), v, offset);
    const c = lerp(a, b, 0.45);
    const path = `M${xy(a)} C${xy(add(lerp(a, b, 0.18), v, width))} ${xy(add(lerp(a, b, 0.62), v, width))} ${xy(b)} C${xy(add(lerp(a, b, 0.62), v, -width))} ${xy(add(lerp(a, b, 0.18), v, -width))} ${xy(a)} Z`;
    const fibers = [-0.35, 0, 0.35]
      .map(o => `M${xy(a)} Q${xy(add(c, v, width * o))} ${xy(b)}`)
      .join(" ");
    push(id, side, path, fibers, c, [a3, b3]);
  };
  const neck = projectMotionPoint(pose.neck),
    hip = projectMotionPoint(pose.hip);
  // Torso coordinates use the live spine axis, so crunch/extension patches bend with it.
  const torso = (u: number, t: number): Point2 => {
    const center = lerp(neck, hip, t);
    const width = 25 * (1 - t) + 15 * t;
    return [center[0] + u * width, center[1]];
  };
  const fan = (
    id: AnatomicalMuscleId,
    i: number,
    points: [number, number][]
  ) => {
    const s = i ? 1 : -1;
    const p = points.map(([u, t]) => torso(u * s, t));
    const path = `M${xy(p[0])} Q${xy(p[1])} ${xy(p[2])} Q${xy(p[3])} ${xy(p[4])} Q${xy(p[5])} ${xy(p[0])} Z`;
    const center = lerp(p[0], p[3], 0.55);
    const fibers = [0.25, 0.5, 0.75]
      .map(t => `M${xy(p[0])} Q${xy(center)} ${xy(lerp(p[2], p[4], t))}`)
      .join(" ");
    push(id, i, path, fibers, center, [pose.neck, pose.hip]);
  };
  for (const i of [0, 1]) {
    const s = i ? 1 : -1;
    // Broad fan-shaped pectorals and latissimus: not an entire colored torso.
    fan("chest", i, [
      [0.9, 0.15],
      [0.7, 0.08],
      [0.07, 0.19],
      [0.06, 0.49],
      [0.87, 0.4],
      [1.1, 0.27],
    ]);
    fan("lats", i, [
      [1, 0.24],
      [0.9, 0.55],
      [0.57, 0.89],
      [0.16, 0.78],
      [0.13, 0.57],
      [0.5, 0.3],
    ]);
    fan("back", i, [
      [0.12, 0.2],
      [0.55, 0.22],
      [0.8, 0.32],
      [0.53, 0.51],
      [0.12, 0.52],
      [0.05, 0.35],
    ]);
    fan("traps", i, [
      [0.12, 0.02],
      [0.4, 0.03],
      [0.95, 0.13],
      [0.57, 0.28],
      [0.12, 0.33],
      [0.04, 0.14],
    ]);
    fan("obliques", i, [
      [0.9, 0.5],
      [1.04, 0.63],
      [0.87, 0.92],
      [0.6, 0.98],
      [0.52, 0.77],
      [0.58, 0.52],
    ]);
    belly("lower_back", i, pose.neck, pose.hip, 4.2, s * 5, 0.53, 0.95);
    for (const row of [0, 1, 2]) {
      fan("abs", i, [
        [0.12, 0.47 + row * 0.15],
        [0.42, 0.45 + row * 0.15],
        [0.5, 0.49 + row * 0.15],
        [0.5, 0.57 + row * 0.15],
        [0.12, 0.58 + row * 0.15],
        [0.09, 0.52 + row * 0.15],
      ]);
    }
    belly(
      "biceps",
      i,
      pose.shoulders[i],
      pose.elbows[i],
      4.9,
      -s * 1.7,
      0.2,
      0.86
    );
    belly(
      "triceps",
      i,
      pose.shoulders[i],
      pose.elbows[i],
      5.1,
      s * 2.4,
      0.17,
      0.91
    );
    belly("forearms", i, pose.elbows[i], pose.hands[i], 3.2, 0, 0.14, 0.83);
    // A rounded deltoid cap follows the shoulder-to-elbow axis rather than a joint dot.
    belly(
      "shoulders",
      i,
      pose.shoulders[i],
      pose.elbows[i],
      8.3,
      s * 1.3,
      -0.08,
      0.46
    );
    // Quadriceps split into muscle-shaped central and medial/lateral bellies.
    belly("quads", i, pose.hips[i], pose.knees[i], 5.4, 0, 0.07, 0.93);
    belly("quads", i, pose.hips[i], pose.knees[i], 3.7, s * 4.7, 0.13, 0.95);
    belly("quads", i, pose.hips[i], pose.knees[i], 3.1, -s * 4.7, 0.2, 0.97);
    belly(
      "hamstrings",
      i,
      pose.hips[i],
      pose.knees[i],
      6.2,
      s * 1.6,
      0.1,
      0.94
    );
    // Normal direction varies with the unchanged camera; keep the inner-thigh
    // belly on the medial side for BOTH legs, not just one projected diagonal.
    const thighNormal = normal(
      projectMotionPoint(pose.hips[i]),
      projectMotionPoint(pose.knees[i])
    );
    const medialOffset = -s * 6.7 * (Math.sign(thighNormal[0]) || 1);
    belly(
      "adductors",
      i,
      pose.hips[i],
      pose.knees[i],
      4.8,
      medialOffset,
      0.02,
      0.76
    );
    belly("calves", i, pose.knees[i], pose.feet[i], 4.8, 0, 0.14, 0.72);
    const h = projectMotionPoint(pose.hips[i]);
    const k = projectMotionPoint(pose.knees[i]);
    const along = lerp(h, k, 0.2);
    const p = (dx: number, dy: number): Point2 => [h[0] + s * dx, h[1] + dy];
    const glutePath = `M${xy(p(-5, -3))} C${xy(p(9, -9))} ${xy(p(15, 5))} ${xy(p(10, 12))} Q${xy(p(0, 19))} ${xy(p(-7, 9))} Z`;
    push(
      "glutes",
      i,
      glutePath,
      `M${xy(p(-3, 0))} Q${xy(p(6, 3))} ${xy(p(6, 12))} M${xy(p(-2, -2))} Q${xy(p(10, 1))} ${xy(p(9, 10))}`,
      p(3, 6),
      [pose.hips[i], pose.knees[i]]
    );
    // Gluteus medius is a lateral fan over the hip, NOT the long outer thigh.
    const outer = p(11, -7),
      tip: Point2 = [along[0] + s * 6, along[1]];
    const mediusPath = `M${xy(p(0, -8))} Q${xy(p(9, -12))} ${xy(outer)} Q${xy(p(15, 2))} ${xy(tip)} Q${xy(p(2, 2))} ${xy(p(0, -8))} Z`;
    push(
      "glute_medius",
      i,
      mediusPath,
      [-2, 3, 8]
        .map(dx => `M${xy(p(dx, -6))} Q${xy(p(8, -1))} ${xy(tip)}`)
        .join(" "),
      lerp(outer, tip, 0.45),
      [pose.hips[i], pose.knees[i]]
    );
  }
  return shapes;
}

/** Original torso silhouette defined by the same shoulder/hip/spine landmarks. */
export function motionTorsoContour(pose: MotionPose): string {
  const sl = projectMotionPoint(pose.shoulders[0]),
    sr = projectMotionPoint(pose.shoulders[1]);
  const hl = projectMotionPoint(pose.hips[0]),
    hr = projectMotionPoint(pose.hips[1]);
  const neck = projectMotionPoint(pose.neck);
  return `M${xy(add(neck, [-5, 0]))} Q${xy(add(sl, [5, -5]))} ${xy(add(sl, [-4, 2]))} Q${xy(lerp(sl, hl, 0.55))} ${xy(add(hl, [-3, 5]))} Q${xy(add(projectMotionPoint(pose.hip), [0, 13]))} ${xy(add(hr, [3, 5]))} Q${xy(lerp(sr, hr, 0.55))} ${xy(add(sr, [4, 2]))} Q${xy(add(sr, [-5, -5]))} ${xy(add(neck, [5, 0]))} Z`;
}
