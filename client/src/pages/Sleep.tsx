import { useTranslation } from 'react-i18next';
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Moon, Trash2, Edit2, Loader2, Star } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, LineChart, Line
} from "recharts";

const QUALITY_OPTIONS = ["Poor", "Fair", "Good", "Excellent"] as const;
const QUALITY_COLORS: Record<string, string> = {
  Poor: "oklch(0.68 0.22 25)",
  Fair: "oklch(0.78 0.20 50)",
  Good: "oklch(0.72 0.19 160)",
  Excellent: "oklch(0.65 0.18 200)",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-xl text-xs">
        <p className="text-muted-foreground mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }} className="font-semibold">{p.name}: {typeof p.value === "number" ? p.value.toFixed(1) : p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

const defaultForm = {
  date: format(new Date(), "yyyy-MM-dd"),
  score: "", restingHr: "", bodyBattery: "", pulseOx: "",
  respiration: "", stress: "", quality: "Good" as const,
  duration: "", deepSleep: "", remSleep: "", notes: ""
};

export default function Sleep() {
  const { t } = useTranslation();
  const [showDialog, setShowDialog] = useState(false);
  const [editEntry, setEditEntry] = useState<any>(null);
  const [form, setForm] = useState<any>(defaultForm);

  const utils = trpc.useUtils();
  const { data: records = [], isLoading } = trpc.sleep.getAll.useQuery({ limit: 60 });
  const { data: goalsData } = trpc.goals.getGoals.useQuery();

  const checkGoalAchievement = (payload: Record<string, number | undefined>) => {
    const goals = goalsData ?? [];
    const checks: Array<{ goalType: string; value: number | undefined; inverse: boolean; label: string; unit: string }> = [
      { goalType: "sleep_score",    value: payload.score,    inverse: false, label: "Sleep Score",    unit: " pts" },
      { goalType: "sleep_duration", value: payload.duration, inverse: false, label: "Sleep Duration", unit: "h"   },
    ];
    checks.forEach(({ goalType, value, inverse, label, unit }) => {
      if (value == null) return;
      const goal = goals.find(g => g.goalType === goalType);
      if (!goal) return;
      const target = Number(goal.targetValue);
      const hit = inverse ? value <= target : value >= target;
      if (hit) {
        const symbol = inverse ? "≤" : "≥";
        toast.success(`🎯 ${label} goal hit! ${value}${unit} ${symbol} ${target}${unit}`, { duration: 5000 });
      }
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


  const chartData = [...records].reverse().map(r => ({
    date: r.date.slice(5),
    score: r.sleepScore,
    duration: r.sleepDuration,
    deep: r.deepSleep,
    rem: r.remSleep,
    hr: null, // restingHr not in sleep table
    battery: r.bodyBattery,
    stress: r.stress,
  }));

  const latest = records[0];

  const getQualityBadge = (q: string | null | undefined) => {
    if (!q) return null;
    return <Badge style={{ background: QUALITY_COLORS[q] + "33", color: QUALITY_COLORS[q], borderColor: QUALITY_COLORS[q] + "66" }} variant="outline" className="text-xs">{q}</Badge>;
  };

  const handleSubmit = () => {
    const payload = {
      date: form.date,
      score: form.score ? Number(form.score) : undefined,
      restingHr: form.restingHr ? Number(form.restingHr) : undefined,
      bodyBattery: form.bodyBattery ? Number(form.bodyBattery) : undefined,
      pulseOx: form.pulseOx ? Number(form.pulseOx) : undefined,
      respiration: form.respiration ? Number(form.respiration) : undefined,
      stress: form.stress ? Number(form.stress) : undefined,
      quality: form.quality as any,
      duration: form.duration ? Number(form.duration) : undefined,
      deepSleep: form.deepSleep ? Number(form.deepSleep) : undefined,
      remSleep: form.remSleep ? Number(form.remSleep) : undefined,
      notes: form.notes || undefined,
    };
    if (editEntry) {
      updateMutation.mutate({ id: editEntry.id, ...payload });
    } else {
      addMutation.mutate(payload);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Sunny Page Header */}
      <div className="rounded-2xl p-5 text-white" style={{background: 'linear-gradient(135deg, oklch(0.62 0.18 270) 0%, oklch(0.62 0.18 230) 100%)'}}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-white">{t('sleep.title')}</h1>
            <p className="text-white/70 text-sm mt-0.5">{t('sleep.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="gap-2 bg-white text-primary hover:bg-white/90" onClick={() => { setEditEntry(null); setForm(defaultForm); setShowDialog(true); }}>
              <Plus className="w-4 h-4" /> {t('sleep.add_record')}
            </Button>
          </div>
        </div>
      </div>

      {/* Latest Stats */}
      {latest && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { labelKey: "sleep.score", value: latest.sleepScore, unit: "/100", badgeClass: "icon-badge-blue" },
            { labelKey: "sleep.duration", value: latest.sleepDuration != null ? `${Number(latest.sleepDuration).toFixed(1)}` : null, unit: "hrs", badgeClass: "icon-badge-purple" },
            { labelKey: "sleep.body_battery", value: latest.bodyBattery, unit: "/100", badgeClass: "icon-badge-green" },
            { labelKey: "sleep.pulse_ox", value: latest.pulseOx, unit: "%", badgeClass: "icon-badge-red" },
          ].map(m => (
            <div key={m.labelKey} className="stat-card rounded-2xl p-4">
              <div className={`icon-badge ${m.badgeClass} mb-2`}>
                <Moon className="w-4 h-4" />
              </div>
              <p className="text-xs text-muted-foreground font-semibold">{t(m.labelKey)}</p>
              <p className="metric-value text-2xl text-foreground mt-0.5">
                {m.value ?? "—"} <span className="text-sm font-normal text-muted-foreground">{m.unit}</span>
              </p>
              {m.labelKey === "sleep.score" && getQualityBadge(latest.sleepQuality)}
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
          {/* Sleep Score & Duration */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-foreground mb-4">Sleep Score & Duration</h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.65 0.18 200)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="oklch(0.65 0.18 200)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.018 240)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} width={35} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area type="monotone" dataKey="score" name="Sleep Score" stroke="oklch(0.65 0.18 200)" fill="url(#scoreGrad)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="duration" name="Duration (hrs)" stroke="oklch(0.75 0.17 280)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>}
          </div>

          {/* Sleep Stages */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-4">Sleep Stages (hrs)</h3>
              {chartData.filter(d => d.deep || d.rem).length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData.slice(-14)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.018 240)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} width={25} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="deep" name="Deep Sleep" stackId="a" fill="oklch(0.45 0.18 260)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="rem" name="REM Sleep" stackId="a" fill="oklch(0.65 0.18 200)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No stage data</div>}
            </div>

            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-4">Body Battery & Stress</h3>
              {chartData.filter(d => d.battery || d.stress).length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.018 240)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line type="monotone" dataKey="battery" name="Body Battery" stroke="oklch(0.72 0.19 160)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="stress" name="Stress" stroke="oklch(0.68 0.22 25)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
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
                    {["Date", "Score", "Quality", "Duration", "Deep", "REM", "HR", "Battery", "Stress", ""].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{r.date}</td>
                      <td className="px-4 py-3">{r.sleepScore ?? "—"}</td>
                      <td className="px-4 py-3">{getQualityBadge(r.sleepQuality)}</td>
                      <td className="px-4 py-3">{r.sleepDuration != null ? `${Number(r.sleepDuration).toFixed(1)}h` : "—"}</td>
                      <td className="px-4 py-3">{r.deepSleep != null ? `${Number(r.deepSleep).toFixed(1)}h` : "—"}</td>
                      <td className="px-4 py-3">{r.remSleep != null ? `${Number(r.remSleep).toFixed(1)}h` : "—"}</td>
                      <td className="px-4 py-3">{r.pulseOx ? `${r.pulseOx}%` : "—"}</td>
                      <td className="px-4 py-3">{r.bodyBattery ?? "—"}</td>
                      <td className="px-4 py-3">{r.stress != null ? Number(r.stress).toFixed(0) : "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => {
                            setEditEntry(r);
                            setForm({ date: r.date, score: r.sleepScore ?? "", restingHr: "", bodyBattery: r.bodyBattery ?? "", pulseOx: r.pulseOx ?? "", respiration: r.respiration ?? "", stress: r.stress ?? "", quality: r.sleepQuality ?? "Good", duration: r.sleepDuration ?? "", deepSleep: r.deepSleep ?? "", remSleep: r.remSleep ?? "", notes: r.notes ?? "" });
                            setShowDialog(true);
                          }}><Edit2 className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => deleteMutation.mutate({ id: r.id })}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr><td colSpan={10} className="text-center py-8 text-muted-foreground text-sm">No records yet</td></tr>
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
              { key: "deepSleep", label: "Deep Sleep (hrs)" },
              { key: "remSleep", label: "REM Sleep (hrs)" },
              { key: "restingHr", label: "Resting HR (bpm)" },
              { key: "bodyBattery", label: "Body Battery (0-100)" },
              { key: "pulseOx", label: "Pulse Ox (%)" },
              { key: "respiration", label: "Respiration (br/min)" },
              { key: "stress", label: "Stress Level" },
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
