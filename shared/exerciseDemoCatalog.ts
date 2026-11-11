/** Exact motion/equipment demos, curated 2026-11-11. No fuzzy fallback.
 * Source media licenses are independent of this repository's MIT code license.
 * Display title/author/license plus source link AND licenseUrl/changes in attribution.
 * See /home/ubuntu/webdev-static-assets/bodyfit-exercise-demos/README.md.
 */
import { officialMachineDemos } from './officialMachineDemos';
export interface ExerciseDemo {
  url: string;
  kind: "video" | "gif" | "youtube";
  videoId?: string;
  sourceUrl: string;
  license: string;
  author: string;
  title: string;
  posterUrl?: string;
  licenseUrl?: string;
  changes?: string;
}
export interface ExerciseDemoCatalogEntry extends ExerciseDemo {
  name: string;
  equipment: string;
  aliases: readonly string[];
  sourceTitle: string;
  originalUrl: string;
  verifiedAt: string;
  muscleGroup: string;
}
export const exerciseDemoCatalog: readonly ExerciseDemoCatalogEntry[] = [
  {
    name: "Bench Press",
    equipment: "Barbell",
    aliases: ["Barbell Bench Press", "臥推"],
    url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663664977018/ebsbzROAiHaNQiOg.mp4",
    kind: "video",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Using_a_Power_Rack_in_bodybuilding,_powerlifting,_strength_training,_resistance_exercise.webm",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    author: "FitnessScape",
    sourceTitle: "Power Rack Training",
    originalUrl:
      "https://upload.wikimedia.org/wikipedia/commons/5/52/Using_a_Power_Rack_in_bodybuilding%2C_powerlifting%2C_strength_training%2C_resistance_exercise.webm",
    title: "Bench Press",
    changes:
      "Excerpt 105–112s; converted to silent H.264 MP4. Same exact movement and equipment.",
    verifiedAt: "2026-11-11",
    muscleGroup: "chest",
  },
  {
    name: "Incline Bench Press",
    equipment: "Barbell",
    aliases: ["Incline Barbell Bench Press", "上斜臥推"],
    url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663664977018/IiFxberlXzsJDhxd.mp4",
    kind: "video",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Using_a_Power_Rack_in_bodybuilding,_powerlifting,_strength_training,_resistance_exercise.webm",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    author: "FitnessScape",
    sourceTitle: "Power Rack Training",
    originalUrl:
      "https://upload.wikimedia.org/wikipedia/commons/5/52/Using_a_Power_Rack_in_bodybuilding%2C_powerlifting%2C_strength_training%2C_resistance_exercise.webm",
    title: "Incline Bench Press",
    changes:
      "Excerpt 113–123s; converted to silent H.264 MP4. Same exact movement and equipment.",
    verifiedAt: "2026-11-11",
    muscleGroup: "chest",
  },
  {
    name: "Decline Bench Press",
    equipment: "Barbell",
    aliases: ["Decline Barbell Bench Press", "下斜臥推"],
    url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663664977018/khbsLGTHBMFYwktd.mp4",
    kind: "video",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Using_a_Power_Rack_in_bodybuilding,_powerlifting,_strength_training,_resistance_exercise.webm",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    author: "FitnessScape",
    sourceTitle: "Power Rack Training",
    originalUrl:
      "https://upload.wikimedia.org/wikipedia/commons/5/52/Using_a_Power_Rack_in_bodybuilding%2C_powerlifting%2C_strength_training%2C_resistance_exercise.webm",
    title: "Decline Bench Press",
    changes:
      "Excerpt 91–101s; converted to silent H.264 MP4. Same exact movement and equipment.",
    verifiedAt: "2026-11-11",
    muscleGroup: "chest",
  },
  {
    name: "Lat Pulldown",
    equipment: "Cable",
    aliases: ["Lat Pull Down", "Lat Pull-down", "下拉機"],
    url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663664977018/skrgTSgksnBshZoC.mp4",
    kind: "video",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Using_a_Power_Rack_in_bodybuilding,_powerlifting,_strength_training,_resistance_exercise.webm",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    author: "FitnessScape",
    sourceTitle: "Power Rack Training",
    originalUrl:
      "https://upload.wikimedia.org/wikipedia/commons/5/52/Using_a_Power_Rack_in_bodybuilding%2C_powerlifting%2C_strength_training%2C_resistance_exercise.webm",
    title: "Lat Pulldown",
    changes:
      "Excerpt 69–78s; converted to silent H.264 MP4. Same exact movement and equipment.",
    verifiedAt: "2026-11-11",
    muscleGroup: "lats",
  },
  {
    name: "Seated Cable Row",
    equipment: "Cable",
    aliases: ["Seated Cable Rows", "坐姿划船"],
    url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663664977018/ZWqQVWXphGIrXpUd.mp4",
    kind: "video",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Using_a_Power_Rack_in_bodybuilding,_powerlifting,_strength_training,_resistance_exercise.webm",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    author: "FitnessScape",
    sourceTitle: "Power Rack Training",
    originalUrl:
      "https://upload.wikimedia.org/wikipedia/commons/5/52/Using_a_Power_Rack_in_bodybuilding%2C_powerlifting%2C_strength_training%2C_resistance_exercise.webm",
    title: "Seated Cable Row",
    changes:
      "Excerpt 51–56s; converted to silent H.264 MP4. Same exact movement and equipment.",
    verifiedAt: "2026-11-11",
    muscleGroup: "back",
  },
  {
    name: "Bent-over Barbell Row",
    equipment: "Barbell",
    aliases: ["Barbell Bent-over Row", "俯身槓鈴划船"],
    url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663664977018/cQYUrnJNAXTdEXWB.mp4",
    kind: "video",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Using_a_Power_Rack_in_bodybuilding,_powerlifting,_strength_training,_resistance_exercise.webm",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    author: "FitnessScape",
    sourceTitle: "Power Rack Training",
    originalUrl:
      "https://upload.wikimedia.org/wikipedia/commons/5/52/Using_a_Power_Rack_in_bodybuilding%2C_powerlifting%2C_strength_training%2C_resistance_exercise.webm",
    title: "Bent-over Barbell Row",
    changes:
      "Excerpt 41–48s; converted to silent H.264 MP4. Same exact movement and equipment.",
    verifiedAt: "2026-11-11",
    muscleGroup: "back",
  },
  {
    name: "Squat",
    equipment: "Barbell",
    aliases: ["Barbell Squat", "Barbell Back Squat", "深蹲"],
    url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663664977018/TmRZKUjBdHHwFFWp.mp4",
    kind: "video",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Using_a_Power_Rack_in_bodybuilding,_powerlifting,_strength_training,_resistance_exercise.webm",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    author: "FitnessScape",
    sourceTitle: "Power Rack Training",
    originalUrl:
      "https://upload.wikimedia.org/wikipedia/commons/5/52/Using_a_Power_Rack_in_bodybuilding%2C_powerlifting%2C_strength_training%2C_resistance_exercise.webm",
    title: "Squat",
    changes:
      "Excerpt 146–156s; converted to silent H.264 MP4. Same exact movement and equipment.",
    verifiedAt: "2026-11-11",
    muscleGroup: "quads",
  },
  {
    name: "Rear Delt Fly",
    equipment: "Dumbbell",
    aliases: ["Dumbbell Rear Delt Fly", "Bent-over Dumbbell Fly", "後三角飛鳥"],
    url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663664977018/HKPsdvDAwdDHlkLR.mp4",
    kind: "video",
    sourceUrl: "https://wger.de/api/v2/exerciseinfo/82/",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
    author: "Goulart",
    sourceTitle: "Bent-over Lateral Raises",
    originalUrl:
      "https://wger.de/media/exercise-video/82/28b53647-27e7-47cf-8852-2ee666c8b628.MOV",
    title: "Rear Delt Fly",
    changes:
      "Converted to H.264 MP4; resized to at most 960px wide; audio removed.",
    verifiedAt: "2026-11-11",
    muscleGroup: "shoulders",
  },
  {
    name: "Barbell Curl",
    equipment: "Barbell",
    aliases: ["Barbell Biceps Curl", "槓鈴彎舉"],
    url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663664977018/YjifMzSXBRqKEwKZ.mp4",
    kind: "video",
    sourceUrl: "https://wger.de/api/v2/exerciseinfo/91/",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
    author: "Goulart",
    sourceTitle: "Biceps Curls With Barbell",
    originalUrl:
      "https://wger.de/media/exercise-video/91/483f4bff-e108-41f1-8e7b-0caf24952552.MOV",
    title: "Barbell Curl",
    changes:
      "Converted to H.264 MP4; resized to at most 960px wide; audio removed.",
    verifiedAt: "2026-11-11",
    muscleGroup: "biceps",
  },
  {
    name: "Dumbbell Curl",
    equipment: "Dumbbell",
    aliases: ["Dumbbell Biceps Curl", "啞鈴彎舉"],
    url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663664977018/zoLlPNyouZTtfgsx.mp4",
    kind: "video",
    sourceUrl: "https://wger.de/api/v2/exerciseinfo/92/",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
    author: "Goulart",
    sourceTitle: "Biceps Curls With Dumbbell",
    originalUrl:
      "https://wger.de/media/exercise-video/92/8bfb917c-3d0d-49b9-8073-5d7e01c1b894.MOV",
    title: "Dumbbell Curl",
    changes:
      "Converted to H.264 MP4; resized to at most 960px wide; audio removed.",
    verifiedAt: "2026-11-11",
    muscleGroup: "biceps",
  },
  {
    name: "Cable Curl",
    equipment: "Cable",
    aliases: ["Cable Biceps Curl", "繩索彎舉"],
    url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663664977018/lRGpNBKCllGJsoHb.mp4",
    kind: "video",
    sourceUrl: "https://wger.de/api/v2/exerciseinfo/95/",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
    author: "Goulart",
    sourceTitle: "Biceps Curl With Cable",
    originalUrl:
      "https://wger.de/media/exercise-video/95/ab770931-47d3-44fd-aef0-ac7a64c3b794.MOV",
    title: "Cable Curl",
    changes:
      "Converted to H.264 MP4; resized to at most 960px wide; audio removed.",
    verifiedAt: "2026-11-11",
    muscleGroup: "biceps",
  },
  {
    name: "Tricep Dip",
    equipment: "Dip Bar",
    aliases: ["Triceps Dip", "Parallel Bar Dip", "三頭撐體"],
    url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663664977018/NTXdQLrXCydMCyKW.mp4",
    kind: "video",
    sourceUrl: "https://wger.de/api/v2/exerciseinfo/194/",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
    author: "Goulart",
    sourceTitle: "Dips",
    originalUrl:
      "https://wger.de/media/exercise-video/194/dd9a663f-d8ba-4621-823b-13788ccb66bc.MOV",
    title: "Tricep Dip",
    changes:
      "Converted to H.264 MP4; resized to at most 960px wide; audio removed.",
    verifiedAt: "2026-11-11",
    muscleGroup: "triceps",
  },
  {
    name: "Lunge",
    equipment: "Dumbbell",
    aliases: ["Dumbbell Lunge", "弓步蹲"],
    url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663664977018/XfBhnOJpYyOkqgct.mp4",
    kind: "video",
    sourceUrl: "https://wger.de/api/v2/exerciseinfo/205/",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
    author: "Goulart",
    sourceTitle: "Dumbbell Lunges Standing",
    originalUrl:
      "https://wger.de/media/exercise-video/205/c167ac34-ddbc-4e1b-8edf-1192e9d00e22.MOV",
    title: "Lunge",
    changes:
      "Converted to H.264 MP4; resized to at most 960px wide; audio removed.",
    verifiedAt: "2026-11-11",
    muscleGroup: "quads",
  },
  {
    name: "Overhead Tricep Extension",
    equipment: "Dumbbell",
    aliases: [
      "Overhead Triceps Extension",
      "Dumbbell Overhead Triceps Extension",
      "過頭三頭伸展",
    ],
    url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663664977018/pyRBtycUuybXunvX.mp4",
    kind: "video",
    sourceUrl: "https://wger.de/api/v2/exerciseinfo/211/",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
    author: "Goulart",
    sourceTitle: "Dumbbell Triceps Extension",
    originalUrl:
      "https://wger.de/media/exercise-video/211/85f6eb25-a76c-409e-9af9-497794ac0dfb.MOV",
    title: "Overhead Tricep Extension",
    changes:
      "Converted to H.264 MP4; resized to at most 960px wide; audio removed.",
    verifiedAt: "2026-11-11",
    muscleGroup: "triceps",
  },
  {
    name: "Face Pull",
    equipment: "Cable",
    aliases: ["Facepull", "Cable Face Pull", "繩索臉拉"],
    url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663664977018/KyxEoHgGhYHIFFvY.mp4",
    kind: "video",
    sourceUrl: "https://wger.de/api/v2/exerciseinfo/222/",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
    author: "Goulart",
    sourceTitle: "Facepull",
    originalUrl:
      "https://wger.de/media/exercise-video/222/eea93fcc-6a3c-4783-8f70-0234c791a001.MOV",
    title: "Face Pull",
    changes:
      "Converted to H.264 MP4; resized to at most 960px wide; audio removed.",
    verifiedAt: "2026-11-11",
    muscleGroup: "shoulders",
  },
  {
    name: "Skull Crusher",
    equipment: "EZ Bar",
    aliases: [
      "EZ Bar Skull Crusher",
      "EZ Bar Lying Triceps Extension",
      "頭骨碎裂者",
    ],
    url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663664977018/KYBwUxVmHPtAnHVp.mp4",
    kind: "video",
    sourceUrl: "https://wger.de/api/v2/exerciseinfo/246/",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
    author: "Goulart",
    sourceTitle: "Skullcrusher SZ-bar",
    originalUrl:
      "https://wger.de/media/exercise-video/246/2a194d11-ff5d-4bdf-849e-1c441cf7b0b1.MOV",
    title: "Skull Crusher",
    changes:
      "Converted to H.264 MP4; resized to at most 960px wide; audio removed.",
    verifiedAt: "2026-11-11",
    muscleGroup: "triceps",
  },
  {
    name: "Hammer Curl",
    equipment: "Dumbbell",
    aliases: ["Dumbbell Hammer Curl", "錘式彎舉"],
    url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663664977018/sqZsOByVDsMHXRuS.mp4",
    kind: "video",
    sourceUrl: "https://wger.de/api/v2/exerciseinfo/272/",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
    author: "Goulart",
    sourceTitle: "Hammer Curls",
    originalUrl:
      "https://wger.de/media/exercise-video/272/df069052-2173-4f24-855f-a0eebe729f24.MOV",
    title: "Hammer Curl",
    changes:
      "Converted to H.264 MP4; resized to at most 960px wide; audio removed.",
    verifiedAt: "2026-11-11",
    muscleGroup: "biceps",
  },
  {
    name: "Lateral Raise",
    equipment: "Dumbbell",
    aliases: ["Dumbbell Lateral Raise", "側平舉"],
    url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663664977018/oPszUDHpWwiQiWRI.mp4",
    kind: "video",
    sourceUrl: "https://wger.de/api/v2/exerciseinfo/348/",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
    author: "Goulart",
    sourceTitle: "Lateral Raises",
    originalUrl:
      "https://wger.de/media/exercise-video/348/de69928a-8a35-4096-821c-1f46de5e0e03.MOV",
    title: "Lateral Raise",
    changes:
      "Converted to H.264 MP4; resized to at most 960px wide; audio removed.",
    verifiedAt: "2026-11-11",
    muscleGroup: "shoulders",
  },
  {
    name: "Leg Curl",
    equipment: "Machine",
    aliases: ["Lying Leg Curl", "Machine Leg Curl", "腿彎舉機"],
    url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663664977018/oVaMrmWoBaZBwfHb.mp4",
    kind: "video",
    sourceUrl: "https://wger.de/api/v2/exerciseinfo/365/",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
    author: "Goulart",
    sourceTitle: "Leg Curls (laying)",
    originalUrl:
      "https://wger.de/media/exercise-video/365/becaf013-5044-40d0-bae9-7ed60c973737.MOV",
    title: "Leg Curl",
    changes:
      "Converted to H.264 MP4; resized to at most 960px wide; audio removed.",
    verifiedAt: "2026-11-11",
    muscleGroup: "hamstrings",
  },
  {
    name: "Leg Press",
    equipment: "Machine",
    aliases: ["Machine Leg Press", "腿推機"],
    url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663664977018/ryswgDxfjCTtEeod.mp4",
    kind: "video",
    sourceUrl: "https://wger.de/api/v2/exerciseinfo/371/",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
    author: "Goulart",
    sourceTitle: "Leg Press",
    originalUrl:
      "https://wger.de/media/exercise-video/371/6aae16b4-01b9-4eb4-935c-3250f84d2c59.MOV",
    title: "Leg Press",
    changes:
      "Converted to H.264 MP4; resized to at most 960px wide; audio removed.",
    verifiedAt: "2026-11-11",
    muscleGroup: "quads",
  },
  ...officialMachineDemos,
];
export const unavailableExerciseDemoNames: readonly string[] = [
  "Dumbbell Fly",
  "Cable Crossover",
  "Push-up",
  "Deadlift",
  "Pull-up",
  "T-Bar Row",
  "Single-arm Dumbbell Row",
  "Hyperextension",
  "Overhead Press",
  "Dumbbell Shoulder Press",
  "Front Raise",
  "Arnold Press",
  "Shoulder Press Machine",
  "Preacher Curl",
  "Concentration Curl",
  "Tricep Pushdown",
  "Close-grip Bench Press",
  "Tricep Kickback",
  "Romanian Deadlift",
  "Bulgarian Split Squat",
  "Hip Thrust",
  "Glute Bridge",
  "Standing Calf Raise",
  "Seated Calf Raise",
  "Crunch",
  "Plank",
  "Cable Crunch",
  "Hanging Leg Raise",
  "Russian Twist",
  "Ab Wheel Rollout",
  "Barbell Shrug",
  "Dumbbell Shrug",
  "Upright Row",
  "Wrist Curl",
  "Reverse Curl",
  "Farmer's Walk",
  "Stationary Bike",
  "Treadmill",
  "Stair Climber",
  "Elliptical Trainer",
  "Rowing Machine",
  "Ski Erg",
  "Air Bike",
  "Jacob's Ladder",
];
export const exerciseDemoCoverage = {
  verified: 23,
  customOnly: 1,
  shipped: 24,
  nativeVideos: 20,
  officialEmbeds: 4,
  unavailable: 44,
  builtinTotal: 67,
  checkedAt: "2026-11-11",
} as const;

export const EXERCISE_DEMO_CATALOG = exerciseDemoCatalog;
function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[‐‑–—]/g, "-")
    .replace(/\s+/g, " ");
}
const equipmentAliases: Record<string, string> = {
  "cable machine": "cable",
  "sz-bar": "ez bar",
  "ez-bar": "ez bar",
  "body weight": "bodyweight",
  "pull up bar": "pull-up bar",
  "parallel bars": "dip bar",
};
function normalizeEquipment(value: string): string {
  const key = normalize(value);
  return equipmentAliases[key] ?? key;
}
/** Only exact canonical names or curated movement synonyms; unknown/mismatch -> undefined.
 * A muscle-group label (including abs/core) is never treated as an exercise name.
 * Generic names default to the builtin equipment only when no equipment is provided.
 */
export function getExerciseDemo(
  name: string,
  equipment?: string
): ExerciseDemo | undefined {
  const key = normalize(name);
  const matches = exerciseDemoCatalog.filter(entry =>
    [entry.name, ...entry.aliases].some(alias => normalize(alias) === key)
  );
  const matching = equipment?.trim()
    ? matches.filter(
        entry =>
          normalizeEquipment(entry.equipment) === normalizeEquipment(equipment)
      )
    : matches;
  return matching.length === 1 ? matching[0] : undefined;
}
