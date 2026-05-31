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
  Plus, Camera, Search, Trash2, Edit2, X, Loader2, Utensils,
  Flame, Beef, Wheat, Droplets, ChevronDown, Upload, Sparkles
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
  const [selectedDate, setSelectedDate] = useState(todayHKString);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [editEntry, setEditEntry] = useState<any>(null);
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState<FoodEntry>({ name: "", quantity: 100, calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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
    onSuccess: () => { utils.nutrition.getMealLogs.invalidate(); toast.success("Updated!"); setEditEntry(null); },
  });
  const deleteMutation = trpc.nutrition.deleteMealLog.useMutation({
    onSuccess: () => { utils.nutrition.getMealLogs.invalidate(); utils.nutrition.getMealLogsRange.invalidate(); toast.success("Deleted"); },
  });
  const uploadPhotoMutation = trpc.nutrition.uploadFoodPhoto.useMutation();
  const analyzePhotoMutation = trpc.nutrition.analyzeFoodPhoto.useMutation({
    onSuccess: (data) => { setAiResult(data); setAnalyzing(false); },
    onError: () => { setAnalyzing(false); toast.error("Analysis failed"); },
  });

  const resetForm = () => setForm({ name: "", quantity: 100, calories: 0, protein: 0, carbs: 0, fat: 0 });

  // Fetch workout calories burned for the selected date
  const { data: workoutCalData } = trpc.workout.getDailyCaloriesBurned.useQuery({ date: selectedDate });
  const workoutCaloriesBurned = workoutCalData?.caloriesBurned ?? 0;
  const workoutSessions = workoutCalData?.sessions ?? [];

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
      const dateKey = toHKDateString(new Date(m.loggedAt));
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

  const handleAnalyze = async () => {
    if (!photoBase64) return;
    setAnalyzing(true);
    try {
      const { url } = await uploadPhotoMutation.mutateAsync({ base64: photoBase64, mimeType: "image/jpeg" });
      analyzePhotoMutation.mutate({ imageUrl: url });
    } catch {
      setAnalyzing(false);
      toast.error("Upload failed");
    }
  };

  const handleAddFromAI = (food: any) => {
    setForm({ name: food.name, nameZh: food.nameZh, quantity: food.quantity, calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat, fiber: food.fiber });
    setShowPhotoDialog(false);
    setShowAddDialog(true);
  };

  const handleSubmit = () => {
    if (!form.name) return toast.error("Food name required");
    if (editEntry) {
      updateMutation.mutate({ id: editEntry.id, ...form });
    } else {
      addMutation.mutate({ date: selectedDate, mealType, foodName: form.name, quantity: form.quantity, calories: form.calories, protein: form.protein, carbs: form.carbs, fat: form.fat, fiber: form.fiber });
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
          <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className="w-40 text-sm" />
          {isOwner && (
            <Button onClick={() => setShowPhotoDialog(true)} variant="outline" size="sm" className="gap-2">
              <Camera className="w-4 h-4" /> AI Photo
            </Button>
          )}
          {isOwner && (
            <Button onClick={() => { setEditEntry(null); resetForm(); setShowAddDialog(true); }} size="sm" className="gap-2">
              <Plus className="w-4 h-4" /> Log Meal
            </Button>
          )}
        </div>
      </div>

      {/* Daily Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Calories", value: Math.round(totals.calories), goal: GOALS.calories, unit: "kcal", color: "oklch(0.78 0.20 50)", icon: Flame },
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

      {/* Workout Calories Burned + Net Balance */}
      {workoutCaloriesBurned > 0 && (
        <div className="bg-card border border-orange-200 dark:border-orange-900/50 rounded-2xl p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center">
                <Flame className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Workout Calories Burned</p>
                <p className="text-xs text-muted-foreground">
                  {workoutSessions.map((s: any) => `${s.name || 'Workout'}${s.duration ? ` (${s.duration} min)` : ''}`).join(' · ')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Burned</p>
                <p className="text-lg font-bold text-orange-500">-{Math.round(workoutCaloriesBurned)} kcal</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Net Balance</p>
                <p className={`text-lg font-bold ${Math.round(totals.calories - workoutCaloriesBurned) < 0 ? 'text-blue-500' : 'text-green-500'}`}>
                  {Math.round(totals.calories - workoutCaloriesBurned) >= 0 ? '+' : ''}{Math.round(totals.calories - workoutCaloriesBurned)} kcal
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Remaining</p>
                <p className="text-lg font-bold text-foreground">
                  {Math.max(0, GOALS.calories - Math.round(totals.calories - workoutCaloriesBurned))} kcal
                </p>
              </div>
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
                  onClick={() => { setMealType(type); setEditEntry(null); resetForm(); setShowAddDialog(true); }}>
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
                          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => { setEditEntry(m); setForm({ name: m.foodName, quantity: m.servings * 100, calories: m.calories ?? 0, protein: m.protein ?? 0, carbs: m.carbs ?? 0, fat: m.fat ?? 0 }); setMealType(m.mealType as MealType); setShowAddDialog(true); }}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
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
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editEntry ? "Edit Meal Entry" : "Log Meal"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
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
