import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { parseGarminRawFile } from "./garminFileImport";
import { storageReadBuffer } from "./storage";
import { ensureSheetHeaders, writeRowToSheet } from "./sheetsService";

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

export type GarminHistoryCandidate = {
  id: number;
  date: string;
  distanceKm: unknown;
  durationSec: unknown;
};

/** Conservative, order-independent matching. Never choose the 'nearest' of two. */
export function selectGarminHistoryMatch(
  candidates: GarminHistoryCandidate[],
  summary: { date: string; distanceKm: number; durationSec: number },
): GarminHistoryCandidate | null {
  if (candidates.some(candidate => candidate.date === summary.date && (
    (finiteNumber(candidate.distanceKm) ?? 0) <= 0 || (finiteNumber(candidate.durationSec) ?? 0) <= 0
  ))) throw new Error("同日有缺少距離或時間的跑步紀錄，無法安全判斷是否重複；請開啟要附加的歷史紀錄，按「編輯」後重新上載原始檔。");
  const matches = candidates.filter(candidate => {
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
  const summary = validateGarminSummary(preview.fields);
  const rawFileHash = createHash("sha256").update(buffer).digest("hex");
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

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
    if (duplicates.length > 1) throw new Error("相同原始檔已連結多筆紀錄，請先檢查歷史紀錄；本次未更改資料。");
    if (duplicates[0]) {
      if (input.runningLogId !== undefined && Number(duplicates[0].id) !== input.runningLogId) {
        throw new Error("這個 Garmin 原始檔已連結另一筆跑步紀錄，不能覆蓋目前選取的紀錄；請編輯已連結的紀錄。");
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
        SELECT id, date::text AS date, distance_km, hour, minutes, second FROM running_logs
        WHERE date = ${summary.date} ORDER BY id LIMIT 101 FOR UPDATE
      `));
      if (history.length > 100) throw new Error(AMBIGUOUS_MATCH);
      const match = selectGarminHistoryMatch(history.map(row => ({
        id: Number(row.id), date: row.date, distanceKm: row.distance_km,
        durationSec: (finiteNumber(row.hour) ?? 0) * 3600 + (finiteNumber(row.minutes) ?? 0) * 60 + (finiteNumber(row.second) ?? 0),
      })), summary);
      if (match) target = rowsFrom(await tx.execute(sql`SELECT ${ROW_COLUMNS} FROM running_logs WHERE id = ${match.id} LIMIT 1 FOR UPDATE`))[0];
      if (match && !target) throw new Error("跑步紀錄已變更，請重新開啟歷史紀錄後再試。");
    }

    if (target) {
      const existingHash = jsonObject(target.garmin_details).rawFileHash;
      if (existingHash && existingHash !== rawFileHash) throw new Error("這筆跑步紀錄已連結不同的 Garmin 原始檔，為免覆蓋現有曲線，本次未更改資料；請檢查所選歷史紀錄。");
    }
    const metadata = {
      ...preview.garminDetails,
      rawFileKey: input.fileKey, rawFileUrl: `/manus-storage/${input.fileKey}`,
      rawFileName: input.fileName, rawFileFormat: preview.sourceFormat,
      rawSampleCount: preview.garminDetails.rawSampleCount ?? preview.timeSeries.length,
      rawFileHash,
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
    const fields: Record<string, string> = { ...preview.fields,
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
        ${JSON.stringify(metadata)}::jsonb, ${JSON.stringify(preview.laps)}::jsonb, ${JSON.stringify(preview.timeSeries)}::jsonb)
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
