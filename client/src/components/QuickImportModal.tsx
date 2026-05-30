import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Camera, FileSpreadsheet, Upload, Loader2, CheckCircle2, X, AlertCircle } from "lucide-react";
import { todayHKString } from "@/lib/hkTime";

export type ImportDataType = "body" | "heartrate" | "sleep";

interface QuickImportModalProps {
  open: boolean;
  onClose: () => void;
  dataType: ImportDataType;
  onSuccess?: () => void;
}

const DATA_TYPE_LABELS: Record<ImportDataType, { en: string; zh: string; color: string }> = {
  body: { en: "Body Composition", zh: "身體成份", color: "bg-emerald-500" },
  heartrate: { en: "Heart Rate", zh: "心跳", color: "bg-red-500" },
  sleep: { en: "Sleep", zh: "睡眠", color: "bg-indigo-500" },
};

const CSV_FORMAT_HINTS: Record<ImportDataType, { columns: string[]; example: string }> = {
  body: {
    columns: ["Date", "Weight (kg)", "Body Fat (%)", "Muscle Mass (kg)", "BMI", "Visceral Fat", "BMR"],
    example: "2026-05-01,75.5,22.3,58.2,24.1,8,1650",
  },
  heartrate: {
    columns: ["Date", "Resting HR (bpm)", "Max HR (bpm)", "Avg HR (bpm)", "HRV (ms)"],
    example: "2026-05-01,52,145,78,45",
  },
  sleep: {
    columns: ["Date", "Sleep Score", "Duration (h)", "Deep Sleep (h)", "REM Sleep (h)", "Body Battery", "Stress"],
    example: "2026-05-01,82,7.5,1.8,2.1,65,28",
  },
};

// Field label maps for display
const FIELD_LABELS: Record<string, string> = {
  weight: "體重 (kg)", bmi: "BMI", bodyFatPct: "體脂 (%)", muscleMass: "肌肉量 (kg)", visceralFat: "內臟脂肪",
  sleepScore: "睡眠評分", sleepDuration: "睡眠時長 (h)", deepSleep: "深睡 (h)", remSleep: "REM (h)",
  bodyBattery: "身體電量", pulseOx: "血氧 (%)", stress: "壓力",
  restingHr: "靜息心率", highHr: "最高心率", avgHr: "平均心率", hrv: "HRV (ms)",
  calories: "卡路里", protein: "蛋白質 (g)", carbs: "碳水 (g)", fat: "脂肪 (g)", fiber: "纖維 (g)",
};

// ─── Photo Import Tab ──────────────────────────────────────────────────────────
function PhotoImportTab({ dataType, onSuccess, onClose }: { dataType: ImportDataType; onSuccess?: () => void; onClose: () => void }) {
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(todayHKString());
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const extractMutation = trpc.imageImport.extract.useMutation({
    onSuccess: (data) => {
      setExtractedData(data);
      // If the AI detected a date, use it
      if (data.date) setSelectedDate(data.date);
    },
    onError: (err) => {
      toast.error(`AI 提取失敗: ${err.message}`);
    },
  });

  const saveMutation = trpc.imageImport.save.useMutation({
    onSuccess: () => {
      toast.success(`✅ 已儲存圖片中的健康數據！`);
      utils.body.getAll.invalidate();
      utils.heartRate.getAll.invalidate();
      utils.sleep.getAll.invalidate();
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      toast.error(`儲存失敗: ${err.message}`);
    },
  });

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("請上傳圖片檔案");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("圖片必須小於 10MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const base64 = result.split(",")[1];
      setImageBase64(base64);
      setImagePreviewUrl(result);
      setExtractedData(null);
      extractMutation.mutate({ base64, mimeType: file.type, dataType });
    };
    reader.readAsDataURL(file);
  }, [dataType, extractMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleSave = () => {
    if (!extractedData || !imageBase64) return;
    const dt = (extractedData.detectedType && extractedData.detectedType !== "unknown" ? extractedData.detectedType : dataType) as "body" | "sleep" | "heartrate" | "nutrition";
    saveMutation.mutate({
      dataType: dt,
      date: selectedDate,
      body: extractedData.body,
      sleep: extractedData.sleep,
      heartrate: extractedData.heartrate,
      nutrition: extractedData.nutrition,
    });
  };

  // Determine which section to show based on detectedType or dataType
  const getRelevantFields = (): Record<string, number | null> => {
    if (!extractedData) return {};
    const dt = extractedData.detectedType && extractedData.detectedType !== "unknown" ? extractedData.detectedType : dataType;
    const section = extractedData[dt] ?? {};
    return section;
  };

  const renderExtractedFields = () => {
    if (!extractedData) return null;
    const fields = getRelevantFields();
    const entries = Object.entries(fields).filter(([, v]) => v != null && v !== 0);

    if (entries.length === 0) {
      // Try showing all non-null fields across all sections
      const allFields: [string, number | null][] = [];
      for (const section of ["body", "sleep", "heartrate", "nutrition"] as const) {
        if (extractedData[section]) {
          Object.entries(extractedData[section]).forEach(([k, v]) => {
            if (v != null && v !== 0) allFields.push([k, v as number]);
          });
        }
      }
      if (allFields.length === 0) {
        return (
          <div className="flex items-center gap-2 text-amber-600 text-sm p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>未能從圖片提取數據，請嘗試更清晰的截圖。</span>
          </div>
        );
      }
      return renderFieldGrid(allFields);
    }
    return renderFieldGrid(entries as [string, number | null][]);
  };

  const renderFieldGrid = (entries: [string, number | null][]) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">提取的數據</p>
        {extractedData?.detectedType && extractedData.detectedType !== "unknown" && (
          <Badge variant="secondary" className="text-xs capitalize">{extractedData.detectedType}</Badge>
        )}
        {extractedData?.confidence && (
          <Badge variant={extractedData.confidence === "high" ? "default" : "secondary"} className="text-xs">
            信心: {extractedData.confidence === "high" ? "高" : extractedData.confidence === "medium" ? "中" : "低"}
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {entries.map(([key, value]) => (
          <div key={key} className="bg-muted/50 rounded-lg p-2.5">
            <p className="text-xs text-muted-foreground">{FIELD_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").trim()}</p>
            <p className="font-semibold text-sm">{String(value)}</p>
          </div>
        ))}
      </div>
      {extractedData?.notes && (
        <p className="text-xs text-muted-foreground italic">{extractedData.notes}</p>
      )}
    </div>
  );

  // Check if there's any extractable data to save
  const hasExtractedData = (() => {
    if (!extractedData) return false;
    for (const section of ["body", "sleep", "heartrate", "nutrition"] as const) {
      if (extractedData[section]) {
        const hasValues = Object.values(extractedData[section]).some((v) => v != null && v !== 0);
        if (hasValues) return true;
      }
    }
    return false;
  })();

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        {imagePreviewUrl ? (
          <div className="relative inline-block">
            <img src={imagePreviewUrl} alt="Preview" className="max-h-40 max-w-full rounded-lg mx-auto object-contain" />
            <button
              className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs"
              onClick={(e) => { e.stopPropagation(); setImageBase64(null); setImagePreviewUrl(null); setExtractedData(null); }}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <Camera className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="text-sm font-medium">拖放截圖或點擊上傳</p>
            <p className="text-xs text-muted-foreground">支援 Garmin、Apple Health、體脂秤截圖</p>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>

      {/* Extracting State */}
      {extractMutation.isPending && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm">AI 正在分析圖片…</span>
        </div>
      )}

      {/* Extracted Data Preview */}
      {extractedData && renderExtractedFields()}

      {/* Date Selector + Save */}
      {extractedData && (
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium w-16 flex-shrink-0">日期</label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="flex-1"
            />
          </div>
          <Button
            className="w-full gap-2"
            onClick={handleSave}
            disabled={saveMutation.isPending || !hasExtractedData}
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            儲存至 {DATA_TYPE_LABELS[dataType].zh}
          </Button>
          {!hasExtractedData && (
            <p className="text-xs text-muted-foreground text-center">未能提取有效數據，無法儲存</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── CSV Import Tab ────────────────────────────────────────────────────────────
function CsvImportTab({ dataType, onSuccess, onClose }: { dataType: ImportDataType; onSuccess?: () => void; onClose: () => void }) {
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const hint = CSV_FORMAT_HINTS[dataType];

  const previewMutation = trpc.csvImport.preview.useMutation({
    onSuccess: (data) => setPreview(data),
    onError: (err) => toast.error(`預覽失敗: ${err.message}`),
  });

  const importMutation = trpc.csvImport.importData.useMutation({
    onSuccess: (data) => {
      toast.success(`✅ 已匯入 ${data.inserted} 筆記錄（跳過 ${data.skipped} 筆）`);
      utils.body.getAll.invalidate();
      utils.heartRate.getAll.invalidate();
      utils.sleep.getAll.invalidate();
      onSuccess?.();
      onClose();
    },
    onError: (err) => toast.error(`匯入失敗: ${err.message}`),
  });

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);
      previewMutation.mutate({ csvText: text, dataType });
    };
    reader.readAsText(file);
  };

  const handlePreview = () => {
    if (!csvText.trim()) { toast.error("請貼上或上傳 CSV 數據"); return; }
    previewMutation.mutate({ csvText, dataType });
  };

  const handleImport = () => {
    if (!csvText.trim()) return;
    importMutation.mutate({ csvText, dataType });
  };

  return (
    <div className="space-y-4">
      {/* Format Hint */}
      <div className="bg-muted/40 rounded-lg p-3 space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">欄位格式</p>
        <p className="text-xs text-foreground font-mono">{hint.columns.join(", ")}</p>
        <p className="text-xs text-muted-foreground font-mono">{hint.example}</p>
      </div>

      {/* File Upload */}
      <div
        className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        <FileSpreadsheet className="w-8 h-8 text-muted-foreground mx-auto mb-1" />
        <p className="text-sm font-medium">點擊上傳 CSV 檔案</p>
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
      </div>

      {/* Or paste */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">或貼上 CSV 文字</label>
        <textarea
          className="w-full h-28 rounded-lg border border-border bg-muted/30 p-2 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
          placeholder={`在此貼上 CSV 數據…\n${hint.columns.join(",")}\n${hint.example}`}
          value={csvText}
          onChange={(e) => { setCsvText(e.target.value); setPreview(null); }}
        />
      </div>

      {/* Preview */}
      {preview && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{preview.validRows} 有效行</Badge>
            <Badge variant="outline">{preview.totalRows} 總行數</Badge>
            {preview.detectedType && <Badge className="bg-primary/10 text-primary border-primary/20">{preview.detectedType}</Badge>}
          </div>
          {preview.preview?.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="text-xs w-full">
                <thead className="bg-muted/50">
                  <tr>{Object.keys(preview.preview[0]).slice(0, 5).map((k: string) => (
                    <th key={k} className="px-2 py-1.5 text-left font-semibold text-muted-foreground">{k}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {preview.preview.slice(0, 3).map((row: any, i: number) => (
                    <tr key={i} className="border-t border-border">
                      {Object.values(row).slice(0, 5).map((v: any, j: number) => (
                        <td key={j} className="px-2 py-1.5">{String(v ?? "—")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2 border-t border-border">
        {!preview ? (
          <Button className="flex-1 gap-2" variant="outline" onClick={handlePreview} disabled={previewMutation.isPending || !csvText.trim()}>
            {previewMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            預覽
          </Button>
        ) : (
          <Button className="flex-1 gap-2" onClick={handleImport} disabled={importMutation.isPending || !preview.validRows}>
            {importMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            匯入 {preview.validRows} 行
          </Button>
        )}
        {preview && (
          <Button variant="outline" onClick={() => setPreview(null)}>重新預覽</Button>
        )}
      </div>
    </div>
  );
}

// ─── Main Modal ────────────────────────────────────────────────────────────────
export default function QuickImportModal({ open, onClose, dataType, onSuccess }: QuickImportModalProps) {
  const label = DATA_TYPE_LABELS[dataType];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${label.color}`} />
            匯入 {label.zh}
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="photo">
          <TabsList className="w-full">
            <TabsTrigger value="photo" className="flex-1 gap-1.5">
              <Camera className="w-3.5 h-3.5" /> 照片匯入
            </TabsTrigger>
            <TabsTrigger value="csv" className="flex-1 gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5" /> CSV 匯入
            </TabsTrigger>
          </TabsList>
          <TabsContent value="photo" className="mt-4">
            <PhotoImportTab dataType={dataType} onSuccess={onSuccess} onClose={onClose} />
          </TabsContent>
          <TabsContent value="csv" className="mt-4">
            <CsvImportTab dataType={dataType} onSuccess={onSuccess} onClose={onClose} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
