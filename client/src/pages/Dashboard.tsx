import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Utensils, Dumbbell, Scale, Heart, Moon, Flame, Zap,
  TrendingUp, TrendingDown, Minus, Activity, Target, Award,
  ChevronRight, Sparkles, Calendar
} from "lucide-react";
import { Link } from "wouter";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import { format, subDays } from "date-fns";

const CALORIE_GOAL = 2000;
const PROTEIN_GOAL = 150;
const CARBS_GOAL = 250;
const FAT_GOAL = 65;

function StatCard({ title, value, unit, subtitle, icon: Icon, color, trend, href }: any) {
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend > 0 ? "text-emerald-400" : trend < 0 ? "text-rose-400" : "text-muted-foreground";
  return (
    <Link href={href || "#"}>
      <div className="bg-card border border-border rounded-2xl p-5 card-glow cursor-pointer stagger-item group">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">{title}</p>
        <div className="flex items-end gap-1.5">
          <span className="metric-value text-2xl text-foreground">{value ?? "—"}</span>
          {unit && <span className="text-muted-foreground text-sm mb-0.5">{unit}</span>}
        </div>
        {subtitle && (
          <div className={`flex items-center gap-1 mt-1.5 text-xs ${trendColor}`}>
            <TrendIcon className="w-3 h-3" />
            <span>{subtitle}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

function MacroRing({ label, value, goal, color }: any) {
  const pct = Math.min((value / goal) * 100, 100);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-14 h-14">
        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="22" fill="none" stroke="currentColor" strokeWidth="5" className="text-muted/30" />
          <circle cx="28" cy="28" r="22" fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={`${2 * Math.PI * 22}`}
            strokeDashoffset={`${2 * Math.PI * 22 * (1 - pct / 100)}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 800ms cubic-bezier(0.23,1,0.32,1)" }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">
          {Math.round(pct)}%
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xs font-semibold text-foreground">{Math.round(value)}g</p>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-xl text-xs">
        <p className="text-muted-foreground mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }} className="font-semibold">{p.name}: {p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { data: summary, isLoading } = trpc.dashboard.getSummary.useQuery();
  const { data: bodyData } = trpc.body.getAll.useQuery({ limit: 14 });
  const { data: sleepData } = trpc.sleep.getAll.useQuery({ limit: 7 });

  const today = format(new Date(), "EEEE, d MMMM yyyy");

  const weightTrend = useMemo(() => {
    if (!bodyData) return [];
    return [...bodyData].reverse().slice(-10).map(d => ({
      date: d.date.slice(5),
      weight: d.weight,
      fat: d.bodyFatPct,
      muscle: d.muscleMass,
    }));
  }, [bodyData]);

  const sleepTrend = useMemo(() => {
    if (!sleepData) return [];
    return [...sleepData].reverse().map(d => ({
      date: d.date.slice(5),
      score: d.score,
      hr: d.restingHr,
    }));
  }, [sleepData]);

  const weekCalories = useMemo(() => {
    if (!summary?.weekMeals) return [];
    const map: Record<string, number> = {};
    summary.weekMeals.forEach(m => {
      map[m.date] = (map[m.date] || 0) + m.calories;
    });
    return Array.from({ length: 7 }, (_, i) => {
      const d = format(subDays(new Date(), 6 - i), "yyyy-MM-dd");
      return { date: format(subDays(new Date(), 6 - i), "EEE"), cal: Math.round(map[d] || 0) };
    });
  }, [summary]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted/30 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  const { today: t, workoutStreak, latestBody, prevBody, latestSleep, latestHr } = summary || {};
  const weightDiff = latestBody && prevBody ? (latestBody.weight ?? 0) - (prevBody.weight ?? 0) : 0;
  const calPct = Math.min(((t?.calories || 0) / CALORIE_GOAL) * 100, 100);

  const macroData = [
    { name: "Protein", value: t?.protein || 0, color: "oklch(0.72 0.19 160)" },
    { name: "Carbs", value: t?.carbs || 0, color: "oklch(0.75 0.17 280)" },
    { name: "Fat", value: t?.fat || 0, color: "oklch(0.68 0.22 25)" },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Good day 👋</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{today}</p>
        </div>
        <Link href="/insights">
          <Button size="sm" className="gap-2">
            <Sparkles className="w-3.5 h-3.5" />
            AI Insights
          </Button>
        </Link>
      </div>

      {/* Today's Calorie Progress */}
      <div className="bg-card border border-border rounded-2xl p-5 card-glow">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Today's Calories</p>
            <div className="flex items-end gap-2 mt-1">
              <span className="metric-value text-4xl text-foreground">{Math.round(t?.calories || 0)}</span>
              <span className="text-muted-foreground text-sm mb-1">/ {CALORIE_GOAL} kcal</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {macroData.map(m => (
              <MacroRing key={m.name} label={m.name}
                value={m.value}
                goal={m.name === "Protein" ? PROTEIN_GOAL : m.name === "Carbs" ? CARBS_GOAL : FAT_GOAL}
                color={m.color}
              />
            ))}
          </div>
        </div>
        <Progress value={calPct} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
          <span>{Math.round(CALORIE_GOAL - (t?.calories || 0))} kcal remaining</span>
          <span>{Math.round(calPct)}% of goal</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Workout Streak" value={workoutStreak || 0} unit="days"
          subtitle={workoutStreak ? `${workoutStreak} day streak 🔥` : "No streak yet"}
          icon={Dumbbell} color="bg-purple-500/20 text-purple-400" trend={workoutStreak ? 1 : 0} href="/workout" />
        <StatCard title="Weight" value={latestBody?.weight} unit="kg"
          subtitle={weightDiff !== 0 ? `${weightDiff > 0 ? "+" : ""}${weightDiff.toFixed(1)} kg` : "No change"}
          icon={Scale} color="bg-emerald-500/20 text-emerald-400" trend={-weightDiff} href="/body" />
        <StatCard title="Sleep Score" value={latestSleep?.score} unit="/100"
          subtitle={latestSleep?.quality || "No data"}
          icon={Moon} color="bg-blue-500/20 text-blue-400" trend={0} href="/sleep" />
        <StatCard title="Resting HR" value={latestHr?.restingHr} unit="bpm"
          subtitle="Latest reading"
          icon={Heart} color="bg-rose-500/20 text-rose-400" trend={0} href="/heart-rate" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly Calories */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Weekly Calories</h3>
            <Badge variant="secondary" className="text-xs">7 days</Badge>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weekCalories} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.018 240)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="cal" name="Calories" fill="oklch(0.78 0.20 50)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Weight Trend */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Body Composition</h3>
            <Badge variant="secondary" className="text-xs">Recent</Badge>
          </div>
          {weightTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={weightTrend}>
                <defs>
                  <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.72 0.19 160)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="oklch(0.72 0.19 160)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.018 240)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} width={35} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="weight" name="Weight (kg)" stroke="oklch(0.72 0.19 160)" fill="url(#wGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
              Log body metrics to see trends
            </div>
          )}
        </div>
      </div>

      {/* Sleep Trend */}
      {sleepTrend.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Sleep Score & Resting HR</h3>
            <Badge variant="secondary" className="text-xs">Last 7 nights</Badge>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={sleepTrend}>
              <defs>
                <linearGradient id="sGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.65 0.18 200)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.65 0.18 200)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.018 240)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} width={30} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="score" name="Sleep Score" stroke="oklch(0.65 0.18 200)" fill="url(#sGrad)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="hr" name="Resting HR" stroke="oklch(0.68 0.22 25)" fill="none" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent Workouts */}
      {summary?.recentSessions && summary.recentSessions.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Recent Workouts</h3>
            <Link href="/workout">
              <Button variant="ghost" size="sm" className="text-xs gap-1">View all <ChevronRight className="w-3 h-3" /></Button>
            </Link>
          </div>
          <div className="space-y-2">
            {summary.recentSessions.slice(0, 4).map(s => (
              <div key={s.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                  <Dumbbell className="w-4 h-4 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{s.name || "Workout Session"}</p>
                  <p className="text-xs text-muted-foreground">{s.date} {s.duration ? `· ${s.duration} min` : ""}</p>
                </div>
                {s.totalVolume && (
                  <span className="text-xs font-semibold text-primary">{Math.round(s.totalVolume)} kg</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: "/nutrition", label: "Log Meal", icon: Utensils, color: "bg-amber-500/20 text-amber-400" },
          { href: "/workout", label: "Start Workout", icon: Dumbbell, color: "bg-purple-500/20 text-purple-400" },
          { href: "/body", label: "Log Weight", icon: Scale, color: "bg-emerald-500/20 text-emerald-400" },
          { href: "/sleep", label: "Log Sleep", icon: Moon, color: "bg-blue-500/20 text-blue-400" },
        ].map(a => (
          <Link key={a.href} href={a.href}>
            <div className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-primary/50 transition-colors">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${a.color}`}>
                <a.icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium text-foreground">{a.label}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
