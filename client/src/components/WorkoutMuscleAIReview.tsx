import { useEffect, useRef, useState } from "react";
import { BrainCircuit, Loader2, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useStudioLanguage } from "./WorkoutStudio";
import type { MuscleAnalysisPeriod } from "@shared/workoutMuscleAnalytics";
type Review = {
  summary: string;
  observations: string[];
  suggestions: Array<{ title: string; detail: string }>;
  limitations: string[];
  dataPeriod: { startDate: string | null; endDate: string | null };
};
export default function WorkoutMuscleAIReview({
  period,
  anchorDate,
  hasSets,
}: {
  period: MuscleAnalysisPeriod;
  anchorDate: string;
  hasSets: boolean;
}) {
  const zh = useStudioLanguage();
  const scope = `${period}:${anchorDate}`;
  const current = useRef(scope);
  current.current = scope;
  const [result, setResult] = useState<{ scope: string; data: Review } | null>(
    null
  );
  const [error, setError] = useState<{ scope: string; message: string } | null>(
    null
  );
  const mutation = trpc.workout.analyzeMusclePeriod.useMutation();
  useEffect(() => {
    setError(null);
  }, [scope]);
  const review = result?.scope === scope ? result.data : null;
  const failure = error?.scope === scope ? error.message : null;
  const run = async () => {
    const requested = scope;
    setError(null);
    try {
      const data = await mutation.mutateAsync({ period, anchorDate });
      if (current.current === requested) setResult({ scope: requested, data });
    } catch (e) {
      if (current.current === requested)
        setError({
          scope: requested,
          message:
            e instanceof Error
              ? e.message
              : zh
                ? "未能產生分析，請重試。"
                : "Review unavailable; retry.",
        });
    }
  };
  return (
    <section
      data-gym-ai-review
      className="rounded-2xl border border-blue-100 bg-white p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <BrainCircuit className="h-4 w-4 text-blue-600" />
            {zh ? "AI 圖表與訓練審視" : "AI chart & training review"}
          </h3>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
            {zh
              ? "使用本期間全部已儲存組數、訓練量分布及資料覆蓋，審視訓練安排；不由圖表推斷實際肌肉成長、活化或傷患。"
              : "Reviews all saved sets, workload distribution and coverage in this period; charts do not measure growth, activation or injury."}
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={!hasSets || mutation.isPending}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white disabled:opacity-50"
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : review ? (
            <RefreshCw className="h-4 w-4" />
          ) : (
            <BrainCircuit className="h-4 w-4" />
          )}
          {mutation.isPending
            ? zh
              ? "正在分析…"
              : "Reviewing…"
            : review
              ? zh
                ? "重新審視"
                : "Review again"
              : zh
                ? "分析本期間圖表"
                : "Review this period"}
        </button>
      </div>
      {!hasSets && (
        <p className="mt-3 text-xs text-muted-foreground">
          {zh
            ? "此期間沒有組數，不會產生虛構 AI 分析。"
            : "No sets in this period; no invented AI report."}
        </p>
      )}
      {failure && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-700"
        >
          {failure}
        </p>
      )}
      {review && (
        <div className="mt-5 space-y-4 text-sm leading-relaxed">
          <p className="text-[10px] text-muted-foreground">
            {review.dataPeriod.startDate ?? "—"} →{" "}
            {review.dataPeriod.endDate ?? "—"} ·{" "}
            {zh ? "香港 UTC+8" : "Hong Kong UTC+8"}
          </p>
          <p>{review.summary}</p>
          <section>
            <h4 className="mb-2 text-xs font-bold">
              {zh ? "圖表觀察" : "Chart observations"}
            </h4>
            <ul className="space-y-2">
              {review.observations.map((text, index) => (
                <li key={index} className="text-xs leading-6">
                  {text}
                </li>
              ))}
            </ul>
          </section>
          <div className="grid gap-3 md:grid-cols-3">
            {review.suggestions.map((item, index) => (
              <div key={index} className="rounded-xl bg-blue-50 p-4">
                <h4 className="text-xs font-bold text-blue-900">
                  {item.title}
                </h4>
                <p className="mt-2 text-xs leading-6 text-slate-700">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
          <details className="rounded-xl bg-slate-50 p-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-semibold">
              {zh ? "分析限制" : "Review limitations"}
            </summary>
            <ul className="mt-2 space-y-2 leading-5">
              {review.limitations.map((text, index) => (
                <li key={index}>{text}</li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </section>
  );
}
