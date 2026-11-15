import { beforeEach, describe, expect, it, vi } from "vitest";
import { prepareGarminGpsWeather } from "./garminGpsWeather";
import { fetchRunningGpsWeather } from "./runningGpsWeather";
import type { parseGarminRawFile } from "./garminFileImport";
vi.mock("./runningGpsWeather", () => ({ fetchRunningGpsWeather: vi.fn() }));
type Preview = ReturnType<typeof parseGarminRawFile>;
const preview = (): Preview => ({ sourceFormat: "FIT", fields: { temperature: "32" }, garminDetails: { avgTemperatureC: 32 }, laps: [], timeSeries: [{ elapsedSec: 0, timestamp: "2026-11-01T22:00:00Z", latitude: 22.3, longitude: 114.2 }], warnings: [] });
const result = () => ({ status: "complete" as const, observation: { temperature: 0, humidity: null, windSpeed: 0, apparentTemp: null, precipitation: 0, weatherCode: 0, weatherCondition: "晴朗", weatherLocation: "GPS 路線", weatherObservedAt: "2026-11-02T06:00:00+08:00", weatherSource: "Open-Meteo 時間加權" }, provenance: { version: 1, coverageFraction: 1 } });
beforeEach(() => { vi.resetAllMocks(); });
describe("best-effort GPS weather enrichment", () => {
  it("does not call the provider for a source without GPS", async () => {
    const p = preview(); p.timeSeries = [{ elapsedSec: 0, timestamp: "2026-11-01T22:00:00Z" }];
    expect(await prepareGarminGpsWeather(p)).toEqual({ fields: {}, metadata: {} });
    expect(fetchRunningGpsWeather).not.toHaveBeenCalled();
  });
  it("preserves real weather zeros, leaves unknown humidity blank and retains device data unchanged", async () => {
    vi.mocked(fetchRunningGpsWeather).mockResolvedValue(result() as Awaited<ReturnType<typeof fetchRunningGpsWeather>>);
    const p = preview(); const before = structuredClone(p);
    const e = await prepareGarminGpsWeather(p);
    expect(e.fields.temperature).toBe("0"); expect(e.fields.windSpeed).toBe("0"); expect(e.fields.weatherCode).toBe("0");
    expect(e.fields.humidity).toBeUndefined(); expect(p).toEqual(before); expect(p.garminDetails.avgTemperatureC).toBe(32);
  });
  it("never replaces an imported manually sourced weather group", async () => {
    vi.mocked(fetchRunningGpsWeather).mockResolvedValue(result() as Awaited<ReturnType<typeof fetchRunningGpsWeather>>);
    const p = preview(); p.fields.weatherSource = "manual";
    expect((await prepareGarminGpsWeather(p)).fields).toEqual({});
  });
  it("keeps partial or unknown estimates out of saved summary fields", async () => {
    vi.mocked(fetchRunningGpsWeather).mockResolvedValue({ ...result(), status: "partial" } as Awaited<ReturnType<typeof fetchRunningGpsWeather>>);
    const e = await prepareGarminGpsWeather(preview()); expect(e.fields).toEqual({}); expect(e.metadata.gpsWeatherStatus).toBe("partial");
  });
  it("provider failure cannot prevent a valid Garmin source save", async () => {
    vi.mocked(fetchRunningGpsWeather).mockRejectedValue(new Error("temporary provider failure"));
    const e = await prepareGarminGpsWeather(preview()); expect(e.fields).toEqual({}); expect(e.metadata.gpsWeatherStatus).toBe("unknown");
  });
});
