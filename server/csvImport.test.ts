import { describe, it, expect } from "vitest";
import {
  parseBodyRow, parseSleepRow, parseHeartRateRow, parseWorkoutRow,
  detectDataType, parseRows,
} from "./csvImport";

// ─── parseBodyRow ─────────────────────────────────────────────────────────────
describe("parseBodyRow", () => {
  it("parses Garmin weight CSV row", () => {
    const row = {
      Date: "2024-01-15",
      Weight: "72.5",
      BMI: "22.4",
      "Body Fat": "18.2",
      "Skeletal Muscle Mass": "55.1",
      "Bone Mass": "3.2",
      "Body Water": "58.0",
    };
    const result = parseBodyRow(row);
    expect(result).not.toBeNull();
    expect(result!.date).toBe("2024-01-15");
    expect(result!.weight).toBe(72.5);
    expect(result!.bmi).toBe(22.4);
    expect(result!.bodyFatPct).toBe(18.2);
    expect(result!.muscleMass).toBe(55.1);
  });

  it("parses MM/DD/YYYY date format", () => {
    const row = { Date: "01/15/2024", Weight: "70.0" };
    const result = parseBodyRow(row);
    expect(result!.date).toBe("2024-01-15");
  });

  it("handles missing optional fields", () => {
    const row = { Date: "2024-03-01", Weight: "68.0" };
    const result = parseBodyRow(row);
    expect(result!.weight).toBe(68.0);
    expect(result!.bmi).toBeUndefined();
    expect(result!.bodyFatPct).toBeUndefined();
  });

  it("returns null for row with no date", () => {
    const row = { Weight: "70.0", BMI: "22.0" };
    expect(parseBodyRow(row)).toBeNull();
  });

  it("handles -- as empty value", () => {
    const row = { Date: "2024-01-01", Weight: "--", BMI: "22.0" };
    const result = parseBodyRow(row);
    expect(result!.weight).toBeUndefined();
    expect(result!.bmi).toBe(22.0);
  });
});

// ─── parseSleepRow ────────────────────────────────────────────────────────────
describe("parseSleepRow", () => {
  it("parses Garmin sleep CSV row", () => {
    const row = {
      Date: "2024-01-15",
      "Sleep Score": "78",
      Duration: "7.5",
      "Deep Sleep": "1.2",
      "REM Sleep": "1.8",
      "Body Battery": "85",
      "Pulse Ox": "96",
    };
    const result = parseSleepRow(row);
    expect(result).not.toBeNull();
    expect(result!.date).toBe("2024-01-15");
    expect(result!.sleepScore).toBe(78);
    expect(result!.sleepDuration).toBe(7.5);
    expect(result!.deepSleep).toBe(1.2);
    expect(result!.remSleep).toBe(1.8);
    expect(result!.bodyBattery).toBe(85);
    expect(result!.pulseOx).toBe(96);
  });

  it("converts sleep score to quality label", () => {
    const excellent = parseSleepRow({ Date: "2024-01-01", "Sleep Score": "85" });
    expect(excellent!.sleepQuality).toBe("Excellent");

    const good = parseSleepRow({ Date: "2024-01-01", "Sleep Score": "65" });
    expect(good!.sleepQuality).toBe("Good");

    const fair = parseSleepRow({ Date: "2024-01-01", "Sleep Score": "45" });
    expect(fair!.sleepQuality).toBe("Fair");

    const poor = parseSleepRow({ Date: "2024-01-01", "Sleep Score": "30" });
    expect(poor!.sleepQuality).toBe("Poor");
  });

  it("converts duration in minutes to hours", () => {
    const row = { Date: "2024-01-01", Duration: "450" }; // 450 min = 7.5 hrs
    const result = parseSleepRow(row);
    expect(result!.sleepDuration).toBeCloseTo(7.5, 1);
  });
});

// ─── parseHeartRateRow ────────────────────────────────────────────────────────
describe("parseHeartRateRow", () => {
  it("parses Garmin heart rate CSV row", () => {
    const row = {
      Date: "2024-01-15",
      "Resting HR": "58",
      "High HR": "142",
      "Avg HR": "72",
      HRV: "45",
    };
    const result = parseHeartRateRow(row);
    expect(result!.date).toBe("2024-01-15");
    expect(result!.restingHr).toBe(58);
    expect(result!.highHr).toBe(142);
    expect(result!.avgHr).toBe(72);
    expect(result!.hrv).toBe(45);
  });

  it("parses alternative column names", () => {
    const row = {
      Date: "2024-02-01",
      "Resting Heart Rate": "60",
      "Max Heart Rate": "155",
    };
    const result = parseHeartRateRow(row);
    expect(result!.restingHr).toBe(60);
    expect(result!.highHr).toBe(155);
  });
});

// ─── parseWorkoutRow ──────────────────────────────────────────────────────────
describe("parseWorkoutRow", () => {
  it("parses Garmin activities CSV row", () => {
    const row = {
      "Activity Type": "RUNNING",
      Date: "2024-01-15",
      Title: "Morning Run",
      Time: "00:45:30",
      Distance: "8.2",
      Calories: "520",
      "Avg HR": "148",
      "Max HR": "172",
    };
    const result = parseWorkoutRow(row);
    expect(result!.date).toBe("2024-01-15");
    expect(result!.activityType).toBe("RUNNING");
    expect(result!.activityName).toBe("Morning Run");
    expect(result!.durationMinutes).toBeCloseTo(46, 0); // 00:45:30 = 45.5 min, rounded to 46
    expect(result!.distanceKm).toBe(8.2);
    expect(result!.calories).toBe(520);
    expect(result!.avgHr).toBe(148);
    expect(result!.maxHr).toBe(172);
  });

  it("converts duration in seconds to minutes", () => {
    const row = { Date: "2024-01-01", "Activity Type": "YOGA", "Duration In Seconds": "3600" };
    const result = parseWorkoutRow(row);
    expect(result!.durationMinutes).toBe(60);
  });

  it("converts distance in meters to km", () => {
    const row = { Date: "2024-01-01", "Activity Type": "CYCLING", Distance: "25400" };
    const result = parseWorkoutRow(row);
    expect(result!.distanceKm).toBeCloseTo(25.4, 1);
  });
});

// ─── detectDataType ───────────────────────────────────────────────────────────
describe("detectDataType", () => {
  it("detects body composition from headers", () => {
    expect(detectDataType(["Date", "Weight", "BMI", "Body Fat"])).toBe("body");
  });

  it("detects sleep from headers", () => {
    expect(detectDataType(["Date", "Sleep Score", "Duration", "Deep Sleep"])).toBe("sleep");
  });

  it("detects heart rate from headers", () => {
    expect(detectDataType(["Date", "Resting HR", "High HR", "HRV"])).toBe("heartrate");
  });

  it("detects workout from headers", () => {
    expect(detectDataType(["Activity Type", "Date", "Time", "Calories"])).toBe("workout");
  });

  it("returns null for unknown headers", () => {
    expect(detectDataType(["foo", "bar", "baz"])).toBeNull();
  });
});

// ─── parseRows ────────────────────────────────────────────────────────────────
describe("parseRows", () => {
  it("parses multiple body rows and skips invalid ones", () => {
    const rows = [
      { Date: "2024-01-01", Weight: "70.0" },
      { Weight: "71.0" }, // no date — should be skipped
      { Date: "2024-01-03", Weight: "69.5" },
    ];
    const result = parseRows(rows, "body");
    expect(result).toHaveLength(2);
  });
});
