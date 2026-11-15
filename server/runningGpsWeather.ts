import { performance } from "node:perf_hooks";
import { weatherConditionFromCode, type HistoricalWeatherObservation } from "./weatherService";
import type {
  RunningGpsWeatherInput, RunningGpsWeatherMetric, RunningGpsWeatherProvenance,
  RunningGpsWeatherResult, RunningGpsWeatherSource,
} from "../shared/runningGpsWeather";
export type { RunningGpsWeatherInput, RunningGpsWeatherResult, RunningGpsWeatherProvenance } from "../shared/runningGpsWeather";

/** Official contracts checked 2026-11-15:
 * https://open-meteo.com/en/docs/historical-weather-api
 * https://open-meteo.com/en/docs/historical-forecast-api
 * https://open-meteo.com/en/docs
 * Archive is model/reanalysis, NOT a GPS weather-station measurement. IFS ~9km;
 * 1.5km query cells distinguish route areas, not district microclimates.
 * Instant fields use the indicated hour (left-hold); precipitation at H covers
 * [H-1h,H), so route [H,H+1h) uses rainfall stamped H+1h. It is prorated assuming
 * uniform hourly rainfall; this is an estimate, never a measured accumulation.
 */
const HOUR = 3_600_000, DAY = 24 * HOUR, HK = 8 * HOUR;
const CELL_KM = 1.5, LAT_STEP = CELL_KM / 111.195;
const MAX_ROWS = 100_000, MAX_PIECES = 100_000, MAX_BATCHES = 24, MAX_REQUESTS = 24;
const METRICS: RunningGpsWeatherMetric[] = ["temperature", "humidity", "apparentTemp", "windSpeed", "precipitation", "weatherCode"];
const FIELDS = "weather_code,temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,precipitation";
const ENDPOINTS: Record<RunningGpsWeatherSource, string> = {
  archive: "https://archive-api.open-meteo.com/v1/archive",
  "historical-forecast": "https://historical-forecast-api.open-meteo.com/v1/forecast",
  forecast: "https://api.open-meteo.com/v1/forecast",
};
const KNOWN_CODES = new Set([0,1,2,3,45,48,51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,97,99]);
const round = (n: number) => Number(n.toFixed(6));
const hkTime = (ms: number) => new Date(ms + HK).toISOString().replace("Z", "+08:00");
const hkHour = (ms: number) => new Date(ms + HK).toISOString().slice(0, 16);
const hkDate = (ms: number) => hkHour(ms).slice(0, 10);
function object(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { return {}; } }
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
}
function finite(raw: unknown): number | null {
  if (typeof raw !== "number" && (typeof raw !== "string" || !raw.trim())) return null;
  const n = Number(raw); return Number.isFinite(n) ? n : null;
}
/** No Date.parse rollover, locale date, offset-less timestamp or elapsed/index-derived clock. */
export function parseRunningGpsTimestamp(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/);
  if (!m) return null;
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(n => Number(n ?? 0));
  if (year < 1940 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) return null;
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return null;
  const offset = m[8];
  if (offset !== "Z" && (Number(offset.slice(1, 3)) > 14 || Number(offset.slice(4)) > 59 || (Number(offset.slice(1,3)) === 14 && Number(offset.slice(4)) !== 0))) return null;
  const t = Date.parse(raw); return Number.isFinite(t) ? t : null;
}
type Point = { t: number; lat: number | null; lon: number | null; index: number };
export type RunningGpsWeatherSegment = {
  cellId: string; latitude: number; longitude: number; hourHK: string;
  precipitationHourHK: string; seconds: number; batchKey: string;
};
export type RunningGpsWeatherBatch = {
  key: string; cellId: string; latitude: number; longitude: number;
  date: string; startDate: string; endDate: string; firstTimestamp: number;
};
/** SERVER ONLY: contains coarse query coordinates; return only Result to clients/AI. */
export type RunningGpsWeatherPlan = {
  segments: RunningGpsWeatherSegment[]; batches: RunningGpsWeatherBatch[];
  locationLabel: string; provenance: RunningGpsWeatherProvenance;
};
export type RunningGpsWeatherPlanOptions = { maxGapSeconds?: number; maxBatches?: number };
function countMetrics(): Record<RunningGpsWeatherMetric, number> {
  return Object.fromEntries(METRICS.map(k => [k, 0])) as Record<RunningGpsWeatherMetric, number>;
}
function initialProvenance(maxGapSeconds: number): RunningGpsWeatherProvenance {
  return {
    version: 1, intervalStartHK: null, intervalEndHK: null, timeBasis: "unknown",
    samplingMethod: "observed-route-time-weighted-1.5km-cells-hourly", spatialCellKm: 1.5,
    maxGapSeconds, totalSeconds: 0, observedRouteSeconds: 0, coveredSeconds: 0,
    coverageFraction: 0, metricCoveredSeconds: countMetrics(), sampledCells: 0, sampledHours: 0,
    plannedCellDayBatches: 0, selectedCellDayBatches: 0, requestsMade: 0, cacheHits: 0,
    failedSegments: 0, source: [], providerTimeStartHK: null, providerTimeEndHK: null,
    precipitationBasis: "preceding-hour-mm-prorated-by-route-seconds", precipitationMeanRateMmPerHour: null,
    conditions: [], mixedConditions: false, reasons: ["天氣為 Open-Meteo 模型／再分析估計；約 1.5 km 路線格不等於供應商約 9 km 天氣解析度或分區實測。"],
  };
}
const bounded = (raw: number | undefined, fallback: number, lo: number, hi: number) => Number.isFinite(raw) ? Math.max(lo, Math.min(hi, Math.floor(raw!))) : fallback;
function longitudeDelta(a: number, b: number) { return ((b - a + 540) % 360) - 180; }
function normalizeLongitude(lon: number) { return ((lon + 180) % 360 + 360) % 360 - 180; }
function distanceMeters(a: Point, b: Point) {
  const r = Math.PI / 180, dlat = (b.lat! - a.lat!) * r, dlon = longitudeDelta(a.lon!, b.lon!) * r;
  const q = Math.sin(dlat / 2) ** 2 + Math.cos(a.lat! * r) * Math.cos(b.lat! * r) * Math.sin(dlon / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, q))));
}
/** Split straight interpolation ONLY between contiguous real pairs at latitude-band,
 * longitude-cell, and hourly boundaries. Each piece retains exact elapsed weight.
 * Longitudes use shortest antimeridian path; polar bands have fewer longitude cells.
 */
function routePieces(a: Point, b: Point, start: number, end: number) {
  const dt = b.t - a.t, dlat = b.lat! - a.lat!, dlon = longitudeDelta(a.lon!, b.lon!);
  const f0 = (start - a.t) / dt, f1 = (end - a.t) / dt;
  const cuts = [f0, f1];
  const nLat = Math.ceil(180 / LAT_STEP), stepLat = 180 / nLat;
  const cross = (origin: number, delta: number, step: number, base: number, lo: number, hi: number, out: number[]) => {
    if (Math.abs(delta) < 1e-12) return;
    const low = Math.min(origin + delta * lo, origin + delta * hi), high = Math.max(origin + delta * lo, origin + delta * hi);
    for (let k = Math.floor((low - base) / step) + 1; k <= Math.floor((high - base) / step); k++) {
      const f = (base + k * step - origin) / delta;
      if (f > lo + 1e-12 && f < hi - 1e-12) out.push(f);
      if (out.length > 2048) break;
    }
  };
  cross(a.lat!, dlat, stepLat, -90, f0, f1, cuts);
  cuts.sort((x, y) => x - y);
  const spatial: number[] = [...cuts];
  for (let i = 1; i < cuts.length; i++) {
    const lo = cuts[i - 1], hi = cuts[i], midLat = a.lat! + dlat * (lo + hi) / 2;
    const band = Math.min(nLat - 1, Math.max(0, Math.floor((midLat + 90) / stepLat)));
    const centerLat = -90 + (band + 0.5) * stepLat;
    const nLon = Math.max(1, Math.ceil(360 * 111.195 * Math.cos(centerLat * Math.PI / 180) / CELL_KM));
    cross(a.lon!, dlon, 360 / nLon, -180, lo, hi, spatial);
  }
  for (let t = (Math.floor(start / HOUR) + 1) * HOUR; t < end; t += HOUR) spatial.push((t - a.t) / dt);
  spatial.sort((x, y) => x - y);
  const result: Array<{ cellId: string; latitude: number; longitude: number; start: number; end: number }> = [];
  for (let i = 1; i < spatial.length; i++) {
    const lo = spatial[i - 1], hi = spatial[i]; if (hi - lo < 1e-12) continue;
    const f = (lo + hi) / 2, lat = a.lat! + dlat * f, lon = normalizeLongitude(a.lon! + dlon * f);
    const band = Math.min(nLat - 1, Math.max(0, Math.floor((lat + 90) / stepLat)));
    const latitude = -90 + (band + 0.5) * stepLat;
    const nLon = Math.max(1, Math.ceil(360 * 111.195 * Math.cos(latitude * Math.PI / 180) / CELL_KM));
    const col = Math.min(nLon - 1, Math.floor((lon + 180) / (360 / nLon)));
    result.push({ cellId: `${band}:${col}`, latitude: round(latitude), longitude: round(-180 + (col + 0.5) * 360 / nLon), start: a.t + lo * dt, end: a.t + hi * dt });
  }
  return result;
}

export function deriveRunningGpsWeatherPlan(input: RunningGpsWeatherInput, options: RunningGpsWeatherPlanOptions = {}): RunningGpsWeatherPlan {
  const maxGap = bounded(options.maxGapSeconds, 120, 1, 120), maxBatches = bounded(options.maxBatches, MAX_BATCHES, 1, MAX_BATCHES);
  const p = initialProvenance(maxGap);
  const empty = (): RunningGpsWeatherPlan => ({ segments: [], batches: [], locationLabel: "GPS位置", provenance: p });
  let raw = input.timeSeries;
  if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { p.reasons.push("時間序列無法讀取。"); return empty(); } }
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > MAX_ROWS) { p.reasons.push("沒有足夠時間樣本，或超過 100,000 個樣本安全上限。"); return empty(); }
  const invalidPrefix = [0];
  const points: Point[] = [];
  let rejected = 0;
  for (let index = 0; index < raw.length; index++) {
    const r = object(raw[index]), t = parseRunningGpsTimestamp(r.timestamp);
    invalidPrefix.push(invalidPrefix[index] + (t === null ? 1 : 0));
    if (t === null) { rejected++; continue; }
    let lat = finite(r.latitude), lon = finite(r.longitude);
    if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) { lat = null; lon = null; rejected++; }
    points.push({ t, lat, lon, index });
  }
  points.sort((a, b) => a.t - b.t || a.index - b.index);
  const unique: Point[] = [];
  let duplicates = 0;
  for (const point of points) {
    const last = unique.at(-1);
    if (!last || last.t !== point.t) unique.push({ ...point });
    else {
      duplicates++;
      if (last.lat !== point.lat || last.lon !== point.lon) { last.lat = null; last.lon = null; }
    }
  }
  if (rejected) p.reasons.push(`已拒絕 ${rejected} 個無效 GPS／明確時區時戳樣本；不以 elapsedSec、零值或預設時間代替。`);
  if (duplicates) p.reasons.push(`已合併 ${duplicates} 個重複時戳；位置衝突的重複時戳不建立區間。`);
  const details = object(input.garminDetails), explicit = input.activityWindow;
  let start: number | null = null, end: number | null = null;
  if (explicit?.verified === true || details.activityWindowVerified === 1 || details.activityWindowVerified === true) {
    start = parseRunningGpsTimestamp(explicit?.startTimestamp ?? details.activityStartTimestamp);
    end = parseRunningGpsTimestamp(explicit?.endTimestamp ?? details.activityEndTimestamp);
    p.timeBasis = "verified-activity-window";
  } else if (details.sourceFormat === undefined || details.sourceFormat === "GPX" || details.sourceFormat === "TCX") {
    // Real source timestamps, NOT timer duration / a date form / filename / default 07:00.
    start = unique[0]?.t ?? null; end = unique.at(-1)?.t ?? null;
    p.timeBasis = "timestamped-sample-bounds";
    p.reasons.push("活動時段採實際時間序列首尾時戳；首尾樣本以外的活動時間未知，不向外延伸。");
  }
  if (start === null || end === null || end <= start || end - start > 7 * DAY || hkDate(start) < "1940-01-01") {
    p.timeBasis = "unknown"; p.reasons.push("欠缺有效可驗證的活動首尾時戳，或時段超過 7 日安全上限。"); return empty();
  }
  p.intervalStartHK = hkTime(start); p.intervalEndHK = hkTime(end); p.totalSeconds = (end - start) / 1000;
  const segments = new Map<string, RunningGpsWeatherSegment>(), batches = new Map<string, RunningGpsWeatherBatch>();
  let gaps = 0, invalidIntervals = 0, pieces = 0, capped = false;
  for (let i = 1; i < unique.length; i++) {
    const a = unique[i - 1], b = unique[i], left = Math.max(start, a.t), right = Math.min(end, b.t);
    if (right <= left) continue;
    const loIndex = Math.min(a.index, b.index), hiIndex = Math.max(a.index, b.index);
    if (a.lat === null || b.lat === null || invalidPrefix[hiIndex] - invalidPrefix[loIndex + 1] > 0) { invalidIntervals++; continue; }
    const dt = (b.t - a.t) / 1000;
    if (dt > maxGap) { gaps++; continue; }
    if (distanceMeters(a, b) / dt > 15) { invalidIntervals++; continue; }
    const parts = routePieces(a, b, left, right);
    if (pieces + parts.length > MAX_PIECES) { capped = true; break; }
    pieces += parts.length;
    for (const part of parts) {
      const hour = Math.floor((part.start + 0.001) / HOUR) * HOUR;
      const date = hkDate(hour), key = `${part.cellId}/${date}`, seconds = (part.end - part.start) / 1000;
      const sKey = `${key}/${hkHour(hour)}`;
      const old = segments.get(sKey);
      if (old) old.seconds += seconds;
      else segments.set(sKey, { cellId: part.cellId, latitude: part.latitude, longitude: part.longitude, hourHK: hkHour(hour), precipitationHourHK: hkHour(hour + HOUR), seconds, batchKey: key });
      const batch = batches.get(key);
      if (batch) batch.endDate = hkDate(hour + HOUR) > batch.endDate ? hkDate(hour + HOUR) : batch.endDate;
      else batches.set(key, { key, cellId: part.cellId, latitude: part.latitude, longitude: part.longitude, date, startDate: date, endDate: hkDate(hour + HOUR), firstTimestamp: part.start });
      p.observedRouteSeconds += seconds;
    }
  }
  if (gaps) p.reasons.push(`${gaps} 個相鄰樣本缺口超過 ${maxGap} 秒；缺口不計入覆蓋。`);
  if (invalidIntervals) p.reasons.push(`${invalidIntervals} 個區間含無效 GPS／未定時樣本／超過 15 m/s 跳點；沒有假造沿途覆蓋。`);
  if (capped) p.reasons.push("路線切分達 100,000 個片段上限；其餘路段沒有計入覆蓋。");
  if (p.observedRouteSeconds < p.totalSeconds - 0.001) p.reasons.push("真實 GPS 區間未覆蓋全部活動時段；不延伸首尾或填補缺口。");
  const all = Array.from(batches.values()).sort((a, b) => a.firstTimestamp - b.firstTimestamp || a.key.localeCompare(b.key));
  p.plannedCellDayBatches = all.length;
  let selected = all;
  if (all.length > maxBatches) {
    // Spread capped queries across the WHOLE route, including first and last batches.
    const indices = maxBatches === 1 ? [0] : Array.from({ length: maxBatches }, (_, i) => Math.round(i * (all.length - 1) / (maxBatches - 1)));
    selected = indices.map(i => all[i]);
    p.reasons.push(`路線超過 ${maxBatches} 個位置／日期批次上限；已分散取樣首尾與全程，其餘只列未覆蓋，不能稱全程平均。`);
  }
  p.selectedCellDayBatches = selected.length; p.observedRouteSeconds = round(p.observedRouteSeconds);
  const cells = new Map(Array.from(segments.values()).map(s => [s.cellId, s]));
  const sole = cells.size === 1 ? Array.from(cells.values())[0] : null;
  return { segments: Array.from(segments.values()), batches: selected,
    locationLabel: sole ? `GPS位置（${sole.latitude.toFixed(2)}, ${sole.longitude.toFixed(2)}）` : `GPS位置（跨 ${cells.size} 個約 1.5 km 路線分區）`, provenance: p };
}

type MetricValues = Record<RunningGpsWeatherMetric, number | null>;
type HourlyData = { values: Map<string, MetricValues>; source: RunningGpsWeatherSource };
export type RunningGpsWeatherCache = Map<string, { expiresAt: number; data: HourlyData }>;
const defaultCache: RunningGpsWeatherCache = new Map();
export type RunningGpsWeatherOptions = RunningGpsWeatherPlanOptions & {
  fetch?: typeof globalThis.fetch; now?: Date; budgetMs?: number; maxRequests?: number;
  concurrency?: number; cache?: RunningGpsWeatherCache | false;
};
function validMetric(raw: unknown, lo: number, hi: number = Infinity): number | null {
  return typeof raw === "number" && Number.isFinite(raw) && raw >= lo && raw <= hi ? raw : null;
}
function parseProvider(raw: unknown, batch: RunningGpsWeatherBatch, source: RunningGpsWeatherSource): HourlyData | null {
  const payload = object(raw), hourly = object(payload.hourly), units = object(payload.hourly_units);
  // Do not interpret a foreign/local timezone response as HK, or silently convert unexpected units.
  if (payload.utc_offset_seconds !== HK / 1000 || (payload.timezone !== undefined && payload.timezone !== "Asia/Hong_Kong")) return null;
  for (const [key, expected] of Object.entries({ temperature_2m: "°C", apparent_temperature: "°C", relative_humidity_2m: "%", wind_speed_10m: "km/h", precipitation: "mm" })) {
    if (units[key] !== undefined && units[key] !== expected) return null;
  }
  if (!Array.isArray(hourly.time) || hourly.time.length > 72) return null;
  const values = new Map<string, MetricValues>(), duplicates = new Set<string>();
  const at = (name: string, index: number) => Array.isArray(hourly[name]) ? (hourly[name] as unknown[])[index] : null;
  hourly.time.forEach((time, index) => {
    if (typeof time !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:00$/.test(time) || parseRunningGpsTimestamp(`${time}+08:00`) === null || time.slice(0,10) < batch.startDate || time.slice(0,10) > batch.endDate) return;
    if (values.has(time) || duplicates.has(time)) { values.delete(time); duplicates.add(time); return; }
    const code = validMetric(at("weather_code", index), 0, 99);
    values.set(time, {
      temperature: validMetric(at("temperature_2m", index), -100, 100),
      humidity: validMetric(at("relative_humidity_2m", index), 0, 100),
      apparentTemp: validMetric(at("apparent_temperature", index), -150, 100),
      windSpeed: validMetric(at("wind_speed_10m", index), 0),
      precipitation: validMetric(at("precipitation", index), 0),
      weatherCode: code !== null && KNOWN_CODES.has(code) ? code : null,
    });
  });
  return values.size ? { values, source } : null;
}
function providerUrl(batch: RunningGpsWeatherBatch, source: RunningGpsWeatherSource) {
  const url = new URL(ENDPOINTS[source]);
  const params = { latitude: String(batch.latitude), longitude: String(batch.longitude), start_date: batch.startDate, end_date: batch.endDate,
    hourly: FIELDS, timezone: "Asia/Hong_Kong", timeformat: "iso8601", temperature_unit: "celsius", wind_speed_unit: "kmh", precipitation_unit: "mm" };
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url;
}
/** Always returns unknown/partial on provider failure. No DB writes, logging of GPS,
 * auth, geocoding fallback or health-import aborts. 24 actual requests maximum,
 * 3 concurrent workers maximum, <=20s wall-clock budget including fallback/JSON.
 */
export async function getRunningGpsWeather(input: RunningGpsWeatherInput, options: RunningGpsWeatherOptions = {}): Promise<RunningGpsWeatherResult> {
  const begun = performance.now(), budget = bounded(options.budgetMs, 19_000, 1, 20_000), deadline = begun + budget;
  const plan = deriveRunningGpsWeatherPlan(input, options), p = plan.provenance;
  const finishUnknown = (reason?: string): RunningGpsWeatherResult => { if (reason) p.reasons.push(reason); return { status: "unknown", observation: null, provenance: p }; };
  if (!plan.segments.length || !plan.batches.length) return finishUnknown("没有可用連續 GPS／時戳區間，未套用香港或預設時間。");
  const now = options.now?.getTime() ?? Date.now();
  if (!Number.isFinite(now) || parseRunningGpsTimestamp(p.intervalEndHK)! > now) return finishUnknown("活動時段在未來或查詢時鐘無效；不把未來預報當已完成活動天氣。");
  const maxRequests = bounded(options.maxRequests, MAX_REQUESTS, 1, MAX_REQUESTS), concurrency = bounded(options.concurrency, 3, 1, 3);
  const fetcher = options.fetch ?? globalThis.fetch;
  const cache = options.cache === false ? null : options.cache ?? (options.fetch ? null : defaultCache);
  const data = new Map<string, HourlyData>();
  let failures = 0, fallbacks = 0;
  async function request(batch: RunningGpsWeatherBatch, source: RunningGpsWeatherSource): Promise<HourlyData | null> {
    const url = providerUrl(batch, source), key = url.href, hit = cache?.get(key);
    if (hit && hit.expiresAt > now) { p.cacheHits++; return hit.data; }
    if (hit) cache?.delete(key);
    if (p.requestsMade >= maxRequests || performance.now() >= deadline) return null;
    p.requestsMade++;
    const wait = Math.max(1, Math.min(6000, deadline - performance.now())), controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const task = (async () => {
        const response = await fetcher(url, { signal: controller.signal });
        if (!response.ok) return null;
        return parseProvider(await response.json(), batch, source);
      })();
      const result = await Promise.race([task, new Promise<null>(resolve => { timer = setTimeout(() => { controller.abort(); resolve(null); }, wait); })]);
      if (result && cache) {
        if (cache.size >= 128) cache.delete(cache.keys().next().value!);
        cache.set(key, { expiresAt: now + (source === "archive" ? HOUR : 10 * 60_000), data: result });
      }
      return result;
    } catch { return null; }
    finally { if (timer) clearTimeout(timer); }
  }
  let cursor = 0;
  async function worker() {
    while (cursor < plan.batches.length) {
      const batch = plan.batches[cursor++];
      const recent = batch.date >= hkDate(now - 5 * DAY);
      // Older dates always archive. Recent archive may lack ERA5's last 5 days;
      // historical forecast is preferred for recent past, current-day forecast for today.
      const primary: RunningGpsWeatherSource = recent ? (batch.date === hkDate(now) ? "forecast" : "historical-forecast") : "archive";
      let result = await request(batch, primary);
      if (!result && recent && p.requestsMade < maxRequests && performance.now() < deadline) {
        fallbacks++;
        result = await request(batch, primary === "historical-forecast" ? "forecast" : "historical-forecast");
      }
      if (result) data.set(batch.key, result); else failures++;
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  const sums = countMetrics(), conditions = new Map<number, number>(), cells = new Set<string>(), hours = new Set<string>(), sources = new Set<RunningGpsWeatherSource>(), providerTimes = new Set<string>();
  for (const segment of plan.segments) {
    const payload = data.get(segment.batchKey), instant = payload?.values.get(segment.hourHK), rain = payload?.values.get(segment.precipitationHourHK);
    const values: MetricValues = { temperature: instant?.temperature ?? null, humidity: instant?.humidity ?? null,
      apparentTemp: instant?.apparentTemp ?? null, windSpeed: instant?.windSpeed ?? null,
      weatherCode: instant?.weatherCode ?? null, precipitation: rain?.precipitation ?? null };
    const valid = METRICS.filter(k => values[k] !== null);
    if (valid.length < METRICS.length) p.failedSegments++;
    if (!valid.length || !payload) continue;
    cells.add(segment.cellId); sources.add(payload.source);
    if (valid.some(k => k !== "precipitation")) { hours.add(segment.hourHK); providerTimes.add(`${segment.hourHK}:00+08:00`); }
    if (values.precipitation !== null) { hours.add(segment.precipitationHourHK); providerTimes.add(`${segment.precipitationHourHK}:00+08:00`); }
    if (valid.length === METRICS.length) p.coveredSeconds += segment.seconds;
    for (const metric of valid) { p.metricCoveredSeconds[metric] += segment.seconds; sums[metric] += values[metric]! * segment.seconds; }
    if (values.weatherCode !== null) conditions.set(values.weatherCode, (conditions.get(values.weatherCode) ?? 0) + segment.seconds);
  }
  p.sampledCells = cells.size; p.sampledHours = hours.size; p.source = Array.from(sources).sort();
  const orderedTimes = Array.from(providerTimes).sort(); p.providerTimeStartHK = orderedTimes[0] ?? null; p.providerTimeEndHK = orderedTimes.at(-1) ?? null;
  p.coveredSeconds = round(p.coveredSeconds); p.coverageFraction = p.totalSeconds ? Math.min(1, p.coveredSeconds / p.totalSeconds) : 0;
  for (const metric of METRICS) p.metricCoveredSeconds[metric] = round(p.metricCoveredSeconds[metric]);
  if (failures) p.reasons.push(`${failures} 個位置／日期批次不可取得、未選取或達請求／時間上限；缺失不當作零值。`);
  if (fallbacks) p.reasons.push(`近期來源未取得資料，已嘗試 ${fallbacks} 次官方近期後備來源。`);
  if (p.failedSegments) p.reasons.push(`${p.failedSegments} 個格／小時片段缺少全部或部分變數；各數值只按自身有效秒數平均，完整覆蓋需六項變數全有資料。`);
  if (p.requestsMade >= maxRequests) p.reasons.push(`最多 ${maxRequests} 次實際請求；不為補齊覆蓋超出限制。`);
  if (performance.now() >= deadline) p.reasons.push(`已達 ${budget} ms 非阻塞查詢預算。`);
  p.reasons.push("瞬時變數採供應商該小時值並按路線停留秒數加權；降水用下一小時時戳的前一小時毫米量按秒比例積分，缺失時不推算全程總量。");
  const mean = (metric: RunningGpsWeatherMetric) => p.metricCoveredSeconds[metric] > 0 ? round(sums[metric] / p.metricCoveredSeconds[metric]) : null;
  p.precipitationMeanRateMmPerHour = mean("precipitation");
  const conditionSeconds = p.metricCoveredSeconds.weatherCode;
  p.conditions = Array.from(conditions).sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([code, seconds]) => ({ code, label: weatherConditionFromCode(code)!, seconds: round(seconds), fraction: conditionSeconds ? round(seconds / conditionSeconds) : 0 }));
  p.mixedConditions = p.conditions.length > 1;
  if (!METRICS.some(k => p.metricCoveredSeconds[k] > 0)) return finishUnknown("天氣來源無可用數值；保留未知，匯入可繼續。");
  const dominant = p.conditions[0];
  const observation: HistoricalWeatherObservation = {
    temperature: mean("temperature"), humidity: mean("humidity"), apparentTemp: mean("apparentTemp"), windSpeed: mean("windSpeed"),
    precipitation: p.metricCoveredSeconds.precipitation > 0 ? round(sums.precipitation / 3600) : null,
    weatherCode: dominant?.code ?? null,
    weatherCondition: dominant ? (p.mixedConditions ? `混合天氣（以${dominant.label}為主）` : dominant.label) : null,
    weatherLocation: plan.locationLabel,
    weatherObservedAt: p.providerTimeStartHK === p.providerTimeEndHK ? p.providerTimeStartHK! : `${p.providerTimeStartHK} – ${p.providerTimeEndHK}`,
    weatherSource: `Open-Meteo ${p.source.join(" / ")} 模型估計（GPS路線時間加權${p.coverageFraction >= 1 - 1e-8 ? "" : "；部分覆蓋"}）`,
  };
  return { status: p.coverageFraction >= 1 - 1e-8 ? "complete" : "partial", observation, provenance: p };
}

/** Integration entry point; getRunningGpsWeather is the identical implementation. */
export const fetchRunningGpsWeather = getRunningGpsWeather;
