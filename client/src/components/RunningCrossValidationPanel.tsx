import { useEffect, useId, useMemo, useState } from "react";
import { Activity, RefreshCw, ShieldCheck } from "lucide-react";
import RunningContextReadinessPanel from "./RunningContextReadinessPanel";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { trpc } from "@/lib/trpc";
import type {
  ContextErrorMetrics,
  ContextEvidenceRow,
  ContextGroup,
  ContextPaceBasis,
  RunningContextReport,
} from "@shared/runningContextReport";

export interface RunningCrossValidationPanelProps {
  targetDistanceKm: number;
  temperatureC: number;
  humidityPct: number;
  windKph: number;
}

type ContextQueryInput = RunningCrossValidationPanelProps & {
  groupKey?: string;
  sleepDateConvention: "unknown" | "wake-date";
};
const PAGE_SIZE = 20;
const finite = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);
const numberLabel = (
  value: number | null | undefined,
  unit: string,
  digits = 1
) => (finite(value) ? `${value.toFixed(digits)}${unit}` : "未有資料");
const dateLabel = (date: string | null) => date?.trim() || "日期未知";
const paceBasisLabel = (basis: ContextPaceBasis) =>
  basis === "continuous-moving" ? "連續移動配速" : "摘要配速";
const groupLabel = (group: ContextGroup) =>
  `${group.runType} ／ ${group.routeType} ／ ${paceBasisLabel(group.paceBasis)} · ${group.count} 次 · ${group.minDistanceKm}–${group.maxDistanceKm} km`;
const paceLabel = (pace: number | null | undefined) => {
  if (!finite(pace) || pace <= 0) return "未有資料";
  const seconds = Math.round(pace);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} /km`;
};
const deltaLabel = (delta: number | null) =>
  finite(delta) ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)} bpm` : "未有資料";
const methodLabel = (method: string | null) => {
  switch (method) {
    case "prior-date-proxy":
      return "前一日期代理（非已確認醒來時間）";
    case "explicit-wake-timestamp":
      return "明確醒來時間戳";
    case "adapter-confirmed-wake-date":
      return "來源已確認醒來日期";
    default:
      return method?.trim() || "配對方法未知";
  }
};
const STATUS_LABELS: Record<RunningContextReport["status"], string> = {
  "insufficient-data": "資料不足",
  "not-improved": "未見穩定改善",
  "validated-association": "留出驗證支持關聯",
  "unsupported-context": "目前情境不受支援",
};
const cardClass =
  "rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5";
const buttonClass =
  "min-h-11 rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:opacity-40";

/** Read-only evidence view. It never changes the running energy simulation. */
export default function RunningCrossValidationPanel(
  props: RunningCrossValidationPanelProps
) {
  // Undefined intentionally asks the backend to choose from real comparable groups.
  const [groupKey, setGroupKey] = useState<string | undefined>();
  const [confirmWakeDate, setConfirmWakeDate] = useState(false);
  const [validationDistance, setValidationDistance] = useState<number | null>(null);
  const conventionId = useId();
  const weatherKey = JSON.stringify([props.temperatureC, props.humidityPct, props.windKph]);
  const [settledWeatherKey, setSettledWeatherKey] = useState(weatherKey);
  useEffect(() => {
    if (weatherKey === settledWeatherKey) return;
    const timer = setTimeout(() => setSettledWeatherKey(weatherKey), 350);
    return () => clearTimeout(timer);
  }, [weatherKey, settledWeatherKey]);
  const input: ContextQueryInput = {
    ...props,
    targetDistanceKm: validationDistance ?? props.targetDistanceKm,
    ...(groupKey ? { groupKey } : {}),
    sleepDateConvention: confirmWakeDate ? "wake-date" : "unknown",
  };
  // Local checkbox/page state must not carry across distance, weather or group keys.
  const selectionKey = JSON.stringify([
    input.targetDistanceKm,
    props.temperatureC,
    props.humidityPct,
    props.windKph,
    groupKey ?? null,
    input.sleepDateConvention,
  ]);
  return (
    <section
      className="running-lab overflow-hidden rounded-[1.75rem] border border-slate-800 bg-slate-950 text-white shadow-[0_24px_80px_-28px_rgba(15,23,42,0.85)]"
      aria-label="跑步情境交叉驗證"
    >
      <div className="relative overflow-hidden border-b border-white/10 px-5 py-6 sm:px-7">
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "radial-gradient(circle at 88% 0%, rgba(16,185,129,.25), transparent 28rem), radial-gradient(circle at 4% 100%, rgba(34,211,238,.12), transparent 24rem)",
          }}
        />
        <div className="relative">
          <p className="mb-2 flex items-center gap-2 text-xs font-bold tracking-wide text-emerald-300">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" /> 已儲存資料 ·
            時序留出驗證
          </p>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            天氣、睡眠與靜息心率交叉驗證
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            只比較相同跑步類型、路線與配速依據的相近距離訓練。證據不足或沒有改善，不啟用校正。
          </p>
        </div>
      </div>
      <div className="border-b border-white/10 bg-slate-900/50 px-5 py-4 sm:px-7">
        <p className="mb-2 text-xs font-semibold text-slate-300">驗算距離（獨立於上方能量模擬）</p>
        <div className="mb-3 flex flex-wrap gap-2" aria-label="驗算距離選擇">
          {[null, 3, 5, 6, 10].map(distance => <button key={distance ?? "follow-lab"} type="button" aria-label={distance === null ? "跟隨能量模擬距離" : `驗算 ${distance} km`} aria-pressed={validationDistance === distance} onClick={() => { setValidationDistance(distance); setGroupKey(undefined); }} className={`${buttonClass} ${validationDistance === distance ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-100" : ""}`}>{distance === null ? "跟隨模擬項目" : `${distance} km`}</button>)}
        </div>
        <p className="mb-3 text-xs leading-6 text-slate-400">可先驗算已有較多紀錄的短途距離；不把短途訓練當作全馬能力，也不改動已保存情境。</p>
        <div className="flex min-h-11 items-center gap-2">
          <input
            id={conventionId}
            type="checkbox"
            checked={confirmWakeDate}
            onChange={event => setConfirmWakeDate(event.target.checked)}
            className="h-4 w-4 accent-cyan-400"
          />
          <label
            htmlFor={conventionId}
            className="text-sm font-medium text-slate-200"
          >
            我確認睡眠紀錄日期是起床日期
          </label>
        </div>
        <p className="mt-1 text-xs leading-6 text-slate-400">
          預設不確認。只有睡覺／起床鐘點不能證明日期含義；未知日期只使用保守的前一日期代理，不作睡眠數值校正。明確確認後，只有已驗證跑步開始時間，且同日醒來時間不晚於跑步開始，才可使用同日睡眠；跑步開始時間未知時仍排除同日資料。
        </p>
        <p className="text-xs leading-6 text-cyan-200">
          目前日期慣例：
          {confirmWakeDate ? "使用者已確認起床日期" : "未知（僅保守代理）"}
          ；修改後會重新讀取並驗證，不沿用上一組誤差或估算。
        </p>
      </div>
      {weatherKey !== settledWeatherKey ? <p role="status" className="p-5 text-sm text-slate-300">等待天氣設定穩定再驗算；不沿用舊估算。</p> : <ContextQuery key={selectionKey} input={input} onGroupChange={setGroupKey} />}
      <div className="border-t border-white/10 bg-slate-900/50 px-5 py-4 text-xs leading-6 text-slate-400 sm:px-7">
        <p>
          每個香港日期整天留出，只用更早日期訓練；同一天的跑步不互相訓練。同日只有日期、未能證明在跑前取得的健康資料會排除，不使用未來資料。
        </p>
        <p>
          這是觀察關聯，不代表天氣、睡眠或靜息心率造成配速改變，也不能排除體能、努力程度等混雜因素。只作相近訓練配速估算，不代表最大比賽能力、完賽時間、VO₂
          實測、醫療診斷或訓練處方；不會套用至既有能量模型。
        </p>
      </div>
    </section>
  );
}

function ContextQuery({
  input,
  onGroupChange,
}: {
  input: ContextQueryInput;
  onGroupChange: (key: string | undefined) => void;
}) {
  const selectId = useId();
  const query = trpc.running.getCrossValidation.useQuery(input, {
    staleTime: 60_000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    // Never retain another key's predictions while the new request is pending.
    placeholderData: undefined,
  });
  const data: RunningContextReport | undefined = query.data;
  const matchesSelection =
    !!data &&
    !query.isPlaceholderData &&
    data.targetDistanceKm === input.targetDistanceKm &&
    (input.groupKey === undefined ||
      data.selectedGroup?.key === input.groupKey);
  // Hide predictions even during a refresh. A failed refresh is not a current report.
  const report =
    matchesSelection && !query.isFetching && !query.error ? data : undefined;
  return (
    <div className="space-y-5 p-5 sm:p-7">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <label
            htmlFor={selectId}
            className="mb-2 block text-xs font-semibold text-slate-300"
          >
            可比組別：跑步類型 ／ 路線 ／ 配速依據
          </label>
          <select
            id={selectId}
            value={input.groupKey ?? ""}
            onChange={event => onGroupChange(event.target.value || undefined)}
            className="min-h-11 w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300"
          >
            <option value="">自動選取（由後端決定）</option>
            {(data?.groups ?? []).map(group => (
              <option key={group.key} value={group.key}>
                {groupLabel(group)}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs leading-6 text-slate-400">
          目標 {numberLabel(input.targetDistanceKm, " km")} · 目前氣溫{" "}
          {numberLabel(input.temperatureC, "°C")} · 濕度{" "}
          {numberLabel(input.humidityPct, "%")} · 風速{" "}
          {numberLabel(input.windKph, " km/h")}
        </p>
      </div>
      {query.error ? (
        <div
          role="alert"
          className="rounded-xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-100"
        >
          <p>未能讀取交叉驗證資料；這不是零紀錄，也不會顯示舊情境估算。</p>
          <p className="mt-1 break-words text-xs">{query.error.message}</p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className={`${buttonClass} mt-3`}
          >
            <RefreshCw className="mr-2 inline h-4 w-4" aria-hidden="true" />
            重試載入
          </button>
        </div>
      ) : query.isLoading || query.isFetching || (data && !matchesSelection) ? (
        <p
          role="status"
          className="flex items-center gap-2 py-6 text-sm text-slate-300"
        >
          <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
          正在載入目前組別與情境的驗證；不沿用舊估算。
        </p>
      ) : report ? (
        <ReportView report={report} />
      ) : (
        <div role="status" className="py-5 text-sm text-slate-400">
          <p>尚未取得驗證回報；不把空白資料視作 0，也不產生參考配速。</p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className={`${buttonClass} mt-3`}
          >
            重試載入
          </button>
        </div>
      )}
    </div>
  );
}

function ReportView({ report }: { report: RunningContextReport }) {
  const [useCorrection, setUseCorrection] = useState(true);
  const [page, setPage] = useState(0);
  const correctionId = useId();
  const canEnableCorrection =
    report.prediction.correctionEnabled === true &&
    report.prediction.supported === true &&
    report.status === "validated-association" &&
    finite(report.prediction.paceSecPerKm) &&
    report.prediction.paceSecPerKm > 0;
  const showPrediction = canEnableCorrection && useCorrection;
  const orderedRows = useMemo(
    () =>
      [...report.rows].sort(
        (a, b) => b.dateHK.localeCompare(a.dateHK) || b.id - a.id
      ),
    [report.rows]
  );
  const pageCount = Math.max(1, Math.ceil(orderedRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = orderedRows.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE
  );
  const holdoutRows = pageRows
    .filter(
      row =>
        finite(row.baselinePredictedPace) ||
        finite(row.weatherPredictedPace) ||
        finite(row.contextPredictedPace)
    )
    .sort((a, b) => a.dateHK.localeCompare(b.dateHK) || a.id - b.id);
  const interval = report.prediction.interval80SecPerKm;
  const validInterval =
    interval &&
    interval.every(value => finite(value) && value > 0) &&
    interval[0] <= interval[1];
  return (
    <>
      <div className={`${cardClass} border-cyan-300/15 bg-cyan-300/[0.045]`}>
        <p className="flex items-center gap-2 text-sm font-bold text-cyan-200">
          <Activity className="h-4 w-4" aria-hidden="true" />
          實際讀取覆蓋 · {report.source}
        </p>
        <p className="mt-2 text-xs leading-6 text-slate-300">
          已讀取跑步 {report.coverage.runs} 次、睡眠 {report.coverage.sleeps}{" "}
          筆、心率 {report.coverage.hearts} 筆。
          {report.historyComplete
            ? "歷史讀取完整（後端回報）。"
            : "歷史讀取未完整，不能視作全部歷史。"}
        </p>
        <p className="text-xs leading-6 text-slate-300">
          選中可比跑步 {report.coverage.selectedRuns} 次；已連結氣溫{" "}
          {report.coverage.temperature} 次、濕度 {report.coverage.humidity}{" "}
          次、跑前睡眠 {report.coverage.sleep} 次、靜息心率{" "}
          {report.coverage.restingHR} 次、靜息心率差值{" "}
          {report.coverage.restingHRDelta} 次。連結數不等於有效留出樣本數。
        </p>
        <p className="mt-1 text-xs leading-6 text-slate-400">
          實際組別：
          {report.selectedGroup
            ? groupLabel(report.selectedGroup)
            : "未有可比組別"}{" "}
          · 回報時間（香港）：{dateLabel(report.generatedAtHK)}
        </p>
        {report.coverage.priorDateSleepProxy > 0 && (
          <p
            role="note"
            className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs leading-6 text-amber-100"
          >
            前一日期睡眠代理 {report.coverage.priorDateSleepProxy}{" "}
            次：睡眠記錄日期未必是醒來日期，不可當作已確認跑前／前一晚睡眠，配對時間具有不確定性。
          </p>
        )}
      </div>

      <RunningContextReadinessPanel readiness={report.readiness} />

      <div className={cardClass}>
        <h3 className="text-sm font-bold">按日期向前留出 · 實測配速誤差</h3>
        <p className="mt-1 text-xs leading-6 text-slate-400">
          以相同類型、路線、配速依據及相近距離比較；整個同日一起留出。MAE
          是平均絕對誤差（s/km）；百分比欄是絕對百分比誤差的中位數，不是百分比
          MAE。
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <ErrorCard label="基準模型" metrics={report.metrics.baseline} />
          <ErrorCard label="僅天氣模型" metrics={report.metrics.weatherOnly} />
          <ErrorCard
            label="聯合情境模型（只含合資格因子）"
            metrics={report.metrics.fullContext}
          />
        </div>
        <p className="mt-3 text-xs text-slate-300">
          聯合模型相對基準的 MAE 改善（後端）：
          {numberLabel(report.metrics.improvementPct, "%")}；使用特徵：
          {report.featuresUsed.length
            ? report.featuresUsed.join("、")
            : "未有合資格特徵"}
          。
        </p>
        <p className="mt-2 text-xs leading-6 text-amber-100/90">{!report.featuresUsed.some(feature => /睡眠|sleep/i.test(feature)) && "睡眠未達入模條件；"}{!report.featuresUsed.some(feature => /心率|heart|rhr/i.test(feature)) && "靜息心率未達入模條件；"}因子有連結紀錄不等於已納入模型，聯合模型可能與僅天氣模型相同。</p>
      </div>

      <div
        className={`${cardClass} ${showPrediction ? "border-emerald-300/20 bg-emerald-400/[0.065]" : "border-amber-300/15"}`}
      >
        <p
          role="status"
          className={`text-sm font-bold ${showPrediction ? "text-emerald-200" : "text-amber-200"}`}
        >
          {STATUS_LABELS[report.status]} ·{" "}
          {showPrediction ? "校正已啟用（僅本面板）" : "校正未啟用"}
        </p>
        <p className="mt-2 text-xs leading-6 text-slate-300">
          {report.statusReason}
        </p>
        <div className="mt-3 flex min-h-11 items-center gap-2">
          <input
            id={correctionId}
            type="checkbox"
            checked={canEnableCorrection && useCorrection}
            disabled={!canEnableCorrection}
            onChange={event => setUseCorrection(event.target.checked)}
            className="h-4 w-4 accent-emerald-400 disabled:opacity-40"
          />
          <label htmlFor={correctionId} className="text-xs text-slate-300">
            顯示經驗校正（只限本面板；須後端允許）
          </label>
        </div>
        {showPrediction ? (
          <div data-context-prediction className="mt-3">
            <h3 className="text-xs font-semibold text-emerald-200">
              相近訓練配速估算
            </h3>
            <p className="mt-1 text-3xl font-bold tracking-tight text-emerald-300">
              {paceLabel(report.prediction.paceSecPerKm)}
            </p>
            <p className="mt-2 text-xs leading-6 text-slate-300">
              經驗 80% 殘差區間：
              {validInterval
                ? `${paceLabel(interval[0])} 至 ${paceLabel(interval[1])}`
                : "未有足夠區間資料"}
              。這是過往時序留出誤差的描述，不是信賴區間，也不保證未來 80%
              覆蓋。
            </p>
          </div>
        ) : (
          <p className="mt-2 text-xs leading-6 text-slate-400">
            {canEnableCorrection
              ? "已手動關閉本面板估算。"
              : "資料不足、情境不受支援或未見改善時，不提供校正配速。"}
          </p>
        )}
        <p className="mt-2 text-xs leading-6 text-slate-400">
          {report.prediction.reason}
        </p>
        <p className="mt-2 text-xs leading-6 text-slate-400">
          目前跑前睡眠：
          {numberLabel(report.prediction.currentSleepHours, " 小時")}（香港{" "}
          {dateLabel(report.prediction.currentSleepDateHK)}
          ）；目前靜息心率差值：
          {deltaLabel(report.prediction.currentRestingHRDeltaBpm)}（香港{" "}
          {dateLabel(report.prediction.currentRestingHRDateHK)}
          ）。日期未知不當作已確認跑前資料。
        </p>
      </div>

      <div className={cardClass}>
        <h3 className="text-sm font-bold">實測與時序留出預測</h3>
        <p className="mt-1 text-xs leading-6 text-slate-400">
          只畫本頁有非空留出預測的實際回報列，按香港日期由早到晚排列；不補值、不連接缺口、不生成模擬曲線。完整數值見下表，每頁最多{" "}
          {PAGE_SIZE} 筆。
        </p>
        {holdoutRows.length ? (
          <div
            role="img"
            aria-label="本頁實測配速與三種時序留出預測圖；數值亦列於下方證據表"
            className="mt-4 overflow-x-auto"
            tabIndex={0}
          >
            <div className="min-w-[640px]">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart
                  data={holdoutRows}
                  margin={{ top: 8, right: 15, left: 8, bottom: 5 }}
                  accessibilityLayer
                >
                  <CartesianGrid
                    stroke="#ffffff"
                    strokeOpacity={0.08}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="dateHK"
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    tickFormatter={paceLabel}
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    width={76}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: number) => paceLabel(value)}
                    labelFormatter={label => `香港日期 ${label}`}
                    contentStyle={{
                      backgroundColor: "#020617",
                      borderColor: "#334155",
                      borderRadius: 12,
                      color: "#e2e8f0",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#cbd5e1" }} />
                  <Line
                    type="linear"
                    dataKey="paceSecPerKm"
                    name="實測配速"
                    stroke="#f8fafc"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="linear"
                    dataKey="baselinePredictedPace"
                    name="基準留出預測"
                    stroke="#fbbf24"
                    dot={{ r: 2 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="linear"
                    dataKey="weatherPredictedPace"
                    name="僅天氣留出預測"
                    stroke="#22d3ee"
                    dot={{ r: 2 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="linear"
                    dataKey="contextPredictedPace"
                    name="天氣＋睡眠／靜息心率留出預測"
                    stroke="#34d399"
                    dot={{ r: 2 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-400">
            本頁沒有非空時序留出預測；不以訓練擬合或假設值替代。
          </p>
        )}
        <EvidenceTable rows={pageRows} source={report.source} />
        <nav
          aria-label="交叉驗證證據分頁"
          className="mt-3 flex flex-wrap items-center justify-between gap-3"
        >
          <p role="status" className="text-xs text-slate-400">
            第 {currentPage + 1} / {pageCount} 頁 · 共 {orderedRows.length}{" "}
            筆回報證據（最新日期先列）
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
              className={buttonClass}
            >
              上一頁
            </button>
            <button
              type="button"
              disabled={currentPage >= pageCount - 1}
              onClick={() => setPage(currentPage + 1)}
              className={buttonClass}
            >
              下一頁
            </button>
          </div>
        </nav>
      </div>
      {report.limitations.length > 0 && (
        <div className={cardClass}>
          <h3 className="text-sm font-bold">回報限制與證據說明</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-6 text-slate-400">
            {report.limitations.map((limitation, index) => (
              <li key={index}>{limitation}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function ErrorCard({
  label,
  metrics,
}: {
  label: string;
  metrics: ContextErrorMetrics | null;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
      <h4 className="text-xs font-semibold text-slate-300">{label}</h4>
      {metrics ? (
        <>
          <p className="mt-2 text-lg font-bold text-cyan-200">
            MAE {numberLabel(metrics.maeSecPerKm, " s/km")}
          </p>
          <p className="mt-1 text-xs text-slate-300">
            百分比絕對誤差中位數{" "}
            {numberLabel(metrics.medianAbsolutePercentError, "%")}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {metrics.count} 次留出 · {metrics.days} 個香港日期 · 偏差{" "}
            {numberLabel(metrics.biasSecPerKm, " s/km")}
          </p>
        </>
      ) : (
        <p className="mt-2 text-xs leading-6 text-slate-400">
          未有足夠留出誤差資料（不是 0）。
        </p>
      )}
    </div>
  );
}

function EvidenceTable({
  rows,
  source,
}: {
  rows: ContextEvidenceRow[];
  source: RunningContextReport["source"];
}) {
  return (
    <div
      className="mt-4 overflow-x-auto"
      tabIndex={0}
      role="region"
      aria-label="可水平捲動的交叉驗證證據表"
    >
      <table className="w-full min-w-[1280px] text-left text-xs">
        <caption className="pb-3 text-left leading-6 text-slate-400">
          實際儲存證據（香港 UTC+8）；未有資料不等於
          0。睡眠來源為回報資料庫，未提供裝置來源；配對方法及日期照實列出。
        </caption>
        <thead className="border-b border-white/10 text-slate-400">
          <tr>
            {[
              "跑步日期（香港）",
              "距離／實測配速",
              "儲存天氣",
              "跑前睡眠／來源／日期",
              "靜息心率／差值／日期",
              "基準留出預測",
              "僅天氣留出預測",
              "天氣＋睡眠／靜息心率留出預測",
            ].map(label => (
              <th key={label} scope="col" className="px-2 py-3 font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr
              key={row.id}
              data-evidence-row={row.id}
              className="border-b border-white/[0.07] align-top last:border-0"
            >
              <th scope="row" className="px-2 py-3 font-medium text-slate-200">
                {dateLabel(row.dateHK)}
                <span className="mt-1 block text-slate-500">
                  紀錄 #{row.id}
                </span>
              </th>
              <td className="px-2 py-3 leading-6 text-slate-300">
                {numberLabel(row.distanceKm, " km")}
                <br />
                <b className="text-white">{paceLabel(row.paceSecPerKm)}</b>
                <br />
                {paceBasisLabel(row.paceBasis)}
              </td>
              <td className="px-2 py-3 leading-6 text-slate-300">
                氣溫 {numberLabel(row.temperatureC, "°C")}
                <br />
                濕度 {numberLabel(row.humidityPct, "%")}
                <br />
                風速 {numberLabel(row.windKph, " km/h")}
                <br />
                <span className="text-slate-500">
                  品質：{row.weatherQuality?.trim() || "未知"}
                </span>
              </td>
              <td className="px-2 py-3 leading-6 text-slate-300">
                睡眠 {numberLabel(row.sleepHours, " 小時")}
                <br />
                香港 {dateLabel(row.sleepDateHK)}
                <br />
                來源：{source}
                <br />
                <span className="text-amber-100/80">
                  配對：{methodLabel(row.sleepMethod)}
                </span>
              </td>
              <td className="px-2 py-3 leading-6 text-slate-300">
                靜息 {numberLabel(row.restingHR, " bpm")}
                <br />
                差值 {deltaLabel(row.restingHRDeltaBpm)}
                <br />
                香港 {dateLabel(row.restingHRDateHK)}
              </td>
              <td className="px-2 py-3 leading-6 text-amber-200">
                {paceLabel(row.baselinePredictedPace)}
              </td>
              <td className="px-2 py-3 leading-6 text-cyan-200">
                {paceLabel(row.weatherPredictedPace)}
              </td>
              <td className="px-2 py-3 leading-6 text-emerald-200">
                {paceLabel(row.contextPredictedPace)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="py-4 text-sm text-slate-400">尚未有可比跑步證據列。</p>
      )}
    </div>
  );
}
