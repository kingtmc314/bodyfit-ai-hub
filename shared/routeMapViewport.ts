export type RouteCoordinate = { latitude: number; longitude: number };
export type WorldPoint = { x: number; y: number };
export type RouteMapView = { center: WorldPoint; zoom: number };
export const TILE_SIZE = 256;
export const ROUTE_MAP_HEIGHT = 320;
export const MIN_ROUTE_ZOOM = 2;
export const MAX_ROUTE_ZOOM = 18;
const MAX_LATITUDE = 85.05112878;

/** Web Mercator, in world pixels at zoom 0. No routing/snapping or fabricated GPS. */
export function projectRouteCoordinate(point: RouteCoordinate): WorldPoint {
  const lat = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, point.latitude));
  const sin = Math.sin(lat * Math.PI / 180);
  return {
    x: (point.longitude + 180) / 360 * TILE_SIZE,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * TILE_SIZE,
  };
}

export function projectRoute(points: readonly RouteCoordinate[]): WorldPoint[] {
  let previousX: number | undefined;
  return points.map(point => {
    const projected = projectRouteCoordinate(point);
    // Keep a route crossing the antimeridian contiguous rather than spanning the world.
    if (previousX !== undefined) projected.x += Math.round((previousX - projected.x) / TILE_SIZE) * TILE_SIZE;
    previousX = projected.x;
    return projected;
  });
}

export function fitRouteViewport(points: readonly WorldPoint[], width: number, height: number, padding = 36): RouteMapView {
  if (!points.length) throw new Error("A route requires GPS points");
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min(
    Math.max(1, width - padding * 2) / Math.max(0.000001, maxX - minX),
    Math.max(1, height - padding * 2) / Math.max(0.000001, maxY - minY),
  );
  return {
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
    zoom: Math.max(MIN_ROUTE_ZOOM, Math.min(17, Math.floor(Math.log2(scale)))),
  };
}

export function routeScreenPoint(point: WorldPoint, view: RouteMapView, width: number, height: number) {
  const scale = 2 ** view.zoom;
  return { x: (point.x - view.center.x) * scale + width / 2, y: (point.y - view.center.y) * scale + height / 2 };
}

/** Only tiles intersecting the active viewport; no prefetching/offline downloads.
 * Browser caching/referrers and visible attribution follow https://operations.osmfoundation.org/policies/tiles/.
 */
export function visibleRouteTiles(view: RouteMapView, width: number, height: number) {
  const count = 2 ** view.zoom;
  const left = view.center.x * count - width / 2;
  const top = view.center.y * count - height / 2;
  const tiles: Array<{ key: string; x: number; y: number; z: number; left: number; top: number }> = [];
  for (let x = Math.floor(left / TILE_SIZE); x <= Math.ceil((left + width) / TILE_SIZE) - 1; x++) {
    for (let y = Math.floor(top / TILE_SIZE); y <= Math.ceil((top + height) / TILE_SIZE) - 1; y++) {
      if (y < 0 || y >= count) continue;
      tiles.push({ key: `${view.zoom}/${x}/${y}`, z: view.zoom, x: ((x % count) + count) % count, y, left: x * TILE_SIZE - left, top: y * TILE_SIZE - top });
    }
  }
  return tiles;
}
