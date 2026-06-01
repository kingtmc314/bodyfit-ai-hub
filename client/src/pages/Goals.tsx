import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useIsOwner } from "@/contexts/OwnerContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Target, Save, Trash2, TrendingDown, TrendingUp, Moon, Heart, Flame, Scale, Activity, Dumbbell, Droplets, User, Calculator } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "react-i18next";

// Must match server z.enum values exactly
type GoalType =
  | "weight"
  | "body_fat_pct"
  | "muscle_mass"
  | "sleep_duration"
  | "sleep_score"
  | "resting_hr"
  | "hrv"
  | "daily_calories"
  | "daily_protein"
  | "workout_duration";

interface GoalConfig {
  type: GoalType;
  labelEn: string;
  labelZh: string;
  unit: string;
  icon: React.ElementType;
  color: string;
  description: string;
  min: number;
  max: number;
  step: number;
}

const GOAL_CONFIGS: GoalConfig[] = [
  { type: "weight",          labelEn: "Target Weight",         labelZh: "目標體重",       unit: "kg",   icon: Scale,       color: "text-green-600",  description: "Your ideal body weight",                       min: 30,   max: 200,  step: 0.1 },
  { type: "body_fat_pct",    labelEn: "Target Body Fat %",     labelZh: "目標體脂率",     unit: "%",    icon: TrendingDown,color: "text-orange-500", description: "Healthy: 10–25% (men), 18–32% (women)",        min: 5,    max: 50,   step: 0.1 },
  { type: "muscle_mass",     labelEn: "Target Muscle Mass",    labelZh: "目標肌肉量",     unit: "kg",   icon: TrendingUp,  color: "text-blue-600",   description: "Lean muscle mass target",                      min: 20,   max: 120,  step: 0.1 },
  { type: "sleep_duration",  labelEn: "Target Sleep Duration", labelZh: "目標睡眠時長",   unit: "hrs",  icon: Moon,        color: "text-purple-600", description: "Recommended: 7–9 hours per night",             min: 4,    max: 12,   step: 0.5 },
  { type: "sleep_score",     labelEn: "Target Sleep Score",    labelZh: "目標睡眠分數",   unit: "pts",  icon: Activity,    color: "text-violet-500", description: "Garmin sleep score: 0–100",                    min: 0,    max: 100,  step: 1   },
  { type: "resting_hr",      labelEn: "Target Resting HR",     labelZh: "目標靜息心率",   unit: "bpm",  icon: Heart,       color: "text-red-500",    description: "Healthy range: 60–100 bpm",                   min: 40,   max: 100,  step: 1   },
  { type: "hrv",             labelEn: "Target HRV",            labelZh: "目標心率變異",   unit: "ms",   icon: Activity,    color: "text-pink-500",   description: "Higher HRV indicates better recovery",         min: 10,   max: 200,  step: 1   },
  { type: "daily_calories",  labelEn: "Daily Calorie Goal",    labelZh: "每日卡路里目標", unit: "kcal", icon: Flame,       color: "text-amber-500",  description: "Based on your TDEE and goals",                 min: 1000, max: 5000, step: 50  },
  { type: "daily_protein",   labelEn: "Daily Protein Goal",    labelZh: "每日蛋白質目標", unit: "g",    icon: Droplets,    color: "text-cyan-500",   description: "Recommended: 1.6–2.2 g per kg bodyweight",    min: 50,   max: 400,  step: 5   },
  { type: "workout_duration",labelEn: "Workout Duration Goal", labelZh: "訓練時長目標",   unit: "min",  icon: Dumbbell,    color: "text-indigo-600", description: "Target minutes per workout session",           min: 15,   max: 240,  step: 5   },
];

export default function Goals() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const isOwner = useIsOwner();

  const { data: goals, refetch } = trpc.goals.getGoals.useQuery();
  const setGoalMutation = trpc.goals.setGoal.useMutation({
    onSuccess: () => { toast.success(isZh ? "目標已儲存" : "Goal saved!"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteGoalMutation = trpc.goals.deleteGoal.useMutation({
    onSuccess: () => { toast.success(isZh ? "目標已刪除" : "Goal deleted"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [values, setValues] = useState<Record<string, string>>({});

  // Profile state
  const { data: profileData, refetch: refetchProfile } = trpc.profile.get.useQuery();
  const upsertProfileMutation = trpc.profile.upsert.useMutation({
    onSuccess: () => { toast.success(isZh ? "個人資料已儲存" : "Profile saved!"); refetchProfile(); },
    onError: (e) => toast.error(e.message),
  });
  const [profileForm, setProfileForm] = useState({ height: "", birthYear: "", gender: "" });

  // Sync profile form when data loads
  useEffect(() => {
    if (profileData) {
      setProfileForm({
        height: profileData.height ? String(profileData.height) : "",
        birthYear: profileData.birthYear ? String(profileData.birthYear) : "",
        gender: profileData.gender ?? "",
      });
    }
  }, [profileData]);

  const handleSaveProfile = () => {
    const h = profileForm.height ? parseFloat(profileForm.height) : undefined;
    const by = profileForm.birthYear ? parseInt(profileForm.birthYear) : undefined;
    const g = profileForm.gender as 'male' | 'female' | undefined || undefined;
    if (h && (h < 50 || h > 300)) { toast.error(isZh ? "身高請在 50–300 cm 之間" : "Height must be 50–300 cm"); return; }
    if (by && (by < 1900 || by > new Date().getFullYear())) { toast.error(isZh ? "出生年份不正確" : "Invalid birth year"); return; }
    upsertProfileMutation.mutate({ height: h, birthYear: by, gender: g });
  };

  // Calculate BMR preview
  const previewBmr = (() => {
    const h = parseFloat(profileForm.height);
    const by = parseInt(profileForm.birthYear);
    const g = profileForm.gender;
    const weight = undefined; // weight comes from body composition, not shown here
    if (!h || !by || !g) return null;
    const age = new Date().getFullYear() - by;
    const gOffset = g === 'female' ? -161 : 5;
    // Show formula without weight (weight from body comp)
    return { age, gOffset, h, g };
  })();

  const getGoalValue = (type: GoalType) => {
    const g = goals?.find(g => g.goalType === type && g.isActive);
    return g ? String(g.targetValue) : "";
  };

  const handleSave = (type: GoalType, unit: string) => {
    const raw = values[type] ?? getGoalValue(type);
    const val = parseFloat(raw);
    if (isNaN(val)) { toast.error(isZh ? "請輸入有效數值" : "Please enter a valid number"); return; }
    setGoalMutation.mutate({ goalType: type, targetValue: val, unit });
  };

  const handleDelete = (type: GoalType) => {
    deleteGoalMutation.mutate({ goalType: type });
    setValues(prev => { const n = { ...prev }; delete n[type]; return n; });
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
          <Target className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">{isZh ? "健康目標" : "Health Goals"}</h1>
          <p className="text-sm text-muted-foreground">{isZh ? "設定個人目標，在趨勢圖表上顯示參考線" : "Set personal targets — shown as reference lines on trend charts"}</p>
        </div>
      </div>

      {/* Personal Profile Section */}
      <Card className="border-2 border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-orange-600" />
            <CardTitle className="text-base font-bold">{isZh ? "個人資料" : "Personal Profile"}</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">{isZh ? "用於 Mifflin-St Jeor 公式計算 BMR 及 TDEE" : "Used for Mifflin-St Jeor BMR & TDEE calculation"}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Height */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{isZh ? "身高 (cm)" : "Height (cm)"}</Label>
              <Input
                type="number" min={50} max={300} step={0.1}
                placeholder="e.g. 175"
                value={profileForm.height}
                onChange={e => setProfileForm(p => ({ ...p, height: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
            {/* Birth Year */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{isZh ? "出生年份" : "Birth Year"}</Label>
              <Input
                type="number" min={1900} max={new Date().getFullYear()} step={1}
                placeholder="e.g. 1990"
                value={profileForm.birthYear}
                onChange={e => setProfileForm(p => ({ ...p, birthYear: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
            {/* Gender */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{isZh ? "性別" : "Gender"}</Label>
              <Select value={profileForm.gender} onValueChange={v => setProfileForm(p => ({ ...p, gender: v }))}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={isZh ? "請選擇" : "Select"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">{isZh ? "男" : "Male"}</SelectItem>
                  <SelectItem value="female">{isZh ? "女" : "Female"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* BMR formula preview */}
          {previewBmr && (
            <div className="p-3 rounded-lg bg-background border border-border text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                <Calculator className="w-3.5 h-3.5" />
                {isZh ? "BMR 公式預覽" : "BMR Formula Preview"}
              </div>
              <p className="text-muted-foreground font-mono">
                BMR = 9.99 × 體重(kg) + 6.25 × {previewBmr.h} - 4.92 × {previewBmr.age} {previewBmr.gOffset > 0 ? `+ ${previewBmr.gOffset}` : `- ${Math.abs(previewBmr.gOffset)}`}
              </p>
              <p className="text-orange-600 dark:text-orange-400">
                {isZh ? "體重從最新身體組成記錄自動引用，TDEE = BMR + 今日運動卡路里" : "Weight auto-fetched from latest body composition. TDEE = BMR + today's exercise calories"}
              </p>
            </div>
          )}

          {isOwner && (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleSaveProfile}
              disabled={upsertProfileMutation.isPending}
            >
              <Save className="w-3.5 h-3.5" />
              {isZh ? "儲存個人資料" : "Save Profile"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Goal cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {GOAL_CONFIGS.map((cfg) => {
          const existing = goals?.find(g => g.goalType === cfg.type && g.isActive);
          const displayVal = values[cfg.type] ?? (existing ? String(existing.targetValue) : "");
          const Icon = cfg.icon;

          return (
            <Card key={cfg.type} className={`border-2 transition-all ${existing ? "border-primary/30 bg-primary/5" : "border-border"}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-5 h-5 ${cfg.color}`} />
                    <CardTitle className="text-base font-bold">
                      {isZh ? cfg.labelZh : cfg.labelEn}
                    </CardTitle>
                  </div>
                  {existing && (
                    <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                      {isZh ? "已設定" : "Active"}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{cfg.description}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {existing && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50">
                    <span className="text-xs text-muted-foreground">{isZh ? "目前目標：" : "Current:"}</span>
                    <span className="text-sm font-bold text-primary">{existing.targetValue} {cfg.unit}</span>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground mb-1 block">
                      {isZh ? "新目標值" : "New target"} ({cfg.unit})
                    </Label>
                    <Input
                      type="number"
                      min={cfg.min}
                      max={cfg.max}
                      step={cfg.step}
                      placeholder={`${cfg.min}–${cfg.max} ${cfg.unit}`}
                      value={displayVal}
                      onChange={e => setValues(prev => ({ ...prev, [cfg.type]: e.target.value }))}
                      className="h-9 text-sm"
                    />
                  </div>
                  {isOwner && (
                    <Button
                      size="sm"
                      className="h-9 px-3 gap-1.5"
                      onClick={() => handleSave(cfg.type, cfg.unit)}
                      disabled={setGoalMutation.isPending}
                    >
                      <Save className="w-3.5 h-3.5" />
                      {isZh ? "儲存" : "Save"}
                    </Button>
                  )}
                  {isOwner && existing && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 px-2 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(cfg.type)}
                      disabled={deleteGoalMutation.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Separator />

      {/* Info note */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <TrendingUp className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
            {isZh ? "目標參考線" : "Goal Reference Lines"}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-300 mt-0.5">
            {isZh
              ? "設定目標後，前往「趨勢分析」頁面，每個圖表將顯示對應的目標參考線（虛線），幫助您追蹤進度。"
              : "After setting goals, visit the Trends page — each chart will show a dashed reference line at your target value to help you track progress."}
          </p>
        </div>
      </div>

      {/* Version */}
      <p className="text-xs text-muted-foreground text-center">BodyFit AI Hub v1.0.0</p>
    </div>
  );
}
