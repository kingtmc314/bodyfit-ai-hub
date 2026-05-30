import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine, ComposedChart,
} from "recharts";
import { format, parseISO } from "date-fns";
import { TrendingUp, TrendingDown, Minus, Activity, Scale, Heart, Moon, Utensils } from "lucide-react";

// ─── Date range options ───────────────────────────────────────────────────────
const RANGES = [
  { label: "7D",  days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y",  days: 365 },
] as const;

// ─── Shared tooltip style ─────────────────────────────────────────────────────
const TooltipStyle = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    fontSize: "12px",
    color: "hsl(var(--card-foreground))",
  },
  labelStyle: { color: "hsl(var(--muted-foreground))", marginBottom: 4 },
};

// ─── Trend badge helper ───────────────────────────────────────────────────────
function TrendBadge({ values, unit = "", inverse = false }: { values: (number | null)[]; unit?: string; inverse?: boolean }) {
  const filtered = values.filter((v): v is number => v !== null && v !== undefined);
  if (filtered.length < 2) return null;
  const diff = filtered[filtered.length - 1] - filtered[0];
  const pct = ((diff / filtered[0]) * 100).toFixed(1);
  const isPositive = diff > 0;
  const isGood = inverse ? !isPositive : isPositive;
  if (Math.abs(diff) < 0.01) return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Minus className="w-3 h-3" /> Stable
    </span>
  );
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${isGood ? "text-emerald-500" : "text-rose-500"}`}>
      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {isPositive ? "+" : ""}{diff.toFixed(1)}{unit} ({pct}%)
    </span>
  );
}

// ─── Chart skeleton ───────────────────────────────────────────────────────────
function ChartSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-[220px] w-full rounded-lg" />
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
      {message}
    </div>
  );
}

// ─── Format date for X axis ───────────────────────────────────────────────────
function fmtDate(dateStr: string, days: number) {
  try {
    const d = parseISO(dateStr);
    return days <= 30 ? format(d, "MM/dd") : format(d, "MM/dd");
  } catch {
    return dateStr;
  }
}


// ─── Error state ─────────────────────────────────────────────────────────────
function ErrorChart({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="h-[220px] flex flex-col items-center justify-center gap-3">
      <p className="text-sm text-rose-500">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>
    </div>
  );
}

// ─── Goal type (matches server enum) ────────────────────────────────────────
type GoalRecord = { goalType: string; targetValue: number | string; unit?: string | null };

// ─── Body Composition Charts ──────────────────────────────────────────────────
function BodyCharts({ days, goals }: { days: number; goals: GoalRecord[] }) {
  const { data, isLoading, error, refetch } = trpc.charts.bodyHistory.useQuery({ days });
  const chartData = useMemo(() =>
    (data ?? []).map(r => ({
      date: r.date,
      label: fmtDate(r.date, days),
      weight: r.weight ?? null,
      bodyFat: r.bodyFatPct ?? null,
      muscle: r.muscleMass ?? null,
      bmi: r.bmi ?? null,
    })), [data, days]);

  if (isLoading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><ChartSkeleton /><ChartSkeleton /></div>;
  if (error) return <ErrorChart message={String(error)} onRetry={refetch} />;
  if (!chartData.length) return <EmptyChart message="No body composition data for this period. Import CSV data to see trends." />;

  const weights = chartData.map(d => d.weight);
  const fats = chartData.map(d => d.bodyFat);
  const weightGoal = goals.find(g => g.goalType === "weight");
  const fatGoal = goals.find(g => g.goalType === "body_fat_pct");
  const muscleGoal = goals.find(g => g.goalType === "muscle_mass");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Weight & Muscle Line Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Weight & Muscle Mass</CardTitle>
            <TrendBadge values={weights} unit=" kg" inverse={false} />
          </div>
          <CardDescription className="text-xs">kg over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={["auto", "auto"]} />
              <Tooltip {...TooltipStyle} formatter={(v: number) => [`${v?.toFixed(1)} kg`]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {weightGoal && <ReferenceLine y={Number(weightGoal.targetValue)} stroke="#f97316" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: `Goal: ${weightGoal.targetValue}kg`, fontSize: 9, fill: "#f97316", position: "insideTopRight" }} />}
              {muscleGoal && <ReferenceLine y={Number(muscleGoal.targetValue)} stroke="#22c55e" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: `Goal: ${muscleGoal.targetValue}kg`, fontSize: 9, fill: "#22c55e", position: "insideBottomRight" }} />}
              <Line type="monotone" dataKey="weight" stroke="#f97316" strokeWidth={2} dot={false} name="Weight (kg)" connectNulls />
              <Line type="monotone" dataKey="muscle" stroke="#22c55e" strokeWidth={2} dot={false} name="Muscle (kg)" connectNulls strokeDasharray="4 2" />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Body Fat % Bar Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Body Fat %</CardTitle>
            <TrendBadge values={fats} unit="%" inverse={true} />
          </div>
          <CardDescription className="text-xs">% body fat over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="fatGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={["auto", "auto"]} unit="%" />
              <Tooltip {...TooltipStyle} formatter={(v: number) => [`${v?.toFixed(1)}%`, "Body Fat"]} />
              {fatGoal && <ReferenceLine y={Number(fatGoal.targetValue)} stroke="#f43f5e" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: `Goal: ${fatGoal.targetValue}%`, fontSize: 9, fill: "#f43f5e", position: "insideTopRight" }} />}
              <Area type="monotone" dataKey="bodyFat" stroke="#f43f5e" strokeWidth={2} fill="url(#fatGrad)" name="Body Fat %" connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* BMI Line Chart */}
      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">BMI Trend</CardTitle>
          <CardDescription className="text-xs">Body Mass Index — healthy range: 18.5 – 24.9</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={[15, 35]} />
              <Tooltip {...TooltipStyle} formatter={(v: number) => [v?.toFixed(1), "BMI"]} />
              <ReferenceLine y={18.5} stroke="#22c55e" strokeDasharray="4 2" label={{ value: "18.5", fontSize: 9, fill: "#22c55e" }} />
              <ReferenceLine y={24.9} stroke="#f97316" strokeDasharray="4 2" label={{ value: "24.9", fontSize: 9, fill: "#f97316" }} />
              <ReferenceLine y={30} stroke="#f43f5e" strokeDasharray="4 2" label={{ value: "30", fontSize: 9, fill: "#f43f5e" }} />
              <Line type="monotone" dataKey="bmi" stroke="#a855f7" strokeWidth={2} dot={false} name="BMI" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sleep Charts ─────────────────────────────────────────────────────────────
function SleepCharts({ days, goals }: { days: number; goals: GoalRecord[] }) {
  const { data, isLoading, error, refetch } = trpc.charts.sleepHistory.useQuery({ days });
  const chartData = useMemo(() =>
    (data ?? []).map(r => ({
      date: r.date,
      label: fmtDate(r.date, days),
      score: r.sleepScore ?? null,
      duration: r.sleepDuration ?? null,
      deep: r.deepSleep ?? null,
      rem: r.remSleep ?? null,
      light: r.lightSleep ?? null,
      battery: r.bodyBattery ?? null,
    })), [data, days]);

  if (isLoading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><ChartSkeleton /><ChartSkeleton /></div>;
  if (error) return <ErrorChart message={String(error)} onRetry={refetch} />;
  if (!chartData.length) return <EmptyChart message="No sleep data for this period. Import CSV data to see trends." />;

  const scores = chartData.map(d => d.score);
  const durations = chartData.map(d => d.duration);
  const sleepScoreGoal = goals.find(g => g.goalType === "sleep_score");
  const sleepDurGoal = goals.find(g => g.goalType === "sleep_duration");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Sleep Score Line Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Sleep Score</CardTitle>
            <TrendBadge values={scores} unit=" pts" />
          </div>
          <CardDescription className="text-xs">Garmin sleep score (0–100)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
              <Tooltip {...TooltipStyle} formatter={(v: number) => [v, "Sleep Score"]} />
              <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="4 2" label={{ value: "Good", fontSize: 9, fill: "#22c55e" }} />
              {sleepScoreGoal && <ReferenceLine y={Number(sleepScoreGoal.targetValue)} stroke="#8b5cf6" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: `Goal: ${sleepScoreGoal.targetValue}`, fontSize: 9, fill: "#8b5cf6", position: "insideTopRight" }} />}
              <Area type="monotone" dataKey="score" stroke="#8b5cf6" strokeWidth={2} fill="url(#scoreGrad)" name="Sleep Score" connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Sleep Duration Line Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Sleep Duration</CardTitle>
            <TrendBadge values={durations} unit="h" />
          </div>
          <CardDescription className="text-xs">Hours of sleep per night</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={[0, 12]} unit="h" />
              <Tooltip {...TooltipStyle} formatter={(v: number) => [`${v?.toFixed(1)}h`, "Duration"]} />
              <ReferenceLine y={7} stroke="#22c55e" strokeDasharray="4 2" label={{ value: "7h", fontSize: 9, fill: "#22c55e" }} />
              <ReferenceLine y={9} stroke="#f97316" strokeDasharray="4 2" label={{ value: "9h", fontSize: 9, fill: "#f97316" }} />
              {sleepDurGoal && <ReferenceLine y={Number(sleepDurGoal.targetValue)} stroke="#06b6d4" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: `Goal: ${sleepDurGoal.targetValue}h`, fontSize: 9, fill: "#06b6d4", position: "insideTopRight" }} />}
              <Line type="monotone" dataKey="duration" stroke="#06b6d4" strokeWidth={2} dot={false} name="Duration (h)" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Sleep Stages Stacked Bar */}
      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Sleep Stages Breakdown</CardTitle>
          <CardDescription className="text-xs">Deep, REM, and Light sleep per night (hours)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} barSize={days <= 30 ? 14 : 6}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" unit="h" />
              <Tooltip {...TooltipStyle} formatter={(v: number) => [`${v?.toFixed(1)}h`]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="deep" stackId="stages" fill="#312e81" name="Deep" radius={[0, 0, 0, 0]} />
              <Bar dataKey="rem" stackId="stages" fill="#8b5cf6" name="REM" />
              <Bar dataKey="light" stackId="stages" fill="#c4b5fd" name="Light" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Heart Rate Charts ────────────────────────────────────────────────────────
function HeartRateCharts({ days, goals }: { days: number; goals: GoalRecord[] }) {
  const { data, isLoading, error, refetch } = trpc.charts.heartRateHistory.useQuery({ days });
  const chartData = useMemo(() =>
    (data ?? []).map(r => ({
      date: r.date,
      label: fmtDate(r.date, days),
      resting: r.restingHr ?? null,
      high: r.highHr ?? null,
      avg: r.avgHr ?? null,
      hrv: r.hrv ?? null,
    })), [data, days]);

  if (isLoading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><ChartSkeleton /><ChartSkeleton /></div>;
  if (error) return <ErrorChart message={String(error)} onRetry={refetch} />;
  if (!chartData.length) return <EmptyChart message="No heart rate data for this period. Import CSV data to see trends." />;

  const restings = chartData.map(d => d.resting);
  const hrvs = chartData.map(d => d.hrv);
  const restingHrGoal = goals.find(g => g.goalType === "resting_hr");
  const hrvGoal = goals.find(g => g.goalType === "hrv");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Resting HR Line Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Resting Heart Rate</CardTitle>
            <TrendBadge values={restings} unit=" bpm" inverse={true} />
          </div>
          <CardDescription className="text-xs">bpm — lower is generally better</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={["auto", "auto"]} unit=" bpm" />
              <Tooltip {...TooltipStyle} formatter={(v: number) => [`${v} bpm`, "Resting HR"]} />
              <ReferenceLine y={60} stroke="#22c55e" strokeDasharray="4 2" label={{ value: "60", fontSize: 9, fill: "#22c55e" }} />
              <ReferenceLine y={100} stroke="#f43f5e" strokeDasharray="4 2" label={{ value: "100", fontSize: 9, fill: "#f43f5e" }} />
              {restingHrGoal && <ReferenceLine y={Number(restingHrGoal.targetValue)} stroke="#f43f5e" strokeDasharray="6 3" strokeWidth={2} label={{ value: `Goal: ${restingHrGoal.targetValue}bpm`, fontSize: 9, fill: "#f43f5e", position: "insideTopRight" }} />}
              <Line type="monotone" dataKey="resting" stroke="#f43f5e" strokeWidth={2} dot={false} name="Resting HR" connectNulls />
              <Line type="monotone" dataKey="avg" stroke="#fb923c" strokeWidth={1.5} dot={false} name="Avg HR" connectNulls strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* HRV Area Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Heart Rate Variability (HRV)</CardTitle>
            <TrendBadge values={hrvs} unit=" ms" />
          </div>
          <CardDescription className="text-xs">ms — higher indicates better recovery</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="hrvGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={["auto", "auto"]} unit=" ms" />
              <Tooltip {...TooltipStyle} formatter={(v: number) => [`${v} ms`, "HRV"]} />
              {hrvGoal && <ReferenceLine y={Number(hrvGoal.targetValue)} stroke="#22c55e" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: `Goal: ${hrvGoal.targetValue}ms`, fontSize: 9, fill: "#22c55e", position: "insideTopRight" }} />}
              <Area type="monotone" dataKey="hrv" stroke="#22c55e" strokeWidth={2} fill="url(#hrvGrad)" name="HRV (ms)" connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* HR Range Bar Chart */}
      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Daily HR Range</CardTitle>
          <CardDescription className="text-xs">Resting vs High heart rate per day</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} barSize={days <= 30 ? 12 : 5}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" unit=" bpm" />
              <Tooltip {...TooltipStyle} formatter={(v: number) => [`${v} bpm`]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="resting" fill="#22c55e" name="Resting HR" radius={[2, 2, 0, 0]} />
              <Bar dataKey="high" fill="#f43f5e" name="High HR" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Workout Charts ───────────────────────────────────────────────────────────
function WorkoutCharts({ days, goals }: { days: number; goals: GoalRecord[] }) {
  const { data, isLoading, error, refetch } = trpc.charts.workoutHistory.useQuery({ days });
  const chartData = useMemo(() =>
    (data ?? []).map(r => ({
      date: r.date,
      label: fmtDate(r.date, days),
      duration: r.duration ? Math.round(r.duration / 60) : null, // seconds → minutes
      volume: r.totalVolume ?? null,
      name: r.name ?? "Workout",
    })), [data, days]);

  if (isLoading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><ChartSkeleton /><ChartSkeleton /></div>;
  if (error) return <ErrorChart message={String(error)} onRetry={refetch} />;
  if (!chartData.length) return <EmptyChart message="No workout data for this period. Log workouts or import CSV data to see trends." />;

  const durations = chartData.map(d => d.duration);
  const workoutDurGoal = goals.find(g => g.goalType === "workout_duration");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Workout Duration Bar Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Workout Duration</CardTitle>
            <TrendBadge values={durations} unit=" min" />
          </div>
          <CardDescription className="text-xs">Minutes per session</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} barSize={days <= 30 ? 14 : 6}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" unit=" min" />
              <Tooltip {...TooltipStyle} formatter={(v: number) => [`${v} min`, "Duration"]} />
              {workoutDurGoal && <ReferenceLine y={Number(workoutDurGoal.targetValue)} stroke="#3b82f6" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: `Goal: ${workoutDurGoal.targetValue}min`, fontSize: 9, fill: "#3b82f6", position: "insideTopRight" }} />}
              <Bar dataKey="duration" fill="#3b82f6" name="Duration (min)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Total Volume Line Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
          <CardDescription className="text-xs">kg lifted per session (sets × reps × weight)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip {...TooltipStyle} formatter={(v: number) => [`${v?.toFixed(0)} kg`, "Volume"]} />
              <Area type="monotone" dataKey="volume" stroke="#3b82f6" strokeWidth={2} fill="url(#volGrad)" name="Volume (kg)" connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Nutrition Charts ─────────────────────────────────────────────────────────
function NutritionCharts({ days, goals }: { days: number; goals: GoalRecord[] }) {
  const { data, isLoading, error, refetch } = trpc.charts.calorieHistory.useQuery({ days });
  const chartData = useMemo(() =>
    (data ?? []).map(r => ({
      date: r.date,
      label: fmtDate(r.date, days),
      calories: Number(r.totalCalories) || 0,
      protein: Number(r.totalProtein) || 0,
      carbs: Number(r.totalCarbs) || 0,
      fat: Number(r.totalFat) || 0,
    })), [data, days]);

  if (isLoading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><ChartSkeleton /><ChartSkeleton /></div>;
  if (error) return <ErrorChart message={String(error)} onRetry={refetch} />;
  if (!chartData.length) return <EmptyChart message="No nutrition data for this period. Log meals to see calorie trends." />;

  const cals = chartData.map(d => d.calories);
  const calGoal = goals.find(g => g.goalType === "daily_calories");
  const proteinGoal = goals.find(g => g.goalType === "daily_protein");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Daily Calories Bar Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Daily Calories</CardTitle>
            <TrendBadge values={cals} unit=" kcal" />
          </div>
          <CardDescription className="text-xs">Total kcal per day</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} barSize={days <= 30 ? 14 : 6}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" unit=" kcal" />
              <Tooltip {...TooltipStyle} formatter={(v: number) => [`${Math.round(v)} kcal`, "Calories"]} />
              {calGoal
                ? <ReferenceLine y={Number(calGoal.targetValue)} stroke="#f97316" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: `Goal: ${calGoal.targetValue}kcal`, fontSize: 9, fill: "#f97316", position: "insideTopRight" }} />
                : <ReferenceLine y={2000} stroke="#f97316" strokeDasharray="4 2" label={{ value: "2000", fontSize: 9, fill: "#f97316" }} />
              }
              <Bar dataKey="calories" fill="#f97316" name="Calories" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Macro Stacked Bar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Macronutrients</CardTitle>
          <CardDescription className="text-xs">Protein, Carbs, Fat per day (g)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} barSize={days <= 30 ? 14 : 6}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" unit="g" />
              <Tooltip {...TooltipStyle} formatter={(v: number) => [`${Math.round(v)}g`]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {proteinGoal && <ReferenceLine y={Number(proteinGoal.targetValue)} stroke="#22c55e" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: `Protein Goal: ${proteinGoal.targetValue}g`, fontSize: 9, fill: "#22c55e", position: "insideTopRight" }} />}
              <Bar dataKey="protein" stackId="macro" fill="#22c55e" name="Protein" />
              <Bar dataKey="carbs" stackId="macro" fill="#f97316" name="Carbs" />
              <Bar dataKey="fat" stackId="macro" fill="#f43f5e" name="Fat" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Trends Page ─────────────────────────────────────────────────────────
export default function Trends() {
  const { t } = useTranslation();
  const [days, setDays] = useState<number>(30);
  const { data: goalsData } = trpc.goals.getGoals.useQuery();
  const goals: GoalRecord[] = goalsData ?? [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("nav.trends", "Trends")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Historical health data visualized</p>
        </div>
        {/* Date range selector */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {RANGES.map(r => (
            <Button
              key={r.days}
              variant={days === r.days ? "default" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setDays(r.days)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Tabs for each data category */}
      <Tabs defaultValue="body">
        <TabsList className="grid grid-cols-5 w-full max-w-lg">
          <TabsTrigger value="body" className="text-xs gap-1">
            <Scale className="w-3.5 h-3.5" /> Body
          </TabsTrigger>
          <TabsTrigger value="sleep" className="text-xs gap-1">
            <Moon className="w-3.5 h-3.5" /> Sleep
          </TabsTrigger>
          <TabsTrigger value="heart" className="text-xs gap-1">
            <Heart className="w-3.5 h-3.5" /> Heart
          </TabsTrigger>
          <TabsTrigger value="workout" className="text-xs gap-1">
            <Activity className="w-3.5 h-3.5" /> Workout
          </TabsTrigger>
          <TabsTrigger value="nutrition" className="text-xs gap-1">
            <Utensils className="w-3.5 h-3.5" /> Nutrition
          </TabsTrigger>
        </TabsList>

        <TabsContent value="body" className="mt-4">
          <BodyCharts days={days} goals={goals} />
        </TabsContent>
        <TabsContent value="sleep" className="mt-4">
          <SleepCharts days={days} goals={goals} />
        </TabsContent>
        <TabsContent value="heart" className="mt-4">
          <HeartRateCharts days={days} goals={goals} />
        </TabsContent>
        <TabsContent value="workout" className="mt-4">
          <WorkoutCharts days={days} goals={goals} />
        </TabsContent>
        <TabsContent value="nutrition" className="mt-4">
          <NutritionCharts days={days} goals={goals} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
