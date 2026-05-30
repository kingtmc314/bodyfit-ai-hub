/**
 * Hong Kong Timezone Utilities (UTC+8)
 *
 * KEY PRINCIPLE: All dates in this app are stored as plain "YYYY-MM-DD" strings
 * exactly as the user typed them. They must be displayed AS-IS without any
 * timezone conversion. Never pass these strings through new Date() for display.
 */

const HK_TIMEZONE = "Asia/Hong_Kong";

/**
 * Format a plain "YYYY-MM-DD" date string for display as "DD/MM/YYYY".
 * The string is already the correct HK date — no timezone conversion is done.
 * Also accepts Date objects or timestamps, converting them to HK timezone first.
 */
export function formatHKDate(
  date: Date | string | number | null | undefined,
  _options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return "";

  // Plain YYYY-MM-DD string: display directly, no timezone conversion
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split("-");
    return `${day}/${month}/${year}`;
  }

  // For Date objects or timestamps, convert to HK timezone
  const d = new Date(date as any);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("zh-HK", {
    timeZone: HK_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * Format a date for chart X-axis labels as "MM/DD".
 * For plain "YYYY-MM-DD" strings, formats directly without timezone conversion.
 */
export function formatHKShortDate(date: Date | string | number | null | undefined): string {
  if (!date) return "";

  // Plain YYYY-MM-DD string: display directly as MM/DD
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [, month, day] = date.split("-");
    return `${month}/${day}`;
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
 * Format a date for chart X-axis labels (alias for formatHKShortDate).
 */
export function formatHKChartDate(date: Date | string | number | null | undefined): string {
  return formatHKShortDate(date);
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
 * Convert a "YYYY-MM-DD" string to a "YYYY-MM-DD" string (no-op, kept for compatibility).
 * For plain date strings, returns them as-is.
 */
export function toHKDateString(date: Date | string | number | null | undefined): string {
  if (!date) return "";
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const d = new Date(date as any);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: HK_TIMEZONE });
}

/**
 * Parse a "YYYY-MM-DD" date string as a HK midnight timestamp (UTC ms).
 * Use this when saving a date-only value from a date input.
 */
export function hkDateStringToUTC(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  // HK midnight = UTC midnight - 8h
  return Date.UTC(year, month - 1, day) - 8 * 60 * 60 * 1000;
}

/**
 * Get current date/time in HK timezone as a Date object.
 */
export function nowHK(): Date {
  const now = new Date();
  const hkOffset = 8 * 60 * 60 * 1000;
  return new Date(now.getTime() + hkOffset - now.getTimezoneOffset() * 60000);
}
