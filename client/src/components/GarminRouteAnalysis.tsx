import { useCallback, useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, MapPinned, Mountain, Route, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MapView } from "@/components/Map";
import GarminRouteTileMap from "@/components/GarminRouteTileMap";
import { analyzeRoute, type GradientBand } from "@shared/routeAnalysis";
import { cn } from "@/lib/utils";

const BAND_STYLE: Record<GradientBand, { dot: string; bar: string; text: string }> = {
  "陡下坡": { dot: "bg-sky-600", bar: "bg-sky-500", text: "text-sky-700 dark:text-sky-300" },
  "下坡": { dot: "bg-cyan-500", bar: "bg-cyan-500", text: "text-cyan-700 dark:text-cyan-300" },
  "平路": { dot: "bg-slate-400", bar: "bg-slate-400", text: "text-slate-700 dark:text-slate-300" },
  "上坡": { dot: "bg-amber-500", bar: "bg-amber-500", text: "text-amber-700 dark:text-amber-300" },
  "陡上坡": { dot: "bg-rose-600", bar: "bg-rose-500", text: "text-rose-700 dark:text-rose-300" },
};

function formatKm(value: number) {
  return `${value.toFixed(value < 10 ? 1 : 0)} km`;
}

function formatSigned(value: number | null, suffix: string) {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}${suffix}`;
}

function RouteMap({ points }: { points: Array<{ latitude: number; longitude: number }> }) {
  const initialCenter = useMemo(() => ({ lat: points[0].latitude, lng: points[0].longitude }), [points]);

  const onMapReady = useCallback((map: google.maps.Map) => {
    if (!window.google?.maps) return;
    const bounds = new window.google.maps.LatLngBounds();
    const path = points.map((point) => {
      const position = { lat: point.latitude, lng: point.longitude };
      bounds.extend(position);
      return position;
    });
    const line = new window.google.maps.Polyline({
      map,
      path,
      geodesic: true,
      strokeColor: "#0f9a8c",
      strokeOpacity: 0.95,
      strokeWeight: 5,
      clickable: false,
    });
    const start = new window.google.maps.Marker({ map, position: path[0], title: "起點", label: { text: "起", color: "#ffffff", fontWeight: "700" } });
    const end = new window.google.maps.Marker({ map, position: path[path.length - 1], title: "終點", label: { text: "終", color: "#ffffff", fontWeight: "700" } });
    if (path.length > 1) map.fitBounds(bounds, 28);
    return () => { line.setMap(null); start.setMap(null); end.setMap(null); };
  }, [points]);

  return <MapView initialCenter={initialCenter} initialZoom={15} onMapReady={onMapReady} fallback={<GarminRouteTileMap points={points} />} className="h-[320px] overflow-hidden rounded-xl" />;
}

function ElevationTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: { distanceKm?: number; altitudeM?: number; gradePct?: number | null } }> }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-lg border border-border bg-popover/95 px-3 py-2 text-xs text-popover-foreground shadow-lg backdrop-blur">
      <p className="font-semibold text-foreground">{point.distanceKm?.toFixed(2) ?? "—"} km</p>
      {point.altitudeM !== undefined && <p className="mt-1 text-muted-foreground">海拔 <span className="font-semibold text-foreground">{point.altitudeM.toFixed(1)} m</span></p>}
      {point.gradePct !== null && point.gradePct !== undefined && <p className="text-muted-foreground">即時坡度 <span className="font-semibold text-foreground">{formatSigned(point.gradePct, "%")}</span></p>}
    </div>
  );
}

export default function GarminRouteAnalysis({
  timeSeries,
  className,
}: {
  timeSeries: Array<Record<string, unknown>>;
  className?: string;
}) {
  const analysis = useMemo(() => analyzeRoute(timeSeries), [timeSeries]);
  const elevationData = useMemo(() => {
    if (!analysis) return [];
    return analysis.points.map((point, index) => {
      const previous = analysis.points[index - 1];
      const distanceM = previous ? Math.max(0, (point.distanceKm - previous.distanceKm) * 1000) : 0;
      const gradePct = previous?.altitudeM !== undefined && point.altitudeM !== undefined && distanceM > 0
        ? Number(((point.altitudeM - previous.altitudeM) / distanceM * 100).toFixed(1))
        : null;
      return { distanceKm: point.distanceKm, altitudeM: point.altitudeM, gradePct };
    });
  }, [analysis]);
  const mapPoints = useMemo(() => analysis?.points.map(point => ({ latitude: point.latitude, longitude: point.longitude })) ?? [], [analysis]);

  if (!analysis) {
    return (
      <section className={cn("rounded-2xl border border-dashed border-border bg-muted/20 px-5 py-7 text-center", className)}>
        <MapPinned className="mx-auto h-7 w-7 text-muted-foreground/70" aria-hidden="true" />
        <h3 className="mt-2 text-sm font-bold text-foreground">此原始檔尚未包含可用 GPS 路線</h3>
        <p className="mx-auto mt-1 max-w-xl text-xs leading-5 text-muted-foreground">請匯入含經緯度的 Garmin FIT、CSV、GPX 或 TCX 活動檔；路線地圖與坡度分段會在核對資料後自動出現。</p>
      </section>
    );
  }

  const hasElevation = elevationData.some(point => point.altitudeM !== undefined);
  const visibleSegments = analysis.segments.slice(0, 12);

  return (
    <section className={cn("@container overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm", className)}>
      <header className="border-b border-border bg-gradient-to-br from-emerald-500/12 via-transparent to-sky-500/10 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"><Route className="h-5 w-5" aria-hidden="true" /></span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">GPX Route Intelligence</p>
              <h3 className="mt-0.5 text-base font-bold text-foreground">路線地圖與坡度分段分析</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">由已核對的 Garmin GPS 與海拔樣本計算；地圖為原始路線，並不以道路導航結果取代。</p>
            </div>
          </div>
          <Badge variant="outline" className="w-fit border-emerald-300/70 bg-card/70 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200">{analysis.points.length.toLocaleString()} 個 GPS 點</Badge>
        </div>
      </header>

      <div className="grid gap-3 border-b border-border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-5">
        <div className="rounded-xl border border-border bg-card p-3"><p className="text-[11px] text-muted-foreground">GPS 路線距離</p><p className="mt-1 text-lg font-bold tabular-nums text-foreground">{formatKm(analysis.totalDistanceKm)}</p></div>
        <div className="rounded-xl border border-border bg-card p-3"><p className="text-[11px] text-muted-foreground">累積爬升</p><p className="mt-1 flex items-center gap-1 text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300"><ArrowUpRight className="h-4 w-4" />{analysis.ascentM.toFixed(0)} m</p></div>
        <div className="rounded-xl border border-border bg-card p-3"><p className="text-[11px] text-muted-foreground">累積下降</p><p className="mt-1 flex items-center gap-1 text-lg font-bold tabular-nums text-sky-700 dark:text-sky-300"><ArrowDownRight className="h-4 w-4" />{analysis.descentM.toFixed(0)} m</p></div>
        <div className="rounded-xl border border-border bg-card p-3"><p className="text-[11px] text-muted-foreground">最大坡度</p><p className="mt-1 text-lg font-bold tabular-nums text-foreground">{formatSigned(analysis.maxUphillPct, "%")} <span className="text-xs font-medium text-muted-foreground">／ {formatSigned(analysis.maxDownhillPct, "%")}</span></p></div>
      </div>

      <div className="grid grid-cols-1 gap-5 p-4 sm:p-5 @3xl:grid-cols-[1.05fr_0.95fr]">
        <div className="overflow-hidden rounded-xl border border-border bg-muted/15 p-1">
          <RouteMap points={mapPoints} />
          <p className="px-3 pb-2 pt-2 text-[11px] text-muted-foreground"><span className="font-semibold text-emerald-700 dark:text-emerald-300">起</span> 至 <span className="font-semibold text-emerald-700 dark:text-emerald-300">終</span>：顯示已上載的 GPS 原始座標。</p>
        </div>

        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2"><Mountain className="h-4 w-4 text-emerald-600 dark:text-emerald-300" /><h4 className="text-sm font-bold text-foreground">海拔剖面</h4><span className="text-xs text-muted-foreground">按距離</span></div>
          {hasElevation ? (
            <div className="h-[280px]" role="img" aria-label="按距離顯示的路線海拔剖面圖">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={elevationData} margin={{ top: 12, right: 8, bottom: 0, left: -16 }}>
                  <defs><linearGradient id="routeElevationFill" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.45} /><stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0.04} /></linearGradient></defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="distanceKm" type="number" domain={["dataMin", "dataMax"]} minTickGap={45} tickFormatter={(value: number) => `${value.toFixed(1)}k`} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} dy={7} />
                  <YAxis dataKey="altitudeM" tickFormatter={(value: number) => `${Math.round(value)}m`} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip content={<ElevationTooltip />} cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "4 4" }} isAnimationActive={false} />
                  <Area type="monotone" dataKey="altitudeM" stroke="var(--chart-2)" strokeWidth={2.5} fill="url(#routeElevationFill)" connectNulls isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="flex h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 text-center"><Mountain className="h-7 w-7 text-muted-foreground/60" /><p className="mt-2 text-sm font-semibold text-foreground">原始檔未含海拔資料</p><p className="mt-1 text-xs leading-5 text-muted-foreground">路線地圖仍可使用；匯入含 altitude／elevation 的 Garmin 記錄後，即可取得坡度分析。</p></div>}
        </div>
      </div>

      <div className="border-t border-border p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h4 className="text-sm font-bold text-foreground">坡度分布</h4><p className="mt-0.5 text-xs text-muted-foreground">按可用海拔 GPS 點的路線距離分類</p></div><div className="flex items-center gap-1.5 text-xs text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" />上坡正值　<TrendingDown className="h-3.5 w-3.5" />下坡負值</div></div>
        {hasElevation ? <div className="grid gap-2 sm:grid-cols-5">{analysis.gradientDistribution.map(item => { const style = BAND_STYLE[item.band]; return <div key={item.band} className="rounded-xl border border-border bg-muted/20 p-2.5"><div className="flex items-center gap-1.5"><span className={cn("h-2 w-2 rounded-full", style.dot)} /><p className={cn("text-xs font-bold", style.text)}>{item.band}</p></div><p className="mt-2 text-base font-bold tabular-nums text-foreground">{item.distanceKm.toFixed(2)} <span className="text-[11px] font-medium text-muted-foreground">km</span></p><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", style.bar)} style={{ width: `${Math.max(0, Math.min(100, item.sharePct))}%` }} /></div><p className="mt-1 text-[11px] tabular-nums text-muted-foreground">{item.sharePct.toFixed(0)}%</p></div>; })}</div> : <p className="rounded-xl bg-muted/30 px-3 py-3 text-xs text-muted-foreground">尚未能計算坡度分布，因為這筆活動沒有海拔樣本。</p>}
      </div>

      <div className="border-t border-border p-4 sm:p-5">
        <div className="mb-3"><h4 className="text-sm font-bold text-foreground">距離分段坡度</h4><p className="mt-0.5 text-xs text-muted-foreground">每約 1 公里彙總高度變化與平均坡度；不足 1 公里的最後一段會保留。</p></div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{visibleSegments.map(segment => {
          const style = segment.band === "未有海拔" ? { dot: "bg-muted-foreground", text: "text-muted-foreground" } : BAND_STYLE[segment.band];
          return <div key={segment.index} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/15 px-3 py-2.5"><div className="flex min-w-0 items-center gap-2"><span className={cn("h-2 w-2 shrink-0 rounded-full", style.dot)} /><div><p className="text-xs font-bold text-foreground">{segment.startKm.toFixed(1)}–{segment.endKm.toFixed(1)} km</p><p className={cn("mt-0.5 text-[11px] font-medium", style.text)}>{segment.band}</p></div></div><div className="text-right text-xs tabular-nums"><p className="font-bold text-foreground">{formatSigned(segment.gradePct, "%")}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{formatSigned(segment.elevationChangeM, " m")}</p></div></div>;
        })}</div>
        {analysis.segments.length > visibleSegments.length && <p className="mt-3 text-xs text-muted-foreground">為保持畫面清晰，顯示首 12 個分段（共 {analysis.segments.length} 段）。海拔剖面仍包含全程資料。</p>}
      </div>
    </section>
  );
}
