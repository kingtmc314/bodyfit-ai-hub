import { describe, expect, it } from "vitest";
import { parseGarminCsv, parseGarminRawFile } from "./garminFileImport";

describe("Garmin original file import", () => {
  it("extracts Garmin-style CSV records into a reviewed summary and time series", () => {
    const csv = [
      "timestamp,distance,enhanced_speed,heart_rate,cadence,power,enhanced_altitude,temperature",
      "2026-11-01T00:00:00Z,0,3.0,120,165,210,25,24",
      "2026-11-01T00:00:01Z,3000,3.2,122,166,215,25.1,24",
      "2026-11-01T00:00:02Z,6300,3.4,124,167,220,25.2,24",
    ].join("\n");
    const result = parseGarminCsv(Buffer.from(csv));

    expect(result.sourceFormat).toBe("CSV");
    expect(result.timeSeries).toHaveLength(3);
    expect(result.timeSeries[1]).toMatchObject({ elapsedSec: 1, heartRate: 122, cadence: 166, power: 215 });
    expect(result.fields.date).toBe("2026-11-01");
    expect(result.fields.distanceKm).toBe("6.30");
  });

  it("routes CSV files through the common file parser and rejects unsupported formats", () => {
    const csv = "timestamp,distance\n2026-11-01T00:00:00Z,0\n";
    expect(parseGarminRawFile(Buffer.from(csv), "run.csv").sourceFormat).toBe("CSV");
    expect(() => parseGarminRawFile(Buffer.from("not fit"), "run.gpx")).toThrow(/FIT 或 CSV/);
  });
});
