import { useTranslation } from 'react-i18next';
import { useState } from "react";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Brain, Sparkles, TrendingUp, RefreshCw, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Streamdown } from "streamdown";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from "recharts";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-xl text-xs">
        <p className="text-muted-foreground mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }} className="font-semibold">{p.name}: {typeof p.value === "number" ? p.value.toFixed(1) : p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Insights() {
  const { t } = useTranslation();
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: insightsRaw, isLoading } = trpc.insights.getLatest.useQuery();
  const insights = insightsRaw ?? [];
  const generateMutation = trpc.insights.generate.useMutation({
    onSuccess: () => { utils.insights.getLatest.invalidate(); setGenerating(false); toast.success("AI insights generated!"); },
    onError: () => { setGenerating(false); toast.error("Failed to generate insights"); },
  });

  // Fetch recent data for analytics
  const { data: bodyData = [] } = trpc.body.getAll.useQuery({ limit: 12 });
  const { data: sleepData = [] } = trpc.sleep.getAll.useQuery({ limit: 12 });
  const { data: hrData = [] } = trpc.heartRate.getAll.useQuery({ limit: 12 });
  const { data: workoutData = [] } = trpc.workout.getSessions.useQuery();

  const handleGenerate = () => {
    setGenerating(true);
    generateMutation.mutate({});
  };

  // Build radar data for health score
  const latestBody = bodyData[0];
  const latestSleep = sleepData[0];
  const latestHr = hrData[0];

  const radarData = [
    { subject: "Sleep", value: latestSleep?.sleepScore ? Math.min(100, latestSleep.sleepScore) : 0 },
    { subject: "Recovery", value: latestSleep?.bodyBattery ?? 0 },
    { subject: "Heart", value: latestHr?.restingHr ? Math.max(0, 100 - (latestHr.restingHr - 40) * 2) : 0 },
    { subject: "Body Fat", value: latestBody?.bodyFatPct ? Math.max(0, 100 - latestBody.bodyFatPct * 2) : 0 },
    { subject: "Muscle", value: latestBody?.muscleMass ? Math.min(100, latestBody.muscleMass * 1.5) : 0 },
    { subject: "Workouts", value: Math.min(100, workoutData.length * 10) },
  ];

  // Weekly workout volume chart
  const weeklyVolume = workoutData.slice(0, 12).reverse().map(s => ({
    date: format(new Date(s.startTime), 'MM-dd'),
    volume: s.totalVolume ? Number(s.totalVolume).toFixed(0) : 0,
    duration: s.duration ?? 0,
  }));

  const latestInsight = (insights as any[])[0];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Sunny Page Header */}
      <div className="rounded-2xl p-5 text-white" style={{background: 'linear-gradient(135deg, oklch(0.58 0.22 300) 0%, oklch(0.62 0.20 260) 100%)'}}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-white">{t('insights.title')}</h1>
            <p className="text-white/70 text-sm mt-0.5">{t('insights.subtitle')}</p>
          </div>
          <Button className="gap-2 bg-white text-primary hover:bg-white/90" onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {t('insights.generate')}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="overview">{t('insights.health_overview')}</TabsTrigger>
          <TabsTrigger value="analytics">{t('insights.analytics')}</TabsTrigger>
          <TabsTrigger value="history">{t('insights.history')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          {/* Latest AI Insight */}
          {latestInsight ? (
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                    <Brain className="w-4 h-4 text-violet-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{t('insights.latest_analysis')}</p>
                    <p className="text-xs text-muted-foreground">{latestInsight.createdAt ? new Date(latestInsight.createdAt).toLocaleDateString() : ""}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs capitalize">{latestInsight.type || "overall"}</Badge>
              </div>
              <div className="prose prose-sm prose-invert max-w-none">
                <Streamdown>{latestInsight.content}</Streamdown>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-foreground font-medium">{t('insights.empty')}</p>
              <p className="text-muted-foreground text-sm mt-1">{t('insights.empty_sub')}</p>
              <Button className="mt-4 gap-2" onClick={handleGenerate} disabled={generating}>
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate Insights
              </Button>
            </div>
          )}

          {/* Health Radar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-4">Health Score Radar</h3>
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="oklch(0.24 0.018 240)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "oklch(0.60 0.010 240)" }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Score" dataKey="value" stroke="oklch(0.72 0.19 160)" fill="oklch(0.72 0.19 160)" fillOpacity={0.25} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Quick Stats */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-4">30-Day Summary</h3>
              <div className="space-y-3">
                {[
                  { label: "Workouts Logged", value: workoutData.length, unit: "sessions", color: "text-emerald-400" },
                  { label: "Avg Sleep Score", value: sleepData.length > 0 ? Math.round(sleepData.reduce((s, r) => s + (r.sleepScore ?? 0), 0) / sleepData.filter(r => r.sleepScore).length) : null, unit: "/100", color: "text-blue-400" },
                  { label: "Avg Resting HR", value: hrData.length > 0 ? Math.round(hrData.reduce((s, r) => s + (r.restingHr ?? 0), 0) / hrData.filter(r => r.restingHr).length) : null, unit: "bpm", color: "text-rose-400" },
                  { label: "Weight Change", value: bodyData.length >= 2 ? (Number(bodyData[0]?.weight ?? 0) - Number(bodyData[bodyData.length - 1]?.weight ?? 0)).toFixed(1) : null, unit: "kg", color: "text-amber-400" },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="text-sm text-muted-foreground">{s.label}</span>
                    <span className={`font-semibold ${s.color}`}>{s.value != null ? `${s.value} ${s.unit}` : "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="mt-4 space-y-4">
          {/* Workout Volume */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-foreground mb-4">Workout Volume & Duration</h3>
            {weeklyVolume.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weeklyVolume}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.018 240)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="volume" name="Volume (kg)" fill="oklch(0.72 0.19 160)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="duration" name="Duration (min)" fill="oklch(0.65 0.18 200)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No workout data yet</div>}
          </div>

          {/* Sleep vs HR Correlation */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-foreground mb-2">Sleep Score vs Resting HR</h3>
            <p className="text-xs text-muted-foreground mb-4">Lower resting HR often correlates with better recovery and sleep quality</p>
            {sleepData.length > 0 && hrData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={sleepData.slice(0, 14).reverse().map((s, i) => ({
                  date: s.date.slice(5),
                  sleep: s.sleepScore,
                  hr: hrData[i]?.restingHr,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.018 240)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "oklch(0.60 0.010 240)" }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="sleep" name="Sleep Score" fill="oklch(0.65 0.18 200)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="hr" name="Resting HR" fill="oklch(0.68 0.22 25)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Need sleep and heart rate data</div>}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (insights as any[]).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No insights generated yet</div>
          ) : (
            (insights as any[]).map((insight: any) => (
              <div key={insight.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between p-4 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === insight.id ? null : insight.id)}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                      <Brain className="w-4 h-4 text-violet-400" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-foreground">
                        {insight.createdAt ? new Date(insight.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : ""}
                      </p>
                      <Badge variant="outline" className="text-xs capitalize mt-0.5">{insight.type || "overall"}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">

                    {expandedId === insight.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>
                {expandedId === insight.id && (
                  <div className="px-4 pb-4 border-t border-border pt-3">
                    <div className="prose prose-sm prose-invert max-w-none">
                      <Streamdown>{insight.content}</Streamdown>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
