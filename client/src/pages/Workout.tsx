import { useTranslation } from 'react-i18next';
import { useState, useMemo } from "react";
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
  Flame, Timer, Weight, BarChart2, X, Check, Trophy, Target
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
  const [selectedDate, setSelectedDate] = useState(todayHKString);
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

  const utils = trpc.useUtils();
  const { data: sessions = [], isLoading } = trpc.workout.getSessions.useQuery({
    startDate: toHKDateString(new Date(Date.now() - 30 * 86400000)),
    endDate: selectedDate,
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
    onSuccess: () => { utils.workout.getSessionWithSets.invalidate(); setShowAddSetDialog(false); toast.success("Set logged!"); },
  });
  const updateSet = trpc.workout.updateSet.useMutation({
    onSuccess: () => { utils.workout.getSessionWithSets.invalidate(); setEditSet(null); toast.success("Updated!"); },
  });
  const deleteSet = trpc.workout.deleteSet.useMutation({
    onSuccess: () => { utils.workout.getSessionWithSets.invalidate(); toast.success("Set deleted"); },
  });

  const filteredExercises = useMemo(() => {
    return BUILT_IN_EXERCISES.filter(e => {
      const matchMuscle = !selectedMuscle || e.muscleGroup === selectedMuscle;
      const matchEquip = selectedEquipment === "all" || e.equipment === selectedEquipment;
      const matchSearch = !searchQuery || e.name.toLowerCase().includes(searchQuery.toLowerCase()) || e.nameZh.includes(searchQuery);
      return matchMuscle && matchEquip && matchSearch;
    });
  }, [selectedMuscle, selectedEquipment, searchQuery]);

  const activeMuscles = useMemo(() => {
    if (!sessionDetail?.sets) return [];
    const muscles = new Set<string>();
    sessionDetail.sets.forEach(s => {
      const ex = BUILT_IN_EXERCISES.find(e => e.name === s.exerciseName);
      if (ex) muscles.add(ex.muscleGroup);
    });
    return Array.from(muscles);
  }, [sessionDetail]);

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
        exerciseId: 1,
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

      <Tabs defaultValue="session">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="session">{t('workout.active_session')}</TabsTrigger>
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
                  <p className="text-muted-foreground text-sm">No active session. Start a workout to begin logging.</p>
                  <Button className="mt-4 gap-2" onClick={() => setShowSessionDialog(true)}>
                    <Plus className="w-4 h-4" /> Start Workout
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between bg-card border border-border rounded-2xl px-5 py-3">
                    <div>
                      <p className="font-semibold text-foreground">{activeSession.name}</p>
                      <p className="text-xs text-muted-foreground">{activeSession.date}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowExerciseDialog(true)}>
                        <Plus className="w-3.5 h-3.5" /> Add Exercise
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteSession.mutate({ id: activeSession.id })}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {Object.keys(exerciseGroups).length === 0 ? (
                    <div className="bg-card border border-border rounded-2xl p-6 text-center">
                      <p className="text-muted-foreground text-sm">No exercises logged yet. Add an exercise to start.</p>
                    </div>
                  ) : (
                    Object.entries(exerciseGroups).map(([exerciseName, sets]) => {
                      const ex = BUILT_IN_EXERCISES.find(e => e.name === exerciseName);
                      return (
                        <div key={exerciseName} className="bg-card border border-border rounded-2xl overflow-hidden">
                          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                            <div>
                              <p className="font-semibold text-foreground text-sm">{exerciseName}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {ex && <Badge variant="secondary" className="text-xs capitalize">{ex.muscleGroup}</Badge>}
                                {ex?.equipment && <Badge variant="outline" className="text-xs">{ex.equipment}</Badge>}
                              </div>
                            </div>
                            <Button size="sm" variant="ghost" className="gap-1 text-xs"
                              onClick={() => { setSelectedExercise(ex || { name: exerciseName }); setSetForm({ reps: 10, weight: sets[sets.length - 1]?.weight || 0, notes: "" }); setEditSet(null); setShowAddSetDialog(true); }}>
                              <Plus className="w-3.5 h-3.5" /> Set
                            </Button>
                          </div>
                          <div className="divide-y divide-border">
                            {sets.map((s, i) => (
                              <div key={s.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/20">
                                <span className="text-xs text-muted-foreground w-8">Set {i + 1}</span>
                                <span className="text-sm font-semibold text-foreground flex-1">{s.reps} reps × {s.weight} kg</span>
                                <span className="text-xs text-muted-foreground">{Math.round((s.reps || 0) * (s.weight || 0))} kg vol</span>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="w-6 h-6"
                                    onClick={() => { setEditSet(s); setSelectedExercise(ex || { name: exerciseName }); setSetForm({ reps: s.reps || 10, weight: s.weight || 0, notes: s.notes || "" }); setShowAddSetDialog(true); }}>
                                    <Edit2 className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="w-6 h-6 text-destructive"
                                    onClick={() => deleteSet.mutate({ id: s.id })}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
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
                <MuscleMap selectedMuscle={selectedMuscle} onSelect={m => setSelectedMuscle(prev => prev === m ? null : m)} />
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredExercises.map((ex, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-colors stagger-item cursor-pointer"
                    onClick={() => { setDetailExercise(ex); setShowExerciseDetail(true); }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm">{ex.name}</p>
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
                  <div className="col-span-2 text-center py-8 text-muted-foreground text-sm">
                    No exercises found for the selected filters
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
              <h3 className="font-semibold text-foreground mb-4">Recent Sessions</h3>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {sessions.slice(0, 10).map(s => (
                  <div key={s.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                      <Dumbbell className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{s.name || "Workout"}</p>
                      <p className="text-xs text-muted-foreground">{toHKDateString(new Date(s.startTime))}{s.duration ? ` · ${s.duration} min` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.totalVolume && <span className="text-xs font-semibold text-primary">{Math.round(s.totalVolume)} kg</span>}
                      <Button variant="ghost" size="icon" className="w-7 h-7"
                        onClick={() => setActiveSession(s)}>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive"
                        onClick={() => deleteSession.mutate({ id: s.id })}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {sessions.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">No sessions yet</p>}
              </div>
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
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader><DialogTitle>Select Exercise</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Search exercises…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {filteredExercises.map((ex, i) => (
                <button key={i} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                  onClick={() => { setSelectedExercise(ex); setSetForm({ reps: 10, weight: 0, notes: "" }); setEditSet(null); setShowExerciseDialog(false); setShowAddSetDialog(true); }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{ex.name}</p>
                      <p className="text-xs text-muted-foreground">{ex.nameZh}</p>
                    </div>
                    <div className="flex gap-1">
                      <Badge variant="secondary" className="text-xs capitalize">{ex.muscleGroup}</Badge>
                      <Badge variant="outline" className="text-xs">{ex.equipment}</Badge>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
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
    </div>
  );
}
