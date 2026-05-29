import { useTranslation } from 'react-i18next';
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Heart, Trash2, Edit2, Loader2, RefreshCw, Activity } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend, ReferenceLine
} from "recharts";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-xl text-xs">
        <p className="text-muted-foreground mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }} className="font-semibold">{p.name}: {p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

const defaultForm = { date: format(new Date(), "yyyy-MM-dd"), restingHr: "", highHr: "", maxHr: "", hrv: "", notes: "" };

export default function HeartRate() {
  const { t } = useTranslation();
  const [showDialog, setShowDialog] = useState(false);
  const [editEntry, setEditEntry] = useState<any>(null);
  const [form, setForm] = useState<any>(defaultForm);
  const [syncing, setSyncing] = useState(false);

  const utils = trpc.useUtils();
  const { data: records = [], isLoading } = trpc.heartRate.getAll.useQuery({ limit: 60 });
  const addMutation = trpc.heartRate.add.useMutation({
    onSuccess: () => { utils.heartRate.getAll.invalidate(); toast.success("Heart rate logged!"); setShowDialog(false); setForm(defaultForm); },
    onError: () => toast.error("Failed to save"),
  });
  const updateMutation = trpc.heartRate.update.useMutation({
    onSuccess: () => { utils.heartRate.getAll.invalidate(); toast.success("Updated!"); setEditEntry(null); setShowDialog(false); },
  });
  const deleteMutation = trpc.heartRate.delete.useMutation({
    onSuccess: () => { utils.heartRate.getAll.invalidate(); toast.success("Deleted"); },
  });
  const syncMutation = trpc.sheets.pullFromSheets.useMutation({
    onSuccess: (data: { count: number; rows: number }) => { utils.heartRate.getAll.invalidate(); setSyncing(false); toast.success(`Pulled ${data.count} records from Google Sheets`); },
    onError: (err) => { setSyncing(false); toast.error("Sync failed: " + err.message); },
  });

  const pushToSheetsMutation = trpc.sheets.pushToSheets.useMutation({
    onError: (err) => console.warn("Sheets write-back failed:", err.message)
  });

  const chartData = [...records].reverse().map(r => ({
    date: r.date.slice(5),
    resting: r.restingHr,
    high: r.highHr,
    hrv: r.hrv,
  }));

  const latest = records[0];

  const getHrZone = (hr: number | null | undefined) => {
    if (!hr) return { label: "—", color: "text-muted-foreground" };
    if (hr < 60) return { label: "Bradycardia", color: "text-blue-400" };
    if (hr <= 100) return { label: "Normal", color: "text-emerald-400" };
    if (hr <= 120) return { label: "Elevated", color: "text-amber-400" };
    return { label: "High", color: "text-rose-400" };
  };

  const hrZone = getHrZone(latest?.restingHr);

  const handleSubmit = () => {
    const payload = {
      date: form.date,
      restingHr: form.restingHr ? Number(form.restingHr) : undefined,
      highHr: form.highHr ? Number(form.highHr) : undefined,
      maxHr: form.maxHr ? Number(form.maxHr) : undefined,
      hrv: form.hrv ? Number(form.hrv) : undefined,
      notes: form.notes || undefined,
    };
    if (editEntry) {
      updateMutation.mutate({ id: editEntry.id, ...payload });
    } else {
      addMutation.mutate(payload, {
        onSuccess: () => pushToSheetsMutation.mutate({ type: "heartrate", data: payload })
      });
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Sunny Page Header */}
      <div className="rounded-2xl p-5 text-white" style={{background: 'linear-gradient(135deg, oklch(0.62 0.20 25) 0%, oklch(0.68 0.19 45) 100%)'}}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-white">{t('heartrate.title')}</h1>
            <p className="text-white/70 text-sm mt-0.5">{t('heartrate.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-2 bg-white/20 hover:bg-white/30 text-white border-0" disabled={syncing}
              onClick={() => { setSyncing(true); syncMutation.mutate({ type: "heartrate" }); }}>
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} /> {t('body.sync_sheets')}
            </Button>
            <Button size="sm" className="gap-2 bg-white text-primary hover:bg-white/90" onClick={() => { setEditEntry(null); setForm(defaultForm); setShowDialog(true); }}>
              <Plus className="w-4 h-4" /> {t('heartrate.add_record')}
            </Button>
          </div>
        </div>
      </div>

      {/* Latest Stats */}
      {latest && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { labelKey: "heartrate.resting_hr", value: latest.restingHr, unit: "bpm", badgeClass: "icon-badge-red" },
            { labelKey: "heartrate.high_hr", value: latest.highHr, unit: "bpm", badgeClass: "icon-badge-orange" },
            { labelKey: "heartrate.avg_hr", value: latest.avgHr, unit: "bpm", badgeClass: "icon-badge-red" },
            { labelKey: "heartrate.hrv", value: latest.hrv != null ? Number(latest.hrv).toFixed(0) : null, unit: "ms", badgeClass: "icon-badge-blue" },
          ].map(m => (
            <div key={m.labelKey} className="stat-card rounded-2xl p-4">
              <div className={`icon-badge ${m.badgeClass} mb-2`}>
                <Heart className="w-4 h-4" />
              </div>
              <p className="text-xs text-muted-foreground font-semibold">{t(m.labelKey)}</p>
              <p className="metric-value text-2xl text-foreground mt-0.5">
                {m.value ?? "—"} <span className="text-sm font-normal text-muted-foreground">{m.unit}</span>
              </p>
              {m.labelKey === "heartrate.resting_hr" && (
                <Badge variant="outline" className={`text-xs mt-1 ${hrZone.color}`}>{hrZone.label}</Badge>
              )}
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
          {/* HR Trend */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-foreground mb-4">Heart Rate Trend</h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.018 240)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} width={35} domain={['auto', 'auto']} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <ReferenceLine y={60} stroke="oklch(0.65 0.18 200)" strokeDasharray="4 2" label={{ value: "60", position: "right", fontSize: 10, fill: "oklch(0.60 0.010 240)" }} />
                  <ReferenceLine y={100} stroke="oklch(0.78 0.20 50)" strokeDasharray="4 2" label={{ value: "100", position: "right", fontSize: 10, fill: "oklch(0.60 0.010 240)" }} />
                  <Line type="monotone" dataKey="resting" name="Resting HR (bpm)" stroke="oklch(0.68 0.22 25)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="high" name="High HR (bpm)" stroke="oklch(0.78 0.20 50)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>}
          </div>

          {/* HRV Trend */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-foreground mb-4">Heart Rate Variability (HRV)</h3>
            {chartData.filter(d => d.hrv).length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="hrvGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.65 0.18 200)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="oklch(0.65 0.18 200)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.018 240)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} width={35} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="hrv" name="HRV (ms)" stroke="oklch(0.65 0.18 200)" fill="url(#hrvGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No HRV data yet</div>}
          </div>
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Date", "Resting HR", "High HR", "Max HR", "HRV", "Notes", ""].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{r.date}</td>
                      <td className="px-4 py-3">{r.restingHr ? `${r.restingHr} bpm` : "—"}</td>
                      <td className="px-4 py-3">{r.highHr ? `${r.highHr} bpm` : "—"}</td>
                      <td className="px-4 py-3">{r.avgHr ? `${r.avgHr} bpm` : "—"}</td>
                      <td className="px-4 py-3">{r.hrv != null ? `${Number(r.hrv).toFixed(0)} ms` : "—"}</td>
                      <td className="px-4 py-3 max-w-32 truncate text-muted-foreground">{r.notes || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => {
                            setEditEntry(r);
                            setForm({ date: r.date, restingHr: r.restingHr ?? "", highHr: r.highHr ?? "", avgHr: r.avgHr ?? "", hrv: r.hrv ?? "", notes: r.notes ?? "" });
                            setShowDialog(true);
                          }}><Edit2 className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => deleteMutation.mutate({ id: r.id })}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">No records yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editEntry ? "Edit Heart Rate" : "Log Heart Rate"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Date</label>
              <Input type="date" value={form.date} onChange={e => setForm((f: any) => ({ ...f, date: e.target.value }))} />
            </div>
            {[
              { key: "restingHr", label: "Resting HR (bpm)" },
              { key: "highHr", label: "High HR (bpm)" },
              { key: "maxHr", label: "Max HR (bpm)" },
              { key: "hrv", label: "HRV (ms)" },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-muted-foreground mb-1 block">{f.label}</label>
                <Input type="number" value={form[f.key]} onChange={e => setForm((prev: any) => ({ ...prev, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div>
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
