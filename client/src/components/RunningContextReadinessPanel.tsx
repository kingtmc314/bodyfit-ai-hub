import { useId, type ReactNode } from "react";
import type {
  ContextDayReadiness,
  ContextFactorReadiness,
  RunningContextReadiness,
} from "@shared/runningContextReport";
import type {
  RunningContextFeature,
  RunningPredictionBlocker,
  RunningValidationStatus,
} from "@shared/runningCrossValidation";

const featureLabels: Record<RunningContextFeature, string> = {
  temperatureC: "氣溫",
  temperatureHumidityInteraction: "氣溫與濕度交互作用",
  preRunSleepHours: "已核對跑前睡眠",
  restingHrDeltaBpm: "靜息心率差值",
};
const validationLabels: Record<RunningValidationStatus, string> = {
  insufficient_data: "資料不足",
  limited: "證據有限",
  no_evidence: "未見穩定改善",
  model_worse: "模型誤差較基準差",
  supported: "留出驗證支持關聯",
};
const blockerLabels: Record<RunningPredictionBlocker, string> = {
  invalid_query: "輸入日期或距離無效",
  unsupported_stratum: "路面、坡度或路線未獲支援",
  insufficient_training: "合資格訓練日不足",
  no_context_features: "沒有合資格情境因子",
  distance_outside_training_support: "距離超出訓練支援範圍",
  missing_or_invalid_context: "本次跑前輸入缺失或無效",
  context_outside_training_support: "本次天氣或恢復輸入超出訓練支援範圍",
  incomplete_history: "歷史讀取未完整",
  insufficient_deployment_evidence: "最新模型的完整實測留出證據不足",
  model_worse: "模型誤差較基準差",
  no_meaningful_improvement: "未達穩定的樣本外改善門檻",
  non_finite_prediction: "估算數值無效",
};
const evidenceLabels: Record<RunningContextReadiness["evidenceState"], string> =
  {
    complete: "已讀取完整合資格組別",
    "partial-history": "歷史讀取未完整，計數只限已載入資料",
    "no-selected-group": "未有選中可比組別",
    "no-eligible-runs": "未有合資格跑步",
  };
const tileClass =
  "min-w-0 rounded-xl border border-white/10 bg-slate-950/50 p-4";
const unknownLabel = (value: boolean | null) =>
  value === null ? "未知" : value ? "已通過" : "未通過";

/** Read-only server projection: never infers eligibility, deficits or permission. */
export default function RunningContextReadinessPanel({
  readiness,
}: {
  readiness: RunningContextReadiness | undefined;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="min-w-0 rounded-2xl border border-emerald-300/20 bg-gradient-to-br from-emerald-400/[0.06] via-slate-900/40 to-cyan-300/[0.04] p-4 sm:p-5"
    >
      <h3 id={headingId} className="text-base font-bold text-emerald-200">
        進階交叉驗算 · 數據完整度
      </h3>
      <p className="mt-2 text-xs leading-6 text-slate-300">
        計數達標是必要但非充分條件；不合併成整體百分比，也不代表一定能啟用校正或保證預測。
      </p>
      {!readiness ? (
        <p
          role="status"
          className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-sm leading-6 text-amber-100"
        >
          準備度未知：此回報未提供伺服器準備度計數。訓練、因子、留出及目前心率基準日數均未知；不從全域歷史總數、最近證據表或
          200 筆紀錄推算，亦不把未知當作 0。
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs leading-6 text-slate-400">
            範圍：截至香港 {readiness.asOfHK} 之前，完整已載入的選中可比組別；
            {evidenceLabels[readiness.evidenceState]}。 歷史完整性：
            {readiness.historyComplete ? "後端確認完整" : "未完整"}。 合資格跑步{" "}
            {readiness.eligibleRows} 次／{readiness.eligibleDays}{" "}
            個香港日期；不是全域健康紀錄或本頁證據筆數。
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <FactorCard
              title="跑前睡眠"
              factor={readiness.factors.sleep}
              thresholds={readiness.thresholds}
            />
            <FactorCard
              title="靜息心率差值"
              factor={readiness.factors.restingHR}
              thresholds={readiness.thresholds}
            />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <DayCard title="合資格訓練日" gate={readiness.training}>
              最新模型實際訓練 {readiness.training.latestModelDays}{" "}
              日；不以其他組別或重複同日補足。
            </DayCard>
            <DayCard title="同列共同留出日" gate={readiness.commonHeldOut}>
              {readiness.commonHeldOut.rows}{" "}
              次共同留出；基準、僅天氣及聯合模型用完全相同列比較誤差。
            </DayCard>
            <DayCard
              title="最新模型完整實測部署留出日"
              gate={readiness.deploymentEvidence}
            >
              {readiness.deploymentEvidence.rows}{" "}
              次；最新特徵結構完全相同，所有啟用輸入均實測，不計補值。
              後端部署證據：
              {readiness.deploymentEvidence.sufficient
                ? "已達門檻"
                : "未達門檻"}
              。 最新特徵：
              {readiness.deploymentEvidence.latestFeatureNames
                .map(feature => featureLabels[feature])
                .join("、") || "未有合資格特徵"}
              。
            </DayCard>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <DayCard
              title="共同留出中睡眠及心率差值均實測日"
              gate={readiness.commonObservedHeldOut}
            >
              {readiness.commonObservedHeldOut.rows}{" "}
              次；兩項必須在同一留出列實測，各自不同列、不同日或補值不能互相補足。
            </DayCard>
            <div className={tileClass}>
              <h4 className="text-sm font-semibold text-cyan-200">
                目前靜息心率較早基準
              </h4>
              {readiness.currentBaseline.observedEarlierDays === null ? (
                <p className="mt-3 text-sm font-semibold text-amber-100">
                  較早基準日數：未知（最低{" "}
                  {readiness.currentBaseline.requiredEarlierDays} 日；量測日前{" "}
                  {readiness.currentBaseline.lookbackDays} 日視窗）
                </p>
              ) : (
                <CountProgress
                  label="目前心率較早基準日"
                  count={readiness.currentBaseline.observedEarlierDays}
                  required={readiness.currentBaseline.requiredEarlierDays}
                  unit="日"
                />
              )}
              <p className="mt-2 text-xs leading-6 text-slate-400">
                量測香港日期：
                {readiness.currentBaseline.measurementDateHK ?? "未知"}。 較早{" "}
                {readiness.currentBaseline.lookbackDays} 日視窗：
                {readiness.currentBaseline.windowStartHK ?? "未知"} 至{" "}
                {readiness.currentBaseline.windowEndExclusiveHK ?? "未知"}
                （不包括結束日）。只計同來源及同量測類型，量測同日及未來資料不可補足。
              </p>
              <p className="mt-1 text-xs leading-6 text-slate-300">
                基準缺額：
                {readiness.currentBaseline.missingEarlierDays === null
                  ? "未知"
                  : `${readiness.currentBaseline.missingEarlierDays} 日`}
                ；後端基準核驗：
                {unknownLabel(readiness.currentBaseline.sufficient)}。
              </p>
              <ServerReasons reasons={readiness.currentBaseline.blockers} />
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.045] p-4 text-xs leading-6">
            <h4 className="font-bold text-cyan-200">如何覆核與補足證據</h4>
            <p className="mt-1 text-slate-200">
              整體最低合資格配對日缺額（後端條件式下限）：
              {readiness.minimumAdditionalMatchedDays} 日。
              樣本、觀測日、訓練日及留出日缺額都是必要但非充分條件；不是需要新增多少原始紀錄的保證，也不是補足便自動啟用。
            </p>
            <p className="mt-2 text-amber-100">
              {readiness.sleepDateConvention === "unknown"
                ? "睡眠日期慣例：未知。先覆核現有紀錄；只有日期確實代表起床日期，才勾選上方確認。不能為了達標而確認，亦不一定要新增 10 筆睡眠紀錄。"
                : "睡眠日期慣例：已確認起床日期；仍須核對有效跑前時間，不能只憑日期或同日紀錄通過。"}
              本次跑前睡眠：
              {readiness.currentSleepVerified ? "後端已核對" : "後端未確認有效"}
              。
            </p>
            <p className="mt-2 text-slate-300">
              後端資料條件：
              {readiness.dataQualified
                ? "已達計數、變化及歷史門檻"
                : "未達計數、變化或歷史門檻"}
              ；進階條件：
              {readiness.advancedReady
                ? "後端已確認通過（不是預測保證）"
                : "後端未確認通過"}
              。 留出驗證狀態：
              {readiness.validationStatus === null
                ? "未知"
                : validationLabels[readiness.validationStatus]}
              ；目前預測阻擋：
              {readiness.predictionBlocker === null
                ? "後端未回報阻擋原因（不代表獲准校正）"
                : blockerLabels[readiness.predictionBlocker]}
              。
            </p>
            <p className="mt-2 text-slate-400">
              即使所有計數達標，模型誤差較基準差或未見穩定改善仍不能校正。仍須完整歷史、本次所有啟用輸入為有效跑前實測、受支援的距離／路面／坡度／路線，以及天氣來源和觀測時刻與跑步開始時間核對。
              必須先用較早日期訓練，再在之後整日留出，於相同實測列量度樣本外誤差改善；同日重複、補值或未來資料不能充當證據。
            </p>
            <ServerReasons
              reasons={readiness.blockers}
              label="後端尚待通過的條件"
            />
            <ServerReasons reasons={readiness.notes} label="後端計數說明" />
          </div>
        </>
      )}
    </section>
  );
}

function FactorCard({
  title,
  factor,
  thresholds,
}: {
  title: string;
  factor: ContextFactorReadiness;
  thresholds: RunningContextReadiness["thresholds"];
}) {
  const varianceStatus = !factor.varianceKnown
    ? "未知"
    : unknownLabel(factor.varianceSufficient);
  return (
    <div className={tileClass}>
      <h4 className="text-sm font-semibold text-emerald-200">{title}</h4>
      <p className="mt-1 text-xs leading-6 text-slate-300">
        最新模型：{factor.includedInLatestModel ? "已納入" : "未納入"}
        （後端回報）
      </p>
      <CountProgress
        label={`${title}有效觀測樣本`}
        count={factor.observedRows}
        required={thresholds.minimumFeatureObservations}
        unit="筆"
      />
      <CountProgress
        label={`${title}香港觀測日`}
        count={factor.observedDays}
        required={thresholds.minimumFeatureObservedDays}
        unit="日"
      />
      <p className="mt-3 text-xs leading-6 text-slate-400">
        缺失 {factor.missingRows} 筆／{factor.missingDays} 個香港跑步日；無效{" "}
        {factor.invalidRows} 筆。 變化核驗：{varianceStatus}；訓練標準差{" "}
        {factor.trainingStandardDeviation === null
          ? "未知（不當作 0）"
          : factor.trainingStandardDeviation}
        ，最低門檻 {thresholds.minimumFeatureStandardDeviation}（
        {factor.feature === "preRunSleepHours" ? "小時" : "bpm"}）。
      </p>
      <p className="mt-2 text-xs leading-6 text-amber-100">
        樣本缺額 {factor.sampleDeficit} 筆；觀測日缺額{" "}
        {factor.observedDayDeficit} 日。 最低合資格配對日缺額：
        {factor.minimumAdditionalMatchedDays}{" "}
        日（條件式下限，非新增原始紀錄保證）。
      </p>
      <ServerReasons reasons={factor.blockers} />
    </div>
  );
}

function DayCard({
  title,
  gate,
  children,
}: {
  title: string;
  gate: ContextDayReadiness;
  children: ReactNode;
}) {
  return (
    <div className={tileClass}>
      <h4 className="text-sm font-semibold text-cyan-200">{title}</h4>
      <CountProgress
        label={title}
        count={gate.days}
        required={gate.requiredDays}
        unit="日"
      />
      <p className="mt-2 text-xs leading-6 text-amber-100">
        日數缺額 {gate.missingDays} 日（後端條件式下限）。
      </p>
      <p className="mt-1 text-xs leading-6 text-slate-400">{children}</p>
    </div>
  );
}

function CountProgress({
  label,
  count,
  required,
  unit,
}: {
  label: string;
  count: number;
  required: number;
  unit: string;
}) {
  const labelId = useId();
  // Only presentation arithmetic: counts/thresholds/deficits always come from the server.
  // Preserve actual counts in ARIA; extend its range if the threshold is exceeded.
  const width =
    required > 0 ? Math.min(100, Math.max(0, (count / required) * 100)) : 0;
  return (
    <div className="mt-3">
      <p
        id={labelId}
        className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-xs text-slate-300"
      >
        <span>{label}</span>
        <span className="font-semibold tabular-nums text-cyan-100">
          {count} / {required} {unit}
        </span>
      </p>
      <div
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={Math.max(required, count)}
        aria-valuenow={count}
        aria-valuetext={`${count} ${unit}；最低門檻 ${required} ${unit}，只代表此項計數`}
        className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"
      >
        <div
          aria-hidden="true"
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function ServerReasons({
  reasons,
  label,
}: {
  reasons: string[];
  label?: string;
}) {
  if (!reasons.length) return null;
  return (
    <div className="mt-2 text-xs leading-6 text-slate-400">
      {label && <p className="font-semibold text-slate-300">{label}</p>}
      <ul className="list-disc space-y-1 break-words pl-4">
        {reasons.map((reason, index) => (
          <li key={index}>{reason}</li>
        ))}
      </ul>
    </div>
  );
}
