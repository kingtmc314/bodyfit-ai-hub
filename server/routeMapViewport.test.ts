import { describe, expect, it } from "vitest";
import { analyzeRoute } from "../shared/routeAnalysis";
import { fitRouteViewport, projectRoute, projectRouteCoordinate, routeScreenPoint, visibleRouteTiles } from "../shared/routeMapViewport";

const hk = [{ latitude: 22.30, longitude: 114.17 }, { latitude: 22.31, longitude: 114.19 }, { latitude: 22.32, longitude: 114.18 }];
describe("GPS basemap viewport", () => {
  it("projects longitude eastward and latitude northward without swapping them", () => {
    const a = projectRouteCoordinate(hk[0]), b = projectRouteCoordinate(hk[1]);
    expect(b.x).toBeGreaterThan(a.x); expect(b.y).toBeLessThan(a.y);
    expect(projectRouteCoordinate({ latitude: 0, longitude: 0 })).toEqual({ x: 128, y: 128 });
  });
  it.each([179, 240, 390, 900])("fits the full real route in a %ipx map", width => {
    const points = projectRoute(hk); const view = fitRouteViewport(points, width, 320);
    for (const point of points) {
      const screen = routeScreenPoint(point, view, width, 320);
      expect(screen.x).toBeGreaterThanOrEqual(35); expect(screen.x).toBeLessThanOrEqual(width - 35);
      expect(screen.y).toBeGreaterThanOrEqual(35); expect(screen.y).toBeLessThanOrEqual(285);
    }
  });
  it("keeps GPS routes available when elevation is absent", () => {
    const route = analyzeRoute(hk);
    expect(route?.points).toHaveLength(3);
    expect(route?.maxUphillPct).toBeNull();
    expect(projectRoute(route!.points)).toHaveLength(3);
  });
  it("keeps nearby points across the antimeridian together", () => {
    const points = projectRoute([{ latitude: 1, longitude: 179.99 }, { latitude: 1, longitude: -179.99 }]);
    expect(Math.abs(points[1].x - points[0].x)).toBeLessThan(1);
    expect(fitRouteViewport(points, 390, 320).zoom).toBeGreaterThan(10);
  });
  it("handles coincident GPS and polar latitude without infinite zoom or coordinates", () => {
    const p = projectRouteCoordinate({ latitude: 90, longitude: 180 });
    expect(Number.isFinite(p.y)).toBe(true);
    expect(fitRouteViewport([p, p], 390, 320).zoom).toBe(17);
  });
  it("requests only visible tiles, wraps longitude and clips polar rows", () => {
    const view = { center: { x: -1, y: 0 }, zoom: 4 };
    const tiles = visibleRouteTiles(view, 390, 320);
    expect(tiles.length).toBeGreaterThan(0); expect(tiles.length).toBeLessThanOrEqual(9);
    for (const t of tiles) {
      expect(t.x).toBeGreaterThanOrEqual(0); expect(t.x).toBeLessThan(16);
      expect(t.y).toBeGreaterThanOrEqual(0); expect(t.y).toBeLessThan(16);
      expect(t.left).toBeLessThan(390); expect(t.left + 256).toBeGreaterThan(0);
      expect(t.top).toBeLessThan(320); expect(t.top + 256).toBeGreaterThan(0);
    }
  });
  it("does not fabricate a map when no GPS points exist", () => {
    expect(() => fitRouteViewport([], 390, 320)).toThrow("requires GPS");
    expect(analyzeRoute([{ latitude: 999, longitude: 114 }, {}])).toBeNull();
  });
});
