// @vitest-environment jsdom
import React, { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ContextEvidenceRow,
  ContextGroup,
  RunningContextReport,
} from "../shared/runningContextReport";
import RunningCrossValidationPanel, {
  type RunningCrossValidationPanelProps,
} from "../client/src/components/RunningCrossValidationPanel";

type QueryInput = RunningCrossValidationPanelProps & {
  groupKey?: string;
  sleepDateConvention: "unknown" | "wake-date";
};
type QueryOptions = {
  staleTime: number;
  refetchInterval: false;
  refetchOnWindowFocus: false;
  placeholderData: undefined;
};
const state = vi.hoisted(() => ({
  data: undefined as RunningContextReport | undefined,
  error: null as { message: string } | null,
  loading: false,
  fetching: false,
  placeholder: false,
  query: vi.fn<(input: QueryInput, options: QueryOptions) => void>(),
  refetch: vi.fn(),
  chart: vi.fn<(rows: ContextEvidenceRow[]) => void>(),
}));
vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    running: {
      getCrossValidation: {
        useQuery: (input: QueryInput, options: QueryOptions) => {
          state.query(input, options);
          return {
            data: state.data,
            error: state.error,
            isLoading: state.loading,
            isFetching: state.fetching,
            isPlaceholderData: state.placeholder,
            refetch: state.refetch,
          };
        },
      },
    },
  },
}));
vi.mock("recharts", () => {
  const wrapper = ({ children }: { children?: ReactNode }) =>
    React.createElement("div", null, children);
  return {
    ResponsiveContainer: wrapper,
    LineChart: ({
      children,
      data,
    }: {
      children?: ReactNode;
      data: ContextEvidenceRow[];
    }) => {
      state.chart(data);
      return React.createElement(
        "div",
        { "data-holdout-chart": true },
        children
      );
    },
    Line: ({
      dataKey,
      connectNulls,
      isAnimationActive,
    }: {
      dataKey: string;
      connectNulls: boolean;
      isAnimationActive: boolean;
    }) =>
      React.createElement("span", {
        "data-line-key": dataKey,
        "data-connect-nulls": String(connectNulls),
        "data-animation": String(isAnimationActive),
      }),
    CartesianGrid: () => null,
    Legend: () => null,
    Tooltip: () => null,
    XAxis: () => null,
    YAxis: () => null,
  };
});

const props: RunningCrossValidationPanelProps = {
  targetDistanceKm: 10,
  temperatureC: 24,
  humidityPct: 75,
  windKph: 8,
};
const queryInput: QueryInput = { ...props, sleepDateConvention: "unknown" };
const groups: ContextGroup[] = [
  {
    key: "easy-road-moving",
    runType: "慢跑",
    routeType: "公路",
    paceBasis: "continuous-moving",
    count: 40,
    minDistanceKm: 9,
    maxDistanceKm: 11,
  },
  {
    key: "tempo-track-summary",
    runType: "節奏跑",
    routeType: "田徑場",
    paceBasis: "summary",
    count: 25,
    minDistanceKm: 9.5,
    maxDistanceKm: 10.5,
  },
];
function row(id = 1): ContextEvidenceRow {
  return {
    id,
    dateHK: `2026-11-${String(id).padStart(2, "0")}`,
    distanceKm: 10,
    paceSecPerKm: 360,
    paceBasis: "continuous-moving",
    temperatureC: 24,
    humidityPct: 75,
    windKph: 8,
    weatherQuality: "已儲存觀測",
    sleepHours: 7.2,
    sleepDateHK: "2026-10-31",
    sleepMethod: "prior-date-proxy",
    restingHR: 56,
    restingHRDeltaBpm: 2.5,
    restingHRDateHK: "2026-10-31",
    baselinePredictedPace: 380,
    weatherPredictedPace: 372,
    contextPredictedPace: 362,
  };
}
function fixture(): RunningContextReport {
  return {
    version: "running-context-v1",
    source: "Life-OS Supabase",
    generatedAtHK: "2026-11-15 14:30:00",
    historyComplete: true,
    groups: groups.map(group => ({ ...group })),
    selectedGroup: { ...groups[0] },
    targetDistanceKm: 10,
    status: "validated-association",
    statusReason: "更早日期訓練的留出驗證呈現穩定改善。",
    coverage: {
      runs: 87,
      sleeps: 100,
      hearts: 90,
      selectedRuns: 40,
      temperature: 38,
      humidity: 35,
      sleep: 31,
      restingHR: 29,
      restingHRDelta: 24,
      priorDateSleepProxy: 8,
    },
    metrics: {
      baseline: {
        count: 10,
        days: 10,
        maeSecPerKm: 20,
        medianAbsolutePercentError: 5.1,
        biasSecPerKm: 4,
      },
      weatherOnly: {
        count: 10,
        days: 10,
        maeSecPerKm: 12,
        medianAbsolutePercentError: 3.2,
        biasSecPerKm: 2,
      },
      fullContext: {
        count: 10,
        days: 10,
        maeSecPerKm: 5,
        medianAbsolutePercentError: 1.3,
        biasSecPerKm: -1,
      },
      improvementPct: 75,
    },
    featuresUsed: ["氣溫", "濕度", "跑前睡眠", "靜息心率差值"],
    prediction: {
      supported: true,
      paceSecPerKm: 361,
      interval80SecPerKm: [350, 376],
      correctionEnabled: true,
      reason: "目前輸入在已驗證範圍內。",
      currentSleepHours: 7.5,
      currentSleepDateHK: "2026-11-14",
      currentRestingHRDeltaBpm: -1.2,
      currentRestingHRDateHK: "2026-11-14",
    },
    rows: [
      row(2),
      row(1),
      {
        ...row(3),
        baselinePredictedPace: null,
        weatherPredictedPace: null,
        contextPredictedPace: null,
      },
    ],
    limitations: ["過往留出關聯不保證下一次訓練表現。"],
  };
}
let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  state.data = undefined;
  state.error = null;
  state.loading = false;
  state.fetching = false;
  state.placeholder = false;
  vi.clearAllMocks();
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const render = async (input: RunningCrossValidationPanelProps = props) => {
  await act(async () =>
    root.render(React.createElement(RunningCrossValidationPanel, input))
  );
};
const click = async (label: string) => {
  const button = [...host.querySelectorAll("button")].find(element =>
    element.textContent?.includes(label)
  );
  if (!button) throw new Error(`Missing button ${label}`);
  await act(async () => button.click());
};
const selectGroup = async (key: string) => {
  const select = host.querySelector("select");
  if (!select) throw new Error("Missing comparable group select");
  await act(async () => {
    select.value = key;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
};
const correction = () => {
  const label = [...host.querySelectorAll("label")].find(element =>
    element.textContent?.includes("顯示經驗校正")
  );
  const checkbox = label
    ? host.querySelector<HTMLInputElement>(`input[id="${label.htmlFor}"]`)
    : null;
  if (!checkbox) throw new Error("Missing correction checkbox");
  return checkbox;
};
const prediction = () => host.querySelector("[data-context-prediction]");

describe("Running context read-only evidence frontend", () => {
  it("asks the backend to auto-select, passes all current inputs and does not poll", async () => {
    state.data = fixture();
    await render();
    expect(state.query).toHaveBeenLastCalledWith(queryInput, {
      staleTime: 60_000,
      refetchInterval: false,
      refetchOnWindowFocus: false,
      placeholderData: undefined,
    });
    const select = host.querySelector("select");
    expect(select?.value).toBe("");
    expect(
      [...host.querySelectorAll("option")].map(option => option.value)
    ).toEqual(["", ...groups.map(group => group.key)]);
    expect(host.textContent).toContain("慢跑 ／ 公路 ／ 連續移動配速");
    expect(host.textContent).toContain("節奏跑 ／ 田徑場 ／ 摘要配速");
    expect(host.textContent).toContain("Life-OS Supabase");
  });

  it("requires explicit wake-date opt-in, resets metrics/page and never implicitly checks it", async () => {
    const report = fixture();
    report.rows = Array.from({ length: 22 }, (_, index) => row(index + 1));
    state.data = report;
    await render();
    const label = [...host.querySelectorAll("label")].find(
      element => element.textContent === "我確認睡眠紀錄日期是起床日期"
    );
    const checkbox = label
      ? host.querySelector<HTMLInputElement>(`input[id="${label.htmlFor}"]`)
      : null;
    expect(checkbox).not.toBeNull();
    expect(checkbox?.checked).toBe(false);
    expect(state.query.mock.calls.at(-1)?.[0].sleepDateConvention).toBe(
      "unknown"
    );
    expect(host.textContent).toContain(
      "未知日期只使用保守的前一日期代理，不作睡眠數值校正"
    );
    expect(host.textContent).toContain("跑步開始時間未知時仍排除同日資料");
    await click("下一頁");
    state.fetching = true;
    await act(async () => checkbox?.click());
    expect(state.query.mock.calls.at(-1)?.[0].sleepDateConvention).toBe(
      "wake-date"
    );
    expect(prediction()).toBeNull();
    expect(host.textContent).not.toContain("MAE 20.0 s/km");
    state.fetching = false;
    await render();
    expect(host.textContent).toContain("第 1 / 2 頁");
    expect(host.textContent).toContain("使用者已確認起床日期");
    await act(async () => checkbox?.click());
    expect(state.query.mock.calls.at(-1)?.[0].sleepDateConvention).toBe(
      "unknown"
    );
    expect(checkbox?.checked).toBe(false);
    await selectGroup(groups[1].key);
    expect(checkbox?.checked).toBe(false);
  });

  it("shows actual read coverage, selected linked counts, timestamp and proxy warning", async () => {
    state.data = fixture();
    await render();
    expect(host.textContent).toContain(
      "已讀取跑步 87 次、睡眠 100 筆、心率 90 筆"
    );
    expect(host.textContent).toContain("選中可比跑步 40 次");
    for (const label of [
      "氣溫 38 次",
      "濕度 35 次",
      "跑前睡眠 31 次",
      "靜息心率 29 次",
      "靜息心率差值 24 次",
    ])
      expect(host.textContent).toContain(label);
    expect(host.textContent).toContain("前一日期睡眠代理 8 次");
    expect(host.textContent).toContain("未必是醒來日期");
    expect(host.textContent).toContain("2026-11-15 14:30:00");
    state.data.historyComplete = false;
    await render();
    expect(host.textContent).toContain("歷史讀取未完整，不能視作全部歷史");
  });

  it("labels server metrics honestly as sec/km MAE and median absolute percent error", async () => {
    state.data = fixture();
    await render();
    for (const label of [
      "MAE 20.0 s/km",
      "MAE 12.0 s/km",
      "MAE 5.0 s/km",
      "百分比絕對誤差中位數 5.1%",
      "百分比絕對誤差中位數 3.2%",
      "百分比絕對誤差中位數 1.3%",
      "10 次留出 · 10 個香港日期",
    ])
      expect(host.textContent).toContain(label);
    expect(host.textContent).toContain("不是百分比 MAE");
    expect(host.textContent).toContain("75.0%");
  });

  it("enables only the validated supported correction, can turn it off and calls no mutation", async () => {
    state.data = fixture();
    await render();
    expect(correction().disabled).toBe(false);
    expect(correction().checked).toBe(true);
    expect(prediction()?.textContent).toContain("相近訓練配速估算");
    expect(prediction()?.textContent).toContain("6:01 /km");
    expect(prediction()?.textContent).toContain(
      "經驗 80% 殘差區間：5:50 /km 至 6:16 /km"
    );
    expect(prediction()?.textContent).toContain("不是信賴區間");
    expect(prediction()?.textContent).toContain("不保證未來 80% 覆蓋");
    await act(async () => correction().click());
    expect(prediction()).toBeNull();
    expect(host.textContent).toContain("已手動關閉本面板估算");
    await act(async () => correction().click());
    expect(prediction()).not.toBeNull();
    expect(state.refetch).not.toHaveBeenCalled();
    const source = readFileSync(
      "client/src/components/RunningCrossValidationPanel.tsx",
      "utf8"
    );
    expect(source).not.toMatch(
      /useMutation|mutateAsync|runningEnergyModel|buildRunningEnergySimulation/
    );
    expect(source).not.toMatch(/\bany\b|setInterval|Date\.now/);
  });

  it.each([
    ["insufficient-data", "資料不足"],
    ["not-improved", "未見穩定改善"],
    ["unsupported-context", "目前情境不受支援"],
  ] as const)(
    "blocks %s and never fabricates fallback pace",
    async (status, label) => {
      const report = fixture();
      report.status = status;
      report.prediction.correctionEnabled = false;
      report.prediction.supported = false;
      report.prediction.paceSecPerKm = null;
      report.prediction.interval80SecPerKm = null;
      report.statusReason = "沒有可用的同日留出證據。";
      if (status === "insufficient-data") {
        report.metrics = {
          baseline: null,
          weatherOnly: null,
          fullContext: null,
          improvementPct: null,
        };
        report.rows = [];
      }
      state.data = report;
      await render();
      expect(host.textContent).toContain(label);
      expect(host.textContent).toContain("校正未啟用");
      expect(host.textContent).toContain(report.statusReason);
      expect(correction().disabled).toBe(true);
      expect(correction().checked).toBe(false);
      expect(prediction()).toBeNull();
      if (status === "insufficient-data") {
        expect(host.textContent).toContain("未有足夠留出誤差資料（不是 0）");
        expect(host.querySelector("[data-holdout-chart]")).toBeNull();
        expect(host.textContent).not.toContain("MAE 0.0");
      }
    }
  );

  it.each([
    "backend-disabled",
    "unsupported",
    "missing-pace",
    "non-finite-pace",
    "wrong-status",
  ] as const)(
    "honors the %s evidence gate even with other positive fields",
    async blocker => {
      const report = fixture();
      if (blocker === "backend-disabled")
        report.prediction.correctionEnabled = false;
      if (blocker === "unsupported") report.prediction.supported = false;
      if (blocker === "missing-pace") report.prediction.paceSecPerKm = null;
      if (blocker === "non-finite-pace")
        report.prediction.paceSecPerKm = Number.NaN;
      if (blocker === "wrong-status") report.status = "not-improved";
      state.data = report;
      await render();
      expect(correction().disabled).toBe(true);
      expect(correction().checked).toBe(false);
      expect(prediction()).toBeNull();
    }
  );

  it("preserves null weather/health/holdouts and unknown sleep date/method rather than empty zero", async () => {
    const report = fixture();
    report.rows = [
      {
        ...row(),
        temperatureC: null,
        humidityPct: null,
        windKph: null,
        sleepHours: null,
        sleepDateHK: null,
        sleepMethod: null,
        restingHR: null,
        restingHRDeltaBpm: null,
        restingHRDateHK: null,
        baselinePredictedPace: null,
        weatherPredictedPace: null,
        contextPredictedPace: null,
      },
    ];
    report.prediction.currentSleepHours = null;
    report.prediction.currentSleepDateHK = null;
    report.prediction.currentRestingHRDeltaBpm = null;
    report.prediction.currentRestingHRDateHK = null;
    report.prediction.interval80SecPerKm = null;
    state.data = report;
    await render();
    const evidence = host.querySelector("[data-evidence-row]")?.textContent;
    for (const label of [
      "氣溫 未有資料",
      "濕度 未有資料",
      "風速 未有資料",
      "睡眠 未有資料",
      "日期未知",
      "配對方法未知",
      "靜息 未有資料",
      "差值 未有資料",
    ])
      expect(evidence).toContain(label);
    expect(evidence).not.toMatch(
      /0\.0(?:°C|%| 小時| bpm)|0:00|1970|Invalid Date/
    );
    expect(host.textContent).toContain(
      "目前跑前睡眠：未有資料（香港 日期未知）"
    );
    expect(host.textContent).toContain("未有足夠區間資料");
    expect(host.querySelector("[data-holdout-chart]")).toBeNull();
  });

  it("does not hide genuine observed zero weather or resting-HR delta", async () => {
    const report = fixture();
    report.rows = [
      {
        ...row(),
        temperatureC: 0,
        humidityPct: 0,
        windKph: 0,
        restingHRDeltaBpm: 0,
      },
    ];
    state.data = report;
    await render();
    const evidence = host.querySelector("[data-evidence-row]")?.textContent;
    expect(evidence).toContain("氣溫 0.0°C");
    expect(evidence).toContain("濕度 0.0%");
    expect(evidence).toContain("風速 0.0 km/h");
    expect(evidence).toContain("差值 0.0 bpm");
  });

  it("plots only chronological non-null out-of-time report rows, without connecting or replacing gaps", async () => {
    const report = fixture();
    report.rows[1].weatherPredictedPace = null;
    state.data = report;
    await render();
    const chartRows = state.chart.mock.calls.at(-1)?.[0];
    expect(chartRows).toEqual([report.rows[1], report.rows[0]]);
    expect(chartRows?.[0].weatherPredictedPace).toBeNull();
    expect(
      [...host.querySelectorAll("[data-line-key]")].map(element =>
        element.getAttribute("data-line-key")
      )
    ).toEqual([
      "paceSecPerKm",
      "baselinePredictedPace",
      "weatherPredictedPace",
      "contextPredictedPace",
    ]);
    expect(
      host.querySelectorAll(
        '[data-connect-nulls="false"][data-animation="false"]'
      )
    ).toHaveLength(4);
    expect(
      host.querySelector('[role="img"]')?.getAttribute("aria-label")
    ).toContain("證據表");
    expect(host.querySelector("table")?.className).toContain("min-w-[1280px]");
    expect(host.querySelectorAll("table th[scope]").length).toBeGreaterThan(8);
    const evidence = host.querySelector('[data-evidence-row="1"]')?.textContent;
    for (const label of [
      "2026-11-01",
      "6:00 /km",
      "24.0°C",
      "75.0%",
      "7.2 小時",
      "Life-OS Supabase",
      "2026-10-31",
      "前一日期代理",
      "+2.5 bpm",
    ])
      expect(evidence).toContain(label);
    expect(host.textContent).toContain("未提供裝置來源");
  });

  it("caps table and chart at 20 rows and offers bounded pagination instead of all massive series", async () => {
    const report = fixture();
    report.rows = Array.from({ length: 22 }, (_, index) => row(index + 1));
    state.data = report;
    await render();
    expect(host.querySelectorAll("[data-evidence-row]")).toHaveLength(20);
    expect(state.chart.mock.calls.at(-1)?.[0]).toHaveLength(20);
    expect(host.textContent).toContain("第 1 / 2 頁 · 共 22 筆");
    expect(host.querySelector('[data-evidence-row="22"]')).not.toBeNull();
    expect(host.querySelector('[data-evidence-row="1"]')).toBeNull();
    await click("下一頁");
    expect(host.querySelectorAll("[data-evidence-row]")).toHaveLength(2);
    expect(state.chart.mock.calls.at(-1)?.[0].map(item => item.id)).toEqual([
      1, 2,
    ]);
    expect(host.textContent).toContain("第 2 / 2 頁");
    await click("上一頁");
    expect(host.querySelectorAll("[data-evidence-row]")).toHaveLength(20);
  });

  it("changes to an exact real group, rejects stale group data and resets the page/checkbox per key", async () => {
    const report = fixture();
    report.rows = Array.from({ length: 22 }, (_, index) => row(index + 1));
    state.data = report;
    await render();
    await click("下一頁");
    await act(async () => correction().click());
    await selectGroup(groups[1].key);
    expect(state.query.mock.calls.at(-1)?.[0]).toEqual({
      ...queryInput,
      groupKey: groups[1].key,
    });
    expect(prediction()).toBeNull();
    expect(host.textContent).toContain("不沿用舊估算");
    state.data = { ...report, selectedGroup: { ...groups[1] } };
    await render();
    expect(prediction()).not.toBeNull();
    expect(host.textContent).toContain("第 1 / 2 頁");
    expect(correction().checked).toBe(true);
    await selectGroup("");
    expect(state.query.mock.calls.at(-1)?.[0]).toEqual(queryInput);
  });

  it("hides prior predictions for changed distance/weather keys, placeholders and refreshes", async () => {
    state.data = fixture();
    await render();
    expect(prediction()).not.toBeNull();
    await render({ ...props, targetDistanceKm: 5 });
    expect(prediction()).toBeNull();
    expect(host.textContent).toContain("不沿用舊估算");
    state.loading = true;
    state.fetching = true;
    await render({ ...props, temperatureC: 30, humidityPct: 90, windKph: 20 });
    expect(prediction()).toBeNull();
    expect(host.textContent).toContain("等待天氣設定穩定");
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 380)); });
    expect(state.query.mock.calls.at(-1)?.[0]).toEqual({
      ...queryInput,
      temperatureC: 30,
      humidityPct: 90,
      windKph: 20,
    });
    expect(prediction()).toBeNull();
    state.loading = false;
    state.fetching = false;
    state.placeholder = true;
    await render();
    expect(prediction()).toBeNull();
    state.placeholder = false;
    await render();
    expect(prediction()).toBeNull();
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 380)); });
    expect(prediction()).not.toBeNull();
    state.fetching = true;
    await render();
    expect(prediction()).toBeNull();
  });

  it("separates loading, no response and failed refresh from zero data and retries explicitly", async () => {
    state.loading = true;
    await render();
    expect(host.querySelector('[role="status"]')?.textContent).toContain(
      "正在載入"
    );
    state.loading = false;
    await render();
    expect(host.textContent).toContain("不把空白資料視作 0");
    expect(prediction()).toBeNull();
    state.data = fixture();
    state.error = { message: "讀取權限不足" };
    await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "讀取權限不足"
    );
    expect(host.textContent).toContain("這不是零紀錄");
    expect(prediction()).toBeNull();
    expect(host.querySelector("[data-holdout-chart]")).toBeNull();
    await click("重試載入");
    expect(state.refetch).toHaveBeenCalledOnce();
    state.error = null;
    await render();
    expect(prediction()).not.toBeNull();
  });

  it("states earlier-day/no-future/date-only exclusion and noncausal nonmedical limits", async () => {
    state.data = fixture();
    await render();
    for (const label of [
      "每個香港日期整天留出",
      "只用更早日期訓練",
      "同一天的跑步不互相訓練",
      "同日只有日期",
      "健康資料會排除",
      "不使用未來資料",
      "觀察關聯",
      "不能排除",
      "不代表最大比賽能力",
      "VO₂ 實測",
      "醫療診斷",
      "不會套用至既有能量模型",
    ])
      expect(host.textContent).toContain(label);
    expect(prediction()?.textContent).not.toMatch(/完賽|VO₂|診斷|造成|因果/);
  });
});

describe("independent comparison distance", () => {
  it("switches comparison to 6km without calling any save or changing the supplied lab props", async () => {
    state.data = fixture();
    await render();
    expect(prediction()).not.toBeNull();
    await selectGroup(groups[1].key);
    await click("6 km");
    expect(state.query.mock.lastCall?.[0].targetDistanceKm).toBe(6);
    expect(state.query.mock.lastCall?.[0].groupKey).toBeUndefined();
    expect(prediction()).toBeNull();
    expect(props.targetDistanceKm).toBe(10);
    expect(host.textContent).toContain("不改動已保存情境");
    state.data = { ...fixture(), targetDistanceKm: 6 };
    await render();
    expect(prediction()).not.toBeNull();
    await click("跟隨模擬項目");
    expect(state.query.mock.lastCall?.[0].targetDistanceKm).toBe(10);
    expect(prediction()).toBeNull();
  });
});

describe("weather query coalescing", () => {
  it("hides old evidence immediately and reads only the final settled weather", async () => {
    state.data = fixture();
    await render();
    const calls = state.query.mock.calls.length;
    await render({ ...props, temperatureC: 28 });
    await render({ ...props, temperatureC: 29 });
    await render({ ...props, temperatureC: 30 });
    expect(prediction()).toBeNull();
    expect(state.query.mock.calls.length).toBe(calls);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 390)); });
    expect(state.query.mock.calls.length).toBe(calls + 1);
    expect(state.query.mock.lastCall?.[0].temperatureC).toBe(30);
  });
});
