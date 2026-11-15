// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import RunningGpsWeatherPanel from "../client/src/components/RunningGpsWeatherPanel";
import type { RunningGpsWeatherResult } from "../shared/runningGpsWeather";
const state = vi.hoisted(() => ({ data: undefined as RunningGpsWeatherResult | undefined, fetching: false, error: null as Error | null, query: vi.fn(), refetch: vi.fn() }));
vi.mock("../client/src/lib/trpc", () => ({ trpc: { running: { getGpsWeather: { useQuery: (input: unknown, options: unknown) => { state.query(input, options); return { data: state.data, isFetching: state.fetching, error: state.error, isPlaceholderData: false, refetch: state.refetch }; } } } } }));
function fixture(): RunningGpsWeatherResult { return {
  status: "complete", observation: { temperature: 0, apparentTemp: null, humidity: 75, windSpeed: 0, precipitation: 0, weatherCode: 0, weatherCondition: "晴朗", weatherLocation: "GPS 路線 · 2 個位置格", weatherObservedAt: "2026-11-02T06:00:00+08:00 至 2026-11-02T08:00:00+08:00", weatherSource: "Open-Meteo" },
  provenance: { version: 1, intervalStartHK: "2026-11-02T06:30:00+08:00", intervalEndHK: "2026-11-02T08:30:00+08:00", timeBasis: "verified-activity-window", samplingMethod: "observed-route-time-weighted-1.5km-cells-hourly", spatialCellKm: 1.5, maxGapSeconds: 120, totalSeconds: 7200, observedRouteSeconds: 7200, coveredSeconds: 7200, coverageFraction: 1, metricCoveredSeconds: { temperature: 7200, humidity: 7200, apparentTemp: 0, windSpeed: 7200, precipitation: 7200, weatherCode: 7200 }, sampledCells: 2, sampledHours: 3, plannedCellDayBatches: 2, selectedCellDayBatches: 2, requestsMade: 2, cacheHits: 0, failedSegments: 0, source: ["archive"], providerTimeStartHK: "2026-11-02T06:00:00+08:00", providerTimeEndHK: "2026-11-02T08:00:00+08:00", precipitationBasis: "preceding-hour-mm-prorated-by-route-seconds", precipitationMeanRateMmPerHour: 0, conditions: [{ code: 0, label: "晴朗", seconds: 7200, fraction: 1 }], mixedConditions: false, reasons: [] }
}; }
let root: Root; let host: HTMLDivElement;
beforeEach(() => { vi.clearAllMocks(); state.data = fixture(); state.fetching = false; state.error = null; (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = async (id = 891) => { await act(async () => root.render(React.createElement(RunningGpsWeatherPanel, { runningLogId: id }))); };
describe("read-only GPS weather panel", () => {
  it("requests one selected run with no polling or persistence and labels genuine zeros/unknown", async () => {
    await render(); expect(state.query.mock.lastCall?.[0]).toEqual({ id: 891 }); expect(state.query.mock.lastCall?.[1].placeholderData).toBeUndefined();
    expect(host.querySelector('section[aria-label="GPS 跑步時段天氣"]')).not.toBeNull();
    expect(host.textContent).toContain("0.0 °C"); expect(host.textContent).toContain("0.0 km/h"); expect(host.textContent).toContain("平均體感未知");
    expect(host.textContent).toContain("100.0%"); expect(host.textContent).toContain("2 個位置取樣格"); expect(host.textContent).toContain("香港 UTC+8");
    expect(host.textContent).toContain("天氣代碼不作數值平均"); expect(host.textContent).toContain("不只取起點");
    const source = readFileSync("client/src/components/RunningGpsWeatherPanel.tsx", "utf8"); expect(source).not.toMatch(/useMutation|mutateAsync|navigator\.geolocation|setInterval/);
  });
  it("clearly distinguishes partial coverage from a complete activity", async () => {
    state.data!.status = "partial"; state.data!.provenance.coverageFraction = 0.5; state.data!.provenance.coveredSeconds = 3600; state.data!.provenance.reasons = ["GPS 中間缺口未補值"];
    await render(); expect(host.textContent).toContain("部分覆蓋平均"); expect(host.textContent).not.toContain("完整時段覆蓋"); expect(host.textContent).toContain("50.0%"); expect(host.textContent).toContain("GPS 中間缺口未補值");
  });
  it("hides stale weather during fetching/errors and retries without saving", async () => {
    state.fetching = true; await render(); expect(host.textContent).not.toContain("75.0 %"); expect(host.textContent).toContain("不沿用其他跑步結果");
    state.fetching = false; state.error = new Error("provider offline"); await render(); expect(host.textContent).not.toContain("75.0 %"); expect(host.querySelector('[role="alert"]')).not.toBeNull(); await act(async () => host.querySelector("button")!.click()); expect(state.refetch).toHaveBeenCalledOnce();
  });
  it("unknown GPS or time is not a default Hong Kong7am estimate", async () => {
    state.data!.status = "unknown"; state.data!.observation = null; state.data!.provenance.intervalStartHK = null; state.data!.provenance.intervalEndHK = null; state.data!.provenance.timeBasis = "unknown";
    await render(); expect(host.textContent).toContain("位置／時段資料未知"); expect(host.textContent).toContain("無 GPS／有效時間時不猜測香港或早上 7 時"); expect(host.querySelectorAll("dl")).toHaveLength(0);
  });
});
