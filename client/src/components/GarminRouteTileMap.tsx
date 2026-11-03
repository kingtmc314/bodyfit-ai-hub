import { useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed, Minus, Plus, RotateCcw } from "lucide-react";
import { fitRouteViewport, MAX_ROUTE_ZOOM, MIN_ROUTE_ZOOM, projectRoute, ROUTE_MAP_HEIGHT, routeScreenPoint, TILE_SIZE, visibleRouteTiles, type RouteCoordinate, type RouteMapView } from "@shared/routeMapViewport";

/** Lightweight native map, not another SDK. Raw GPS stays in this page's SVG;
 * the basemap provider receives only normal visible tile requests, never the route.
 * https://operations.osmfoundation.org/policies/tiles/ — no prefetch/offline mode.
 */
export default function GarminRouteTileMap({ points }: { points: readonly RouteCoordinate[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [customView, setCustomView] = useState<RouteMapView | null>(null);
  const [tileStatus, setTileStatus] = useState<Record<string, "loaded" | "error">>({});
  const [tileAttempt, setTileAttempt] = useState(0);
  const drag = useRef<{ id: number; x: number; y: number; view: RouteMapView } | null>(null);
  const projected = useMemo(() => projectRoute(points), [points]);
  const fitted = useMemo(() => fitRouteViewport(projected, width, ROUTE_MAP_HEIGHT), [projected, width]);
  const view = customView ?? fitted;
  const tiles = useMemo(() => visibleRouteTiles(view, width, ROUTE_MAP_HEIGHT), [view, width]);
  const screenPoints = useMemo(() => projected.map(point => routeScreenPoint(point, view, width, ROUTE_MAP_HEIGHT)), [projected, view, width]);
  const path = useMemo(() => screenPoints.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" "), [screenPoints]);
  const first = screenPoints[0];
  const last = screenPoints.at(-1)!;
  const failed = tiles.filter(tile => tileStatus[tile.key] === "error").length;
  const loaded = tiles.some(tile => tileStatus[tile.key] === "loaded");

  useEffect(() => { setCustomView(null); }, [projected]);
  useEffect(() => {
    if (!container.current) return;
    const update = () => setWidth(Math.max(1, container.current?.clientWidth || 320));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  const zoom = (delta: number) => setCustomView({ ...view, zoom: Math.max(MIN_ROUTE_ZOOM, Math.min(MAX_ROUTE_ZOOM, view.zoom + delta)) });
  const controlClass = "flex h-9 w-9 items-center justify-center border-b border-border bg-card text-card-foreground last:border-b-0 hover:bg-muted disabled:opacity-40";
  return (
    <div ref={container} className="relative h-full w-full overflow-hidden bg-[#e8eee9] text-slate-900" data-route-basemap="openstreetmap"
      aria-label="GPS 路線備援地圖，可拖動並用按鈕縮放" role="region"
      style={{ touchAction: "none" }}
      onPointerDown={event => {
        if ((event.target as Element).closest("button,a") || !event.isPrimary || event.button !== 0) return;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, view };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        const start = drag.current;
        if (!start || start.id !== event.pointerId) return;
        const scale = 2 ** start.view.zoom;
        setCustomView({ zoom: start.view.zoom, center: { x: start.view.center.x - (event.clientX - start.x) / scale, y: Math.max(0, Math.min(TILE_SIZE, start.view.center.y - (event.clientY - start.y) / scale)) } });
      }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {tiles.map(tile => <img key={`${tileAttempt}/${tile.key}`} src={`https://tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png`} alt="" draggable={false} referrerPolicy="strict-origin-when-cross-origin"
          className="absolute select-none" style={{ left: tile.left, top: tile.top, width: TILE_SIZE, height: TILE_SIZE, maxWidth: "none" }}
          onLoad={() => setTileStatus(previous => ({ ...previous, [tile.key]: "loaded" }))}
          onError={() => setTileStatus(previous => ({ ...previous, [tile.key]: "error" }))} />)}
      </div>
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${width} ${ROUTE_MAP_HEIGHT}`} aria-label="已保存的原始 GPS 路線與起終點" role="img">
        <polyline points={path} fill="none" stroke="white" strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={path} fill="none" stroke="#078577" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
        {[{ point: first, label: "起", color: "#047857" }, { point: last, label: "終", color: "#c2410c" }].map(marker => <g key={marker.label} transform={`translate(${marker.point.x},${marker.point.y})`}><circle r="12" fill={marker.color} stroke="white" strokeWidth="2" /><text textAnchor="middle" dy="4" fill="white" fontSize="11" fontWeight="700">{marker.label}</text></g>)}
      </svg>
      <span className="absolute left-2 top-12 rounded-md bg-white/95 px-2 py-1 text-[10px] font-semibold shadow-sm">GPS 備援地圖</span>
      <div className="absolute right-2 top-12 overflow-hidden rounded-lg border border-border shadow-md">
        <button type="button" aria-label="放大路線地圖" className={controlClass} disabled={view.zoom >= MAX_ROUTE_ZOOM} onClick={() => zoom(1)}><Plus className="h-4 w-4" /></button>
        <button type="button" aria-label="縮小路線地圖" className={controlClass} disabled={view.zoom <= MIN_ROUTE_ZOOM} onClick={() => zoom(-1)}><Minus className="h-4 w-4" /></button>
        <button type="button" aria-label="顯示完整路線" className={controlClass} onClick={() => setCustomView(null)}><LocateFixed className="h-4 w-4" /></button>
      </div>
      {!loaded && !failed && <p role="status" className="absolute bottom-7 left-2 rounded bg-white/95 px-2 py-1 text-[11px]">正在載入街道底圖…</p>}
      {failed > 0 && <div role="status" className="absolute bottom-7 left-2 right-2 rounded-lg bg-white/95 p-2 text-[11px] shadow-sm"><p>{loaded ? "部分街道底圖未能載入" : "街道底圖暫時未能載入"}；GPS 路線仍然保留。</p><button type="button" className="mt-1 flex items-center gap-1 font-semibold text-emerald-800" onClick={() => { setTileStatus({}); setTileAttempt(n => n + 1); }}><RotateCcw className="h-3 w-3" />重試底圖</button></div>}
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="absolute bottom-0 right-0 bg-white/95 px-1.5 py-1 text-[10px] text-slate-700 underline">© OpenStreetMap contributors</a>
    </div>
  );
}
