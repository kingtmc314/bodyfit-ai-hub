import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { Encoder, Profile } from "@garmin/fitsdk";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "./db";
import { parseGarminRawFile } from "./garminFileImport";
import { storageReadBuffer } from "./storage";
import { ensureSheetHeaders, writeRowToSheet } from "./sheetsService";
import { isValidGarminDate, saveGarminImport, selectGarminHistoryMatch, validateGarminSummary } from "./garminDirectSave";
import { prepareGarminGpsWeather } from "./garminGpsWeather";

vi.mock("./db", () => ({ getDb: vi.fn() }));
vi.mock("./garminFileImport", () => ({ parseGarminRawFile: vi.fn() }));
vi.mock("./storage", () => ({ storageReadBuffer: vi.fn() }));
vi.mock("./sheetsService", () => ({ ensureSheetHeaders: vi.fn(), writeRowToSheet: vi.fn() }));
vi.mock("./garminGpsWeather", () => ({ prepareGarminGpsWeather: vi.fn() }));

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

const timestamps = (first: string | undefined, last: string | undefined) => [
  { elapsedSec: 0, timestamp: first, heartRate: 150 },
  { elapsedSec: 360, timestamp: last, heartRate: 151 },
];
const linkedShortRun = (overrides: Row = {}) => historical({
  id: 891, date: "2026-11-12", distance_km: 0.81, hour: 0, minutes: 5, second: 54,
  garmin_details: {
    rawFileHash: "old-fit-hash", rawFileName: "previous.fit", rawFileFormat: "FIT", customMetric: "keep", raceId: 22,
    activityStartTimestamp: "2026-11-12T11:31:20Z", activityEndTimestamp: "2026-11-12T11:54:19.276Z",
    activityWindowVerified: 1, activityTimeBasis: "fit-session-elapsed",
  },
  laps: [{ lap: 1, durationSec: 354, distanceKm: 0.81, avgPace: "7.17" }],
  time_series: timestamps("2026-11-12T11:31:20Z", "2026-11-12T11:54:19Z"),
  ...overrides,
});
const shortRunPreview = () => ({
  ...preview(),
  fields: { ...preview().fields, date: "2026-11-12", distanceKm: "0.83", hour: "0", minutes: "6", second: "0" },
  garminDetails: {
    ...preview().garminDetails, rawSampleCount: 361,
    activityStartTimestamp: "2026-11-12T12:36:45Z", activityEndTimestamp: "2026-11-12T12:42:45Z",
    activityWindowVerified: 1, activityTimeBasis: "fit-session-elapsed",
  },
  timeSeries: Array.from({ length: 361 }, (_, elapsedSec) => ({
    elapsedSec, timestamp: new Date(Date.parse("2026-11-12T12:36:45Z") + elapsedSec * 1000).toISOString(), heartRate: 150,
  })),
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
    if (text.includes("WHERE garmin_details->>'rawFileHash' =")) return { rows: structuredClone(rows.filter(row => row.garmin_details?.rawFileHash === params[0]).slice(0, 2)) };
    if (text.startsWith("SELECT") && text.includes("WHERE date =")) {
      expect(text).toContain("time_series->0->>'timestamp' AS first_timestamp");
      expect(text).toContain("time_series->-1->>'timestamp' AS last_timestamp");
      return { rows: rows.filter(row => row.date === params[0]).slice(0, 101).map(row => {
        const series = typeof row.time_series === "string" ? JSON.parse(row.time_series) : row.time_series;
        const details = typeof row.garmin_details === "string" ? JSON.parse(row.garmin_details) : row.garmin_details;
        return {
          id: row.id, date: row.date, distance_km: row.distance_km, hour: row.hour, minutes: row.minutes, second: row.second,
          first_timestamp: series?.[0]?.timestamp ?? null,
          last_timestamp: Array.isArray(series) ? series[series.length - 1]?.timestamp ?? null : null,
          activity_start_timestamp: details?.activityStartTimestamp ?? null,
          activity_end_timestamp: details?.activityEndTimestamp ?? null,
          activity_window_verified: details?.activityWindowVerified === undefined ? null : String(details.activityWindowVerified),
          activity_time_basis: details?.activityTimeBasis ?? null,
          raw_file_key: details?.rawFileKey ?? null, raw_file_hash: details?.rawFileHash ?? null,
        };
      }) };
    }
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
  vi.mocked(prepareGarminGpsWeather).mockResolvedValue({ fields: {}, metadata: {} });
});

describe("GPS weather is new-summary-only enrichment", () => {
  const enrichment = () => ({ fields: { temperature: "0", humidity: "65.5", weatherLocation: "GPS 路線 · 2 個取樣格", weatherSource: "Open-Meteo 全程時間加權", weatherObservedAt: "2026-11-02T06:00:00+08:00 至 2026-11-02T07:00:00+08:00" }, metadata: { gpsWeatherStatus: "complete", gpsWeatherProvenance: '{"version":1,"coverageFraction":1}' } });
  it("adds labelled GPS averages only to a new summary and preserves the source hash and samples", async () => {
    const db = mockDatabase();
    vi.mocked(prepareGarminGpsWeather).mockResolvedValue(enrichment());
    const result = await saveGarminImport(input);
    expect(result.action).toBe("created");
    expect(result.fields.temperature).toBe("0");
    expect(result.fields.humidity).toBe("65.5");
    expect(result.fields.weatherLocation).toContain("2 個取樣格");
    expect(result.garminDetails.rawFileHash).toBe(hash);
    expect(result.garminDetails.gpsWeatherStatus).toBe("complete");
    expect(result.timeSeries).toEqual(preview().timeSeries);
    expect(db.rows()).toHaveLength(1);
  });
  it("does not overwrite existing manual weather or persist weather on an attachment", async () => {
    const before = historical();
    const db = mockDatabase([before]);
    vi.mocked(prepareGarminGpsWeather).mockResolvedValue(enrichment());
    const result = await saveGarminImport({ ...input, runningLogId: before.id });
    expect(result.action).toBe("attached");
    expect(db.rows()[0].temperature).toBe(before.temperature);
    expect(db.rows()[0].weather_source).toBe("manual");
    expect(result.garminDetails.gpsWeatherStatus).toBeUndefined();
    expect(writeRowToSheet).not.toHaveBeenCalled();
  });
  it("a duplicate remains the saved original summary, not a new GPS-weather result", async () => {
    const before = historical({ garmin_details: { rawFileHash: hash }, time_series: preview().timeSeries });
    const db = mockDatabase([before]);
    vi.mocked(prepareGarminGpsWeather).mockResolvedValue(enrichment());
    const result = await saveGarminImport(input);
    expect(result.action).toBe("duplicate");
    expect(result.fields.temperature).toBe("25.5");
    expect(db.rows()).toEqual([before]);
  });
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
    await expect(saveGarminImport({ ...input, runningLogId: 8 })).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("#7") });
    expect(db.queries.some(query => /^(UPDATE|INSERT)/.test(query.sql))).toBe(false);
  });

  it("rejects overwriting a target's different hash, with or without explicit target", async () => {
    const seed = [historical({ garmin_details: { rawFileHash: "different-hash" } })];
    const db = mockDatabase(seed);
    await expect(saveGarminImport({ ...input, runningLogId: 7 })).rejects.toThrow(/不同的 Garmin/);
    await expect(saveGarminImport(input)).rejects.toThrow(/不同的 Garmin/);
    expect(db.rows()).toEqual(seed);
    await expect(saveGarminImport(input)).rejects.toBeInstanceOf(TRPCError);
    await expect(saveGarminImport(input)).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("#7") });
    expect(db.queries.some(query => /^(UPDATE|INSERT)/.test(query.sql))).toBe(false);
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

describe("Garmin trustworthy timestamp-window matching", () => {
  const existing = {
    id: 891, date: "2026-11-12", distanceKm: 0.81, durationSec: 354,
    firstTimestamp: "2026-11-12T11:31:20Z", lastTimestamp: "2026-11-12T11:54:19Z",
    activityWindowVerified: 1, activityTimeBasis: "fit-session-elapsed",
  };
  const incoming = {
    date: existing.date, distanceKm: 0.83, durationSec: 360,
    firstTimestamp: "2026-11-12T12:36:45Z", lastTimestamp: "2026-11-12T12:42:45Z",
    activityWindowVerified: 1, activityTimeBasis: "fit-session-elapsed",
  };

  it.each([
    { firstTimestamp: "2026-11-12T11:55:19Z", lastTimestamp: "2026-11-12T12:01:19Z" },
    { firstTimestamp: "2026-11-12T10:00:00Z", lastTimestamp: "2026-11-12T11:30:20Z" },
    { firstTimestamp: "2026-11-12T19:55:19+08:00", lastTimestamp: "2026-11-12T20:01:19+08:00" },
  ])("excludes clearly separated valid windows in either order, including exactly 60 seconds: %o", window => {
    expect(selectGarminHistoryMatch([existing], { ...incoming, ...window })).toBeNull();
  });

  it.each([
    { firstTimestamp: "2026-11-12T11:55:18.999Z", lastTimestamp: "2026-11-12T12:01:19Z" },
    { firstTimestamp: "2026-11-12T11:54:19Z", lastTimestamp: "2026-11-12T12:00:19Z" },
    { firstTimestamp: "2026-11-12T11:50:00Z", lastTimestamp: "2026-11-12T11:56:00Z" },
  ])("keeps near, touching and overlapping windows as possible duplicates: %o", window => {
    expect(selectGarminHistoryMatch([existing], { ...incoming, ...window })?.id).toBe(891);
  });

  it.each([
    { firstTimestamp: undefined }, { lastTimestamp: undefined },
    { firstTimestamp: "invalid" }, { lastTimestamp: "invalid" },
    { firstTimestamp: "2026-11-12T20:00:00Z", lastTimestamp: "2026-11-12T19:00:00Z" },
    { firstTimestamp: "2026-11-11T12:00:00Z" },
    { firstTimestamp: "2026-11-12T16:00:00Z", lastTimestamp: "2026-11-12T16:06:00Z" },
    { firstTimestamp: "2026-11-12T12:36:45", lastTimestamp: "2026-11-12T12:42:45" },
    { firstTimestamp: "2026-02-30T12:36:45Z" },
    { firstTimestamp: "2026-11-12T24:00:00Z" },
    { firstTimestamp: 1794487005000 },
    { activityWindowVerified: undefined }, { activityWindowVerified: 0 },
    { activityTimeBasis: "record-endpoints" },
  ])("does not exclude on missing, malformed, reversed or HK-date-inconsistent bounds on either side: %o", invalid => {
    expect(selectGarminHistoryMatch([existing], { ...incoming, ...invalid })?.id).toBe(891);
    expect(selectGarminHistoryMatch([{ ...existing, ...invalid }], incoming)?.id).toBe(891);
  });

  it("keeps incomplete-history and ambiguity safeguards unless a valid window proves distinction", () => {
    expect(() => selectGarminHistoryMatch([{ ...existing, distanceKm: null }], { ...incoming, firstTimestamp: undefined })).toThrow(/缺少距離或時間/);
    expect(selectGarminHistoryMatch([{ ...existing, distanceKm: null }], incoming)).toBeNull();
    const overlapping = { ...existing, firstTimestamp: incoming.firstTimestamp, lastTimestamp: incoming.lastTimestamp };
    expect(selectGarminHistoryMatch([existing, overlapping], incoming)?.id).toBe(891);
    expect(() => selectGarminHistoryMatch([{ ...existing, firstTimestamp: undefined }, { ...overlapping, id: 892 }], incoming)).toThrow(/編輯/);
  });

  it("accepts a HK start date across UTC midnight, without requiring the end to be on that date", () => {
    const overnight = { ...incoming, firstTimestamp: "2026-11-12T15:59:00Z", lastTimestamp: "2026-11-12T16:05:00Z" };
    expect(selectGarminHistoryMatch([existing], overnight)).toBeNull();
    const utcPreviousDay = { ...incoming, firstTimestamp: "2026-11-11T23:00:00Z", lastTimestamp: "2026-11-11T23:06:00Z" };
    expect(selectGarminHistoryMatch([existing], utcPreviousDay)).toBeNull();
  });
});

describe("Garmin separated short-run save regressions", () => {
  it("creates a new id for two similar short FIT runs with clearly separate activity windows and leaves record #891 unchanged", async () => {
    const original = linkedShortRun();
    const db = mockDatabase([original]);
    const parsed = shortRunPreview();
    vi.mocked(parseGarminRawFile).mockReturnValue(parsed);
    const result = await saveGarminImport({ ...input, fileName: "2026-11-12_20-36-45_0.83.fit" });
    expect(result).toMatchObject({ action: "created", sampleCount: 361, date: "2026-11-12" });
    expect(result.id).not.toBe(891);
    expect(result.garminDetails).toMatchObject({
      rawActivityFirstTimestamp: parsed.timeSeries[0].timestamp,
      rawActivityLastTimestamp: parsed.timeSeries[360].timestamp,
    });
    expect(db.rows()).toHaveLength(2);
    expect(db.rows()[0]).toEqual(original);
    expect(result.timeSeries).toEqual(parsed.timeSeries);
    expect(db.queries.some(query => query.sql.startsWith("UPDATE"))).toBe(false);
    const history = db.queries.find(query => query.sql.includes("WHERE date ="))!;
    expect(history.sql).toContain("date::text AS date");
    expect(history.sql).toContain("LIMIT 101 FOR UPDATE");
    expect(history.sql).not.toMatch(/, garmin_details[, ]/);
    expect(history.sql).toContain("garmin_details->>'activityWindowVerified' AS activity_window_verified");
    expect(db.queries[1].params).toContain("garmin-date:2026-11-12");
    expect(db.queries.some(query => query.sql.includes("user_id"))).toBe(false);
    expect(writeRowToSheet).toHaveBeenCalledTimes(1);
  });

  it("uses complete verified canonical metadata plus extracted sample endpoints even when JSON is serialised", async () => {
    const original = linkedShortRun({
      time_series: JSON.stringify(linkedShortRun().time_series),
      garmin_details: { ...linkedShortRun().garmin_details, rawActivityFirstTimestamp: "2026-11-12T12:36:45Z", rawActivityLastTimestamp: "2026-11-12T12:42:45Z" },
    });
    const db = mockDatabase([original]);
    vi.mocked(parseGarminRawFile).mockReturnValue(shortRunPreview());
    expect((await saveGarminImport(input)).action).toBe("created");
    expect(db.rows()[0]).toEqual(original);
  });

  it.each([
    ["2026-11-12T11:55:18Z", "2026-11-12T12:01:18Z"],
    ["2026-11-12T11:54:19Z", "2026-11-12T12:00:19Z"],
    ["2026-11-12T11:50:00Z", "2026-11-12T11:56:00Z"],
  ])("blocks near or overlapping different-hash source windows %s to %s with no writes", async (first, last) => {
    const seed = [linkedShortRun()];
    const db = mockDatabase(seed);
    const parsed = shortRunPreview();
    vi.mocked(parseGarminRawFile).mockReturnValue({ ...parsed, timeSeries: timestamps(first, last), garminDetails: { ...parsed.garminDetails, activityStartTimestamp: first, activityEndTimestamp: last } });
    await expect(saveGarminImport(input)).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringMatching(/#891.*previous\.fit.*11:31:20Z.*11:54:19Z.*不同的 Garmin/) });
    expect(db.rows()).toEqual(seed);
    expect(db.queries.some(query => /^(UPDATE|INSERT)/.test(query.sql))).toBe(false);
    expect(writeRowToSheet).not.toHaveBeenCalled();
  });

  it.each([
    [undefined, undefined], ["invalid", "2026-11-12T12:42:45Z"],
    ["2026-11-12T12:36:45Z", "invalid"],
    ["2026-11-12T12:42:45Z", "2026-11-12T12:36:45Z"],
    ["2026-11-11T12:36:45Z", "2026-11-11T12:42:45Z"],
    ["2026-11-12T16:36:45Z", "2026-11-12T16:42:45Z"],
    ["2026-11-12T20:36:45", "2026-11-12T20:42:45"],
  ])("invalid incoming or stored bounds %s to %s cannot enable a new-record bypass", async (first, last) => {
    const seed = [linkedShortRun()];
    const db = mockDatabase(seed);
    vi.mocked(parseGarminRawFile).mockReturnValue({ ...shortRunPreview(), timeSeries: timestamps(first, last) });
    await expect(saveGarminImport(input)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.rows()).toEqual(seed);
    expect(db.queries.some(query => /^(UPDATE|INSERT)/.test(query.sql))).toBe(false);
    const storedSeed = [linkedShortRun({ time_series: timestamps(first, last) })];
    const storedDb = mockDatabase(storedSeed);
    vi.mocked(parseGarminRawFile).mockReturnValue(shortRunPreview());
    await expect(saveGarminImport(input)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(storedDb.rows()).toEqual(storedSeed);
    expect(storedDb.queries.some(query => /^(UPDATE|INSERT)/.test(query.sql))).toBe(false);
    expect(writeRowToSheet).not.toHaveBeenCalled();
  });

  it("identical bytes still deduplicate before timestamp-window matching even when the new parsed time is separated", async () => {
    const original = linkedShortRun({ garmin_details: { ...linkedShortRun().garmin_details, rawFileHash: hash } });
    const db = mockDatabase([original]);
    vi.mocked(parseGarminRawFile).mockReturnValue(shortRunPreview());
    const result = await saveGarminImport({ ...input, fileName: "new-time.fit" });
    expect(result).toMatchObject({ id: 891, action: "duplicate" });
    expect(result.timeSeries).toEqual(original.time_series);
    expect(result.garminDetails).toEqual(original.garmin_details);
    expect(db.rows()).toEqual([original]);
    expect(db.queries.some(query => query.sql.includes("WHERE date =") || /^(UPDATE|INSERT)/.test(query.sql))).toBe(false);
    expect(writeRowToSheet).not.toHaveBeenCalled();
  });

  it("never obtains a missing activity window from filenames, file keys, metadata or extra client fields", async () => {
    const seed = [linkedShortRun()];
    const db = mockDatabase(seed);
    const parsed = { ...shortRunPreview(), timeSeries: [] };
    parsed.garminDetails = { ...parsed.garminDetails, ...{ rawActivityFirstTimestamp: "2026-11-12T12:36:45Z", rawActivityLastTimestamp: "2026-11-12T12:42:45Z" } };
    vi.mocked(parseGarminRawFile).mockReturnValue(parsed);
    const hintedInput = {
      ...input, fileName: "2026-11-12_20-36-45_0.83.fit", fileKey: "garmin-originals/2/2026-11-12_20-36-45.fit",
      firstTimestamp: "2026-11-12T12:36:45Z", lastTimestamp: "2026-11-12T12:42:45Z",
    };
    await expect(saveGarminImport(hintedInput)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.rows()).toEqual(seed);
    expect(db.queries.some(query => /^(UPDATE|INSERT)/.test(query.sql))).toBe(false);
  });

  it("explicit selection cannot overwrite a different source even for clearly separated times; manual fields and curves stay unchanged", async () => {
    const seed = [linkedShortRun()];
    const db = mockDatabase(seed);
    vi.mocked(parseGarminRawFile).mockReturnValue(shortRunPreview());
    await expect(saveGarminImport({ ...input, runningLogId: 891 })).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringMatching(/#891.*previous\.fit.*11:31:20Z.*11:54:19Z.*不同的 Garmin.*未更改資料/) });
    expect(db.rows()).toEqual(seed);
    expect(db.rows()[0]).toMatchObject({ running_shoes: "Manual shoes", shoes_id: 12, notes: "Preserve my race notes", running_type: "Race", weather_source: "manual", garmin_details: { raceId: 22 } });
    expect(db.queries.some(query => /^(UPDATE|INSERT)/.test(query.sql))).toBe(false);
    expect(writeRowToSheet).not.toHaveBeenCalled();
  });
});

// Actual SDK-encoded, in-memory fixtures: no real object storage or DB access.
function fitWindowFixture({
  session: sessionOverrides = {}, recordSeconds = [0, 1379], sessions = 1,
}: { session?: Row; recordSeconds?: Array<number | null>; sessions?: number } = {}) {
  const start = new Date("2026-11-12T11:31:20Z");
  const encoder = new Encoder();
  encoder.onMesg(Profile.MesgNum.FILE_ID, { type: "activity", manufacturer: "development", product: 1, timeCreated: start });
  for (const second of recordSeconds) encoder.onMesg(Profile.MesgNum.RECORD, {
    ...(second !== null ? { timestamp: new Date(start.getTime() + second * 1000) } : {}),
    distance: 810, heartRate: 150,
  });
  for (let index = 0; index < sessions; index += 1) encoder.onMesg(Profile.MesgNum.SESSION, {
    timestamp: start, startTime: start, sport: "running", totalElapsedTime: 1379.276,
    totalTimerTime: 353.941, totalDistance: 810, ...sessionOverrides,
  });
  return Buffer.from(encoder.close());
}

describe("FIT full-session canonical activity-window provenance", () => {
  it("matches real Garmin session.timestamp==start with elapsed end, not paused timer duration", async () => {
    const actualParser = await vi.importActual<typeof import("./garminFileImport")>("./garminFileImport");
    const parsed = actualParser.parseGarminRawFile(fitWindowFixture(), "any-name.fit");
    expect(parsed.fields).toMatchObject({ date: "2026-11-12", distanceKm: "0.81", minutes: "5", second: "54" });
    expect(parsed.garminDetails).toMatchObject({
      activityStartTimestamp: "2026-11-12T11:31:20.000Z", activityEndTimestamp: "2026-11-12T11:54:19.276Z",
      activityWindowVerified: 1, activityTimeBasis: "fit-session-elapsed",
    });
    expect(parsed.timeSeries.at(-1)?.timestamp).toBe("2026-11-12T11:54:19.000Z");
  });

  it("can use session end timestamp only when elapsed is absent and complete record bounds agree", async () => {
    const actualParser = await vi.importActual<typeof import("./garminFileImport")>("./garminFileImport");
    const parsed = actualParser.parseGarminRawFile(fitWindowFixture({ session: {
      totalElapsedTime: undefined, timestamp: new Date("2026-11-12T11:54:19Z"),
    } }), "fallback.fit");
    expect(parsed.garminDetails).toMatchObject({ activityWindowVerified: 1, activityTimeBasis: "fit-session-timestamp", activityEndTimestamp: "2026-11-12T11:54:19.000Z" });
  });

  it.each([
    { recordSeconds: [6, 1379] }, { recordSeconds: [0, 1373] },
    { recordSeconds: [0, 1379, 1000] }, { recordSeconds: [0, -1, 1379] },
    { recordSeconds: [0, 1380] }, { recordSeconds: [0, null, 1379] },
    { recordSeconds: [0] }, { recordSeconds: [] }, { sessions: 2 },
    { session: { sport: "cycling" } }, { session: { startTime: undefined } },
    { session: { totalElapsedTime: 0 } },
    { session: { totalElapsedTime: undefined } },
    { session: { totalElapsedTime: 1000 } },
    { session: { timestamp: new Date("2026-11-12T11:40:00Z") } },
    { session: { totalElapsedTime: undefined, timestamp: new Date("2026-11-12T11:31:10Z") } },
  ])("does not verify partial, multisession, invalid or contradictory fixture %o", async options => {
    const actualParser = await vi.importActual<typeof import("./garminFileImport")>("./garminFileImport");
    const parsed = actualParser.parseGarminRawFile(fitWindowFixture(options), "2026-11-12_20-36-45.fit");
    expect(parsed.garminDetails.activityWindowVerified).toBe(0);
  });

  it("allows only the conservative five-second completeness margin and never changes the first-record HK date", async () => {
    const actualParser = await vi.importActual<typeof import("./garminFileImport")>("./garminFileImport");
    const parsed = actualParser.parseGarminRawFile(fitWindowFixture({ recordSeconds: [5, 1375] }), "complete.fit");
    expect(parsed.garminDetails.activityWindowVerified).toBe(1);
    const mismatch = actualParser.parseGarminRawFile(fitWindowFixture({
      session: { startTime: new Date("2026-11-12T15:59:59Z"), totalElapsedTime: 3, timestamp: new Date("2026-11-12T15:59:59Z") },
      recordSeconds: [16121, 16122],
    }), "midnight.fit");
    expect(mismatch.fields.date).toBe("2026-11-13");
    expect(mismatch.garminDetails.activityWindowVerified).toBe(0);
  });
});

describe("Legacy Garmin source revalidation and permanent conflict guards", () => {
  const legacy = (overrides: Row = {}) => linkedShortRun({
    garmin_details: {
      rawFileName: "previous.fit", rawFileFormat: "FIT", rawFileKey: "garmin-originals/2/previous_12345678.fit",
      rawFileHash: createHash("sha256").update(fitWindowFixture()).digest("hex"), customMetric: "keep", raceId: 22,
    }, ...overrides,
  });
  const useActualLegacyParser = async () => {
    const actualParser = await vi.importActual<typeof import("./garminFileImport")>("./garminFileImport");
    vi.mocked(parseGarminRawFile).mockImplementation((buffer, filename) => buffer === bytes ? shortRunPreview() : actualParser.parseGarminRawFile(buffer, filename));
  };

  it("safely reparses a close legacy source after hash validation and creates a distinct record without rewriting legacy metadata", async () => {
    const seed = [legacy()];
    const db = mockDatabase(seed);
    const source = fitWindowFixture();
    vi.mocked(storageReadBuffer).mockImplementation(async key => key === input.fileKey ? bytes : source);
    await useActualLegacyParser();
    const result = await saveGarminImport(input);
    expect(result.action).toBe("created");
    expect(result.id).not.toBe(891);
    expect(storageReadBuffer).toHaveBeenCalledWith(seed[0].garmin_details.rawFileKey);
    expect(db.rows()[0]).toEqual(seed[0]);
    expect(db.queries.some(query => query.sql.startsWith("UPDATE"))).toBe(false);
  });

  it.each(["storage", "hash", "partial", "multisession", "parser", "missing-key", "invalid-hash"])("keeps legacy source uncertain on %s failure with no writes", async failure => {
    const partialSource = fitWindowFixture({ recordSeconds: [60, 1300] });
    const multiSource = fitWindowFixture({ sessions: 2 });
    const source = failure === "partial" ? partialSource : failure === "multisession" ? multiSource : fitWindowFixture();
    const row = legacy();
    if (failure === "partial" || failure === "multisession") row.garmin_details.rawFileHash = createHash("sha256").update(source).digest("hex");
    if (failure === "missing-key") delete row.garmin_details.rawFileKey;
    if (failure === "invalid-hash") row.garmin_details.rawFileHash = "invalid";
    const db = mockDatabase([row]);
    vi.mocked(storageReadBuffer).mockImplementation(async key => {
      if (key === input.fileKey) return bytes;
      if (failure === "storage") throw new Error("storage unavailable");
      return failure === "hash" ? Buffer.from("wrong bytes") : source;
    });
    await useActualLegacyParser();
    if (failure === "parser") vi.mocked(parseGarminRawFile).mockImplementation(buffer => {
      if (buffer === bytes) return shortRunPreview();
      throw new Error("invalid FIT");
    });
    await expect(saveGarminImport(input)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.rows()).toEqual([row]);
    expect(db.queries.some(query => /^(UPDATE|INSERT)/.test(query.sql))).toBe(false);
    expect(writeRowToSheet).not.toHaveBeenCalled();
  });

  it("does not treat legacy sample endpoints alone as complete-session verification", async () => {
    const original = legacy();
    delete original.garmin_details.rawFileKey;
    const db = mockDatabase([original]);
    vi.mocked(parseGarminRawFile).mockReturnValue(shortRunPreview());
    await expect(saveGarminImport(input)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.rows()).toEqual([original]);
    expect(storageReadBuffer).toHaveBeenCalledTimes(1);
  });

  it("never reads nonmatching summaries and bounds legacy source reads to twenty", async () => {
    const seed = Array.from({ length: 22 }, (_, index) => legacy({ id: index + 1 }));
    seed.push(legacy({ id: 50, distance_km: 9 }));
    const db = mockDatabase(seed);
    vi.mocked(storageReadBuffer).mockImplementation(async key => key === input.fileKey ? bytes : fitWindowFixture());
    await useActualLegacyParser();
    await expect(saveGarminImport(input)).rejects.toThrow(/編輯/);
    expect(storageReadBuffer).toHaveBeenCalledTimes(21);
    expect(db.rows()).toEqual(seed);
    expect(db.queries.some(query => /^(UPDATE|INSERT)/.test(query.sql))).toBe(false);
  });

  it.each([
    { garmin_details: { rawFileKey: "garmin-originals/2/legacy.fit", rawFileName: "legacy.fit" }, time_series: [] },
    { garmin_details: {}, time_series: timestamps("2026-11-12T11:31:20Z", "2026-11-12T11:54:19Z") },
  ])("protects existing raw source or curves without a hash, including explicit edit: %o", overrides => {
    const seed = [linkedShortRun(overrides)];
    const db = mockDatabase(seed);
    vi.mocked(parseGarminRawFile).mockReturnValue(shortRunPreview());
    return (async () => {
      await expect(saveGarminImport(input)).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(saveGarminImport({ ...input, runningLogId: 891 })).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("#891") });
      expect(db.rows()).toEqual(seed);
      expect(db.queries.some(query => /^(UPDATE|INSERT)/.test(query.sql))).toBe(false);
    })();
  });

  it("unverified incoming canonical metadata cannot bypass a linked history even with clearly separated samples", async () => {
    const seed = [linkedShortRun()];
    const db = mockDatabase(seed);
    const parsed = shortRunPreview();
    parsed.garminDetails.activityWindowVerified = 0;
    vi.mocked(parseGarminRawFile).mockReturnValue(parsed);
    await expect(saveGarminImport(input)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.rows()).toEqual(seed);
  });
});
