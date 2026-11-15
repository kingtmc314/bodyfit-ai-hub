import { TRPCError } from "@trpc/server";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { fetchRunningGpsWeather } from "./runningGpsWeather";
import { storageReadBuffer } from "./storage";
import { parseGarminRawFile } from "./garminFileImport";
import type { RunningGpsWeatherInput } from "../shared/runningGpsWeather";

/** Legacy personal running table has no user_id; router remains owner-scoped. */
export async function loadRunningGpsWeatherForId(id: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "未能讀取跑步 GPS 資料；没有改寫紀錄。" });
  const result = await db.execute(sql`SELECT id, garmin_details, time_series FROM running_logs WHERE id = ${id} LIMIT 1`);
  const row = (result as unknown as { rows: Array<{ id: number; garmin_details: unknown; time_series: unknown }> }).rows[0];
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "找不到指定跑步紀錄。" });
  const input: RunningGpsWeatherInput = { timeSeries: row.time_series, garminDetails: row.garmin_details };
  let details: Record<string, unknown> = {};
  try {
    const raw = typeof row.garmin_details === "string" ? JSON.parse(row.garmin_details) : row.garmin_details;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) details = raw;
  } catch { /* Original invalid metadata remains unknown. */ }
  // Old FIT rows may predate verified activity-window metadata. Re-read only a
  // hash-verifiable owned source; derive weather from it without backfilling the row.
  if (![1, true].includes(details.activityWindowVerified as number | boolean)
    && typeof details.rawFileKey === "string" && /^garmin-originals\/2\/[A-Za-z0-9_./-]+\.(fit|gpx|tcx|csv)$/i.test(details.rawFileKey)
    && typeof details.rawFileHash === "string" && /^[a-f0-9]{64}$/i.test(details.rawFileHash)) {
    try {
      const bytes = await storageReadBuffer(details.rawFileKey);
      if (createHash("sha256").update(bytes).digest("hex") === details.rawFileHash.toLowerCase()) {
        const parsed = parseGarminRawFile(bytes, details.rawFileKey);
        input.timeSeries = parsed.timeSeries;
        input.garminDetails = parsed.garminDetails;
      }
    } catch { /* Missing source/network/parse failure never changes saved data. */ }
  }
  return fetchRunningGpsWeather(input);
}
