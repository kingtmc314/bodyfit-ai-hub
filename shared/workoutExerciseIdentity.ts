/** v3.19.0: reviewed exercise-choice equivalences, NOT physical-machine identity.
 * History is name-based. Same-name UI choices share rows; source attribution is unknown.
 * Only six reviewed groups are folded. Ambiguous movement variants remain separate.
 */
export interface ExerciseUsageCount {
  exerciseName: string;
  setRows: number;
  sessionCount: number;
}
export interface ExerciseChoiceIdentity {
  name: string;
  nameZh?: string | null;
  equipment?: string | null;
  muscleGroup?: string | null;
  isCustom?: boolean;
  id?: number;
  instructions?: string | null;
  aliases?: string[];
  equipmentAliases?: string[];
  identityNotice?: string;
  variantLabel?: string;
}
export const REVIEWED_EXERCISE_MERGES = [
  { key: "hip-abduction", target: "Hip Abduction", names: ["Hip Abduction"], equipment: ["machine"] },
  { key: "hip-adduction", target: "Hip Adduction", names: ["Hip Adduction"], equipment: ["machine"] },
  { key: "lat-pulldown", target: "Lat Pulldown", names: ["Lat Pulldown"], equipment: ["machine", "cable"] },
  { key: "triceps-extension", target: "Triceps Extension", names: ["Triceps Extension", "Triceps Extension Machine"], equipment: ["machine"] },
  { key: "back-extension", target: "Back Extension", names: ["Back Extension", "Back Extension Machine"], equipment: ["machine"] },
  { key: "ab-crunch", target: "Abdominal Crunch", names: ["Abdominal Crunch", "Abdominal Crunch Machine"], equipment: ["machine"] },
] as const;
export function normalizeExerciseName(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}
function reviewedRule(name: string) {
  const key = normalizeExerciseName(name);
  return REVIEWED_EXERCISE_MERGES.find(rule => rule.names.some(n => normalizeExerciseName(n) === key));
}
/** Name-only history does not identify apparatus. Never infer additional aliases from guide IDs. */
export function getCanonicalExerciseName(name: string): string {
  return reviewedRule(name)?.target ?? name.trim();
}
export function getExerciseHistoryNames(name: string): string[] {
  const rule = reviewedRule(name);
  return rule ? Array.from(new Set([rule.target, ...rule.names])) : [name.trim()];
}
/** Merge only compatible choices from explicitly reviewed groups. No raw choice or metadata is mutated. */
export function buildUnifiedExerciseCatalog<T extends ExerciseChoiceIdentity>(choices: T[], usage: ExerciseUsageCount[] = []): T[] {
  const groups = new Map<string, T[]>();
  const order: string[] = [];
  choices.forEach((choice, index) => {
    const rule = reviewedRule(choice.name);
    const compatible = rule && (rule.equipment as readonly string[]).includes((choice.equipment ?? "").trim().toLowerCase());
    const key = compatible ? `reviewed:${rule.key}` : `separate:${index}`;
    if (!groups.has(key)) { groups.set(key, []); order.push(key); }
    groups.get(key)!.push(choice);
  });
  const rowsByName = new Map(usage.map(u => [normalizeExerciseName(u.exerciseName), u.setRows]));
  return order.map(key => {
    const entries = groups.get(key)!;
    if (!key.startsWith("reviewed:")) {
      const entry = entries[0];
      // Contradictory saved instructions for this exact-name pair cannot identify old name-only rows.
      if (entry.name === "Iso-Lateral High Row") return { ...entry, variantLabel: entry.isCustom ? "自訂說明待核對" : "坐姿高位划船指引", identityNotice: "此同名紀錄無法分辨坐姿／俯臥來源；未合併或分派歷史。" };
      return { ...entry };
    }
    const sorted = [...entries].sort((a, b) => {
      const rowDifference = (rowsByName.get(normalizeExerciseName(b.name)) ?? 0) - (rowsByName.get(normalizeExerciseName(a.name)) ?? 0);
      if (rowDifference) return rowDifference;
      // Identical names share the SAME usage, so metadata quality breaks a tie, not invented attribution.
      const metadata = (v: T) => (v.isCustom || v.id != null ? 2 : 0) + (v.instructions?.trim() ? 1 : 0);
      return metadata(b) - metadata(a);
    });
    const winner = sorted[0];
    const aliases = Array.from(new Set(entries.flatMap(v => [v.name, v.nameZh ?? ""]).filter(Boolean)));
    const equipmentAliases = Array.from(new Set(entries.map(v => v.equipment ?? "").filter(Boolean)));
    return { ...winner, aliases, equipmentAliases, identityNotice: entries.length > 1 ? "已整理同類選項；同名歷史只計一次，器械重量不代表可跨機型直接比較。" : undefined };
  });
}
