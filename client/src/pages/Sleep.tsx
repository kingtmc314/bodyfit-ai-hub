import { useTranslation } from 'react-i18next';
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { todayHKString, formatHKChartDate, formatHKDate } from "@/lib/hkTime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Moon, Trash2, Edit2, Loader2, Upload } from "lucide-react";
import QuickImportModal from "@/components/QuickImportModal";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, LineChart, Line,
  ComposedChart, Bar, ReferenceLine
} from "recharts";

const QUALITY_OPTIONS = ["Poor", "Fair", "Good", "Excellent"] as const;
const QUALITY_COLORS: Record<string, string> = {
  Poor: "oklch(0.68 0.22 25)",
  Fair: "oklch(0.78 0.20 50)",
  Good: "oklch(0.72 0.19 160)",
  Excellent: "oklch(0.65 0.18 200)",
};

// Convert "HH:MM:SS" or "HH:MM" time string to decimal hours (0-24)
// Bedtime after midnight (e.g. 01:54) is treated as 25.9 so it appears above midnight line
function timeToDecimalHour(t: string | null | undefined, isBedtime = false): number | null {
  if (!t) return null;
  const parts = String(t).split(":");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const dec = h + m / 60;
  // Bedtime: if hour < 12 (e.g. 01:54 AM), treat as next-day → add 24
  if (isBedtime && h < 12) return dec + 24;
  return dec;
}

function decimalHourToLabel(v: number): string {
  const h = Math.floor(v % 24);
  const m = Math.round((v % 1) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-xl text-xs">
        <p className="text-muted-foreground mb-1">{label}</p>
        {payload.map((p: any) => {
          const isTime = p.name === "就寢時間" || p.name === "起床時間";
          const display = isTime && typeof p.value === "number"
            ? decimalHourToLabel(p.value)
            : typeof p.value === "number" ? p.value.toFixed(1) : p.value;
          return (
            <p key={p.name} style={{ color: p.color }} className="font-semibold">
              {p.name}: {display}
            </p>
          );
        })}
      </div>
    );
  }
  return null;
};

const defaultForm = {
  date: todayHKString(),
  score: "", restingHr: "", bodyBattery: "", pulseOx: "",
  respiration: "", hrv: "", quality: "Good" as const,
  duration: "", notes: ""
};

export default function Sleep() {
  const { t } = useTranslation();
  const [showDialog, setShowDialog] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editEntry, setEditEntry] = useState<any>(null);
  const [form, setForm] = useState<any>(defaultForm);

  const utils = trpc.useUtils();
  const { data: records = [], isLoading } = trpc.sleep.getAll.useQuery({ limit: 90 });
  const { data: goalsData } = trpc.goals.getGoals.useQuery();

  const checkGoalAchievement = (payload: Record<string, number | undefined>) => {
    const goals = goalsData ?? [];
    const checks = [
      { goalType: "sleep_score",    value: payload.score,    inverse: false, label: "Sleep Score",    unit: " pts" },
      { goalType: "sleep_duration", value: payload.duration, inverse: false, label: "Sleep Duration", unit: "h"   },
    ];
    checks.forEach(({ goalType, value, inverse, label, unit }) => {
      if (value == null) return;
      const goal = goals.find((g: any) => g.goalType === goalType);
      if (!goal) return;
      const target = Number(goal.targetValue);
      const hit = inverse ? value <= target : value >= target;
      if (hit) toast.success(`🎯 ${label} goal hit! ${value}${unit} ${inverse ? "≤" : "≥"} ${target}${unit}`, { duration: 5000 });
    });
  };

  const addMutation = trpc.sleep.add.useMutation({
    onSuccess: (_, vars) => {
      utils.sleep.getAll.invalidate();
      toast.success("Sleep logged!");
      checkGoalAchievement(vars as any);
      setShowDialog(false);
      setForm(defaultForm);
    },
    onError: () => toast.error("Failed to save"),
  });
  const updateMutation = trpc.sleep.update.useMutation({
    onSuccess: (_, vars) => {
      utils.sleep.getAll.invalidate();
      toast.success("Updated!");
      checkGoalAchievement(vars as any);
      setEditEntry(null);
      setShowDialog(false);
    },
  });
  const deleteMutation = trpc.sleep.delete.useMutation({
    onSuccess: () => { utils.sleep.getAll.invalidate(); toast.success("Deleted"); },
  });

  const toHrs = (v: number | null | undefined) =>
    v != null && v > 24 ? Math.round((v / 60) * 10) / 10 : v ?? null;

  // Chart data (chronological order)
  const chartData = [...records].reverse().map(r => ({
    date: formatHKChartDate(r.date),
    score: r.sleepScore ?? null,
    duration: toHrs(r.sleepDuration),
    battery: r.bodyBattery ?? null,
    hrv: r.hrv ?? null,
    restingHr: r.restingHr ?? null,
    pulseOx: r.pulseOx != null ? Number(r.pulseOx) : null,
    respiration: r.respiration != null ? Number(r.respiration) : null,
    bedtime: timeToDecimalHour(r.bedtime as any, true),
    waketime: timeToDecimalHour(r.waketime as any, false),
  }));

  const latest = records[0];

  const getQualityBadge = (q: string | null | undefined) => {
    if (!q) return null;
    return (
      <Badge
        style={{ background: QUALITY_COLORS[q] + "33", color: QUALITY_COLORS[q], borderColor: QUALITY_COLORS[q] + "66" }}
        variant="outline" className="text-xs"
      >{q}</Badge>
    );
  };

  const handleSubmit = () => {
    const payload = {
      date: form.date,
      score: form.score ? Number(form.score) : undefined,
      restingHr: form.restingHr ? Number(form.restingHr) : undefined,
      bodyBattery: form.bodyBattery ? Number(form.bodyBattery) : undefined,
      pulseOx: form.pulseOx ? Number(form.pulseOx) : undefined,
      respiration: form.respiration ? Number(form.respiration) : undefined,
      hrv: form.hrv ? Number(form.hrv) : undefined,
      quality: form.quality as any,
      duration: form.duration ? Number(form.duration) : undefined,
      notes: form.notes || undefined,
    };
    if (editEntry) {
      updateMutation.mutate({ id: editEntry.id, ...payload });
    } else {
      addMutation.mutate(payload);
    }
  };

  // Bedtime/Waketime chart: Y-axis ticks from 0 to 30 (0=midnight, 24=midnight next day)
  const sleepTimeTicks = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, oklch(0.62 0.18 270) 0%, oklch(0.62 0.18 230) 100%)' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-white">{t('sleep.title')}</h1>
            <p className="text-white/70 text-sm mt-0.5">{t('sleep.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-2 bg-white/20 border-white/40 text-white hover:bg-white/30" onClick={() => setShowImport(true)}>
              <Upload className="w-4 h-4" /> 匯入
            </Button>
            <Button size="sm" className="gap-2 bg-white text-primary hover:bg-white/90" onClick={() => { setEditEntry(null); setForm(defaultForm); setShowDialog(true); }}>
              <Plus className="w-4 h-4" /> {t('sleep.add_record')}
            </Button>
          </div>
        </div>
      </div>
      <QuickImportModal open={showImport} onClose={() => setShowImport(false)} dataType="sleep" onSuccess={() => utils.sleep.getAll.invalidate()} />

      {/* Latest Stats — 6 cards */}
      {latest && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "睡眠評分", value: latest.sleepScore, unit: "/100", sub: getQualityBadge(latest.sleepQuality), color: "icon-badge-blue" },
            { label: "睡眠時數", value: latest.sleepDuration != null ? `${toHrs(latest.sleepDuration)?.toFixed(1) ?? "—"}` : null, unit: "hrs", color: "icon-badge-purple" },
            { label: "HRV", value: latest.hrv, unit: "ms", color: "icon-badge-orange" },
            { label: "靜息心率", value: latest.restingHr, unit: "bpm", color: "icon-badge-red" },
            { label: "Body Battery", value: latest.bodyBattery, unit: "/100", color: "icon-badge-green" },
            { label: "血氧", value: latest.pulseOx != null ? Number(latest.pulseOx).toFixed(1) : null, unit: "%", color: "icon-badge-teal" },
          ].map(m => (
            <div key={m.label} className="stat-card rounded-2xl p-4">
              <div className={`icon-badge ${m.color} mb-2`}><Moon className="w-4 h-4" /></div>
              <p className="text-xs text-muted-foreground font-semibold">{m.label}</p>
              <p className="metric-value text-2xl text-foreground mt-0.5">
                {m.value ?? "—"} <span className="text-sm font-normal text-muted-foreground">{m.unit}</span>
              </p>
              {m.sub}
            </div>
          ))}
        </div>
      )}

      <Tabs defaultValue="charts">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="charts">{t('body.trend')}</TabsTrigger>
          <TabsTrigger value="log">{t('common.view_all')}</TabsTrigger>
        </TabsList>

        <TabsContent value="charts" className="mt-4 space-y-4">

          {/* 1. Sleep Score & Duration */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-foreground mb-1">睡眠評分 & 睡眠時數對比</h3>
            <p className="text-xs text-muted-foreground mb-4">評分（左軸 0-100）與睡眠時數（右軸 hrs）趨勢</p>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.65 0.18 200)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="oklch(0.65 0.18 200)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="durationGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.75 0.17 280)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="oklch(0.75 0.17 280)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.018 240)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="score" domain={[0, 100]} tick={{ fontSize: 11, fill: "oklch(0.65 0.18 200)" }} axisLine={false} tickLine={false} width={32} label={{ value: '評分', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 10, fill: 'oklch(0.65 0.18 200)' } }} />
                  <YAxis yAxisId="hrs" orientation="right" domain={[0, 12]} tick={{ fontSize: 11, fill: "oklch(0.75 0.17 280)" }} axisLine={false} tickLine={false} width={32} label={{ value: '時數', angle: 90, position: 'insideRight', offset: 10, style: { fontSize: 10, fill: 'oklch(0.75 0.17 280)' } }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area yAxisId="score" type="monotone" dataKey="score" name="睡眠評分" stroke="oklch(0.65 0.18 200)" fill="url(#scoreGrad)" strokeWidth={2.5} dot={false} />
                  <Area yAxisId="hrs" type="monotone" dataKey="duration" name="睡眠時數 (hrs)" stroke="oklch(0.75 0.17 280)" fill="url(#durationGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>}
          </div>

          {/* 2. Bedtime & Waketime Chart */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-foreground mb-1">就寢時間 & 起床時間對照圖</h3>
            <p className="text-xs text-muted-foreground mb-4">每日就寢（藍）與起床（橙）時間，虛線為午夜（00:00）</p>
            {chartData.filter(d => d.bedtime || d.waketime).length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={chartData.slice(-30)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.018 240)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} />
                  <YAxis
                    domain={[18, 30]}
                    ticks={[18, 20, 22, 24, 26, 28, 30]}
                    tickFormatter={v => decimalHourToLabel(v)}
                    tick={{ fontSize: 10, fill: "oklch(0.60 0.010 240)" }}
                    axisLine={false} tickLine={false} width={42}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  {/* Midnight reference line at 24 */}
                  <ReferenceLine y={24} stroke="oklch(0.50 0.010 240)" strokeDasharray="6 3" label={{ value: '午夜', position: 'insideTopRight', fontSize: 10, fill: 'oklch(0.50 0.010 240)' }} />
                  <Line type="monotone" dataKey="bedtime" name="就寢時間" stroke="oklch(0.62 0.18 270)" strokeWidth={2} dot={{ r: 3, fill: "oklch(0.62 0.18 270)" }} connectNulls />
                  <Line type="monotone" dataKey="waketime" name="起床時間" stroke="oklch(0.78 0.20 50)" strokeWidth={2} dot={{ r: 3, fill: "oklch(0.78 0.20 50)" }} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            ) : <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No bedtime/waketime data</div>}
          </div>

          {/* 3. Body Battery & HRV + Blood Ox & Respiration */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-1">Body Battery & HRV</h3>
              <p className="text-xs text-muted-foreground mb-3">每日身體電量（左）與心率變異性（右）</p>
              {chartData.filter(d => d.battery || d.hrv).length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.018 240)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="batt" domain={[0, 100]} tick={{ fontSize: 10, fill: "oklch(0.72 0.19 160)" }} axisLine={false} tickLine={false} width={28} />
                    <YAxis yAxisId="hrv" orientation="right" tick={{ fontSize: 10, fill: "oklch(0.68 0.22 25)" }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line yAxisId="batt" type="monotone" dataKey="battery" name="Body Battery" stroke="oklch(0.72 0.19 160)" strokeWidth={2} dot={false} />
                    <Line yAxisId="hrv" type="monotone" dataKey="hrv" name="HRV (ms)" stroke="oklch(0.68 0.22 25)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                  </LineChart>
                </ResponsiveContainer>
              ) : <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No data</div>}
            </div>

            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-1">血氧 & 呼吸率</h3>
              <p className="text-xs text-muted-foreground mb-3">睡眠期間血氧飽和度（左）與呼吸頻率（右）</p>
              {chartData.filter(d => d.pulseOx || d.respiration).length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.018 240)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="ox" domain={[90, 100]} tick={{ fontSize: 10, fill: "oklch(0.65 0.18 200)" }} axisLine={false} tickLine={false} width={28} />
                    <YAxis yAxisId="resp" orientation="right" domain={[8, 20]} tick={{ fontSize: 10, fill: "oklch(0.75 0.17 280)" }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line yAxisId="ox" type="monotone" dataKey="pulseOx" name="血氧 (%)" stroke="oklch(0.65 0.18 200)" strokeWidth={2} dot={false} />
                    <Line yAxisId="resp" type="monotone" dataKey="respiration" name="呼吸率 (br/min)" stroke="oklch(0.75 0.17 280)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                  </LineChart>
                </ResponsiveContainer>
              ) : <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No data</div>}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["日期", "評分", "品質", "時數", "HRV", "靜息心率", "血氧", "呼吸率", "Body Battery", "就寢", "起床", ""].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{formatHKDate(r.date)}</td>
                      <td className="px-4 py-3">{r.sleepScore ?? "—"}</td>
                      <td className="px-4 py-3">{getQualityBadge(r.sleepQuality)}</td>
                      <td className="px-4 py-3">{r.sleepDuration != null ? `${toHrs(r.sleepDuration)?.toFixed(1)}h` : "—"}</td>
                      <td className="px-4 py-3">{r.hrv != null ? `${r.hrv}ms` : "—"}</td>
                      <td className="px-4 py-3">{r.restingHr != null ? `${r.restingHr}bpm` : "—"}</td>
                      <td className="px-4 py-3">{r.pulseOx ? `${Number(r.pulseOx).toFixed(1)}%` : "—"}</td>
                      <td className="px-4 py-3">{r.respiration ? `${Number(r.respiration).toFixed(1)}` : "—"}</td>
                      <td className="px-4 py-3">{r.bodyBattery ?? "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{r.bedtime ? String(r.bedtime).slice(0, 5) : "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{r.waketime ? String(r.waketime).slice(0, 5) : "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => {
                            setEditEntry(r);
                            setForm({
                              date: r.date,
                              score: r.sleepScore ?? "",
                              restingHr: r.restingHr ?? "",
                              bodyBattery: r.bodyBattery ?? "",
                              pulseOx: r.pulseOx ?? "",
                              respiration: r.respiration ?? "",
                              hrv: r.hrv ?? "",
                              quality: r.sleepQuality ?? "Good",
                              duration: r.sleepDuration != null ? (toHrs(r.sleepDuration) ?? "") : "",
                              notes: r.notes ?? "",
                            });
                            setShowDialog(true);
                          }}><Edit2 className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => deleteMutation.mutate({ id: r.id })}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr><td colSpan={12} className="text-center py-8 text-muted-foreground text-sm">No records yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editEntry ? "Edit Sleep Record" : "Log Sleep"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Date</label>
              <Input type="date" value={form.date} onChange={e => setForm((f: any) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Quality</label>
              <Select value={form.quality} onValueChange={v => setForm((f: any) => ({ ...f, quality: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QUALITY_OPTIONS.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {[
              { key: "score", label: "Sleep Score (0-100)" },
              { key: "duration", label: "Duration (hrs)" },
              { key: "hrv", label: "HRV (ms)" },
              { key: "restingHr", label: "Resting HR (bpm)" },
              { key: "bodyBattery", label: "Body Battery (0-100)" },
              { key: "pulseOx", label: "Pulse Ox (%)" },
              { key: "respiration", label: "Respiration (br/min)" },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-muted-foreground mb-1 block">{f.label}</label>
                <Input type="number" step="0.1" value={form[f.key]} onChange={e => setForm((prev: any) => ({ ...prev, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
              <Input placeholder="Optional notes…" value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); setEditEntry(null); }}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={addMutation.isPending || updateMutation.isPending}>
              {(addMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editEntry ? "Save" : "Log"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
