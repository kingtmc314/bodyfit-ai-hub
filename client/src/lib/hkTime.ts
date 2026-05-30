/**
 * Hong Kong Timezone Utilities (UTC+8)
 * All date display in the app should use these helpers to ensure
 * dates are shown in Hong Kong local time (Asia/Hong_Kong, UTC+8).
 */

const HK_TIMEZONE = "Asia/Hong_Kong";
const HK_OFFSET_MS = 8 * 60 * 60 * 1000; // UTC+8

/**
 * Get the current date/time in HK timezone as a Date object.
 * The returned Date's UTC values represent HK local time.
 */
export function nowHK(): Date {
  const now = new Date();
  // Shift to HK local time
  return new Date(now.getTime() + HK_OFFSET_MS - now.getTimezoneOffset() * 60000);
}

/**
 * Format a UTC timestamp (ms) or Date as a date string in HK timezone.
 * Returns "YYYY-MM-DD" format.
 */
export function toHKDateString(date: Date | string | number | null | undefined): string {
  if (!date) return "";
  const d = new Date(date as any);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: HK_TIMEZONE }); // en-CA gives YYYY-MM-DD
}

/**
 * Format a UTC timestamp as a human-readable date in HK timezone.
 * e.g. "2026-05-30" or "May 30, 2026"
 */
export function formatHKDate(
  date: Date | string | number | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return "";
  const d = new Date(date as any);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("zh-HK", {
    timeZone: HK_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...options,
  });
}

/**
 * Format a UTC timestamp as a short date (MM/DD) in HK timezone.
 */
export function formatHKShortDate(date: Date | string | number | null | undefined): string {
  if (!date) return "";
  const d = new Date(date as any);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    timeZone: HK_TIMEZONE,
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * Format a UTC timestamp as date + time in HK timezone.
 * e.g. "2026-05-30 14:30"
 */
export function formatHKDateTime(date: Date | string | number | null | undefined): string {
  if (!date) return "";
  const d = new Date(date as any);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-HK", {
    timeZone: HK_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Get today's date string in HK timezone as "YYYY-MM-DD".
 * Use this for default date inputs.
 */
export function todayHKString(): string {
  return toHKDateString(new Date());
}

/**
 * Parse a "YYYY-MM-DD" date string as a HK midnight timestamp (UTC ms).
 * Use this when saving a date-only value from a date input.
 */
export function hkDateStringToUTC(dateStr: string): number {
  // dateStr is "YYYY-MM-DD" in HK time → convert to UTC ms
  const [year, month, day] = dateStr.split("-").map(Number);
  // HK midnight = UTC midnight - 8h
  return Date.UTC(year, month - 1, day) - HK_OFFSET_MS;
}

/**
 * Format a date for chart X-axis labels (short, e.g. "05/30").
 */
export function formatHKChartDate(date: Date | string | number | null | undefined): string {
  return formatHKShortDate(date);
}
