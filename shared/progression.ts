export type StrengthSet = {
  reps?: number | null;
  weight?: number | null;
  createdAt?: Date | string | null;
};

export type ProgressionSuggestion =
  | { available: false; detail: string }
  | {
      available: true;
      strategy: "increase_weight" | "increase_reps" | "maintain";
      targetWeightKg: number;
      targetReps: number;
      detail: string;
    };

/**
 * Produce a conservative double-progression recommendation from the most recent
 * working sets. It is deliberately deterministic: this is an aid for logging,
 * not a medical or coaching prescription.
 */
export function buildProgressionSuggestion(rawSets: StrengthSet[]): ProgressionSuggestion {
  const sets = rawSets
    .map(set => ({ reps: Number(set.reps ?? 0), weight: Number(set.weight ?? 0) }))
    .filter(set => Number.isFinite(set.reps) && Number.isFinite(set.weight) && set.reps > 0 && set.weight > 0);

  if (!sets.length) {
    return { available: false, detail: "完成第一組後，系統會依你的實際表現提出下一次建議。" };
  }

  const latest = sets[0];
  const comparable = sets.filter(set => Math.abs(set.weight - latest.weight) < 0.01).slice(0, 3);
  const averageReps = comparable.reduce((sum, set) => sum + set.reps, 0) / comparable.length;
  const increment = latest.weight >= 100 ? 5 : latest.weight >= 30 ? 2.5 : 1;
  const roundedIncrement = Math.round(increment * 10) / 10;

  if (averageReps >= 10) {
    const targetWeightKg = Math.round((latest.weight + roundedIncrement) * 10) / 10;
    return {
      available: true,
      strategy: "increase_weight",
      targetWeightKg,
      targetReps: Math.max(6, latest.reps - 2),
      detail: `最近 ${comparable.length} 組於 ${latest.weight} kg 平均完成 ${averageReps.toFixed(1)} 次，可嘗試加重 ${roundedIncrement} kg。`,
    };
  }

  if (averageReps < 6) {
    return {
      available: true,
      strategy: "maintain",
      targetWeightKg: latest.weight,
      targetReps: Math.max(6, latest.reps),
      detail: `先以 ${latest.weight} kg 穩定完成至少 6 次，保留 1–2 次餘力並優先確認動作控制。`,
    };
  }

  return {
    available: true,
    strategy: "increase_reps",
    targetWeightKg: latest.weight,
    targetReps: Math.min(12, latest.reps + 1),
    detail: `維持 ${latest.weight} kg，下一組目標多完成 1 次；達到 10–12 次後再小幅加重。`,
  };
}
