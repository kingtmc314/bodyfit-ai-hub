/**
 * CSV Import utilities for Garmin Connect, Apple Health, and generic formats.
 * Supports: body composition, sleep, heart rate, workout/activity data, nutrition.
 */

export type ImportDataType = "body" | "sleep" | "heartrate" | "workout" | "nutrition" | "running";

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
  lightSleep?: number; // hours
  awakeDuration?: number; // hours
  bodyBattery?: number;
  pulseOx?: number;
  respiration?: number;
  stress?: number;
  sleepQuality?: "Poor" | "Fair" | "Good" | "Excellent";
  restingHr?: number;
  hrv?: number; // Heart Rate Variability (ms)
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

export interface ParsedNutritionRow {
  date: string;
  mealType?: string;
  foodName?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  servings?: number;
}

export interface ParsedRunningRow {
  date: string;
  runningType?: string;
  runningShoes?: string;
  distanceKm?: number;
  hour?: number;
  minutes?: number;
  second?: number;
  averagePace?: string;   // decimal min/km e.g. "6.5"
  bestPace?: string;
  averageHeartRate?: number;
  maximumHeartRate?: number;
  averageCadence?: number;
  maxCadence?: number;
  avgStrideLengthM?: number;
  avgVerticalRatio?: number;
  verticalOscillationCm?: number;
  avgGroundContactTimeMs?: number;
  calories?: number;
  temperature?: number;
  humidity?: number;
  notes?: string;
}

export type ParsedRow = ParsedBodyRow | ParsedSleepRow | ParsedHeartRateRow | ParsedWorkoutRow | ParsedNutritionRow | ParsedRunningRow;

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

  let lightSleep = toNum(keys["lightsleep"] ?? keys["lightsleepduration"] ?? keys["lightsleepmins"]);
  if (lightSleep !== undefined && lightSleep > 24) lightSleep = lightSleep / 60;

  let awakeDuration = toNum(keys["awake"] ?? keys["awakeduration"] ?? keys["awakemins"] ?? keys["awakenings"]);
  if (awakeDuration !== undefined && awakeDuration > 24) awakeDuration = awakeDuration / 60;

  return {
    date,
    sleepScore,
    sleepDuration,
    deepSleep,
    remSleep,
    lightSleep,
    awakeDuration,
    bodyBattery: toNum(keys["bodybattery"] ?? keys["bodybatteryend"]),
    pulseOx: toNum(keys["pulseox"] ?? keys["spo2"] ?? keys["bloodoxygen"]),
    respiration: toNum(keys["respiration"] ?? keys["breathingrate"] ?? keys["avgrespirationrate"]),
    stress: toNum(keys["stress"] ?? keys["avgstress"] ?? keys["stresslevel"]),
    sleepQuality,
    restingHr: toNum(keys["restinghr"] ?? keys["restingheartrate"] ?? keys["avgrestinghr"]),
    hrv: toNum(keys["hrv"] ?? keys["heartratevariability"] ?? keys["hrvscore"] ?? keys["avghrv"]),
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

// ─── Nutrition / Meal Log ───────────────────────────────────────────────────────

/**
 * Generic daily nutrition summary or meal log CSV.
 * Supports: MyFitnessPal, Cronometer, Garmin daily nutrition summary.
 */
export function parseNutritionRow(row: Record<string, string>): ParsedNutritionRow | null {
  const keys: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    keys[normalizeKey(k)] = v;
  }

  const rawDate =
    keys["date"] ??
    keys["datetime"] ??
    keys["day"] ??
    keys["calendardate"];
  const date = rawDate ? parseDate(rawDate) : null;
  if (!date) return null;

  const calories = toNum(
    keys["calories"] ?? keys["kcal"] ?? keys["energy"] ??
    keys["totalcalories"] ?? keys["energykcal"] ?? keys["calorieskcal"]
  );
  const protein = toNum(
    keys["protein"] ?? keys["proteing"] ?? keys["proteingrams"] ?? keys["totalprotein"]
  );
  const carbs = toNum(
    keys["carbs"] ?? keys["carbohydrates"] ?? keys["carbohydratesg"] ??
    keys["totalcarbs"] ?? keys["netcarbs"]
  );
  const fat = toNum(
    keys["fat"] ?? keys["totalfat"] ?? keys["fatg"] ?? keys["fatgrams"]
  );
  const fiber = toNum(keys["fiber"] ?? keys["dietaryfiber"] ?? keys["fibeg"]);

  // Require at least calories or protein to be a valid row
  if (calories === undefined && protein === undefined) return null;

  const mealType = (
    keys["meal"] ?? keys["mealtype"] ?? keys["mealname"] ?? keys["category"]
  )?.trim()?.toLowerCase() ?? "snack";
  const foodName = (
    keys["food"] ?? keys["foodname"] ?? keys["name"] ?? keys["item"] ?? keys["description"]
  )?.trim();

  return {
    date,
    mealType,
    foodName: foodName || "Imported Entry",
    calories,
    protein,
    carbs,
    fat,
    fiber,
    servings: toNum(keys["servings"] ?? keys["quantity"] ?? keys["amount"]) ?? 1,
  };
}

// ─── Running ─────────────────────────────────────────────────────────────────

/**
 * Garmin Connect Running/Activity CSV columns (from Activities export):
 *   Activity Type, Date, Favorite, Title, Distance, Calories, Time, Avg HR, Max HR,
 *   Aerobic TE, Avg Run Cadence, Max Run Cadence, Avg Pace, Best Pace, Total Ascent,
 *   Total Descent, Avg Stride Length, Avg Vertical Ratio, Avg Vertical Oscillation,
 *   Avg Ground Contact Time, Training Stress Score, Grit, Flow, Climb, Bottom Time,
 *   Min Temp, Surface Interval, Decompression, Best Lap Time, Number of Laps, Max Temp
 */
export function parseRunningRow(row: Record<string, string>): ParsedRunningRow | null {
  const keys: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    keys[normalizeKey(k)] = v;
  }

  const rawDate = keys["date"] ?? keys["calendardate"] ?? keys["datetime"] ?? keys["starttime"];
  const date = rawDate ? parseDate(rawDate) : null;
  if (!date) return null;

  // Only process running-type activities
  const actType = (keys["activitytype"] ?? keys["type"] ?? keys["sport"] ?? "").toLowerCase();
  const runningKeywords = ["running", "run", "trail", "race", "jogging", "treadmill"];
  if (actType && !runningKeywords.some(k => actType.includes(k))) return null;

  // Parse duration HH:MM:SS or seconds
  let hour: number | undefined;
  let minutes: number | undefined;
  let second: number | undefined;
  const rawTime = keys["time"] ?? keys["duration"] ?? keys["durationinseconds"];
  if (rawTime) {
    const hmsMatch = rawTime.match(/(\d+):(\d{2}):(\d{2})/);
    if (hmsMatch) {
      hour = parseInt(hmsMatch[1]);
      minutes = parseInt(hmsMatch[2]);
      second = parseInt(hmsMatch[3]);
    } else {
      const secs = parseFloat(rawTime);
      if (!isNaN(secs) && secs > 0) {
        hour = Math.floor(secs / 3600);
        minutes = Math.floor((secs % 3600) / 60);
        second = Math.round(secs % 60);
      }
    }
  }

  // Distance: Garmin exports in km
  let distanceKm = toNum(keys["distance"] ?? keys["distancekm"] ?? keys["distancemiles"]);
  if (distanceKm !== undefined) {
    // If very large, might be in meters
    if (distanceKm > 500) distanceKm = distanceKm / 1000;
  }

  // Pace: Garmin exports as "M:SS /km" or "M:SS /mi" or decimal
  let averagePace: string | undefined;
  const rawPace = keys["avgpace"] ?? keys["averagepace"] ?? keys["pace"];
  if (rawPace && rawPace !== "--") {
    const paceMatch = rawPace.match(/(\d+):(\d{2})/);
    if (paceMatch) {
      // Convert M:SS to decimal min/km
      const decPace = parseInt(paceMatch[1]) + parseInt(paceMatch[2]) / 60;
      averagePace = decPace.toFixed(4);
    } else {
      const n = parseFloat(rawPace);
      if (!isNaN(n)) averagePace = String(n);
    }
  }

  let bestPace: string | undefined;
  const rawBest = keys["bestpace"] ?? keys["fastestpace"];
  if (rawBest && rawBest !== "--") {
    bestPace = rawBest.trim();
  }

  // Cadence: Garmin exports steps/min (already spm, not rpm)
  const avgCadence = toNum(keys["avgcadence"] ?? keys["avgruncadence"] ?? keys["averagecadence"] ?? keys["cadence"]);
  const maxCadence = toNum(keys["maxcadence"] ?? keys["maxruncadence"]);

  // Stride length: Garmin exports in meters
  const avgStrideLengthM = toNum(keys["avgstridelength"] ?? keys["averagestridelength"] ?? keys["avgstridelengthmeter"]);

  // Vertical ratio & oscillation
  const avgVerticalRatio = toNum(keys["avgverticalratio"] ?? keys["verticalratio"]);
  const verticalOscillationCm = toNum(keys["avgverticaloscillation"] ?? keys["verticaloscillation"] ?? keys["avgverticaloscillationcm"]);
  const avgGroundContactTimeMs = toNum(keys["avggroundcontacttime"] ?? keys["groundcontacttime"]);

  // Running type from activity title or type
  let runningType: string | undefined;
  const title = (keys["title"] ?? keys["activityname"] ?? "").toLowerCase();
  if (title.includes("interval") || title.includes("track")) runningType = "Interval";
  else if (title.includes("tempo") || title.includes("threshold")) runningType = "Tempo";
  else if (title.includes("long") || title.includes("lsd")) runningType = "Long Run";
  else if (title.includes("race") || title.includes("competition")) runningType = "Race";
  else if (title.includes("trail")) runningType = "Trail";
  else if (title.includes("recovery") || title.includes("easy")) runningType = "Easy";
  else if (actType.includes("trail")) runningType = "Trail";

  return {
    date,
    runningType,
    distanceKm,
    hour,
    minutes,
    second,
    averagePace,
    bestPace,
    averageHeartRate: toNum(keys["avghr"] ?? keys["averageheartrate"] ?? keys["heartrateavg"]) !== undefined
      ? Math.round(toNum(keys["avghr"] ?? keys["averageheartrate"] ?? keys["heartrateavg"])!)
      : undefined,
    maximumHeartRate: toNum(keys["maxhr"] ?? keys["maximumheartrate"] ?? keys["heartratemax"]) !== undefined
      ? Math.round(toNum(keys["maxhr"] ?? keys["maximumheartrate"] ?? keys["heartratemax"])!)
      : undefined,
    averageCadence: avgCadence,
    maxCadence,
    avgStrideLengthM,
    avgVerticalRatio,
    verticalOscillationCm,
    avgGroundContactTimeMs,
    calories: toNum(keys["calories"] ?? keys["activekilocalories"] ?? keys["totalcalories"]) !== undefined
      ? Math.round(toNum(keys["calories"] ?? keys["activekilocalories"] ?? keys["totalcalories"])!)
      : undefined,
    temperature: toNum(keys["mintemp"] ?? keys["temperature"] ?? keys["avgtemperature"]),
    humidity: toNum(keys["humidity"]),
    notes: keys["title"] ?? undefined,
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
  // Running: Garmin activity export with running-specific columns
  if (hasAny("activitytype", "workoutactivitytype") && hasAny("avgruncadence", "avgcadence", "avgpace", "bestpace", "avgstridelength", "avgverticalratio")) {
    return "running";
  }
  // Workout: has activity type or duration with calories
  if (hasAny("activitytype", "workoutactivitytype", "sport") || (hasAny("calories", "activekilocalories") && hasAny("time", "duration", "durationinseconds"))) {
    return "workout";
  }
  // Nutrition: has calories/protein/carbs/fat (but not workout-specific columns)
  if (hasAny("calories", "kcal", "energy", "totalcalories") && hasAny("protein", "carbs", "carbohydrates", "fat")) {
    if (!hasAny("activitytype", "workoutactivitytype", "sport")) {
      return "nutrition";
    }
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
    else if (type === "nutrition") parsed = parseNutritionRow(row);
    else if (type === "running") parsed = parseRunningRow(row);

    if (parsed) results.push(parsed);
  }
  return results;
}
