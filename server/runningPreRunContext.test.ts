import { describe, expect, it } from "vitest";
import {
  canonicalPreRunHKDate,
  matchRunningPreRunContext,
  parsePreRunZonedTimestamp,
  type PreRunHeart,
  type PreRunRun,
  type PreRunSleep,
} from "../shared/runningPreRunContext";

// Entirely synthetic test fixtures: these are never inserted into application data.
const run: PreRunRun = { id: "run-a", HKdate: "2026-11-15", startTimestamp: "2026-11-15T08:00:00+08:00" };
const sleep = (overrides: Partial<PreRunSleep> = {}): PreRunSleep => ({
  id: "sleep-a", date: "2026-11-15", sleepDuration: 7.5,
  bedtime: "2026-11-14T23:00:00+08:00", waketime: "2026-11-15T06:30:00+08:00",
  sleepScore: 80, restingHr: 60, hrv: 40, source: "device-a", ...overrides,
});
const heart = (overrides: Partial<PreRunHeart> = {}): PreRunHeart => ({
  id: "heart-a", date: "2026-11-14", restingHr: 60, hrv: 40, source: "device-a", ...overrides,
});
const heartHistory = (days: readonly number[], restingHr = 50, source = "device-a"): PreRunHeart[] => days.map(day => heart({ id: `history-${source}-${day}`, date: `2026-11-${String(day).padStart(2, "0")}`, restingHr, source }));
const sleepHistory = (days: readonly number[], restingHr = 50, source = "device-a"): PreRunSleep[] => days.map(day => sleep({ id: `sleep-history-${source}-${day}`, date: `2026-11-${String(day).padStart(2, "0")}`, bedtime: null, waketime: `2026-11-${String(day).padStart(2, "0")}T06:00:00+08:00`, restingHr, source }));

describe("strict HK dates and explicit timestamp parsing", () => {
  it.each(["2024-02-29", "2000-02-29", "2026-11-15", "0001-01-01"])("accepts canonical valid date %s", value => {
    expect(canonicalPreRunHKDate(value)).toBe(value);
  });
  it.each(["2026-02-29", "1900-02-29", "2026-04-31", "2026-13-01", "2026-00-01", "2026-11-00", "2026-1-5", " 2026-11-15", "11/15/2026", "2026-11-15T00:00:00Z", "", "0000-01-01"])("rejects invalid/ambiguous date %s", value => {
    expect(canonicalPreRunHKDate(value)).toBeNull();
  });
  it.each(["2026-02-29T07:00:00+08:00", "2026-11-15T24:00:00+08:00", "2026-11-15T08:60:00Z", "2026-11-15T08:00:60Z", "2026-11-15T08:00:00", "2026-11-15", "08:00", "2026-11-15T08:00:00+14:01", "2026-11-15T08:00:00-00:00"])("does not normalize malformed/unzoned timestamp %s", value => {
    expect(parsePreRunZonedTimestamp(value)).toBeNull();
  });
  it("matches a UTC wake crossing HK midnight without depending on host timezone", () => {
    const result = matchRunningPreRunContext({ id: 1, HKdate: "2024-03-01", startTimestamp: "2024-02-29T16:20:00Z" }, [sleep({ date: "2024-03-01", bedtime: "2024-02-29T10:00:00Z", waketime: "2024-02-29T16:10:00Z" })], []);
    expect(result.run.valid).toBe(true);
    expect(result.sleep?.measurementHKdate).toBe("2024-03-01");
    expect(result.sleep?.ageHours).toBeCloseTo(1 / 6);
    expect(result.sleep?.measuredAt).toBe("2024-02-29T16:10:00.000Z");
  });
  it("makes every association null on invalid run date/start or HK mismatch, never fallback", () => {
    for (const badRun of [
      { ...run, HKdate: "2026-02-29" },
      { ...run, startTimestamp: "08:00" },
      { ...run, startTimestamp: "" },
      { ...run, startTimestamp: "2026-11-14T15:59:00Z" },
    ]) {
      const result = matchRunningPreRunContext(badRun, [sleep()], [heart()]);
      expect(result.run.valid).toBe(false);
      expect(result.sleep).toBeNull();
      expect(result.restingHr).toBeNull();
      expect(result.baseline.records).toEqual([]);
    }
  });
});

describe("pre-run sleep association", () => {
  it("uses measured wake <= start and preserves exact provenance/covariates", () => {
    const result = matchRunningPreRunContext(run, [sleep()], []);
    expect(result.sleep).toMatchObject({ id: "sleep-a", date: run.HKdate, source: "device-a", pairingMethod: "explicit-wake-timestamp", confidence: "verified-pre-run", ageHours: 1.5, sleepHours: 7.5 });
    expect(result.restingHr).toMatchObject({ kind: "verified-overnight-sleep", restingHr: 60, source: "device-a" });
    expect(result.coverage.sleepWakeVerified).toBe(true);
    expect(matchRunningPreRunContext(run, [sleep({ waketime: run.startTimestamp })], []).sleep).not.toBeNull();
  });
  it("entirely excludes all unverified same-day rows, including their resting HR and HRV", () => {
    const result = matchRunningPreRunContext(run, [
      sleep({ bedtime: "23:00", waketime: "06:00" }),
      sleep({ id: "missing-wake", bedtime: null, waketime: null }),
      sleep({ id: "clock-with-seconds", bedtime: "23:00:00", waketime: "06:00:00" }),
    ], [heart({ date: run.HKdate })]);
    expect(result.sleep).toBeNull();
    expect(result.sleepHours).toBeNull();
    expect(result.restingHr).toBeNull();
    expect(result.hrv).toBeNull();
    expect(result.coverage.rejected["unverified-same-day-sleep"]).toBe(3);
    expect(result.coverage.rejected["same-day-or-future-heart-summary"]).toBe(1);
  });
  it("only allows same-day HH:mm after an explicit adapter wake-date contract", () => {
    const clockSleep = sleep({ bedtime: "23:00", waketime: "06:30" });
    expect(matchRunningPreRunContext(run, [clockSleep], []).sleep).toBeNull();
    const confirmed = matchRunningPreRunContext(run, [clockSleep], [], { dateConvention: "wake-date" });
    expect(confirmed.sleep).toMatchObject({ pairingMethod: "adapter-confirmed-wake-date", ageHours: 1.5 });
    expect(matchRunningPreRunContext(run, [sleep({ bedtime: "23:00", waketime: "09:00" })], [], { dateConvention: "wake-date" }).sleep).toBeNull();
    expect(matchRunningPreRunContext(run, [sleep({ date: "2026-11-14" })], [], { dateConvention: "wake-date" }).sleep).toBeNull();
  });
  it("uses prior-date proxy without inventing an end time or borrowing overnight RHR", () => {
    const result = matchRunningPreRunContext(run, [sleep({ date: "2026-11-14", bedtime: "23:00", waketime: "06:30" })], []);
    expect(result.sleep).toMatchObject({ pairingMethod: "prior-date-proxy", confidence: "lower-confidence", measuredAt: null, ageHours: null, ageHoursRange: [1.5, 25.5], sleepHours: 7.5, restingHr: null });
    expect(result.restingHr).toBeNull();
    expect(result.coverage.lowerConfidencePairing).toBe(true);
    expect(result.hrv).toMatchObject({ kind: "sleep-context", unit: "unknown", interpretation: "context-only" });
  });
  it("excludes unknown-convention sleep without a run start while bounding prior-day heart", () => {
    const dateOnly = { id: 1, HKdate: run.HKdate };
    const result = matchRunningPreRunContext(dateOnly, [sleep(), sleep({ id: "prior", date: "2026-11-14", bedtime: "23:00", waketime: "06:30" })], [heart()]);
    expect(result.sleep).toBeNull();
    expect(result.restingHr?.ageHoursRange).toEqual([0, 48]);
    expect(result.coverage.runStartKnown).toBe(false);
    expect(matchRunningPreRunContext(dateOnly, [sleep({ bedtime: null, waketime: "2026-11-14T06:00:00+08:00" })], []).sleep).toBeNull();
  });
  it("rejects a prior bedtime-date proxy whose possible next-day wake is after a midnight run", () => {
    const midnightRun = { ...run, startTimestamp: "2026-11-15T01:00:00+08:00" };
    const result = matchRunningPreRunContext(midnightRun, [sleep({ date: "2026-11-14", bedtime: "23:30", waketime: "08:00" })], []);
    expect(result.sleep).toBeNull();
    expect(result.sleepHours).toBeNull();
    expect(result.coverage.rejected["ambiguous-proxy-wake-after-run"]).toBe(1);
    expect(matchRunningPreRunContext(run, [sleep({ date: "2026-11-14", bedtime: null, waketime: null })], []).sleep).toBeNull();
  });
  it("never admits ambiguous same-day clocks even for an evening run; verified adapter semantics can", () => {
    const eveningRun = { ...run, startTimestamp: "2026-11-15T20:00:00+08:00" };
    const row = sleep({ bedtime: "23:30", waketime: "08:00" });
    expect(matchRunningPreRunContext(eveningRun, [row], []).sleep).toBeNull();
    expect(matchRunningPreRunContext(eveningRun, [row], [], { dateConvention: "wake-date" }).sleep?.ageHours).toBe(12);
  });
  it("rejects future/night-after-run and malformed explicit timestamps instead of date fallback", () => {
    const rows = [
      sleep({ id: "future-date", date: "2026-11-16" }),
      sleep({ id: "future-wake", date: "2026-11-14", bedtime: "23:00", waketime: "2026-11-16T06:00:00+08:00" }),
      sleep({ id: "after-start", waketime: "2026-11-15T08:01:00+08:00" }),
      sleep({ id: "bed-after-run", bedtime: "2026-11-15T09:00:00+08:00" }),
      sleep({ id: "bad-wake", date: "2026-11-14", waketime: "2026-02-29T06:00:00+08:00" }),
      sleep({ id: "bad-clock", date: "2026-11-14", bedtime: null, waketime: "25:00" }),
      sleep({ id: "unknown-date", date: "" }),
      sleep({ id: "date-timestamp", date: "2026-11-14T00:00:00Z" }),
    ];
    const result = matchRunningPreRunContext(run, rows, []);
    expect(result.sleep).toBeNull();
    expect(result.restingHr).toBeNull();
    expect(result.hrv).toBeNull();
    expect(Object.keys(result.coverage.rejected).length).toBeGreaterThan(3);
  });
  it("uses exact 48-hour measured threshold and stricter proxy upper bound", () => {
    const base = sleep({ date: "2026-11-13", bedtime: null, waketime: "2026-11-13T08:00:00+08:00" });
    expect(matchRunningPreRunContext(run, [base], []).sleep?.ageHours).toBe(48);
    expect(matchRunningPreRunContext(run, [{ ...base, waketime: "2026-11-13T07:59:59+08:00" }], []).sleep).toBeNull();
    expect(matchRunningPreRunContext(run, [{ ...base, waketime: "08:00" }], []).sleep?.ageHoursRange).toEqual([24, 48]);
    expect(matchRunningPreRunContext(run, [{ ...base, waketime: "07:59:59" }], []).sleep).toBeNull();
  });
  it("does not guess mixed minutes: default is hours, explicit minutes conversion is unrounded", () => {
    expect(matchRunningPreRunContext(run, [sleep({ sleepDuration: 450 })], []).sleep).toBeNull();
    const result = matchRunningPreRunContext(run, [sleep({ sleepDuration: "451" })], [], { sleepDurationUnit: "minutes" });
    expect(result.sleepHours).toBeCloseTo(451 / 60);
    expect(result.sleep?.durationUnit).toBe("minutes");
  });
  it.each([0, -1, 16.01, 24, 1440, NaN, Infinity, "n/a", "7h"])("rejects implausible or invalid supplied duration %s", value => {
    const result = matchRunningPreRunContext(run, [sleep({ sleepDuration: value })], []);
    expect(result.sleep).toBeNull();
    expect(result.restingHr).toBeNull();
    expect(result.coverage.rejected["invalid-sleep-duration"]).toBe(1);
  });
  it("keeps absent measurements null, while real score zero remains zero", () => {
    const result = matchRunningPreRunContext(run, [sleep({ sleepDuration: null, sleepScore: 0, restingHr: null, hrv: null })], [heart({ restingHr: null, hrv: null })]);
    expect(result.sleep).not.toBeNull();
    expect(result.sleepHours).toBeNull();
    expect(result.sleep?.sleepScore).toBe(0);
    expect(result.restingHr).toBeNull();
    expect(result.rhrDeltaBpm).toBeNull();
    expect(result.hrv).toBeNull();
  });
  it("chooses the closest valid wake deterministically and never sums/merges duplicates", () => {
    const records = [sleep({ id: "later", waketime: "2026-11-15T07:00:00+08:00", sleepDuration: 6, hrv: null }), sleep(), sleep({ id: "invalid", waketime: "2026-11-15T07:30:00+08:00", sleepDuration: 100 })];
    const first = matchRunningPreRunContext(run, records, []);
    expect(first).toEqual(matchRunningPreRunContext(run, [...records].reverse(), []));
    expect(first.sleep).toMatchObject({ id: "later", sleepHours: 6, hrv: null });
    expect(first.coverage.duplicateRowsDiscarded).toBe(1);
    expect(first.hrv).toBeNull();
  });
  it("breaks exact date/time ties deterministically by complete row then stable ID", () => {
    const a = sleep({ id: "a", sleepDuration: 6 }), b = sleep({ id: "b", sleepDuration: 8 });
    expect(matchRunningPreRunContext(run, [b, a], []).sleep?.id).toBe("a");
    expect(matchRunningPreRunContext(run, [a, b], []).sleepHours).toBe(6);
  });
});

describe("strict resting HR and past-only baseline", () => {
  it("daily heart summaries must be strictly earlier than the run date", () => {
    const result = matchRunningPreRunContext(run, [], [heart({ id: "past" }), heart({ id: "same", date: run.HKdate, restingHr: 90 }), heart({ id: "future", date: "2026-11-16", restingHr: 100 })]);
    expect(result.restingHr).toMatchObject({ id: "past", date: "2026-11-14", kind: "prior-day-heart-summary", restingHr: 60, ageHours: null, measuredAt: null });
    expect(result.coverage.rejected["same-day-or-future-heart-summary"]).toBe(2);
  });
  it.each([0, 29, 121, 250, -1, NaN, Infinity, "60bpm"])("rejects resting HR %s without substituting exercise metrics", value => {
    const exerciseOnly = { ...heart({ restingHr: value, hrv: null }), avgHR: 75, avgHr: 75, highHr: 80, HRzones: [60] };
    const result = matchRunningPreRunContext(run, [sleep({ restingHr: value, hrv: null })], [exerciseOnly]);
    expect(result.restingHr).toBeNull();
    expect(result.baseline.meanBpm).toBeNull();
    expect(result.rhrDeltaBpm).toBeNull();
  });
  it("accepts inclusive resting-HR validation bounds 30 through 120", () => {
    for (const value of [30, 120, "60"]) expect(matchRunningPreRunContext(run, [], [heart({ restingHr: value })]).restingHr?.restingHr).toBe(Number(value));
  });
  it("anchors both baseline windows strictly before the selected older measurement, not the run", () => {
    const result = matchRunningPreRunContext(run, [], [heartHistory([8, 9, 10, 11, 12]), heart({ date: "2026-11-13", restingHr: 120 }), heart(), heart({ date: run.HKdate, restingHr: 120 }), heart({ date: "2026-11-20", restingHr: 120 })].flat());
    // November 13 is strictly before the selected Nov 14; Nov 14 itself is never baseline.
    expect(result.restingHr?.date).toBe("2026-11-14");
    expect(result.baseline.windowEndExclusiveHKdate).toBe("2026-11-14");
    expect(result.baseline.records.every(r => r.measurementHKdate < "2026-11-14")).toBe(true);
    expect(result.baseline.validDays).toBe(6);
    expect(result.baseline.meanBpm).toBeCloseTo((5 * 50 + 120) / 6);
    expect(result.rhrDeltaBpm).toBeCloseTo(60 - (5 * 50 + 120) / 6);
    expect(result.baselines.days14.windowStartHKdate).toBe("2026-10-31");
    expect(result.baselines.days28.windowStartHKdate).toBe("2026-10-17");
  });
  it("computes overnight baseline only from verified older sleep measurements of the same source", () => {
    const result = matchRunningPreRunContext(run, [sleep(), ...sleepHistory([8, 9, 10, 11, 12]), sleep({ id: "same-day-earlier", waketime: "2026-11-15T05:00:00+08:00", restingHr: 120 }), sleep({ id: "unverified-past", date: "2026-11-13", bedtime: "23:00", waketime: "06:00", restingHr: 120 })], heartHistory([8, 9, 10, 11, 12], 120));
    expect(result.baseline).toMatchObject({ validDays: 5, meanBpm: 50, rhrDeltaBpm: 10, kind: "verified-overnight-sleep", source: "device-a" });
    expect(result.baseline.records.some(r => r.id === "same-day-earlier" || r.id === "unverified-past")).toBe(false);
  });
  it("requires >=5 distinct valid days, never counts duplicate rows as coverage", () => {
    const rows = [heart(), ...heartHistory([8, 9, 10, 11]), ...heartHistory([8, 9, 10, 11])];
    const result = matchRunningPreRunContext(run, [], rows);
    expect(result.baseline.validDays).toBe(4);
    expect(result.baseline.coverage).toBe(4 / 28);
    expect(result.baseline.meanBpm).toBeNull();
    expect(result.rhrDeltaBpm).toBeNull();
    expect(matchRunningPreRunContext(run, [], rows, { baselineWindowDays: 14 }).baseline.windowDays).toBe(14);
  });
  it("uses the inclusive preceding window start, excludes outside-window and invalid HR", () => {
    const rows = [heart(), ...heartHistory([8, 9, 10, 11]), heart({ id: "inside14", date: "2026-10-31", restingHr: 50 }), heart({ id: "outside14", date: "2026-10-30", restingHr: 100 }), heart({ id: "invalidhr", date: "2026-11-12", restingHr: 121 })];
    const result = matchRunningPreRunContext(run, [], rows, { baselineWindowDays: 14 });
    expect(result.baseline.validDays).toBe(5);
    expect(result.baseline.meanBpm).toBe(50);
    expect(result.rhrDeltaBpm).toBe(10);
    expect(result.baselines.days28.validDays).toBe(6);
  });
  it("never blends sources, kinds, or unknown provenance into a baseline", () => {
    const known = matchRunningPreRunContext(run, [], [heart(), ...heartHistory([8, 9, 10, 11, 12]), ...heartHistory([8, 9, 10, 11, 12], 120, "device-b")]);
    expect(known.baseline.meanBpm).toBe(50);
    expect(known.baseline.records.every(r => r.source === "device-a")).toBe(true);
    const unknown = matchRunningPreRunContext(run, [], [heart({ source: null }), ...heartHistory([8, 9, 10, 11, 12]).map(r => ({ ...r, source: null }))]);
    expect(unknown.restingHr?.source).toBeNull();
    expect(unknown.baseline.meanBpm).toBeNull();
    expect(unknown.limitations.join(" ")).toContain("provenance is unknown");
  });
  it("retains HRV as unknown-unit context only, never a model adjustment", () => {
    const result = matchRunningPreRunContext(run, [], [heart({ hrv: "42.5" })]);
    expect(result.hrv).toMatchObject({ value: 42.5, unit: "unknown", interpretation: "context-only", kind: "daily-heart-context", source: "device-a" });
    expect(result.limitations.join(" ")).toContain("measurement protocol are unknown");
    expect(matchRunningPreRunContext(run, [], [heart({ hrv: -1 })]).hrv).toBeNull();
  });
  it("has no cross-user or cross-call borrowing/cache and explicitly assigns scope to caller", () => {
    const userA = matchRunningPreRunContext(run, [sleep()], [heart()]);
    const userB = matchRunningPreRunContext({ ...run, id: "user-b-run" }, [], []);
    expect(userA.sleepHours).toBe(7.5);
    expect(userB.sleep).toBeNull();
    expect(userB.restingHr).toBeNull();
    expect(userB.hrv).toBeNull();
    expect(userB.baseline.records).toEqual([]);
    expect(userB.coverage.userScopeVerified).toBe(false);
    expect(userB.limitations.join(" ")).toContain("authorized single-user");
  });
  it("does not mutate supplied arrays or rows", () => {
    const row = Object.freeze(sleep());
    const rows = Object.freeze([row]);
    const heartRow = Object.freeze(heart());
    expect(() => matchRunningPreRunContext(Object.freeze(run), rows, Object.freeze([heartRow]))).not.toThrow();
    expect(rows[0]).toBe(row);
  });
});
