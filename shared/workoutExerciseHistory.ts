/** Name-based saved workout history; legacy exercise IDs do not identify a UI choice. */
export interface ExerciseUsageCount {
  exerciseName: string;
  setRows: number;
  sessionCount: number;
}

export interface ExerciseHistoryInput {
  exerciseName: string;
  /** One-based session page. */
  page: number;
  pageSize?: number;
}

export interface ExerciseHistorySet {
  id: number;
  setNumber: number;
  reps: number | null;
  weight: number | null;
  duration: number | null;
  distance: number | null;
}

export interface ExerciseHistorySession {
  id: number;
  /** Session calendar date in Asia/Hong_Kong, not the browser's timezone. */
  dateHK: string;
  name: string | null;
  location: string | null;
  /** UTC ISO timestamp. */
  startTime: string;
  /** Every matching saved set in this session, ordered by setNumber and then id. */
  sets: ExerciseHistorySet[];
}

export interface ExerciseHistorySummary {
  /** Counts and metrics cover the entire owner's matching history, not just this page. */
  totalSets: number;
  sessionCount: number;
  firstDateHK: string | null;
  lastDateHK: string | null;
  maxWeightKg: number | null;
  /** Sum of finite non-negative saved weight × non-negative reps; missing loads are not estimated. */
  totalVolumeKg: number;
}

export interface ExerciseHistoryTrendPoint {
  dateHK: string;
  sessionCount: number;
  setCount: number;
  totalReps: number;
  totalVolumeKg: number;
  maxWeightKg: number | null;
  /** Arithmetic mean of finite non-negative saved set loads, including 0; not volume / reps. */
  averageWeightKg: number | null;
  /** Missing or invalid load values; unloaded cardio is never assigned a fake weight. */
  missingLoadSetCount: number;
}

export interface WorkoutExerciseHistory {
  exerciseName: string;
  /** Exact approved saved names queried, including the canonical name. */
  aliases: string[];
  summary: ExerciseHistorySummary;
  /** Entire matching owner history grouped by HK day ascending, independent of the session page. */
  trend: ExerciseHistoryTrendPoint[];
  trendMetadata: { truncated: boolean };
  sessions: ExerciseHistorySession[];
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
}

export const EXERCISE_HISTORY_DEFAULT_PAGE_SIZE = 8;
export const EXERCISE_HISTORY_MAX_PAGE_SIZE = 20;
