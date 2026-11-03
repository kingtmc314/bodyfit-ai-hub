/** Derived evidence from retained Garmin samples, not physiological measurements or a race model. */
export type RunningContinuousEvidence = {
  version: 1;
  sourceFormat: string | null;
  sourceSampleCount: number | null;
  retainedSampleCount: number;
  usableSampleCount: number;
  rejectedSampleCount: number;
  sourceElapsedSeconds: number | null;
  retainedSpanSeconds: number | null;
  observedSeconds: number;
  movingSeconds: number;
  longestContinuousSeconds: number;
  coverage: number | null;
  paceCoverage: number | null;
  heartRateCoverage: number | null;
  cadenceCoverage: number | null;
  powerCoverage: number | null;
  meanMovingPaceSecPerKm: number | null;
  meanHeartRate: number | null;
  meanCadence: number | null;
  meanPowerWatts: number | null;
  meanTemperatureC: number | null;
  meanAbsoluteGradePct: number | null;
  derivedStepLengthM: number | null;
  firstHalf: RunningHalfEvidence;
  secondHalf: RunningHalfEvidence;
  heartRateDriftPct: number | null;
  latePaceChangePct: number | null;
  efficiencyDecouplingPct: number | null;
  bestObservedPace: { seconds60: number | null; seconds300: number | null; seconds1200: number | null };
  baselineQualified: boolean;
  limitations: string[];
};
export type RunningHalfEvidence = { movingSeconds: number; paceSecPerKm: number | null; pairedSeconds: number; pairedHeartRate: number | null; pairedSpeedMps: number | null };

type Sample = { t: number; elapsed: number; pace: number | null; hr: number | null; cadence: number | null; power: number | null; distance: number | null; altitude: number | null; temperature: number | null };
type Interval = { start: number; end: number; speed: number | null; hr: number | null; cadence: number | null; power: number | null; temperature: number | null; grade: number | null; segment: number };
export function finiteRunningNumber(value: unknown): number | null {
  if ((typeof value !== "number" && typeof value !== "string") || (typeof value === "string" && !value.trim())) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
const inRange = (v: unknown, lo: number, hi: number) => { const n = finiteRunningNumber(v); return n !== null && n >= lo && n <= hi ? n : null; };
const meanPair = (a: number | null, b: number | null) => a !== null && b !== null ? (a + b) / 2 : null;
const round = (n: number | null) => n === null ? null : Number(n.toFixed(4));
export function parseRunningPaceSeconds(raw: unknown): number | null {
  const text = String(raw ?? "").trim();
  const clock = text.match(/^(\d{1,2}):(\d{2})(?:\.(\d+))?$/);
  if (clock) return Number(clock[2]) < 60 ? inRange(Number(clock[1]) * 60 + Number(clock[2]) + Number(`0.${clock[3] ?? 0}`), 120, 1800) : null;
  const minutes = inRange(raw, 2, 30);
  return minutes === null ? null : minutes * 60;
}
function jsonValue(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try { return JSON.parse(raw); } catch { return null; }
}
function metric(intervals: Interval[], key: "speed" | "hr" | "cadence" | "power" | "temperature" | "grade") {
  let seconds = 0, sum = 0, squares = 0;
  for (const i of intervals) {
    const value = i[key];
    if (value === null) continue;
    const dt = i.end - i.start;
    seconds += dt; sum += value * dt; squares += value * value * dt;
  }
  const mean = seconds ? sum / seconds : null;
  return { seconds, mean, cv: mean !== null && mean > 0 ? Math.sqrt(Math.max(0, squares / seconds - mean * mean)) / mean : null };
}
function clip(intervals: Interval[], start: number, end: number) {
  return intervals.filter(i => i.end > start && i.start < end).map(i => ({ ...i, start: Math.max(start, i.start), end: Math.min(end, i.end) }));
}
function half(intervals: Interval[]): RunningHalfEvidence {
  const speed = metric(intervals, "speed");
  const paired = intervals.filter(i => i.speed !== null && i.hr !== null);
  return { movingSeconds: speed.seconds, paceSecPerKm: round(speed.mean ? 1000 / speed.mean : null), pairedSeconds: metric(paired, "speed").seconds, pairedHeartRate: round(metric(paired, "hr").mean), pairedSpeedMps: round(metric(paired, "speed").mean) };
}
/** Exact piecewise-rate integration within observed contiguous intervals; never bridges a pause/gap. */
function sustainedPace(intervals: Interval[], duration: number): number | null {
  let bestSpeed: number | null = null;
  const groups = new Map<number, Interval[]>();
  for (const i of intervals) if (i.speed !== null) { const group = groups.get(i.segment) ?? []; group.push(i); groups.set(i.segment, group); }
  for (const group of Array.from(groups.values())) {
    const start = group[0].start, end = group.at(-1)!.end;
    if (end - start < duration) continue;
    const boundaries = [start, ...group.map(i => i.end)];
    const prefix = [0];
    for (const i of group) prefix.push(prefix.at(-1)! + (i.end - i.start) * i.speed!);
    const integral = (t: number) => {
      let lo = 0, hi = group.length;
      while (lo < hi) { const mid = (lo + hi) >>> 1; if (boundaries[mid] <= t) lo = mid + 1; else hi = mid; }
      const index = Math.min(group.length - 1, Math.max(0, lo - 1));
      return prefix[index] + (t - boundaries[index]) * group[index].speed!;
    };
    for (const t of boundaries.flatMap(t => [t, t + duration])) {
      if (t < start + duration || t > end) continue;
      const speed = (integral(t) - integral(t - duration)) / duration;
      if (bestSpeed === null || speed > bestSpeed) bestSpeed = speed;
    }
  }
  return round(bestSpeed && bestSpeed > 0 ? 1000 / bestSpeed : null);
}

export function deriveRunningContinuousEvidence(raw: unknown, options: { sourceFormat?: unknown; sourceSampleCount?: unknown; durationSeconds?: unknown } = {}): RunningContinuousEvidence {
  const value = jsonValue(raw);
  const rows: unknown[] = Array.isArray(value) ? value : [];
  const intervals: Interval[] = [];
  let previous: Sample | null = null, firstTimestamp: number | null = null, lastTimestamp: number | null = null;
  let lastAcceptedTimestamp = -Infinity, lastAcceptedElapsed = -Infinity, clockOrigin: number | null = null;
  let usable = 0, rejected = 0, maxElapsed: number | null = null, segment = 0;
  let hasAnyMetric = false;
  for (const row of rows) {
    if (!row || typeof row !== "object") { rejected++; previous = null; segment++; continue; }
    const r = row as Record<string, unknown>;
    // The stored parser contract uses explicit timestamp + elapsedSec. Do not infer clocks from indices.
    const t = typeof r.timestamp === "string" && /(?:Z|[+-]\d{2}:\d{2})$/i.test(r.timestamp) ? Date.parse(r.timestamp) / 1000 : NaN;
    const elapsed = inRange(r.elapsedSec, 0, 7 * 86400);
    if (!Number.isFinite(t) || elapsed === null || t <= lastAcceptedTimestamp || elapsed <= lastAcceptedElapsed || (clockOrigin !== null && Math.abs(t - elapsed - clockOrigin) > 2)) { rejected++; previous = null; segment++; continue; }
    const sample: Sample = { t, elapsed, pace: inRange(r.paceSecPerKm, 100, 1800), hr: inRange(r.heartRate, 30, 240), cadence: inRange(r.cadence, 0, 300), power: inRange(r.power, 0, 2500), distance: inRange(r.distanceKm, 0, 2000), altitude: inRange(r.altitudeM, -500, 9000), temperature: inRange(r.temperatureC, -40, 65) };
    firstTimestamp ??= t; lastTimestamp = t; lastAcceptedTimestamp = t; lastAcceptedElapsed = elapsed; clockOrigin ??= t - elapsed;
    maxElapsed = Math.max(maxElapsed ?? 0, elapsed);
    const usableMetric = sample.pace !== null || sample.hr !== null || sample.cadence !== null || sample.power !== null;
    if (usableMetric) usable++;
    hasAnyMetric ||= usableMetric;
    if (previous) {
      const dt = t - previous.t;
      // A fixed conservative limit prevents sparse downsampling from manufacturing continuous efforts.
      if (dt > 0 && dt <= 10 && elapsed > previous.elapsed && Math.abs((elapsed - previous.elapsed) - dt) <= 2) {
        let speed = previous.pace !== null && sample.pace !== null ? (1000 / previous.pace + 1000 / sample.pace) / 2 : null;
        const distanceDelta = sample.distance !== null && previous.distance !== null ? (sample.distance - previous.distance) * 1000 : null;
        if (sample.cadence === 0 || previous.cadence === 0 || (distanceDelta !== null && (distanceDelta <= 0 || distanceDelta / dt > 12))) speed = null;
        const grade = distanceDelta !== null && distanceDelta >= 2 && previous.altitude !== null && sample.altitude !== null ? (sample.altitude - previous.altitude) / distanceDelta * 100 : null;
        if (speed === null) segment++;
        intervals.push({ start: previous.elapsed, end: elapsed, speed, hr: meanPair(previous.hr, sample.hr), cadence: meanPair(previous.cadence, sample.cadence), power: meanPair(previous.power, sample.power), temperature: meanPair(previous.temperature, sample.temperature), grade: grade !== null && Math.abs(grade) <= 40 ? grade : null, segment });
        if (speed === null) segment++;
      } else segment++;
    }
    previous = sample;
  }
  const duration = inRange(options.durationSeconds, 0, 7 * 86400);
  const sourceElapsed = maxElapsed === null && duration === null ? null : Math.max(maxElapsed ?? 0, duration ?? 0);
  const observedSeconds = intervals.reduce((s, i) => s + i.end - i.start, 0);
  const speed = metric(intervals, "speed"), hr = metric(intervals, "hr"), cadence = metric(intervals, "cadence"), power = metric(intervals, "power");
  const coverage = (seconds: number) => sourceElapsed && sourceElapsed > 0 ? round(Math.min(1, seconds / sourceElapsed)) : null;
  const moving = intervals.filter(i => i.speed !== null);
  const groupDurations = new Map<number, number>();
  for (const i of moving) groupDurations.set(i.segment, (groupDurations.get(i.segment) ?? 0) + i.end - i.start);
  const longest = Math.max(0, ...Array.from(groupDurations.values()));
  const midpoint = (sourceElapsed ?? 0) / 2;
  const firstIntervals = clip(moving, 0, midpoint), secondIntervals = clip(moving, midpoint, sourceElapsed ?? 0);
  const firstHalf = half(firstIntervals), secondHalf = half(secondIntervals);
  const pairedFirst = firstIntervals.filter(i => i.hr !== null), pairedSecond = secondIntervals.filter(i => i.hr !== null);
  const firstSpeed = metric(pairedFirst, "speed"), secondSpeed = metric(pairedSecond, "speed");
  const firstGrade = metric(pairedFirst, "grade").mean, secondGrade = metric(pairedSecond, "grade").mean;
  const firstTemp = metric(pairedFirst, "temperature").mean, secondTemp = metric(pairedSecond, "temperature").mean;
  const comparable = firstHalf.pairedSeconds >= 300 && secondHalf.pairedSeconds >= 300 && midpoint > 0
    && firstHalf.pairedSeconds / midpoint >= 0.6 && secondHalf.pairedSeconds / midpoint >= 0.6
    && firstSpeed.mean !== null && secondSpeed.mean !== null && Math.abs(secondSpeed.mean / firstSpeed.mean - 1) <= 0.15
    && firstSpeed.cv !== null && firstSpeed.cv <= 0.2 && secondSpeed.cv !== null && secondSpeed.cv <= 0.2
    && (firstGrade === null || secondGrade === null || Math.abs(firstGrade - secondGrade) <= 2)
    && (firstTemp === null || secondTemp === null || Math.abs(firstTemp - secondTemp) <= 3);
  let stepSeconds = 0, stepSum = 0;
  for (const i of moving) if (i.cadence !== null && i.cadence >= 60) { const dt = i.end - i.start; stepSum += i.speed! * 60 / i.cadence * dt; stepSeconds += dt; }
  const meanPace = speed.mean ? 1000 / speed.mean : null;
  const baselineQualified = usable >= 30 && speed.seconds >= 300 && longest >= 300 && (coverage(speed.seconds) ?? 0) >= 0.75 && speed.cv !== null && speed.cv <= 0.2 && meanPace !== null && meanPace >= 120;
  const limitations = ["保留樣本的時間加權衍生值；不等於原檔逐秒完整精度，均勻抽樣可能隱藏短暫停頓。", "不從配速／心率推定實測 VO₂、乳酸或閾值；預測屬模型而非量測。"];
  if (!hasAnyMetric || !intervals.length) limitations.push("沒有足夠有效時間相鄰樣本；只可用活動摘要。");
  if (!baselineQualified) limitations.push("連續配速覆蓋／穩定性不足以校準預測，保留摘要配速作後備。");
  if (hr.seconds === 0) limitations.push("缺少可用連續心率。");
  if (power.seconds === 0) limitations.push("缺少可用連續功率。");
  if (!comparable) limitations.push("前後半段配對覆蓋、穩定性或環境不可比；不計效率解耦／心率漂移。");
  else limitations.push("效率解耦及心率漂移只是相關現象；坡度、熱力、補水、感測誤差均可混雜，不能診斷疲勞原因。");
  if (metric(moving, "grade").mean === null) limitations.push("缺少可用坡度；無法排除地形混雜。");
  return {
    version: 1, sourceFormat: typeof options.sourceFormat === "string" && /^(FIT|CSV|GPX|TCX)$/.test(options.sourceFormat) ? options.sourceFormat : null,
    sourceSampleCount: inRange(options.sourceSampleCount, 0, 1e8), retainedSampleCount: rows.length, usableSampleCount: usable, rejectedSampleCount: rejected,
    sourceElapsedSeconds: sourceElapsed, retainedSpanSeconds: firstTimestamp !== null && lastTimestamp !== null ? lastTimestamp - firstTimestamp : null,
    observedSeconds, movingSeconds: speed.seconds, longestContinuousSeconds: longest, coverage: coverage(observedSeconds), paceCoverage: coverage(speed.seconds), heartRateCoverage: coverage(hr.seconds), cadenceCoverage: coverage(cadence.seconds), powerCoverage: coverage(power.seconds),
    meanMovingPaceSecPerKm: round(meanPace), meanHeartRate: round(hr.mean), meanCadence: round(cadence.mean), meanPowerWatts: round(power.mean), meanTemperatureC: round(metric(intervals, "temperature").mean), meanAbsoluteGradePct: round(metric(moving.map(i => ({ ...i, grade: i.grade === null ? null : Math.abs(i.grade) })), "grade").mean), derivedStepLengthM: round(stepSeconds ? stepSum / stepSeconds : null),
    firstHalf, secondHalf,
    heartRateDriftPct: comparable && firstHalf.pairedHeartRate && secondHalf.pairedHeartRate ? round((secondHalf.pairedHeartRate / firstHalf.pairedHeartRate - 1) * 100) : null,
    latePaceChangePct: firstHalf.movingSeconds >= 60 && secondHalf.movingSeconds >= 60 && firstHalf.paceSecPerKm && secondHalf.paceSecPerKm ? round((secondHalf.paceSecPerKm / firstHalf.paceSecPerKm - 1) * 100) : null,
    efficiencyDecouplingPct: comparable && firstHalf.pairedSpeedMps && secondHalf.pairedSpeedMps && firstHalf.pairedHeartRate && secondHalf.pairedHeartRate ? round((1 - (secondHalf.pairedSpeedMps / secondHalf.pairedHeartRate) / (firstHalf.pairedSpeedMps / firstHalf.pairedHeartRate)) * 100) : null,
    bestObservedPace: { seconds60: sustainedPace(intervals, 60), seconds300: sustainedPace(intervals, 300), seconds1200: sustainedPace(intervals, 1200) }, baselineQualified, limitations,
  };
}
