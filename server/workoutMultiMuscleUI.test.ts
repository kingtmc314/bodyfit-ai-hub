// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WorkoutMuscleAnalytics, { WorkoutMuscleAnalyticsView } from "../client/src/components/WorkoutMuscleAnalytics";
import { buildWorkoutMuscleAnalysis } from "./workoutMuscleAnalytics";
import type { MuscleAnalysisInput } from "../shared/workoutMuscleAnalytics";

const state = vi.hoisted(() => ({
  isZh: true,
  data: undefined as any,
  resolve: undefined as ((input: MuscleAnalysisInput) => any) | undefined,
  query: vi.fn(),
  refetch: vi.fn(),
  ai: vi.fn(),
  three: vi.fn(),
}));
vi.mock("../client/src/components/WorkoutStudio", () => ({
  useStudioLanguage: () => state.isZh,
  studioMuscleLabel: (muscle: string) => muscle,
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ i18n: { language: state.isZh ? "zh-TW" : "en" } }) }));
vi.mock("../client/src/lib/hkTime", () => ({ todayHKString: () => "2026-11-16" }));
vi.mock("../client/src/lib/trpc", () => ({
  trpc: { workout: { getMuscleAnalysis: { useQuery: (input: MuscleAnalysisInput) => {
    state.query(input);
    return { data: state.resolve ? state.resolve(input) : state.data, isLoading: false, isFetching: false, error: null, refetch: state.refetch };
  } } } },
}));
vi.mock("../client/src/components/WorkoutMuscleAIReview", () => ({ default: (props: any) => {
  state.ai(props);
  return React.createElement("div", { "data-preserved-ai": true });
} }));
vi.mock("../client/src/components/WorkoutMuscle3DPanel", () => ({ default: (props: any) => {
  state.three(props);
  return React.createElement("div", { "data-preserved-3d": true });
} }));

const input = { period: "all" as const, anchorDate: "2026-11-16" };
const session = { id: 1, startTime: "2026-11-16T00:00:00+08:00" };
const saved = (id: number, exerciseName: string, weight = 30) => ({ id, sessionId: 1, exerciseName, reps: 10, weight });
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  state.isZh = true;
  state.data = undefined;
  state.resolve = undefined;
  vi.clearAllMocks();
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const render = async (element: React.ReactNode) => { await act(async () => root.render(element)); };
const click = async (label: string) => {
  const button = Array.from(host.querySelectorAll("button")).find(b => b.textContent === label);
  expect(button, `missing ${label}`).toBeDefined();
  await act(async () => button!.click());
};
const muscle = (id: string) => host.querySelector(`[data-participation-muscle="${id}"]`)!;

describe("compound muscle participation chart", () => {
  it("shows every primary and secondary in named columns even when secondary direct kg is zero", async () => {
    const data = buildWorkoutMuscleAnalysis(input, [session], [saved(1, "Chest Press Machine"), saved(2, "Leg Press"), saved(3, "Lat Pulldown"), saved(4, "Biceps Curl Machine", 0)]);
    await render(React.createElement(WorkoutMuscleAnalyticsView, { data, metric: "volume", onMetric: vi.fn() }));
    const chart = host.querySelector("[data-muscle-participation-chart]")!;
    expect(chart.textContent).toContain("主力組數");
    expect(chart.textContent).toContain("輔助組數");
    expect(chart.textContent).toContain("合計參與");
    expect(chart.querySelectorAll("tbody tr")).toHaveLength(data.muscles.length);
    expect(muscle("biceps").querySelector("[data-primary-sets]")?.textContent).toBe("1");
    expect(muscle("biceps").querySelector("[data-secondary-sets]")?.textContent).toBe("1");
    expect(muscle("biceps").querySelector("[data-combined-sets]")?.textContent).toBe("2 · 50%");
    expect((muscle("biceps").querySelector("[data-participation-primary]") as HTMLElement).style.width).toBe("25%");
    expect((muscle("biceps").querySelector("[data-participation-secondary]") as HTMLElement).style.width).toBe("25%");
    expect(muscle("biceps").querySelector('[role="img"]')?.getAttribute("aria-label")).toContain("合計 2 / 4 組 (50%)");
    for (const id of ["triceps", "hamstrings", "calves"]) {
      expect(muscle(id).querySelector("[data-primary-sets]")?.textContent).toBe("0");
      expect(muscle(id).querySelector("[data-secondary-sets]")?.textContent).toBe("1");
      expect(muscle(id).querySelector("[data-combined-sets]")?.textContent).toBe("1 · 25%");
    }
    expect(muscle("shoulders").querySelector("[data-secondary-sets]")?.textContent).toBe("2");
    expect(muscle("shoulders").querySelector("[data-combined-sets]")?.textContent).toBe("2 · 50%");
    expect(host.querySelector("dl")?.textContent).toContain("900 kg");
    expect(host.textContent).toContain("共 4 組已儲存記錄、40 次");
    expect(chart.textContent).toContain("各行不能相加作總組數");
    expect(chart.textContent).toContain("不額外分配 kg 或卡路里");
    expect(host.querySelectorAll("[data-muscle-area-map] svg")).toHaveLength(2);
    expect(host.querySelector('[data-muscle-id="calves"]')?.getAttribute("data-muscle-tone")).toBe("secondary");
    expect(state.three).toHaveBeenLastCalledWith({ primary: expect.arrayContaining(["chest", "quads", "glutes", "lats", "biceps"]), secondary: expect.arrayContaining(["triceps", "shoulders", "hamstrings", "calves", "biceps"]) });
    expect(state.ai).toHaveBeenLastCalledWith({ period: "all", anchorDate: "2026-11-16", hasSets: true });
  });

  it.each(["volume", "sets"] as const)("keeps combined participation visible in %s metric without changing allocated totals", async metric => {
    const data = buildWorkoutMuscleAnalysis(input, [session], [saved(1, "Leg Press")]);
    const before = JSON.stringify(data);
    const onMetric = vi.fn();
    await render(React.createElement(WorkoutMuscleAnalyticsView, { data, metric, onMetric }));
    for (const id of ["quads", "glutes"]) expect(muscle(id).querySelector("[data-primary-sets]")?.textContent).toBe("1");
    expect(host.textContent).toContain(metric === "volume" ? "150 kg · 50%" : "0.5 組 · 50%");
    expect(host.textContent).toContain("共 1 組已儲存記錄、10 次");
    expect(muscle("calves").querySelector("[data-combined-sets]")?.textContent).toBe("1 · 100%");
    await click(metric === "volume" ? "分配組數" : "訓練量 kg");
    expect(onMetric).toHaveBeenCalledWith(metric === "volume" ? "sets" : "volume");
    expect(JSON.stringify(data)).toBe(before);
  });

  it("shows zero-load saved participation without assigning invented volume", async () => {
    const data = buildWorkoutMuscleAnalysis(input, [session], [saved(1, "Chest Press Machine", 0)]);
    await render(React.createElement(WorkoutMuscleAnalyticsView, { data, metric: "volume", onMetric: vi.fn() }));
    expect(host.textContent).toContain("不換算成虛構 kg");
    expect(host.querySelectorAll("[data-participation-muscle]")).toHaveLength(3);
    expect(muscle("triceps").querySelector("[data-combined-sets]")?.textContent).toBe("1 · 100%");
    expect(host.querySelector("dl")?.textContent).toContain("0 kg");
  });

  it("preserves raw unknown warnings locally without inventing participation for unresolved exercises", async () => {
    const data = buildWorkoutMuscleAnalysis(input, [session], [saved(1, "Chest Press Machine"), saved(2, "Unknown Dual Machine")], [{ id: 9, name: "Unknown Dual Machine", muscleGroup: "RAW_UNKNOWN_CATEGORY", source: "custom_exercises" }]);
    await render(React.createElement(WorkoutMuscleAnalyticsView, { data, metric: "volume", onMetric: vi.fn() }));
    expect(host.textContent).toContain("Unknown Dual Machine");
    expect(host.textContent).toContain("RAW_UNKNOWN_CATEGORY");
    expect(host.querySelectorAll("[data-participation-muscle]")).toHaveLength(3);
    expect(muscle("triceps").querySelector("[data-combined-sets]")?.textContent).toBe("1 · 50%");
    expect(host.textContent).toContain("共 2 組已儲存記錄、20 次");
  });

  it("switches week/month/year/all HK scope for chart and AI together, including all-history future rows", async () => {
    const sessions = ["2025-12-31T15:59:59.999Z", "2025-12-31T16:00:00.000Z", "2026-10-31T16:00:00.000Z", "2026-11-15T16:00:00.000Z", "2026-11-22T15:59:59.999Z", "2027-01-01T16:00:00.000Z"].map((startTime, i) => ({ id: i + 1, startTime }));
    const sets = sessions.map(s => ({ ...saved(s.id, "Chest Press Machine"), sessionId: s.id }));
    state.resolve = scoped => buildWorkoutMuscleAnalysis(scoped, sessions, sets);
    await render(React.createElement(WorkoutMuscleAnalytics));
    for (const [label, period, count] of [["本週", "week", 2], ["本月", "month", 3], ["本年", "year", 4], ["全部", "all", 6]] as const) {
      await click(label);
      expect(state.query).toHaveBeenLastCalledWith({ period, anchorDate: "2026-11-16" });
      expect(muscle("triceps").querySelector("[data-secondary-sets]")?.textContent).toBe(String(count));
      expect(muscle("triceps").querySelector("[data-combined-sets]")?.textContent).toBe(`${count} · 100%`);
      expect(host.textContent).toContain(`共 ${count} 組已儲存記錄`);
      expect(state.ai).toHaveBeenLastCalledWith({ period, anchorDate: "2026-11-16", hasSets: true });
    }
    expect(host.textContent).toContain("2025-12-31");
    expect(host.textContent).toContain("2027-01-02");
    expect(host.textContent).toContain("全部不設歷史截限");
  });

  it("provides English combined counts and hides the chart for genuinely empty data", async () => {
    state.isZh = false;
    const data = buildWorkoutMuscleAnalysis(input, [session], [saved(1, "Chest Press Machine")]);
    await render(React.createElement(WorkoutMuscleAnalyticsView, { data, metric: "volume", onMetric: vi.fn() }));
    expect(host.textContent).toContain("Every mapped muscle counts: primary + secondary");
    expect(host.textContent).toContain("rows must not be added as total sets");
    expect(muscle("triceps").querySelector('[role="img"]')?.getAttribute("aria-label")).toContain("0 primary + 1 secondary = 1 / 1 sets (100%)");
    await render(React.createElement(WorkoutMuscleAnalyticsView, { data: buildWorkoutMuscleAnalysis(input, [], []), metric: "volume", onMetric: vi.fn() }));
    expect(host.querySelector("[data-muscle-participation-chart]")).toBeNull();
    expect(host.querySelector("[data-preserved-3d]")).toBeNull();
    expect(host.textContent).toContain("No logged sets in this period");
  });
});
