import { describe, expect, it } from "vitest";
import { analyzeRoute, gradientBand, normalizeRoutePoints } from "../shared/routeAnalysis";

describe("Garmin route and gradient analysis", () => {
  it("normalizes coordinate-bearing records and derives distance when a raw route lacks distance", () => {
    const points = normalizeRoutePoints([
      { elapsedSec: 0, latitude: "22.3000", longitude: "114.1700", altitudeM: 8 },
      { elapsedSec: 60, latitude: 22.301, longitude: 114.17, altitudeM: 12 },
    ]);

    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ latitude: 22.3, longitude: 114.17, distanceKm: 0 });
    expect(points[1].distanceKm).toBeGreaterThan(0.1);
  });

  it("calculates elevation change, slope zones and distance-based segments from a route", () => {
    const analysis = analyzeRoute([
      { elapsedSec: 0, distanceKm: 0, latitude: 22.3, longitude: 114.17, altitudeM: 10 },
      { elapsedSec: 300, distanceKm: 0.5, latitude: 22.301, longitude: 114.17, altitudeM: 20 },
      { elapsedSec: 600, distanceKm: 1, latitude: 22.302, longitude: 114.17, altitudeM: 15 },
      { elapsedSec: 900, distanceKm: 1.5, latitude: 22.303, longitude: 114.17, altitudeM: 30 },
      { elapsedSec: 1200, distanceKm: 2, latitude: 22.304, longitude: 114.17, altitudeM: 22 },
    ]);

    expect(analysis).not.toBeNull();
    expect(analysis?.totalDistanceKm).toBe(2);
    expect(analysis?.ascentM).toBe(25);
    expect(analysis?.descentM).toBe(13);
    expect(analysis?.maxUphillPct).toBe(3);
    expect(analysis?.maxDownhillPct).toBe(-1.6);
    expect(analysis?.segments).toHaveLength(2);
    expect(analysis?.segments[0]).toMatchObject({ startKm: 0, endKm: 1, elevationChangeM: 5, gradePct: 0.5, band: "平路" });
    expect(analysis?.segments[1]).toMatchObject({ startKm: 1, endKm: 2, elevationChangeM: 7, gradePct: 0.7, band: "平路" });
    expect(analysis?.gradientDistribution.some(item => item.band === "上坡" && item.distanceKm > 0)).toBe(true);
    expect(analysis?.gradientDistribution.some(item => item.band === "下坡" && item.distanceKm > 0)).toBe(true);
  });

  it("uses stable user-facing gradient thresholds", () => {
    expect(gradientBand(-3)).toBe("陡下坡");
    expect(gradientBand(-1)).toBe("下坡");
    expect(gradientBand(0)).toBe("平路");
    expect(gradientBand(1)).toBe("上坡");
    expect(gradientBand(3)).toBe("陡上坡");
  });

  it("does not offer a route map when fewer than two valid GPS points are present", () => {
    expect(analyzeRoute([{ elapsedSec: 0, latitude: 22.3, longitude: 114.17 }])).toBeNull();
    expect(analyzeRoute([{ elapsedSec: 0, latitude: 91, longitude: 114.17 }, { elapsedSec: 1, latitude: 22.3, longitude: 114.17 }])).toBeNull();
  });
});
