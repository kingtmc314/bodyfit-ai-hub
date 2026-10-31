import { describe, expect, it } from "vitest";
import { buildProgressionSuggestion } from "../shared/progression";

describe("buildProgressionSuggestion", () => {
  it("recommends a conservative weight increase after consistently achieving 10+ reps", () => {
    const result = buildProgressionSuggestion([
      { weight: 60, reps: 12 },
      { weight: 60, reps: 11 },
      { weight: 60, reps: 10 },
    ]);
    expect(result).toMatchObject({ available: true, strategy: "increase_weight", targetWeightKg: 62.5, targetReps: 10 });
  });

  it("recommends one more repetition before increasing a working weight", () => {
    const result = buildProgressionSuggestion([
      { weight: 32.5, reps: 8 },
      { weight: 32.5, reps: 8 },
    ]);
    expect(result).toMatchObject({ available: true, strategy: "increase_reps", targetWeightKg: 32.5, targetReps: 9 });
  });

  it("prioritizes control when recent repetitions are below the working range", () => {
    const result = buildProgressionSuggestion([{ weight: 80, reps: 5 }]);
    expect(result).toMatchObject({ available: true, strategy: "maintain", targetWeightKg: 80, targetReps: 6 });
  });

  it("does not fabricate an overload suggestion without completed strength sets", () => {
    expect(buildProgressionSuggestion([])).toMatchObject({ available: false });
  });
});
