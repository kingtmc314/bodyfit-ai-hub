import { describe, expect, it } from "vitest";
import { deriveRunningContinuousEvidence, finiteRunningNumber, parseRunningPaceSeconds } from "../shared/runningContinuousAnalysis";
import { selectLabHistoricalRuns } from "../shared/labHistoricalSelector";
import { buildRunningEnergySimulation } from "../client/src/lib/runningEnergyModel";
import { runningRowFeature, toLabHistoricalRun, buildRunningHistoryContext, type RunningHistory } from "./runningContinuousAnalysis";

const origin = Date.parse("2026-10-01T23:00:00Z");
function sample(t: number, extra: Record<string, unknown> = {}) {
  return { elapsedSec: t, timestamp: new Date(origin + t * 1000).toISOString(), paceSecPerKm: 300, heartRate: 150, cadence: 180, power: 250, ...extra };
}
function steady(seconds: number, step = 1, extra: Record<string, unknown> = {}) {
  return Array.from({ length: Math.floor(seconds / step) + 1 }, (_, i) => sample(i * step, extra));
}
function row(id = 1, timeSeries: unknown = steady(1200)) {
  return { id, date: "2026-10-02", distance_km: "10", average_pace: "6:00", average_heart_rate: null, maximum_heart_rate: null, running_type: "Easy", route_type: "Road", source_format: "FIT", source_sample_count: 1201, minutes: 20, time_series: timeSeries };
}
function historyOf(count: number): RunningHistory {
  const runs = Array.from({ length: count }, (_, i) => runningRowFeature({ ...row(i + 1, null), date: i === 0 ? "2020-01-01" : "2026-10-02" }));
  return { runs, coverage: { totalRuns: count, processedRuns: count, complete: true, snapshotMaxId: count, continuousRuns: 0, fitRuns: 0, qualifiedRuns: 0, earliestHK: "2020-01-01", latestHK: "2026-10-02" } };
}
function packedContext(context: string) {
  const header = JSON.parse(context.split("\n")[1]);
  const monthlyText = context.split("## 全歷史逐月摘要")[1].split("\n").slice(1).join("\n").split("## 逐次緊湊特徵")[0].trim();
  const perRunText = context.split("## 逐次緊湊特徵")[1].split("\n").slice(1).join("\n").split("## 共同限制")[0].trim();
  return { header, months: monthlyText ? monthlyText.split("\n").map(line => JSON.parse(line)) : [], runs: perRunText ? perRunText.split("\n").map(line => JSON.parse(line)) : [], perRunChars: perRunText ? perRunText.length + 1 : 0 };
}

describe("continuous running evidence", () => {
  it("uses interval duration, not point-count means, including irregular sampling", () => {
    const evidence = deriveRunningContinuousEvidence([sample(0, { heartRate: 100, cadence: 160, power: 100 }), sample(1, { heartRate: 100, cadence: 160, power: 100 }), sample(10, { heartRate: 200, cadence: 200, power: 300 })]);
    expect(evidence.meanHeartRate).toBe(145);
    expect(evidence.meanCadence).toBe(178);
    expect(evidence.meanPowerWatts).toBe(190);
    expect(evidence.meanMovingPaceSecPerKm).toBe(300);
    expect(evidence.observedSeconds).toBe(10);
    expect(evidence.sourceElapsedSeconds).toBe(10);
  });

  it("retains missing values as null and rejects duplicates, reverse clocks, invalid timestamps and implausible values", () => {
    expect(finiteRunningNumber(null)).toBeNull();
    expect(finiteRunningNumber([])).toBeNull();
    const evidence = deriveRunningContinuousEvidence([
      sample(0, { heartRate: null, power: null }), sample(1, { heartRate: null, power: null }),
      sample(1), sample(0), sample(2, { heartRate: 900, power: -10 }),
      sample(3, { heartRate: null, power: null }), sample(4, { elapsedSec: 0 }),
      { elapsedSec: 5, timestamp: "2026-01-01T00:00:00" },
    ]);
    expect(evidence.rejectedSampleCount).toBe(4);
    expect(evidence.meanHeartRate).toBeNull();
    expect(evidence.meanPowerWatts).toBeNull();
    expect(evidence.heartRateCoverage).toBe(0);
    expect(evidence.powerCoverage).toBe(0);
    expect(evidence.efficiencyDecouplingPct).toBeNull();
  });

  it("does not interpolate rolling efforts across gaps or pauses", () => {
    const gappy = [...steady(40), ...Array.from({ length: 41 }, (_, i) => sample(i + 100))];
    const evidence = deriveRunningContinuousEvidence(gappy, { durationSeconds: 140 });
    expect(evidence.bestObservedPace.seconds60).toBeNull();
    expect(evidence.longestContinuousSeconds).toBe(40);
    expect(evidence.movingSeconds).toBe(80);
    expect(evidence.baselineQualified).toBe(false);
    const paused = steady(100).map((s, i) => i === 50 ? { ...s, cadence: 0 } : s);
    expect(deriveRunningContinuousEvidence(paused).bestObservedPace.seconds60).toBeNull();
    const stoppedDistance = steady(100).map(s => ({ ...s, distanceKm: 1 }));
    expect(deriveRunningContinuousEvidence(stoppedDistance).movingSeconds).toBe(0);
  });

  it("computes comparable paired halves, drift and HR-speed decoupling without claiming causality", () => {
    const samples = steady(1800).map((s, i) => ({ ...s, heartRate: i < 900 ? 150 : 165, altitudeM: 20, temperatureC: 24, distanceKm: i / 300 }));
    const evidence = deriveRunningContinuousEvidence(samples, { sourceFormat: "FIT", sourceSampleCount: 1801 });
    expect(evidence.heartRateDriftPct).toBeCloseTo(10, 1);
    expect(evidence.efficiencyDecouplingPct).toBeCloseTo(9.09, 1);
    expect(evidence.latePaceChangePct).toBe(0);
    expect(evidence.firstHalf.pairedSeconds).toBe(900);
    expect(evidence.secondHalf.pairedSeconds).toBe(900);
    expect(evidence.bestObservedPace).toEqual({ seconds60: 300, seconds300: 300, seconds1200: 300 });
    expect(evidence.derivedStepLengthM).toBeCloseTo(1.1111, 4);
    expect(evidence.baselineQualified).toBe(true);
    expect(evidence.limitations.join(" ")).toContain("不能診斷");
    const hot = samples.map((s, i) => ({ ...s, temperatureC: i < 900 ? 20 : 30 }));
    expect(deriveRunningContinuousEvidence(hot).efficiencyDecouplingPct).toBeNull();
  });

  it("uses full retained duration including late samples beyond the first 10,000", () => {
    const samples = steady(12000).map((s, i) => ({ ...s, paceSecPerKm: i < 10000 ? 300 : 400 }));
    const evidence = deriveRunningContinuousEvidence(samples, { sourceSampleCount: 50000, sourceFormat: "FIT" });
    expect(evidence.retainedSampleCount).toBe(12001);
    expect(evidence.sourceSampleCount).toBe(50000);
    expect(evidence.sourceElapsedSeconds).toBe(12000);
    expect(evidence.coverage).toBe(1);
    expect(evidence.meanMovingPaceSecPerKm).toBeGreaterThan(310);
    expect(evidence.latePaceChangePct).toBeGreaterThan(0);
    // Parser already retains at most 10k uniform samples across the whole activity.
    const uniform = Array.from({ length: 10000 }, (_, i) => sample(Math.round(i * 60000 / 9999)));
    const retained = deriveRunningContinuousEvidence(uniform, { sourceSampleCount: 60001 });
    expect(retained.sourceElapsedSeconds).toBe(60000);
    expect(retained.observedSeconds).toBe(60000);
    expect(retained.bestObservedPace.seconds1200).toBe(300);
    const sparse = steady(6000, 30);
    expect(deriveRunningContinuousEvidence(sparse).baselineQualified).toBe(false);
  });

  it("keeps no-data and manual summary fallback, and safely parses decimal minutes and MM:SS", () => {
    const empty = deriveRunningContinuousEvidence(null, { durationSeconds: 3600 });
    expect(empty.sourceElapsedSeconds).toBe(3600);
    expect(empty.usableSampleCount).toBe(0);
    expect(empty.meanHeartRate).toBeNull();
    expect(empty.meanMovingPaceSecPerKm).toBeNull();
    expect(empty.baselineQualified).toBe(false);
    expect(parseRunningPaceSeconds("5:30")).toBe(330);
    expect(parseRunningPaceSeconds("5.5")).toBe(330);
    expect(parseRunningPaceSeconds("5:99")).toBeNull();
    expect(parseRunningPaceSeconds(null)).toBeNull();
    expect(selectLabHistoricalRuns([toLabHistoricalRun(runningRowFeature(row(1, null)))], "easy", "10K").baselinePaceSecPerKm).toBe(360);
  });

  it("qualified FIT evidence changes the actual lab modeled finish while low coverage and incompatible evidence do not", () => {
    const qualified = toLabHistoricalRun(runningRowFeature(row()));
    const summary = { ...qualified, continuous: undefined };
    const chosen = selectLabHistoricalRuns([qualified], "easy", "10K");
    const fallback = selectLabHistoricalRuns([summary], "easy", "10K");
    expect(chosen.baselinePaceSecPerKm).toBe(300);
    expect(chosen.fitRunCount).toBe(1);
    expect(chosen.continuousCoverage).toBe(1);
    const input = { scenario: "easy" as const, easyRunDistance: "10K" as const, temperatureC: 18, humidityPct: 55, windKph: 5 };
    expect(buildRunningEnergySimulation({ ...input, baselinePaceSecPerKm: chosen.baselinePaceSecPerKm! }).baselineFinishSeconds).toBeLessThan(buildRunningEnergySimulation({ ...input, baselinePaceSecPerKm: fallback.baselinePaceSecPerKm! }).baselineFinishSeconds);
    const bad = toLabHistoricalRun(runningRowFeature(row(2, steady(100))));
    expect(selectLabHistoricalRuns([bad], "easy", "10K").baselinePaceSecPerKm).toBe(360);
    const incompatible = selectLabHistoricalRuns([qualified], "100m", "10K");
    expect(incompatible.baselinePaceSecPerKm).toBe(360);
    expect(incompatible.fitRunCount).toBe(0);
  });

  it("includes old and all per-run features beyond 30/50, distinguishes HK focus, and discloses any prompt packing", () => {
    const history = historyOf(70);
    const context = buildRunningHistoryContext(history, { startHK: "2026-09-01", endHK: "2026-11-03" });
    expect(context).toContain('"processedRuns":70');
    expect(context).toContain('"perRunIncluded":70');
    expect(context).toContain('"id":1,');
    expect(context).toContain('"id":70,');
    expect(context).toContain("2020-01-01");
    expect(context).toContain("2026-09-01 至 2026-11-03");
    const packed = buildRunningHistoryContext(history, { startHK: "2026-09-01", endHK: "2026-11-03" }, 1000);
    expect(packed).toContain("不可聲稱逐次已全讀");
    expect(packed).not.toContain('"perRunOmittedForPromptBudget":0');
    expect(packed).toContain('"processedRuns":70');
    expect(packed).toContain('"HKMonth":"2020-01"');
  });

  it("prioritizes every continuous source at 36k before uniformly packing summary-only history, with honest counts", () => {
    const history = historyOf(421);
    const fit = runningRowFeature(row());
    const continuousIndexes = [1, 2, 17, 61, 109, 175, 213, 289, 333, 419];
    history.runs = history.runs.map((run, i) => ({ ...run, date: new Date(Date.UTC(2020, 0, 1 + i * 6)).toISOString().slice(0, 10), ...(continuousIndexes.includes(i) ? { continuous: { ...fit.continuous, sourceFormat: i === 17 ? "TCX" : "FIT" } } : {}) })).reverse();
    history.coverage = { ...history.coverage, continuousRuns: 10, fitRuns: 9, qualifiedRuns: 10, latestHK: "2026-11-25" };
    const context = buildRunningHistoryContext(history, { startHK: "2026-09-01", endHK: "2026-11-03" }, 36000);
    const { header, months, runs, perRunChars } = packedContext(context);
    const continuous = runs.filter(run => run.continuous !== null);
    const summaries = runs.filter(run => run.continuous === null);
    expect(continuous.map(run => run.id)).toEqual(continuousIndexes.map(i => i + 1));
    expect(continuous.find(run => run.id === 18)?.continuous.format).toBe("TCX");
    expect(header.continuousPerRunIncluded).toBe(10);
    expect(header.continuousPerRunOmittedForPromptBudget).toBe(0);
    expect(header.summaryOnlyPerRunIncluded).toBe(summaries.length);
    expect(header.summaryOnlyPerRunOmittedForPromptBudget).toBe(411 - summaries.length);
    expect(header.perRunIncluded).toBe(runs.length);
    expect(header.perRunOmittedForPromptBudget).toBe(421 - runs.length);
    expect(header.perRunOmittedForPromptBudget).toBeGreaterThan(0);
    expect(header.perRunChars).toBe(perRunChars);
    expect(perRunChars).toBeLessThanOrEqual(36000);
    expect(summaries[0].id).toBe(1);
    expect(summaries.at(-1).id).toBe(421);
    expect(runs.map(run => run.HK)).toEqual(runs.map(run => run.HK).sort());
    const summaryPositions = summaries.map(run => run.id - 1);
    const gaps = summaryPositions.slice(1).map((position, i) => position - summaryPositions[i]);
    expect(Math.max(...gaps)).toBeLessThan(2 * 421 / summaries.length);
    expect(header.allHistory.runs).toBe(421);
    expect(header.allHistory.distanceKm).toBe(4210);
    expect(months.reduce((sum, month) => sum + month.runs, 0)).toBe(421);
    expect(months.reduce((sum, month) => sum + (month.distanceKm ?? 0), 0)).toBe(4210);
    expect(months.reduce((sum, month) => sum + (month.continuousRuns ?? 0), 0)).toBe(10);
    const noContinuousMonth = months.find(month => month.continuousRuns === undefined);
    expect(noContinuousMonth).toBeDefined();
    expect(noContinuousMonth).not.toHaveProperty("meanComparableHRDriftPct");
    expect(noContinuousMonth).not.toHaveProperty("sustainedEffortRunCounts");
    expect(months.find(month => month.continuousRuns > 0)?.meanComparableHRDriftPct).toBe(0);
    expect(context).toContain("省略量測值=null=未量測／不足");
    expect(context).toContain("香港日期升序");
  });

  it("discloses continuous evidence omissions when that group alone exceeds the budget, including zero budget", () => {
    const history = historyOf(20);
    const evidence = runningRowFeature(row()).continuous;
    history.runs = history.runs.map(run => ({ ...run, continuous: evidence }));
    history.coverage = { ...history.coverage, continuousRuns: 20, fitRuns: 20, qualifiedRuns: 20 };
    const { header, runs, perRunChars } = packedContext(buildRunningHistoryContext(history, { startHK: "2026-09-01", endHK: "2026-11-03" }, 4000));
    expect(runs.length).toBeGreaterThan(1);
    expect(runs.length).toBeLessThan(20);
    expect(runs[0].id).toBe(1);
    expect(runs.at(-1).id).toBe(20);
    expect(header.continuousPerRunIncluded).toBe(runs.length);
    expect(header.continuousPerRunOmittedForPromptBudget).toBe(20 - runs.length);
    expect(header.summaryOnlyPerRunIncluded).toBe(0);
    expect(header.summaryOnlyPerRunOmittedForPromptBudget).toBe(0);
    expect(perRunChars).toBeLessThanOrEqual(4000);
    expect(header.allHistory.continuousRuns).toBe(20);
    const zero = packedContext(buildRunningHistoryContext(history, { startHK: "2026-09-01", endHK: "2026-11-03" }, 0));
    expect(zero.runs).toEqual([]);
    expect(zero.header.continuousPerRunOmittedForPromptBudget).toBe(20);
    expect(zero.header.perRunChars).toBe(0);
    expect(zero.months.reduce((sum, month) => sum + month.runs, 0)).toBe(20);
  });

  it("retains all 65 full-feature rows with the default budget and never packs raw samples or private metadata", () => {
    const history = historyOf(65);
    const raw = row(1, steady(1200, 1, { latitude: 22.1234567, longitude: 114.7654321, rawPrivateMarker: "RAW_JSON_MUST_NOT_LEAK" }));
    const feature = runningRowFeature({ ...raw, route_type: "Road https://private.example/file?token=secret", garmin_details: { hash: "HASH_MUST_NOT_LEAK", originalUrl: "https://private.example/original" } });
    history.runs = history.runs.map(run => ({ ...run, continuous: feature.continuous, route: feature.route }));
    history.coverage = { ...history.coverage, continuousRuns: 65, fitRuns: 65, qualifiedRuns: 65 };
    const context = buildRunningHistoryContext(history, { startHK: "2026-09-01", endHK: "2026-11-03" });
    const { header, runs } = packedContext(context);
    expect(header.perRunIncluded).toBe(65);
    expect(header.perRunOmittedForPromptBudget).toBe(0);
    expect(header.perRunBudgetChars).toBe(180000);
    expect(runs).toHaveLength(65);
    expect(runs.every(run => run.continuous.halves.length === 2 && run.continuous.bestObservedPace.seconds1200 === 300)).toBe(true);
    for (const sensitive of ["RAW_JSON_MUST_NOT_LEAK", "HASH_MUST_NOT_LEAK", "https://", "private.example", "latitude", "longitude", "22.1234567", "114.7654321", "time_series", "garmin_details"]) expect(context).not.toContain(sensitive);
  });
});
