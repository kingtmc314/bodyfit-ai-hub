import { describe, expect, it } from "vitest";
import { buildRunningEnergySimulation } from "../client/src/lib/runningEnergyModel";

describe("running energy-system learning model", () => {
  const commonInput = {
    baselinePaceSecPerKm: 330,
    maxHeartRate: 188,
    restingHeartRate: 56,
    temperatureC: 18,
    humidityPct: 55,
    windKph: 5,
  };

  it("returns a complete, internally balanced timeline for sprint and endurance scenarios", () => {
    const sprint = buildRunningEnergySimulation({ ...commonInput, scenario: "100m", easyRunDistance: "10K" });
    const endurance = buildRunningEnergySimulation({ ...commonInput, scenario: "easy", easyRunDistance: "Marathon" });
    const sprintFinal = sprint.timeline.at(-1)!;
    const enduranceFinal = endurance.timeline.at(-1)!;

    expect(sprint.timeline).toHaveLength(41);
    expect(sprintFinal.atpPcr + sprintFinal.glycolytic + sprintFinal.aerobic).toBeCloseTo(100, 0);
    expect(sprint.peakHeartRate).toBeLessThanOrEqual(188);
    expect(sprint.peakLactate).toBeGreaterThan(1);
    expect(endurance.distanceKm).toBeCloseTo(42.195, 3);
    expect(enduranceFinal.aerobic).toBeGreaterThan(sprintFinal.aerobic);
  });

  it("applies a conservative performance penalty in hot, humid and windy conditions", () => {
    const mild = buildRunningEnergySimulation({ ...commonInput, scenario: "easy", easyRunDistance: "10K" });
    const harsh = buildRunningEnergySimulation({
      ...commonInput,
      scenario: "easy",
      easyRunDistance: "10K",
      temperatureC: 32,
      humidityPct: 85,
      windKph: 24,
    });

    expect(harsh.weatherLoadPercent).toBeGreaterThan(mild.weatherLoadPercent);
    expect(harsh.weatherFinishSeconds).toBeGreaterThan(mild.weatherFinishSeconds);
    expect(harsh.weatherPaceSecPerKm).toBeGreaterThan(mild.weatherPaceSecPerKm);
  });

  it("keeps the model framed as an estimate rather than a measurement", () => {
    const result = buildRunningEnergySimulation({ ...commonInput, scenario: "800m", easyRunDistance: "10K" });
    expect(result.recovery.after1MinHr).toBeGreaterThanOrEqual(result.recovery.after3MinHr);
    expect(result.recovery.after3MinHr).toBeGreaterThanOrEqual(result.recovery.after5MinHr);
    expect(result.recovery.oxygenDebtClearPct).toBeGreaterThan(0);
  });
});
