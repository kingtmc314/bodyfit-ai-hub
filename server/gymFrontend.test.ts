// @vitest-environment jsdom
import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildWorkoutMuscleAnalysis } from "./workoutMuscleAnalytics";
import { todayHKString } from "../client/src/lib/hkTime";
import WorkoutMuscleAnalytics, {
  WorkoutMuscleAnalyticsView,
} from "../client/src/components/WorkoutMuscleAnalytics";
import {
  WorkoutStudioRestBar,
  WorkoutStudioExerciseHeading,
  WorkoutStudioHeader,
  WorkoutStudioStyles,
} from "../client/src/components/WorkoutStudio";

const state = vi.hoisted(() => ({
  data: undefined as any,
  error: null as any,
  loading: false,
  language: "zh-TW",
  query: vi.fn(),
  refetch: vi.fn(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: state.language },
  }),
}));
vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    workout: {
      getMuscleAnalysis: {
        useQuery: (input: any) => {
          state.query(input);
          return {
            data: state.data,
            error: state.error,
            isLoading: state.loading,
            isFetching: false,
            refetch: state.refetch,
          };
        },
      },
      analyzeMusclePeriod: { useMutation: () => ({ isPending: false, mutateAsync: vi.fn() }) },
    },
  },
}));
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  state.data = undefined;
  state.error = null;
  state.loading = false;
  state.language = "zh-TW";
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
const render = async (node: React.ReactNode) => {
  await act(async () => root.render(node));
};
const click = async (label: string) => {
  const button = [...host.querySelectorAll("button")].find(
    element =>
      element.textContent?.includes(label) ||
      element.getAttribute("aria-label") === label
  );
  if (!button) throw new Error(`Missing button ${label}`);
  await act(async () => button.click());
};
const input = { period: "week" as const, anchorDate: "2026-11-15" };
function fixture() {
  return buildWorkoutMuscleAnalysis(
    input,
    [
      {
        id: 1,
        startTime: "2026-11-14T18:00:00+08:00",
        endTime: "2026-11-14T19:00:00+08:00",
      },
    ],
    [
      {
        id: 1,
        sessionId: 1,
        exerciseName: "Bench Press",
        weight: 40,
        reps: 10,
      },
      { id: 2, sessionId: 1, exerciseName: "Leg Press", weight: 100, reps: 10 },
      {
        id: 3,
        sessionId: 1,
        exerciseName: "Unknown custom movement",
        weight: null,
        reps: 12,
      },
    ],
    []
  );
}
function RestHarness() {
  const [seconds, setSeconds] = useState(90),
    [running, setRunning] = useState(true),
    [preset, setPreset] = useState(90);
  return React.createElement(WorkoutStudioRestBar, {
    seconds,
    preset,
    running,
    onPreset: value => {
      setPreset(value);
      setSeconds(value);
      setRunning(true);
    },
    onAdjust: delta =>
      setSeconds(value => Math.max(0, Math.min(600, value + delta))),
    onToggle: () => setRunning(value => !value),
    onReset: () => {
      setSeconds(0);
      setRunning(false);
    },
    onAddExercise: state.refetch,
    onAddSet: state.query,
    exerciseName: "Chest Press Machine",
  });
}

describe("Gym frontend saved-data analytics", () => {
  it("queries week/month/year/all using today in HK and lets all history keep its own backend range", async () => {
    await render(React.createElement(WorkoutMuscleAnalytics));
    expect(state.query).toHaveBeenLastCalledWith({
      period: "week",
      anchorDate: todayHKString(),
    });
    for (const [label, period] of [
      ["本月", "month"],
      ["本年", "year"],
      ["全部", "all"],
      ["本週", "week"],
    ]) {
      await click(label);
      expect(state.query).toHaveBeenLastCalledWith({
        period,
        anchorDate: todayHKString(),
      });
    }
    expect(host.textContent).toContain("香港 UTC+8");
    expect(host.textContent).toContain("週一開始");
  });
  it("does not turn loading, API failure or absent data into fabricated zeroes or a muscle ranking", async () => {
    state.loading = true;
    await render(React.createElement(WorkoutMuscleAnalytics));
    expect(host.querySelector('[role="status"]')?.textContent).toContain(
      "正在載入"
    );
    state.loading = false;
    state.error = { message: "Denied" };
    await render(React.createElement(WorkoutMuscleAnalytics));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "不是零訓練量"
    );
    expect(host.querySelector("[data-muscle-area-map]")).toBeNull();
    await click("重試載入");
    expect(state.refetch).toHaveBeenCalledOnce();
    state.error = null;
    await render(React.createElement(WorkoutMuscleAnalytics));
    expect(host.textContent).toContain("不以空白回應推算為 0");
  });
  it("renders front/back anatomy and mathematically separate primary-volume vs overlapping secondary-participation charts", async () => {
    const data = fixture();
    await render(
      React.createElement(WorkoutMuscleAnalyticsView, {
        data,
        metric: "volume",
        onMetric: state.query,
      })
    );
    expect(host.querySelectorAll("[data-muscle-area-map] svg")).toHaveLength(2);
    expect(
      host
        .querySelector('[data-muscle-id="chest"]')
        ?.getAttribute("data-muscle-tone")
    ).toBe("primary");
    expect(
      host
        .querySelector('[data-muscle-id="triceps"]')
        ?.getAttribute("data-muscle-tone")
    ).toBe("secondary");
    expect(host.textContent).toContain("1,400 kg");
    expect(host.textContent).toContain("400 kg · 28.6%");
    expect(host.textContent).toContain("比例不可相加");
    expect(host.textContent).toContain("Unknown custom movement");
    expect(host.textContent).toContain("缺少重量");
    expect(host.textContent).not.toMatch(/top\s*10|前\s*10%|比.*使用者/i);
    await click("分配組數");
    expect(state.query).toHaveBeenCalledWith("sets");
  });
  it("distinguishes empty period, cardio-only logs and genuine zero-load bodyweight instead of inventing kg", async () => {
    const empty = buildWorkoutMuscleAnalysis(input, [], []);
    await render(
      React.createElement(WorkoutMuscleAnalyticsView, {
        data: empty,
        metric: "volume",
        onMetric: state.query,
      })
    );
    expect(host.textContent).toContain("此期間尚未有已記錄組數");
    const cardio = buildWorkoutMuscleAnalysis(
      input,
      [{ id: 1, startTime: "2026-11-14T18:00:00+08:00" }],
      [{ id: 1, sessionId: 1, exerciseName: "Treadmill", duration: 20 }]
    );
    await render(
      React.createElement(WorkoutMuscleAnalyticsView, {
        data: cardio,
        metric: "volume",
        onMetric: state.query,
      })
    );
    expect(host.textContent).toContain("只有有氧或未分類記錄");
    const bodyweight = buildWorkoutMuscleAnalysis(
      input,
      [{ id: 1, startTime: "2026-11-14T18:00:00+08:00" }],
      [{ id: 1, sessionId: 1, exerciseName: "Push-up", weight: 0, reps: 10 }]
    );
    await render(
      React.createElement(WorkoutMuscleAnalyticsView, {
        data: bodyweight,
        metric: "volume",
        onMetric: state.query,
      })
    );
    expect(host.textContent).toContain("不換算成虛構 kg");
    await render(
      React.createElement(WorkoutMuscleAnalyticsView, {
        data: bodyweight,
        metric: "sets",
        onMetric: state.query,
      })
    );
    expect(host.textContent).toContain("1 組 · 100%");
  });
  it("provides English period, missing-data and metric controls without losing actual machine names", async () => {
    state.language = "en";
    state.data = fixture();
    await render(React.createElement(WorkoutMuscleAnalytics));
    expect(host.textContent).toContain("See your training distribution");
    expect(host.textContent).toContain("Secondary participation");
    await click("Month");
    expect(state.query).toHaveBeenLastCalledWith({
      period: "month",
      anchorDate: todayHKString(),
    });
    expect(host.textContent).toContain("Unknown custom movement");
  });
});

describe("Workout studio readable movement and rest controls", () => {
  it("supports pause/reset/presets and 15-second adjustments with a separate next-set action", async () => {
    await render(React.createElement(RestHarness));
    expect(host.querySelector('[role="timer"]')?.textContent).toBe("1:30");
    await click("增加休息 15 秒");
    expect(host.querySelector('[role="timer"]')?.textContent).toBe("1:45");
    await click("減少休息 15 秒");
    await click("暫停休息");
    expect(host.querySelector('[aria-label="繼續休息"]')).not.toBeNull();
    await click("120s");
    expect(host.querySelector('[role="timer"]')?.textContent).toBe("2:00");
    await click("重設");
    expect(host.querySelector('[role="timer"]')?.textContent).toBe("0:00");
    expect(
      (host.querySelector('[aria-label="繼續休息"]') as HTMLButtonElement)
        .disabled
    ).toBe(true);
    await click("新增動作");
    expect(state.refetch).toHaveBeenCalledOnce();
    await click("下一組");
    expect(state.query).toHaveBeenCalledOnce();
  });
  it("does not substitute animation and links only the exact Gymwork reference while keeping instructions", async () => {
    const exercise = {
      name: "Chest Press Machine",
      nameZh: "胸推機",
      muscleGroup: "chest",
      equipment: "Machine",
    };
    await render(
      React.createElement(WorkoutStudioExerciseHeading, {
        exercise,
        active: true,
        onOpen: state.refetch,
      })
    );
    expect(
      host.querySelector("canvas,video,iframe,[data-exercise-motion]")
    ).toBeNull();
    expect(host.textContent).toContain("胸肌");
    expect(host.textContent).toContain("肱三頭肌");
    await click("胸推機");
    expect(state.refetch).toHaveBeenCalledOnce();
    await render(
      React.createElement(WorkoutStudioExerciseHeading, {
        exercise: {
          name: "Lat Pulldown",
          muscleGroup: "lats",
          equipment: "Cable",
        },
        active: true,
        onOpen: state.refetch,
      })
    );
    const link = host.querySelector(
      'a[aria-label="Gymwork 原作 Lat Pulldown"]'
    ) as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.href).toContain("gymwork.pro/exercises/lat-pulldown");
    expect(link.target).toBe("_blank");
    expect(
      host.querySelector("canvas,video,iframe,[data-exercise-motion]")
    ).toBeNull();
    expect(host.textContent).toContain("未嵌入或複製素材");
    await render(
      React.createElement(WorkoutStudioExerciseHeading, {
        exercise: {
          name: "Unknown machine",
          muscleGroup: "chest",
          equipment: "Machine",
        },
        active: true,
        onOpen: state.refetch,
      })
    );
    expect(host.querySelector("a")).toBeNull();
    expect(host.textContent).toContain("肌群與步驟");
  });
  it("has a readable top time/Finish + volume/kg/kcal/sets summary and no instant save side effect", async () => {
    await render(
      React.createElement(WorkoutStudioHeader, {
        title: "Workout · v3.17.0",
        subtitle: "Studio",
        status: "進行中",
        actions: null,
        workoutTime: "—",
        timeNote: "實際時間需核對",
        volume: "1,400",
        energy: "10–35",
        sets: 3,
        onFinish: state.refetch,
      })
    );
    expect(host.querySelector("h1")?.textContent).toContain("Workout");
    expect(host.textContent).toContain("訓練時間");
    expect(host.textContent).toContain("1,400");
    expect(host.textContent).toContain("活動熱量估算");
    expect(state.refetch).not.toHaveBeenCalled();
    await click("Finish");
    expect(state.refetch).toHaveBeenCalledOnce();
  });
  it("scopes light colors, touch targets, safe areas and responsive set-row constraints to gym components only", async () => {
    await render(React.createElement(WorkoutStudioStyles));
    const css = host.querySelector("style")?.textContent || "";
    expect(css).toContain(".workout-studio");
    expect(css).toContain("min-height:44px");
    expect(css).toContain("safe-area-inset-bottom");
    expect(css).toContain("min-width:0");
    expect(css).toContain("@media(min-width:768px)");
    expect(css).not.toMatch(/(?:^|\})\s*(?:html|body|:root)\s*\{/);
    const source = readFileSync("client/src/pages/Workout.tsx", "utf8");
    for (const preserved of [
      "prepareReportPhoto",
      "GymLocationInput",
      "getComparisonPeriod",
      "HistorySummaryCard",
      "WORKOUT_TEMPLATES",
      "handleSaveEditSession",
      "handleFinishSession",
      "MAX_WORKOUT_MINUTES",
      "sessionStorage.setItem",
      "ExerciseDetailModal",
      "getExercisePRs",
      "openNextSet",
      "getExerciseGuide",
    ])
      expect(source).toContain(preserved);
    expect(source).toContain("EXERCISE_GUIDES");
    expect(source).toContain("studio-set-row");
    expect(source).toContain("複製第");
    expect(source).toContain("修改第");
    expect(source).toContain("刪除第");
  });
});
