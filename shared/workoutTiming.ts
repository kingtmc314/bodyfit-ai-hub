import { MAX_WORKOUT_MINUTES, WORKOUT_CALORIE_VERSION } from "./workoutCalories";

export interface WorkoutTimeDetails {
  actualMinutes: number | null;
  source: "reviewed" | "original" | "unknown";
  elapsedMinutes?: number;
  needsReview: boolean;
}
export interface WorkoutTimingSession {
  duration?: number | null;
  rawDuration?: number | null;
  startTime?: Date | string | null;
  endTime?: Date | string | null;
  calorieDetails?: unknown;
  timeDetails?: WorkoutTimeDetails;
}
export function isActualWorkoutMinutes(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_WORKOUT_MINUTES;
}
/** Course time is never inferred from reps, recovery, effectiveMinutes or legacy date anchors. */
export function getWorkoutTimeDetails(session: WorkoutTimingSession, now = new Date()): WorkoutTimeDetails {
  const details = session.calorieDetails as {
    version?: string; origin?: string;
    timing?: { verifiedDurationMinutes?: unknown; mode?: string; finished?: boolean };
  } | null;
  const versioned = details?.version === WORKOUT_CALORIE_VERSION;
  const verified = versioned ? details?.timing?.verifiedDurationMinutes : null;
  const raw = session.rawDuration !== undefined ? session.rawDuration : session.duration;
  const actualMinutes = isActualWorkoutMinutes(verified) ? verified : isActualWorkoutMinutes(raw) ? raw : null;
  const source = isActualWorkoutMinutes(verified) ? "reviewed" : actualMinutes != null ? "original" : "unknown";
  const result: WorkoutTimeDetails = { actualMinutes, source, needsReview: source !== "reviewed" };
  // Only new live sessions were started at a real instant. Old noon timestamps are date markers.
  if (versioned && details?.origin === "new" && details.timing?.mode === "live" && session.startTime) {
    const start = new Date(session.startTime).getTime();
    const end = session.endTime ? new Date(session.endTime).getTime() : details.timing.finished ? NaN : now.getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) result.elapsedMinutes = (end - start) / 60000;
  }
  return result;
}
/** Original values remain visible but unverified; only reviewed time may be auto-filled. */
export function reviewedWorkoutDurationInput(session: WorkoutTimingSession | null | undefined): string {
  if (!session) return "";
  const time = session.timeDetails ?? getWorkoutTimeDetails(session);
  return time.source === "reviewed" && isActualWorkoutMinutes(time.actualMinutes) ? String(time.actualMinutes) : "";
}
