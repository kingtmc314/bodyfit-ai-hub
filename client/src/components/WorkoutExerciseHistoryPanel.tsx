import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  History,
  Loader2,
  MapPin,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useIsOwner } from "@/contexts/OwnerContext";
import { todayHKString } from "@/lib/hkTime";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ExerciseHistoryTrendPoint } from "@shared/workoutExerciseHistory";
import { getCanonicalExerciseName } from "@shared/workoutExerciseIdentity";

interface Props {
  exerciseName: string;
  open: boolean;
  weightUnit?: "kg" | "lbs";
}

/** A new query observer/page state for each movement and each open. No history request while closed. */
export default function WorkoutExerciseHistoryPanel({
  exerciseName,
  open,
  weightUnit = "kg",
}: Props) {
  if (!open || !exerciseName) return null;
  return (
    <ExerciseHistoryTimeline
      key={exerciseName}
      exerciseName={exerciseName}
      initialUnit={weightUnit}
    />
  );
}

function ExerciseHistoryTimeline({
  exerciseName,
  initialUnit,
}: {
  exerciseName: string;
  initialUnit: "kg" | "lbs";
}) {
  const { i18n } = useTranslation();
  const zh = i18n.language.startsWith("zh");
  const [page, setPage] = useState(1);
  const [unit, setUnit] = useState(initialUnit);
  const isOwner = useIsOwner();
  const aiSequence = useRef(0);
  useEffect(
    () => () => {
      aiSequence.current += 1;
    },
    []
  );
  const [ai, setAi] = useState<{
    status: "idle" | "loading" | "error" | "success";
    error?: string;
    result?: {
      analysis: string;
      recommendations: Array<{ title: string; detail: string; type: string }>;
    };
  }>({ status: "idle" });
  const analyze = trpc.workout.analyzeExercise.useMutation();
  const requestAnalysis = async () => {
    const sequence = ++aiSequence.current;
    setAi({ status: "loading" });
    try {
      const result = await analyze.mutateAsync({ exerciseName });
      if (aiSequence.current === sequence) setAi({ status: "success", result });
    } catch (error) {
      if (aiSequence.current === sequence)
        setAi({
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
    }
  };
  const query = trpc.workout.getExerciseHistory.useQuery(
    { exerciseName, page, pageSize: 8 },
    {
      enabled: Boolean(exerciseName),
      placeholderData: undefined,
      refetchOnWindowFocus: false,
    }
  );
  // Never show the previous movement/page, even if a query cache supplies placeholder data.
  const data =
    query.data &&
    query.data.page === page &&
    getCanonicalExerciseName(query.data.exerciseName) ===
      getCanonicalExerciseName(exerciseName)
      ? query.data
      : undefined;
  const number = (value: number | null | undefined, digits = 1) =>
    value == null
      ? "—"
      : value.toLocaleString(zh ? "zh-HK" : "en-GB", {
          maximumFractionDigits: digits,
        });
  const weight = (kg: number | null | undefined) =>
    kg == null ? "—" : number(unit === "lbs" ? kg * 2.2046226218 : kg);

  return (
    <section
      aria-label={
        zh ? `動作訓練紀錄 ${exerciseName}` : `Exercise history ${exerciseName}`
      }
      className="min-w-0 space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">
            {zh ? "你的訓練紀錄" : "Your training history"}
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {zh
              ? "每次課程、每一組 · 香港時間（UTC+8）"
              : "Every session, every set · Hong Kong time (UTC+8)"}
          </p>
        </div>
        <div
          role="group"
          aria-label={zh ? "紀錄重量顯示單位" : "History display weight unit"}
          className="inline-flex rounded-xl border border-border bg-muted/40 p-1"
        >
          {(["kg", "lbs"] as const).map(value => (
            <button
              key={value}
              type="button"
              aria-pressed={unit === value}
              onClick={() => setUnit(value)}
              className={`min-h-11 min-w-12 rounded-lg px-3 text-sm font-medium ${unit === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {query.error ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5"
        >
          <p className="font-medium">
            {zh ? "未能載入動作紀錄" : "Unable to load exercise history"}
          </p>
          <p className="mt-1 break-words text-sm text-muted-foreground">
            {query.error.message}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4 min-h-11 gap-2 rounded-xl"
            onClick={() => query.refetch()}
          >
            <RotateCcw className="h-4 w-4" />
            {zh ? "重試載入" : "Retry"}
          </Button>
        </div>
      ) : !data ? (
        <div
          role="status"
          aria-live="polite"
          className="flex min-h-48 items-center justify-center gap-3 rounded-2xl bg-muted/30 p-6 text-sm text-muted-foreground"
        >
          <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
          {zh ? "正在載入動作紀錄…" : "Loading exercise history…"}
        </div>
      ) : data.summary.totalSets === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-5 py-10 text-center">
          <History
            aria-hidden="true"
            className="mx-auto mb-3 h-7 w-7 text-muted-foreground"
          />
          <h4 className="text-base font-semibold">
            {zh ? "尚未記錄此動作" : "No records for this movement yet"}
          </h4>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            {zh
              ? "加入課程並記錄一組後，你的日期、次數和重量會顯示在這裡。"
              : "After you log a set in a session, its date, reps and weight will appear here."}
          </p>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-3 rounded-2xl border border-border/60 bg-muted/25 p-4 sm:p-5">
            {[
              [zh ? "課程" : "Sessions", number(data.summary.sessionCount, 0)],
              [
                zh ? "記錄組數" : "Logged sets",
                number(data.summary.totalSets, 0),
              ],
              [
                zh ? "最高記錄重量" : "Heaviest logged",
                `${weight(data.summary.maxWeightKg)} ${unit}`,
              ],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs leading-5 text-muted-foreground">
                  {label}
                </dt>
                <dd className="mt-1 break-words text-lg font-semibold tabular-nums sm:text-2xl">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <ExerciseHistoryTrend
            points={data.trend ?? []}
            truncated={data.trendMetadata?.truncated ?? false}
            unit={unit}
            zh={zh}
          />
          {isOwner && (
            <section
              aria-label={
                zh ? "動作時間序列 AI 分析" : "Exercise trend AI analysis"
              }
              className="rounded-2xl border border-border/60 bg-muted/20 p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold">
                    {zh ? "AI 進展分析" : "AI progress analysis"}
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {zh
                      ? "依據此動作的已保存紀錄及完整負重時間序列；只在點選後分析。"
                      : "Based on this movement’s saved history and full load time series; runs only when requested."}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 gap-2 rounded-xl text-sm"
                  disabled={ai.status === "loading"}
                  onClick={() => void requestAnalysis()}
                >
                  {ai.status === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {zh ? "分析進展" : "Analyze progress"}
                </Button>
              </div>
              {ai.status === "loading" && (
                <p role="status" className="mt-4 text-sm text-muted-foreground">
                  {zh ? "正在分析訓練趨勢…" : "Analyzing your training trend…"}
                </p>
              )}
              {ai.status === "error" && (
                <p role="alert" className="mt-4 text-sm text-destructive">
                  {zh ? "分析未完成，可重試：" : "Analysis failed; retry: "}
                  {ai.error}
                </p>
              )}
              {ai.result && (
                <div className="mt-5 space-y-4">
                  <p className="whitespace-pre-wrap text-sm leading-7">
                    {ai.result.analysis}
                  </p>
                  <ol className="space-y-3">
                    {ai.result.recommendations.map((recommendation, index) => (
                      <li
                        key={`${recommendation.title}:${index}`}
                        className="rounded-xl border border-border/50 bg-card p-4"
                      >
                        <h5 className="text-sm font-semibold">
                          {recommendation.title}
                        </h5>
                        <p className="mt-2 text-sm leading-7 text-muted-foreground">
                          {recommendation.detail}
                        </p>
                      </li>
                    ))}
                  </ol>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {zh
                      ? "建議屬估算，紀錄不能量測姿勢或恢復狀態。器械、單邊及總負重須自行核對。"
                      : "Recommendations are estimates; logs do not measure form or recovery. Verify machine, unilateral and total-load conventions."}
                  </p>
                </div>
              )}
            </section>
          )}
          <p className="text-xs leading-5 text-muted-foreground">
            {data.summary.firstDateHK && data.summary.lastDateHK
              ? `${data.summary.firstDateHK} — ${data.summary.lastDateHK} · `
              : ""}
            {zh
              ? "只顯示已保存的組數；包含已完成及未結束課程。"
              : "Saved sets only, including completed and unfinished sessions."}
          </p>
          <ol
            className="space-y-4"
            aria-label={zh ? "課程時間線" : "Session timeline"}
          >
            {data.sessions.map(session => {
              const hasCardio = session.sets.some(
                set => set.duration != null || set.distance != null
              );
              return (
                <li
                  key={session.id}
                  className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 px-4 py-4 sm:px-5">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        <CalendarDays
                          aria-hidden="true"
                          className="h-4 w-4 shrink-0 text-teal-700 dark:text-teal-400"
                        />
                        <time dateTime={session.dateHK}>{session.dateHK}</time>
                      </p>
                      <h4 className="mt-1 break-words text-sm">
                        {session.name ||
                          (zh ? "未命名課程" : "Untitled session")}
                      </h4>
                    </div>
                    {session.location && (
                      <p className="flex max-w-full items-start gap-1.5 text-xs leading-5 text-muted-foreground">
                        <MapPin
                          aria-hidden="true"
                          className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        />
                        <span className="break-words">{session.location}</span>
                      </p>
                    )}
                  </div>
                  <div
                    className="max-w-full overflow-x-auto overscroll-x-contain"
                    tabIndex={0}
                    role="region"
                    aria-label={`${session.dateHK} ${zh ? "每組紀錄" : "set records"}`}
                  >
                    <table className="w-full text-left text-sm tabular-nums">
                      <caption className="sr-only">
                        {session.dateHK} · {exerciseName} ·{" "}
                        {zh ? "每組次數及重量" : "Reps and weight for each set"}
                      </caption>
                      <thead className="bg-muted/30 text-xs text-muted-foreground">
                        <tr>
                          <th
                            scope="col"
                            className="px-4 py-3 font-medium sm:px-5"
                          >
                            {zh ? "組" : "Set"}
                          </th>
                          <th scope="col" className="px-3 py-3 font-medium">
                            {zh ? "次數" : "Reps"}
                          </th>
                          <th
                            scope="col"
                            className="whitespace-nowrap px-3 py-3 font-medium"
                          >
                            {zh ? "重量" : "Weight"} ({unit})
                          </th>
                          {hasCardio && (
                            <>
                              <th
                                scope="col"
                                className="whitespace-nowrap px-3 py-3 font-medium"
                              >
                                {zh ? "分鐘" : "Minutes"}
                              </th>
                              <th
                                scope="col"
                                className="whitespace-nowrap px-3 py-3 font-medium"
                              >
                                km
                              </th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {session.sets.map(set => (
                          <tr key={set.id}>
                            <th
                              scope="row"
                              className="px-4 py-3.5 font-medium text-muted-foreground sm:px-5"
                            >
                              {set.setNumber}
                            </th>
                            <td className="px-3 py-3.5">
                              {number(set.reps, 0)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3.5 font-medium">
                              {weight(set.weight)}
                            </td>
                            {hasCardio && (
                              <>
                                <td className="px-3 py-3.5">
                                  {number(set.duration)}
                                </td>
                                <td className="px-3 py-3.5">
                                  {number(set.distance, 2)}
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </li>
              );
            })}
          </ol>
          <nav
            aria-label={zh ? "動作紀錄分頁" : "Exercise history pagination"}
            className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4"
          >
            <p role="status" className="text-xs text-muted-foreground">
              {zh
                ? `第 ${data.page} / ${data.totalPages} 頁`
                : `Page ${data.page} of ${data.totalPages}`}
              {query.isFetching ? (zh ? " · 更新中…" : " · Updating…") : ""}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                aria-label={zh ? "上一頁紀錄" : "Previous history page"}
                className="min-h-11 rounded-xl"
                disabled={page <= 1 || query.isFetching}
                onClick={() => setPage(value => Math.max(1, value - 1))}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                {zh ? "上一頁" : "Previous"}
              </Button>
              <Button
                type="button"
                variant="outline"
                aria-label={zh ? "下一頁紀錄" : "Next history page"}
                className="min-h-11 rounded-xl"
                disabled={!data.hasNextPage || query.isFetching}
                onClick={() => setPage(value => value + 1)}
              >
                {zh ? "下一頁" : "Next"}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </nav>
        </>
      )}
    </section>
  );
}

type TrendMetric =
  | "totalVolumeKg"
  | "maxWeightKg"
  | "averageWeightKg"
  | "totalReps"
  | "setCount";
function ExerciseHistoryTrend({
  points,
  truncated,
  unit,
  zh,
}: {
  points: ExerciseHistoryTrendPoint[];
  truncated: boolean;
  unit: "kg" | "lbs";
  zh: boolean;
}) {
  const [metric, setMetric] = useState<TrendMetric>("totalVolumeKg");
  const [period, setPeriod] = useState("all");
  const metrics: Record<TrendMetric, { label: string; weight: boolean }> = {
    totalVolumeKg: { label: zh ? "總訓練量" : "Total volume", weight: true },
    maxWeightKg: { label: zh ? "最高重量" : "Max weight", weight: true },
    averageWeightKg: {
      label: zh ? "平均重量" : "Average weight",
      weight: true,
    },
    totalReps: { label: zh ? "總次數" : "Total reps", weight: false },
    setCount: { label: zh ? "組數" : "Sets", weight: false },
  };
  const chartData = useMemo(() => {
    const today = todayHKString();
    let cutoff = "";
    if (period !== "all") {
      const date = new Date(`${today}T00:00:00+08:00`);
      date.setUTCMonth(date.getUTCMonth() - Number(period));
      cutoff = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Hong_Kong",
      }).format(date);
    }
    return points
      .filter(
        point => (!cutoff || point.dateHK >= cutoff) && point.dateHK <= today
      )
      .map(point => {
        const raw =
          metric === "totalVolumeKg" &&
          point.missingLoadSetCount >= point.setCount
            ? null
            : point[metric];
        return {
          ...point,
          value:
            raw == null
              ? null
              : raw *
                (metrics[metric].weight && unit === "lbs" ? 2.2046226218 : 1),
        };
      });
  }, [points, period, metric, unit]);
  const suffix = metrics[metric].weight
    ? unit
    : metric === "totalReps"
      ? zh
        ? "次"
        : "reps"
      : zh
        ? "組"
        : "sets";
  const label = `${metrics[metric].label} (${suffix})`;
  const format = (value: number | null) =>
    value == null
      ? "—"
      : value.toLocaleString(zh ? "zh-HK" : "en-GB", {
          maximumFractionDigits: 1,
        });
  return (
    <section
      aria-label={zh ? "負重時間序列" : "Load time series"}
      className="min-w-0 rounded-2xl border border-border/60 bg-card p-4 sm:p-5"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold">
            {zh ? "訓練進展" : "Training progress"}
          </h4>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {zh
              ? "完整動作歷史 · 按香港日期彙總，不受下方分頁影響。"
              : "Full movement history, grouped by Hong Kong date; independent of session pagination."}
          </p>
        </div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <label className="text-xs text-muted-foreground">
          {zh ? "指標" : "Metric"}
          <select
            aria-label={zh ? "時間序列指標" : "Trend metric"}
            value={metric}
            onChange={event => setMetric(event.target.value as TrendMetric)}
            className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground"
          >
            {Object.entries(metrics).map(([key, config]) => (
              <option key={key} value={key}>
                {config.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          {zh ? "期間" : "Period"}
          <select
            aria-label={zh ? "時間序列期間" : "Trend period"}
            value={period}
            onChange={event => setPeriod(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground"
          >
            {[
              ["3", zh ? "近 3 個月" : "Last 3 months"],
              ["6", zh ? "近 6 個月" : "Last 6 months"],
              ["12", zh ? "近一年" : "Last year"],
              ["all", zh ? "全部紀錄" : "All history"],
            ].map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mb-3 text-xs leading-5 text-muted-foreground">
        {metric === "totalVolumeKg"
          ? zh
            ? `總訓練量＝每組重量 × 次數的合計 (${unit}·次)，不是單純重量相加。`
            : `Total volume = sum of each set’s weight × reps (${unit}·reps), not a sum of weights.`
          : metric === "averageWeightKg"
            ? zh
              ? "平均重量＝有記錄負重的每組算術平均，包含 0；不是總訓練量 ÷ 次數。"
              : "Average weight is the arithmetic mean of recorded set loads, including 0; not volume divided by reps."
            : zh
              ? "顯示已保存數值；缺漏負重保留空缺，不當作 0。"
              : "Saved values only; missing loads remain gaps, not zero."}
      </p>
      {!chartData.length ? (
        <p className="rounded-xl bg-muted/30 p-5 text-sm text-muted-foreground">
          {zh ? "此期間未有可顯示的紀錄。" : "No records in this period."}
        </p>
      ) : (
        <>
          <div
            role="img"
            aria-label={`${label} · ${chartData[0].dateHK} — ${chartData[chartData.length - 1].dateHK}`}
            className="h-56 min-w-0 w-full sm:h-64"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                accessibilityLayer
                data={chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  stroke="var(--border)"
                  strokeDasharray="3 5"
                  vertical={false}
                />
                <XAxis
                  dataKey="dateHK"
                  tickFormatter={value => String(value).slice(5)}
                  minTickGap={35}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  width={48}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickFormatter={value =>
                    Number(value).toLocaleString(undefined, {
                      notation: "compact",
                    })
                  }
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    color: "var(--foreground)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={value => [format(Number(value)), label]}
                  labelFormatter={date => `${date} · HK UTC+8`}
                />
                <Line
                  type="linear"
                  dataKey="value"
                  name={label}
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "var(--primary)", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <details className="mt-2 border-t border-border/50 pt-2">
            <summary className="flex min-h-11 cursor-pointer items-center text-xs font-medium text-primary">
              {zh
                ? `查看 ${chartData.length} 個日期的數據`
                : `View data for ${chartData.length} dates`}
            </summary>
            <div className="max-h-56 overflow-auto">
              <table className="w-full text-left text-xs tabular-nums">
                <caption className="sr-only">{label} · HK UTC+8</caption>
                <thead>
                  <tr>
                    <th className="py-2 font-medium">
                      {zh ? "香港日期" : "HK date"}
                    </th>
                    <th className="py-2 font-medium">{label}</th>
                    <th className="py-2 font-medium">
                      {zh ? "缺漏負重組" : "Missing-load sets"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map(point => (
                    <tr
                      key={point.dateHK}
                      className="border-t border-border/40"
                    >
                      <th scope="row" className="py-2.5 font-normal">
                        {point.dateHK}
                      </th>
                      <td className="py-2.5">{format(point.value)}</td>
                      <td className="py-2.5">{point.missingLoadSetCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
      {chartData.some(point => point.missingLoadSetCount > 0) && (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          {zh
            ? "部分日期有缺漏負重：總訓練量只含已記錄部分負重；整日未知負重保留空缺，不顯示為 0。"
            : "Some dates have missing loads. Volume covers only recorded loads; wholly unknown-load days remain gaps, not zero."}
        </p>
      )}
      {truncated && (
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
          {zh
            ? "歷史趨勢已達查詢上限，較早資料未全數包含。"
            : "Trend query limit reached; earlier data may be omitted."}
        </p>
      )}
    </section>
  );
}
