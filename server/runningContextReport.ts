import { crossValidateRunningContext, predictRunningContext, type RunningContextHistory, type RunningContextRun, type RunningCrossValidationReport, type RunningHeldOutPrediction, type RunningStratum } from "../shared/runningCrossValidation";
import { matchRunningPreRunContext } from "../shared/runningPreRunContext";
import type { ContextErrorMetrics, ContextEvidenceRow, ContextGroup, RunningContextReport } from "../shared/runningContextReport";
import type { loadRunningRecoveryDataset } from "./runningRecoveryDataset";
import { todayHK } from "./hkTime";

type Dataset = Awaited<ReturnType<typeof loadRunningRecoveryDataset>>;
export type RunningContextReportInput = {
  targetDistanceKm: number;
  groupKey?: string;
  temperatureC?: number;
  humidityPct?: number;
  windKph?: number;
  sleepDateConvention?: "unknown" | "wake-date";
};
const valid = (n: unknown, lo: number, hi: number): n is number => typeof n === "number" && Number.isFinite(n) && n >= lo && n <= hi;
const median = (v: number[]): number => { const a = [...v].sort((x, y) => x - y); return a.length % 2 ? a[Math.floor(a.length / 2)] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2; };
const dateKey = () => `${new Date().toLocaleString("sv-SE", { timeZone: "Asia/Hong_Kong", hour12: false }).replace(" ", "T")}+08:00`;
function runType(value: string | null): RunningStratum["runType"] | null {
  const t = (value ?? "").trim().toLowerCase();
  if (/interval|sprint|fartlek|race|time trial|test|trail|間歇|衝刺|比賽|越野/.test(t)) return null;
  if (/recovery|恢復/.test(t)) return "recovery";
  if (/long|長距離/.test(t)) return "long";
  if (/tempo|節奏/.test(t)) return "tempo";
  if (/easy|輕鬆|慢跑/.test(t)) return "easy";
  if (/steady|穩定/.test(t)) return "steady";
  return null;
}
function surface(value: string | null): RunningStratum["surface"] | null {
  const t = (value ?? "").trim().toLowerCase();
  if (!t || ["unknown", "未知", "未提供"].includes(t)) return "unknown";
  if (["road", "公路"].includes(t)) return "road";
  if (["track", "跑道"].includes(t)) return "track";
  if (["treadmill", "跑步機"].includes(t)) return "treadmill";
  return null;
}
const groupKey = (s: RunningStratum) => [s.runType, s.surface, s.terrain, s.targetDefinition].join("|");
function weatherQuality(run: Dataset["joined"][number]["run"]) {
  const p = run.weatherProvenance;
  if (!p?.observedAt) return p?.source ? "已保存來源；未核對時刻" : "已保存數值；時刻／来源未核對";
  const observed = Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(p.observedAt) ? p.observedAt : `${p.observedAt}+08:00`);
  const start = run.startTimestamp ? Date.parse(run.startTimestamp) : NaN;
  return Number.isFinite(observed) && Number.isFinite(start) && Math.abs(observed - start) <= 90 * 60e3 ? "已保存時刻接近跑步起點" : "已保存天氣；起點／時刻未對齊";
}
export function prepareRunningContextHistory(dataset: Dataset) {
  const entries: Array<{ input: RunningContextRun; evidence: ContextEvidenceRow; stratum: RunningStratum }> = [];
  for (const { run, preRun } of dataset.joined) {
    const type = runType(run.type), route = surface(run.route);
    if (!type || !route || !valid(run.distanceKm, 0.2, 200)) continue;
    const c = run.continuous;
    const continuous = c.baselineQualified && valid(c.meanMovingPaceSecPerKm, 90, 1800);
    const pace = continuous ? c.meanMovingPaceSecPerKm : run.summaryPaceSecPerKm;
    if (!valid(pace, 90, 1800)) continue;
    const grade = c.meanAbsoluteGradePct;
    const terrain: RunningStratum["terrain"] = valid(grade, 0, 30) ? grade <= 1 ? "flat" : grade <= 3 ? "rolling" : "hilly" : "unknown";
    const stratum: RunningStratum = { runType: type, surface: route, terrain, targetDefinition: continuous ? "moving_pace_seconds_per_km" : "summary_pace_seconds_per_km" };
    const basis = continuous ? "continuous-moving" as const : "summary" as const;
    const pauses = c.observedSeconds > 0 && c.movingSeconds / c.observedSeconds < 0.9;
    const numericSleep = preRun.sleep?.confidence === "verified-pre-run" ? preRun.sleepHours : null;
    const temperature = valid(run.weather.temperatureC, -30, 55) ? run.weather.temperatureC : null;
    const humidity = valid(run.weather.humidityPct, 0, 100) ? run.weather.humidityPct : null;
    entries.push({ stratum, input: { id: String(run.id), hkDate: run.date, stratum, distanceKm: run.distanceKm,
      measuredPaceSecondsPerKm: pace, hasMaterialPauses: pauses,
      context: { temperatureC: temperature, relativeHumidityPct: humidity, preRunSleepHours: numericSleep,
        preRunRestingHrBpm: preRun.restingHr?.restingHr ?? null, preRunRestingHrDeltaBpm: preRun.rhrDeltaBpm } },
      evidence: { id: run.id, dateHK: run.date, distanceKm: run.distanceKm, paceSecPerKm: pace, paceBasis: basis,
        temperatureC: temperature, humidityPct: humidity, windKph: valid(run.weather.windKph, 0, 150) ? run.weather.windKph : null,
        weatherQuality: weatherQuality(run), sleepHours: preRun.sleepHours, sleepDateHK: preRun.sleep?.date ?? null,
        sleepMethod: preRun.sleep?.pairingMethod ?? null, restingHR: preRun.restingHr?.restingHr ?? null,
        restingHRDeltaBpm: preRun.rhrDeltaBpm, restingHRDateHK: preRun.restingHr?.date ?? null,
        baselinePredictedPace: null, weatherPredictedPace: null, contextPredictedPace: null } });
  }
  const byGroup = new Map<string, typeof entries>();
  for (const entry of entries) { const key = groupKey(entry.stratum); const values = byGroup.get(key) ?? []; values.push(entry); byGroup.set(key, values); }
  const groups: ContextGroup[] = Array.from(byGroup.entries()).map(([key, values]) => ({ key, runType: values[0].stratum.runType,
    routeType: `${values[0].stratum.surface} / ${values[0].stratum.terrain}`, paceBasis: values[0].evidence.paceBasis,
    count: values.length, minDistanceKm: Math.min(...values.map(v => v.input.distanceKm)), maxDistanceKm: Math.max(...values.map(v => v.input.distanceKm)) })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  return { entries, byGroup, groups };
}
function metric(rows: RunningHeldOutPrediction[], field: "baselinePaceSecondsPerKm" | "contextPaceSecondsPerKm"): ContextErrorMetrics | null {
  if (!rows.length) return null;
  const errors = rows.map(r => r[field] - r.measuredPaceSecondsPerKm);
  return { count: rows.length, days: new Set(rows.map(r => r.hkDate)).size,
    maeSecPerKm: errors.reduce((s, n) => s + Math.abs(n), 0) / errors.length,
    medianAbsolutePercentError: median(rows.map((r, i) => Math.abs(errors[i]) / r.measuredPaceSecondsPerKm * 100)),
    biasSecPerKm: errors.reduce((s, n) => s + n, 0) / errors.length };
}
const reasonZH: Record<string, string> = {
  invalid_query: "輸入日期／距離不在有效範圍", unsupported_stratum: "路面／坡度未知；只做描述性驗算，不作自動修正",
  insufficient_training: "相同類型、路面、配速定義及相近距離的訓練日不足20日",
  no_context_features: "沒有至少10個較早量測日及有效變化的情境因子", distance_outside_training_support: "距離超出歷史訓練支援範圍",
  missing_or_invalid_context: "本次情境缺少已啟用的跑前因子", context_outside_training_support: "本次天氣／恢復狀況超出歷史支援範圍",
  incomplete_history: "歷史讀取未完成，禁止調整", insufficient_deployment_evidence: "相同因子及完整跑前資料的留出驗算不足10日",
  model_worse: "情境模型留出誤差比歷史配速基準更差", no_meaningful_improvement: "未達到穩定的樣本外改善門檻", non_finite_prediction: "數值無效，禁止調整",
};
const featuresZH: Record<string, string> = { temperatureC: "氣溫", temperatureHumidityInteraction: "溫度×濕度", preRunSleepHours: "已核對跑前睡眠", restingHrDeltaBpm: "跑前靜止心率偏差" };
export function buildRunningContextReport(dataset: Dataset, input: RunningContextReportInput, asOfHK = todayHK(), currentTimestamp = new Date().toISOString()): RunningContextReport {
  const prepared = prepareRunningContextHistory(dataset);
  const near = (km: number) => Math.max(km, input.targetDistanceKm) / Math.min(km, input.targetDistanceKm) <= 1.15;
  const defaultGroup = [...prepared.groups].sort((a, b) => (prepared.byGroup.get(b.key)?.filter(e => near(e.input.distanceKm)).length ?? 0) - (prepared.byGroup.get(a.key)?.filter(e => near(e.input.distanceKm)).length ?? 0))[0] ?? null;
  // An explicitly selected missing group is never silently replaced with another type.
  const selectedGroup = input.groupKey ? prepared.groups.find(g => g.key === input.groupKey) ?? null : defaultGroup;
  const selected = selectedGroup ? (prepared.byGroup.get(selectedGroup.key) ?? []).filter(e => near(e.input.distanceKm) && e.input.hkDate < asOfHK) : [];
  const current = matchRunningPreRunContext({ id: "current-query", HKdate: asOfHK, startTimestamp: currentTimestamp }, dataset.sleepRows, dataset.heartRows,
    { dateConvention: input.sleepDateConvention ?? "unknown", sleepDurationUnit: "hours", baselineWindowDays: 28 });
  const history: RunningContextHistory = { runs: prepared.entries.map(e => e.input), fullHistoryComplete: dataset.complete,
    restingHrHistory: dataset.heartRows.flatMap(r => valid(r.restingHr, 30, 120) ? [{ hkDate: r.date, restingHrBpm: r.restingHr }] : []) };
  const weatherHistory: RunningContextHistory = { ...history, restingHrHistory: [], runs: history.runs.map(r => ({ ...r,
    context: { temperatureC: r.context.temperatureC, relativeHumidityPct: r.context.relativeHumidityPct } })) };
  let full: RunningCrossValidationReport | null = null, weather: RunningCrossValidationReport | null = null;
  let prediction: ReturnType<typeof predictRunningContext> | null = null;
  if (selectedGroup && selected[0]) {
    const cohort = { stratum: selected[0].stratum, referenceDistanceKm: input.targetDistanceKm, beforeHkDate: asOfHK };
    full = crossValidateRunningContext(history, cohort);
    weather = crossValidateRunningContext(weatherHistory, cohort);
    prediction = predictRunningContext(history, { hkDate: asOfHK, stratum: selected[0].stratum, distanceKm: input.targetDistanceKm,
      context: { temperatureC: input.temperatureC ?? null, relativeHumidityPct: input.humidityPct ?? null,
        preRunSleepHours: current.sleep?.confidence === "verified-pre-run" ? current.sleepHours : null,
        preRunRestingHrBpm: current.restingHr?.restingHr ?? null, preRunRestingHrDeltaBpm: current.rhrDeltaBpm } });
  }
  const weatherById = new Map(weather?.heldOutPredictions.map(r => [r.runId, r]) ?? []);
  const intersection = full?.heldOutPredictions.filter(r => weatherById.has(r.runId)) ?? [];
  const matchedWeather = intersection.map(r => weatherById.get(r.runId)!);
  const baselineMetrics = metric(intersection, "baselinePaceSecondsPerKm");
  const fullMetrics = metric(intersection, "contextPaceSecondsPerKm");
  // If weather has no eligible features there is no honest three-way comparison.
  const weatherMetrics = metric(matchedWeather, "contextPaceSecondsPerKm");
  const fullById = new Map(intersection.map(r => [r.runId, r]));
  const rows = selected.map(e => { const f = fullById.get(e.input.id), w = f ? weatherById.get(e.input.id) : undefined;
    return { ...e.evidence, baselinePredictedPace: f?.baselinePaceSecondsPerKm ?? null,
      weatherPredictedPace: w?.contextPaceSecondsPerKm ?? null, contextPredictedPace: f?.contextPaceSecondsPerKm ?? null }; }).sort((a, b) => b.dateHK.localeCompare(a.dateHK) || b.id - a.id);
  const limitations = [
    "此驗算比較同類型／路面／坡度／配速定義及±15%比例相近距離的實測訓練配速，不是原能量實驗室的完賽／VO₂／乳酸模型已經驗證。",
    "每個香港測試日只用更早活動；同日所有跑步一併留出。基準、天氣與恢復誤差在相同留出活動比較。",
    "至少20個較早訓練日、10個留出驗算日及每個因子10個量測日；門檻固定，不用留出結果挑係數。",
    "睡眠日期語意未知時，日期代理只作低信心背景展示，不作數值睡眠預測；勾選起床日確認後仍須實際起床時間早於已核對跑步起點。",
    "每日靜止心率只用更早日；偏差以該量測日之前的28日個人基準計算。運動平均／最大心率不是靜止心率；HRV量測類型未知，不硬套係數。",
    "歷史天氣若沒有已對齊的來源／觀測時刻只是已保存近似值；新驗算只評估氣溫、溫濕交互與合資格恢复因子。風速展示為背景，尚未作學習因子，也不能當作路線逆風。",
    "未分類、越野、混合路面、比賽、測試、衝刺、間歇及明顯停頓不與穩定配速混算；未知路面／坡度獨立作描述性驗算，不當作公路或平坦，也不啟用自動修正。",
    "配速與天氣／睡眠／靜止心率僅是關聯，仍受訓練意圖、路線、補水、感測器、季節及體能變化混雜。",
    "80%範圍為歷史留出殘差分位，並非信賴區間或未來涵蓋率保證；目前不把额外修正套入已保存情境或原能量模擬。",
  ];
  if (dataset.durationNormalization.legacyMinutesConverted) limitations.push(`${dataset.durationNormalization.legacyMinutesConverted}筆歷史睡眠分鐘值只在與就寢／起床時鐘跨度一致時轉成小時；原資料未改写。`);
  if (dataset.durationNormalization.rejected) limitations.push(`${dataset.durationNormalization.rejected}筆睡眠時長的單位／範圍未能核對，保留缺值而非猜測。`);
  if (!dataset.complete) limitations.push("跑步／健康歷史分頁未完成；禁止情境修正。");
  if (rows.length > 200) limitations.push("逐次證據表只列最近200筆；統計及驗算仍計入全部相符活動。");
  const unknownRoute = selected[0]?.stratum.surface === "unknown" || selected[0]?.stratum.terrain === "unknown";
  const status: RunningContextReport["status"] = unknownRoute && full?.metrics && full.metrics.matchedDays >= 10 ? "unsupported-context" : !full || ["insufficient_data", "limited"].includes(full.status) ? "insufficient-data"
    : full.status === "supported" ? "validated-association" : "not-improved";
  const statusReason = !selectedGroup ? "尚未有已分類、已標示路面及有效配速的相符組別" : !selected.length ? "這個組別没有與所選距離相近且早於本日的活動"
    : full?.status === "insufficient_data" ? "較早的相近訓練日不足20日"
    : unknownRoute && full?.metrics && full.metrics.matchedDays >= 10 ? "可查看描述性留出誤差，但路面／坡度未核對；不作額外修正"
    : full?.status === "limited" ? "可用留出日或完整因子證據不足；不作額外修正"
    : full?.status === "supported" ? "相近訓練配速的留出驗算有改善，仍非比賽能力驗證"
    : full?.status === "model_worse" ? "情境模型誤差較大，維持基準" : "沒有穩定樣本外改善；不作疲勞／天氣額外懲罰";
  const weatherTimingVerified = !full?.latestFeatureNames.some(f => f === "temperatureC" || f === "temperatureHumidityInteraction") || selected.every(e => e.evidence.weatherQuality === "已保存時刻接近跑步起點");
  const enabled = prediction?.autoApplyAllowed === true && weatherTimingVerified && !unknownRoute;
  const p = enabled ? prediction?.correctedPaceSecondsPerKm : undefined;
  const residual = prediction?.residual80PercentInterval;
  return { version: "running-context-v1", source: "Life-OS Supabase", generatedAtHK: dateKey(), historyComplete: dataset.complete,
    groups: prepared.groups, selectedGroup, targetDistanceKm: input.targetDistanceKm, status, statusReason,
    coverage: { runs: dataset.history.coverage.processedRuns, sleeps: dataset.sleepRows.length, hearts: dataset.heartRows.length,
      selectedRuns: selected.length, temperature: selected.filter(e => e.evidence.temperatureC !== null).length,
      humidity: selected.filter(e => e.evidence.humidityPct !== null).length, sleep: selected.filter(e => e.input.context.preRunSleepHours !== null).length,
      restingHR: selected.filter(e => e.evidence.restingHR !== null).length, restingHRDelta: selected.filter(e => e.evidence.restingHRDeltaBpm !== null).length,
      priorDateSleepProxy: selected.filter(e => e.evidence.sleepMethod === "prior-date-proxy").length },
    metrics: { baseline: baselineMetrics, weatherOnly: weatherMetrics, fullContext: fullMetrics,
      improvementPct: baselineMetrics && fullMetrics && baselineMetrics.maeSecPerKm > 1e-6 ? (baselineMetrics.maeSecPerKm - fullMetrics.maeSecPerKm) / baselineMetrics.maeSecPerKm * 100 : null },
    featuresUsed: full?.latestFeatureNames.map(f => featuresZH[f]) ?? [],
    prediction: { supported: enabled, correctionEnabled: enabled,
      paceSecPerKm: p ?? null, interval80SecPerKm: p !== undefined && residual ? [Math.max(90, p + residual.lowerSecondsPerKm), p + residual.upperSecondsPerKm] : null,
      reason: prediction?.reason ? reasonZH[prediction.reason] ?? "目前情境未通過支援與留出驗證門檻" : !weatherTimingVerified ? "歷史天氣時刻未與跑步起點核對；只作參考，不啟用額外修正" : p !== undefined ? "僅限相同訓練組別的有界配速關聯；不自動套入完賽模擬" : "沒有足夠相近歷史可作數值預測",
      currentSleepHours: current.sleep?.confidence === "verified-pre-run" ? current.sleepHours : null,
      currentSleepDateHK: current.sleep?.date ?? null, currentRestingHRDeltaBpm: current.rhrDeltaBpm, currentRestingHRDateHK: current.restingHr?.date ?? null },
    rows: rows.slice(0, 200), limitations };
}
/** Compact deterministic facts for the LLM: no raw metadata, GPS, notes, source credentials or invented effects. */
export function runningContextAIText(dataset: Dataset, focusStartHK?: string): string {
  const prepared = prepareRunningContextHistory(dataset);
  const rows = prepared.entries.filter(e => !focusStartHK || e.input.hkDate >= focusStartHK);
  const groups = prepared.groups.slice(0, 8).map(g => ({ key: g.key, runs: g.count, distanceRangeKm: [g.minDistanceKm, g.maxDistanceKm] }));
  const focusGroups = Array.from(new Set(rows.map(e => groupKey(e.stratum)))).map(key => ({ key, runs: rows.filter(e => groupKey(e.stratum) === key).length })).sort((a, b) => b.runs - a.runs).slice(0, 8);
  const selected = [...rows].sort((a, b) => b.input.hkDate.localeCompare(a.input.hkDate)).slice(0, 30).map(e => ({ HK: e.evidence.dateHK,
    type: e.stratum.runType, surface: e.stratum.surface, terrain: e.stratum.terrain, basis: e.evidence.paceBasis, km: e.evidence.distanceKm,
    pace: e.evidence.paceSecPerKm, weather: { C: e.evidence.temperatureC, humidityPct: e.evidence.humidityPct, timing: e.evidence.weatherQuality },
    sleepHours: e.evidence.sleepHours, sleepHK: e.evidence.sleepDateHK, sleepPairing: e.evidence.sleepMethod,
    sleepUsedAsPredictor: e.input.context.preRunSleepHours !== null, preRunRestingHR: e.evidence.restingHR, rhrHK: e.evidence.restingHRDateHK, rhrDelta: e.evidence.restingHRDeltaBpm }));
  const reference = rows[0];
  const validation = reference ? buildRunningContextReport(dataset, { targetDistanceKm: reference.input.distanceKm, groupKey: groupKey(reference.stratum) }) : null;
  const text = JSON.stringify({ source: "Life-OS Supabase", complete: dataset.complete, running: dataset.history.coverage.processedRuns,
    sleepRecords: dataset.sleepRows.length, heartRecords: dataset.heartRows.length, focusStartHK: focusStartHK ?? null,
    linkedComparableRuns: rows.length, groupsScope: "all-history", groups, focusGroups, validationScope: "all-loaded-history-before-evaluation-day", listedRows: selected.length, omittedRows: Math.max(0, rows.length - selected.length),
    validationExample: validation ? { group: validation.selectedGroup, target: "相近訓練配速，非賽事預測", status: validation.status,
      metrics: validation.metrics, reason: validation.statusReason, features: validation.featuresUsed, correctionEnabled: validation.prediction.correctionEnabled } : null,
    rows: selected, limitations: "睡眠日期未知代理不作數值預測；靜止心率是較早日量測；缺值不為零；樣本外驗算是實測訓練配速，非原能量生理／賽事模型已驗證；禁止把關聯當因果或捏造係數/精確增益。" });
  return `\n## 跑步前恢復與天氣連結（伺服器只讀事實）\n${text.length > 18000 ? JSON.stringify({ ...JSON.parse(text), rows: selected.slice(0, 8), listedRows: Math.min(8, selected.length), omittedRows: Math.max(0, rows.length - 8) }) : text}\n`;
}
