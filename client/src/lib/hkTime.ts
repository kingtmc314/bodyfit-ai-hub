/**
 * Hong Kong Timezone Utilities (UTC+8)
 * All date display in the app should use these helpers to ensure
 * dates are shown in Hong Kong local time (Asia/Hong_Kong, UTC+8).
 *
 * IMPORTANT: The database stores dates as plain "YYYY-MM-DD" strings that
 * already represent HK local dates. These must NOT be fed through timezone
 * conversion (new Date("YYYY-MM-DD") parses as UTC midnight, which is correct
 * for display but the formatHKDate functions must treat them as local HK dates).
 * Use parseDateStr() to safely parse such strings.
 */

const HK_TIMEZONE = "Asia/Hong_Kong";
const HK_OFFSET_MS = 8 * 60 * 60 * 1000; // UTC+8

/**
 * Detect if the input is a plain "YYYY-MM-DD" date string.
 */
function isDateOnlyString(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/**
 * Parse a "YYYY-MM-DD" string into { year, month, day } without any timezone shift.
 * The string is already the HK local date.
 */
function parseDateStr(s: string): { year: number; month: number; day: number } {
  const [year, month, day] = s.split("-").map(Number);
  return { year, month, day };
}

/**
 * Get the current date/time in HK timezone as a Date object.
 */
export function nowHK(): Date {
  const now = new Date();
  return new Date(now.getTime() + HK_OFFSET_MS - now.getTimezoneOffset() * 60000);
}

/**
 * Format a UTC timestamp (ms) or Date as a date string in HK timezone.
 * Returns "YYYY-MM-DD" format.
 * For plain "YYYY-MM-DD" strings, returns them as-is (already HK date).
 */
export function toHKDateString(date: Date | string | number | null | undefined): string {
  if (!date) return "";
  // Plain date strings are already HK dates — return as-is
  if (isDateOnlyString(date)) return date;
  const d = new Date(date as any);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: HK_TIMEZONE }); // en-CA gives YYYY-MM-DD
}

/**
 * Format a date as a human-readable HK date, e.g. "30/05/2026".
 * For plain "YYYY-MM-DD" strings (already HK dates), formats directly.
 * For timestamps/Date objects, converts to HK timezone first.
 */
export function formatHKDate(
  date: Date | string | number | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return "";

  if (isDateOnlyString(date)) {
    // Already a HK date string — format directly without timezone conversion
    const { year, month, day } = parseDateStr(date);
    const defaults: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      ...options,
    };
    // Use a fixed UTC date to avoid any local-timezone shift during formatting
    const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)); // noon UTC, safe from DST
    return d.toLocaleDateString("zh-HK", { timeZone: "UTC", ...defaults });
  }

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
 * For plain "YYYY-MM-DD" strings, formats directly.
 */
export function formatHKShortDate(date: Date | string | number | null | undefined): string {
  if (!date) return "";

  if (isDateOnlyString(date)) {
    const { year, month, day } = parseDateStr(date);
    const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return d.toLocaleDateString("en-US", {
      timeZone: "UTC",
      month: "2-digit",
      day: "2-digit",
    });
  }

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
  return new Date().toLocaleDateString("en-CA", { timeZone: HK_TIMEZONE });
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
