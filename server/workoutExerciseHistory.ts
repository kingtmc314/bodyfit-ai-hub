import { TRPCError } from "@trpc/server";
import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import {
  getCanonicalExerciseName,
  getExerciseHistoryNames,
} from "@shared/workoutExerciseIdentity";
import {
  EXERCISE_HISTORY_DEFAULT_PAGE_SIZE,
  EXERCISE_HISTORY_MAX_PAGE_SIZE,
  type ExerciseHistoryInput,
  type ExerciseHistorySession,
  type ExerciseHistoryTrendPoint,
  type ExerciseUsageCount,
  type WorkoutExerciseHistory,
} from "@shared/workoutExerciseHistory";
import type { getDb } from "./db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export const exerciseHistoryInputSchema = z.object({
  exerciseName: z
    .string()
    .min(1)
    .max(255)
    .refine(name => name.trim().length > 0, "Exercise name is required"),
  // Keep the OFFSET safely representable even with the largest permitted page size.
  page: z
    .number()
    .int()
    .min(1)
    .max(Math.floor(Number.MAX_SAFE_INTEGER / EXERCISE_HISTORY_MAX_PAGE_SIZE)),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(EXERCISE_HISTORY_MAX_PAGE_SIZE)
    .default(EXERCISE_HISTORY_DEFAULT_PAGE_SIZE),
});

function rowsOf<T>(result: unknown): T[] {
  return (
    Array.isArray(result) ? result : (result as { rows: T[] }).rows
  ) as T[];
}
function jsonValue<T>(value: T | string): T {
  return typeof value === "string" ? (JSON.parse(value) as T) : value;
}
function nullableNumber(value: unknown): number | null {
  return value == null ? null : Number(value);
}

/** Full saved-name usage; no recent-session or population cap, no catalog/ID inference. */
export async function getWorkoutExerciseUsage(
  db: Db,
  ownerUserId: number
): Promise<ExerciseUsageCount[]> {
  const result = await db.execute(sql`
    WITH usage AS (
      SELECT ws.exercise_name AS "exerciseName", COUNT(*) AS "setRows",
        COUNT(DISTINCT sess.id) AS "sessionCount"
      FROM workout_sets ws
      INNER JOIN workout_sessions sess ON sess.id = ws.session_id
      WHERE sess.user_id = ${ownerUserId} AND ws.exercise_name IS NOT NULL
      GROUP BY ws.exercise_name
      ORDER BY ws.exercise_name COLLATE "C"
      LIMIT ALL
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'exerciseName', usage."exerciseName", 'setRows', usage."setRows", 'sessionCount', usage."sessionCount"
    ) ORDER BY usage."exerciseName" COLLATE "C"), '[]'::jsonb) AS usage
    FROM usage
    LIMIT 1
  `);
  const [row] = rowsOf<{ usage: ExerciseUsageCount[] | string }>(result);
  if (!row) throw new Error("Workout exercise usage query returned no result");
  return jsonValue(row.usage).map(entry => ({
    exerciseName: entry.exerciseName,
    setRows: Number(entry.setRows),
    sessionCount: Number(entry.sessionCount),
  }));
}

/**
 * One SQL statement gives summary + page the same read snapshot. The page is bounded
 * by sessions (max 20); JSON aggregation returns ALL matching sets for each selected
 * session, not an arbitrary 500-row slice. LIMIT ALL is deliberate for full aggregates.
 * start_time is the existing UTC timestamp-without-time-zone column. Convert explicitly
 * through UTC before Asia/Hong_Kong, independent of server or device timezone.
 */
export async function getWorkoutExerciseHistory(
  db: Db,
  ownerUserId: number,
  requested: ExerciseHistoryInput
): Promise<WorkoutExerciseHistory> {
  const input = exerciseHistoryInputSchema.parse(requested);
  const exerciseName = getCanonicalExerciseName(input.exerciseName);
  const aliases = Array.from(
    new Set(getExerciseHistoryNames(input.exerciseName))
  );
  const names: SQL = sql.join(
    aliases.map(name => sql`${name}`),
    sql`, `
  );
  const offset = (input.page - 1) * input.pageSize;
  const result = await db.execute(sql`
    WITH matched AS MATERIALIZED (
      SELECT ws.id AS set_id, ws.set_number, ws.reps, ws.weight, ws.duration, ws.distance,
        sess.id AS session_id, sess.name, sess.location, sess.start_time,
        (ws.weight >= 0 AND ws.weight < 'Infinity'::real) AS valid_load,
        (ws.reps >= 0) AS valid_reps,
        to_char((sess.start_time AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD') AS date_hk
      FROM workout_sets ws
      INNER JOIN workout_sessions sess ON sess.id = ws.session_id
      WHERE sess.user_id = ${ownerUserId} AND ws.exercise_name IN (${names})
      LIMIT ALL
    ), summary AS (
      SELECT COUNT(*) AS "totalSets", COUNT(DISTINCT session_id) AS "sessionCount",
        MIN(date_hk) AS "firstDateHK", MAX(date_hk) AS "lastDateHK",
        MAX(weight) FILTER (WHERE valid_load) AS "maxWeightKg",
        COALESCE(SUM(weight::double precision * reps::double precision)
          FILTER (WHERE valid_load AND valid_reps), 0) AS "totalVolumeKg"
      FROM matched
      LIMIT 1
    ), daily_trend AS (
      SELECT date_hk AS "dateHK", COUNT(DISTINCT session_id) AS "sessionCount", COUNT(*) AS "setCount",
        COALESCE(SUM(reps) FILTER (WHERE valid_reps), 0) AS "totalReps",
        COALESCE(SUM(weight::double precision * reps::double precision)
          FILTER (WHERE valid_load AND valid_reps), 0) AS "totalVolumeKg",
        MAX(weight) FILTER (WHERE valid_load) AS "maxWeightKg",
        AVG(weight::double precision) FILTER (WHERE valid_load) AS "averageWeightKg",
        COUNT(*) FILTER (WHERE valid_load IS NOT TRUE) AS "missingLoadSetCount"
      FROM matched GROUP BY date_hk
      ORDER BY date_hk ASC
      LIMIT ALL
    ), session_page AS (
      SELECT session_id, date_hk, name, location, start_time
      FROM matched
      GROUP BY session_id, date_hk, name, location, start_time
      ORDER BY date_hk DESC, start_time DESC, session_id DESC
      LIMIT ${input.pageSize} OFFSET ${offset}
    )
    SELECT summary."totalSets", summary."sessionCount", summary."firstDateHK", summary."lastDateHK",
      summary."maxWeightKg", summary."totalVolumeKg",
      COALESCE((
        SELECT jsonb_agg(to_jsonb(daily_trend) ORDER BY daily_trend."dateHK" ASC)
        FROM daily_trend LIMIT 1
      ), '[]'::jsonb) AS trend,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', page.session_id, 'dateHK', page.date_hk, 'name', page.name, 'location', page.location,
          'startTime', to_char(page.start_time, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
          'sets', (
            SELECT jsonb_agg(jsonb_build_object(
              'id', matched.set_id, 'setNumber', matched.set_number, 'reps', matched.reps,
              'weight', matched.weight, 'duration', matched.duration, 'distance', matched.distance
            ) ORDER BY matched.set_number, matched.set_id)
            FROM matched WHERE matched.session_id = page.session_id
            LIMIT 1
          )
        ) ORDER BY page.date_hk DESC, page.start_time DESC, page.session_id DESC)
        FROM session_page page
        LIMIT 1
      ), '[]'::jsonb) AS sessions
    FROM summary
    LIMIT 1
  `);
  type HistoryRow = {
    totalSets: number | string;
    sessionCount: number | string;
    firstDateHK: string | null;
    lastDateHK: string | null;
    maxWeightKg: number | string | null;
    totalVolumeKg: number | string;
    trend: ExerciseHistoryTrendPoint[] | string;
    sessions: ExerciseHistorySession[] | string;
  };
  const [row] = rowsOf<HistoryRow>(result);
  if (!row)
    throw new Error("Workout exercise history query returned no result");
  const sessionCount = Number(row.sessionCount);
  const totalPages = Math.ceil(sessionCount / input.pageSize);
  return {
    exerciseName,
    aliases,
    summary: {
      totalSets: Number(row.totalSets),
      sessionCount,
      firstDateHK: row.firstDateHK ?? null,
      lastDateHK: row.lastDateHK ?? null,
      maxWeightKg: nullableNumber(row.maxWeightKg),
      totalVolumeKg: Number(row.totalVolumeKg),
    },
    trend: jsonValue(row.trend).map(point => ({
      dateHK: point.dateHK,
      sessionCount: Number(point.sessionCount),
      setCount: Number(point.setCount),
      totalReps: Number(point.totalReps),
      totalVolumeKg: Number(point.totalVolumeKg),
      maxWeightKg: nullableNumber(point.maxWeightKg),
      averageWeightKg: nullableNumber(point.averageWeightKg),
      missingLoadSetCount: Number(point.missingLoadSetCount),
    })),
    trendMetadata: { truncated: false },
    sessions: jsonValue(row.sessions).map(session => ({
      id: Number(session.id),
      dateHK: session.dateHK,
      name: session.name ?? null,
      location: session.location ?? null,
      startTime: new Date(session.startTime).toISOString(),
      sets: session.sets.map(set => ({
        id: Number(set.id),
        setNumber: Number(set.setNumber),
        reps: nullableNumber(set.reps),
        weight: nullableNumber(set.weight),
        duration: nullableNumber(set.duration),
        distance: nullableNumber(set.distance),
      })),
    })),
    page: input.page,
    pageSize: input.pageSize,
    totalPages,
    hasNextPage: input.page < totalPages,
  };
}

/** Exact normalized name + equipment only, scoped to this owner. Never reuses/deletes rows.
 * This preflight guard does not claim to enforce concurrent uniqueness without a schema constraint.
 * Built-in/UI-catalog collisions are intentionally checked by the client, not inferred here.
 */
export async function assertCustomExerciseNotDuplicate(
  db: Db,
  ownerUserId: number,
  name: string,
  equipment: string
): Promise<void> {
  const normalize = (value: string) =>
    value.trim().replace(/\s+/g, " ").toLowerCase();
  const result = await db.execute(sql`
    SELECT id FROM custom_exercises
    WHERE user_id = ${ownerUserId}
      AND lower(trim(regexp_replace(name, '[[:space:]]+', ' ', 'g'))) = ${normalize(name)}
      AND lower(trim(regexp_replace(equipment, '[[:space:]]+', ' ', 'g'))) = ${normalize(equipment)}
    LIMIT 1
  `);
  if (rowsOf<{ id: number }>(result).length) {
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "相同名稱及器材的自訂動作已存在，請在動作列表選擇現有項目；如屬不同動作，請使用可分辨的名稱。",
    });
  }
}
