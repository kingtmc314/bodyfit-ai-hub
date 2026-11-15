import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import * as matcher from "../shared/runningPreRunContext";
import { runningRowFeature, type RunningHistory } from "./runningContinuousAnalysis";
import {
  loadRunningRecoveryDataset,
  normalizeStoredHealthHKDate,
  normalizeStoredSleepDuration,
  RUNNING_SLEEP_DURATION_LIMITS,
  type Reader,
} from "./runningRecoveryDataset";

type StoredRow = Record<string, unknown> & { id: unknown; user_id: number; date: unknown };
type Table = "sleep_logs" | "heart_rate_logs";
const dialect = new PgDialect();
const OWNER = 7;
const CUTOFF = "2026-11-15";
const run = runningRowFeature({ id: 301, date: CUTOFF, activity_window_verified: true, activity_start_timestamp: `${CUTOFF}T08:00:00+08:00`, time_series: [] });
function historyOf(runs = [run], complete = true): RunningHistory {
  return { runs, coverage: { totalRuns: runs.length, processedRuns: runs.length, complete, snapshotMaxId: 301, continuousRuns: 0, fitRuns: 0, qualifiedRuns: 0, earliestHK: runs[0]?.date ?? null, latestHK: runs.at(-1)?.date ?? null } };
}
const storedSleep = (overrides: Partial<StoredRow> = {}): StoredRow => ({
  id: 1, user_id: OWNER, date: CUTOFF, sleep_duration: "7.5", bedtime: "23:00:00", waketime: "07:00:00", sleep_score: "80", resting_hr: "60", hrv: "42", source: "garmin", ...overrides,
});
const storedHeart = (overrides: Partial<StoredRow> = {}): StoredRow => ({
  id: 1, user_id: OWNER, date: "2026-11-14", resting_hr: "60", hrv: "42", source: "garmin", ...overrides,
});
// Model SQL text padding, NOT canonical validation: malformed/calendar-invalid
// labels must still reach adapter rejection if the SQL cutoff selects them.
function withinSQLCutoff(value: unknown, cutoff: unknown, query: string): boolean {
  if (typeof value !== "string") return false;
  const iso = /^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})$/.exec(value);
  const comparable = /CASE\s+WHEN date::text/.test(query) && iso && iso[0] === value
    ? `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}` : value;
  return comparable <= String(cutoff);
}
function fakeReader(
  sleep: StoredRow[] = [],
  heart: StoredRow[] = [],
  snapshotOverrides: Partial<Record<Table, { total: unknown; max_id: unknown }>> = {},
  onFirstPage?: (table: Table, rows: StoredRow[]) => void,
) {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const firstPages = new Set<Table>();
  const db: Reader & { execute: ReturnType<typeof vi.fn> } = { execute: vi.fn(async (query: Parameters<Reader["execute"]>[0]) => {
    const rendered = dialect.sqlToQuery(query);
    queries.push(rendered);
    const table = /FROM (sleep_logs|heart_rate_logs)/.exec(rendered.sql)?.[1] as Table | undefined;
    if (!table) throw new Error(`Unexpected table/query: ${rendered.sql}`);
    const records = table === "sleep_logs" ? sleep : heart;
    const owner = Number(rendered.params[0]);
    if (/COUNT\(\*\) AS total, MAX\(id\)/.test(rendered.sql)) {
      const eligible = records.filter(r => r.user_id === owner && withinSQLCutoff(r.date, rendered.params[1], rendered.sql));
      return { rows: [snapshotOverrides[table] ?? { total: String(eligible.length), max_id: eligible.length ? String(Math.max(...eligible.map(r => Number(r.id)))) : null }] };
    }
    if (!firstPages.has(table)) { firstPages.add(table); onFirstPage?.(table, records); }
    const [, cursor, maxId, cutoff] = rendered.params;
    return { rows: records.filter(r => r.user_id === owner && Number(r.id) > Number(cursor) && Number(r.id) <= Number(maxId) && withinSQLCutoff(r.date, cutoff, rendered.sql)).sort((a, b) => Number(a.id) - Number(b.id)).slice(0, 200) };
  }) };
  return { db, queries };
}

function expectReadonlyOwnerSQL(queries: Array<{ sql: string; params: unknown[] }>, owner = OWNER, cutoff = CUTOFF) {
  let comparableDate: string | undefined;
  for (const query of queries) {
    expect(query.sql).toMatch(/^\s*SELECT\s/);
    expect(query.sql).toMatch(/WHERE user_id = \$\d+/);
    const predicate = /CASE\s+WHEN date::text ~ '\^\[0-9\]\{4\}-\[0-9\]\{1,2\}-\[0-9\]\{1,2\}\$'\s+THEN split_part\(date::text, '-', 1\) \|\| '-' \|\| lpad\(split_part\(date::text, '-', 2\), 2, '0'\) \|\| '-' \|\| lpad\(split_part\(date::text, '-', 3\), 2, '0'\)\s+ELSE date::text\s+END(?= <= \$\d+)/.exec(query.sql)?.[0];
    expect(predicate).toBeDefined();
    comparableDate ??= predicate;
    expect(predicate).toBe(comparableDate); // Same expression in COUNT/MAX and every keyset for BOTH tables.
    expect(query.sql).not.toMatch(/\bdate <=|::date\b|CAST\(|to_date\(/i);
    expect(query.sql).toMatch(/LIMIT (?:1|200)\b/);
    expect(query.params[0]).toBe(owner);
    expect(query.params.at(-1)).toBe(cutoff);
    const snapshot = /COUNT\(\*\) AS total, MAX\(id\)/.test(query.sql);
    expect(query.params).toHaveLength(snapshot ? 2 : 4);
    if (snapshot) expect(query.sql).toMatch(/END <= \$2 LIMIT 1/);
    else {
      expect(query.sql).toMatch(/WHERE user_id = \$1 AND id > \$2 AND id <= \$3 AND CASE/);
      expect(query.sql).toMatch(/END <= \$4\s+ORDER BY id ASC LIMIT 200/);
    }
    expect(query.sql).not.toMatch(/SELECT \*|INSERT|UPDATE|DELETE|ALTER|CREATE|OFFSET|running_logs|notes|created_at|body_battery|high_hr|avg_hr|zone1/);
    expect(query.sql).not.toContain(String(owner));
  }
}

describe("normalizeStoredHealthHKDate", () => {
  it.each([
    ["2025-11-1", "2025-11-01"], ["2025-12-1", "2025-12-01"],
    ["2026-2-9", "2026-02-09"], ["2026-02-9", "2026-02-09"],
    ["2026-2-09", "2026-02-09"], ["2026-11-15", "2026-11-15"],
    ["2024-2-29", "2024-02-29"], ["2000-2-29", "2000-02-29"],
    ["0001-1-1", "0001-01-01"], ["9999-12-31", "9999-12-31"],
  ])("pads only unequivocal numeric ISO labels %s → %s", (value, expected) => {
    expect(normalizeStoredHealthHKDate(value)).toBe(expected);
    expect(matcher.canonicalPreRunHKDate(expected)).toBe(expected);
  });
  it.each([
    null, undefined, "", " ", 20251101, true, {}, [], new Date("2025-11-01T00:00:00Z"),
    "2025-2-29", "1900-2-29", "2026-2-30", "2026-4-31", "2026-0-1", "2026-13-1", "2026-1-0", "2026-1-32", "0000-1-1",
    "2025-011-1", "2025-11-001", "25-11-1", "2025/11/1", "11-1-2025", "01/11/2025",
    " 2025-11-1", "2025-11-1 ", "2025-11-1\n", "2025-11-1T00:00:00Z", "2025-11-1+08:00", "2025-11-1 garbage",
    "２０２５-１１-１", "2025-+11-1", "2025-11-1' OR true",
  ])("rejects missing/ambiguous/calendar-invalid text without rollover: %s", value => {
    expect(normalizeStoredHealthHKDate(value)).toBeNull();
  });
  it("does not relax the shared matcher or infer wake-date semantics", () => {
    expect(matcher.canonicalPreRunHKDate("2025-11-1")).toBeNull();
    const context = matcher.matchRunningPreRunContext(
      { id: 1, HKdate: "2025-11-02", startTimestamp: "2025-11-02T08:00:00+08:00" },
      [{ id: 299, date: "2025-11-1", sleepDuration: 7.5, waketime: "07:00" }], [],
    );
    expect(context.sleep).toBeNull();
    expect(context.coverage.rejected["invalid-sleep-date"]).toBe(1);
  });
});

describe("normalizeStoredSleepDuration", () => {
  it.each([0, 7.5, 16, "7.5", "0", "16"])("accepts explicit hours %s without making clock assumptions", value => {
    expect(normalizeStoredSleepDuration(value)).toEqual({ hours: Number(value), status: "hours" });
  });
  it.each([null, undefined, ""])("keeps missing %s distinct from zero", value => {
    expect(normalizeStoredSleepDuration(value)).toEqual({ hours: null, status: "missing" });
  });
  it.each([true, false, {}, [], " ", "0x08", "7h", "7.5junk", "Infinity", "NaN", Infinity, NaN, -1, 16.01, 24, 961, "-2"])("rejects invalid or ambiguous value %s", value => {
    expect(normalizeStoredSleepDuration(value, "23:00", "07:00")).toEqual({ hours: null, status: "rejected" });
  });
  it("converts only clock-corroborated legacy minutes, including TIME seconds", () => {
    expect(normalizeStoredSleepDuration(450, "23:00", "07:00")).toEqual({ hours: 7.5, status: "legacy-minutes" });
    expect(normalizeStoredSleepDuration("451", "23:00:00", "07:00:00")).toEqual({ hours: 451 / 60, status: "legacy-minutes" });
    expect(normalizeStoredSleepDuration(480, "23:00:00.123456", "07:00:00.123456")).toEqual({ hours: 8, status: "legacy-minutes" });
    expect(normalizeStoredSleepDuration(960, "00:00", "16:00")).toEqual({ hours: 16, status: "legacy-minutes" });
    expect(normalizeStoredSleepDuration(40, "23:00", "07:00").status).toBe("rejected");
  });
  it.each([
    [450, null, null], [450, "23:00", null], [450, null, "07:00"],
    [450, "24:00", "07:00"], [450, "23:60", "07:00"], [450, "23:00:60", "07:00"],
    [450, "23:00", "7:00"], [450, "23:00+08:00", "07:00"],
    [450, "2026-11-14T23:00:00+08:00", "2026-11-15T07:00:00+08:00"],
    [450, "00:00", "17:00"], [450, "07:00", "07:00"],
    [60, "23:00", "07:00"], [496, "23:00", "07:00"],
  ])("rejects absent/invalid/unconvincing clocks: %s %s → %s", (value, bed, wake) => {
    expect(normalizeStoredSleepDuration(value, bed, wake)).toEqual({ hours: null, status: "rejected" });
  });
  it("applies inclusive plausibility boundaries and publishes the exact limits", () => {
    expect(normalizeStoredSleepDuration(120, "23:00", "07:00").hours).toBe(2);
    expect(normalizeStoredSleepDuration(495, "23:00", "07:00").hours).toBe(8.25);
    expect(normalizeStoredSleepDuration(119, "23:00", "07:00").status).toBe("rejected");
    expect(RUNNING_SLEEP_DURATION_LIMITS).toEqual({ hoursMin: 0, hoursMax: 16, legacyMinutesExclusiveMin: 24, legacyMinutesMax: 960, clockSpanHoursMax: 16, maximumSpanExcessHours: 0.25, minimumSpanFraction: 0.25 });
  });
});

describe("loadRunningRecoveryDataset read-only snapshots", () => {
  it("loads 429+ owner rows by 200-row keysets, casts real TIME/date fields, and never reloads history", async () => {
    const sleep = Array.from({ length: 429 }, (_, i) => storedSleep({ id: (i + 1) * 2, date: i === 0 ? "2020-01-01" : "2026-11-14", sleep_duration: i < 254 ? "450" : "7.5" }));
    const heart = Array.from({ length: 431 }, (_, i) => storedHeart({ id: (i + 1) * 3 }));
    sleep.push(storedSleep({ id: 9999, user_id: 99 }), storedSleep({ id: 10000, date: "2026-11-16" }));
    heart.push(storedHeart({ id: 9999, user_id: 99 }), storedHeart({ id: 10000, date: "2026-11-16" }));
    const history = historyOf();
    const { db, queries } = fakeReader(sleep, heart);
    const dataset = await loadRunningRecoveryDataset(db, OWNER, history, CUTOFF);
    expect(dataset.history).toBe(history);
    expect(dataset.joined[0].run).toBe(history.runs[0]);
    expect(dataset.sleepRows).toHaveLength(429);
    expect(dataset.heartRows).toHaveLength(431);
    expect(dataset.sleepRows[0].date).toBe("2020-01-01");
    expect(dataset.sleepRows.at(-1)?.id).toBe(858);
    expect(dataset.heartRows.at(-1)?.id).toBe(1293);
    expect(dataset.complete).toBe(true);
    expect(dataset.durationNormalization).toEqual({ legacyMinutesConverted: 254, rejected: 0 });
    expectReadonlyOwnerSQL(queries);
    for (const table of ["sleep_logs", "heart_rate_logs"]) {
      const pages = queries.filter(q => q.sql.includes(`FROM ${table}`) && !q.sql.includes("COUNT(*)"));
      expect(pages).toHaveLength(3);
      expect(pages.map(q => q.params[1])).toEqual(table === "sleep_logs" ? [0, 400, 800] : [0, 600, 1200]);
      expect(pages.every(q => /ORDER BY id ASC LIMIT 200/.test(q.sql))).toBe(true);
      expect(pages.every(q => /id > \$\d+ AND id <= \$\d+/.test(q.sql))).toBe(true);
      expect(pages.every(q => /date::text AS date/.test(q.sql))).toBe(true);
      if (table === "sleep_logs") expect(pages.every(q => /bedtime::text AS bedtime, waketime::text AS waketime/.test(q.sql))).toBe(true);
    }
    expect(queries.filter(q => /COUNT\(\*\) AS total, MAX\(id\)/.test(q.sql))).toHaveLength(2);
  });
  it("reads an engineered 422-row fixture including ids 299/328 legacy ISO dates as completely as padded copies", async () => {
    const sleep = Array.from({ length: 422 }, (_, i) => Object.freeze(storedSleep({
      id: i + 1, date: i + 1 === 299 ? "2025-11-1" : i + 1 === 328 ? "2025-12-1" : "2025-10-31",
    })));
    const original = JSON.stringify(sleep);
    const { db, queries } = fakeReader(sleep);
    const result = await loadRunningRecoveryDataset(db, OWNER, historyOf(), CUTOFF);
    const padded = fakeReader(sleep.map(row => ({ ...row, date: row.id === 299 ? "2025-11-01" : row.id === 328 ? "2025-12-01" : row.date })));
    const reference = await loadRunningRecoveryDataset(padded.db, OWNER, historyOf(), CUTOFF);
    expect(result).toEqual(reference);
    expect(result.complete).toBe(true);
    expect(result.sleepRows).toHaveLength(422);
    expect(result.sleepRows.find(row => row.id === 299)?.date).toBe("2025-11-01");
    expect(result.sleepRows.find(row => row.id === 328)?.date).toBe("2025-12-01");
    expect(JSON.stringify(sleep)).toBe(original);
    expectReadonlyOwnerSQL(queries);
    const pages = queries.filter(q => q.sql.includes("FROM sleep_logs") && !q.sql.includes("COUNT(*)"));
    expect(pages.map(q => q.params)).toEqual([[OWNER, 0, 422, CUTOFF], [OWNER, 200, 422, CUTOFF], [OWNER, 400, 422, CUTOFF]]);
  });
  it.each([
    ["2025-11-01", "2025-10-31", "2025-11-1", "2025-11-2"],
    ["2025-12-01", "2025-11-1", "2025-12-1", "2025-12-2"],
    ["2026-02-10", "2026-2-9", "2026-2-10", "2026-10-1"],
    ["2026-10-01", "2026-9-30", "2026-10-1", "2026-10-2"],
  ])("uses padded text cutoff %s in both tables' COUNT/MAX and keysets, including unpadded M/D", async (cutoff, earlier, same, later) => {
    const dates = [earlier, same, later, earlier];
    const scope = (date: string, i: number) => ({ id: i + 1, date, user_id: i === 3 ? 99 : OWNER });
    const sleep = dates.map((date, i) => storedSleep(scope(date, i)));
    const heart = dates.map((date, i) => storedHeart(scope(date, i)));
    const { db, queries } = fakeReader(sleep, heart);
    const result = await loadRunningRecoveryDataset(db, OWNER, historyOf([]), cutoff);
    const canonical = (date: string) => date.split("-").map((part, i) => i === 0 ? part : part.padStart(2, "0")).join("-");
    const padded = fakeReader(sleep.map(row => ({ ...row, date: canonical(row.date as string) })), heart.map(row => ({ ...row, date: canonical(row.date as string) })));
    expect(result).toEqual(await loadRunningRecoveryDataset(padded.db, OWNER, historyOf([]), cutoff));
    expect(result.complete).toBe(true);
    expect(result.sleepRows.map(row => [row.id, row.date])).toEqual([[1, canonical(earlier)], [2, cutoff]]);
    expect(result.heartRows.map(row => [row.id, row.date])).toEqual([[1, canonical(earlier)], [2, cutoff]]);
    expectReadonlyOwnerSQL(queries, OWNER, cutoff);
    expect(queries.filter(q => q.sql.includes("COUNT(*)")).map(q => q.params)).toEqual([[OWNER, cutoff], [OWNER, cutoff]]);
    expect(queries.filter(q => !q.sql.includes("COUNT(*)")).map(q => q.params)).toEqual([[OWNER, 0, 2, cutoff], [OWNER, 0, 2, cutoff]]);
  });
  it("models an engineered mixed 254 legacy-minute / 166-hour distribution on copies, not writes", async () => {
    const sleep = Array.from({ length: 420 }, (_, i) => Object.freeze(storedSleep({ id: i + 1, sleep_duration: i < 254 ? 450 : 7.5 })));
    const original = JSON.stringify(sleep);
    const { db, queries } = fakeReader(sleep);
    const dataset = await loadRunningRecoveryDataset(db, OWNER, historyOf(), CUTOFF);
    expect(dataset.sleepRows).toHaveLength(420);
    expect(dataset.sleepRows.every(r => r.sleepDuration === 7.5)).toBe(true);
    expect(dataset.sleepRows.filter(r => r.durationNormalization === "hours")).toHaveLength(166);
    expect(dataset.durationNormalization).toEqual({ legacyMinutesConverted: 254, rejected: 0 });
    expect(JSON.stringify(sleep)).toBe(original);
    expect(dataset.sleepRows[0]).not.toBe(sleep[0]);
    expectReadonlyOwnerSQL(queries);
  });
  it("retains neither arbitrary source text nor notes, URLs, tokens, raw fields or exercise-HR substitutes", async () => {
    const privateRow = storedSleep({ source: "garmin https://private.invalid/a?token=private-secret", notes: "DO NOT EXPOSE", user_id: OWNER, raw_file_url: "https://private.invalid/raw", body_battery: 100 });
    const heart = storedHeart({ resting_hr: null, hrv: null, high_hr: 199, avg_hr: 150, notes: "PRIVATE HEART NOTES", source: "Bearer private-credential" });
    const { db, queries } = fakeReader([privateRow], [heart]);
    const result = await loadRunningRecoveryDataset(db, OWNER, historyOf(), CUTOFF);
    expect(result.sleepRows[0].source).toBeNull();
    expect(result.heartRows[0]).toMatchObject({ restingHr: null, hrv: null, source: null });
    expect(result.joined[0].preRun.restingHr).toBeNull();
    expect(JSON.stringify(result)).not.toMatch(/private\.invalid|private-secret|private-credential|DO NOT EXPOSE|PRIVATE HEART NOTES|raw_file_url|body_battery|user_id|high_hr|avg_hr/);
    expectReadonlyOwnerSQL(queries);
  });
  it("whitelists known sources and keeps invalid/blank/missing numbers null instead of zero", async () => {
    const sleep = [storedSleep({ sleep_duration: null, sleep_score: null, resting_hr: " ", hrv: true, source: " GARMIN " }), storedSleep({ id: 2, source: "unknown-device" })];
    const heart = [storedHeart({ resting_hr: "0x3c", hrv: "42 bpm", source: "sheets" }), storedHeart({ id: 2, resting_hr: "60", hrv: "0", source: "manual" })];
    const { db } = fakeReader(sleep, heart);
    const result = await loadRunningRecoveryDataset(db, OWNER, historyOf(), CUTOFF);
    expect(result.sleepRows[0]).toMatchObject({ sleepDuration: null, sleepScore: null, restingHr: null, hrv: null, source: "garmin", durationNormalization: "missing" });
    expect(result.sleepRows[1].source).toBeNull();
    expect(result.heartRows[0]).toMatchObject({ restingHr: null, hrv: null, source: "sheets" });
    expect(result.heartRows[1]).toMatchObject({ restingHr: 60, hrv: 0, source: "manual" });
    expect(result.durationNormalization).toEqual({ legacyMinutesConverted: 0, rejected: 0 });
  });
  it("counts and excludes invalid/uncorroborated durations without inventing a minutes source unit", async () => {
    const { db } = fakeReader([
      storedSleep({ id: 1, sleep_duration: 450, bedtime: null, waketime: null }),
      storedSleep({ id: 2, sleep_duration: 40 }),
      storedSleep({ id: 3, sleep_duration: 450 }),
      storedSleep({ id: 4, sleep_duration: "bad" }),
    ]);
    const result = await loadRunningRecoveryDataset(db, OWNER, historyOf(), CUTOFF);
    expect(result.sleepRows.map(r => r.id)).toEqual([3]);
    expect(result.durationNormalization).toEqual({ legacyMinutesConverted: 1, rejected: 3 });
    // Full source snapshot was processed; explicit normalization rejects are not a pagination omission.
    expect(result.complete).toBe(true);
    expect(result.joined[0].preRun.sleepHours).toBeNull();
  });
  it("holds high-water ids steady when new rows arrive between snapshot and pages", async () => {
    const { db, queries } = fakeReader([storedSleep()], [storedHeart()], {}, (table, rows) => {
      rows.push(table === "sleep_logs" ? storedSleep({ id: 2 }) : storedHeart({ id: 2 }));
    });
    const result = await loadRunningRecoveryDataset(db, OWNER, historyOf(), CUTOFF);
    expect(result.sleepRows.map(r => r.id)).toEqual([1]);
    expect(result.heartRows.map(r => r.id)).toEqual([1]);
    expect(result.complete).toBe(true);
    expect(queries.filter(q => !q.sql.includes("COUNT(*)")).every(q => q.params[2] === 1)).toBe(true);
  });
  it.each(["sleep_logs", "heart_rate_logs"] as const)("flags incomplete %s counts and prevents false completeness", async table => {
    const { db } = fakeReader([storedSleep()], [storedHeart()], { [table]: { total: 2, max_id: 2 } });
    const result = await loadRunningRecoveryDataset(db, OWNER, historyOf(), CUTOFF);
    expect(result.complete).toBe(false);
    expect(result.sleepRows).toHaveLength(1);
    expect(result.heartRows).toHaveLength(1);
  });
  it("requires supplied history completeness and matching processed/total attestation", async () => {
    const { db } = fakeReader();
    expect((await loadRunningRecoveryDataset(db, OWNER, historyOf([run], false), CUTOFF)).complete).toBe(false);
    const history = historyOf();
    history.coverage.processedRuns = 2;
    expect((await loadRunningRecoveryDataset(db, OWNER, history, CUTOFF)).complete).toBe(false);
    history.coverage.processedRuns = 1; history.coverage.totalRuns = 2;
    expect((await loadRunningRecoveryDataset(db, OWNER, history, CUTOFF)).complete).toBe(false);
  });
  it("accepts empty snapshots with null max ids as complete", async () => {
    const { db, queries } = fakeReader();
    const result = await loadRunningRecoveryDataset(db, OWNER, historyOf([]), CUTOFF);
    expect(result).toMatchObject({ sleepRows: [], heartRows: [], joined: [], complete: true, durationNormalization: { legacyMinutesConverted: 0, rejected: 0 } });
    expect(queries).toHaveLength(2);
  });
  it.each([{ total: null, max_id: null }, { total: "bad", max_id: 1 }, { total: 1, max_id: "NaN" }, { total: 1, max_id: null }, { total: -1, max_id: -1 }, { total: 1.5, max_id: 2 }])("does not attest invalid snapshot statistics %j", async snapshot => {
    const { db } = fakeReader([], [], { sleep_logs: snapshot });
    expect((await loadRunningRecoveryDataset(db, OWNER, historyOf(), CUTOFF)).complete).toBe(false);
  });
  it("rejects invalid dates rather than parsing them as host-zone Dates or rolling them over", async () => {
    const { db } = fakeReader([storedSleep({ date: "2026-02-30" }), storedSleep({ id: 2, date: "2026-11-14 garbage" })]);
    const result = await loadRunningRecoveryDataset(db, OWNER, historyOf(), CUTOFF);
    expect(result.sleepRows).toEqual([]);
    expect(result.complete).toBe(false);
    const dateObjectReader: Reader = { execute: vi.fn(async query => /COUNT/.test(dialect.sqlToQuery(query).sql) ? { rows: [{ total: 1, max_id: 1 }] } : { rows: [storedSleep({ date: new Date("2026-11-14T00:00:00Z") })] }) };
    expect((await loadRunningRecoveryDataset(dateObjectReader, OWNER, historyOf(), CUTOFF)).complete).toBe(false);
  });
  it.each(["2025-2-29", "2026-2-30", "2026-4-31", "2026-0-1", "0000-1-1", "01/11/2025", "2025-11-1 garbage"])("rejects selected invalid label %s in both tables and marks a full read incomplete", async date => {
    const { db, queries } = fakeReader([storedSleep({ date })], [storedHeart({ date })]);
    const result = await loadRunningRecoveryDataset(db, OWNER, historyOf([]), CUTOFF);
    expect(result.sleepRows).toEqual([]);
    expect(result.heartRows).toEqual([]);
    expect(result.complete).toBe(false);
    expect(queries).toHaveLength(4); // Snapshot and page for each table, no SQL date cast failures.
    expectReadonlyOwnerSQL(queries);
  });
  it("rejects nonfinite/nonadvancing/out-of-order page ids without looping or exposing them", async () => {
    const db: Reader = { execute: vi.fn(async query => /COUNT/.test(dialect.sqlToQuery(query).sql) ? { rows: [{ total: 1, max_id: 1 }] } : { rows: [storedSleep({ id: Infinity }), storedSleep({ id: "NaN" }), storedSleep({ id: 0 })] }) };
    const result = await loadRunningRecoveryDataset(db, OWNER, historyOf(), CUTOFF);
    expect(result.sleepRows).toEqual([]);
    expect(result.heartRows).toEqual([]);
    expect(result.complete).toBe(false);
    expect(db.execute).toHaveBeenCalledTimes(4);
  });
  it("does not cache or reuse another owner's rows", async () => {
    const { db, queries } = fakeReader([storedSleep()], [storedHeart()]);
    expect((await loadRunningRecoveryDataset(db, OWNER, historyOf(), CUTOFF)).sleepRows).toHaveLength(1);
    const another = await loadRunningRecoveryDataset(db, 99, historyOf(), CUTOFF);
    expect(another.sleepRows).toEqual([]);
    expect(another.heartRows).toEqual([]);
    expect(another.joined[0].preRun.sleep).toBeNull();
    expect(queries.filter(q => q.params[0] === 99)).toHaveLength(2);
  });
  it.each([0, -1, NaN, Infinity, 1.5, "7", null])("validates owner %s before any SQL", async owner => {
    const { db } = fakeReader();
    await expect(loadRunningRecoveryDataset(db, owner as number, historyOf(), CUTOFF)).rejects.toThrow("owner userId");
    expect(db.execute).not.toHaveBeenCalled();
  });
  it.each(["", "2026-02-30", "2026-11-15T00:00:00Z", "2026-11-15' OR true", " 2026-11-15", "2026-11-5", "2026-2-15"])("validates cutoff %s before any SQL", async cutoff => {
    const { db } = fakeReader();
    await expect(loadRunningRecoveryDataset(db, OWNER, historyOf(), cutoff)).rejects.toThrow("canonical Hong Kong cutoff");
    expect(db.execute).not.toHaveBeenCalled();
  });
  it("rejects a runtime date-convention typo rather than interpreting it as wake-date", async () => {
    const { db } = fakeReader();
    await expect(loadRunningRecoveryDataset(db, OWNER, historyOf(), CUTOFF, { dateConvention: "wake" as "wake-date" })).rejects.toThrow("Unsupported");
    expect(db.execute).not.toHaveBeenCalled();
  });
});

describe("dataset delegates all pre-run eligibility and baselines to the shared matcher", () => {
  it("passes canonical legacy ISO read-shapes to the strict matcher without host timezone or wake-date assumptions", async () => {
    const legacyRun = runningRowFeature({ id: 302, date: "2025-12-01", activity_window_verified: true, activity_start_timestamp: "2025-12-01T08:00:00+08:00", time_series: [] });
    const sleep = Object.freeze(storedSleep({ id: 328, date: "2025-12-1" }));
    const heart = Object.freeze(storedHeart({ date: "2025-11-30" }));
    const { db } = fakeReader([sleep], [heart]);
    const spy = vi.spyOn(matcher, "matchRunningPreRunContext");
    const previousTZ = process.env.TZ;
    try {
      process.env.TZ = "Pacific/Honolulu";
      const hawaii = await loadRunningRecoveryDataset(db, OWNER, historyOf([legacyRun]), "2025-12-01");
      process.env.TZ = "Asia/Tokyo";
      const tokyo = await loadRunningRecoveryDataset(db, OWNER, historyOf([legacyRun]), "2025-12-01");
      expect(hawaii).toEqual(tokyo);
      expect(tokyo.complete).toBe(true);
      expect(tokyo.sleepRows[0].date).toBe("2025-12-01");
      expect(tokyo.heartRows[0].date).toBe("2025-11-30");
      expect(spy).toHaveBeenLastCalledWith(
        { id: legacyRun.id, HKdate: legacyRun.date, startTimestamp: legacyRun.startTimestamp }, tokyo.sleepRows, tokyo.heartRows,
        { dateConvention: "unknown", sleepDurationUnit: "hours", baselineWindowDays: 28 },
      );
      expect(tokyo.joined[0].preRun.sleep).toBeNull(); // Padding is not evidence of a wake-date convention.
      expect(tokyo.joined[0].preRun.coverage.rejected["invalid-sleep-date"]).toBeUndefined();
      expect(tokyo.joined[0].preRun.restingHr?.kind).toBe("prior-day-heart-summary");
      expect(sleep.date).toBe("2025-12-1");
      expect(matcher.canonicalPreRunHKDate(sleep.date)).toBeNull();
    } finally {
      spy.mockRestore();
      if (previousTZ === undefined) delete process.env.TZ;
      else process.env.TZ = previousTZ;
    }
  });
  it("forwards the real start, unknown semantics, normalized hours and 28-day baseline by default", async () => {
    const spy = vi.spyOn(matcher, "matchRunningPreRunContext");
    try {
      const { db } = fakeReader([storedSleep({ sleep_duration: 450 })], [storedHeart()]);
      const history = historyOf();
      const result = await loadRunningRecoveryDataset(db, OWNER, history, CUTOFF);
      expect(spy).toHaveBeenCalledWith({ id: run.id, HKdate: run.date, startTimestamp: run.startTimestamp }, result.sleepRows, result.heartRows, { dateConvention: "unknown", sleepDurationUnit: "hours", baselineWindowDays: 28 });
      expect(result.joined[0].preRun).toEqual(matcher.matchRunningPreRunContext({ id: run.id, HKdate: run.date, startTimestamp: run.startTimestamp }, result.sleepRows, result.heartRows, { dateConvention: "unknown", sleepDurationUnit: "hours", baselineWindowDays: 28 }));
      expect(result.joined[0].preRun.sleep).toBeNull();
      expect(result.joined[0].preRun.restingHr?.kind).toBe("prior-day-heart-summary");
    } finally { spy.mockRestore(); }
  });
  it("only verifies same-day clock sleep when wake-date was explicitly passed", async () => {
    const { db } = fakeReader([storedSleep({ sleep_duration: 450 })]);
    const unknown = await loadRunningRecoveryDataset(db, OWNER, historyOf(), CUTOFF);
    const confirmed = await loadRunningRecoveryDataset(db, OWNER, historyOf(), CUTOFF, { dateConvention: "wake-date" });
    expect(unknown.joined[0].preRun.sleep).toBeNull();
    expect(confirmed.joined[0].preRun.sleep).toMatchObject({ sleepHours: 7.5, durationUnit: "hours", pairingMethod: "adapter-confirmed-wake-date", ageHours: 1, measuredAt: "2026-11-14T23:00:00.000Z" });
    expect(confirmed.joined[0].preRun.coverage.userScopeVerified).toBe(false); // Never override the matcher's attestation.
  });
  it("excludes wake-after-run and same-day HR, even with explicit wake-date", async () => {
    const { db } = fakeReader([storedSleep({ waketime: "09:00" })], [storedHeart({ date: CUTOFF, resting_hr: 110 }), storedHeart({ id: 2, date: "2026-11-14", resting_hr: 55 })]);
    const result = await loadRunningRecoveryDataset(db, OWNER, historyOf(), CUTOFF, { dateConvention: "wake-date" });
    expect(result.joined[0].preRun.sleep).toBeNull();
    expect(result.joined[0].preRun.restingHr?.restingHr).toBe(55);
    expect(result.joined[0].preRun.coverage.rejected["same-day-or-future-heart-summary"]).toBe(1);
  });
  it("does not fix invalid starts/missing dates or assume a start for missing timestamps", async () => {
    const runs = [{ ...run, startTimestamp: "08:00" }, { ...run, date: "" }, { ...run, startTimestamp: null }];
    const { db } = fakeReader([storedSleep()], [storedHeart()]);
    const result = await loadRunningRecoveryDataset(db, OWNER, historyOf(runs), CUTOFF, { dateConvention: "wake-date" });
    expect(result.joined[0].preRun.run.valid).toBe(false);
    expect(result.joined[1].preRun.run.valid).toBe(false);
    expect(result.joined[2].preRun.run.valid).toBe(true);
    expect(result.joined[2].preRun.sleep).toBeNull();
    expect(result.joined[2].preRun.coverage.runStartKnown).toBe(false);
    expect(runs[0].startTimestamp).toBe("08:00");
    expect(runs[1].date).toBe("");
  });
  it("keeps explicit historical baseline reference dates, source and measurement kind without floating host-timezone parsing", async () => {
    const heart = [storedHeart(), ...[8, 9, 10, 11, 12].map((day, i) => storedHeart({ id: i + 2, date: `2026-11-${String(day).padStart(2, "0")}`, resting_hr: 50 })), storedHeart({ id: 10, date: CUTOFF, resting_hr: 120 }), storedHeart({ id: 11, date: "2026-11-13", resting_hr: 120, source: "manual" })];
    const { db } = fakeReader([], heart);
    const previousTZ = process.env.TZ;
    try {
      process.env.TZ = "Pacific/Honolulu";
      const hawaii = await loadRunningRecoveryDataset(db, OWNER, historyOf(), CUTOFF);
      process.env.TZ = "Asia/Tokyo";
      const tokyo = await loadRunningRecoveryDataset(db, OWNER, historyOf(), CUTOFF);
      expect(hawaii.joined).toEqual(tokyo.joined);
      expect(tokyo.joined[0].preRun.baseline).toMatchObject({ windowDays: 28, validDays: 5, meanBpm: 50, rhrDeltaBpm: 10, windowStartHKdate: "2026-10-17", windowEndExclusiveHKdate: "2026-11-14", source: "garmin", kind: "prior-day-heart-summary" });
      expect(tokyo.joined[0].preRun.baseline.records.every(r => r.date === r.measurementHKdate && r.date < "2026-11-14" && r.source === "garmin")).toBe(true);
    } finally {
      if (previousTZ === undefined) delete process.env.TZ;
      else process.env.TZ = previousTZ;
    }
  });
  it("keeps invalid-clock text private but preserves matcher rejection", async () => {
    const { db } = fakeReader([storedSleep({ bedtime: "https://private.invalid?token=credential" })]);
    const result = await loadRunningRecoveryDataset(db, OWNER, historyOf(), CUTOFF, { dateConvention: "wake-date" });
    expect(result.sleepRows[0].bedtime).toBe("invalid-clock");
    expect(result.joined[0].preRun.sleep).toBeNull();
    expect(result.joined[0].preRun.coverage.rejected["invalid-bedtime"]).toBe(1);
    expect(JSON.stringify(result)).not.toContain("private.invalid");
  });
});
