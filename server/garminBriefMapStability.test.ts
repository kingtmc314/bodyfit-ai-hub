// @vitest-environment jsdom
import React, { act, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  detail: { time_series: [{ elapsedSec: 0, latitude: 22.3, longitude: 114.17 }, { elapsedSec: 10, latitude: 22.31, longitude: 114.18 }] },
  samples: [] as unknown[],
}));
vi.mock("../client/src/lib/trpc", () => ({ trpc: { running: { getGarminRunDetail: { useQuery: () => ({ data: state.detail, isLoading: false }) } } } }));
vi.mock("../client/src/components/GarminTimeSeriesChart", () => ({ default: ({ timeSeries }: { timeSeries: unknown }) => { state.samples.push(timeSeries); return null; } }));
import GarminHealthBriefing from "../client/src/components/GarminHealthBriefing";

let root: Root;
let host: HTMLDivElement;
const data = { runs: [{ id: 1, hasTimeSeries: true, date: "2026-11-01", runningType: "Race", distanceKm: 21.13 }] };
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  state.samples = [];
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });

describe("Garmin brief stable raw series", () => {
  it("retains one sample identity while the one-second countdown keeps advancing", async () => {
    vi.useFakeTimers();
    function CountdownParent() {
      const [tick, setTick] = useState(0);
      useEffect(() => { const timer = setInterval(() => setTick(n => n + 1), 1000); return () => clearInterval(timer); }, []);
      return React.createElement("div", null, React.createElement("output", null, tick), React.createElement(GarminHealthBriefing, { data }));
    }
    await act(async () => root.render(React.createElement(CountdownParent)));
    for (let i = 0; i < 6; i++) await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(host.querySelector("output")?.textContent).toBe("6");
    expect(state.samples.length).toBeGreaterThanOrEqual(7);
    expect(new Set(state.samples).size).toBe(1);
    expect(state.samples[0]).toEqual(state.detail.time_series);
  });
  it("still sends genuinely changed saved GPS data to the chart", async () => {
    await act(async () => root.render(React.createElement(GarminHealthBriefing, { data })));
    const original = state.samples.at(-1);
    state.detail = { time_series: [{ elapsedSec: 0, latitude: 22.5, longitude: 114.2 }, { elapsedSec: 20, latitude: 22.51, longitude: 114.22 }] };
    await act(async () => root.render(React.createElement(GarminHealthBriefing, { data })));
    expect(state.samples.at(-1)).not.toBe(original);
    expect(state.samples.at(-1)).toEqual(state.detail.time_series);
  });
});
