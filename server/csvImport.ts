/**
 * CSV Import utilities for Garmin Connect, Apple Health, and generic formats.
 * Supports: body composition, sleep, heart rate, workout/activity data.
 */

export type ImportDataType = "body" | "sleep" | "heartrate" | "workout";

export interface ParsedBodyRow {
  date: string;
  weight?: number;
  bmi?: number;
  bodyFatPct?: number;
  muscleMass?: number;
  fatMass?: number;
  bmr?: number;
  visceralFat?: number;
}

export interface ParsedSleepRow {
  date: string;
  sleepScore?: number;
  sleepDuration?: number; // hours
  deepSleep?: number; // hours
  remSleep?: number; // hours
  bodyBattery?: number;
  pulseOx?: number;
  respiration?: number;
  stress?: number;
  sleepQuality?: "Poor" | "Fair" | "Good" | "Excellent";
  restingHr?: number;
}

export interface ParsedHeartRateRow {
  date: string;
  restingHr?: number;
  highHr?: number;
  avgHr?: number;
  hrv?: number;
}

export interface ParsedWorkoutRow {
  date: string;
  activityType?: string;
  activityName?: string;
  durationMinutes?: number;
  calories?: number;
  avgHr?: number;
  maxHr?: number;
  distanceKm?: number;
  notes?: string;
}

export type ParsedRow = ParsedBodyRow | ParsedSleepRow | ParsedHeartRateRow | ParsedWorkoutRow;

/** Normalize a column header: lowercase, remove spaces/special chars */
function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Parse a date string in various formats to yyyy-MM-dd */
function parseDate(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();

  // Already yyyy-MM-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // MM/DD/YYYY or DD/MM/YYYY
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const [, a, b, year] = slashMatch;
    // Assume MM/DD/YYYY (US format, common in Garmin exports)
    const month = a.padStart(2, "0");
    const day = b.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // ISO 8601 with time: 2024-01-15T10:30:00Z
  const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoMatch) return isoMatch[1];

  // Try native Date parse as fallback
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return null;
}

function toNum(v: string | undefined): number | undefined {
  if (v === undefined || v === null || v.trim() === "" || v.trim() === "--") return undefined;
  const n = parseFloat(v.replace(/,/g, ""));
  return isNaN(n) ? undefined : n;
}

function toSleepQuality(score: number | undefined): "Poor" | "Fair" | "Good" | "Excellent" | undefined {
  if (score === undefined) return undefined;
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Poor";
}

// ─── Body Composition ────────────────────────────────────────────────────────

/**
 * Garmin Connect Weight CSV columns (from Health Stats > Weight export):
 *   Date, Time, Weight, Change, BMI, Body Fat, Skeletal Muscle Mass, Bone Mass, Body Water, WeightDate
 *
 * Generic / Withings / Xiaomi columns:
 *   date, weight, bmi, body_fat_pct, muscle_mass, fat_mass, bmr, visceral_fat
 */
export function parseBodyRow(row: Record<string, string>): ParsedBodyRow | null {
  const keys: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    keys[normalizeKey(k)] = v;
  }

  // Try to find date
  const rawDate =
    keys["date"] ||
    keys["weightdate"] ||
    keys["calendardate"] ||
    keys["datetime"] ||
    keys["time"];
  const date = rawDate ? parseDate(rawDate) : null;
  if (!date) return null;

  return {
    date,
    weight: toNum(keys["weight"] ?? keys["weightkg"] ?? keys["weightlbs"]),
    bmi: toNum(keys["bmi"]),
    bodyFatPct: toNum(keys["bodyfat"] ?? keys["bodyfatpct"] ?? keys["fatpercent"] ?? keys["fat"]),
    muscleMass: toNum(keys["skeletalmusclemass"] ?? keys["musclemass"] ?? keys["muscle"] ?? keys["leanmass"]),
    fatMass: toNum(keys["fatmass"]),
    bmr: toNum(keys["bmr"] ?? keys["basalmetabolicrate"]),
    visceralFat: toNum(keys["visceralfat"] ?? keys["visceralfatrating"]),
  };
}

// ─── Sleep ────────────────────────────────────────────────────────────────────

/**
 * Garmin Connect Sleep CSV (from Health Stats > Sleep):
 *   Date, Sleep Score, Body Battery, Pulse Ox, Respiration, Stress, Quality, Duration, Deep Sleep, REM Sleep, Resting HR
 *
 * Apple Health export (via third-party apps):
 *   date, sleep_score, total_sleep_hours, deep_sleep_hours, rem_sleep_hours, heart_rate_dip
 */
export function parseSleepRow(row: Record<string, string>): ParsedSleepRow | null {
  const keys: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    keys[normalizeKey(k)] = v;
  }

  const rawDate = keys["date"] ?? keys["calendardate"] ?? keys["datetime"];
  const date = rawDate ? parseDate(rawDate) : null;
  if (!date) return null;

  const sleepScore = toNum(keys["sleepscore"] ?? keys["score"] ?? keys["sleepquality"]);
  const rawQuality = keys["quality"] ?? keys["sleepqualitylabel"];
  let sleepQuality: "Poor" | "Fair" | "Good" | "Excellent" | undefined;
  if (rawQuality) {
    const q = rawQuality.trim();
    if (["Poor", "Fair", "Good", "Excellent"].includes(q)) {
      sleepQuality = q as "Poor" | "Fair" | "Good" | "Excellent";
    }
  }
  if (!sleepQuality && sleepScore !== undefined) {
    sleepQuality = toSleepQuality(sleepScore);
  }

  // Duration: may be in hours (e.g. "7.5") or minutes (e.g. "450") or "7h 30m"
  let sleepDuration = toNum(keys["duration"] ?? keys["sleepduration"] ?? keys["totalsleephours"] ?? keys["sleephours"]);
  if (sleepDuration !== undefined && sleepDuration > 24) {
    // Likely in minutes
    sleepDuration = sleepDuration / 60;
  }

  let deepSleep = toNum(keys["deepsleep"] ?? keys["deepsleepduration"] ?? keys["deepsleepmins"] ?? keys["deepsleepminhours"]);
  if (deepSleep !== undefined && deepSleep > 24) deepSleep = deepSleep / 60;

  let remSleep = toNum(keys["remsleep"] ?? keys["remsleepduration"] ?? keys["remsleepmins"]);
  if (remSleep !== undefined && remSleep > 24) remSleep = remSleep / 60;

  return {
    date,
    sleepScore,
    sleepDuration,
    deepSleep,
    remSleep,
    bodyBattery: toNum(keys["bodybattery"] ?? keys["bodybatteryend"]),
    pulseOx: toNum(keys["pulseox"] ?? keys["spo2"] ?? keys["bloodoxygen"]),
    respiration: toNum(keys["respiration"] ?? keys["breathingrate"] ?? keys["avgrespirationrate"]),
    stress: toNum(keys["stress"] ?? keys["avgstress"] ?? keys["stresslevel"]),
    sleepQuality,
    restingHr: toNum(keys["restinghr"] ?? keys["restingheartrate"] ?? keys["avgrestinghr"]),
  };
}

// ─── Heart Rate ───────────────────────────────────────────────────────────────

/**
 * Garmin Connect Heart Rate CSV:
 *   Date, Resting HR, High HR, Avg HR, HRV
 *
 * Apple Health:
 *   date, resting_heart_rate, heart_rate_variability
 */
export function parseHeartRateRow(row: Record<string, string>): ParsedHeartRateRow | null {
  const keys: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    keys[normalizeKey(k)] = v;
  }

  const rawDate = keys["date"] ?? keys["calendardate"] ?? keys["datetime"];
  const date = rawDate ? parseDate(rawDate) : null;
  if (!date) return null;

  return {
    date,
    restingHr: toNum(keys["restinghr"] ?? keys["restingheartrate"] ?? keys["restingbpm"] ?? keys["minheartratebeatsperminute"]),
    highHr: toNum(keys["highhr"] ?? keys["maxhr"] ?? keys["maxheartrate"] ?? keys["maxheartratebeatsperminute"] ?? keys["peakhr"]),
    avgHr: toNum(keys["avghr"] ?? keys["averageheartrate"] ?? keys["averageheartratebeatsperminute"]),
    hrv: toNum(keys["hrv"] ?? keys["lastnightavg"] ?? keys["heartratevariability"] ?? keys["sdnn"]),
  };
}

// ─── Workout / Activity ───────────────────────────────────────────────────────

/**
 * Garmin Connect Activities CSV:
 *   Activity Type, Date, Favorite, Title, Distance, Calories, Time, Avg HR, Max HR, ...
 *
 * Apple Health Workouts:
 *   workoutActivityType, startDate, endDate, duration, totalEnergyBurned, ...
 */
export function parseWorkoutRow(row: Record<string, string>): ParsedWorkoutRow | null {
  const keys: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    keys[normalizeKey(k)] = v;
  }

  const rawDate =
    keys["date"] ??
    keys["startdate"] ??
    keys["datetime"] ??
    keys["calendardate"];
  const date = rawDate ? parseDate(rawDate) : null;
  if (!date) return null;

  const activityType = (
    keys["activitytype"] ??
    keys["type"] ??
    keys["workoutactivitytype"] ??
    keys["sport"]
  )?.trim();

  const activityName = (
    keys["title"] ??
    keys["activityname"] ??
    keys["name"] ??
    keys["workoutname"]
  )?.trim();

  // Duration: may be "HH:MM:SS" or seconds or minutes
  let durationMinutes: number | undefined;
  const rawDuration =
    keys["time"] ??
    keys["duration"] ??
    keys["durationinseconds"] ??
    keys["durationminutes"] ??
    keys["elapsedtime"];

  if (rawDuration) {
    const hhmmss = rawDuration.match(/^(\d+):(\d{2}):(\d{2})$/);
    if (hhmmss) {
      durationMinutes = parseInt(hhmmss[1]) * 60 + parseInt(hhmmss[2]) + parseInt(hhmmss[3]) / 60;
    } else {
      const n = toNum(rawDuration);
      if (n !== undefined) {
        // If > 300, assume seconds; else assume minutes
        durationMinutes = n > 300 ? n / 60 : n;
      }
    }
  }

  let distanceKm: number | undefined;
  const rawDist = keys["distance"] ?? keys["distanceinmeters"] ?? keys["distancekm"];
  if (rawDist) {
    const n = toNum(rawDist);
    if (n !== undefined) {
      // If > 500, assume meters; else assume km
      distanceKm = n > 500 ? n / 1000 : n;
    }
  }

  return {
    date,
    activityType,
    activityName,
    durationMinutes: durationMinutes !== undefined ? Math.round(durationMinutes) : undefined,
    calories: toNum(keys["calories"] ?? keys["activekilocalories"] ?? keys["totalenergyburned"]),
    avgHr: toNum(keys["avghr"] ?? keys["averageheartrate"] ?? keys["averageheartratebeatsperminute"]),
    maxHr: toNum(keys["maxhr"] ?? keys["maxheartrate"] ?? keys["maxheartratebeatsperminute"]),
    distanceKm,
    notes: (keys["notes"] ?? keys["description"] ?? "")?.trim() || undefined,
  };
}

// ─── Auto-detect format ───────────────────────────────────────────────────────

/**
 * Attempt to auto-detect the data type from CSV headers.
 */
export function detectDataType(headers: string[]): ImportDataType | null {
  const normalized = headers.map(normalizeKey);
  const has = (k: string) => normalized.includes(k);
  const hasAny = (...ks: string[]) => ks.some(k => normalized.includes(k));

  // Sleep: has sleep-specific columns
  if (hasAny("sleepscore", "score", "deepsleep", "remsleep", "sleepduration", "bodybattery")) {
    return "sleep";
  }
  // Heart rate: has HR-specific columns (but not sleep)
  if (hasAny("restinghr", "restingheartrate", "hrv", "lastnightavg", "heartratevariability")) {
    return "heartrate";
  }
  // Workout: has activity type or duration with calories
  if (hasAny("activitytype", "workoutactivitytype", "sport") || (hasAny("calories", "activekilocalories") && hasAny("time", "duration", "durationinseconds"))) {
    return "workout";
  }
  // Body: has weight or body fat
  if (hasAny("weight", "weightkg", "bmi", "bodyfat", "bodyfatpct", "skeletalmusclemass", "musclemass")) {
    return "body";
  }

  return null;
}

/**
 * Parse all rows of a CSV (already parsed into objects) for a given data type.
 * Returns valid rows only (skips rows with no date or all-null values).
 */
export function parseRows(
  rows: Record<string, string>[],
  type: ImportDataType
): ParsedRow[] {
  const results: ParsedRow[] = [];
  for (const row of rows) {
    let parsed: ParsedRow | null = null;
    if (type === "body") parsed = parseBodyRow(row);
    else if (type === "sleep") parsed = parseSleepRow(row);
    else if (type === "heartrate") parsed = parseHeartRateRow(row);
    else if (type === "workout") parsed = parseWorkoutRow(row);

    if (parsed) results.push(parsed);
  }
  return results;
}
