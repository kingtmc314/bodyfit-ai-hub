import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { loadRunningGpsWeatherForId } from "./runningGpsWeatherRepository";
import { getDb } from "./db";
import { fetchRunningGpsWeather } from "./runningGpsWeather";
import { storageReadBuffer } from "./storage";
import { parseGarminRawFile } from "./garminFileImport";
vi.mock("./db", () => ({ getDb: vi.fn() }));
vi.mock("./runningGpsWeather", () => ({ fetchRunningGpsWeather: vi.fn() }));
vi.mock("./storage", () => ({ storageReadBuffer: vi.fn() }));
vi.mock("./garminFileImport", () => ({ parseGarminRawFile: vi.fn() }));
const bytes = Buffer.from("owned real-source bytes for test only");
const hash = createHash("sha256").update(bytes).digest("hex");
const row = () => ({ id: 891, garmin_details: { rawFileKey: "garmin-originals/2/source.fit", rawFileHash: hash }, time_series: [{ timestamp: "2026-11-02T06:00:00+08:00", latitude: 22.3, longitude: 114.2 }] });
const parsed = () => ({ sourceFormat: "FIT" as const, fields: {}, garminDetails: { activityWindowVerified: 1, activityStartTimestamp: "2026-11-02T06:00:00+08:00", activityEndTimestamp: "2026-11-02T07:00:00+08:00" }, laps: [], warnings: [], timeSeries: [{ timestamp: "2026-11-02T06:00:00+08:00", elapsedSec: 0, latitude: 22.3, longitude: 114.2 }] });
const dialect = new PgDialect();
let execute: ReturnType<typeof vi.fn>;
beforeEach(() => { vi.resetAllMocks(); execute = vi.fn(async (statement: SQL) => { const q = dialect.sqlToQuery(statement); expect(q.sql).toMatch(/^SELECT id, garmin_details, time_series FROM running_logs WHERE id = \$1 LIMIT 1$/); expect(q.params).toEqual([891]); return { rows: [row()] }; }); vi.mocked(getDb).mockResolvedValue({ execute } as unknown as NonNullable<Awaited<ReturnType<typeof getDb>>>); vi.mocked(storageReadBuffer).mockResolvedValue(bytes); vi.mocked(parseGarminRawFile).mockReturnValue(parsed()); });
describe("GPS weather repository never writes existing runs", () => {
  it("selects only a single run and re-verifies a legacy owned hash source without UPDATE", async () => {
    await loadRunningGpsWeatherForId(891); expect(execute).toHaveBeenCalledOnce(); expect(storageReadBuffer).toHaveBeenCalledWith("garmin-originals/2/source.fit"); expect(fetchRunningGpsWeather).toHaveBeenCalledWith({ timeSeries: parsed().timeSeries, garminDetails: parsed().garminDetails });
  });
  it("hash mismatch does not trust or parse a replaced source", async () => {
    vi.mocked(storageReadBuffer).mockResolvedValue(Buffer.from("wrong bytes")); await loadRunningGpsWeatherForId(891); expect(parseGarminRawFile).not.toHaveBeenCalled(); expect(fetchRunningGpsWeather).toHaveBeenCalledWith({ timeSeries: row().time_series, garminDetails: row().garmin_details });
  });
  it("does not read another owner source and leaves saved metadata unchanged", async () => {
    const r = row(); r.garmin_details.rawFileKey = "garmin-originals/9/source.fit"; execute.mockResolvedValue({ rows: [r] }); const before = structuredClone(r); await loadRunningGpsWeatherForId(891); expect(storageReadBuffer).not.toHaveBeenCalled(); expect(r).toEqual(before);
  });
  it("verified metadata needs no source re-read", async () => {
    execute.mockResolvedValue({ rows: [{ ...row(), garmin_details: { ...row().garmin_details, activityWindowVerified: 1 } }] }); await loadRunningGpsWeatherForId(891); expect(storageReadBuffer).not.toHaveBeenCalled();
  });
  it("unavailable source remains a non-destructive unknown lookup", async () => {
    vi.mocked(storageReadBuffer).mockRejectedValue(new Error("source unavailable")); await loadRunningGpsWeatherForId(891); expect(fetchRunningGpsWeather).toHaveBeenCalledWith({ timeSeries: row().time_series, garminDetails: row().garmin_details });
  });
  it("does not fetch weather for a missing run", async () => {
    execute.mockResolvedValue({ rows: [] }); await expect(loadRunningGpsWeatherForId(891)).rejects.toMatchObject({ code: "NOT_FOUND" }); expect(fetchRunningGpsWeather).not.toHaveBeenCalled();
  });
});
