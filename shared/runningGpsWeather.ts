/** Compact GPS-weather contract. Never persist the server-only route plan to UI/AI. */
export type RunningGpsWeatherInput = {
  timeSeries: unknown;
  garminDetails?: unknown;
  /** Caller has verified these against the actual source-file timestamps, not a date/time form. */
  activityWindow?: { startTimestamp: string; endTimestamp: string; verified: true };
};

export type RunningGpsWeatherMetric = "temperature" | "humidity" | "apparentTemp" | "windSpeed" | "precipitation" | "weatherCode";
export type RunningGpsWeatherSource = "archive" | "historical-forecast" | "forecast";
export type RunningGpsWeatherProvenance = {
  version: 1;
  intervalStartHK: string | null;
  intervalEndHK: string | null;
  timeBasis: "verified-activity-window" | "timestamped-sample-bounds" | "unknown";
  samplingMethod: "observed-route-time-weighted-1.5km-cells-hourly";
  /** Cell size is a query partition, NOT the provider's meteorological resolution. */
  spatialCellKm: 1.5;
  maxGapSeconds: number;
  totalSeconds: number;
  observedRouteSeconds: number;
  coveredSeconds: number;
  coverageFraction: number;
  metricCoveredSeconds: Record<RunningGpsWeatherMetric, number>;
  sampledCells: number;
  sampledHours: number;
  plannedCellDayBatches: number;
  selectedCellDayBatches: number;
  requestsMade: number;
  cacheHits: number;
  failedSegments: number;
  source: RunningGpsWeatherSource[];
  /** Real provider hourly timestamps, with explicit HK offset; compact range, not a raw route. */
  providerTimeStartHK: string | null;
  providerTimeEndHK: string | null;
  /** precipitation field is estimated mm integrated over covered activity time, not a daily sum. */
  precipitationBasis: "preceding-hour-mm-prorated-by-route-seconds";
  precipitationMeanRateMmPerHour: number | null;
  conditions: Array<{ code: number; label: string; seconds: number; fraction: number }>;
  mixedConditions: boolean;
  reasons: string[];
};

export type RunningGpsWeatherObservation = {
  weatherCode: number | null;
  weatherCondition: string | null;
  temperature: number | null;
  humidity: number | null;
  apparentTemp: number | null;
  windSpeed: number | null;
  precipitation: number | null;
  weatherLocation: string;
  /** True provider hourly range (HK), not a fabricated single observation time. */
  weatherObservedAt: string;
  weatherSource: string;
};
export type RunningGpsWeatherResult = {
  status: "complete" | "partial" | "unknown";
  observation: RunningGpsWeatherObservation | null;
  provenance: RunningGpsWeatherProvenance;
};
