export type RunningScenario =
  | "100m"
  | "200m"
  | "400m"
  | "800m"
  | "1500m"
  | "3000m"
  | "easy";

export type EasyRunDistance = "10K" | "Half Marathon" | "Marathon";

export interface EnergyModelInput {
  scenario: RunningScenario;
  easyRunDistance: EasyRunDistance;
  baselinePaceSecPerKm?: number;
  maxHeartRate?: number;
  restingHeartRate?: number;
  heightCm?: number;
  weightKg?: number;
  bodyFatPct?: number;
  muscleMassKg?: number;
  runTypeDistribution?: Array<{ type: string; count: number }>;
  historicalRunCount?: number;
  temperatureC: number;
  humidityPct: number;
  windKph: number;
}

export interface EnergyPoint {
  elapsedSeconds: number;
  atpPcr: number;
  glycolytic: number;
  aerobic: number;
  vo2: number;
  heartRate: number;
  respirationRate: number;
  breathDepth: number;
  lactate: number;
  oxygenDebt: number;
}

export interface RunningEnergySimulation {
  title: string;
  distanceKm: number;
  baselineFinishSeconds: number;
  weatherFinishSeconds: number;
  weatherLoadPercent: number;
  paceSecPerKm: number;
  weatherPaceSecPerKm: number;
  peakLactate: number;
  peakVo2: number;
  peakHeartRate: number;
  recovery: { after1MinHr: number; after3MinHr: number; after5MinHr: number; oxygenDebtClearPct: number };
  calibration: { level: "個人化" | "部分個人化" | "參考值"; notes: string[] };
  timeline: EnergyPoint[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const hasNumber = (value: number | undefined): value is number => value !== undefined && Number.isFinite(value);

function getScenarioExperience(input: EnergyModelInput): number {
  const entries = input.runTypeDistribution ?? [];
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.count || 0), 0);
  if (!total) return 0;
  const scenarioTerms = input.scenario === "easy"
    ? ["easy", "long", "recovery", "trail"]
    : input.scenario === "100m" || input.scenario === "200m"
      ? ["sprint", "interval", "time trial"]
      : input.scenario === "400m" || input.scenario === "800m"
        ? ["interval", "tempo", "race", "fartlek"]
        : ["tempo", "race", "long", "interval"];
  const matching = entries
    .filter(entry => scenarioTerms.some(term => entry.type.toLowerCase().includes(term)))
    .reduce((sum, entry) => sum + Math.max(0, entry.count || 0), 0);
  return clamp(matching / total, 0, 1);
}

const profileFor = (scenario: RunningScenario, easyRunDistance: EasyRunDistance) => {
  if (scenario === "easy") {
    const distanceKm = easyRunDistance === "10K" ? 10 : easyRunDistance === "Half Marathon" ? 21.0975 : 42.195;
    return { title: `穩定慢跑 · ${easyRunDistance}`, distanceKm, referenceSeconds: distanceKm * 360, intensity: 0.66 };
  }
  const profiles: Record<Exclude<RunningScenario, "easy">, { title: string; distanceKm: number; referenceSeconds: number; intensity: number }> = {
    "100m": { title: "100m 衝刺", distanceKm: 0.1, referenceSeconds: 16, intensity: 1 },
    "200m": { title: "200m 衝刺", distanceKm: 0.2, referenceSeconds: 34, intensity: 0.98 },
    "400m": { title: "400m 競速", distanceKm: 0.4, referenceSeconds: 76, intensity: 0.95 },
    "800m": { title: "800m 競速", distanceKm: 0.8, referenceSeconds: 174, intensity: 0.91 },
    "1500m": { title: "1500m 競速", distanceKm: 1.5, referenceSeconds: 360, intensity: 0.87 },
    "3000m": { title: "3000m 競速", distanceKm: 3, referenceSeconds: 780, intensity: 0.83 },
  };
  return profiles[scenario];
};

export const formatSeconds = (seconds: number) => {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
};

export const formatPace = (secondsPerKm: number) => `${Math.floor(secondsPerKm / 60)}:${String(Math.round(secondsPerKm % 60)).padStart(2, "0")}/km`;

/**
 * Educational, personal-data-calibrated estimate. This is not a laboratory VO₂, lactate,
 * respiratory, clinical heat-stress, or performance prediction measurement.
 */
export function buildRunningEnergySimulation(input: EnergyModelInput): RunningEnergySimulation {
  const profile = profileFor(input.scenario, input.easyRunDistance);
  const baselinePace = clamp(input.baselinePaceSecPerKm || 360, 210, 600);
  const maxHr = clamp(input.maxHeartRate || 185, 150, 220);
  const restingHr = clamp(input.restingHeartRate || 58, 38, 100);
  const enduranceFactor = clamp(360 / baselinePace, 0.72, 1.28);
  const scenarioExperience = getScenarioExperience(input);
  const weightAdjustment = hasNumber(input.weightKg) ? clamp((input.weightKg - 70) * 0.055, -1.4, 3.2) : 0;
  const bodyFatAdjustment = hasNumber(input.bodyFatPct) ? clamp((input.bodyFatPct - 18) * 0.06, -0.7, 2.2) : 0;
  const muscleRatio = hasNumber(input.muscleMassKg) && hasNumber(input.weightKg) && input.weightKg > 0
    ? input.muscleMassKg / input.weightKg
    : null;
  const muscleEfficiency = muscleRatio === null ? 0 : clamp((muscleRatio - 0.7) * 4.5, -0.7, 0.7);
  const heightAdjustment = hasNumber(input.heightCm) ? clamp((input.heightCm - 172) * -0.008, -0.25, 0.25) : 0;
  const historyConfidence = clamp((input.historicalRunCount ?? 0) / 24, 0, 1);
  const personalPerformanceAdjustment = clamp(
    (weightAdjustment + bodyFatAdjustment - muscleEfficiency + heightAdjustment) * (0.45 + historyConfidence * 0.55)
      - scenarioExperience * 0.7,
    -2.5,
    4.5,
  );
  const calibrationNotes: string[] = [];
  if (hasNumber(input.heightCm)) calibrationNotes.push(`身高 ${input.heightCm.toFixed(0)} cm`);
  if (hasNumber(input.weightKg)) calibrationNotes.push(`體重 ${input.weightKg.toFixed(1)} kg`);
  if (hasNumber(input.bodyFatPct)) calibrationNotes.push(`體脂 ${input.bodyFatPct.toFixed(1)}%`);
  if (hasNumber(input.muscleMassKg)) calibrationNotes.push(`肌肉量 ${input.muscleMassKg.toFixed(1)} kg`);
  if ((input.historicalRunCount ?? 0) > 0) calibrationNotes.push(`${input.historicalRunCount} 次完整歷史跑步記錄`);
  if (scenarioExperience > 0) calibrationNotes.push(`${Math.round(scenarioExperience * 100)}% 同類型訓練比重`);
  const calibrationLevel = calibrationNotes.length >= 4 ? "個人化" : calibrationNotes.length >= 2 ? "部分個人化" : "參考值";

  const baselineFinishSeconds = input.scenario === "easy"
    ? profile.distanceKm * baselinePace * (1 + personalPerformanceAdjustment / 100)
    : (profile.referenceSeconds / enduranceFactor) * (1 + personalPerformanceAdjustment / 100);

  // Conservative weather load: temperature has the largest weight, then humidity and wind.
  const heatLoad = Math.max(0, input.temperatureC - 12) * 0.16 + Math.max(0, 8 - input.temperatureC) * 0.06;
  const humidityLoad = Math.max(0, input.humidityPct - 55) * Math.max(0, input.temperatureC - 14) * 0.004;
  const windLoad = Math.max(0, input.windKph - 6) * 0.065;
  const bodyHeatLoad = Math.max(0, weightAdjustment + bodyFatAdjustment - muscleEfficiency) * 0.28;
  const weatherLoadPercent = clamp(heatLoad + humidityLoad + windLoad + bodyHeatLoad, 0, 18);
  const weatherFinishSeconds = baselineFinishSeconds * (1 + weatherLoadPercent / 100);
  const weatherPaceSecPerKm = weatherFinishSeconds / profile.distanceKm;

  const duration = weatherFinishSeconds;
  // Shift gradually from phosphagen/glycolytic work toward aerobic dominance.
  // The 45–780 second window deliberately keeps 100–400m predominantly anaerobic,
  // while 3000m and steady endurance work move progressively toward aerobic supply.
  const durationFactor = clamp((duration - 45) / 735, 0, 1);
  const intensity = profile.intensity;
  const timeline: EnergyPoint[] = Array.from({ length: 41 }, (_, index) => {
    const progress = index / 40;
    const elapsedSeconds = duration * progress;
    const atpRaw = 0.15 + 1.7 * Math.exp(-progress * (5.5 - 1.8 * durationFactor));
    const glycolyticCenter = duration < 90 ? 0.33 : duration < 480 ? 0.42 : 0.2;
    const glycolyticSpread = duration < 90 ? 4.4 : duration < 480 ? 3 : 1.6;
    const glycolyticRaw = 0.28 + (0.38 + 0.9 * intensity) * Math.exp(-Math.pow((progress - glycolyticCenter) * glycolyticSpread, 2));
    const aerobicRaw = 0.04 + (0.08 + durationFactor * 1.75) * (1 - Math.exp(-progress * (4.8 + durationFactor * 2)));
    const totalEnergy = atpRaw + glycolyticRaw + aerobicRaw;
    const atpPcr = (atpRaw / totalEnergy) * 100;
    const glycolytic = (glycolyticRaw / totalEnergy) * 100;
    const aerobic = (aerobicRaw / totalEnergy) * 100;
    const exertion = clamp(0.22 + intensity * (0.78 - 0.23 * Math.exp(-progress * 4)), 0, 1);
    const vo2 = clamp(8 + 58 * exertion * (1 - Math.exp(-progress * 5.4)) + muscleEfficiency * 1.8 - bodyFatAdjustment * 0.7, 0, 72);
    const heartRate = clamp(restingHr + (maxHr - restingHr) * exertion * (1 - Math.exp(-progress * 4.2)) + weatherLoadPercent * 0.2, restingHr, maxHr);
    const respirationRate = clamp(13 + 45 * exertion * (1 - Math.exp(-progress * 3.8)), 10, 64);
    const breathDepth = clamp(0.25 + 0.72 * exertion * (1 - Math.exp(-progress * 3.2)), 0, 1);
    const lactate = clamp(1.1 + 13.2 * intensity * (glycolytic / 100) * (0.58 + progress * 0.42) + weatherLoadPercent * 0.025, 0.8, 22);
    const oxygenDebt = clamp((100 - aerobic) * intensity * (0.42 + progress * 0.55), 0, 100);
    return {
      elapsedSeconds,
      atpPcr: Number(atpPcr.toFixed(1)),
      glycolytic: Number(glycolytic.toFixed(1)),
      aerobic: Number(aerobic.toFixed(1)),
      vo2: Number(vo2.toFixed(1)),
      heartRate: Math.round(heartRate),
      respirationRate: Math.round(respirationRate),
      breathDepth: Number(breathDepth.toFixed(2)),
      lactate: Number(lactate.toFixed(1)),
      oxygenDebt: Number(oxygenDebt.toFixed(1)),
    };
  });

  const finalPoint = timeline[timeline.length - 1];
  const recoveryDrop = clamp((maxHr - restingHr) * (0.36 + durationFactor * 0.14), 22, 66);
  return {
    title: profile.title,
    distanceKm: profile.distanceKm,
    baselineFinishSeconds,
    weatherFinishSeconds,
    weatherLoadPercent: Number(weatherLoadPercent.toFixed(1)),
    paceSecPerKm: baselineFinishSeconds / profile.distanceKm,
    weatherPaceSecPerKm,
    peakLactate: Math.max(...timeline.map(point => point.lactate)),
    peakVo2: Math.max(...timeline.map(point => point.vo2)),
    peakHeartRate: Math.max(...timeline.map(point => point.heartRate)),
    recovery: {
      after1MinHr: Math.round(clamp(finalPoint.heartRate - recoveryDrop, restingHr, maxHr)),
      after3MinHr: Math.round(clamp(finalPoint.heartRate - recoveryDrop * 1.65, restingHr, maxHr)),
      after5MinHr: Math.round(clamp(finalPoint.heartRate - recoveryDrop * 2.05, restingHr, maxHr)),
      oxygenDebtClearPct: Math.round(clamp(58 + durationFactor * 22 - weatherLoadPercent * 0.4, 35, 86)),
    },
    calibration: { level: calibrationLevel, notes: calibrationNotes },
    timeline,
  };
}
