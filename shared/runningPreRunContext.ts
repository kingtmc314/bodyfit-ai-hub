/**
 * Pure pre-run covariates, never a readiness adjustment or diagnosis.
 * SECURITY: the caller/adapter MUST supply records scoped to the run's authorized
 * user and chosen source. These shapes contain no user identity; this module has
 * no global cache, data fetch, cross-user fallback, or way to verify ownership.
 *
 * Sleep.tsx submits hours; sheetsService.ts labels Duration (h). Legacy display
 * code guesses minutes for values >24, but that heuristic is unsafe here: hours
 * are the default, and an adapter must explicitly declare minutes if appropriate.
 * Neither file establishes Sleep.date as a wake date. Clock-only times therefore
 * NEVER establish same-day eligibility unless dateConvention is explicitly set.
 */
export type PreRunRecordId = string | number;
export type PreRunNumeric = number | string | null;
export type PreRunRun = {
  id: PreRunRecordId;
  HKdate: string;
  /** Strict ISO 8601 with Z or an explicit offset, not a date or local clock. */
  startTimestamp?: string | null;
};
export type PreRunSleep = {
  id: PreRunRecordId;
  date: string;
  sleepDuration?: PreRunNumeric;
  bedtime?: string | null;
  waketime?: string | null;
  sleepScore?: PreRunNumeric;
  restingHr?: PreRunNumeric;
  hrv?: PreRunNumeric;
  source?: string | null;
};
export type PreRunHeart = {
  id: PreRunRecordId;
  date: string;
  restingHr?: PreRunNumeric;
  hrv?: PreRunNumeric;
  source?: string | null;
};
export type PreRunContextOptions = {
  /** Only set wake-date when the adapter guarantees it for EVERY supplied sleep row. */
  dateConvention?: "unknown" | "wake-date";
  sleepDurationUnit?: "hours" | "minutes";
  baselineWindowDays?: 14 | 28;
};
export type PreRunPairingMethod = "explicit-wake-timestamp" | "adapter-confirmed-wake-date" | "prior-date-proxy";
export type PreRunMeasurement = {
  id: PreRunRecordId;
  date: string;
  /** Actual wake HK date when verified, otherwise only the record's label date. */
  measurementHKdate: string;
  source: string | null;
  pairingMethod: PreRunPairingMethod;
  confidence: "verified-pre-run" | "lower-confidence";
  /** Null for ambiguous-date proxies: no invented midnight/end-of-day measurement. */
  measuredAt: string | null;
  ageHours: number | null;
  /** Conservative bounds; proxy upper bound must not exceed 48 hours. */
  ageHoursRange: readonly [number, number];
};
export type PreRunSleepMatch = PreRunMeasurement & {
  sleepHours: number | null;
  sleepScore: number | null;
  restingHr: number | null;
  hrv: number | null;
  durationUnit: "hours" | "minutes";
};
export type PreRunRestingHrMatch = PreRunMeasurement & {
  kind: "verified-overnight-sleep" | "prior-day-heart-summary";
  restingHr: number;
};
export type PreRunHrvContext = PreRunMeasurement & {
  value: number;
  kind: "sleep-context" | "daily-heart-context";
  unit: "unknown";
  interpretation: "context-only";
};
export type PreRunRhrBaseline = {
  windowDays: 14 | 28;
  minimumDays: 5;
  validDays: number;
  coverage: number;
  meanBpm: number | null;
  rhrDeltaBpm: number | null;
  windowStartHKdate: string | null;
  /** Exclusive: selected measurement day and later days are never included. */
  windowEndExclusiveHKdate: string | null;
  source: string | null;
  kind: PreRunRestingHrMatch["kind"] | null;
  records: Array<{ id: PreRunRecordId; date: string; measurementHKdate: string; source: string | null; restingHr: number }>;
};
export type PreRunContext = {
  run: { id: PreRunRecordId; HKdate: string | null; startTimestamp: string | null; valid: boolean };
  sleep: PreRunSleepMatch | null;
  restingHr: PreRunRestingHrMatch | null;
  hrv: PreRunHrvContext | null;
  sleepHours: number | null;
  rhrDeltaBpm: number | null;
  baseline: PreRunRhrBaseline;
  baselines: { days14: PreRunRhrBaseline; days28: PreRunRhrBaseline };
  coverage: {
    runDateValid: boolean;
    runStartKnown: boolean;
    sleepMatched: boolean;
    sleepDurationAvailable: boolean;
    sleepWakeVerified: boolean;
    restingHrMatched: boolean;
    baselineSufficient: boolean;
    hrvAvailable: boolean;
    lowerConfidencePairing: boolean;
    userScopeVerified: false;
    inputSleepRows: number;
    inputHeartRows: number;
    eligibleSleepRows: number;
    eligibleRestingHrRows: number;
    duplicateRowsDiscarded: number;
    rejected: Record<string, number>;
  };
  limitations: string[];
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const HK_OFFSET = 8 * HOUR;
const MAX_AGE_HOURS = 48;

/** Exact canonical date validation; no rollover, locale parsing, trimming, or fallback. */
export function canonicalPreRunHKDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const year = Number(value.slice(0, 4)), month = Number(value.slice(5, 7)), day = Number(value.slice(8, 10));
  if (year < 1 || month < 1 || month > 12 || day < 1) return null;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1] ? value : null;
}

/** Returns milliseconds only for a valid explicit zoned ISO timestamp. */
export function parsePreRunZonedTimestamp(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/);
  if (!match || !canonicalPreRunHKDate(match[1]) || Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4] ?? 0) > 59) return null;
  if (match[6] !== "Z") {
    const zoneHours = Number(match[6].slice(1, 3)), zoneMinutes = Number(match[6].slice(4, 6));
    // RFC 3339 -00:00 denotes an unknown offset, not a verified measurement zone.
    if (match[6] === "-00:00" || zoneHours > 14 || zoneMinutes > 59 || (zoneHours === 14 && zoneMinutes !== 0)) return null;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

const dayStart = (date: string) => Date.parse(`${date}T00:00:00+08:00`);
const hkDateAt = (ms: number) => new Date(ms + HK_OFFSET).toISOString().slice(0, 10);
const missing = (value: unknown) => value === null || value === undefined || value === "";
function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function range(value: unknown, lo: number, hi: number): number | null {
  const n = finiteNumber(value);
  return n !== null && n >= lo && n <= hi ? n : null;
}
function clock(value: string): boolean {
  const match = value.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  return !!match && Number(match[1]) < 24 && Number(match[2]) < 60 && Number(match[3] ?? 0) < 60;
}

type Candidate = {
  measurement: PreRunMeasurement;
  time: number | null;
  day: number;
  key: string;
  kind: "sleep" | "heart";
  sleepHours: number | null;
  sleepScore: number | null;
  restingHr: number | null;
  hrv: number | null;
};
// Explicit stable tie-breaker, independent of input order and locale. No field merging.
function compareCandidates(a: Candidate, b: Candidate): number {
  const chronological = b.day - a.day || (b.time !== null ? 1 : 0) - (a.time !== null ? 1 : 0) || (b.time ?? 0) - (a.time ?? 0);
  if (chronological) return chronological;
  const completeness = (c: Candidate) => Number(c.sleepHours !== null) + Number(c.sleepScore !== null) + Number(c.restingHr !== null) + Number(c.hrv !== null);
  return completeness(b) - completeness(a) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
}
function deduplicate(candidates: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return [...candidates].sort(compareCandidates).filter(c => {
    const key = JSON.stringify([c.kind, c.measurement.source, c.measurement.measurementHKdate]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function emptyBaseline(windowDays: 14 | 28): PreRunRhrBaseline {
  return { windowDays, minimumDays: 5, validDays: 0, coverage: 0, meanBpm: null, rhrDeltaBpm: null, windowStartHKdate: null, windowEndExclusiveHKdate: null, source: null, kind: null, records: [] };
}
function baselineFor(selected: Candidate | null, candidates: Candidate[], windowDays: 14 | 28): PreRunRhrBaseline {
  const result = emptyBaseline(windowDays);
  if (!selected || selected.restingHr === null) return result;
  const cutoff = selected.day;
  result.windowStartHKdate = hkDateAt(cutoff - windowDays * DAY);
  result.windowEndExclusiveHKdate = selected.measurement.measurementHKdate;
  result.source = selected.measurement.source;
  result.kind = selected.kind === "sleep" ? "verified-overnight-sleep" : "prior-day-heart-summary";
  // Unknown provenance cannot establish a comparable baseline. Never blend devices,
  // sources, or a daily summary with an overnight resting measurement.
  if (result.source === null) return result;
  const eligible = candidates.filter(c => c.kind === selected.kind && c.measurement.source === result.source && c.restingHr !== null && c.day >= cutoff - windowDays * DAY && c.day < cutoff && (selected.kind !== "sleep" || (c.time !== null && selected.time !== null && c.time < selected.time)));
  const unique = deduplicate(eligible);
  result.records = unique.map(c => ({ id: c.measurement.id, date: c.measurement.date, measurementHKdate: c.measurement.measurementHKdate, source: c.measurement.source, restingHr: c.restingHr! }));
  result.validDays = unique.length;
  result.coverage = unique.length / windowDays;
  if (unique.length >= result.minimumDays) {
    result.meanBpm = unique.reduce((sum, c) => sum + c.restingHr!, 0) / unique.length;
    result.rhrDeltaBpm = selected.restingHr - result.meanBpm;
  }
  return result;
}

/**
 * O(n log n) time/O(n) memory for one run; no timestamp iteration or I/O.
 * Same-day sleep requires BOTH a real run start and a verified wake <= start.
 * Daily heart summaries are always strictly prior-day, including for baselines.
 * Unknown-date sleep proxies require a known run start and a clock-only wake;
 * BOTH label-day and following-day possible wakes must precede the run within
 * 48 hours. Without a run start these ambiguous sleep rows are excluded.
 * Proxies have bounded date uncertainty, not fabricated measurement timestamps.
 */
export function matchRunningPreRunContext(
  run: PreRunRun,
  sleepRows: readonly PreRunSleep[],
  heartRows: readonly PreRunHeart[],
  options: PreRunContextOptions = {},
): PreRunContext {
  const date = canonicalPreRunHKDate(run.HKdate);
  const startProvided = run.startTimestamp !== undefined && run.startTimestamp !== null;
  const start = parsePreRunZonedTimestamp(run.startTimestamp);
  const valid = date !== null && (!startProvided || (start !== null && hkDateAt(start) === date));
  const rejected: Record<string, number> = {};
  const reject = (reason: string) => { rejected[reason] = (rejected[reason] ?? 0) + 1; };
  const days14 = emptyBaseline(14), days28 = emptyBaseline(28);
  const result: PreRunContext = {
    run: { id: run.id, HKdate: date, startTimestamp: start === null ? null : new Date(start).toISOString(), valid },
    sleep: null, restingHr: null, hrv: null, sleepHours: null, rhrDeltaBpm: null,
    baseline: options.baselineWindowDays === 14 ? days14 : days28,
    baselines: { days14, days28 },
    coverage: { runDateValid: date !== null, runStartKnown: start !== null && valid, sleepMatched: false, sleepDurationAvailable: false, sleepWakeVerified: false, restingHrMatched: false, baselineSufficient: false, hrvAvailable: false, lowerConfidencePairing: false, userScopeVerified: false, inputSleepRows: sleepRows.length, inputHeartRows: heartRows.length, eligibleSleepRows: 0, eligibleRestingHrRows: 0, duplicateRowsDiscarded: 0, rejected },
    limitations: ["Caller/adapter must enforce authorized single-user and chosen-source scope; ownership cannot be verified from these record shapes.", "Temporal association is not a physiological adjustment, causal claim, or diagnosis."],
  };
  if (!valid || date === null) {
    reject(date === null ? "invalid-run-date" : start === null ? "invalid-run-start" : "run-date-start-mismatch");
    result.limitations.push("Invalid run date/start: no date or current-time fallback was used.");
    return result;
  }
  if (start === null) result.limitations.push("Run start is missing; same-day sleep and unknown-date sleep proxies are excluded. Verified earlier-date wakes and strictly prior-day heart summaries may pair with conservative age bounds.");
  if (options.dateConvention !== "wake-date") result.limitations.push("Sleep.date bed/wake convention is unconfirmed; clock-only wake times cannot verify same-day sleep.");
  const runDay = dayStart(date);
  const durationUnit = options.sleepDurationUnit ?? "hours";
  const candidates: Candidate[] = [];
  const measurement = (row: PreRunSleep | PreRunHeart, time: number | null, method: PreRunPairingMethod, proxyBounds?: readonly [number, number]): PreRunMeasurement => {
    const measurementHKdate = time === null ? row.date : hkDateAt(time);
    const day = dayStart(measurementHKdate);
    const exactAge = time !== null && start !== null ? (start - time) / HOUR : null;
    const bounds: readonly [number, number] = proxyBounds ?? (exactAge !== null ? [exactAge, exactAge] : time !== null ? [(runDay - time) / HOUR, (runDay + DAY - time) / HOUR] : [Math.max(0, ((start ?? runDay) - (day + DAY)) / HOUR), ((start ?? runDay + DAY) - day) / HOUR]);
    return { id: row.id, date: row.date, measurementHKdate, source: typeof row.source === "string" && row.source.trim() ? row.source : null, pairingMethod: method, confidence: time === null ? "lower-confidence" : "verified-pre-run", measuredAt: time === null ? null : new Date(time).toISOString(), ageHours: exactAge, ageHoursRange: bounds };
  };
  const add = (row: PreRunSleep | PreRunHeart, kind: Candidate["kind"], time: number | null, method: PreRunPairingMethod, hours: number | null, score: number | null, proxyBounds?: readonly [number, number]) => {
    const m = measurement(row, time, method, proxyBounds);
    const restingHr = range(row.restingHr, 30, 120);
    const hrv = range(row.hrv, 0, Number.MAX_VALUE);
    if (!missing(row.restingHr) && restingHr === null) reject("invalid-resting-hr-value");
    if (!missing(row.hrv) && hrv === null) reject("invalid-hrv-value");
    candidates.push({ measurement: m, time, day: dayStart(m.measurementHKdate), kind, sleepHours: hours, sleepScore: score, restingHr, hrv, key: JSON.stringify([m.source, typeof row.id, row.id, row.date, time, hours, score, restingHr, hrv]) });
  };
  for (const row of sleepRows) {
    if (!canonicalPreRunHKDate(row.date)) { reject("invalid-sleep-date"); continue; }
    if (row.date > date) { reject("future-sleep-date"); continue; }
    if (start === null && row.date === date) { reject("unverified-same-day-sleep"); continue; }
    const rawHours = finiteNumber(row.sleepDuration);
    const hours = rawHours === null ? null : durationUnit === "minutes" ? rawHours / 60 : rawHours;
    if (!missing(row.sleepDuration) && (hours === null || hours <= 0 || hours > 16)) { reject("invalid-sleep-duration"); continue; }
    const score = range(row.sleepScore, 0, 100);
    if (!missing(row.sleepScore) && score === null) reject("invalid-sleep-score-value");
    let wake: number | null = null;
    let method: PreRunPairingMethod = "prior-date-proxy";
    if (!missing(row.waketime)) {
      wake = parsePreRunZonedTimestamp(row.waketime);
      if (wake !== null) method = "explicit-wake-timestamp";
      else if (typeof row.waketime === "string" && clock(row.waketime)) {
        if (options.dateConvention === "wake-date") {
          wake = parsePreRunZonedTimestamp(`${row.date}T${row.waketime}+08:00`);
          method = "adapter-confirmed-wake-date";
        }
      } else { reject("invalid-wake-time"); continue; }
    }
    if (wake !== null && options.dateConvention === "wake-date" && hkDateAt(wake) !== row.date) { reject("wake-date-contract-mismatch"); continue; }
    // Without a run clock even an explicit same-day wake cannot prove pre-run order.
    if (wake !== null && (start === null ? hkDateAt(wake) >= date : wake > start)) { reject("wake-not-proven-before-run"); continue; }
    if (!missing(row.bedtime)) {
      const bed = parsePreRunZonedTimestamp(row.bedtime);
      if (bed !== null) {
        if ((wake !== null && bed >= wake) || (start === null ? hkDateAt(bed) >= date : bed >= start)) { reject("bedtime-not-before-wake-or-run"); continue; }
      } else if (typeof row.bedtime !== "string" || !clock(row.bedtime)) { reject("invalid-bedtime"); continue; }
    }
    if (wake === null && row.date >= date) { reject("unverified-same-day-sleep"); continue; }
    let proxyBounds: readonly [number, number] | undefined;
    if (wake === null) {
      // Unknown label may be BED date or WAKE date. For a clock-only wake,
      // possible wakes lie on label day or the following HK day. This is an
      // uncertainty interval, never a fabricated measuredAt. A previous-date
      // label alone is insufficient for a midnight/early-morning run.
      if (start === null || typeof row.waketime !== "string" || !clock(row.waketime)) {
        reject("unbounded-sleep-date-proxy");
        continue;
      }
      const earliestPossibleWake = parsePreRunZonedTimestamp(`${row.date}T${row.waketime}+08:00`)!;
      const latestPossibleWake = earliestPossibleWake + DAY;
      if (latestPossibleWake > start) { reject("ambiguous-proxy-wake-after-run"); continue; }
      proxyBounds = [(start - latestPossibleWake) / HOUR, (start - earliestPossibleWake) / HOUR];
    }
    add(row, "sleep", wake, method, hours, score, proxyBounds);
  }
  for (const row of heartRows) {
    if (!canonicalPreRunHKDate(row.date)) { reject("invalid-heart-date"); continue; }
    if (row.date >= date) { reject("same-day-or-future-heart-summary"); continue; }
    add(row, "heart", null, "prior-date-proxy", null, null);
  }
  const isRecent = (c: Candidate) => c.measurement.ageHoursRange[0] >= 0 && c.measurement.ageHoursRange[1] <= MAX_AGE_HOURS;
  const recentSleep = candidates.filter(c => c.kind === "sleep" && isRecent(c));
  // Unverified sleep-label dates do not prove that resting HR belongs to a pre-run
  // overnight episode; they can provide sleep covariates but NEVER overnight RHR.
  const recentResting = candidates.filter(c => c.restingHr !== null && (c.kind === "heart" || c.time !== null) && isRecent(c));
  const uniqueSleep = deduplicate(recentSleep);
  const uniqueResting = deduplicate(recentResting);
  result.coverage.eligibleSleepRows = recentSleep.length;
  result.coverage.eligibleRestingHrRows = recentResting.length;
  // Count once per actual candidate, not twice when sleep also supplies resting HR.
  const recentUnion = candidates.filter(c => isRecent(c));
  result.coverage.duplicateRowsDiscarded = recentUnion.length - deduplicate(recentUnion).length;
  const selectedSleep = uniqueSleep[0] ?? null;
  // Prefer an eligible verified overnight measurement to an uncertain daily summary.
  const selectedRhr = uniqueResting.find(c => c.kind === "sleep") ?? uniqueResting.find(c => c.kind === "heart") ?? null;
  if (selectedSleep) {
    result.sleep = { ...selectedSleep.measurement, sleepHours: selectedSleep.sleepHours, sleepScore: selectedSleep.sleepScore, restingHr: selectedSleep.time === null ? null : selectedSleep.restingHr, hrv: selectedSleep.hrv, durationUnit };
    result.sleepHours = selectedSleep.sleepHours;
  }
  if (selectedRhr) result.restingHr = { ...selectedRhr.measurement, restingHr: selectedRhr.restingHr!, kind: selectedRhr.kind === "sleep" ? "verified-overnight-sleep" : "prior-day-heart-summary" };
  const hrvCandidate = selectedSleep?.hrv !== null && selectedSleep?.hrv !== undefined ? selectedSleep : selectedRhr?.hrv !== null && selectedRhr?.hrv !== undefined ? selectedRhr : null;
  if (hrvCandidate) result.hrv = { ...hrvCandidate.measurement, value: hrvCandidate.hrv!, kind: hrvCandidate.kind === "sleep" ? "sleep-context" : "daily-heart-context", unit: "unknown", interpretation: "context-only" };
  result.baselines = { days14: baselineFor(selectedRhr, candidates, 14), days28: baselineFor(selectedRhr, candidates, 28) };
  result.baseline = options.baselineWindowDays === 14 ? result.baselines.days14 : result.baselines.days28;
  result.rhrDeltaBpm = result.baseline.rhrDeltaBpm;
  Object.assign(result.coverage, {
    sleepMatched: result.sleep !== null,
    sleepDurationAvailable: result.sleepHours !== null,
    sleepWakeVerified: result.sleep?.confidence === "verified-pre-run",
    restingHrMatched: result.restingHr !== null,
    baselineSufficient: result.baseline.meanBpm !== null,
    hrvAvailable: result.hrv !== null,
    lowerConfidencePairing: result.sleep?.confidence === "lower-confidence" || result.restingHr?.confidence === "lower-confidence" || result.hrv?.confidence === "lower-confidence",
  });
  if (result.coverage.lowerConfidencePairing) result.limitations.push("Prior-date pairing is a conservative date proxy within 48 hours, not a measured wake/end time; ageHours is null and bounds describe date uncertainty. For unknown-date sleep clocks both label-day and following-day wakes are bounded before the known run start. Lower-confidence sleep should be display/context only, not a verified numeric pre-run predictor.");
  if (!result.sleep) result.limitations.push("No eligible pre-run sleep within the conservative 48-hour window.");
  if (!result.restingHr) result.limitations.push("No eligible resting measurement; exercise average/high HR and HR zones are never resting-HR substitutes.");
  if (result.restingHr?.kind === "prior-day-heart-summary") result.limitations.push("Daily heart resting HR is a prior-day summary, not a verified overnight measurement.");
  if (selectedRhr && selectedRhr.measurement.source === null) result.limitations.push("Resting measurement provenance is unknown; no mixed/unknown-source baseline is computed.");
  if (!result.coverage.baselineSufficient) result.limitations.push("Resting-HR delta is null: baseline requires at least 5 distinct valid days in the chosen 14/28-day window, strictly before the selected measurement and from the same source and measurement kind.");
  if (result.hrv) result.limitations.push("HRV is retained as context only; unit and measurement protocol are unknown and no adjustment or diagnosis is inferred.");
  if (Object.keys(rejected).length) result.limitations.push("Rejected rows/values are counted in coverage.rejected; invalid or future timestamps never fall back to an assumed measurement time.");
  return result;
}
