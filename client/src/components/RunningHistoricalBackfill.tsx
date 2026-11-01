import { useState, type ReactNode } from "react";
import { CloudSun, DatabaseZap, Loader2, MapPinned, RefreshCw, Route, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { todayHKString } from "@/lib/hkTime";

const ROUTE_TYPES = [
  { value: "Road", label: "公路" },
  { value: "Track", label: "跑道" },
  { value: "Trail", label: "越野" },
  { value: "Treadmill", label: "跑步機" },
  { value: "Mixed", label: "混合路線" },
];

export default function RunningHistoricalBackfill() {
  const utils = trpc.useUtils();
  const [scope, setScope] = useState<"logs" | "races" | "both">("both");
  const [startDate, setStartDate] = useState("2020-01-01");
  const [endDate, setEndDate] = useState(todayHKString());
  const [routeType, setRouteType] = useState("__skip__");
  const [location, setLocation] = useState("香港");
  const [time, setTime] = useState("07:00");
  const [overwriteRouteType, setOverwriteRouteType] = useState(false);
  const [overwriteWeather, setOverwriteWeather] = useState(false);
  const [useRecordLocation, setUseRecordLocation] = useState(true);
  const [preview, setPreview] = useState<any>(null);

  const buildPreviewPayload = () => ({
    scope,
    startDate,
    endDate,
    routeType: routeType === "__skip__" ? undefined : routeType as "Road" | "Track" | "Trail" | "Treadmill" | "Mixed",
    overwriteRouteType,
    overwriteWeather,
  });

  const previewMutation = trpc.running.previewHistoricalBackfill.useMutation({
    onSuccess: (result) => {
      setPreview(result);
      toast.success(`已預覽 ${result.total} 筆可回填資料`);
    },
    onError: (error) => toast.error(`無法預覽：${error.message}`),
  });
  const applyMutation = trpc.running.applyHistoricalBackfill.useMutation({
    onSuccess: async (result) => {
      await Promise.all([
        utils.running.getLogs.invalidate(),
        utils.running.getRaces.invalidate(),
        utils.running.getRacesEnriched.invalidate(),
        utils.running.getStats.invalidate(),
        utils.running.getShoePerformance.invalidate(),
        utils.running.getLabPersonalization.invalidate(),
      ]);
      setPreview(null);
      toast.success(`已完成：${result.routeTypeUpdates} 筆路線、${result.weatherUpdates} 筆天氣資料已回填`);
      if (result.skippedNoData || result.failures.length) {
        toast.message(`略過 ${result.skippedNoData + result.failures.length} 筆沒有可用歷史資料或更新失敗的項目`);
      }
    },
    onError: (error) => toast.error(`回填失敗：${error.message}`),
  });

  const previewBackfill = () => {
    if (startDate > endDate) return toast.error("開始日期不可晚於結束日期");
    if (routeType === "__skip__" && !overwriteWeather) {
      return toast.error("請至少選擇一種路線類型，或啟用天氣資料回填。 ");
    }
    previewMutation.mutate(buildPreviewPayload());
  };

  const applyBackfill = () => {
    if (!preview?.total) return;
    applyMutation.mutate({ ...buildPreviewPayload(), location: location.trim() || "香港", time, useRecordLocation });
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-200/70 bg-gradient-to-br from-cyan-50 via-white to-sky-50 shadow-sm dark:border-cyan-400/15 dark:from-cyan-950/30 dark:via-card dark:to-slate-950/30">
      <div className="flex flex-col gap-4 border-b border-cyan-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between dark:border-cyan-400/10">
        <div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-300"><DatabaseZap className="h-5 w-5" /></span><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-600 dark:text-cyan-300">HISTORICAL DATA CARE</p><h3 className="mt-0.5 font-bold text-foreground">歷史路線與天氣回填</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">先預覽，再回填。預設只補齊缺失欄位，不會覆寫你的手動紀錄；日期一律按香港時間處理。</p></div></div>
        <span className="w-fit rounded-full border border-emerald-300/60 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"><ShieldCheck className="mr-1 inline h-3.5 w-3.5" />預覽優先</span>
      </div>

      <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
        <Field label="資料範圍"><Select value={scope} onValueChange={(value) => { setScope(value as typeof scope); setPreview(null); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="both">跑步紀錄 + 賽事</SelectItem><SelectItem value="logs">只回填跑步紀錄</SelectItem><SelectItem value="races">只回填賽事</SelectItem></SelectContent></Select></Field>
        <Field label="開始日期（香港）"><Input type="date" value={startDate} max={endDate} onChange={(event) => { setStartDate(event.target.value); setPreview(null); }} /></Field>
        <Field label="結束日期（香港）"><Input type="date" value={endDate} max={todayHKString()} min={startDate} onChange={(event) => { setEndDate(event.target.value); setPreview(null); }} /></Field>
        <Field label="缺漏路線類型"><Select value={routeType} onValueChange={(value) => { setRouteType(value); setPreview(null); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__skip__">不更改路線類型</SelectItem>{ROUTE_TYPES.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></Field>
      </div>

      <div className="grid gap-3 border-y border-cyan-100 bg-cyan-50/40 p-5 md:grid-cols-3 dark:border-cyan-400/10 dark:bg-cyan-950/10">
        <Field label="歷史天氣地點"><div className="relative"><MapPinned className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-600 dark:text-cyan-300" /><Input className="pl-9" value={location} onChange={(event) => { setLocation(event.target.value); setPreview(null); }} placeholder="香港" /></div></Field>
        <Field label="參考時間（香港）"><Input type="time" value={time} onChange={(event) => { setTime(event.target.value); setPreview(null); }} /></Field>
        <div className="rounded-xl border border-cyan-200/80 bg-white/80 px-3 py-2.5 text-xs text-muted-foreground dark:border-cyan-400/10 dark:bg-slate-950/35"><CloudSun className="mr-1.5 inline h-4 w-4 text-cyan-600 dark:text-cyan-300" />使用 Open‑Meteo 逐小時歷史資料，會記錄天氣狀況、體感溫度、濕度、風速及降雨量。</div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 px-5 py-4 text-xs text-foreground">
        <Toggle checked={overwriteRouteType} onChange={(checked) => { setOverwriteRouteType(checked); setPreview(null); }} label="覆寫既有路線類型" disabled={routeType === "__skip__"} />
        <Toggle checked={overwriteWeather} onChange={(checked) => { setOverwriteWeather(checked); setPreview(null); }} label="覆寫既有天氣欄位" />
        <Toggle checked={useRecordLocation} onChange={(checked) => { setUseRecordLocation(checked); setPreview(null); }} label="賽事優先使用其已記錄地點" />
      </div>

      {preview && <div className="mx-5 mb-4 grid gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm dark:border-amber-300/15 dark:bg-amber-400/10 sm:grid-cols-5"><Summary value={preview.total} label="可更新" /><Summary value={preview.routeTypeUpdates} label="路線類型" /><Summary value={preview.weatherUpdates} label="天氣資料" /><Summary value={preview.selectedRaces} label="賽事" /><Summary value={preview.skippedFuture} label="未來日期略過" /><p className="sm:col-span-5 mt-1 text-xs text-amber-800 dark:text-amber-100">確認後才會寫入。範例：{preview.samples?.slice(0, 3).map((sample: any) => `${sample.kind === "log" ? "跑步" : "賽事"} ${sample.date}`).join(" · ") || "沒有符合條件的資料"}</p></div>}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-cyan-100 bg-white/70 px-5 py-4 dark:border-cyan-400/10 dark:bg-card/50"><Button type="button" variant="outline" onClick={previewBackfill} disabled={previewMutation.isPending || applyMutation.isPending}>{previewMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}預覽回填</Button><Button type="button" onClick={applyBackfill} disabled={!preview?.total || applyMutation.isPending} className="bg-cyan-600 text-white hover:bg-cyan-700 dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300">{applyMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Route className="mr-1.5 h-4 w-4" />}確認套用 {preview?.total ? `(${preview.total})` : ""}</Button></div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1.5 text-xs font-semibold text-foreground"><span>{label}</span>{children}</label>;
}

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean }) {
  return <label className={`flex items-center gap-2 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-border accent-cyan-600" />{label}</label>;
}

function Summary({ value, label }: { value: number; label: string }) {
  return <div><p className="text-lg font-bold text-amber-800 dark:text-amber-100">{value}</p><p className="text-[11px] font-medium text-amber-700/80 dark:text-amber-100/70">{label}</p></div>;
}
