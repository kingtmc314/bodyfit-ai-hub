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

  it("uniformly samples very long activities across their full duration instead of dropping the end of the run", () => {
    const rows = ["timestamp,distance,heart_rate"];
    const startedAt = Date.parse("2026-11-01T00:00:00Z");
    for (let second = 0; second <= 10000; second += 1) {
      rows.push(`${new Date(startedAt + second * 1000).toISOString()},${second * 3},${130 + second % 20}`);
    }
    const result = parseGarminCsv(Buffer.from(rows.join("\n")));

    expect(result.timeSeries).toHaveLength(10000);
    expect(result.timeSeries[0]?.elapsedSec).toBe(0);
    expect(result.timeSeries.at(-1)?.elapsedSec).toBe(10000);
    expect(result.garminDetails.rawSampleCount).toBe(10001);
  });

  it("extracts Garmin GPX trackpoint extensions into reviewed samples and derives distance when no distance is supplied", () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Garmin" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <trk><name>Morning run</name><trkseg>
    <trkpt lat="22.3000" lon="114.1700"><ele>11.2</ele><time>2026-11-01T00:00:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>130</gpxtpx:hr><gpxtpx:cad>82</gpxtpx:cad><gpxtpx:atemp>25</gpxtpx:atemp></gpxtpx:TrackPointExtension></extensions></trkpt>
    <trkpt lat="22.3010" lon="114.1700"><ele>14.0</ele><time>2026-11-01T00:01:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>142</gpxtpx:hr><gpxtpx:cad>84</gpxtpx:cad></gpxtpx:TrackPointExtension></extensions></trkpt>
    <trkpt lat="22.3020" lon="114.1700"><ele>12.5</ele><time>2026-11-01T00:02:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>148</gpxtpx:hr><gpxtpx:cad>86</gpxtpx:cad></gpxtpx:TrackPointExtension></extensions></trkpt>
  </trkseg></trk>
</gpx>`;
    const result = parseGarminRawFile(Buffer.from(gpx), "run.gpx");

    expect(result.sourceFormat).toBe("GPX");
    expect(result.timeSeries).toHaveLength(3);
    expect(result.timeSeries[1]).toMatchObject({ elapsedSec: 60, heartRate: 142, cadence: 84, altitudeM: 14 });
    expect(Number(result.fields.distanceKm)).toBeGreaterThan(0.2);
    expect(result.garminDetails.totalAscentM).toBe(2.8);
  });

  it("extracts Garmin TCX laps, summary and trackpoints into the common reviewed record contract", () => {
    const tcx = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities><Activity Sport="Running"><Id>2026-11-01T00:00:00Z</Id>
    <Lap StartTime="2026-11-01T00:00:00Z"><TotalTimeSeconds>120</TotalTimeSeconds><DistanceMeters>400</DistanceMeters><Calories>24</Calories><AverageHeartRateBpm><Value>145</Value></AverageHeartRateBpm><MaximumHeartRateBpm><Value>158</Value></MaximumHeartRateBpm>
      <Track>
        <Trackpoint><Time>2026-11-01T00:00:00Z</Time><AltitudeMeters>10</AltitudeMeters><DistanceMeters>0</DistanceMeters><HeartRateBpm><Value>132</Value></HeartRateBpm><Cadence>80</Cadence></Trackpoint>
        <Trackpoint><Time>2026-11-01T00:01:00Z</Time><AltitudeMeters>13</AltitudeMeters><DistanceMeters>200</DistanceMeters><HeartRateBpm><Value>145</Value></HeartRateBpm><Cadence>83</Cadence></Trackpoint>
        <Trackpoint><Time>2026-11-01T00:02:00Z</Time><AltitudeMeters>11</AltitudeMeters><DistanceMeters>400</DistanceMeters><HeartRateBpm><Value>158</Value></HeartRateBpm><Cadence>85</Cadence></Trackpoint>
      </Track>
    </Lap>
  </Activity></Activities>
</TrainingCenterDatabase>`;
    const result = parseGarminRawFile(Buffer.from(tcx), "race.tcx");

    expect(result.sourceFormat).toBe("TCX");
    expect(result.timeSeries).toHaveLength(3);
    expect(result.timeSeries[2]).toMatchObject({ elapsedSec: 120, distanceKm: 0.4, heartRate: 158, cadence: 85 });
    expect(result.fields.distanceKm).toBe("0.40");
    expect(result.fields.averageHeartRate).toBe("145");
    expect(result.laps).toEqual([{ lap: 1, durationSec: 120, distanceKm: 0.4, avgPace: "5.00" }]);
  });

  it("routes supported source files through the common parser and rejects unsupported or unsafe XML", () => {
    const csv = "timestamp,distance\n2026-11-01T00:00:00Z,0\n";
    expect(parseGarminRawFile(Buffer.from(csv), "run.csv").sourceFormat).toBe("CSV");
    expect(() => parseGarminRawFile(Buffer.from("not fit"), "run.txt")).toThrow(/FIT、CSV、GPX 或 TCX/);
    expect(() => parseGarminRawFile(Buffer.from("<!DOCTYPE gpx><gpx />"), "run.gpx")).toThrow(/DTD/);
  });
});
