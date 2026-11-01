export type BackfillScope = "logs" | "races" | "both";

export type HistoricalBackfillOptions = {
  scope: BackfillScope;
  startDate: string;
  endDate: string;
  routeType?: string;
  overwriteRouteType: boolean;
  overwriteWeather: boolean;
};

export type BackfillRecord = {
  id: number | string;
  date: string | Date | null;
  route_type?: string | null;
  temperature?: number | string | null;
  humidity?: number | string | null;
  wind_speed?: number | string | null;
  apparent_temp?: number | string | null;
  precipitation?: number | string | null;
  weather_code?: number | string | null;
  weather_condition?: string | null;
  weather_location?: string | null;
};

export type BackfillCandidate = {
  id: number;
  date: string;
  kind: "log" | "race";
  needsRouteType: boolean;
  needsWeather: boolean;
};

function normaliseDate(value: BackfillRecord["date"]): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const valueString = String(value);
  const matched = valueString.match(/^\d{4}-\d{2}-\d{2}/);
  return matched?.[0] ?? null;
}

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "";
}

export function recordHasWeather(record: BackfillRecord): boolean {
  return [
    record.weather_condition,
    record.weather_code,
    record.temperature,
    record.humidity,
    record.wind_speed,
    record.apparent_temp,
    record.precipitation,
  ].some(hasValue);
}

export function buildHistoricalBackfillCandidates(
  runningLogs: BackfillRecord[],
  races: BackfillRecord[],
  options: HistoricalBackfillOptions,
  todayHK: string,
): { candidates: BackfillCandidate[]; skippedFuture: number } {
  const includeLogs = options.scope === "logs" || options.scope === "both";
  const includeRaces = options.scope === "races" || options.scope === "both";
  const candidates: BackfillCandidate[] = [];
  let skippedFuture = 0;

  const collect = (records: BackfillRecord[], kind: "log" | "race") => {
    for (const record of records) {
      const date = normaliseDate(record.date);
      if (!date || date < options.startDate || date > options.endDate) continue;
      if (date > todayHK) {
        skippedFuture += 1;
        continue;
      }
      const needsRouteType = kind === "log" && Boolean(options.routeType)
        && (options.overwriteRouteType || !record.route_type);
      const needsWeather = options.overwriteWeather || !recordHasWeather(record);
      if (!needsRouteType && !needsWeather) continue;
      candidates.push({ id: Number(record.id), date, kind, needsRouteType, needsWeather });
    }
  };

  if (includeLogs) collect(runningLogs, "log");
  if (includeRaces) collect(races, "race");
  return { candidates, skippedFuture };
}

export function summariseHistoricalBackfill(candidates: BackfillCandidate[], skippedFuture: number) {
  const logs = candidates.filter(candidate => candidate.kind === "log");
  const races = candidates.filter(candidate => candidate.kind === "race");
  return {
    selectedLogs: logs.length,
    selectedRaces: races.length,
    routeTypeUpdates: logs.filter(candidate => candidate.needsRouteType).length,
    weatherUpdates: candidates.filter(candidate => candidate.needsWeather).length,
    skippedFuture,
    total: candidates.length,
  };
}
