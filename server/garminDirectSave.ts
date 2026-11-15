import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { parseGarminRawFile } from "./garminFileImport";
import { storageReadBuffer } from "./storage";
import { ensureSheetHeaders, writeRowToSheet } from "./sheetsService";
import { prepareGarminGpsWeather } from "./garminGpsWeather";

type GarminPreview = ReturnType<typeof parseGarminRawFile>;
type RunningRow = Record<string, unknown> & { id: number; date: string };

export type GarminDirectSaveInput = {
  fileKey: string;
  fileName: string;
  mimeType?: string;
  runningLogId?: number;
};

export type GarminDirectSaveResult = {
  id: number;
  action: "created" | "attached" | "duplicate";
  date: string;
  sampleCount: number;
  fields: Record<string, string>;
  garminDetails: GarminPreview["garminDetails"];
  laps: GarminPreview["laps"];
  timeSeries: GarminPreview["timeSeries"];
  syncWarning?: string;
};

// Keep this allowlist in sync with the running form, never with arbitrary input
// keys. Nulls must become empty strings, not form defaults (e.g. Easy / Road).
const SUMMARY_COLUMNS = {
  date: "date",
  runningType: "running_type",
  routeType: "route_type",
  runningShoes: "running_shoes",
  distanceKm: "distance_km",
  hour: "hour",
  minutes: "minutes",
  second: "second",
  averagePace: "average_pace",
  bestPace: "best_pace",
  averageHeartRate: "average_heart_rate",
  maximumHeartRate: "maximum_heart_rate",
  averageCadence: "average_cadence",
  maxCadence: "max_cadence",
  avgStrideLengthM: "avg_stride_length_m",
  avgVerticalRatio: "avg_vertical_ratio",
  verticalOscillationCm: "vertical_oscillation_cm",
  avgGroundContactTimeMs: "avg_ground_contact_time_ms",
  calories: "calories",
  temperature: "temperature",
  humidity: "humidity",
  windSpeed: "wind_speed",
  apparentTemp: "apparent_temp",
  precipitation: "precipitation",
  weatherCode: "weather_code",
  weatherCondition: "weather_condition",
  weatherLocation: "weather_location",
  weatherObservedAt: "weather_observed_at",
  weatherSource: "weather_source",
  notes: "notes",
} as const;

const ROW_COLUMNS = sql.raw(`id, ${Object.values(SUMMARY_COLUMNS).map(column => column === "date" ? "date::text AS date" : column).join(", ")}, garmin_details, laps, time_series`);
const INTEGER_FIELDS = new Set(["hour", "minutes", "second", "averageHeartRate", "maximumHeartRate", "calories", "weatherCode"]);
const TEXT_FIELDS = new Set(["date", "runningType", "routeType", "runningShoes", "averagePace", "bestPace", "weatherCondition", "weatherLocation", "weatherObservedAt", "weatherSource", "notes"]);
const AMBIGUOUS_MATCH = "同日有多筆相近跑步紀錄，無法安全判斷；請開啟要附加的歷史紀錄，按「編輯」後重新上載原始檔。";

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Strict calendar validation: JS Date alone silently normalises February 30. */
export function isValidGarminDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateGarminSummary(fields: Record<string, string>) {
  if (!isValidGarminDate(fields.date)) throw new Error("原始檔缺少有效的香港活動日期；不會以今天日期建立紀錄，請重新匯出 Garmin 原始檔。");
  const distanceKm = finiteNumber(fields.distanceKm);
  const parts = [fields.hour, fields.minutes, fields.second].map(value => value === undefined ? 0 : finiteNumber(value));
  if (parts.some(value => value === null || value < 0)) throw new Error("原始檔的跑步時間無效，未建立紀錄。");
  const durationSec = (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  if (distanceKm === null || distanceKm <= 0 || !Number.isFinite(durationSec) || durationSec <= 0) {
    throw new Error("原始檔必須包含大於零的距離及跑步時間，未建立紀錄；請使用完整的 Garmin 活動原始檔。");
  }
  return { date: fields.date, distanceKm, durationSec };
}

type GarminTimestampWindow = {
  firstTimestamp?: unknown;
  lastTimestamp?: unknown;
  activityWindowVerified?: unknown;
  activityTimeBasis?: unknown;
};

export type GarminHistoryCandidate = GarminTimestampWindow & {
  id: number;
  date: string;
  distanceKm: unknown;
  durationSec: unknown;
};

// Require unambiguous absolute timestamps, not local times or filename hints.
// Date.parse alone also silently normalises invalid calendar dates.
function timestampMillis(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parts = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/i);
  if (!parts || !isValidGarminDate(parts[1]) || Number(parts[2]) > 23 || Number(parts[3]) > 59 || Number(parts[4]) > 59) return null;
  if (parts[5].toUpperCase() !== "Z" && (Number(parts[5].slice(1, 3)) > 23 || Number(parts[5].slice(4)) > 59)) return null;
  const millis = Date.parse(value);
  return Number.isFinite(millis) ? millis : null;
}

function validActivityWindow(activity: GarminTimestampWindow & { date: string }) {
  const first = timestampMillis(activity.firstTimestamp);
  const last = timestampMillis(activity.lastTimestamp);
  if (String(activity.activityWindowVerified) !== "1" || !["fit-session-elapsed", "fit-session-timestamp"].includes(String(activity.activityTimeBasis))
    || first === null || last === null || first >= last || !isValidGarminDate(activity.date)) return null;
  const hongKongDate = new Date(first + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return hongKongDate === activity.date ? { first, last } : null;
}

function definitelyDistinct(candidate: GarminHistoryCandidate, summary: GarminTimestampWindow & { date: string }) {
  const existing = validActivityWindow(candidate);
  const incoming = validActivityWindow(summary);
  return existing !== null && incoming !== null
    && (incoming.first - existing.last >= 60_000 || existing.first - incoming.last >= 60_000);
}

/** Conservative, order-independent matching. Never choose the 'nearest' of two. */
export function selectGarminHistoryMatch(
  candidates: GarminHistoryCandidate[],
  summary: GarminTimestampWindow & { date: string; distanceKm: number; durationSec: number },
): GarminHistoryCandidate | null {
  // Only trustworthy, clearly separated windows can rule out same-day history.
  // Missing, invalid, overlapping or near windows retain the old safeguards.
  const possible = candidates.filter(candidate => candidate.date === summary.date && !definitelyDistinct(candidate, summary));
  if (possible.some(candidate => (
    (finiteNumber(candidate.distanceKm) ?? 0) <= 0 || (finiteNumber(candidate.durationSec) ?? 0) <= 0
  ))) throw new Error("同日有缺少距離或時間的跑步紀錄，無法安全判斷是否重複；請開啟要附加的歷史紀錄，按「編輯」後重新上載原始檔。");
  const matches = possible.filter(candidate => {
    const distance = finiteNumber(candidate.distanceKm);
    const duration = finiteNumber(candidate.durationSec);
    // Permit summary rounding and small timer/GPS differences, but require BOTH.
    return candidate.date === summary.date && distance !== null && distance > 0 && duration !== null && duration > 0
      && Math.abs(distance - summary.distanceKm) <= Math.max(0.1, summary.distanceKm * 0.02)
      && Math.abs(duration - summary.durationSec) <= Math.max(60, summary.durationSec * 0.02);
  });
  if (matches.length > 1) throw new Error(AMBIGUOUS_MATCH);
  return matches[0] ?? null;
}

function jsonObject(value: unknown): GarminPreview["garminDetails"] {
  if (typeof value === "string") {
    try { return jsonObject(JSON.parse(value)); } catch { return {}; }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value as GarminPreview["garminDetails"] : {};
}

function jsonArray<T>(value: unknown): T[] {
  if (typeof value === "string") {
    try { return jsonArray<T>(JSON.parse(value)); } catch { return []; }
  }
  return Array.isArray(value) ? value : [];
}

function timeSeriesWindow(timeSeries: GarminPreview["timeSeries"]): GarminTimestampWindow {
  return { firstTimestamp: timeSeries[0]?.timestamp, lastTimestamp: timeSeries[timeSeries.length - 1]?.timestamp };
}

function canonicalWindow(details: GarminPreview["garminDetails"]): GarminTimestampWindow {
  return {
    firstTimestamp: details.activityStartTimestamp, lastTimestamp: details.activityEndTimestamp,
    activityWindowVerified: details.activityWindowVerified, activityTimeBasis: details.activityTimeBasis,
  };
}

function agreesWithSampleBounds(window: GarminTimestampWindow & { date: string }, firstRaw: unknown, lastRaw: unknown): boolean {
  const verified = validActivityWindow(window);
  const first = timestampMillis(firstRaw);
  const last = timestampMillis(lastRaw);
  return verified !== null && first !== null && last !== null && first <= last
    && first >= verified.first && last <= verified.last && first - verified.first <= 5000 && verified.last - last <= 5000;
}

function describeExistingSource(row: RunningRow): string {
  const details = jsonObject(row.garmin_details);
  const window = timeSeriesWindow(jsonArray<GarminPreview["timeSeries"][number]>(row.time_series));
  const first = timestampMillis(window.firstTimestamp);
  const last = timestampMillis(window.lastTimestamp);
  const time = first !== null && last !== null && first <= last
    ? `${window.firstTimestamp} 至 ${window.lastTimestamp}` : "未記錄有效活動時間";
  return `紀錄 #${row.id}（${row.date}；檔案：${details.rawFileName || details.rawFileKey || "未記錄檔名"}${details.rawFileFormat ? ` [${details.rawFileFormat}]` : ""}；活動時間：${time}）`;
}

function resultFromRow(row: RunningRow, action: GarminDirectSaveResult["action"]): GarminDirectSaveResult {
  const fields: Record<string, string> = {};
  for (const [field, column] of Object.entries(SUMMARY_COLUMNS)) fields[field] = row[column] === null || row[column] === undefined ? "" : String(row[column]);
  fields.weatherTime = fields.weatherObservedAt.match(/T(\d{2}:\d{2})/)?.[1] ?? "";
  const timeSeries = jsonArray<GarminPreview["timeSeries"][number]>(row.time_series);
  return {
    id: Number(row.id), action, date: fields.date, sampleCount: timeSeries.length, fields,
    garminDetails: jsonObject(row.garmin_details),
    laps: jsonArray<GarminPreview["laps"][number]>(row.laps), timeSeries,
  };
}

function rowsFrom(result: unknown): RunningRow[] {
  return (result as { rows: RunningRow[] }).rows;
}

/** Router must validate the original object key before calling this service. */
export async function saveGarminImport(input: GarminDirectSaveInput): Promise<GarminDirectSaveResult> {
  // Re-read and re-parse trusted object storage, never persist client preview data.
  const buffer = await storageReadBuffer(input.fileKey);
  const preview = parseGarminRawFile(buffer, input.fileName);
  if (!input.fileKey.toLowerCase().endsWith(`.${preview.sourceFormat.toLowerCase()}`)) throw new Error("原始檔格式與副檔名不一致");
  const parsedWindow = timeSeriesWindow(preview.timeSeries);
  const summary = { ...validateGarminSummary(preview.fields), ...canonicalWindow(preview.garminDetails) };
  if (!agreesWithSampleBounds(summary, parsedWindow.firstTimestamp, parsedWindow.lastTimestamp)) summary.activityWindowVerified = 0;
  const rawFileHash = createHash("sha256").update(buffer).digest("hex");
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Network lookups never hold date/hash transaction locks or prevent a source save.
  const gpsWeather = await prepareGarminGpsWeather(preview);

  const result = await db.transaction(async tx => {
    // PostgreSQL transaction-scoped locks work across server instances. Truncate
    // only the lock key to signed 64 bits; compare the full SHA256 for identity.
    const hashLock = BigInt.asIntN(64, BigInt(`0x${rawFileHash.slice(0, 16)}`)).toString();
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${hashLock}::bigint)`);
    // Also serialize distinct encodings of the same day's activity so concurrent
    // uploads cannot both observe 'no history' and create separate records.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`garmin-date:${summary.date}`}, 0))`);

    const duplicates = rowsFrom(await tx.execute(sql`
      SELECT ${ROW_COLUMNS} FROM running_logs
      WHERE garmin_details->>'rawFileHash' = ${rawFileHash}
      ORDER BY id LIMIT 2 FOR UPDATE
    `));
    if (duplicates.length > 1) throw new TRPCError({ code: "CONFLICT", message: `相同原始檔已連結多筆紀錄：${duplicates.map(describeExistingSource).join("、")}；請先檢查歷史紀錄，本次未更改資料。` });
    if (duplicates[0]) {
      if (input.runningLogId !== undefined && Number(duplicates[0].id) !== input.runningLogId) {
        throw new TRPCError({ code: "CONFLICT", message: `這個 Garmin 原始檔已連結另一筆跑步紀錄：${describeExistingSource(duplicates[0])}，不能覆蓋目前選取的紀錄；請開啟已連結的紀錄查看或編輯，本次未更改資料。` });
      }
      if (duplicates[0].date !== summary.date) throw new Error("原始檔的香港活動日期與已連結紀錄不符，未更改資料。");
      return resultFromRow(duplicates[0], "duplicate");
    }

    let target: RunningRow | undefined;
    if (input.runningLogId !== undefined) {
      target = rowsFrom(await tx.execute(sql`SELECT ${ROW_COLUMNS} FROM running_logs WHERE id = ${input.runningLogId} LIMIT 1 FOR UPDATE`))[0];
      if (!target) throw new Error("找不到要附加的跑步紀錄，請重新開啟歷史紀錄。");
      if (target.date !== summary.date) throw new Error(`原始檔的香港活動日期（${summary.date}）與所選紀錄（${target.date}）不符，未附加檔案；請編輯正確的歷史紀錄。`);
    } else {
      const history = rowsFrom(await tx.execute(sql`
        SELECT id, date::text AS date, distance_km, hour, minutes, second,
          time_series->0->>'timestamp' AS first_timestamp,
          time_series->-1->>'timestamp' AS last_timestamp,
          garmin_details->>'activityStartTimestamp' AS activity_start_timestamp,
          garmin_details->>'activityEndTimestamp' AS activity_end_timestamp,
          garmin_details->>'activityWindowVerified' AS activity_window_verified,
          garmin_details->>'activityTimeBasis' AS activity_time_basis,
          garmin_details->>'rawFileKey' AS raw_file_key,
          garmin_details->>'rawFileHash' AS raw_file_hash FROM running_logs
        WHERE date = ${summary.date} ORDER BY id LIMIT 101 FOR UPDATE
      `));
      if (history.length > 100) throw new Error(AMBIGUOUS_MATCH);
      const candidates = history.map(row => ({
        id: Number(row.id), date: row.date, distanceKm: row.distance_km,
        durationSec: (finiteNumber(row.hour) ?? 0) * 3600 + (finiteNumber(row.minutes) ?? 0) * 60 + (finiteNumber(row.second) ?? 0),
        firstTimestamp: row.activity_start_timestamp, lastTimestamp: row.activity_end_timestamp,
        activityWindowVerified: row.activity_window_verified, activityTimeBasis: row.activity_time_basis,
      }));
      let sourceReads = 0;
      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        const row = history[index];
        if (agreesWithSampleBounds(candidate, row.first_timestamp, row.last_timestamp)) continue;
        candidate.activityWindowVerified = 0;
        const distance = finiteNumber(candidate.distanceKm);
        const duration = finiteNumber(candidate.durationSec);
        // Legacy sample endpoints are not proof of a full session. Only re-read
        // close summaries with a hash-verifiable original, at most 20 per save.
        if (!validActivityWindow(summary) || distance === null || duration === null
          || Math.abs(distance - summary.distanceKm) > Math.max(0.1, summary.distanceKm * 0.02)
          || Math.abs(duration - summary.durationSec) > Math.max(60, summary.durationSec * 0.02)
          || typeof row.raw_file_key !== "string" || !row.raw_file_key
          || typeof row.raw_file_hash !== "string" || !/^[a-f0-9]{64}$/i.test(row.raw_file_hash)) continue;
        if (sourceReads >= 20) continue;
        sourceReads += 1;
        try {
          const existingBytes = await storageReadBuffer(row.raw_file_key);
          if (createHash("sha256").update(existingBytes).digest("hex") !== row.raw_file_hash.toLowerCase()) continue;
          const existingPreview = parseGarminRawFile(existingBytes, row.raw_file_key);
          const verified = { ...canonicalWindow(existingPreview.garminDetails), date: row.date };
          const bounds = timeSeriesWindow(existingPreview.timeSeries);
          if (existingPreview.fields.date === row.date && agreesWithSampleBounds(verified, bounds.firstTimestamp, bounds.lastTimestamp)) Object.assign(candidate, verified);
        } catch {
          // Missing source, storage/parse failure or partial FIT stays uncertain.
          // Never modify legacy metadata just to make matching possible.
        }
      }
      const match = selectGarminHistoryMatch(candidates, summary);
      if (match) target = rowsFrom(await tx.execute(sql`SELECT ${ROW_COLUMNS} FROM running_logs WHERE id = ${match.id} LIMIT 1 FOR UPDATE`))[0];
      if (match && !target) throw new Error("跑步紀錄已變更，請重新開啟歷史紀錄後再試。");
    }

    if (target) {
      const existingDetails = jsonObject(target.garmin_details);
      const existingHash = existingDetails.rawFileHash;
      if ((existingHash && existingHash !== rawFileHash) || (!existingHash && (existingDetails.rawFileKey || jsonArray(target.time_series).length > 0))) {
        throw new TRPCError({ code: "CONFLICT", message: `${describeExistingSource(target)}已連結不同的 Garmin 原始檔或尚未驗證來源的曲線，為免覆蓋現有曲線，本次未更改資料；請開啟該歷史紀錄檢查現有檔案，並選擇正確的紀錄或原始檔重新上載。` });
      }
    }
    const metadata = {
      ...preview.garminDetails,
      rawFileKey: input.fileKey, rawFileUrl: `/manus-storage/${input.fileKey}`,
      rawFileName: input.fileName, rawFileFormat: preview.sourceFormat,
      rawSampleCount: preview.garminDetails.rawSampleCount ?? preview.timeSeries.length,
      rawFileHash,
      rawActivityFirstTimestamp: parsedWindow.firstTimestamp,
      rawActivityLastTimestamp: parsedWindow.lastTimestamp,
      activityWindowVerified: validActivityWindow(summary) ? 1 : 0,
    };
    if (target) {
      // Deliberately no summary, shoes/FK, weather, notes, status or race writes.
      const updated = rowsFrom(await tx.execute(sql`
        UPDATE running_logs SET
          garmin_details = COALESCE(garmin_details, '{}'::jsonb) || ${JSON.stringify(metadata)}::jsonb,
          laps = ${JSON.stringify(preview.laps)}::jsonb,
          time_series = ${JSON.stringify(preview.timeSeries)}::jsonb
        WHERE id = ${Number(target.id)} RETURNING ${ROW_COLUMNS}
      `))[0];
      if (!updated) throw new Error("未能附加 Garmin 資料，請重試。");
      return resultFromRow(updated, "attached");
    }

    // Create only from the validated file summary, including running dynamics.
    const fields: Record<string, string> = { ...preview.fields, ...gpsWeather.fields,
      hour: String(Math.floor(summary.durationSec / 3600)),
      minutes: String(Math.floor(summary.durationSec % 3600 / 60)),
      second: String(Math.round(summary.durationSec % 60)),
    };
    const entries = Object.entries(SUMMARY_COLUMNS);
    const values = entries.map(([field]) => {
      const value = fields[field];
      if (TEXT_FIELDS.has(field)) return value ?? null;
      const number = finiteNumber(value);
      return number !== null && INTEGER_FIELDS.has(field) ? Math.round(number) : number;
    });
    const inserted = rowsFrom(await tx.execute(sql`
      INSERT INTO running_logs (${sql.raw(entries.map(([, column]) => column).join(", "))}, garmin_details, laps, time_series)
      VALUES (${sql.join(values.map(value => sql`${value}`), sql`, `)},
        ${JSON.stringify({ ...metadata, ...gpsWeather.metadata })}::jsonb, ${JSON.stringify(preview.laps)}::jsonb, ${JSON.stringify(preview.timeSeries)}::jsonb)
      RETURNING ${ROW_COLUMNS}
    `))[0];
    if (!inserted) throw new Error("未能建立 Garmin 跑步紀錄，請重試。");
    return resultFromRow(inserted, "created");
  });

  // Only new summaries are appended. Historical attachments must not rewrite or
  // duplicate the manually curated Sheets summary. Never fail a committed save.
  if (result.action === "created") {
    try {
      await ensureSheetHeaders("running");
      const sheetFields = Object.fromEntries(Object.entries(result.fields).filter(([, value]) => value !== ""));
      await writeRowToSheet("running", { ...sheetFields, garminDetails: result.garminDetails, laps: result.laps });
    } catch (error) {
      console.warn("[Sheets] Garmin run committed but Sheets sync failed:", error instanceof Error ? error.message : error);
      result.syncWarning = "跑步紀錄及 Garmin 原始資料已儲存，但 Google Sheets 同步未完成；請稍後檢查試算表，勿重複建立紀錄。";
    }
  }
  return result;
}
