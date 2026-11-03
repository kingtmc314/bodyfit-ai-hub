import { useState } from "react";
import { FileText, ShieldCheck } from "lucide-react";
import { type InBodyReport, inBodyReportSchema } from "@shared/inbodyReport";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface InBodyReportDetailsProps {
  reportDetails: unknown;
  primary?: Record<string, unknown>;
}

type MetricKey = keyof InBodyReport["metrics"];
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
  { key: "muscleControlKg", label: "肌肉控制", unit: "kg" },
  { key: "fatControlKg", label: "脂肪控制", unit: "kg" },
];
const SEGMENTS: { key: keyof InBodyReport["segments"]; label: string }[] = [
  { key: "leftArm", label: "左臂" },
  { key: "rightArm", label: "右臂" },
  { key: "trunk", label: "軀幹" },
  { key: "leftLeg", label: "左腿" },
  { key: "rightLeg", label: "右腿" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readMetadata(
  raw: unknown
): { report: InBodyReport; photoUrl: string | null; fileName: string } | null {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!isRecord(value)) return null;
  const parsed = inBodyReportSchema.safeParse(value.report);
  if (!parsed.success) return null;
  // This is a private local storage key, never a URL taken from report JSON.
  // The owner segment and ASCII filename pattern are fixed; no '..', escapes,
  // query strings, external protocols or arbitrary /manus-storage paths allowed.
  const sourceKey =
    typeof value.sourceKey === "string" &&
    /^inbody-reports\/2\/[a-zA-Z0-9_-]{8,}_[a-f0-9]{8}\.(?:jpg|png|webp)$/.test(
      value.sourceKey
    )
      ? value.sourceKey
      : null;
  return {
    report: parsed.data,
    photoUrl: sourceKey ? `/manus-storage/${sourceKey}` : null,
    fileName:
      typeof value.fileName === "string" ? value.fileName : "來源報告相片",
  };
}

function numeric(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (
    typeof value === "string" &&
    /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())
  ) {
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
  }
  return null;
}

function display(value: unknown, unit = ""): string {
  const number = numeric(value);
  return number === null
    ? "—"
    : `${number.toLocaleString("zh-HK", { maximumFractionDigits: 3 })}${unit ? ` ${unit}` : ""}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-muted/20 p-3">
      <dt className="text-xs leading-relaxed text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-base font-semibold tabular-nums">
        {value}
      </dd>
    </div>
  );
}

export default function InBodyReportDetails({
  reportDetails,
  primary,
}: InBodyReportDetailsProps) {
  const [open, setOpen] = useState(false);
  const metadata = readMetadata(reportDetails);
  if (!metadata) return null;
  const { report, photoUrl, fileName } = metadata;
  const currentValue = (key: MetricKey) =>
    primary && Object.prototype.hasOwnProperty.call(primary, key)
      ? primary[key]
      : report.metrics[key];
  const hasReviewedValues = PRIMARY_FIELDS.some(
    field => primary && Object.prototype.hasOwnProperty.call(primary, field.key)
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 rounded-lg border-emerald-500/25 px-2 text-xs text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-300"
        >
          <FileText className="size-3.5" />
          InBody 報告
        </Button>
      </DialogTrigger>
      <DialogContent
        data-no-padding
        className="max-h-[85dvh] gap-0 rounded-2xl sm:max-w-2xl"
      >
        <DialogHeader className="shrink-0 border-b border-border bg-gradient-to-br from-emerald-500/10 via-background to-orange-500/5 px-5 pb-4 pt-5 text-left">
          <DialogTitle className="flex items-center gap-2 pr-8">
            <FileText className="size-5 text-emerald-500" />
            InBody 報告
          </DialogTitle>
          <DialogDescription>
            紙本相片辨識後核對儲存的資料 · 唯讀檢視
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5">
          <section className="space-y-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                報告列印量度時間（香港時間）
              </h3>
              <Badge variant="outline" className="text-xs">
                {report.confidence === "high"
                  ? "高可信度"
                  : report.confidence === "medium"
                    ? "中可信度"
                    : "低可信度 · 需核對"}
              </Badge>
            </div>
            <p className="font-semibold tabular-nums">
              {report.date ?? "日期未列明"}
              <span className="ml-3">{report.time ?? "時間未列明"}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              保留報告原有的香港日期及時間，不以拍攝、上載日期或今日代替。
            </p>
            <dl className="grid grid-cols-3 gap-2">
              <Stat label="身高" value={display(report.heightCm, "cm")} />
              <Stat label="年齡" value={display(report.age)} />
              <Stat
                label="報告列印性別"
                value={
                  report.sex === "male"
                    ? "男"
                    : report.sex === "female"
                      ? "女"
                      : "—"
                }
              />
            </dl>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">主要身體數據</h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {hasReviewedValues
                ? "以下優先顯示目前身體記錄的已核對值；如曾手動修改，會以最新記錄為準，而非舊的相片辨識值。空白保留為「—」，不以舊值或 0 補上。"
                : "以下為辨識後核對儲存的數值；未列明的欄位顯示「—」。"}
            </p>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PRIMARY_FIELDS.map(field => (
                <Stat
                  key={field.key}
                  label={field.label}
                  value={display(currentValue(field.key), field.unit)}
                />
              ))}
            </dl>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">進階報告數據</h3>
            <dl className="grid grid-cols-2 gap-2">
              {ADVANCED_FIELDS.map(field => (
                <Stat
                  key={field.key}
                  label={field.label}
                  value={display(report.metrics[field.key], field.unit)}
                />
              ))}
            </dl>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">五部位分段數據</h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              依報告的左／右標示。除脂量不是全身骨骼肌量；標準百分比不是體脂率。未列明不作推算。
            </p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[300px] text-xs tabular-nums">
                <caption className="sr-only">
                  五部位除脂量、脂肪量及體脂率
                </caption>
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-3 text-left font-medium">
                      部位
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-3 text-right font-medium"
                    >
                      除脂量 kg
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-3 text-right font-medium"
                    >
                      脂肪 kg
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3 text-right font-medium"
                    >
                      體脂 %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {SEGMENTS.map(segment => (
                    <tr key={segment.key} className="border-t border-border/60">
                      <th
                        scope="row"
                        className="px-3 py-3 text-left font-medium"
                      >
                        {segment.label}
                      </th>
                      <td className="px-2 py-3 text-right">
                        {display(report.segments[segment.key].leanKg)}
                      </td>
                      <td className="px-2 py-3 text-right">
                        {display(report.segments[segment.key].fatKg)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {display(report.segments[segment.key].fatPct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3 text-xs leading-relaxed text-muted-foreground">
            基礎代謝率 BMR 並非建議攝取熱量；骨骼肌量 SMM 與除脂體重 FFM
            不同。腰臀比 WHR 不會換算為內臟脂肪等級。
          </div>
          {report.warnings.length > 0 && (
            <section className="rounded-xl border border-orange-500/25 bg-orange-500/5 p-3">
              <h3 className="text-xs font-semibold text-orange-600 dark:text-orange-300">
                辨識時的核對提醒
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed">
                {report.warnings.map((warning, index) => (
                  <li key={`${index}-${warning}`} className="break-words">
                    {warning}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {report.notes && (
            <section>
              <h3 className="text-sm font-semibold">報告備註</h3>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                {report.notes}
              </p>
            </section>
          )}

          <section className="rounded-xl border border-border p-3">
            <h3 className="text-sm font-semibold">來源報告相片</h3>
            {photoUrl ? (
              <details className="mt-2">
                <summary className="cursor-pointer rounded-lg py-2 text-sm text-emerald-600 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-emerald-300">
                  查看已附上的整頁相片
                </summary>
                <img
                  src={photoUrl}
                  alt="已儲存的 InBody 整頁來源報告"
                  loading="lazy"
                  className="mt-2 max-h-[60dvh] w-full rounded-lg bg-muted/20 object-contain"
                />
                <p className="mt-2 break-all text-xs text-muted-foreground">
                  {fileName}
                </p>
              </details>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                未有可安全顯示的來源相片。
              </p>
            )}
          </section>
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" />
            此頁只展示身體數據記錄及來源，不提供醫療診斷；如有疑問請向合資格醫護人員查詢。
          </p>
        </div>
        <footer className="sticky bottom-0 shrink-0 border-t border-border bg-background px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            onClick={() => setOpen(false)}
          >
            關閉
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
