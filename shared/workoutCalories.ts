/** Conservative active-energy estimates, not a metabolic measurement or a confidence interval.
 * Compendium 2024: https://pacompendium.com/conditioning-exercise/ (02054=3.5, 02050=6).
 * https://pacompendium.com/ defines 1 MET = 1 kcal/kg/hour; active energy excludes 1 resting MET.
 * Rep cadence, recovery and uncertainty ranges below are explicit application heuristics.
 */
export const WORKOUT_CALORIE_VERSION = "workout-active-v1" as const;
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
  /** Minutes for cardio AND explicitly timed resistance work. Never seconds. */
  duration?: number | null; calories?: number | null; distance?: number | null;
}
export interface WorkoutCalorieEstimate {
  activeKcal: number; lowKcal: number; highKcal: number; bodyWeightKg: number;
  weightSource: WorkoutWeightSource; effectiveMinutes: number; intensity: WorkoutIntensity;
  source: WorkoutCalorieSource; warnings: string[];
}
export interface WorkoutCalorieDetails extends WorkoutCalorieEstimate {
  version: typeof WORKOUT_CALORIE_VERSION;
  energyBasis: "active" | "reported_unknown" | "mixed";
  sessionDate: string;
  weightDate: string | null;
  resistanceMinutes: number; cardioMinutes: number;
  resistanceKcal: number; cardioKcal: number;
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
  if (/\b(plank|wall sit|dead hang|isometric)\b/i.test(set.exerciseName ?? "")) return false;
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
  return { activeKcal, lowKcal, highKcal, bodyWeightKg, weightSource, effectiveMinutes, intensity, source, warnings };
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
  // Light uses bodyweight-general 02056 as a disclosed conservative proxy, not a load-derived MET.
  const resistanceMet = intensity === "vigorous" ? 6 : intensity === "light" ? 3 : 3.5;
  if (intensity === "light") warn("輕度強度採用一般自重訓練 3 MET 代理值，並非由舉重重量推算。");
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
      if ((set.reps ?? 0) > 0 || (set.duration ?? 0) > 0) resistance.push(set);
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
  let workMinutes = 0;
  for (const set of resistance) {
    if ((set.duration ?? 0) > 0) workMinutes += validMinutes(set.duration!, "力量組工作時間");
    else {
      const reps = set.reps ?? 0;
      if (!Number.isFinite(reps) || reps < 0 || reps > 200) {
        if (!input.tolerateInvalid) throw new Error("力量組次數必須為 0–200，請核對紀錄。");
        warn("無效力量組次數已排除。"); continue;
      }
      // 3 seconds/rep; 15–90 seconds work per completed set. No tonnage/calorie multiplier.
      workMinutes += Math.min(1.5, Math.max(0.25, reps * 3 / 60));
    }
  }
  let resistanceMinutes = resistance.length ? workMinutes + Math.max(0, resistance.length - 1) * 1.25 : 0;
  if (verified != null) resistanceMinutes = resistance.length ? Math.max(0, verified - cardioMinutes) : 0;
  else {
    if (resistance.length) warn("力量時間由已記錄組數、每次約 3 秒及組間約 75 秒恢復估算；閒置時間不累加。");
    if (available != null) resistanceMinutes = Math.min(resistanceMinutes, Math.max(0, available - cardioMinutes));
  }
  if (resistanceMinutes + cardioMinutes > MAX_WORKOUT_MINUTES) {
    if (!input.tolerateInvalid) throw new Error("有效訓練時間超過 180 分鐘，請核對組數與時間。");
    warn("力量時間超過安全範圍，已排除；請確認實際運動時間。"); resistanceMinutes = 0;
  }
  if (!resistance.length && !components.length) warn("尚無已完成組數；不會僅因開啟訓練計時器而增加熱量。");
  if (verified != null && !resistance.length && !components.length) warn("只有時間而没有活動紀錄，未假設整段時間都是力量訓練。");
  const resistanceKcal = (resistanceMet - 1) * bodyWeightKg * resistanceMinutes / 60;
  if (resistance.length) components.unshift({ kind: "resistance", minutes: resistanceMinutes, kcal: Math.round(resistanceKcal), source: "compendium_2024_active" });
  let activeKcal = Math.round(resistanceKcal + cardioKcal);
  let lowKcal = Math.round(resistanceKcal * 0.75 + cardioLow);
  let highKcal = Math.round(resistanceKcal * 1.3 + cardioHigh);
  let source: WorkoutCalorieSource = resistance.length && components.some(c => c.kind === "cardio") ? "mixed"
    : resistance.length ? "resistance_estimate" : reported ? "machine_reported" : estimatedCardio ? "cardio_estimate" : "none";
  let energyBasis: WorkoutCalorieDetails["energyBasis"] = reported ? (resistanceKcal > 0 || estimatedCardio ? "mixed" : "reported_unknown") : "active";
  if (input.manualCalories != null) {
    if (!Number.isFinite(input.manualCalories) || input.manualCalories < 0 || input.manualCalories > 10000) throw new Error("手動熱量必須為 0–10000 kcal，請核對單位。");
    activeKcal = lowKcal = highKcal = input.manualCalories; source = "manual"; energyBasis = "reported_unknown";
    warn("已保留手動輸入熱量，未以估算覆寫；活動／總熱量基準未確認。");
  }
  return {
    version: WORKOUT_CALORIE_VERSION, activeKcal, lowKcal, highKcal, bodyWeightKg, weightSource,
    effectiveMinutes: Math.round((resistanceMinutes + cardioMinutes) * 100) / 100,
    intensity, source, warnings, energyBasis, sessionDate: input.sessionDate ?? "", weightDate: input.weightDate ?? null,
    resistanceMinutes, cardioMinutes, resistanceKcal: Math.round(resistanceKcal), cardioKcal: Math.round(cardioKcal), resistanceMet,
    durationSource: verified != null ? "verified_duration" : "logged_sets",
    timing: { mode: input.mode ?? "live", verifiedDurationMinutes: verified, availableMinutes: available },
    manualCalories: input.manualCalories ?? null, rangeMeaning: "heuristic_not_confidence_interval", components,
  };
}
