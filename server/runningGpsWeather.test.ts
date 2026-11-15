import { describe, expect, it, vi } from "vitest";
import {
  deriveRunningGpsWeatherPlan, fetchRunningGpsWeather, parseRunningGpsTimestamp,
  type RunningGpsWeatherCache,
} from "./runningGpsWeather";
import type { RunningGpsWeatherInput } from "../shared/runningGpsWeather";

const START = Date.parse("2026-10-01T10:00:00+08:00");
const NOW = new Date("2026-11-15T12:00:00+08:00");
const iso = (t: number) => new Date(t).toISOString();
const hk = (t: number) => new Date(t + 8 * 3_600_000).toISOString().slice(0, 16);
const sample = (seconds: number, latitude = 22.3, longitude = 114.17, start = START) => ({ elapsedSec: seconds, timestamp: iso(start + seconds * 1000), latitude, longitude });
function input(samples: unknown[], start = START, duration = 120): RunningGpsWeatherInput {
  return { timeSeries: samples, activityWindow: { startTimestamp: iso(start), endTimestamp: iso(start + duration * 1000), verified: true } };
}
function route(duration: number, step: number, coordinate: (seconds: number) => [number, number] = () => [22.3, 114.17], start = START) {
  return Array.from({ length: Math.floor(duration / step) + 1 }, (_, i) => sample(i * step, ...coordinate(i * step), start));
}
type Hour = { temperature_2m: number | null; relative_humidity_2m: number | null; apparent_temperature: number | null; wind_speed_10m: number | null; precipitation: number | null; weather_code: number | null };
const ZERO: Hour = { temperature_2m: 0, relative_humidity_2m: 0, apparent_temperature: 0, wind_speed_10m: 0, precipitation: 0, weather_code: 0 };
const NORMAL: Hour = { temperature_2m: 20, relative_humidity_2m: 60, apparent_temperature: 21, wind_speed_10m: 5, precipitation: 0, weather_code: 1 };
function provider(fn: (time: string, url: URL) => Partial<Hour> = () => NORMAL) {
  return vi.fn(async (raw: string | URL | Request) => {
    const url = new URL(String(raw)), first = Date.parse(`${url.searchParams.get("start_date")}T00:00:00+08:00`), last = Date.parse(`${url.searchParams.get("end_date")}T00:00:00+08:00`) + 24 * 3_600_000;
    const time: string[] = [], rows: Partial<Hour>[] = [];
    for (let t = first; t < last; t += 3_600_000) { time.push(hk(t)); rows.push(fn(hk(t), url)); }
    const hourly: Record<string, unknown> = { time };
    for (const key of Object.keys(NORMAL)) hourly[key] = rows.map(row => row[key as keyof Hour] ?? null);
    return new Response(JSON.stringify({ timezone: "Asia/Hong_Kong", utc_offset_seconds: 28800, hourly,
      hourly_units: { temperature_2m: "°C", apparent_temperature: "°C", relative_humidity_2m: "%", wind_speed_10m: "km/h", precipitation: "mm" } }), { status: 200 });
  }) as unknown as ReturnType<typeof vi.fn> & typeof fetch;
}

describe("GPS weather bounded route planner", () => {
  it("strictly validates offsets and calendar dates independent of server TZ", () => {
    expect(parseRunningGpsTimestamp("2026-10-01T10:00:00+08:00")).toBe(START);
    expect(parseRunningGpsTimestamp("2026-10-01T02:00Z")).toBe(START);
    for (const value of ["2026-10-01T10:00:00", "2026-02-30T10:00:00Z", "2026-04-31T10:00Z", "2026-10-01T24:00Z", "2026-10-01T10:60Z", "2026-10-01T10:00+14:30", "2026-10-01", null, 0, NaN]) expect(parseRunningGpsTimestamp(value)).toBeNull();
  });
  it("has no guessed 07:00 or Hong Kong default and supports real GPX sample bounds", () => {
    const unknown = deriveRunningGpsWeatherPlan({ timeSeries: [{ elapsedSec: 0, latitude: 22.3, longitude: 114.17 }, { elapsedSec: 120, latitude: 22.3, longitude: 114.17 }] });
    expect(unknown.batches).toEqual([]);
    expect(unknown.provenance.intervalStartHK).toBeNull();
    const gpx = deriveRunningGpsWeatherPlan({ timeSeries: [sample(0), sample(120)], garminDetails: { sourceFormat: "GPX" } });
    expect(gpx.provenance.timeBasis).toBe("timestamped-sample-bounds");
    expect(gpx.provenance.intervalStartHK).toBe("2026-10-01T10:00:00.000+08:00");
    expect(gpx.provenance.totalSeconds).toBe(120);
    expect(deriveRunningGpsWeatherPlan({ timeSeries: [sample(0), sample(120)], garminDetails: { sourceFormat: "FIT", activityWindowVerified: 0 } }).batches).toEqual([]);
  });
  it("uses verified details and clamps actual samples to the measured window", () => {
    const plan = deriveRunningGpsWeatherPlan({ timeSeries: [sample(-60), sample(0), sample(60), sample(120), sample(180)], garminDetails: { sourceFormat: "FIT", activityWindowVerified: 1, activityStartTimestamp: iso(START + 30_000), activityEndTimestamp: iso(START + 90_000) } });
    expect(plan.provenance.timeBasis).toBe("verified-activity-window");
    expect(plan.provenance.observedRouteSeconds).toBe(60);
    expect(plan.provenance.totalSeconds).toBe(60);
    expect(plan.segments.reduce((a, b) => a + b.seconds, 0)).toBeCloseTo(60);
  });
  it("sorts chronology, deduplicates time without density weighting, rejects conflicting duplicates", () => {
    const plan = deriveRunningGpsWeatherPlan(input([sample(120), sample(0), sample(60), sample(60)]));
    expect(plan.provenance.observedRouteSeconds).toBe(120);
    const conflicting = deriveRunningGpsWeatherPlan(input([sample(0), sample(60), sample(60, 22.31), sample(120)]));
    expect(conflicting.provenance.observedRouteSeconds).toBe(0);
  });
  it("preserves valid equator/meridian zero, rejects null-island, nulls, NaN and out-of-bounds", () => {
    for (const [lat, lon] of [[0, 30], [30, 0], [90, 180], [-90, -180]]) {
      expect(deriveRunningGpsWeatherPlan(input([sample(0, lat, lon), sample(120, lat, lon)])).provenance.observedRouteSeconds).toBe(120);
    }
    for (const [lat, lon] of [[0, 0], [null, 10], [10, null], [NaN, 20], [91, 20], [20, 181]]) {
      const points = [0, 120].map(t => ({ ...sample(t), latitude: lat, longitude: lon }));
      expect(deriveRunningGpsWeatherPlan(input(points)).provenance.observedRouteSeconds).toBe(0);
    }
  });
  it("never bridges missing GPS, missing timestamps, sparse gaps, or implausible jumps", () => {
    const missingGps = deriveRunningGpsWeatherPlan(input([sample(0), { ...sample(60), latitude: null }, sample(120)]));
    expect(missingGps.provenance.observedRouteSeconds).toBe(0);
    const missingTimestamp = deriveRunningGpsWeatherPlan(input([sample(0), { latitude: 22.3, longitude: 114.17 }, sample(120)]));
    expect(missingTimestamp.provenance.observedRouteSeconds).toBe(0);
    const sparse = deriveRunningGpsWeatherPlan(input([sample(0), sample(60), sample(600), sample(660)], START, 660));
    expect(sparse.provenance.observedRouteSeconds).toBe(120);
    const jump = deriveRunningGpsWeatherPlan(input([sample(0), sample(120, 24, 116)]));
    expect(jump.provenance.observedRouteSeconds).toBe(0);
  });
  it("splits all observed route intervals at cells and hours including crossing midnight", () => {
    const start = Date.parse("2026-10-01T23:30:00+08:00");
    const plan = deriveRunningGpsWeatherPlan(input(route(7200, 120, t => [22.3, 114.15 + t / 7200 * 0.05], start), start, 7200));
    expect(plan.provenance.observedRouteSeconds).toBe(7200);
    expect(new Set(plan.segments.map(s => s.cellId)).size).toBeGreaterThan(2);
    expect(new Set(plan.segments.map(s => s.hourHK))).toEqual(new Set(["2026-10-01T23:00", "2026-10-02T00:00", "2026-10-02T01:00"]));
    expect(plan.batches.some(b => b.startDate === "2026-10-01" && b.endDate === "2026-10-02")).toBe(true);
    expect(plan.segments[0].hourHK).toBe("2026-10-01T23:00");
    expect(plan.segments.at(-1)?.hourHK).toBe("2026-10-02T01:00");
  });
  it("spatial limit spreads batches across the full route without claiming missing coverage", () => {
    const plan = deriveRunningGpsWeatherPlan(input(route(7200, 120, t => [22.3, 114.0 + t / 7200 * 0.4]), START, 7200), { maxBatches: 3 });
    expect(plan.provenance.plannedCellDayBatches).toBeGreaterThan(20);
    expect(plan.batches).toHaveLength(3);
    expect(plan.batches[0].cellId).toBe(plan.segments[0].cellId);
    expect(plan.batches.at(-1)?.cellId).toBe(plan.segments.at(-1)?.cellId);
    expect(plan.provenance.observedRouteSeconds).toBe(7200);
  });
  it("takes shortest antimeridian path instead of inventing a worldwide route", () => {
    const plan = deriveRunningGpsWeatherPlan(input([sample(0, 0, 179.999), sample(120, 0, -179.999)]));
    expect(plan.provenance.observedRouteSeconds).toBe(120);
    expect(plan.batches.length).toBeLessThanOrEqual(2);
    expect(plan.batches.every(b => Math.abs(b.longitude) > 179)).toBe(true);
  });
});

describe("GPS weather fetch and aggregation", () => {
  it("preserves real zero values and uses official timezone/units and archive for older days", async () => {
    const mock = provider(() => ZERO);
    const result = await fetchRunningGpsWeather(input([sample(0), sample(120)]), { fetch: mock, now: NOW });
    expect(result.status).toBe("complete");
    expect(result.observation).toMatchObject({ temperature: 0, humidity: 0, apparentTemp: 0, windSpeed: 0, precipitation: 0, weatherCode: 0, weatherCondition: "晴朗" });
    expect(result.provenance.coverageFraction).toBe(1);
    expect(result.provenance.precipitationMeanRateMmPerHour).toBe(0);
    const url = new URL(String(mock.mock.calls[0][0]));
    expect(url.host).toBe("archive-api.open-meteo.com");
    expect(url.searchParams.get("timezone")).toBe("Asia/Hong_Kong");
    expect(url.searchParams.get("wind_speed_unit")).toBe("kmh");
    expect(url.searchParams.get("precipitation_unit")).toBe("mm");
    expect(result.observation?.weatherLocation).toContain("GPS位置");
    expect(result.observation?.weatherLocation).not.toContain("香港");
    expect(JSON.stringify(result)).not.toContain('"latitude"');
    expect(JSON.stringify(result)).not.toContain('"timestamp"');
  });
  it("time weights >1hr midnight/cross-cell route and aligns rain with the PRECEDING hour", async () => {
    const start = Date.parse("2026-10-01T23:30:00+08:00");
    const mock = provider(time => ({ ...NORMAL,
      temperature_2m: time.endsWith("23:00") ? 0 : time.endsWith("00:00") ? 10 : 30,
      weather_code: time.endsWith("23:00") ? 0 : 61,
      precipitation: time.endsWith("00:00") ? 2 : time.endsWith("01:00") ? 4 : time.endsWith("02:00") ? 6 : 100,
    }));
    const result = await fetchRunningGpsWeather(input(route(7200, 120, t => [22.3, 114.15 + t / 7200 * 0.05], start), start, 7200), { fetch: mock, now: NOW });
    expect(result.status).toBe("complete");
    // 30min at 0C, 60min at 10C, 30min at 30C, irrespective of spatial cells.
    expect(result.observation?.temperature).toBeCloseTo(12.5);
    expect(result.observation?.precipitation).toBeCloseTo(8); // 2*.5 + 4*1 + 6*.5
    expect(result.provenance.precipitationMeanRateMmPerHour).toBeCloseTo(4);
    expect(result.observation?.weatherCode).toBe(61); // categorical, not arithmetic
    expect(result.provenance.conditions.find(c => c.code === 61)?.seconds).toBeCloseTo(5400);
    expect(result.provenance.mixedConditions).toBe(true);
    expect(result.observation?.weatherCondition).toContain("混合");
    expect(result.provenance.providerTimeStartHK).toBe("2026-10-01T23:00:00+08:00");
    expect(result.provenance.providerTimeEndHK).toBe("2026-10-02T02:00:00+08:00");
  });
  it("does not give dense 1Hz GPS a larger weight than sparse real intervals", async () => {
    const points = [...route(3600, 1), ...route(3600, 120).slice(1).map(p => ({ ...p, timestamp: iso(Date.parse(p.timestamp) + 3_600_000), elapsedSec: p.elapsedSec + 3600 }))];
    const mock = provider(time => ({ ...NORMAL, temperature_2m: time.endsWith("10:00") ? 0 : 30 }));
    const result = await fetchRunningGpsWeather(input(points, START, 7200), { fetch: mock, now: NOW });
    expect(result.status).toBe("complete"); expect(result.observation?.temperature).toBe(15);
  });
  it("weights cell dwell time rather than a midpoint coordinate or mean of GPS samples", async () => {
    const points = route(600, 120).concat(route(1800, 120, t => [22.3, 114.17 + Math.min(t, 600) / 600 * 0.03]).slice(1).map(p => ({ ...p, elapsedSec: p.elapsedSec + 600, timestamp: iso(Date.parse(p.timestamp) + 600_000) })));
    const activity = input(points, START, 2400), plan = deriveRunningGpsWeatherPlan(activity);
    const latitude = plan.batches[0].latitude, longitude = plan.batches[0].longitude;
    const expected = plan.segments.reduce((sum, s) => sum + (s.latitude === latitude && s.longitude === longitude ? 0 : 30) * s.seconds, 0) / 2400;
    const result = await fetchRunningGpsWeather(activity, { fetch: provider((_time, url) => ({ ...NORMAL, temperature_2m: Number(url.searchParams.get("latitude")) === latitude && Number(url.searchParams.get("longitude")) === longitude ? 0 : 30 })), now: NOW });
    expect(result.status).toBe("complete"); expect(result.observation?.temperature).toBeCloseTo(expected, 5);
    expect(result.observation?.temperature).not.toBe(30);
  });
  it("keeps null unknown, uses per-metric coverage, and does not fake full accumulation", async () => {
    const mock = provider(time => ({ ...ZERO, humidity: undefined, relative_humidity_2m: null, wind_speed_10m: time.endsWith("10:00") ? null : 0, precipitation: null }));
    const result = await fetchRunningGpsWeather(input(route(7200, 120), START, 7200), { fetch: mock, now: NOW });
    expect(result.status).toBe("partial");
    expect(result.observation).toMatchObject({ temperature: 0, humidity: null, windSpeed: 0, precipitation: null });
    expect(result.provenance.metricCoveredSeconds.windSpeed).toBe(3600);
    expect(result.provenance.metricCoveredSeconds.temperature).toBe(7200);
    expect(result.provenance.coveredSeconds).toBe(0);
  });
  it("rejects negative wind/rain and NaN/string values without coercing null to zero", async () => {
    const mock = provider(() => ({ ...NORMAL, wind_speed_10m: -1, precipitation: -1, temperature_2m: null, relative_humidity_2m: 101 }));
    const result = await fetchRunningGpsWeather(input([sample(0), sample(120)]), { fetch: mock, now: NOW });
    expect(result.status).toBe("partial");
    expect(result.observation).toMatchObject({ temperature: null, humidity: null, windSpeed: null, precipitation: null });
  });
  it("reports missing GPS span, failed APIs and capped batches honestly", async () => {
    const gap = await fetchRunningGpsWeather(input([sample(0), sample(120), sample(600), sample(720)], START, 720), { fetch: provider(), now: NOW });
    expect(gap.status).toBe("partial"); expect(gap.provenance.coveredSeconds).toBe(240); expect(gap.provenance.coverageFraction).toBeCloseTo(1 / 3);
    const activity = input(route(7200, 120, t => [22.3, 114.0 + t / 7200 * 0.4]), START, 7200);
    const limited = await fetchRunningGpsWeather(activity, { fetch: provider(), now: NOW, maxBatches: 3 });
    expect(limited.status).toBe("partial"); expect(limited.provenance.requestsMade).toBe(3); expect(limited.provenance.failedSegments).toBeGreaterThan(0);
    const failure = await fetchRunningGpsWeather(input([sample(0), sample(120)]), { fetch: vi.fn(async () => { throw new Error("provider down"); }), now: NOW });
    expect(failure.status).toBe("unknown"); expect(failure.observation).toBeNull(); expect(failure.provenance.coverageFraction).toBe(0);
  });
  it("retains exact valid weights when one route cell fails or one provider hour is missing", async () => {
    const activity = input(route(2400, 120, t => [22.3, 114.17 + t / 2400 * 0.06]), START, 2400);
    const plan = deriveRunningGpsWeatherPlan(activity), failed = plan.batches[1];
    const expected = plan.segments.filter(s => s.batchKey !== failed.key).reduce((sum, s) => sum + s.seconds, 0);
    const base = provider();
    const mock = vi.fn(async (raw: string | URL | Request) => {
      const url = new URL(String(raw));
      if (Number(url.searchParams.get("latitude")) === failed.latitude && Number(url.searchParams.get("longitude")) === failed.longitude) return new Response("{}", { status: 503 });
      return base(raw);
    }) as unknown as typeof fetch;
    const result = await fetchRunningGpsWeather(activity, { fetch: mock, now: NOW });
    expect(result.status).toBe("partial"); expect(result.provenance.coveredSeconds).toBeCloseTo(expected, 5);
    expect(result.observation?.temperature).toBe(20);
    const missingHour = vi.fn(async (raw: string | URL | Request) => {
      const payload = await (await base(raw)).json();
      const index = payload.hourly.time.indexOf("2026-10-01T11:00");
      for (const key of Object.keys(payload.hourly)) payload.hourly[key].splice(index, 1);
      return new Response(JSON.stringify(payload));
    }) as unknown as typeof fetch;
    const partial = await fetchRunningGpsWeather(input(route(7200, 120), START, 7200), { fetch: missingHour, now: NOW });
    expect(partial.status).toBe("partial"); expect(partial.provenance.metricCoveredSeconds.temperature).toBe(3600);
    expect(partial.provenance.metricCoveredSeconds.precipitation).toBe(3600);
    expect(partial.provenance.coveredSeconds).toBe(0); // different missing intervals cannot manufacture full coverage
  });
  it("uses official recent historical forecast and today's forecast, with bounded fallback", async () => {
    const recent = Date.parse("2026-11-14T10:00+08:00"), today = Date.parse("2026-11-15T10:00+08:00");
    const base = provider();
    const mock = vi.fn(async (raw: string | URL | Request, init?: RequestInit) => {
      if (new URL(String(raw)).host === "historical-forecast-api.open-meteo.com") return new Response("{}", { status: 503 });
      return base(raw, init);
    }) as unknown as typeof fetch;
    const result = await fetchRunningGpsWeather(input([sample(0, 22.3, 114.17, recent), sample(120, 22.3, 114.17, recent)], recent), { fetch: mock, now: NOW });
    expect(result.status).toBe("complete"); expect(result.provenance.requestsMade).toBe(2); expect(result.provenance.source).toEqual(["forecast"]);
    const todayMock = provider();
    await fetchRunningGpsWeather(input([sample(0, 22.3, 114.17, today), sample(120, 22.3, 114.17, today)], today), { fetch: todayMock, now: NOW });
    expect(new URL(String(todayMock.mock.calls[0][0])).host).toBe("api.open-meteo.com");
  });
  it("does not choose nearest hour from the wrong date, unexpected timezone or units", async () => {
    for (const change of [
      { hourly: { time: ["2026-09-30T10:00"], temperature_2m: [20] } },
      { utc_offset_seconds: 0 },
      { hourly_units: { wind_speed_10m: "mph" } },
      { hourly: { time: ["2026-10-01T10:00", "2026-10-01T10:00"], temperature_2m: [20, 20] } },
    ]) {
      const base = provider();
      const mock = vi.fn(async (raw: string | URL | Request) => {
        const response = await base(raw); return new Response(JSON.stringify({ ...await response.json(), ...change }));
      }) as unknown as typeof fetch;
      expect((await fetchRunningGpsWeather(input([sample(0), sample(120)]), { fetch: mock, now: NOW })).status).toBe("unknown");
    }
  });
  it("never requests invalid/future dates or overly long windows", async () => {
    const mock = provider();
    const future = input([sample(0), sample(120)], START, 120); future.activityWindow!.endTimestamp = "2027-01-01T10:00Z";
    const invalid = input([sample(0), sample(120)]); invalid.activityWindow!.startTimestamp = "2026-02-30T10:00Z";
    for (const activity of [future, invalid, input([sample(0), sample(120)], START, 8 * 86400)]) {
      expect((await fetchRunningGpsWeather(activity, { fetch: mock, now: NOW })).status).toBe("unknown");
    }
    const nextDay = Date.parse("2026-11-16T10:00+08:00");
    expect((await fetchRunningGpsWeather(input([sample(0, 22.3, 114.17, nextDay), sample(120, 22.3, 114.17, nextDay)], nextDay), { fetch: mock, now: NOW })).status).toBe("unknown");
    expect(mock).not.toHaveBeenCalled();
  });
  it("uses bounded cache and respects maximum requests including fallbacks", async () => {
    const cache: RunningGpsWeatherCache = new Map(), mock = provider(), activity = input([sample(0), sample(120)]);
    const first = await fetchRunningGpsWeather(activity, { fetch: mock, now: NOW, cache });
    const second = await fetchRunningGpsWeather(activity, { fetch: mock, now: NOW, cache });
    expect(first.provenance.requestsMade).toBe(1); expect(second.provenance.requestsMade).toBe(0); expect(second.provenance.cacheHits).toBe(1);
    const limited = await fetchRunningGpsWeather(input(route(7200, 120, t => [22.3, 114.0 + t / 7200 * 0.4]), START, 7200), { fetch: provider(), now: NOW, maxRequests: 2 });
    expect(limited.provenance.requestsMade).toBe(2); expect(limited.status).toBe("partial");
  });
  it("never runs more than three concurrent requests and aborts within total budget", async () => {
    let active = 0, maximum = 0;
    const base = provider();
    const mock = vi.fn(async (raw: string | URL | Request, init?: RequestInit) => {
      active++; maximum = Math.max(maximum, active);
      await new Promise(resolve => setTimeout(resolve, 2));
      try { return await base(raw, init); } finally { active--; }
    }) as unknown as typeof fetch;
    await fetchRunningGpsWeather(input(route(7200, 120, t => [22.3, 114.0 + t / 7200 * 0.4]), START, 7200), { fetch: mock, now: NOW, concurrency: 100 });
    expect(maximum).toBeLessThanOrEqual(3);
    const hung = vi.fn((_raw: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    })) as unknown as typeof fetch;
    const begun = Date.now();
    const result = await fetchRunningGpsWeather(input([sample(0), sample(120)]), { fetch: hung, now: NOW, budgetMs: 20 });
    expect(Date.now() - begun).toBeLessThan(500); expect(result.status).toBe("unknown"); expect(result.provenance.requestsMade).toBe(1);
  });
});
