import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Heart, Activity, Loader2 } from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";

// ─── Helpers ────────────────────────────────────────────────────────────────
function fmtDateTime(ts: Date | string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDate(ts: Date | string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    month: "2-digit", day: "2-digit",
  });
}

function bpCategory(systolic: number, diastolic: number) {
  if (systolic < 120 && diastolic < 80) return { label: "正常", color: "bg-green-500/20 text-green-700 dark:text-green-400" };
  if (systolic < 130 && diastolic < 80) return { label: "偏高前期", color: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" };
  if (systolic < 140 || diastolic < 90) return { label: "高血壓一期", color: "bg-orange-500/20 text-orange-700 dark:text-orange-400" };
  return { label: "高血壓二期", color: "bg-red-500/20 text-red-700 dark:text-red-400" };
}

const TooltipStyle = {
  contentStyle: { background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "hsl(var(--foreground))", fontWeight: 600 },
};

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function BloodPressure() {
  const [days, setDays] = useState(90);
  const [showDialog, setShowDialog] = useState(false);
  const [editRecord, setEditRecord] = useState<any>(null);
  const [form, setForm] = useState({
    measuredAt: new Date().toISOString().slice(0, 16),
    systolic: 120,
    diastolic: 80,
    pulse: 72,
    notes: "",
  });

  const utils = trpc.useUtils();
  const { data: records = [], isLoading } = trpc.bloodPressure.getAll.useQuery({ days });

  const addBP = trpc.bloodPressure.add.useMutation({
    onSuccess: () => { utils.bloodPressure.getAll.invalidate(); toast.success("血壓記錄已新增"); setShowDialog(false); },
    onError: (e) => toast.error("新增失敗：" + e.message),
  });
  const updateBP = trpc.bloodPressure.update.useMutation({
    onSuccess: () => { utils.bloodPressure.getAll.invalidate(); toast.success("已更新"); setShowDialog(false); setEditRecord(null); },
    onError: (e) => toast.error("更新失敗：" + e.message),
  });
  const deleteBP = trpc.bloodPressure.delete.useMutation({
    onSuccess: () => { utils.bloodPressure.getAll.invalidate(); toast.success("已刪除"); },
    onError: (e) => toast.error("刪除失敗：" + e.message),
  });

  const chartData = useMemo(() => {
    return [...records].reverse().map(r => ({
      label: fmtDate(r.measuredAt),
      systolic: r.systolic,
      diastolic: r.diastolic,
      pulse: r.pulse,
    }));
  }, [records]);

  const latestRecord = records[0];

  function openAdd() {
    setEditRecord(null);
    const now = new Date();
    const hkOffset = 8 * 60;
    const localOffset = now.getTimezoneOffset();
    const hkTime = new Date(now.getTime() + (hkOffset + localOffset) * 60000);
    setForm({
      measuredAt: hkTime.toISOString().slice(0, 16),
      systolic: 120,
      diastolic: 80,
      pulse: 72,
      notes: "",
    });
    setShowDialog(true);
  }

  function openEdit(r: any) {
    setEditRecord(r);
    const dt = new Date(r.measuredAt);
    const hkOffset = 8 * 60;
    const localOffset = dt.getTimezoneOffset();
    const hkTime = new Date(dt.getTime() + (hkOffset + localOffset) * 60000);
    setForm({
      measuredAt: hkTime.toISOString().slice(0, 16),
      systolic: r.systolic,
      diastolic: r.diastolic,
      pulse: r.pulse ?? 72,
      notes: r.notes ?? "",
    });
    setShowDialog(true);
  }

  function handleSave() {
    const isoAt = new Date(form.measuredAt + ":00+08:00").toISOString();
    if (editRecord) {
      updateBP.mutate({ id: editRecord.id, measuredAt: isoAt, systolic: form.systolic, diastolic: form.diastolic, pulse: form.pulse || null, notes: form.notes || null });
    } else {
      addBP.mutate({ measuredAt: isoAt, systolic: form.systolic, diastolic: form.diastolic, pulse: form.pulse || undefined, notes: form.notes || undefined });
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="w-6 h-6 text-red-500" /> 血壓記錄
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">追蹤收縮壓、舒張壓及脈搏</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground"
            value={days}
            onChange={e => setDays(Number(e.target.value))}
          >
            <option value={30}>30 日</option>
            <option value={90}>90 日</option>
            <option value={180}>180 日</option>
            <option value={365}>365 日</option>
          </select>
          <Button size="sm" onClick={openAdd} className="gap-1">
            <Plus className="w-4 h-4" /> 新增記錄
          </Button>
        </div>
      </div>

      {/* Latest Reading Cards */}
      {latestRecord && (() => {
        const cat = bpCategory(latestRecord.systolic, latestRecord.diastolic);
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="col-span-2 md:col-span-1">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">最新收縮壓</p>
                <p className="text-3xl font-bold text-red-500">{latestRecord.systolic}</p>
                <p className="text-xs text-muted-foreground">mmHg</p>
              </CardContent>
            </Card>
            <Card className="col-span-2 md:col-span-1">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">最新舒張壓</p>
                <p className="text-3xl font-bold text-blue-500">{latestRecord.diastolic}</p>
                <p className="text-xs text-muted-foreground">mmHg</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">脈搏</p>
                <p className="text-3xl font-bold text-orange-500">{latestRecord.pulse ?? "—"}</p>
                <p className="text-xs text-muted-foreground">bpm</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">狀態</p>
                <Badge className={`mt-1 text-xs ${cat.color}`}>{cat.label}</Badge>
                <p className="text-xs text-muted-foreground mt-1">{fmtDateTime(latestRecord.measuredAt)}</p>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4" /> 血壓趨勢
            </CardTitle>
            <CardDescription className="text-xs">收縮壓 / 舒張壓 / 脈搏</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis yAxisId="bp" domain={[50, 200]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" unit=" mmHg" />
                <YAxis yAxisId="pulse" orientation="right" domain={[40, 140]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" unit=" bpm" />
                <Tooltip {...TooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {/* Reference lines for normal range */}
                <ReferenceLine yAxisId="bp" y={120} stroke="#22c55e" strokeDasharray="4 2" strokeWidth={1} label={{ value: "正常收縮壓", fontSize: 9, fill: "#22c55e", position: "insideTopRight" }} />
                <ReferenceLine yAxisId="bp" y={80} stroke="#3b82f6" strokeDasharray="4 2" strokeWidth={1} label={{ value: "正常舒張壓", fontSize: 9, fill: "#3b82f6", position: "insideTopRight" }} />
                <Line yAxisId="bp" type="monotone" dataKey="systolic" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: "#ef4444" }} name="收縮壓" connectNulls />
                <Line yAxisId="bp" type="monotone" dataKey="diastolic" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: "#3b82f6" }} name="舒張壓" connectNulls />
                <Line yAxisId="pulse" type="monotone" dataKey="pulse" stroke="#f97316" strokeWidth={1.5} strokeDasharray="4 2" dot={{ r: 2, fill: "#f97316" }} name="脈搏" connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Records Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">記錄列表</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : records.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">尚無記錄，點擊「新增記錄」開始追蹤血壓。</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">日期時間</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">收縮壓</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">舒張壓</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">脈搏</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">狀態</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">備注</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => {
                    const cat = bpCategory(r.systolic, r.diastolic);
                    return (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(r.measuredAt)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-red-500">{r.systolic}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-blue-500">{r.diastolic}</td>
                        <td className="px-3 py-2.5 text-right text-orange-500">{r.pulse ?? "—"}</td>
                        <td className="px-3 py-2.5 text-center">
                          <Badge className={`text-xs ${cat.color}`}>{cat.label}</Badge>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[120px] truncate">{r.notes ?? "—"}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => { if (confirm("確定刪除此記錄？")) deleteBP.mutate({ id: r.id }); }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={v => { setShowDialog(v); if (!v) setEditRecord(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editRecord ? "編輯血壓記錄" : "新增血壓記錄"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">量度時間</label>
              <Input type="datetime-local" value={form.measuredAt}
                onChange={e => setForm(f => ({ ...f, measuredAt: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">收縮壓 (mmHg)</label>
                <Input type="number" min={50} max={300} value={form.systolic}
                  onChange={e => setForm(f => ({ ...f, systolic: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">舒張壓 (mmHg)</label>
                <Input type="number" min={30} max={200} value={form.diastolic}
                  onChange={e => setForm(f => ({ ...f, diastolic: Number(e.target.value) }))} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">脈搏 (bpm) — 可選</label>
              <Input type="number" min={30} max={300} value={form.pulse}
                onChange={e => setForm(f => ({ ...f, pulse: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">備注 — 可選</label>
              <Input placeholder="例如：早上起床後、運動後…" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            {/* Live category preview */}
            {form.systolic > 0 && form.diastolic > 0 && (() => {
              const cat = bpCategory(form.systolic, form.diastolic);
              return (
                <div className={`rounded-lg p-3 text-center text-sm font-medium ${cat.color}`}>
                  {form.systolic}/{form.diastolic} mmHg — {cat.label}
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); setEditRecord(null); }}>取消</Button>
            <Button onClick={handleSave} disabled={addBP.isPending || updateBP.isPending}>
              {(addBP.isPending || updateBP.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editRecord ? "儲存" : "新增"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
