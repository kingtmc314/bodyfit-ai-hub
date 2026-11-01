import { useMemo, useState } from "react";
import { Activity, HeartPulse, Mountain, type LucideIcon } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import GarminRouteAnalysis from "@/components/GarminRouteAnalysis";
import { cn } from "@/lib/utils";

const MAX_DISPLAY_POINTS = 720;

type ChartMetric = "pace" | "heartRate" | "altitude";

type GarminTimePoint = {
  elapsedSec: number;
  timestamp?: string;
  distanceKm?: number;
  paceSecPerKm?: number;
  heartRate?: number;
  altitudeM?: number;
};

type ChartPoint = GarminTimePoint & {
  axisValue: number;
  metricValue?: number;
};

type MetricOption = {
  key: ChartMetric;
  label: string;
  axisLabel: string;
  color: string;
  activeClassName: string;
  Icon: LucideIcon;
};

export interface GarminTimeSeriesChartProps {
  timeSeries: Array<Record<string, unknown>>;
  runLabel?: string;
  className?: string;
}

const METRIC_OPTIONS: readonly MetricOption[] = [
  {
    key: "pace",
    label: "配速",
    axisLabel: "配速（分／公里）",
    color: "var(--chart-3)",
    activeClassName:
      "border-sky-600 bg-sky-600 text-white hover:bg-sky-700 dark:border-sky-400 dark:bg-sky-400 dark:text-slate-950 dark:hover:bg-sky-300",
    Icon: Activity,
  },
  {
    key: "heartRate",
    label: "心率",
    axisLabel: "心率（bpm）",
    color: "var(--color-heart)",
    activeClassName:
      "border-rose-600 bg-rose-600 text-white hover:bg-rose-700 dark:border-rose-400 dark:bg-rose-400 dark:text-slate-950 dark:hover:bg-rose-300",
    Icon: HeartPulse,
  },
  {
    key: "altitude",
    label: "海拔",
    axisLabel: "海拔（m）",
    color: "var(--chart-2)",
    activeClassName:
      "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 dark:border-emerald-400 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300",
    Icon: Mountain,
  },
];

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function toOptionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

function toNonNegativeNumber(value: unknown): number | undefined {
  const parsed = toFiniteNumber(value);
  return parsed !== undefined && parsed >= 0 ? parsed : undefined;
}

function toPositiveNumber(value: unknown): number | undefined {
  const parsed = toFiniteNumber(value);
  return parsed !== undefined && parsed > 0 ? parsed : undefined;
}

function normalizeTimeSeries(
  timeSeries: Array<Record<string, unknown>>
): GarminTimePoint[] {
  return timeSeries.flatMap(sample => {
    const elapsedSec = toNonNegativeNumber(sample.elapsedSec);
    if (elapsedSec === undefined) return [];

    return [
      {
        elapsedSec,
        timestamp: toOptionalText(sample.timestamp),
        distanceKm: toNonNegativeNumber(sample.distanceKm),
        paceSecPerKm: toPositiveNumber(sample.paceSecPerKm),
        heartRate: toPositiveNumber(sample.heartRate),
        altitudeM: toFiniteNumber(sample.altitudeM),
      },
    ];
  });
}

function getMetricValue(
  point: GarminTimePoint,
  metric: ChartMetric
): number | undefined {
  if (metric === "pace") return point.paceSecPerKm;
  if (metric === "heartRate") return point.heartRate;
  return point.altitudeM;
}

/**
 * Keeps chart rendering responsive for dense FIT exports. In addition to evenly
 * spaced points, it protects the first and last valid value of every supported
 * metric so occasional heart-rate or altitude readings are not sampled away.
 */
function samplePoints(points: GarminTimePoint[]): GarminTimePoint[] {
  if (points.length <= MAX_DISPLAY_POINTS) return points;

  const lastIndex = points.length - 1;
  const protectedIndexes = new Set<number>([0, lastIndex]);

  for (const metric of ["pace", "heartRate", "altitude"] as const) {
    let firstValueIndex: number | undefined;
    let lastValueIndex: number | undefined;

    points.forEach((point, index) => {
      if (getMetricValue(point, metric) === undefined) return;
      firstValueIndex ??= index;
      lastValueIndex = index;
    });

    if (firstValueIndex !== undefined) protectedIndexes.add(firstValueIndex);
    if (lastValueIndex !== undefined) protectedIndexes.add(lastValueIndex);
  }

  const availableEvenlySpacedSlots = MAX_DISPLAY_POINTS - protectedIndexes.size;
  const selectedIndexes = new Set(protectedIndexes);

  for (let slot = 0; slot < availableEvenlySpacedSlots; slot += 1) {
    const position =
      availableEvenlySpacedSlots === 1
        ? 0.5
        : slot / (availableEvenlySpacedSlots - 1);
    selectedIndexes.add(Math.round(position * lastIndex));
  }

  return Array.from(selectedIndexes)
    .sort((first, second) => first - second)
    .map(index => points[index]);
}

function formatElapsed(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatPace(secondsPerKm: number): string {
  return `${formatElapsed(secondsPerKm)} ／km`;
}

function formatDistance(distanceKm: number): string {
  const decimals = distanceKm < 10 ? 1 : 0;
  return `${distanceKm.toFixed(decimals)} km`;
}

function formatMetricValue(metric: ChartMetric, value: number): string {
  if (metric === "pace") return formatPace(value);
  if (metric === "heartRate") return `${Math.round(value)} bpm`;
  return `${value.toFixed(1)} m`;
}

function formatMetricTick(metric: ChartMetric, value: number): string {
  if (metric === "pace") return formatPace(value);
  if (metric === "heartRate") return `${Math.round(value)}`;
  return `${Math.round(value)}`;
}

function formatTimestamp(timestamp?: string): string | undefined {
  if (!timestamp) return undefined;

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;

  return date.toLocaleTimeString("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasOptionalFiniteNumber(value: unknown): boolean {
  return value === undefined || toFiniteNumber(value) !== undefined;
}

function isChartPoint(value: unknown): value is ChartPoint {
  if (!isRecord(value)) return false;

  return (
    toFiniteNumber(value.elapsedSec) !== undefined &&
    toFiniteNumber(value.axisValue) !== undefined &&
    hasOptionalFiniteNumber(value.distanceKm) &&
    hasOptionalFiniteNumber(value.paceSecPerKm) &&
    hasOptionalFiniteNumber(value.heartRate) &&
    hasOptionalFiniteNumber(value.altitudeM) &&
    hasOptionalFiniteNumber(value.metricValue) &&
    (value.timestamp === undefined || typeof value.timestamp === "string")
  );
}

type GarminChartTooltipProps = Pick<
  TooltipProps<number, string>,
  "active" | "payload"
> & {
  selectedMetric: ChartMetric;
};

function TooltipRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-5 py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span
        className="font-semibold tabular-nums"
        style={color ? { color } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

function GarminChartTooltip({
  active,
  payload,
  selectedMetric,
}: GarminChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const rawPoint: unknown = payload[0]?.payload;
  if (!isChartPoint(rawPoint) || rawPoint.metricValue === undefined)
    return null;

  const selectedOption = METRIC_OPTIONS.find(
    option => option.key === selectedMetric
  );
  const timestamp = formatTimestamp(rawPoint.timestamp);

  return (
    <div className="min-w-48 rounded-xl border border-border bg-popover/95 px-3 py-2.5 text-xs text-popover-foreground shadow-lg backdrop-blur">
      <p className="mb-1.5 border-b border-border pb-1.5 font-semibold text-foreground">
        已過時間 {formatElapsed(rawPoint.elapsedSec)}
      </p>
      <div className="space-y-0.5">
        {timestamp && <TooltipRow label="記錄時間" value={timestamp} />}
        {rawPoint.distanceKm !== undefined && (
          <TooltipRow
            label="距離"
            value={formatDistance(rawPoint.distanceKm)}
          />
        )}
        <TooltipRow
          label={selectedOption?.label ?? "指標"}
          value={formatMetricValue(selectedMetric, rawPoint.metricValue)}
          color={selectedOption?.color}
        />
        {selectedMetric !== "heartRate" && rawPoint.heartRate !== undefined && (
          <TooltipRow
            label="心率"
            value={`${Math.round(rawPoint.heartRate)} bpm`}
          />
        )}
        {selectedMetric !== "altitude" && rawPoint.altitudeM !== undefined && (
          <TooltipRow
            label="海拔"
            value={`${rawPoint.altitudeM.toFixed(1)} m`}
          />
        )}
      </div>
    </div>
  );
}

export default function GarminTimeSeriesChart({
  timeSeries,
  runLabel,
  className,
}: GarminTimeSeriesChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<ChartMetric>("pace");

  const normalizedPoints = useMemo(
    () => normalizeTimeSeries(timeSeries),
    [timeSeries]
  );
  const displayedPoints = useMemo(
    () => samplePoints(normalizedPoints),
    [normalizedPoints]
  );
  const usesDistanceAxis = normalizedPoints.some(
    point => point.distanceKm !== undefined
  );
  const selectedOption =
    METRIC_OPTIONS.find(option => option.key === selectedMetric) ??
    METRIC_OPTIONS[0];
  const SelectedMetricIcon = selectedOption.Icon;

  const chartData = useMemo((): ChartPoint[] => {
    let latestDistanceKm = 0;

    return displayedPoints.map(point => {
      if (point.distanceKm !== undefined) latestDistanceKm = point.distanceKm;

      return {
        ...point,
        axisValue: usesDistanceAxis ? latestDistanceKm : point.elapsedSec,
        metricValue: getMetricValue(point, selectedMetric),
      };
    });
  }, [displayedPoints, selectedMetric, usesDistanceAxis]);

  const metricPointCount = chartData.filter(
    point => point.metricValue !== undefined
  ).length;
  const isSampled = normalizedPoints.length > MAX_DISPLAY_POINTS;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm",
        className
      )}
    >
      <header className="border-b border-border bg-gradient-to-br from-sky-500/10 via-transparent to-emerald-500/10 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-700 dark:text-sky-300">
              <Activity className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-700 dark:text-sky-300">
                Garmin 跑步時間序列
              </p>
              <h3 className="mt-0.5 truncate text-base font-bold text-foreground">
                {runLabel ? `${runLabel} · 跑步曲線` : "單次跑步數據曲線"}
              </h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                切換檢視逐段配速、心率與海拔變化。資料來源：已核對的 Garmin 原始檔。
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="w-fit border-sky-300/70 bg-card/70 text-sky-800 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-200"
          >
            {timeSeries.length.toLocaleString()} 筆樣本
          </Badge>
        </div>
      </header>

      {normalizedPoints.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center px-5 py-10 text-center">
          <Activity
            className="mb-3 h-8 w-8 text-muted-foreground/70"
            aria-hidden="true"
          />
          <p className="text-sm font-semibold text-foreground">
            暫無可顯示的時間序列資料
          </p>
          <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
            請確認原始 FIT／CSV／GPX／TCX 已包含有效的
            elapsedSec（經過秒數）欄位，再重新匯入這筆跑步。
          </p>
        </div>
      ) : (
        <div className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="選擇要顯示的跑步指標"
            >
              {METRIC_OPTIONS.map(option => {
                const isSelected = selectedMetric === option.key;
                const OptionIcon = option.Icon;

                return (
                  <Button
                    key={option.key}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    aria-pressed={isSelected}
                    aria-label={`顯示${option.label}圖表`}
                    className={cn(
                      "h-8 rounded-lg px-3 transition-transform active:scale-[0.97]",
                      isSelected
                        ? option.activeClassName
                        : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    onClick={() => setSelectedMetric(option.key)}
                  >
                    <OptionIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    {option.label}
                  </Button>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground">
              {isSampled
                ? `為維持流暢度，顯示 ${displayedPoints.length.toLocaleString()}／${normalizedPoints.length.toLocaleString()} 筆（保留首尾資料）`
                : `顯示全部 ${displayedPoints.length.toLocaleString()} 筆時間序列資料`}
            </p>
          </div>

          {metricPointCount === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-5 py-10 text-center">
              <SelectedMetricIcon
                className="mb-3 h-8 w-8 text-muted-foreground/70"
                aria-hidden="true"
              />
              <p className="text-sm font-semibold text-foreground">
                這筆跑步沒有{selectedOption.label}資料
              </p>
              <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
                可切換至其他指標查看；若原始 FIT／CSV／GPX／TCX
                沒有此欄位，匯入後便無法建立對應曲線。
              </p>
            </div>
          ) : (
            <div
              className="pt-4"
              role="img"
              aria-label={`${selectedOption.label}時間序列圖表，橫軸為${usesDistanceAxis ? "距離" : "經過時間"}`}
            >
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: selectedOption.color }}
                    aria-hidden="true"
                  />
                  <p className="text-sm font-semibold text-foreground">
                    {selectedOption.label}變化
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {selectedOption.axisLabel}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  橫軸：{usesDistanceAxis ? "距離（km）" : "經過時間（mm:ss）"}
                </p>
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 12, left: 0, bottom: 4 }}
                >
                  <CartesianGrid
                    stroke="var(--border)"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="axisValue"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(value: number) =>
                      usesDistanceAxis
                        ? formatDistance(value)
                        : formatElapsed(value)
                    }
                    minTickGap={42}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    dy={7}
                  />
                  <YAxis
                    dataKey="metricValue"
                    type="number"
                    reversed={selectedMetric === "pace"}
                    tickFormatter={(value: number) =>
                      formatMetricTick(selectedMetric, value)
                    }
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={selectedMetric === "pace" ? 48 : 42}
                    dx={-4}
                  />
                  <Tooltip<number, string>
                    content={
                      <GarminChartTooltip selectedMetric={selectedMetric} />
                    }
                    cursor={{
                      stroke: "var(--muted-foreground)",
                      strokeDasharray: "4 4",
                    }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="metricValue"
                    name={selectedOption.label}
                    stroke={selectedOption.color}
                    strokeWidth={2.5}
                    dot={
                      metricPointCount === 1
                        ? { r: 4, fill: selectedOption.color, strokeWidth: 0 }
                        : false
                    }
                    activeDot={{
                      r: 4,
                      fill: selectedOption.color,
                      stroke: "var(--card)",
                      strokeWidth: 2,
                    }}
                    connectNulls
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>

              {selectedMetric === "pace" && (
                <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                  配速軸已反轉：越靠上代表每公里秒數越低、速度越快。
                </p>
              )}
            </div>
          )}

          <GarminRouteAnalysis timeSeries={timeSeries} className="mt-5" />
        </div>
      )}
    </section>
  );
}
