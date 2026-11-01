import { useRef, useState } from "react";
import { FileChartColumnIncreasing, FileUp, Loader2, X, CheckCircle2, Activity, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

type GarminRawPreview = {
  sourceFormat: "FIT" | "CSV";
  fields: Record<string, string>;
  garminDetails: Record<string, string | number | null>;
  laps: Array<{ lap: number; durationSec: number | null; distanceKm: number | null; avgPace: string | null }>;
  timeSeries: Array<Record<string, unknown>>;
  warnings: string[];
};

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("無法讀取檔案"));
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.readAsDataURL(file);
  });
}

export default function GarminRawFileImporter({
  onExtracted,
}: {
  onExtracted: (preview: GarminRawPreview, file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<GarminRawPreview | null>(null);
  const parse = trpc.running.parseGarminRawFile.useMutation({
    onSuccess: (data) => {
      setPreview(data as GarminRawPreview);
      toast.success("已讀取 Garmin 原始檔，請核對下方跑步資料後儲存");
    },
    onError: (error) => toast.error("無法讀取 Garmin 原始檔", { description: error.message || "請確認檔案是由 Garmin 匯出的 FIT 或 CSV。" }),
  });

  const chooseFile = async (selected?: File) => {
    if (!selected) return;
    if (!/\.(fit|csv)$/i.test(selected.name)) {
      toast.error("請選擇 Garmin FIT 或 CSV 原始檔");
      return;
    }
    if (selected.size > 25 * 1024 * 1024) {
      toast.error("原始檔不可超過 25MB");
      return;
    }
    setFile(selected);
    setPreview(null);
    try {
      const base64 = await toBase64(selected);
      parse.mutate({ fileName: selected.name, mimeType: selected.type || "application/octet-stream", base64 });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "無法讀取檔案");
    }
  };

  const clear = () => {
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const apply = () => {
    if (!preview || !file) return;
    onExtracted(preview, file);
  };

  return (
    <section className="mt-3 rounded-2xl border border-sky-300/60 bg-gradient-to-br from-sky-50/85 via-card to-indigo-50/65 p-4 dark:border-sky-400/20 dark:from-sky-950/25 dark:via-card dark:to-indigo-950/20">
      <div className="flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/12 text-sky-700 dark:text-sky-300"><FileChartColumnIncreasing className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-700 dark:text-sky-300">Garmin Original Data</p>
          <h3 className="mt-0.5 text-sm font-bold text-foreground">匯入 FIT／CSV 原始檔</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">直接讀取 Garmin 原始檔的逐秒配速、心率、步頻、功率及海拔資料；先核對摘要，再存成同一筆跑步紀錄。</p>
        </div>
      </div>
      <input ref={inputRef} type="file" accept=".fit,.csv,application/octet-stream,text/csv" className="hidden" onChange={(event) => chooseFile(event.target.files?.[0])} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" className="h-9 rounded-xl border-sky-300/70 bg-card text-sky-700 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-950/35" onClick={() => inputRef.current?.click()} disabled={parse.isPending}>
          {parse.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileUp className="mr-1.5 h-4 w-4" />}
          {parse.isPending ? "讀取原始檔…" : "選擇 FIT／CSV"}
        </Button>
        <Badge variant="outline" className="border-sky-300/60 text-sky-700 dark:text-sky-300">上限 25MB</Badge>
        {file && <span className="max-w-44 truncate text-xs font-medium text-foreground">{file.name}</span>}
        {file && <button type="button" onClick={clear} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" />清除</button>}
      </div>
      {preview && (
        <div className="mt-3 rounded-xl border border-sky-200/80 bg-card/85 p-3 dark:border-sky-400/15">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /><p className="text-xs font-bold text-foreground">已讀取 {preview.sourceFormat} 資料</p></div>
            <Badge className="bg-sky-600 text-white">{preview.timeSeries.length.toLocaleString()} 個逐秒樣本</Badge>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-lg bg-muted/55 p-2"><p className="text-[10px] text-muted-foreground">距離</p><p className="mt-0.5 font-bold text-foreground">{preview.fields.distanceKm || "—"} km</p></div>
            <div className="rounded-lg bg-muted/55 p-2"><p className="text-[10px] text-muted-foreground">平均配速</p><p className="mt-0.5 font-bold text-foreground">{preview.fields.averagePace || "—"} min/km</p></div>
            <div className="rounded-lg bg-muted/55 p-2"><p className="text-[10px] text-muted-foreground">平均心率</p><p className="mt-0.5 font-bold text-foreground">{preview.fields.averageHeartRate || "—"} bpm</p></div>
            <div className="rounded-lg bg-muted/55 p-2"><p className="text-[10px] text-muted-foreground">分段</p><p className="mt-0.5 font-bold text-foreground">{preview.laps.length || "—"} laps</p></div>
          </div>
          {preview.warnings.length > 0 && <div className="mt-2.5 rounded-lg bg-amber-400/10 px-2.5 py-2 text-[11px] leading-4 text-amber-800 dark:text-amber-200"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" />{preview.warnings.join(" ")}</div>}
          <Button type="button" size="sm" className="mt-3 h-8 rounded-lg bg-sky-600 text-xs text-white hover:bg-sky-700" onClick={apply}><Activity className="mr-1.5 h-3.5 w-3.5" />套用到這次跑步</Button>
        </div>
      )}
    </section>
  );
}
