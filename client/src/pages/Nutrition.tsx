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
  ChevronLeft, ChevronRight, Star
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
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [copyMenuId, setCopyMenuId] = useState<number | null>(null);
  const [showAILookup, setShowAILookup] = useState(false);
  const [aiLookupRestaurant, setAILookupRestaurant] = useState("");
  const [aiLookupFood, setAILookupFood] = useState("");
  const [aiLookupQty, setAILookupQty] = useState(100);
  const [aiLookupResult, setAILookupResult] = useState<any>(null);
  const [showRecentFoods, setShowRecentFoods] = useState(false);
  const [foodHistory, setFoodHistory] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('bf-food-history') || '[]'); } catch { return []; }
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const saveFoodToHistory = (food: any) => {
    const key = `${(food.nameZh || food.name).toLowerCase()}|${(food.restaurantName || '').toLowerCase()}`;
    const entry = { ...food, key, savedAt: Date.now() };
    setFoodHistory(prev => {
      const filtered = prev.filter((f: any) => f.key !== key);
      const updated = [entry, ...filtered].slice(0, 30);
      localStorage.setItem('bf-food-history', JSON.stringify(updated));
      return updated;
    });
  };

  const applyFoodFromHistory = (food: any) => {
    setForm({
      name: food.nameZh || food.name,
      quantity: food.quantity,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      fiber: food.fiber,
    });
    setShowRecentFoods(false);
  };

  const clearFoodHistory = () => {
    setFoodHistory([]);
    localStorage.removeItem('bf-food-history');
    toast.success('已清除查詢記錄');
  };

  const utils = trpc.useUtils();
  const { data: meals = [], isLoading } = trpc.nutrition.getMealLogs.useQuery({ date: selectedDate });
  // Calculate 6 days ago in HK timezone: use HK midnight offset to avoid UTC date boundary issues
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
    onSuccess: () => { utils.nutrition.getMealLogs.invalidate(); utils.nutrition.getMealLogsRange.invalidate(); toast.success("Meal logged!"); setShowAddDialog(false); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.nutrition.updateMealLog.useMutation({
    onSuccess: () => {
      utils.nutrition.getMealLogs.invalidate();
      utils.nutrition.getMealLogsRange.invalidate();
      toast.success("Updated!");
      setEditEntry(null);
      setShowAddDialog(false);
    },
  });
  const deleteMutation = trpc.nutrition.deleteMealLog.useMutation({
    onSuccess: () => { utils.nutrition.getMealLogs.invalidate(); utils.nutrition.getMealLogsRange.invalidate(); toast.success("Deleted"); },
  });
  const uploadPhotoMutation = trpc.nutrition.uploadFoodPhoto.useMutation();
  const analyzePhotoMutation = trpc.nutrition.analyzeFoodPhoto.useMutation({
    onSuccess: (data) => { setAiResult(data); setAnalyzing(false); },
    onError: () => { setAnalyzing(false); toast.error("Analysis failed"); },
  });

  const resetForm = () => setForm({ name: "", quantity: 100, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: undefined });

  // Fetch all exercise calories burned for the selected date (workout + running + steps)
  const { data: workoutCalData } = trpc.workout.getDailyCaloriesBurned.useQuery({ date: selectedDate });
  const workoutCaloriesBurned = workoutCalData?.caloriesBurned ?? 0;
  const runningCaloriesBurned = workoutCalData?.runningBurned ?? 0;
  const stepsCaloriesBurned = workoutCalData?.stepsBurned ?? 0;
  const totalCaloriesBurned = workoutCalData?.totalBurned ?? workoutCaloriesBurned;
  const workoutSessions = workoutCalData?.sessions ?? [];

  // Fetch TDEE-based dynamic calorie target (uses BMR from latest body composition)
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
      // Compute HK date string for (6-i) days ago using HK midnight offset
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
  };

  const handleAnalyze = () => {
    if (!photoBase64) return;
    setAnalyzing(true);
    // Pass base64 directly to avoid S3 upload (works on all hosting environments)
    analyzePhotoMutation.mutate({ imageBase64: photoBase64, mimeType: "image/jpeg" });
  };

  const lookupFoodMutation = trpc.nutrition.lookupFoodNutrition.useMutation({
    onSuccess: (data) => {
      setAILookupResult(data);
      // Save to history with restaurant name for context
      saveFoodToHistory({ ...data, restaurantName: aiLookupRestaurant || '' });
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
    setForm({ name: food.name, nameZh: food.nameZh, quantity: food.quantity, calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat, fiber: food.fiber });
    setDialogDate(selectedDate);
    setShowPhotoDialog(false);
    setShowAddDialog(true);
  };

  const handleSubmit = () => {
    if (!form.name) return toast.error("Food name required");
    if (editEntry) {
      updateMutation.mutate({ id: editEntry.id, date: dialogDate, mealType, foodName: form.name, quantity: form.quantity, calories: form.calories, protein: form.protein, carbs: form.carbs, fat: form.fat, fiber: form.fiber });
    } else {
      addMutation.mutate({ date: dialogDate, mealType, foodName: form.name, quantity: form.quantity, calories: form.calories, protein: form.protein, carbs: form.carbs, fat: form.fat, fiber: form.fiber });
    }
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
            <Button onClick={() => setShowPhotoDialog(true)} variant="outline" size="sm" className="gap-2">
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
                  {mealGroups[type].map(m => (
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
                          {(() => {
                            const histKey = `${m.foodName.toLowerCase()}|`;
                            const altKey = `${m.foodName.toLowerCase()}|${''}`;
                            const isStarred = foodHistory.some((f: any) => (f.nameZh || f.name).toLowerCase() === m.foodName.toLowerCase());
                            return (
                              <Button variant="ghost" size="icon"
                                className={`w-7 h-7 ${isStarred ? 'text-yellow-500 hover:text-yellow-600' : 'text-muted-foreground hover:text-yellow-500'}`}
                                title={isStarred ? '已在常用食物（點擊移除）' : '加入常用食物'}
                                onClick={() => {
                                  if (isStarred) {
                                    setFoodHistory(prev => {
                                      const updated = prev.filter((f: any) => (f.nameZh || f.name).toLowerCase() !== m.foodName.toLowerCase());
                                      localStorage.setItem('bf-food-history', JSON.stringify(updated));
                                      return updated;
                                    });
                                    toast.success(`已從常用食物移除 ${m.foodName}`);
                                  } else {
                                    saveFoodToHistory({ name: m.foodName, nameZh: m.foodName, quantity: m.servings * 100, calories: m.calories ?? 0, protein: m.protein ?? 0, carbs: m.carbs ?? 0, fat: m.fat ?? 0, fiber: m.fiber ?? 0, unit: 'g', restaurantName: '' });
                                    toast.success(`已將 ${m.foodName} 加入常用食物`);
                                  }
                                }}>
                                <Star className={`w-3.5 h-3.5 ${isStarred ? 'fill-yellow-500' : ''}`} />
                              </Button>
                            );
                          })()}
                          <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => deleteMutation.mutate({ id: m.id })}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="charts" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Weekly Calories */}
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

            {/* Today's Macro Distribution */}
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

            {/* Weekly Macros Stacked */}
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

      {/* Add/Edit Meal Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) setEditEntry(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editEntry ? "Edit Meal Entry" : "Log Meal"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Recent Foods History */}
            {isOwner && foodHistory.length > 0 && (
              <div className="border border-border rounded-xl p-3 bg-muted/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/70">
                    <span>🕒</span>
                    常用食物
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowRecentFoods(v => !v)}>
                      {showRecentFoods ? '收起' : `展開 (${foodHistory.length})`}
                    </button>
                    {showRecentFoods && (
                      <button className="text-xs text-destructive hover:text-destructive/80" onClick={clearFoodHistory}>清除</button>
                    )}
                  </div>
                </div>
                {showRecentFoods && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {foodHistory.map((food: any, idx: number) => (
                      <button key={idx} className="w-full text-left bg-card hover:bg-accent border border-border rounded-lg px-3 py-2 transition-colors"
                        onClick={() => applyFoodFromHistory(food)}>
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-foreground truncate">{food.nameZh || food.name}</div>
                            {food.restaurantName && <div className="text-[10px] text-muted-foreground truncate">{food.restaurantName}</div>}
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <div className="text-xs font-bold text-orange-500">{food.calories} kcal</div>
                            <div className="text-[10px] text-muted-foreground">{food.quantity}{food.unit || 'g'}</div>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
                          <span>🥩 {food.protein}g</span>
                          <span>🍞 {food.carbs}g</span>
                          <span>🧈 {food.fat}g</span>
                          {food.fiber > 0 && <span>🌿 {food.fiber}g</span>}
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

      {/* AI Photo Analysis Dialog */}
      <Dialog open={showPhotoDialog} onOpenChange={setShowPhotoDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> AI Food Photo Analysis</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!photoPreview ? (
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center space-y-3">
                <Camera className="w-10 h-10 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">Upload or capture a food photo</p>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" /> Upload Photo
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => cameraInputRef.current?.click()}>
                    <Camera className="w-4 h-4 mr-2" /> Take Photo
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
                    {analyzing ? "Analyzing…" : "Analyze with AI"}
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-muted/50 rounded-xl p-3">
                      <p className="text-xs text-muted-foreground mb-1">AI Analysis Result</p>
                      <p className="text-sm font-medium text-foreground">{aiResult.notes}</p>
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        {[
                          { label: "Calories", value: Math.round(aiResult.totalCalories), unit: "kcal" },
                          { label: "Protein", value: Math.round(aiResult.totalProtein), unit: "g" },
                          { label: "Carbs", value: Math.round(aiResult.totalCarbs), unit: "g" },
                          { label: "Fat", value: Math.round(aiResult.totalFat), unit: "g" },
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
                            <p className="text-sm font-medium">{food.name} <span className="text-muted-foreground text-xs">({food.nameZh})</span></p>
                            <p className="text-xs text-muted-foreground">{food.quantity}{food.unit}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground">{Math.round(food.calories)} kcal</span>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAddFromAI(food)}>Add</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button className="w-full" onClick={() => {
                      if (aiResult.foods?.[0]) {
                        setForm({ name: aiResult.foods[0].name, quantity: aiResult.foods[0].quantity, calories: aiResult.totalCalories, protein: aiResult.totalProtein, carbs: aiResult.totalCarbs, fat: aiResult.totalFat });
                        setDialogDate(selectedDate);
                        setShowPhotoDialog(false);
                        setShowAddDialog(true);
                      }
                    }}>Add All as One Entry</Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
