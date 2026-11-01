export const HONG_KONG_WEATHER_LOCATION = {
  label: "香港",
  latitude: 22.3193,
  longitude: 114.1694,
} as const;

export type WeatherCoordinates = {
  label: string;
  latitude: number;
  longitude: number;
};

export type HistoricalWeatherObservation = {
  weatherCode: number | null;
  weatherCondition: string | null;
  temperature: number | null;
  humidity: number | null;
  apparentTemp: number | null;
  windSpeed: number | null;
  precipitation: number | null;
  weatherLocation: string;
  weatherObservedAt: string;
  weatherSource: string;
};

type OpenMeteoHourly = {
  time?: string[];
  weather_code?: Array<number | null>;
  temperature_2m?: Array<number | null>;
  relative_humidity_2m?: Array<number | null>;
  apparent_temperature?: Array<number | null>;
  wind_speed_10m?: Array<number | null>;
  precipitation?: Array<number | null>;
};

type OpenMeteoArchiveResponse = {
  hourly?: OpenMeteoHourly;
};

const WEATHER_CONDITIONS: Record<number, string> = {
  0: "晴朗",
  1: "大致晴朗",
  2: "局部多雲",
  3: "多雲",
  45: "霧",
  48: "霜霧",
  51: "微雨",
  53: "中度毛毛雨",
  55: "濃毛毛雨",
  56: "微凍雨",
  57: "濃凍雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  66: "微凍雨",
  67: "大凍雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  77: "米雪",
  80: "陣雨",
  81: "中度陣雨",
  82: "強陣雨",
  85: "陣雪",
  86: "強陣雪",
  95: "雷暴",
  96: "雷暴伴小冰雹",
  97: "強雷暴",
  99: "強雷暴伴大冰雹",
};

export function weatherConditionFromCode(code: number | null | undefined): string | null {
  if (code === null || code === undefined || !Number.isFinite(code)) return null;
  return WEATHER_CONDITIONS[code] ?? `WMO ${code}`;
}

export function isHongKongDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normaliseTime(value: string | undefined): string {
  return /^\d{2}:\d{2}$/.test(value ?? "") ? value! : "07:00";
}

function safeNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function dayKey(date: string, time: string): string {
  return `${date}T${time}`;
}

function nearestHourIndex(times: string[], date: string, time: string): number {
  const exact = times.indexOf(dayKey(date, time));
  if (exact >= 0) return exact;
  const dayMatches = times
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => candidate.startsWith(`${date}T`));
  if (!dayMatches.length) return -1;

  const [targetHour, targetMinute] = time.split(":").map(Number);
  const targetMinutes = targetHour * 60 + targetMinute;
  return dayMatches.reduce((best, item) => {
    const [, rawTime = "00:00"] = item.candidate.split("T");
    const [hour, minute] = rawTime.split(":").map(Number);
    const delta = Math.abs((hour * 60 + minute) - targetMinutes);
    return delta < best.delta ? { index: item.index, delta } : best;
  }, { index: dayMatches[0].index, delta: Number.POSITIVE_INFINITY }).index;
}

export function selectHourlyWeather(
  hourly: OpenMeteoHourly,
  date: string,
  time: string,
  coordinates: WeatherCoordinates,
): HistoricalWeatherObservation | null {
  const index = nearestHourIndex(hourly.time ?? [], date, normaliseTime(time));
  if (index < 0) return null;
  const code = safeNumber(hourly.weather_code?.[index]);
  const observedAt = hourly.time?.[index] ?? dayKey(date, normaliseTime(time));
  return {
    weatherCode: code,
    weatherCondition: weatherConditionFromCode(code),
    temperature: safeNumber(hourly.temperature_2m?.[index]),
    humidity: safeNumber(hourly.relative_humidity_2m?.[index]),
    apparentTemp: safeNumber(hourly.apparent_temperature?.[index]),
    windSpeed: safeNumber(hourly.wind_speed_10m?.[index]),
    precipitation: safeNumber(hourly.precipitation?.[index]),
    weatherLocation: coordinates.label,
    weatherObservedAt: observedAt,
    weatherSource: "Open-Meteo 歷史天氣（逐小時）",
  };
}

export async function resolveWeatherLocation(input: {
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<WeatherCoordinates> {
  const latitude = input.latitude;
  const longitude = input.longitude;
  if (latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined) {
    return {
      label: input.location?.trim() || HONG_KONG_WEATHER_LOCATION.label,
      latitude,
      longitude,
    };
  }

  const location = input.location?.trim();
  if (!location || location === "香港" || location.toLowerCase() === "hong kong") {
    return HONG_KONG_WEATHER_LOCATION;
  }

  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", location);
    url.searchParams.set("count", "1");
    url.searchParams.set("language", "zh");
    url.searchParams.set("format", "json");
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`Geocoding request failed (${response.status})`);
    const result = await response.json() as { results?: Array<{ name?: string; admin1?: string; country?: string; latitude?: number; longitude?: number }> };
    const match = result.results?.[0];
    if (!match || !Number.isFinite(match.latitude) || !Number.isFinite(match.longitude)) {
      throw new Error("Location not found");
    }
    const label = [match.name, match.admin1, match.country].filter(Boolean).join(" · ") || location;
    return { label, latitude: Number(match.latitude), longitude: Number(match.longitude) };
  } catch {
    // Keep bulk repair useful even if a historical race location is ambiguous.
    return { ...HONG_KONG_WEATHER_LOCATION, label: location };
  }
}

export async function fetchHistoricalWeatherRange(input: {
  coordinates: WeatherCoordinates;
  startDate: string;
  endDate: string;
  time?: string;
}): Promise<Map<string, HistoricalWeatherObservation>> {
  if (!isHongKongDate(input.startDate) || !isHongKongDate(input.endDate)) {
    throw new Error("歷史天氣查詢需要有效的 YYYY-MM-DD 日期");
  }
  if (input.startDate > input.endDate) {
    throw new Error("開始日期不可晚於結束日期");
  }

  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.searchParams.set("latitude", String(input.coordinates.latitude));
  url.searchParams.set("longitude", String(input.coordinates.longitude));
  url.searchParams.set("start_date", input.startDate);
  url.searchParams.set("end_date", input.endDate);
  url.searchParams.set("hourly", "weather_code,temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m");
  url.searchParams.set("timezone", "Asia/Hong_Kong");
  url.searchParams.set("wind_speed_unit", "kmh");

  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`歷史天氣資料暫時無法取得（${response.status}）`);
  const payload = await response.json() as OpenMeteoArchiveResponse;
  if (!payload.hourly?.time?.length) throw new Error("歷史天氣來源沒有傳回逐小時資料");

  const result = new Map<string, HistoricalWeatherObservation>();
  const dates = Array.from(new Set(payload.hourly.time.map(value => value.slice(0, 10))));
  for (const date of dates) {
    const observation = selectHourlyWeather(payload.hourly, date, normaliseTime(input.time), input.coordinates);
    if (observation) result.set(date, observation);
  }
  return result;
}

export async function fetchHistoricalWeatherForDate(input: {
  coordinates: WeatherCoordinates;
  date: string;
  time?: string;
}): Promise<HistoricalWeatherObservation> {
  const observations = await fetchHistoricalWeatherRange({
    coordinates: input.coordinates,
    startDate: input.date,
    endDate: input.date,
    time: input.time,
  });
  const observation = observations.get(input.date);
  if (!observation) throw new Error("找不到指定日期及時間的天氣資料");
  return observation;
}

export function buildDateChunks(dates: string[], maximumSpanDays = 31): Array<{ startDate: string; endDate: string; dates: string[] }> {
  const ordered = Array.from(new Set(dates.filter(isHongKongDate))).sort();
  if (!ordered.length) return [];
  const chunks: Array<{ startDate: string; endDate: string; dates: string[] }> = [];
  let startDate = ordered[0];
  let selected = [ordered[0]];

  for (const date of ordered.slice(1)) {
    const start = new Date(`${startDate}T00:00:00Z`).getTime();
    const current = new Date(`${date}T00:00:00Z`).getTime();
    const spanDays = Math.floor((current - start) / 86_400_000);
    if (spanDays >= maximumSpanDays) {
      chunks.push({ startDate, endDate: selected[selected.length - 1], dates: selected });
      startDate = date;
      selected = [date];
    } else {
      selected.push(date);
    }
  }
  chunks.push({ startDate, endDate: selected[selected.length - 1], dates: selected });
  return chunks;
}
