/** Verified generic machine technique metadata only. No branded animation assets or embedding permission. */
export type ExerciseGuideId =
  | "lat-pulldown"
  | "seated-row"
  | "chest-press"
  | "pec-deck"
  | "shoulder-press"
  | "leg-press"
  | "leg-extension"
  | "leg-curl"
  | "ab-crunch"
  | "triceps-extension"
  | "biceps-curl"
  | "hip-adduction"
  | "hip-abduction"
  | "back-extension"
  | "lateral-raise"
  | "high-row"
  | "incline-press"
  | "decline-press";
export interface ExerciseGuideSpec {
  id: ExerciseGuideId;
  name: string;
  nameZh: string;
  aliases: string[];
  equipment: string[];
  primary: string[];
  secondary: string[];
  setup: string[];
  movement: string[];
  breathing: string;
  safety: string;
  sources: string[];
}
const machine = ["machine"];
const cable = ["cable", "machine"];
function spec(
  id: ExerciseGuideId,
  name: string,
  nameZh: string,
  aliases: string[],
  equipment: string[],
  primary: string[],
  secondary: string[],
  setup: string[],
  movement: string[],
  breathing: string,
  sources: string[]
): ExerciseGuideSpec {
  return {
    id,
    name,
    nameZh,
    aliases: [name, nameZh, ...aliases],
    equipment,
    primary,
    secondary,
    setup,
    movement,
    breathing,
    safety:
      "按現場器械調校座椅、支點及安全鎖。先用可控制的負重；不要借力、撞擊回程或強行鎖死關節。疼痛時立即停止並向教練確認。",
    sources,
  };
}
const stable = "背部及骨盆穩貼靠墊，雙腳踏穩，保持頭頸自然對齊。";
export const EXERCISE_GUIDES: ExerciseGuideSpec[] = [
  spec(
    "lat-pulldown",
    "Lat Pulldown",
    "高位下拉",
    ["Lat Pull Down", "Lat Pull-down", "下拉機", "高位下拉機"],
    cable,
    ["lats"],
    ["biceps", "shoulders", "back"],
    [
      "調校座椅與大腿墊，固定雙腿；雙手握桿略闊於肩。",
      "胸口自然抬起，軀幹保持穩定，拉桿在頭頂前方。",
    ],
    [
      "肩膀向下，以手肘帶動拉桿至上胸前方；不要拉到頸後。",
      "控制手臂伸展，讓拉桿回升；不要猛放重量或用後仰借力。",
    ],
    "拉下呼氣，回升吸氣。",
    [
      "https://www.acefitness.org/resources/everyone/exercise-library/158/seated-lat-pulldown/",
      "https://www.gymwork.pro/exercises/lat-pulldown?lang=en&id=147",
    ]
  ),
  spec(
    "seated-row",
    "Seated Cable Row",
    "坐姿划船",
    ["Seated Row", "Seated Row Machine", "Cable Row", "坐姿划船機"],
    cable,
    ["back", "lats"],
    ["biceps", "shoulders", "forearms"],
    [
      "坐穩，雙腳抵住腳踏，膝部微曲；握住身前把手。",
      "軀幹保持直立，手腕中立，不圓背。",
    ],
    [
      "以手肘向後帶動把手靠近腰部，肩胛骨受控收攏。",
      "慢慢伸直手臂，沿原路回程；不後仰或蹬腿借力。",
    ],
    "拉回呼氣，向前伸展吸氣。",
    [
      "https://www.acefitness.org/resources/everyone/exercise-library/168/seated-row/",
    ]
  ),
  spec(
    "chest-press",
    "Chest Press Machine",
    "胸推機",
    ["Chest Press", "Machine Chest Press", "Seated Chest Press"],
    machine,
    ["chest"],
    ["triceps", "shoulders"],
    ["調校座椅，使把手約在胸部中線。", stable],
    [
      "沿機器路徑向前推把手，手肘伸展但不鎖死。",
      "慢慢屈肘回到胸前，肩胛骨貼背，不聳肩或拱腰。",
    ],
    "推出呼氣，回程吸氣。",
    [
      "https://www.acefitness.org/resources/everyone/exercise-library/188/seated-chest-press/",
    ]
  ),
  spec(
    "pec-deck",
    "Pec Deck",
    "蝴蝶機夾胸",
    [
      "Pec Deck Machine",
      "Pectoral Fly",
      "Pectoral Fly Machine",
      "Chest Fly Machine",
      "蝴蝶機",
    ],
    machine,
    ["chest"],
    ["shoulders"],
    ["座位調至把手或前臂墊約在胸口高度。", stable],
    [
      "手肘保持微曲，沿槓臂弧線把兩側把手向胸前合攏。",
      "控制向外回程至舒適伸展位置，避免肩部過度後拉。",
    ],
    "合攏呼氣，張開吸氣。",
    ["https://exrx.net/WeightExercises/PectoralSternal/LVPecDeckFly"]
  ),
  spec(
    "shoulder-press",
    "Shoulder Press Machine",
    "肩推機",
    ["Shoulder Press", "Machine Shoulder Press", "Seated Shoulder Press"],
    machine,
    ["shoulders"],
    ["triceps"],
    ["調校座椅，使把手約在肩部高度。", stable],
    [
      "沿器械路徑向上推，手臂接近伸直但不鎖肘。",
      "受控降回肩部附近；避免拱腰、聳肩及反彈。",
    ],
    "上推呼氣，下降吸氣。",
    [
      "https://www.acefitness.org/resources/everyone/exercise-library/186/seated-shoulder-press/",
    ]
  ),
  spec(
    "leg-press",
    "Leg Press",
    "腿推機",
    ["Seated Leg Press", "45 Degree Leg Press", "45° Leg Press"],
    machine,
    ["quads", "glutes"],
    ["hamstrings", "calves"],
    [stable, "全腳掌踏住踏板，膝部跟隨腳尖方向；核對安全鎖。"],
    [
      "伸展髖膝推開踏板，腳跟不離板，膝部不要超伸。",
      "控制屈髖屈膝回程；臀部不離墊，大腿不強壓胸口。",
    ],
    "推開呼氣，回程吸氣。",
    [
      "https://www.acefitness.org/resources/everyone/exercise-library/154/seated-leg-press/",
    ]
  ),
  spec(
    "leg-extension",
    "Leg Extension",
    "腿伸展機",
    ["Leg Extension Machine", "Seated Leg Extension"],
    machine,
    ["quads"],
    [],
    ["調校座椅，使膝部大致對齊機械支點，腳墊放在小腿下段。", stable],
    [
      "大腿及臀部固定，以膝關節伸展帶動小腿向前上方。",
      "慢慢屈膝回程，不抬臀、甩動或讓配重撞回。",
    ],
    "伸膝呼氣，回程吸氣。",
    [
      "https://www.acefitness.org/resources/everyone/exercise-library/183/seated-leg-extension/",
    ]
  ),
  spec(
    "leg-curl",
    "Seated Leg Curl",
    "坐姿腿彎舉",
    ["Leg Curl", "Leg Curl Machine", "Seated Leg Curl Machine"],
    machine,
    ["hamstrings"],
    ["calves"],
    ["調校座椅、小腿墊及大腿固定墊，膝部對準支點。", stable],
    [
      "以膝關節屈曲，把腳跟帶向後下方，軀幹及大腿固定。",
      "慢慢伸膝回到起點；不抬臀、擺動或硬鎖膝。",
    ],
    "屈膝呼氣，伸膝回程吸氣。",
    ["https://www.nasm.org/resource-center/exercise-library/seated-leg-curl"]
  ),
  spec(
    "ab-crunch",
    "Abdominal Crunch Machine",
    "腹部捲曲機",
    [
      "Abdominal Crunch",
      "Ab Crunch Machine",
      "Seated Abdominal Crunch",
      "Abdominal Machine",
      "腹肌機",
    ],
    machine,
    ["abs"],
    ["obliques"],
    [
      "調校座位、上方臂墊及下肢固定位置。",
      "臀部固定，握住把手但不以手臂硬拉。",
    ],
    [
      "以腹部帶動軀幹向前捲曲，手肘與槓桿隨軀幹下降。",
      "控制回到自然坐姿；避免借力、拉頸及過度後仰。",
    ],
    "捲曲呼氣，返回吸氣。",
    ["https://exrx.net/WeightExercises/RectusAbdominis/LVSeatedCrunch"]
  ),
  spec(
    "triceps-extension",
    "Triceps Extension Machine",
    "三頭肌伸展機",
    ["Tricep Extension Machine", "Triceps Extension", "Tricep Extension"],
    machine,
    ["triceps"],
    ["forearms"],
    ["調校座位，使上臂貼墊、手肘對準轉軸。", stable],
    [
      "上臂保持固定，只以手肘伸展將前臂及把手向下推出。",
      "慢慢屈肘回程，不離開臂墊、聳肩或借力擺動。",
    ],
    "伸肘呼氣，回程吸氣。",
    ["https://exrx.net/WeightExercises/Triceps/LVTriExt"]
  ),
  spec(
    "biceps-curl",
    "Biceps Curl Machine",
    "二頭肌彎舉機",
    [
      "Bicep Curl Machine",
      "Arm Curl Machine",
      "Biceps Curl",
      "Bicep Curl",
      "Preacher Curl Machine",
    ],
    machine,
    ["biceps"],
    ["forearms"],
    ["座位調至上臂貼斜墊、手肘大致對準轉軸。", stable],
    [
      "保持上臂貼墊，以手肘屈曲把手柄向胸口捲起。",
      "慢慢伸肘回程，不硬鎖手肘或抬肘後仰。",
    ],
    "捲起呼氣，放下吸氣。",
    [
      "https://www.acefitness.org/resources/everyone/exercise-library/184/seated-biceps-curl/",
    ]
  ),
  spec(
    "hip-adduction",
    "Hip Adduction",
    "髖內收機",
    [
      "Hip Adductor",
      "Hip Adduction Machine",
      "Seated Hip Adduction",
      "Adductor Machine",
      "髖內收",
    ],
    machine,
    ["adductors"],
    [],
    [stable, "按機器調節桿設定舒適張開起點，腿墊置於雙腿內側。"],
    [
      "保持骨盆固定，以髖內收把雙腿向中線合攏。",
      "慢慢回到張開起點；避免膝墊撞擊或扭動軀幹。",
    ],
    "合攏呼氣，張開吸氣。",
    ["https://exrx.net/WeightExercises/HipAdductors/LVSeatedHipAdduction"]
  ),
  spec(
    "hip-abduction",
    "Hip Abduction",
    "髖外展機",
    [
      "Hip Abductor",
      "Hip Abduction Machine",
      "Seated Hip Abduction",
      "Abductor Machine",
      "髖外展",
    ],
    machine,
    ["glute_medius"],
    ["glutes"],
    [stable, "腿墊貼膝外側，設定舒適的起始位置並固定插銷。"],
    [
      "骨盆固定，雙髖外展把腿墊向外推開。",
      "慢慢合回起點，不聳動、側傾或借腰部擺動。",
    ],
    "推開呼氣，合回吸氣。",
    [
      "https://shop.lifefitness.com/products/hammer-strength-select-hip-abduction",
    ]
  ),
  spec(
    "back-extension",
    "Back Extension Machine",
    "坐式背伸展機",
    ["Seated Back Extension", "Back Extension", "Lower Back Machine"],
    machine,
    ["lower_back"],
    ["glutes", "hamstrings"],
    [
      "調好座位、背墊及腳部固定位置，坐穩。",
      "手柄只作穩定，髖部及雙腳保持固定。",
    ],
    [
      "由舒適的前屈位置，受控伸展軀幹回至自然直立。",
      "慢慢回到起點；不要拱到過度伸展、彈震或猛拉把手。",
    ],
    "伸展呼氣，回程吸氣。",
    ["https://exrx.net/WeightExercises/ErectorSpinae/LVBackExtension"]
  ),
  spec(
    "lateral-raise",
    "Lateral Raise Machine",
    "側平舉機",
    ["Machine Lateral Raise", "Lateral Raise"],
    machine,
    ["shoulders"],
    ["traps"],
    ["座位調至肩部與器械支點大致對齊，上臂貼墊。", stable],
    [
      "以肩部帶動手肘向外抬起至舒適位置，不聳肩。",
      "沿原路慢慢下降，不用軀幹或腰部擺動。",
    ],
    "抬起呼氣，下降吸氣。",
    ["https://exrx.net/WeightExercises/DeltoidLateral/LVLateralRaise"]
  ),
  spec(
    "high-row",
    "Iso-Lateral High Row",
    "高位划船機",
    ["High Row", "High Row Machine", "Iso Lateral High Row", "Iso-Lateral Row"],
    machine,
    ["lats", "back"],
    ["biceps", "shoulders", "traps"],
    [
      "調校座位及胸墊，胸口貼穩，握住前上方把手。",
      "雙腳踏穩，左右獨立槓臂在身前上方起始。",
    ],
    [
      "以手肘向後下方帶動把手，胸口全程貼墊。",
      "受控沿原弧線向前上方返回，不蹬腿後仰或聳肩。",
    ],
    "拉回呼氣，伸展回程吸氣。",
    ["https://exrx.net/WeightExercises/BackGeneral/LVSeatedHighRow"]
  ),
  spec(
    "incline-press",
    "Incline Press Machine",
    "上斜胸推機",
    [
      "Incline Chest Press",
      "Incline Chest Press Machine",
      "Iso-Lateral Incline Press",
    ],
    machine,
    ["chest"],
    ["shoulders", "triceps"],
    ["調校座位，使把手約在上胸附近。", stable],
    [
      "沿機器路徑向前上方推，肩膀穩定、不硬鎖手肘。",
      "控制回到上胸附近，不以拱腰或彈動借力。",
    ],
    "推出呼氣，回程吸氣。",
    ["https://exrx.net/WeightExercises/PectoralClavicular/LVInclineChestPress"]
  ),
  spec(
    "decline-press",
    "Decline Press Machine",
    "下斜胸推機",
    [
      "Decline Chest Press",
      "Decline Chest Press Machine",
      "Iso-Lateral Decline Press",
    ],
    machine,
    ["chest"],
    ["triceps", "shoulders"],
    ["座位調至把手約在下胸附近。", stable],
    [
      "沿機器路徑向前下方推，手肘伸展但不硬鎖。",
      "慢慢回到下胸附近；保持頭背穩定，不拱腰。",
    ],
    "推出呼氣，回程吸氣。",
    ["https://exrx.net/WeightExercises/PectoralSternal/LVDeclineChestPressPL"]
  ),
];
export function getExerciseGuide(
  name: string,
  equipment?: string
): ExerciseGuideSpec | null {
  const key = name.trim().toLowerCase().replace(/\s+/g, " ");
  const eq = equipment?.trim().toLowerCase();
  return (
    EXERCISE_GUIDES.find(
      s =>
        s.aliases.some(a => a.toLowerCase() === key) &&
        (!eq || s.equipment.includes(eq))
    ) ?? null
  );
}
