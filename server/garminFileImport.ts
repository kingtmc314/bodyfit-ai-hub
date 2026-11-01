import { Decoder, Stream } from "@garmin/fitsdk";
import Papa from "papaparse";
import sax from "sax";

export type GarminSourceFormat = "FIT" | "CSV" | "GPX" | "TCX";

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
  sourceFormat: GarminSourceFormat;
  fields: Record<string, string>;
  garminDetails: Record<string, string | number | null>;
  laps: Array<{ lap: number; durationSec: number | null; distanceKm: number | null; avgPace: string | null }>;
  timeSeries: GarminTimeSample[];
  warnings: string[];
};

type XmlPoint = {
  timestamp: Date;
  latitude?: number;
  longitude?: number;
  distanceM?: number;
  altitudeM?: number;
  heartRate?: number;
  cadence?: number;
  power?: number;
  temperatureC?: number;
};

type XmlLap = {
  startedAt?: Date;
  totalTimeSec?: number;
  distanceM?: number;
  calories?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
};

// 10,000 detailed samples remain comfortably below Vercel's 4.5MB function
// response/request cap. Ordinary activities retain every second; longer files
// are uniformly sampled across their full duration, while the source file stays
// attached for future reprocessing.
const MAX_SAMPLES = 10000;
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

function keepChartSamples<T>(items: T[]): T[] {
  if (items.length <= MAX_SAMPLES) return items;
  return Array.from({ length: MAX_SAMPLES }, (_, index) => {
    const sourceIndex = Math.round(index * (items.length - 1) / (MAX_SAMPLES - 1));
    return items[sourceIndex];
  });
}

function metricFields(session: Record<string, unknown>, samples: GarminTimeSample[], sourceFormat: GarminSourceFormat): GarminRawPreview {
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
  if (samples.length >= MAX_SAMPLES) warnings.push(`為維持操作效能，這次活動已均勻保留全程 ${MAX_SAMPLES.toLocaleString()} 個曲線樣本；原始檔仍會隨紀錄保存。`);
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
  const altitudeM = asNumber(record.enhancedAltitude) ?? asNumber(record.altitude);
  return {
    elapsedSec: Math.max(0, Math.round((timestamp.getTime() - startedAt.getTime()) / 1000)),
    timestamp: timestamp.toISOString(),
    ...(distanceM !== undefined ? { distanceKm: Number((distanceM / 1000).toFixed(4)) } : {}),
    ...(speed && speed > 0 ? { paceSecPerKm: Number((1000 / speed).toFixed(2)) } : {}),
    ...(asNumber(record.heartRate) !== undefined ? { heartRate: asNumber(record.heartRate) } : {}),
    ...(asNumber(record.cadence) !== undefined ? { cadence: asNumber(record.cadence) } : {}),
    ...(asNumber(record.power) !== undefined ? { power: asNumber(record.power) } : {}),
    ...(altitudeM !== undefined ? { altitudeM } : {}),
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
  const sourceSamples = recordMessages.map(record => mapFitRecord(record, firstTimestamp)).filter((sample): sample is GarminTimeSample => !!sample);
  const samples = keepChartSamples(sourceSamples);
  const session = (messages.sessionMesgs?.[0] ?? {}) as Record<string, unknown>;
  const preview = metricFields(session, samples, "FIT");
  preview.laps = ((messages.lapMesgs ?? []) as unknown as Array<Record<string, unknown>>).map((lap, index) => {
    const distance = asNumber(lap.totalDistance);
    const duration = asNumber(lap.totalTimerTime) ?? asNumber(lap.totalElapsedTime);
    const speed = asNumber(lap.avgSpeed);
    return { lap: index + 1, durationSec: duration ? Math.round(duration) : null, distanceKm: distance ? Number((distance / 1000).toFixed(3)) : null, avgPace: decimalPace(speed ? 1000 / speed : undefined) ?? null };
  });
  preview.garminDetails.rawSampleCount = sourceSamples.length;
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
  const sourceSamples: GarminTimeSample[] = timed.map(item => ({
    elapsedSec: Math.max(0, Math.round((item.timestamp.getTime() - start.getTime()) / 1000)), timestamp: item.timestamp.toISOString(),
    ...(item.distance !== undefined ? { distanceKm: item.distance > 100 ? Number((item.distance / 1000).toFixed(4)) : item.distance } : {}),
    ...(item.speed && item.speed > 0 ? { paceSecPerKm: Number((1000 / item.speed).toFixed(2)) } : {}),
    ...(asNumber(valueFor(item.row, ["heartrate", "heart_rate"])) !== undefined ? { heartRate: asNumber(valueFor(item.row, ["heartrate", "heart_rate"])) } : {}),
    ...(asNumber(valueFor(item.row, ["cadence"])) !== undefined ? { cadence: asNumber(valueFor(item.row, ["cadence"])) } : {}),
    ...(asNumber(valueFor(item.row, ["power", "watts"])) !== undefined ? { power: asNumber(valueFor(item.row, ["power", "watts"])) } : {}),
    ...(asNumber(valueFor(item.row, ["altitude", "enhancedaltitude"])) !== undefined ? { altitudeM: asNumber(valueFor(item.row, ["altitude", "enhancedaltitude"])) } : {}),
    ...(asNumber(valueFor(item.row, ["temperature", "temp"])) !== undefined ? { temperatureC: asNumber(valueFor(item.row, ["temperature", "temp"])) } : {}),
  }));
  const samples = keepChartSamples(sourceSamples);
  const last = samples.at(-1);
  const session: Record<string, unknown> = { startTime: start, totalDistance: last?.distanceKm ? last.distanceKm * 1000 : undefined, totalTimerTime: last?.elapsedSec };
  const preview = metricFields(session, samples, "CSV");
  preview.garminDetails.rawSampleCount = sourceSamples.length;
  preview.warnings.push("CSV 欄位會因 Garmin 匯出設定而不同；請先核對摘要與逐秒樣本數量。", ...(!timed.length ? ["此 CSV 未包含可識別的 timestamp 記錄，因此未保存逐秒曲線。"] : []));
  return preview;
}

function localName(name: string): string {
  const segments = name.split(":");
  return segments.at(-1)?.toLowerCase() ?? name.toLowerCase();
}

function parseXmlNumber(value: string | undefined): number | undefined {
  return value === undefined ? undefined : asNumber(value.trim());
}

function parseXmlDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = asDate(value.trim());
  return parsed ?? undefined;
}

function xmlAttribute(tag: sax.Tag | sax.QualifiedTag, name: string): string | undefined {
  const value = tag.attributes[name];
  if (typeof value === "string") return value;
  return value?.value;
}

function distanceBetweenMeters(first: XmlPoint, second: XmlPoint): number | undefined {
  if (first.latitude === undefined || first.longitude === undefined || second.latitude === undefined || second.longitude === undefined) return undefined;
  const radians = Math.PI / 180;
  const latDistance = (second.latitude - first.latitude) * radians;
  const lonDistance = (second.longitude - first.longitude) * radians;
  const a = Math.sin(latDistance / 2) ** 2 + Math.cos(first.latitude * radians) * Math.cos(second.latitude * radians) * Math.sin(lonDistance / 2) ** 2;
  return 6371000 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function toTimeSeries(points: XmlPoint[]): GarminTimeSample[] {
  const visiblePoints = keepChartSamples(points);
  const startedAt = visiblePoints[0]?.timestamp;
  if (!startedAt) return [];
  let cumulativeDistanceM = 0;
  let previous: XmlPoint | undefined;

  return visiblePoints.map((point) => {
    if (point.distanceM !== undefined) cumulativeDistanceM = point.distanceM;
    else if (previous) cumulativeDistanceM += distanceBetweenMeters(previous, point) ?? 0;

    const elapsedSec = Math.max(0, Math.round((point.timestamp.getTime() - startedAt.getTime()) / 1000));
    const segmentSeconds = previous ? Math.max(0, (point.timestamp.getTime() - previous.timestamp.getTime()) / 1000) : 0;
    const segmentDistanceM = previous ? (point.distanceM !== undefined && previous.distanceM !== undefined ? point.distanceM - previous.distanceM : distanceBetweenMeters(previous, point) ?? 0) : 0;
    const paceSecPerKm = segmentSeconds > 0 && segmentDistanceM > 1 ? Number((segmentSeconds * 1000 / segmentDistanceM).toFixed(2)) : undefined;
    previous = point;

    return {
      elapsedSec,
      timestamp: point.timestamp.toISOString(),
      ...(cumulativeDistanceM > 0 ? { distanceKm: Number((cumulativeDistanceM / 1000).toFixed(4)) } : {}),
      ...(paceSecPerKm && paceSecPerKm < 7200 ? { paceSecPerKm } : {}),
      ...(point.heartRate !== undefined ? { heartRate: point.heartRate } : {}),
      ...(point.cadence !== undefined ? { cadence: point.cadence } : {}),
      ...(point.power !== undefined ? { power: point.power } : {}),
      ...(point.altitudeM !== undefined ? { altitudeM: point.altitudeM } : {}),
      ...(point.temperatureC !== undefined ? { temperatureC: point.temperatureC } : {}),
    };
  });
}

function calculateAscentDescent(points: XmlPoint[]) {
  let ascent = 0;
  let descent = 0;
  for (let index = 1; index < points.length; index += 1) {
    const before = points[index - 1].altitudeM;
    const after = points[index].altitudeM;
    if (before === undefined || after === undefined) continue;
    const delta = after - before;
    if (delta > 0) ascent += delta;
    if (delta < 0) descent += Math.abs(delta);
  }
  return { ascent: Number(ascent.toFixed(1)), descent: Number(descent.toFixed(1)) };
}

function averageOf(values: Array<number | undefined>): number | undefined {
  const valid = values.filter((value): value is number => value !== undefined && Number.isFinite(value));
  return valid.length ? Number((valid.reduce((total, value) => total + value, 0) / valid.length).toFixed(1)) : undefined;
}

function xmlPreview(points: XmlPoint[], laps: XmlLap[], sourceFormat: "GPX" | "TCX"): GarminRawPreview {
  const samples = toTimeSeries(points);
  const lastPoint = points.at(-1);
  const distanceFromTrack = samples.at(-1)?.distanceKm;
  const totalLapTime = laps.reduce((total, lap) => total + (lap.totalTimeSec ?? 0), 0);
  const totalLapDistance = laps.reduce((total, lap) => total + (lap.distanceM ?? 0), 0);
  const elevation = calculateAscentDescent(points);
  const session: Record<string, unknown> = {
    startTime: points[0]?.timestamp,
    totalTimerTime: totalLapTime || samples.at(-1)?.elapsedSec,
    totalDistance: totalLapDistance || (distanceFromTrack ? distanceFromTrack * 1000 : undefined),
    totalCalories: laps.reduce((total, lap) => total + (lap.calories ?? 0), 0) || undefined,
    avgHeartRate: averageOf(points.map((point) => point.heartRate)) ?? averageOf(laps.map((lap) => lap.avgHeartRate)),
    maxHeartRate: Math.max(...points.map((point) => point.heartRate ?? 0), ...laps.map((lap) => lap.maxHeartRate ?? 0), 0) || undefined,
    avgRunningCadence: averageOf(points.map((point) => point.cadence)),
    totalAscent: elevation.ascent || undefined,
    totalDescent: elevation.descent || undefined,
    avgTemperature: averageOf(points.map((point) => point.temperatureC)),
  };
  const preview = metricFields(session, samples, sourceFormat);
  preview.garminDetails.rawSampleCount = points.length;
  preview.laps = laps.map((lap, index) => {
    const durationSec = lap.totalTimeSec ?? null;
    const distanceKm = lap.distanceM !== undefined ? Number((lap.distanceM / 1000).toFixed(3)) : null;
    return {
      lap: index + 1,
      durationSec: durationSec ? Math.round(durationSec) : null,
      distanceKm,
      avgPace: durationSec && distanceKm && distanceKm > 0 ? decimalPace(durationSec / distanceKm) ?? null : null,
    };
  });
  if (!points.length) preview.warnings.push(`${sourceFormat} 檔未包含有效的時間軌跡點；請確認這是活動記錄而不是路線規劃檔。`);
  if (sourceFormat === "GPX") preview.warnings.push("GPX 標準可包含時間與海拔，但心率、步頻及功率會視 Garmin 擴充欄位是否存在而定。");
  if (sourceFormat === "TCX" && !preview.laps.length) preview.warnings.push("此 TCX 沒有完整 Lap 資訊；已保留可讀取的逐點時間序列。 ");
  if (!lastPoint) preview.warnings.push("請先核對摘要，再將原始檔套用到這次跑步。 ");
  return preview;
}

/**
 * Strict SAX parser for accepted GPX and TCX activity exports. It does not fetch
 * external entities, rejects DTD declarations, and maps only fitness metrics
 * required by the reviewed running-record contract.
 */
function parseActivityXml(buffer: Buffer, sourceFormat: "GPX" | "TCX"): GarminRawPreview {
  const source = buffer.toString("utf8");
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error("GPX／TCX 檔不可包含外部實體或 DTD 宣告");

  const parser = sax.parser(true, { trim: true, normalize: false, position: false });
  const points: XmlPoint[] = [];
  const laps: XmlLap[] = [];
  const tagStack: string[] = [];
  let rootName = "";
  let activePoint: Partial<XmlPoint> | null = null;
  let activeLap: Partial<XmlLap> | null = null;
  let currentText = "";
  parser.onerror = (error) => { throw error; };
  parser.ondoctype = () => {
    throw new Error("GPX／TCX 檔不可包含 DTD 宣告");
  };
  parser.onopentag = (tag) => {
    const name = localName(tag.name);
    tagStack.push(name);
    currentText = "";
    if (!rootName) rootName = name;
    if ((sourceFormat === "GPX" && name === "trkpt") || (sourceFormat === "TCX" && name === "trackpoint")) {
      activePoint = {
        latitude: parseXmlNumber(xmlAttribute(tag, "lat")),
        longitude: parseXmlNumber(xmlAttribute(tag, "lon")),
      };
    }
    if (sourceFormat === "TCX" && name === "lap") {
      activeLap = { startedAt: parseXmlDate(xmlAttribute(tag, "starttime")) };
    }
  };
  parser.ontext = (text) => { currentText += text; };
  parser.oncdata = (text) => { currentText += text; };
  parser.onclosetag = (rawName) => {
    const name = localName(rawName);
    const parent = tagStack.at(-2) ?? "";
    const grandparent = tagStack.at(-3) ?? "";
    const value = currentText.trim();

    if (activePoint && value) {
      if (name === "time") activePoint.timestamp = parseXmlDate(value);
      if (name === "ele" || name === "altitudemeters") activePoint.altitudeM = parseXmlNumber(value);
      if (name === "distancemeters") activePoint.distanceM = parseXmlNumber(value);
      if ((name === "value" && (parent === "heartratebpm" || grandparent === "heartratebpm")) || name === "hr") activePoint.heartRate = parseXmlNumber(value);
      if (name === "cadence" || name === "runcadence" || name === "cad") activePoint.cadence = parseXmlNumber(value);
      if (name === "watts" || name === "power") activePoint.power = parseXmlNumber(value);
      if (name === "atemp" || name === "temperature") activePoint.temperatureC = parseXmlNumber(value);
    }

    if (activeLap && value) {
      if (name === "totaltimeseconds") activeLap.totalTimeSec = parseXmlNumber(value);
      if (name === "distancemeters") activeLap.distanceM = parseXmlNumber(value);
      if (name === "calories") activeLap.calories = parseXmlNumber(value);
      if (name === "value" && (parent === "averageheartratebpm" || grandparent === "averageheartratebpm")) activeLap.avgHeartRate = parseXmlNumber(value);
      if (name === "value" && (parent === "maximumheartratebpm" || grandparent === "maximumheartratebpm")) activeLap.maxHeartRate = parseXmlNumber(value);
    }

    if ((sourceFormat === "GPX" && name === "trkpt") || (sourceFormat === "TCX" && name === "trackpoint")) {
      if (activePoint?.timestamp) points.push(activePoint as XmlPoint);
      activePoint = null;
    }
    if (sourceFormat === "TCX" && name === "lap") {
      laps.push(activeLap ?? {});
      activeLap = null;
    }
    tagStack.pop();
    currentText = "";
  };

  try {
    parser.write(source).close();
  } catch (error) {
    throw new Error(`無法讀取 ${sourceFormat} XML：${error instanceof Error ? error.message : "檔案格式不正確"}`);
  }
  if (sourceFormat === "GPX" && rootName !== "gpx") throw new Error("這不是有效的 GPX 活動檔");
  if (sourceFormat === "TCX" && rootName !== "trainingcenterdatabase") throw new Error("這不是有效的 TCX 活動檔");
  return xmlPreview(points, laps, sourceFormat);
}

export function parseGarminGpx(buffer: Buffer): GarminRawPreview {
  return parseActivityXml(buffer, "GPX");
}

export function parseGarminTcx(buffer: Buffer): GarminRawPreview {
  return parseActivityXml(buffer, "TCX");
}

export function parseGarminRawFile(buffer: Buffer, filename: string): GarminRawPreview {
  if (buffer.length > 25 * 1024 * 1024) throw new Error("原始 Garmin 檔案超過 25MB 限制");
  if (/\.fit$/i.test(filename)) return parseGarminFit(buffer);
  if (/\.csv$/i.test(filename)) return parseGarminCsv(buffer);
  if (/\.gpx$/i.test(filename)) return parseGarminGpx(buffer);
  if (/\.tcx$/i.test(filename)) return parseGarminTcx(buffer);
  throw new Error("請選擇 Garmin FIT、CSV、GPX 或 TCX 原始檔");
}
