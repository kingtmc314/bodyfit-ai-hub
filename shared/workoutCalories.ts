import { estimateWorkoutVolumeEnergy, validWorkoutLoad, validWorkoutReps, type WorkoutVolumeEnergy } from "./workoutVolumeEnergy";

/** Bounded volume-dependent gym energy heuristic, NOT a metabolic measurement.
 * See references/workout-energy-model.md for evidence, assumptions and limitations.
 * Resistance replaces whole-session MET with work + body/support + bounded recovery.
 * Gym cardio retains its disclosed active-MET proxy or device value exactly once.
 */
export const WORKOUT_CALORIE_VERSION = "workout-volume-v2" as const;
export const PREVIOUS_WORKOUT_CALORIE_VERSION = "workout-active-v1" as const;
export function isSupportedWorkoutCalorieVersion(version: unknown): boolean {
  return version === WORKOUT_CALORIE_VERSION || version === PREVIOUS_WORKOUT_CALORIE_VERSION;
}
export const MAX_WORKOUT_MINUTES = 180;
export const CARDIO_EXERCISE_NAMES = [
  "Stationary Bike", "Treadmill", "Stair Climber", "Elliptical Trainer",
  "Rowing Machine", "Ski Erg", "Air Bike", "Jacob's Ladder",
] as const;
export type WorkoutIntensity = "light" | "moderate" | "vigorous";
export type WorkoutWeightSource = "body_composition" | "user_profile" | "session_override" | "assumed_70kg";
export type WorkoutCalorieSource = "resistance_estimate" | "cardio_estimate" | "machine_reported" | "mixed" | "manual" | "none";
export interface CalorieWorkoutSet {
  id?: number; sessionId?: number; exerciseId?: number | null; exerciseName?: string | null;
  category?: string | null; isCardio?: boolean; reps?: number | null; weight?: number | null;
  /** Position only: a stored row represents one completed set, never a set multiplier. */
  setNumber?: number | null;
  /** Minutes for cardio AND explicitly timed resistance work. Never seconds. */
  duration?: number | null; calories?: number | null; distance?: number | null;
}
export interface WorkoutCalorieEstimate {
  activeKcal: number; lowKcal: number; highKcal: number; bodyWeightKg: number;
  weightSource: WorkoutWeightSource; effectiveMinutes: number; intensity: WorkoutIntensity;
  source: WorkoutCalorieSource; warnings: string[];
  /** Optional for clients rendering older stored summaries; always returned by v2. */
  volume?: WorkoutVolumeEnergy;
  /** Convenience alias of volume.totalVolumeKgReps; always returned by v2. */
  totalVolumeKgReps?: number;
  modelVersion?: typeof WORKOUT_CALORIE_VERSION;
}
export interface WorkoutCalorieDetails extends WorkoutCalorieEstimate {
  version: typeof WORKOUT_CALORIE_VERSION;
  volume: WorkoutVolumeEnergy;
  energyBasis: "active" | "reported_unknown" | "mixed";
  sessionDate: string;
  weightDate: string | null;
  resistanceMinutes: number; cardioMinutes: number;
  resistanceKcal: number; cardioKcal: number;
  /** Descriptive gross-MET equivalent of the result, NOT an input or Compendium code. */
  resistanceMet: number;
  durationSource: "logged_sets" | "verified_duration";
  timing: {
    mode: "live" | "historical";
    verifiedDurationMinutes: number | null;
    /** Validated available elapsed time caps work but never drives it. */
    availableMinutes?: number | null;
    finished?: boolean;
  };
  manualCalories: number | null;
  rawOriginalCalories?: number | null;
  origin?: "new" | "legacy";
  rangeMeaning: "heuristic_not_confidence_interval";
  components: Array<{ kind: "resistance" | "cardio"; exerciseName?: string; minutes: number; kcal: number; source: string }>;
}
/** v1 provenance remains readable without pretending it already has volume metrics. */
export type StoredWorkoutCalorieDetails = Omit<WorkoutCalorieDetails, "version" | "volume"> & {
  version: typeof WORKOUT_CALORIE_VERSION | typeof PREVIOUS_WORKOUT_CALORIE_VERSION;
  volume?: WorkoutVolumeEnergy;
};
export interface WorkoutCalorieInput {
  sets: readonly CalorieWorkoutSet[]; sessionDate?: string;
  bodyWeightKg?: number | null; weightSource?: WorkoutWeightSource; weightDate?: string | null;
  intensity?: WorkoutIntensity;
  verifiedDurationMinutes?: number | null;
  availableMinutes?: number | null;
  manualCalories?: number | null;
  mode?: "live" | "historical";
  /** Reads tolerate unsafe legacy values with warnings; all new writes validate strictly. */
  tolerateInvalid?: boolean;
}
export function isCardioSet(set: CalorieWorkoutSet): boolean {
  if (set.isCardio === false || ["strength", "resistance"].includes(set.category?.toLowerCase() ?? "")) return false;
  if (/\b(plank|wall[ -]?sit|dead[ -]?hang|isometric|hold)\b|平板|靜態|靠牆/i.test(set.exerciseName ?? "")) return false;
  if (set.isCardio !== true && set.category?.toLowerCase() !== "cardio"
    && /squat|deadlift|hip thrust|good morning|press|adduction|abduction|adductor|abductor|curl|extension|raise|fly|row(?!ing machine)|pulldown|pull[ -]?up|chin[ -]?up|push[ -]?up|\bdips?\b|lunge|step[ -]?up|crunch|sit[ -]?up|ab wheel|深蹲|胸推|肩推|腿推|蹬腿|髖|髋|硬拉|臀推|引體|掌上壓|俯臥撐|雙槓|捲腹|卷腹|仰臥起坐/i.test(set.exerciseName ?? "")) return false;
  return set.isCardio === true || set.category?.toLowerCase() === "cardio"
    || CARDIO_EXERCISE_NAMES.some(name => name.toLowerCase() === set.exerciseName?.trim().toLowerCase())
    // Custom machine entries commonly have duration/kcal but no resistance reps.
    || (!(Number(set.reps) > 0) && (Number(set.duration) > 0 || set.calories != null));
}
export function validateWorkoutMinutes(value: number, label = "訓練時間"): number {
  if (!Number.isFinite(value) || value < 0 || value > MAX_WORKOUT_MINUTES) {
    throw new Error(`${label}必須為 0–${MAX_WORKOUT_MINUTES} 分鐘。請確認實際運動時間；閒置或跨日時間不可計入。`);
  }
  return value;
}
export function validateBodyWeight(value: number): number {
  if (!Number.isFinite(value) || value < 20 || value > 350) throw new Error("體重必須為 20–350 kg，請確認單位。");
  return value;
}
export function calorieEstimateSummary(details: WorkoutCalorieDetails): WorkoutCalorieEstimate {
  const { activeKcal, lowKcal, highKcal, bodyWeightKg, weightSource, effectiveMinutes, intensity, source, warnings } = details;
  return { activeKcal, lowKcal, highKcal, bodyWeightKg, weightSource, effectiveMinutes, intensity, source, warnings,
    volume: details.volume, totalVolumeKgReps: details.volume.totalVolumeKgReps, modelVersion: WORKOUT_CALORIE_VERSION };
}
export function estimateWorkoutCalories(input: WorkoutCalorieInput): WorkoutCalorieDetails {
  const warnings: string[] = [];
  const warn = (text: string) => { if (!warnings.includes(text)) warnings.push(text); };
  const validMinutes = (value: number, label: string): number => {
    try { return validateWorkoutMinutes(value, label); }
    catch (error) { if (!input.tolerateInvalid) throw error; warn(`${label}無效，已從估算排除；請輸入實際分鐘。`); return 0; }
  };
  let bodyWeightKg = input.bodyWeightKg ?? 70;
  let weightSource = input.weightSource ?? (input.bodyWeightKg != null ? "session_override" : "assumed_70kg");
  try { validateBodyWeight(bodyWeightKg); } catch (error) {
    if (!input.tolerateInvalid) throw error;
    bodyWeightKg = 70; weightSource = "assumed_70kg";
  }
  if (weightSource === "assumed_70kg") warn("沒有當日或之前的有效體重，暫假設 70 kg；請補充體重以改善估算。");
  const intensity = input.intensity ?? "moderate";
  let verified: number | null = null;
  if (input.verifiedDurationMinutes != null) verified = validMinutes(input.verifiedDurationMinutes, "已確認訓練時間");
  let available: number | null = null;
  if (input.availableMinutes != null) available = validMinutes(input.availableMinutes, "可用訓練時間");
  const components: WorkoutCalorieDetails["components"] = [];
  let cardioMinutes = 0, cardioKcal = 0, cardioLow = 0, cardioHigh = 0;
  let reported = false, estimatedCardio = false;
  const resistance: CalorieWorkoutSet[] = [];
  for (const set of input.sets) {
    if (!input.tolerateInvalid) {
      if (set.duration != null) validMinutes(set.duration, "組時間");
      if (set.reps != null && (!Number.isFinite(set.reps) || set.reps < 0 || set.reps > 200)) throw new Error("力量組次數必須為 0–200，請核對紀錄。");
      if (set.weight != null && (!Number.isFinite(set.weight) || set.weight < 0 || set.weight > 1000)) throw new Error("訓練負重必須為 0–1000 kg，請確認單位。");
      if (set.calories != null && (!Number.isFinite(set.calories) || set.calories < 0 || set.calories > 3000)) throw new Error("器械熱量必須為 0–3000 kcal，請核對器械顯示。");
    }
    if (!isCardioSet(set)) {
      const clean = { ...set };
      if (set.reps != null && !validWorkoutReps(set.reps)) { warn("無效力量組次數已排除；原始紀錄保留。"); clean.reps = null; }
      if (set.weight != null && !validWorkoutLoad(set.weight)) { warn("無效力量負重已排除；原始紀錄保留，請核對 kg 單位。"); clean.weight = null; }
      if (set.duration != null) clean.duration = validMinutes(set.duration, "力量組工作時間");
      if ((clean.reps ?? 0) > 0 || (clean.duration ?? 0) > 0) resistance.push(clean);
      continue;
    }
    const minutes = set.duration == null ? 0 : validMinutes(set.duration, "有氧時間");
    let kcal = 0;
    let source = "moderate_cardio_proxy_5MET";
    if (set.calories != null) {
      if (!Number.isFinite(set.calories) || set.calories < 0 || set.calories > 3000) {
        if (!input.tolerateInvalid) throw new Error("器械熱量必須為 0–3000 kcal，請核對器械顯示及分鐘單位。");
        warn("無效器械熱量已排除；請核對原始紀錄。");
      } else {
        // Reported 0 is meaningful; do not replace it with a MET estimate.
        kcal = set.calories; reported = true; source = "machine_reported";
        warn("器械熱量僅計一次；器械未標明活動或總熱量，可能包含靜息消耗且有測量誤差。");
        if (minutes === 0 && kcal > 0) warn("器械熱量缺少有氧分鐘；已保留報告值，請補充時間。");
      }
    } else if (minutes > 0) {
      // Unknown speed/power: explicitly use moderate-conditioning proxy, never infer vigorous effort.
      kcal = (5 - 1) * bodyWeightKg * minutes / 60; estimatedCardio = true;
      warn("沒有器械熱量／速度／功率，有氧暫採 5 MET 中等強度代理估算。");
    }
    cardioMinutes += minutes; cardioKcal += kcal;
    cardioLow += kcal * (source === "machine_reported" ? 0.8 : 0.65);
    cardioHigh += kcal * (source === "machine_reported" ? 1.2 : 1.5);
    components.push({ kind: "cardio", exerciseName: set.exerciseName ?? undefined, minutes, kcal: Math.round(kcal), source });
  }
  if (cardioMinutes > MAX_WORKOUT_MINUTES) {
    if (!input.tolerateInvalid) throw new Error("有氧總時間超過 180 分鐘，請核對每組分鐘，或分開記錄訓練。");
    warn("有氧總時間超過安全範圍，時間估算已排除；器械報告值仍保留。");
    // Do not silently clamp corrupt minutes to a large plausible-looking estimate.
    cardioKcal = components.filter(c => c.source === "machine_reported").reduce((sum, c) => sum + c.kcal, 0);
    cardioLow = cardioKcal * 0.8; cardioHigh = cardioKcal * 1.2; cardioMinutes = 0;
    for (const component of components) if (component.source !== "machine_reported") { component.kcal = 0; component.minutes = 0; }
  }
  if (verified != null && cardioMinutes > verified) {
    if (!input.tolerateInvalid) throw new Error("有氧分鐘超過已確認的訓練總時間，請修正時間後再完成。");
    warn("有氧分鐘超過訓練總時間；未把整段時間再當作力量訓練。");
  }
  const minuteCaps = [verified, available].filter((value): value is number => value != null);
  const allowedResistanceMinutes = minuteCaps.length ? Math.max(0, Math.min(...minuteCaps) - cardioMinutes) : null;
  let volume = estimateWorkoutVolumeEnergy(resistance, bodyWeightKg, intensity, allowedResistanceMinutes, warn);
  let resistanceMinutes = volume.workMinutes + volume.recoveryMinutes;
  if (resistance.length) warn("力量有效時間由已記錄組數、每次約 3 秒及組間最多約 75 秒恢復估算；課程分鐘只作上限，閒置時間不累加。");
  if (resistanceMinutes + cardioMinutes > MAX_WORKOUT_MINUTES) {
    if (!input.tolerateInvalid) throw new Error("有效訓練時間超過 180 分鐘，請核對組數與時間。");
    warn("力量時間超過安全範圍，已排除；請確認實際運動時間。");
    volume = estimateWorkoutVolumeEnergy(resistance, bodyWeightKg, intensity, 0, warn); resistanceMinutes = 0;
  }
  if (!resistance.length && !components.length) warn("尚無已完成組數；不會僅因開啟訓練計時器而增加熱量。");
  if (verified != null && !resistance.length && !components.length) warn("只有時間而没有活動紀錄，未假設整段時間都是力量訓練。");
  const resistanceKcal = volume.resistanceKcal;
  const resistanceMet = resistanceMinutes > 0 ? 1 + resistanceKcal * 60 / bodyWeightKg / resistanceMinutes : 1;
  if (resistance.length) components.unshift({ kind: "resistance", minutes: resistanceMinutes, kcal: Math.round(resistanceKcal), source: WORKOUT_CALORIE_VERSION });
  let activeKcal = Math.round(resistanceKcal + cardioKcal);
  // Broad sensitivity band: app policy, not experimentally established error bounds.
  let lowKcal = Math.round(resistanceKcal * 0.5 + cardioLow);
  let highKcal = Math.round(resistanceKcal * 1.75 + cardioHigh);
  let source: WorkoutCalorieSource = resistance.length && components.some(c => c.kind === "cardio") ? "mixed"
    : resistance.length ? "resistance_estimate" : reported ? "machine_reported" : estimatedCardio ? "cardio_estimate" : "none";
  let energyBasis: WorkoutCalorieDetails["energyBasis"] = reported ? (resistanceKcal > 0 || estimatedCardio ? "mixed" : "reported_unknown") : "active";
  let manualCalories = input.manualCalories ?? null;
  if (manualCalories != null && (!Number.isFinite(manualCalories) || manualCalories < 0 || manualCalories > 10000)) {
    if (!input.tolerateInvalid) throw new Error("手動熱量必須為 0–10000 kcal，請核對單位。");
    warn("舊手動／未知來源熱量無效，未用作活動熱量；原始數值保留，請核對單位及來源。"); manualCalories = null;
  }
  if (manualCalories != null) {
    activeKcal = lowKcal = highKcal = manualCalories; source = "manual"; energyBasis = "reported_unknown";
    warn("已保留手動輸入熱量，未以估算覆寫；活動／總熱量基準未確認。");
  }
  return {
    version: WORKOUT_CALORIE_VERSION, modelVersion: WORKOUT_CALORIE_VERSION, volume, activeKcal, lowKcal, highKcal, bodyWeightKg, weightSource,
    totalVolumeKgReps: volume.totalVolumeKgReps,
    effectiveMinutes: Math.round((resistanceMinutes + cardioMinutes) * 100) / 100,
    intensity, source, warnings, energyBasis, sessionDate: input.sessionDate ?? "", weightDate: input.weightDate ?? null,
    resistanceMinutes, cardioMinutes, resistanceKcal: Math.round(resistanceKcal), cardioKcal: Math.round(cardioKcal), resistanceMet,
    durationSource: verified != null ? "verified_duration" : "logged_sets",
    timing: { mode: input.mode ?? "live", verifiedDurationMinutes: verified, availableMinutes: available },
    manualCalories, rangeMeaning: "heuristic_not_confidence_interval", components,
  };
}
