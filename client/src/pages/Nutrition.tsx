import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { useIsOwner } from "@/contexts/OwnerContext";
import { toast } from "sonner";
import { todayHKString, toHKDateString } from "@/lib/hkTime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Camera, Search, Trash2, Edit2, X, Loader2, Utensils, Copy,
  Flame, Beef, Wheat, Droplets, ChevronDown, Upload, Sparkles,
  ChevronLeft, ChevronRight, Star, History, Images, CheckCircle2
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area
} from "recharts";

const GOALS = { calories: 2000, protein: 150, carbs: 250, fat: 65 };
const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
const MEAL_COLORS: Record<string, string> = {
  breakfast: "oklch(0.78 0.20 50)",
  lunch: "oklch(0.72 0.19 160)",
  dinner: "oklch(0.75 0.17 280)",
  snack: "oklch(0.68 0.22 25)",
};

type MealType = typeof MEAL_TYPES[number];

interface FoodEntry {
  name: string; nameZh?: string; quantity: number; calories: number;
  protein: number; carbs: number; fat: number; fiber?: number;
}

interface BatchPhoto {
  preview: string;
  base64: string;
  status: 'pending' | 'analyzing' | 'done' | 'error';
  result?: any;
}

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

export default function Nutrition() {
  const { t } = useTranslation();
  const isOwner = useIsOwner();
  const [selectedDate, setSelectedDate] = useState(() => todayHKString());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [editEntry, setEditEntry] = useState<any>(null);
  const [dialogDate, setDialogDate] = useState(() => todayHKString());
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState<FoodEntry>({ name: "", quantity: 100, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: undefined });
  const [copyMenuId, setCopyMenuId] = useState<number | null>(null);
  const [showAILookup, setShowAILookup] = useState(false);
  const [aiLookupRestaurant, setAILookupRestaurant] = useState("");
  const [aiLookupFood, setAILookupFood] = useState("");
  const [aiLookupQty, setAILookupQty] = useState(100);
  const [aiLookupResult, setAILookupResult] = useState<any>(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showManageFavs, setShowManageFavs] = useState(false);
  const [selectedFavIds, setSelectedFavIds] = useState<Set<number>>(new Set());
  const [renamingFav, setRenamingFav] = useState<{ id: number; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // AI Photo dialog state
  const [photoDialogTab, setPhotoDialogTab] = useState<'single' | 'batch' | 'history'>('single');
  // Single photo
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  // Batch photos
  const [batchPhotos, setBatchPhotos] = useState<BatchPhoto[]>([]);
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const batchFileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  // ─── DB-backed food favorites ────────────────────────────────────────────────
  const { data: favoriteFoods = [] } = trpc.foodFavorites.list.useQuery(undefined, { enabled: isOwner });
  const addFavoriteMutation = trpc.foodFavorites.add.useMutation({
    onSuccess: () => utils.foodFavorites.list.invalidate(),
    onError: (e) => toast.error('加入常用食物失敗: ' + e.message),
  });
  const removeFavoriteByNameMutation = trpc.foodFavorites.removeByName.useMutation({
    onSuccess: () => utils.foodFavorites.list.invalidate(),
    onError: (e) => toast.error('移除失敗: ' + e.message),
  });
  const removeFavoriteMutation = trpc.foodFavorites.remove.useMutation({
    onSuccess: () => { utils.foodFavorites.list.invalidate(); toast.success('已刪除'); },
    onError: (e) => toast.error('刪除失敗: ' + e.message),
  });
  const renameFavoriteMutation = trpc.foodFavorites.rename.useMutation({
    onSuccess: () => { utils.foodFavorites.list.invalidate(); setRenamingFav(null); toast.success('已重命名'); },
    onError: (e) => toast.error('重命名失敗: ' + e.message),
  });
  const bulkRemoveFavoriteMutation = trpc.foodFavorites.bulkRemove.useMutation({
    onSuccess: () => { utils.foodFavorites.list.invalidate(); setSelectedFavIds(new Set()); toast.success('已批量刪除'); },
    onError: (e) => toast.error('批量刪除失敗: ' + e.message),
  });

  // ─── AI photo analysis history ───────────────────────────────────────────────
  const { data: analysisHistory = [] } = trpc.foodAnalysisHistory.list.useQuery(undefined, { enabled: isOwner });
  const saveAnalysisHistoryMutation = trpc.foodAnalysisHistory.save.useMutation();

  const { data: meals = [], isLoading } = trpc.nutrition.getMealLogs.useQuery({ date: selectedDate });
  const [weekStartDate] = useState(() => {
    const hkNow = new Date(Date.now() + 8 * 3600 * 1000);
    hkNow.setUTCDate(hkNow.getUTCDate() - 6);
    return hkNow.toISOString().slice(0, 10);
  });
  const { data: weekMeals = [] } = trpc.nutrition.getMealLogsRange.useQuery({
    startDate: weekStartDate,
    endDate: selectedDate,
  });
  const { data: searchResults = [] } = trpc.nutrition.searchFoods.useQuery(
    { query: searchQuery }, { enabled: searchQuery.length > 1 }
  );

  const addMutation = trpc.nutrition.addMealLog.useMutation({
    onSuccess: () => { utils.nutrition.getMealLogs.invalidate(); utils.nutrition.getMealLogsRange.invalidate(); toast.success("已記錄餐食！"); setShowAddDialog(false); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.nutrition.updateMealLog.useMutation({
    onSuccess: () => {
      utils.nutrition.getMealLogs.invalidate();
      utils.nutrition.getMealLogsRange.invalidate();
      toast.success("已更新！");
      setEditEntry(null);
      setShowAddDialog(false);
    },
  });
  const deleteMutation = trpc.nutrition.deleteMealLog.useMutation({
    onSuccess: () => { utils.nutrition.getMealLogs.invalidate(); utils.nutrition.getMealLogsRange.invalidate(); toast.success("已刪除"); },
  });
  const analyzePhotoMutation = trpc.nutrition.analyzeFoodPhoto.useMutation({
    onSuccess: (data) => {
      setAiResult(data);
      setAnalyzing(false);
      // Save to analysis history
      saveAnalysisHistoryMutation.mutate({
        analysisResult: JSON.stringify(data.foods || []),
        totalCalories: data.totalCalories,
      }, {
        onSuccess: () => utils.foodAnalysisHistory.list.invalidate(),
      });
    },
    onError: () => { setAnalyzing(false); toast.error("分析失敗，請重試"); },
  });

  const resetForm = () => setForm({ name: "", quantity: 100, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: undefined });

  const { data: workoutCalData } = trpc.workout.getDailyCaloriesBurned.useQuery({ date: selectedDate });
  const workoutCaloriesBurned = workoutCalData?.caloriesBurned ?? 0;
  const runningCaloriesBurned = workoutCalData?.runningBurned ?? 0;
  const stepsCaloriesBurned = workoutCalData?.stepsBurned ?? 0;
  const totalCaloriesBurned = workoutCalData?.totalBurned ?? workoutCaloriesBurned;

  const { data: dashSummary } = trpc.dashboard.getSummary.useQuery();
  const dynamicCalorieGoal = dashSummary?.tdee?.dailyCalorieTarget ?? GOALS.calories;
  const hasBmr = dashSummary?.tdee?.hasBmr ?? false;

  const totals = meals.reduce((acc, m) => ({
    calories: acc.calories + (m.calories ?? 0),
    protein: acc.protein + (m.protein ?? 0),
    carbs: acc.carbs + (m.carbs ?? 0),
    fat: acc.fat + (m.fat ?? 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const mealGroups = MEAL_TYPES.reduce((acc, t) => {
    acc[t] = meals.filter(m => m.mealType === t);
    return acc;
  }, {} as Record<MealType, typeof meals>);

  const weekChartData = (() => {
    const map: Record<string, { cal: number; protein: number; carbs: number; fat: number }> = {};
    weekMeals.forEach(m => {
      const dateKey = m.logDate ?? toHKDateString(new Date(m.loggedAt));
      if (!map[dateKey]) map[dateKey] = { cal: 0, protein: 0, carbs: 0, fat: 0 };
      map[dateKey].cal += (m.calories ?? 0);
      map[dateKey].protein += (m.protein ?? 0);
      map[dateKey].carbs += (m.carbs ?? 0);
      map[dateKey].fat += (m.fat ?? 0);
    });
    return Array.from({ length: 7 }, (_, i) => {
      const hkTs = new Date(Date.now() + 8 * 3600 * 1000);
      hkTs.setUTCDate(hkTs.getUTCDate() - (6 - i));
      const d = hkTs.toISOString().slice(0, 10);
      const day = new Date(d + 'T12:00:00+08:00').toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Hong_Kong' });
      return { date: day, ...(map[d] || { cal: 0, protein: 0, carbs: 0, fat: 0 }) };
    });
  })();

  const macroDistribution = [
    { name: "Protein", value: Math.round(totals.protein * 4), color: "oklch(0.72 0.19 160)" },
    { name: "Carbs", value: Math.round(totals.carbs * 4), color: "oklch(0.75 0.17 280)" },
    { name: "Fat", value: Math.round(totals.fat * 9), color: "oklch(0.68 0.22 25)" },
  ];

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setPhotoPreview(result);
      setPhotoBase64(result.split(",")[1]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAnalyze = () => {
    if (!photoBase64) return;
    setAnalyzing(true);
    analyzePhotoMutation.mutate({ imageBase64: photoBase64, mimeType: "image/jpeg" });
  };

  // Batch photo handling
  const handleBatchFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newPhotos: BatchPhoto[] = [];
    let loaded = 0;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        newPhotos.push({
          preview: dataUrl,
          base64: dataUrl.split(',')[1],
          status: 'pending',
        });
        loaded++;
        if (loaded === files.length) {
          setBatchPhotos(prev => [...prev, ...newPhotos]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleBatchAnalyze = async () => {
    if (batchPhotos.length === 0 || batchAnalyzing) return;
    setBatchAnalyzing(true);
    for (let i = 0; i < batchPhotos.length; i++) {
      if (batchPhotos[i].status === 'done') continue;
      setBatchPhotos(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'analyzing' } : p));
      try {
        const result = await analyzePhotoMutation.mutateAsync({ imageBase64: batchPhotos[i].base64, mimeType: "image/jpeg" });
        setBatchPhotos(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'done', result } : p));
        // Save to history
        saveAnalysisHistoryMutation.mutate({
          analysisResult: JSON.stringify(result.foods || []),
          totalCalories: result.totalCalories,
        }, { onSuccess: () => utils.foodAnalysisHistory.list.invalidate() });
      } catch {
        setBatchPhotos(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'error' } : p));
      }
    }
    setBatchAnalyzing(false);
  };

  const lookupFoodMutation = trpc.nutrition.lookupFoodNutrition.useMutation({
    onSuccess: (data) => {
      setAILookupResult(data);
      // Also save to DB favorites automatically
      if (isOwner) {
        addFavoriteMutation.mutate({
          foodName: data.nameZh || data.name,
          calories: data.calories,
          protein: data.protein,
          carbs: data.carbs,
          fat: data.fat,
          servingSize: data.quantity,
          servingUnit: data.unit || 'g',
        });
      }
    },
    onError: (e) => { toast.error('AI 查詢失敗: ' + e.message); },
  });

  const handleApplyAILookup = () => {
    if (!aiLookupResult) return;
    setForm({
      name: aiLookupResult.nameZh || aiLookupResult.name,
      quantity: aiLookupResult.quantity,
      calories: aiLookupResult.calories,
      protein: aiLookupResult.protein,
      carbs: aiLookupResult.carbs,
      fat: aiLookupResult.fat,
      fiber: aiLookupResult.fiber,
    });
    setAILookupResult(null);
    setShowAILookup(false);
    setAILookupRestaurant("");
    setAILookupFood("");
  };

  const handleAddFromAI = (food: any) => {
    setForm({ name: food.nameZh || food.name, quantity: food.quantity, calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat, fiber: food.fiber });
    setDialogDate(selectedDate);
    setShowPhotoDialog(false);
    setShowAddDialog(true);
  };

  const applyFavorite = (fav: any) => {
    setForm({
      name: fav.foodName,
      quantity: fav.servingSize ?? 100,
      calories: fav.calories ?? 0,
      protein: fav.protein ?? 0,
      carbs: fav.carbs ?? 0,
      fat: fav.fat ?? 0,
    });
    setShowFavorites(false);
  };

  const handleSubmit = () => {
    if (!form.name) return toast.error("請輸入食物名稱");
    if (editEntry) {
      updateMutation.mutate({ id: editEntry.id, date: dialogDate, mealType, foodName: form.name, quantity: form.quantity, calories: form.calories, protein: form.protein, carbs: form.carbs, fat: form.fat, fiber: form.fiber });
    } else {
      addMutation.mutate({ date: dialogDate, mealType, foodName: form.name, quantity: form.quantity, calories: form.calories, protein: form.protein, carbs: form.carbs, fat: form.fat, fiber: form.fiber });
    }
  };

  const openPhotoDialog = () => {
    setPhotoPreview(null);
    setPhotoBase64(null);
    setAiResult(null);
    setBatchPhotos([]);
    setPhotoDialogTab('single');
    setShowPhotoDialog(true);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nutrition</h1>
          <p className="text-muted-foreground text-sm">Track your daily food intake</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => {
              const d = new Date(selectedDate + 'T12:00:00+08:00');
              d.setDate(d.getDate() - 1);
              setSelectedDate(d.toISOString().slice(0, 10));
            }}><ChevronLeft className="w-4 h-4" /></Button>
            <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              className="w-36 text-sm text-center" />
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => {
              const d = new Date(selectedDate + 'T12:00:00+08:00');
              d.setDate(d.getDate() + 1);
              setSelectedDate(d.toISOString().slice(0, 10));
            }} disabled={selectedDate >= todayHKString()}><ChevronRight className="w-4 h-4" /></Button>
          </div>
          {selectedDate !== todayHKString() && (
            <Button variant="ghost" size="sm" className="text-xs h-8 px-2 text-primary" onClick={() => setSelectedDate(todayHKString())}>Today</Button>
          )}
          {isOwner && (
            <Button onClick={openPhotoDialog} variant="outline" size="sm" className="gap-2">
              <Camera className="w-4 h-4" /> AI Photo
            </Button>
          )}
          {isOwner && (
            <Button onClick={() => { setEditEntry(null); setDialogDate(selectedDate); resetForm(); setShowAddDialog(true); }} size="sm" className="gap-2">
              <Plus className="w-4 h-4" /> Log Meal
            </Button>
          )}
        </div>
      </div>

      {/* Daily Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Calories", value: Math.round(totals.calories), goal: dynamicCalorieGoal, unit: "kcal", color: "oklch(0.78 0.20 50)", icon: Flame },
          { label: "Protein", value: Math.round(totals.protein), goal: GOALS.protein, unit: "g", color: "oklch(0.72 0.19 160)", icon: Beef },
          { label: "Carbs", value: Math.round(totals.carbs), goal: GOALS.carbs, unit: "g", color: "oklch(0.75 0.17 280)", icon: Wheat },
          { label: "Fat", value: Math.round(totals.fat), goal: GOALS.fat, unit: "g", color: "oklch(0.68 0.22 25)", icon: Droplets },
        ].map(m => (
          <div key={m.label} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <m.icon className="w-4 h-4" style={{ color: m.color }} />
              <span className="text-xs text-muted-foreground font-medium">{m.label}</span>
            </div>
            <p className="metric-value text-xl text-foreground">{m.value} <span className="text-sm font-normal text-muted-foreground">{m.unit}</span></p>
            <Progress value={Math.min((m.value / m.goal) * 100, 100)} className="h-1.5 mt-2" style={{ "--progress-color": m.color } as any} />
            <p className="text-xs text-muted-foreground mt-1">{m.goal - m.value > 0 ? `${m.goal - m.value} remaining` : "Goal reached ✓"}</p>
          </div>
        ))}
      </div>

      {/* Exercise Calories Burned + Net Balance */}
      {totalCaloriesBurned > 0 && (
        <div className="bg-card border border-orange-200 dark:border-orange-900/50 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center">
              <Flame className="w-5 h-5 text-orange-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">今日運動消耗</p>
              <p className="text-xs text-muted-foreground">
                {[
                  workoutCaloriesBurned > 0 && `健身 ${workoutCaloriesBurned} kcal`,
                  runningCaloriesBurned > 0 && `跑步 ${runningCaloriesBurned} kcal`,
                  stepsCaloriesBurned > 0 && `步行 ${stepsCaloriesBurned} kcal`,
                ].filter(Boolean).join(' · ')}
              </p>
            </div>
            <p className="text-base font-bold text-orange-500">-{Math.round(totalCaloriesBurned)} kcal</p>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-1 border-t border-border/50">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">攝取</p>
              <p className="text-base font-bold text-foreground">{Math.round(totals.calories)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">淨卡路里</p>
              <p className={`text-base font-bold ${Math.round(totals.calories - totalCaloriesBurned) > dynamicCalorieGoal ? 'text-red-500' : 'text-green-500'}`}>
                {Math.round(totals.calories - totalCaloriesBurned)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">剩餘目標{hasBmr && <span className="ml-1 text-primary/70">(TDEE)</span>}</p>
              <p className="text-base font-bold text-foreground">
                {Math.max(0, dynamicCalorieGoal - Math.round(totals.calories - totalCaloriesBurned))}
              </p>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="log">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="log">Today's Log</TabsTrigger>
          <TabsTrigger value="charts">Charts & Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="log" className="space-y-4 mt-4">
          {MEAL_TYPES.map(type => (
            <div key={type} className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: MEAL_COLORS[type] }} />
                  <h3 className="font-semibold text-foreground capitalize">{type}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {Math.round(mealGroups[type].reduce((s, m) => s + (m.calories ?? 0), 0))} kcal
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                  onClick={() => { setMealType(type); setEditEntry(null); setDialogDate(selectedDate); resetForm(); setShowAddDialog(true); }}>
                  <Plus className="w-3.5 h-3.5" /> Add
                </Button>
              </div>
              {mealGroups[type].length === 0 ? (
                <p className="text-muted-foreground text-sm px-5 py-4 text-center">No entries yet</p>
              ) : (
                <div className="divide-y divide-border">
                  {mealGroups[type].map(m => {
                    const isStarred = favoriteFoods.some((f: any) => f.foodName.toLowerCase() === m.foodName.toLowerCase());
                    return (
                      <div key={m.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{m.foodName}</p>
                          <p className="text-xs text-muted-foreground">{m.servings * 100}g · P:{Math.round(m.protein ?? 0)}g C:{Math.round(m.carbs ?? 0)}g F:{Math.round(m.fat ?? 0)}g</p>
                        </div>
                        <span className="text-sm font-semibold text-foreground shrink-0">{Math.round(m.calories ?? 0)} kcal</span>
                        {isOwner && (
                          <div className="flex gap-1 shrink-0">
                            <div className="relative">
                              <Button variant="ghost" size="icon" className="w-7 h-7 text-blue-500 hover:text-blue-600" title="複製" onClick={() => setCopyMenuId(copyMenuId === m.id ? null : m.id)}>
                                <Copy className="w-3.5 h-3.5" />
                              </Button>
                              {copyMenuId === m.id && (
                                <div className="absolute right-0 top-8 z-50 bg-popover border border-border rounded-xl shadow-xl py-1 min-w-[140px]" onClick={() => setCopyMenuId(null)}>
                                  <button className="w-full text-left px-3 py-2 text-xs hover:bg-accent rounded-lg"
                                    onClick={() => { addMutation.mutate({ date: todayHKString(), mealType: m.mealType as MealType, foodName: m.foodName, quantity: m.servings * 100, calories: m.calories ?? 0, protein: m.protein ?? 0, carbs: m.carbs ?? 0, fat: m.fat ?? 0, fiber: m.fiber ?? undefined }); toast.success('已複製到今天'); }}>
                                    複製到今天
                                  </button>
                                  <button className="w-full text-left px-3 py-2 text-xs hover:bg-accent rounded-lg"
                                    onClick={() => { addMutation.mutate({ date: selectedDate, mealType: m.mealType as MealType, foodName: m.foodName, quantity: m.servings * 100, calories: m.calories ?? 0, protein: m.protein ?? 0, carbs: m.carbs ?? 0, fat: m.fat ?? 0, fiber: m.fiber ?? undefined }); toast.success(`已複製到 ${selectedDate}`); }}>
                                    複製到當前日期
                                  </button>
                                </div>
                              )}
                            </div>
                            <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => { setEditEntry(m); setDialogDate(m.logDate ?? selectedDate); setForm({ name: m.foodName, quantity: m.servings * 100, calories: m.calories ?? 0, protein: m.protein ?? 0, carbs: m.carbs ?? 0, fat: m.fat ?? 0, fiber: m.fiber ?? undefined }); setMealType(m.mealType as MealType); setShowAddDialog(true); }}>
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon"
                              className={`w-7 h-7 ${isStarred ? 'text-yellow-500 hover:text-yellow-600' : 'text-muted-foreground hover:text-yellow-500'}`}
                              title={isStarred ? '已在常用食物（點擊移除）' : '加入常用食物'}
                              onClick={() => {
                                if (isStarred) {
                                  removeFavoriteByNameMutation.mutate({ foodName: m.foodName });
                                  toast.success(`已從常用食物移除 ${m.foodName}`);
                                } else {
                                  addFavoriteMutation.mutate({ foodName: m.foodName, calories: m.calories ?? 0, protein: m.protein ?? 0, carbs: m.carbs ?? 0, fat: m.fat ?? 0, servingSize: m.servings * 100, servingUnit: 'g' });
                                  toast.success(`已將 ${m.foodName} 加入常用食物`);
                                }
                              }}>
                              <Star className={`w-3.5 h-3.5 ${isStarred ? 'fill-yellow-500' : ''}`} />
                            </Button>
                            <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => deleteMutation.mutate({ id: m.id })}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="charts" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-4">Weekly Calorie Intake</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weekChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.018 240)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="cal" name="Calories" fill="oklch(0.78 0.20 50)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-4">Today's Macro Distribution (kcal)</h3>
              {totals.calories > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={macroDistribution} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                      {macroDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => [`${v} kcal`]} />
                    <Legend formatter={(v) => <span className="text-xs text-foreground">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Log meals to see distribution</div>
              )}
            </div>
            <div className="bg-card border border-border rounded-2xl p-5 lg:col-span-2">
              <h3 className="font-semibold text-foreground mb-4">Weekly Macro Breakdown</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weekChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.018 240)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="protein" name="Protein (g)" stackId="a" fill="oklch(0.72 0.19 160)" />
                  <Bar dataKey="carbs" name="Carbs (g)" stackId="a" fill="oklch(0.75 0.17 280)" />
                  <Bar dataKey="fat" name="Fat (g)" stackId="a" fill="oklch(0.68 0.22 25)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── Add/Edit Meal Dialog ─────────────────────────────────────────────── */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) setEditEntry(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editEntry ? "Edit Meal Entry" : "Log Meal"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* DB-backed Favourite Foods */}
            {isOwner && favoriteFoods.length > 0 && (
              <div className="border border-border rounded-xl p-3 bg-muted/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/70">
                    <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                    常用食物
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="text-xs text-primary hover:text-primary/80 font-medium" onClick={() => { setShowManageFavs(true); setSelectedFavIds(new Set()); setRenamingFav(null); }}>
                      管理
                    </button>
                    <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowFavorites(v => !v)}>
                      {showFavorites ? '收起' : `展開 (${favoriteFoods.length})`}
                    </button>
                  </div>
                </div>
                {showFavorites && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {favoriteFoods.map((food: any) => (
                      <button key={food.id} className="w-full text-left bg-card hover:bg-accent border border-border rounded-lg px-3 py-2 transition-colors"
                        onClick={() => applyFavorite(food)}>
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-foreground truncate">{food.foodName}</div>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <div className="text-xs font-bold text-orange-500">{Math.round(food.calories ?? 0)} kcal</div>
                            <div className="text-[10px] text-muted-foreground">{food.servingSize ?? 100}{food.servingUnit || 'g'}</div>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
                          <span>🥩 {Math.round(food.protein ?? 0)}g</span>
                          <span>🍞 {Math.round(food.carbs ?? 0)}g</span>
                          <span>🧈 {Math.round(food.fat ?? 0)}g</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* AI Food Lookup */}
            {isOwner && (
              <div className="border border-border rounded-xl p-3 bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Sparkles className="w-3.5 h-3.5" />
                    AI 食物熱量查詢
                  </div>
                  <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowAILookup(v => !v)}>
                    {showAILookup ? '收起' : '展開'}
                  </button>
                </div>
                {showAILookup && (
                  <div className="space-y-2">
                    <Input placeholder="餐廳/品牌名稱（可選）" value={aiLookupRestaurant} onChange={e => setAILookupRestaurant(e.target.value)} className="h-8 text-xs" />
                    <Input placeholder="食品名稱（必填）" value={aiLookupFood} onChange={e => setAILookupFood(e.target.value)} className="h-8 text-xs" />
                    <div className="flex items-center gap-2">
                      <Input type="number" placeholder="分量 (g)" value={aiLookupQty} onChange={e => setAILookupQty(Number(e.target.value))} className="h-8 text-xs w-24" />
                      <Button size="sm" className="h-8 text-xs flex-1" disabled={!aiLookupFood.trim() || lookupFoodMutation.isPending}
                        onClick={() => lookupFoodMutation.mutate({ restaurantName: aiLookupRestaurant || undefined, foodName: aiLookupFood, quantity: aiLookupQty })}>
                        {lookupFoodMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                        AI 查詢
                      </Button>
                    </div>
                    {aiLookupResult && (
                      <div className="bg-card border border-border rounded-lg p-2.5 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">{aiLookupResult.nameZh || aiLookupResult.name}</span>
                          <span className="text-muted-foreground">{aiLookupResult.quantity}{aiLookupResult.unit}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1 text-center">
                          <div className="bg-orange-100 dark:bg-orange-900/30 rounded p-1">
                            <div className="font-bold text-orange-600">{aiLookupResult.calories}</div>
                            <div className="text-muted-foreground">kcal</div>
                          </div>
                          <div className="bg-blue-100 dark:bg-blue-900/30 rounded p-1">
                            <div className="font-bold text-blue-600">{aiLookupResult.protein}g</div>
                            <div className="text-muted-foreground">蛋白</div>
                          </div>
                          <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded p-1">
                            <div className="font-bold text-yellow-600">{aiLookupResult.carbs}g</div>
                            <div className="text-muted-foreground">碳水</div>
                          </div>
                          <div className="bg-red-100 dark:bg-red-900/30 rounded p-1">
                            <div className="font-bold text-red-600">{aiLookupResult.fat}g</div>
                            <div className="text-muted-foreground">脂肪</div>
                          </div>
                        </div>
                        {aiLookupResult.fiber > 0 && <div className="text-muted-foreground">纖維: {aiLookupResult.fiber}g</div>}
                        {aiLookupResult.notes && <div className="text-muted-foreground italic">{aiLookupResult.notes}</div>}
                        <Button size="sm" className="w-full h-7 text-xs mt-1" onClick={handleApplyAILookup}>套用此熱量資料</Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Date</label>
              <Input type="date" value={dialogDate} onChange={e => setDialogDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Meal Type</label>
              <Select value={mealType} onValueChange={v => setMealType(v as MealType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MEAL_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Food Name</label>
              <div className="relative">
                <Input placeholder="Search or enter food name…" value={form.name}
                  onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setSearchQuery(e.target.value); }} />
                {searchResults.length > 0 && form.name && (
                  <div className="absolute top-full left-0 right-0 z-50 bg-card border border-border rounded-xl shadow-xl mt-1 max-h-48 overflow-y-auto">
                    {searchResults.map(f => (
                      <button key={f.id} className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm"
                        onClick={() => { setForm({ name: f.name, quantity: 100, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat, fiber: f.fiber ?? undefined }); setSearchQuery(""); }}>
                        <span className="font-medium">{f.name}</span>
                        <span className="text-muted-foreground ml-2 text-xs">{f.calories} kcal/100g</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Quantity (g)</label>
                <Input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Calories (kcal)</label>
                <Input type="number" value={form.calories} onChange={e => setForm(f => ({ ...f, calories: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Protein (g)</label>
                <Input type="number" value={form.protein} onChange={e => setForm(f => ({ ...f, protein: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Carbs (g)</label>
                <Input type="number" value={form.carbs} onChange={e => setForm(f => ({ ...f, carbs: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Fat (g)</label>
                <Input type="number" value={form.fat} onChange={e => setForm(f => ({ ...f, fat: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Fiber (g)</label>
                <Input type="number" value={form.fiber || ""} onChange={e => setForm(f => ({ ...f, fiber: Number(e.target.value) }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); setEditEntry(null); }}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={addMutation.isPending || updateMutation.isPending}>
              {(addMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editEntry ? "Save Changes" : "Log Meal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── AI Photo Analysis Dialog ─────────────────────────────────────────── */}
      <Dialog open={showPhotoDialog} onOpenChange={setShowPhotoDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> AI 食物相片分析</DialogTitle>
          </DialogHeader>

          {/* Tab selector */}
          <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
            <button
              className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${photoDialogTab === 'single' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setPhotoDialogTab('single')}>
              <Camera className="w-3.5 h-3.5 inline mr-1" />單張分析
            </button>
            <button
              className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${photoDialogTab === 'batch' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setPhotoDialogTab('batch')}>
              <Images className="w-3.5 h-3.5 inline mr-1" />批量分析
            </button>
            <button
              className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${photoDialogTab === 'history' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setPhotoDialogTab('history')}>
              <History className="w-3.5 h-3.5 inline mr-1" />分析記錄
              {analysisHistory.length > 0 && <span className="ml-1 bg-primary text-primary-foreground text-[10px] rounded-full px-1">{analysisHistory.length}</span>}
            </button>
          </div>

          {/* Single Photo Tab */}
          {photoDialogTab === 'single' && (
            <div className="space-y-4">
              {!photoPreview ? (
                <div className="border-2 border-dashed border-border rounded-xl p-8 text-center space-y-3">
                  <Camera className="w-10 h-10 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">上傳或拍攝食物相片</p>
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-2" /> 上傳相片
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => cameraInputRef.current?.click()}>
                      <Camera className="w-4 h-4 mr-2" /> 拍照
                    </Button>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                  <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoSelect} />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <img src={photoPreview} alt="Food" className="w-full h-48 object-cover rounded-xl" />
                    <Button variant="ghost" size="icon" className="absolute top-2 right-2 w-7 h-7 bg-black/50 hover:bg-black/70"
                      onClick={() => { setPhotoPreview(null); setPhotoBase64(null); setAiResult(null); }}>
                      <X className="w-3.5 h-3.5 text-white" />
                    </Button>
                  </div>
                  {!aiResult ? (
                    <Button className="w-full gap-2" onClick={handleAnalyze} disabled={analyzing}>
                      {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {analyzing ? "分析中…" : "AI 分析"}
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-muted/50 rounded-xl p-3">
                        <p className="text-xs text-muted-foreground mb-1">AI 分析結果</p>
                        <p className="text-sm font-medium text-foreground">{aiResult.notes}</p>
                        <div className="grid grid-cols-4 gap-2 mt-2">
                          {[
                            { label: "卡路里", value: Math.round(aiResult.totalCalories), unit: "kcal" },
                            { label: "蛋白質", value: Math.round(aiResult.totalProtein), unit: "g" },
                            { label: "碳水", value: Math.round(aiResult.totalCarbs), unit: "g" },
                            { label: "脂肪", value: Math.round(aiResult.totalFat), unit: "g" },
                          ].map(m => (
                            <div key={m.label} className="text-center">
                              <p className="text-xs text-muted-foreground">{m.label}</p>
                              <p className="text-sm font-bold text-foreground">{m.value}<span className="text-xs font-normal">{m.unit}</span></p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {aiResult.foods?.map((food: any, i: number) => (
                          <div key={i} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                            <div>
                              <p className="text-sm font-medium">{food.nameZh || food.name}</p>
                              <p className="text-xs text-muted-foreground">{food.quantity}{food.unit}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-foreground">{Math.round(food.calories)} kcal</span>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAddFromAI(food)}>加入</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Button className="w-full" onClick={() => {
                        if (aiResult.foods?.[0]) {
                          setForm({ name: aiResult.foods[0].nameZh || aiResult.foods[0].name, quantity: aiResult.foods[0].quantity, calories: aiResult.totalCalories, protein: aiResult.totalProtein, carbs: aiResult.totalCarbs, fat: aiResult.totalFat });
                          setDialogDate(selectedDate);
                          setShowPhotoDialog(false);
                          setShowAddDialog(true);
                        }
                      }}>全部加入為一筆記錄</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Batch Photo Tab */}
          {photoDialogTab === 'batch' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center space-y-3">
                <Images className="w-10 h-10 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">選擇多張食物相片一次分析</p>
                <Button variant="outline" size="sm" onClick={() => batchFileInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" /> 選擇相片（可多選）
                </Button>
                <input ref={batchFileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleBatchFileSelect} />
              </div>

              {batchPhotos.length > 0 && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {batchPhotos.map((photo, i) => (
                      <div key={i} className="relative rounded-lg overflow-hidden aspect-square">
                        <img src={photo.preview} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                        <div className={`absolute inset-0 flex items-center justify-center ${
                          photo.status === 'analyzing' ? 'bg-black/50' :
                          photo.status === 'done' ? 'bg-green-500/30' :
                          photo.status === 'error' ? 'bg-red-500/30' : ''
                        }`}>
                          {photo.status === 'analyzing' && <Loader2 className="w-6 h-6 text-white animate-spin" />}
                          {photo.status === 'done' && <CheckCircle2 className="w-6 h-6 text-green-400" />}
                          {photo.status === 'error' && <X className="w-6 h-6 text-red-400" />}
                        </div>
                        <button className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                          onClick={() => setBatchPhotos(prev => prev.filter((_, idx) => idx !== i))}>
                          <X className="w-3 h-3 text-white" />
                        </button>
                        {photo.result && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1.5 py-1 text-[10px] text-white text-center">
                            {Math.round(photo.result.totalCalories)} kcal
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <Button className="w-full gap-2" onClick={handleBatchAnalyze}
                    disabled={batchAnalyzing || batchPhotos.every(p => p.status === 'done')}>
                    {batchAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {batchAnalyzing ? `分析中 (${batchPhotos.filter(p => p.status === 'done').length}/${batchPhotos.length})…` :
                     batchPhotos.every(p => p.status === 'done') ? '全部分析完成' : `分析全部 ${batchPhotos.length} 張相片`}
                  </Button>

                  {/* Batch results */}
                  {batchPhotos.some(p => p.status === 'done') && (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-foreground/70">分析結果</p>
                      {batchPhotos.filter(p => p.status === 'done' && p.result).map((photo, i) => (
                        <div key={i} className="bg-muted/30 rounded-xl p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <img src={photo.preview} alt="" className="w-12 h-12 rounded-lg object-cover" />
                            <div>
                              <p className="text-xs font-semibold text-foreground">{photo.result.notes}</p>
                              <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5">
                                <span className="text-orange-500 font-bold">{Math.round(photo.result.totalCalories)} kcal</span>
                                <span>P:{Math.round(photo.result.totalProtein)}g</span>
                                <span>C:{Math.round(photo.result.totalCarbs)}g</span>
                                <span>F:{Math.round(photo.result.totalFat)}g</span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1">
                            {photo.result.foods?.map((food: any, fi: number) => (
                              <div key={fi} className="flex items-center justify-between text-xs">
                                <span className="text-foreground">{food.nameZh || food.name} ({food.quantity}{food.unit})</span>
                                <div className="flex items-center gap-1">
                                  <span className="text-muted-foreground">{Math.round(food.calories)} kcal</span>
                                  <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => handleAddFromAI(food)}>加入</Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Analysis History Tab */}
          {photoDialogTab === 'history' && (
            <div className="space-y-3">
              {analysisHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  尚無分析記錄
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">最近 {analysisHistory.length} 次分析記錄（點擊食物可快速加入）</p>
                  <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                    {analysisHistory.map((record: any) => {
                      const foods = record.foods || [];
                      const analyzedAt = new Date(record.analyzedAt).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                      return (
                        <div key={record.id} className="bg-muted/30 border border-border rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">{analyzedAt}</span>
                            {record.totalCalories && (
                              <span className="text-xs font-bold text-orange-500">{Math.round(record.totalCalories)} kcal</span>
                            )}
                          </div>
                          {foods.length > 0 ? (
                            <div className="space-y-1">
                              {foods.map((food: any, fi: number) => (
                                <div key={fi} className="flex items-center justify-between text-xs">
                                  <span className="text-foreground">{food.nameZh || food.name}
                                    <span className="text-muted-foreground ml-1">({food.quantity}{food.unit})</span>
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">{Math.round(food.calories)} kcal</span>
                                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => handleAddFromAI(food)}>加入</Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">無食物資料</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* ─── Manage Favorites Dialog ─────────────────────────────────────────── */}
      <Dialog open={showManageFavs} onOpenChange={(open) => { setShowManageFavs(open); if (!open) { setSelectedFavIds(new Set()); setRenamingFav(null); } }}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              管理常用食物
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {favoriteFoods.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">尚無常用食物</p>
            ) : (
              favoriteFoods.map((food: any) => (
                <div key={food.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${
                  selectedFavIds.has(food.id) ? 'border-primary/50 bg-primary/5' : 'border-border bg-card'
                }`}>
                  {/* Checkbox */}
                  <button
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      selectedFavIds.has(food.id) ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                    }`}
                    onClick={() => setSelectedFavIds(prev => {
                      const next = new Set(prev);
                      next.has(food.id) ? next.delete(food.id) : next.add(food.id);
                      return next;
                    })}
                  >
                    {selectedFavIds.has(food.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </button>
                  {/* Name / rename inline */}
                  {renamingFav?.id === food.id ? (
                    <div className="flex-1 flex items-center gap-1.5">
                      <Input
                        className="h-7 text-xs flex-1"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && renameValue.trim()) renameFavoriteMutation.mutate({ id: food.id, newName: renameValue.trim() });
                          if (e.key === 'Escape') setRenamingFav(null);
                        }}
                        autoFocus
                      />
                      <Button size="sm" className="h-7 text-xs px-2" disabled={!renameValue.trim() || renameFavoriteMutation.isPending}
                        onClick={() => renameValue.trim() && renameFavoriteMutation.mutate({ id: food.id, newName: renameValue.trim() })}>
                        {renameFavoriteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : '確認'}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setRenamingFav(null)}>取消</Button>
                    </div>
                  ) : (
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{food.foodName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {Math.round(food.calories ?? 0)} kcal · {food.servingSize ?? 100}{food.servingUnit || 'g'}
                        {food.protein != null && ` · 蛋白 ${Math.round(food.protein)}g`}
                      </p>
                    </div>
                  )}
                  {/* Action buttons */}
                  {renamingFav?.id !== food.id && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => { setRenamingFav({ id: food.id, name: food.foodName }); setRenameValue(food.foodName); }}
                        title="重命名">
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                        onClick={() => removeFavoriteMutation.mutate({ id: food.id })}
                        disabled={removeFavoriteMutation.isPending}
                        title="刪除">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          {/* Footer actions */}
          <div className="border-t border-border pt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => {
                if (selectedFavIds.size === favoriteFoods.length) setSelectedFavIds(new Set());
                else setSelectedFavIds(new Set(favoriteFoods.map((f: any) => f.id)));
              }}>
                {selectedFavIds.size === favoriteFoods.length ? '取消全選' : '全選'}
              </Button>
              {selectedFavIds.size > 0 && (
                <Button size="sm" variant="destructive" className="text-xs h-8 gap-1"
                  disabled={bulkRemoveFavoriteMutation.isPending}
                  onClick={() => bulkRemoveFavoriteMutation.mutate({ ids: Array.from(selectedFavIds) })}>
                  {bulkRemoveFavoriteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  刪除已選 ({selectedFavIds.size})
                </Button>
              )}
            </div>
            <Button size="sm" variant="ghost" className="text-xs h-8" onClick={() => setShowManageFavs(false)}>關閉</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
