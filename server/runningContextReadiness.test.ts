import { describe, expect, it } from "vitest";
import { deriveRunningContinuousEvidence } from "../shared/runningContinuousAnalysis";
import { crossValidateRunningContext, predictRunningContext, RUNNING_CROSS_VALIDATION_POLICY, type RunningContextHistory } from "../shared/runningCrossValidation";
import { matchRunningPreRunContext } from "../shared/runningPreRunContext";
import type { RunningHistoryFeature } from "./runningContinuousAnalysis";
import type { RunningRecoveryDataset } from "./runningRecoveryDataset";
import { buildRunningContextReadiness, buildRunningContextReport, prepareRunningContextHistory } from "./runningContextReport";

// Engineered, in-memory regression fixtures only. No DB, network or physiology claim.
const date = (i: number) => new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10);
const start = (i: number) => `${date(i)}T08:00:00+08:00`;
const key = "easy|road|flat|moving_pace_seconds_per_km";
const policy = RUNNING_CROSS_VALIDATION_POLICY;
type Convention = "unknown" | "wake-date";

function runAt(i: number): RunningHistoryFeature {
  const temperatureC = [16, 20, 24, 28, 32][i % 5];
  const pace = 330 + 4 * (temperatureC - 24);
  return { id: i + 1, date: date(i), type: "easy", route: "road", shoes: null,
    distanceKm: 10, durationSeconds: pace * 10, summaryPaceSecPerKm: pace,
    summaryHeartRate: 150, maximumHeartRate: 190,
    summaryDynamics: { cadence: null, strideM: null, verticalRatio: null, verticalOscillationCm: null, groundContactMs: null },
    weather: { temperatureC, humidityPct: null, windKph: 0 }, startTimestamp: start(i),
    weatherProvenance: { source: "engineered-test-only", location: null, observedAt: start(i) },
    continuous: { ...deriveRunningContinuousEvidence([], {}), observedSeconds: pace * 10, movingSeconds: pace * 10,
      longestContinuousSeconds: pace * 10, meanMovingPaceSecPerKm: pace, meanAbsoluteGradePct: 0, baselineQualified: true } };
}
function rejoin(d: RunningRecoveryDataset, convention: Convention = "wake-date"): RunningRecoveryDataset {
  return { ...d, joined: d.history.runs.map(run => ({ run, preRun: matchRunningPreRunContext(
    { id: run.id, HKdate: run.date, startTimestamp: run.startTimestamp }, d.sleepRows, d.heartRows,
    { dateConvention: convention, sleepDurationUnit: "hours", baselineWindowDays: 28 }) })) };
}
function fixture(count = 60, convention: Convention = "wake-date"): RunningRecoveryDataset {
  const runs = Array.from({ length: count }, (_, i) => runAt(i));
  const sleepRows: RunningRecoveryDataset["sleepRows"] = Array.from({ length: count + 38 }, (_, i) => ({ id: i + 1,
    date: date(i - 35), sleepDuration: 6 + i % 4 / 2, bedtime: "23:00:00", waketime: "07:00:00", sleepScore: 80,
    restingHr: null, hrv: null, source: "manual", durationNormalization: "hours" }));
  return rejoin({ history: { runs, coverage: { totalRuns: count, processedRuns: count, complete: true,
    snapshotMaxId: count, continuousRuns: count, fitRuns: 0, qualifiedRuns: count,
    earliestHK: count ? date(0) : null, latestHK: count ? date(count - 1) : null } }, sleepRows,
    heartRows: sleepRows.map((r, i) => ({ id: r.id, date: r.date, restingHr: 58 + i % 5, source: "manual", hrv: null })),
    joined: [], complete: true, durationNormalization: { legacyMinutesConverted: 0, rejected: 0 } }, convention);
}
function report(d: RunningRecoveryDataset, cutoff = 60, convention: Convention = "wake-date", groupKey = key) {
  return buildRunningContextReport(d, { targetDistanceKm: 10, groupKey, temperatureC: 24, sleepDateConvention: convention }, date(cutoff), start(cutoff));
}
function engines(d: RunningRecoveryDataset, cutoff = 60) {
  const prepared = prepareRunningContextHistory(d);
  const stratum = prepared.byGroup.get(key)![0].stratum;
  const history: RunningContextHistory = { runs: prepared.entries.map(e => e.input), fullHistoryComplete: d.complete };
  const cohort = { stratum, referenceDistanceKm: 10, beforeHkDate: date(cutoff) };
  const full = crossValidateRunningContext(history, cohort);
  const weather = crossValidateRunningContext({ ...history, runs: history.runs.map(r => ({ ...r,
    context: { temperatureC: r.context.temperatureC, relativeHumidityPct: r.context.relativeHumidityPct } })) }, cohort);
  const weatherIds = new Set(weather.heldOutPredictions.map(r => r.runId));
  const common = full.heldOutPredictions.filter(r => weatherIds.has(r.runId));
  return { full, common, history, stratum };
}
function expectCoverage(d: RunningRecoveryDataset, cutoff = 60) {
  const result = report(d, cutoff).readiness!;
  const { full, common } = engines(d, cutoff);
  expect(result.eligibleRows).toBe(full.eligibleRows);
  expect(result.eligibleDays).toBe(full.eligibleDays);
  for (const factor of [result.factors.sleep, result.factors.restingHR]) {
    const coverage = full.featureCoverage.find(c => c.feature === factor.feature)!;
    expect(factor.observedRows).toBe(coverage.observedTrainingRows);
    expect(factor.observedDays).toBe(coverage.observedTrainingDays);
    expect(factor.missingRows).toBe(coverage.missingTrainingRows);
    expect(factor.missingDays).toBe(full.eligibleDays - coverage.observedTrainingDays);
    expect(factor.includedInLatestModel).toBe(coverage.enabledInLatestModel);
    expect(factor.sampleDeficit).toBe(Math.max(0, policy.minimumFeatureObservations - coverage.observedTrainingRows));
    expect(factor.observedDayDeficit).toBe(Math.max(0, policy.minimumFeatureObservedDays - coverage.observedTrainingDays));
  }
  const observed = common.filter(r => r.observedFeatureNames.includes("preRunSleepHours") && r.observedFeatureNames.includes("restingHrDeltaBpm"));
  expect(result.commonHeldOut).toMatchObject({ rows: common.length, days: new Set(common.map(r => r.hkDate)).size });
  expect(result.commonObservedHeldOut).toMatchObject({ rows: observed.length, days: new Set(observed.map(r => r.hkDate)).size });
  expect(result.deploymentEvidence).toMatchObject({ rows: full.deploymentEvidence?.matchedRows ?? 0,
    days: full.deploymentEvidence?.matchedDays ?? 0, sufficient: full.deploymentEvidenceSufficient, latestFeatureNames: full.latestFeatureNames });
  return result;
}

describe("running context readiness — full qualifying cohort, not global record totals", () => {
  it("distinguishes ten factor rows AND ten distinct HK dates; same-date duplicates never fill day gaps", () => {
    let d = fixture(9);
    const runs = d.history.runs.flatMap(r => [r, { ...r, id: r.id + 1000 }]);
    d = rejoin({ ...d, history: { ...d.history, runs } });
    const a = expectCoverage(d, 9);
    expect(a.eligibleRows).toBe(18);
    expect(a.eligibleDays).toBe(9);
    expect(a.factors.sleep).toMatchObject({ observedRows: 18, observedDays: 9, sampleDeficit: 0, observedDayDeficit: 1,
      minimumAdditionalMatchedDays: 1, varianceKnown: false, varianceSufficient: null });
    expect(a.training).toMatchObject({ days: 9, missingDays: 11, latestModelDays: 0 });
    expect(a.minimumAdditionalMatchedDays).toBe(21);
    const duplicateHealth = rejoin({ ...d,
      sleepRows: [...d.sleepRows, ...d.sleepRows.map(r => ({ ...r, id: Number(r.id) + 1000 }))],
      heartRows: [...d.heartRows, ...d.heartRows.map(r => ({ ...r, id: Number(r.id) + 1000 }))] });
    expect(report(duplicateHealth, 9).readiness).toEqual(report(d, 9).readiness);
    const duplicateIds = rejoin({ ...d, history: { ...d.history, runs: [...runs, ...runs] } });
    const b = expectCoverage(duplicateIds, 9);
    expect(b.eligibleRows).toBe(0);
    expect(b.eligibleDays).toBe(0);
    expect(b.advancedReady).toBe(false);
  });

  it("blocks unknown sleep convention, offers existing-record review, and never uses large global totals for deficits", () => {
    const d = fixture(30, "unknown");
    const a = report(d, 30, "unknown").readiness!;
    expect(d.sleepRows.length).toBeGreaterThan(30);
    expect(a.factors.sleep).toMatchObject({ observedRows: 0, observedDays: 0, missingRows: 30, missingDays: 30,
      sampleDeficit: 10, observedDayDeficit: 10, includedInLatestModel: false });
    expect(a.sleepDateConvention).toBe("unknown");
    expect(a.advancedReady).toBe(false);
    expect(a.factors.sleep.blockers.join(" ")).toMatch(/日期語意未確認.*覆核現有紀錄/);
    expect(a.notes.join(" ")).toMatch(/並非.*新增.*一定啟用/);
    const reviewed = report(rejoin(d), 30).readiness!;
    expect(reviewed.factors.sleep.observedDays).toBe(30);
    expect(reviewed.factors.sleep.observedDayDeficit).toBe(0);
  });

  it("reports two qualified HR-deviation days as an eight-day gap, not hundreds of unrelated raw readings", () => {
    const base = fixture(30, "unknown");
    const hearts = base.heartRows.filter(r => r.date >= date(22) && r.date <= date(28));
    const unrelated = Array.from({ length: 400 }, (_, i) => ({ id: 1000 + i, date: date(-100 - i),
      restingHr: 61, hrv: null, source: "garmin" }));
    const d = rejoin({ ...base, heartRows: [...hearts, ...unrelated] }, "unknown");
    const a = report(d, 30, "unknown").readiness!;
    expect(d.heartRows.length).toBeGreaterThan(400);
    expect(a.factors.sleep.observedDays).toBe(0);
    expect(a.factors.restingHR).toMatchObject({ observedRows: 2, observedDays: 2,
      sampleDeficit: 8, observedDayDeficit: 8, missingRows: 28, missingDays: 28 });
    expect(a.currentBaseline.observedEarlierDays).toBeNull();
    expect(a.advancedReady).toBe(false);
  });

  it("does not promote absent or constant factors; variance is known failed only after actual training gates", () => {
    const base = fixture();
    const constant = rejoin({ ...base, sleepRows: base.sleepRows.map(r => ({ ...r, sleepDuration: 7 })),
      heartRows: base.heartRows.map(r => ({ ...r, restingHr: 60 })) });
    const a = expectCoverage(constant);
    for (const f of [a.factors.sleep, a.factors.restingHR]) {
      expect(f).toMatchObject({ observedRows: 60, observedDays: 60, sampleDeficit: 0, observedDayDeficit: 0,
        includedInLatestModel: false, varianceKnown: true, varianceSufficient: false, trainingStandardDeviation: null });
    }
    expect(a.commonHeldOut.days).toBeGreaterThanOrEqual(10);
    expect(a.commonObservedHeldOut.days).toBe(0);
    expect(a.deploymentEvidence.days).toBeGreaterThanOrEqual(10); // weather-only schema, NOT advanced evidence
    expect(a.dataQualified).toBe(false);
    expect(a.advancedReady).toBe(false);
    const missing = expectCoverage(rejoin({ ...base, sleepRows: [], heartRows: [] }));
    expect(missing.factors.restingHR).toMatchObject({ observedRows: 0, observedDays: 0, missingRows: 60, missingDays: 60,
      sampleDeficit: 10, observedDayDeficit: 10, varianceKnown: false, varianceSufficient: null });
    expect(missing.currentBaseline.observedEarlierDays).toBeNull();
  });

  it("reads actual current same-kind baseline counts, excludes same/future days, duplicates, and unlike sources", () => {
    const base = fixture();
    const d = rejoin({ ...base, heartRows: [-5, -4, -3, -2, -1, 0, 1].map((i, n) => ({ id: n + 1,
      date: date(60 + i), restingHr: 60 + n, source: "manual" })) });
    const a = report(d).readiness!;
    expect(a.currentBaseline).toMatchObject({ measurementDateHK: date(59), windowEndExclusiveHK: date(59),
      lookbackDays: policy.restingHrLookbackDays, requiredEarlierDays: policy.minimumEarlierRestingHrDays,
      observedEarlierDays: 4, missingEarlierDays: 1, sufficient: false });
    expect(a.factors.restingHR.observedRows).toBe(0);
    const duplicates = rejoin({ ...d, heartRows: [...d.heartRows, ...d.heartRows.map(r => ({ ...r, id: Number(r.id) + 100 }))] });
    expect(report(duplicates).readiness!.currentBaseline).toEqual(a.currentBaseline);
    const mixed = rejoin({ ...d, heartRows: [...d.heartRows, { id: 300, date: date(54), restingHr: 61, source: "garmin" },
      { id: 301, date: date(30), restingHr: 61, source: "manual" }] });
    expect(report(mixed).readiness!.currentBaseline).toEqual(a.currentBaseline);
    const enough = rejoin({ ...d, heartRows: [...d.heartRows, { id: 302, date: date(54), restingHr: 61, source: "manual" }] });
    expect(report(enough).readiness!.currentBaseline).toMatchObject({ observedEarlierDays: 5, missingEarlierDays: 0, sufficient: true });
    const unknownSource = rejoin({ ...d, heartRows: d.heartRows.map(r => ({ ...r, source: null })) });
    expect(report(unknownSource).readiness!.currentBaseline).toMatchObject({ observedEarlierDays: null, missingEarlierDays: null, sufficient: null });
  });

  it("separates all common heldout from same-row observed factors and same-latest-schema deployment evidence", () => {
    const base = fixture(80);
    const d = rejoin({ ...base, sleepRows: base.sleepRows.filter(r => r.date < date(45) || r.date >= date(70)) });
    const a = expectCoverage(d, 80);
    expect(a.commonHeldOut.rows).toBeGreaterThan(a.commonObservedHeldOut.rows);
    expect(a.factors.sleep.includedInLatestModel).toBe(true);
    expect(a.commonObservedHeldOut.days).toBeLessThan(a.commonHeldOut.days);
    const { full, common, history, stratum } = engines(d, 80);
    const current = matchRunningPreRunContext({ id: "query", HKdate: date(80), startTimestamp: start(80) }, d.sleepRows, d.heartRows,
      { dateConvention: "wake-date", baselineWindowDays: 28 });
    const prediction = predictRunningContext(history, { hkDate: date(80), stratum, distanceKm: 10, context: {
      temperatureC: 24, preRunSleepHours: current.sleepHours, preRunRestingHrDeltaBpm: current.rhrDeltaBpm } });
    // Shrink only the supplied common comparison evidence: model deployment's
    // separate full-schema count must not masquerade as advanced common evidence.
    const limited = buildRunningContextReadiness({ full, commonHeldOut: common.slice(0, 6), current, asOfHK: date(80),
      historyComplete: true, selectedGroup: true, sleepDateConvention: "wake-date", prediction,
      correctionEnabled: prediction.autoApplyAllowed, weatherTimingVerified: true, unknownRoute: false });
    expect(limited.commonObservedHeldOut.days).toBeLessThan(10);
    expect(limited.deploymentEvidence).toEqual(a.deploymentEvidence);
    expect(limited.dataQualified).toBe(false);
    expect(limited.advancedReady).toBe(false);
  });

  it("does not enable advanced mode merely because both factors qualify when model errors worsen or query is unsupported", () => {
    const base = fixture(80);
    const runs = base.history.runs.map((r, i) => {
      const pace = i < 40 ? r.summaryPaceSecPerKm! : 660 - r.summaryPaceSecPerKm!;
      return { ...r, summaryPaceSecPerKm: pace, continuous: { ...r.continuous, meanMovingPaceSecPerKm: pace } };
    });
    const worse = rejoin({ ...base, history: { ...base.history, runs } });
    const a = expectCoverage(worse, 80);
    expect(a.factors.sleep.includedInLatestModel).toBe(true);
    expect(a.factors.restingHR.includedInLatestModel).toBe(true);
    expect(a.validationStatus).toBe("model_worse");
    expect(a.advancedReady).toBe(false);
    expect(a.blockers.join(" ")).toMatch(/誤差.*更差/);
    const unsupported = buildRunningContextReport(base, { targetDistanceKm: 10, groupKey: key,
      temperatureC: 54, sleepDateConvention: "wake-date" }, date(80), start(80)).readiness!;
    expect(unsupported.factors.sleep.includedInLatestModel).toBe(true);
    expect(unsupported.factors.restingHR.includedInLatestModel).toBe(true);
    expect(unsupported.predictionBlocker).toBe("context_outside_training_support");
    expect(unsupported.advancedReady).toBe(false);
    expect(unsupported.blockers.join(" ")).toMatch(/超出歷史支援/);
  });

  it("keeps empty/unread/missing groups zero or unknown rather than borrowing global counts", () => {
    for (const d of [fixture(0), { ...fixture(), complete: false, joined: [] }]) {
      const a = report(d).readiness!;
      expect(a.eligibleRows).toBe(0);
      expect(a.eligibleDays).toBe(0);
      expect(a.factors.sleep.observedRows).toBe(0);
      expect(a.factors.restingHR.observedDays).toBe(0);
      expect(a.currentBaseline.observedEarlierDays).toBeNull();
      expect(a.dataQualified).toBe(false);
      expect(a.advancedReady).toBe(false);
    }
    const missing = report(fixture(), 60, "wake-date", "does-not-exist").readiness!;
    expect(missing.evidenceState).toBe("no-selected-group");
    expect(missing.eligibleRows).toBe(0);
    expect(missing.currentBaseline.observedEarlierDays).toBeNull();
    const partial = report({ ...fixture(), complete: false }).readiness!;
    expect(partial.evidenceState).toBe("partial-history");
    expect(partial.eligibleRows).toBe(60); // only real loaded cohort, no inferred unseen totals
    expect(partial.advancedReady).toBe(false);
    expect(partial.blockers.join(" ")).toMatch(/只限已載入/);
  });

  it("uses all >200 eligible rows and HK before-as-of counts, not the capped table or later history", () => {
    const d = fixture(225);
    const result = report(d, 225);
    expect(result.rows).toHaveLength(200);
    expect(result.readiness!.eligibleRows).toBe(225);
    expect(result.readiness!.eligibleDays).toBe(225);
    expect(result.readiness!.factors.sleep.observedDays).toBe(225);
    expect(result.readiness!.factors.restingHR.observedRows).toBe(225);
    expect(result.readiness!.commonHeldOut.rows).toBe(result.metrics.fullContext!.count);
    expect(result.readiness!.commonHeldOut.days).toBe(result.metrics.fullContext!.days);
    expectCoverage(d, 225);
    const earlier = rejoin({ ...d, history: { ...d.history, runs: d.history.runs.filter(r => r.date < date(45)) } });
    expect(report(d, 45).readiness).toEqual(report(earlier, 45).readiness);
    expect(report(d, 45).readiness!.eligibleDays).toBe(45);
    expect(result.source).toBe("Life-OS Supabase");
  });

  it("leaves every existing report/prediction/evidence and source input untouched apart from the optional projection", () => {
    const d = fixture();
    const before = JSON.stringify(d);
    const result = report(d);
    const { full } = engines(d);
    expect(result.featuresUsed).toHaveLength(full.latestFeatureNames.length);
    expect(result.readiness!.thresholds.minimumTrainingDays).toBe(policy.minimumTrainingDays);
    expect(result.readiness!.thresholds.minimumFeatureObservations).toBe(policy.minimumFeatureObservations);
    expect(result.readiness!.thresholds.minimumFeatureObservedDays).toBe(policy.minimumFeatureObservedDays);
    expect(JSON.stringify(d)).toBe(before);
  });
});
