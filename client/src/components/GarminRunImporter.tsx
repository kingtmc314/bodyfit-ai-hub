import { useRef, useState } from "react";
import { CheckCircle2, FileImage, Images, Info, Loader2, Sparkles, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

const MAX_SCREENSHOTS = 16;
const MAX_TOTAL_BYTES = 30 * 1024 * 1024;

interface GarminRunImporterProps {
  onExtracted: (fields: Record<string, unknown>, sourceFiles: File[]) => void;
}

type GarminPreview = {
  fields: Record<string, unknown>;
  confidence: "high" | "medium" | "low";
  notes: string;
  lapCount: number;
  screenshotCount: number;
};

const labels: Record<string, string> = {
  date: "日期（香港）",
  distanceKm: "距離",
  hour: "時",
  minutes: "分",
  second: "秒",
  averagePace: "平均配速",
  bestPace: "最佳配速",
  averageHeartRate: "平均心率",
  maximumHeartRate: "最高心率",
  averageCadence: "平均步頻",
  maxCadence: "最高步頻",
  calories: "總卡路里",
  avgStrideLengthM: "平均步幅",
  avgVerticalRatio: "平均垂直比率",
  verticalOscillationCm: "平均垂直振幅",
  avgGroundContactTimeMs: "平均觸地時間",
  temperature: "氣溫",
};

function readBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function buildFields(result: any): Record<string, unknown> {
  const run = result.running ?? {};
  const details = result.garminDetails ?? {};
  const values: Record<string, unknown> = {};
  if (result.date) values.date = result.date;
  if (result.time) values.weatherTime = result.time;
  const direct: Array<[string, string]> = [
    ["distanceKm", "distanceKm"], ["durationHour", "hour"], ["durationMin", "minutes"], ["durationSec", "second"],
    ["avgPace", "averagePace"], ["bestPace", "bestPace"], ["avgHr", "averageHeartRate"], ["maxHr", "maximumHeartRate"],
    ["avgCadence", "averageCadence"], ["maxCadence", "maxCadence"], ["calories", "calories"],
    ["avgStrideLengthM", "avgStrideLengthM"], ["avgVerticalRatio", "avgVerticalRatio"],
    ["verticalOscillationCm", "verticalOscillationCm"], ["avgGroundContactTimeMs", "avgGroundContactTimeMs"],
  ];
  direct.forEach(([source, target]) => { if (run[source] !== null && run[source] !== undefined) values[target] = String(run[source]); });
  if (run.runningType) values.runningType = run.runningType;
  if (run.temperatureC !== null && run.temperatureC !== undefined) values.temperature = String(run.temperatureC);
  if (run.routeName) values.notes = `Garmin 路線：${run.routeName}`;
  values.garminDetails = details;
  values.laps = result.laps ?? [];
  return values;
}

function displayValue(key: string, value: unknown) {
  const raw = String(value);
  if (key === "distanceKm") return `${raw} km`;
  if (key === "averageHeartRate" || key === "maximumHeartRate") return `${raw} bpm`;
  if (key === "averageCadence" || key === "maxCadence") return `${raw} spm`;
  if (key === "calories") return `${raw} kcal`;
  if (key === "avgStrideLengthM") return `${raw} m`;
  if (key === "avgVerticalRatio") return `${raw}%`;
  if (key === "verticalOscillationCm") return `${raw} cm`;
  if (key === "avgGroundContactTimeMs") return `${raw} ms`;
  if (key === "temperature") return `${raw}°C`;
  return raw;
}

export default function GarminRunImporter({ onExtracted }: GarminRunImporterProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<GarminPreview | null>(null);
  const [applied, setApplied] = useState(false);
  const extractMutation = trpc.imageImport.extractGarminRun.useMutation({
    onSuccess: (result) => {
      const fields = buildFields(result);
      const count = Object.entries(fields).filter(([key, value]) => !["garminDetails", "laps"].includes(key) && value !== "" && value != null).length;
      if (!count) return toast.error("未能從截圖讀取主要跑步數據，請確保已包含 Garmin 總覽或 Stats 畫面。");
      setPreview({ fields, confidence: result.confidence, notes: result.notes, lapCount: result.laps?.length ?? 0, screenshotCount: files.length });
      setApplied(false);
    },
    onError: (error) => {
      const raw = error.message || "";
      const guidance = /expected pattern|invalid url|image_url|url/i.test(raw)
        ? "已改用直接圖片資料與每 5 張自動分批合併；請再次按「合併分析」。若仍失敗，可先保留總覽、Stats、Laps 這 3–8 張最清晰畫面。"
        : /json|format|parse/i.test(raw)
          ? "分析服務回傳格式不完整；請重試或減少至 6–8 張最清晰的 Garmin 畫面。"
          : "請重試；你目前已選取的截圖會保留在這個視窗。";
      toast.error("Garmin 截圖分析暫時未完成", { description: guidance });
    },
  });

  const chooseFiles = (selected: FileList | null) => {
    const candidates = Array.from(selected ?? []);
    const valid = candidates.filter(file => file.type.startsWith("image/") && file.size <= 10 * 1024 * 1024);
    if (!valid.length) return;
    if (valid.length !== candidates.length) toast.message("只保留圖片檔案，每張上限 10MB");
    let totalBytes = 0;
    const withinTotalLimit = valid.filter((file) => {
      if (totalBytes + file.size > MAX_TOTAL_BYTES) return false;
      totalBytes += file.size;
      return true;
    }).slice(0, MAX_SCREENSHOTS);
    if (withinTotalLimit.length !== valid.length) {
      toast.message("已保留合計 30MB 內的截圖；系統會每 5 張自動分批分析並合併結果。");
    }
    setFiles(withinTotalLimit);
    setPreview(null);
    setApplied(false);
  };

  const analyze = async () => {
    if (!files.length) return toast.error("請先選擇 Garmin 截圖");
    try {
      const screenshots = await Promise.all(files.map(async file => ({ base64: await readBase64(file), mimeType: file.type })));
      extractMutation.mutate({ screenshots });
    } catch {
      toast.error("未能讀取截圖，請重試");
    }
  };

  const apply = () => {
    if (!preview) return;
    onExtracted(preview.fields, files);
    setApplied(true);
    toast.success(`已填入同一筆跑步紀錄，並會在儲存時保留 ${files.length} 張來源截圖`);
  };

  const visibleFields = preview ? Object.entries(preview.fields).filter(([key, value]) => labels[key] && value !== "" && value != null) : [];

  return <section className="overflow-hidden rounded-xl border border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-4 dark:border-violet-400/15 dark:from-violet-950/25 dark:via-card dark:to-fuchsia-950/10">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/12 text-violet-600 dark:text-violet-300"><Images className="h-4.5 w-4.5" /></span><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-300">GARMIN CONTINUOUS IMPORT</p><h4 className="mt-0.5 text-sm font-bold text-foreground">連續截圖合併匯入</h4><p className="mt-1 text-xs leading-5 text-muted-foreground">可一次選擇總覽、Stats、Laps、Charts 等多個畫面；系統每 5 張自動分批分析，再合併為同一筆跑步供你核對。</p></div></div><Badge variant="outline" className="w-fit border-violet-200 bg-white/70 text-[10px] text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200">最多 16 張／合計 30MB</Badge></div>

    <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={event => { chooseFiles(event.target.files); event.target.value = ""; }} />
    <div className="mt-4 flex flex-wrap items-center gap-2"><Button type="button" variant="outline" size="sm" className="border-violet-200 bg-white text-violet-700 hover:bg-violet-50 dark:border-violet-400/20 dark:bg-slate-950/30 dark:text-violet-200" onClick={() => inputRef.current?.click()} disabled={extractMutation.isPending}><UploadCloud className="mr-1.5 h-3.5 w-3.5" />選擇 Garmin 截圖</Button><Button type="button" size="sm" className="bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-400 dark:text-slate-950 dark:hover:bg-violet-300" onClick={analyze} disabled={!files.length || extractMutation.isPending}>{extractMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}{extractMutation.isPending ? "分析多張畫面中…" : `合併分析${files.length ? ` (${files.length})` : ""}`}</Button>{files.length > 0 && <button type="button" className="ml-auto text-xs text-muted-foreground hover:text-foreground" onClick={() => { setFiles([]); setPreview(null); }}>清除</button>}</div>

    {files.length > 0 && <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{files.map((file, index) => <div key={`${file.name}-${index}`} className="flex min-w-20 items-center gap-1.5 rounded-lg border border-violet-200/80 bg-white/75 px-2 py-1.5 text-[10px] text-violet-800 dark:border-violet-400/15 dark:bg-slate-950/35 dark:text-violet-100"><FileImage className="h-3.5 w-3.5 shrink-0" /><span className="max-w-24 truncate">{index + 1}. {file.name}</span><button type="button" className="text-violet-400 hover:text-rose-500" onClick={() => { setFiles(current => current.filter((_, fileIndex) => fileIndex !== index)); setPreview(null); }}><X className="h-3 w-3" /></button></div>)}</div>}

    {preview && <div className="mt-4 rounded-xl border border-violet-200/90 bg-white/75 p-3.5 dark:border-violet-400/15 dark:bg-slate-950/35"><div className="flex flex-wrap items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /><span className="text-xs font-bold text-foreground">同一跑步的合併辨識結果</span><Badge variant="outline" className={preview.confidence === "high" ? "border-emerald-300 text-emerald-700 dark:text-emerald-300" : "border-amber-300 text-amber-700 dark:text-amber-200"}>{preview.confidence === "high" ? "高可信度" : preview.confidence === "medium" ? "中可信度" : "請仔細核對"}</Badge><span className="text-[11px] text-muted-foreground">{preview.screenshotCount} 張來源 · {preview.lapCount} 個分段</span></div><div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 xl:grid-cols-4">{visibleFields.map(([key, value]) => <div key={key} className="min-w-0"><p className="text-[10px] text-muted-foreground">{labels[key]}</p><p className="truncate text-xs font-semibold text-foreground">{displayValue(key, value)}</p></div>)}</div>{preview.notes && <p className="mt-3 text-[11px] leading-4 text-muted-foreground">{preview.notes}</p>}<div className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/80 px-2.5 py-2 text-[11px] leading-4 text-amber-800 dark:border-amber-400/15 dark:bg-amber-400/10 dark:text-amber-100"><Info className="mr-1 inline h-3.5 w-3.5" />截圖可準確導入摘要、統計及每公里分段；要保留逐秒配速／心率／功率曲線，請日後上載原始 Garmin FIT 或 CSV 匯出檔。</div>{!applied && <Button type="button" size="sm" className="mt-3 w-full bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-400 dark:text-slate-950" onClick={apply}>填入這筆跑步並保留所有來源截圖</Button>}{applied && <p className="mt-3 text-center text-xs font-medium text-emerald-600 dark:text-emerald-300">已填入表單。請核對數據後按「儲存」。</p>}</div>}
  </section>;
}
