import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { todayHKString, formatHKDate, formatHKChartDate } from "@/lib/hkTime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Footprints, Plus, Trash2, Edit2, Loader2, Activity, Timer, Heart, Zap } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ComposedChart, Area
} from "recharts";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatPace = (secPerKm: number | null | undefined): string => {
  if (!secPerKm || secPerKm <= 0) return "—";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
};

// average_pace in DB is min/km as decimal (e.g. "7.08" = 7 min 4.8 sec per km)
const parsePaceField = (val: string | null | undefined): number => {
  if (!val) return 0;
  const f = parseFloat(val);
  if (isNaN(f)) return 0;
  // Convert decimal minutes to seconds
  return f * 60;
};

const formatDuration = (h: number, m: number, s: number): string => {
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0) parts.push(`${s}s`);
  return parts.join(" ") || "—";
};

const RUNNING_TYPES = ["Easy", "Tempo", "Interval", "Long Run", "Race", "Trail", "Recovery", "其他"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-xl text-xs">
        <p className="text-muted-foreground mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }} className="font-semibold">
            {p.name}: {p.value != null ? p.value : "—"}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// ─── Default form ─────────────────────────────────────────────────────────────
const defaultForm = {
  date: todayHKString(),
  runningType: "Easy",
  runningShoes: "",
  distanceKm: "",
  hour: "0",
  minutes: "",
  second: "0",
  averagePace: "",
  bestPace: "",
  averageHeartRate: "",
  maximumHeartRate: "",
  averageCadence: "",
  calories: "",
  notes: "",
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function Running() {
  const [showDialog, setShowDialog] = useState(false);
  const [editEntry, setEditEntry] = useState<any>(null);
  const [form, setForm] = useState<any>(defaultForm);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: logs = [], isLoading } = trpc.running.getLogs.useQuery({ limit: 200 });
  const { data: stats } = trpc.running.getStats.useQuery();

  // ─── Mutations ───────────────────────────────────────────────────────────────
  const addMutation = trpc.running.addLog.useMutation({
    onSuccess: () => {
      utils.running.getLogs.invalidate();
      utils.running.getStats.invalidate();
      toast.success("跑步記錄已新增！");
      setShowDialog(false);
      setForm(defaultForm);
    },
    onError: (e) => toast.error("儲存失敗：" + e.message),
  });

  const updateMutation = trpc.running.updateLog.useMutation({
    onSuccess: () => {
      utils.running.getLogs.invalidate();
      utils.running.getStats.invalidate();
      toast.success("記錄已更新！");
      setEditEntry(null);
      setShowDialog(false);
      setForm(defaultForm);
    },
    onError: (e) => toast.error("更新失敗：" + e.message),
  });

  const deleteMutation = trpc.running.deleteLog.useMutation({
    onSuccess: () => {
      utils.running.getLogs.invalidate();
      utils.running.getStats.invalidate();
      toast.success("記錄已刪除");
      setDeleteConfirm(null);
    },
    onError: () => toast.error("刪除失敗"),
  });

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditEntry(null);
    setForm(defaultForm);
    setShowDialog(true);
  };

  const openEdit = (row: any) => {
    setEditEntry(row);
    setForm({
      date: row.date ?? todayHKString(),
      runningType: row.running_type ?? "Easy",
      runningShoes: row.running_shoes ?? "",
      distanceKm: row.distance_km != null ? String(row.distance_km) : "",
      hour: row.hour != null ? String(row.hour) : "0",
      minutes: row.minutes != null ? String(row.minutes) : "",
      second: row.second != null ? String(row.second) : "0",
      averagePace: row.average_pace ?? "",
      bestPace: row.best_pace ?? "",
      averageHeartRate: row.average_heart_rate != null ? String(row.average_heart_rate) : "",
      maximumHeartRate: row.maximum_heart_rate != null ? String(row.maximum_heart_rate) : "",
      averageCadence: row.average_cadence != null ? String(row.average_cadence) : "",
      calories: row.calories != null ? String(row.calories) : "",
      notes: row.notes ?? "",
    });
    setShowDialog(true);
  };

  const handleSave = () => {
    const payload: any = {
      date: form.date,
      runningType: form.runningType || undefined,
      runningShoes: form.runningShoes || undefined,
      distanceKm: form.distanceKm ? parseFloat(form.distanceKm) : undefined,
      hour: form.hour ? parseInt(form.hour) : undefined,
      minutes: form.minutes ? parseInt(form.minutes) : undefined,
      second: form.second ? parseInt(form.second) : undefined,
      averagePace: form.averagePace || undefined,
      bestPace: form.bestPace || undefined,
      averageHeartRate: form.averageHeartRate ? parseInt(form.averageHeartRate) : undefined,
      maximumHeartRate: form.maximumHeartRate ? parseInt(form.maximumHeartRate) : undefined,
      averageCadence: form.averageCadence ? parseFloat(form.averageCadence) : undefined,
      calories: form.calories ? parseInt(form.calories) : undefined,
      notes: form.notes || undefined,
    };
    if (editEntry) {
      updateMutation.mutate({ id: Number(editEntry.id), ...payload });
    } else {
      addMutation.mutate(payload);
    }
  };

  const f = (key: string, val: string) => setForm((p: any) => ({ ...p, [key]: val }));

  // ─── Chart data ──────────────────────────────────────────────────────────────
  const monthlyData = useMemo(() => {
    if (!stats?.monthly) return [];
    return (stats.monthly as any[]).map((m: any) => ({
      month: m.month,
      距離: m.distance ? parseFloat(m.distance).toFixed(1) : 0,
      次數: Number(m.runs),
      平均配速秒: m.avg_pace ? parseFloat(m.avg_pace) * 60 : null,
    }));
  }, [stats]);

  const recentData = useMemo(() => {
    return (logs as any[]).slice(0, 20).reverse().map((r: any) => ({
      date: formatHKChartDate(r.date),
      距離: r.distance_km ? parseFloat(r.distance_km) : null,
      配速秒: r.average_pace ? parsePaceField(r.average_pace) : null,
      心率: r.average_heart_rate ?? null,
      步頻: r.average_cadence ? parseFloat(r.average_cadence) : null,
    }));
  }, [logs]);

  // ─── Summary stats ───────────────────────────────────────────────────────────
  const summary = stats?.summary as any;
  const totalRuns = summary ? Number(summary.total_runs) : 0;
  const totalDist = summary ? parseFloat(summary.total_distance || 0).toFixed(1) : "0.0";
  const avgPaceSec = summary ? parsePaceField(summary.avg_pace_sec ? String(summary.avg_pace_sec) : null) : 0;
  const avgHr = summary ? Math.round(Number(summary.avg_hr || 0)) : 0;

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Footprints className="w-6 h-6 text-orange-500" />
            跑步記錄
          </h1>
          <p className="text-muted-foreground text-sm mt-1">追蹤跑步訓練與表現數據</p>
        </div>
        <Button onClick={openAdd} className="hero-gradient text-white">
          <Plus className="w-4 h-4 mr-1" /> 記錄跑步
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "總跑步次數", value: `${totalRuns} 次`, icon: Footprints, color: "text-orange-500" },
          { label: "總距離", value: `${totalDist} km`, icon: Activity, color: "text-emerald-500" },
          { label: "平均配速", value: formatPace(avgPaceSec), icon: Timer, color: "text-blue-500" },
          { label: "平均心率", value: avgHr ? `${avgHr} bpm` : "—", icon: Heart, color: "text-red-500" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <p className="text-xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="charts">
        <TabsList className="mb-4">
          <TabsTrigger value="charts">趨勢</TabsTrigger>
          <TabsTrigger value="log">查看全部</TabsTrigger>
        </TabsList>

        {/* Charts tab */}
        <TabsContent value="charts" className="space-y-6">
          {/* Monthly distance */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-foreground mb-4">每月跑步距離 (km)</h3>
            {monthlyData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">暫無數據</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="距離" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Recent runs pace + HR */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-foreground mb-4">最近跑步 — 配速 & 心率</h3>
            {recentData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">暫無數據</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={recentData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area yAxisId="left" type="monotone" dataKey="距離" fill="#fed7aa" stroke="#f97316" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="心率" stroke="#ef4444" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Cadence chart */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-foreground mb-4">最近跑步 — 步頻 (spm)</h3>
            {recentData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">暫無數據</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={recentData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={[150, 210]} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="步頻" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </TabsContent>

        {/* Log tab */}
        <TabsContent value="log">
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (logs as any[]).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Footprints className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">尚未記錄跑步數據</p>
                <p className="text-sm mt-1">點擊「記錄跑步」新增第一次跑步記錄</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      {["日期", "類型", "距離", "時間", "配速", "心率", "步頻", "卡路里", "備注", ""].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(logs as any[]).map((row: any) => (
                      <tr key={row.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium whitespace-nowrap">{formatHKDate(row.date)}</td>
                        <td className="px-4 py-3">
                          {row.running_type ? (
                            <Badge variant="outline" className="text-xs">{row.running_type}</Badge>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {row.distance_km ? `${parseFloat(row.distance_km).toFixed(2)} km` : "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {(row.hour != null || row.minutes != null)
                            ? formatDuration(row.hour || 0, row.minutes || 0, row.second || 0)
                            : "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {row.average_pace ? formatPace(parsePaceField(row.average_pace)) : "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {row.average_heart_rate ? `${row.average_heart_rate} bpm` : "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {row.average_cadence ? `${parseFloat(row.average_cadence).toFixed(0)} spm` : "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {row.calories ? `${row.calories} kcal` : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[120px] truncate">
                          {row.notes || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(row)}>
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteConfirm(Number(row.id))}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(o) => { setShowDialog(o); if (!o) { setEditEntry(null); setForm(defaultForm); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editEntry ? "修改跑步記錄" : "記錄跑步"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">日期</label>
              <Input type="date" value={form.date} onChange={(e) => f("date", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">訓練類型</label>
              <Select value={form.runningType} onValueChange={(v) => f("runningType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RUNNING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">距離 (km)</label>
              <Input type="number" step="0.01" placeholder="例: 10.5" value={form.distanceKm} onChange={(e) => f("distanceKm", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">時間 — 小時</label>
              <Input type="number" min="0" placeholder="0" value={form.hour} onChange={(e) => f("hour", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">時間 — 分鐘</label>
              <Input type="number" min="0" max="59" placeholder="例: 45" value={form.minutes} onChange={(e) => f("minutes", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">時間 — 秒</label>
              <Input type="number" min="0" max="59" placeholder="0" value={form.second} onChange={(e) => f("second", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">平均配速 (min/km)</label>
              <Input type="text" placeholder="例: 6.5 (=6:30/km)" value={form.averagePace} onChange={(e) => f("averagePace", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">最佳配速</label>
              <Input type="text" placeholder="例: 05:48" value={form.bestPace} onChange={(e) => f("bestPace", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">平均心率 (bpm)</label>
              <Input type="number" placeholder="例: 145" value={form.averageHeartRate} onChange={(e) => f("averageHeartRate", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">最高心率 (bpm)</label>
              <Input type="number" placeholder="例: 175" value={form.maximumHeartRate} onChange={(e) => f("maximumHeartRate", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">平均步頻 (spm)</label>
              <Input type="number" placeholder="例: 178" value={form.averageCadence} onChange={(e) => f("averageCadence", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">消耗卡路里 (kcal)</label>
              <Input type="number" placeholder="例: 450" value={form.calories} onChange={(e) => f("calories", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">跑鞋</label>
              <Input type="text" placeholder="例: Asics Metaspeed Sky" value={form.runningShoes} onChange={(e) => f("runningShoes", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">備注</label>
              <Input type="text" placeholder="訓練感受、路線等..." value={form.notes} onChange={(e) => f("notes", e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); setEditEntry(null); setForm(defaultForm); }}>取消</Button>
            <Button onClick={handleSave} disabled={addMutation.isPending || updateMutation.isPending} className="hero-gradient text-white">
              {(addMutation.isPending || updateMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteConfirm !== null} onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>確認刪除</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">確定要刪除此跑步記錄？此操作無法復原。</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>取消</Button>
            <Button variant="destructive" onClick={() => deleteConfirm !== null && deleteMutation.mutate({ id: deleteConfirm })}
              disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
