import { useTranslation } from "react-i18next";
import { useState, useMemo, useRef, useEffect } from "react";
import { useIsOwner } from "@/contexts/OwnerContext";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { todayHKString, toHKDateString, formatHKChartDate } from "@/lib/hkTime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WorkoutMuscleAnalytics from "@/components/WorkoutMuscleAnalytics";
import GymDirectoryPanel from "@/components/GymDirectoryPanel";
import {
  WorkoutStudioStyles,
  WorkoutStudioHeader,
  WorkoutStudioExerciseHeading,
  WorkoutStudioLibraryCard,
  WorkoutStudioRestBar,
  studioMuscleLabel,
  useStudioLanguage,
} from "@/components/WorkoutStudio";
import { EXERCISE_GUIDES, getExerciseGuide } from "@shared/exerciseGuides";
import { getExerciseMuscles } from "@shared/exerciseMuscles";
import {
  buildUnifiedExerciseCatalog,
  getCanonicalExerciseName,
  getExerciseHistoryNames,
  normalizeExerciseName,
} from "@shared/workoutExerciseIdentity";
import GymLocationInput, {
  normalizeGymLocation,
} from "@/components/GymLocationInput";
import { APP_VERSION } from "@/lib/appMeta";
import {
  MAX_WORKOUT_MINUTES,
  estimateWorkoutCalories,
  calorieEstimateSummary,
  type WorkoutCalorieEstimate,
} from "@shared/workoutCalories";
import {
  getWorkoutTimeDetails,
  reviewedWorkoutDurationInput,
  isActualWorkoutMinutes,
} from "@shared/workoutTiming";
export type { WorkoutCalorieEstimate } from "@shared/workoutCalories";
import {
  prepareReportPhoto,
  type PreparedReportPhoto,
} from "@/lib/prepareReportPhoto";
import {
  Plus,
  Dumbbell,
  Trash2,
  Edit2,
  Search,
  ChevronRight,
  Loader2,
  Flame,
  Timer,
  Weight,
  BarChart2,
  X,
  Check,
  Trophy,
  Target,
  Star,
  ArrowUpDown,
  Camera,
  Sparkles,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  Copy,
  ListChecks,
  TrendingUp,
  MapPin,
  Play,
  Activity,
  History,
} from "lucide-react";
import MuscleMap, { MUSCLE_GROUPS } from "@/components/MuscleMap";
import ExerciseDetailModal from "@/components/ExerciseDetailModal";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";

const EQUIPMENT_LIST = [
  "Barbell",
  "Dumbbell",
  "Cable",
  "Machine",
  "Smith Machine",
  "Kettlebell",
  "Resistance Band",
  "Bodyweight",
  "TRX / Suspension",
  "Pull-up Bar",
  "Dip Bar",
  "EZ Bar",
  "Trap Bar",
  "Plate",
  "Foam Roller",
  "Medicine Ball",
  "Battle Rope",
  "Cardio Machine",
];

const BUILT_IN_EXERCISES = [
  // Chest
  {
    name: "Bench Press",
    nameZh: "臥推",
    muscleGroup: "chest",
    equipment: "Barbell",
    instructions:
      "Lie on bench, grip bar shoulder-width, lower to chest, press up.",
  },
  {
    name: "Incline Bench Press",
    nameZh: "上斜臥推",
    muscleGroup: "chest",
    equipment: "Barbell",
  },
  {
    name: "Decline Bench Press",
    nameZh: "下斜臥推",
    muscleGroup: "chest",
    equipment: "Barbell",
  },
  {
    name: "Dumbbell Fly",
    nameZh: "啞鈴飛鳥",
    muscleGroup: "chest",
    equipment: "Dumbbell",
  },
  {
    name: "Cable Crossover",
    nameZh: "繩索夾胸",
    muscleGroup: "chest",
    equipment: "Cable",
  },
  {
    name: "Chest Press Machine",
    nameZh: "胸推機",
    muscleGroup: "chest",
    equipment: "Machine",
  },
  {
    name: "Push-up",
    nameZh: "掌上壓",
    muscleGroup: "chest",
    equipment: "Bodyweight",
  },
  {
    name: "Pec Deck",
    nameZh: "蝴蝶機夾胸",
    muscleGroup: "chest",
    equipment: "Machine",
  },
  // Back
  {
    name: "Deadlift",
    nameZh: "硬拉",
    muscleGroup: "back",
    equipment: "Barbell",
  },
  {
    name: "Pull-up",
    nameZh: "引體向上",
    muscleGroup: "back",
    equipment: "Pull-up Bar",
  },
  {
    name: "Lat Pulldown",
    nameZh: "下拉機",
    muscleGroup: "lats",
    equipment: "Cable",
  },
  {
    name: "Seated Cable Row",
    nameZh: "坐姿划船",
    muscleGroup: "back",
    equipment: "Cable",
  },
  {
    name: "Bent-over Barbell Row",
    nameZh: "俯身槓鈴划船",
    muscleGroup: "back",
    equipment: "Barbell",
  },
  {
    name: "T-Bar Row",
    nameZh: "T型划船",
    muscleGroup: "back",
    equipment: "Barbell",
  },
  {
    name: "Single-arm Dumbbell Row",
    nameZh: "單臂啞鈴划船",
    muscleGroup: "back",
    equipment: "Dumbbell",
  },
  {
    name: "Hyperextension",
    nameZh: "背伸展",
    muscleGroup: "back",
    equipment: "Machine",
  },
  // Shoulders
  {
    name: "Overhead Press",
    nameZh: "過頭推舉",
    muscleGroup: "shoulders",
    equipment: "Barbell",
  },
  {
    name: "Dumbbell Shoulder Press",
    nameZh: "啞鈴肩推",
    muscleGroup: "shoulders",
    equipment: "Dumbbell",
  },
  {
    name: "Lateral Raise",
    nameZh: "側平舉",
    muscleGroup: "shoulders",
    equipment: "Dumbbell",
  },
  {
    name: "Front Raise",
    nameZh: "前平舉",
    muscleGroup: "shoulders",
    equipment: "Dumbbell",
  },
  {
    name: "Rear Delt Fly",
    nameZh: "後三角飛鳥",
    muscleGroup: "shoulders",
    equipment: "Dumbbell",
  },
  {
    name: "Face Pull",
    nameZh: "繩索臉拉",
    muscleGroup: "shoulders",
    equipment: "Cable",
  },
  {
    name: "Arnold Press",
    nameZh: "阿諾德推舉",
    muscleGroup: "shoulders",
    equipment: "Dumbbell",
  },
  {
    name: "Shoulder Press Machine",
    nameZh: "肩推機",
    muscleGroup: "shoulders",
    equipment: "Machine",
  },
  // Biceps
  {
    name: "Barbell Curl",
    nameZh: "槓鈴彎舉",
    muscleGroup: "biceps",
    equipment: "Barbell",
  },
  {
    name: "Dumbbell Curl",
    nameZh: "啞鈴彎舉",
    muscleGroup: "biceps",
    equipment: "Dumbbell",
  },
  {
    name: "Hammer Curl",
    nameZh: "錘式彎舉",
    muscleGroup: "biceps",
    equipment: "Dumbbell",
  },
  {
    name: "Preacher Curl",
    nameZh: "牧師椅彎舉",
    muscleGroup: "biceps",
    equipment: "EZ Bar",
  },
  {
    name: "Cable Curl",
    nameZh: "繩索彎舉",
    muscleGroup: "biceps",
    equipment: "Cable",
  },
  {
    name: "Concentration Curl",
    nameZh: "集中彎舉",
    muscleGroup: "biceps",
    equipment: "Dumbbell",
  },
  // Triceps
  {
    name: "Tricep Dip",
    nameZh: "三頭撐體",
    muscleGroup: "triceps",
    equipment: "Dip Bar",
  },
  {
    name: "Skull Crusher",
    nameZh: "頭骨碎裂者",
    muscleGroup: "triceps",
    equipment: "EZ Bar",
  },
  {
    name: "Tricep Pushdown",
    nameZh: "繩索下壓",
    muscleGroup: "triceps",
    equipment: "Cable",
  },
  {
    name: "Overhead Tricep Extension",
    nameZh: "過頭三頭伸展",
    muscleGroup: "triceps",
    equipment: "Dumbbell",
  },
  {
    name: "Close-grip Bench Press",
    nameZh: "窄握臥推",
    muscleGroup: "triceps",
    equipment: "Barbell",
  },
  {
    name: "Tricep Kickback",
    nameZh: "三頭後踢",
    muscleGroup: "triceps",
    equipment: "Dumbbell",
  },
  // Legs
  { name: "Squat", nameZh: "深蹲", muscleGroup: "quads", equipment: "Barbell" },
  {
    name: "Leg Press",
    nameZh: "腿推機",
    muscleGroup: "quads",
    equipment: "Machine",
  },
  {
    name: "Leg Extension",
    nameZh: "腿伸展機",
    muscleGroup: "quads",
    equipment: "Machine",
  },
  {
    name: "Leg Curl",
    nameZh: "腿彎舉機",
    muscleGroup: "hamstrings",
    equipment: "Machine",
  },
  {
    name: "Romanian Deadlift",
    nameZh: "羅馬尼亞硬拉",
    muscleGroup: "hamstrings",
    equipment: "Barbell",
  },
  {
    name: "Lunge",
    nameZh: "弓步蹲",
    muscleGroup: "quads",
    equipment: "Dumbbell",
  },
  {
    name: "Bulgarian Split Squat",
    nameZh: "保加利亞分腿蹲",
    muscleGroup: "quads",
    equipment: "Dumbbell",
  },
  {
    name: "Hip Thrust",
    nameZh: "臀推",
    muscleGroup: "glutes",
    equipment: "Barbell",
  },
  {
    name: "Glute Bridge",
    nameZh: "臀橋",
    muscleGroup: "glutes",
    equipment: "Bodyweight",
  },
  {
    name: "Standing Calf Raise",
    nameZh: "站姿提踵",
    muscleGroup: "calves",
    equipment: "Machine",
  },
  {
    name: "Seated Calf Raise",
    nameZh: "坐姿提踵",
    muscleGroup: "calves",
    equipment: "Machine",
  },
  // Abs
  {
    name: "Crunch",
    nameZh: "捲腹",
    muscleGroup: "abs",
    equipment: "Bodyweight",
  },
  {
    name: "Plank",
    nameZh: "平板支撐",
    muscleGroup: "abs",
    equipment: "Bodyweight",
  },
  {
    name: "Cable Crunch",
    nameZh: "繩索捲腹",
    muscleGroup: "abs",
    equipment: "Cable",
  },
  {
    name: "Hanging Leg Raise",
    nameZh: "懸掛舉腿",
    muscleGroup: "abs",
    equipment: "Pull-up Bar",
  },
  {
    name: "Russian Twist",
    nameZh: "俄羅斯轉體",
    muscleGroup: "obliques",
    equipment: "Bodyweight",
  },
  {
    name: "Ab Wheel Rollout",
    nameZh: "腹輪",
    muscleGroup: "abs",
    equipment: "Bodyweight",
  },
  // Traps
  {
    name: "Barbell Shrug",
    nameZh: "槓鈴聳肩",
    muscleGroup: "traps",
    equipment: "Barbell",
  },
  {
    name: "Dumbbell Shrug",
    nameZh: "啞鈴聳肩",
    muscleGroup: "traps",
    equipment: "Dumbbell",
  },
  {
    name: "Upright Row",
    nameZh: "直立划船",
    muscleGroup: "traps",
    equipment: "Barbell",
  },
  // Forearms
  {
    name: "Wrist Curl",
    nameZh: "腕彎舉",
    muscleGroup: "forearms",
    equipment: "Barbell",
  },
  {
    name: "Reverse Curl",
    nameZh: "反握彎舉",
    muscleGroup: "forearms",
    equipment: "Barbell",
  },
  {
    name: "Farmer's Walk",
    nameZh: "農夫走路",
    muscleGroup: "forearms",
    equipment: "Dumbbell",
  },
  // Cardio Machines
  {
    name: "Stationary Bike",
    nameZh: "单車機",
    muscleGroup: "cardio",
    equipment: "Machine",
    instructions:
      "Adjust seat height, maintain steady cadence, track time and resistance level.",
  },
  {
    name: "Treadmill",
    nameZh: "跑步機",
    muscleGroup: "cardio",
    equipment: "Machine",
    instructions:
      "Set speed and incline, maintain upright posture, track distance and time.",
  },
  {
    name: "Stair Climber",
    nameZh: "行山機",
    muscleGroup: "cardio",
    equipment: "Machine",
    instructions:
      "Step at a steady pace, avoid leaning heavily on handles, track steps and time.",
  },
  {
    name: "Elliptical Trainer",
    nameZh: "橢圓機",
    muscleGroup: "cardio",
    equipment: "Machine",
    instructions:
      "Use full stride, engage arms, maintain upright posture, track distance and time.",
  },
  {
    name: "Rowing Machine",
    nameZh: "劃船機",
    muscleGroup: "cardio",
    equipment: "Machine",
    instructions:
      "Drive with legs first, then lean back, pull handle to lower chest, track distance and strokes.",
  },
  {
    name: "Ski Erg",
    nameZh: "Ski Erg 機",
    muscleGroup: "cardio",
    equipment: "Machine",
    instructions:
      "Pull handles down with straight arms, engage core and hips, track distance and time.",
  },
  {
    name: "Air Bike",
    nameZh: "風阻单車",
    muscleGroup: "cardio",
    equipment: "Machine",
    instructions:
      "Push and pull handles while pedaling, maintain steady pace or do intervals.",
  },
  {
    name: "Jacob's Ladder",
    nameZh: "天梯機",
    muscleGroup: "cardio",
    equipment: "Machine",
    instructions: "Climb at steady pace, engage core, track time and floors.",
  },
];

const WORKOUT_TEMPLATES = [
  {
    key: "push",
    name: "Push Day",
    nameZh: "推日：胸、肩、三頭",
    description: "以推舉動作建立胸肩三頭的力量基礎。",
    exercises: [
      {
        name: "Bench Press",
        nameZh: "臥推",
        targetSets: 4,
        targetReps: "6–10",
        equipment: "Barbell",
      },
      {
        name: "Incline Bench Press",
        nameZh: "上斜臥推",
        targetSets: 3,
        targetReps: "8–12",
        equipment: "Barbell",
      },
      {
        name: "Dumbbell Shoulder Press",
        nameZh: "啞鈴肩推",
        targetSets: 3,
        targetReps: "8–12",
        equipment: "Dumbbell",
      },
      {
        name: "Lateral Raise",
        nameZh: "側平舉",
        targetSets: 3,
        targetReps: "12–15",
        equipment: "Dumbbell",
      },
      {
        name: "Tricep Pushdown",
        nameZh: "繩索下壓",
        targetSets: 3,
        targetReps: "10–15",
        equipment: "Cable",
      },
    ],
  },
  {
    key: "pull",
    name: "Pull Day",
    nameZh: "拉日：背、二頭",
    description: "平衡垂直與水平拉力，強化背部與手臂。",
    exercises: [
      {
        name: "Lat Pulldown",
        nameZh: "下拉機",
        targetSets: 4,
        targetReps: "8–12",
        equipment: "Cable",
      },
      {
        name: "Seated Cable Row",
        nameZh: "坐姿划船",
        targetSets: 3,
        targetReps: "8–12",
        equipment: "Cable",
      },
      {
        name: "Single-arm Dumbbell Row",
        nameZh: "單臂啞鈴划船",
        targetSets: 3,
        targetReps: "8–12",
        equipment: "Dumbbell",
      },
      {
        name: "Face Pull",
        nameZh: "繩索臉拉",
        targetSets: 3,
        targetReps: "12–15",
        equipment: "Cable",
      },
      {
        name: "Hammer Curl",
        nameZh: "錘式彎舉",
        targetSets: 3,
        targetReps: "10–12",
        equipment: "Dumbbell",
      },
    ],
  },
  {
    key: "legs",
    name: "Leg Day",
    nameZh: "腿日：股四頭、臀腿後側",
    description: "以蹲、髖伸與單腿動作建立下肢力量。",
    exercises: [
      {
        name: "Squat",
        nameZh: "深蹲",
        targetSets: 4,
        targetReps: "6–10",
        equipment: "Barbell",
      },
      {
        name: "Romanian Deadlift",
        nameZh: "羅馬尼亞硬拉",
        targetSets: 3,
        targetReps: "8–12",
        equipment: "Barbell",
      },
      {
        name: "Leg Press",
        nameZh: "腿推機",
        targetSets: 3,
        targetReps: "10–12",
        equipment: "Machine",
      },
      {
        name: "Leg Curl",
        nameZh: "腿彎舉機",
        targetSets: 3,
        targetReps: "10–15",
        equipment: "Machine",
      },
      {
        name: "Standing Calf Raise",
        nameZh: "站姿提踵",
        targetSets: 3,
        targetReps: "12–15",
        equipment: "Machine",
      },
    ],
  },
  {
    key: "full-body",
    name: "Full Body",
    nameZh: "全身力量",
    description: "適合每週 2–3 次的均衡全身訓練。",
    exercises: [
      {
        name: "Squat",
        nameZh: "深蹲",
        targetSets: 3,
        targetReps: "6–10",
        equipment: "Barbell",
      },
      {
        name: "Bench Press",
        nameZh: "臥推",
        targetSets: 3,
        targetReps: "6–10",
        equipment: "Barbell",
      },
      {
        name: "Lat Pulldown",
        nameZh: "下拉機",
        targetSets: 3,
        targetReps: "8–12",
        equipment: "Cable",
      },
      {
        name: "Hip Thrust",
        nameZh: "臀推",
        targetSets: 3,
        targetReps: "8–12",
        equipment: "Barbell",
      },
      {
        name: "Plank",
        nameZh: "平板撐",
        targetSets: 3,
        targetReps: "30–45 秒",
        equipment: "Bodyweight",
      },
    ],
  },
] as const;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-xl text-xs">
        <p className="text-muted-foreground mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }} className="font-semibold">
            {p.name}: {Math.round(p.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const ALL_HISTORY_PERIOD_VALUE = "all";
const HK_HISTORY_MONTHS = [
  { value: "01", label: "1 月" },
  { value: "02", label: "2 月" },
  { value: "03", label: "3 月" },
  { value: "04", label: "4 月" },
  { value: "05", label: "5 月" },
  { value: "06", label: "6 月" },
  { value: "07", label: "7 月" },
  { value: "08", label: "8 月" },
  { value: "09", label: "9 月" },
  { value: "10", label: "10 月" },
  { value: "11", label: "11 月" },
  { value: "12", label: "12 月" },
] as const;

type HistoryPeriod = { year: string; month: string };
type HistoryComparisonMode = "previous_month" | "prior_equivalent_period";

/** Sessions are stored as timestamps, so derive every history filter date in Hong Kong time. */
function getSessionHKDate(session: any): string {
  return toHKDateString(session?.startTime);
}

function matchesHistoryPeriod(session: any, period: HistoryPeriod): boolean {
  const hkDate = getSessionHKDate(session);
  return (
    Boolean(hkDate) &&
    (period.year === ALL_HISTORY_PERIOD_VALUE ||
      hkDate.slice(0, 4) === period.year) &&
    (period.month === ALL_HISTORY_PERIOD_VALUE ||
      hkDate.slice(5, 7) === period.month)
  );
}

function formatHistoryPeriod(period: HistoryPeriod): string {
  if (
    period.year === ALL_HISTORY_PERIOD_VALUE &&
    period.month === ALL_HISTORY_PERIOD_VALUE
  )
    return "全部歷史記錄";
  if (period.year === ALL_HISTORY_PERIOD_VALUE)
    return `所有年份 · ${Number(period.month)} 月`;
  if (period.month === ALL_HISTORY_PERIOD_VALUE) return `${period.year} 年`;
  return `${period.year} 年 ${Number(period.month)} 月`;
}

function getComparisonPeriod(
  period: HistoryPeriod,
  mode: HistoryComparisonMode
): HistoryPeriod | null {
  if (
    period.year === ALL_HISTORY_PERIOD_VALUE &&
    period.month === ALL_HISTORY_PERIOD_VALUE
  )
    return null;

  // 「上個月」只適用於一個明確選定的年月，才能維持相同的完整月份比較。
  if (mode === "previous_month") {
    if (
      period.year === ALL_HISTORY_PERIOD_VALUE ||
      period.month === ALL_HISTORY_PERIOD_VALUE
    )
      return null;
    const month = Number(period.month);
    const isJanuary = month === 1;
    return {
      year: String(Number(period.year) - (isJanuary ? 1 : 0)),
      month: String(isJanuary ? 12 : month - 1).padStart(2, "0"),
    };
  }

  // 「上一個同等期間」保留已選擇的月份範圍，並往前推一年。
  return period.year === ALL_HISTORY_PERIOD_VALUE
    ? null
    : { year: String(Number(period.year) - 1), month: period.month };
}

function summariseHistorySessions(historySessions: any[]) {
  return historySessions.reduce(
    (summary, session) => ({
      sessions: summary.sessions + 1,
      volume: summary.volume + (Number(session.totalVolume) || 0),
      calories: summary.calories + (Number(session.caloriesBurned) || 0),
      duration: summary.duration + (Number(session.duration) || 0),
    }),
    { sessions: 0, volume: 0, calories: 0, duration: 0 }
  );
}

function HistorySummaryCard({
  title,
  periodLabel,
  summary,
  historyUnit,
  unavailableMessage,
}: {
  title: string;
  periodLabel: string;
  summary: ReturnType<typeof summariseHistorySessions> | null;
  historyUnit: "kg" | "lbs";
  unavailableMessage?: string;
}) {
  const displayVolume = summary
    ? historyUnit === "lbs"
      ? Math.round(summary.volume * 2.20462).toLocaleString()
      : Math.round(summary.volume).toLocaleString()
    : "—";
  const showCalories = Boolean(summary && summary.calories > 0);
  const showDuration = Boolean(summary && summary.duration > 0);

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{periodLabel}</p>
        </div>
        <BarChart2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
      </div>
      {summary ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">課程次數</p>
            <p className="font-bold text-foreground mt-0.5">
              {summary.sessions.toLocaleString()}{" "}
              <span className="text-xs font-medium text-muted-foreground">
                次
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">總訓練量</p>
            <p className="font-bold text-primary mt-0.5">
              {displayVolume}{" "}
              <span className="text-xs font-medium">{historyUnit}</span>
            </p>
          </div>
          {showCalories && (
            <div>
              <p className="text-xs text-muted-foreground">活動熱量估算合計</p>
              <p className="font-semibold text-orange-500 mt-0.5">
                {Math.round(summary.calories).toLocaleString()}{" "}
                <span className="text-xs font-medium">kcal</span>
              </p>
            </div>
          )}
          {showDuration && (
            <div>
              <p className="text-xs text-muted-foreground">總時長</p>
              <p className="font-semibold text-foreground mt-0.5">
                {Math.round(summary.duration).toLocaleString()}{" "}
                <span className="text-xs font-medium text-muted-foreground">
                  分鐘
                </span>
              </p>
            </div>
          )}
          {!showCalories && !showDuration && (
            <p className="col-span-2 text-xs text-muted-foreground">
              此期間沒有已記錄的熱量或時長。
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-2">
          {unavailableMessage}
        </p>
      )}
    </div>
  );
}

export function formatActiveEnergyRange(
  estimate?: WorkoutCalorieEstimate | null
): string {
  if (
    !estimate ||
    estimate.activeKcal == null ||
    !Number.isFinite(estimate.activeKcal)
  )
    return "—";
  if (
    estimate.lowKcal != null &&
    estimate.highKcal != null &&
    Number.isFinite(estimate.lowKcal) &&
    Number.isFinite(estimate.highKcal)
  ) {
    return `${Math.floor(estimate.lowKcal)}–${Math.ceil(estimate.highKcal)}`;
  }
  return `約 ${Math.round(estimate.activeKcal)}`;
}

const CALORIE_SOURCE_LABELS: Record<string, string> = {
  resistance_estimate: "阻力訓練活動強度估算",
  cardio_estimate: "有氧活動強度估算",
  machine_reported: "器材回報（熱量口徑未確認）",
  mixed: "活動估算＋器材回報",
  none: "沒有可用活動記錄",
  body_composition: "當日或之前的身體記錄",
  user_profile: "個人檔案",
  session_override: "本次課程修正",
  assumed_70kg: "假設 70 kg（請補充體重）",
  reported: "已記錄的器材／裝置數值",
  device: "器材／裝置記錄",
  met: "活動強度模型",
  estimated: "活動強度模型",
  manual: "保留原始／手動值（來源未核實）",
  profile: "個人檔案",
  body_log: "體重記錄",
  body_record: "體重記錄",
  latest_body: "最近體重記錄",
  default: "預設參考體重",
  fallback: "預設參考體重",
  duration: "有效訓練時間",
};

export function WorkoutEnergyPanel({
  estimate,
}: {
  estimate?: WorkoutCalorieEstimate | null;
}) {
  const isZh = useStudioLanguage();
  return (
    <section
      aria-label="活動熱量估算"
      className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
            <Flame aria-hidden="true" className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {estimate?.source === "manual"
                ? "保留原始／手動熱量 · 口徑未核實"
                : "估計活動熱量 · ACTIVE"}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {estimate?.source === "manual"
                ? "保留原始／手動值，不能確認其来源或活動／總熱量口徑；不是模型估算。"
                : estimate?.source === "machine_reported" ||
                    estimate?.source === "mixed"
                  ? "器材回報可能包含靜息熱量，無法確認為純活動消耗。"
                  : "活動估算扣除靜息代謝，不是量測值。"}{" "}
              勿視為可精確抵銷的飲食額度。
            </p>
          </div>
        </div>
        <p className="text-xl font-extrabold tabular-nums text-orange-500">
          {formatActiveEnergyRange(estimate)}{" "}
          <span className="text-xs font-medium">kcal</span>
        </p>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        範圍是模型假設下的參考區間，並非統計信賴區間。
      </p>
      {estimate ? (
        <details className="mt-3 border-t border-border/50 pt-2">
          <summary className="flex min-h-11 cursor-pointer items-center text-xs font-medium text-primary">
            {isZh ? "估算依據與限制" : "Estimate basis and limitations"}
          </summary>
          <dl className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">估算來源</dt>
              <dd className="mt-0.5 break-words font-medium text-foreground">
                {CALORIE_SOURCE_LABELS[estimate.source] ||
                  estimate.source ||
                  "未提供"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">參考體重／來源</dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {estimate.bodyWeightKg == null
                  ? "未提供"
                  : `${estimate.bodyWeightKg} kg`}{" "}
                ·{" "}
                {CALORIE_SOURCE_LABELS[estimate.weightSource] ||
                  estimate.weightSource ||
                  "未提供"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">熱量模型有效分鐘／強度</dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {estimate.effectiveMinutes == null
                  ? "未提供"
                  : `${estimate.effectiveMinutes} 分鐘`}{" "}
                ·{" "}
                {(
                  {
                    light: "輕量",
                    moderate: "中等",
                    vigorous: "高強度",
                  } as Record<string, string>
                )[estimate.intensity] ||
                  estimate.intensity ||
                  "未提供"}
              </dd>
              <p className="mt-1 text-[11px] text-muted-foreground">
                模型時間可由組數推估，不代表實際課程時長。
              </p>
            </div>
          </dl>
          {estimate.volume && (
            <dl className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs sm:grid-cols-4">
              <div>
                <dt className="text-[10px] text-muted-foreground">
                  {isZh ? "力量訓練量" : "Strength volume"}
                </dt>
                <dd className="mt-1 font-bold text-blue-700">
                  {Math.round(
                    estimate.volume.totalVolumeKgReps
                  ).toLocaleString()}{" "}
                  kg·{isZh ? "次" : "reps"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] text-muted-foreground">
                  {isZh ? "已記錄力量組／次數" : "Logged strength sets / reps"}
                </dt>
                <dd className="mt-1 font-semibold">
                  {estimate.volume.completedSets} / {estimate.volume.totalReps}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] text-muted-foreground">
                  {isZh ? "模型工作／恢復分鐘" : "Model work / recovery min"}
                </dt>
                <dd className="mt-1 font-semibold">
                  {estimate.volume.workMinutes.toFixed(1)} /{" "}
                  {estimate.volume.recoveryMinutes.toFixed(1)}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] text-muted-foreground">
                  {isZh
                    ? "缺漏／器材負重需核對"
                    : "Missing / ambiguous load sets"}
                </dt>
                <dd className="mt-1 font-semibold">
                  {estimate.volume.missingLoadSets} /{" "}
                  {estimate.volume.equipmentAmbiguousSets}
                </dd>
              </div>
              <p className="col-span-2 text-[10px] leading-5 text-muted-foreground sm:col-span-4">
                {isZh
                  ? "訓練量是記錄 kg × 次數，不代表肌肉活化或熱量。有效工作／恢復時間及能量為未驗證模型假設，不是實際課程時長；器材、單邊與總負重仍須核對。"
                  : "Volume is logged kg × reps, not activation or calories. Work/recovery time and energy are unverified model assumptions, not actual session duration. Machine, one-side and total-load conventions need review."}
              </p>
            </dl>
          )}
          {estimate.warnings?.length > 0 && (
            <ul
              aria-label="估算限制"
              className="mt-3 space-y-1 rounded-xl bg-amber-500/10 p-3 text-[11px] leading-5 text-amber-700 dark:text-amber-300"
            >
              {estimate.warnings.map((warning, index) => (
                <li
                  key={`${index}-${warning}`}
                  className="flex items-start gap-1.5"
                >
                  <AlertCircle
                    aria-hidden="true"
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  />
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          )}
        </details>
      ) : (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          尚未有可用估算。請補充有效時長及訓練組數；不會以開啟頁面的時間或固定
          70 kg 體重推算。
        </p>
      )}
    </section>
  );
}

function LibraryFilters({
  equipment,
  muscle,
  onEquipment,
  onMuscle,
  equipmentOptions,
  cardio = false,
}: {
  equipment: string;
  muscle: string | null;
  onEquipment: (value: string) => void;
  onMuscle: (value: string | null) => void;
  equipmentOptions: string[];
  cardio?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="text-[11px] font-medium text-muted-foreground">
        器材
        <select
          aria-label="篩選器材"
          value={equipment}
          onChange={event => onEquipment(event.target.value)}
          className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">所有器材</option>
          {equipmentOptions.map(item => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label className="text-[11px] font-medium text-muted-foreground">
        肌群
        <select
          aria-label="篩選肌群"
          value={cardio ? "cardio" : muscle || "all"}
          disabled={cardio}
          onChange={event =>
            onMuscle(event.target.value === "all" ? null : event.target.value)
          }
          className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          <option value="all">所有肌群</option>
          {MUSCLE_GROUPS.map(item => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
          {!MUSCLE_GROUPS.some(item => item.id === "cardio") && (
            <option value="cardio">有氧</option>
          )}
        </select>
      </label>
    </div>
  );
}

export default function Workout() {
  const { t } = useTranslation();
  const isOwner = useIsOwner();
  const isZh = useStudioLanguage();
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
  const [setForm, setSetForm] = useState({
    reps: 10,
    weight: 0,
    duration: 0,
    distance: 0,
    avgHr: 0,
    calories: 0,
    notes: "",
  });
  const [sessionName, setSessionName] = useState("");
  const [sessionLocation, setSessionLocation] = useState("");
  const [sessionEntryMode, setSessionEntryMode] = useState<"live" | "manual">(
    "live"
  );
  const [sessionStartTime, setSessionStartTime] = useState("08:00");
  const [manualDuration, setManualDuration] = useState("");
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [finishForm, setFinishForm] = useState({
    duration: "",
    intensity: "moderate" as "light" | "moderate" | "vigorous",
    bodyWeightKg: "",
  });
  const [selectedTemplateKey, setSelectedTemplateKey] =
    useState<string>("custom");
  const [editSet, setEditSet] = useState<any>(null);
  const [sessionSort, setSessionSort] = useState<
    "date_desc" | "date_asc" | "volume_desc" | "duration_desc"
  >("date_desc");
  const [sessionSearch, setSessionSearch] = useState("");
  const [activeTab, setActiveTab] = useState<
    "session" | "exercises" | "history" | "pr" | "muscles" | "gyms"
  >("session");
  const [prSearch, setPrSearch] = useState("");
  const [prSortBy, setPrSortBy] = useState<"weight" | "name" | "date">(
    "weight"
  );
  const [prUnit, setPrUnit] = useState<"kg" | "lbs">("kg");
  const [exerciseLibMode, setExerciseLibMode] = useState<"strength" | "cardio">(
    "strength"
  );
  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">("kg");
  const [historyUnit, setHistoryUnit] = useState<"kg" | "lbs">("kg");
  const [historyYear, setHistoryYear] = useState(ALL_HISTORY_PERIOD_VALUE);
  const [historyMonth, setHistoryMonth] = useState(ALL_HISTORY_PERIOD_VALUE);
  const [historyComparisonMode, setHistoryComparisonMode] =
    useState<HistoryComparisonMode>("prior_equivalent_period");
  const [restSeconds, setRestSeconds] = useState(0);
  const [restPreset, setRestPreset] = useState(90);
  const [restIsActive, setRestIsActive] = useState(false);
  // Custom exercise creation state
  const [showCreateExerciseDialog, setShowCreateExerciseDialog] =
    useState(false);
  const [createExForm, setCreateExForm] = useState({
    name: "",
    nameZh: "",
    muscleGroup: "chest",
    equipment: "Barbell",
    instructions: "",
  });
  const [aiIdentifyLoading, setAiIdentifyLoading] = useState(false);
  const [aiIdentifyResult, setAiIdentifyResult] = useState<any>(null);
  const createExPhotoRef = useRef<HTMLInputElement>(null);
  const createExAlbumRef = useRef<HTMLInputElement>(null);
  const preparedExercisePhoto = useRef<PreparedReportPhoto | null>(null);
  const photoRequestSequence = useRef(0);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoReady, setPhotoReady] = useState(false);

  const utils = trpc.useUtils();
  // Load the complete owner history. The History tab must not hide older sessions
  // merely because they fall outside a rolling 90-day dashboard window.
  const {
    data: sessions = [],
    isLoading,
    error: sessionsError,
  } = trpc.workout.getSessions.useQuery();
  const { data: sessionDetail } = trpc.workout.getSessionWithSets.useQuery(
    { sessionId: activeSession?.id ?? 0 },
    { enabled: !!activeSession?.id }
  );
  const previousSession = useMemo(() => {
    if (!activeSession?.startTime) return null;
    const anchor = new Date(activeSession.startTime).getTime();
    return (
      [...sessions]
        .filter(
          session =>
            session.id !== activeSession.id &&
            session.endTime &&
            new Date(session.startTime).getTime() < anchor
        )
        .sort(
          (a, b) =>
            new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        )[0] ?? null
    );
  }, [sessions, activeSession?.id, activeSession?.startTime]);
  const { data: previousSessionDetail, isLoading: previousSetsLoading } =
    trpc.workout.getSessionWithSets.useQuery(
      { sessionId: previousSession?.id ?? 0 },
      { enabled: !!previousSession?.id && activeTab === "session" }
    );
  const savedLocations = useMemo(
    () =>
      sessions
        .map((session: any) => session.location)
        .filter((location): location is string => typeof location === "string"),
    [sessions]
  );
  const currentSession = activeSession
    ? {
        ...activeSession,
        ...(sessionDetail?.session?.id === activeSession.id
          ? sessionDetail?.session
          : {}),
      }
    : null;
  const calorieEstimate: WorkoutCalorieEstimate | null =
    currentSession?.calorieEstimate ?? null;
  const [workoutClock, setWorkoutClock] = useState(() => Date.now());
  useEffect(() => {
    if (!currentSession?.id) return;
    const timer = window.setInterval(() => setWorkoutClock(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, [currentSession?.id]);
  const timeDetails = currentSession
    ? getWorkoutTimeDetails(currentSession, new Date(workoutClock))
    : null;
  const finishPreview = useMemo(() => {
    if (!showFinishDialog || !finishForm.duration.trim()) return null;
    const minutes = Number(finishForm.duration);
    const weight = finishForm.bodyWeightKg.trim()
      ? Number(finishForm.bodyWeightKg)
      : calorieEstimate?.bodyWeightKg;
    if (
      !isActualWorkoutMinutes(minutes) ||
      minutes <= 0 ||
      (weight != null &&
        (!Number.isFinite(weight) || weight < 20 || weight > 350))
    )
      return null;
    if (sessionDetail?.session?.id !== currentSession?.id) return null;
    try {
      return calorieEstimateSummary(
        estimateWorkoutCalories({
          sets: sessionDetail?.sets ?? [],
          verifiedDurationMinutes: minutes,
          intensity: finishForm.intensity,
          bodyWeightKg: weight,
          weightSource: finishForm.bodyWeightKg.trim()
            ? "session_override"
            : calorieEstimate?.weightSource,
          manualCalories:
            currentSession?.calorieDetails?.manualCalories ??
            (calorieEstimate?.source === "manual"
              ? currentSession?.caloriesBurned
              : null),
          tolerateInvalid: true,
        })
      );
    } catch {
      return null;
    }
  }, [
    showFinishDialog,
    finishForm,
    sessionDetail,
    currentSession?.id,
    currentSession?.calorieDetails,
    currentSession?.caloriesBurned,
    calorieEstimate,
  ]);
  const historicalSession = Boolean(
    currentSession &&
      getSessionHKDate(currentSession) &&
      getSessionHKDate(currentSession) !== todayHKString()
  );
  const { data: progressionSuggestion } =
    trpc.workout.getProgressionSuggestion.useQuery(
      { exerciseName: selectedExercise?.name ?? "" },
      {
        enabled:
          !!selectedExercise?.name &&
          selectedExercise?.muscleGroup !== "cardio",
      }
    );
  const { data: exercisePRs = {} } = trpc.workout.getExercisePRs.useQuery();
  const { data: prHistory = [] } = trpc.workout.getPRHistory.useQuery();

  const createSession = trpc.workout.createSession.useMutation({
    onSuccess: data => {
      utils.workout.getSessions.invalidate();
      utils.workout.getMuscleAnalysis.invalidate();
      utils.workout.getExerciseHistory.invalidate();
      utils.workout.getExerciseUsage.invalidate();
      const template = WORKOUT_TEMPLATES.find(
        item => item.key === selectedTemplateKey
      );
      setActiveSession({
        id: data.id,
        name: sessionName.trim() || template?.nameZh || "訓練",
        date: selectedDate,
        location: normalizeGymLocation(sessionLocation),
        startTime:
          sessionEntryMode === "manual"
            ? `${selectedDate}T${sessionStartTime}:00+08:00`
            : new Date().toISOString(),
        endTime:
          sessionEntryMode === "manual"
            ? new Date(
                new Date(
                  `${selectedDate}T${sessionStartTime}:00+08:00`
                ).getTime() +
                  Number(manualDuration) * 60000
              ).toISOString()
            : null,
        duration: sessionEntryMode === "manual" ? Number(manualDuration) : null,
        calorieEstimate: data.calorieEstimate,
        templateKey: template?.key,
        plannedExercises: template?.exercises.map(exercise => ({
          ...exercise,
        })),
      });
      setShowSessionDialog(false);
      toast.success(
        sessionEntryMode === "manual"
          ? "已建立補錄課程，請繼續新增實際完成的組數。"
          : template
            ? `已套用「${template.nameZh}」範本`
            : "訓練已開始"
      );
    },
    onError: error => toast.error("建立課程失敗：" + error.message),
  });
  const deleteSession = trpc.workout.deleteSession.useMutation({
    onSuccess: () => {
      utils.workout.getSessions.invalidate();
      utils.workout.getMuscleAnalysis.invalidate();
      utils.workout.getExerciseHistory.invalidate();
      utils.workout.getExerciseUsage.invalidate();
      setActiveSession(null);
      toast.success("Session deleted");
    },
  });
  const addSet = trpc.workout.addSet.useMutation({
    onSuccess: () => {
      utils.workout.getSessionWithSets.invalidate();
      utils.workout.getSessions.invalidate();
      utils.workout.getMuscleAnalysis.invalidate();
      utils.workout.getExerciseHistory.invalidate();
      utils.workout.getExerciseUsage.invalidate();
      setShowAddSetDialog(false);
      toast.success("Set logged!");
    },
  });

  useEffect(() => {
    if (!restIsActive || restSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setRestSeconds(seconds => {
        if (seconds <= 1) {
          window.clearInterval(timer);
          setRestIsActive(false);
          toast.success("休息完成，準備下一組！");
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [restIsActive, restSeconds]);
  const updateSet = trpc.workout.updateSet.useMutation({
    onSuccess: () => {
      utils.workout.getSessionWithSets.invalidate();
      utils.workout.getSessions.invalidate();
      utils.workout.getMuscleAnalysis.invalidate();
      utils.workout.getExerciseHistory.invalidate();
      utils.workout.getExerciseUsage.invalidate();
      setEditSet(null);
      setShowAddSetDialog(false);
      toast.success("Updated!");
    },
    onError: e => toast.error("Update failed: " + e.message),
  });
  const deleteSet = trpc.workout.deleteSet.useMutation({
    onSuccess: () => {
      utils.workout.getSessionWithSets.invalidate();
      utils.workout.getSessions.invalidate();
      utils.workout.getMuscleAnalysis.invalidate();
      utils.workout.getExerciseHistory.invalidate();
      utils.workout.getExerciseUsage.invalidate();
      toast.success("Set deleted");
    },
  });

  // Edit completed session
  const [showEditSessionDialog, setShowEditSessionDialog] = useState(false);
  const [editSessionForm, setEditSessionForm] = useState({
    name: "",
    location: "",
    date: "",
    endDate: "",
    startHH: "08",
    startMM: "00",
    endHH: "09",
    endMM: "00",
    hasEndTime: false,
    duration: "",
    notes: "",
  });
  const editDurationPreview = useMemo(() => {
    if (
      !showEditSessionDialog ||
      !editSessionForm.duration.trim() ||
      sessionDetail?.session?.id !== currentSession?.id
    )
      return null;
    const minutes = Number(editSessionForm.duration);
    if (!isActualWorkoutMinutes(minutes) || minutes <= 0) return null;
    try {
      return calorieEstimateSummary(
        estimateWorkoutCalories({
          sets: sessionDetail?.sets ?? [],
          verifiedDurationMinutes: minutes,
          bodyWeightKg: calorieEstimate?.bodyWeightKg,
          weightSource: calorieEstimate?.weightSource,
          intensity: calorieEstimate?.intensity,
          manualCalories:
            currentSession?.calorieDetails?.manualCalories ??
            (calorieEstimate?.source === "manual"
              ? currentSession?.caloriesBurned
              : null),
          tolerateInvalid: true,
        })
      );
    } catch {
      return null;
    }
  }, [
    showEditSessionDialog,
    editSessionForm.duration,
    sessionDetail,
    currentSession?.id,
    currentSession?.calorieDetails,
    currentSession?.caloriesBurned,
    calorieEstimate,
  ]);
  const initialEditSessionForm = useRef<typeof editSessionForm | null>(null);
  const updateSession = trpc.workout.updateSession.useMutation({
    onSuccess: () => {
      utils.workout.getSessions.invalidate();
      utils.workout.getSessionWithSets.invalidate();
      utils.workout.getMuscleAnalysis.invalidate();
      utils.workout.getExerciseHistory.invalidate();
      utils.workout.getExerciseUsage.invalidate();
      setShowEditSessionDialog(false);
      toast.success("訓練記錄已更新！");
    },
    onError: e => toast.error("更新失敗: " + e.message),
  });

  const handleOpenEditSession = (s: any) => {
    const start = s.startTime ? new Date(s.startTime) : new Date();
    const end = s.endTime
      ? new Date(s.endTime)
      : new Date(start.getTime() + 3600000);
    const toHKH = (d: Date) =>
      String(
        d.getUTCHours() + 8 > 23
          ? d.getUTCHours() + 8 - 24
          : d.getUTCHours() + 8
      ).padStart(2, "0");
    const toHKM = (d: Date) => String(d.getUTCMinutes()).padStart(2, "0");
    const form = {
      name: s.name || "",
      location: s.location || "",
      endDate: s.endTime
        ? toHKDateString(s.endTime)
        : toHKDateString(s.startTime),
      hasEndTime: Boolean(s.endTime),
      duration: reviewedWorkoutDurationInput(s),
      date: s.startTime
        ? new Date(new Date(s.startTime).getTime() + 8 * 3600000)
            .toISOString()
            .slice(0, 10)
        : "",
      startHH: toHKH(start),
      startMM: toHKM(start),
      endHH: toHKH(end),
      endMM: toHKM(end),
      notes: s.notes || "",
    };
    initialEditSessionForm.current = form;
    setEditSessionForm(form);
    setShowEditSessionDialog(true);
  };

  const handleSaveEditSession = () => {
    if (!activeSession) return;
    const dateStr = editSessionForm.date;
    if (!dateStr) return toast.error("請選擇日期");
    const hh = parseInt(editSessionForm.startHH, 10);
    const mm = parseInt(editSessionForm.startMM, 10);
    const eh = parseInt(editSessionForm.endHH, 10);
    const em = parseInt(editSessionForm.endMM, 10);
    if (isNaN(hh) || hh < 0 || hh > 23 || isNaN(mm) || mm < 0 || mm > 59)
      return toast.error("開始時間格式錯誤（HH: 00-23, MM: 00-59）");
    if (
      editSessionForm.hasEndTime &&
      (isNaN(eh) || eh < 0 || eh > 23 || isNaN(em) || em < 0 || em > 59)
    )
      return toast.error("結束時間格式錯誤（HH: 00-23, MM: 00-59）");
    const startISO = `${dateStr}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+08:00`;
    const endISO = `${editSessionForm.endDate || dateStr}T${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}:00+08:00`;
    const original = initialEditSessionForm.current;
    const startChanged =
      !original ||
      editSessionForm.date !== original.date ||
      editSessionForm.startHH !== original.startHH ||
      editSessionForm.startMM !== original.startMM;
    const endChanged =
      !original ||
      editSessionForm.hasEndTime !== original.hasEndTime ||
      editSessionForm.endDate !== original.endDate ||
      editSessionForm.endHH !== original.endHH ||
      editSessionForm.endMM !== original.endMM;
    const durationChanged =
      !original || editSessionForm.duration.trim() !== original.duration.trim();
    if (
      (startChanged || endChanged) &&
      editSessionForm.hasEndTime &&
      new Date(endISO).getTime() <= new Date(startISO).getTime()
    )
      return toast.error("結束時間必須晚於開始時間，跨日課程請核對結束日期");
    const durationMin =
      durationChanged && editSessionForm.duration.trim()
        ? Number(editSessionForm.duration)
        : undefined;
    if (
      durationMin !== undefined &&
      (!Number.isFinite(durationMin) ||
        durationMin <= 0 ||
        durationMin > MAX_WORKOUT_MINUTES)
    )
      return toast.error(`有效時長需介乎 1 至 ${MAX_WORKOUT_MINUTES} 分鐘`);
    const editInput = {
      id: activeSession.id,
      name: editSessionForm.name.trim(),
      location: normalizeGymLocation(editSessionForm.location),
      notes: editSessionForm.notes,
      startTime: startChanged ? startISO : undefined,
      endTime: endChanged && editSessionForm.hasEndTime ? endISO : undefined,
      duration: durationMin,
    };
    updateSession.mutate(editInput, {
      onSuccess: () => {
        // Update local activeSession so header reflects edits immediately
        setActiveSession((prev: any) =>
          prev
            ? {
                ...prev,
                name: editSessionForm.name.trim(),
                location: normalizeGymLocation(editSessionForm.location),
                notes: editSessionForm.notes,
                startTime: editInput.startTime ?? prev.startTime,
                endTime: editInput.endTime ?? prev.endTime,
                duration: durationMin ?? prev.duration,
                date: dateStr,
              }
            : prev
        );
      },
    });
  };

  const [, navigate] = useLocation();
  const [finishLoading, setFinishLoading] = useState(false);
  const finishSession = trpc.workout.finishSession.useMutation({
    onSuccess: data => {
      utils.workout.getSessions.invalidate();
      utils.workout.getMuscleAnalysis.invalidate();
      utils.workout.getExerciseHistory.invalidate();
      utils.workout.getExerciseUsage.invalidate();
      setFinishLoading(false);
      setShowFinishDialog(false);
      utils.workout.getSessionWithSets.invalidate();
      // Store workout summary for dashboard modal
      sessionStorage.setItem(
        "workoutSummary",
        JSON.stringify({
          name: activeSession?.name || "訓練",
          duration: data.duration,
          caloriesBurned: data.caloriesBurned,
          totalVolume: data.totalVolume,
          exerciseCount: data.exerciseCount,
          calorieEstimate: data.calorieEstimate,
        })
      );
      setActiveSession(null);
      navigate("/");
    },
    onError: e => {
      setFinishLoading(false);
      toast.error("錯誤: " + e.message);
    },
  });

  const [showAiAnalysis, setShowAiAnalysis] = useState(false);
  const [aiAnalysisExercise, setAiAnalysisExercise] = useState<string | null>(
    null
  );
  const [aiAnalysisResult, setAiAnalysisResult] = useState<{
    analysis: string;
    recommendations: Array<{ title: string; detail: string; type: string }>;
  } | null>(null);
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const aiAnalysisTarget = useRef<string | null>(null);
  useEffect(() => {
    aiAnalysisTarget.current = showAiAnalysis ? aiAnalysisExercise : null;
    return () => {
      aiAnalysisTarget.current = null;
    };
  }, [showAiAnalysis, aiAnalysisExercise]);
  const analyzeExercise = trpc.workout.analyzeExercise.useMutation({
    onSuccess: (data, input) => {
      if (aiAnalysisTarget.current !== input.exerciseName) return;
      setAiAnalysisResult(data);
      setAiAnalysisLoading(false);
    },
    onError: (e, input) => {
      if (aiAnalysisTarget.current !== input.exerciseName) return;
      toast.error("AI 分析失敗: " + e.message);
      setAiAnalysisLoading(false);
    },
  });

  const { data: favourites = [] } = trpc.workout.getFavourites.useQuery();
  const favouriteSet = useMemo(
    () => new Set(favourites as string[]),
    [favourites]
  );

  const toggleFavourite = trpc.workout.toggleFavourite.useMutation({
    onSuccess: () => {
      utils.workout.getFavourites.invalidate();
    },
    onError: e => toast.error("錯誤: " + e.message),
  });

  // Fetch custom exercises
  const { data: customExercisesData = [] } =
    trpc.workout.getCustomExercises.useQuery();
  const { data: exerciseUsage = [] } = trpc.workout.getExerciseUsage.useQuery();
  const createCustomExercise = trpc.workout.createCustomExercise.useMutation({
    onSuccess: () => {
      utils.workout.getCustomExercises.invalidate();
      setShowCreateExerciseDialog(false);
      setCreateExForm({
        name: "",
        nameZh: "",
        muscleGroup: "chest",
        equipment: "Barbell",
        instructions: "",
      });
      setAiIdentifyResult(null);
      toast.success("自訂動作已新增！");
    },
  });
  const deleteCustomExercise = trpc.workout.deleteCustomExercise.useMutation({
    onSuccess: () => {
      utils.workout.getCustomExercises.invalidate();
      toast.success("已刪除");
    },
  });
  const identifyExerciseFromPhoto =
    trpc.workout.identifyExerciseFromPhoto.useMutation();

  useEffect(() => {
    if (showCreateExerciseDialog) return;
    photoRequestSequence.current += 1;
    preparedExercisePhoto.current = null;
    setPhotoReady(false);
    setPhotoError(null);
    setAiIdentifyLoading(false);
    setAiIdentifyResult(null);
  }, [showCreateExerciseDialog]);

  const allExercises = useMemo(() => {
    const custom = (customExercisesData as any[]).map(c => ({
      ...c,
      isCustom: true,
    }));
    // Exact builtin/guide choices already present need no second UI source.
    // A shared guide/animation family alone is NOT evidence of equivalent apparatus.
    const originalMachines = EXERCISE_GUIDES.filter(
      motion =>
        !BUILT_IN_EXERCISES.some(
          exercise =>
            exercise.name === motion.name && exercise.equipment === "Machine"
        )
    ).map(motion => ({
      name: motion.name,
      nameZh: motion.nameZh,
      muscleGroup: motion.primary[0] || "",
      equipment: "Machine",
      instructions: motion.movement.join(" "),
    }));
    return buildUnifiedExerciseCatalog(
      [...BUILT_IN_EXERCISES, ...originalMachines, ...custom],
      exerciseUsage
    );
  }, [customExercisesData, exerciseUsage]);

  const openExerciseDetails = (exercise: any) => {
    setDetailExercise(exercise);
    setShowExerciseDetail(true);
  };

  const existingCustomChoice = allExercises.find(exercise => {
    const names = [
      exercise.name,
      ...(exercise.aliases ?? []),
      ...getExerciseHistoryNames(exercise.name),
    ];
    const sameName = names.some(
      name =>
        normalizeExerciseName(name) === normalizeExerciseName(createExForm.name)
    );
    const apparatus = [
      exercise.equipment,
      ...(exercise.equipmentAliases ?? []),
    ];
    return (
      sameName &&
      apparatus.some(
        value =>
          value?.trim().toLowerCase() ===
          createExForm.equipment.trim().toLowerCase()
      )
    );
  });

  const plannedExercises = useMemo(() => {
    const raw = activeSession?.plannedExercises;
    if (Array.isArray(raw))
      return raw as Array<{
        name: string;
        nameZh?: string;
        targetSets: number;
        targetReps: string;
        equipment?: string;
      }>;
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }, [activeSession]);

  const openPlannedExercise = (planned: {
    name: string;
    targetReps: string;
    equipment?: string;
  }) => {
    const exercise = allExercises.find(item => item.name === planned.name) ?? {
      name: planned.name,
      muscleGroup: "chest",
      equipment: planned.equipment ?? "Machine",
    };
    const reps = Number.parseInt(planned.targetReps, 10) || 10;
    setSelectedExercise(exercise);
    setSetForm({
      reps,
      weight: 0,
      duration: 0,
      distance: 0,
      avgHr: 0,
      calories: 0,
      notes: "",
    });
    setEditSet(null);
    setShowAddSetDialog(true);
  };

  const filteredExercises = useMemo(() => {
    return allExercises.filter(e => {
      const isCardioEx = e.muscleGroup === "cardio";
      const matchSearch =
        !searchQuery ||
        `${e.name} ${(e as any).nameZh || ""} ${e.equipment} ${(e.aliases ?? []).join(" ")} ${(e.equipmentAliases ?? []).join(" ")}`
          .toLowerCase()
          .includes(searchQuery.trim().toLowerCase());
      const matchEquip =
        selectedEquipment === "all" ||
        e.equipment === selectedEquipment ||
        e.equipmentAliases?.includes(selectedEquipment);
      if (exerciseLibMode === "cardio")
        return isCardioEx && matchSearch && matchEquip;
      const matchMuscle = !selectedMuscle || e.muscleGroup === selectedMuscle;
      return !isCardioEx && matchMuscle && matchEquip && matchSearch;
    });
  }, [
    allExercises,
    selectedMuscle,
    selectedEquipment,
    searchQuery,
    exerciseLibMode,
  ]);

  const equipmentOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...EQUIPMENT_LIST,
          ...allExercises
            .flatMap(exercise => [
              exercise.equipment,
              ...(exercise.equipmentAliases ?? []),
            ])
            .filter(Boolean),
        ])
      ).sort(),
    [allExercises]
  );

  // Auto-restore today's latest unfinished session from sessions list
  useEffect(() => {
    if (sessions.length > 0 && !activeSession) {
      const todayStr = todayHKString();
      const todaySessions = sessions.filter(
        (s: any) =>
          !s.endTime && toHKDateString(new Date(s.startTime)) === todayStr
      );
      if (todaySessions.length > 0) {
        const latest = todaySessions.sort(
          (a: any, b: any) =>
            new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        )[0];
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
      const ex = allExercises.find(
        e =>
          e.name === s.exerciseName ||
          (e as any).nameZh === s.exerciseName ||
          e.name.toLowerCase() === (s.exerciseName ?? "").toLowerCase()
      );
      if (ex) {
        muscles.add(ex.muscleGroup);
      } else {
        // Fallback: if exerciseName itself is a valid muscle group id, use it directly
        const validMuscles = [
          "chest",
          "back",
          "lats",
          "shoulders",
          "biceps",
          "triceps",
          "quads",
          "hamstrings",
          "glutes",
          "calves",
          "core",
          "abs",
          "cardio",
        ];
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
      const exName = s.exerciseName || "Unknown";
      map[exName] = (map[exName] || 0) + vol;
    });
    return Object.entries(map).map(([name, vol]) => ({
      name: name.split(" ").slice(0, 2).join(" "),
      vol: Math.round(vol),
    }));
  }, [sessionDetail]);

  // Live and saved estimates both come from sessionDetail.session.calorieEstimate.
  // Never infer active energy from training volume, a fixed bodyweight, or page wall-clock time.

  const weeklyVolume = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = toHKDateString(new Date(Date.now() - (6 - i) * 86400000));
      const daySessions = sessions.filter(
        s => toHKDateString(new Date(s.startTime)) === d
      );
      return {
        date: new Date(Date.now() - (6 - i) * 86400000).toLocaleDateString(
          "en-US",
          { weekday: "short", timeZone: "Asia/Hong_Kong" }
        ),
        volume: Math.round(
          daySessions.reduce((s, sess) => s + (sess.totalVolume || 0), 0)
        ),
      };
    });
  }, [sessions]);

  const historyPeriod = useMemo<HistoryPeriod>(
    () => ({ year: historyYear, month: historyMonth }),
    [historyYear, historyMonth]
  );
  const historyYearOptions = useMemo(
    () =>
      Array.from(
        new Set(
          sessions
            .map((session: any) => getSessionHKDate(session).slice(0, 4))
            .filter((year: string) => /^\d{4}$/.test(year))
        )
      ).sort((a, b) => Number(b) - Number(a)),
    [sessions]
  );
  const comparisonPeriod = useMemo(
    () => getComparisonPeriod(historyPeriod, historyComparisonMode),
    [historyPeriod, historyComparisonMode]
  );
  const sessionMatchesSearch = (session: any) =>
    !sessionSearch.trim() ||
    `${session.name || ""} ${session.location || ""}`
      .toLowerCase()
      .includes(sessionSearch.trim().toLowerCase());
  const selectedHistorySessions = useMemo(
    () =>
      sessions.filter(
        (session: any) =>
          matchesHistoryPeriod(session, historyPeriod) &&
          sessionMatchesSearch(session)
      ),
    [sessions, historyPeriod, sessionSearch]
  );
  const comparisonHistorySessions = useMemo(
    () =>
      comparisonPeriod
        ? sessions.filter(
            (session: any) =>
              matchesHistoryPeriod(session, comparisonPeriod) &&
              sessionMatchesSearch(session)
          )
        : [],
    [sessions, comparisonPeriod, sessionSearch]
  );
  const selectedHistorySummary = useMemo(
    () => summariseHistorySessions(selectedHistorySessions),
    [selectedHistorySessions]
  );
  const comparisonHistorySummary = useMemo(
    () =>
      comparisonPeriod
        ? summariseHistorySessions(comparisonHistorySessions)
        : null,
    [comparisonPeriod, comparisonHistorySessions]
  );
  const sortedHistorySessions = useMemo(() => {
    const sorted = [...selectedHistorySessions];
    switch (sessionSort) {
      case "date_asc":
        sorted.sort(
          (a: any, b: any) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );
        break;
      case "date_desc":
        sorted.sort(
          (a: any, b: any) =>
            new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        );
        break;
      case "volume_desc":
        sorted.sort(
          (a: any, b: any) =>
            Number(b.totalVolume || 0) - Number(a.totalVolume || 0)
        );
        break;
      case "duration_desc":
        sorted.sort(
          (a: any, b: any) => Number(b.duration || 0) - Number(a.duration || 0)
        );
        break;
    }
    return sorted;
  }, [selectedHistorySessions, sessionSort]);

  const selectedDaySessions = useMemo(
    () =>
      sessions.filter(
        (session: any) =>
          toHKDateString(new Date(session.startTime)) === selectedDate
      ),
    [sessions, selectedDate]
  );
  const selectedDayVolume = selectedDaySessions.reduce(
    (sum: number, session: any) => sum + (Number(session.totalVolume) || 0),
    0
  );
  const selectedDayCalories = selectedDaySessions.reduce(
    (sum: number, session: any) => sum + (Number(session.caloriesBurned) || 0),
    0
  );

  const handleStartSession = () => {
    const template = WORKOUT_TEMPLATES.find(
      item => item.key === selectedTemplateKey
    );
    const name = sessionName.trim() || template?.nameZh;
    if (!isOwner) return;
    if (!name) return toast.error("請輸入課程名稱或選擇訓練範本");
    if (!selectedDate) return toast.error("請選擇訓練日期");
    if (sessionEntryMode === "live" && selectedDate !== todayHKString())
      return toast.error("歷史日期請選擇補錄模式，並填寫時間。");
    const effectiveDuration = Number(manualDuration);
    if (
      sessionEntryMode === "manual" &&
      (!Number.isFinite(effectiveDuration) ||
        effectiveDuration <= 0 ||
        effectiveDuration > MAX_WORKOUT_MINUTES ||
        !/^\d{2}:\d{2}$/.test(sessionStartTime))
    )
      return toast.error(
        `請填寫開始時間及 1 至 ${MAX_WORKOUT_MINUTES} 分鐘的有效時長`
      );
    const startTime =
      sessionEntryMode === "manual"
        ? `${selectedDate}T${sessionStartTime}:00+08:00`
        : new Date().toISOString();
    const createInput = {
      date: selectedDate,
      location: normalizeGymLocation(sessionLocation),
      startTime,
      endTime:
        sessionEntryMode === "manual"
          ? new Date(
              new Date(startTime).getTime() + effectiveDuration * 60000
            ).toISOString()
          : undefined,
      duration: sessionEntryMode === "manual" ? effectiveDuration : undefined,
      name,
      templateKey: template?.key,
      plannedExercises: template?.exercises.map(exercise => ({ ...exercise })),
    };
    createSession.mutate(createInput);
  };

  const handleAddSet = () => {
    if (!selectedExercise || !activeSession || !isOwner) return;
    if (selectedExercise.muscleGroup === "cardio") {
      if (
        !Number.isFinite(setForm.duration) ||
        setForm.duration <= 0 ||
        setForm.duration > MAX_WORKOUT_MINUTES
      )
        return toast.error(`有氧時間需介乎 1 至 ${MAX_WORKOUT_MINUTES} 分鐘`);
      if (
        [setForm.distance, setForm.avgHr, setForm.calories].some(
          value => !Number.isFinite(value) || value < 0
        )
      )
        return toast.error("請填寫有效的距離、心率及器材熱量數值");
    } else if (
      !Number.isInteger(setForm.reps) ||
      setForm.reps <= 0 ||
      !Number.isFinite(setForm.weight) ||
      setForm.weight < 0
    )
      return toast.error("請填寫有效次數及重量（自重可為 0 kg）");
    const setNum =
      (sessionDetail?.sets.filter(s => s.exerciseName === selectedExercise.name)
        .length || 0) + 1;
    const isCardio = selectedExercise?.muscleGroup === "cardio";
    // Always store weight in kg; convert from lbs if needed
    const weightKg =
      weightUnit === "lbs"
        ? parseFloat((setForm.weight / 2.20462).toFixed(2))
        : setForm.weight;
    if (editSet) {
      updateSet.mutate(
        isCardio
          ? {
              id: editSet.id,
              duration: setForm.duration || undefined,
              distance: setForm.distance || undefined,
              avgHr: setForm.avgHr || undefined,
              calories: setForm.calories || undefined,
              notes: setForm.notes || undefined,
            }
          : {
              id: editSet.id,
              reps: setForm.reps,
              weight: weightKg,
              notes: setForm.notes,
            }
      );
    } else {
      addSet.mutate(
        isCardio
          ? {
              sessionId: activeSession.id,
              exerciseName: selectedExercise.name,
              setNumber: setNum,
              duration: setForm.duration || undefined,
              distance: setForm.distance || undefined,
              avgHr: setForm.avgHr || undefined,
              calories: setForm.calories || undefined,
              notes: setForm.notes,
            }
          : {
              sessionId: activeSession.id,
              exerciseName: selectedExercise.name,
              setNumber: setNum,
              reps: setForm.reps,
              weight: weightKg,
              notes: setForm.notes,
            },
        {
          onSuccess: () => {
            if (!isCardio) {
              setRestSeconds(restPreset);
              setRestIsActive(true);
            }
          },
        }
      );
    }
  };

  const exerciseGroups = useMemo(() => {
    if (!sessionDetail?.sets) return {};
    const groups: Record<string, typeof sessionDetail.sets> = {};
    sessionDetail.sets.forEach(s => {
      const exName = s.exerciseName || "Unknown";
      if (!groups[exName]) groups[exName] = [];
      groups[exName].push(s);
    });
    return groups;
  }, [sessionDetail]);

  const lastLoggedSet = useMemo(() => {
    const sets = sessionDetail?.sets ?? [];
    return sets.length > 0
      ? [...sets].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
            b.id - a.id
        )[0]
      : null;
  }, [sessionDetail]);

  const openNextSet = () => {
    if (!lastLoggedSet) return;
    const exercise = allExercises.find(
      item =>
        item.name === lastLoggedSet.exerciseName ||
        (item as any).nameZh === lastLoggedSet.exerciseName
    ) ?? {
      name: lastLoggedSet.exerciseName,
      muscleGroup: "chest",
      equipment: "Machine",
    };
    const isCardio = exercise.muscleGroup === "cardio";
    setSelectedExercise(exercise);
    setSetForm(
      isCardio
        ? {
            reps: 0,
            weight: 0,
            duration: lastLoggedSet.duration || 0,
            distance: lastLoggedSet.distance || 0,
            avgHr: (lastLoggedSet as any).avgHr || 0,
            calories: (lastLoggedSet as any).calories || 0,
            notes: "",
          }
        : {
            reps: lastLoggedSet.reps || 10,
            weight:
              weightUnit === "lbs"
                ? Number(((lastLoggedSet.weight || 0) * 2.20462).toFixed(2))
                : lastLoggedSet.weight || 0,
            duration: 0,
            distance: 0,
            avgHr: 0,
            calories: 0,
            notes: "",
          }
    );
    setEditSet(null);
    setShowAddSetDialog(true);
  };

  const handleAiPhotoIdentify = async (file?: File) => {
    const sequence = ++photoRequestSequence.current;
    setAiIdentifyLoading(true);
    setPhotoError(null);
    setAiIdentifyResult(null);
    if (file) {
      preparedExercisePhoto.current = null;
      setPhotoReady(false);
    }
    try {
      const photo = file
        ? await prepareReportPhoto(file)
        : preparedExercisePhoto.current;
      if (sequence !== photoRequestSequence.current) return;
      if (!photo) throw new Error("請先選取器材或動作相片");
      preparedExercisePhoto.current = photo;
      setPhotoReady(true);
      const result = await identifyExerciseFromPhoto.mutateAsync({
        base64: photo.base64,
        mimeType: photo.mimeType,
      });
      if (sequence !== photoRequestSequence.current) return;
      setAiIdentifyResult(result);
    } catch (error) {
      if (sequence === photoRequestSequence.current)
        setPhotoError(
          error instanceof Error ? error.message : "未能辨識，請重試。"
        );
    } finally {
      if (sequence === photoRequestSequence.current)
        setAiIdentifyLoading(false);
    }
  };

  const applyIdentifiedExercise = () => {
    if (!aiIdentifyResult) return;
    setCreateExForm(form => ({
      ...form,
      name: aiIdentifyResult.name || form.name,
      nameZh: aiIdentifyResult.nameZh || form.nameZh,
      muscleGroup: MUSCLE_GROUPS.some(
        item => item.id === aiIdentifyResult.muscleGroup
      )
        ? aiIdentifyResult.muscleGroup
        : form.muscleGroup,
      equipment: equipmentOptions.includes(aiIdentifyResult.equipment)
        ? aiIdentifyResult.equipment
        : form.equipment,
      instructions: aiIdentifyResult.instructions || form.instructions,
    }));
    toast.success("已填入草稿；請核對欄位後再儲存。");
  };

  const openFinishSession = () => {
    setFinishForm({
      duration: reviewedWorkoutDurationInput(currentSession),
      intensity: (["light", "moderate", "vigorous"].includes(
        calorieEstimate?.intensity || ""
      )
        ? calorieEstimate?.intensity
        : "moderate") as "light" | "moderate" | "vigorous",
      bodyWeightKg: "",
    });
    setShowFinishDialog(true);
  };

  const handleFinishSession = () => {
    if (
      !isOwner ||
      !currentSession ||
      currentSession.endTime ||
      historicalSession
    )
      return;
    if (!finishForm.duration.trim())
      return toast.error("實際課程時長尚未核對，請輸入分鐘後再確認儲存。");
    const duration = Number(finishForm.duration);
    const bodyWeightKg = finishForm.bodyWeightKg.trim()
      ? Number(finishForm.bodyWeightKg)
      : undefined;
    if (
      !Number.isFinite(duration) ||
      duration <= 0 ||
      duration > MAX_WORKOUT_MINUTES
    )
      return toast.error(
        `請填寫 1 至 ${MAX_WORKOUT_MINUTES} 分鐘的實際課程時長`
      );
    if (
      bodyWeightKg !== undefined &&
      (!Number.isFinite(bodyWeightKg) ||
        bodyWeightKg < 20 ||
        bodyWeightKg > 350)
    )
      return toast.error("修正體重需介乎 20 至 350 kg");
    setFinishLoading(true);
    const finishInput = {
      id: currentSession.id,
      duration,
      intensity: finishForm.intensity,
      bodyWeightKg,
    };
    finishSession.mutate(finishInput);
  };

  const handleCreateCustomExercise = () => {
    if (!isOwner) return;
    if (!createExForm.name.trim()) return toast.error("請輸入動作名稱");
    if (aiIdentifyLoading) return;
    if (existingCustomChoice) {
      setShowCreateExerciseDialog(false);
      openExerciseDetails(existingCustomChoice);
      toast.success("已找到相同動作，請沿用現有選項；原有紀錄保留不變。");
      return;
    }
    createCustomExercise.mutate({
      ...createExForm,
      name: createExForm.name.trim(),
      nameZh: createExForm.nameZh.trim(),
    });
  };

  return (
    <div className="workout-studio min-w-0 p-3 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <WorkoutStudioStyles />
      <WorkoutStudioHeader
        title={`${t("workout.title")} · v${APP_VERSION}`}
        subtitle={
          isZh
            ? "清楚記錄每一組，讓訓練有跡可循。"
            : "A clear space to log every set and follow your progress."
        }
        status={
          currentSession
            ? currentSession.endTime
              ? isZh
                ? "已完成訓練"
                : "Completed workout"
              : historicalSession
                ? isZh
                  ? "歷史補錄課程"
                  : "Historical session"
                : isZh
                  ? "訓練進行中"
                  : "Workout in progress"
            : isZh
              ? "準備開始"
              : "Ready to train"
        }
        workoutTime={
          timeDetails?.actualMinutes != null
            ? `${timeDetails.actualMinutes} ${isZh ? "分鐘" : "min"}`
            : timeDetails?.elapsedMinutes != null
              ? `${Math.floor(timeDetails.elapsedMinutes)} ${isZh ? "分鐘" : "min"}`
              : "—"
        }
        timeNote={
          !currentSession
            ? isZh
              ? "尚未開始訓練 · 準備好就記錄第一組。"
              : "No workout started yet · log your first set when ready."
            : timeDetails?.actualMinutes != null
              ? isZh
                ? "實際課程時長 · 請保留核對原始時間"
                : "Actual session duration · review original time"
              : timeDetails?.elapsedMinutes != null
                ? isZh
                  ? "經過時間，可能含閒置；結束前須核對實際時長。"
                  : "Elapsed time may include idle time; review before finishing."
                : isZh
                  ? "實際課程時長未知，需核對；不以模型時間代替。"
                  : "Actual duration unknown; model time is not session time."
        }
        volume={
          currentSession && sessionDetail?.session?.id !== currentSession.id
            ? "—"
            : Math.round(
                currentSession
                  ? (sessionDetail?.sets ?? []).reduce(
                      (sum, set) => sum + (set.weight ?? 0) * (set.reps ?? 0),
                      0
                    )
                  : selectedDayVolume
              ).toLocaleString()
        }
        energy={
          currentSession
            ? formatActiveEnergyRange(calorieEstimate)
            : selectedDayCalories > 0
              ? `≈ ${Math.round(selectedDayCalories)}`
              : "—"
        }
        sets={
          currentSession && sessionDetail?.session?.id === currentSession.id
            ? (sessionDetail?.sets.length ?? null)
            : null
        }
        onFinish={
          isOwner &&
          currentSession &&
          !currentSession.endTime &&
          !historicalSession
            ? openFinishSession
            : undefined
        }
        finishing={finishLoading}
        actions={
          <>
            <Input
              aria-label="選擇訓練日期（香港時間）"
              type="date"
              value={selectedDate}
              onChange={event => setSelectedDate(event.target.value)}
              className="h-11 w-36 rounded-xl border-border bg-card text-sm text-foreground"
            />
            {!activeSession ? (
              <Button
                onClick={() => {
                  setSessionEntryMode(
                    selectedDate === todayHKString() ? "live" : "manual"
                  );
                  setShowSessionDialog(true);
                }}
                className="h-11 gap-1.5 rounded-xl"
              >
                <Plus className="h-4 w-4" />
                {t("workout.start_workout")}
              </Button>
            ) : isOwner ? (
              <Button
                variant="outline"
                className="h-11 gap-1 rounded-xl text-xs"
                onClick={() => {
                  setSessionEntryMode(
                    selectedDate === todayHKString() ? "live" : "manual"
                  );
                  setShowSessionDialog(true);
                }}
              >
                <Plus className="h-4 w-4" />
                {isZh ? "新增課程" : "New session"}
              </Button>
            ) : null}
          </>
        }
      />

      {isLoading && (
        <p
          role="status"
          className="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          正在載入訓練記錄…
        </p>
      )}
      {sessionsError && (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive"
        >
          未能載入訓練記錄：{sessionsError.message}
          <Button
            variant="outline"
            className="ml-2 h-9 text-xs"
            onClick={() => utils.workout.getSessions.invalidate()}
          >
            重試載入
          </Button>
        </p>
      )}

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
        <TabsList className="studio-nav">
          <TabsTrigger value="session">
            {t("workout.active_session")}
            {activeSession && (
              <span className="ml-1.5 w-2 h-2 rounded-full bg-green-400 inline-block" />
            )}
          </TabsTrigger>
          <TabsTrigger value="exercises">
            {t("workout.exercise_library")}
          </TabsTrigger>
          <TabsTrigger value="history">{t("workout.history")}</TabsTrigger>
          <TabsTrigger value="pr" className="gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            {isZh ? "個人最佳" : "Personal records"}
          </TabsTrigger>
          <TabsTrigger value="muscles" className="col-span-2 gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            {isZh ? "肌群分析" : "Muscle analytics"}
          </TabsTrigger>
          <TabsTrigger value="gyms" className="col-span-2 gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {isZh ? "健身室與器械" : "Gyms & equipment"}
          </TabsTrigger>
        </TabsList>

        {/* Active Session Tab */}
        <TabsContent value="session" className="mt-4">
          <div className="studio-session-layout">
            {/* Muscle Map */}
            <div className="studio-muscle-aside bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-3 text-sm">
                {t("workout.muscle_groups")}
              </h3>
              <MuscleMap
                activeMuscles={activeMuscles}
                selectedMuscle={selectedMuscle}
                onSelect={m =>
                  setSelectedMuscle(prev => (prev === m ? null : m))
                }
              />
              {activeMuscles.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {activeMuscles.map(m => (
                    <Badge
                      key={m}
                      variant="secondary"
                      className="text-xs capitalize"
                    >
                      {studioMuscleLabel(m, isZh)}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Session Log */}
            <div className="studio-session-log space-y-3">
              {!activeSession ? (
                <div className="bg-card border border-border rounded-2xl p-8 text-center">
                  <Dumbbell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">
                    No active session.{" "}
                    {isOwner
                      ? "Start a workout to begin logging."
                      : "No workout session today."}
                  </p>
                  {isOwner && (
                    <Button
                      className="mt-4 gap-2"
                      onClick={() => setShowSessionDialog(true)}
                    >
                      <Plus className="w-4 h-4" /> Start Workout
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card border border-border rounded-2xl px-4 py-4">
                    <div>
                      <p className="break-words font-semibold text-foreground">
                        {currentSession.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground">
                          {getSessionHKDate(currentSession) ||
                            activeSession.date}{" "}
                          · 香港時間
                        </p>
                      </div>
                      <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                        <MapPin
                          aria-hidden="true"
                          className="mt-0.5 h-3 w-3 shrink-0"
                        />
                        <span className="break-words">
                          {currentSession.location || "未設定訓練地點"}
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      {currentSession.endTime || historicalSession ? (
                        // Completed session - edit + add exercise + badge
                        <>
                          {isOwner && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-xs"
                              onClick={() => {
                                setSearchQuery("");
                                setShowExerciseDialog(true);
                              }}
                            >
                              <Plus className="w-3.5 h-3.5" /> 補錄動作
                            </Button>
                          )}
                          {isOwner && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-xs"
                              onClick={() =>
                                handleOpenEditSession(currentSession)
                              }
                            >
                              <Edit2 className="w-3.5 h-3.5" /> 修改
                            </Button>
                          )}
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/15 text-green-500 border border-green-500/30">
                            <Check className="w-3 h-3" />{" "}
                            {currentSession.endTime ? "已完成" : "歷史補錄"}
                          </span>
                        </>
                      ) : (
                        // Active session - show edit controls
                        <>
                          {isOwner && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2"
                              onClick={() => {
                                setSearchQuery("");
                                setExerciseLibMode("strength");
                                setShowExerciseDialog(true);
                              }}
                            >
                              <Plus className="w-3.5 h-3.5" /> Add Exercise
                            </Button>
                          )}
                          {isOwner && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-xs"
                              onClick={() =>
                                handleOpenEditSession(currentSession)
                              }
                            >
                              <Edit2 className="w-3.5 h-3.5" /> 地點／時長
                            </Button>
                          )}
                        </>
                      )}
                      {isOwner && (
                        <Button
                          size="sm"
                          variant="destructive"
                          aria-label="刪除訓練課程"
                          onClick={() => {
                            if (
                              window.confirm(
                                "刪除此課程及所有組數？此操作不能復原。"
                              )
                            )
                              deleteSession.mutate({ id: activeSession.id });
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <details
                    aria-label="實際課程時間"
                    className="rounded-xl border border-border/60 bg-card px-4 py-2 text-xs leading-5"
                  >
                    <summary className="flex min-h-11 cursor-pointer items-center font-medium text-muted-foreground">
                      {isZh ? "課程時間核對" : "Review session timing"}
                    </summary>
                    <p>
                      實際課程時長：
                      {timeDetails?.actualMinutes == null
                        ? "未知，需核對"
                        : `${timeDetails.actualMinutes} 分鐘`}
                      {timeDetails?.source === "reviewed"
                        ? " · 已手動核對"
                        : timeDetails?.source === "original"
                          ? " · 原始值，未核對"
                          : ""}
                    </p>
                    {timeDetails?.elapsedMinutes != null && (
                      <p>
                        本次即時課程已經過{" "}
                        {Math.floor(timeDetails.elapsedMinutes)}{" "}
                        分鐘（牆鐘時間，可能包含閒置；不會自動計入熱量）。
                      </p>
                    )}
                    <p className="text-muted-foreground">
                      課程時長與下方熱量模型有效分鐘不同。舊紀錄時間可能只是日期標記，不代表真實開始／結束時間。
                    </p>
                  </details>
                  <WorkoutEnergyPanel estimate={calorieEstimate} />
                  {historicalSession && !currentSession.endTime && (
                    <p className="rounded-xl bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
                      這是未有結束時間的歷史課程。請用「修改」補充實際時間及有效時長，不會以現在時間強制結束。
                    </p>
                  )}

                  {plannedExercises.length > 0 && (
                    <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/5 via-card to-violet-500/5 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <ListChecks className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="text-sm font-bold text-foreground">
                              本次訓練計劃
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {activeSession.templateKey
                                ? "已套用範本；完成組數會獨立記錄。"
                                : "預先規劃的動作順序"}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[11px]">
                          {plannedExercises.length} 個動作
                        </Badge>
                      </div>
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {plannedExercises.map(planned => {
                          const completed = (sessionDetail?.sets ?? []).filter(
                            set => set.exerciseName === planned.name
                          ).length;
                          const complete = completed >= planned.targetSets;
                          return (
                            <button
                              key={planned.name}
                              type="button"
                              onClick={() =>
                                isOwner &&
                                !currentSession?.endTime &&
                                openPlannedExercise(planned)
                              }
                              disabled={!isOwner || !!currentSession?.endTime}
                              className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${complete ? "border-emerald-400/25 bg-emerald-400/10" : "border-border bg-card/80 hover:border-primary/35 hover:bg-primary/5"}`}
                            >
                              <div className="min-w-0">
                                <p className="truncate text-xs font-bold text-foreground">
                                  {planned.nameZh || planned.name}
                                </p>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                  {planned.targetSets} 組 × {planned.targetReps}
                                  {planned.equipment
                                    ? ` · ${planned.equipment}`
                                    : ""}
                                </p>
                              </div>
                              <span
                                className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${complete ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}
                              >
                                {completed}/{planned.targetSets}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {Object.keys(exerciseGroups).length === 0 ? (
                    <div className="bg-card border border-border rounded-2xl p-6 text-center">
                      <p className="text-muted-foreground text-sm">
                        No exercises logged yet. Add an exercise to start.
                      </p>
                    </div>
                  ) : (
                    Object.entries(exerciseGroups).map(
                      ([exerciseName, sets]) => {
                        const ex =
                          allExercises.find(
                            e =>
                              e.name === exerciseName ||
                              (e as any).nameZh === exerciseName ||
                              getCanonicalExerciseName(e.name) ===
                                getCanonicalExerciseName(exerciseName)
                          ) ||
                          BUILT_IN_EXERCISES.find(
                            e =>
                              e.name === exerciseName ||
                              e.nameZh === exerciseName
                          );
                        const totalVol = sets.reduce(
                          (sum, s) =>
                            sum + Math.round((s.reps || 0) * (s.weight || 0)),
                          0
                        );
                        return (
                          <div
                            key={exerciseName}
                            className="studio-exercise-card bg-card border border-border/70 rounded-2xl overflow-hidden"
                          >
                            <div className="flex flex-col gap-3 border-b border-border px-3 py-4 sm:px-5">
                              <WorkoutStudioExerciseHeading
                                exercise={{
                                  ...ex,
                                  name: exerciseName,
                                  muscleGroup: ex?.muscleGroup ?? "",
                                  equipment: ex?.equipment ?? "",
                                }}
                                active={
                                  lastLoggedSet?.exerciseName === exerciseName
                                }
                                onOpen={() => {
                                  setDetailExercise({
                                    ...ex,
                                    name: exerciseName,
                                    muscleGroup: ex?.muscleGroup ?? "",
                                    equipment: ex?.equipment ?? "",
                                  });
                                  setShowExerciseDetail(true);
                                }}
                              />
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs text-muted-foreground">
                                  {isZh ? "本次訓練量" : "Session volume"}:{" "}
                                  <strong className="text-blue-600">
                                    {totalVol.toLocaleString()} kg
                                  </strong>
                                </p>
                                <div className="flex gap-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="gap-1.5 text-xs"
                                    aria-label={`查看訓練紀錄 ${exerciseName}`}
                                    onClick={() =>
                                      openExerciseDetails({
                                        ...ex,
                                        name: exerciseName,
                                        muscleGroup: ex?.muscleGroup ?? "",
                                        equipment: ex?.equipment ?? "",
                                      })
                                    }
                                  >
                                    <History className="h-4 w-4" />
                                    {isZh ? "紀錄" : "History"}
                                  </Button>
                                  {isOwner && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="gap-1 text-xs"
                                      onClick={() => {
                                        const isCardio =
                                          (ex?.muscleGroup || "") === "cardio";
                                        setSelectedExercise(
                                          ex || { name: exerciseName }
                                        );
                                        setSetForm(
                                          isCardio
                                            ? {
                                                reps: 0,
                                                weight: 0,
                                                duration:
                                                  sets[sets.length - 1]
                                                    ?.duration || 0,
                                                distance:
                                                  sets[sets.length - 1]
                                                    ?.distance || 0,
                                                avgHr:
                                                  sets[sets.length - 1]
                                                    ?.avgHr || 0,
                                                calories:
                                                  sets[sets.length - 1]
                                                    ?.calories || 0,
                                                notes: "",
                                              }
                                            : {
                                                reps: 10,
                                                weight:
                                                  weightUnit === "lbs"
                                                    ? Number(
                                                        (
                                                          (sets[sets.length - 1]
                                                            ?.weight || 0) *
                                                          2.20462
                                                        ).toFixed(2)
                                                      )
                                                    : sets[sets.length - 1]
                                                        ?.weight || 0,
                                                duration: 0,
                                                distance: 0,
                                                avgHr: 0,
                                                calories: 0,
                                                notes: "",
                                              }
                                        );
                                        setEditSet(null);
                                        setShowAddSetDialog(true);
                                      }}
                                    >
                                      <Plus className="w-3.5 h-3.5" /> Set
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="gap-1 text-xs text-purple-500 hover:text-purple-600"
                                    onClick={() => {
                                      setAiAnalysisExercise(exerciseName);
                                      setAiAnalysisResult(null);
                                      setShowAiAnalysis(true);
                                      setAiAnalysisLoading(true);
                                      analyzeExercise.mutate({ exerciseName });
                                    }}
                                  >
                                    <Sparkles className="w-3.5 h-3.5" /> AI
                                  </Button>
                                </div>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                {isZh ? "上次課程" : "Previous workout"}:{" "}
                                {previousSetsLoading
                                  ? isZh
                                    ? "載入中…"
                                    : "Loading…"
                                  : (() => {
                                      const prior =
                                        previousSessionDetail?.session?.id ===
                                        previousSession?.id
                                          ? previousSessionDetail?.sets
                                              .filter(set =>
                                                getExerciseHistoryNames(
                                                  exerciseName
                                                ).includes(
                                                  set.exerciseName ?? ""
                                                )
                                              )
                                              .at(-1)
                                          : null;
                                      if (!prior)
                                        return isZh
                                          ? "上次課程未有此動作記錄；不以 PR 或建議代替。"
                                          : "No record for this movement in the prior workout; not a PR or recommendation.";
                                      if (ex?.muscleGroup === "cardio")
                                        return `${prior.duration ?? "—"} min · ${prior.distance ?? "—"} km`;
                                      return `${prior.weight ?? "—"} kg × ${prior.reps ?? "—"} ${isZh ? "次" : "reps"} · ${previousSession ? getSessionHKDate(previousSession) : ""}`;
                                    })()}
                              </p>
                            </div>
                            <div className="studio-set-head">
                              <span>{isZh ? "組" : "Set"}</span>
                              <span>
                                {ex?.muscleGroup === "cardio"
                                  ? isZh
                                    ? "有氧記錄"
                                    : "Cardio record"
                                  : historyUnit}
                              </span>
                              <span>
                                {ex?.muscleGroup === "cardio"
                                  ? ""
                                  : isZh
                                    ? "次數"
                                    : "Reps"}
                              </span>
                              <span className="text-center">
                                {isZh ? "完成" : "Done"}
                              </span>
                              <span className="hidden md:block">
                                {isZh ? "修改記錄" : "Edit log"}
                              </span>
                            </div>
                            <div className="divide-y divide-border">
                              {sets.map((s, i) => (
                                <div
                                  key={s.id ?? `legacy-set-${i}`}
                                  className="studio-set-row hover:bg-muted/20"
                                >
                                  <span className="text-xs font-semibold text-muted-foreground">
                                    {i + 1}
                                  </span>
                                  {ex?.muscleGroup === "cardio" ? (
                                    <span className="col-span-2 min-w-0 text-xs font-semibold leading-5 text-foreground">
                                      {s.duration ? `${s.duration} min` : ""}
                                      {s.distance ? ` · ${s.distance} km` : ""}
                                      {(s as any).avgHr
                                        ? ` · ${(s as any).avgHr} bpm`
                                        : ""}
                                      {(s as any).calories
                                        ? ` · ${(s as any).calories} kcal`
                                        : ""}
                                    </span>
                                  ) : (
                                    <span className="min-w-0 text-sm font-semibold text-foreground">
                                      {s.weight == null
                                        ? "—"
                                        : historyUnit === "lbs"
                                          ? Math.round(s.weight * 2.20462)
                                          : s.weight}{" "}
                                      <span className="text-[10px] font-normal text-muted-foreground">
                                        {historyUnit}
                                      </span>
                                      {s.weight &&
                                        exercisePRs[exerciseName] &&
                                        s.weight >=
                                          exercisePRs[exerciseName] && (
                                          <span
                                            className="text-xs font-bold text-amber-500 flex items-center gap-0.5"
                                            title="Personal Record!"
                                          >
                                            <Trophy className="w-3 h-3" /> PR
                                          </span>
                                        )}
                                    </span>
                                  )}
                                  {ex?.muscleGroup !== "cardio" && (
                                    <span className="text-sm font-semibold text-foreground">
                                      {s.reps ?? "—"}
                                    </span>
                                  )}
                                  <span
                                    aria-label={
                                      isZh
                                        ? "已記錄完成組"
                                        : "Logged completed set"
                                    }
                                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white"
                                  >
                                    <Check className="h-4 w-4" />
                                  </span>
                                  {isOwner && (
                                    <div className="studio-set-actions">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="studio-icon-action text-blue-500 hover:text-blue-600"
                                        aria-label={`複製第 ${i + 1} 組 ${exerciseName}`}
                                        title="複製此組"
                                        onClick={() => {
                                          const isCardio =
                                            (ex?.muscleGroup || "") ===
                                            "cardio";
                                          setSelectedExercise(
                                            ex || { name: exerciseName }
                                          );
                                          setSetForm(
                                            isCardio
                                              ? {
                                                  reps: 0,
                                                  weight: 0,
                                                  duration: s.duration || 0,
                                                  distance: s.distance || 0,
                                                  avgHr: (s as any).avgHr || 0,
                                                  calories:
                                                    (s as any).calories || 0,
                                                  notes: "",
                                                }
                                              : {
                                                  reps: s.reps || 10,
                                                  weight:
                                                    weightUnit === "lbs"
                                                      ? Number(
                                                          (
                                                            (s.weight || 0) *
                                                            2.20462
                                                          ).toFixed(2)
                                                        )
                                                      : s.weight || 0,
                                                  duration: 0,
                                                  distance: 0,
                                                  avgHr: 0,
                                                  calories: 0,
                                                  notes: "",
                                                }
                                          );
                                          setEditSet(null);
                                          setShowAddSetDialog(true);
                                        }}
                                      >
                                        <Copy className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="studio-icon-action"
                                        aria-label={`修改第 ${i + 1} 組 ${exerciseName}`}
                                        onClick={() => {
                                          const isCardio =
                                            (ex?.muscleGroup || "") ===
                                            "cardio";
                                          setEditSet(s);
                                          setSelectedExercise(
                                            ex || { name: exerciseName }
                                          );
                                          setSetForm(
                                            isCardio
                                              ? {
                                                  reps: 0,
                                                  weight: 0,
                                                  duration: s.duration || 0,
                                                  distance: s.distance || 0,
                                                  avgHr: (s as any).avgHr || 0,
                                                  calories:
                                                    (s as any).calories || 0,
                                                  notes: s.notes || "",
                                                }
                                              : {
                                                  reps: s.reps || 10,
                                                  weight:
                                                    weightUnit === "lbs"
                                                      ? Number(
                                                          (
                                                            (s.weight || 0) *
                                                            2.20462
                                                          ).toFixed(2)
                                                        )
                                                      : s.weight || 0,
                                                  duration: 0,
                                                  distance: 0,
                                                  avgHr: 0,
                                                  calories: 0,
                                                  notes: s.notes || "",
                                                }
                                          );
                                          setShowAddSetDialog(true);
                                        }}
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="studio-icon-action text-destructive"
                                        aria-label={`刪除第 ${i + 1} 組 ${exerciseName}`}
                                        onClick={() =>
                                          deleteSet.mutate({ id: s.id })
                                        }
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                    )
                  )}

                  {/* Volume Chart */}
                  {volumeByExercise.length > 0 && (
                    <div className="bg-card border border-border rounded-2xl p-5">
                      <h3 className="font-semibold text-foreground mb-3 text-sm">
                        Session Volume by Exercise
                      </h3>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={volumeByExercise} layout="vertical">
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="oklch(0.24 0.018 240)"
                            horizontal={false}
                          />
                          <XAxis
                            type="number"
                            tick={{
                              fontSize: 10,
                              fill: "oklch(0.60 0.010 240)",
                            }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            tick={{
                              fontSize: 10,
                              fill: "oklch(0.60 0.010 240)",
                            }}
                            axisLine={false}
                            tickLine={false}
                            width={80}
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar
                            dataKey="vol"
                            name="Volume (kg)"
                            fill="oklch(0.75 0.17 280)"
                            radius={[0, 4, 4, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {isOwner && !currentSession.endTime && !historicalSession && (
                    <WorkoutStudioRestBar
                      seconds={restSeconds}
                      preset={restPreset}
                      running={restIsActive}
                      onPreset={seconds => {
                        setRestPreset(seconds);
                        setRestSeconds(seconds);
                        setRestIsActive(true);
                      }}
                      onAdjust={delta =>
                        setRestSeconds(seconds =>
                          Math.max(0, Math.min(600, seconds + delta))
                        )
                      }
                      onToggle={() => setRestIsActive(value => !value)}
                      onReset={() => {
                        setRestSeconds(0);
                        setRestIsActive(false);
                      }}
                      onAddExercise={() => {
                        setSearchQuery("");
                        setExerciseLibMode("strength");
                        setShowExerciseDialog(true);
                      }}
                      onAddSet={lastLoggedSet ? openNextSet : undefined}
                      exerciseName={lastLoggedSet?.exerciseName || undefined}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Exercise Library Tab */}
        <TabsContent value="exercises" className="mt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="space-y-3">
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                  MOVEMENT LIBRARY
                </p>
                <h2 className="mt-1 text-lg font-extrabold text-foreground">
                  器材 × 肌群動作庫
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {isZh
                    ? "找器材、選動作，回顧每一次進步。"
                    : "Find your equipment and follow each movement’s progress."}
                </p>
                <details className="mt-2 text-xs leading-5 text-muted-foreground">
                  <summary className="flex min-h-11 cursor-pointer items-center text-primary">
                    {isZh ? "關於動作示範" : "About movement illustrations"}
                  </summary>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {isZh
                      ? "先找器材，再選肌群。支援動作提供免費通用簡化動畫，非 Gymwork 原作，不使用付費素材；不保證符合每款品牌器械的結構或軌跡。點選動作可查看訓練紀錄、動畫與技巧。未支援動作仍保留肌群與說明。"
                      : "Filter by equipment and muscle. Supported movements include free generic simplified animations, not Gymwork originals or paid assets. They may not match every branded machine's structure or path. Select a static thumbnail to view the animation, muscles and steps here; unsupported movements retain their muscles and instructions."}
                  </p>
                </details>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    variant={
                      exerciseLibMode === "strength" ? "default" : "outline"
                    }
                    className="h-11 gap-1 text-xs"
                    onClick={() => setExerciseLibMode("strength")}
                  >
                    <Dumbbell className="h-3.5 w-3.5" />
                    力量
                  </Button>
                  <Button
                    variant={
                      exerciseLibMode === "cardio" ? "default" : "outline"
                    }
                    className="h-11 gap-1 text-xs"
                    onClick={() => setExerciseLibMode("cardio")}
                  >
                    <Activity className="h-3.5 w-3.5" />
                    有氧
                  </Button>
                </div>
                <div className="mt-3">
                  <LibraryFilters
                    equipment={selectedEquipment}
                    muscle={selectedMuscle}
                    onEquipment={setSelectedEquipment}
                    onMuscle={setSelectedMuscle}
                    equipmentOptions={equipmentOptions}
                    cardio={exerciseLibMode === "cardio"}
                  />
                </div>
                {(selectedEquipment !== "all" ||
                  selectedMuscle ||
                  searchQuery) && (
                  <Button
                    variant="ghost"
                    className="mt-2 h-10 w-full gap-1 text-xs"
                    onClick={() => {
                      setSelectedEquipment("all");
                      setSelectedMuscle(null);
                      setSearchQuery("");
                    }}
                  >
                    <X className="h-3 w-3" />
                    清除篩選
                  </Button>
                )}
              </div>
              {exerciseLibMode === "strength" && (
                <div className="hidden rounded-2xl border border-border bg-card p-4 lg:block">
                  <h3 className="mb-2 text-sm font-semibold text-foreground">
                    點選肌群
                  </h3>
                  <MuscleMap
                    activeMuscles={activeMuscles}
                    selectedMuscle={selectedMuscle}
                    onSelect={muscle =>
                      setSelectedMuscle(previous =>
                        previous === muscle ? null : muscle
                      )
                    }
                  />
                </div>
              )}
            </aside>
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-40 flex-1">
                  <Search
                    aria-hidden="true"
                    className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground"
                  />
                  <Input
                    aria-label="搜尋動作名稱或器材"
                    placeholder="搜尋中文／英文動作或器材…"
                    className="h-11 pl-9"
                    value={searchQuery}
                    onChange={event => setSearchQuery(event.target.value)}
                  />
                </div>
                {isOwner && (
                  <Button
                    variant="outline"
                    className="h-11 gap-1.5 text-xs"
                    onClick={() => setShowCreateExerciseDialog(true)}
                  >
                    <PlusCircle className="h-4 w-4" />
                    自訂／拍照新增
                  </Button>
                )}
              </div>
              <p role="status" className="text-xs text-muted-foreground">
                {filteredExercises.length} 個動作 ·{" "}
                {
                  filteredExercises.filter(exercise =>
                    getExerciseGuide(exercise.name, exercise.equipment)
                  ).length
                }{" "}
                {isZh ? "個支援簡化動畫" : "with simplified animation"} ·{" "}
                {selectedEquipment === "all" ? "所有器材" : selectedEquipment}
                {selectedMuscle && exerciseLibMode !== "cardio"
                  ? ` · ${MUSCLE_GROUPS.find(muscle => muscle.id === selectedMuscle)?.label || selectedMuscle}`
                  : ""}
              </p>
              {favouriteSet.size > 0 &&
                !searchQuery &&
                !selectedMuscle &&
                selectedEquipment === "all" && (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3">
                    <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-foreground">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      我的最愛
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {allExercises
                        .filter(
                          exercise =>
                            favouriteSet.has(exercise.name) &&
                            (exerciseLibMode === "cardio"
                              ? exercise.muscleGroup === "cardio"
                              : exercise.muscleGroup !== "cardio")
                        )
                        .map(exercise => (
                          <Button
                            key={exercise.name}
                            variant="outline"
                            className="h-10 gap-1.5 rounded-xl text-xs"
                            onClick={() => {
                              setDetailExercise(exercise);
                              setShowExerciseDetail(true);
                            }}
                          >
                            <Play aria-hidden="true" className="h-3 w-3" />
                            {(exercise as any).nameZh || exercise.name}
                          </Button>
                        ))}
                    </div>
                  </div>
                )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredExercises.map((exercise: any, index: number) => (
                  <WorkoutStudioLibraryCard
                    key={
                      exercise.id
                        ? `custom-${exercise.id}`
                        : `${exercise.name}:${exercise.equipment}:${exercise.variantLabel ?? index}`
                    }
                    exercise={exercise}
                    onOpen={() => openExerciseDetails(exercise)}
                    favourite={
                      favouriteSet.has(exercise.name) ||
                      (exercise.aliases ?? []).some((alias: string) =>
                        favouriteSet.has(alias)
                      )
                    }
                    onFavourite={
                      isOwner && !exercise.isCustom
                        ? () =>
                            toggleFavourite.mutate({
                              exerciseName: exercise.name,
                            })
                        : undefined
                    }
                    onDelete={
                      isOwner && exercise.isCustom
                        ? () => {
                            if (
                              window.confirm(
                                `刪除自訂動作「${exercise.name}」？`
                              )
                            )
                              deleteCustomExercise.mutate({ id: exercise.id });
                          }
                        : undefined
                    }
                    onAdd={
                      isOwner && activeSession
                        ? () => {
                            setSelectedExercise(exercise);
                            setSetForm({
                              reps: exercise.muscleGroup === "cardio" ? 0 : 10,
                              weight: 0,
                              duration: 0,
                              distance: 0,
                              avgHr: 0,
                              calories: 0,
                              notes: "",
                            });
                            setEditSet(null);
                            setShowAddSetDialog(true);
                          }
                        : undefined
                    }
                  />
                ))}
                {filteredExercises.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-center sm:col-span-2 xl:col-span-3">
                    <p className="text-sm text-muted-foreground">
                      沒有符合器材及肌群的動作。試試清除篩選，或新增你的動作。
                    </p>
                    {isOwner && (
                      <Button
                        variant="outline"
                        className="mt-3 h-11 gap-1.5"
                        onClick={() => {
                          setCreateExForm(form => ({
                            ...form,
                            name: searchQuery,
                          }));
                          setShowCreateExerciseDialog(true);
                        }}
                      >
                        <PlusCircle className="h-4 w-4" />
                        新增自訂動作
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* History & Charts Tab */}
        <TabsContent value="history" className="mt-4 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-semibold text-foreground">訓練歷史篩選</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  日期按香港時間（UTC+8）計算；搜尋文字亦會套用到下方比較摘要。
                </p>
              </div>
              <Badge variant="secondary" className="w-fit text-xs shrink-0">
                {formatHistoryPeriod(historyPeriod)}
              </Badge>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Select value={historyYear} onValueChange={setHistoryYear}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="選擇年份" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_HISTORY_PERIOD_VALUE}>
                    所有年份
                  </SelectItem>
                  {historyYearOptions.map(year => (
                    <SelectItem key={year} value={year}>
                      {year} 年
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={historyMonth} onValueChange={setHistoryMonth}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="選擇月份" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_HISTORY_PERIOD_VALUE}>
                    所有月份
                  </SelectItem>
                  {HK_HISTORY_MONTHS.map(month => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={historyComparisonMode}
                onValueChange={value =>
                  setHistoryComparisonMode(value as HistoryComparisonMode)
                }
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prior_equivalent_period">
                    比較：上一個同等期間
                  </SelectItem>
                  <SelectItem
                    value="previous_month"
                    disabled={
                      historyYear === ALL_HISTORY_PERIOD_VALUE ||
                      historyMonth === ALL_HISTORY_PERIOD_VALUE
                    }
                  >
                    比較：上個月
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {historyComparisonMode === "previous_month" &&
              !comparisonPeriod && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  請先選擇一個完整的年份及月份，才可與上個月比較。
                </p>
              )}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <HistorySummaryCard
              title="已選期間摘要"
              periodLabel={formatHistoryPeriod(historyPeriod)}
              summary={selectedHistorySummary}
              historyUnit={historyUnit}
            />
            <HistorySummaryCard
              title="比較期間摘要"
              periodLabel={
                comparisonPeriod
                  ? formatHistoryPeriod(comparisonPeriod)
                  : "未能建立可比較期間"
              }
              summary={comparisonHistorySummary}
              historyUnit={historyUnit}
              unavailableMessage="請選擇年份以比較上一個同等期間；如要比較上個月，請同時選擇年份及月份。"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Weekly Volume */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="mb-4">
                <h3 className="font-semibold text-foreground">
                  最近 7 天訓練量
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  按香港時間計算
                </p>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyVolume}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="oklch(0.24 0.018 240)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "oklch(0.60 0.010 240)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "oklch(0.60 0.010 240)" }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="volume"
                    name="Volume (kg)"
                    fill="oklch(0.75 0.17 280)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Session History */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-foreground">訓練記錄</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {sortedHistorySessions.length} 次符合目前篩選
                  </p>
                </div>
                <div className="flex items-center border border-border rounded-lg overflow-hidden text-xs">
                  <button
                    className={`px-2 py-0.5 transition-colors ${historyUnit === "kg" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-muted"}`}
                    onClick={() => setHistoryUnit("kg")}
                  >
                    kg
                  </button>
                  <button
                    className={`px-2 py-0.5 transition-colors ${historyUnit === "lbs" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-muted"}`}
                    onClick={() => setHistoryUnit("lbs")}
                  >
                    lbs
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Input
                  aria-label="搜尋訓練名稱或地點"
                  placeholder="搜尋名稱／地點…"
                  value={sessionSearch}
                  onChange={e => setSessionSearch(e.target.value)}
                  className="h-8 text-xs w-36"
                />
                <Select
                  value={sessionSort}
                  onValueChange={v => setSessionSort(v as any)}
                >
                  <SelectTrigger className="h-8 w-44 text-xs">
                    <ArrowUpDown className="w-3 h-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date_desc">
                      {t("common.sort_date_desc")}
                    </SelectItem>
                    <SelectItem value="date_asc">
                      {t("common.sort_date_asc")}
                    </SelectItem>
                    <SelectItem value="volume_desc">
                      {t("workout.sort_volume_desc")}
                    </SelectItem>
                    <SelectItem value="duration_desc">
                      {t("workout.sort_duration_desc")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {sortedHistorySessions.map((s: any) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 py-2 border-b border-border last:border-0"
                  >
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                      <Dumbbell className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {s.name || "Workout"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {toHKDateString(new Date(s.startTime))}
                        {s.duration ? ` · ${s.duration} min` : ""}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin
                          aria-hidden="true"
                          className="h-3 w-3 shrink-0"
                        />
                        <span className="truncate">
                          {s.location || "未設定地點"}
                        </span>
                      </p>
                    </div>
                    <div className="flex max-w-[50%] flex-wrap items-center justify-end gap-1.5">
                      {(s as any).caloriesBurned ? (
                        <span className="text-xs font-semibold text-orange-500">
                          {s.calorieEstimate
                            ? formatActiveEnergyRange(s.calorieEstimate)
                            : `約 ${Math.round((s as any).caloriesBurned)}`}{" "}
                          kcal
                        </span>
                      ) : null}
                      {s.totalVolume && (
                        <span className="text-xs font-semibold text-primary">
                          {historyUnit === "lbs"
                            ? Math.round(
                                s.totalVolume * 2.20462
                              ).toLocaleString() + " lbs"
                            : Math.round(s.totalVolume).toLocaleString() +
                              " kg"}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-10 h-10"
                        aria-label={`查看課程 ${s.name || "Workout"}`}
                        onClick={() => {
                          setActiveSession(s);
                          setActiveTab("session");
                        }}
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                      {isOwner && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 text-muted-foreground hover:text-foreground"
                          title="修改記錄"
                          onClick={() => {
                            setActiveSession(s);
                            handleOpenEditSession(s);
                          }}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {isOwner && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-10 h-10 text-destructive"
                          aria-label={`刪除課程 ${s.name || "Workout"}`}
                          onClick={() => {
                            if (
                              window.confirm(
                                "刪除此課程及所有組數？此操作不能復原。"
                              )
                            )
                              deleteSession.mutate({ id: s.id });
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {sortedHistorySessions.length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-4">
                    {t("common.no_records")}
                  </p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Personal Records (PR) Tab */}
        <TabsContent value="pr" className="mt-4">
          <div className="space-y-4">
            {/* Header with controls */}
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-foreground">個人最佳記錄</h3>
                <Badge variant="secondary" className="text-xs">
                  {prHistory.length} 個動作
                </Badge>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Unit toggle */}
                <div className="flex items-center border border-border rounded-lg overflow-hidden text-xs">
                  <button
                    className={`px-2 py-0.5 transition-colors ${prUnit === "kg" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-muted"}`}
                    onClick={() => setPrUnit("kg")}
                  >
                    kg
                  </button>
                  <button
                    className={`px-2 py-0.5 transition-colors ${prUnit === "lbs" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-muted"}`}
                    onClick={() => setPrUnit("lbs")}
                  >
                    lbs
                  </button>
                </div>
                {/* Sort */}
                <Select
                  value={prSortBy}
                  onValueChange={v => setPrSortBy(v as any)}
                >
                  <SelectTrigger className="h-8 w-36 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weight">重量（最高）</SelectItem>
                    <SelectItem value="name">動作名稱</SelectItem>
                    <SelectItem value="date">達成日期</SelectItem>
                  </SelectContent>
                </Select>
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="搜尋動作…"
                    className="h-8 pl-8 text-xs w-36"
                    value={prSearch}
                    onChange={e => setPrSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {prHistory.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  尚無訓練記錄，開始訓練後即可查看個人最佳。
                </p>
              </div>
            ) : (
              (() => {
                const filtered = prHistory
                  .filter(pr =>
                    pr.exerciseName
                      .toLowerCase()
                      .includes(prSearch.toLowerCase())
                  )
                  .sort((a, b) => {
                    if (prSortBy === "weight") return b.prWeight - a.prWeight;
                    if (prSortBy === "name")
                      return a.exerciseName.localeCompare(b.exerciseName);
                    if (prSortBy === "date")
                      return (b.achievedAt ?? "").localeCompare(
                        a.achievedAt ?? ""
                      );
                    return 0;
                  });
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filtered.map((pr, i) => {
                      const displayWeight =
                        prUnit === "lbs"
                          ? Math.round(pr.prWeight * 2.20462)
                          : pr.prWeight;
                      const displayPrevWeight =
                        pr.prevWeight != null
                          ? prUnit === "lbs"
                            ? Math.round(pr.prevWeight * 2.20462)
                            : pr.prevWeight
                          : null;
                      const delta =
                        pr.prevWeight != null
                          ? pr.prWeight - pr.prevWeight
                          : null;
                      const displayDelta =
                        delta != null
                          ? prUnit === "lbs"
                            ? Math.round(delta * 2.20462)
                            : Math.round(delta * 10) / 10
                          : null;
                      const achievedDate = pr.achievedAt
                        ? new Date(pr.achievedAt).toLocaleDateString("zh-HK", {
                            timeZone: "Asia/Hong_Kong",
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          })
                        : "—";
                      const ex = allExercises.find(
                        e =>
                          e.name === pr.exerciseName ||
                          (e as any).nameZh === pr.exerciseName
                      );
                      return (
                        <div
                          key={i}
                          className="bg-card border border-border rounded-2xl p-4 hover:border-amber-400/60 transition-all hover:shadow-md"
                        >
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-foreground text-sm truncate">
                                {pr.exerciseName}
                              </p>
                              {ex && (
                                <p className="text-xs text-muted-foreground">
                                  {(ex as any).nameZh || ex.muscleGroup}
                                </p>
                              )}
                            </div>
                            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                              <Trophy className="w-4 h-4 text-amber-500" />
                            </div>
                          </div>
                          <div className="flex items-end gap-1 mb-2">
                            <span className="text-2xl font-extrabold text-amber-500">
                              {displayWeight}
                            </span>
                            <span className="text-sm text-muted-foreground mb-0.5">
                              {prUnit}
                            </span>
                            {pr.prReps && (
                              <span className="text-xs text-muted-foreground mb-0.5 ml-1">
                                × {pr.prReps} reps
                              </span>
                            )}
                          </div>
                          {/* PR delta: prev PR → current PR */}
                          {displayPrevWeight != null &&
                            displayDelta != null && (
                              <div className="flex items-center gap-1.5 text-xs mb-2">
                                <span className="text-muted-foreground">
                                  {displayPrevWeight} {prUnit}
                                </span>
                                <span className="text-muted-foreground">→</span>
                                <span className="text-amber-500 font-semibold">
                                  {displayWeight} {prUnit}
                                </span>
                                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-bold">
                                  +{displayDelta} {prUnit}
                                </span>
                              </div>
                            )}
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Timer className="w-3 h-3" />
                            <span>{achievedDate}</span>
                            {pr.sessionName && (
                              <span className="text-muted-foreground/60">
                                · {pr.sessionName}
                              </span>
                            )}
                          </div>
                          {ex && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              <Badge
                                variant="secondary"
                                className="text-xs capitalize"
                              >
                                {ex.muscleGroup}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {ex.equipment}
                              </Badge>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {filtered.length === 0 && (
                      <div className="col-span-3 text-center py-8">
                        <p className="text-muted-foreground text-sm">
                          找不到「{prSearch}」的動作 PR
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>
        </TabsContent>
        <TabsContent value="muscles" className="mt-4">
          <WorkoutMuscleAnalytics />
        </TabsContent>
        <TabsContent value="gyms" className="mt-4">
          <GymDirectoryPanel
            onSelectLocation={location => {
              setSessionLocation(location);
              setSessionEntryMode(
                selectedDate === todayHKString() ? "live" : "manual"
              );
              setShowSessionDialog(true);
            }}
            onOpenExercise={exercise => {
              setDetailExercise(exercise);
              setShowExerciseDetail(true);
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Start Session Dialog */}
      <Dialog open={showSessionDialog} onOpenChange={setShowSessionDialog}>
        <DialogContent className="workout-studio-dialog max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>建立訓練課程</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={sessionEntryMode === "live" ? "default" : "outline"}
                className="h-11"
                onClick={() => {
                  setSessionEntryMode("live");
                  setSelectedDate(todayHKString());
                }}
              >
                即時訓練
              </Button>
              <Button
                type="button"
                variant={sessionEntryMode === "manual" ? "default" : "outline"}
                className="h-11"
                onClick={() => setSessionEntryMode("manual")}
              >
                補錄已完成課程
              </Button>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              {sessionEntryMode === "live"
                ? "以實際開始時間建立今日課程；結束前可核對有效時長。"
                : "自行指定香港日期、開始時間及有效時長；不使用現在時間計算歷史課程。"}
            </p>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                訓練範本（選填）
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTemplateKey("custom")}
                  className={`rounded-xl border p-2.5 text-left transition-colors ${selectedTemplateKey === "custom" ? "border-primary bg-primary/10" : "border-border hover:bg-muted/40"}`}
                >
                  <p className="text-xs font-bold text-foreground">自訂課程</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    自由選擇動作
                  </p>
                </button>
                {WORKOUT_TEMPLATES.map(template => (
                  <button
                    key={template.key}
                    type="button"
                    onClick={() => {
                      setSelectedTemplateKey(template.key);
                      if (!sessionName.trim()) setSessionName(template.nameZh);
                    }}
                    className={`rounded-xl border p-2.5 text-left transition-colors ${selectedTemplateKey === template.key ? "border-primary bg-primary/10" : "border-border hover:bg-muted/40"}`}
                  >
                    <p className="text-xs font-bold text-foreground">
                      {template.nameZh}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
                      {template.exercises.length} 個動作 ·{" "}
                      {template.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label
                htmlFor="workout-session-name"
                className="text-xs text-muted-foreground mb-1 block"
              >
                課程名稱
              </label>
              <Input
                id="workout-session-name"
                placeholder="例如：推日、腿日…"
                value={sessionName}
                onChange={e => setSessionName(e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="workout-session-date"
                className="text-xs text-muted-foreground mb-1 block"
              >
                日期（香港時間）
              </label>
              <Input
                id="workout-session-date"
                type="date"
                value={selectedDate}
                onChange={e => {
                  setSelectedDate(e.target.value);
                  if (e.target.value !== todayHKString())
                    setSessionEntryMode("manual");
                }}
              />
            </div>
            <GymLocationInput
              value={sessionLocation}
              onChange={setSessionLocation}
              locations={savedLocations}
            />
            {sessionEntryMode === "manual" && (
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-muted-foreground">
                  開始時間（香港）
                  <Input
                    aria-label="補錄開始時間"
                    type="time"
                    className="mt-1 h-11"
                    value={sessionStartTime}
                    onChange={event => setSessionStartTime(event.target.value)}
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  有效時長（分鐘）
                  <Input
                    aria-label="補錄有效時長"
                    type="number"
                    inputMode="decimal"
                    min="1"
                    max={MAX_WORKOUT_MINUTES}
                    className="mt-1 h-11"
                    value={manualDuration}
                    onChange={event => setManualDuration(event.target.value)}
                    placeholder="例如 45"
                  />
                </label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSessionDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleStartSession}
              disabled={createSession.isPending}
            >
              {createSession.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {sessionEntryMode === "manual" ? "建立補錄課程" : "開始訓練"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Select Exercise Dialog */}
      <Dialog open={showExerciseDialog} onOpenChange={setShowExerciseDialog}>
        <DialogContent className="workout-studio-dialog max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>選擇動作</DialogTitle>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              點選動作記錄組數；右側紀錄按鈕可查看日期、重量與進展。
            </p>
          </DialogHeader>
          <div className="space-y-3 flex-1 flex flex-col min-h-0">
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant={exerciseLibMode === "strength" ? "default" : "outline"}
                className="flex-1 text-xs"
                onClick={() => setExerciseLibMode("strength")}
              >
                力量訓練
              </Button>
              <Button
                size="sm"
                variant={exerciseLibMode === "cardio" ? "default" : "outline"}
                className="flex-1 text-xs"
                onClick={() => setExerciseLibMode("cardio")}
              >
                有氧
              </Button>
            </div>
            <Input
              aria-label="搜尋課程動作"
              placeholder="搜尋動作…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <LibraryFilters
              equipment={selectedEquipment}
              muscle={selectedMuscle}
              onEquipment={setSelectedEquipment}
              onMuscle={setSelectedMuscle}
              equipmentOptions={equipmentOptions}
              cardio={exerciseLibMode === "cardio"}
            />
            <div className="space-y-2 flex-1 overflow-y-auto overscroll-contain pr-1">
              {filteredExercises.map((ex: any, i: number) => (
                <div
                  key={
                    ex.id
                      ? `custom-${ex.id}`
                      : `${ex.name}:${ex.equipment}:${ex.variantLabel ?? i}`
                  }
                  className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-2 py-1.5"
                >
                  <button
                    type="button"
                    aria-label={`選擇 ${ex.name} 記錄組數`}
                    className="min-h-14 min-w-0 flex-1 rounded-lg px-2 py-2 text-left hover:bg-muted/40"
                    onClick={() => {
                      setSelectedExercise(ex);
                      setSetForm({
                        reps: ex.muscleGroup === "cardio" ? 0 : 10,
                        weight: 0,
                        duration: 0,
                        distance: 0,
                        avgHr: 0,
                        calories: 0,
                        notes: "",
                      });
                      setEditSet(null);
                      setShowExerciseDialog(false);
                      setShowAddSetDialog(true);
                    }}
                  >
                    <span className="block text-sm font-semibold leading-6">
                      {isZh ? ex.nameZh || ex.name : ex.name}
                    </span>
                    <span className="block text-xs leading-5 text-muted-foreground">
                      {isZh && ex.nameZh ? `${ex.name} · ` : ""}
                      {ex.equipment}
                      {ex.isCustom ? " · 自訂" : ""}
                    </span>
                    {ex.variantLabel && (
                      <span className="block text-xs leading-5 text-amber-700 dark:text-amber-400">
                        {ex.variantLabel}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={`查看訓練紀錄 ${ex.name}`}
                    title={
                      isZh
                        ? "訓練紀錄與動作詳情"
                        : "History and exercise details"
                    }
                    onClick={() => openExerciseDetails(ex)}
                    className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-border text-primary hover:bg-muted/40"
                  >
                    <History className="h-4 w-4" />
                  </button>
                  <ChevronRight
                    aria-hidden="true"
                    className="mr-1 h-4 w-4 shrink-0 text-muted-foreground"
                  />
                </div>
              ))}
              {filteredExercises.length === 0 && (
                <div className="text-center py-6 space-y-3">
                  <p className="text-muted-foreground text-sm">
                    找不到「{searchQuery}」
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setCreateExForm(f => ({ ...f, name: searchQuery }));
                      setShowExerciseDialog(false);
                      setShowCreateExerciseDialog(true);
                    }}
                  >
                    <PlusCircle className="w-4 h-4" /> 新增為自訂動作
                  </Button>
                </div>
              )}
            </div>
            <div className="border-t border-border pt-3">
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => {
                  setShowExerciseDialog(false);
                  setShowCreateExerciseDialog(true);
                }}
              >
                <PlusCircle className="w-4 h-4" /> 新增自訂動作
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Custom Exercise Dialog */}
      <Dialog
        open={showCreateExerciseDialog}
        onOpenChange={setShowCreateExerciseDialog}
      >
        <DialogContent className="workout-studio-dialog max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新增自訂動作</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-xs font-semibold text-foreground">
                拍照識別器材／動作（選填）
              </p>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                相片先在裝置內壓縮，再送交 AI
                辨識。結果只作草稿，須核對後手動儲存；不會自動建立動作。
              </p>
              <input
                ref={createExPhotoRef}
                type="file"
                aria-label="拍攝器材或動作相片"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={event => {
                  const file = event.target.files?.[0];
                  if (file) void handleAiPhotoIdentify(file);
                  event.target.value = "";
                }}
              />
              <input
                ref={createExAlbumRef}
                type="file"
                aria-label="從相簿選取器材或動作"
                accept="image/*"
                className="hidden"
                onChange={event => {
                  const file = event.target.files?.[0];
                  if (file) void handleAiPhotoIdentify(file);
                  event.target.value = "";
                }}
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="h-11 gap-1.5 text-xs"
                  disabled={aiIdentifyLoading}
                  onClick={() => createExPhotoRef.current?.click()}
                >
                  <Camera className="h-4 w-4" />
                  後置相機拍攝
                </Button>
                <Button
                  variant="outline"
                  className="h-11 gap-1.5 text-xs"
                  disabled={aiIdentifyLoading}
                  onClick={() => createExAlbumRef.current?.click()}
                >
                  <PlusCircle className="h-4 w-4" />
                  從相簿選取
                </Button>
              </div>
              {aiIdentifyLoading && (
                <p
                  role="status"
                  className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在壓縮／辨識相片…
                </p>
              )}
              {photoError && (
                <div
                  role="alert"
                  className="mt-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive"
                >
                  <p>{photoError}</p>
                  {photoReady && (
                    <Button
                      variant="outline"
                      className="mt-2 h-10 text-xs"
                      onClick={() => void handleAiPhotoIdentify()}
                    >
                      重試辨識（沿用已壓縮相片）
                    </Button>
                  )}
                </div>
              )}
              {aiIdentifyResult && (
                <div className="mt-3 rounded-xl border border-primary/20 bg-card p-3">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-primary">
                    <CheckCircle2 className="h-4 w-4" />
                    辨識結果 · 尚未儲存
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {aiIdentifyResult.nameZh || aiIdentifyResult.name}
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                    {aiIdentifyResult.name} · {aiIdentifyResult.equipment} ·{" "}
                    {aiIdentifyResult.muscleGroup}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    AI 可信度：{aiIdentifyResult.confidence || "未提供"}
                    ；請核對器材和動作，不能作安全保證。
                  </p>
                  <Button
                    variant="outline"
                    className="mt-2 h-10 w-full text-xs"
                    onClick={applyIdentifiedExercise}
                  >
                    填入草稿並核對
                  </Button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  動作名稱（英）*
                </label>
                <Input
                  aria-label="自訂動作英文名稱"
                  placeholder="e.g. Cable Fly"
                  value={createExForm.name}
                  onChange={e =>
                    setCreateExForm(f => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  動作名稱（中）
                </label>
                <Input
                  aria-label="自訂動作中文名稱"
                  placeholder="e.g. 繩索飛鳥"
                  value={createExForm.nameZh}
                  onChange={e =>
                    setCreateExForm(f => ({ ...f, nameZh: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  肌肉群
                </label>
                <Select
                  value={createExForm.muscleGroup}
                  onValueChange={v =>
                    setCreateExForm(f => ({ ...f, muscleGroup: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MUSCLE_GROUPS.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  器材
                </label>
                <Select
                  value={createExForm.equipment}
                  onValueChange={v =>
                    setCreateExForm(f => ({ ...f, equipment: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EQUIPMENT_LIST.map(e => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                動作說明（選填）
              </label>
              <Input
                placeholder="簡短描述動作要點…"
                value={createExForm.instructions}
                onChange={e =>
                  setCreateExForm(f => ({ ...f, instructions: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateExerciseDialog(false);
                setAiIdentifyResult(null);
              }}
            >
              取消
            </Button>
            <Button
              onClick={handleCreateCustomExercise}
              disabled={
                createCustomExercise.isPending ||
                aiIdentifyLoading ||
                !createExForm.name.trim()
              }
            >
              {createCustomExercise.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              新增動作
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Set Dialog */}
      <Dialog open={showAddSetDialog} onOpenChange={setShowAddSetDialog}>
        <DialogContent className="workout-studio-dialog max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editSet ? "Edit Set" : `Log Set — ${selectedExercise?.name}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {selectedExercise?.muscleGroup === "cardio" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      時間（分鐘）
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={setForm.duration || ""}
                      placeholder="0"
                      onChange={e =>
                        setSetForm(f => ({
                          ...f,
                          duration: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      距離（km）
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={setForm.distance || ""}
                      placeholder="0.0"
                      onChange={e =>
                        setSetForm(f => ({
                          ...f,
                          distance: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      心跳（bpm）
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={setForm.avgHr || ""}
                      placeholder="0"
                      onChange={e =>
                        setSetForm(f => ({
                          ...f,
                          avgHr: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      器材回報熱量（kcal，選填）
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={setForm.calories || ""}
                      placeholder="0"
                      onChange={e =>
                        setSetForm(f => ({
                          ...f,
                          calories: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    備註（可選）
                  </label>
                  <Input
                    placeholder="例：阶段訓練、慢跳恢復…"
                    value={setForm.notes}
                    onChange={e =>
                      setSetForm(f => ({ ...f, notes: e.target.value }))
                    }
                  />
                </div>
                <div className="bg-muted/50 rounded-xl p-3 grid grid-cols-2 gap-2 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">時間</p>
                    <p className="text-lg font-bold text-foreground">
                      {setForm.duration || 0}{" "}
                      <span className="text-xs font-normal">min</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      器材回報（口徑未確認）
                    </p>
                    <p className="text-lg font-bold text-orange-500">
                      {setForm.calories || 0}{" "}
                      <span className="text-xs font-normal">kcal</span>
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                {progressionSuggestion && (
                  <div className="rounded-xl border border-violet-400/20 bg-violet-500/5 p-3">
                    <div className="flex gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-300">
                        <TrendingUp className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-foreground">
                          漸進超負荷建議
                        </p>
                        <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                          {progressionSuggestion.detail}
                        </p>
                        {progressionSuggestion.available && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="mt-2 h-7 border-violet-300/50 text-[11px] text-violet-700 hover:bg-violet-500/10 dark:text-violet-200"
                            onClick={() =>
                              setSetForm(form => ({
                                ...form,
                                reps: progressionSuggestion.targetReps,
                                weight:
                                  weightUnit === "lbs"
                                    ? Number(
                                        (
                                          progressionSuggestion.targetWeightKg *
                                          2.20462
                                        ).toFixed(1)
                                      )
                                    : progressionSuggestion.targetWeightKg,
                              }))
                            }
                          >
                            套用 {progressionSuggestion.targetWeightKg} kg ×{" "}
                            {progressionSuggestion.targetReps}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Reps
                    </label>
                    <Input
                      type="number"
                      value={setForm.reps}
                      onChange={e =>
                        setSetForm(f => ({
                          ...f,
                          reps: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-muted-foreground">
                        Weight
                      </label>
                      <div className="flex rounded-md overflow-hidden border border-border text-xs">
                        <button
                          className={`px-2 py-0.5 transition-colors ${weightUnit === "kg" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-muted"}`}
                          onClick={() => {
                            if (weightUnit === "lbs") {
                              setSetForm(f => ({
                                ...f,
                                weight: parseFloat(
                                  (f.weight / 2.20462).toFixed(2)
                                ),
                              }));
                              setWeightUnit("kg");
                            }
                          }}
                        >
                          kg
                        </button>
                        <button
                          className={`px-2 py-0.5 transition-colors ${weightUnit === "lbs" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-muted"}`}
                          onClick={() => {
                            if (weightUnit === "kg") {
                              setSetForm(f => ({
                                ...f,
                                weight: parseFloat(
                                  (f.weight * 2.20462).toFixed(1)
                                ),
                              }));
                              setWeightUnit("lbs");
                            }
                          }}
                        >
                          lbs
                        </button>
                      </div>
                    </div>
                    <Input
                      type="number"
                      step="0.5"
                      value={setForm.weight}
                      onChange={e =>
                        setSetForm(f => ({
                          ...f,
                          weight: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Notes (optional)
                  </label>
                  <Input
                    placeholder="e.g. felt strong, paused reps…"
                    value={setForm.notes}
                    onChange={e =>
                      setSetForm(f => ({ ...f, notes: e.target.value }))
                    }
                  />
                </div>
                <div className="bg-muted/50 rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground">Volume</p>
                  {weightUnit === "lbs" ? (
                    <p className="text-xl font-bold text-foreground">
                      {Math.round(setForm.reps * setForm.weight)}{" "}
                      <span className="text-sm font-normal">lbs</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({Math.round((setForm.reps * setForm.weight) / 2.20462)}{" "}
                        kg)
                      </span>
                    </p>
                  ) : (
                    <p className="text-xl font-bold text-foreground">
                      {Math.round(setForm.reps * setForm.weight)}{" "}
                      <span className="text-sm font-normal">kg</span>
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddSetDialog(false);
                setEditSet(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddSet}
              disabled={addSet.isPending || updateSet.isPending}
            >
              {(addSet.isPending || updateSet.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editSet ? "Save" : "Log Set"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exercise Detail Modal */}
      <ExerciseDetailModal
        exercise={detailExercise}
        weightUnit={historyUnit}
        open={showExerciseDetail}
        onClose={() => setShowExerciseDetail(false)}
        hasActiveSession={isOwner && !!activeSession}
        onAddToSession={() => {
          if (detailExercise) {
            setSelectedExercise(detailExercise);
            setSetForm({
              reps: detailExercise.muscleGroup === "cardio" ? 0 : 10,
              weight: 0,
              duration: 0,
              distance: 0,
              avgHr: 0,
              calories: 0,
              notes: "",
            });
            setEditSet(null);
            setShowExerciseDialog(false);
            setShowAddSetDialog(true);
          }
        }}
      />

      {/* Edit Session Dialog */}
      <Dialog
        open={showEditSessionDialog}
        onOpenChange={setShowEditSessionDialog}
      >
        <DialogContent className="workout-studio-dialog max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>修改訓練記錄</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label
                htmlFor="workout-edit-name"
                className="text-xs text-muted-foreground mb-1 block"
              >
                訓練名稱
              </label>
              <Input
                id="workout-edit-name"
                value={editSessionForm.name}
                onChange={e =>
                  setEditSessionForm(f => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Push Day"
              />
            </div>
            <GymLocationInput
              value={editSessionForm.location}
              onChange={location =>
                setEditSessionForm(form => ({ ...form, location }))
              }
              locations={savedLocations}
            />
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                日期（香港時間）
              </label>
              <Input
                aria-label="修改課程日期"
                type="date"
                value={editSessionForm.date}
                onChange={e =>
                  setEditSessionForm(f => ({ ...f, date: e.target.value }))
                }
              />
            </div>
            <label className="flex min-h-10 items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={editSessionForm.hasEndTime}
                disabled={Boolean(currentSession?.endTime)}
                onChange={event =>
                  setEditSessionForm(form => ({
                    ...form,
                    hasEndTime: event.target.checked,
                  }))
                }
              />
              記錄實際結束時間（不勾選則維持未結束）
            </label>
            {editSessionForm.hasEndTime && (
              <label className="block text-xs text-muted-foreground">
                結束日期（香港時間，支援跨日）
                <Input
                  aria-label="修改課程結束日期"
                  type="date"
                  value={editSessionForm.endDate}
                  onChange={event =>
                    setEditSessionForm(form => ({
                      ...form,
                      endDate: event.target.value,
                    }))
                  }
                  className="mt-1"
                />
              </label>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  開始時間（HH:MM）
                </label>
                <div className="flex gap-1">
                  <Input
                    aria-label="開始小時"
                    inputMode="numeric"
                    className="w-full text-center"
                    maxLength={2}
                    value={editSessionForm.startHH}
                    onChange={e =>
                      setEditSessionForm(f => ({
                        ...f,
                        startHH: e.target.value.replace(/\D/g, "").slice(0, 2),
                      }))
                    }
                    placeholder="08"
                  />
                  <span className="self-center text-muted-foreground">:</span>
                  <Input
                    aria-label="開始分鐘"
                    inputMode="numeric"
                    className="w-full text-center"
                    maxLength={2}
                    value={editSessionForm.startMM}
                    onChange={e =>
                      setEditSessionForm(f => ({
                        ...f,
                        startMM: e.target.value.replace(/\D/g, "").slice(0, 2),
                      }))
                    }
                    placeholder="00"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  結束時間（HH:MM）
                </label>
                <div className="flex gap-1">
                  <Input
                    aria-label="結束小時"
                    inputMode="numeric"
                    disabled={!editSessionForm.hasEndTime}
                    className="w-full text-center"
                    maxLength={2}
                    value={editSessionForm.endHH}
                    onChange={e =>
                      setEditSessionForm(f => ({
                        ...f,
                        endHH: e.target.value.replace(/\D/g, "").slice(0, 2),
                      }))
                    }
                    placeholder="09"
                  />
                  <span className="self-center text-muted-foreground">:</span>
                  <Input
                    aria-label="結束分鐘"
                    inputMode="numeric"
                    disabled={!editSessionForm.hasEndTime}
                    className="w-full text-center"
                    maxLength={2}
                    value={editSessionForm.endMM}
                    onChange={e =>
                      setEditSessionForm(f => ({
                        ...f,
                        endMM: e.target.value.replace(/\D/g, "").slice(0, 2),
                      }))
                    }
                    placeholder="00"
                  />
                </div>
              </div>
            </div>
            <label className="block text-xs text-muted-foreground">
              實際課程時長（分鐘，請自行核對）
              <Input
                aria-label="修改有效訓練時長"
                type="number"
                inputMode="decimal"
                min="1"
                max={MAX_WORKOUT_MINUTES}
                className="mt-1 h-11"
                value={editSessionForm.duration}
                onChange={event =>
                  setEditSessionForm(form => ({
                    ...form,
                    duration: event.target.value,
                  }))
                }
                placeholder="未知可留空，請勿把離開健身室後的時間計入"
              />
            </label>
            <p className="text-[11px] leading-5 text-muted-foreground">
              {timeDetails?.source === "original"
                ? `原始未核對時長：${timeDetails.actualMinutes} 分鐘。`
                : timeDetails?.needsReview
                  ? "實際時長未知或無效，需核對。"
                  : ""}
              只自動填入已核對時長；不會填入熱量模型的組數推估時間。修改分鐘不會改寫舊開始／結束時間；未結束歷史課程不會以現在時間自動結束。舊時間欄位可能只是日期標記，除非你自行修改，否則保留原值。
            </p>
            {editDurationPreview && (
              <section aria-label="未儲存時長修正預覽">
                <p className="mb-2 text-xs font-semibold">
                  未儲存預覽 · 儲存後才套用時長修正
                </p>
                <WorkoutEnergyPanel estimate={editDurationPreview} />
              </section>
            )}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                備註（選填）
              </label>
              <Input
                value={editSessionForm.notes}
                onChange={e =>
                  setEditSessionForm(f => ({ ...f, notes: e.target.value }))
                }
                placeholder="備註…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditSessionDialog(false)}
            >
              取消
            </Button>
            <Button
              onClick={handleSaveEditSession}
              disabled={updateSession.isPending}
            >
              {updateSession.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showFinishDialog}
        onOpenChange={open => {
          if (!finishLoading) setShowFinishDialog(open);
        }}
      >
        <DialogContent className="workout-studio-dialog max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>結束訓練前核對</DialogTitle>
          </DialogHeader>
          <p className="text-xs leading-5 text-muted-foreground">
            請核對實際課程分鐘（排除長時間離開／閒置）。組數推估的熱量有效分鐘不是實際課程時長，不能自動代填。只有下方確認才會儲存。
          </p>
          {timeDetails?.source === "original" && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              原始值 {timeDetails.actualMinutes}{" "}
              分鐘尚未核對，請自行輸入實際時間。
            </p>
          )}
          {timeDetails?.elapsedMinutes != null && (
            <div className="text-xs leading-5">
              <p>
                本次即時課程經過 {Math.floor(timeDetails.elapsedMinutes)}{" "}
                分鐘；包含閒置，請先核對。
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-1"
                disabled={
                  timeDetails.elapsedMinutes < 1 ||
                  timeDetails.elapsedMinutes > MAX_WORKOUT_MINUTES
                }
                onClick={() =>
                  setFinishForm(form => ({
                    ...form,
                    duration: String(Math.round(timeDetails.elapsedMinutes!)),
                  }))
                }
              >
                使用經過時間（仍需確認儲存）
              </Button>
            </div>
          )}
          <section aria-label="未儲存熱量預覽">
            <p className="mb-2 text-xs font-semibold">
              未儲存預覽 · 使用目前組數及你輸入的分鐘／強度／體重
            </p>
            {finishForm.duration.trim() && (
              <p className="mb-2 text-xs text-muted-foreground">
                {isZh
                  ? "你核對的實際課程時長"
                  : "Reviewed actual session duration"}
                : {finishForm.duration} {isZh ? "分鐘" : "min"} ·{" "}
                {isZh
                  ? "模型有效分鐘不等於課程時長"
                  : "Model time is not session time"}
              </p>
            )}
            {finishPreview ? (
              <WorkoutEnergyPanel estimate={finishPreview} />
            ) : (
              <p className="text-xs text-muted-foreground">
                請填寫有效分鐘以顯示預覽；尚未儲存任何變更。
              </p>
            )}
          </section>
          <label className="block text-xs font-medium text-muted-foreground">
            實際課程時長（分鐘）
            <Input
              aria-label="結束訓練有效時長"
              type="number"
              inputMode="decimal"
              min="1"
              max={MAX_WORKOUT_MINUTES}
              className="mt-1 h-11"
              value={finishForm.duration}
              onChange={event =>
                setFinishForm(form => ({
                  ...form,
                  duration: event.target.value,
                }))
              }
              placeholder="請填寫實際分鐘，例如 45"
            />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            訓練強度
            <select
              aria-label="結束訓練強度"
              className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={finishForm.intensity}
              onChange={event =>
                setFinishForm(form => ({
                  ...form,
                  intensity: event.target.value as typeof form.intensity,
                }))
              }
            >
              <option value="light">輕量 · 輕鬆、較多休息</option>
              <option value="moderate">中等 · 一般力量訓練</option>
              <option value="vigorous">高強度 · 循環／高密度訓練</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            本次參考體重修正（kg，選填）
            <Input
              aria-label="本次參考體重修正"
              type="number"
              inputMode="decimal"
              min="20"
              max="350"
              step="0.1"
              className="mt-1 h-11"
              value={finishForm.bodyWeightKg}
              onChange={event =>
                setFinishForm(form => ({
                  ...form,
                  bodyWeightKg: event.target.value,
                }))
              }
              placeholder={
                calorieEstimate?.bodyWeightKg != null
                  ? `留空沿用 ${calorieEstimate.bodyWeightKg} kg`
                  : "留空使用後端體重來源"
              }
            />
          </label>
          <p className="text-[11px] leading-5 text-muted-foreground">
            體重修正只用於本次課程，不會自動新增或修改身體數據。下方確認才會儲存。
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={finishLoading}
              onClick={() => setShowFinishDialog(false)}
            >
              返回訓練
            </Button>
            <Button
              disabled={finishLoading || !finishForm.duration.trim()}
              onClick={handleFinishSession}
            >
              {finishLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              確認結束並儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Exercise Analysis Dialog */}
      <Dialog open={showAiAnalysis} onOpenChange={setShowAiAnalysis}>
        <DialogContent className="workout-studio-dialog max-w-lg">
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
                <p className="text-sm text-foreground leading-relaxed">
                  {aiAnalysisResult.analysis}
                </p>
              </div>
              {aiAnalysisResult.recommendations.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    個人化建議
                  </p>
                  {aiAnalysisResult.recommendations.map((rec, i) => (
                    <div
                      key={i}
                      className="flex gap-3 bg-card border border-border rounded-xl p-3"
                    >
                      <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                          {i + 1}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {rec.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {rec.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAiAnalysis(false)}>
              關閉
            </Button>
            {!aiAnalysisLoading && (
              <Button
                variant="outline"
                className="gap-2 text-purple-600"
                onClick={() => {
                  setAiAnalysisResult(null);
                  setAiAnalysisLoading(true);
                  analyzeExercise.mutate({ exerciseName: aiAnalysisExercise! });
                }}
              >
                <Sparkles className="w-4 h-4" /> 重新分析
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
