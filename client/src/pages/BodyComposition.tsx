import { useTranslation } from 'react-i18next';
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { todayHKString, formatHKChartDate, formatHKDate } from "@/lib/hkTime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Scale, Trash2, Edit2, Loader2, TrendingUp, TrendingDown, Minus, Upload, ArrowUpDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import QuickImportModal from "@/components/QuickImportModal";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ComposedChart, Bar, BarChart
} from "recharts";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-xl text-xs">
        <p className="text-muted-foreground mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }} className="font-semibold">{p.name}: {p.value != null ? Number(p.value).toFixed(1) : "—"}</p>
        ))}
      </div>
    );
  }
  return null;
};

const defaultForm = { date: todayHKString(), weight: "", bodyFatPct: "", muscleMass: "", bmi: "", fatMass: "", visceralFat: "", bmr: "", notes: "" };

export default function BodyComposition() {
  const { t } = useTranslation();
  const [showDialog, setShowDialog] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editEntry, setEditEntry] = useState<any>(null);
  const [form, setForm] = useState<any>(defaultForm);

  const [bodySort, setBodySort] = useState<'date_desc'|'date_asc'|'weight_asc'|'weight_desc'|'bf_asc'>('date_desc');
  const [bodySearch, setBodySearch] = useState('');
  const utils = trpc.useUtils();
  const { data: records = [], isLoading } = trpc.body.getAll.useQuery({ limit: 200 });
  const { data: goalsData } = trpc.goals.getGoals.useQuery();

  // Check if a saved value meets/beats a goal and show a celebratory toast
  const checkGoalAchievement = (payload: Record<string, number | undefined>) => {
    const goals = goalsData ?? [];
    const checks: Array<{ goalType: string; value: number | undefined; inverse?: boolean; label: string; unit: string }> = [
      { goalType: "weight",       value: payload.weight,      inverse: true,  label: "Weight",      unit: "kg" },
      { goalType: "body_fat_pct", value: payload.bodyFatPct,  inverse: true,  label: "Body Fat",    unit: "%" },
      { goalType: "muscle_mass",  value: payload.muscleMass,  inverse: false, label: "Muscle Mass", unit: "kg" },
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

  const addMutation = trpc.body.add.useMutation({
    onSuccess: (_, vars) => {
      utils.body.getAll.invalidate();
      toast.success("Body metrics logged!");
      checkGoalAchievement(vars as any);
      setShowDialog(false);
      setForm(defaultForm);
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.body.update.useMutation({
    onSuccess: (_, vars) => {
      utils.body.getAll.invalidate();
      toast.success("Updated!");
      checkGoalAchievement(vars as any);
      setEditEntry(null);
      setShowDialog(false);
    },
  });
  const deleteMutation = trpc.body.delete.useMutation({
    onSuccess: () => { utils.body.getAll.invalidate(); toast.success("Deleted"); },
  });


  const chartData = [...records].reverse().map(r => ({
    date: formatHKChartDate(r.date),
    weight: r.weight,
    fat: r.bodyFatPct,
    muscle: r.muscleMass,
    bmi: r.bmi,
    fatMass: r.fatMass,
    bmr: r.bmr,
  }));

  const latest = records[0];
  const prev = records[1];
  const diff = (key: string) => {
    if (!latest || !prev) return null;
    const d = (latest as any)[key] - (prev as any)[key];
    return d;
  };

  const StatBadge = ({ val }: { val: number | null }) => {
    if (val === null) return null;
    const Icon = val > 0 ? TrendingUp : val < 0 ? TrendingDown : Minus;
    const color = val > 0 ? "text-rose-400" : val < 0 ? "text-emerald-400" : "text-muted-foreground";
    return <span className={`flex items-center gap-0.5 text-xs ${color}`}><Icon className="w-3 h-3" />{Math.abs(val).toFixed(1)}</span>;
  };

  const handleSubmit = () => {
    const payload = {
      date: form.date,
      weight: form.weight ? Number(form.weight) : undefined,
      bodyFatPct: form.bodyFatPct ? Number(form.bodyFatPct) : undefined,
      muscleMass: form.muscleMass ? Number(form.muscleMass) : undefined,
      bmi: form.bmi ? Number(form.bmi) : undefined,
      fatMass: form.fatMass ? Number(form.fatMass) : undefined,
      visceralFat: form.visceralFat ? Number(form.visceralFat) : undefined,
      bmr: form.bmr ? Number(form.bmr) : undefined,
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
      {/* Page Header */}
      <div className="hero-gradient rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-white">{t('body.title')}</h1>
            <p className="text-white/70 text-sm mt-0.5">{t('body.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-2 bg-white/20 border-white/40 text-white hover:bg-white/30" onClick={() => setShowImport(true)}>
              <Upload className="w-4 h-4" /> 匯入
            </Button>
            <Button size="sm" className="gap-2 bg-white text-primary hover:bg-white/90" onClick={() => { setEditEntry(null); setForm(defaultForm); setShowDialog(true); }}>
              <Plus className="w-4 h-4" /> {t('body.add_record')}
            </Button>
          </div>
        </div>
      </div>
      <QuickImportModal open={showImport} onClose={() => setShowImport(false)} dataType="body" onSuccess={() => utils.body.getAll.invalidate()} />

      {/* Latest Metrics Cards */}
      {latest && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { labelKey: "body.weight", value: latest.weight, unit: "kg", key: "weight", badgeClass: "icon-badge-green" },
            { labelKey: "body.body_fat", value: latest.bodyFatPct, unit: "%", key: "bodyFatPct", badgeClass: "icon-badge-yellow" },
            { labelKey: "body.muscle_mass", value: latest.muscleMass, unit: "kg", key: "muscleMass", badgeClass: "icon-badge-blue" },
            { labelKey: "body.bmi", value: latest.bmi, unit: "", key: "bmi", badgeClass: "icon-badge-purple" },
            { labelKey: "body.fat_mass", value: latest.fatMass, unit: "kg", key: "fatMass", badgeClass: "icon-badge-red" },
            { labelKey: "body.visceral_fat", value: latest.visceralFat, unit: "", key: "visceralFat", badgeClass: "icon-badge-orange" },
            { labelKey: "body.bmr", value: latest.bmr, unit: "kcal", key: "bmr", badgeClass: "icon-badge-blue" },
            { labelKey: "body.notes", value: latest.source, unit: "", key: "source", badgeClass: "icon-badge-green" },
          ].map(m => (
            <div key={m.labelKey} className="stat-card rounded-2xl p-4">
              <div className={`icon-badge ${m.badgeClass} mb-2`}>
                <Scale className="w-4 h-4" />
              </div>
              <p className="text-xs text-muted-foreground font-semibold">{t(m.labelKey).replace(/ \(.*\)/, '')}</p>
              <p className="metric-value text-2xl text-foreground mt-0.5">{m.value != null ? Number(m.value).toFixed(1) : "—"} <span className="text-sm font-normal text-muted-foreground">{m.unit}</span></p>
              <StatBadge val={diff(m.key)} />
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
          {/* Weight & Muscle Trend */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-foreground mb-4">Weight & Muscle Mass Trend</h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={chartData}>
                  <defs>
                    <linearGradient id="wGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.72 0.19 160)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="oklch(0.72 0.19 160)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.018 240)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} width={35} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area type="monotone" dataKey="weight" name="Weight (kg)" stroke="oklch(0.72 0.19 160)" fill="url(#wGrad2)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="muscle" name="Muscle (kg)" stroke="oklch(0.65 0.18 200)" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                </ComposedChart>
              </ResponsiveContainer>
            ) : <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>}
          </div>

          {/* Body Fat & Water */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-4">Body Fat % Trend</h3>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="fatGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.78 0.20 50)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="oklch(0.78 0.20 50)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.018 240)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="fat" name="Body Fat %" stroke="oklch(0.78 0.20 50)" fill="url(#fatGrad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>}
            </div>

            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-4">BMI Trend</h3>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.018 240)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} width={30} domain={['auto', 'auto']} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="bmi" name="BMI" stroke="oklch(0.75 0.17 280)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="log" className="mt-4 space-y-3">
          {/* Sort/Filter bar */}
          {(() => {
            const sortedBodyRecords = (() => {
              let list = [...records];
              if (bodySearch.trim()) {
                const q = bodySearch.toLowerCase();
                list = list.filter(r => (r.notes || '').toLowerCase().includes(q));
              }
              switch (bodySort) {
                case 'date_asc': list.sort((a,b) => new Date(a.date).getTime()-new Date(b.date).getTime()); break;
                case 'date_desc': list.sort((a,b) => new Date(b.date).getTime()-new Date(a.date).getTime()); break;
                case 'weight_asc': list.sort((a,b) => Number(a.weight||999)-Number(b.weight||999)); break;
                case 'weight_desc': list.sort((a,b) => Number(b.weight||0)-Number(a.weight||0)); break;
                case 'bf_asc': list.sort((a,b) => Number(a.bodyFatPct||999)-Number(b.bodyFatPct||999)); break;
              }
              return list;
            })();
            return (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Input placeholder={t('common.search')+'...'} value={bodySearch} onChange={e=>setBodySearch(e.target.value)} className="h-8 text-xs w-40" />
                  <Select value={bodySort} onValueChange={v=>setBodySort(v as any)}>
                    <SelectTrigger className="h-8 w-44 text-xs"><ArrowUpDown className="w-3 h-3 mr-1"/><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date_desc">{t('common.sort_date_desc')}</SelectItem>
                      <SelectItem value="date_asc">{t('common.sort_date_asc')}</SelectItem>
                      <SelectItem value="weight_desc">{t('body.sort_weight_desc')}</SelectItem>
                      <SelectItem value="weight_asc">{t('body.sort_weight_asc')}</SelectItem>
                      <SelectItem value="bf_asc">{t('body.sort_bf_asc')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground ml-auto">{sortedBodyRecords.length} {t('common.records')}</span>
                </div>
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Date", "Weight", "Body Fat", "Muscle", "BMI", "Fat Mass", "Visceral Fat", "Notes", ""].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedBodyRecords.map(r => (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{formatHKDate(r.date)}</td>
                      <td className="px-4 py-3">{r.weight != null ? `${Number(r.weight).toFixed(1)} kg` : "—"}</td>
                      <td className="px-4 py-3">{r.bodyFatPct != null ? `${Number(r.bodyFatPct).toFixed(1)}%` : "—"}</td>
                      <td className="px-4 py-3">{r.muscleMass != null ? `${Number(r.muscleMass).toFixed(1)} kg` : "—"}</td>
                      <td className="px-4 py-3">{r.bmi != null ? Number(r.bmi).toFixed(1) : "—"}</td>
                      <td className="px-4 py-3">{r.fatMass != null ? `${Number(r.fatMass).toFixed(1)} kg` : "—"}</td>
                      <td className="px-4 py-3">{r.visceralFat ?? "—"}</td>
                      <td className="px-4 py-3 max-w-32 truncate text-muted-foreground">{r.notes || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => {
                            setEditEntry(r);
                            setForm({ date: r.date, weight: r.weight ?? "", bodyFatPct: r.bodyFatPct ?? "", muscleMass: r.muscleMass ?? "", bmi: r.bmi ?? "", fatMass: r.fatMass ?? "", visceralFat: r.visceralFat ?? "", bmr: r.bmr ?? "", notes: r.notes ?? "" });
                            setShowDialog(true);
                          }}><Edit2 className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => deleteMutation.mutate({ id: r.id })}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {sortedBodyRecords.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-8 text-muted-foreground text-sm">{t('common.no_records')}</td></tr>
                  )}
                </tbody>
              </table>
                  </div>
                </div>
              </>
            );
          })()}
        </TabsContent>
      </Tabs>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editEntry ? "Edit Body Metrics" : "Log Body Metrics"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Date</label>
              <Input type="date" value={form.date} onChange={e => setForm((f: any) => ({ ...f, date: e.target.value }))} />
            </div>
            {[
              { key: "weight", label: "Weight (kg)", step: "0.1" },
              { key: "bodyFatPct", label: "Body Fat (%)", step: "0.1" },
              { key: "muscleMass", label: "Muscle Mass (kg)", step: "0.1" },
              { key: "bmi", label: "BMI", step: "0.1" },
              { key: "fatMass", label: "Fat Mass (kg)", step: "0.1" },
              { key: "visceralFat", label: "Visceral Fat", step: "1" },
              { key: "bmr", label: "BMR (kcal)", step: "1" },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-muted-foreground mb-1 block">{f.label}</label>
                <Input type="number" step={f.step} value={form[f.key]} onChange={e => setForm((prev: any) => ({ ...prev, [f.key]: e.target.value }))} />
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
