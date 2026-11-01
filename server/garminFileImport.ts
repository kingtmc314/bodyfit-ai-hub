import { Decoder, Stream } from "@garmin/fitsdk";
import Papa from "papaparse";

export type GarminTimeSample = {
  elapsedSec: number;
  timestamp: string;
  distanceKm?: number;
  paceSecPerKm?: number;
  heartRate?: number;
  cadence?: number;
  power?: number;
  altitudeM?: number;
  temperatureC?: number;
};

type GarminRawPreview = {
  sourceFormat: "FIT" | "CSV";
  fields: Record<string, string>;
  garminDetails: Record<string, string | number | null>;
  laps: Array<{ lap: number; durationSec: number | null; distanceKm: number | null; avgPace: string | null }>;
  timeSeries: GarminTimeSample[];
  warnings: string[];
};

const MAX_SAMPLES = 30000;
const asNumber = (value: unknown): number | undefined => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};
const asDate = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const toHKDate = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const toHKTime = (date: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Hong_Kong", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
const decimalPace = (secondsPerKm: number | undefined) => secondsPerKm && secondsPerKm > 0 ? (secondsPerKm / 60).toFixed(2) : undefined;

function metricFields(session: Record<string, unknown>, samples: GarminTimeSample[], sourceFormat: "FIT" | "CSV"): GarminRawPreview {
  const first = samples[0];
  const last = samples.at(-1);
  const durationSec = asNumber(session.totalTimerTime) ?? (last ? last.elapsedSec : undefined);
  const distanceM = asNumber(session.totalDistance);
  const distanceKm = distanceM && distanceM > 100 ? distanceM / 1000 : asNumber(session.distanceKm) ?? last?.distanceKm;
  const avgSpeed = asNumber(session.avgSpeed) ?? asNumber(session.averageSpeed);
  const maxSpeed = asNumber(session.maxSpeed) ?? asNumber(session.maximumSpeed);
  const paceSeconds = distanceKm && durationSec ? durationSec / distanceKm : avgSpeed ? 1000 / avgSpeed : undefined;
  const bestPaceSeconds = maxSpeed ? 1000 / maxSpeed : undefined;
  const start = first ? new Date(first.timestamp) : asDate(session.startTime) ?? asDate(session.timestamp);
  const fields: Record<string, string> = {};
  if (start) { fields.date = toHKDate(start); fields.weatherTime = toHKTime(start); }
  if (distanceKm) fields.distanceKm = distanceKm.toFixed(2);
  if (durationSec !== undefined) {
    fields.hour = String(Math.floor(durationSec / 3600));
    fields.minutes = String(Math.floor((durationSec % 3600) / 60));
    fields.second = String(Math.round(durationSec % 60));
  }
  const averagePace = decimalPace(paceSeconds);
  const bestPace = decimalPace(bestPaceSeconds);
  if (averagePace) fields.averagePace = averagePace;
  if (bestPace) fields.bestPace = bestPace;
  const pairs: Array<[keyof typeof session, string]> = [
    ["avgHeartRate", "averageHeartRate"], ["maxHeartRate", "maximumHeartRate"], ["avgRunningCadence", "averageCadence"], ["maxRunningCadence", "maxCadence"], ["totalCalories", "calories"], ["avgStepLength", "avgStrideLengthM"], ["avgVerticalRatio", "avgVerticalRatio"], ["avgVerticalOscillation", "verticalOscillationCm"], ["avgStanceTime", "avgGroundContactTimeMs"], ["avgTemperature", "temperature"],
  ];
  for (const [source, target] of pairs) {
    const value = asNumber(session[source]);
    if (value !== undefined) fields[target] = String(value);
  }
  const warnings: string[] = [];
  if (!samples.length) warnings.push("原始檔沒有可讀取的逐秒 Record 樣本；已只填入活動摘要。");
  if (samples.length >= MAX_SAMPLES) warnings.push(`為維持操作效能，已保留首 ${MAX_SAMPLES.toLocaleString()} 個逐秒樣本。`);
  return {
    sourceFormat,
    fields,
    garminDetails: {
      sourceFormat,
      rawSampleCount: samples.length,
      avgPowerW: asNumber(session.avgPower) ?? null,
      maxPowerW: asNumber(session.maxPower) ?? null,
      totalAscentM: asNumber(session.totalAscent) ?? null,
      totalDescentM: asNumber(session.totalDescent) ?? null,
      avgTemperatureC: asNumber(session.avgTemperature) ?? null,
      totalMovingTimeSec: asNumber(session.totalMovingTime) ?? null,
    },
    laps: [],
    timeSeries: samples,
    warnings,
  };
}

function mapFitRecord(record: Record<string, unknown>, startedAt: Date): GarminTimeSample | null {
  const timestamp = asDate(record.timestamp);
  if (!timestamp) return null;
  const speed = asNumber(record.enhancedSpeed) ?? asNumber(record.speed);
  const distanceM = asNumber(record.distance);
  return {
    elapsedSec: Math.max(0, Math.round((timestamp.getTime() - startedAt.getTime()) / 1000)),
    timestamp: timestamp.toISOString(),
    ...(distanceM !== undefined ? { distanceKm: Number((distanceM / 1000).toFixed(4)) } : {}),
    ...(speed && speed > 0 ? { paceSecPerKm: Number((1000 / speed).toFixed(2)) } : {}),
    ...(asNumber(record.heartRate) !== undefined ? { heartRate: asNumber(record.heartRate) } : {}),
    ...(asNumber(record.cadence) !== undefined ? { cadence: asNumber(record.cadence) } : {}),
    ...(asNumber(record.power) !== undefined ? { power: asNumber(record.power) } : {}),
    ...(asNumber(record.enhancedAltitude) ?? asNumber(record.altitude) ? { altitudeM: asNumber(record.enhancedAltitude) ?? asNumber(record.altitude) } : {}),
    ...(asNumber(record.temperature) !== undefined ? { temperatureC: asNumber(record.temperature) } : {}),
  };
}

export function parseGarminFit(buffer: Buffer): GarminRawPreview {
  const stream = Stream.fromBuffer(buffer);
  if (!Decoder.isFIT(stream)) throw new Error("這不是有效的 Garmin FIT 檔案");
  const decoder = new Decoder(stream);
  const { messages, errors } = decoder.read({ applyScaleAndOffset: true, expandComponents: true, convertDateTimesToDates: true, mergeHeartRates: true });
  const recordMessages = (messages.recordMesgs ?? []) as Array<Record<string, unknown>>;
  const firstTimestamp = recordMessages.map(record => asDate(record.timestamp)).find((date): date is Date => !!date)
    ?? asDate((messages.sessionMesgs?.[0] as Record<string, unknown> | undefined)?.startTime)
    ?? new Date();
  const samples = recordMessages.map(record => mapFitRecord(record, firstTimestamp)).filter((sample): sample is GarminTimeSample => !!sample).slice(0, MAX_SAMPLES);
  const session = (messages.sessionMesgs?.[0] ?? {}) as Record<string, unknown>;
  const preview = metricFields(session, samples, "FIT");
  preview.laps = (messages.lapMesgs ?? []).map((lap: any, index) => {
    const distance = asNumber(lap.totalDistance);
    const duration = asNumber(lap.totalTimerTime) ?? asNumber(lap.totalElapsedTime);
    const speed = asNumber(lap.avgSpeed);
    return { lap: index + 1, durationSec: duration ? Math.round(duration) : null, distanceKm: distance ? Number((distance / 1000).toFixed(3)) : null, avgPace: decimalPace(speed ? 1000 / speed : undefined) ?? null };
  });
  if (errors.length) preview.warnings.push(`FIT 檔案有 ${errors.length} 項可恢復的解析提示；已保留能安全讀取的資料。`);
  return preview;
}

function valueFor(row: Record<string, string>, names: string[]) {
  const lookup: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) lookup[key.toLowerCase().replace(/[^a-z0-9]/g, "")] = value;
  return names.map(name => lookup[name]).find(value => value !== undefined && value !== "");
}

export function parseGarminCsv(buffer: Buffer): GarminRawPreview {
  const parsed = Papa.parse<Record<string, string>>(buffer.toString("utf8"), { header: true, skipEmptyLines: true });
  if (parsed.errors.length && !parsed.data.length) throw new Error("CSV 格式無法讀取，請使用 Garmin 匯出的原始 CSV 檔");
  const raw = parsed.data;
  const timed = raw.map(row => {
    const timestampRaw = valueFor(row, ["timestamp", "time", "datetime"]);
    const timestamp = timestampRaw ? new Date(timestampRaw) : null;
    const distance = asNumber(valueFor(row, ["distance", "distancekm"]));
    const speed = asNumber(valueFor(row, ["enhancedspeed", "speed"]));
    return timestamp && !Number.isNaN(timestamp.getTime()) ? { timestamp, distance, speed, row } : null;
  }).filter(Boolean) as Array<{ timestamp: Date; distance?: number; speed?: number; row: Record<string, string> }>;
  const start = timed[0]?.timestamp ?? new Date();
  const samples: GarminTimeSample[] = timed.slice(0, MAX_SAMPLES).map(item => ({
    elapsedSec: Math.max(0, Math.round((item.timestamp.getTime() - start.getTime()) / 1000)), timestamp: item.timestamp.toISOString(),
    ...(item.distance !== undefined ? { distanceKm: item.distance > 100 ? Number((item.distance / 1000).toFixed(4)) : item.distance } : {}),
    ...(item.speed && item.speed > 0 ? { paceSecPerKm: Number((1000 / item.speed).toFixed(2)) } : {}),
    ...(asNumber(valueFor(item.row, ["heartrate", "heart_rate"])) !== undefined ? { heartRate: asNumber(valueFor(item.row, ["heartrate", "heart_rate"])) } : {}),
    ...(asNumber(valueFor(item.row, ["cadence"])) !== undefined ? { cadence: asNumber(valueFor(item.row, ["cadence"])) } : {}),
    ...(asNumber(valueFor(item.row, ["power", "watts"])) !== undefined ? { power: asNumber(valueFor(item.row, ["power", "watts"])) } : {}),
    ...(asNumber(valueFor(item.row, ["altitude", "enhancedaltitude"])) !== undefined ? { altitudeM: asNumber(valueFor(item.row, ["altitude", "enhancedaltitude"])) } : {}),
    ...(asNumber(valueFor(item.row, ["temperature", "temp"])) !== undefined ? { temperatureC: asNumber(valueFor(item.row, ["temperature", "temp"])) } : {}),
  }));
  const last = samples.at(-1);
  const session: Record<string, unknown> = { startTime: start, totalDistance: last?.distanceKm ? last.distanceKm * 1000 : undefined, totalTimerTime: last?.elapsedSec };
  const preview = metricFields(session, samples, "CSV");
  preview.warnings.push("CSV 欄位會因 Garmin 匯出設定而不同；請先核對摘要與逐秒樣本數量。", ...(!timed.length ? ["此 CSV 未包含可識別的 timestamp 記錄，因此未保存逐秒曲線。"] : []));
  return preview;
}

export function parseGarminRawFile(buffer: Buffer, filename: string): GarminRawPreview {
  if (buffer.length > 25 * 1024 * 1024) throw new Error("原始 Garmin 檔案超過 25MB 限制");
  if (/\.fit$/i.test(filename)) return parseGarminFit(buffer);
  if (/\.csv$/i.test(filename)) return parseGarminCsv(buffer);
  throw new Error("請選擇 Garmin FIT 或 CSV 原始檔");
}
