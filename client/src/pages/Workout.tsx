import { useTranslation } from 'react-i18next';
import { useState, useMemo, useRef, useEffect } from "react";
import { useIsOwner } from "@/contexts/OwnerContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { todayHKString, toHKDateString, formatHKChartDate } from "@/lib/hkTime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Dumbbell, Trash2, Edit2, Search, ChevronRight, Loader2,
  Flame, Timer, Weight, BarChart2, X, Check, Trophy, Target, Star, ArrowUpDown,
  Camera, Sparkles, PlusCircle, AlertCircle, CheckCircle2
} from "lucide-react";
import MuscleMap, { MUSCLE_GROUPS } from "@/components/MuscleMap";
import ExerciseDetailModal from "@/components/ExerciseDetailModal";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area
} from "recharts";

const EQUIPMENT_LIST = [
  "Barbell", "Dumbbell", "Cable", "Machine", "Smith Machine",
  "Kettlebell", "Resistance Band", "Bodyweight", "TRX / Suspension",
  "Pull-up Bar", "Dip Bar", "EZ Bar", "Trap Bar", "Plate",
  "Foam Roller", "Medicine Ball", "Battle Rope", "Cardio Machine",
];

const BUILT_IN_EXERCISES = [
  // Chest
  { name: "Bench Press", nameZh: "臥推", muscleGroup: "chest", equipment: "Barbell", instructions: "Lie on bench, grip bar shoulder-width, lower to chest, press up." },
  { name: "Incline Bench Press", nameZh: "上斜臥推", muscleGroup: "chest", equipment: "Barbell" },
  { name: "Decline Bench Press", nameZh: "下斜臥推", muscleGroup: "chest", equipment: "Barbell" },
  { name: "Dumbbell Fly", nameZh: "啞鈴飛鳥", muscleGroup: "chest", equipment: "Dumbbell" },
  { name: "Cable Crossover", nameZh: "繩索夾胸", muscleGroup: "chest", equipment: "Cable" },
  { name: "Chest Press Machine", nameZh: "胸推機", muscleGroup: "chest", equipment: "Machine" },
  { name: "Push-up", nameZh: "掌上壓", muscleGroup: "chest", equipment: "Bodyweight" },
  { name: "Pec Deck", nameZh: "蝴蝶機夾胸", muscleGroup: "chest", equipment: "Machine" },
  // Back
  { name: "Deadlift", nameZh: "硬拉", muscleGroup: "back", equipment: "Barbell" },
  { name: "Pull-up", nameZh: "引體向上", muscleGroup: "back", equipment: "Pull-up Bar" },
  { name: "Lat Pulldown", nameZh: "下拉機", muscleGroup: "lats", equipment: "Cable" },
  { name: "Seated Cable Row", nameZh: "坐姿划船", muscleGroup: "back", equipment: "Cable" },
  { name: "Bent-over Barbell Row", nameZh: "俯身槓鈴划船", muscleGroup: "back", equipment: "Barbell" },
  { name: "T-Bar Row", nameZh: "T型划船", muscleGroup: "back", equipment: "Barbell" },
  { name: "Single-arm Dumbbell Row", nameZh: "單臂啞鈴划船", muscleGroup: "back", equipment: "Dumbbell" },
  { name: "Hyperextension", nameZh: "背伸展", muscleGroup: "back", equipment: "Machine" },
  // Shoulders
  { name: "Overhead Press", nameZh: "過頭推舉", muscleGroup: "shoulders", equipment: "Barbell" },
  { name: "Dumbbell Shoulder Press", nameZh: "啞鈴肩推", muscleGroup: "shoulders", equipment: "Dumbbell" },
  { name: "Lateral Raise", nameZh: "側平舉", muscleGroup: "shoulders", equipment: "Dumbbell" },
  { name: "Front Raise", nameZh: "前平舉", muscleGroup: "shoulders", equipment: "Dumbbell" },
  { name: "Rear Delt Fly", nameZh: "後三角飛鳥", muscleGroup: "shoulders", equipment: "Dumbbell" },
  { name: "Face Pull", nameZh: "繩索臉拉", muscleGroup: "shoulders", equipment: "Cable" },
  { name: "Arnold Press", nameZh: "阿諾德推舉", muscleGroup: "shoulders", equipment: "Dumbbell" },
  { name: "Shoulder Press Machine", nameZh: "肩推機", muscleGroup: "shoulders", equipment: "Machine" },
  // Biceps
  { name: "Barbell Curl", nameZh: "槓鈴彎舉", muscleGroup: "biceps", equipment: "Barbell" },
  { name: "Dumbbell Curl", nameZh: "啞鈴彎舉", muscleGroup: "biceps", equipment: "Dumbbell" },
  { name: "Hammer Curl", nameZh: "錘式彎舉", muscleGroup: "biceps", equipment: "Dumbbell" },
  { name: "Preacher Curl", nameZh: "牧師椅彎舉", muscleGroup: "biceps", equipment: "EZ Bar" },
  { name: "Cable Curl", nameZh: "繩索彎舉", muscleGroup: "biceps", equipment: "Cable" },
  { name: "Concentration Curl", nameZh: "集中彎舉", muscleGroup: "biceps", equipment: "Dumbbell" },
  // Triceps
  { name: "Tricep Dip", nameZh: "三頭撐體", muscleGroup: "triceps", equipment: "Dip Bar" },
  { name: "Skull Crusher", nameZh: "頭骨碎裂者", muscleGroup: "triceps", equipment: "EZ Bar" },
  { name: "Tricep Pushdown", nameZh: "繩索下壓", muscleGroup: "triceps", equipment: "Cable" },
  { name: "Overhead Tricep Extension", nameZh: "過頭三頭伸展", muscleGroup: "triceps", equipment: "Dumbbell" },
  { name: "Close-grip Bench Press", nameZh: "窄握臥推", muscleGroup: "triceps", equipment: "Barbell" },
  { name: "Tricep Kickback", nameZh: "三頭後踢", muscleGroup: "triceps", equipment: "Dumbbell" },
  // Legs
  { name: "Squat", nameZh: "深蹲", muscleGroup: "quads", equipment: "Barbell" },
  { name: "Leg Press", nameZh: "腿推機", muscleGroup: "quads", equipment: "Machine" },
  { name: "Leg Extension", nameZh: "腿伸展機", muscleGroup: "quads", equipment: "Machine" },
  { name: "Leg Curl", nameZh: "腿彎舉機", muscleGroup: "hamstrings", equipment: "Machine" },
  { name: "Romanian Deadlift", nameZh: "羅馬尼亞硬拉", muscleGroup: "hamstrings", equipment: "Barbell" },
  { name: "Lunge", nameZh: "弓步蹲", muscleGroup: "quads", equipment: "Dumbbell" },
  { name: "Bulgarian Split Squat", nameZh: "保加利亞分腿蹲", muscleGroup: "quads", equipment: "Dumbbell" },
  { name: "Hip Thrust", nameZh: "臀推", muscleGroup: "glutes", equipment: "Barbell" },
  { name: "Glute Bridge", nameZh: "臀橋", muscleGroup: "glutes", equipment: "Bodyweight" },
  { name: "Standing Calf Raise", nameZh: "站姿提踵", muscleGroup: "calves", equipment: "Machine" },
  { name: "Seated Calf Raise", nameZh: "坐姿提踵", muscleGroup: "calves", equipment: "Machine" },
  // Abs
  { name: "Crunch", nameZh: "捲腹", muscleGroup: "abs", equipment: "Bodyweight" },
  { name: "Plank", nameZh: "平板支撐", muscleGroup: "abs", equipment: "Bodyweight" },
  { name: "Cable Crunch", nameZh: "繩索捲腹", muscleGroup: "abs", equipment: "Cable" },
  { name: "Hanging Leg Raise", nameZh: "懸掛舉腿", muscleGroup: "abs", equipment: "Pull-up Bar" },
  { name: "Russian Twist", nameZh: "俄羅斯轉體", muscleGroup: "obliques", equipment: "Bodyweight" },
  { name: "Ab Wheel Rollout", nameZh: "腹輪", muscleGroup: "abs", equipment: "Bodyweight" },
  // Traps
  { name: "Barbell Shrug", nameZh: "槓鈴聳肩", muscleGroup: "traps", equipment: "Barbell" },
  { name: "Dumbbell Shrug", nameZh: "啞鈴聳肩", muscleGroup: "traps", equipment: "Dumbbell" },
  { name: "Upright Row", nameZh: "直立划船", muscleGroup: "traps", equipment: "Barbell" },
  // Forearms
  { name: "Wrist Curl", nameZh: "腕彎舉", muscleGroup: "forearms", equipment: "Barbell" },
  { name: "Reverse Curl", nameZh: "反握彎舉", muscleGroup: "forearms", equipment: "Barbell" },
  { name: "Farmer's Walk", nameZh: "農夫走路", muscleGroup: "forearms", equipment: "Dumbbell" },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-xl text-xs">
        <p className="text-muted-foreground mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }} className="font-semibold">{p.name}: {Math.round(p.value)}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Workout() {
  const { t } = useTranslation();
  const isOwner = useIsOwner();
  const [selectedDate, setSelectedDate] = useState(() => todayHKString());
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState<string>("all");
  const [showSessionDialog, setShowSessionDialog] = useState(false);
  const [showAddSetDialog, setShowAddSetDialog] = useState(false);
  const [showExerciseDialog, setShowExerciseDialog] = useState(false);
  const [showExerciseDetail, setShowExerciseDetail] = useState(false);
  const [detailExercise, setDetailExercise] = useState<any>(null);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [selectedExercise, setSelectedExercise] = useState<any>(null);
  const [setForm, setSetForm] = useState({ reps: 10, weight: 0, notes: "" });
  const [sessionName, setSessionName] = useState("");
  const [editSet, setEditSet] = useState<any>(null);
  const [sessionSort, setSessionSort] = useState<'date_desc'|'date_asc'|'volume_desc'|'duration_desc'>('date_desc');
  const [sessionSearch, setSessionSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'session'|'exercises'|'history'>('session');
  // Custom exercise creation state
  const [showCreateExerciseDialog, setShowCreateExerciseDialog] = useState(false);
  const [createExForm, setCreateExForm] = useState({ name: '', nameZh: '', muscleGroup: 'chest', equipment: 'Barbell', instructions: '' });
  const [aiIdentifyLoading, setAiIdentifyLoading] = useState(false);
  const [aiIdentifyResult, setAiIdentifyResult] = useState<any>(null);
  const createExPhotoRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: sessions = [], isLoading } = trpc.workout.getSessions.useQuery({
    startDate: toHKDateString(new Date(Date.now() - 90 * 86400000)),
  });
  const { data: sessionDetail } = trpc.workout.getSessionWithSets.useQuery(
    { sessionId: activeSession?.id }, { enabled: !!activeSession?.id }
  );

  const createSession = trpc.workout.createSession.useMutation({
    onSuccess: (data) => {
      utils.workout.getSessions.invalidate();
      setActiveSession({ id: data.id, name: sessionName, date: selectedDate });
      setShowSessionDialog(false);
      toast.success("Workout session started!");
    },
  });
  const deleteSession = trpc.workout.deleteSession.useMutation({
    onSuccess: () => { utils.workout.getSessions.invalidate(); setActiveSession(null); toast.success("Session deleted"); },
  });
  const addSet = trpc.workout.addSet.useMutation({
    onSuccess: () => {
      utils.workout.getSessionWithSets.invalidate();
      utils.workout.getSessions.invalidate();
      setShowAddSetDialog(false);
      toast.success("Set logged!");
    },
  });
  const updateSet = trpc.workout.updateSet.useMutation({
    onSuccess: () => {
      utils.workout.getSessionWithSets.invalidate();
      utils.workout.getSessions.invalidate();
      setEditSet(null);
      toast.success("Updated!");
    },
  });
  const deleteSet = trpc.workout.deleteSet.useMutation({
    onSuccess: () => {
      utils.workout.getSessionWithSets.invalidate();
      utils.workout.getSessions.invalidate();
      toast.success("Set deleted");
    },
  });

  const [finishLoading, setFinishLoading] = useState(false);
  const finishSession = trpc.workout.finishSession.useMutation({
    onSuccess: (data) => {
      utils.workout.getSessions.invalidate();
      setFinishLoading(false);
      const calMsg = data.caloriesBurned ? ` · 消耗 ${data.caloriesBurned} kcal 🔥` : '';
      toast.success(`訓練完成！共 ${data.duration} 分鐘${calMsg} 🎉`);
      setActiveSession(null);
    },
    onError: (e) => { setFinishLoading(false); toast.error('錯誤: ' + e.message); },
  });

  const [showAiAnalysis, setShowAiAnalysis] = useState(false);
  const [aiAnalysisExercise, setAiAnalysisExercise] = useState<string | null>(null);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<{ analysis: string; recommendations: Array<{ title: string; detail: string; type: string }> } | null>(null);
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const analyzeExercise = trpc.workout.analyzeExercise.useMutation({
    onSuccess: (data) => { setAiAnalysisResult(data); setAiAnalysisLoading(false); },
    onError: (e) => { toast.error('AI 分析失敗: ' + e.message); setAiAnalysisLoading(false); },
  });

  const { data: favourites = [] } = trpc.workout.getFavourites.useQuery();
  const favouriteSet = useMemo(() => new Set(favourites as string[]), [favourites]);

  const toggleFavourite = trpc.workout.toggleFavourite.useMutation({
    onSuccess: () => { utils.workout.getFavourites.invalidate(); },
    onError: (e) => toast.error('錯誤: ' + e.message),
  });

  // Fetch custom exercises
  const { data: customExercisesData = [] } = trpc.workout.getCustomExercises.useQuery();
  const createCustomExercise = trpc.workout.createCustomExercise.useMutation({
    onSuccess: () => {
      utils.workout.getCustomExercises.invalidate();
      setShowCreateExerciseDialog(false);
      setCreateExForm({ name: '', nameZh: '', muscleGroup: 'chest', equipment: 'Barbell', instructions: '' });
      setAiIdentifyResult(null);
      toast.success('自訂動作已新增！');
    },
  });
  const deleteCustomExercise = trpc.workout.deleteCustomExercise.useMutation({
    onSuccess: () => { utils.workout.getCustomExercises.invalidate(); toast.success('已刪除'); },
  });
  const identifyExerciseFromPhoto = trpc.workout.identifyExerciseFromPhoto.useMutation({
    onSuccess: (data) => {
      setAiIdentifyResult(data);
      setCreateExForm(f => ({
        ...f,
        name: data.name || f.name,
        nameZh: data.nameZh || f.nameZh,
        muscleGroup: data.muscleGroup || f.muscleGroup,
        equipment: data.equipment || f.equipment,
        instructions: data.instructions || f.instructions,
      }));
      setAiIdentifyLoading(false);
    },
    onError: (e) => { toast.error('AI 識別失敗: ' + e.message); setAiIdentifyLoading(false); },
  });

  const allExercises = useMemo(() => {
    const custom = (customExercisesData as any[]).map(c => ({ ...c, isCustom: true }));
    return [...BUILT_IN_EXERCISES, ...custom];
  }, [customExercisesData]);

  const filteredExercises = useMemo(() => {
    return allExercises.filter(e => {
      const matchMuscle = !selectedMuscle || e.muscleGroup === selectedMuscle;
      const matchEquip = selectedEquipment === 'all' || e.equipment === selectedEquipment;
      const matchSearch = !searchQuery || e.name.toLowerCase().includes(searchQuery.toLowerCase()) || (e.nameZh||'').includes(searchQuery);
      return matchMuscle && matchEquip && matchSearch;
    });
  }, [allExercises, selectedMuscle, selectedEquipment, searchQuery]);

  // Auto-restore today's latest session from sessions list
  useEffect(() => {
    if (sessions.length > 0 && !activeSession) {
      const todayStr = todayHKString();
      const todaySessions = sessions.filter((s: any) => toHKDateString(new Date(s.startTime)) === todayStr);
      if (todaySessions.length > 0) {
        const latest = todaySessions.sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];
        setActiveSession(latest);
      }
    }
  }, [sessions]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeMuscles = useMemo(() => {
    if (!sessionDetail?.sets) return [];
    const muscles = new Set<string>();
    sessionDetail.sets.forEach(s => {
      if (!s.exerciseName) return;
      // Match by English name, Chinese name, or direct muscleGroup value
      const ex = allExercises.find(e =>
        e.name === s.exerciseName ||
        (e as any).nameZh === s.exerciseName ||
        e.name.toLowerCase() === (s.exerciseName ?? '').toLowerCase()
      );
      if (ex) {
        muscles.add(ex.muscleGroup);
      } else {
        // Fallback: if exerciseName itself is a valid muscle group id, use it directly
        const validMuscles = ['chest','back','lats','shoulders','biceps','triceps','quads','hamstrings','glutes','calves','core','abs','cardio'];
        if (validMuscles.includes(s.exerciseName.toLowerCase())) {
          muscles.add(s.exerciseName.toLowerCase());
        }
      }
    });
    return Array.from(muscles);
  }, [sessionDetail, allExercises]);

  const volumeByExercise = useMemo(() => {
    if (!sessionDetail?.sets) return [];
    const map: Record<string, number> = {};
    sessionDetail.sets.forEach(s => {
      const vol = (s.reps || 0) * (s.weight || 0);
      const exName = s.exerciseName || 'Unknown';
      map[exName] = (map[exName] || 0) + vol;
    });
    return Object.entries(map).map(([name, vol]) => ({ name: name.split(" ").slice(0, 2).join(" "), vol: Math.round(vol) }));
  }, [sessionDetail]);

  // Live calories estimate for active session (before finishing)
  const liveCaloriesEstimate = useMemo(() => {
    if (!sessionDetail?.sets?.length) return 0;
    const totalVol = sessionDetail.sets.reduce((sum, s) => sum + (s.reps || 0) * (s.weight || 0), 0);
    const met = totalVol > 5000 ? 6 : totalVol > 2000 ? 5.5 : 5;
    // Estimate duration from session start time
    const startTime = activeSession?.startTime ? new Date(activeSession.startTime) : null;
    const durationMin = startTime ? Math.max(1, Math.round((Date.now() - startTime.getTime()) / 60000)) : 30;
    return Math.round(met * 70 * (durationMin / 60));
  }, [sessionDetail, activeSession]);

  const weeklyVolume = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = toHKDateString(new Date(Date.now() - (6 - i) * 86400000));
      const daySessions = sessions.filter(s => toHKDateString(new Date(s.startTime)) === d);
      return {
        date: new Date(Date.now() - (6 - i) * 86400000).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Hong_Kong' }),
        volume: Math.round(daySessions.reduce((s, sess) => s + (sess.totalVolume || 0), 0)),
      };
    });
  }, [sessions]);

  const handleStartSession = () => {
    if (!sessionName.trim()) return toast.error("Enter session name");
    createSession.mutate({ date: selectedDate, name: sessionName });
  };

  const handleAddSet = () => {
    if (!selectedExercise || !activeSession) return;
    const setNum = (sessionDetail?.sets.filter(s => s.exerciseName === selectedExercise.name).length || 0) + 1;
    if (editSet) {
      updateSet.mutate({ id: editSet.id, reps: setForm.reps, weight: setForm.weight, notes: setForm.notes });
    } else {
      addSet.mutate({
        sessionId: activeSession.id,
        exerciseName: selectedExercise.name,
        setNumber: setNum,
        reps: setForm.reps,
        weight: setForm.weight,
        notes: setForm.notes,
      });
    }
  };

  const exerciseGroups = useMemo(() => {
    if (!sessionDetail?.sets) return {};
    const groups: Record<string, typeof sessionDetail.sets> = {};
    sessionDetail.sets.forEach(s => {
      const exName = s.exerciseName || 'Unknown';
      if (!groups[exName]) groups[exName] = [];
      groups[exName].push(s);
    });
    return groups;
  }, [sessionDetail]);

  const handleAiPhotoIdentify = (file: File) => {
    setAiIdentifyLoading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const base64 = dataUrl.split(',')[1];
      const mimeType = file.type || 'image/jpeg';
      identifyExerciseFromPhoto.mutate({ base64, mimeType });
    };
    reader.readAsDataURL(file);
  };

  const handleCreateCustomExercise = () => {
    if (!createExForm.name.trim()) return toast.error('請輸入動作名稱');
    createCustomExercise.mutate(createExForm);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Sunny Page Header */}
      <div className="hero-gradient rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-white">{t('workout.title')}</h1>
            <p className="text-white/70 text-sm mt-0.5">{t('workout.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-40 text-sm bg-white/20 border-white/30 text-white placeholder:text-white/50" />
            {!activeSession ? (
              <Button onClick={() => setShowSessionDialog(true)} size="sm" className="gap-2 bg-white text-primary hover:bg-white/90">
                <Plus className="w-4 h-4" /> {t('workout.start_workout')}
              </Button>
            ) : (
              <Badge variant="outline" className="gap-2 bg-white/20 text-white border-white/40">
                <div className="w-2 h-2 rounded-full bg-white pulse-dot" />
                {activeSession.name}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="session">{t('workout.active_session')}{activeSession && <span className="ml-1.5 w-2 h-2 rounded-full bg-green-400 inline-block" />}</TabsTrigger>
          <TabsTrigger value="exercises">{t('workout.exercise_library')}</TabsTrigger>
          <TabsTrigger value="history">{t('workout.history')}</TabsTrigger>
        </TabsList>

        {/* Active Session Tab */}
        <TabsContent value="session" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Muscle Map */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-3 text-sm">{t('workout.muscle_groups')}</h3>
              <MuscleMap activeMuscles={activeMuscles} selectedMuscle={selectedMuscle}
                onSelect={m => setSelectedMuscle(prev => prev === m ? null : m)} />
              {activeMuscles.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {activeMuscles.map(m => (
                    <Badge key={m} variant="secondary" className="text-xs capitalize">{m}</Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Session Log */}
            <div className="lg:col-span-2 space-y-3">
              {!activeSession ? (
                <div className="bg-card border border-border rounded-2xl p-8 text-center">
                  <Dumbbell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">No active session. {isOwner ? 'Start a workout to begin logging.' : 'No workout session today.'}</p>
                  {isOwner && (
                    <Button className="mt-4 gap-2" onClick={() => setShowSessionDialog(true)}>
                      <Plus className="w-4 h-4" /> Start Workout
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between bg-card border border-border rounded-2xl px-5 py-3">
                    <div>
                      <p className="font-semibold text-foreground">{activeSession.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground">{activeSession.date}</p>
                        {liveCaloriesEstimate > 0 && (
                          <span className="text-xs font-medium text-orange-500">{liveCaloriesEstimate} kcal est.</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {isOwner && <Button size="sm" variant="outline" className="gap-2" onClick={() => { setSearchQuery(''); setShowExerciseDialog(true); }}>
                        <Plus className="w-3.5 h-3.5" /> Add Exercise
                      </Button>}
                      {isOwner && <Button size="sm" className="gap-2 bg-green-500 hover:bg-green-600 text-white"
                        disabled={finishLoading}
                        onClick={() => { setFinishLoading(true); finishSession.mutate({ id: activeSession.id }); }}>
                        {finishLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        結束訓練
                      </Button>}
                      {isOwner && <Button size="sm" variant="destructive" onClick={() => deleteSession.mutate({ id: activeSession.id })}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>}
                    </div>
                  </div>

                  {Object.keys(exerciseGroups).length === 0 ? (
                    <div className="bg-card border border-border rounded-2xl p-6 text-center">
                      <p className="text-muted-foreground text-sm">No exercises logged yet. Add an exercise to start.</p>
                    </div>
                  ) : (
                    Object.entries(exerciseGroups).map(([exerciseName, sets]) => {
                      const ex = allExercises.find(e => e.name === exerciseName || (e as any).nameZh === exerciseName);
                      const totalVol = sets.reduce((sum, s) => sum + Math.round((s.reps || 0) * (s.weight || 0)), 0);
                      return (
                        <div key={exerciseName} className="bg-card border border-border rounded-2xl overflow-hidden">
                          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-foreground text-sm">{exerciseName}</p>
                                {totalVol > 0 && <span className="text-xs font-medium text-orange-500 bg-orange-50 dark:bg-orange-950/30 px-2 py-0.5 rounded-full">{totalVol.toLocaleString()} kg</span>}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {ex && <Badge variant="secondary" className="text-xs capitalize">{ex.muscleGroup}</Badge>}
                                {ex?.equipment && <Badge variant="outline" className="text-xs">{ex.equipment}</Badge>}
                              </div>
                            </div>
                            <div className="flex gap-1">
                              {isOwner && <Button size="sm" variant="ghost" className="gap-1 text-xs"
                                onClick={() => { setSelectedExercise(ex || { name: exerciseName }); setSetForm({ reps: 10, weight: sets[sets.length - 1]?.weight || 0, notes: "" }); setEditSet(null); setShowAddSetDialog(true); }}>
                                <Plus className="w-3.5 h-3.5" /> Set
                              </Button>}
                              <Button size="sm" variant="ghost" className="gap-1 text-xs text-purple-500 hover:text-purple-600"
                                onClick={() => { setAiAnalysisExercise(exerciseName); setAiAnalysisResult(null); setShowAiAnalysis(true); setAiAnalysisLoading(true); analyzeExercise.mutate({ exerciseName }); }}>
                                <Sparkles className="w-3.5 h-3.5" /> AI
                              </Button>
                            </div>
                          </div>
                          <div className="divide-y divide-border">
                            {sets.map((s, i) => (
                              <div key={s.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/20">
                                <span className="text-xs text-muted-foreground w-8">Set {i + 1}</span>
                                <span className="text-sm font-semibold text-foreground flex-1">{s.reps} reps × {s.weight} kg</span>
                                <span className="text-xs text-muted-foreground">{Math.round((s.reps || 0) * (s.weight || 0))} kg vol</span>
                                {isOwner && <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="w-6 h-6"
                                    onClick={() => { setEditSet(s); setSelectedExercise(ex || { name: exerciseName }); setSetForm({ reps: s.reps || 10, weight: s.weight || 0, notes: s.notes || "" }); setShowAddSetDialog(true); }}>
                                    <Edit2 className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="w-6 h-6 text-destructive"
                                    onClick={() => deleteSet.mutate({ id: s.id })}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Volume Chart */}
                  {volumeByExercise.length > 0 && (
                    <div className="bg-card border border-border rounded-2xl p-5">
                      <h3 className="font-semibold text-foreground mb-3 text-sm">Session Volume by Exercise</h3>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={volumeByExercise} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.018 240)" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} width={80} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="vol" name="Volume (kg)" fill="oklch(0.75 0.17 280)" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Exercise Library Tab */}
        <TabsContent value="exercises" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Filters */}
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-2xl p-4">
                <h3 className="font-semibold text-foreground text-sm mb-3">Filter by Muscle</h3>
                <MuscleMap activeMuscles={activeMuscles} selectedMuscle={selectedMuscle} onSelect={m => setSelectedMuscle(prev => prev === m ? null : m)} />
                {selectedMuscle && (
                  <Button variant="ghost" size="sm" className="w-full mt-2 text-xs" onClick={() => setSelectedMuscle(null)}>
                    <X className="w-3 h-3 mr-1" /> Clear filter
                  </Button>
                )}
              </div>
            </div>

            {/* Exercise List */}
            <div className="lg:col-span-3 space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search exercises…" className="pl-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => setShowCreateExerciseDialog(true)}>
                  <PlusCircle className="w-4 h-4" /> 新增自訂
                </Button>
                <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Equipment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Equipment</SelectItem>
                    {EQUIPMENT_LIST.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* My Favourites section */}
              {favouriteSet.size > 0 && !searchQuery && !selectedMuscle && selectedEquipment === 'all' && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" /> 我的最愛
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {BUILT_IN_EXERCISES.filter(ex => favouriteSet.has(ex.name)).map((ex, i) => (
                      <div key={`fav-${i}`} className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3 hover:border-yellow-500/40 transition-colors cursor-pointer"
                        onClick={() => { setDetailExercise(ex); setShowExerciseDetail(true); }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground text-sm">{ex.name}</p>
                            <p className="text-xs text-muted-foreground">{ex.nameZh}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              <Badge variant="secondary" className="text-xs capitalize">{ex.muscleGroup}</Badge>
                              <Badge variant="outline" className="text-xs">{ex.equipment}</Badge>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 shrink-0">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                              onClick={(e) => { e.stopPropagation(); toggleFavourite.mutate({ exerciseName: ex.name }); }}>
                              <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                            </Button>
                            {activeSession && (
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                                onClick={(e) => { e.stopPropagation(); setSelectedExercise(ex); setSetForm({ reps: 10, weight: 0, notes: "" }); setEditSet(null); setShowAddSetDialog(true); }}>
                                <Plus className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredExercises.map((ex: any, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-colors stagger-item cursor-pointer"
                    onClick={() => { setDetailExercise(ex); setShowExerciseDetail(true); }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-lg" title={ex.equipment}>
                            {({Barbell:'🏋️',Dumbbell:'💪',Cable:'🔗',Machine:'⚙️',Bodyweight:'🤸','Pull-up Bar':'🔝','EZ Bar':'〰️','Resistance Band':'🎗️',Kettlebell:'🫙','Smith Machine':'🏗️','Trap Bar':'🏋️','Dip Bar':'🔝',Plate:'⚖️','Foam Roller':'🔵','Medicine Ball':'🏀','Battle Rope':'〰️','Cardio Machine':'🚴','TRX / Suspension':'🎗️'} as Record<string,string>)[ex.equipment] || '🏋️'}
                          </span>
                          <p className="font-semibold text-foreground text-sm">{ex.name}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{ex.nameZh}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <Badge variant="secondary" className="text-xs capitalize">{ex.muscleGroup}</Badge>
                          <Badge variant="outline" className="text-xs">{ex.equipment}</Badge>
                        </div>
                        {ex.instructions && (
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{ex.instructions}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        {!(ex as any).isCustom && (
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0"
                            onClick={(e) => { e.stopPropagation(); toggleFavourite.mutate({ exerciseName: ex.name }); }}>
                            <Star className={`w-4 h-4 transition-colors ${favouriteSet.has(ex.name) ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} />
                          </Button>
                        )}
                        {(ex as any).isCustom && (
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive"
                            onClick={(e) => { e.stopPropagation(); deleteCustomExercise.mutate({ id: (ex as any).id }); }}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                        {activeSession && (
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0"
                            onClick={(e) => { e.stopPropagation(); setSelectedExercise(ex); setSetForm({ reps: 10, weight: 0, notes: "" }); setEditSet(null); setShowAddSetDialog(true); }}>
                            <Plus className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {filteredExercises.length === 0 && (
                  <div className="col-span-2 text-center py-8 space-y-3">
                    <p className="text-muted-foreground text-sm">找不到相關動作</p>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setCreateExForm(f => ({ ...f, name: searchQuery })); setShowCreateExerciseDialog(true); }}>
                      <PlusCircle className="w-4 h-4" /> 新增「{searchQuery}」為自訂動作
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* History & Charts Tab */}
        <TabsContent value="history" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Weekly Volume */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-4">Weekly Training Volume</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyVolume}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.018 240)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="volume" name="Volume (kg)" fill="oklch(0.75 0.17 280)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Session History */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-3">All Sessions</h3>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Input placeholder={t('common.search')+'...'} value={sessionSearch} onChange={e=>setSessionSearch(e.target.value)} className="h-8 text-xs w-36" />
                <Select value={sessionSort} onValueChange={v=>setSessionSort(v as any)}>
                  <SelectTrigger className="h-8 w-44 text-xs"><ArrowUpDown className="w-3 h-3 mr-1"/><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date_desc">{t('common.sort_date_desc')}</SelectItem>
                    <SelectItem value="date_asc">{t('common.sort_date_asc')}</SelectItem>
                    <SelectItem value="volume_desc">{t('workout.sort_volume_desc')}</SelectItem>
                    <SelectItem value="duration_desc">{t('workout.sort_duration_desc')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(() => {
                let sList = [...sessions];
                if (sessionSearch.trim()) sList = sList.filter((s: any) => (s.name||'').toLowerCase().includes(sessionSearch.toLowerCase()));
                switch (sessionSort) {
                  case 'date_asc': sList.sort((a: any,b: any)=>new Date(a.startTime).getTime()-new Date(b.startTime).getTime()); break;
                  case 'date_desc': sList.sort((a: any,b: any)=>new Date(b.startTime).getTime()-new Date(a.startTime).getTime()); break;
                  case 'volume_desc': sList.sort((a: any,b: any)=>Number(b.totalVolume||0)-Number(a.totalVolume||0)); break;
                  case 'duration_desc': sList.sort((a: any,b: any)=>Number(b.duration||0)-Number(a.duration||0)); break;
                }
                return (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {sList.map((s: any) => (
                  <div key={s.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                      <Dumbbell className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{s.name || "Workout"}</p>
                      <p className="text-xs text-muted-foreground">{toHKDateString(new Date(s.startTime))}{s.duration ? ` · ${s.duration} min` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {(s as any).caloriesBurned ? <span className="text-xs font-semibold text-orange-500">{Math.round((s as any).caloriesBurned)} kcal</span> : null}
                      {s.totalVolume && <span className="text-xs font-semibold text-primary">{Math.round(s.totalVolume)} kg</span>}
                      <Button variant="ghost" size="icon" className="w-7 h-7"
                        onClick={() => { setActiveSession(s); setActiveTab('session'); }}>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                      {isOwner && <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive"
                        onClick={() => deleteSession.mutate({ id: s.id })}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>}
                    </div>
                  </div>
                ))}
                    {sList.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">{t('common.no_records')}</p>}
                  </div>
                );
              })()}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Start Session Dialog */}
      <Dialog open={showSessionDialog} onOpenChange={setShowSessionDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Start Workout Session</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Session Name</label>
              <Input placeholder="e.g. Push Day, Leg Day…" value={sessionName} onChange={e => setSessionName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Date</label>
              <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSessionDialog(false)}>Cancel</Button>
            <Button onClick={handleStartSession} disabled={createSession.isPending}>
              {createSession.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Start
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        {/* Select Exercise Dialog */}
      <Dialog open={showExerciseDialog} onOpenChange={setShowExerciseDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader><DialogTitle>選擇動作</DialogTitle></DialogHeader>
          <div className="space-y-3 flex-1 flex flex-col min-h-0">
            <Input placeholder="搜尋動作…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            <div className="space-y-1 flex-1 overflow-y-auto">
              {filteredExercises.map((ex: any, i: number) => (
                <button key={i} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                  onClick={() => { setSelectedExercise(ex); setSetForm({ reps: 10, weight: 0, notes: "" }); setEditSet(null); setShowExerciseDialog(false); setShowAddSetDialog(true); }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{ex.name}{(ex as any).isCustom && <Badge variant="secondary" className="ml-1.5 text-[10px] py-0">自訂</Badge>}</p>
                      <p className="text-xs text-muted-foreground">{ex.nameZh}</p>
                    </div>
                    <div className="flex gap-1">
                      <Badge variant="secondary" className="text-xs capitalize">{ex.muscleGroup}</Badge>
                      <Badge variant="outline" className="text-xs">{ex.equipment}</Badge>
                    </div>
                  </div>
                </button>
              ))}
              {filteredExercises.length === 0 && (
                <div className="text-center py-6 space-y-3">
                  <p className="text-muted-foreground text-sm">找不到「{searchQuery}」</p>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setCreateExForm(f => ({ ...f, name: searchQuery })); setShowExerciseDialog(false); setShowCreateExerciseDialog(true); }}>
                    <PlusCircle className="w-4 h-4" /> 新增為自訂動作
                  </Button>
                </div>
              )}
            </div>
            <div className="border-t border-border pt-3">
              <Button variant="outline" className="w-full gap-2" onClick={() => { setShowExerciseDialog(false); setShowCreateExerciseDialog(true); }}>
                <PlusCircle className="w-4 h-4" /> 新增自訂動作
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Custom Exercise Dialog */}
      <Dialog open={showCreateExerciseDialog} onOpenChange={setShowCreateExerciseDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>新增自訂動作</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {/* AI Photo Identify */}
            <div className="bg-muted/40 border border-border rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-2">📷 拍照讓 AI 識別動作（選填）</p>
              <input
                ref={createExPhotoRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleAiPhotoIdentify(f); }}
              />
              <Button variant="outline" size="sm" className="gap-2 w-full" disabled={aiIdentifyLoading}
                onClick={() => createExPhotoRef.current?.click()}>
                {aiIdentifyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                {aiIdentifyLoading ? 'AI 識別中…' : '拍照 / 上傳圖片'}
              </Button>
              {aiIdentifyResult && (
                <div className="mt-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  <p className="text-xs text-green-600">AI 已識別：{aiIdentifyResult.name}（{aiIdentifyResult.nameZh}）— 可信度：{aiIdentifyResult.confidence}</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">動作名稱（英）*</label>
                <Input placeholder="e.g. Cable Fly" value={createExForm.name} onChange={e => setCreateExForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">動作名稱（中）</label>
                <Input placeholder="e.g. 繩索飛鳥" value={createExForm.nameZh} onChange={e => setCreateExForm(f => ({ ...f, nameZh: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">肌肉群</label>
                <Select value={createExForm.muscleGroup} onValueChange={v => setCreateExForm(f => ({ ...f, muscleGroup: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MUSCLE_GROUPS.map(m => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">器材</label>
                <Select value={createExForm.equipment} onValueChange={v => setCreateExForm(f => ({ ...f, equipment: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EQUIPMENT_LIST.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">動作說明（選填）</label>
              <Input placeholder="簡短描述動作要點…" value={createExForm.instructions} onChange={e => setCreateExForm(f => ({ ...f, instructions: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateExerciseDialog(false); setAiIdentifyResult(null); }}>取消</Button>
            <Button onClick={handleCreateCustomExercise} disabled={createCustomExercise.isPending}>
              {createCustomExercise.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              新增動作
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Set Dialog */}
      <Dialog open={showAddSetDialog} onOpenChange={setShowAddSetDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editSet ? "Edit Set" : `Log Set — ${selectedExercise?.name}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Reps</label>
                <Input type="number" value={setForm.reps} onChange={e => setSetForm(f => ({ ...f, reps: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Weight (kg)</label>
                <Input type="number" step="0.5" value={setForm.weight} onChange={e => setSetForm(f => ({ ...f, weight: Number(e.target.value) }))} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Notes (optional)</label>
              <Input placeholder="e.g. felt strong, paused reps…" value={setForm.notes} onChange={e => setSetForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="bg-muted/50 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground">Volume</p>
              <p className="text-xl font-bold text-foreground">{Math.round(setForm.reps * setForm.weight)} <span className="text-sm font-normal">kg</span></p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddSetDialog(false); setEditSet(null); }}>Cancel</Button>
            <Button onClick={handleAddSet} disabled={addSet.isPending || updateSet.isPending}>
              {(addSet.isPending || updateSet.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editSet ? "Save" : "Log Set"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exercise Detail Modal */}
      <ExerciseDetailModal
        exercise={detailExercise}
        open={showExerciseDetail}
        onClose={() => setShowExerciseDetail(false)}
        hasActiveSession={!!activeSession}
        onAddToSession={() => {
          if (detailExercise) {
            setSelectedExercise(detailExercise);
            setSetForm({ reps: 10, weight: 0, notes: "" });
            setEditSet(null);
            setShowAddSetDialog(true);
          }
        }}
      />

      {/* AI Exercise Analysis Dialog */}
      <Dialog open={showAiAnalysis} onOpenChange={setShowAiAnalysis}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              AI 動作分析 — {aiAnalysisExercise}
            </DialogTitle>
          </DialogHeader>
          {aiAnalysisLoading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              <p className="text-sm text-muted-foreground">正在分析訓練記錄…</p>
            </div>
          ) : aiAnalysisResult ? (
            <div className="space-y-4">
              <div className="bg-purple-50 dark:bg-purple-950/30 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                <p className="text-sm text-foreground leading-relaxed">{aiAnalysisResult.analysis}</p>
              </div>
              {aiAnalysisResult.recommendations.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">個人化建議</p>
                  {aiAnalysisResult.recommendations.map((rec, i) => (
                    <div key={i} className="flex gap-3 bg-card border border-border rounded-xl p-3">
                      <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-purple-600 dark:text-purple-400">{i + 1}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{rec.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{rec.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAiAnalysis(false)}>關閉</Button>
            {!aiAnalysisLoading && (
              <Button variant="outline" className="gap-2 text-purple-600"
                onClick={() => { setAiAnalysisResult(null); setAiAnalysisLoading(true); analyzeExercise.mutate({ exerciseName: aiAnalysisExercise! }); }}>
                <Sparkles className="w-4 h-4" /> 重新分析
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
