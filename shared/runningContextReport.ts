import type { RunningContextFeature, RunningPredictionBlocker, RunningValidationStatus } from "./runningCrossValidation";

/** Counts describe the full loaded, qualifying cohort, never the recent evidence table. */
export type ContextFactorReadiness = {
  feature: "preRunSleepHours" | "restingHrDeltaBpm";
  includedInLatestModel: boolean;
  observedRows: number;
  observedDays: number;
  missingRows: number;
  /** Eligible HK run-days with no qualifying observation of this factor. */
  missingDays: number;
  invalidRows: number;
  sampleDeficit: number;
  observedDayDeficit: number;
  minimumAdditionalMatchedDays: number;
  trainingStandardDeviation: number | null;
  varianceKnown: boolean;
  varianceSufficient: boolean | null;
  blockers: string[];
};
export type ContextDayReadiness = {
  days: number;
  requiredDays: number;
  missingDays: number;
};
export type ContextBaselineReadiness = {
  measurementDateHK: string | null;
  windowStartHK: string | null;
  windowEndExclusiveHK: string | null;
  lookbackDays: number;
  requiredEarlierDays: number;
  /** Null when no selected measurement/comparable provenance is available. */
  observedEarlierDays: number | null;
  missingEarlierDays: number | null;
  sufficient: boolean | null;
  blockers: string[];
};
export type RunningContextReadiness = {
  version: "running-context-readiness-v1";
  scope: "full-loaded-selected-cohort-before-as-of-hk-date";
  asOfHK: string;
  evidenceState: "complete" | "partial-history" | "no-selected-group" | "no-eligible-runs";
  historyComplete: boolean;
  eligibleRows: number;
  eligibleDays: number;
  thresholds: {
    minimumFeatureObservations: number;
    minimumFeatureObservedDays: number;
    minimumTrainingDays: number;
    minimumHeldOutDays: number;
    minimumFeatureStandardDeviation: number;
    minimumEarlierRestingHrDays: number;
    restingHrLookbackDays: number;
  };
  factors: { sleep: ContextFactorReadiness; restingHR: ContextFactorReadiness };
  training: ContextDayReadiness & { latestModelDays: number };
  /** Exact same rows used by baseline/weather/full-context error comparison. */
  commonHeldOut: ContextDayReadiness & { rows: number };
  /** Common rows with BOTH sleep and HR-deviation actually observed, never imputed. */
  commonObservedHeldOut: ContextDayReadiness & { rows: number };
  /** All active inputs observed on the exact latest feature schema; not imputed aggregate evidence. */
  deploymentEvidence: ContextDayReadiness & { rows: number; sufficient: boolean; latestFeatureNames: RunningContextFeature[] };
  currentBaseline: ContextBaselineReadiness;
  sleepDateConvention: "unknown" | "wake-date";
  currentSleepVerified: boolean;
  validationStatus: RunningValidationStatus | null;
  predictionBlocker: RunningPredictionBlocker | null;
  /** Count/variation/history gates only, not an improvement or prediction claim. */
  dataQualified: boolean;
  advancedReady: boolean;
  /** Conditional lower bound, NOT an exact number of new raw records or an enablement guarantee. */
  minimumAdditionalMatchedDays: number;
  blockers: string[];
  notes: string[];
};

export type ContextPaceBasis = "continuous-moving" | "summary";
export type ContextGroup = {
  key: string;
  runType: string;
  routeType: string;
  paceBasis: ContextPaceBasis;
  count: number;
  minDistanceKm: number;
  maxDistanceKm: number;
};
export type ContextErrorMetrics = {
  count: number;
  days: number;
  maeSecPerKm: number;
  medianAbsolutePercentError: number;
  biasSecPerKm: number;
};
export type ContextEvidenceRow = {
  id: number;
  dateHK: string;
  distanceKm: number;
  paceSecPerKm: number;
  paceBasis: ContextPaceBasis;
  temperatureC: number | null;
  humidityPct: number | null;
  windKph: number | null;
  weatherQuality: string;
  sleepHours: number | null;
  sleepDateHK: string | null;
  sleepMethod: string | null;
  restingHR: number | null;
  restingHRDeltaBpm: number | null;
  restingHRDateHK: string | null;
  baselinePredictedPace: number | null;
  weatherPredictedPace: number | null;
  contextPredictedPace: number | null;
};
export type RunningContextReport = {
  version: "running-context-v1";
  source: "Life-OS Supabase";
  generatedAtHK: string;
  historyComplete: boolean;
  groups: ContextGroup[];
  selectedGroup: ContextGroup | null;
  targetDistanceKm: number;
  status: "insufficient-data" | "not-improved" | "validated-association" | "unsupported-context";
  statusReason: string;
  coverage: {
    runs: number;
    sleeps: number;
    hearts: number;
    selectedRuns: number;
    temperature: number;
    humidity: number;
    sleep: number;
    restingHR: number;
    restingHRDelta: number;
    priorDateSleepProxy: number;
  };
  metrics: {
    baseline: ContextErrorMetrics | null;
    weatherOnly: ContextErrorMetrics | null;
    fullContext: ContextErrorMetrics | null;
    improvementPct: number | null;
  };
  featuresUsed: string[];
  prediction: {
    supported: boolean;
    paceSecPerKm: number | null;
    interval80SecPerKm: [number, number] | null;
    correctionEnabled: boolean;
    reason: string;
    currentSleepHours: number | null;
    currentSleepDateHK: string | null;
    currentRestingHRDeltaBpm: number | null;
    currentRestingHRDateHK: string | null;
  };
  rows: ContextEvidenceRow[];
  limitations: string[];
  /** Optional for backwards compatibility with previously saved reports. */
  readiness?: RunningContextReadiness;
};
