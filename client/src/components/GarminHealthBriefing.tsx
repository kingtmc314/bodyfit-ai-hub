import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Database,
  Flame,
  Footprints,
  Gauge,
  Heart,
  MapPin,
  Moon,
  Scale,
  TriangleAlert,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import GarminTimeSeriesChart from "@/components/GarminTimeSeriesChart";

type BriefData = any;

const number = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatPace = (seconds: number | null | undefined) => {
  if (!seconds || seconds <= 0) return "—";
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
};

const formatHKDate = (value: unknown) => {
  if (typeof value !== "string" || !value) return "—";
  const date = new Date(`${value.slice(0, 10)}T12:00:00+08:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("zh-HK", { timeZone: "Asia/Hong_Kong", month: "short", day: "numeric" });
};

const toSamples = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value)
    ? value.filter((sample): sample is Record<string, unknown> => typeof sample === "object" && sample !== null && !Array.isArray(sample))
    : [];

function MetricCard({ label, value, unit, Icon, accent = "text-orange-600 dark:text-orange-300", note }: {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  Icon: typeof Activity;
  accent?: string;
  note?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-muted ${accent}`}><Icon className="h-4.5 w-4.5" /></div>
        {note && <span className="max-w-28 text-right text-[10px] leading-4 text-muted-foreground">{note}</span>}
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">{value ?? "—"}{unit && value != null && <span className="ml-1 text-xs font-semibold text-muted-foreground">{unit}</span>}</p>
    </div>
  );
}

function ChartShell({ title, description, children, className = "" }: { title: string; description: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm ${className}`}>
      <header className="border-b border-border bg-gradient-to-br from-orange-500/8 via-transparent to-teal-500/8 px-4 py-4 sm:px-5">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </header>
      {children}
    </section>
  );
}

function EmptyChart({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-52 items-center justify-center px-5 py-8 text-center text-xs leading-5 text-muted-foreground">{children}</div>;
}

export default function GarminHealthBriefing({ data, isLoading }: { data: BriefData | undefined; isLoading?: boolean }) {
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const runsWithSeries = useMemo(() => (data?.runs ?? []).filter((run: any) => run.hasTimeSeries), [data]);

  useEffect(() => {
    if (!runsWithSeries.length) {
      setSelectedRunId("");
      return;
    }
    if (!runsWithSeries.some((run: any) => String(run.id) === selectedRunId)) setSelectedRunId(String(runsWithSeries[0].id));
  }, [runsWithSeries, selectedRunId]);

  const detailQuery = trpc.running.getGarminRunDetail.useQuery(
    { id: Number(selectedRunId || 0) },
    { enabled: Boolean(selectedRunId) },
  );
  const overview = data?.overview;
  const quality = data?.dataQuality;
  const runs = data?.runs ?? [];
  const hasRuns = runs.length > 0;
  const trend = data?.heartRate?.trend ?? [];
  const dynamics = data?.dynamics ?? [];
  const trainingLoad = data?.trainingLoad ?? [];
  const selectedRun = runsWithSeries.find((run: any) => String(run.id) === selectedRunId);
  const samples = toSamples(detailQuery.data?.time_series);
  const allDynamicsAvailable = {
    cadence: quality?.cadenceRunCount ?? 0,
    stride: runs.filter((run: any) => number(run.avgStrideLengthM) !== null).length,
    vertical: runs.filter((run: any) => number(run.avgVerticalRatio) !== null || number(run.verticalOscillationCm) !== null).length,
    ground: runs.filter((run: any) => number(run.avgGroundContactTimeMs) !== null).length,
  };

  if (isLoading) {
    return <div className="grid gap-4 md:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl border border-border bg-muted/50" />)}</div>;
  }

  if (!hasRuns) {
    return (
      <section className="rounded-2xl border border-dashed border-orange-300/80 bg-gradient-to-br from-orange-50/80 via-card to-teal-50/50 px-5 py-12 text-center dark:border-orange-400/30 dark:from-orange-950/15 dark:to-teal-950/10">
        <Activity className="mx-auto h-9 w-9 text-orange-600 dark:text-orange-300" />
        <h3 className="mt-3 text-lg font-bold text-foreground">尚未有可製作簡報的跑步數據</h3>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">完成跑步紀錄或匯入 Garmin FIT、CSV、GPX、TCX 原始檔後，這裡會自動匯總訓練、心率、跑姿、恢復與資料完整度。所有數據均來自已儲存紀錄。</p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-teal-400/25 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-5 text-white shadow-lg sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-teal-200"><Activity className="h-4 w-4" /> Garmin Health Brief</div>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight">跑步健康數據簡報</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">整合所有已儲存跑步、心率、睡眠及身體成份資料；僅呈現實測數字，不以缺少的 Garmin 指標作推算。</p>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-slate-200">
            <p className="font-semibold text-white">資料範圍</p>
            <p className="mt-1 tabular-nums">{data?.period?.from ? formatHKDate(data.period.from) : "—"} 至 {data?.period?.to ? formatHKDate(data.period.to) : "—"}</p>
            <p className="mt-1 text-[11px] text-slate-400">香港時間 · 完整歷史彙總</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="跑步次數" value={overview?.totalRuns} unit="次" Icon={Footprints} note="完整歷史" />
        <MetricCard label="累積距離" value={number(overview?.totalDistanceKm)?.toFixed(1)} unit="km" Icon={MapPin} accent="text-teal-600 dark:text-teal-300" />
        <MetricCard label="平均配速" value={formatPace(number(overview?.averagePaceSecPerKm))} unit="／km" Icon={Activity} accent="text-sky-600 dark:text-sky-300" />
        <MetricCard label="平均心率" value={number(overview?.averageHeartRate)?.toFixed(0)} unit="bpm" Icon={Heart} accent="text-rose-600 dark:text-rose-300" />
        <MetricCard label="平均步頻" value={number(overview?.averageCadence)?.toFixed(0)} unit="spm" Icon={Gauge} accent="text-violet-600 dark:text-violet-300" />
        <MetricCard label="記錄卡路里" value={number(overview?.totalCalories)?.toLocaleString()} unit="kcal" Icon={Flame} accent="text-amber-600 dark:text-amber-300" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartShell title="訓練負荷與距離" description="按月匯總的已記錄距離、跑步次數及卡路里；不混入模擬值。">
          {trainingLoad.length >= 1 ? <div className="h-64 p-4 sm:p-5"><ResponsiveContainer width="100%" height="100%"><BarChart data={trainingLoad} margin={{ top: 6, right: 6, bottom: 0, left: -16 }}><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="week" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} /><YAxis yAxisId="distance" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} /><YAxis yAxisId="runs" orientation="right" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar yAxisId="distance" dataKey="distanceKm" name="距離（km）" fill="#f97316" radius={[5, 5, 0, 0]} /><Bar yAxisId="runs" dataKey="runs" name="跑步次數" fill="#0f9a8c" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyChart>尚未有足夠的日期及距離資料可建立訓練負荷趨勢。</EmptyChart>}
        </ChartShell>

        <ChartShell title="心率與配速趨勢" description="最近 24 次含實測心率／配速的跑步；配速圖軸已反轉，越上代表越快。">
          {trend.some((point: any) => point.averageHeartRate !== null || point.paceSecPerKm !== null) ? <div className="h-64 p-4 sm:p-5"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend} margin={{ top: 6, right: 8, bottom: 0, left: -16 }}><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={formatHKDate} minTickGap={38} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} /><YAxis yAxisId="pace" reversed tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(value) => formatPace(Number(value))} /><YAxis yAxisId="hr" orientation="right" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} /><Tooltip labelFormatter={formatHKDate} formatter={(value: number, name: string) => [name === "配速" ? `${formatPace(Number(value))}／km` : `${Math.round(Number(value))} bpm`, name]} /><Legend wrapperStyle={{ fontSize: 11 }} /><Line yAxisId="pace" type="monotone" dataKey="paceSecPerKm" name="配速" stroke="#38bdf8" strokeWidth={2.5} dot={false} connectNulls /><Line yAxisId="hr" type="monotone" dataKey="averageHeartRate" name="平均心率" stroke="#f43f5e" strokeWidth={2.5} dot={false} connectNulls /></LineChart></ResponsiveContainer></div> : <EmptyChart>尚未有足夠的平均心率或配速資料可建立實測趨勢。</EmptyChart>}
        </ChartShell>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <ChartShell title="心率區間時間分布" description="採用心跳管理頁中已儲存的各區間分鐘數；不會以每次跑步平均心率假裝成區間時間。">
          {data?.heartRate?.zoneMinuteCount ? <div className="h-60 p-4 sm:p-5"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.heartRate.zones} margin={{ top: 6, right: 6, bottom: 0, left: -16 }}><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="zone" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} /><Tooltip formatter={(value: number, _name: string, item: any) => [`${Number(value).toLocaleString()} 分鐘（${item.payload?.pct ?? 0}%）`, "記錄時間"]} /><Bar dataKey="minutes" name="區間分鐘" fill="#f43f5e" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyChart>尚未有已儲存的心率區間分鐘資料。可在心跳管理頁輸入 Garmin 的 Zone 1–5 時間，這裡便會自動整合。</EmptyChart>}
        </ChartShell>
        <ChartShell title="跑姿與效率趨勢" description="以每次跑步的摘要數據呈現；不同量綱分開顯示，避免把步頻、步幅及接觸時間混成同一尺度。">
          {(allDynamicsAvailable.cadence || allDynamicsAvailable.stride || allDynamicsAvailable.vertical || allDynamicsAvailable.ground) ? <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5"><div className="rounded-xl border border-border bg-muted/20 p-3"><p className="text-xs font-semibold text-foreground">步頻與步幅</p><div className="mt-3 h-40"><ResponsiveContainer width="100%" height="100%"><LineChart data={dynamics}><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={formatHKDate} minTickGap={28} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} /><YAxis yAxisId="cadence" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} /><YAxis yAxisId="stride" orientation="right" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} /><Line yAxisId="cadence" dataKey="cadence" name="步頻" stroke="#8b5cf6" dot={false} connectNulls /><Line yAxisId="stride" dataKey="strideLengthM" name="步幅" stroke="#0f9a8c" dot={false} connectNulls /></LineChart></ResponsiveContainer></div></div><div className="rounded-xl border border-border bg-muted/20 p-3"><p className="text-xs font-semibold text-foreground">垂直動作與接觸</p><div className="mt-3 h-40"><ResponsiveContainer width="100%" height="100%"><LineChart data={dynamics}><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={formatHKDate} minTickGap={28} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} /><Line dataKey="verticalRatioPct" name="垂直比" stroke="#f97316" dot={false} connectNulls /><Line dataKey="groundContactTimeMs" name="接觸時間" stroke="#f43f5e" dot={false} connectNulls /></LineChart></ResponsiveContainer></div></div><div className="sm:col-span-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground md:grid-cols-4"><span>步頻：<b className="text-foreground">{allDynamicsAvailable.cadence}</b> 次</span><span>步幅：<b className="text-foreground">{allDynamicsAvailable.stride}</b> 次</span><span>垂直資料：<b className="text-foreground">{allDynamicsAvailable.vertical}</b> 次</span><span>接觸時間：<b className="text-foreground">{allDynamicsAvailable.ground}</b> 次</span></div></div> : <EmptyChart>原始資料尚未提供步頻、步幅、垂直動作或接觸時間。可匯入 Garmin FIT／CSV／GPX／TCX 補充可用欄位。</EmptyChart>}
        </ChartShell>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartShell title="恢復脈絡：睡眠與身體電量" description="最近 30 筆已儲存睡眠紀錄。這是訓練觀察脈絡，不構成醫療判讀。">
          {data?.recovery?.sleep?.some((point: any) => point.sleepScore !== null || point.bodyBattery !== null || point.hrv !== null) ? <div className="h-60 p-4 sm:p-5"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.recovery.sleep} margin={{ top: 6, right: 6, bottom: 0, left: -16 }}><defs><linearGradient id="garminBriefSleep" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="#0f9a8c" stopOpacity={0.45} /><stop offset="95%" stopColor="#0f9a8c" stopOpacity={0.03} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={formatHKDate} minTickGap={38} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} /><Tooltip labelFormatter={formatHKDate} /><Legend wrapperStyle={{ fontSize: 11 }} /><Area dataKey="sleepScore" name="睡眠分數" type="monotone" stroke="#0f9a8c" fill="url(#garminBriefSleep)" connectNulls /><Line dataKey="bodyBattery" name="身體電量" type="monotone" stroke="#f97316" dot={false} connectNulls /></AreaChart></ResponsiveContainer></div> : <EmptyChart>尚未有睡眠分數、身體電量或 HRV 資料可建立恢復趨勢。</EmptyChart>}
        </ChartShell>
        <ChartShell title="恢復脈絡：靜息心率與體重" description="分別以心跳及身體成份紀錄呈現，讓量測日期保持透明。">
          {(data?.recovery?.heart?.length || data?.recovery?.body?.length) ? <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5"><div className="rounded-xl border border-border bg-muted/20 p-3"><p className="text-xs font-semibold text-foreground">靜息心率</p><div className="mt-3 h-40"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.recovery.heart}><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={formatHKDate} minTickGap={28} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} /><Line dataKey="restingHr" name="靜息心率" stroke="#f43f5e" dot={false} connectNulls /></LineChart></ResponsiveContainer></div></div><div className="rounded-xl border border-border bg-muted/20 p-3"><p className="text-xs font-semibold text-foreground">體重（kg）</p><div className="mt-3 h-40"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.recovery.body}><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={formatHKDate} minTickGap={28} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} /><Line dataKey="weightKg" name="體重" stroke="#8b5cf6" dot={false} connectNulls /></LineChart></ResponsiveContainer></div></div></div> : <EmptyChart>尚未有睡眠、靜息心率或身體成份恢復脈絡資料。</EmptyChart>}
        </ChartShell>
      </div>

      <ChartShell title="單次 Garmin 原始數據曲線" description="選擇一筆含 Garmin time-series 的跑步，檢視實測配速、心率、步頻、功率、海拔，以及已保存的 GPS 路線與坡度分析。">
        {runsWithSeries.length ? <div className="space-y-4 p-4 sm:p-5"><div className="max-w-lg"><label className="mb-1.5 block text-xs font-semibold text-muted-foreground">選擇跑步紀錄</label><Select value={selectedRunId} onValueChange={setSelectedRunId}><SelectTrigger className="bg-card"><SelectValue placeholder="選擇含 Garmin 原始資料的跑步" /></SelectTrigger><SelectContent>{runsWithSeries.map((run: any) => <SelectItem key={run.id} value={String(run.id)}>{formatHKDate(run.date)} · {run.runningType ?? "未分類"} · {number(run.distanceKm)?.toFixed(1) ?? "—"} km{run.sourceFormat ? ` · ${run.sourceFormat}` : ""}</SelectItem>)}</SelectContent></Select></div>{detailQuery.isLoading ? <div className="h-72 animate-pulse rounded-2xl bg-muted/50" /> : <GarminTimeSeriesChart timeSeries={samples} runLabel={selectedRun ? `${formatHKDate(selectedRun.date)} · ${selectedRun.runningType ?? "跑步"}` : undefined} />}</div> : <EmptyChart>已有跑步摘要，但暫未保存任何逐秒時間序列。使用 FIT、CSV、GPX 或 TCX 原始檔匯入後，可在此查看實測曲線及路線。</EmptyChart>}
      </ChartShell>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <ChartShell title="資料來源與覆蓋率" description="每個項目皆顯示真實可用次數；空欄不會以零值代替。">
          <div className="grid grid-cols-2 gap-2 p-4 text-xs sm:grid-cols-3 sm:p-5">
            {[{ label: "Garmin 原始／逐秒", value: quality?.sourceRunCount, total: overview?.totalRuns, Icon: Database }, { label: "GPS 路線", value: quality?.gpsRunCount, total: overview?.totalRuns, Icon: MapPin }, { label: "功率", value: quality?.powerRunCount, total: overview?.totalRuns, Icon: Zap }, { label: "海拔", value: quality?.elevationRunCount, total: overview?.totalRuns, Icon: Activity }, { label: "睡眠紀錄", value: quality?.sleepRecordCount, Icon: Moon }, { label: "身體成份", value: quality?.bodyRecordCount, Icon: Scale }].map(({ label, value, total, Icon }) => <div key={label} className="rounded-xl border border-border bg-muted/20 p-3"><div className="flex items-center justify-between gap-2"><Icon className="h-3.5 w-3.5 text-muted-foreground" /><Badge variant="outline" className="h-5 px-1.5 text-[10px]">{value ?? 0}{total ? `/${total}` : " 筆"}</Badge></div><p className="mt-3 font-semibold text-foreground">{label}</p></div>)}
          </div>
        </ChartShell>
        <ChartShell title="觀察備註" description="以已儲存數據的相對變化作描述；不作醫療診斷、受傷風險或表現保證。">
          <div className="space-y-3 p-4 sm:p-5"><div className="flex gap-2 rounded-xl border border-amber-300/60 bg-amber-50/70 p-3 text-xs leading-5 text-amber-950 dark:border-amber-400/20 dark:bg-amber-950/15 dark:text-amber-100"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /><span>僅供訓練觀察；請按自身感受調整訓練，如有任何健康疑慮請諮詢合資格專業人士。</span></div>{(data?.observations ?? []).map((observation: string, index: number) => <div key={`${index}-${observation}`} className="flex gap-2 text-sm leading-6 text-muted-foreground"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />{observation}</div>)}</div>
        </ChartShell>
      </div>
    </div>
  );
}
