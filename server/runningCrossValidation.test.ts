import { describe, expect, it } from "vitest";
import {
  crossValidateRunningContext,
  predictRunningContext,
  RUNNING_CROSS_VALIDATION_POLICY,
  type PreRunContext,
  type RunningContextHistory,
  type RunningContextQuery,
  type RunningContextRun,
  type RunningStratum,
} from "../shared/runningCrossValidation";

// ENGINEERED UNIT-TEST FIXTURES ONLY. Not user history, empirical research or
// evidence that weather/sleep/HR explain real performance. No network, DB or LLM.
const stratum: RunningStratum = {
  runType: "easy", surface: "road", terrain: "flat",
  targetDefinition: "moving_pace_seconds_per_km",
};
const date = (offset: number): string => new Date(Date.UTC(2025, 0, 1 + offset)).toISOString().slice(0, 10);
function fixture(count = 80): RunningContextHistory {
  return { fullHistoryComplete: true, runs: Array.from({ length: count }, (_, i) => {
    const temperatureC = [16, 20, 24, 28, 32][i % 5];
    return { id: `synthetic-${i}`, hkDate: date(i), stratum: { ...stratum }, distanceKm: 10,
      measuredPaceSecondsPerKm: 330 + 4 * (temperatureC - 24),
      hasMaterialPauses: false, context: { temperatureC } };
  }) };
}
const cohort = { stratum, referenceDistanceKm: 10 };
function query(overrides: Partial<RunningContextQuery> = {}): RunningContextQuery {
  return { hkDate: date(100), stratum: { ...stratum }, distanceKm: 10,
    context: { temperatureC: 28 }, ...overrides };
}
function allNumbersFinite(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(allNumbersFinite);
  if (value && typeof value === "object") return Object.values(value).every(allNumbersFinite);
  return true;
}
function mapped(history: RunningContextHistory, fn: (run: RunningContextRun, index: number) => RunningContextRun): RunningContextHistory {
  return { ...history, runs: history.runs.map(fn) };
}

describe("running cross-validation: engineered synthetic fixtures only", () => {
  it("compares the same observed rows and validates the actual bounded estimator", () => {
    const report = crossValidateRunningContext(fixture(), cohort);
    expect(report.status).toBe("supported");
    expect(report.metrics?.matchedRows).toBe(report.heldOutPredictions.length);
    expect(report.metrics?.matchedDays).toBeGreaterThanOrEqual(10);
    expect(report.metrics!.contextMaeSecondsPerKm).toBeLessThan(report.metrics!.baselineMaeSecondsPerKm);
    const rows = report.heldOutPredictions;
    const baselineMae = rows.reduce((sum, row) => sum + Math.abs(row.measuredPaceSecondsPerKm - row.baselinePaceSecondsPerKm), 0) / rows.length;
    const contextMae = rows.reduce((sum, row) => sum + Math.abs(row.measuredPaceSecondsPerKm - row.contextPaceSecondsPerKm), 0) / rows.length;
    expect(report.metrics!.baselineMaeSecondsPerKm).toBeCloseTo(baselineMae, 12);
    expect(report.metrics!.contextMaeSecondsPerKm).toBeCloseTo(contextMae, 12);
    expect(report.contextEstimatePolicy).toBe("ridge_with_bounded_additive_correction");
    rows.forEach(row => {
      expect(Math.abs(row.contextPaceSecondsPerKm - row.baselinePaceSecondsPerKm)).toBeLessThanOrEqual(15 + 1e-9);
      expect(Math.abs(row.contextPaceSecondsPerKm - row.baselinePaceSecondsPerKm)).toBeLessThanOrEqual(0.03 * row.baselinePaceSecondsPerKm + 1e-9);
    });
  });

  it("holds every HK-calendar-day row out together; new same-day targets cannot affect predictions", () => {
    const base = fixture(45);
    const twins = base.runs.map(run => ({ ...run, id: `${run.id}-second` }));
    const history = { ...base, runs: [...base.runs, ...twins] };
    const report = crossValidateRunningContext(history, cohort);
    const targetDate = date(30);
    const onDay = report.heldOutPredictions.filter(row => row.hkDate === targetDate);
    expect(onDay).toHaveLength(2);
    expect(onDay[0].trainingDayCount).toBe(30);
    expect(onDay[0].trainingLatestHkDate).toBe(date(29));
    expect(onDay[0].contextPaceSecondsPerKm).toBe(onDay[1].contextPaceSecondsPerKm);
    const changed = mapped(history, run => run.hkDate === targetDate
      ? { ...run, measuredPaceSecondsPerKm: 1200 } : run);
    const after = crossValidateRunningContext(changed, cohort).heldOutPredictions.filter(row => row.hkDate === targetDate);
    expect(after.map(row => row.contextPaceSecondsPerKm)).toEqual(onDay.map(row => row.contextPaceSecondsPerKm));
    report.heldOutPredictions.forEach(row => expect(row.trainingLatestHkDate < row.hkDate).toBe(true));
  });

  it("future target/features do not change earlier held-out predictions or fold transforms", () => {
    const original = fixture(70);
    const modified = mapped(original, (run, i) => i >= 45 ? { ...run,
      measuredPaceSecondsPerKm: 1500, context: { temperatureC: 54, preRunSleepHours: 1 } } : run);
    const before = crossValidateRunningContext(original, cohort).heldOutPredictions.filter(row => row.hkDate < date(45));
    const after = crossValidateRunningContext(modified, cohort).heldOutPredictions.filter(row => row.hkDate < date(45));
    expect(after).toEqual(before);
    const reversed = { ...original, runs: [...original.runs].reverse() };
    expect(crossValidateRunningContext(reversed, cohort)).toEqual(crossValidateRunningContext(original, cohort));
  });

  it("as-of query excludes both current-day and future rows from model AND evidence", () => {
    const history = fixture(80);
    const cutoff = date(55);
    const earlier = { ...history, runs: history.runs.filter(run => run.hkDate < cutoff) };
    const a = predictRunningContext(history, query({ hkDate: cutoff }));
    const b = predictRunningContext(earlier, query({ hkDate: cutoff }));
    expect(a.validation.heldOutPredictions).toEqual(b.validation.heldOutPredictions);
    expect(a.correctedPaceSecondsPerKm).toBe(b.correctedPaceSecondsPerKm);
    expect(a.validation.latestTrainingDays).toBe(55);
  });

  it("learns imputation from earlier data, reports missing coverage, and will not deploy with a missing active input", () => {
    const history = mapped(fixture(), (run, i) => ({ ...run, context: i % 7 === 0 ? {} : run.context }));
    const report = crossValidateRunningContext(history, cohort);
    const temperature = report.featureCoverage.find(item => item.feature === "temperatureC")!;
    expect(temperature.observedTrainingRows).toBeGreaterThanOrEqual(10);
    expect(temperature.missingTrainingRows).toBeGreaterThan(0);
    expect(temperature.imputationValue).toBeGreaterThan(0);
    expect(temperature.observedHeldOutRows).toBeLessThan(report.metrics!.matchedRows);
    const missing = predictRunningContext(history, query({ context: {} }));
    expect(missing.reason).toBe("missing_or_invalid_context");
    expect(missing.autoApplyAllowed).toBe(false);
    expect(missing.correctionSecondsPerKm).toBeUndefined();
  });

  it("never substitutes missing sleep/HR/humidity with zero observations", () => {
    const report = crossValidateRunningContext(fixture(), cohort);
    for (const name of ["preRunSleepHours", "restingHrDeltaBpm", "temperatureHumidityInteraction"]) {
      const coverage = report.featureCoverage.find(item => item.feature === name)!;
      expect(coverage.observedTrainingRows).toBe(0);
      expect(coverage.enabledInLatestModel).toBe(false);
      expect(coverage.imputationValue).toBeNull();
    }
    expect(report.latestFeatureNames).toEqual(["temperatureC"]);
  });

  it("requires 10 observed days as well as samples and disables constant features", () => {
    const history = mapped(fixture(), (run, i) => ({ ...run,
      context: { ...run.context, preRunSleepHours: i < 9 ? 5 + i / 10 : undefined,
        preRunRestingHrBpm: 60, relativeHumidityPct: undefined } }));
    const report = crossValidateRunningContext(history, cohort);
    expect(report.featureCoverage.find(item => item.feature === "preRunSleepHours")?.enabledInLatestModel).toBe(false);
    const constants = mapped(fixture(), run => ({ ...run, context: { temperatureC: 24, preRunSleepHours: 7 } }));
    const constantReport = crossValidateRunningContext(constants, cohort);
    expect(constantReport.status).toBe("no_evidence");
    expect(constantReport.metrics).toBeNull();
    expect(constantReport.latestFeatureNames).toEqual([]);
    expect(predictRunningContext(constants, query()).autoApplyAllowed).toBe(false);
  });

  it("returns insufficient/limited states, not zero-error evidence, for too few days", () => {
    const short = crossValidateRunningContext(fixture(19), cohort);
    expect(short.status).toBe("insufficient_data");
    expect(short.metrics).toBeNull();
    expect(short.residual80PercentInterval).toBeNull();
    const manySameDay = mapped(fixture(80), (run, i) => ({ ...run, hkDate: date(i % 5) }));
    expect(crossValidateRunningContext(manySameDay, cohort).status).toBe("insufficient_data");
    const limited = crossValidateRunningContext(fixture(29), cohort);
    expect(limited.status).toBe("limited");
    expect(limited.metrics!.matchedDays).toBeLessThan(10);
    expect(limited.deploymentEligible).toBe(false);
  });

  it("does not enable a model that becomes worse out of time", () => {
    const reversedRegime = mapped(fixture(60), (run, i) => ({ ...run,
      measuredPaceSecondsPerKm: i < 20 ? run.measuredPaceSecondsPerKm
        : 330 - 4 * (run.context.temperatureC! - 24) }));
    const report = crossValidateRunningContext(reversedRegime, cohort);
    expect(report.status).toBe("model_worse");
    expect(report.metrics!.contextMaeSecondsPerKm).toBeGreaterThan(report.metrics!.baselineMaeSecondsPerKm);
    expect(report.deploymentEligible).toBe(false);
    expect(predictRunningContext(reversedRegime, query()).autoApplyAllowed).toBe(false);
  });

  it("constant observed pace gives no meaningful evidence and avoids baseline-error division", () => {
    const history = mapped(fixture(), run => ({ ...run, measuredPaceSecondsPerKm: 330 }));
    const report = crossValidateRunningContext(history, cohort);
    expect(report.metrics?.baselineMaeSecondsPerKm).toBe(0);
    expect(report.metrics?.relativeMaeImprovement).toBeNull();
    expect(report.status).toBe("no_evidence");
    expect(report.deploymentEligible).toBe(false);
    expect(allNumbersFinite(report)).toBe(true);
  });

  it("requires exact surface, type, terrain AND measured target definition", () => {
    const base = fixture(50);
    const variants: Partial<RunningStratum>[] = [
      { surface: "track" }, { runType: "tempo" }, { terrain: "hilly" },
      { targetDefinition: "summary_pace_seconds_per_km" },
    ];
    const extras = variants.flatMap((variant, j) => base.runs.map(run => ({ ...run,
      id: `${run.id}-variant-${j}`, stratum: { ...run.stratum, ...variant }, measuredPaceSecondsPerKm: 900 })));
    const report = crossValidateRunningContext({ ...base, runs: [...base.runs, ...extras] }, cohort);
    expect(report.eligibleRows).toBe(base.runs.length);
    expect(report.heldOutPredictions).toEqual(crossValidateRunningContext(base, cohort).heldOutPredictions);
    expect(predictRunningContext(base, query({ stratum: { ...stratum, surface: "track" } })).reason).toBe("insufficient_training");
    const summary = mapped(base, run => ({ ...run, stratum: { ...run.stratum, targetDefinition: "summary_pace_seconds_per_km" } }));
    expect(crossValidateRunningContext(summary, { ...cohort, stratum: summary.runs[0].stratum }).targetDefinition).toBe("summary_pace_seconds_per_km");
  });

  it("does not promote trail, sprint, interval, test, races, pauses or unknown terrain into comparables", () => {
    for (const change of [{ runType: "interval" }, { runType: "sprint" }, { runType: "test" },
      { runType: "race" }, { surface: "trail" }, { surface: "mixed" }, { surface: "unknown" },
      { terrain: "unknown" }] as Partial<RunningStratum>[]) {
      const blocked = predictRunningContext(fixture(), query({ stratum: { ...stratum, ...change } }));
      expect(blocked.reason).toBe("unsupported_stratum");
      expect(blocked.autoApplyAllowed).toBe(false);
    }
    const paused = mapped(fixture(), run => ({ ...run, hasMaterialPauses: true }));
    expect(crossValidateRunningContext(paused, cohort).eligibleRows).toBe(0);
    expect(crossValidateRunningContext(fixture(), cohort).interpretation).toBe("measured_pace_in_exact_stratum_not_maximum_race_ability");
  });

  it("conservatively restricts distance ratios AND rejects even nearby query extrapolation", () => {
    const base = fixture(50);
    const distant = base.runs.map(run => ({ ...run, id: `${run.id}-far`, distanceKm: 11.6 }));
    const report = crossValidateRunningContext({ ...base, runs: [...base.runs, ...distant] }, cohort);
    expect(report.eligibleRows).toBe(base.runs.length);
    expect(predictRunningContext(base, query({ distanceKm: 10.1 })).reason).toBe("distance_outside_training_support");
    expect(predictRunningContext(base, query({ distanceKm: 11.6 })).reason).toBe("insufficient_training");
    expect(predictRunningContext(base, query({ distanceKm: 0 })).reason).toBe("invalid_query");
    expect(predictRunningContext(base, query({ distanceKm: Infinity })).reason).toBe("invalid_query");
  });

  it("rejects unsupported context rather than clamping a new heat/sleep/HR input", () => {
    const history = fixture();
    const above = predictRunningContext(history, query({ context: { temperatureC: 33 } }));
    expect(above.reason).toBe("context_outside_training_support");
    expect(above.correctionSecondsPerKm).toBeUndefined();
    const below = predictRunningContext(history, query({ context: { temperatureC: 15 } }));
    expect(below.reason).toBe("context_outside_training_support");
  });

  it("requires complete history; evidence status is distinct from query apply status", () => {
    const history = { ...fixture(), fullHistoryComplete: false };
    const report = crossValidateRunningContext(history, cohort);
    expect(report.status).toBe("limited");
    expect(report.metrics!.absoluteMaeImprovementSecondsPerKm).toBeGreaterThanOrEqual(3);
    expect(report.deploymentEligible).toBe(false);
    const prediction = predictRunningContext(history, query());
    expect(prediction.reason).toBe("incomplete_history");
    expect(prediction.correctedPaceSecondsPerKm).toBeUndefined();
    const complete = fixture();
    expect(crossValidateRunningContext(complete, cohort).deploymentEligible).toBe(true);
    expect(predictRunningContext(complete, query({ context: {} })).autoApplyAllowed).toBe(false);
  });

  it("deploys only a bounded ADDITIVE comparable-training-pace correction, never a pace ratio", () => {
    const prediction = predictRunningContext(fixture(), query({ context: { temperatureC: 32 } }));
    expect(prediction.status).toBe("enabled");
    expect(prediction.autoApplyAllowed).toBe(true);
    expect(prediction.correctionSecondsPerKm).toBeGreaterThan(0);
    expect(prediction.correctedPaceSecondsPerKm).toBeCloseTo(prediction.baselinePaceSecondsPerKm! + prediction.correctionSecondsPerKm!, 12);
    expect(Math.abs(prediction.correctionSecondsPerKm!)).toBeLessThanOrEqual(RUNNING_CROSS_VALIDATION_POLICY.maximumCorrectionSecondsPerKm);
    expect(Math.abs(prediction.correctionSecondsPerKm!)).toBeLessThanOrEqual(0.03 * prediction.baselinePaceSecondsPerKm!);
    expect(prediction.contextModelPaceSecondsPerKm!).toBeGreaterThan(prediction.correctedPaceSecondsPerKm!);
    expect(prediction.featureContributions?.map(item => item.feature)).toEqual(["temperatureC"]);
    expect(allNumbersFinite(prediction)).toBe(true);
  });

  it("labels historical residual quantiles as empirical, not confidence or accuracy guarantees", () => {
    const report = crossValidateRunningContext(fixture(), cohort);
    const interval = report.residual80PercentInterval!;
    expect(interval.label).toBe("observed_out_of_time_residual_80_percent_interval");
    expect(interval.isConfidenceInterval).toBe(false);
    expect(interval.guaranteesFutureCoverage).toBe(false);
    expect(interval.matchedDays).toBeGreaterThanOrEqual(10);
    expect(interval.lowerSecondsPerKm).toBeLessThanOrEqual(interval.upperSecondsPerKm);
    expect(report.limitations.join(" ")).toMatch(/not causal/);
    expect(report.limitations.join(" ")).toMatch(/fitness trends/);
  });

  it("uses a valid earlier-only resting HR daily baseline, never current/future HR", () => {
    const base = mapped(fixture(60), (run, i) => ({ ...run,
      context: { ...run.context, preRunRestingHrBpm: 58 + (i % 5) } }));
    const hr = Array.from({ length: 90 }, (_, i) => ({ hkDate: date(i - 10), restingHrBpm: 60 }));
    const history = { ...base, restingHrHistory: hr };
    const cutoff = date(40);
    const filtered = { ...history, restingHrHistory: hr.filter(day => day.hkDate < cutoff) };
    const a = predictRunningContext(history, query({ hkDate: cutoff, context: { temperatureC: 24, preRunRestingHrBpm: 62 } }));
    const b = predictRunningContext(filtered, query({ hkDate: cutoff, context: { temperatureC: 24, preRunRestingHrBpm: 62 } }));
    expect(a.validation).toEqual(b.validation);
    expect(a.correctedPaceSecondsPerKm).toBe(b.correctedPaceSecondsPerKm);
    expect(a.validation.featureCoverage.find(item => item.feature === "restingHrDeltaBpm")?.observedTrainingRows).toBe(40);
    const duplicateDays = { ...base, restingHrHistory: Array.from({ length: 10 }, () => ({ hkDate: date(-1), restingHrBpm: 60 })) };
    expect(crossValidateRunningContext(duplicateDays, cohort).featureCoverage.find(item => item.feature === "restingHrDeltaBpm")?.observedTrainingRows).toBe(0);
  });

  it("validates named feature units and reports invalid inputs instead of converting or penalizing them", () => {
    const invalidContexts: PreRunContext[] = [
      { temperatureC: 86 }, { temperatureC: NaN }, { temperatureC: Infinity },
      // Wrong unit inputs are not silently converted.
      { preRunSleepHours: 25200 }, { relativeHumidityPct: 101 }, { preRunRestingHrBpm: 1000 },
    ];
    const bad = mapped(fixture(60), (run, i) => ({ ...run, context: invalidContexts[i % invalidContexts.length] }));
    const report = crossValidateRunningContext(bad, cohort);
    expect(report.status).toBe("no_evidence");
    expect(report.featureCoverage.reduce((sum, item) => sum + item.invalidTrainingRows, 0)).toBeGreaterThan(0);
    expect(allNumbersFinite(report)).toBe(true);
    const proper = predictRunningContext(fixture(), query({ context: { temperatureC: 28 } }));
    const namedWrong = predictRunningContext(fixture(), query({ context: { temperatureF: 82 } as PreRunContext }));
    expect(proper.autoApplyAllowed).toBe(true);
    expect(namedWrong.reason).toBe("missing_or_invalid_context");
  });

  it("weather interaction is tempC * humidityPct / 100; sleep zero is an observation", () => {
    const history = mapped(fixture(60), (run, i) => ({ ...run,
      context: { ...run.context, relativeHumidityPct: 50, preRunSleepHours: i % 3 === 0 ? 0 : 7 } }));
    const report = crossValidateRunningContext(history, cohort);
    const temp = report.featureCoverage.find(item => item.feature === "temperatureC")!;
    const interaction = report.featureCoverage.find(item => item.feature === "temperatureHumidityInteraction")!;
    expect(interaction.imputationValue).toBe(temp.imputationValue! / 2);
    const sleep = report.featureCoverage.find(item => item.feature === "preRunSleepHours")!;
    expect(sleep.observedTrainingRows).toBe(60);
    expect(sleep.trainingSupport?.min).toBe(0);
  });

  it("bounded influence handles extreme training paces without non-finite outputs", () => {
    const history = mapped(fixture(), (run, i) => i === 30 ? { ...run, measuredPaceSecondsPerKm: 1799 } : run);
    const report = crossValidateRunningContext(history, cohort);
    expect(allNumbersFinite(report)).toBe(true);
    const before = crossValidateRunningContext(fixture(), cohort).heldOutPredictions.find(row => row.runId === "synthetic-35")!;
    const after = report.heldOutPredictions.find(row => row.runId === "synthetic-35")!;
    expect(Math.abs(after.contextPaceSecondsPerKm - before.contextPaceSecondsPerKm)).toBeLessThan(10);
  });

  it("rejects malformed dates and nonphysical measured pace without coercion", () => {
    const base = fixture(40);
    const invalid = [
      { ...base.runs[0], id: "bad-date", hkDate: "2025-02-30" },
      { ...base.runs[0], id: "utc-not-hk-day", hkDate: "2025-01-01T00:00:00Z" },
      { ...base.runs[0], id: "bad-pace", measuredPaceSecondsPerKm: 0 },
      { ...base.runs[0], id: "not-finite", measuredPaceSecondsPerKm: NaN },
    ];
    const report = crossValidateRunningContext({ ...base, runs: [...base.runs, ...invalid] }, cohort);
    expect(report.eligibleRows).toBe(40);
    expect(allNumbersFinite(report)).toBe(true);
    expect(predictRunningContext(base, query({ hkDate: "2025-02-30" })).reason).toBe("invalid_query");
  });

  it("permits exact unknown-terrain descriptive metrics but never enables correction", () => {
    const unknown = { ...stratum, terrain: "unknown" as const };
    const history = mapped(fixture(), run => ({ ...run, stratum: unknown }));
    const report = crossValidateRunningContext(history, { ...cohort, stratum: unknown });
    expect(report.eligibleRows).toBe(80);
    expect(report.metrics!.matchedDays).toBeGreaterThanOrEqual(10);
    expect(report.status).toBe("limited");
    expect(report.deploymentEligible).toBe(false);
    const prediction = predictRunningContext(history, query({ stratum: unknown }));
    expect(prediction.reason).toBe("unsupported_stratum");
    expect(prediction.autoApplyAllowed).toBe(false);
    expect(prediction.validation.metrics).not.toBeNull();
  });

  it("prefers verified adapter HR deltas, validates bpm bounds, and does not silently fall back when invalid", () => {
    const history = mapped(fixture(), (run, i) => ({ ...run,
      context: { ...run.context, preRunRestingHrDeltaBpm: (i % 5) - 2, preRunRestingHrBpm: 60 } }));
    const report = crossValidateRunningContext(history, cohort);
    const coverage = report.featureCoverage.find(item => item.feature === "restingHrDeltaBpm")!;
    expect(coverage.observedTrainingRows).toBe(80);
    expect(coverage.imputationValue).toBe(0);
    expect(coverage.enabledInLatestModel).toBe(true);
    const withFallback = { ...history, restingHrHistory: Array.from({ length: 100 }, (_, i) => ({ hkDate: date(i - 10), restingHrBpm: 40 })) };
    expect(crossValidateRunningContext(withFallback, cohort).featureCoverage.find(item => item.feature === "restingHrDeltaBpm")?.imputationValue).toBe(0);
    const invalid = mapped(withFallback, run => ({ ...run, context: { ...run.context, preRunRestingHrDeltaBpm: 41 } }));
    const badCoverage = crossValidateRunningContext(invalid, cohort).featureCoverage.find(item => item.feature === "restingHrDeltaBpm")!;
    expect(badCoverage.observedTrainingRows).toBe(0);
    expect(badCoverage.invalidTrainingRows).toBe(80);
  });

  it("future duplicate IDs cannot remove earlier rows and cause lookahead selection", () => {
    const base = fixture(50);
    const withFutureDuplicate = { ...base, runs: [...base.runs, { ...base.runs[0], hkDate: date(70) }] };
    const earlier = crossValidateRunningContext(base, cohort).heldOutPredictions;
    const after = crossValidateRunningContext(withFutureDuplicate, cohort).heldOutPredictions.filter(row => row.hkDate <= date(49));
    expect(after).toEqual(earlier);
  });
});

describe("unknown surface is descriptive only, never assumed road", () => {
  it("can compare exact unknown-surface history while blocking application", () => {
    const unknown = { ...stratum, surface: "unknown" as const };
    const history = mapped(fixture(), run => ({ ...run, stratum: unknown }));
    const report = crossValidateRunningContext(history, { ...cohort, stratum: unknown });
    expect(report.eligibleRows).toBe(80);
    expect(report.metrics?.matchedDays).toBeGreaterThanOrEqual(10);
    expect(report.deploymentEligible).toBe(false);
    const prediction = predictRunningContext(history, query({ stratum: unknown }));
    expect(prediction.reason).toBe("unsupported_stratum");
    expect(prediction.autoApplyAllowed).toBe(false);
    expect(prediction.correctedPaceSecondsPerKm).toBeUndefined();
  });
  it("does not contaminate a known-road cohort with missing-route activities", () => {
    const known = fixture(45);
    const unknown = mapped(known, run => ({ ...run, id: `${run.id}-unknown`, stratum: { ...stratum, surface: "unknown" }, measuredPaceSecondsPerKm: 1100 }));
    expect(crossValidateRunningContext({ ...known, runs: [...known.runs, ...unknown.runs] }, cohort).heldOutPredictions).toEqual(crossValidateRunningContext(known, cohort).heldOutPredictions);
  });
});

describe("adapter baseline absence is authoritative", () => {
  it("does not silently derive another baseline when adapter explicitly supplied null", () => {
    const history = mapped(fixture(), run => ({ ...run, context: { ...run.context, preRunRestingHrBpm: 60, preRunRestingHrDeltaBpm: null } }));
    history.restingHrHistory = Array.from({ length: 100 }, (_, i) => ({ hkDate: date(i - 30), restingHrBpm: 45 + i % 7 }));
    const report = crossValidateRunningContext(history, cohort);
    expect(report.featureCoverage.find(f => f.feature === "restingHrDeltaBpm")?.observedTrainingRows).toBe(0);
    expect(report.latestFeatureNames).not.toContain("restingHrDeltaBpm");
  });
});
