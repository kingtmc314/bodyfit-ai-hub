import React, { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Timer, Play, Square, Trash2, TrendingUp, Flame, Clock, Trophy, Zap } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface FastingPreset {
  label: string;
  type: string;
  hours: number;
  description: string;
  color: string;
}

const FASTING_PRESETS: FastingPreset[] = [
  { label: "16:8", type: "16:8", hours: 16, description: "斷食 16 小時，進食窗口 8 小時", color: "bg-blue-500" },
  { label: "18:6", type: "18:6", hours: 18, description: "斷食 18 小時，進食窗口 6 小時", color: "bg-indigo-500" },
  { label: "20:4", type: "20:4", hours: 20, description: "斷食 20 小時，進食窗口 4 小時", color: "bg-purple-500" },
  { label: "OMAD", type: "OMAD", hours: 23, description: "每日一餐，斷食約 23 小時", color: "bg-pink-500" },
  { label: "24h", type: "24h", hours: 24, description: "完整 24 小時斷食", color: "bg-red-500" },
  { label: "自訂", type: "custom", hours: 12, description: "自訂斷食時長", color: "bg-gray-500" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatHours(h: number): string {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

function toHKString(date: Date | string): string {
  return new Date(date).toLocaleString("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ─── Active Timer Component ───────────────────────────────────────────────────
function ActiveFastTimer({
  fast,
  onEnd,
}: {
  fast: { id: number; startTime: Date | string; targetHours: number; fastingType: string };
  onEnd: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const endMutation = trpc.fasting.end.useMutation({
    onSuccess: () => { toast.success("斷食已結束！"); onEnd(); },
    onError: (e) => toast.error(`結束失敗：${e.message}`),
  });

  useEffect(() => {
    const tick = () => setElapsed(Date.now() - new Date(fast.startTime).getTime());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [fast.startTime]);

  const targetMs = fast.targetHours * 3600000;
  const progress = Math.min((elapsed / targetMs) * 100, 100);
  const remaining = Math.max(targetMs - elapsed, 0);
  const isComplete = elapsed >= targetMs;

  const handleEnd = () => {
    endMutation.mutate({ id: fast.id, endTime: new Date().toISOString() });
  };

  return (
    <Card className="border-2 border-orange-400/60 bg-gradient-to-br from-orange-950/30 to-amber-950/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-orange-300">
            <Flame className="w-5 h-5 animate-pulse" />
            斷食進行中 — {fast.fastingType}
          </CardTitle>
          <Badge variant="outline" className="border-orange-400 text-orange-300">
            {isComplete ? "✅ 目標達成" : "⏳ 進行中"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Big Timer */}
        <div className="text-center py-4">
          <div className="text-6xl font-mono font-bold text-orange-200 tracking-wider">
            {formatDuration(elapsed)}
          </div>
          <div className="text-sm text-muted-foreground mt-2">
            開始時間：{toHKString(fast.startTime)}
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">進度</span>
            <span className={isComplete ? "text-green-400 font-semibold" : "text-orange-300"}>
              {progress.toFixed(1)}% / 目標 {fast.targetHours}h
            </span>
          </div>
          <Progress value={progress} className="h-3" />
          {!isComplete && (
            <div className="text-xs text-muted-foreground text-right">
              距目標還剩 {formatDuration(remaining)}
            </div>
          )}
        </div>

        {/* End Button */}
        <Button
          onClick={handleEnd}
          disabled={endMutation.isPending}
          variant="destructive"
          className="w-full gap-2"
          size="lg"
        >
          <Square className="w-4 h-4" />
          {endMutation.isPending ? "結束中..." : "結束斷食"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Start Fast Panel ─────────────────────────────────────────────────────────
function StartFastPanel({ onStarted }: { onStarted: () => void }) {
  const [selectedPreset, setSelectedPreset] = useState<FastingPreset>(FASTING_PRESETS[0]);
  const [customHours, setCustomHours] = useState(12);
  const [notes, setNotes] = useState("");

  const startMutation = trpc.fasting.start.useMutation({
    onSuccess: () => { toast.success("斷食已開始！"); onStarted(); },
    onError: (e) => toast.error(`開始失敗：${e.message}`),
  });

  const handleStart = () => {
    const hours = selectedPreset.type === "custom" ? customHours : selectedPreset.hours;
    startMutation.mutate({
      fastingType: selectedPreset.type === "custom" ? `自訂 ${hours}h` : selectedPreset.type,
      targetHours: hours,
      startTime: new Date().toISOString(),
      notes: notes || undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="w-5 h-5 text-primary" />
          開始新的斷食
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preset Grid */}
        <div className="grid grid-cols-3 gap-2">
          {FASTING_PRESETS.map((preset) => (
            <button
              key={preset.type}
              onClick={() => setSelectedPreset(preset)}
              className={`rounded-lg p-3 text-center transition-all border-2 ${
                selectedPreset.type === preset.type
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              <div className="font-bold text-lg">{preset.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {preset.type !== "custom" ? `${preset.hours}h` : "自訂"}
              </div>
            </button>
          ))}
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          {selectedPreset.description}
        </p>

        {/* Custom hours */}
        {selectedPreset.type === "custom" && (
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium whitespace-nowrap">目標時長</label>
            <input
              type="number"
              min={1}
              max={72}
              value={customHours}
              onChange={(e) => setCustomHours(Number(e.target.value))}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <span className="text-sm text-muted-foreground">小時</span>
          </div>
        )}

        {/* Notes */}
        <Textarea
          placeholder="備註（選填）"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="resize-none"
        />

        {/* Start Button */}
        <Button
          onClick={handleStart}
          disabled={startMutation.isPending}
          className="w-full gap-2"
          size="lg"
        >
          <Play className="w-4 h-4" />
          {startMutation.isPending ? "開始中..." : "開始斷食"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Stats Cards ──────────────────────────────────────────────────────────────
function StatsCards() {
  const { data: stats } = trpc.fasting.stats.useQuery({ days: 30 });

  const cards = [
    { icon: <Flame className="w-5 h-5 text-orange-400" />, label: "本月斷食次數", value: stats?.totalFasts ?? 0, unit: "次" },
    { icon: <Clock className="w-5 h-5 text-blue-400" />, label: "平均斷食時長", value: stats ? formatHours(stats.avgHours) : "—", unit: "" },
    { icon: <Trophy className="w-5 h-5 text-yellow-400" />, label: "最長斷食", value: stats ? formatHours(stats.longestFast) : "—", unit: "" },
    { icon: <Zap className="w-5 h-5 text-green-400" />, label: "連續天數", value: stats?.currentStreak ?? 0, unit: "天" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((c, i) => (
        <Card key={i} className="bg-card/60">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">{c.icon}<span className="text-xs text-muted-foreground">{c.label}</span></div>
            <div className="text-2xl font-bold">
              {c.value}{c.unit && <span className="text-sm font-normal text-muted-foreground ml-1">{c.unit}</span>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── History List ─────────────────────────────────────────────────────────────
function HistoryList({ onRefresh }: { onRefresh: () => void }) {
  const utils = trpc.useUtils();
  const { data: logs, isLoading } = trpc.fasting.list.useQuery({ limit: 30 });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const deleteMutation = trpc.fasting.delete.useMutation({
    onSuccess: () => {
      toast.success("已刪除");
      utils.fasting.list.invalidate();
      utils.fasting.stats.invalidate();
      setDeleteId(null);
      onRefresh();
    },
    onError: (e) => toast.error(`刪除失敗：${e.message}`),
  });

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">載入中...</div>;
  if (!logs?.length) return (
    <div className="text-center py-12 text-muted-foreground">
      <Timer className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p>尚無斷食紀錄</p>
      <p className="text-sm mt-1">開始您的第一次斷食吧！</p>
    </div>
  );

  const completedLogs = logs.filter(l => l.isCompleted);
  const activeLogs = logs.filter(l => !l.isCompleted);

  return (
    <div className="space-y-2">
      {activeLogs.length > 0 && (
        <div className="text-xs font-medium text-orange-400 uppercase tracking-wide px-1 mb-1">進行中</div>
      )}
      {[...activeLogs, ...completedLogs].map((log) => {
        const actualH = log.actualHours ?? 0;
        const targetH = log.targetHours ?? 16;
        const completed = log.isCompleted;
        const success = actualH >= targetH;

        return (
          <Card key={log.id} className={`transition-all ${!completed ? "border-orange-400/40 bg-orange-950/10" : ""}`}>
            <CardContent className="py-3 px-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={completed ? (success ? "default" : "secondary") : "outline"} className={!completed ? "border-orange-400 text-orange-300" : ""}>
                      {log.fastingType}
                    </Badge>
                    {completed && (
                      <span className={`text-sm font-semibold ${success ? "text-green-400" : "text-yellow-400"}`}>
                        {success ? "✅" : "⚠️"} {formatHours(actualH)}
                      </span>
                    )}
                    {!completed && <span className="text-xs text-orange-300 animate-pulse">● 進行中</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    開始：{toHKString(log.startTime)}
                    {log.endTime && <span className="ml-2">結束：{toHKString(log.endTime)}</span>}
                  </div>
                  {log.notes && <div className="text-xs text-muted-foreground mt-0.5 truncate">{log.notes}</div>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive h-7 w-7"
                  onClick={() => setDeleteId(log.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              {completed && (
                <div className="mt-2">
                  <Progress value={Math.min((actualH / targetH) * 100, 100)} className="h-1.5" />
                  <div className="text-xs text-muted-foreground text-right mt-0.5">
                    目標 {targetH}h
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Delete confirm dialog */}
      <Dialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>確認刪除</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">確定要刪除這筆斷食紀錄嗎？此操作無法復原。</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>取消</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "刪除中..." : "確認刪除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Fasting() {
  const utils = trpc.useUtils();
  const { data: activeFast, isLoading: loadingActive } = trpc.fasting.getActive.useQuery();

  const refresh = useCallback(() => {
    utils.fasting.getActive.invalidate();
    utils.fasting.list.invalidate();
    utils.fasting.stats.invalidate();
  }, [utils]);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Timer className="w-6 h-6 text-orange-400" />
          斷食紀錄
        </h1>
        <p className="text-sm text-muted-foreground mt-1">追蹤您的間歇性斷食計劃與進度</p>
      </div>

      {/* Stats */}
      <StatsCards />

      {/* Active Fast or Start Panel */}
      {loadingActive ? (
        <Card className="animate-pulse h-48" />
      ) : activeFast ? (
        <ActiveFastTimer fast={activeFast as any} onEnd={refresh} />
      ) : (
        <StartFastPanel onStarted={refresh} />
      )}

      {/* History */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">斷食紀錄</h2>
        </div>
        <HistoryList onRefresh={refresh} />
      </div>
    </div>
  );
}
