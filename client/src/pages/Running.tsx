import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { todayHKString, formatHKDate, formatHKChartDate } from "@/lib/hkTime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Footprints, Plus, Trash2, Edit2, Loader2, Activity, Timer, Heart, Sparkles, Bot, Trophy, Star, MapPin, Calendar, Clock, Award, Flag, Zap, Package, Camera, ImageIcon, ArrowUpDown, Thermometer, Wind, Droplets, Download } from "lucide-react";
import LogPhotoUploader, { LogPhotoUploaderRef } from "@/components/LogPhotoUploader";
import ScreenshotImporter from "@/components/ScreenshotImporter";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ComposedChart, Area
} from "recharts";
import { Streamdown } from "streamdown";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatPace = (secPerKm: number | null | undefined): string => {
  if (!secPerKm || secPerKm <= 0) return "—";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
};

const parsePaceField = (val: string | null | undefined): number => {
  if (!val) return 0;
  const f = parseFloat(val);
  if (isNaN(f)) return 0;
  return f * 60;
};

const formatDuration = (h: number, m: number, s: number): string => {
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0) parts.push(`${s}s`);
  return parts.join(" ") || "—";
};

const RUNNING_TYPES = ["Easy", "Tempo", "Interval", "Long Run", "Race", "Trail", "Recovery", "Fartlek", "Sprint", "Time Trial", "其他"];
const WEEKS_OPTIONS = [4, 8, 12, 24, 52];

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
  maxCadence: "",
  avgStrideLengthM: "",
  avgVerticalRatio: "",
  verticalOscillationCm: "",
  calories: "",
  notes: "",
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function Running() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const [showDialog, setShowDialog] = useState(false);
  const [editEntry, setEditEntry] = useState<any>(null);
  const [form, setForm] = useState<any>(defaultForm);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [aiWeeks, setAiWeeks] = useState(12);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  // Sort state
  const [shoeSort, setShoeSort] = useState<'status' | 'mileage' | 'name' | 'purchase'>('status');
  const [raceSort, setRaceSort] = useState<'date' | 'distance' | 'name'>('date');
  // Log sort/filter state
  const [logSort, setLogSort] = useState<'date_desc' | 'date_asc' | 'distance_desc' | 'pace_asc' | 'hr_asc'>('date_desc');
  const [logFilterType, setLogFilterType] = useState<string>('all');
  const [logSearch, setLogSearch] = useState('');

  // Shoe Locker state
  const [showShoeDialog, setShowShoeDialog] = useState(false);
  const [editShoe, setEditShoe] = useState<any>(null);
  const [shoeForm, setShoeForm] = useState<any>({ shoesName: '', brand: '', model: '', status: 'Active', purchaseDate: '', firstUseDate: '', retirementDate: '', initialKm: '', maxKm: '800', notes: '', price: '', photoUrl: '' });
  const [deleteShoeConfirm, setDeleteShoeConfirm] = useState<number | null>(null);

  // Race Events state
  const [showRaceDialog, setShowRaceDialog] = useState(false);
  const [editRace, setEditRace] = useState<any>(null);
  const [raceForm, setRaceForm] = useState<any>({ raceName: '', date: todayHKString(), distanceKm: '', location: '', registration: '', bibNo: '', isPb: false, finishTime: '', finishHr: '', finishMin: '', finishSec: '', targetHr: '', targetMin: '', targetSec: '', overallPlace: '', ageGroupPlace: '', genderGroupPlace: '', runningShoes: '', notes: '' });
  const [deleteRaceConfirm, setDeleteRaceConfirm] = useState<number | null>(null);

  // Hoisted so both PB cards and race list can call it
  const openEditRace = (race: any) => {
    setEditRace(race);
    setRaceForm({
      raceName: race.race_name || '',
      date: race.date || todayHKString(),
      distanceKm: race.distance_km != null ? String(race.distance_km) : '',
      location: race.location || '',
      registration: race.registration || '',
      bibNo: race.bib_no || '',
      isPb: race.is_pb || false,
      finishTime: race.finish_time || '',
      finishHr: race.finish_hr != null ? String(race.finish_hr) : '',
      finishMin: race.finish_min != null ? String(race.finish_min) : '',
      finishSec: race.finish_sec != null ? String(race.finish_sec) : '',
      targetHr: race.target_hr != null ? String(race.target_hr) : '',
      targetMin: race.target_min != null ? String(race.target_min) : '',
      targetSec: race.target_sec != null ? String(race.target_sec) : '',
      overallPlace: race.overall_place != null ? String(race.overall_place) : '',
      ageGroupPlace: race.age_group_place != null ? String(race.age_group_place) : '',
      genderGroupPlace: race.gender_group_place != null ? String(race.gender_group_place) : '',
      runningShoes: race.running_shoes || '',
      notes: race.notes || '',
    });
    setShowRaceDialog(true);
  };

  const utils = trpc.useUtils();
  const { data: logs = [], isLoading } = trpc.running.getLogs.useQuery({ limit: 200 });
  const { data: stats } = trpc.running.getStats.useQuery();
  const { data: activeShoes = [] } = trpc.running.getActiveShoes.useQuery();
  const { data: allShoes = [] } = trpc.running.getShoes.useQuery();
  const { data: races = [] } = trpc.running.getRaces.useQuery();
  const { data: racesEnriched = [] } = trpc.running.getRacesEnriched.useQuery();
  const { data: pbs = [] } = trpc.running.getPBs.useQuery();
  const { data: hrLogs = [] } = trpc.heartRate.getAll.useQuery({ limit: 30 });
  const { data: maxHrData } = trpc.heartRate.getMaxHr.useQuery();

  // Shoe run history modal state
  const [shoeHistoryModal, setShoeHistoryModal] = useState<{ shoe: any; runs: any[] } | null>(null);
  const [loadingShoeHistory, setLoadingShoeHistory] = useState<number | null>(null);
  const shoeHistoryQuery = trpc.running.getShoeRunHistory.useQuery(
    { shoeId: loadingShoeHistory ?? undefined },
    { enabled: loadingShoeHistory !== null }
  );

  // Countdown timer
  const [now, setNow] = useState(() => new Date());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    timerRef.current = setInterval(() => setNow(new Date()), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Open shoe history
  const openShoeHistory = (shoe: any) => {
    setLoadingShoeHistory(Number(shoe.id));
  };
  useEffect(() => {
    if (loadingShoeHistory !== null && !shoeHistoryQuery.isLoading && shoeHistoryQuery.data) {
      const shoe = (allShoes as any[]).find((s: any) => Number(s.id) === loadingShoeHistory);
      setShoeHistoryModal({ shoe, runs: shoeHistoryQuery.data as any[] });
      setLoadingShoeHistory(null);
    }
  }, [loadingShoeHistory, shoeHistoryQuery.isLoading, shoeHistoryQuery.data]);

  // ─── Photo uploader ref ──────────────────────────────────────────────────────
  const photoUploaderRef = useRef<LogPhotoUploaderRef>(null);

  // ─── Mutations ───────────────────────────────────────────────────────────────
  const addMutation = trpc.running.addLog.useMutation({
    onSuccess: async (newRecord) => {
      if (photoUploaderRef.current?.hasStagedFiles()) {
        await photoUploaderRef.current.uploadStagedFiles(newRecord.id);
      }
      utils.running.getLogs.invalidate();
      utils.running.getStats.invalidate();
      toast.success(t("running.add_record"));
      setShowDialog(false);
      setForm(defaultForm);
    },
    onError: (e) => toast.error(t("common.error") + ": " + e.message),
  });

  const updateMutation = trpc.running.updateLog.useMutation({
    onSuccess: () => {
      utils.running.getLogs.invalidate();
      utils.running.getStats.invalidate();
      toast.success(t("common.success"));
      setEditEntry(null);
      setShowDialog(false);
      setForm(defaultForm);
    },
    onError: (e) => toast.error(t("common.error") + ": " + e.message),
  });

  const deleteMutation = trpc.running.deleteLog.useMutation({
    onSuccess: () => {
      utils.running.getLogs.invalidate();
      utils.running.getStats.invalidate();
      toast.success(t("common.success"));
      setDeleteConfirm(null);
    },
    onError: () => toast.error(t("common.error")),
  });

  const aiMutation = trpc.running.getAIAnalysis.useMutation({
    onSuccess: (data) => {
      setAiAnalysis(typeof data.analysis === 'string' ? data.analysis : null);
    },
    onError: (e) => toast.error(t("common.error") + ": " + e.message),
  });

  // Training plan state
  const [trainingPlan, setTrainingPlan] = useState<string | null>(null);
  const [planWeeks, setPlanWeeks] = useState(12);
  const [planGoalRaceId, setPlanGoalRaceId] = useState<string>('__none__');
  const [planGoalFinishHr, setPlanGoalFinishHr] = useState('');
  const [planGoalFinishMin, setPlanGoalFinishMin] = useState('');
  const [planGoalFinishSec, setPlanGoalFinishSec] = useState('');
  const trainingPlanMutation = trpc.running.generateTrainingPlan.useMutation({
    onSuccess: (data) => { setTrainingPlan(typeof data.plan === 'string' ? data.plan : null); },
    onError: (e) => toast.error(t('common.error') + ': ' + e.message),
  });

  // Shoe mutations
  const addShoeMutation = trpc.running.addShoe.useMutation({
    onSuccess: () => { utils.running.getShoes.invalidate(); utils.running.getActiveShoes.invalidate(); toast.success(t('running.add_shoe') + ' ✓'); setShowShoeDialog(false); setShoeForm({ shoesName: '', brand: '', model: '', status: 'Active', purchaseDate: '', firstUseDate: '', retirementDate: '', initialKm: '', maxKm: '800', notes: '', price: '', photoUrl: '' }); },
    onError: (e) => toast.error('錯誤: ' + e.message),
  });
  const updateShoeMutation = trpc.running.updateShoe.useMutation({
    onSuccess: () => { utils.running.getShoes.invalidate(); utils.running.getActiveShoes.invalidate(); toast.success('跑鞋已更新'); setShowShoeDialog(false); setEditShoe(null); },
    onError: (e) => toast.error('錯誤: ' + e.message),
  });
  const deleteShoeMutation = trpc.running.deleteShoe.useMutation({
    onSuccess: () => { utils.running.getShoes.invalidate(); utils.running.getActiveShoes.invalidate(); toast.success('跑鞋已刪除'); setDeleteShoeConfirm(null); },
    onError: (e) => toast.error('錯誤: ' + e.message),
  });

  // Race mutations
  const addRaceMutation = trpc.running.addRace.useMutation({
    onSuccess: () => { utils.running.getRaces.invalidate(); utils.running.getPBs.invalidate(); utils.running.getRacesEnriched.invalidate(); toast.success('賽事已新增'); setShowRaceDialog(false); setRaceForm({ raceName: '', date: todayHKString(), distanceKm: '', location: '', registration: '', bibNo: '', isPb: false, finishTime: '', finishHr: '', finishMin: '', finishSec: '', targetHr: '', targetMin: '', targetSec: '', overallPlace: '', ageGroupPlace: '', genderGroupPlace: '', runningShoes: '', notes: '' }); },
    onError: (e) => toast.error('錯誤: ' + e.message),
  });
  const updateRaceMutation = trpc.running.updateRace.useMutation({
    onSuccess: () => { utils.running.getRaces.invalidate(); utils.running.getPBs.invalidate(); toast.success('賽事已更新'); setShowRaceDialog(false); setEditRace(null); },
    onError: (e) => toast.error('錯誤: ' + e.message),
  });
  const deleteRaceMutation = trpc.running.deleteRace.useMutation({
    onSuccess: () => { utils.running.getRaces.invalidate(); utils.running.getPBs.invalidate(); toast.success('賽事已刪除'); setDeleteRaceConfirm(null); },
    onError: (e) => toast.error('錯誤: ' + e.message),
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
      maxCadence: row.max_cadence != null ? String(row.max_cadence) : "",
      avgStrideLengthM: row.avg_stride_length_m != null ? String(row.avg_stride_length_m) : "",
      avgVerticalRatio: row.avg_vertical_ratio != null ? String(row.avg_vertical_ratio) : "",
      verticalOscillationCm: row.vertical_oscillation_cm != null ? String(row.vertical_oscillation_cm) : "",
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
      maxCadence: form.maxCadence ? parseFloat(form.maxCadence) : undefined,
      avgStrideLengthM: form.avgStrideLengthM ? parseFloat(form.avgStrideLengthM) : undefined,
      avgVerticalRatio: form.avgVerticalRatio ? parseFloat(form.avgVerticalRatio) : undefined,
      verticalOscillationCm: form.verticalOscillationCm ? parseFloat(form.verticalOscillationCm) : undefined,
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

  // ─── Sorted shoes and races ─────────────────────────────────────────────────
  const sortedShoes = useMemo(() => {
    const shoes = [...(allShoes as any[])];
    const statusOrder: Record<string, number> = { 'Active': 0, 'Not Yet Opened': 1, 'Retired': 2 };
    switch (shoeSort) {
      case 'status': return shoes.sort((a, b) => {
        const aStatus = a.retirement_date ? 'Retired' : a.firstusedate ? 'Active' : 'Not Yet Opened';
        const bStatus = b.retirement_date ? 'Retired' : b.firstusedate ? 'Active' : 'Not Yet Opened';
        return (statusOrder[aStatus] ?? 3) - (statusOrder[bStatus] ?? 3);
      });
      case 'mileage': return shoes.sort((a, b) => {
        const aKm = parseFloat(a.total_km || 0) + parseFloat(a.initial_km || 0);
        const bKm = parseFloat(b.total_km || 0) + parseFloat(b.initial_km || 0);
        return bKm - aKm;
      });
      case 'name': return shoes.sort((a, b) => (a.shoes_name || '').localeCompare(b.shoes_name || ''));
      case 'purchase': return shoes.sort((a, b) => {
        const aDate = a.purchase_date || '';
        const bDate = b.purchase_date || '';
        return bDate.localeCompare(aDate);
      });
      default: return shoes;
    }
  }, [allShoes, shoeSort]);

  const sortedRacesList = useMemo(() => {
    const raceList = [...(races as any[])];
    switch (raceSort) {
      case 'date': return raceList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      case 'distance': return raceList.sort((a, b) => parseFloat(b.distance_km || 0) - parseFloat(a.distance_km || 0));
      case 'name': return raceList.sort((a, b) => (a.race_name || '').localeCompare(b.race_name || ''));
      default: return raceList;
    }
  }, [races, raceSort]);

  // ─── Sorted/filtered log ────────────────────────────────────────────────────
  const sortedFilteredLogs = useMemo(() => {
    let list = [...(logs as any[])];
    if (logFilterType !== 'all') list = list.filter((r: any) => r.running_type === logFilterType);
    if (logSearch.trim()) {
      const q = logSearch.toLowerCase();
      list = list.filter((r: any) => (
        (r.running_type || '').toLowerCase().includes(q) ||
        (r.running_shoes || '').toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q)
      ));
    }
    switch (logSort) {
      case 'date_asc': list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); break;
      case 'date_desc': list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); break;
      case 'distance_desc': list.sort((a, b) => parseFloat(b.distance_km || 0) - parseFloat(a.distance_km || 0)); break;
      case 'pace_asc': list.sort((a, b) => parsePaceField(a.average_pace) - parsePaceField(b.average_pace)); break;
      case 'hr_asc': list.sort((a, b) => (a.average_heart_rate ?? 999) - (b.average_heart_rate ?? 999)); break;
    }
    return list;
  }, [logs, logSort, logFilterType, logSearch]);

  // ─── Summary stats ───────────────────────────────────────────────────────────
  const summary = stats?.summary as any;
  const totalRuns = summary ? Number(summary.total_runs) : 0;
  const totalDist = summary ? parseFloat(summary.total_distance || 0).toFixed(1) : "0.0";
  const avgPaceSec = summary ? parsePaceField(summary.avg_pace_sec ? String(summary.avg_pace_sec) : null) : 0;
  const avgHr = summary ? Math.round(Number(summary.avg_hr || 0)) : 0;

  // ─── Derived data for header ─────────────────────────────────────────────────
  const latestHr = (hrLogs as any[]).length > 0 ? (hrLogs as any[])[0] : null;
  const restingHr = latestHr?.restingHr ?? null;
  // Use all-time maximum highHr from the entire heart_rate_logs table
  const maxHrForZones = (maxHrData as any)?.maxHr ?? latestHr?.highHr ?? 202;
  const finishedRacesCount = (races as any[]).filter((r: any) => new Date(r.date + 'T00:00:00+08:00') <= now).length;
  const totalShoesCount = (allShoes as any[]).length;
  const nextRace = [...(races as any[])]
    .filter((r: any) => new Date(r.date + 'T00:00:00+08:00') > now)
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
  const otherUpcoming = [...(races as any[])]
    .filter((r: any) => new Date(r.date + 'T00:00:00+08:00') > now)
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(1, 4);

  // HR Zones (Karvonen)
  const hrZones = restingHr && maxHrForZones ? [
    { label: 'ZONE 1', pct: '59–74%', lo: Math.round(restingHr + 0.59 * (maxHrForZones - restingHr)), hi: Math.round(restingHr + 0.74 * (maxHrForZones - restingHr)), color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
    { label: 'ZONE 2', pct: '74–84%', lo: Math.round(restingHr + 0.74 * (maxHrForZones - restingHr)), hi: Math.round(restingHr + 0.84 * (maxHrForZones - restingHr)), color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20' },
    { label: 'ZONE 3', pct: '84–88%', lo: Math.round(restingHr + 0.84 * (maxHrForZones - restingHr)), hi: Math.round(restingHr + 0.88 * (maxHrForZones - restingHr)), color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20' },
    { label: 'ZONE 4', pct: '88–95%', lo: Math.round(restingHr + 0.88 * (maxHrForZones - restingHr)), hi: Math.round(restingHr + 0.95 * (maxHrForZones - restingHr)), color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' },
    { label: 'ZONE 5', pct: '95–100%', lo: Math.round(restingHr + 0.95 * (maxHrForZones - restingHr)), hi: maxHrForZones, color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
  ] : [];

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Gradient hero banner */}
      <div className="rounded-2xl p-5 text-white" style={{background: 'linear-gradient(135deg, oklch(0.62 0.20 45) 0%, oklch(0.68 0.19 25) 100%)'}}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
              <Footprints className="w-5 h-5" />
              {t('running.title')}
            </h1>
            <p className="text-white/70 text-sm mt-0.5">{t('running.subtitle')}</p>
          </div>
          <Button onClick={openAdd} size="sm" className="bg-white text-orange-600 hover:bg-white/90 font-semibold">
            <Plus className="w-4 h-4 mr-1" /> {t('running.add_record')}
          </Button>
        </div>
      </div>

      {/* 5 Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { labelKey: 'running.total_distance', value: totalDist, unit: 'km', icon: MapPin, badgeClass: 'icon-badge-orange' },
          { labelKey: 'running.total_shoes', value: totalShoesCount, unit: '', icon: Package, badgeClass: 'icon-badge-purple' },
          { labelKey: 'running.finished_races', value: finishedRacesCount, unit: '', icon: Trophy, badgeClass: 'icon-badge-yellow' },
          { labelKey: 'running.total_activities', value: totalRuns, unit: '', icon: Activity, badgeClass: 'icon-badge-green' },
          { labelKey: 'running.resting_hr', value: restingHr, unit: 'bpm', icon: Heart, badgeClass: 'icon-badge-red' },
        ].map((s) => (
          <div key={s.labelKey} className="stat-card rounded-2xl p-4">
            <div className={`icon-badge ${s.badgeClass} mb-2`}>
              <s.icon className="w-4 h-4" />
            </div>
            <p className="text-xs text-muted-foreground font-semibold">{t(s.labelKey)}</p>
            <p className="metric-value text-2xl text-foreground mt-0.5">
              {s.value ?? '—'}{s.unit && s.value != null ? <span className="text-sm font-normal text-muted-foreground ml-1">{s.unit}</span> : null}
            </p>
          </div>
        ))}
      </div>

      {/* Next Race countdown */}
      {nextRace && (() => {
        const raceDate = new Date(nextRace.date + 'T00:00:00+08:00');
        const diffMs = raceDate.getTime() - now.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHrs = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const diffMin = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const diffSec = Math.floor((diffMs % (1000 * 60)) / 1000);
        return (
          <div className="rounded-2xl border border-red-500/20 p-5 shadow-sm" style={{background: 'linear-gradient(135deg, oklch(0.97 0.02 25) 0%, oklch(0.98 0.01 45) 100%)'}}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-red-500 flex items-center gap-1 mb-1">
                  <Zap className="w-3.5 h-3.5" /> {t('running.next_race')}
                </p>
                <p className="text-xl font-extrabold text-foreground">{nextRace.race_name}</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{nextRace.date}</span>
                  {nextRace.distance_km && <span className="flex items-center gap-1"><Flag className="w-3.5 h-3.5" />{parseFloat(nextRace.distance_km).toFixed(1)} km</span>}
                  {nextRace.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{nextRace.location}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {[{v: diffDays, l: t('running.days')}, {v: diffHrs, l: t('running.hrs')}, {v: diffMin, l: t('running.min_label')}, {v: diffSec, l: t('running.sec')}].map(({v, l}, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-extrabold text-xl shadow-sm ${
                      i === 3 ? 'bg-red-500/15 text-red-500 border border-red-500/20' : 'bg-white dark:bg-muted text-foreground border border-border'
                    }`}>{String(v).padStart(2, '0')}</div>
                    <p className="text-[9px] text-muted-foreground mt-1 font-semibold uppercase">{l}</p>
                  </div>
                ))}
              </div>
            </div>
            {otherUpcoming.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border/50">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t('running.also_coming_up')}</p>
                <div className="flex gap-2 flex-wrap">
                  {otherUpcoming.map((r: any) => {
                    const d = Math.ceil((new Date(r.date + 'T00:00:00+08:00').getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={r.id} className="flex items-center gap-2 bg-white/60 dark:bg-muted/50 border border-border rounded-full px-3 py-1 text-xs">
                        <span className="text-foreground font-medium truncate max-w-[120px]">{r.race_name}</span>
                        <span className="text-red-500 font-bold shrink-0">{d}d</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* HR Zones */}
      {hrZones.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
            <Heart className="w-4 h-4 text-red-500" /> {t('running.hr_zones')}
          </h3>
          <p className="text-xs text-muted-foreground mb-3">{t('running.hr_zones_based')} {maxHrForZones} bpm {t('running.and_resting')} {restingHr} bpm</p>
          <div className="grid grid-cols-5 gap-2">
            {hrZones.map((z) => (
              <div key={z.label} className={`border rounded-xl p-2.5 text-center ${z.color}`}>
                <p className="text-[10px] font-bold">{z.label}</p>
                <p className="text-[9px] opacity-70">{z.pct}</p>
                <p className="text-sm font-extrabold mt-1">{z.lo} – {z.hi}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="charts">
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="charts">趨勢</TabsTrigger>
          <TabsTrigger value="log">查看全部</TabsTrigger>
          <TabsTrigger value="shoes" className="flex items-center gap-1">
            <Footprints className="w-3.5 h-3.5" />
            Shoe Locker
          </TabsTrigger>
          <TabsTrigger value="races" className="flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5" />
            賽事
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-1">
            <Bot className="w-3.5 h-3.5" />
            AI 教練
          </TabsTrigger>
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
        <TabsContent value="log" className="space-y-3">
          {/* Sort/Filter bar */}
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder={t('common.search') + '...'}
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              className="h-8 text-xs w-40"
            />
            <Select value={logFilterType} onValueChange={setLogFilterType}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all_types')}</SelectItem>
                {RUNNING_TYPES.map(rt => <SelectItem key={rt} value={rt}>{rt}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={logSort} onValueChange={(v) => setLogSort(v as any)}>
              <SelectTrigger className="h-8 w-40 text-xs"><ArrowUpDown className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">{t('running.sort_date_desc')}</SelectItem>
                <SelectItem value="date_asc">{t('running.sort_date_asc')}</SelectItem>
                <SelectItem value="distance_desc">{t('running.sort_distance')}</SelectItem>
                <SelectItem value="pace_asc">{t('running.sort_pace')}</SelectItem>
                <SelectItem value="hr_asc">{t('running.sort_hr')}</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">{sortedFilteredLogs.length} {t('common.records')}</span>
            <div className="ml-auto flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => window.open('/api/export/running/csv', '_blank')}>
                <Download className="w-3 h-3" /> CSV
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => window.open('/api/export/running/pdf', '_blank')}>
                <Download className="w-3 h-3" /> PDF
              </Button>
            </div>
          </div>
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : sortedFilteredLogs.length === 0 ? (
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
                      {["日期", "類型", "跑鞋", "距離", "時間", "配速", "心率", "步頻", "卡路里", "備注", ""].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedFilteredLogs.map((row: any) => (
                      <tr key={row.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium whitespace-nowrap">{formatHKDate(row.date)}</td>
                        <td className="px-4 py-3">
                          {row.running_type ? (
                            <Badge variant="outline" className="text-xs">{row.running_type}</Badge>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[120px] truncate">
                          {row.running_shoes || "—"}
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
                          <LogPhotoUploader logId={row.id} type="running" compact />
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

        {/* Shoe Locker tab */}
        <TabsContent value="shoes" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Footprints className="w-4 h-4 text-orange-500" />
              Shoe Locker
            </h3>
            <div className="flex items-center gap-2">
              <Select value={shoeSort} onValueChange={(v) => setShoeSort(v as any)}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <ArrowUpDown className="w-3 h-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="status">{t('running.sort_by_status')}</SelectItem>
                  <SelectItem value="mileage">{t('running.sort_by_mileage')}</SelectItem>
                  <SelectItem value="name">{t('running.sort_by_name')}</SelectItem>
                  <SelectItem value="purchase">{t('running.sort_by_purchase')}</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" className="hero-gradient text-white" onClick={() => { setEditShoe(null); setShoeForm({ shoesName: '', brand: '', model: '', status: 'Active', purchaseDate: '', firstUseDate: '', retirementDate: '', initialKm: '', maxKm: '800', notes: '', price: '', photoUrl: '' }); setShowShoeDialog(true); }}>
                <Plus className="w-3.5 h-3.5 mr-1" /> {t('running.add_shoe')}
              </Button>
            </div>
          </div>

          {/* Shoe cards */}
          {(allShoes as any[]).length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Footprints className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">{t('running.no_shoes_yet')}</p>
              <p className="text-sm mt-1">{t('running.add_first_shoe')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {sortedShoes.map((shoe: any) => {
                const totalKm = parseFloat(shoe.total_km || 0);
                const maxKm = shoe.max_km ? parseFloat(shoe.max_km) : 800;
                const initialKm = shoe.initial_km ? parseFloat(shoe.initial_km) : 0;
                const usedKm = totalKm + initialKm;
                const pct = Math.min(100, (usedKm / maxKm) * 100);
                const runCount = shoe.run_count ? Number(shoe.run_count) : 0;
                const priceNum = shoe.price ? parseFloat(shoe.price) : null;
                const costPerKm = priceNum && usedKm > 0 ? (priceNum / usedKm).toFixed(2) : null;

                // Status logic: retirement_date → retired, first_use_date → active, else not opened
                const hasRetirement = !!shoe.retirement_date;
                const hasFirstUse = !!shoe.firstusedate;
                const shoeStatus = hasRetirement ? 'Retired' : hasFirstUse ? 'Active' : 'Not Yet Opened';
                const statusLabel = shoeStatus === 'Retired' ? t('running.status_retired') : shoeStatus === 'Active' ? t('running.status_active') : t('running.status_not_opened');
                const statusClass = shoeStatus === 'Active' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                  : shoeStatus === 'Retired' ? 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30'
                  : 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30';
                const barColor = pct > 87.5 ? 'bg-red-500' : pct > 62.5 ? 'bg-yellow-500' : 'bg-emerald-500';
                const kmColor = pct > 87.5 ? 'text-red-500' : pct > 62.5 ? 'text-yellow-500' : 'text-emerald-500';

                return (
                  <div key={shoe.id} className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                    {/* Photo area */}
                    <div className="relative bg-muted/40 flex items-center justify-center" style={{ minHeight: 180 }}>
                      {shoe.photo_url ? (
                        <img src={shoe.photo_url} alt={shoe.shoes_name} className="w-full h-44 object-contain p-2" />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-44 text-muted-foreground/30">
                          <Footprints className="w-16 h-16" />
                        </div>
                      )}
                      {/* Status badge overlay */}
                      <span className={`absolute top-3 left-3 text-[11px] px-2.5 py-1 rounded-full border font-semibold ${statusClass}`}>
                        {statusLabel}
                      </span>
                    </div>

                    {/* Card body */}
                    <div className="p-4">
                      {/* Brand + Name */}
                      {shoe.brand && (
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{shoe.brand}</p>
                      )}
                      <p className="font-bold text-foreground text-base leading-tight mb-3">{shoe.shoes_name}</p>

                      {/* Mileage bar */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{t('running.distance_used')}</span>
                          <span className={`font-bold ${kmColor}`}>{usedKm.toFixed(1)} km</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2.5">
                          <div className={`h-2.5 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                          <span>0 km</span>
                          <span>{maxKm} km</span>
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="bg-muted/50 rounded-xl p-2 text-center">
                          <p className="text-[10px] text-muted-foreground">{t('running.sessions')}</p>
                          <p className="text-sm font-bold text-foreground">{runCount}</p>
                        </div>
                        <div className="bg-muted/50 rounded-xl p-2 text-center">
                          <p className="text-[10px] text-muted-foreground">{t('running.price')}</p>
                          <p className="text-sm font-bold text-orange-500">{priceNum ? `HK$${priceNum.toLocaleString()}` : '—'}</p>
                        </div>
                        <div className="bg-muted/50 rounded-xl p-2 text-center">
                          <p className="text-[10px] text-muted-foreground">{t('running.cost_per_km')}</p>
                          <p className="text-sm font-bold text-emerald-600">{costPerKm ? `$${costPerKm}` : '—'}</p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 mb-3">
                        <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => {
                          setEditShoe(shoe);
                          setShoeForm({
                            shoesName: shoe.shoes_name || '',
                            brand: shoe.brand || '',
                            model: shoe.model || '',
                            status: shoeStatus,
                            purchaseDate: shoe.purchase_date || '',
                            firstUseDate: shoe.firstusedate || '',
                            retirementDate: shoe.retirement_date || '',
                            initialKm: shoe.initial_km != null ? String(shoe.initial_km) : '',
                            maxKm: shoe.max_km != null ? String(shoe.max_km) : '800',
                            notes: shoe.notes || '',
                            price: shoe.price != null ? String(shoe.price) : '',
                            photoUrl: shoe.photo_url || '',
                          });
                          setShowShoeDialog(true);
                        }}>
                          <Edit2 className="w-3 h-3 mr-1" /> {t('running.edit')}
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteShoeConfirm(Number(shoe.id))}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 h-8 text-xs text-blue-600 hover:text-blue-700 border-blue-200 hover:border-blue-400"
                          onClick={() => openShoeHistory(shoe)}
                          disabled={loadingShoeHistory === Number(shoe.id)}>
                          {loadingShoeHistory === Number(shoe.id) ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Activity className="w-3 h-3 mr-1" />}
                          {runCount} {t('running.view_runs')}
                        </Button>
                      </div>

                      {/* Dates footer */}
                      <div className="border-t border-border pt-2 space-y-0.5">
                        {shoe.purchase_date && (
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {t('running.purchased')}: {shoe.purchase_date}
                          </p>
                        )}
                        {shoe.firstusedate && (
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Footprints className="w-3 h-3" /> {t('running.first_used')}: {shoe.firstusedate}
                          </p>
                        )}
                        {shoe.retirement_date && (
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Flag className="w-3 h-3" /> {t('running.retired_on')}: {shoe.retirement_date}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Race Events tab */}
        <TabsContent value="races" className="space-y-5">
          {/* Header row */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" />
              {t('running.race_events')}
            </h3>
            <div className="flex items-center gap-2">
              <Select value={raceSort} onValueChange={(v) => setRaceSort(v as any)}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <ArrowUpDown className="w-3 h-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">{t('running.sort_by_date')}</SelectItem>
                  <SelectItem value="distance">{t('running.sort_by_distance')}</SelectItem>
                  <SelectItem value="name">{t('running.sort_by_name')}</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" className="hero-gradient text-white" onClick={() => { setEditRace(null); setRaceForm({ raceName: '', date: todayHKString(), distanceKm: '', location: '', registration: '', bibNo: '', isPb: false, finishTime: '', finishHr: '', finishMin: '', finishSec: '', targetHr: '', targetMin: '', targetSec: '', overallPlace: '', ageGroupPlace: '', genderGroupPlace: '', runningShoes: '', notes: '' }); setShowRaceDialog(true); }}>
                <Plus className="w-3.5 h-3.5 mr-1" /> {t('running.add_race')}
              </Button>
            </div>
          </div>

          {/* PB Records */}
          {(pbs as any[]).length > 0 && (
            <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/5 border border-yellow-500/20 rounded-2xl p-4 shadow-sm">
              <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <Award className="w-4 h-4 text-yellow-500" /> {t('running.pb_records')}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(pbs as any[]).map((pb: any, i: number) => {
                  const hasHms = pb.finish_hr != null || pb.finish_min != null || pb.finish_sec != null;
                  const fh = pb.finish_hr ?? 0; const fm = pb.finish_min ?? 0; const fs = pb.finish_sec ?? 0;
                  const pbTime = hasHms
                    ? (fh > 0 ? `${fh}:${String(fm).padStart(2,'0')}:${String(fs).padStart(2,'0')}` : `${fm}:${String(fs).padStart(2,'0')}`)
                    : null;
                  // Find the matching race to allow quick edit
                  const matchRace = (races as any[]).find((r: any) => r.id === pb.id);
                  return (
                    <div
                      key={i}
                      className={`bg-white/50 dark:bg-white/5 border rounded-xl p-3 text-center transition-all ${!hasHms ? 'border-dashed border-yellow-400/50 cursor-pointer hover:border-yellow-500 hover:bg-yellow-50/30 dark:hover:bg-yellow-900/10' : 'border-yellow-500/20'}`}
                      onClick={() => { if (!hasHms && matchRace) { openEditRace(matchRace); setShowRaceDialog(true); } }}
                      title={!hasHms ? (isZh ? '點擊填入完賽時間' : 'Click to enter finish time') : undefined}
                    >
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{parseFloat(pb.distance_km).toFixed(1)} km</p>
                      {pbTime ? (
                        <p className="text-xl font-extrabold text-yellow-600 dark:text-yellow-400 mt-0.5">{pbTime}</p>
                      ) : (
                        <div className="mt-1">
                          <p className="text-xs text-yellow-500/70 font-medium flex items-center justify-center gap-1">
                            <Clock className="w-3 h-3" />{isZh ? '點擊填入時間' : 'Click to add time'}
                          </p>
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{pb.race_name}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(races as any[]).length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">{t('running.no_races_yet')}</p>
              <p className="text-sm mt-1">{t('running.add_first_race')}</p>
            </div>
          ) : (() => {
            const upcomingRaces = sortedRacesList.filter((r: any) => new Date(r.date + 'T00:00:00+08:00') > now);
            const completedRaces = sortedRacesList.filter((r: any) => new Date(r.date + 'T00:00:00+08:00') <= now);

            return (
              <div className="space-y-6">
                {/* Upcoming races — compact grid */}
                {upcomingRaces.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">{t('running.upcoming')}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {upcomingRaces.map((race: any) => {
                        const raceDate = new Date(race.date + 'T00:00:00+08:00');
                        const diffMs = raceDate.getTime() - now.getTime();
                        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                        const isNext = upcomingRaces[0]?.id === race.id;
                        return (
                          <div key={race.id} className={`rounded-2xl border p-3 shadow-sm ${
                            isNext ? 'bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border-blue-500/30' : 'bg-card border-border'
                          }`}>
                            {isNext && <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500 mb-1.5 flex items-center gap-1"><Zap className="w-3 h-3" />{t('running.next_race')}</p>}
                            <p className="font-bold text-foreground text-sm leading-tight mb-1.5">{race.race_name}</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground mb-2">
                              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{race.date}</span>
                              {race.distance_km && <span className="flex items-center gap-1"><Flag className="w-3 h-3" />{parseFloat(race.distance_km).toFixed(1)} km</span>}
                              {race.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{race.location}</span>}
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex gap-1">
                                <Button size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={() => openEditRace(race)}><Edit2 className="w-2.5 h-2.5 mr-0.5" />{t('running.edit')}</Button>
                                <Button size="sm" variant="outline" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteRaceConfirm(Number(race.id))}><Trash2 className="w-2.5 h-2.5" /></Button>
                              </div>
                              <div className="text-right">
                                <span className={`text-lg font-extrabold ${isNext ? 'text-blue-500' : 'text-foreground'}`}>{diffDays}</span>
                                <span className="text-[10px] text-muted-foreground ml-1">{t('running.days_to_go')}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Completed races */}
                {completedRaces.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">{t('running.completed')}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {completedRaces.map((race: any) => {
                        const enriched = (racesEnriched as any[]).find((r: any) => Number(r.id) === Number(race.id));
                        const rl = enriched?.runLog ?? null;
                        return (
                          <div key={race.id} className={`bg-card border rounded-2xl shadow-sm overflow-hidden ${
                            race.is_pb ? 'border-yellow-500/40' : 'border-border'
                          }`}>
                            {/* Card header */}
                            <div className={`p-4 ${
                              race.is_pb ? 'bg-gradient-to-r from-yellow-500/10 to-orange-500/5' : 'bg-muted/30'
                            }`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-bold text-foreground">{race.race_name}</p>
                                    {race.is_pb && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500 text-white font-extrabold">{t('running.pb_badge')}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{race.date}</span>
                                    {race.distance_km && <span className="flex items-center gap-1"><Flag className="w-3 h-3" />{parseFloat(race.distance_km).toFixed(1)} km</span>}
                                    {race.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{race.location}</span>}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  {(() => {
                                    const hasHms = race.finish_hr != null || race.finish_min != null || race.finish_sec != null;
                                    const fh = race.finish_hr ?? 0; const fm = race.finish_min ?? 0; const fs = race.finish_sec ?? 0;
                                    const displayTime = hasHms
                                      ? (fh > 0 ? `${fh}:${String(fm).padStart(2,'0')}:${String(fs).padStart(2,'0')}` : `${fm}:${String(fs).padStart(2,'0')}`)
                                      : (race.finish_time && race.finish_time !== 'True' && race.finish_time !== 'False' ? race.finish_time : null);
                                    if (!displayTime) return null;
                                    return (
                                      <div className="text-right">
                                        <p className="text-2xl font-extrabold text-foreground">{displayTime}</p>
                                        <p className="text-[10px] text-muted-foreground">{t('running.finish_time')}</p>
                                      </div>
                                    );
                                  })()}
                                  {(() => {
                                    const hasTgt = race.target_hr != null || race.target_min != null || race.target_sec != null;
                                    if (!hasTgt) return null;
                                    const th = race.target_hr ?? 0; const tm = race.target_min ?? 0; const ts = race.target_sec ?? 0;
                                    const tgtTime = th > 0 ? `${th}:${String(tm).padStart(2,'0')}:${String(ts).padStart(2,'0')}` : `${tm}:${String(ts).padStart(2,'0')}`;
                                    return (
                                      <div className="text-right">
                                        <p className="text-sm font-semibold text-blue-500">{tgtTime}</p>
                                        <p className="text-[10px] text-muted-foreground">目標</p>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>

                            {/* Performance metrics */}
                            <div className="p-4 space-y-3">
                              {/* Rankings */}
                              {(race.overall_place || race.gender_group_place || race.age_group_place || race.bib_no) && (
                                <div className="flex gap-2 flex-wrap">
                                  {race.overall_place && (
                                    <div className="bg-muted/50 rounded-lg px-2.5 py-1.5 text-center">
                                      <p className="text-[9px] text-muted-foreground font-semibold uppercase">{t('running.overall_place')}</p>
                                      <p className="text-sm font-bold text-foreground">#{race.overall_place}</p>
                                    </div>
                                  )}
                                  {race.gender_group_place && (
                                    <div className="bg-muted/50 rounded-lg px-2.5 py-1.5 text-center">
                                      <p className="text-[9px] text-muted-foreground font-semibold uppercase">{t('running.gender_place')}</p>
                                      <p className="text-sm font-bold text-foreground">#{race.gender_group_place}</p>
                                    </div>
                                  )}
                                  {race.age_group_place && (
                                    <div className="bg-muted/50 rounded-lg px-2.5 py-1.5 text-center">
                                      <p className="text-[9px] text-muted-foreground font-semibold uppercase">{t('running.age_group_place')}</p>
                                      <p className="text-sm font-bold text-foreground">#{race.age_group_place}</p>
                                    </div>
                                  )}
                                  {race.bib_no && (
                                    <div className="bg-muted/50 rounded-lg px-2.5 py-1.5 text-center">
                                      <p className="text-[9px] text-muted-foreground font-semibold uppercase">BIB</p>
                                      <p className="text-sm font-bold text-foreground">{race.bib_no}</p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Running log matched data — all fields */}
                              {rl && (
                                <div className="border-t border-border pt-3 space-y-2">
                                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                    <Activity className="w-3 h-3" /> {t('running.run_log_matched')}
                                  </p>

                                  {/* Pace & HR */}
                                  <div className="grid grid-cols-2 gap-2">
                                    {rl.average_pace && (
                                      <div className="bg-muted/40 rounded-lg p-2">
                                        <p className="text-[9px] text-muted-foreground">{t('running.avg_pace_race')}</p>
                                        <p className="text-sm font-bold text-foreground">{formatPace(parsePaceField(rl.average_pace))}</p>
                                      </div>
                                    )}
                                    {rl.best_pace && (
                                      <div className="bg-muted/40 rounded-lg p-2">
                                        <p className="text-[9px] text-muted-foreground">{t('running.best_pace')}</p>
                                        <p className="text-sm font-bold text-foreground">{rl.best_pace}</p>
                                      </div>
                                    )}
                                    {rl.average_heart_rate && (
                                      <div className="bg-muted/40 rounded-lg p-2">
                                        <p className="text-[9px] text-muted-foreground">{t('running.avg_hr_race')}</p>
                                        <p className="text-sm font-bold text-red-500">{Math.round(Number(rl.average_heart_rate))} bpm</p>
                                      </div>
                                    )}
                                    {rl.maximum_heart_rate && (
                                      <div className="bg-muted/40 rounded-lg p-2">
                                        <p className="text-[9px] text-muted-foreground">{t('running.max_hr')}</p>
                                        <p className="text-sm font-bold text-red-600">{Math.round(Number(rl.maximum_heart_rate))} bpm</p>
                                      </div>
                                    )}
                                    {rl.average_cadence && (
                                      <div className="bg-muted/40 rounded-lg p-2">
                                        <p className="text-[9px] text-muted-foreground">{t('running.avg_cadence_race')}</p>
                                        <p className="text-sm font-bold text-foreground">{Math.round(Number(rl.average_cadence))} spm</p>
                                      </div>
                                    )}
                                    {rl.max_cadence && (
                                      <div className="bg-muted/40 rounded-lg p-2">
                                        <p className="text-[9px] text-muted-foreground">{t('running.max_cadence')}</p>
                                        <p className="text-sm font-bold text-foreground">{Math.round(Number(rl.max_cadence))} spm</p>
                                      </div>
                                    )}
                                    {rl.calories && (
                                      <div className="bg-muted/40 rounded-lg p-2">
                                        <p className="text-[9px] text-muted-foreground">{t('running.calories')}</p>
                                        <p className="text-sm font-bold text-orange-500">{rl.calories} kcal</p>
                                      </div>
                                    )}
                                    {rl.running_shoes && (
                                      <div className="bg-muted/40 rounded-lg p-2">
                                        <p className="text-[9px] text-muted-foreground">{t('running.shoes')}</p>
                                        <p className="text-sm font-bold text-foreground truncate">{rl.running_shoes}</p>
                                      </div>
                                    )}
                                  </div>

                                  {/* Biomechanics */}
                                  {(rl.avg_stride_length_m || rl.avg_vertical_ratio || rl.vertical_oscillation_cm || rl.avg_ground_contact_time_ms) && (
                                    <div>
                                      <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{t('running.biomechanics')}</p>
                                      <div className="grid grid-cols-2 gap-2">
                                        {rl.avg_stride_length_m && (
                                          <div className="bg-purple-500/5 border border-purple-500/15 rounded-lg p-2">
                                            <p className="text-[9px] text-muted-foreground">{t('running.stride_length')}</p>
                                            <p className="text-sm font-bold text-purple-600 dark:text-purple-400">{parseFloat(rl.avg_stride_length_m).toFixed(2)} m</p>
                                          </div>
                                        )}
                                        {rl.avg_vertical_ratio && (
                                          <div className="bg-purple-500/5 border border-purple-500/15 rounded-lg p-2">
                                            <p className="text-[9px] text-muted-foreground">{t('running.vertical_ratio')}</p>
                                            <p className="text-sm font-bold text-purple-600 dark:text-purple-400">{parseFloat(rl.avg_vertical_ratio).toFixed(1)}%</p>
                                          </div>
                                        )}
                                        {rl.vertical_oscillation_cm && (
                                          <div className="bg-purple-500/5 border border-purple-500/15 rounded-lg p-2">
                                            <p className="text-[9px] text-muted-foreground">{t('running.vertical_oscillation')}</p>
                                            <p className="text-sm font-bold text-purple-600 dark:text-purple-400">{parseFloat(rl.vertical_oscillation_cm).toFixed(1)} cm</p>
                                          </div>
                                        )}
                                        {rl.avg_ground_contact_time_ms && (
                                          <div className="bg-purple-500/5 border border-purple-500/15 rounded-lg p-2">
                                            <p className="text-[9px] text-muted-foreground">{t('running.ground_contact')}</p>
                                            <p className="text-sm font-bold text-purple-600 dark:text-purple-400">{Math.round(Number(rl.avg_ground_contact_time_ms))} ms</p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Weather */}
                                  {(rl.temperature || rl.humidity || rl.wind_speed || rl.apparent_temp) && (
                                    <div>
                                      <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                                        <Thermometer className="w-3 h-3" /> {t('running.weather_conditions')}
                                      </p>
                                      <div className="flex flex-wrap gap-2">
                                        {rl.temperature && (
                                          <div className="flex items-center gap-1 bg-sky-500/10 border border-sky-500/20 rounded-full px-2.5 py-1 text-xs">
                                            <Thermometer className="w-3 h-3 text-sky-500" />
                                            <span className="font-semibold text-sky-700 dark:text-sky-400">{parseFloat(rl.temperature).toFixed(1)}°C</span>
                                          </div>
                                        )}
                                        {rl.apparent_temp && (
                                          <div className="flex items-center gap-1 bg-orange-500/10 border border-orange-500/20 rounded-full px-2.5 py-1 text-xs">
                                            <Thermometer className="w-3 h-3 text-orange-500" />
                                            <span className="font-semibold text-orange-700 dark:text-orange-400">{t('running.feels_like')} {parseFloat(rl.apparent_temp).toFixed(1)}°C</span>
                                          </div>
                                        )}
                                        {rl.humidity && (
                                          <div className="flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 rounded-full px-2.5 py-1 text-xs">
                                            <Droplets className="w-3 h-3 text-blue-500" />
                                            <span className="font-semibold text-blue-700 dark:text-blue-400">{parseFloat(rl.humidity).toFixed(0)}%</span>
                                          </div>
                                        )}
                                        {rl.wind_speed && (
                                          <div className="flex items-center gap-1 bg-teal-500/10 border border-teal-500/20 rounded-full px-2.5 py-1 text-xs">
                                            <Wind className="w-3 h-3 text-teal-500" />
                                            <span className="font-semibold text-teal-700 dark:text-teal-400">{parseFloat(rl.wind_speed).toFixed(1)} km/h</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Log notes */}
                                  {rl.log_notes && (
                                    <p className="text-xs text-muted-foreground italic border-t border-border pt-2">{rl.log_notes}</p>
                                  )}
                                </div>
                              )}

                              {/* Race shoes from race record itself (fallback) */}
                              {!rl?.running_shoes && race.running_shoes && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Footprints className="w-3.5 h-3.5" />
                                  <span>{race.running_shoes}</span>
                                </div>
                              )}

                              {race.notes && (
                                <p className="text-xs text-muted-foreground italic">{race.notes}</p>
                              )}

                              {/* Action buttons — no per-race AI button */}
                              <div className="flex gap-2 pt-1">
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEditRace(race)}><Edit2 className="w-3 h-3 mr-1" />{t('running.edit')}</Button>
                                <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteRaceConfirm(Number(race.id))}><Trash2 className="w-3 h-3" /></Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </TabsContent>

        {/* AI Coach tab */}
        <TabsContent value="ai" className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <div>
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-orange-500" />
                  {t("running.ai_analysis")}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">{t("running.ai_coach_desc")}</p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={String(aiWeeks)} onValueChange={(v) => { setAiWeeks(Number(v)); setAiAnalysis(null); }}>
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKS_OPTIONS.map((w) => (
                      <SelectItem key={w} value={String(w)}>{w}W</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => { setAiAnalysis(null); aiMutation.mutate({ weeks: aiWeeks }); }}
                  disabled={aiMutation.isPending}
                  className="hero-gradient text-white h-8 text-xs"
                >
                  {aiMutation.isPending ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />{t("running.generating")}</>
                  ) : (
                    <><Sparkles className="w-3.5 h-3.5 mr-1" />{t("running.generate_analysis")}</>
                  )}
                </Button>
              </div>
            </div>

            {aiMutation.isPending && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                <p className="text-sm text-muted-foreground">{t("running.generating")}</p>
              </div>
            )}

            {!aiMutation.isPending && aiAnalysis && (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <Streamdown>{aiAnalysis}</Streamdown>
              </div>
            )}

            {!aiMutation.isPending && !aiAnalysis && (
              <div className="text-center py-12 text-muted-foreground">
                <Bot className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">{t("running.ai_analysis_desc")}</p>
              </div>
            )}
          </div>

          {/* ─── Personalized Training Plan ─── */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Bot className="w-4 h-4 text-blue-500" />
                {t('running.training_plan_title')}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">{t('running.training_plan_desc')}</p>
            </div>

            {/* Config row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('running.goal_race')}</label>
                <Select value={planGoalRaceId} onValueChange={(v) => { setPlanGoalRaceId(v); setTrainingPlan(null); }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="選擇目標賽事..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— 不指定 —</SelectItem>
                    {[...(races as any[])]
                      .filter((r: any) => new Date(r.date + 'T00:00:00+08:00') > now)
                      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
                      .map((r: any) => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          {r.race_name} ({r.date}, {parseFloat(r.distance_km||0).toFixed(1)}km)
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('running.plan_weeks')}</label>
                <Select value={String(planWeeks)} onValueChange={(v) => { setPlanWeeks(Number(v)); setTrainingPlan(null); }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[4, 8, 12, 16, 20, 24].map((w) => (
                      <SelectItem key={w} value={String(w)}>{w} {t('running.weeks')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('running.goal_finish_time')} (hr : min : sec)</label>
                <div className="flex items-center gap-1.5">
                  <Input type="number" min="0" max="23" placeholder="0" className="h-8 text-xs text-center" value={planGoalFinishHr} onChange={(e) => { setPlanGoalFinishHr(e.target.value); setTrainingPlan(null); }} />
                  <span className="text-muted-foreground font-bold">:</span>
                  <Input type="number" min="0" max="59" placeholder="00" className="h-8 text-xs text-center" value={planGoalFinishMin} onChange={(e) => { setPlanGoalFinishMin(e.target.value); setTrainingPlan(null); }} />
                  <span className="text-muted-foreground font-bold">:</span>
                  <Input type="number" min="0" max="59" placeholder="00" className="h-8 text-xs text-center" value={planGoalFinishSec} onChange={(e) => { setPlanGoalFinishSec(e.target.value); setTrainingPlan(null); }} />
                  <Button
                    onClick={() => {
                      setTrainingPlan(null);
                      trainingPlanMutation.mutate({
                        goalRaceId: planGoalRaceId !== '__none__' ? Number(planGoalRaceId) : undefined,
                        goalFinishHr: planGoalFinishHr !== '' ? parseInt(planGoalFinishHr) : undefined,
                        goalFinishMin: planGoalFinishMin !== '' ? parseInt(planGoalFinishMin) : undefined,
                        goalFinishSec: planGoalFinishSec !== '' ? parseInt(planGoalFinishSec) : undefined,
                        planWeeks,
                      });
                    }}
                    disabled={trainingPlanMutation.isPending}
                    className="ml-2 bg-blue-500 hover:bg-blue-600 text-white h-8 text-xs px-3 shrink-0"
                  >
                    {trainingPlanMutation.isPending ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />{t('running.generating')}</>
                    ) : (
                      <><Bot className="w-3.5 h-3.5 mr-1" />{t('running.generate_plan')}</>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {trainingPlanMutation.isPending && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <p className="text-sm text-muted-foreground">{t('running.generating_plan')}</p>
              </div>
            )}

            {!trainingPlanMutation.isPending && trainingPlan && (
              <div className="prose prose-sm dark:prose-invert max-w-none border-t border-border pt-4">
                <Streamdown>{trainingPlan}</Streamdown>
              </div>
            )}

            {!trainingPlanMutation.isPending && !trainingPlan && (
              <div className="text-center py-8 text-muted-foreground">
                <Bot className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">{t('running.training_plan_empty')}</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(o) => { setShowDialog(o); if (!o) { setEditEntry(null); setForm(defaultForm); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editEntry ? t("running.edit_record") : t("running.add_record")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2">
              <ScreenshotImporter
                dataType="running"
                onExtracted={(fields) => setForm((p: any) => ({ ...p, ...fields }))}
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("running.date")}</label>
              <Input type="date" value={form.date} onChange={(e) => f("date", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("running.activity_type")}</label>
              <Select value={form.runningType} onValueChange={(v) => f("runningType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RUNNING_TYPES.map((rt) => <SelectItem key={rt} value={rt}>{rt}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("running.distance")}</label>
              <Input type="number" step="0.01" placeholder="例: 10.5" value={form.distanceKm} onChange={(e) => f("distanceKm", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("running.duration")} — h</label>
              <Input type="number" min="0" placeholder="0" value={form.hour} onChange={(e) => f("hour", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("running.duration")} — min</label>
              <Input type="number" min="0" max="59" placeholder="例: 45" value={form.minutes} onChange={(e) => f("minutes", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("running.duration")} — sec</label>
              <Input type="number" min="0" max="59" placeholder="0" value={form.second} onChange={(e) => f("second", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("running.avg_pace")}</label>
              <Input type="text" placeholder="例: 6.5 (=6:30/km)" value={form.averagePace} onChange={(e) => f("averagePace", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Best Pace</label>
              <Input type="text" placeholder="例: 05:48" value={form.bestPace} onChange={(e) => f("bestPace", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("running.avg_hr")}</label>
              <Input type="number" placeholder="例: 145" value={form.averageHeartRate} onChange={(e) => f("averageHeartRate", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("running.max_hr")}</label>
              <Input type="number" placeholder="例: 175" value={form.maximumHeartRate} onChange={(e) => f("maximumHeartRate", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("running.avg_cadence")}</label>
              <Input type="number" placeholder="例: 178" value={form.averageCadence} onChange={(e) => f("averageCadence", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("running.max_cadence")}</label>
              <Input type="number" placeholder="例: 195" value={form.maxCadence} onChange={(e) => f("maxCadence", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">平均步幅 (m)</label>
              <Input type="number" step="0.01" placeholder="例: 1.15" value={form.avgStrideLengthM} onChange={(e) => f("avgStrideLengthM", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">垂直比率 (%)</label>
              <Input type="number" step="0.1" placeholder="例: 8.5" value={form.avgVerticalRatio} onChange={(e) => f("avgVerticalRatio", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">垂直振幅 (cm)</label>
              <Input type="number" step="0.1" placeholder="例: 9.2" value={form.verticalOscillationCm} onChange={(e) => f("verticalOscillationCm", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("running.calories")}</label>
              <Input type="number" placeholder="例: 450" value={form.calories} onChange={(e) => f("calories", e.target.value)} />
            </div>
            {/* Shoe Locker selector */}
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                跑鞋 <span className="text-[10px] text-muted-foreground/60">(來自 Shoe Locker，排除退役跑鞋)</span>
              </label>
              <Select
                value={form.runningShoes || "__none__"}
                onValueChange={(v) => f("runningShoes", v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('running.shoe_name') + '...'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— 不選擇 —</SelectItem>
                  {(activeShoes as any[]).map((shoe: any) => {
                    const sHasRetire = !!shoe.retirement_date;
                    const sHasFirst = !!shoe.firstusedate;
                    const sStatus = sHasRetire ? 'Retired' : sHasFirst ? 'Active' : 'Not Yet Opened';
                    return (
                      <SelectItem key={shoe.id} value={shoe.shoes_name}>
                        <span className="flex items-center gap-2">
                          {shoe.shoes_name}
                          {sStatus === 'Active' && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1 border-emerald-400 text-emerald-600">{t('running.status_active')}</Badge>
                          )}
                          {sStatus === 'Not Yet Opened' && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1 border-blue-400 text-blue-600">{t('running.status_not_opened')}</Badge>
                          )}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("running.notes")}</label>
              <Input type="text" placeholder="..."  value={form.notes} onChange={(e) => f("notes", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">截圖上載</label>
              <LogPhotoUploader ref={photoUploaderRef} logId={editEntry ? editEntry.id : null} type="running" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); setEditEntry(null); setForm(defaultForm); }}>{t("running.cancel")}</Button>
            <Button onClick={handleSave} disabled={addMutation.isPending || updateMutation.isPending} className="hero-gradient text-white">
              {(addMutation.isPending || updateMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {t("running.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteConfirm !== null} onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t("common.confirm_delete")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t("running.delete_confirm")}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>{t("running.cancel")}</Button>
            <Button variant="destructive" onClick={() => deleteConfirm !== null && deleteMutation.mutate({ id: deleteConfirm })}
              disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Shoe Locker Dialog */}
      <Dialog open={showShoeDialog} onOpenChange={(o) => { setShowShoeDialog(o); if (!o) { setEditShoe(null); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editShoe ? t('running.edit_shoe') : t('running.add_shoe')}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('running.shoe_name')} *</label>
              <Input placeholder="例: Nike Vaporfly 3" value={shoeForm.shoesName} onChange={(e) => setShoeForm((p: any) => ({ ...p, shoesName: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('running.brand')}</label>
              <Input placeholder="例: Nike" value={shoeForm.brand} onChange={(e) => setShoeForm((p: any) => ({ ...p, brand: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('running.model')}</label>
              <Input placeholder="例: Vaporfly 3" value={shoeForm.model} onChange={(e) => setShoeForm((p: any) => ({ ...p, model: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('running.purchase_date')}</label>
              <Input type="date" value={shoeForm.purchaseDate} onChange={(e) => setShoeForm((p: any) => ({ ...p, purchaseDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('running.first_use_date')}</label>
              <Input type="date" value={shoeForm.firstUseDate} onChange={(e) => setShoeForm((p: any) => ({ ...p, firstUseDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('running.retirement_date')}</label>
              <Input type="date" value={shoeForm.retirementDate} onChange={(e) => setShoeForm((p: any) => ({ ...p, retirementDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('running.initial_km')}</label>
              <Input type="number" step="0.1" placeholder="0" value={shoeForm.initialKm} onChange={(e) => setShoeForm((p: any) => ({ ...p, initialKm: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('running.max_km')}</label>
              <Input type="number" step="1" placeholder="800" value={shoeForm.maxKm} onChange={(e) => setShoeForm((p: any) => ({ ...p, maxKm: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('running.price')}</label>
              <Input type="number" step="0.01" placeholder="例: 1500" value={shoeForm.price} onChange={(e) => setShoeForm((p: any) => ({ ...p, price: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('running.photo_url')}</label>
              <Input placeholder="https://..." value={shoeForm.photoUrl} onChange={(e) => setShoeForm((p: any) => ({ ...p, photoUrl: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('running.race_notes')}</label>
              <Input placeholder="..." value={shoeForm.notes} onChange={(e) => setShoeForm((p: any) => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShoeDialog(false)}>取消</Button>
            <Button className="hero-gradient text-white"
              disabled={addShoeMutation.isPending || updateShoeMutation.isPending || !shoeForm.shoesName}
              onClick={() => {
                // Derive status from dates
                const derivedStatus = shoeForm.retirementDate ? 'Retired' : shoeForm.firstUseDate ? 'Active' : 'Not Yet Opened';
                const payload = {
                  shoesName: shoeForm.shoesName,
                  brand: shoeForm.brand || undefined,
                  model: shoeForm.model || undefined,
                  status: derivedStatus,
                  purchaseDate: shoeForm.purchaseDate || undefined,
                  firstUseDate: shoeForm.firstUseDate || undefined,
                  retirementDate: shoeForm.retirementDate || undefined,
                  initialKm: shoeForm.initialKm ? parseFloat(shoeForm.initialKm) : 0,
                  maxKm: shoeForm.maxKm ? parseFloat(shoeForm.maxKm) : 800,
                  notes: shoeForm.notes || undefined,
                  price: shoeForm.price ? parseFloat(shoeForm.price) : undefined,
                  photoUrl: shoeForm.photoUrl || undefined,
                };
                if (editShoe) {
                  updateShoeMutation.mutate({ id: Number(editShoe.id), ...payload });
                } else {
                  addShoeMutation.mutate(payload);
                }
              }}>
              {(addShoeMutation.isPending || updateShoeMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Shoe Confirm */}
      <Dialog open={deleteShoeConfirm !== null} onOpenChange={(o) => { if (!o) setDeleteShoeConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>確認刪除</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">確定要刪除這雙跑鞋？此操作無法復原。</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteShoeConfirm(null)}>取消</Button>
            <Button variant="destructive" onClick={() => deleteShoeConfirm !== null && deleteShoeMutation.mutate({ id: deleteShoeConfirm })} disabled={deleteShoeMutation.isPending}>
              {deleteShoeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Race Dialog */}
      <Dialog open={showRaceDialog} onOpenChange={(o) => { setShowRaceDialog(o); if (!o) setEditRace(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editRace ? '編輯賽事' : '新增賽事'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">賽事名稱 *</label>
              <Input placeholder="例: 2025 香港馬拉松" value={raceForm.raceName} onChange={(e) => setRaceForm((p: any) => ({ ...p, raceName: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">日期 *</label>
              <Input type="date" value={raceForm.date} onChange={(e) => setRaceForm((p: any) => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">距離 (km)</label>
              <Input type="number" step="0.1" placeholder="例: 42.195" value={raceForm.distanceKm} onChange={(e) => setRaceForm((p: any) => ({ ...p, distanceKm: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">完賽時間 (hr : min : sec)</label>
              <div className="flex items-center gap-1.5">
                <Input type="number" min="0" max="23" placeholder="0" className="text-center" value={raceForm.finishHr} onChange={(e) => setRaceForm((p: any) => ({ ...p, finishHr: e.target.value }))} />
                <span className="text-muted-foreground font-bold text-sm">:</span>
                <Input type="number" min="0" max="59" placeholder="00" className="text-center" value={raceForm.finishMin} onChange={(e) => setRaceForm((p: any) => ({ ...p, finishMin: e.target.value }))} />
                <span className="text-muted-foreground font-bold text-sm">:</span>
                <Input type="number" min="0" max="59" placeholder="00" className="text-center" value={raceForm.finishSec} onChange={(e) => setRaceForm((p: any) => ({ ...p, finishSec: e.target.value }))} />
              </div>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">目標時間 (hr : min : sec)</label>
              <div className="flex items-center gap-1.5">
                <Input type="number" min="0" max="23" placeholder="0" className="text-center" value={raceForm.targetHr} onChange={(e) => setRaceForm((p: any) => ({ ...p, targetHr: e.target.value }))} />
                <span className="text-muted-foreground font-bold text-sm">:</span>
                <Input type="number" min="0" max="59" placeholder="00" className="text-center" value={raceForm.targetMin} onChange={(e) => setRaceForm((p: any) => ({ ...p, targetMin: e.target.value }))} />
                <span className="text-muted-foreground font-bold text-sm">:</span>
                <Input type="number" min="0" max="59" placeholder="00" className="text-center" value={raceForm.targetSec} onChange={(e) => setRaceForm((p: any) => ({ ...p, targetSec: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">地點</label>
              <Input placeholder="例: 香港" value={raceForm.location} onChange={(e) => setRaceForm((p: any) => ({ ...p, location: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">總排名</label>
              <Input type="number" placeholder="例: 1234" value={raceForm.overallPlace} onChange={(e) => setRaceForm((p: any) => ({ ...p, overallPlace: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">性別排名</label>
              <Input type="number" placeholder="例: 456" value={raceForm.genderGroupPlace} onChange={(e) => setRaceForm((p: any) => ({ ...p, genderGroupPlace: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">年齡組排名</label>
              <Input type="number" placeholder="例: 78" value={raceForm.ageGroupPlace} onChange={(e) => setRaceForm((p: any) => ({ ...p, ageGroupPlace: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">号碼 (BIB)</label>
              <Input placeholder="例: A1234" value={raceForm.bibNo} onChange={(e) => setRaceForm((p: any) => ({ ...p, bibNo: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">跑鞋</label>
              <Select value={raceForm.runningShoes || '__none__'} onValueChange={(v) => setRaceForm((p: any) => ({ ...p, runningShoes: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="選擇跑鞋..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— 不選擇 —</SelectItem>
                  {(activeShoes as any[]).map((s: any) => (
                    <SelectItem key={s.id} value={s.shoes_name}>{s.shoes_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <input type="checkbox" id="isPb" checked={raceForm.isPb} onChange={(e) => setRaceForm((p: any) => ({ ...p, isPb: e.target.checked }))} className="w-4 h-4" />
              <label htmlFor="isPb" className="text-sm font-medium text-foreground">標記為個人PB</label>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">備註</label>
              <Input placeholder="..." value={raceForm.notes} onChange={(e) => setRaceForm((p: any) => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRaceDialog(false)}>取消</Button>
            <Button className="hero-gradient text-white"
              disabled={addRaceMutation.isPending || updateRaceMutation.isPending || !raceForm.raceName || !raceForm.date}
              onClick={() => {
                const payload = {
                  raceName: raceForm.raceName,
                  date: raceForm.date,
                  distanceKm: raceForm.distanceKm ? parseFloat(raceForm.distanceKm) : undefined,
                  location: raceForm.location || undefined,
                  registration: raceForm.registration || undefined,
                  bibNo: raceForm.bibNo || undefined,
                  isPb: raceForm.isPb,
                  finishTime: raceForm.finishTime || undefined,
                  finishHr: raceForm.finishHr !== '' ? parseInt(raceForm.finishHr) : undefined,
                  finishMin: raceForm.finishMin !== '' ? parseInt(raceForm.finishMin) : undefined,
                  finishSec: raceForm.finishSec !== '' ? parseInt(raceForm.finishSec) : undefined,
                  targetHr: raceForm.targetHr !== '' ? parseInt(raceForm.targetHr) : undefined,
                  targetMin: raceForm.targetMin !== '' ? parseInt(raceForm.targetMin) : undefined,
                  targetSec: raceForm.targetSec !== '' ? parseInt(raceForm.targetSec) : undefined,
                  overallPlace: raceForm.overallPlace ? parseInt(raceForm.overallPlace) : undefined,
                  ageGroupPlace: raceForm.ageGroupPlace ? parseInt(raceForm.ageGroupPlace) : undefined,
                  genderGroupPlace: raceForm.genderGroupPlace ? parseInt(raceForm.genderGroupPlace) : undefined,
                  runningShoes: raceForm.runningShoes || undefined,
                  notes: raceForm.notes || undefined,
                };
                if (editRace) {
                  updateRaceMutation.mutate({ id: Number(editRace.id), ...payload });
                } else {
                  addRaceMutation.mutate(payload);
                }
              }}>
              {(addRaceMutation.isPending || updateRaceMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Race Confirm */}
      <Dialog open={deleteRaceConfirm !== null} onOpenChange={(o) => { if (!o) setDeleteRaceConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('running.confirm_delete')}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t('running.confirm_delete_race_msg')}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRaceConfirm(null)}>{t('running.cancel')}</Button>
            <Button variant="destructive" onClick={() => deleteRaceConfirm !== null && deleteRaceMutation.mutate({ id: deleteRaceConfirm })} disabled={deleteRaceMutation.isPending}>
              {deleteRaceMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}{t('running.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shoe Run History Modal */}
      <Dialog open={!!shoeHistoryModal} onOpenChange={(o) => { if (!o) setShoeHistoryModal(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-orange-500" />
              {shoeHistoryModal?.shoe?.shoes_name} — {t('running.run_history')}
            </DialogTitle>
          </DialogHeader>
          {shoeHistoryModal?.runs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p>{t('running.no_runs_for_shoe')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(shoeHistoryModal?.runs || []).map((run: any, i: number) => {
                const dur = (run.hour || run.minutes || run.second)
                  ? formatDuration(run.hour || 0, run.minutes || 0, run.second || 0)
                  : null;
                return (
                  <div key={run.id ?? i} className="bg-muted/40 rounded-xl p-3 flex flex-wrap gap-3 items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">{run.date}</span>
                        {run.running_type && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{run.running_type}</Badge>}
                      </div>
                      {run.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{run.notes}</p>}
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground flex-wrap shrink-0">
                      {run.distance_km && <span className="font-semibold text-foreground">{parseFloat(run.distance_km).toFixed(2)} km</span>}
                      {dur && <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{dur}</span>}
                      {run.average_pace && <span className="flex items-center gap-0.5"><Timer className="w-3 h-3" />{formatPace(parsePaceField(run.average_pace))}</span>}
                      {run.average_heart_rate && <span className="flex items-center gap-0.5"><Heart className="w-3 h-3 text-red-400" />{run.average_heart_rate} bpm</span>}
                      {run.average_cadence && <span>{parseFloat(run.average_cadence).toFixed(0)} spm</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShoeHistoryModal(null)}>{t('running.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
