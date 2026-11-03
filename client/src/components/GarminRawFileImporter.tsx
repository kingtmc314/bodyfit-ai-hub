import { useEffect, useRef, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { FileChartColumnIncreasing, FileUp, Loader2, X, CheckCircle2, Activity, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import GarminTimeSeriesChart from "@/components/GarminTimeSeriesChart";
import { describeGarminRawImportFailure, type GarminRawImportFailure } from "@shared/garminRawImportStatus";

type GarminSourceFormat = "FIT" | "CSV" | "GPX" | "TCX";

type GarminRawPreview = {
  sourceFormat: GarminSourceFormat;
  fields: Record<string, string>;
  garminDetails: Record<string, string | number | null>;
  laps: Array<{ lap: number; durationSec: number | null; distanceKm: number | null; avgPace: string | null }>;
  timeSeries: Array<Record<string, unknown>>;
  warnings: string[];
  rawFileKey: string;
};

type GarminStagedSource = {
  fileKey: string;
  sourceFormat: GarminSourceFormat;
};

type UploadState = "idle" | "uploading" | "parsing" | "saving";
export type GarminDirectSaved = inferRouterOutputs<AppRouter>["running"]["saveGarminImport"];

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const CHUNK_BYTES = 2 * 1024 * 1024;
const MAX_CHUNK_ATTEMPTS = 3;

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

function readChunkBase64(chunk: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("無法讀取檔案分段"));
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.readAsDataURL(chunk);
  });
}

function createUploadId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID().replace(/-/g, "");
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
}

export default function GarminRawFileImporter({
  runningLogId,
  onSaved,
  onBusyChange,
  onUnconfirmedChange,
}: {
  runningLogId?: number;
  onSaved: (saved: GarminDirectSaved) => void;
  onBusyChange?: (busy: boolean) => void;
  onUnconfirmedChange?: (unconfirmed: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<GarminRawPreview | null>(null);
  const [stagedSource, setStagedSource] = useState<GarminStagedSource | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [chunkProgress, setChunkProgress] = useState<{ current: number; total: number } | null>(null);
  const [failure, setFailure] = useState<GarminRawImportFailure | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState<GarminDirectSaved | null>(null);
  const uploadChunk = trpc.running.uploadGarminRawChunk.useMutation();
  const parse = trpc.running.parseGarminRawFile.useMutation();
  const saveImport = trpc.running.saveGarminImport.useMutation();
  const isBusy = uploadChunk.isPending || parse.isPending || saveImport.isPending || uploadState !== "idle";
  useEffect(() => { onBusyChange?.(isBusy); }, [isBusy, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
  useEffect(() => { onUnconfirmedChange?.(!!preview && !saved); }, [preview, saved, onUnconfirmedChange]);
  useEffect(() => () => onUnconfirmedChange?.(false), [onUnconfirmedChange]);

  const persistImport = async (selected: File, source: GarminStagedSource) => {
    setUploadState("saving");
    setSaveError(null);
    try {
      const result = await saveImport.mutateAsync({
        fileKey: source.fileKey,
        fileName: selected.name,
        mimeType: selected.type || "application/octet-stream",
        runningLogId,
      });
      setSaved(result);
      onSaved(result);
      toast.success(result.action === "duplicate" ? "此原始檔已保存，沒有重複新增" : result.sampleCount ? "原始檔與圖表已直接保存到跑步紀錄" : "原始檔與活動摘要已保存（檔案沒有曲線樣本）");
    } catch (error) {
      const message = error instanceof Error ? error.message : "儲存連線暫時中斷，請重試。";
      setSaveError(message);
      toast.error("原始檔已上載，但跑步紀錄尚未確認儲存", { description: message });
    } finally {
      setUploadState("idle");
    }
  };

  const importFile = async (selected: File) => {
    setPreview(null);
    setStagedSource(null);
    setFailure(null);
    setSaveError(null);
    setSaved(null);
    if (!/\.(fit|csv|gpx|tcx)$/i.test(selected.name)) {
      const isZip = /\.zip$/i.test(selected.name);
      toast.error(isZip ? "請先解壓 Garmin ZIP 檔" : "請選擇 Garmin FIT、CSV、GPX 或 TCX 原始檔", {
        description: isZip ? "目前請從壓縮檔內選擇單次活動的 .fit、.csv、.gpx 或 .tcx 原始檔。" : undefined,
      });
      return;
    }
    if (selected.size === 0) {
      toast.error("原始檔沒有內容，請重新選擇檔案");
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      toast.error("原始檔不可超過 25MB");
      return;
    }

    const uploadId = createUploadId();
    const totalChunks = Math.ceil(selected.size / CHUNK_BYTES);
    const chunkKeys: string[] = [];
    try {
      setUploadState("uploading");
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
        setChunkProgress({ current: chunkIndex + 1, total: totalChunks });
        const start = chunkIndex * CHUNK_BYTES;
        const base64 = await readChunkBase64(selected.slice(start, Math.min(start + CHUNK_BYTES, selected.size)));
        let lastError: unknown;
        for (let attempt = 1; attempt <= MAX_CHUNK_ATTEMPTS; attempt += 1) {
          try {
            const uploaded = await uploadChunk.mutateAsync({ uploadId, chunkIndex, base64 });
            chunkKeys.push(uploaded.fileKey);
            lastError = undefined;
            break;
          } catch (error) {
            lastError = error;
            if (attempt < MAX_CHUNK_ATTEMPTS) await wait(attempt * 700);
          }
        }
        if (lastError) throw lastError;
      }
      setUploadState("parsing");
      setChunkProgress(null);
      const parsed = await parse.mutateAsync({
        fileName: selected.name,
        mimeType: selected.type || "application/octet-stream",
        uploadId,
        chunkKeys,
      });
      const reviewedPreview = parsed as GarminRawPreview;
      setPreview(reviewedPreview);
      const source = { fileKey: reviewedPreview.rawFileKey, sourceFormat: reviewedPreview.sourceFormat };
      setStagedSource(source);
      await persistImport(selected, source);
    } catch (error) {
      const recoveredFailure = describeGarminRawImportFailure(error);
      setFailure(recoveredFailure);
      toast.error(recoveredFailure.title, { description: recoveredFailure.description });
    } finally {
      setUploadState("idle");
      setChunkProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const chooseFile = async (selected?: File) => {
    if (!selected) return;
    setFile(selected);
    await importFile(selected);
  };

  const clear = () => {
    setFile(null);
    setPreview(null);
    setStagedSource(null);
    setUploadState("idle");
    setChunkProgress(null);
    setFailure(null);
    setSaveError(null);
    setSaved(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const actionLabel = uploadState === "uploading"
    ? `安全上載 ${chunkProgress?.current ?? 1}/${chunkProgress?.total ?? 1}…`
    : uploadState === "saving" || saveImport.isPending
      ? "正在保存跑步與圖表…"
    : uploadState === "parsing" || parse.isPending
      ? "讀取原始檔…"
      : "選擇 FIT／CSV／GPX／TCX";

  return (
    <section className="mt-3 rounded-2xl border border-sky-300/60 bg-gradient-to-br from-sky-50/85 via-card to-indigo-50/65 p-4 dark:border-sky-400/20 dark:from-sky-950/25 dark:via-card dark:to-indigo-950/20">
      <div className="flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/12 text-sky-700 dark:text-sky-300"><FileChartColumnIncreasing className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-700 dark:text-sky-300">Garmin Original Data</p>
          <h3 className="mt-0.5 text-sm font-bold text-foreground">匯入 FIT／CSV／GPX／TCX 原始檔</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">選檔後自動上載、解析並直接保存跑步與圖表，不需再按「套用」或「儲存」。{runningLogId ? "原始資料會附加到正在編輯的紀錄，保留既有摘要、跑鞋及天氣。" : "自動按香港日期、距離與時間配對唯一歷史紀錄；沒有相符紀錄才新增。"} 清除預覽不會刪除已保存紀錄。</p>
        </div>
      </div>
      <input ref={inputRef} type="file" accept=".fit,.csv,.gpx,.tcx,application/octet-stream,text/csv,application/gpx+xml,application/vnd.garmin.tcx+xml" className="hidden" onChange={(event) => chooseFile(event.target.files?.[0])} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" className="h-9 rounded-xl border-sky-300/70 bg-card text-sky-700 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-950/35" onClick={() => inputRef.current?.click()} disabled={isBusy}>
          {isBusy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileUp className="mr-1.5 h-4 w-4" />}
          {actionLabel}
        </Button>
        <Badge variant="outline" className="border-sky-300/60 text-sky-700 dark:text-sky-300">上限 25MB</Badge>
        <Badge variant="outline" className="border-emerald-300/60 text-emerald-700 dark:text-emerald-300">安全分段上載</Badge>
        {file && <span className="max-w-44 truncate text-xs font-medium text-foreground">{file.name}</span>}
        {file && <button type="button" onClick={clear} disabled={isBusy} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"><X className="h-3.5 w-3.5" />清除</button>}
      </div>
      {failure && file && (
        <div className="mt-3 rounded-xl border border-amber-300/70 bg-amber-50/80 p-3 text-xs dark:border-amber-400/20 dark:bg-amber-950/20">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-amber-900 dark:text-amber-100">{failure.title}</p>
              <p className="mt-1 leading-5 text-amber-800 dark:text-amber-200">{failure.description}</p>
              {failure.retryable && (
                <Button type="button" size="sm" variant="outline" disabled={isBusy} onClick={() => importFile(file)} className="mt-2 h-8 border-amber-400/70 bg-card text-xs text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-950/50">
                  <Activity className="mr-1.5 h-3.5 w-3.5" />再次嘗試
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
      {preview && (
        <div className="mt-3 rounded-xl border border-sky-200/80 bg-card/85 p-3 dark:border-sky-400/15">
          {saved && <div role="status" className="mb-3 rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-200"><p className="font-bold">{saved.action === "duplicate" ? "已保存過此檔案，沒有重複新增" : saved.sampleCount ? "跑步圖表已儲存" : "原始檔及活動摘要已儲存（沒有曲線樣本）"}</p><p className="mt-1">{saved.date} · 紀錄 #{saved.id} · {saved.action === "created" ? "已新增跑步紀錄" : "已附加到既有跑步紀錄"}。{saved.sampleCount > 0 ? "關閉視窗後仍可從「查看全部」開啟逐秒曲線。" : "原始檔未提供曲線樣本，不會產生虛構圖表。"}</p>{saved.syncWarning && <p className="mt-1">{saved.syncWarning}</p>}</div>}
          {saveError && <div role="alert" className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><p className="font-bold">跑步紀錄尚未確認儲存</p><p className="mt-1 leading-5">{saveError}</p><Button type="button" size="sm" variant="outline" className="mt-2" disabled={isBusy} onClick={() => file && stagedSource && persistImport(file, stagedSource)}>重試儲存（不用重新上載）</Button></div>}
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
          {preview.timeSeries.length > 0 && <GarminTimeSeriesChart timeSeries={preview.timeSeries} runLabel={file?.name} className="mt-3" />}
          {preview.warnings.length > 0 && <div className="mt-2.5 rounded-lg bg-amber-400/10 px-2.5 py-2 text-[11px] leading-4 text-amber-800 dark:text-amber-200"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" />{preview.warnings.join(" ")}</div>}
        </div>
      )}
    </section>
  );
}
