import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useIsOwner } from "@/contexts/OwnerContext";
import { toast } from "sonner";
import { todayHKString, formatHKDate } from "@/lib/hkTime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Footprints, Trash2, Edit2, Loader2, ArrowUpDown, TrendingUp, Building2, Settings, Target, CheckCircle2, X } from "lucide-react";
import LogPhotoUploader, { LogPhotoUploaderRef } from "@/components/LogPhotoUploader";
import ScreenshotImporter from "@/components/ScreenshotImporter";
import { useTranslation } from "react-i18next";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from "recharts";

const defaultForm = {
  date: todayHKString(),
  steps: "", floorsClimbed: "", distanceKm: "",
  activeMinutes: "", calories: "", notes: ""
};

const DEFAULT_STEP_GOAL = 10000;
const DEFAULT_FLOOR_GOAL = 10;

function StepGoalRing({ steps, goal }: { steps: number; goal: number }) {
  const pct = Math.min(steps / goal, 1);
  const r = 36, cx = 44, cy = 44;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  const color = pct >= 1 ? "oklch(0.72 0.19 160)" : pct >= 0.7 ? "oklch(0.78 0.20 50)" : "oklch(0.68 0.22 25)";
  return (
    <svg width={88} height={88} viewBox="0 0 88 88">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="oklch(0.22 0.015 240)" strokeWidth={8} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`} style={{ transition: "stroke-dasharray 0.5s ease" }} />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={11} fontWeight={700} fill={color}>
        {steps >= 1000 ? `${(steps / 1000).toFixed(1)}k` : steps}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize={9} fill="oklch(0.60 0.010 240)">
        /{goal >= 1000 ? `${goal / 1000}k` : goal}
      </text>
    </svg>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-3 text-xs shadow-lg">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value?.toLocaleString()}</p>
      ))}
    </div>
  );
};

// Auto-calculate calories from steps using body weight
// Formula based on MET 3.5 (walking), stride ~0.75m:
// Calories = steps × 0.0004 × weight_kg + floors × 0.17 × weight_kg
function calcStepsCalories(steps: number, weightKg: number, floors = 0): number {
  return Math.round(steps * 0.0004 * weightKg + floors * 0.17 * weightKg);
}

export default function Steps() {
  const { t } = useTranslation();
  const isOwner = useIsOwner();
  const [showDialog, setShowDialog] = useState(false);
  const [editEntry, setEditEntry] = useState<any>(null);
  const [form, setForm] = useState<any>(defaultForm);
  const photoUploaderRef = useRef<LogPhotoUploaderRef>(null);
  const [sort, setSort] = useState<'date_desc' | 'date_asc' | 'steps_desc' | 'floors_desc'>('date_desc');
  const [search, setSearch] = useState('');
  const [stepGoal, setStepGoal] = useState<number>(() => {
    const saved = localStorage.getItem('bf-step-goal');
    return saved ? Number(saved) : DEFAULT_STEP_GOAL;
  });
  const [floorGoal, setFloorGoal] = useState<number>(() => {
    const saved = localStorage.getItem('bf-floor-goal');
    return saved ? Number(saved) : DEFAULT_FLOOR_GOAL;
  });
  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [goalForm, setGoalForm] = useState({ steps: String(stepGoal), floors: String(floorGoal) });

  const handleSaveGoals = useCallback(() => {
    const s = Number(goalForm.steps);
    const f = Number(goalForm.floors);
    if (!s || s < 100 || s > 100000) return toast.error('步數目標需在 100 至 100,000 之間');
    if (!f || f < 1 || f > 200) return toast.error('樓層目標需在 1 至 200 之間');
    setStepGoal(s);
    setFloorGoal(f);
    localStorage.setItem('bf-step-goal', String(s));
    localStorage.setItem('bf-floor-goal', String(f));
    setShowGoalDialog(false);
    toast.success('目標已更新');
  }, [goalForm]);

  const utils = trpc.useUtils();
  const { data: records = [], isLoading } = trpc.steps.getAll.useQuery({ limit: 365 });
  // Fetch body weight on or before the selected date for accurate calorie estimation
  const { data: weightRecord } = trpc.body.getWeightOnOrBefore.useQuery(
    { date: form.date || todayHKString() },
    { enabled: !!form.date }
  );
  const latestWeight: number = (weightRecord as any)?.weight ?? 70; // default 70kg if no record

  const addMutation = trpc.steps.add.useMutation({
    onSuccess: async (newRecord) => {
      if (photoUploaderRef.current?.hasStagedFiles()) {
        await photoUploaderRef.current.uploadStagedFiles(newRecord.id);
      }
      utils.steps.getAll.invalidate();
      toast.success(t('steps.logged'));
      setShowDialog(false);
      setForm(defaultForm);
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.steps.update.useMutation({
    onSuccess: () => { utils.steps.getAll.invalidate(); toast.success(t('common.updated')); setShowDialog(false); setEditEntry(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.steps.delete.useMutation({
    onSuccess: () => { utils.steps.getAll.invalidate(); toast.success(t('common.deleted')); },
    onError: (e) => toast.error(e.message),
  });
  const backfillMutation = trpc.steps.backfillCalories.useMutation({
    onSuccess: (result) => {
      utils.steps.getAll.invalidate();
      toast.success(`已更新 ${result.updated} / ${result.total} 筆步數記錄（含樓梯加成公式）`);
    },
    onError: (e) => toast.error(e.message),
  });

  // Auto-calculate calories when steps change (for both new entries and edits)
  useEffect(() => {
    if (form.steps) {
      const steps = Number(form.steps);
      const floors = Number(form.floorsClimbed) || 0;
      if (steps > 0) {
        const estimated = calcStepsCalories(steps, latestWeight, floors);
        setForm((f: any) => ({ ...f, calories: String(estimated) }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.steps, form.floorsClimbed, latestWeight]);

  const handleSubmit = () => {
    const payload = {
      date: form.date,
      steps: form.steps ? Number(form.steps) : undefined,
      floorsClimbed: form.floorsClimbed ? Number(form.floorsClimbed) : undefined,
      distanceKm: form.distanceKm || undefined,
      activeMinutes: form.activeMinutes ? Number(form.activeMinutes) : undefined,
      calories: form.calories ? Number(form.calories) : undefined,
      notes: form.notes || undefined,
    };
    if (editEntry) updateMutation.mutate({ id: editEntry.id, ...payload });
    else addMutation.mutate(payload);
  };

  // Stats
  const today = records[0];
  const last7 = records.slice(0, 7);
  const avgSteps7 = last7.length ? Math.round(last7.reduce((s, r) => s + (r.steps ?? 0), 0) / last7.length) : 0;
  const avgFloors7 = last7.length ? Math.round(last7.reduce((s, r) => s + (r.floorsClimbed ?? 0), 0) / last7.length) : 0;
  const totalSteps30 = records.slice(0, 30).reduce((s, r) => s + (r.steps ?? 0), 0);

  // Chart data (last 30 days reversed for chronological order)
  const chartData = useMemo(() => {
    return records.slice(0, 30).reverse().map(r => ({
      date: formatHKDate(r.date).slice(5),
      steps: r.steps ?? 0,
      floors: r.floorsClimbed ?? 0,
    }));
  }, [records]);

  // Sorted/filtered list
  const sortedList = useMemo(() => {
    let list = [...records];
    if (search.trim()) list = list.filter(r => (r.notes || '').toLowerCase().includes(search.toLowerCase()) || r.date.includes(search));
    switch (sort) {
      case 'date_asc': list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); break;
      case 'date_desc': list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); break;
      case 'steps_desc': list.sort((a, b) => (b.steps ?? 0) - (a.steps ?? 0)); break;
      case 'floors_desc': list.sort((a, b) => (b.floorsClimbed ?? 0) - (a.floorsClimbed ?? 0)); break;
    }
    return list;
  }, [records, sort, search]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Footprints className="w-6 h-6 text-primary" />
            {t('steps.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('steps.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {isOwner && (
            <Button variant="outline" size="sm" onClick={() => backfillMutation.mutate()} disabled={backfillMutation.isPending} className="gap-1.5 text-xs">
              {backfillMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
              重新計算卡路里
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => { setGoalForm({ steps: String(stepGoal), floors: String(floorGoal) }); setShowGoalDialog(true); }} className="gap-1.5 text-xs">
            <Target className="w-3.5 h-3.5" /> 設定目標
          </Button>
          {isOwner && (
            <Button onClick={() => { setEditEntry(null); setForm(defaultForm); setShowDialog(true); }} className="gap-2">
              <Plus className="w-4 h-4" /> {t('steps.add')}
            </Button>
          )}
        </div>
      </div>

      {/* Achievement stats row */}
      {records.length > 0 && (() => {
        const last7recs = records.slice(0, 7);
        const last30recs = records.slice(0, 30);
        const hit7 = last7recs.filter(r => (r.steps ?? 0) >= stepGoal).length;
        const hit30 = last30recs.filter(r => (r.steps ?? 0) >= stepGoal).length;
        const pct7 = last7recs.length ? Math.round(hit7 / last7recs.length * 100) : 0;
        const pct30 = last30recs.length ? Math.round(hit30 / last30recs.length * 100) : 0;
        return (
          <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-2xl p-4 flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-foreground">步數目標達標率</span>
            </div>
            <div className="flex gap-6 flex-wrap">
              <div className="text-center">
                <p className="text-lg font-bold text-green-500">{pct7}%</p>
                <p className="text-xs text-muted-foreground">迗7日 ({hit7}/{last7recs.length}天)</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-blue-500">{pct30}%</p>
                <p className="text-xs text-muted-foreground">迗30日 ({hit30}/{last30recs.length}天)</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-amber-500">{stepGoal.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">每日目標步數</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Today's summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center gap-2">
          <p className="text-xs text-muted-foreground">{t('steps.today_steps')}</p>
          <StepGoalRing steps={today?.steps ?? 0} goal={stepGoal} />
          <p className="text-xs text-muted-foreground">{t('steps.goal')}: {stepGoal.toLocaleString()}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center justify-center gap-1">
          <Building2 className="w-6 h-6 text-blue-400" />
          <p className="text-2xl font-bold text-foreground">{today?.floorsClimbed ?? 0}</p>
          <p className="text-xs text-muted-foreground">{t('steps.today_floors')}</p>
          <p className="text-xs text-muted-foreground">{t('steps.goal')}: {floorGoal}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center justify-center gap-1">
          <TrendingUp className="w-6 h-6 text-green-400" />
          <p className="text-2xl font-bold text-foreground">{avgSteps7.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{t('steps.avg_7d_steps')}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center justify-center gap-1">
          <Footprints className="w-6 h-6 text-orange-400" />
          <p className="text-2xl font-bold text-foreground">{(totalSteps30 / 1000).toFixed(0)}k</p>
          <p className="text-xs text-muted-foreground">{t('steps.total_30d')}</p>
        </div>
      </div>

      <Tabs defaultValue="chart">
        <TabsList>
          <TabsTrigger value="chart">{t('common.chart')}</TabsTrigger>
          <TabsTrigger value="log">{t('common.log')}</TabsTrigger>
        </TabsList>

        <TabsContent value="chart" className="mt-4 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-foreground mb-4">{t('steps.steps_chart_30d')}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.018 240)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={{ fontSize: 10, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} width={45} tickFormatter={v => v >= 1000 ? `${v / 1000}k` : v} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="steps" name={t('steps.steps')} fill="oklch(0.75 0.17 280)" radius={[3, 3, 0, 0]} />
                <ReferenceLine y={stepGoal} stroke="oklch(0.68 0.22 25)" strokeDasharray="6 3" strokeWidth={1.5}
                  label={{ value: `目標 ${stepGoal >= 1000 ? `${stepGoal / 1000}k` : stepGoal}`, position: 'insideTopRight', fontSize: 10, fill: 'oklch(0.68 0.22 25)' }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-foreground mb-4">{t('steps.floors_chart_30d')}</h3>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.018 240)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={{ fontSize: 10, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} width={30} />
                <Tooltip content={<CustomTooltip />} />
                <Area dataKey="floors" name={t('steps.floors')} stroke="oklch(0.65 0.18 200)" fill="oklch(0.65 0.18 200 / 0.2)" strokeWidth={2} />
                <ReferenceLine y={floorGoal} stroke="oklch(0.68 0.22 25)" strokeDasharray="6 3" strokeWidth={1.5}
                  label={{ value: `目標 ${floorGoal}F`, position: 'insideTopRight', fontSize: 10, fill: 'oklch(0.68 0.22 25)' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        <TabsContent value="log" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder={t('common.search') + '...'} value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-xs w-40" />
            <Select value={sort} onValueChange={v => setSort(v as any)}>
              <SelectTrigger className="h-8 w-44 text-xs"><ArrowUpDown className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">{t('common.sort_date_desc')}</SelectItem>
                <SelectItem value="date_asc">{t('common.sort_date_asc')}</SelectItem>
                <SelectItem value="steps_desc">{t('steps.sort_steps_desc')}</SelectItem>
                <SelectItem value="floors_desc">{t('steps.sort_floors_desc')}</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto">{sortedList.length} {t('common.records')}</span>
          </div>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {[t('common.date'), t('steps.steps'), t('steps.floors'), t('steps.distance'), t('steps.active_min'), t('steps.calories'), t('common.notes'), ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedList.map(r => (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{formatHKDate(r.date)}</td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${(r.steps ?? 0) >= stepGoal ? 'text-green-400' : 'text-foreground'}`}>
                          {r.steps?.toLocaleString() ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${(r.floorsClimbed ?? 0) >= floorGoal ? 'text-blue-400' : 'text-foreground'}`}>
                          {r.floorsClimbed ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">{r.distanceKm ? `${Number(r.distanceKm).toFixed(2)} km` : '—'}</td>
                      <td className="px-4 py-3">{r.activeMinutes ? `${r.activeMinutes} min` : '—'}</td>
                      <td className="px-4 py-3">{r.calories ? `${r.calories} kcal` : '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-32 truncate">{r.notes ?? '—'}</td>
                      <td className="px-4 py-3">
                        <LogPhotoUploader logId={r.id} type="steps" compact />
                      </td>
                      {isOwner && (
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => {
                            setEditEntry(r);
                            setForm({ date: r.date, steps: r.steps ?? '', floorsClimbed: r.floorsClimbed ?? '', distanceKm: r.distanceKm ?? '', activeMinutes: r.activeMinutes ?? '', calories: r.calories ?? '', notes: r.notes ?? '' });
                            setShowDialog(true);
                          }}><Edit2 className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => deleteMutation.mutate({ id: r.id })}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </td>
                      )}
                    </tr>
                  ))}
                  {sortedList.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-8 text-muted-foreground text-sm">{t('common.no_records')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editEntry ? t('steps.edit') : t('steps.add')}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <ScreenshotImporter
                dataType="steps"
                onExtracted={(fields) => setForm((p: any) => ({ ...p, ...fields }))}
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">{t('common.date')}</label>
              <Input type="date" value={form.date} onChange={e => setForm((f: any) => ({ ...f, date: e.target.value }))} />
            </div>
            {[
              { key: 'steps', label: t('steps.steps'), placeholder: '10000' },
              { key: 'floorsClimbed', label: t('steps.floors'), placeholder: '10' },
              { key: 'distanceKm', label: t('steps.distance') + ' (km)', placeholder: '7.5', step: '0.01' },
              { key: 'activeMinutes', label: t('steps.active_min'), placeholder: '60' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-muted-foreground mb-1 block">{f.label}</label>
                <Input type="number" step={f.step ?? '1'} placeholder={f.placeholder} value={form[f.key]} onChange={e => setForm((prev: any) => ({ ...prev, [f.key]: e.target.value }))} />
              </div>
            ))}
            {/* Calories - auto-calculated from steps + body weight */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                {t('steps.calories')} (kcal)
                {form.steps && (
                  <span className="ml-1 text-primary text-[10px]">
                    · 自動估算 ({latestWeight}kg
                    {weightRecord && (weightRecord as any).date !== form.date
                      ? ` · 體重來自 ${(weightRecord as any).date}`
                      : ''}
                    )
                  </span>
                )}
              </label>
              <Input
                type="number"
                placeholder="400"
                value={form.calories}
                onChange={e => setForm((prev: any) => ({ ...prev, calories: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">{t('common.notes')}</label>
              <Input placeholder={t('common.optional_notes')} value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">截圖上載</label>
              <LogPhotoUploader ref={photoUploaderRef} logId={editEntry ? editEntry.id : null} type="steps" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); setEditEntry(null); }}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmit} disabled={addMutation.isPending || updateMutation.isPending}>
              {(addMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Goal Setting Dialog */}
      <Dialog open={showGoalDialog} onOpenChange={setShowGoalDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Target className="w-4 h-4 text-primary" />設定每日目標</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">每日步數目標</label>
              <Input type="number" min={100} max={100000} step={500} value={goalForm.steps}
                onChange={e => setGoalForm(f => ({ ...f, steps: e.target.value }))} />
              <p className="text-xs text-muted-foreground mt-1">建議：8,000–8,000 步（一般成人），10,000 步（活躍目標）</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">每日樓層目標</label>
              <Input type="number" min={1} max={200} step={1} value={goalForm.floors}
                onChange={e => setGoalForm(f => ({ ...f, floors: e.target.value }))} />
              <p className="text-xs text-muted-foreground mt-1">建議：10 層（一般成人）</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGoalDialog(false)}>取消</Button>
            <Button onClick={handleSaveGoals}>儲存目標</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
