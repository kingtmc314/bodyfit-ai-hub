import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Utensils, Dumbbell, Scale, Heart, Moon, Flame,
  TrendingUp, TrendingDown, Minus, Activity, Target,
  ChevronRight, Sparkles, Sun, Zap, Droplets, Wind
} from "lucide-react";
import { Link } from "wouter";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";
import { format, subDays } from "date-fns";
import { useTranslation } from "react-i18next";
import { Streamdown } from "streamdown";

const CALORIE_GOAL = 2000;
const PROTEIN_GOAL = 150;
const CARBS_GOAL = 250;
const FAT_GOAL = 65;

function StatCard({ title, value, unit, subtitle, icon: Icon, badgeClass, trend, href }: any) {
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend > 0 ? "text-emerald-500" : trend < 0 ? "text-rose-500" : "text-muted-foreground";
  return (
    <Link href={href || "#"}>
      <div className="stat-card rounded-2xl p-4 cursor-pointer group">
        <div className="flex items-start justify-between mb-3">
          <div className={`icon-badge ${badgeClass}`}>
            <Icon className="w-4.5 h-4.5" />
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
        </div>
        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-1">{title}</p>
        <div className="flex items-end gap-1.5">
          <span className="metric-value text-2xl text-foreground">{value ?? "—"}</span>
          {unit && <span className="text-muted-foreground text-sm mb-0.5">{unit}</span>}
        </div>
        {subtitle && (
          <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${trendColor}`}>
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
          <circle cx="28" cy="28" r="22" fill="none" stroke="currentColor" strokeWidth="5" className="text-muted/40" />
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
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className="text-xs font-bold text-foreground">{Math.round(value)}g</p>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-border rounded-xl p-3 shadow-lg text-xs">
        <p className="text-muted-foreground mb-1 font-medium">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }} className="font-bold">{p.name}: {p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const [insightPeriod] = useState<"week" | "month">("week");
  const [generatingInsight, setGeneratingInsight] = useState(false);
  const [insightText, setInsightText] = useState<string>("");

  const { data: summary, isLoading } = trpc.dashboard.getSummary.useQuery();
  const { data: bodyData } = trpc.body.getAll.useQuery({ limit: 14 });
  const { data: sleepData } = trpc.sleep.getAll.useQuery({ limit: 7 });
  const generateInsightMutation = trpc.insights.generate.useMutation({
    onSuccess: (data) => {
      setInsightText(data.content || "");
      setGeneratingInsight(false);
    },
    onError: () => setGeneratingInsight(false),
  });

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12
    ? t('dashboard.greeting_morning')
    : hour < 18
      ? t('dashboard.greeting_afternoon')
      : t('dashboard.greeting_evening');

  const today = i18n.language === 'zh'
    ? format(now, "yyyy年M月d日 EEEE")
    : format(now, "EEEE, d MMMM yyyy");

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
      score: d.sleepScore,
      hr: d.pulseOx,
    }));
  }, [sleepData]);

  const weekCalories = useMemo(() => {
    if (!summary?.weekMeals) return [];
    const map: Record<string, number> = {};
    summary.weekMeals.forEach(m => {
      const dateKey = format(new Date(m.loggedAt), 'yyyy-MM-dd');
      map[dateKey] = (map[dateKey] || 0) + (m.calories ?? 0);
    });
    return Array.from({ length: 7 }, (_, i) => {
      const d = format(subDays(new Date(), 6 - i), "yyyy-MM-dd");
      return { date: format(subDays(new Date(), 6 - i), "EEE"), cal: Math.round(map[d] || 0) };
    });
  }, [summary]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-32 rounded-2xl animate-pulse gradient-sunny" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-muted/30 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-48 bg-muted/30 rounded-2xl animate-pulse" />
      </div>
    );
  }

  const { today: tod, workoutStreak, latestBody, prevBody, latestSleep, latestHr } = summary || {};
  const weightDiff = latestBody && prevBody ? (latestBody.weight ?? 0) - (prevBody.weight ?? 0) : 0;
  const calPct = Math.min(((tod?.calories || 0) / CALORIE_GOAL) * 100, 100);

  const macroData = [
    { name: t('nutrition.protein').replace(' (g)', ''), value: tod?.protein || 0, color: "oklch(0.62 0.18 145)", goal: PROTEIN_GOAL },
    { name: t('nutrition.carbs').replace(' (g)', ''), value: tod?.carbs || 0, color: "oklch(0.62 0.18 230)", goal: CARBS_GOAL },
    { name: t('nutrition.fat').replace(' (g)', ''), value: tod?.fat || 0, color: "oklch(0.68 0.19 45)", goal: FAT_GOAL },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">

      {/* ── HERO BANNER ── */}
      <div className="hero-gradient rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        {/* decorative circles */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-6 right-16 w-24 h-24 rounded-full bg-white/10" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sun className="w-5 h-5 text-yellow-200" />
              <p className="text-white/80 text-sm font-semibold">{greeting},</p>
            </div>
            <h1 className="text-2xl font-extrabold text-white leading-tight">
              {(summary as any)?.user?.name || "Champion"} 💪
            </h1>
            <p className="text-white/70 text-xs mt-1">{today}</p>
          </div>
          <Link href="/insights">
            <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white border-0 gap-2 backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5" />
              {t('nav.insights')}
            </Button>
          </Link>
        </div>
        {/* Quick stats row */}
        <div className="relative z-10 grid grid-cols-3 gap-3 mt-5">
          {[
            { label: t('dashboard.calories_today'), value: `${Math.round(tod?.calories || 0)}`, unit: "kcal", icon: Flame },
            { label: t('dashboard.workout_streak'), value: `${workoutStreak || 0}`, unit: t('dashboard.days'), icon: Zap },
            { label: t('dashboard.heart_rate'), value: latestHr?.restingHr ? `${latestHr.restingHr}` : "—", unit: t('dashboard.bpm'), icon: Heart },
          ].map(s => (
            <div key={s.label} className="bg-white/15 backdrop-blur-sm rounded-2xl p-3 text-center">
              <s.icon className="w-4 h-4 text-white/80 mx-auto mb-1" />
              <p className="text-xl font-extrabold text-white">{s.value}<span className="text-xs font-medium text-white/70 ml-0.5">{s.unit}</span></p>
              <p className="text-white/60 text-xs mt-0.5 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── CALORIE PROGRESS CARD ── */}
      <div className="bg-white rounded-2xl p-5 border border-border shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">{t('dashboard.calories_today')}</p>
            <div className="flex items-end gap-2">
              <span className="metric-value text-4xl text-foreground">{Math.round(tod?.calories || 0)}</span>
              <span className="text-muted-foreground text-sm mb-1">/ {CALORIE_GOAL} {t('nutrition.kcal')}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-primary font-semibold">{Math.round(Math.max(0, CALORIE_GOAL - (tod?.calories || 0)))}</span> {t('nutrition.remaining')}
            </p>
          </div>
          <div className="flex items-center gap-5">
            {macroData.map(m => (
              <MacroRing key={m.name} label={m.name} value={m.value} goal={m.goal} color={m.color} />
            ))}
          </div>
        </div>
        <Progress value={calPct} className="h-2.5 rounded-full" />
        <div className="flex justify-between text-xs text-muted-foreground mt-1.5 font-medium">
          <span>{Math.round(calPct)}% {t('nutrition.goal')}</span>
          <span>{Math.round(CALORIE_GOAL - (tod?.calories || 0))} {t('nutrition.kcal')} {t('nutrition.remaining')}</span>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title={t('dashboard.workout_streak')}
          value={workoutStreak || 0} unit={t('dashboard.days')}
          subtitle={workoutStreak ? `${workoutStreak} ${t('dashboard.days')} 🔥` : "—"}
          icon={Dumbbell} badgeClass="icon-badge-blue" trend={workoutStreak ? 1 : 0} href="/workout"
        />
        <StatCard
          title={t('dashboard.current_weight')}
          value={latestBody?.weight} unit="kg"
          subtitle={weightDiff !== 0 ? `${weightDiff > 0 ? "+" : ""}${weightDiff.toFixed(1)} kg` : "—"}
          icon={Scale} badgeClass="icon-badge-green" trend={-weightDiff} href="/body"
        />
        <StatCard
          title={t('dashboard.sleep_score')}
          value={latestSleep?.sleepScore} unit="/100"
          subtitle={latestSleep?.sleepQuality || "—"}
          icon={Moon} badgeClass="icon-badge-purple" trend={0} href="/sleep"
        />
        <StatCard
          title={t('dashboard.heart_rate')}
          value={latestHr?.restingHr} unit={t('dashboard.bpm')}
          subtitle="Latest reading"
          icon={Heart} badgeClass="icon-badge-red" trend={0} href="/heart-rate"
        />
      </div>

      {/* ── CHARTS ROW ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly Calories */}
        <div className="bg-white rounded-2xl p-5 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-foreground">{t('dashboard.weekly_calories')}</h3>
            <span className="tag-pill tag-orange">7 {t('dashboard.days')}</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weekCalories} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.012 80)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.52 0.015 240)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.015 240)" }} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="cal" name={t('nutrition.calories')} fill="oklch(0.68 0.19 45)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Weight Trend */}
        <div className="bg-white rounded-2xl p-5 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-foreground">{t('nav.body')}</h3>
            <span className="tag-pill tag-green">Recent</span>
          </div>
          {weightTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={weightTrend}>
                <defs>
                  <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.62 0.18 145)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="oklch(0.62 0.18 145)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.012 80)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.52 0.015 240)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.015 240)" }} axisLine={false} tickLine={false} width={35} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="weight" name={t('body.weight')} stroke="oklch(0.62 0.18 145)" fill="url(#wGrad)" strokeWidth={2.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
              <Scale className="w-8 h-8 text-muted-foreground/30" />
              <p>{t('body.no_records')}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── SLEEP TREND ── */}
      {sleepTrend.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-foreground">{t('sleep.title')} & {t('heartrate.resting_hr')}</h3>
            <span className="tag-pill tag-blue">7 nights</span>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={sleepTrend}>
              <defs>
                <linearGradient id="sGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.62 0.18 270)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="oklch(0.62 0.18 270)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.012 80)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.52 0.015 240)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.015 240)" }} axisLine={false} tickLine={false} width={30} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="score" name={t('sleep.score')} stroke="oklch(0.62 0.18 270)" fill="url(#sGrad)" strokeWidth={2.5} dot={false} />
              <Area type="monotone" dataKey="hr" name={t('heartrate.resting_hr')} stroke="oklch(0.62 0.20 25)" fill="none" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── RECENT WORKOUTS ── */}
      {summary?.recentSessions && summary.recentSessions.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-foreground">{t('dashboard.recent_workouts')}</h3>
            <Link href="/workout">
              <Button variant="ghost" size="sm" className="text-xs gap-1 text-primary hover:text-primary">
                {t('common.view_all')} <ChevronRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
          <div className="space-y-2">
            {summary.recentSessions.slice(0, 4).map(s => (
              <div key={s.id} className="flex items-center gap-3 py-2.5 border-b border-border/60 last:border-0">
                <div className="icon-badge icon-badge-blue">
                  <Dumbbell className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{s.name || "Workout Session"}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(s.startTime), 'yyyy-MM-dd')}{s.duration ? ` · ${s.duration} min` : ""}</p>
                </div>
                {s.totalVolume && (
                  <span className="tag-pill tag-orange">{Math.round(s.totalVolume)} kg</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── AI INSIGHT CARD ── */}
      <div className="bg-gradient-to-br from-primary/8 via-accent/5 to-background rounded-2xl p-5 border border-primary/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="icon-badge icon-badge-orange">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-foreground">{t('dashboard.ai_insight')}</h3>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setGeneratingInsight(true);
              generateInsightMutation.mutate({});
            }}
            disabled={generatingInsight}
            className="gap-2"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {generatingInsight ? t('dashboard.generating') : t('dashboard.generate_insight')}
          </Button>
        </div>
        {insightText ? (
          <div className="text-sm text-foreground/80 leading-relaxed">
            <Streamdown>{insightText}</Streamdown>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('dashboard.no_insight')}</p>
        )}
      </div>

      {/* ── QUICK ACTIONS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: "/nutrition", labelKey: "dashboard.log_meal",    icon: Utensils, badgeClass: "icon-badge-yellow" },
          { href: "/workout",   labelKey: "dashboard.log_workout", icon: Dumbbell, badgeClass: "icon-badge-blue"   },
          { href: "/body",      labelKey: "dashboard.log_weight",  icon: Scale,    badgeClass: "icon-badge-green"  },
          { href: "/sleep",     labelKey: "nav.sleep",             icon: Moon,     badgeClass: "icon-badge-purple" },
        ].map(a => (
          <Link key={a.href} href={a.href}>
            <div className="bg-white rounded-2xl p-4 flex flex-col items-center gap-2.5 cursor-pointer border border-border hover:border-primary/40 hover:shadow-md transition-all duration-200 group">
              <div className={`icon-badge ${a.badgeClass} group-hover:scale-110 transition-transform`}>
                <a.icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-foreground text-center">{t(a.labelKey)}</span>
            </div>
          </Link>
        ))}
      </div>

    </div>
  );
}
