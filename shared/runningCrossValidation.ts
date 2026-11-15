/**
 * Pure, deterministic validation of measured running pace, NOT race ability.
 * Callers link historical weather and pre-run physiology; this module fetches nothing.
 * Dates must already be local Hong Kong calendar dates. Pre-run features must really
 * have been available before the run; fullHistoryComplete is a caller attestation.
 * Fixed policies are deliberately not tunable on the held-out results.
 */
export type HongKongDate = string;
export type RunningTargetDefinition =
  | "moving_pace_seconds_per_km"
  | "summary_pace_seconds_per_km";
export type RunningRunType =
  | "easy" | "recovery" | "steady" | "tempo" | "long"
  | "interval" | "sprint" | "test" | "race";
export type RunningSurface = "road" | "track" | "treadmill" | "trail" | "mixed" | "unknown";
export type RunningTerrain = "flat" | "rolling" | "hilly" | "unknown";
export interface RunningStratum {
  runType: RunningRunType;
  surface: RunningSurface;
  terrain: RunningTerrain;
  targetDefinition: RunningTargetDefinition;
}
export interface PreRunContext {
  /** Celsius, not Fahrenheit. Missing/null is not zero. */
  temperatureC?: number | null;
  /** Percentage points in [0, 100], not a 0..1 fraction. */
  relativeHumidityPct?: number | null;
  /** Hours of sleep preceding this run; zero is an observed zero. */
  preRunSleepHours?: number | null;
  /** Beats/minute measured before this run, never post-run heart rate. */
  preRunRestingHrBpm?: number | null;
  /**
   * Optional caller-verified pre-run delta in bpm, bounded [-40, 40]. Caller must
   * use >=5 distinct valid earlier baseline days, preceding the selected pre-run
   * measurement day, within 28 days. If supplied, this takes precedence over the
   * fallback run-day baseline. Never supply post-run or future-derived deltas.
   */
  preRunRestingHrDeltaBpm?: number | null;
}
export interface RunningContextRun {
  id: string;
  hkDate: HongKongDate;
  stratum: RunningStratum;
  distanceKm: number;
  /** Measured moving or summary pace, as specified by stratum.targetDefinition. */
  measuredPaceSecondsPerKm: number;
  hasMaterialPauses: boolean;
  context: PreRunContext;
}
export interface RestingHrHistoryDay {
  hkDate: HongKongDate;
  restingHrBpm: number;
}
export interface RunningContextHistory {
  runs: readonly RunningContextRun[];
  /** Optional baseline source. Current-day and future observations are never used. */
  restingHrHistory?: readonly RestingHrHistoryDay[];
  /** False for pagination, truncation, omitted runs, or uncertain completeness. */
  fullHistoryComplete: boolean;
}
export interface RunningValidationCohort {
  stratum: RunningStratum;
  referenceDistanceKm: number;
  /** Exclusive cutoff; every same-day row is excluded. */
  beforeHkDate?: HongKongDate;
}
export interface RunningContextQuery {
  hkDate: HongKongDate;
  stratum: RunningStratum;
  distanceKm: number;
  context: PreRunContext;
}
export type RunningContextFeature =
  | "temperatureC" | "temperatureHumidityInteraction"
  | "preRunSleepHours" | "restingHrDeltaBpm";
export type RunningValidationStatus =
  | "insufficient_data" | "limited" | "no_evidence" | "model_worse" | "supported";
export interface RunningErrorMetrics {
  matchedRows: number;
  matchedDays: number;
  /** Both models are scored on exactly the same observed test rows. */
  baselineMaeSecondsPerKm: number;
  contextMaeSecondsPerKm: number;
  baselineMedianAbsolutePercentError: number;
  contextMedianAbsolutePercentError: number;
  absoluteMaeImprovementSecondsPerKm: number;
  /** Null when baseline MAE is zero; never divide by a zero/near-zero error. */
  relativeMaeImprovement: number | null;
  fractionOfDaysImproved: number;
}
export interface RunningFeatureCoverage {
  feature: RunningContextFeature;
  enabledInLatestModel: boolean;
  observedTrainingRows: number;
  observedTrainingDays: number;
  missingTrainingRows: number;
  invalidTrainingRows: number;
  trainingStandardDeviation: number | null;
  imputationValue: number | null;
  trainingSupport: { min: number; max: number } | null;
  /** Ridge association per one learned training SD, not a causal contribution. */
  estimatedSecondsPerTrainingSd: number | null;
  observedHeldOutRows: number;
  observedHeldOutDays: number;
}
export interface RunningHeldOutPrediction {
  runId: string;
  hkDate: HongKongDate;
  measuredPaceSecondsPerKm: number;
  baselinePaceSecondsPerKm: number;
  rawContextModelPaceSecondsPerKm: number;
  /** Same bounded additive estimator used by deployment, not an untested raw correction. */
  contextPaceSecondsPerKm: number;
  trainingDayCount: number;
  trainingLatestHkDate: HongKongDate;
  featureNames: RunningContextFeature[];
  observedFeatureNames: RunningContextFeature[];
}
export interface EmpiricalResidualInterval {
  label: "observed_out_of_time_residual_80_percent_interval";
  /** Observed pace minus model pace, empirical 10th/90th percentiles. */
  lowerSecondsPerKm: number;
  upperSecondsPerKm: number;
  matchedRows: number;
  matchedDays: number;
  isConfidenceInterval: false;
  /** Descriptive only: neither a calibrated prediction interval nor a guarantee. */
  guaranteesFutureCoverage: false;
}
export interface RunningCrossValidationReport {
  status: RunningValidationStatus;
  reasons: string[];
  targetDefinition: RunningTargetDefinition;
  interpretation: "measured_pace_in_exact_stratum_not_maximum_race_ability";
  contextEstimatePolicy: "ridge_with_bounded_additive_correction";
  stratum: RunningStratum;
  referenceDistanceKm: number;
  fullHistoryComplete: boolean;
  eligibleRows: number;
  eligibleDays: number;
  rejectedRows: number;
  skippedTestRows: number;
  latestTrainingDays: number;
  latestFeatureNames: RunningContextFeature[];
  metrics: RunningErrorMetrics | null;
  /** Same feature schema as latest model, all active inputs actually observed. */
  deploymentEvidence: RunningErrorMetrics | null;
  deploymentEvidenceSufficient: boolean;
  /** Evidence gate only. Query support/completeness must still pass predictRunningContext. */
  deploymentEligible: boolean;
  featureCoverage: RunningFeatureCoverage[];
  residual80PercentInterval: EmpiricalResidualInterval | null;
  heldOutPredictions: RunningHeldOutPrediction[];
  limitations: readonly string[];
}
export type RunningPredictionBlocker =
  | "invalid_query" | "unsupported_stratum" | "insufficient_training"
  | "no_context_features" | "distance_outside_training_support"
  | "missing_or_invalid_context" | "context_outside_training_support"
  | "incomplete_history" | "insufficient_deployment_evidence"
  | "model_worse" | "no_meaningful_improvement" | "non_finite_prediction";
export interface RunningContextPrediction {
  status: "enabled" | "not_enabled";
  autoApplyAllowed: boolean;
  reason: RunningPredictionBlocker | null;
  validation: RunningCrossValidationReport;
  baselinePaceSecondsPerKm?: number;
  contextModelPaceSecondsPerKm?: number;
  /** Present ONLY when every deployment gate passes; bounded ADDITIVE change. */
  correctionSecondsPerKm?: number;
  correctedPaceSecondsPerKm?: number;
  /** Noncausal model terms relative to earlier training feature centers, before bounding. */
  featureContributions?: { feature: RunningContextFeature; secondsPerKm: number }[];
  /** Historical residuals for the bounded estimator; not a confidence interval. */
  residual80PercentInterval: EmpiricalResidualInterval | null;
}
export const RUNNING_CROSS_VALIDATION_POLICY = Object.freeze({
  minimumTrainingDays: 20,
  minimumHeldOutDays: 10,
  minimumFeatureObservations: 10,
  minimumFeatureObservedDays: 10,
  minimumFeatureStandardDeviation: 0.000001,
  maximumDistanceRatio: 1.15,
  ridgePenalty: 4,
  minimumAbsoluteMaeImprovementSecondsPerKm: 3,
  minimumRelativeMaeImprovement: 0.05,
  minimumFractionOfDaysImproved: 0.6,
  maximumCorrectionSecondsPerKm: 15,
  maximumCorrectionFractionOfBaseline: 0.03,
  maximumNearestContextRmsZDistance: 1.5,
  minimumEarlierRestingHrDays: 5,
  restingHrLookbackDays: 28,
});
const POLICY = RUNNING_CROSS_VALIDATION_POLICY;
const FEATURES: RunningContextFeature[] = [
  "temperatureC", "temperatureHumidityInteraction", "preRunSleepHours", "restingHrDeltaBpm",
];
const LIMITATIONS = Object.freeze([
  "Associations are not causal; weather, sleep and resting heart rate can share unmeasured confounds.",
  "Measured easy/steady/tempo/long pace is not maximum race ability or a guaranteed finish time.",
  "Only exact type, surface, terrain and target-definition strata and nearby distances are compared.",
  "Intervals, sprints, material pauses, trail/mixed/unknown surfaces, test efforts and races are excluded; exact unknown terrain permits description only, never deployment.",
  "Missing features are imputed from earlier training only; deployment requires all active features observed.",
  "Empirical residual quantiles describe past out-of-time errors, not confidence or guaranteed future coverage.",
  "Caller must attest complete history and pre-run feature provenance; this module cannot verify data sourcing.",
  "Expanding history does not explicitly model fitness trends or changing effort; recent-half improvement is required but does not eliminate time confounding.",
  "Only median-baseline versus joint-context ridge is tested; individual feature effects and incremental weather-versus-physiology benefit are not separately validated.",
]);
interface FeatureValues {
  values: Partial<Record<RunningContextFeature, number>>;
  invalid: Set<RunningContextFeature>;
  humidity?: number;
}
interface PreparedRun extends RunningContextRun { features: FeatureValues }
interface FeatureScale {
  name: RunningContextFeature;
  impute: number;
  center: number;
  sd: number;
  min: number;
  max: number;
}
interface FittedModel {
  rows: PreparedRun[];
  days: string[];
  baseline: number;
  scales: FeatureScale[];
  coefficients: number[];
  coverage: RunningFeatureCoverage[];
  temperatureSupport: { min: number; max: number } | null;
  humiditySupport: { min: number; max: number } | null;
}
const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const inRange = (x: unknown, min: number, max: number): x is number => finite(x) && x >= min && x <= max;
const validDistance = (x: unknown) => inRange(x, 0.2, 200);
const validPace = (x: unknown) => inRange(x, 90, 1800);
function validDate(date: unknown): date is HongKongDate {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}
function dayNumber(date: HongKongDate): number { return Date.parse(`${date}T00:00:00Z`) / 86400000; }
function quantile(values: readonly number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * q;
  const lower = Math.floor(index);
  return sorted[lower] + (sorted[Math.ceil(index)] - sorted[lower]) * (index - lower);
}
function median(values: readonly number[]): number { return quantile(values, 0.5); }
function mean(values: readonly number[]): number { return values.reduce((sum, v) => sum + v, 0) / values.length; }
function uniqueDays(rows: readonly { hkDate: string }[]): string[] {
  return Array.from(new Set(rows.map(row => row.hkDate))).sort();
}
function exactStratum(a: RunningStratum, b: RunningStratum): boolean {
  return a.runType === b.runType && a.surface === b.surface && a.terrain === b.terrain && a.targetDefinition === b.targetDefinition;
}
function analyzableStratum(stratum: RunningStratum): boolean {
  return !!stratum && ["easy", "recovery", "steady", "tempo", "long"].includes(stratum.runType)
    && ["road", "track", "treadmill", "unknown"].includes(stratum.surface)
    && ["flat", "rolling", "hilly", "unknown"].includes(stratum.terrain)
    && ["moving_pace_seconds_per_km", "summary_pace_seconds_per_km"].includes(stratum.targetDefinition);
}
function supportedStratum(stratum: RunningStratum): boolean {
  return analyzableStratum(stratum) && stratum.terrain !== "unknown" && stratum.surface !== "unknown";
}
function nearDistance(a: number, b: number): boolean {
  return validDistance(a) && validDistance(b) && Math.max(a, b) / Math.min(a, b) <= POLICY.maximumDistanceRatio + 1e-12;
}
function earlierRestingHrBaseline(history: readonly RestingHrHistoryDay[], date: string): number | undefined {
  const days = new Map<string, number[]>();
  const oldest = dayNumber(date) - POLICY.restingHrLookbackDays;
  for (const row of history) {
    if (!validDate(row.hkDate) || row.hkDate >= date || dayNumber(row.hkDate) < oldest || !inRange(row.restingHrBpm, 30, 150)) continue;
    const values = days.get(row.hkDate) ?? [];
    values.push(row.restingHrBpm);
    days.set(row.hkDate, values);
  }
  // Duplicate readings on one day never manufacture baseline days.
  return days.size >= POLICY.minimumEarlierRestingHrDays
    ? median(Array.from(days.values()).map(values => median(values))) : undefined;
}
function getFeatures(context: PreRunContext, date: string, hrHistory: readonly RestingHrHistoryDay[]): FeatureValues {
  const values: FeatureValues["values"] = {};
  const invalid = new Set<RunningContextFeature>();
  const read = (value: number | null | undefined, min: number, max: number, feature: RunningContextFeature) => {
    if (value == null) return undefined;
    if (!inRange(value, min, max)) { invalid.add(feature); return undefined; }
    return value;
  };
  const temperature = read(context.temperatureC, -30, 55, "temperatureC");
  const humidity = read(context.relativeHumidityPct, 0, 100, "temperatureHumidityInteraction");
  const sleep = read(context.preRunSleepHours, 0, 16, "preRunSleepHours");
  const restingHr = read(context.preRunRestingHrBpm, 30, 150, "restingHrDeltaBpm");
  if (temperature !== undefined) values.temperatureC = temperature;
  if (temperature !== undefined && humidity !== undefined) values.temperatureHumidityInteraction = temperature * humidity / 100;
  if (invalid.has("temperatureC")) invalid.add("temperatureHumidityInteraction");
  if (sleep !== undefined) values.preRunSleepHours = sleep;
  if (Object.prototype.hasOwnProperty.call(context, "preRunRestingHrDeltaBpm")) {
    const delta = read(context.preRunRestingHrDeltaBpm, -40, 40, "restingHrDeltaBpm");
    if (delta !== undefined) values.restingHrDeltaBpm = delta;
  } else if (restingHr !== undefined) {
    const baseline = earlierRestingHrBaseline(hrHistory, date);
    if (baseline !== undefined) {
      const delta = read(restingHr - baseline, -40, 40, "restingHrDeltaBpm");
      if (delta !== undefined) values.restingHrDeltaBpm = delta;
    }
  }
  return { values, invalid, humidity };
}
function prepare(history: RunningContextHistory, cohort: RunningValidationCohort): PreparedRun[] {
  if (!analyzableStratum(cohort.stratum) || !validDistance(cohort.referenceDistanceKm)
    || (cohort.beforeHkDate !== undefined && !validDate(cohort.beforeHkDate))) return [];
  const rows = history.runs.filter(run => typeof run.id === "string" && run.id.length > 0
    && validDate(run.hkDate) && (!cohort.beforeHkDate || run.hkDate < cohort.beforeHkDate)
    && analyzableStratum(run.stratum) && exactStratum(run.stratum, cohort.stratum)
    && run.hasMaterialPauses === false && validPace(run.measuredPaceSecondsPerKm)
    && nearDistance(run.distanceKm, cohort.referenceDistanceKm))
    .map(run => ({ ...run, features: getFeatures(run.context ?? {}, run.hkDate, history.restingHrHistory ?? []) }))
    .sort((a, b) => a.hkDate.localeCompare(b.hkDate) || a.id.localeCompare(b.id));
  const sameDayCounts = new Map<string, number>();
  rows.forEach(row => {
    const key = `${row.hkDate}|${row.id}`;
    sameDayCounts.set(key, (sameDayCounts.get(key) ?? 0) + 1);
  });
  const seenIds = new Set<string>();
  // A duplicate future ID cannot retroactively remove an earlier training row.
  return rows.filter(row => {
    if (sameDayCounts.get(`${row.hkDate}|${row.id}`) !== 1 || seenIds.has(row.id)) return false;
    seenIds.add(row.id);
    return true;
  });
}
function dailyWeights(rows: PreparedRun[]): number[] {
  const counts = new Map<string, number>();
  rows.forEach(row => counts.set(row.hkDate, (counts.get(row.hkDate) ?? 0) + 1));
  return rows.map(row => 1 / counts.get(row.hkDate)!);
}
function weightedMean(values: number[], weights: number[]): number {
  return values.reduce((sum, value, i) => sum + value * weights[i], 0) / weights.reduce((sum, w) => sum + w, 0);
}
function dailyMedianPace(rows: PreparedRun[]): number {
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    const values = groups.get(row.hkDate) ?? [];
    values.push(row.measuredPaceSecondsPerKm);
    groups.set(row.hkDate, values);
  }
  return median(Array.from(groups.values()).map(values => median(values)));
}
function solve(matrix: number[][], rhs: number[]): number[] | null {
  const augmented = matrix.map((row, i) => [...row, rhs[i]]);
  for (let col = 0; col < rhs.length; col++) {
    let pivot = col;
    for (let row = col + 1; row < rhs.length; row++) if (Math.abs(augmented[row][col]) > Math.abs(augmented[pivot][col])) pivot = row;
    if (!finite(augmented[pivot][col]) || Math.abs(augmented[pivot][col]) < 1e-10) return null;
    [augmented[pivot], augmented[col]] = [augmented[col], augmented[pivot]];
    const divisor = augmented[col][col];
    for (let j = col; j <= rhs.length; j++) augmented[col][j] /= divisor;
    for (let row = 0; row < rhs.length; row++) {
      if (row === col) continue;
      const factor = augmented[row][col];
      for (let j = col; j <= rhs.length; j++) augmented[row][j] -= factor * augmented[col][j];
    }
  }
  const result = augmented.map(row => row[rhs.length]);
  return result.every(finite) ? result : null;
}
function design(features: FeatureValues, scales: FeatureScale[], winsorize: boolean): number[] {
  return [1, ...scales.map(scale => {
    let value = features.values[scale.name] ?? scale.impute;
    if (winsorize) value = Math.max(scale.min, Math.min(scale.max, value));
    return (value - scale.center) / scale.sd;
  })];
}
function fit(rows: PreparedRun[]): FittedModel | null {
  const days = uniqueDays(rows);
  if (days.length < POLICY.minimumTrainingDays) return null;
  const weights = dailyWeights(rows);
  const scales: FeatureScale[] = [];
  const coverage: RunningFeatureCoverage[] = [];
  for (const name of FEATURES) {
    const observed = rows.filter(row => row.features.values[name] !== undefined);
    const values = observed.map(row => row.features.values[name]!);
    let scale: FeatureScale | undefined;
    if (values.length >= POLICY.minimumFeatureObservations && uniqueDays(observed).length >= POLICY.minimumFeatureObservedDays) {
      // Bounds/standardization/imputation are learned from THIS earlier fold only.
      const min = quantile(values, 0.05);
      const max = quantile(values, 0.95);
      const impute = median(values);
      const all = rows.map(row => Math.max(min, Math.min(max, row.features.values[name] ?? impute)));
      const center = weightedMean(all, weights);
      const sd = Math.sqrt(weightedMean(all.map(value => (value - center) ** 2), weights));
      if (sd >= POLICY.minimumFeatureStandardDeviation && finite(sd)) {
        scale = { name, impute, center, sd, min, max };
        scales.push(scale);
      }
    }
    coverage.push({
      feature: name, enabledInLatestModel: !!scale,
      observedTrainingRows: values.length, observedTrainingDays: uniqueDays(observed).length,
      missingTrainingRows: rows.length - values.length,
      invalidTrainingRows: rows.filter(row => row.features.invalid.has(name)).length,
      trainingStandardDeviation: scale?.sd ?? null, imputationValue: scale?.impute ?? null,
      trainingSupport: scale ? { min: scale.min, max: scale.max } : null,
      estimatedSecondsPerTrainingSd: null,
      observedHeldOutRows: 0, observedHeldOutDays: 0,
    });
  }
  const baseline = dailyMedianPace(rows);
  if (!scales.length) return { rows, days, baseline, scales, coefficients: [baseline], coverage, temperatureSupport: null, humiditySupport: null };
  const paces = rows.map(row => row.measuredPaceSecondsPerKm);
  const robustRadius = Math.max(15, 3 * 1.4826 * median(paces.map(value => Math.abs(value - baseline))));
  const lower = Math.max(quantile(paces, 0.05), baseline - robustRadius);
  const upper = Math.min(quantile(paces, 0.95), baseline + robustRadius);
  const targets = paces.map(value => Math.max(lower, Math.min(upper, value)));
  const x = rows.map(row => design(row.features, scales, true));
  let coefficients: number[] | null = null;
  let robustWeights = [...weights];
  // Fixed three-step robust ridge; a day gets total initial weight one.
  for (let iteration = 0; iteration < 3; iteration++) {
    const size = scales.length + 1;
    const matrix = Array.from({ length: size }, () => Array<number>(size).fill(0));
    const rhs = Array<number>(size).fill(0);
    for (let i = 0; i < rows.length; i++) for (let a = 0; a < size; a++) {
      rhs[a] += robustWeights[i] * x[i][a] * targets[i];
      for (let b = 0; b < size; b++) matrix[a][b] += robustWeights[i] * x[i][a] * x[i][b];
    }
    for (let a = 1; a < size; a++) matrix[a][a] += POLICY.ridgePenalty;
    coefficients = solve(matrix, rhs);
    if (!coefficients) return null;
    const residuals = targets.map((target, i) => Math.abs(target - x[i].reduce((sum, value, j) => sum + value * coefficients![j], 0)));
    const huberBound = Math.max(5, 1.5 * 1.4826 * median(residuals));
    robustWeights = weights.map((w, i) => w * (residuals[i] <= huberBound ? 1 : huberBound / residuals[i]));
  }
  const humidities = rows.filter(row => row.features.values.temperatureHumidityInteraction !== undefined)
    .map(row => row.features.humidity!).filter(finite);
  const humiditySupport = scales.some(scale => scale.name === "temperatureHumidityInteraction") && humidities.length
    ? { min: quantile(humidities, 0.05), max: quantile(humidities, 0.95) } : null;
  const temperatures = rows.map(row => row.features.values.temperatureC).filter(finite);
  const temperatureSupport = scales.some(scale => scale.name === "temperatureC" || scale.name === "temperatureHumidityInteraction") && temperatures.length
    ? { min: quantile(temperatures, 0.05), max: quantile(temperatures, 0.95) } : null;
  for (const item of coverage) {
    const index = scales.findIndex(scale => scale.name === item.feature);
    if (index >= 0) item.estimatedSecondsPerTrainingSd = coefficients![index + 1];
  }
  return { rows, days, baseline, scales, coefficients: coefficients!, coverage, temperatureSupport, humiditySupport };
}
function distanceSupported(model: FittedModel, distance: number): boolean {
  const distances = model.rows.map(row => row.distanceKm);
  return validDistance(distance) && distance >= Math.min(...distances) && distance <= Math.max(...distances)
    && distances.every(value => nearDistance(value, distance));
}
function contextSupported(model: FittedModel, features: FeatureValues, requireObserved: boolean): boolean {
  const observedScales = model.scales.filter(scale => features.values[scale.name] !== undefined);
  if (requireObserved && observedScales.length !== model.scales.length) return false;
  if (observedScales.some(scale => features.values[scale.name]! < scale.min || features.values[scale.name]! > scale.max)) return false;
  if (model.temperatureSupport && features.values.temperatureC !== undefined
    && (features.values.temperatureC < model.temperatureSupport.min || features.values.temperatureC > model.temperatureSupport.max)) return false;
  if (model.humiditySupport && features.values.temperatureHumidityInteraction !== undefined
    && (features.humidity === undefined || features.humidity < model.humiditySupport.min || features.humidity > model.humiditySupport.max)) return false;
  if (!observedScales.length) return !requireObserved;
  // Reject unsupported combinations as well as individual marginal extrapolation.
  return model.rows.some(row => observedScales.every(scale => row.features.values[scale.name] !== undefined)
    && Math.sqrt(mean(observedScales.map(scale => {
      const training = Math.max(scale.min, Math.min(scale.max, row.features.values[scale.name]!));
      return ((features.values[scale.name]! - training) / scale.sd) ** 2;
    }))) <= POLICY.maximumNearestContextRmsZDistance);
}
function modelPace(model: FittedModel, features: FeatureValues): number | null {
  const value = design(features, model.scales, false).reduce((sum, x, i) => sum + x * model.coefficients[i], 0);
  // Predictions are rejected, never silently clamped into apparently valid outputs.
  return validPace(value) ? value : null;
}
function boundedCorrection(baseline: number, rawPrediction: number): number {
  const bound = Math.min(POLICY.maximumCorrectionSecondsPerKm, POLICY.maximumCorrectionFractionOfBaseline * baseline);
  return Math.max(-bound, Math.min(bound, rawPrediction - baseline));
}
function errorMetrics(rows: RunningHeldOutPrediction[]): RunningErrorMetrics | null {
  if (!rows.length) return null;
  const baseline = rows.map(row => Math.abs(row.measuredPaceSecondsPerKm - row.baselinePaceSecondsPerKm));
  const context = rows.map(row => Math.abs(row.measuredPaceSecondsPerKm - row.contextPaceSecondsPerKm));
  const baselineMae = mean(baseline);
  const contextMae = mean(context);
  const days = uniqueDays(rows);
  const improvedDays = days.filter(day => {
    const indexes = rows.map((row, i) => row.hkDate === day ? i : -1).filter(i => i >= 0);
    return mean(indexes.map(i => context[i])) < mean(indexes.map(i => baseline[i]));
  }).length;
  return {
    matchedRows: rows.length, matchedDays: days.length,
    baselineMaeSecondsPerKm: baselineMae, contextMaeSecondsPerKm: contextMae,
    baselineMedianAbsolutePercentError: median(baseline.map((error, i) => 100 * error / rows[i].measuredPaceSecondsPerKm)),
    contextMedianAbsolutePercentError: median(context.map((error, i) => 100 * error / rows[i].measuredPaceSecondsPerKm)),
    absoluteMaeImprovementSecondsPerKm: baselineMae - contextMae,
    relativeMaeImprovement: baselineMae > 1e-9 ? (baselineMae - contextMae) / baselineMae : null,
    fractionOfDaysImproved: improvedDays / days.length,
  };
}
function meaningful(metrics: RunningErrorMetrics | null, rows: RunningHeldOutPrediction[]): boolean {
  if (!metrics || metrics.matchedDays < POLICY.minimumHeldOutDays
    || metrics.absoluteMaeImprovementSecondsPerKm < POLICY.minimumAbsoluteMaeImprovementSecondsPerKm
    || metrics.relativeMaeImprovement === null || metrics.relativeMaeImprovement < POLICY.minimumRelativeMaeImprovement
    || metrics.fractionOfDaysImproved < POLICY.minimumFractionOfDaysImproved) return false;
  // A good early regime alone cannot authorize deployment after a recent reversal.
  const dates = uniqueDays(rows);
  const later = errorMetrics(rows.filter(row => row.hkDate >= dates[Math.floor(dates.length / 2)]));
  return !!later && later.contextMaeSecondsPerKm < later.baselineMaeSecondsPerKm;
}
function interval(rows: RunningHeldOutPrediction[]): EmpiricalResidualInterval | null {
  if (uniqueDays(rows).length < POLICY.minimumHeldOutDays) return null;
  const residuals = rows.map(row => row.measuredPaceSecondsPerKm - row.contextPaceSecondsPerKm);
  return { label: "observed_out_of_time_residual_80_percent_interval",
    lowerSecondsPerKm: quantile(residuals, 0.1), upperSecondsPerKm: quantile(residuals, 0.9),
    matchedRows: rows.length, matchedDays: uniqueDays(rows).length,
    isConfidenceInterval: false, guaranteesFutureCoverage: false };
}
/** Expanding chronological walk-forward; each test run uses ONLY dates strictly earlier. */
export function crossValidateRunningContext(history: RunningContextHistory, cohort: RunningValidationCohort): RunningCrossValidationReport {
  const rows = prepare(history, cohort);
  const heldOut: RunningHeldOutPrediction[] = [];
  let skippedTestRows = 0;
  for (const day of uniqueDays(rows)) {
    const earlier = rows.filter(row => row.hkDate < day);
    const today = rows.filter(row => row.hkDate === day);
    for (const row of today) {
      const training = earlier.filter(train => nearDistance(train.distanceKm, row.distanceKm));
      const model = fit(training);
      if (!model || !model.scales.length || !distanceSupported(model, row.distanceKm) || !contextSupported(model, row.features, false)) {
        skippedTestRows++; continue;
      }
      const predicted = modelPace(model, row.features);
      if (predicted === null) { skippedTestRows++; continue; }
      heldOut.push({ runId: row.id, hkDate: row.hkDate, measuredPaceSecondsPerKm: row.measuredPaceSecondsPerKm,
        baselinePaceSecondsPerKm: model.baseline, rawContextModelPaceSecondsPerKm: predicted,
        contextPaceSecondsPerKm: model.baseline + boundedCorrection(model.baseline, predicted),
        trainingDayCount: model.days.length, trainingLatestHkDate: model.days[model.days.length - 1],
        featureNames: model.scales.map(scale => scale.name),
        observedFeatureNames: model.scales.filter(scale => row.features.values[scale.name] !== undefined).map(scale => scale.name) });
    }
  }
  const latest = fit(rows);
  const latestFeatureNames = latest?.scales.map(scale => scale.name) ?? [];
  const observedEvidence = heldOut.filter(row => row.featureNames.join("|") === latestFeatureNames.join("|")
    && row.observedFeatureNames.length === latestFeatureNames.length);
  const metrics = errorMetrics(heldOut);
  const deploymentEvidence = errorMetrics(observedEvidence);
  const deploymentEvidenceSufficient = !!deploymentEvidence && deploymentEvidence.matchedDays >= POLICY.minimumHeldOutDays;
  const useful = meaningful(metrics, heldOut);
  const deploymentUseful = meaningful(deploymentEvidence, observedEvidence);
  let status: RunningValidationStatus;
  const reasons: string[] = [];
  if (uniqueDays(rows).length < POLICY.minimumTrainingDays) {
    status = "insufficient_data"; reasons.push("At least 20 distinct earlier training days are required.");
  } else if (!latestFeatureNames.length) {
    status = "no_evidence"; reasons.push("No feature has at least 10 observed training days/samples and nonzero variance.");
  } else if (!metrics || metrics.matchedDays < POLICY.minimumHeldOutDays) {
    status = "limited"; reasons.push("Fewer than 10 matched out-of-time held-out days within distance/context support.");
  } else if (metrics.contextMaeSecondsPerKm > metrics.baselineMaeSecondsPerKm + 1e-9) {
    status = "model_worse"; reasons.push("Context model MAE is worse than the same-row earlier median baseline.");
  } else if (!useful) {
    status = "no_evidence"; reasons.push("No stable meaningful improvement: require >=3 sec/km, >=5%, and >=60% days improved.");
  } else if (!supportedStratum(cohort.stratum)) {
    status = "limited"; reasons.push("Exact unknown-terrain association is descriptive only; terrain confounding prohibits deployment.");
  } else if (!deploymentEvidenceSufficient || !deploymentUseful || !history.fullHistoryComplete) {
    status = "limited"; reasons.push("Promising aggregate results do not satisfy complete-history, observed-input deployment evidence.");
  } else {
    status = "supported"; reasons.push("Meaningful out-of-time improvement within this exact measured-pace cohort; query checks still required.");
  }
  const coverage = latest?.coverage ?? FEATURES.map(feature => {
    const observed = rows.filter(row => row.features.values[feature] !== undefined);
    return { feature, enabledInLatestModel: false, observedTrainingRows: observed.length,
      observedTrainingDays: uniqueDays(observed).length, missingTrainingRows: rows.length - observed.length,
      invalidTrainingRows: rows.filter(row => row.features.invalid.has(feature)).length,
      trainingStandardDeviation: null, imputationValue: null, trainingSupport: null,
      estimatedSecondsPerTrainingSd: null,
      observedHeldOutRows: 0, observedHeldOutDays: 0 } satisfies RunningFeatureCoverage;
  });
  for (const item of coverage) {
    const observed = heldOut.filter(row => row.observedFeatureNames.includes(item.feature));
    item.observedHeldOutRows = observed.length;
    item.observedHeldOutDays = uniqueDays(observed).length;
  }
  return { status, reasons, targetDefinition: cohort.stratum.targetDefinition,
    interpretation: "measured_pace_in_exact_stratum_not_maximum_race_ability", stratum: { ...cohort.stratum },
    contextEstimatePolicy: "ridge_with_bounded_additive_correction",
    referenceDistanceKm: cohort.referenceDistanceKm, fullHistoryComplete: history.fullHistoryComplete,
    eligibleRows: rows.length, eligibleDays: uniqueDays(rows).length, rejectedRows: history.runs.length - rows.length,
    skippedTestRows, latestTrainingDays: latest?.days.length ?? 0, latestFeatureNames, metrics, deploymentEvidence,
    deploymentEvidenceSufficient, deploymentEligible: status === "supported" && deploymentUseful,
    featureCoverage: coverage, residual80PercentInterval: interval(observedEvidence),
    heldOutPredictions: heldOut, limitations: LIMITATIONS };
}
/**
 * Revalidates as of the query's HK date, never trusts evidence from a later date.
 * Returns an additive correction only after ALL evidence, provenance and support
 * gates pass. Never converts an easy training pace into maximal race performance.
 */
export function predictRunningContext(history: RunningContextHistory, query: RunningContextQuery): RunningContextPrediction {
  const cohort: RunningValidationCohort = {
    stratum: query.stratum, referenceDistanceKm: query.distanceKm, beforeHkDate: query.hkDate,
  };
  const validation = crossValidateRunningContext(history, cohort);
  const blocked = (reason: RunningPredictionBlocker): RunningContextPrediction => ({
    status: "not_enabled", autoApplyAllowed: false, reason, validation, residual80PercentInterval: null,
  });
  if (!validDate(query.hkDate) || !validDistance(query.distanceKm)) return blocked("invalid_query");
  if (!supportedStratum(query.stratum)) return blocked("unsupported_stratum");
  const model = fit(prepare(history, cohort));
  if (!model) return blocked("insufficient_training");
  if (!model.scales.length) return blocked("no_context_features");
  if (!distanceSupported(model, query.distanceKm)) return blocked("distance_outside_training_support");
  const features = getFeatures(query.context ?? {}, query.hkDate, history.restingHrHistory ?? []);
  if (model.scales.some(scale => features.values[scale.name] === undefined || features.invalid.has(scale.name))) return blocked("missing_or_invalid_context");
  if (!contextSupported(model, features, true)) return blocked("context_outside_training_support");
  if (!history.fullHistoryComplete) return blocked("incomplete_history");
  if (!validation.deploymentEvidenceSufficient) return blocked("insufficient_deployment_evidence");
  if (validation.status === "model_worse") return blocked("model_worse");
  if (!validation.deploymentEligible) return blocked("no_meaningful_improvement");
  const predicted = modelPace(model, features);
  if (predicted === null) return blocked("non_finite_prediction");
  const correction = boundedCorrection(model.baseline, predicted);
  const corrected = model.baseline + correction;
  if (!validPace(corrected) || !finite(correction)) return blocked("non_finite_prediction");
  return { status: "enabled", autoApplyAllowed: true, reason: null, validation,
    baselinePaceSecondsPerKm: model.baseline, contextModelPaceSecondsPerKm: predicted,
    correctionSecondsPerKm: correction, correctedPaceSecondsPerKm: corrected,
    featureContributions: model.scales.map((scale, i) => ({ feature: scale.name,
      secondsPerKm: ((features.values[scale.name]! - scale.center) / scale.sd) * model.coefficients[i + 1] })),
    residual80PercentInterval: validation.residual80PercentInterval };
}
