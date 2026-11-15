import { CloudSun, MapPin, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { RunningGpsWeatherResult } from "@shared/runningGpsWeather";

const valueLabel = (value: number | null | undefined, unit: string) =>
  typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(1)} ${unit}` : "未知";

/** Opens only for one selected saved run. No mutation, geolocation permission or bulk lookup. */
export default function RunningGpsWeatherPanel({ runningLogId }: { runningLogId: number }) {
  const query = trpc.running.getGpsWeather.useQuery({ id: runningLogId }, {
    staleTime: 15 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
    placeholderData: undefined,
  });
  const result: RunningGpsWeatherResult | undefined = !query.isFetching && !query.error && !query.isPlaceholderData ? query.data : undefined;
  const weather = result?.observation;
  const provenance = result?.provenance;
  return (
    <section aria-label="GPS 跑步時段天氣" className="mx-5 mb-5 rounded-2xl border border-sky-200 bg-sky-50/70 p-4 text-slate-900 dark:border-sky-400/20 dark:bg-sky-400/5 dark:text-slate-100">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold"><CloudSun className="h-4 w-4 text-sky-600 dark:text-sky-300" aria-hidden="true" />GPS 路線 × 跑步時段天氣</h3>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">自動按原檔 GPS 與時間讀取；跨位置及跨小時分段，以各段實際覆蓋時間加權平均，不只取起點。</p>
        </div>
        {result && <span role="status" className={`rounded-full px-2.5 py-1 text-xs font-semibold ${result.status === "complete" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-200"}`}>{result.status === "complete" ? "完整時段覆蓋" : result.status === "partial" ? "部分覆蓋平均" : "位置／時段資料未知"}</span>}
      </div>
      {query.isFetching ? <p role="status" className="mt-3 flex items-center gap-2 text-sm"><RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />正在讀取此跑步的 GPS 時段天氣；不沿用其他跑步結果。</p> : query.error ? <div role="alert" className="mt-3 text-sm"><p>未能取得天氣，原有跑步及手動天氣保持不變。</p><button type="button" onClick={() => void query.refetch()} className="mt-2 min-h-11 rounded-xl border border-sky-300/30 px-3 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">重試 GPS 天氣</button></div> : result ? <>
        {weather && <>
          <p className="mt-3 flex items-center gap-1.5 break-words text-xs leading-6"><MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />{weather.weatherLocation}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[["平均氣溫", valueLabel(weather.temperature, "°C")], ["平均體感", valueLabel(weather.apparentTemp, "°C")], ["平均濕度", valueLabel(weather.humidity, "%")], ["平均風速", valueLabel(weather.windSpeed, "km/h")]].map(([label, value]) => <div key={label} className="rounded-xl bg-white/80 p-3 dark:bg-slate-950/40"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-base font-bold tabular-nums">{value}</dd></div>)}
          </dl>
          <p className="mt-3 text-xs leading-6">主要狀況：{weather.weatherCondition ?? "未知"}。天氣代碼不作數值平均；不同狀況按覆蓋時間列為混合。</p>
          <p className="text-xs leading-6">平均降雨率：{valueLabel(provenance?.precipitationMeanRateMmPerHour, "mm/h")}；覆蓋時段估計降雨量：{valueLabel(weather.precipitation, "mm")}（逐小時降雨量按時間比例估計，不是實測全程雨量）。</p>
        </>}
        {provenance && <>
          <p className="mt-3 break-words text-xs leading-6 text-muted-foreground">跑步時段（香港 UTC+8）：{provenance.intervalStartHK ?? "未知"} 至 {provenance.intervalEndHK ?? "未知"}。{provenance.timeBasis === "verified-activity-window" ? "原檔活動時間已核對。" : provenance.timeBasis === "timestamped-sample-bounds" ? "按有效 GPS 樣本首尾計算；不代表原檔以外的完整活動。" : "沒有可驗證的活動時間。"}</p>
          <p className="text-xs leading-6 text-muted-foreground">天氣覆蓋 {valueLabel(provenance.coveredSeconds / 60, "分鐘")}／{valueLabel(provenance.totalSeconds / 60, "分鐘")} · {(provenance.coverageFraction * 100).toFixed(1)}% · {provenance.sampledCells} 個位置取樣格 · {provenance.sampledHours} 個小時段。取樣格不是行政區或氣象模型的解析度；缺口不補成全程天氣。</p>
          {provenance.reasons.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-6 text-amber-700 dark:text-amber-200">{provenance.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>}
        </>}
        {weather && <p className="mt-2 break-words text-xs leading-6 text-muted-foreground">來源：{weather.weatherSource} · 來源時段：{weather.weatherObservedAt || "未知"}</p>}
      </> : <p role="status" className="mt-3 text-xs">尚未取得此跑步回報；未知不當作零。</p>}
      <p className="mt-3 text-xs leading-6 text-muted-foreground">Open-Meteo 網格模型／歷史重建僅是當地天氣近似值，並非沿路街道實測。舊紀錄只讀展示，不覆寫手動天氣、原檔或曲線；無 GPS／有效時間時不猜測香港或早上 7 時。</p>
    </section>
  );
}
