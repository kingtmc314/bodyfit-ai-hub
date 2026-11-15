import type { parseGarminRawFile } from "./garminFileImport";
import { fetchRunningGpsWeather } from "./runningGpsWeather";

type Preview = ReturnType<typeof parseGarminRawFile>;
export type GarminGpsWeatherEnrichment = {
  fields: Record<string, string>;
  metadata: Record<string, string | number | null>;
};

/** External weather is best-effort and OUTSIDE the transaction. Never affects matching or source identity. */
export async function prepareGarminGpsWeather(preview: Preview): Promise<GarminGpsWeatherEnrichment> {
  const unchanged: GarminGpsWeatherEnrichment = { fields: {}, metadata: {} };
  const hasGps = preview.timeSeries.some(sample => typeof sample.latitude === "number" && Number.isFinite(sample.latitude)
    && typeof sample.longitude === "number" && Number.isFinite(sample.longitude));
  if (!hasGps) return unchanged;
  try {
    const result = await fetchRunningGpsWeather({ timeSeries: preview.timeSeries, garminDetails: preview.garminDetails });
    const metadata = { gpsWeatherStatus: result.status, gpsWeatherProvenance: JSON.stringify(result.provenance) };
    // Partial weather is shown as partial in the read-only panel, never disguised as a complete saved summary.
    if (!result.observation || result.status !== "complete" || preview.fields.weatherSource?.trim()) return { fields: {}, metadata };
    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(result.observation)) {
      if (value !== null && value !== undefined) fields[key] = String(value);
    }
    // New FIT device temperature is retained verbatim in avgTemperatureC/timeSeries;
    // the new weather summary uses the explicitly labelled ambient grid estimate.
    return { fields, metadata };
  } catch {
    return { fields: {}, metadata: { gpsWeatherStatus: "unknown", gpsWeatherWarning: "GPS 天氣暫未取得；原檔及跑步摘要正常保存，可在逐秒曲線重新只讀查詢。" } };
  }
}
