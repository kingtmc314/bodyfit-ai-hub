import { useEffect, useMemo, useState } from "react";
import { Activity, CirclePlay, CloudSun, Footprints, History, Pause, RefreshCw, Save, Thermometer, Trash2, Wind, Zap } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useIsOwner } from "@/contexts/OwnerContext";
import {
  buildRunningEnergySimulation,
  formatPace,
  formatSeconds,
  type EasyRunDistance,
  type RunningScenario,
} from "@/lib/runningEnergyModel";
import { selectLabHistoricalRuns, type LabHistoricalRun } from "@shared/labHistoricalSelector";

interface RunningEnergyLabProps {
  maxHeartRate?: number;
  restingHeartRate?: number;
  profile?: {
    heightCm?: number | null;
    weightKg?: number | null;
    bodyFatPct?: number | null;
    muscleMassKg?: number | null;
    recordedDate?: string | null;
  } | null;
  historicalRuns?: LabHistoricalRun[];
}

const SCENARIOS: Array<{ id: RunningScenario; label: string; detail: string }> = [
  { id: "100m", label: "100m 衝刺", detail: "加速與 ATP-PCr" },
  { id: "200m", label: "200m 衝刺", detail: "爆發輸出" },
  { id: "400m", label: "400m 競速", detail: "乳酸壓力" },
  { id: "800m", label: "800m 競速", detail: "無氧／有氧交界" },
  { id: "1500m", label: "1500m 競速", detail: "速度耐力" },
  { id: "3000m", label: "3000m 競速", detail: "高需氧負荷" },
  { id: "easy", label: "穩定慢跑", detail: "10K · 半馬 · 全馬" },
];

const scenarioLabel = (scenario: string, distance?: string | null) => {
  const label = SCENARIOS.find(item => item.id === scenario)?.label ?? scenario;
  if (scenario !== "easy") return label;
  return `${label} · ${distance === "Half Marathon" ? "半馬" : distance === "Marathon" ? "全馬" : "10K"}`;
};

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/15 bg-slate-950/95 px-3 py-2.5 text-xs text-white shadow-2xl backdrop-blur-xl">
      <p className="mb-1.5 font-medium text-slate-300">{label}s</p>
      {payload.map((entry: any) => <p key={entry.name} style={{ color: entry.color }} className="leading-5">{entry.name}: <b>{entry.value}</b>{entry.name === "VO₂" ? " ml/kg/min" : entry.name === "心率" ? " bpm" : entry.name === "血乳酸" ? " mmol/L" : "%"}</p>)}
    </div>
  );
};

export default function RunningEnergyLab({ maxHeartRate, restingHeartRate, profile, historicalRuns = [] }: RunningEnergyLabProps) {
  const isOwner = useIsOwner();
  const utils = trpc.useUtils();
  const [scenario, setScenario] = useState<RunningScenario>("800m");
  const [easyRunDistance, setEasyRunDistance] = useState<EasyRunDistance>("10K");
  const [temperatureC, setTemperatureC] = useState(24);
  const [humidityPct, setHumidityPct] = useState(75);
  const [windKph, setWindKph] = useState(8);
  const [isPlaying, setIsPlaying] = useState(false);
  const [frame, setFrame] = useState(40);
  const [scenarioName, setScenarioName] = useState("");
  const { data: savedScenarios = [] } = trpc.running.getLabScenarios.useQuery();

  const saveScenario = trpc.running.saveLabScenario.useMutation({
    onSuccess: () => {
      utils.running.getLabScenarios.invalidate();
      setScenarioName("");
      toast.success("天氣情境已儲存，可在下方比較。 ");
    },
    onError: (error) => toast.error(`儲存失敗：${error.message}`),
  });
  const deleteScenario = trpc.running.deleteLabScenario.useMutation({
    onSuccess: () => {
      utils.running.getLabScenarios.invalidate();
      toast.success("已移除儲存的情境。");
    },
    onError: (error) => toast.error(`刪除失敗：${error.message}`),
  });

  const historySelection = useMemo(
    () => selectLabHistoricalRuns(historicalRuns, scenario, easyRunDistance),
    [historicalRuns, scenario, easyRunDistance],
  );
  const simulation = useMemo(() => buildRunningEnergySimulation({
    scenario,
    easyRunDistance,
    baselinePaceSecPerKm: historySelection.baselinePaceSecPerKm ?? undefined,
    maxHeartRate,
    restingHeartRate,
    heightCm: profile?.heightCm ?? undefined,
    weightKg: profile?.weightKg ?? undefined,
    bodyFatPct: profile?.bodyFatPct ?? undefined,
    muscleMassKg: profile?.muscleMassKg ?? undefined,
    runTypeDistribution: historySelection.selectedTypeDistribution,
    historicalRunCount: historySelection.selectedRuns.length,
    temperatureC,
    humidityPct,
    windKph,
  }), [scenario, easyRunDistance, historySelection, maxHeartRate, restingHeartRate, profile, temperatureC, humidityPct, windKph]);

  useEffect(() => {
    setFrame(40);
    setIsPlaying(false);
  }, [scenario, easyRunDistance, temperatureC, humidityPct, windKph]);

  useEffect(() => {
    if (!isPlaying) return;
    const animation = window.setInterval(() => {
      setFrame(current => {
        if (current >= 40) {
          window.clearInterval(animation);
          setIsPlaying(false);
          return 40;
        }
        return current + 1;
      });
    }, 150);
    return () => window.clearInterval(animation);
  }, [isPlaying]);

  const currentPoint = simulation.timeline[Math.min(frame, 40)];
  const liveTimeline = simulation.timeline.slice(0, Math.max(2, frame + 1)).map(point => ({ ...point, elapsed: Math.round(point.elapsedSeconds) }));
  const progress = (frame / 40) * 100;
  const simulationHint = historySelection.selectedRuns.length
    ? `已從 ${historySelection.consideredCount} 次完整歷史跑步中自動選取 ${historySelection.selectedRuns.length} 次相容樣本校準。`
    : "尚未有相容的歷史配速與距離資料，暫以保守參考值估算。";

  const replay = () => {
    setFrame(0);
    setIsPlaying(true);
  };
  const saveCurrentScenario = () => {
    const name = scenarioName.trim();
    if (!name) return toast.error("請為這個天氣情境命名。 ");
    saveScenario.mutate({
      name,
      runningScenario: scenario,
      easyRunDistance: scenario === "easy" ? easyRunDistance : undefined,
      temperatureC,
      humidityPct,
      windKph,
      baselinePaceSecPerKm: historySelection.baselinePaceSecPerKm ?? undefined,
      baselineFinishSeconds: simulation.baselineFinishSeconds,
      weatherPaceSecPerKm: simulation.weatherPaceSecPerKm,
      weatherFinishSeconds: simulation.weatherFinishSeconds,
      weatherLoadPercent: simulation.weatherLoadPercent,
    });
  };
  const loadScenario = (saved: any) => {
    const nextScenario = SCENARIOS.find(item => item.id === saved.runningScenario)?.id;
    if (!nextScenario) return toast.error("此情境的跑步項目已不再支援。 ");
    setScenario(nextScenario);
    if (saved.easyRunDistance === "10K" || saved.easyRunDistance === "Half Marathon" || saved.easyRunDistance === "Marathon") setEasyRunDistance(saved.easyRunDistance);
    setTemperatureC(Number(saved.temperatureC));
    setHumidityPct(Number(saved.humidityPct));
    setWindKph(Number(saved.windKph));
    setFrame(40);
    toast.success("已載入儲存的天氣情境。 ");
  };

  return (
    <section className="running-lab overflow-hidden rounded-[1.75rem] border border-slate-800 bg-slate-950 text-white shadow-[0_24px_80px_-28px_rgba(15,23,42,0.85)]">
      <div className="relative overflow-hidden border-b border-white/10 px-5 py-6 sm:px-7">
        <div className="pointer-events-none absolute inset-0 opacity-50" style={{ backgroundImage: "radial-gradient(circle at 88% 0%, rgba(16,185,129,.28), transparent 28rem), radial-gradient(circle at 4% 100%, rgba(249,115,22,.18), transparent 24rem)" }} />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 flex items-center gap-2 text-emerald-300"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/15"><Zap className="h-4 w-4" /></span><span className="text-[11px] font-bold uppercase tracking-[0.18em]">RUN SCIENCE LAB</span></div>
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">跑步能量系統互動實驗室</h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-300">用過往跑步資料校準，動態探索強度、環境與恢復反應如何改變供能策略。</p>
          </div>
          <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3.5 py-2.5 text-xs leading-5 text-amber-100 xl:max-w-xs"><b>教學用途的估算模型</b>：VO₂、乳酸、呼吸與氧債均非實驗室量測，不能作醫療或訓練處方。</div>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-slate-900/65 p-5 xl:border-b-0 xl:border-r">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">選擇跑步項目</p>
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
            {SCENARIOS.map(item => <button key={item.id} type="button" onClick={() => setScenario(item.id)} className={`rounded-xl border px-3 py-2.5 text-left transition-all ${scenario === item.id ? "border-emerald-300/60 bg-emerald-400/15 shadow-lg shadow-emerald-500/10" : "border-white/8 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.07]"}`}><span className="block text-sm font-semibold">{item.label}</span><span className="mt-0.5 block text-[11px] text-slate-400">{item.detail}</span></button>)}
          </div>
          {scenario === "easy" && <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-xl bg-black/20 p-1.5">{(["10K", "Half Marathon", "Marathon"] as EasyRunDistance[]).map(distance => <button key={distance} onClick={() => setEasyRunDistance(distance)} className={`rounded-lg px-1 py-2 text-[11px] font-semibold transition-colors ${easyRunDistance === distance ? "bg-white text-slate-900" : "text-slate-300 hover:bg-white/10"}`}>{distance === "Half Marathon" ? "半馬" : distance === "Marathon" ? "全馬" : distance}</button>)}</div>}
          <div className="mt-6 border-t border-white/10 pt-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><CloudSun className="h-4 w-4 text-amber-300" /> 天氣因素</div>
            <div className="space-y-3.5">
              <label className="block"><span className="mb-1.5 flex justify-between text-xs text-slate-300"><span className="flex items-center gap-1"><Thermometer className="h-3.5 w-3.5" /> 氣溫</span><b>{temperatureC}°C</b></span><Input aria-label="氣溫" type="range" min="5" max="38" value={temperatureC} onChange={event => setTemperatureC(Number(event.target.value))} className="running-lab-range h-2 border-0 bg-transparent p-0" /></label>
              <label className="block"><span className="mb-1.5 flex justify-between text-xs text-slate-300"><span className="flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> 濕度</span><b>{humidityPct}%</b></span><Input aria-label="相對濕度" type="range" min="30" max="95" value={humidityPct} onChange={event => setHumidityPct(Number(event.target.value))} className="running-lab-range h-2 border-0 bg-transparent p-0" /></label>
              <label className="block"><span className="mb-1.5 flex justify-between text-xs text-slate-300"><span className="flex items-center gap-1"><Wind className="h-3.5 w-3.5" /> 逆風</span><b>{windKph} km/h</b></span><Input aria-label="逆風" type="range" min="0" max="35" value={windKph} onChange={event => setWindKph(Number(event.target.value))} className="running-lab-range h-2 border-0 bg-transparent p-0" /></label>
            </div>
          </div>
        </aside>

        <div className="min-w-0 p-5 sm:p-7">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-300">模擬情境</p><h3 className="mt-1 text-2xl font-bold tracking-tight">{simulation.title}</h3><p className="mt-1 text-xs text-slate-400">{simulationHint}</p></div>
            <div className="flex flex-wrap gap-2"><Button type="button" onClick={() => isPlaying ? setIsPlaying(false) : (frame >= 40 ? replay() : setIsPlaying(true))} className="bg-emerald-400 text-slate-950 hover:bg-emerald-300">{isPlaying ? <Pause className="mr-1.5 h-4 w-4" /> : <CirclePlay className="mr-1.5 h-4 w-4" />}{isPlaying ? "暫停" : frame >= 40 ? "重新模擬" : "繼續"}</Button><Button type="button" variant="outline" onClick={() => { setIsPlaying(false); setFrame(40); }} className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"><RefreshCw className="mr-1.5 h-4 w-4" /> 完整結果</Button></div>
          </div>

          <div className="mb-5 rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="mb-2.5 flex items-center justify-between text-xs"><span className="font-medium text-slate-300">跑者進度 · {formatSeconds(currentPoint.elapsedSeconds)} / {formatSeconds(simulation.weatherFinishSeconds)}</span><span className="font-bold text-emerald-300">{Math.round(progress)}%</span></div>
            <div className="running-lab-track relative h-9 overflow-hidden rounded-lg border border-white/10 bg-slate-900"><div className="absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r from-emerald-500/35 to-cyan-400/30 transition-all duration-150" style={{ width: `${Math.max(3, progress)}%` }} /><div className="absolute inset-y-0 left-0 right-0 opacity-40" style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent 0 35px, rgba(255,255,255,.18) 36px 38px)" }} /><Footprints className="absolute top-2 h-5 w-5 text-white drop-shadow-[0_2px_8px_rgba(16,185,129,.9)] transition-all duration-150" style={{ left: `calc(${Math.min(progress, 96)}% - 0.65rem)` }} /></div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="估算完賽時間" value={formatSeconds(simulation.weatherFinishSeconds)} sub={`基準 ${formatSeconds(simulation.baselineFinishSeconds)}`} accent="text-emerald-300" /><Metric label="天氣後配速" value={formatPace(simulation.weatherPaceSecPerKm)} sub={`環境負荷 +${simulation.weatherLoadPercent}%`} accent="text-cyan-300" /><Metric label="能量系統" value={`${Math.round(currentPoint.aerobic)}% 有氧`} sub={`ATP-PCr ${Math.round(currentPoint.atpPcr)}% · 糖酵解 ${Math.round(currentPoint.glycolytic)}%`} accent="text-violet-300" /><Metric label="個人資料校準" value={simulation.calibration.level} sub={simulation.calibration.notes.length ? simulation.calibration.notes.slice(0, 2).join(" · ") : "使用參考值"} accent="text-amber-300" /></div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-bold">個人化校準資料</p><p className="mt-0.5 text-xs text-slate-400">掃描全部歷史跑步資料後，僅選取與目前項目相容的類型、路線與距離；例如衝刺不會把越野或長距離慢跑混入校準。</p></div><span className="w-fit rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-bold text-cyan-200">{simulation.calibration.level}</span></div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><CalibrationItem label="身體狀況" value={[profile?.heightCm ? `${profile.heightCm.toFixed(0)} cm` : null, profile?.weightKg ? `${profile.weightKg.toFixed(1)} kg` : null].filter(Boolean).join(" · ") || "待補充"} /><CalibrationItem label="體組成" value={[profile?.bodyFatPct ? `體脂 ${profile.bodyFatPct.toFixed(1)}%` : null, profile?.muscleMassKg ? `肌肉 ${profile.muscleMassKg.toFixed(1)} kg` : null].filter(Boolean).join(" · ") || "待補充"} /><CalibrationItem label="相容樣本配速" value={historySelection.baselinePaceSecPerKm ? formatPace(historySelection.baselinePaceSecPerKm) : "參考值"} /><CalibrationItem label="相容跑步類型" value={historySelection.selectedTypeDistribution.slice(0, 2).map(item => `${item.type} ${item.count}`).join(" · ") || "未有相符紀錄"} /></div>
            <div className="mt-3 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.055] px-3 py-2.5 text-xs text-cyan-50"><p className="font-semibold text-cyan-200">自動選取證據 · {historySelection.selectedRuns.length} / {historySelection.consideredCount} 次歷史跑步</p><p className="mt-1 leading-5 text-slate-300">規則：{historySelection.ruleLabel}</p><p className="mt-1 leading-5 text-slate-400">精確相符 {historySelection.eligibleCount} 次 · 排除越野 {historySelection.excludedTrailCount} 次 · 類型相符但距離不符 {historySelection.excludedDistanceCount} 次{historySelection.fallbackReason ? ` · ${historySelection.fallbackReason}` : ""}</p></div>
          </div>

          {isOwner && <div className="mt-5 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] p-3.5"><div className="flex flex-col gap-2 sm:flex-row"><Input value={scenarioName} onChange={event => setScenarioName(event.target.value)} maxLength={80} placeholder={`命名此情境，例如：${temperatureC}°C 潮濕 10K`} className="h-9 border-white/15 bg-slate-950/40 text-sm text-white placeholder:text-slate-500" /><Button type="button" onClick={saveCurrentScenario} disabled={saveScenario.isPending} className="h-9 shrink-0 bg-cyan-300 text-slate-950 hover:bg-cyan-200">{saveScenario.isPending ? <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}儲存比較</Button></div><p className="mt-2 text-[11px] text-cyan-100/75">會保存項目、天氣與預估結果；日後的歷史跑步更新不會覆蓋此比較快照。</p></div>}

          <div className="mt-5 grid gap-5 2xl:grid-cols-[1.18fr_.82fr]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5"><div className="mb-3"><p className="text-sm font-bold">ATP-PCr、乳酸與有氧供能</p><p className="mt-0.5 text-xs text-slate-400">三個能量系統會同時運作；此圖顯示相對貢獻比例。</p></div><ResponsiveContainer width="100%" height={255}><AreaChart data={liveTimeline} stackOffset="expand" margin={{ top: 5, right: 5, left: -22, bottom: 0 }}><defs><linearGradient id="atp-gradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#fbbf24" stopOpacity={0.85} /><stop offset="1" stopColor="#fbbf24" stopOpacity={0.25} /></linearGradient><linearGradient id="gly-gradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#fb7185" stopOpacity={0.85} /><stop offset="1" stopColor="#fb7185" stopOpacity={0.2} /></linearGradient><linearGradient id="aerobic-gradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#34d399" stopOpacity={0.85} /><stop offset="1" stopColor="#34d399" stopOpacity={0.2} /></linearGradient></defs><CartesianGrid stroke="#ffffff" strokeOpacity={0.08} vertical={false} /><XAxis dataKey="elapsed" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={value => `${Math.round(value * 100)}%`} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Legend wrapperStyle={{ fontSize: 11, color: "#cbd5e1" }} /><Area type="monotone" dataKey="atpPcr" name="ATP-PCr" stackId="1" stroke="#fbbf24" fill="url(#atp-gradient)" /><Area type="monotone" dataKey="glycolytic" name="乳酸糖酵解" stackId="1" stroke="#fb7185" fill="url(#gly-gradient)" /><Area type="monotone" dataKey="aerobic" name="有氧供能" stackId="1" stroke="#34d399" fill="url(#aerobic-gradient)" /></AreaChart></ResponsiveContainer></div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5"><div className="mb-3"><p className="text-sm font-bold">即時生理估算</p><p className="mt-0.5 text-xs text-slate-400">隨跑者進度更新的推算值</p></div><div className="grid grid-cols-2 gap-2.5"><LiveMetric label="VO₂" value={`${currentPoint.vo2}`} unit="ml/kg/min" tone="cyan" /><LiveMetric label="心跳速率" value={`${currentPoint.heartRate}`} unit="bpm" tone="rose" /><LiveMetric label="呼吸速率" value={`${currentPoint.respirationRate}`} unit="次／min" tone="violet" /><LiveMetric label="呼吸深度" value={`${Math.round(currentPoint.breathDepth * 100)}`} unit="% max" tone="sky" /><LiveMetric label="血乳酸" value={`${currentPoint.lactate}`} unit="mmol/L" tone="amber" /><LiveMetric label="氧債" value={`${Math.round(currentPoint.oxygenDebt)}`} unit="相對負荷" tone="emerald" /></div></div>
          </div>

          <div className="mt-5 grid gap-5 2xl:grid-cols-[1.18fr_.82fr]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5"><div className="mb-3"><p className="text-sm font-bold">VO₂、心率與血乳酸曲線</p><p className="mt-0.5 text-xs text-slate-400">用相同時間軸觀察需氧與無氧負荷的相對轉換。</p></div><ResponsiveContainer width="100%" height={220}><LineChart data={liveTimeline} margin={{ top: 5, right: 5, left: -22, bottom: 0 }}><CartesianGrid stroke="#ffffff" strokeOpacity={0.08} vertical={false} /><XAxis dataKey="elapsed" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Legend wrapperStyle={{ fontSize: 11, color: "#cbd5e1" }} /><Line type="monotone" dataKey="vo2" name="VO₂" stroke="#22d3ee" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="heartRate" name="心率" stroke="#fb7185" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="lactate" name="血乳酸" stroke="#fbbf24" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer></div>
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-400/10 to-transparent p-4 sm:p-5"><p className="text-sm font-bold">運動後氧債／恢復反應</p><p className="mt-0.5 text-xs text-slate-400">依本次相對強度及天氣負荷的恢復估算。</p><div className="mt-4 space-y-3"><RecoveryRow label="1 分鐘後心率" value={`${simulation.recovery.after1MinHr} bpm`} width="74%" /><RecoveryRow label="3 分鐘後心率" value={`${simulation.recovery.after3MinHr} bpm`} width="49%" /><RecoveryRow label="5 分鐘後心率" value={`${simulation.recovery.after5MinHr} bpm`} width="28%" /></div><div className="mt-5 rounded-xl border border-emerald-300/15 bg-emerald-400/10 p-3"><p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200">預估氧債清除</p><p className="mt-1 text-2xl font-bold text-emerald-300">{simulation.recovery.oxygenDebtClearPct}% <span className="text-xs font-medium text-emerald-100">於 5 分鐘內</span></p></div></div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between"><div><p className="flex items-center gap-2 text-sm font-bold"><History className="h-4 w-4 text-cyan-300" />已儲存的天氣比較</p><p className="mt-0.5 text-xs text-slate-400">以保存當刻的模型結果作橫向比較。</p></div><span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-300">{savedScenarios.length}/12</span></div>
            {savedScenarios.length === 0 ? <p className="py-5 text-center text-sm text-slate-400">尚未儲存比較情境。調整天氣後為結果命名，即可在這裡保留快照。</p> : <div className="overflow-x-auto"><table className="min-w-[680px] w-full text-left text-xs"><thead className="border-b border-white/10 text-slate-400"><tr><th className="pb-2 font-medium">情境</th><th className="pb-2 font-medium">環境</th><th className="pb-2 font-medium">預估時間</th><th className="pb-2 font-medium">天氣配速</th><th className="pb-2 font-medium">負荷</th><th className="pb-2 font-medium">儲存時間（香港）</th><th className="pb-2" /></tr></thead><tbody>{(savedScenarios as any[]).map(saved => <tr key={saved.id} className="border-b border-white/[0.07] last:border-0"><td className="py-3 pr-3"><p className="font-semibold text-white">{saved.name}</p><p className="mt-0.5 text-slate-400">{scenarioLabel(saved.runningScenario, saved.easyRunDistance)}</p></td><td className="py-3 pr-3 text-slate-300">{Number(saved.temperatureC).toFixed(0)}°C · {saved.humidityPct}% · {Number(saved.windKph).toFixed(0)} km/h</td><td className="py-3 pr-3 font-semibold text-emerald-300">{formatSeconds(Number(saved.weatherFinishSeconds))}</td><td className="py-3 pr-3 text-cyan-200">{formatPace(Number(saved.weatherPaceSecPerKm))}</td><td className="py-3 pr-3 text-amber-200">+{Number(saved.weatherLoadPercent).toFixed(1)}%</td><td className="py-3 pr-3 text-slate-400">{new Date(saved.createdAt).toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}</td><td className="py-3"><div className="flex justify-end gap-1"><Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-cyan-200 hover:bg-white/10 hover:text-cyan-100" onClick={() => loadScenario(saved)}>載入</Button>{isOwner && <Button type="button" variant="ghost" size="icon" aria-label={`刪除 ${saved.name}`} className="h-7 w-7 text-slate-400 hover:bg-rose-500/15 hover:text-rose-300" onClick={() => deleteScenario.mutate({ id: Number(saved.id) })}><Trash2 className="h-3.5 w-3.5" /></Button>}</div></td></tr>)}</tbody></table></div>}
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-1 text-lg font-bold ${accent}`}>{value}</p><p className="mt-0.5 text-[11px] text-slate-400">{sub}</p></div>;
}

function CalibrationItem({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-slate-950/35 px-3 py-2.5"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 truncate text-xs font-medium text-slate-200" title={value}>{value}</p></div>;
}

function LiveMetric({ label, value, unit, tone }: { label: string; value: string; unit: string; tone: "cyan" | "rose" | "violet" | "sky" | "amber" | "emerald" }) {
  const tones = { cyan: "border-cyan-300/15 bg-cyan-400/10 text-cyan-200", rose: "border-rose-300/15 bg-rose-400/10 text-rose-200", violet: "border-violet-300/15 bg-violet-400/10 text-violet-200", sky: "border-sky-300/15 bg-sky-400/10 text-sky-200", amber: "border-amber-300/15 bg-amber-400/10 text-amber-200", emerald: "border-emerald-300/15 bg-emerald-400/10 text-emerald-200" };
  return <div className={`rounded-xl border p-3 ${tones[tone]}`}><p className="text-[11px] font-semibold opacity-75">{label}</p><p className="mt-1 text-xl font-bold leading-none">{value}</p><p className="mt-1 text-[10px] opacity-75">{unit}</p></div>;
}

function RecoveryRow({ label, value, width }: { label: string; value: string; width: string }) {
  return <div><div className="mb-1 flex justify-between text-xs text-slate-300"><span>{label}</span><b className="text-white">{value}</b></div><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300" style={{ width }} /></div></div>;
}
