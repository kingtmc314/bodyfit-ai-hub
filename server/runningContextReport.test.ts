import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { deriveRunningContinuousEvidence } from "../shared/runningContinuousAnalysis";
import {
  crossValidateRunningContext,
  predictRunningContext,
  type RunningContextHistory,
  type RunningHeldOutPrediction,
} from "../shared/runningCrossValidation";
import { matchRunningPreRunContext } from "../shared/runningPreRunContext";
import type { ContextErrorMetrics, RunningContextReport } from "../shared/runningContextReport";
import type { RunningHistory, RunningHistoryFeature } from "./runningContinuousAnalysis";
import {
  loadRunningRecoveryDataset,
  type Reader,
  type RecoverySleepRow,
  type RunningRecoveryDataset,
} from "./runningRecoveryDataset";
import {
  prepareRunningContextHistory,
  buildRunningContextReport,
  runningContextAIText,
} from "./runningContextReport";

// ENGINEERED TEST FIXTURES ONLY: these equations, health rows and continuous
// summaries are invented to exercise integration. They are NOT user history or
// empirical evidence of physiological/weather effects. No real DB/network/LLM.
const OWNER = 7;
const date = (offset: number) => new Date(Date.UTC(2025, 0, 1 + offset)).toISOString().slice(0, 10);
const start = (offset: number) => `${date(offset)}T08:00:00+08:00`;
const roadKey = "easy|road|flat|moving_pace_seconds_per_km";
type Convention = "unknown" | "wake-date";

function historyOf(runs: RunningHistoryFeature[], complete = true): RunningHistory {
  const dates = runs.map(r => r.date).sort();
  return { runs, coverage: {
    totalRuns: runs.length, processedRuns: runs.length, complete,
    snapshotMaxId: Math.max(0, ...runs.map(r => r.id)),
    continuousRuns: runs.filter(r => r.continuous.observedSeconds > 0).length,
    fitRuns: 0, qualifiedRuns: runs.filter(r => r.continuous.baselineQualified).length,
    earliestHK: dates[0] ?? null, latestHK: dates.at(-1) ?? null,
  } };
}

function runAt(i: number): RunningHistoryFeature {
  const temperatureC = [16, 20, 24, 28, 32][i % 5];
  const pace = 330 + 4 * (temperatureC - 24);
  return {
    id: i + 1, date: date(i), type: "easy", route: "road", shoes: null,
    distanceKm: 10, durationSeconds: pace * 10, summaryPaceSecPerKm: pace,
    summaryHeartRate: 150, maximumHeartRate: 190,
    summaryDynamics: { cadence: null, strideM: null, verticalRatio: null, verticalOscillationCm: null, groundContactMs: null },
    weather: { temperatureC, humidityPct: null, windKph: 0 },
    startTimestamp: start(i),
    weatherProvenance: { source: "engineered-test-only", location: null, observedAt: start(i) },
    continuous: {
      // Use the real builder for every default; only the intentionally engineered
      // summary fields below are overridden. No fabricated raw samples are read.
      ...deriveRunningContinuousEvidence([], {}),
      observedSeconds: pace * 10, movingSeconds: pace * 10,
      longestContinuousSeconds: pace * 10, meanMovingPaceSecPerKm: pace,
      meanAbsoluteGradePct: 0, baselineQualified: true,
    },
  };
}

function rejoin(dataset: RunningRecoveryDataset, convention: Convention = "unknown"): RunningRecoveryDataset {
  return { ...dataset, joined: dataset.history.runs.map(run => ({
    run,
    preRun: matchRunningPreRunContext({ id: run.id, HKdate: run.date, startTimestamp: run.startTimestamp },
      dataset.sleepRows, dataset.heartRows,
      { dateConvention: convention, sleepDurationUnit: "hours", baselineWindowDays: 28 }),
  })) };
}

function fixture(count = 60, convention: Convention = "unknown"): RunningRecoveryDataset {
  const sleepRows: RecoverySleepRow[] = Array.from({ length: count + 38 }, (_, i) => ({
    id: i + 1, date: date(i - 35), sleepDuration: 7,
    bedtime: "23:00:00", waketime: "07:00:00", sleepScore: 80,
    restingHr: null, hrv: 40, source: "manual", durationNormalization: "hours",
  }));
  const heartRows = sleepRows.map(row => ({ id: row.id, date: row.date, restingHr: 60, hrv: 40, source: "manual" }));
  return rejoin({ history: historyOf(Array.from({ length: count }, (_, i) => runAt(i))),
    sleepRows, heartRows, complete: true, joined: [],
    durationNormalization: { legacyMinutesConverted: 0, rejected: 0 },
  }, convention);
}

function mapRuns(dataset: RunningRecoveryDataset,
  fn: (run: RunningHistoryFeature, i: number) => RunningHistoryFeature,
  convention: Convention = "unknown"): RunningRecoveryDataset {
  return rejoin({ ...dataset, history: historyOf(dataset.history.runs.map(fn), dataset.history.coverage.complete) }, convention);
}

function report(dataset: RunningRecoveryDataset, offset = 65,
  input: Partial<Parameters<typeof buildRunningContextReport>[1]> = {}): RunningContextReport {
  return buildRunningContextReport(dataset, { targetDistanceKm: 10, groupKey: roadKey, temperatureC: 28, ...input }, date(offset), start(offset));
}

function engineHistory(dataset: RunningRecoveryDataset): RunningContextHistory {
  return { fullHistoryComplete: dataset.complete,
    runs: prepareRunningContextHistory(dataset).entries.map(e => e.input),
    restingHrHistory: dataset.heartRows.flatMap(r => typeof r.restingHr === "number" && r.restingHr >= 30 && r.restingHr <= 120
      ? [{ hkDate: r.date, restingHrBpm: r.restingHr }] : []),
  };
}

function engineComparisons(dataset: RunningRecoveryDataset, offset = 65, key = roadKey) {
  const prepared = prepareRunningContextHistory(dataset);
  const stratum = prepared.byGroup.get(key)![0].stratum;
  const history = engineHistory(dataset);
  const weatherHistory: RunningContextHistory = { ...history, restingHrHistory: [], runs: history.runs.map(r => ({ ...r,
    context: { temperatureC: r.context.temperatureC, relativeHumidityPct: r.context.relativeHumidityPct },
  })) };
  const cohort = { stratum, referenceDistanceKm: 10, beforeHkDate: date(offset) };
  const full = crossValidateRunningContext(history, cohort);
  const weather = crossValidateRunningContext(weatherHistory, cohort);
  const weatherById = new Map(weather.heldOutPredictions.map(r => [r.runId, r]));
  const commonFull = full.heldOutPredictions.filter(r => weatherById.has(r.runId));
  return { full, weather, commonFull, commonWeather: commonFull.map(r => weatherById.get(r.runId)!) };
}

function independentMetrics(rows: RunningHeldOutPrediction[], kind: "baseline" | "context"): ContextErrorMetrics {
  const errors = rows.map(r => (kind === "baseline" ? r.baselinePaceSecondsPerKm : r.contextPaceSecondsPerKm) - r.measuredPaceSecondsPerKm);
  const percentages = rows.map((r, i) => Math.abs(errors[i]) / r.measuredPaceSecondsPerKm * 100).sort((a, b) => a - b);
  const mid = Math.floor(percentages.length / 2);
  return { count: rows.length, days: new Set(rows.map(r => r.hkDate)).size,
    maeSecPerKm: errors.reduce((sum, e) => sum + Math.abs(e), 0) / rows.length,
    medianAbsolutePercentError: percentages.length % 2 ? percentages[mid] : (percentages[mid - 1] + percentages[mid]) / 2,
    biasSecPerKm: errors.reduce((sum, e) => sum + e, 0) / rows.length,
  };
}

function expectFinite(value: unknown): void {
  if (typeof value === "number") expect(Number.isFinite(value)).toBe(true);
  else if (Array.isArray(value)) value.forEach(expectFinite);
  else if (value && typeof value === "object") Object.values(value).forEach(expectFinite);
}

type AIFacts = {
  complete: boolean; running: number; sleepRecords: number; heartRecords: number;
  focusStartHK: string | null; linkedComparableRuns: number; listedRows: number; omittedRows: number;
  groups: Array<{ key: string; runs: number; distanceRangeKm: number[] }>;
  groupsScope?: string; allHistoryGroups?: unknown;
  rows: Array<{ HK: string; type: string; surface: string; terrain: string; basis: string;
    km: number; pace: number; weather: { C: number | null; humidityPct: number | null; timing: string };
    sleepHours: number | null; sleepHK: string | null; sleepPairing: string | null;
    sleepUsedAsPredictor: boolean; preRunRestingHR: number | null; rhrHK: string | null; rhrDelta: number | null }>;
  validationExample: null | { group: { key: string }; target: string; status: string; metrics: RunningContextReport["metrics"]; reason: string; correctionEnabled: boolean };
  limitations: string;
};
function aiFacts(dataset: RunningRecoveryDataset, focus?: string): AIFacts {
  const lines = runningContextAIText(dataset, focus).trim().split("\n");
  expect(lines[0]).toMatch(/^## /);
  return JSON.parse(lines.slice(1).join("\n")) as AIFacts;
}

describe("running context report integration — engineered fixtures only", () => {
  it("prepares typed measured histories without mutating runs, health rows or matcher outcomes", () => {
    const dataset = fixture();
    const before = JSON.stringify(dataset);
    const prepared = prepareRunningContextHistory(dataset);
    expect(prepared.groups).toEqual([{ key: roadKey, runType: "easy", routeType: "road / flat", paceBasis: "continuous-moving", count: 60, minDistanceKm: 10, maxDistanceKm: 10 }]);
    expect(prepared.entries).toHaveLength(60);
    expect(prepared.entries[0].input.measuredPaceSecondsPerKm).toBe(dataset.history.runs[0].continuous.meanMovingPaceSecPerKm);
    report(dataset);
    aiFacts(dataset);
    expect(JSON.stringify(dataset)).toBe(before);
  });

  it("uses real engine held-outs and recomputes all three error metrics on the exact same observed IDs and days", () => {
    const dataset = fixture();
    const result = report(dataset);
    const { full, weather, commonFull, commonWeather } = engineComparisons(dataset);
    expect(full.status).toBe("supported");
    expect(weather.status).toBe("supported");
    expect(commonFull.length).toBeGreaterThanOrEqual(10);
    expect(result.metrics.baseline).toEqual(independentMetrics(commonFull, "baseline"));
    expect(result.metrics.weatherOnly).toEqual(independentMetrics(commonWeather, "context"));
    expect(result.metrics.fullContext).toEqual(independentMetrics(commonFull, "context"));
    const linked = result.rows.filter(r => r.contextPredictedPace !== null);
    expect(linked.map(r => String(r.id)).sort()).toEqual(commonFull.map(r => r.runId).sort());
    for (const row of linked) {
      const f = commonFull.find(r => r.runId === String(row.id))!;
      const w = commonWeather.find(r => r.runId === String(row.id))!;
      expect(row.dateHK).toBe(f.hkDate);
      expect(row.paceSecPerKm).toBe(f.measuredPaceSecondsPerKm);
      expect(row.paceSecPerKm).toBe(w.measuredPaceSecondsPerKm);
      expect(row.baselinePredictedPace).toBe(f.baselinePaceSecondsPerKm);
      expect(row.weatherPredictedPace).toBe(w.contextPaceSecondsPerKm);
      expect(row.contextPredictedPace).toBe(f.contextPaceSecondsPerKm);
      expect(f.trainingLatestHkDate < row.dateHK).toBe(true);
      expect(w.trainingLatestHkDate < row.dateHK).toBe(true);
    }
    expect(result.metrics.improvementPct).toBeCloseTo((result.metrics.baseline!.maeSecPerKm - result.metrics.fullContext!.maeSecPerKm) / result.metrics.baseline!.maeSecPerKm * 100, 12);
  });

  it("intersects genuinely different full/weather cohorts rather than comparing their independent sample totals", () => {
    let dataset = fixture(60, "wake-date");
    dataset = rejoin({ ...dataset, sleepRows: dataset.sleepRows.map((row, i) => ({ ...row, sleepDuration: 6 + i % 4 / 2 })) }, "wake-date");
    dataset = mapRuns(dataset, (run, i) => ({ ...run, weather: { ...run.weather, temperatureC: i < 30 ? null : run.weather.temperatureC } }), "wake-date");
    const { full, weather, commonFull, commonWeather } = engineComparisons(dataset);
    expect(full.heldOutPredictions.length).toBeGreaterThan(weather.heldOutPredictions.length);
    expect(commonFull.length).toBeGreaterThanOrEqual(10);
    expect(commonFull.length).toBeLessThan(full.heldOutPredictions.length);
    const result = report(dataset, 60, { sleepDateConvention: "wake-date" });
    expect(result.metrics.baseline).toEqual(independentMetrics(commonFull, "baseline"));
    expect(result.metrics.weatherOnly).toEqual(independentMetrics(commonWeather, "context"));
    expect(result.metrics.fullContext).toEqual(independentMetrics(commonFull, "context"));
    const commonIds = new Set(commonFull.map(r => r.runId));
    for (const row of result.rows) {
      expect(row.contextPredictedPace !== null).toBe(commonIds.has(String(row.id)));
      expect(row.baselinePredictedPace !== null).toBe(commonIds.has(String(row.id)));
      expect(row.weatherPredictedPace !== null).toBe(commonIds.has(String(row.id)));
    }
  });

  it("counts same-day twin runs separately but holds out whole HK days and orders evidence deterministically", () => {
    const dataset = fixture();
    const twins = dataset.history.runs.map(r => ({ ...r, id: r.id + 1000 }));
    const joined = rejoin({ ...dataset, history: historyOf([...twins.reverse(), ...dataset.history.runs].reverse()) });
    const result = report(joined);
    const { commonFull } = engineComparisons(joined);
    expect(result.metrics.baseline!.count).toBe(commonFull.length);
    expect(result.metrics.baseline!.count).toBe(result.metrics.baseline!.days * 2);
    expect(result.metrics.weatherOnly!.days).toBe(result.metrics.fullContext!.days);
    expect(result.metrics.weatherOnly!.count).toBe(result.metrics.fullContext!.count);
    expect(result.rows.map(r => [r.dateHK, r.id])).toEqual([...result.rows].sort((a, b) => b.dateHK.localeCompare(a.dateHK) || b.id - a.id).map(r => [r.dateHK, r.id]));
    commonFull.forEach(r => expect(r.trainingLatestHkDate < r.hkDate).toBe(true));
  });

  it("does not turn absent or constant features into zero-error evidence or an improvement claim", () => {
    for (const temperatureC of [null, 24]) {
      const dataset = mapRuns(fixture(), run => ({ ...run, weather: { temperatureC, humidityPct: null, windKph: null } }));
      const result = report(dataset);
      expect(result.featuresUsed).toEqual([]);
      expect(result.metrics).toEqual({ baseline: null, weatherOnly: null, fullContext: null, improvementPct: null });
      expect(result.status).not.toBe("validated-association");
      expect(result.prediction).toMatchObject({ supported: false, correctionEnabled: false, paceSecPerKm: null, interval80SecPerKm: null });
      expect(result.rows.every(r => r.baselinePredictedPace === null && r.weatherPredictedPace === null && r.contextPredictedPace === null)).toBe(true);
    }
  });

  it("has no three-way gain metric when weather has no eligible features even if sleep has measurable variation", () => {
    let dataset = fixture(60, "wake-date");
    dataset = rejoin({ ...dataset, sleepRows: dataset.sleepRows.map((r, i) => ({ ...r, sleepDuration: 6 + i % 4 / 2 })) }, "wake-date");
    dataset = mapRuns(dataset, r => ({ ...r, weather: { temperatureC: null, humidityPct: null, windKph: null } }), "wake-date");
    const engines = engineComparisons(dataset);
    expect(engines.full.heldOutPredictions.length).toBeGreaterThanOrEqual(10);
    expect(engines.weather.heldOutPredictions).toEqual([]);
    const result = report(dataset);
    expect(result.metrics).toEqual({ baseline: null, weatherOnly: null, fullContext: null, improvementPct: null });
  });

  it.each([
    { route: null, grade: 0, key: "easy|unknown|flat|moving_pace_seconds_per_km" },
    { route: "unknown", grade: 0, key: "easy|unknown|flat|moving_pace_seconds_per_km" },
    { route: "road", grade: null, key: "easy|road|unknown|moving_pace_seconds_per_km" },
    { route: null, grade: null, key: "easy|unknown|unknown|moving_pace_seconds_per_km" },
  ])("permits descriptive metrics but never correction for unknown surface/terrain: $key", ({ route, grade, key }) => {
    const dataset = mapRuns(fixture(), r => ({ ...r, route, continuous: { ...r.continuous, meanAbsoluteGradePct: grade } }));
    const prepared = prepareRunningContextHistory(dataset);
    expect(prepared.groups[0].key).toBe(key);
    expect(prepared.entries.every(e => e.stratum.surface === (route === "road" ? "road" : "unknown"))).toBe(true);
    const result = report(dataset, 65, { groupKey: key });
    expect(result.metrics.fullContext!.days).toBeGreaterThanOrEqual(10);
    expect(result.status).toBe("unsupported-context");
    expect(result.prediction).toMatchObject({ supported: false, correctionEnabled: false, paceSecPerKm: null, interval80SecPerKm: null });
    expect(result.statusReason).toMatch(/描述性|未核對/);
  });

  it("does not silently replace an explicitly selected unavailable/unsupported group with the majority road group", () => {
    const dataset = fixture();
    for (const groupKey of ["easy|trail|flat|moving_pace_seconds_per_km", "tempo|track|flat|summary_pace_seconds_per_km", "nonexistent"]) {
      const result = report(dataset, 65, { groupKey });
      expect(result.groups[0].key).toBe(roadKey);
      expect(result.selectedGroup).toBeNull();
      expect(result.rows).toEqual([]);
      expect(result.coverage.selectedRuns).toBe(0);
      expect(result.metrics.fullContext).toBeNull();
      expect(result.prediction.correctionEnabled).toBe(false);
    }
  });

  it("keeps types, summary/moving target definitions and verified terrain separate and excludes unsupported route labels", () => {
    const dataset = mapRuns(fixture(8), (r, i) => {
      if (i === 0) return { ...r, type: "tempo" };
      if (i === 1) return { ...r, route: "track" };
      if (i === 2) return { ...r, continuous: { ...r.continuous, meanAbsoluteGradePct: 2 } };
      if (i === 3) return { ...r, continuous: { ...r.continuous, baselineQualified: false, meanMovingPaceSecPerKm: 1000 } };
      if (i === 4) return { ...r, route: "mixed" };
      if (i === 5) return { ...r, type: "interval" };
      if (i === 6) return { ...r, route: "trail" };
      return r;
    });
    const prepared = prepareRunningContextHistory(dataset);
    expect(prepared.entries.map(e => e.input.id)).toEqual(["1", "2", "3", "4", "8"]);
    expect(prepared.groups.map(g => g.key)).toEqual(expect.arrayContaining([
      roadKey, "tempo|road|flat|moving_pace_seconds_per_km", "easy|track|flat|moving_pace_seconds_per_km",
      "easy|road|rolling|moving_pace_seconds_per_km", "easy|road|flat|summary_pace_seconds_per_km",
    ]));
    expect(prepared.entries.find(e => e.input.id === "4")!.evidence).toMatchObject({ paceBasis: "summary", paceSecPerKm: dataset.history.runs[3].summaryPaceSecPerKm });
  });

  it("displays prior-date sleep provenance without treating a lower-confidence proxy as numeric sleep", () => {
    const dataset = fixture();
    const prepared = prepareRunningContextHistory(dataset);
    for (const entry of prepared.entries) {
      const preRun = dataset.joined.find(j => j.run.id === entry.evidence.id)!.preRun;
      expect(preRun.sleep).toMatchObject({ confidence: "lower-confidence", pairingMethod: "prior-date-proxy", measuredAt: null });
      expect(entry.input.context.preRunSleepHours).toBeNull();
      expect(entry.evidence).toMatchObject({ sleepHours: 7, sleepDateHK: preRun.sleep!.date, sleepMethod: "prior-date-proxy" });
      expect(entry.evidence.sleepDateHK! < entry.evidence.dateHK).toBe(true);
    }
    const result = report(dataset, 60);
    expect(result.coverage.sleep).toBe(0);
    expect(result.coverage.priorDateSleepProxy).toBe(60);
    expect(result.featuresUsed).not.toContain("已核對跑前睡眠");
    expect(result.prediction).toMatchObject({ currentSleepHours: null, currentSleepDateHK: date(59) });
    const facts = aiFacts(dataset);
    expect(facts.rows.every(r => r.sleepHours === 7 && r.sleepUsedAsPredictor === false && r.sleepPairing === "prior-date-proxy")).toBe(true);
  });

  it("uses wake-date-confirmed sleep only after actual wake-before-run matching, including the current query", () => {
    const dataset = fixture(60, "wake-date");
    const prepared = prepareRunningContextHistory(dataset);
    expect(prepared.entries.every(e => e.input.context.preRunSleepHours === 7 && e.evidence.sleepMethod === "adapter-confirmed-wake-date")).toBe(true);
    const result = report(dataset, 60, { sleepDateConvention: "wake-date" });
    expect(result.coverage.sleep).toBe(60);
    expect(result.coverage.priorDateSleepProxy).toBe(0);
    expect(result.prediction).toMatchObject({ currentSleepHours: 7, currentSleepDateHK: date(60) });
    const late = rejoin({ ...dataset, sleepRows: dataset.sleepRows.map(r => ({ ...r, waketime: "09:00:00" })) }, "wake-date");
    const lateResult = report(late, 60, { sleepDateConvention: "wake-date" });
    expect(lateResult.prediction.currentSleepDateHK).toBe(date(59));
    expect(late.joined[0].preRun.sleep!.measurementHKdate).toBe(date(-1));
  });

  it("reports date-only earlier resting HR/baseline, never exercise average/max HR or same-day daily HR", () => {
    const dataset = mapRuns(fixture(), r => ({ ...r, summaryHeartRate: 171, maximumHeartRate: 209 }));
    const result = report(dataset, 60);
    expect(result.coverage.restingHR).toBe(60);
    expect(result.coverage.restingHRDelta).toBe(60);
    for (const row of result.rows) {
      expect(row.restingHR).toBe(60);
      expect(row.restingHRDeltaBpm).toBe(0);
      expect(row.restingHRDateHK! < row.dateHK).toBe(true);
      const outcome = dataset.joined.find(j => j.run.id === row.id)!.preRun;
      expect(outcome.restingHr).toMatchObject({ kind: "prior-day-heart-summary", measuredAt: null });
      expect(outcome.baseline.records.every(r => r.measurementHKdate < outcome.restingHr!.measurementHKdate)).toBe(true);
    }
    const noHearts = rejoin({ ...dataset, heartRows: [] });
    expect(report(noHearts, 60).rows.every(r => r.restingHR === null && r.restingHRDeltaBpm === null)).toBe(true);
    expect(report(noHearts, 60).coverage.restingHR).toBe(0);
    expect(result.prediction.currentRestingHRDateHK).toBe(date(59));
    expect(result.limitations.join(" ")).toMatch(/運動平均／最大心率不是靜止心率/);
  });

  it("preserves actually measured zero error and zero weather/delta values while missing evidence remains null", () => {
    const constantPace = mapRuns(fixture(), r => ({ ...r, summaryPaceSecPerKm: 330,
      continuous: { ...r.continuous, meanMovingPaceSecPerKm: 330 } }));
    const zeroError = report(constantPace);
    expect(zeroError.metrics.baseline).toMatchObject({ maeSecPerKm: 0, medianAbsolutePercentError: 0, biasSecPerKm: 0 });
    expect(zeroError.metrics.fullContext).toMatchObject({ maeSecPerKm: 0, medianAbsolutePercentError: 0, biasSecPerKm: 0 });
    expect(zeroError.metrics.improvementPct).toBeNull();
    expect(zeroError.prediction.paceSecPerKm).toBeNull();
    expectFinite(zeroError);
    const zeros = mapRuns(fixture(2), (r, i) => ({ ...r, weather: { temperatureC: i === 0 ? 0 : null, humidityPct: i === 0 ? 0 : null, windKph: i === 0 ? 0 : null } }));
    const result = report(zeros);
    expect(result.rows.find(r => r.id === 1)).toMatchObject({ temperatureC: 0, humidityPct: 0, windKph: 0, restingHRDeltaBpm: 0 });
    expect(result.rows.find(r => r.id === 2)).toMatchObject({ temperatureC: null, humidityPct: null, windKph: null });
    expect(result.coverage).toMatchObject({ temperature: 1, humidity: 1 });
    expect(result.metrics.fullContext).toBeNull();
  });

  it("returns null-safe insufficient evidence for empty and short snapshots, not fabricated zero-error scores", () => {
    for (const count of [0, 19, 29]) {
      const result = report(fixture(count));
      expect(result.status).toBe("insufficient-data");
      expect(result.prediction).toMatchObject({ correctionEnabled: false, paceSecPerKm: null, interval80SecPerKm: null });
      if (count < 20) expect(result.metrics).toEqual({ baseline: null, weatherOnly: null, fullContext: null, improvementPct: null });
      else expect(result.metrics.baseline!.days).toBeLessThan(10);
      expectFinite(result);
    }
  });

  it("counts column coverage over the selected chronological cohort without upgrading missing/proxy values", () => {
    let dataset = mapRuns(fixture(), (r, i) => ({ ...r, weather: {
      temperatureC: i % 3 === 0 ? null : r.weather.temperatureC,
      humidityPct: i % 2 === 0 ? 50 : null, windKph: i % 4 === 0 ? null : 0,
    } }));
    dataset = rejoin({ ...dataset, sleepRows: dataset.sleepRows.filter(r => r.date !== date(10)) });
    const prepared = prepareRunningContextHistory(dataset).entries;
    const result = report(dataset, 45);
    const selected = prepared.filter(e => e.input.hkDate < date(45));
    expect(result.coverage).toEqual({
      runs: 60, sleeps: dataset.sleepRows.length, hearts: dataset.heartRows.length, selectedRuns: selected.length,
      temperature: selected.filter(e => e.evidence.temperatureC !== null).length,
      humidity: selected.filter(e => e.evidence.humidityPct !== null).length,
      sleep: selected.filter(e => e.input.context.preRunSleepHours !== null).length,
      restingHR: selected.filter(e => e.evidence.restingHR !== null).length,
      restingHRDelta: selected.filter(e => e.evidence.restingHRDeltaBpm !== null).length,
      priorDateSleepProxy: selected.filter(e => e.evidence.sleepMethod === "prior-date-proxy").length,
    });
    expect(result.rows.every(r => r.dateHK < date(45))).toBe(true);
    expect(result.rows[0].dateHK).toBe(date(44));
    expect(result.rows.at(-1)!.dateHK).toBe(date(0));
  });

  it("excludes same-day and future targets/features from current-query statistics, predictions and evidence", () => {
    const dataset = fixture();
    const cutoff = 45;
    const earlier = rejoin({ ...dataset, history: historyOf(dataset.history.runs.filter(r => r.date < date(cutoff))) });
    const changed = mapRuns(dataset, (r, i) => i < cutoff ? r : ({ ...r, summaryPaceSecPerKm: 1500,
      continuous: { ...r.continuous, meanMovingPaceSecPerKm: 1500 }, weather: { temperatureC: 54, humidityPct: 100, windKph: 150 },
    }));
    const a = report(dataset, cutoff), b = report(earlier, cutoff), c = report(changed, cutoff);
    expect(a.metrics).toEqual(b.metrics);
    expect(a.metrics).toEqual(c.metrics);
    expect(a.prediction).toEqual(b.prediction);
    expect(a.prediction).toEqual(c.prediction);
    expect(a.rows).toEqual(b.rows);
    expect(a.rows).toEqual(c.rows);
    expect(a.coverage.selectedRuns).toBe(cutoff);
    expect(a.rows.every(r => r.dateHK < date(cutoff))).toBe(true);
  });

  it.each(["missing-observation", "date-only", "misaligned", "missing-start"])("blocks weather correction for $0 provenance even when the actual synthetic estimator validates", quality => {
    const good = fixture();
    const goodReport = report(good, 60);
    expect(goodReport.prediction.correctionEnabled).toBe(true);
    const dataset = mapRuns(good, r => ({ ...r,
      startTimestamp: quality === "missing-start" ? null : r.startTimestamp,
      weatherProvenance: { source: "engineered-test-only", location: null,
        observedAt: quality === "missing-observation" ? null : quality === "date-only" ? r.date : quality === "misaligned" ? `${r.date}T00:00:00+08:00` : r.startTimestamp!,
      },
    }));
    const history = engineHistory(dataset);
    const engine = predictRunningContext(history, { hkDate: date(60), stratum: history.runs[0].stratum, distanceKm: 10, context: { temperatureC: 28 } });
    expect(engine.autoApplyAllowed).toBe(true);
    const result = report(dataset, 60);
    expect(result.metrics).toEqual(goodReport.metrics);
    expect(result.prediction).toMatchObject({ supported: false, correctionEnabled: false, paceSecPerKm: null, interval80SecPerKm: null });
    expect(result.prediction.reason).toMatch(/歷史天氣時刻未與跑步起點核對/);
    expect(result.rows.every(r => r.weatherQuality !== "已保存時刻接近跑步起點")).toBe(true);
  });

  it("keeps validation evidence distinct from query support and blocks incomplete history", () => {
    const dataset = fixture();
    expect(report(dataset, 60).prediction.correctionEnabled).toBe(true);
    const missingInput = report(dataset, 60, { temperatureC: undefined });
    expect(missingInput.status).toBe("validated-association");
    expect(missingInput.prediction.correctionEnabled).toBe(false);
    expect(missingInput.prediction.paceSecPerKm).toBeNull();
    const incomplete = report({ ...dataset, complete: false });
    expect(incomplete.historyComplete).toBe(false);
    expect(incomplete.metrics.fullContext).not.toBeNull();
    expect(incomplete.prediction.correctionEnabled).toBe(false);
    expect(incomplete.limitations.join(" ")).toMatch(/分頁未完成/);
  });

  it("discloses the 200-row evidence cap while complete history, coverage, groups and all-row statistics stay intact", () => {
    const dataset = fixture(225);
    const prepared = prepareRunningContextHistory(dataset);
    const { commonFull, commonWeather } = engineComparisons(dataset, 225);
    const result = report(dataset, 225);
    expect(dataset.history.runs).toHaveLength(225);
    expect(prepared.entries).toHaveLength(225);
    expect(prepared.groups[0].count).toBe(225);
    expect(result.historyComplete).toBe(true);
    expect(result.coverage.selectedRuns).toBe(225);
    expect(result.rows).toHaveLength(200);
    expect(result.rows[0].dateHK).toBe(date(224));
    expect(result.rows.at(-1)!.dateHK).toBe(date(25));
    expect(result.metrics.baseline!.count).toBeGreaterThan(result.rows.length);
    expect(result.metrics.baseline).toEqual(independentMetrics(commonFull, "baseline"));
    expect(result.metrics.weatherOnly).toEqual(independentMetrics(commonWeather, "context"));
    expect(result.metrics.fullContext).toEqual(independentMetrics(commonFull, "context"));
    expect(result.limitations.join(" ")).toMatch(/最近200筆；統計及驗算仍計入全部相符活動/);
  });

  it("emits compact structured AI facts with honest count/omission accounting and explicit uncertainty", () => {
    const dataset = fixture();
    const facts = aiFacts(dataset);
    expect(facts).toMatchObject({ complete: true, running: 60, linkedComparableRuns: 60, focusStartHK: null, listedRows: 30, omittedRows: 30 });
    expect(facts.rows).toHaveLength(30);
    expect(facts.groups[0]).toMatchObject({ key: roadKey, runs: 60, distanceRangeKm: [10, 10] });
    expect(facts.rows[0].HK).toBe(date(59));
    expect(facts.rows.at(-1)!.HK).toBe(date(30));
    expect(facts.rows.every(r => r.basis === "continuous-moving" && r.sleepUsedAsPredictor === false)).toBe(true);
    expect(facts.validationExample!.target).toMatch(/非賽事預測/);
    expect(facts.limitations).toMatch(/日期未知代理不作數值預測/);
    expect(facts.limitations).toMatch(/缺值不為零/);
    expect(facts.limitations).toMatch(/禁止把關聯當因果|捏造係數\/精確增益/);
    expect(runningContextAIText(dataset).length).toBeLessThan(19000);
    expectFinite(facts);
  });

  it("never leaks GPS, raw metadata/source URLs, hashes, notes or credentials into AI facts", () => {
    const dataset = mapRuns(fixture(), r => ({ ...r,
      shoes: "Bearer synthetic-private-token",
      weatherProvenance: { source: "https://private.invalid/source?api_key=synthetic-credential", location: "GPS_PRIVATE_SENTINEL", observedAt: r.startTimestamp! },
      continuous: { ...r.continuous, limitations: ["RAW_SOURCE_SENTINEL", "SHA256_PRIVATE_SENTINEL"] },
      rawSource: "RAW_SOURCE_SENTINEL", gps: { latitude: 22.123456, longitude: 114.123456 },
      hash: "SHA256_PRIVATE_SENTINEL", notes: "PRIVATE_NOTE_SENTINEL", credentials: "synthetic-credential",
    }));
    dataset.sleepRows = dataset.sleepRows.map(r => ({ ...r, source: "Bearer synthetic-private-token" }));
    dataset.heartRows = dataset.heartRows.map(r => ({ ...r, source: "https://private.invalid/heart" }));
    const text = runningContextAIText(rejoin(dataset));
    expect(text).not.toMatch(/GPS_PRIVATE_SENTINEL|RAW_SOURCE_SENTINEL|SHA256_PRIVATE_SENTINEL|PRIVATE_NOTE_SENTINEL|synthetic-private-token|synthetic-credential|private\.invalid|22\.123456|114\.123456/);
    expect(text).not.toMatch(/"(?:gps|latitude|longitude|hash|rawSource|credentials|notes|sourceUrl)"/);
  });

  it("separates focus-period rows/counts from whole-history totals, including an empty focus", () => {
    const dataset = fixture();
    const facts = aiFacts(dataset, date(45));
    expect(facts).toMatchObject({ running: 60, focusStartHK: date(45), linkedComparableRuns: 15, listedRows: 15, omittedRows: 0 });
    expect(facts.rows.every(r => r.HK >= date(45))).toBe(true);
    const empty = aiFacts(dataset, date(90));
    expect(empty).toMatchObject({ running: 60, linkedComparableRuns: 0, listedRows: 0, omittedRows: 0, rows: [], validationExample: null });
  });

  it("does not present old-only groups as unscoped focus-period groups", () => {
    const dataset = mapRuns(fixture(), (r, i) => i < 30 ? { ...r, type: "tempo", route: "track" } : r);
    const facts = aiFacts(dataset, date(45));
    expect(facts.rows.every(r => r.type === "easy" && r.surface === "road")).toBe(true);
    expect(facts.linkedComparableRuns).toBe(15);
    // All-history group summaries are fine, but must be explicitly scoped or
    // separated from focus groups; focusStartHK alone does not scope old counts.
    const explicitlyAllHistory = facts.groupsScope === "all-history" || facts.allHistoryGroups !== undefined;
    if (!explicitlyAllHistory) expect(facts.groups.some(g => g.key.startsWith("tempo|track|"))).toBe(false);
  });
});

type StoredHealth = Record<string, unknown> & { id: number; user_id: number; date: string };
type HealthTable = "sleep_logs" | "heart_rate_logs";
function ownerScopedFakeReader(sleep: StoredHealth[], heart: StoredHealth[]) {
  const dialect = new PgDialect();
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const db: Reader = { execute: async query => {
    const rendered = dialect.sqlToQuery(query);
    queries.push(rendered);
    const table = /FROM (sleep_logs|heart_rate_logs)/.exec(rendered.sql)?.[1] as HealthTable | undefined;
    if (!table) throw new Error("Test fake only supports owner-scoped health SELECTs");
    const rows = table === "sleep_logs" ? sleep : heart;
    const owner = Number(rendered.params[0]);
    if (/COUNT\(\*\)/.test(rendered.sql)) {
      const eligible = rows.filter(r => r.user_id === owner && r.date <= String(rendered.params[1]));
      return { rows: [{ total: eligible.length, max_id: eligible.length ? Math.max(...eligible.map(r => r.id)) : null }] };
    }
    const [, cursor, maxId, cutoff] = rendered.params;
    return { rows: rows.filter(r => r.user_id === owner && r.id > Number(cursor) && r.id <= Number(maxId) && r.date <= String(cutoff))
      .sort((a, b) => a.id - b.id).slice(0, 200) };
  } };
  return { db, queries };
}

describe("running context report with owner-scoped in-memory health adapter", () => {
  it("integrates actual adapter/matcher/report/AI with all fake health types and fresh reads, never foreign-owner data or writes", async () => {
    const base = fixture();
    const sleep: StoredHealth[] = base.sleepRows.map(r => ({ id: Number(r.id), user_id: OWNER, date: r.date,
      sleep_duration: r.sleepDuration, bedtime: r.bedtime, waketime: r.waketime,
      sleep_score: r.sleepScore, resting_hr: r.restingHr, hrv: r.hrv, source: r.source,
    }));
    const heart: StoredHealth[] = base.heartRows.map(r => ({ id: Number(r.id), user_id: OWNER, date: r.date,
      resting_hr: r.restingHr, hrv: r.hrv, source: r.source,
    }));
    sleep.push({ id: 999, user_id: 99, date: date(60), sleep_duration: 2, bedtime: "23:00", waketime: "07:00", source: "manual" });
    heart.push({ id: 999, user_id: 99, date: date(59), resting_hr: 119, hrv: 999, source: "manual" });
    const { db, queries } = ownerScopedFakeReader(sleep, heart);
    const first = await loadRunningRecoveryDataset(db, OWNER, base.history, date(60), { dateConvention: "wake-date" });
    const a = report(first, 60, { sleepDateConvention: "wake-date" });
    expect(first.complete).toBe(true);
    expect(first.sleepRows.every(r => Number(r.id) !== 999)).toBe(true);
    expect(first.heartRows.every(r => Number(r.id) !== 999)).toBe(true);
    expect(a.prediction).toMatchObject({ currentSleepHours: 7, currentSleepDateHK: date(60), currentRestingHRDeltaBpm: 0, currentRestingHRDateHK: date(59) });
    // Deliberately mutate only in-memory source fixtures between two real adapter
    // calls. Current query values must be freshly loaded, not module-cached.
    sleep.find(r => r.user_id === OWNER && r.date === date(60))!.sleep_duration = 5;
    heart.find(r => r.user_id === OWNER && r.date === date(59))!.resting_hr = 62;
    const second = await loadRunningRecoveryDataset(db, OWNER, base.history, date(60), { dateConvention: "wake-date" });
    const b = report(second, 60, { sleepDateConvention: "wake-date" });
    expect(b.prediction).toMatchObject({ currentSleepHours: 5, currentRestingHRDeltaBpm: 2 });
    expect(b.metrics).toEqual(a.metrics);
    expect(aiFacts(second).heartRecords).toBe(second.heartRows.length);
    expect(aiFacts(second).sleepRecords).toBe(second.sleepRows.length);
    expect(queries.filter(q => /COUNT\(\*\)/.test(q.sql))).toHaveLength(4);
    for (const query of queries) {
      expect(query.sql).toMatch(/^\s*SELECT /);
      expect(query.sql).toMatch(/WHERE user_id = \$\d+/);
      expect(query.sql).toMatch(/LIMIT (?:1|200)\b/);
      expect(query.params[0]).toBe(OWNER);
      expect(query.params.at(-1)).toBe(date(60));
      expect(query.sql).not.toMatch(/INSERT|UPDATE|DELETE|ALTER|CREATE|SELECT \*|running_logs|notes|avg_hr|high_hr/);
    }
  });
});
