export const MUSCLE_ANALYSIS_PERIODS = [
  "week",
  "month",
  "year",
  "all",
] as const;
export type MuscleAnalysisPeriod = (typeof MUSCLE_ANALYSIS_PERIODS)[number];
export interface MuscleAnalysisInput {
  period: MuscleAnalysisPeriod;
  /** Hong Kong calendar date, not a browser-local timestamp. */
  anchorDate: string;
}
export interface MuscleAnalysisRange {
  /** Inclusive HK calendar dates. For empty all-history results both are null. */
  startDate: string | null;
  endDate: string | null;
}
export interface MuscleAnalysisRow {
  muscle: string;
  directVolumeKg: number;
  /** Actual saved strength sets naming this muscle as primary; overlaps across muscles. */
  primarySetCount: number;
  /** 1 / primary-muscle count per set; conserves mapped strength set count. */
  allocatedPrimarySetCount: number;
  secondarySetCount: number;
  /** Equally allocated timed strength minutes; no conversion to kg volume. */
  directTimedMinutes: number;
  /** Direct kg volume / ALL logged valid kg volume, including unmapped work. */
  directVolumeSharePct: number;
  /** Allocated primary sets / ALL strength sets, including unmapped work. */
  primarySetSharePct: number;
  /** Secondary sets / ALL strength sets; not additive across muscles. */
  secondaryParticipationPct: number;
}
export interface UnmappedMuscleSource {
  exerciseId: number | null;
  exerciseName: string | null;
  muscleGroup: string | null;
  category: string | null;
  reason:
    | "missing_metadata"
    | "unknown_muscle_category"
    | "unclassified_activity";
  setCount: number;
  volumeKg: number;
}
export interface MuscleAnalysisWarning {
  code:
    | "unknown_muscle_category"
    | "unknown_activity_category"
    | "unmapped_sources"
    | "invalid_set_values"
    | "unattributed_volume";
  message: string;
  /** Original persisted value, never silently relabelled. */
  rawCategory?: string | null;
  exerciseName?: string | null;
  setCount: number;
}
export interface WorkoutMuscleAnalysis {
  period: MuscleAnalysisPeriod;
  anchorDate: string;
  timeZone: "Asia/Hong_Kong";
  weekStartsOn: "monday";
  range: MuscleAnalysisRange;
  sessionCount: number;
  completedSessionCount: number;
  setCount: number;
  totalReps: number;
  /** Each valid persisted weight * reps is counted exactly once, regardless of mapping. */
  totalVolumeKg: number;
  strengthSetCount: number;
  cardioSetCount: number;
  unclassifiedSetCount: number;
  strengthVolumeKg: number;
  cardioVolumeKg: number;
  unclassifiedVolumeKg: number;
  mappedVolumeKg: number;
  /** Strength volume whose primary muscles cannot be resolved. */
  unmappedVolumeKg: number;
  /** All volume not assigned directly: unmapped strength + cardio + unclassified. */
  unattributedVolumeKg: number;
  timedStrengthSetCount: number;
  timedStrengthMinutes: number;
  /** Explicit zero external load or persisted bodyweight equipment; null alone is not evidence. */
  bodyweightSetCount: number;
  missingWeightSetCount: number;
  muscles: MuscleAnalysisRow[];
  coverage: {
    mappedStrengthSetCount: number;
    exerciseMappedSetCount: number;
    categoryMappedSetCount: number;
    unmappedSetCount: number;
    unmappedSourceCount: number;
    mappedSetCoveragePct: number;
    mappedVolumeCoveragePct: number;
    weightedSetCount: number;
    unweightedStrengthSetCount: number;
    invalidValueSetCount: number;
  };
  unmappedSources: UnmappedMuscleSource[];
  warnings: MuscleAnalysisWarning[];
  definitions: {
    volume: string;
    directAttribution: string;
    primarySets: string;
    secondaryParticipation: string;
    coverage: string;
    completedSessions: string;
    scope: string;
  };
}
const HK_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
export function isMuscleAnalysisDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000"))
    return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
export function muscleAnalysisHKDate(value: Date | string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) throw new Error("Invalid workout timestamp");
  return new Date(timestamp + HK_OFFSET_MS).toISOString().slice(0, 10);
}
/** Half-open timestamps ensure the last millisecond of a HK day is included. */
export function getMuscleAnalysisBounds(input: MuscleAnalysisInput): {
  range: MuscleAnalysisRange;
  startTimeInclusive: Date | null;
  endTimeExclusive: Date | null;
} {
  if (!isMuscleAnalysisDate(input.anchorDate))
    throw new Error("anchorDate must be a valid YYYY-MM-DD date");
  if (!MUSCLE_ANALYSIS_PERIODS.includes(input.period))
    throw new Error("Invalid muscle analysis period");
  if (input.period === "all")
    return {
      range: { startDate: null, endDate: null },
      startTimeInclusive: null,
      endTimeExclusive: null,
    };
  const start = new Date(`${input.anchorDate}T00:00:00Z`);
  const end = new Date(start);
  if (input.period === "week") {
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    end.setTime(start.getTime() + 7 * DAY_MS);
  } else if (input.period === "month") {
    start.setUTCDate(1);
    end.setUTCDate(1);
    end.setUTCMonth(end.getUTCMonth() + 1);
  } else {
    start.setUTCMonth(0, 1);
    end.setUTCMonth(0, 1);
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  }
  return {
    range: {
      startDate: start.toISOString().slice(0, 10),
      endDate: new Date(end.getTime() - DAY_MS).toISOString().slice(0, 10),
    },
    startTimeInclusive: new Date(start.getTime() - HK_OFFSET_MS),
    endTimeExclusive: new Date(end.getTime() - HK_OFFSET_MS),
  };
}
