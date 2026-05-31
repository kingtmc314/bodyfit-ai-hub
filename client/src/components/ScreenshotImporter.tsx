/**
 * ScreenshotImporter
 *
 * A compact "📷 從截圖讀取" button that:
 * 1. Opens a file picker (or camera) to select a screenshot
 * 2. Sends it to imageImport.extract via tRPC
 * 3. Shows a preview of extracted fields with a confidence badge
 * 4. Calls onExtracted(fields) so the parent can fill its form
 *
 * Usage:
 *   <ScreenshotImporter
 *     dataType="running"
 *     onExtracted={(fields) => { setForm(f => ({ ...f, ...fields })); }}
 *   />
 */
import { useRef, useState } from "react";
import { Camera, Loader2, CheckCircle2, AlertCircle, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export type ScreenshotDataType = "running" | "steps" | "body" | "sleep" | "heartrate";

interface ScreenshotImporterProps {
  dataType: ScreenshotDataType;
  onExtracted: (fields: Record<string, unknown>) => void;
  className?: string;
}

const CONFIDENCE_COLOR: Record<string, string> = {
  high: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  low: "bg-red-500/20 text-red-400 border-red-500/30",
};

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "高可信度",
  medium: "中可信度",
  low: "低可信度",
};

/** Convert extracted result to form-friendly key-value pairs for each data type */
function toFormFields(dataType: ScreenshotDataType, extracted: Record<string, unknown>): Record<string, string> {
  const fields: Record<string, string> = {};

  if (extracted.date && typeof extracted.date === "string") {
    fields.date = extracted.date;
  }

  if (dataType === "running") {
    const r = (extracted.running ?? {}) as Record<string, unknown>;
    if (r.distanceKm != null) fields.distanceKm = String(r.distanceKm);
    if (r.durationHour != null) fields.hour = String(r.durationHour);
    if (r.durationMin != null) fields.minutes = String(r.durationMin);
    if (r.durationSec != null) fields.second = String(r.durationSec);
    if (r.avgPace != null) fields.averagePace = String(r.avgPace);
    if (r.bestPace != null) fields.bestPace = String(r.bestPace);
    if (r.avgHr != null) fields.averageHeartRate = String(r.avgHr);
    if (r.maxHr != null) fields.maximumHeartRate = String(r.maxHr);
    if (r.avgCadence != null) fields.averageCadence = String(r.avgCadence);
    if (r.maxCadence != null) fields.maxCadence = String(r.maxCadence);
    if (r.calories != null) fields.calories = String(r.calories);
    if (r.avgStrideLengthM != null) fields.avgStrideLengthM = String(r.avgStrideLengthM);
    if (r.avgVerticalRatio != null) fields.avgVerticalRatio = String(r.avgVerticalRatio);
    if (r.verticalOscillationCm != null) fields.verticalOscillationCm = String(r.verticalOscillationCm);
    if (r.runningType != null) fields.runningType = String(r.runningType);
  } else if (dataType === "steps") {
    const s = (extracted.steps ?? {}) as Record<string, unknown>;
    if (s.steps != null) fields.steps = String(s.steps);
    if (s.floorsClimbed != null) fields.floorsClimbed = String(s.floorsClimbed);
    if (s.distanceKm != null) fields.distanceKm = String(s.distanceKm);
    if (s.activeMinutes != null) fields.activeMinutes = String(s.activeMinutes);
    if (s.calories != null) fields.calories = String(s.calories);
  } else if (dataType === "body") {
    const b = (extracted.body ?? {}) as Record<string, unknown>;
    if (b.weight != null) fields.weight = String(b.weight);
    if (b.bmi != null) fields.bmi = String(b.bmi);
    if (b.bodyFatPct != null) fields.bodyFatPct = String(b.bodyFatPct);
    if (b.muscleMass != null) fields.muscleMass = String(b.muscleMass);
    if (b.visceralFat != null) fields.visceralFat = String(b.visceralFat);
  } else if (dataType === "sleep") {
    const sl = (extracted.sleep ?? {}) as Record<string, unknown>;
    if (sl.sleepScore != null) fields.score = String(sl.sleepScore);
    if (sl.sleepDuration != null) fields.duration = String(sl.sleepDuration);
    if (sl.deepSleep != null) fields.deepSleep = String(sl.deepSleep);
    if (sl.remSleep != null) fields.remSleep = String(sl.remSleep);
    if (sl.bodyBattery != null) fields.bodyBattery = String(sl.bodyBattery);
    if (sl.pulseOx != null) fields.pulseOx = String(sl.pulseOx);
    if (sl.hrv != null) fields.hrv = String(sl.hrv);
  } else if (dataType === "heartrate") {
    const hr = (extracted.heartrate ?? {}) as Record<string, unknown>;
    if (hr.restingHr != null) fields.restingHr = String(hr.restingHr);
    if (hr.highHr != null) fields.highHr = String(hr.highHr);
    if (hr.avgHr != null) fields.avgHr = String(hr.avgHr);
    if (hr.hrv != null) fields.hrv = String(hr.hrv);
  }

  return fields;
}

/** Human-readable labels for extracted fields */
const FIELD_LABELS: Record<string, string> = {
  date: "日期",
  distanceKm: "距離 (km)",
  hour: "時 (h)",
  minutes: "分 (min)",
  second: "秒 (sec)",
  averagePace: "平均配速",
  bestPace: "最佳配速",
  averageHeartRate: "平均心率",
  maximumHeartRate: "最高心率",
  averageCadence: "平均步頻",
  maxCadence: "最高步頻",
  calories: "卡路里",
  avgStrideLengthM: "平均步幅 (m)",
  avgVerticalRatio: "垂直比率 (%)",
  verticalOscillationCm: "垂直振幅 (cm)",
  runningType: "活動類型",
  steps: "步數",
  floorsClimbed: "樓層",
  activeMinutes: "活躍分鐘",
  weight: "體重 (kg)",
  bmi: "BMI",
  bodyFatPct: "體脂率 (%)",
  muscleMass: "肌肉量 (kg)",
  visceralFat: "內臟脂肪",
  score: "睡眠評分",
  duration: "睡眠時數",
  deepSleep: "深睡 (min)",
  remSleep: "REM (min)",
  bodyBattery: "身體電量",
  pulseOx: "血氧 (%)",
  hrv: "HRV (ms)",
  restingHr: "靜息心率",
  highHr: "最高心率",
  avgHr: "平均心率",
};

export default function ScreenshotImporter({ dataType, onExtracted, className }: ScreenshotImporterProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ fields: Record<string, string>; confidence: string; notes: string } | null>(null);
  const [applied, setApplied] = useState(false);

  const extractMutation = trpc.imageImport.extract.useMutation({
    onSuccess: (data) => {
      const fields = toFormFields(dataType, data as Record<string, unknown>);
      const nonEmpty = Object.keys(fields).filter(k => fields[k] !== "" && fields[k] != null);
      if (nonEmpty.length === 0) {
        toast.error("AI 未能從截圖中識別到相關數據，請嘗試更清晰的截圖");
        return;
      }
      setPreview({
        fields,
        confidence: (data as any).confidence ?? "medium",
        notes: (data as any).notes ?? "",
      });
      setApplied(false);
    },
    onError: (err) => {
      toast.error("截圖分析失敗：" + err.message);
    },
  });

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("請上傳圖片檔案");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      extractMutation.mutate({ base64, mimeType: file.type, dataType });
    };
    reader.readAsDataURL(file);
  };

  const handleApply = () => {
    if (!preview) return;
    onExtracted(preview.fields);
    setApplied(true);
    toast.success("已填入截圖數據，請確認後儲存");
  };

  const handleDismiss = () => {
    setPreview(null);
    setApplied(false);
  };

  return (
    <div className={className}>
      {/* Hidden file inputs */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />

      {/* Trigger button row */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-8 border-dashed border-primary/40 text-primary hover:bg-primary/5"
          disabled={extractMutation.isPending}
          onClick={() => fileRef.current?.click()}
        >
          {extractMutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          {extractMutation.isPending ? "AI 分析中…" : "從截圖讀取數據"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1 text-xs h-8 text-muted-foreground"
          disabled={extractMutation.isPending}
          onClick={() => cameraRef.current?.click()}
        >
          <Camera className="w-3.5 h-3.5" />
          拍照
        </Button>
      </div>

      {/* Extracted preview panel */}
      {preview && (
        <div className="mt-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {applied ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span className="font-medium text-foreground">
                {applied ? "已填入表單" : "AI 識別結果"}
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 ${CONFIDENCE_COLOR[preview.confidence] ?? CONFIDENCE_COLOR.medium}`}
              >
                {CONFIDENCE_LABEL[preview.confidence] ?? preview.confidence}
              </Badge>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 text-muted-foreground"
              onClick={handleDismiss}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>

          {/* Field list */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            {Object.entries(preview.fields).map(([key, val]) => (
              <div key={key} className="flex items-baseline gap-1 min-w-0">
                <span className="text-muted-foreground shrink-0">{FIELD_LABELS[key] ?? key}:</span>
                <span className="font-medium text-foreground truncate">{val}</span>
              </div>
            ))}
          </div>

          {preview.notes && (
            <p className="text-muted-foreground/70 italic">{preview.notes}</p>
          )}

          {!applied && (
            <Button
              type="button"
              size="sm"
              className="w-full h-7 text-xs hero-gradient text-white"
              onClick={handleApply}
            >
              填入表單欄位
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
