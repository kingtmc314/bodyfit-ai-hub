import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useIsOwner } from "@/contexts/OwnerContext";
import { toast } from "sonner";
import { todayHKString } from "@/lib/hkTime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Trash2, Edit2, ChevronDown, ChevronUp, Stethoscope, Clock,
  User, MapPin, Loader2, X, Activity
} from "lucide-react";

const BODY_PARTS = [
  "頸部", "肩部", "上背", "下背", "腰部", "臀部",
  "大腿前側 (股四頭肌)", "大腿後側 (腿後肌)", "膝蓋", "小腿", "腳踝", "足部",
  "上臂", "前臂", "手腕", "手指",
  "核心", "全身", "其他",
];

const PT_EQUIPMENT = [
  "Bodyweight", "Resistance Band", "Theraband", "Balance Board", "Wobble Board",
  "TENS Machine", "Ultrasound Device", "IFC Machine", "Hot Pack", "Cold Pack",
  "Traction Table", "Parallel Bars", "Hydrotherapy Pool", "Exercise Bike (PT)",
  "Foam Roller", "Massage Ball", "Pilates Ball", "Bosu Ball", "Other",
];

const PAIN_LABELS: Record<number, string> = {
  0: "0 - 無痛", 1: "1", 2: "2", 3: "3 - 輕微", 4: "4", 5: "5 - 中等",
  6: "6", 7: "7 - 嚴重", 8: "8", 9: "9", 10: "10 - 極度",
};

interface ExerciseForm {
  name: string; sets: string; reps: string; durationSec: string; equipment: string; notes: string;
}

const defaultExForm = (): ExerciseForm => ({ name: "", sets: "", reps: "", durationSec: "", equipment: "", notes: "" });

export default function PhysioTherapy() {
  const isOwner = useIsOwner();
  const utils = trpc.useUtils();

  // Session list
  const [days, setDays] = useState(180);
  const { data: sessions = [], isLoading } = trpc.physio.getSessions.useQuery({ days });

  // Session dialog
  const [showSessionDialog, setShowSessionDialog] = useState(false);
  const [editingSession, setEditingSession] = useState<any>(null);
  const [sessionForm, setSessionForm] = useState({
    sessionDate: todayHKString(), therapist: "", bodyPart: "", durationMin: "",
    notes: "", painBefore: "", painAfter: "",
  });

  // Exercise dialog
  const [showExDialog, setShowExDialog] = useState(false);
  const [targetSessionId, setTargetSessionId] = useState<number | null>(null);
  const [exForm, setExForm] = useState<ExerciseForm>(defaultExForm());

  // Expanded sessions
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const addSession = trpc.physio.addSession.useMutation({
    onSuccess: () => { utils.physio.getSessions.invalidate(); setShowSessionDialog(false); toast.success("物理治療記錄已新增！"); },
    onError: (e) => toast.error("新增失敗: " + e.message),
  });
  const updateSession = trpc.physio.updateSession.useMutation({
    onSuccess: () => { utils.physio.getSessions.invalidate(); setShowSessionDialog(false); setEditingSession(null); toast.success("記錄已更新！"); },
    onError: (e) => toast.error("更新失敗: " + e.message),
  });
  const deleteSession = trpc.physio.deleteSession.useMutation({
    onSuccess: () => { utils.physio.getSessions.invalidate(); toast.success("已刪除"); },
  });
  const addExercise = trpc.physio.addExercise.useMutation({
    onSuccess: () => { utils.physio.getSessions.invalidate(); setShowExDialog(false); setExForm(defaultExForm()); toast.success("動作已新增！"); },
    onError: (e) => toast.error("新增失敗: " + e.message),
  });
  const deleteExercise = trpc.physio.deleteExercise.useMutation({
    onSuccess: () => { utils.physio.getSessions.invalidate(); toast.success("已刪除"); },
  });

  const openAddSession = () => {
    setEditingSession(null);
    setSessionForm({ sessionDate: todayHKString(), therapist: "", bodyPart: "", durationMin: "", notes: "", painBefore: "", painAfter: "" });
    setShowSessionDialog(true);
  };

  const openEditSession = (s: any) => {
    setEditingSession(s);
    setSessionForm({
      sessionDate: s.sessionDate ?? todayHKString(),
      therapist: s.therapist ?? "",
      bodyPart: s.bodyPart ?? "",
      durationMin: s.durationMin ? String(s.durationMin) : "",
      notes: s.notes ?? "",
      painBefore: s.painBefore != null ? String(s.painBefore) : "",
      painAfter: s.painAfter != null ? String(s.painAfter) : "",
    });
    setShowSessionDialog(true);
  };

  const handleSaveSession = () => {
    const payload = {
      sessionDate: sessionForm.sessionDate,
      therapist: sessionForm.therapist || undefined,
      bodyPart: sessionForm.bodyPart || undefined,
      durationMin: sessionForm.durationMin ? parseInt(sessionForm.durationMin) : undefined,
      notes: sessionForm.notes || undefined,
      painBefore: sessionForm.painBefore !== "" ? parseInt(sessionForm.painBefore) : undefined,
      painAfter: sessionForm.painAfter !== "" ? parseInt(sessionForm.painAfter) : undefined,
    };
    if (editingSession) {
      updateSession.mutate({ id: editingSession.id, ...payload });
    } else {
      addSession.mutate(payload);
    }
  };

  const handleSaveExercise = () => {
    if (!targetSessionId || !exForm.name.trim()) return toast.error("請填寫動作名稱");
    addExercise.mutate({
      sessionId: targetSessionId,
      name: exForm.name.trim(),
      sets: exForm.sets ? parseInt(exForm.sets) : undefined,
      reps: exForm.reps ? parseInt(exForm.reps) : undefined,
      durationSec: exForm.durationSec ? parseInt(exForm.durationSec) : undefined,
      equipment: exForm.equipment || undefined,
      notes: exForm.notes || undefined,
    });
  };

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const painColor = (v: number) => v <= 3 ? "text-green-600" : v <= 6 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Stethoscope className="w-6 h-6 text-teal-500" /> 物理治療記錄
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">追蹤每次物理治療療程及進度</p>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={String(days)} onValueChange={v => setDays(Number(v))}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">近 30 天</SelectItem>
                <SelectItem value="90">近 90 天</SelectItem>
                <SelectItem value="180">近 180 天</SelectItem>
                <SelectItem value="365">近 1 年</SelectItem>
                <SelectItem value="730">近 2 年</SelectItem>
              </SelectContent>
            </Select>
            {isOwner && (
              <Button className="gap-2" onClick={openAddSession}>
                <Plus className="w-4 h-4" /> 新增療程
              </Button>
            )}
          </div>
        </div>

        {/* Stats summary */}
        {sessions.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-teal-500">{sessions.length}</p>
              <p className="text-xs text-muted-foreground mt-1">療程次數</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-primary">
                {sessions.reduce((s, x) => s + (x.durationMin ?? 0), 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">總療程分鐘</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-orange-500">
                {sessions.reduce((s, x) => s + ((x as any).exercises?.length ?? 0), 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">動作記錄</p>
            </div>
          </div>
        )}

        {/* Session list */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16">
            <Stethoscope className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">尚無物理治療記錄</p>
            {isOwner && <Button className="mt-4 gap-2" onClick={openAddSession}><Plus className="w-4 h-4" /> 新增第一次療程</Button>}
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s: any) => {
              const expanded = expandedIds.has(s.id);
              return (
                <div key={s.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                  {/* Session header */}
                  <div className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground">{s.sessionDate}</span>
                          {s.bodyPart && (
                            <Badge className="text-xs bg-teal-100 text-teal-700 border-teal-200">{s.bodyPart}</Badge>
                          )}
                          {s.durationMin && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" /> {s.durationMin} 分鐘
                            </span>
                          )}
                        </div>
                        {s.therapist && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <User className="w-3 h-3" /> {s.therapist}
                          </p>
                        )}
                        {(s.painBefore != null || s.painAfter != null) && (
                          <div className="flex gap-3 mt-1.5">
                            {s.painBefore != null && (
                              <span className={`text-xs font-medium ${painColor(s.painBefore)}`}>
                                治療前痛感: {s.painBefore}/10
                              </span>
                            )}
                            {s.painAfter != null && (
                              <span className={`text-xs font-medium ${painColor(s.painAfter)}`}>
                                治療後痛感: {s.painAfter}/10
                              </span>
                            )}
                          </div>
                        )}
                        {s.notes && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{s.notes}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isOwner && (
                          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => { setTargetSessionId(s.id); setExForm(defaultExForm()); setShowExDialog(true); }}>
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {isOwner && (
                          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEditSession(s)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {isOwner && (
                          <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => deleteSession.mutate({ id: s.id })}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => toggleExpand(s.id)}>
                          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </div>
                    {/* Exercise count badge */}
                    {s.exercises?.length > 0 && !expanded && (
                      <button className="mt-2 text-xs text-teal-600 hover:underline" onClick={() => toggleExpand(s.id)}>
                        {s.exercises.length} 個動作 ▾
                      </button>
                    )}
                  </div>

                  {/* Exercises */}
                  {expanded && (
                    <div className="border-t border-border">
                      {s.exercises?.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">尚無動作記錄</p>
                      ) : (
                        s.exercises.map((ex: any, i: number) => (
                          <div key={ex.id} className={`flex items-center gap-3 px-5 py-3 ${i > 0 ? 'border-t border-border/50' : ''}`}>
                            <Activity className="w-4 h-4 text-teal-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{ex.name}</p>
                              <div className="flex gap-2 flex-wrap mt-0.5">
                                {ex.sets && <span className="text-xs text-muted-foreground">{ex.sets} sets</span>}
                                {ex.reps && <span className="text-xs text-muted-foreground">× {ex.reps} reps</span>}
                                {ex.durationSec && <span className="text-xs text-muted-foreground">{ex.durationSec}秒</span>}
                                {ex.equipment && <Badge variant="outline" className="text-xs py-0">{ex.equipment}</Badge>}
                              </div>
                              {ex.notes && <p className="text-xs text-muted-foreground mt-0.5">{ex.notes}</p>}
                            </div>
                            {isOwner && (
                              <Button variant="ghost" size="icon" className="w-6 h-6 text-destructive shrink-0"
                                onClick={() => deleteExercise.mutate({ id: ex.id })}>
                                <X className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        ))
                      )}
                      {isOwner && (
                        <div className="px-5 py-3 border-t border-border/50">
                          <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-teal-600 hover:text-teal-700"
                            onClick={() => { setTargetSessionId(s.id); setExForm(defaultExForm()); setShowExDialog(true); }}>
                            <Plus className="w-3.5 h-3.5" /> 新增動作
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Session Dialog */}
      <Dialog open={showSessionDialog} onOpenChange={v => { setShowSessionDialog(v); if (!v) setEditingSession(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSession ? "修改療程記錄" : "新增物理治療療程"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">日期 *</label>
              <Input type="date" value={sessionForm.sessionDate}
                onChange={e => setSessionForm(f => ({ ...f, sessionDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">治療師 / 診所</label>
              <Input placeholder="e.g. Dr. Chan / TMH Physio" value={sessionForm.therapist}
                onChange={e => setSessionForm(f => ({ ...f, therapist: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">治療部位</label>
              <Select value={sessionForm.bodyPart} onValueChange={v => setSessionForm(f => ({ ...f, bodyPart: v }))}>
                <SelectTrigger><SelectValue placeholder="選擇部位…" /></SelectTrigger>
                <SelectContent>
                  {BODY_PARTS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">療程時間（分鐘）</label>
              <Input type="number" min={1} max={480} placeholder="e.g. 45" value={sessionForm.durationMin}
                onChange={e => setSessionForm(f => ({ ...f, durationMin: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">治療前痛感 (0-10)</label>
                <Select value={sessionForm.painBefore} onValueChange={v => setSessionForm(f => ({ ...f, painBefore: v }))}>
                  <SelectTrigger><SelectValue placeholder="選擇…" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAIN_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">治療後痛感 (0-10)</label>
                <Select value={sessionForm.painAfter} onValueChange={v => setSessionForm(f => ({ ...f, painAfter: v }))}>
                  <SelectTrigger><SelectValue placeholder="選擇…" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAIN_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">進度備註</label>
              <textarea
                className="w-full min-h-[80px] rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="治療進度、感受、醫生建議…"
                value={sessionForm.notes}
                onChange={e => setSessionForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowSessionDialog(false); setEditingSession(null); }}>取消</Button>
            <Button onClick={handleSaveSession} disabled={addSession.isPending || updateSession.isPending}>
              {(addSession.isPending || updateSession.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Exercise Dialog */}
      <Dialog open={showExDialog} onOpenChange={setShowExDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>新增治療動作</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">動作 / 治療名稱 *</label>
              <Input placeholder="e.g. Straight Leg Raise, TENS Therapy" value={exForm.name}
                onChange={e => setExForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">組數</label>
                <Input type="number" min={1} placeholder="e.g. 3" value={exForm.sets}
                  onChange={e => setExForm(f => ({ ...f, sets: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">次數</label>
                <Input type="number" min={1} placeholder="e.g. 15" value={exForm.reps}
                  onChange={e => setExForm(f => ({ ...f, reps: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">持續時間（秒）</label>
              <Input type="number" min={1} placeholder="e.g. 1200 (20 min TENS)" value={exForm.durationSec}
                onChange={e => setExForm(f => ({ ...f, durationSec: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">器材 / 儀器</label>
              <Select value={exForm.equipment} onValueChange={v => setExForm(f => ({ ...f, equipment: v }))}>
                <SelectTrigger><SelectValue placeholder="選擇器材…" /></SelectTrigger>
                <SelectContent>
                  {PT_EQUIPMENT.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">備註</label>
              <Input placeholder="備註…" value={exForm.notes}
                onChange={e => setExForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExDialog(false)}>取消</Button>
            <Button onClick={handleSaveExercise} disabled={addExercise.isPending}>
              {addExercise.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              新增
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
