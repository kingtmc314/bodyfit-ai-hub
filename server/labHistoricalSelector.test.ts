import { describe, expect, it } from "vitest";
import { selectLabHistoricalRuns } from "../shared/labHistoricalSelector";

const history = [
  { id: 1, date: "2026-01-03", runningType: "Sprint", routeType: "Track", distanceKm: 0.2, paceSecPerKm: 205 },
  { id: 2, date: "2026-01-04", runningType: "Interval", routeType: "Road", distanceKm: 2.4, paceSecPerKm: 255 },
  { id: 3, date: "2026-01-11", runningType: "Trail", routeType: "Trail", distanceKm: 8.2, paceSecPerKm: 410 },
  { id: 4, date: "2026-01-18", runningType: "Long Run", routeType: "Road", distanceKm: 22, paceSecPerKm: 355 },
  { id: 5, date: "2026-01-25", runningType: "Easy", routeType: "Road", distanceKm: 10.5, paceSecPerKm: 335 },
  { id: 6, date: "2026-02-01", runningType: "Race", routeType: "Road", distanceKm: 21.1, paceSecPerKm: 320 },
];

describe("energy-lab historical scenario selection", () => {
  it("selects sprint-compatible training while excluding trail and long-run evidence", () => {
    const selection = selectLabHistoricalRuns(history, "100m", "10K");

    expect(selection.consideredCount).toBe(6);
    expect(selection.selectedRuns.map(run => run.id)).toEqual([1, 2]);
    expect(selection.selectedRuns.some(run => run.routeType === "Trail")).toBe(false);
    expect(selection.selectedRuns.some(run => Number(run.distanceKm) >= 10)).toBe(false);
    expect(selection.eligibleCount).toBe(2);
    expect(selection.fallback).toBe("none");
    expect(selection.baselinePaceSecPerKm).toBeCloseTo(230, 0);
  });

  it("uses distance-appropriate non-trail evidence for half-marathon calibration", () => {
    const selection = selectLabHistoricalRuns(history, "easy", "Half Marathon");

    expect(selection.selectedRuns.map(run => run.id)).toEqual([4, 6]);
    expect(selection.selectedRuns.every(run => run.routeType !== "Trail")).toBe(true);
    expect(selection.ruleLabel).toContain("半馬");
    expect(selection.fallback).toBe("none");
  });

  it("falls back transparently to safe non-trail history when no exact analogue exists", () => {
    const selection = selectLabHistoricalRuns([
      { id: 9, runningType: "Easy", routeType: "Road", distanceKm: 5, paceSecPerKm: 360 },
      { id: 10, runningType: "Trail", routeType: "Trail", distanceKm: 5, paceSecPerKm: 450 },
    ], "100m", "10K");

    expect(selection.selectedRuns.map(run => run.id)).toEqual([9]);
    expect(selection.fallback).toBe("non-trail-history");
    expect(selection.fallbackReason).toContain("非越野");
    expect(selection.excludedTrailCount).toBe(1);
  });

  it("uses a reference value only when no complete historical pace and distance are available", () => {
    const selection = selectLabHistoricalRuns([
      { id: 12, runningType: "Sprint", routeType: "Track", distanceKm: null, paceSecPerKm: null },
    ], "200m", "10K");

    expect(selection.selectedRuns).toEqual([]);
    expect(selection.fallback).toBe("reference");
    expect(selection.fallbackReason).toContain("參考值");
  });
});
