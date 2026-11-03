import { Encoder, Profile } from "@garmin/fitsdk";
import { describe, expect, it } from "vitest";
import { parseGarminRawFile } from "./garminFileImport";

describe("Official FIT units and historical date safety", () => {
  it("converts SDK millimetres to metres/cm and running strides/min to total steps/min", () => {
    const start = new Date("2026-11-01T16:10:00.000Z");
    const encoder = new Encoder();
    encoder.onMesg(Profile.MesgNum.FILE_ID, { type: "activity", manufacturer: "development", product: 1, timeCreated: start });
    for (let i = 0; i <= 2; i++) encoder.onMesg(Profile.MesgNum.RECORD, {
      timestamp: new Date(start.getTime() + i * 180000), distance: i * 500,
      speed: 2.77, cadence: 85 + i, heartRate: 130 + i,
    });
    encoder.onMesg(Profile.MesgNum.SESSION, {
      timestamp: new Date(start.getTime() + 360000), startTime: start, sport: "running",
      totalTimerTime: 360, totalDistance: 1000,
      avgCadence: 86, maxCadence: 90,
      avgStepLength: 1020, avgVerticalOscillation: 80, avgVerticalRatio: 7.5,
    });
    const parsed = parseGarminRawFile(Buffer.from(encoder.close()), "historical.fit");
    expect(parsed.fields).toMatchObject({ date: "2026-11-02", avgStrideLengthM: "1.02", verticalOscillationCm: "8", avgVerticalRatio: "7.5", averageCadence: "172", maxCadence: "180" });
    expect(parsed.timeSeries[0].cadence).toBe(170);
    expect(parsed.timeSeries[2].cadence).toBe(174);
  });
  it("never substitutes today's date for a CSV with no valid historical timestamps", () => {
    const parsed = parseGarminRawFile(Buffer.from("distance,heart_rate\n5000,140"), "invalid-history.csv");
    expect(parsed.fields.date).toBeUndefined();
    expect(parsed.timeSeries).toHaveLength(0);
  });
});
