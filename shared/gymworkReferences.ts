/** Public official exercise-page references, NOT copied animation assets or embed permission.
 * Verified catalog names/IDs on 2026-11-15 (Hong Kong). Pages open at Gymwork itself.
 */
export interface GymworkReference {
  name: string;
  id: number;
  aliases: string[];
  equipment: string[];
  url: string;
}
export const GYMWORK_REFERENCES: GymworkReference[] = [
  {
    name: "Lat pulldown",
    id: 147,
    aliases: [
      "Lat Pulldown",
      "Lat Pull Down",
      "Lat Pull-down",
      "高位下拉",
      "高位下拉機",
      "下拉機",
    ],
    equipment: ["Machine", "Cable"],
    url: "https://www.gymwork.pro/exercises/lat-pulldown?lang=en&id=147",
  },
  {
    name: "Seated Cable Row",
    id: 284,
    aliases: ["Seated Cable Row", "Cable Row", "坐姿纜繩划船"],
    equipment: ["Machine", "Cable"],
    url: "https://www.gymwork.pro/exercises/seated-cable-row?lang=en&id=284",
  },
  {
    name: "Seated Row Machine",
    id: 704,
    aliases: ["Seated Row Machine", "Seated Row", "坐姿划船機"],
    equipment: ["Machine"],
    url: "https://www.gymwork.pro/exercises/seated-row-machine?lang=en&id=704",
  },
  {
    name: "Chest Press Machine",
    id: 758,
    aliases: [
      "Chest Press Machine",
      "Chest Press",
      "Machine Chest Press",
      "胸推機",
    ],
    equipment: ["Machine"],
    url: "https://www.gymwork.pro/exercises/chest-press-machine?lang=en&id=758",
  },
  {
    name: "Peck Deck Fly",
    id: 151,
    aliases: [
      "Pec Deck",
      "Pec Deck Machine",
      "Chest Fly Machine",
      "Pectoral Fly Machine",
      "蝴蝶機",
      "蝴蝶機夾胸",
    ],
    equipment: ["Machine"],
    url: "https://www.gymwork.pro/exercises/peck-deck-fly?lang=en&id=151",
  },
  {
    name: "Shoulder Press Machine",
    id: 560,
    aliases: [
      "Shoulder Press Machine",
      "Shoulder Press",
      "Machine Shoulder Press",
      "肩推機",
    ],
    equipment: ["Machine"],
    url: "https://www.gymwork.pro/exercises/shoulder-press-machine?lang=en&id=560",
  },
  {
    name: "Leg Press",
    id: 109,
    aliases: ["Leg Press", "腿推機"],
    equipment: ["Machine"],
    url: "https://www.gymwork.pro/exercises/leg-press?lang=en&id=109",
  },
  {
    name: "Seated Leg Press",
    id: 770,
    aliases: ["Seated Leg Press", "坐姿腿推"],
    equipment: ["Machine"],
    url: "https://www.gymwork.pro/exercises/seated-leg-press?lang=en&id=770",
  },
  {
    name: "Leg Extension",
    id: 97,
    aliases: [
      "Leg Extension",
      "Leg Extension Machine",
      "Seated Leg Extension",
      "腿伸展機",
    ],
    equipment: ["Machine"],
    url: "https://www.gymwork.pro/exercises/leg-extension?lang=en&id=97",
  },
  {
    name: "Seated Leg Curl",
    id: 803,
    aliases: ["Seated Leg Curl", "Seated Leg Curl Machine", "坐姿腿彎舉"],
    equipment: ["Machine"],
    url: "https://www.gymwork.pro/exercises/seated-leg-curl?lang=en&id=803",
  },
  {
    name: "Leg Curl",
    id: 98,
    aliases: ["Leg Curl", "Leg Curl Machine", "腿彎舉"],
    equipment: ["Machine"],
    url: "https://www.gymwork.pro/exercises/leg-curl?lang=en&id=98",
  },
  {
    name: "Crunch Machine (Abdominal Machine)",
    id: 3354,
    aliases: [
      "Abdominal Crunch Machine",
      "Abdominal Machine",
      "Abdominal Crunch",
      "Ab Crunch Machine",
      "腹部捲曲機",
      "腹肌機",
    ],
    equipment: ["Machine"],
    url: "https://www.gymwork.pro/exercises/crunch-machine-abdominal-machine?lang=en&id=3354",
  },
  {
    name: "Triceps Extension Machine",
    id: 30395,
    aliases: [
      "Triceps Extension Machine",
      "Tricep Extension Machine",
      "Triceps Extension",
      "Tricep Extension",
      "三頭肌伸展機",
    ],
    equipment: ["Machine"],
    url: "https://www.gymwork.pro/exercises/triceps-extension-machine?lang=en&id=30395",
  },
  {
    name: "Machine Biceps Curl",
    id: 892,
    aliases: [
      "Biceps Curl Machine",
      "Bicep Curl Machine",
      "Machine Biceps Curl",
      "Biceps Curl",
      "Arm Curl Machine",
      "二頭肌彎舉機",
    ],
    equipment: ["Machine"],
    url: "https://www.gymwork.pro/exercises/machine-biceps-curl?lang=en&id=892",
  },
  {
    name: "Preacher Curl Machine",
    id: 1237,
    aliases: ["Preacher Curl Machine"],
    equipment: ["Machine"],
    url: "https://www.gymwork.pro/exercises/preacher-curl-machine?lang=en&id=1237",
  },
  {
    name: "Hip Adduction (Inner Thigh)",
    id: 441,
    aliases: [
      "Hip Adduction",
      "Hip Adduction Machine",
      "Hip Adductor",
      "Adductor Machine",
      "髖內收機",
      "髖內收",
    ],
    equipment: ["Machine"],
    url: "https://www.gymwork.pro/exercises/hip-adduction-inner-thigh?lang=en&id=441",
  },
  {
    name: "Hip Abduction (Outer Thigh)",
    id: 873,
    aliases: [
      "Hip Abduction",
      "Hip Abduction Machine",
      "Hip Abductor",
      "Abductor Machine",
      "髖外展機",
      "髖外展",
    ],
    equipment: ["Machine"],
    url: "https://www.gymwork.pro/exercises/hip-abduction-outer-thigh?lang=en&id=873",
  },
  {
    name: "Back Extension Machine",
    id: 36276,
    aliases: [
      "Back Extension Machine",
      "Seated Back Extension",
      "Lower Back Machine",
      "坐式背伸展機",
    ],
    equipment: ["Machine"],
    url: "https://www.gymwork.pro/exercises/back-extension-machine?lang=en&id=36276",
  },
  {
    name: "Side Lateral Raise Machine",
    id: 395,
    aliases: [
      "Lateral Raise Machine",
      "Machine Lateral Raise",
      "Side Lateral Raise Machine",
      "側平舉機",
    ],
    equipment: ["Machine"],
    url: "https://www.gymwork.pro/exercises/side-lateral-raise-machine?lang=en&id=395",
  },
  {
    name: "Incline Chest Press Machine",
    id: 346,
    aliases: [
      "Incline Chest Press",
      "Incline Chest Press Machine",
      "Incline Press Machine",
      "上斜胸推機",
    ],
    equipment: ["Machine"],
    url: "https://www.gymwork.pro/exercises/incline-chest-press-machine?lang=en&id=346",
  },
  {
    name: "Decline Chest Press",
    id: 957,
    aliases: [
      "Decline Chest Press",
      "Decline Chest Press Machine",
      "Decline Press Machine",
      "下斜胸推機",
    ],
    equipment: ["Machine"],
    url: "https://www.gymwork.pro/exercises/decline-chest-press?lang=en&id=957",
  },
  {
    name: "High Low Machine",
    id: 432,
    aliases: ["High Low Machine"],
    equipment: ["Machine"],
    url: "https://www.gymwork.pro/exercises/high-low-machine?lang=en&id=432",
  },
  {
    name: "Cable Pushdown",
    id: 221,
    aliases: ["Cable Pushdown", "Tricep Pushdown", "Cable Tricep Pushdown"],
    equipment: ["Cable"],
    url: "https://www.gymwork.pro/exercises/cable-pushdown?lang=en&id=221",
  },
  {
    name: "Bench Press",
    id: 59,
    aliases: ["Bench Press"],
    equipment: ["Barbell"],
    url: "https://www.gymwork.pro/exercises/bench-press?lang=en&id=59",
  },
  {
    name: "Assisted Pull-Up",
    id: 349,
    aliases: ["Assisted Pull-Up"],
    equipment: ["Machine"],
    url: "https://www.gymwork.pro/exercises/assisted-pull-up?lang=en&id=349",
  },
  {
    name: "Lying Leg Curl",
    id: 802,
    aliases: ["Lying Leg Curl"],
    equipment: ["Machine"],
    url: "https://www.gymwork.pro/exercises/lying-leg-curl?lang=en&id=802",
  },
];
export function getGymworkReference(
  name: string,
  equipment?: string
): GymworkReference | null {
  const key = name.trim().toLowerCase().replace(/\s+/g, " ");
  const eq = equipment?.trim().toLowerCase();
  return (
    GYMWORK_REFERENCES.find(
      r =>
        r.aliases.some(a => a.toLowerCase() === key) &&
        (!eq || r.equipment.some(e => e.toLowerCase() === eq))
    ) ?? null
  );
}
