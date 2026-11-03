import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  FileImage,
  ImagePlus,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  type InBodyReport,
  inBodyPrimaryMetrics,
  inBodyReportSchema,
} from "@shared/inbodyReport";
import { trpc } from "@/lib/trpc";
import {
  prepareReportPhoto,
  type PreparedReportPhoto,
} from "@/lib/prepareReportPhoto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export interface InBodyReportImporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  onGenericImport?: () => void;
  onCsvImport?: () => void;
}

type MetricKey = keyof InBodyReport["metrics"];
type SegmentKey = keyof InBodyReport["segments"];
type SegmentMetric = keyof InBodyReport["segments"]["leftArm"];

const PRIMARY_FIELDS: { key: MetricKey; label: string; unit: string }[] = [
  { key: "weight", label: "體重", unit: "kg" },
  { key: "bodyFatPct", label: "體脂率", unit: "%" },
  { key: "muscleMass", label: "骨骼肌量 SMM", unit: "kg" },
  { key: "bmi", label: "BMI", unit: "" },
  { key: "fatMass", label: "體脂肪量", unit: "kg" },
  { key: "bmr", label: "基礎代謝率 BMR", unit: "kcal／日" },
  { key: "visceralFat", label: "內臟脂肪等級", unit: "" },
];
const ADVANCED_FIELDS: typeof PRIMARY_FIELDS = [
  { key: "totalBodyWaterKg", label: "身體總水分 TBW", unit: "kg" },
  { key: "fatFreeMassKg", label: "除脂體重 FFM", unit: "kg" },
  { key: "waistHipRatio", label: "腰臀比 WHR", unit: "" },
  { key: "muscleControlKg", label: "肌肉控制（保留正負號）", unit: "kg" },
  { key: "fatControlKg", label: "脂肪控制（保留正負號）", unit: "kg" },
];
const SEGMENTS: { key: SegmentKey; label: string }[] = [
  { key: "leftArm", label: "左臂" },
  { key: "rightArm", label: "右臂" },
  { key: "trunk", label: "軀幹" },
  { key: "leftLeg", label: "左腿" },
  { key: "rightLeg", label: "右腿" },
];
const SEGMENT_FIELDS: { key: SegmentMetric; label: string }[] = [
  { key: "leanKg", label: "除脂量 kg" },
  { key: "fatKg", label: "脂肪 kg" },
  { key: "fatPct", label: "體脂 %" },
];
const FIELD_LABELS: Record<string, string> = {
  date: "報告日期",
  time: "報告時間",
  heightCm: "身高",
  age: "年齡",
  sex: "性別",
};
for (const field of [...PRIMARY_FIELDS, ...ADVANCED_FIELDS])
  FIELD_LABELS[`metrics.${field.key}`] = field.label;
for (const segment of SEGMENTS)
  for (const field of SEGMENT_FIELDS)
    FIELD_LABELS[`segments.${segment.key}.${field.key}`] =
      `${segment.label} ${field.label}`;

/** Keep a raw draft so negative controls, decimals and invalid input remain editable. */
function numberFromDraft(value: string): number | null {
  const text = value.trim();
  if (text === "") return null;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return Number.NaN;
  return Number(text);
}

function NumericField({
  id,
  label,
  unit,
  value,
  onChange,
  invalid = false,
}: {
  id: string;
  label: string;
  unit?: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label
        htmlFor={id}
        className="block text-xs font-medium text-muted-foreground"
      >
        {label}
        {unit ? ` (${unit})` : ""}
      </label>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="未列明"
        value={value}
        onChange={event => onChange(event.target.value)}
        aria-invalid={invalid}
        className="h-11 tabular-nums"
      />
    </div>
  );
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "連線暫時失敗，請稍後重試。";
}

export default function InBodyReportImporter({
  open,
  onOpenChange,
  onSaved,
  onGenericImport,
  onCsvImport,
}: InBodyReportImporterProps) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const mounted = useRef(true);
  const saveLock = useRef(false);
  const alreadySaved = useRef(false);
  const extractLock = useRef(false);
  const selectedFile = useRef<File | null>(null);
  const preparedPhoto = useRef<PreparedReportPhoto | null>(null);
  const objectUrl = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState("");
  const [report, setReport] = useState<InBodyReport | null>(null);
  const [source, setSource] = useState<{
    sourceKey: string;
    fileName: string;
  } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{
    kind: "extract" | "save";
    message: string;
  } | null>(null);
  const [saved, setSaved] = useState<{
    id: number;
    status: "created" | "duplicate";
    date: string;
  } | null>(null);
  const extractMutation = trpc.imageImport.extractInBody.useMutation();
  const saveMutation = trpc.body.saveInBodyReport.useMutation();

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestId.current += 1;
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    };
  }, []);

  const validation = report ? inBodyReportSchema.safeParse(report) : null;
  const invalidPaths = new Set(
    validation && !validation.success
      ? validation.error.issues.map(issue => issue.path.join("."))
      : []
  );
  const primary = report ? inBodyPrimaryMetrics(report) : {};
  const hasPrimary = Object.entries(primary).some(
    ([key, value]) =>
      key !== "date" && typeof value === "number" && Number.isFinite(value)
  );
  const canSave = Boolean(
    report?.date &&
      source &&
      validation?.success &&
      hasPrimary &&
      !extracting &&
      !saving &&
      !saved
  );

  const close = (next: boolean) => {
    if (saveLock.current) return;
    if (!next && extractLock.current) {
      // Closed/obsolete requests may not replace a later selection or review.
      requestId.current += 1;
      extractLock.current = false;
      setExtracting(false);
    }
    onOpenChange(next);
  };

  async function extract(file: File, id: number) {
    extractLock.current = true;
    setExtracting(true);
    setError(null);
    try {
      const photo = preparedPhoto.current ?? (await prepareReportPhoto(file));
      if (!mounted.current || id !== requestId.current) return;
      preparedPhoto.current = photo;
      const result = await extractMutation.mutateAsync({
        base64: photo.base64,
        mimeType: photo.mimeType,
        fileName: photo.fileName,
      });
      if (!mounted.current || id !== requestId.current) return;
      const parsed = inBodyReportSchema.safeParse(result.report);
      if (!parsed.success)
        throw new Error("辨識結果格式不完整，請重試辨識；相片會保留。");
      setReport(parsed.data);
      setDrafts({});
      setSource({ sourceKey: result.sourceKey, fileName: result.fileName });
    } catch (cause) {
      if (mounted.current && id === requestId.current)
        setError({ kind: "extract", message: errorText(cause) });
    } finally {
      if (mounted.current && id === requestId.current) {
        extractLock.current = false;
        setExtracting(false);
      }
    }
  }

  function chooseFile(file?: File) {
    // Cancelling the native file picker intentionally leaves the review untouched.
    if (!file || saveLock.current) return;
    const id = ++requestId.current;
    alreadySaved.current = false;
    selectedFile.current = file;
    preparedPhoto.current = null;
    setReport(null);
    setSource(null);
    setSaved(null);
    setDrafts({});
    setError(null);
    setSelectedName(file.name);
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(file);
    setPreviewUrl(objectUrl.current);
    void extract(file, id);
  }

  function retryExtraction() {
    if (extractLock.current || saveLock.current || !selectedFile.current)
      return;
    void extract(selectedFile.current, ++requestId.current);
  }

  function updateNumber(
    path: string,
    value: string,
    apply: (previous: InBodyReport, number: number | null) => InBodyReport
  ) {
    if (saveLock.current || saved) return;
    setDrafts(previous => ({ ...previous, [path]: value }));
    setReport(previous =>
      previous ? apply(previous, numberFromDraft(value)) : previous
    );
  }

  function draft(path: string, value: number | null): string {
    return drafts[path] ?? (value === null ? "" : String(value));
  }

  async function confirmSave() {
    // Ref lock closes the double-click gap before React has rendered isPending.
    if (
      saveLock.current ||
      alreadySaved.current ||
      extractLock.current ||
      !canSave ||
      !source ||
      !validation?.success
    )
      return;
    saveLock.current = true;
    setSaving(true);
    setError(null);
    let succeeded = false;
    try {
      const result = await saveMutation.mutateAsync({
        report: validation.data,
        sourceKey: source.sourceKey,
        fileName: source.fileName,
      });
      alreadySaved.current = true;
      succeeded = true;
      if (mounted.current) setSaved(result);
    } catch (cause) {
      // Keep the same reviewed report and stored source key: retry never re-OCRs.
      if (mounted.current)
        setError({ kind: "save", message: errorText(cause) });
    } finally {
      saveLock.current = false;
      if (mounted.current) setSaving(false);
    }
    if (succeeded) onSaved();
  }

  const metricField = (field: (typeof PRIMARY_FIELDS)[number]) => {
    if (!report) return null;
    const path = `metrics.${field.key}`;
    return (
      <NumericField
        key={field.key}
        id={`inbody-${field.key}`}
        label={field.label}
        unit={field.unit}
        value={draft(path, report.metrics[field.key])}
        invalid={invalidPaths.has(path)}
        onChange={value =>
          updateNumber(path, value, (previous, number) => ({
            ...previous,
            metrics: { ...previous.metrics, [field.key]: number },
          }))
        }
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        data-no-padding
        className="max-h-[85dvh] gap-0 rounded-2xl sm:max-w-2xl"
        showCloseButton={!saving}
        onEscapeKeyDown={event => {
          if (saveLock.current) event.preventDefault();
        }}
        onInteractOutside={event => {
          if (saveLock.current) event.preventDefault();
        }}
      >
        <DialogHeader className="shrink-0 border-b border-border bg-gradient-to-br from-emerald-500/10 via-background to-orange-500/5 px-5 pb-4 pt-5 text-left">
          <DialogTitle className="flex items-center gap-2 pr-8">
            <FileImage className="size-5 text-emerald-500" />
            匯入身體數據
          </DialogTitle>
          <DialogDescription>
            拍攝整頁報告 → AI 辨識 → 核對及編輯 → 確認儲存
          </DialogDescription>
          <label htmlFor="inbody-template" className="sr-only">
            匯入範本
          </label>
          <select
            id="inbody-template"
            aria-label="匯入範本"
            value="inbody-paper-v1"
            disabled={saving}
            className="mt-1 h-11 w-full rounded-xl border border-emerald-500/25 bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50"
            onChange={event => {
              if (saveLock.current) return;
              const navigate = event.target.value === "generic"
                ? onGenericImport
                : event.target.value === "csv" ? onCsvImport : undefined;
              if (!navigate) return;
              requestId.current += 1;
              extractLock.current = false;
              setExtracting(false);
              navigate();
            }}
          >
            <option value="inbody-paper-v1">InBody 紙本報告</option>
            <option value="generic" disabled={!onGenericImport}>
              一般身體數據截圖
            </option>
            <option value="csv" disabled={!onCsvImport}>CSV 匯入</option>
          </select>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5">
          <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <h3 className="text-sm font-semibold">保留整張報告，不裁邊</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              把四邊、列印日期及數值拍清楚，避免反光。相片會先在裝置壓縮；拍照及辨識不會建立身體記錄，只有確認儲存才會附上來源相片。
            </p>
            <input
              ref={cameraInput}
              type="file"
              accept="image/*,.heic,.heif"
              capture="environment"
              className="hidden"
              aria-label="拍攝 InBody 報告"
              onChange={event => {
                chooseFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <input
              ref={galleryInput}
              type="file"
              accept="image/*,.heic,.heif"
              className="hidden"
              aria-label="從相簿選取 InBody 報告"
              onChange={event => {
                chooseFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                type="button"
                className="h-11 gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={saving}
                onClick={() => cameraInput.current?.click()}
              >
                <Camera className="size-4" />
                {previewUrl ? "重新拍照" : "拍攝報告"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 gap-2"
                disabled={saving}
                onClick={() => galleryInput.current?.click()}
              >
                <ImagePlus className="size-4" />
                從相簿選取
              </Button>
            </div>
          </section>

          {previewUrl && (
            <figure className="space-y-2">
              <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
                <img
                  src={previewUrl}
                  alt="所選 InBody 整頁報告預覽"
                  className="mx-auto max-h-72 w-full object-contain"
                />
              </div>
              <figcaption className="break-all text-xs text-muted-foreground">
                {selectedName} · 本機預覽
              </figcaption>
            </figure>
          )}

          {extracting && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm"
            >
              <Loader2 className="size-5 shrink-0 animate-spin text-emerald-500" />
              <div>
                <p className="font-medium">正在壓縮及辨識報告…</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  尚未儲存記錄；完成後請核對每個欄位。
                </p>
              </div>
            </div>
          )}
          {previewUrl && !report && !extracting && !error && (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full gap-2"
              onClick={retryExtraction}
            >
              <RotateCcw className="size-4" />
              繼續辨識已選相片
            </Button>
          )}

          {error && (
            <div
              role="alert"
              className="space-y-2 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4"
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-orange-600 dark:text-orange-300">
                <AlertCircle className="size-4 shrink-0" />
                {error.kind === "save" ? "未能確認儲存" : "未能辨識相片"}
              </p>
              <p className="break-words text-sm">{error.message}</p>
              <p className="text-xs text-muted-foreground">
                {error.kind === "save"
                  ? "已保留你核對的數據及來源相片，直接再次確認即可，毋須重新上載或辨識。"
                  : "所選相片已保留，可直接重試，或選取較清晰的相片。"}
              </p>
              {error.kind === "extract" && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 gap-2"
                  disabled={extracting || saving}
                  onClick={retryExtraction}
                >
                  <RotateCcw className="size-4" />
                  重試辨識
                </Button>
              )}
            </div>
          )}

          {saved && (
            <div
              role="status"
              aria-live="polite"
              className="space-y-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5"
            >
              <CheckCircle2 className="size-7 text-emerald-500" />
              <p className="font-semibold">
                {saved.status === "duplicate"
                  ? "這份報告已儲存，沒有重複新增"
                  : "InBody 報告已儲存"}
              </p>
              <p className="text-sm text-muted-foreground">
                {saved.date} · 記錄 #{saved.id}
                {saved.status === "duplicate"
                  ? " · 已找到相同報告"
                  : " · 數據及來源相片已附上"}
              </p>
            </div>
          )}

          {report && (
            <fieldset
              disabled={saving || Boolean(saved)}
              className="min-w-0 space-y-5 disabled:opacity-75"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Sparkles className="size-4 text-emerald-500" />
                  核對辨識結果
                </h3>
                <Badge
                  variant="outline"
                  className={
                    report.confidence === "high"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                      : "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-300"
                  }
                >
                  {report.confidence === "high"
                    ? "高可信度 · 仍請核對"
                    : report.confidence === "medium"
                      ? "中可信度 · 需要核對"
                      : "低可信度 · 必須仔細核對"}
                </Badge>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                所有欄位均可修改，未列明或無法確認的數值請留空，不會補成
                0。低可信度不會阻止你核實後儲存。
              </p>
              {report.warnings.length > 0 && (
                <div className="rounded-xl border border-orange-500/25 bg-orange-500/5 p-3 text-xs leading-relaxed">
                  <p className="mb-1 font-semibold text-orange-600 dark:text-orange-300">
                    AI 提醒／需要核實
                  </p>
                  <ul className="list-disc space-y-1 pl-4">
                    {report.warnings.map((warning, index) => (
                      <li className="break-words" key={`${index}-${warning}`}>
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <section className="space-y-3 rounded-xl border border-border p-3">
                <h4 className="text-sm font-semibold">
                  報告列印日期及時間（香港時間）
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <label
                      htmlFor="inbody-date"
                      className="block text-xs font-medium text-muted-foreground"
                    >
                      日期 · 必填
                    </label>
                    <Input
                      id="inbody-date"
                      type="date"
                      value={report.date ?? ""}
                      required
                      aria-invalid={!report.date || invalidPaths.has("date")}
                      className="h-11"
                      onChange={event =>
                        setReport(previous =>
                          previous
                            ? { ...previous, date: event.target.value || null }
                            : previous
                        )
                      }
                    />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <label
                      htmlFor="inbody-time"
                      className="block text-xs font-medium text-muted-foreground"
                    >
                      時間 · 未列明可留空
                    </label>
                    <Input
                      id="inbody-time"
                      type="time"
                      step="1"
                      value={report.time ?? ""}
                      aria-invalid={invalidPaths.has("time")}
                      className="h-11"
                      onChange={event =>
                        setReport(previous =>
                          previous
                            ? { ...previous, time: event.target.value || null }
                            : previous
                        )
                      }
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  請照報告列印的量度日期及時間填寫，不採用拍攝／上載時間；缺少日期不會自動改成今天。
                </p>
              </section>

              <div className="grid grid-cols-2 gap-3">
                {PRIMARY_FIELDS.map(metricField)}
              </div>

              <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3 text-xs leading-relaxed text-muted-foreground">
                <p>
                  基礎代謝率 BMR 並非建議攝取熱量；骨骼肌量 SMM 並非除脂體重
                  FFM。
                </p>
                <p className="mt-1">
                  內臟脂肪只填報告明確列印的等級，不會從腰臀比 WHR
                  推算。分段的「標準百分比」也不等於體脂率。
                </p>
              </div>

              <Accordion
                type="multiple"
                className="rounded-xl border border-border px-3"
              >
                <AccordionItem value="advanced">
                  <AccordionTrigger>進階數據及基本資料</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {ADVANCED_FIELDS.map(metricField)}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <NumericField
                        id="inbody-height"
                        label="身高"
                        unit="cm"
                        value={draft("heightCm", report.heightCm)}
                        invalid={invalidPaths.has("heightCm")}
                        onChange={value =>
                          updateNumber(
                            "heightCm",
                            value,
                            (previous, number) => ({
                              ...previous,
                              heightCm: number,
                            })
                          )
                        }
                      />
                      <NumericField
                        id="inbody-age"
                        label="年齡"
                        value={draft("age", report.age)}
                        invalid={invalidPaths.has("age")}
                        onChange={value =>
                          updateNumber("age", value, (previous, number) => ({
                            ...previous,
                            age: number,
                          }))
                        }
                      />
                      <div className="col-span-2 space-y-1.5">
                        <label
                          htmlFor="inbody-sex"
                          className="block text-xs font-medium text-muted-foreground"
                        >
                          報告列印性別
                        </label>
                        <select
                          id="inbody-sex"
                          value={report.sex ?? ""}
                          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                          onChange={event => {
                            const sex =
                              event.target.value === "male"
                                ? "male"
                                : event.target.value === "female"
                                  ? "female"
                                  : null;
                            setReport(previous =>
                              previous ? { ...previous, sex } : previous
                            );
                          }}
                        >
                          <option value="">未列明</option>
                          <option value="male">男</option>
                          <option value="female">女</option>
                        </select>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="segments">
                  <AccordionTrigger>
                    五部位分段數據（左右分開）
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="mb-3 text-xs text-muted-foreground">
                      以報告標示的左／右為準，不按相片方向互換。只填明確列出的
                      kg 或體脂 %。
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[320px] table-fixed text-xs">
                        <caption className="sr-only">
                          左臂、右臂、軀幹、左腿及右腿的除脂量與脂肪數據
                        </caption>
                        <thead>
                          <tr className="text-muted-foreground">
                            <th scope="col" className="w-12 pb-2 text-left">
                              部位
                            </th>
                            {SEGMENT_FIELDS.map(field => (
                              <th
                                key={field.key}
                                scope="col"
                                className="pb-2 text-center font-medium"
                              >
                                {field.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {SEGMENTS.map(segment => (
                            <tr
                              key={segment.key}
                              className="border-t border-border/60"
                            >
                              <th
                                scope="row"
                                className="py-2 text-left font-medium"
                              >
                                {segment.label}
                              </th>
                              {SEGMENT_FIELDS.map(field => {
                                const path = `segments.${segment.key}.${field.key}`;
                                return (
                                  <td key={field.key} className="p-1">
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      aria-label={`${segment.label} ${field.label}`}
                                      placeholder="—"
                                      aria-invalid={invalidPaths.has(path)}
                                      value={draft(
                                        path,
                                        report.segments[segment.key][field.key]
                                      )}
                                      className="h-11 px-2 text-center tabular-nums"
                                      onChange={event =>
                                        updateNumber(
                                          path,
                                          event.target.value,
                                          (previous, number) => ({
                                            ...previous,
                                            segments: {
                                              ...previous.segments,
                                              [segment.key]: {
                                                ...previous.segments[
                                                  segment.key
                                                ],
                                                [field.key]: number,
                                              },
                                            },
                                          })
                                        )
                                      }
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
              <div className="space-y-1.5">
                <label
                  htmlFor="inbody-notes"
                  className="text-xs font-medium text-muted-foreground"
                >
                  備註
                </label>
                <Textarea
                  id="inbody-notes"
                  value={report.notes}
                  onChange={event =>
                    setReport(previous =>
                      previous
                        ? { ...previous, notes: event.target.value }
                        : previous
                    )
                  }
                  placeholder="選填；請勿填寫不必要的個人資料"
                />
              </div>
              {validation && !validation.success && (
                <div
                  role="alert"
                  className="rounded-xl border border-orange-500/25 p-3 text-xs text-orange-600 dark:text-orange-300"
                >
                  <p className="font-medium">請先修正以下欄位：</p>
                  <ul className="mt-1 list-disc pl-4">
                    {Array.from(invalidPaths).map(path => (
                      <li key={path}>
                        請核對「{FIELD_LABELS[path] ?? path}
                        」的數值、格式或範圍。
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!report.date && (
                <p className="text-xs text-orange-600 dark:text-orange-300">
                  未讀到量度日期。請核對報告並填寫，才可儲存。
                </p>
              )}
              {!hasPrimary && (
                <p className="text-xs text-orange-600 dark:text-orange-300">
                  至少核實並填寫一項主要身體數據（例如體重或體脂率），才可儲存。
                </p>
              )}
              <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                數據及相片只會在你按「確認儲存」後附加至目前 Life-OS 的 Supabase
                記錄。本功能只作記錄，不提供醫療診斷。
              </p>
            </fieldset>
          )}
          {!previewUrl && (
            <div className="py-4 text-center text-xs text-muted-foreground">
              先選取報告相片，辨識後在此核對。一般截圖請使用上方另一範本。
            </div>
          )}
        </div>

        <footer className="sticky bottom-0 z-10 shrink-0 border-t border-border bg-background px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {saved ? (
            <Button
              type="button"
              className="h-11 w-full bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => close(false)}
            >
              完成
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 shrink-0"
                disabled={saving}
                onClick={() => close(false)}
              >
                取消
              </Button>
              <Button
                type="button"
                className="h-11 flex-1 gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={!canSave}
                onClick={() => void confirmSave()}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                {saving
                  ? "儲存中，請稍候…"
                  : error?.kind === "save"
                    ? "重試儲存（不用重新上載）"
                    : "確認儲存"}
              </Button>
            </div>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
