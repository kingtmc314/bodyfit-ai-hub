import { sql, type SQL } from "drizzle-orm";
import {
  canonicalPreRunHKDate,
  matchRunningPreRunContext,
  type PreRunContext,
  type PreRunHeart,
  type PreRunSleep,
} from "../shared/runningPreRunContext";
import type { RunningHistory, RunningHistoryFeature } from "./runningContinuousAnalysis";

export type Reader = { execute: (query: SQL) => Promise<unknown> };
export type RunningRecoveryDatasetOptions = { dateConvention?: "unknown" | "wake-date" };
export const RUNNING_SLEEP_DURATION_LIMITS = Object.freeze({
  hoursMin: 0,
  hoursMax: 16,
  legacyMinutesExclusiveMin: 24,
  legacyMinutesMax: 960,
  clockSpanHoursMax: 16,
  maximumSpanExcessHours: 0.25,
  minimumSpanFraction: 0.25,
});
export type StoredSleepDurationNormalization = {
  hours: number | null;
  status: "hours" | "legacy-minutes" | "missing" | "rejected";
};
export type RecoverySleepRow = PreRunSleep & {
  durationNormalization: StoredSleepDurationNormalization["status"];
};
export type RunningRecoveryDataset = {
  history: RunningHistory;
  sleepRows: RecoverySleepRow[];
  heartRows: PreRunHeart[];
  complete: boolean;
  joined: Array<{ run: RunningHistoryFeature; preRun: PreRunContext }>;
  durationNormalization: { legacyMinutesConverted: number; rejected: number };
};

function strictNumber(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
const missing = (value: unknown) => value === null || value === undefined || value === "";
function clockHours(value: unknown): number | null {
  if (typeof value !== "string") return null;
  // PostgreSQL TIME::text can include fractional seconds. No host-local Date parsing.
  const clock = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?$/.exec(value);
  if (!clock) return null;
  const hours = Number(clock[1]), minutes = Number(clock[2]), seconds = Number(clock[3] ?? 0);
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  return hours + minutes / 60 + (seconds + Number(`0.${clock[4] ?? "0"}`)) / 3600;
}

/**
 * Sleep.tsx stores hours but historically displayed values >24 as minutes.
 * That display heuristic alone is NOT unit evidence: require a plausible TIME
 * window before converting a legacy value. Never change or write the source row.
 * Missing is not zero; rejected values must not be used as sleep covariates.
 */
export function normalizeStoredSleepDuration(
  value: unknown,
  bedtime?: unknown,
  waketime?: unknown,
): StoredSleepDurationNormalization {
  if (missing(value)) return { hours: null, status: "missing" };
  const duration = strictNumber(value);
  const limits = RUNNING_SLEEP_DURATION_LIMITS;
  if (duration === null || duration < limits.hoursMin) return { hours: null, status: "rejected" };
  if (duration <= limits.hoursMax) return { hours: duration, status: "hours" };
  if (duration <= limits.legacyMinutesExclusiveMin || duration > limits.legacyMinutesMax) return { hours: null, status: "rejected" };
  const bed = clockHours(bedtime), wake = clockHours(waketime);
  if (bed === null || wake === null) return { hours: null, status: "rejected" };
  const span = (wake - bed + 24) % 24;
  const hours = duration / 60;
  if (span > limits.clockSpanHoursMax || hours > span + limits.maximumSpanExcessHours || hours < span * limits.minimumSpanFraction) {
    return { hours: null, status: "rejected" };
  }
  return { hours, status: "legacy-minutes" };
}

const PAGE_SIZE = 200;
const rowsOf = (result: unknown): Record<string, unknown>[] => {
  const rows = (result as { rows?: unknown } | null)?.rows ?? result;
  return Array.isArray(rows) ? rows : [];
};
const positiveId = (value: unknown): number | null => {
  const id = strictNumber(value);
  return id !== null && Number.isSafeInteger(id) && id > 0 ? id : null;
};
// Only fixed provenance labels can leave this adapter. URLs, arbitrary user text,
// tokens/credentials, and unknown sources are dropped, not recast as a device.
const HEALTH_SOURCE_WHITELIST = new Set(["manual", "sheets", "app_spreadsheet", "csv", "image", "garmin"]);
function sourceLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const label = value.trim().toLowerCase();
  if (/(?:[a-z][a-z\d+.-]*:\/\/|www\.|bearer\b|token\b|api[_-]?key\b|password\b|secret\b)/i.test(label)) return null;
  return HEALTH_SOURCE_WHITELIST.has(label) ? label : null;
}
function timeText(value: unknown): string | null {
  if (missing(value)) return null;
  // Preserve invalid-clock rejection in the shared matcher without leaking text.
  return clockHours(value) !== null ? value as string : "invalid-clock";
}

/**
 * Read-shape normalization only: accept exact numeric YYYY-M-D ISO labels and
 * validate the padded calendar date. No trimming, locale/Date parsing, rollover,
 * wake-date inference, or source-row mutation; the shared matcher stays strict.
 */
export function normalizeStoredHealthHKDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const iso = /^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})$/.exec(value);
  if (!iso || iso[0] !== value) return null;
  return canonicalPreRunHKDate(`${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`);
}

// Fixed internal expression, shared by snapshot and keyset predicates. date::text
// supports both PostgreSQL DATE and legacy TEXT columns without casting bad text
// to DATE. Pad ISO-shaped text BEFORE lexical cutoff comparison; calendar-invalid
// and other selected labels still fail the adapter's canonical validation below.
// ELSE preserves the prior conservative handling of non-ISO/NULL source labels.
const HEALTH_COMPARABLE_DATE = sql`CASE
  WHEN date::text ~ '^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}$'
  THEN split_part(date::text, '-', 1) || '-' || lpad(split_part(date::text, '-', 2), 2, '0') || '-' || lpad(split_part(date::text, '-', 3), 2, '0')
  ELSE date::text
END`;

type HealthTable = "sleep_logs" | "heart_rate_logs";
type HealthSnapshot = { rows: Record<string, unknown>[]; complete: boolean };
async function readHealthSnapshot(db: Reader, table: HealthTable, userId: number, throughHK: string): Promise<HealthSnapshot> {
  // Both table identifiers and column selections are fixed internal whitelists.
  const tableSQL = sql.raw(table);
  const snapshot = rowsOf(await db.execute(sql`
    SELECT COUNT(*) AS total, MAX(id) AS max_id FROM ${tableSQL}
    WHERE user_id = ${userId} AND ${HEALTH_COMPARABLE_DATE} <= ${throughHK} LIMIT 1
  `))[0];
  const total = strictNumber(snapshot?.total);
  const maxId = missing(snapshot?.max_id) ? (total === 0 ? 0 : null) : strictNumber(snapshot?.max_id);
  if (total === null || !Number.isSafeInteger(total) || total < 0 || maxId === null || !Number.isSafeInteger(maxId) || maxId < 0 || (total > 0 && maxId === 0) || (total === 0 && maxId !== 0)) {
    return { rows: [], complete: false };
  }
  const columns = table === "sleep_logs"
    ? sql`id, date::text AS date, sleep_duration, bedtime::text AS bedtime, waketime::text AS waketime, sleep_score, resting_hr, hrv, source`
    : sql`id, date::text AS date, resting_hr, hrv, source`;
  const rows: Record<string, unknown>[] = [];
  let cursor = 0, validPages = true;
  while (cursor < maxId) {
    const page = rowsOf(await db.execute(sql`
      SELECT ${columns} FROM ${tableSQL}
      WHERE user_id = ${userId} AND id > ${cursor} AND id <= ${maxId} AND ${HEALTH_COMPARABLE_DATE} <= ${throughHK}
      ORDER BY id ASC LIMIT 200
    `));
    if (!page.length) break;
    if (page.length > PAGE_SIZE) { validPages = false; break; }
    let next = cursor;
    for (const row of page) {
      const id = positiveId(row?.id);
      if (id === null || id <= next || id > maxId) { validPages = false; continue; }
      next = id;
      rows.push(row);
    }
    if (next <= cursor) { validPages = false; break; }
    cursor = next;
  }
  return { rows, complete: validPages && rows.length === total };
}

/**
 * Read-only, uncached adapter for the EXISTING owner-scoped Life-OS tables.
 * The supplied running snapshot is used verbatim: no duplicate running fetch.
 * COUNT/MAX-id attest pagination, not transaction isolation against edits/deletes.
 * Invalid durations are counted and excluded; missing measurements remain null.
 */
export async function loadRunningRecoveryDataset(
  db: Reader,
  userId: number,
  history: RunningHistory,
  throughHK: string,
  options: RunningRecoveryDatasetOptions = {},
): Promise<RunningRecoveryDataset> {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("Recovery dataset requires a valid owner userId");
  if (!canonicalPreRunHKDate(throughHK)) throw new Error("Recovery dataset requires a canonical Hong Kong cutoff date");
  if (options.dateConvention !== undefined && options.dateConvention !== "unknown" && options.dateConvention !== "wake-date") {
    throw new Error("Unsupported sleep date convention");
  }
  const [sleepSnapshot, heartSnapshot] = await Promise.all([
    readHealthSnapshot(db, "sleep_logs", userId, throughHK),
    readHealthSnapshot(db, "heart_rate_logs", userId, throughHK),
  ]);
  const sleepRows: RecoverySleepRow[] = [], heartRows: PreRunHeart[] = [];
  const durationNormalization = { legacyMinutesConverted: 0, rejected: 0 };
  let identitiesValid = true;
  for (const row of sleepSnapshot.rows) {
    const id = positiveId(row.id), date = normalizeStoredHealthHKDate(row.date);
    if (id === null || date === null || date > throughHK) { identitiesValid = false; continue; }
    const duration = normalizeStoredSleepDuration(row.sleep_duration, row.bedtime, row.waketime);
    if (duration.status === "rejected") { durationNormalization.rejected++; continue; }
    if (duration.status === "legacy-minutes") durationNormalization.legacyMinutesConverted++;
    sleepRows.push({
      id, date, sleepDuration: duration.hours, bedtime: timeText(row.bedtime), waketime: timeText(row.waketime),
      sleepScore: strictNumber(row.sleep_score), restingHr: strictNumber(row.resting_hr), hrv: strictNumber(row.hrv),
      source: sourceLabel(row.source), durationNormalization: duration.status,
    });
  }
  for (const row of heartSnapshot.rows) {
    const id = positiveId(row.id), date = normalizeStoredHealthHKDate(row.date);
    if (id === null || date === null || date > throughHK) { identitiesValid = false; continue; }
    heartRows.push({ id, date, restingHr: strictNumber(row.resting_hr), hrv: strictNumber(row.hrv), source: sourceLabel(row.source) });
  }
  const complete = history.coverage.complete === true
    && history.coverage.processedRuns === history.runs.length
    && history.coverage.totalRuns === history.runs.length
    && sleepSnapshot.complete && heartSnapshot.complete && identitiesValid;
  return {
    history, sleepRows, heartRows, complete, durationNormalization,
    joined: history.runs.map(run => ({
      run,
      preRun: matchRunningPreRunContext({ id: run.id, HKdate: run.date, startTimestamp: run.startTimestamp }, sleepRows, heartRows, {
        dateConvention: options.dateConvention ?? "unknown", sleepDurationUnit: "hours", baselineWindowDays: 28,
      }),
    })),
  };
}
