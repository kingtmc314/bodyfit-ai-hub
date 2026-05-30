/**
 * Server-side Hong Kong Timezone Utilities (UTC+8)
 * Use these helpers for all date-based queries to ensure
 * "today", "this week" etc. are computed in HK local time.
 */

const HK_OFFSET_MS = 8 * 60 * 60 * 1000; // UTC+8 = +8h

/**
 * Get today's date string in HK timezone as "YYYY-MM-DD".
 */
export function todayHK(): string {
  const now = new Date();
  const hkNow = new Date(now.getTime() + HK_OFFSET_MS);
  return hkNow.toISOString().slice(0, 10);
}

/**
 * Get a date string N days ago in HK timezone as "YYYY-MM-DD".
 */
export function daysAgoHK(days: number): string {
  const now = new Date();
  const hkNow = new Date(now.getTime() + HK_OFFSET_MS - days * 24 * 60 * 60 * 1000);
  return hkNow.toISOString().slice(0, 10);
}

/**
 * Convert a "YYYY-MM-DD" HK date string to UTC Date range [start, end].
 * start = HK midnight = UTC 16:00 previous day
 * end   = HK 23:59:59 = UTC 15:59:59 same day
 */
export function hkDateToUTCRange(dateStr: string): { start: Date; end: Date } {
  // Parse the HK date as HK midnight
  const [year, month, day] = dateStr.split("-").map(Number);
  // HK midnight in UTC = UTC midnight - 8h
  const startUTC = new Date(Date.UTC(year, month - 1, day) - HK_OFFSET_MS);
  const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start: startUTC, end: endUTC };
}

/**
 * Convert a UTC Date to HK date string "YYYY-MM-DD".
 */
export function toHKDateString(date: Date): string {
  const hkDate = new Date(date.getTime() + HK_OFFSET_MS);
  return hkDate.toISOString().slice(0, 10);
}
