import { createHash } from "node:crypto";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "./db";
import { parseGarminRawFile } from "./garminFileImport";
import { storageReadBuffer } from "./storage";
import { ensureSheetHeaders, writeRowToSheet } from "./sheetsService";
import { isValidGarminDate, saveGarminImport, selectGarminHistoryMatch, validateGarminSummary } from "./garminDirectSave";

vi.mock("./db", () => ({ getDb: vi.fn() }));
vi.mock("./garminFileImport", () => ({ parseGarminRawFile: vi.fn() }));
vi.mock("./storage", () => ({ storageReadBuffer: vi.fn() }));
vi.mock("./sheetsService", () => ({ ensureSheetHeaders: vi.fn(), writeRowToSheet: vi.fn() }));

type Row = Record<string, any>;
const dialect = new PgDialect();
const bytes = Buffer.from("original Garmin FIT bytes, not client preview");
const hash = createHash("sha256").update(bytes).digest("hex");
const input = { fileKey: "garmin-originals/2/source_12345678.fit", fileName: "run.fit" };
const summary = { date: "2026-11-02", distanceKm: 5, durationSec: 1800 };
const preview = () => ({
  sourceFormat: "FIT" as const,
  fields: {
    date: summary.date, weatherTime: "06:17", distanceKm: "5.00", hour: "0", minutes: "30", second: "0",
    averagePace: "6.00", averageHeartRate: "150", maximumHeartRate: "172", averageCadence: "175.5", maxCadence: "189.5",
    avgStrideLengthM: "1.07", avgVerticalRatio: "8.2", verticalOscillationCm: "7.8", avgGroundContactTimeMs: "240.5", calories: "301",
  } as Record<string, string>,
  garminDetails: { sourceFormat: "FIT", avgPowerW: 220, rawSampleCount: 20000 },
  laps: [{ lap: 1, durationSec: 1800, distanceKm: 5, avgPace: "6.00" }],
  timeSeries: [{ elapsedSec: 0, timestamp: "2026-11-01T22:17:00.000Z", heartRate: 150 }],
  warnings: [],
});
const historical = (overrides: Row = {}): Row => ({
  id: 7, date: summary.date, running_type: "Race", route_type: "Trail", running_shoes: "Manual shoes", shoes_id: 12,
  distance_km: 5.02, hour: 0, minutes: 30, second: 13, average_pace: "6.02", best_pace: "4.20",
  average_heart_rate: 149, maximum_heart_rate: 174, average_cadence: 171.3, max_cadence: 187.2,
  avg_stride_length_m: 1.02, avg_vertical_ratio: 8.5, vertical_oscillation_cm: 7.4, avg_ground_contact_time_ms: 251,
  calories: 288, temperature: 25.5, humidity: 78, wind_speed: 9.4, apparent_temp: 27.1, precipitation: 0,
  weather_code: 2, weather_condition: "Cloudy", weather_location: "Sha Tin", weather_observed_at: "2026-11-02T06:10", weather_source: "manual",
  notes: "Preserve my race notes", status: "completed", created_at: "earlier", updated_at: "earlier",
  garmin_details: { customMetric: "keep", raceId: 22 }, laps: [], time_series: [], ...overrides,
});

/** Small stateful PostgreSQL contract fake: SQL is compiled by Drizzle itself.
 * Transactions are serialized and rolled back, so retries exercise persistent
 * state instead of just checking a pre-scripted list of return values. */
function mockDatabase(seed: Row[] = []) {
  let rows = structuredClone(seed);
  let nextId = 100;
  let pending: Promise<unknown> = Promise.resolve();
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const execute = vi.fn(async (statement: SQL) => {
    const query = dialect.sqlToQuery(statement);
    const text = query.sql.replace(/\s+/g, " ").trim();
    const params = query.params;
    queries.push({ sql: text, params });
    if (text.startsWith("SELECT pg_advisory_xact_lock")) return { rows: [] };
    if (text.includes("garmin_details->>'rawFileHash'")) return { rows: structuredClone(rows.filter(row => row.garmin_details?.rawFileHash === params[0]).slice(0, 2)) };
    if (text.startsWith("SELECT") && text.includes("WHERE date =")) return { rows: structuredClone(rows.filter(row => row.date === params[0]).slice(0, 101)) };
    if (text.startsWith("SELECT") && text.includes("WHERE id =")) return { rows: structuredClone(rows.filter(row => row.id === params[0]).slice(0, 1)) };
    if (text.startsWith("UPDATE running_logs")) {
      const row = rows.find(row => row.id === params[3]);
      if (!row) return { rows: [] };
      row.garmin_details = { ...row.garmin_details, ...JSON.parse(params[0] as string) };
      row.laps = JSON.parse(params[1] as string);
      row.time_series = JSON.parse(params[2] as string);
      return { rows: [structuredClone(row)] };
    }
    if (text.startsWith("INSERT INTO running_logs")) {
      const columns = text.match(/INSERT INTO running_logs \(([^)]+)\)/)![1].split(",").map(column => column.trim());
      const row: Row = { id: nextId++ };
      columns.forEach((column, index) => { row[column] = ["garmin_details", "laps", "time_series"].includes(column) ? JSON.parse(params[index] as string) : params[index]; });
      rows.push(row);
      return { rows: [structuredClone(row)] };
    }
    throw new Error(`Unexpected SQL: ${text}`);
  });
  const transaction = vi.fn((callback: (tx: { execute: typeof execute }) => Promise<unknown>) => {
    const run = pending.then(async () => {
      const before = structuredClone(rows);
      try { return await callback({ execute }); } catch (error) { rows = before; throw error; }
    });
    pending = run.catch(() => undefined);
    return run;
  });
  const db = { transaction };
  vi.mocked(getDb).mockResolvedValue(db as any);
  return { db, queries, rows: () => structuredClone(rows), execute };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(storageReadBuffer).mockResolvedValue(bytes);
  vi.mocked(parseGarminRawFile).mockReturnValue(preview());
  vi.mocked(ensureSheetHeaders).mockResolvedValue();
  vi.mocked(writeRowToSheet).mockResolvedValue();
});

describe("Garmin direct-save pure validation and history selection", () => {
  it.each(["", "not-a-date", "2026-2-03", "2026-02-29", "2024-02-30", "2026-13-01", undefined, "2026-11-02T00:00:00Z"])("rejects malformed date %s without a today fallback", date => {
    expect(isValidGarminDate(date)).toBe(false);
    expect(() => validateGarminSummary({ ...preview().fields, date: date as string })).toThrow(/香港活動日期/);
  });
  it("accepts real leap days and validates the positive summary", () => {
    expect(isValidGarminDate("2024-02-29")).toBe(true);
    expect(validateGarminSummary(preview().fields)).toEqual(summary);
  });
  it.each(["0", "-1", "NaN", "Infinity", ""])("rejects invalid distance %s", distanceKm => {
    expect(() => validateGarminSummary({ ...preview().fields, distanceKm })).toThrow(/大於零/);
  });
  it("rejects zero, negative and nonnumeric duration", () => {
    expect(() => validateGarminSummary({ ...preview().fields, hour: "0", minutes: "0", second: "0" })).toThrow(/大於零/);
    expect(() => validateGarminSummary({ ...preview().fields, minutes: "-1" })).toThrow(/時間無效/);
    expect(() => validateGarminSummary({ ...preview().fields, minutes: "NaN" })).toThrow(/時間無效/);
  });
  it("requires same HK date and BOTH close distance and duration", () => {
    const candidates = [
      { id: 1, date: "2026-11-01", distanceKm: 5, durationSec: 1800 },
      { id: 2, date: summary.date, distanceKm: 7, durationSec: 1800 },
      { id: 3, date: summary.date, distanceKm: 5, durationSec: 2400 },
      { id: 4, date: summary.date, distanceKm: 5.02, durationSec: 1813 },
    ];
    expect(selectGarminHistoryMatch(candidates, summary)?.id).toBe(4);
    expect(selectGarminHistoryMatch([...candidates].reverse(), summary)?.id).toBe(4);
    expect(selectGarminHistoryMatch(candidates.slice(0, 3), summary)).toBeNull();
  });
  it("never silently guesses between two similar activities", () => {
    expect(() => selectGarminHistoryMatch([
      { id: 1, ...summary }, { id: 2, ...summary, distanceKm: 5.01 },
    ], summary)).toThrow(/編輯/);
  });
  it.each([{ distanceKm: null }, { distanceKm: 0 }, { durationSec: null }, { durationSec: 0 }])("requires explicit edit for incomplete same-day history %o", partial => {
    expect(() => selectGarminHistoryMatch([{ id: 1, ...summary, ...partial }], summary)).toThrow(/編輯/);
  });
});

describe("Garmin direct save transactions", () => {
  it("creates from the server-reparsed file, including dynamics and atomic source metadata", async () => {
    const db = mockDatabase();
    const result = await saveGarminImport(input);
    expect(storageReadBuffer).toHaveBeenCalledWith(input.fileKey);
    expect(parseGarminRawFile).toHaveBeenCalledWith(bytes, "run.fit");
    expect(result).toMatchObject({ id: 100, action: "created", date: summary.date, sampleCount: 1 });
    expect(result.fields).toMatchObject({ distanceKm: "5", minutes: "30", maxCadence: "189.5", avgStrideLengthM: "1.07", avgVerticalRatio: "8.2", verticalOscillationCm: "7.8", avgGroundContactTimeMs: "240.5", runningType: "", routeType: "", runningShoes: "", weatherLocation: "" });
    expect(result.garminDetails).toMatchObject({ rawFileHash: hash, rawFileKey: input.fileKey, rawFileName: "run.fit", rawFileFormat: "FIT", rawSampleCount: 20000 });
    expect(result.timeSeries).toEqual(preview().timeSeries);
    expect(result.laps).toEqual(preview().laps);
    expect(db.queries[0].sql).toMatch(/pg_advisory_xact_lock\(\$1::bigint\)/);
    expect(db.queries.some(query => query.sql.includes("user_id"))).toBe(false);
    expect(db.queries.filter(query => query.sql.includes("FROM running_logs")).every(query => query.sql.includes("LIMIT") && query.sql.includes("FOR UPDATE"))).toBe(true);
    expect(db.queries.filter(query => query.sql.includes("FROM running_logs")).every(query => query.sql.includes("date::text AS date"))).toBe(true);
    expect(db.rows()).toHaveLength(1);
    expect(ensureSheetHeaders).toHaveBeenCalledWith("running");
    expect(writeRowToSheet).toHaveBeenCalledWith("running", expect.objectContaining({ date: summary.date, maxCadence: "189.5", avgStrideLengthM: "1.07", garminDetails: result.garminDetails, laps: result.laps }));
    expect(vi.mocked(writeRowToSheet).mock.calls[0][1]).not.toHaveProperty("temperature");
  });

  it("attaches to the unique history match, preserving every summary field, shoes/FK, weather and other metadata", async () => {
    const original = historical();
    const db = mockDatabase([original]);
    const result = await saveGarminImport(input);
    expect(result.action).toBe("attached");
    expect(result.id).toBe(7);
    const actual = db.rows()[0];
    const { garmin_details: _details, laps: _laps, time_series: _series, ...summaryBefore } = original;
    const { garmin_details: _newDetails, laps: _newLaps, time_series: _newSeries, ...summaryAfter } = actual;
    expect(summaryAfter).toEqual(summaryBefore);
    expect(result.fields).toMatchObject({ runningType: "Race", routeType: "Trail", runningShoes: "Manual shoes", distanceKm: "5.02", second: "13", averageHeartRate: "149", notes: original.notes, weatherCondition: "Cloudy", weatherLocation: "Sha Tin", temperature: "25.5", weatherCode: "2", weatherTime: "06:10", maxCadence: "187.2" });
    expect(result.garminDetails).toMatchObject({ customMetric: "keep", raceId: 22, rawFileHash: hash });
    expect(result.garminDetails).toEqual(actual.garmin_details);
    expect(db.queries.find(query => query.sql.startsWith("UPDATE"))!.sql).toMatch(/^UPDATE running_logs SET garmin_details = .* laps = .* time_series = .* WHERE id =/);
    expect(db.queries.some(query => /INSERT|races|running_shoes/.test(query.sql.split(" RETURNING ")[0]) && query.sql.startsWith("UPDATE"))).toBe(false);
    expect(writeRowToSheet).not.toHaveBeenCalled();
  });

  it("an explicit historical edit permits summary differences but not date differences", async () => {
    const db = mockDatabase([historical({ distance_km: 4.4, minutes: 24 })]);
    expect((await saveGarminImport({ ...input, runningLogId: 7 })).action).toBe("attached");
    expect(db.rows()[0].distance_km).toBe(4.4);
    const mismatch = mockDatabase([historical({ date: "2026-11-01" })]);
    await expect(saveGarminImport({ ...input, runningLogId: 7 })).rejects.toThrow(/香港活動日期.*不符/);
    expect(mismatch.rows()[0].garmin_details).not.toHaveProperty("rawFileHash");
  });

  it("returns the same committed record after a lost response, even for a newly uploaded key of identical bytes", async () => {
    const db = mockDatabase();
    const created = await saveGarminImport(input);
    const retry = await saveGarminImport(input);
    const reupload = await saveGarminImport({ ...input, fileKey: "garmin-originals/2/another_87654321.fit", fileName: "renamed.fit" });
    expect(created.action).toBe("created");
    expect(retry).toEqual({ ...created, action: "duplicate" });
    expect(reupload).toEqual(retry);
    expect(db.rows()).toHaveLength(1);
    expect(db.queries.filter(query => query.sql.startsWith("INSERT"))).toHaveLength(1);
    expect(writeRowToSheet).toHaveBeenCalledTimes(1);
  });

  it("concurrent same-file requests persist just one record", async () => {
    const db = mockDatabase();
    const [first, second] = await Promise.all([saveGarminImport(input), saveGarminImport(input)]);
    expect([first.action, second.action]).toEqual(["created", "duplicate"]);
    expect(first.id).toBe(second.id);
    expect(db.rows()).toHaveLength(1);
  });

  it("duplicates return actual edited summary and stored charts, not a newly parsed preview", async () => {
    const row = historical({ garmin_details: { rawFileHash: hash, rawFileName: "original.fit", customMetric: "keep" }, laps: [{ lap: 1, durationSec: 33, distanceKm: 0.1, avgPace: null }], time_series: [{ elapsedSec: 0, timestamp: "stored", heartRate: 91 }] });
    const db = mockDatabase([row]);
    const result = await saveGarminImport({ ...input, runningLogId: 7 });
    expect(result.action).toBe("duplicate");
    expect(result.fields.runningShoes).toBe("Manual shoes");
    expect(result.garminDetails).toEqual(row.garmin_details);
    expect(result.timeSeries).toEqual(row.time_series);
    expect(result.laps).toEqual(row.laps);
    expect(db.queries.some(query => /^(UPDATE|INSERT)/.test(query.sql))).toBe(false);
    expect(writeRowToSheet).not.toHaveBeenCalled();
  });

  it("rejects attaching a hash already owned by another target", async () => {
    const seed = [historical({ garmin_details: { rawFileHash: hash } }), historical({ id: 8 })];
    const db = mockDatabase(seed);
    await expect(saveGarminImport({ ...input, runningLogId: 8 })).rejects.toThrow(/已連結另一筆/);
    expect(db.rows()).toEqual(seed);
  });

  it("rejects overwriting a target's different hash, with or without explicit target", async () => {
    const seed = [historical({ garmin_details: { rawFileHash: "different-hash" } })];
    const db = mockDatabase(seed);
    await expect(saveGarminImport({ ...input, runningLogId: 7 })).rejects.toThrow(/不同的 Garmin/);
    await expect(saveGarminImport(input)).rejects.toThrow(/不同的 Garmin/);
    expect(db.rows()).toEqual(seed);
  });

  it("rejects two close same-day histories instead of guessing or creating", async () => {
    const seed = [historical(), historical({ id: 8 })];
    const db = mockDatabase(seed);
    await expect(saveGarminImport(input)).rejects.toThrow(/編輯/);
    expect(db.rows()).toEqual(seed);
  });

  it("rejects incomplete same-day history and an absent explicit target", async () => {
    const db = mockDatabase([historical({ distance_km: null })]);
    await expect(saveGarminImport(input)).rejects.toThrow(/缺少距離或時間/);
    await expect(saveGarminImport({ ...input, runningLogId: 999 })).rejects.toThrow(/找不到/);
    expect(db.rows()).toHaveLength(1);
  });

  it.each([
    { date: "2026-02-30" }, { date: "" }, { distanceKm: "0" }, { minutes: "0", hour: "0", second: "0" },
  ])("invalid parsed summary creates no record: %o", async invalid => {
    const parsed = preview();
    parsed.fields = { ...parsed.fields, ...invalid };
    vi.mocked(parseGarminRawFile).mockReturnValue(parsed);
    const db = mockDatabase();
    await expect(saveGarminImport(input)).rejects.toThrow();
    expect(db.db.transaction).not.toHaveBeenCalled();
    expect(db.rows()).toEqual([]);
    expect(writeRowToSheet).not.toHaveBeenCalled();
  });

  it("rejects parser and storage errors without starting a transaction", async () => {
    const db = mockDatabase();
    vi.mocked(parseGarminRawFile).mockImplementation(() => { throw new Error("invalid FIT"); });
    await expect(saveGarminImport(input)).rejects.toThrow("invalid FIT");
    vi.mocked(storageReadBuffer).mockRejectedValue(new Error("storage 503"));
    await expect(saveGarminImport(input)).rejects.toThrow("storage 503");
    expect(db.db.transaction).not.toHaveBeenCalled();
  });

  it.each(["header", "append"])("a %s sync error after commit returns success and warning, never duplicates on retry", async stage => {
    const db = mockDatabase();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    if (stage === "header") vi.mocked(ensureSheetHeaders).mockRejectedValue(new Error("header network error"));
    else vi.mocked(writeRowToSheet).mockRejectedValue(new Error("append network error"));
    const result = await saveGarminImport(input);
    expect(result.action).toBe("created");
    expect(result.syncWarning).toContain("已儲存");
    expect(db.rows()).toHaveLength(1);
    expect((await saveGarminImport(input)).action).toBe("duplicate");
    expect(db.rows()).toHaveLength(1);
    warn.mockRestore();
  });

  it("rolls back a failed database write and permits the same-key retry", async () => {
    const db = mockDatabase();
    const normalExecute = db.execute.getMockImplementation()!;
    let fail = true;
    db.execute.mockImplementation(async statement => {
      const result = await normalExecute(statement);
      if (dialect.sqlToQuery(statement).sql.trim().startsWith("INSERT") && fail) {
        fail = false;
        throw new Error("transaction connection lost before commit");
      }
      return result;
    });
    await expect(saveGarminImport(input)).rejects.toThrow(/connection lost/);
    expect(db.rows()).toEqual([]);
    expect(writeRowToSheet).not.toHaveBeenCalled();
    expect((await saveGarminImport(input)).action).toBe("created");
    expect(db.rows()).toHaveLength(1);
  });
});
