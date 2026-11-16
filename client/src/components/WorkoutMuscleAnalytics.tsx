import { useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart2,
  Info,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { todayHKString } from "@/lib/hkTime";
import { getMuscleParticipationRows } from "@shared/workoutMuscleAnalytics";
import type {
  MuscleAnalysisPeriod,
  WorkoutMuscleAnalysis,
} from "@shared/workoutMuscleAnalytics";
import MuscleAreaMap from "@/components/MuscleAreaMap";
import WorkoutMuscleAIReview from "./WorkoutMuscleAIReview";
import WorkoutMuscle3DPanel from "./WorkoutMuscle3DPanel";
import {
  studioMuscleLabel,
  useStudioLanguage,
} from "@/components/WorkoutStudio";

type ChartMetric = "volume" | "sets";
const formatNumber = (value: number, digits = 0) =>
  Number.isFinite(value)
    ? value.toLocaleString(undefined, { maximumFractionDigits: digits })
    : "—";
const percentage = (value: number) =>
  Number.isFinite(value) ? `${formatNumber(value, 1)}%` : "—";
const barWidth = (value: number) =>
  `${Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))}%`;
const WARNING_LABELS: Record<string, [string, string]> = {
  unknown_muscle_category: [
    "原始肌群分類未能識別，保留原值並優先使用可核對的逐動作分類。",
    "An original muscle category was not recognized; saved values are preserved.",
  ],
  unknown_activity_category: [
    "原始活動類別未能識別，請核對動作資料。",
    "An original activity category was not recognized; review the exercise metadata.",
  ],
  unmapped_sources: [
    "部分組數未有肌群分類：保留於總數，不推測主力肌群。",
    "Some sets have no muscle mapping: included in totals, never assigned invented muscles.",
  ],
  invalid_set_values: [
    "無效數值不計入相應總數；原始記錄沒有被更改。",
    "Invalid values are excluded from the corresponding totals; original records are unchanged.",
  ],
  unattributed_volume: [
    "部分重量訓練量未分配到阻力肌群，因此主力比例總和可以低於 100%。",
    "Some logged load has no direct muscle attribution, so shares may total less than 100%.",
  ],
};

/** Present the API's attribution, not fabricated activation, fatigue or population ranks. */
export function WorkoutMuscleAnalyticsView({
  data,
  metric,
  onMetric,
}: {
  data: WorkoutMuscleAnalysis;
  metric: ChartMetric;
  onMetric: (metric: ChartMetric) => void;
}) {
  const isZh = useStudioLanguage();
  const rows = data.muscles;
  const participationRows = getMuscleParticipationRows(data);
  const primary = rows
    .filter(row => row.primarySetCount > 0)
    .map(row => row.muscle);
  const secondary = rows
    .filter(row => row.secondarySetCount > 0)
    .map(row => row.muscle);
  const values = Object.fromEntries(
    rows.map(row => [
      row.muscle,
      metric === "volume" ? row.directVolumeSharePct : row.primarySetSharePct,
    ])
  );
  const hasMapped = data.coverage.mappedStrengthSetCount > 0;
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          [
            isZh ? "已記錄訓練量" : "Logged volume",
            `${formatNumber(data.totalVolumeKg)} kg`,
            isZh ? "外部重量 × 次數" : "External load × reps",
          ],
          [
            isZh ? "阻力訓練組數" : "Strength sets",
            formatNumber(data.strengthSetCount),
            `${data.cardioSetCount} ${isZh ? "組有氧另計" : "cardio entries separate"}`,
          ],
          [
            isZh ? "課程記錄" : "Saved sessions",
            formatNumber(data.sessionCount),
            `${data.completedSessionCount} ${isZh ? "次已完成" : "completed"}`,
          ],
          [
            isZh ? "肌群分類覆蓋" : "Mapping coverage",
            data.strengthSetCount
              ? percentage(data.coverage.mappedSetCoveragePct)
              : "—",
            `${data.coverage.mappedStrengthSetCount} / ${data.strengthSetCount} ${isZh ? "阻力組數" : "strength sets"}`,
          ],
        ].map(([label, value, note]) => (
          <div
            key={label}
            className="min-w-0 rounded-2xl border border-border bg-white p-4"
          >
            <dt className="text-[11px] font-medium text-muted-foreground">
              {label}
            </dt>
            <dd className="studio-stat mt-1 text-xl font-extrabold">{value}</dd>
            <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
              {note}
            </p>
          </div>
        ))}
      </dl>
      <p className="text-[11px] leading-5 text-muted-foreground">
        {isZh
          ? `共 ${formatNumber(data.setCount)} 組已儲存記錄、${formatNumber(data.totalReps)} 次；每組及重量訓練量只計一次，不因涉及多個肌群而增加。`
          : `${formatNumber(data.setCount)} saved sets, ${formatNumber(data.totalReps)} reps. Each set and its load volume count once, even when multiple muscles participate.`}
      </p>
      {data.setCount === 0 ? (
        <div
          role="status"
          className="rounded-2xl border border-dashed border-border bg-white p-6 text-center"
        >
          <Activity className="mx-auto mb-3 h-7 w-7 text-blue-500" />
          <h3 className="text-sm font-bold">
            {isZh ? "此期間尚未有已記錄組數" : "No logged sets in this period"}
          </h3>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {isZh
              ? "開始記錄動作後，才會顯示肌群分配。沒有記錄不等於沒有運動，也不會產生假排名。"
              : "Muscle attribution appears after sets are saved. Missing logs do not mean no activity; no ranking is invented."}
          </p>
        </div>
      ) : !hasMapped ? (
        <p
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800"
        >
          {data.strengthSetCount
            ? isZh
              ? "有訓練記錄，但尚未有可分類的阻力肌群。請核對下方未分類動作；不會自動推測。"
              : "Workout logs exist, but strength muscle mapping is missing. Review the unmapped exercises below."
            : isZh
              ? "此期間只有有氧或未分類記錄，沒有可分配的阻力肌群。"
              : "Only cardio or unclassified work is logged; no resistance-muscle distribution is available."}
        </p>
      ) : null}
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section
          className="min-w-0 rounded-2xl border border-border bg-white p-4 sm:p-5"
          aria-label={isZh ? "正面與背面肌群圖" : "Front and back muscle map"}
        >
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-bold">
              {isZh ? "肌群分布" : "Muscle distribution"}
            </h3>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
            {isZh
              ? "深藍：主力肌群 · 淺藍：輔助參與 · 灰色：未有已分類記錄"
              : "Blue: primary · light blue: secondary · gray: no mapped logs"}
          </p>
          <div className="mt-3 rounded-xl bg-slate-50 p-2">
            <MuscleAreaMap
              primary={primary}
              secondary={secondary}
              values={values}
              showLegend={false}
            />
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-5 text-muted-foreground">
            <Info className="mt-1 h-3 w-3 shrink-0" />
            {isZh
              ? "人體圖為概念示意。依動作分類顯示參與，不是肌電、疲勞、成長或臨床量測。"
              : "Conceptual anatomy based on exercise mapping, not EMG, fatigue, growth or clinical measurement."}
          </p>
        </section>
        <section
          className="min-w-0 rounded-2xl border border-border bg-white p-4 sm:p-5"
          aria-label={isZh ? "肌群訓練量分配圖表" : "Muscle attribution chart"}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <BarChart2 className="h-4 w-4 text-blue-600" />
              {isZh ? "主力訓練分配" : "Primary attribution"}
            </h3>
            <div className="flex rounded-xl bg-slate-100 p-1">
              {(["volume", "sets"] as const).map(value => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={metric === value}
                  onClick={() => onMetric(value)}
                  className={`rounded-lg px-3 text-[11px] font-semibold ${metric === value ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}
                >
                  {value === "volume"
                    ? isZh
                      ? "訓練量 kg"
                      : "Volume kg"
                    : isZh
                      ? "分配組數"
                      : "Allocated sets"}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
            {metric === "volume"
              ? isZh
                ? "各主力肌群平均分配外部重量訓練量；分母包括所有有效記錄 kg。"
                : "Load is divided equally among primary muscles; shares use all valid logged kg volume."
              : isZh
                ? "每組平均分配到主力肌群；分母是所有阻力組數，包括未分類組。"
                : "Each set is shared among primary muscles; the denominator includes all strength sets."}
          </p>
          {metric === "volume" && data.totalVolumeKg === 0 && (
            <p className="mt-3 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-700">
              {isZh
                ? "此期間沒有有效外部重量訓練量。自重／計時訓練不換算成虛構 kg，請切換「分配組數」。"
                : "No valid external-load volume. Bodyweight and timed work are not converted to invented kg; view allocated sets."}
            </p>
          )}
          <div className="mt-4 space-y-4">
            {rows
              .filter(row => row.primarySetCount > 0)
              .map(row => {
                const value =
                  metric === "volume"
                    ? row.directVolumeKg
                    : row.allocatedPrimarySetCount;
                const share =
                  metric === "volume"
                    ? row.directVolumeSharePct
                    : row.primarySetSharePct;
                return (
                  <div key={row.muscle}>
                    <div className="mb-1 flex items-start justify-between gap-2 text-xs">
                      <span className="font-semibold">
                        {studioMuscleLabel(row.muscle, isZh)}
                      </span>
                      <span className="studio-stat text-blue-600">
                        {formatNumber(value, 1)}{" "}
                        {metric === "volume" ? "kg" : isZh ? "組" : "sets"} ·{" "}
                        {percentage(share)}
                      </span>
                    </div>
                    <div
                      role="img"
                      aria-label={`${studioMuscleLabel(row.muscle, isZh)} ${percentage(share)}`}
                      className="h-2 overflow-hidden rounded-full bg-slate-100"
                    >
                      <div
                        style={{ width: barWidth(share) }}
                        className="h-full rounded-full bg-blue-600"
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {row.primarySetCount}{" "}
                      {isZh ? "組主力參與" : "primary participations"}
                      {row.directTimedMinutes > 0
                        ? ` · ${formatNumber(row.directTimedMinutes, 1)} ${isZh ? "分配計時分鐘" : "allocated timed min"}`
                        : ""}
                    </p>
                  </div>
                );
              })}
          </div>
          {!primary.length && (
            <p className="mt-5 text-xs text-muted-foreground">
              {isZh
                ? "沒有已分類的主力肌群數據。"
                : "No mapped primary-muscle data."}
            </p>
          )}
        </section>
      </div>
      {hasMapped && (
        <section
          className="min-w-0 rounded-2xl border border-border bg-white p-4 sm:p-5"
          aria-label={isZh ? "肌群合計參與圖表" : "Combined muscle participation chart"}
          data-muscle-participation-chart
        >
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <BarChart2 className="h-4 w-4 text-blue-600" />
            {isZh ? "每個肌群都有計：主力＋輔助參與" : "Every mapped muscle counts: primary + secondary"}
          </h3>
          <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
            {isZh
              ? "合計參與＝主力組數＋輔助組數，比例以所有阻力組數為分母。同一肌群在同一組只計一次；同一組可計入多個肌群，各行不能相加作總組數。輔助參與即使直接訓練量為 0 kg 仍會顯示，不額外分配 kg 或卡路里。"
              : "Combined participation = primary sets + secondary sets, divided by all strength sets. A muscle counts once per saved set; a set can involve several muscles, so rows must not be added as total sets. Secondary participation remains visible at 0 kg direct volume, with no extra kg or calories assigned."}
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-blue-600" />{isZh ? "主力參與" : "Primary participation"}</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-blue-300" />{isZh ? "輔助參與" : "Secondary participation"}</span>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[460px] text-xs">
              <caption className="sr-only">{isZh ? "每肌群參與組數；跨肌群重疊，不是額外訓練量" : "Per-muscle saved-set participation; overlaps across muscles, not additional workload"}</caption>
              <thead className="border-b border-border text-[10px] text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2 pr-3 text-left">{isZh ? "肌群／參與比例" : "Muscle / participation"}</th>
                  <th scope="col" className="px-2 py-2 text-right">{isZh ? "主力組數" : "Primary sets"}</th>
                  <th scope="col" className="px-2 py-2 text-right">{isZh ? "輔助組數" : "Secondary sets"}</th>
                  <th scope="col" className="py-2 pl-2 text-right">{isZh ? "合計參與" : "Combined sets"}</th>
                </tr>
              </thead>
              <tbody>
                {participationRows.map(row => {
                  const primaryPct = data.strengthSetCount > 0
                    ? row.primarySetCount / data.strengthSetCount * 100 : 0;
                  const secondaryPct = data.strengthSetCount > 0
                    ? row.secondarySetCount / data.strengthSetCount * 100 : 0;
                  const label = studioMuscleLabel(row.muscle, isZh);
                  return (
                    <tr key={row.muscle} data-participation-muscle={row.muscle} className="border-b border-slate-100 last:border-0">
                      <th scope="row" className="py-3 pr-3 text-left font-semibold">
                        {label}
                        <div
                          role="img"
                          aria-label={isZh
                            ? `${label}：主力 ${row.primarySetCount} 組、輔助 ${row.secondarySetCount} 組，合計 ${row.participationSetCount} / ${data.strengthSetCount} 組 (${percentage(row.participationPct)})`
                            : `${label}: ${row.primarySetCount} primary + ${row.secondarySetCount} secondary = ${row.participationSetCount} / ${data.strengthSetCount} sets (${percentage(row.participationPct)})`}
                          className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-slate-100"
                        >
                          <span data-participation-primary style={{ width: barWidth(primaryPct) }} className="h-full shrink-0 bg-blue-600" />
                          <span data-participation-secondary style={{ width: barWidth(secondaryPct) }} className="h-full shrink-0 bg-blue-300" />
                        </div>
                      </th>
                      <td data-primary-sets className="studio-stat px-2 py-3 text-right text-blue-700">{formatNumber(row.primarySetCount)}</td>
                      <td data-secondary-sets className="studio-stat px-2 py-3 text-right text-slate-600">{formatNumber(row.secondarySetCount)}</td>
                      <td data-combined-sets className="studio-stat py-3 pl-2 text-right font-semibold">{formatNumber(row.participationSetCount)} <span className="text-[10px] font-normal text-muted-foreground">· {percentage(row.participationPct)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[10px] leading-5 text-muted-foreground">
            {isZh
              ? "例：胸推一組會計胸肌主力一次，同時計三頭肌及肩部輔助各一次；腿推的股四頭肌和臀肌各計主力一組，但 kg 訓練量及分配組數由主力肌群平均攤分。這是解剖分類參與，不是實測啟動程度。"
              : "Example: one chest-press set counts once for the chest as primary, and once each for triceps and shoulders as secondary. Leg-press quads and glutes each receive one primary participation, while kg volume and allocated sets are shared equally between primaries. This is anatomical participation, not measured activation."}
          </p>
        </section>
      )}
      <section
        className="rounded-2xl border border-border bg-white p-4 sm:p-5"
        aria-label={isZh ? "輔助肌群參與" : "Secondary muscle participation"}
      >
        <h3 className="text-sm font-bold">
          {isZh ? "輔助肌群參與" : "Secondary participation"}
        </h3>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
          {isZh
            ? "輔助參與次數 ÷ 所有阻力組數。同一組可涉及多個輔助肌群，比例不可相加，也不加入主力訓練量。"
            : "Secondary participations / all strength sets. Involvement overlaps; percentages are not additive and are not direct load."}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows
            .filter(row => row.secondarySetCount > 0)
            .map(row => (
              <div key={row.muscle} className="rounded-xl bg-blue-50 p-3">
                <div className="flex justify-between gap-2 text-xs">
                  <strong>{studioMuscleLabel(row.muscle, isZh)}</strong>
                  <span>
                    {row.secondarySetCount} {isZh ? "組" : "sets"} ·{" "}
                    {percentage(row.secondaryParticipationPct)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-blue-300"
                    style={{ width: barWidth(row.secondaryParticipationPct) }}
                  />
                </div>
              </div>
            ))}
        </div>
        {!secondary.length && (
          <p className="mt-3 text-xs text-muted-foreground">
            {isZh
              ? "尚未有已分類的輔助參與記錄。"
              : "No mapped secondary participation."}
          </p>
        )}
      </section>
      {hasMapped && (
        <WorkoutMuscle3DPanel primary={primary} secondary={secondary} />
      )}
      <WorkoutMuscleAIReview
        period={data.period}
        anchorDate={data.anchorDate}
        hasSets={data.setCount > 0}
      />
      <section
        className="rounded-2xl border border-border bg-white p-4 sm:p-5"
        aria-label={isZh ? "資料覆蓋與限制" : "Data coverage and limitations"}
      >
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <Info className="h-4 w-4 text-blue-600" />
          {isZh ? "資料覆蓋與限制" : "Coverage and limitations"}
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          {[
            [
              isZh ? "未分類組數" : "Unmapped sets",
              data.coverage.unmappedSetCount,
            ],
            [isZh ? "缺少重量" : "Missing load", data.missingWeightSetCount],
            [isZh ? "自重記錄" : "Bodyweight logs", data.bodyweightSetCount],
            [
              isZh ? "分類層級肌群" : "Category-only mappings",
              data.coverage.categoryMappedSetCount,
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className="mt-1 font-bold">{value}</p>
            </div>
          ))}
        </div>
        {data.unmappedSources.length > 0 && (
          <div className="mt-4 space-y-2 rounded-xl bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-900">
              {isZh ? "待核對的原始動作" : "Original exercises to review"}
            </p>
            {data.unmappedSources.map((source, index) => (
              <div
                key={`${source.exerciseName}-${index}`}
                className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-amber-900"
              >
                <span>
                  {source.exerciseName ||
                    (isZh ? "動作名稱未提供" : "Missing exercise name")}{" "}
                  {source.muscleGroup ? `· ${source.muscleGroup}` : ""}
                  {source.category ? ` · ${source.category}` : ""}
                </span>
                <span>
                  {source.setCount} {isZh ? "組" : "sets"} ·{" "}
                  {formatNumber(source.volumeKg)} kg
                </span>
              </div>
            ))}
          </div>
        )}
        {data.warnings.length > 0 && (
          <ul className="mt-3 space-y-2">
            {data.warnings.map((warning, index) => (
              <li
                key={`${warning.code}-${index}`}
                className="flex items-start gap-2 text-[11px] leading-5 text-muted-foreground"
              >
                <AlertCircle className="mt-1 h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span>
                  {WARNING_LABELS[warning.code]?.[isZh ? 0 : 1] ||
                    warning.message}
                  {warning.rawCategory ? ` (${warning.rawCategory})` : ""}
                  {warning.exerciseName
                    ? ` · ${warning.exerciseName}`
                    : ""} · {warning.setCount} {isZh ? "組" : "sets"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[10px] leading-5 text-muted-foreground">
          {isZh
            ? "計入選定香港期間內所有健身課程及已儲存組數，包括熱身及未完成課程。不含跑步或步數。0 kg 是已記錄的零外部負重；空白重量是缺漏，不能視為自重。此分析不修改原始記錄，也不提供人口百分位或生理評分。"
            : "Includes all saved gym sets, warm-ups and incomplete sessions in the selected Hong Kong calendar range. Running and steps are excluded. A saved 0 kg is zero external load; a missing load is not assumed bodyweight. Records remain unchanged; no population percentile or physiological score is provided."}
        </p>
      </section>
    </div>
  );
}

export default function WorkoutMuscleAnalytics() {
  const isZh = useStudioLanguage();
  const [period, setPeriod] = useState<MuscleAnalysisPeriod>("week");
  const [metric, setMetric] = useState<ChartMetric>("volume");
  const anchorDate = todayHKString();
  const input = useMemo(() => ({ period, anchorDate }), [period, anchorDate]);
  const query = trpc.workout.getMuscleAnalysis.useQuery(input, {
    staleTime: 30_000,
  });
  const data = query.data;
  return (
    <div className="min-w-0 space-y-4">
      <header className="rounded-2xl border border-border bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-blue-600">
              TRAINING / MUSCLE INSIGHTS
            </p>
            <h2 className="mt-1 text-xl font-extrabold">
              {isZh ? "看見你的訓練分布" : "See your training distribution"}
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {isZh
                ? "只根據真實儲存組數與動作分類，不推測身體表現。"
                : "Based only on saved sets and exercise mappings, not inferred body performance."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            aria-label={isZh ? "重新載入肌群分析" : "Refresh muscle analytics"}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 text-xs text-muted-foreground"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`}
            />
            {isZh ? "重新載入" : "Refresh"}
          </button>
        </div>
        <div
          className="mt-4 grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1"
          role="group"
          aria-label={isZh ? "肌群分析期間" : "Muscle analytics period"}
        >
          {(["week", "month", "year", "all"] as const).map(value => (
            <button
              type="button"
              key={value}
              aria-pressed={period === value}
              onClick={() => setPeriod(value)}
              className={`rounded-lg px-2 text-xs font-semibold ${period === value ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}
            >
              {
                {
                  week: isZh ? "本週" : "Week",
                  month: isZh ? "本月" : "Month",
                  year: isZh ? "本年" : "Year",
                  all: isZh ? "全部" : "All",
                }[value]
              }
            </button>
          ))}
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
          {data?.range.startDate && data.range.endDate ? (
            <>
              {data.range.startDate}
              <ArrowRight className="h-3 w-3" />
              {data.range.endDate} ·{" "}
            </>
          ) : null}
          {isZh
            ? "香港 UTC+8 · 週一開始 · 全部不設歷史截限"
            : "Hong Kong UTC+8 · Monday-start weeks · All history has no cutoff"}
        </p>
      </header>
      {query.isLoading ? (
        <div
          role="status"
          className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-white p-8 text-sm text-muted-foreground"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          {isZh ? "正在載入已儲存訓練資料…" : "Loading saved workout data…"}
        </div>
      ) : query.error ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
        >
          <p>
            {isZh
              ? "未能載入肌群分析。這不是零訓練量；請重試。"
              : "Muscle analytics could not load. This does not mean zero training; please retry."}
          </p>
          <p className="mt-1 break-words text-xs">{query.error.message}</p>
          <button
            type="button"
            className="mt-3 rounded-xl border border-red-200 bg-white px-4 text-xs font-semibold"
            onClick={() => query.refetch()}
          >
            {isZh ? "重試載入" : "Retry"}
          </button>
        </div>
      ) : data ? (
        <WorkoutMuscleAnalyticsView
          data={data}
          metric={metric}
          onMetric={setMetric}
        />
      ) : (
        <p
          role="status"
          className="rounded-2xl border border-border bg-white p-6 text-xs text-muted-foreground"
        >
          {isZh
            ? "分析資料未提供；不以空白回應推算為 0。"
            : "Analysis data is unavailable; an empty response is not treated as zero."}
        </p>
      )}
    </div>
  );
}
