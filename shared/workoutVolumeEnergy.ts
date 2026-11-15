import type { CalorieWorkoutSet, WorkoutIntensity } from "./workoutCalories";

/** Application assumptions, NOT calibrated physiology or confidence intervals. */
export const WORKOUT_VOLUME_ASSUMPTIONS = {
  gravityMPerSecondSquared: 9.80665,
  joulesPerKcal: 4184,
  positiveWorkEfficiency: 0.25,
  secondsPerRep: 3,
  recoveryMinutesPerGap: 1.25,
  maxWorkMinutesPerRepSet: 1.5,
  minWorkMinutesPerRepSet: 0.25,
  maxActiveWorkMetEquivalent: 8,
} as const;

export type WorkoutMovementClass = "lower_compound" | "hip_hinge" | "upper_push" | "upper_pull"
  | "machine_lower" | "hip_isolation" | "assisted_bodyweight"
  | "isolation" | "bodyweight_push" | "bodyweight_pull" | "core" | "isometric" | "generic_strength";
export interface WorkoutMovementAssumption {
  movementClass: WorkoutMovementClass;
  /** Positive load-path displacement per rep; not the full out-and-back path. */
  displacementM: number;
  /** Heuristic fraction of body mass displaced; NOT measured muscle activation. */
  bodyMassFraction: number;
  internalSupportActiveMet: number;
}
export function workoutMovementAssumption(name = ""): WorkoutMovementAssumption {
  const movement = (movementClass: WorkoutMovementClass, displacementM: number, bodyMassFraction: number, internalSupportActiveMet: number) =>
    ({ movementClass, displacementM, bodyMassFraction, internalSupportActiveMet });
  if (/\b(plank|wall[ -]?sit|dead[ -]?hang|isometric|hold)\b|平板|靜態|靠牆/i.test(name)) return movement("isometric", 0, 0, 2);
  if (/assisted|assistance|輔助|辅助/i.test(name) && /pull[ -]?ups?|chin[ -]?ups?|\bdips?\b|引體|引体|雙槓|双杠/i.test(name))
    return movement("assisted_bodyweight", 0, 0, 1.8);
  if (/\b(pull[ -]?ups?|chin[ -]?ups?)\b|引體/i.test(name)) return movement("bodyweight_pull", 0.4, 0.9, 1.8);
  if (/\b(push[ -]?ups?|dips?)\b|掌上壓|俯臥撐|雙槓/i.test(name)) return movement("bodyweight_push", 0.2, 0.65, 1.8);
  if (/leg[ -]?press|hack[ -]?squat|腿推|蹬腿|哈克/i.test(name)) return movement("machine_lower", 0.3, 0.02, 2);
  if (/hip[ -]?(adduction|abduction)|adductor|abductor|髖內收|髖外展|髖外收|髋内收|髋外展/i.test(name)) return movement("hip_isolation", 0.2, 0.02, 1.4);
  if (/squat|lunge|step[ -]?up|深蹲|弓步/i.test(name)) return movement("lower_compound", 0.45, 0.5, 2.2);
  if (/deadlift|hip thrust|good morning|硬拉|臀推/i.test(name)) return movement("hip_hinge", 0.5, 0.35, 2);
  if (/curl|extension|raise|fly|flye|彎舉|伸展|飛鳥|平舉/i.test(name)) return movement("isolation", 0.25, 0.02, 1.4);
  if (/press|推胸|肩推|胸推/i.test(name)) return movement("upper_push", 0.35, 0.05, 1.6);
  if (/row|pulldown|pull[ -]?down|face pull|划船|下拉/i.test(name)) return movement("upper_pull", 0.4, 0.05, 1.6);
  if (/crunch|sit[ -]?up|ab wheel|捲腹|卷腹|仰臥起坐/i.test(name)) return movement("core", 0.15, 0.15, 1.6);
  return movement("generic_strength", 0.3, 0.1, 1.6);
}
export interface WorkoutVolumeMovement extends WorkoutMovementAssumption {
  exerciseName: string;
  reps: number;
  loggedLoadKg: number | null;
  volumeKgReps: number;
  workMinutes: number;
  externalWorkJ: number;
  bodyMovementWorkJ: number;
  equipmentAmbiguous: boolean;
}
export interface WorkoutVolumeEnergy {
  /** Sum of kg × reps across completed resistance rows; each row is ONE set. */
  totalVolumeKgReps: number;
  totalReps: number;
  completedSets: number;
  missingLoadSets: number;
  equipmentAmbiguousSets: number;
  assumedEfficiency: number;
  workMinutes: number;
  recoveryMinutes: number;
  /** Raw assumed mechanical work, before timing / energy safety scaling. */
  externalWorkJ: number;
  bodyMovementWorkJ: number;
  externalEnergyKcal: number;
  bodyMovementEnergyKcal: number;
  internalSupportKcal: number;
  recoveryKcal: number;
  resistanceKcal: number;
  /** Combined time-availability and ceiling factor applied to all kcal components. */
  appliedEnergyScale: number;
  capped: boolean;
  capKcal: number;
  movements: WorkoutVolumeMovement[];
}
export function validWorkoutReps(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 200;
}
export function validWorkoutLoad(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1000;
}
/** Inputs must already have safe durations/reps/loads. Cardio rows must not be passed here. */
export function estimateWorkoutVolumeEnergy(
  sets: readonly CalorieWorkoutSet[], bodyWeightKg: number, intensity: WorkoutIntensity,
  allowedMinutes: number | null, warn: (text: string) => void,
): WorkoutVolumeEnergy {
  const a = WORKOUT_VOLUME_ASSUMPTIONS;
  const movements: WorkoutVolumeMovement[] = sets.map(set => {
    const assumption = workoutMovementAssumption(set.exerciseName ?? "");
    const reps = validWorkoutReps(set.reps) ? set.reps : 0;
    const loggedLoadKg = validWorkoutLoad(set.weight) ? set.weight : null;
    const volumeKgReps = (loggedLoadKg ?? 0) * reps;
    const workMinutes = (set.duration ?? 0) > 0 ? set.duration!
      : reps > 0 ? Math.min(a.maxWorkMinutesPerRepSet, Math.max(a.minWorkMinutesPerRepSet, reps * a.secondsPerRep / 60)) : 0;
    // No inferred reps for timed movements; isometrics have zero external displacement.
    const externalWorkJ = volumeKgReps * a.gravityMPerSecondSquared * assumption.displacementM;
    const bodyMovementWorkJ = bodyWeightKg * assumption.bodyMassFraction * a.gravityMPerSecondSquared * assumption.displacementM * reps;
    const equipmentAmbiguous = loggedLoadKg != null && loggedLoadKg > 0;
    if (assumption.movementClass === "generic_strength") warn("未確認動作類別，暫用通用力量動作幅度 0.30 m 與自重比例；這不是已量測的肌肉啟動或移動體重，請核對器械及動作。");
    if (equipmentAmbiguous) warn("負重按每組記錄的 kg 原值計算，不自動乘雙手、槓片或滑輪比例；器械配重、滑輪／槓桿、輔助重量及啞鈴單邊／總重有歧義，需人工確認。");
    if (loggedLoadKg == null) warn("部分力量組缺少負重；沒有捏造 kg，僅估算有紀錄的自重動作／支撐及恢復，訓練量可能低估。");
    if (assumption.movementClass === "assisted_bodyweight") warn("輔助引體／雙槓的配重不是新增舉重負荷；輔助比例未確認，已排除配重及自重位移的機械功，僅估算工作支撐及恢復。kg·次保留為字面紀錄，並非實際受力訓練量。");
    if (assumption.movementClass === "isometric") warn("等長／靜態動作外部位移設為 0，不代表零代謝消耗；使用工作分鐘的支撐分量，未把負重當作動態舉重功。");
    if ((set.duration ?? 0) > 0 && !reps) warn("計時力量組沒有次數，不反推次數或 kg·次訓練量；採用動作支撐分量，請補充實際次數以估算動態機械功。");
    return { ...assumption, exerciseName: set.exerciseName ?? "未命名力量動作", reps, loggedLoadKg,
      volumeKgReps, workMinutes, externalWorkJ, bodyMovementWorkJ, equipmentAmbiguous };
  }).filter(m => m.workMinutes > 0);
  const sum = (fn: (m: WorkoutVolumeMovement) => number) => movements.reduce((n, m) => n + fn(m), 0);
  const rawWorkMinutes = sum(m => m.workMinutes);
  const rawRecoveryMinutes = Math.max(0, movements.length - 1) * a.recoveryMinutesPerGap;
  const rawMinutes = rawWorkMinutes + rawRecoveryMinutes;
  const timingScale = rawMinutes > 0 && allowedMinutes != null ? Math.min(1, Math.max(0, allowedMinutes) / rawMinutes) : 1;
  const workMinutes = rawWorkMinutes * timingScale;
  const recoveryMinutes = rawRecoveryMinutes * timingScale;
  if (timingScale < 1) warn("可用／已確認分鐘少於組數推算工作與恢復；能量分量已按時間比例縮減，原始 kg·次保留，請核對組數及時間。");
  const intensityScale = intensity === "light" ? 0.8 : intensity === "vigorous" ? 1.25 : 1;
  const recoveryActiveMet = intensity === "light" ? 0.5 : intensity === "vigorous" ? 1 : 0.75;
  const externalWorkJ = sum(m => m.externalWorkJ);
  const bodyMovementWorkJ = sum(m => m.bodyMovementWorkJ);
  let externalEnergyKcal = externalWorkJ / a.joulesPerKcal / a.positiveWorkEfficiency * timingScale;
  let bodyMovementEnergyKcal = bodyMovementWorkJ / a.joulesPerKcal / a.positiveWorkEfficiency * timingScale;
  let internalSupportKcal = sum(m => m.internalSupportActiveMet * bodyWeightKg * m.workMinutes / 60) * intensityScale * timingScale;
  let recoveryKcal = recoveryActiveMet * bodyWeightKg * recoveryMinutes / 60;
  const rawKcal = externalEnergyKcal + bodyMovementEnergyKcal + internalSupportKcal + recoveryKcal;
  // A safety ceiling, not a physiological maximum or a validated accuracy guarantee.
  const capKcal = a.maxActiveWorkMetEquivalent * bodyWeightKg * workMinutes / 60
    + recoveryActiveMet * bodyWeightKg * recoveryMinutes / 60;
  const capScale = rawKcal > capKcal && rawKcal > 0 ? capKcal / rawKcal : 1;
  const capped = capScale < 1;
  if (capped) warn("機械功能量超出本模型安全上限，已限制活動分量；這不是生理上限或準確度保證，請核對重量、器械比例及動作幅度。");
  externalEnergyKcal *= capScale; bodyMovementEnergyKcal *= capScale;
  internalSupportKcal *= capScale; recoveryKcal *= capScale;
  if (movements.length) {
    warn("力量熱量包含負重×次數×動作正向幅度的機械功，假設效率 25%；另計自重移動、工作支撐及有限組間恢復，未疊加舊版整段 MET 熱量。");
    warn("動作幅度、自重比例、效率及恢復均為未驗證假設；未量測力竭程度、速度、離心消耗或訓練後耗氧，範圍不是統計信賴區間。");
  }
  return {
    totalVolumeKgReps: sum(m => m.volumeKgReps), totalReps: sum(m => m.reps), completedSets: movements.length,
    missingLoadSets: movements.filter(m => m.loggedLoadKg == null).length,
    equipmentAmbiguousSets: movements.filter(m => m.equipmentAmbiguous).length,
    assumedEfficiency: a.positiveWorkEfficiency, workMinutes, recoveryMinutes, externalWorkJ, bodyMovementWorkJ,
    externalEnergyKcal, bodyMovementEnergyKcal, internalSupportKcal, recoveryKcal,
    resistanceKcal: externalEnergyKcal + bodyMovementEnergyKcal + internalSupportKcal + recoveryKcal,
    appliedEnergyScale: timingScale * capScale, capped, capKcal, movements,
  };
}
