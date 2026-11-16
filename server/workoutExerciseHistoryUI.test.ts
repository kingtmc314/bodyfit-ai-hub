// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  history: null as any,
  historyError: null as any,
  historyFetching: false,
  queryCalls: [] as Array<{ input: any; options: any }>,
  sessions: [] as any[],
  detail: null as any,
  custom: [] as any[],
  usage: [] as any[],
  mutations: {} as Record<string, ReturnType<typeof vi.fn>>,
  analyze: vi.fn(),
  refetch: vi.fn(),
  chartData: [] as any[],
  lineProps: null as any,
}));
vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      workout: new Proxy({}, { get: () => ({ invalidate: vi.fn() }) }),
    }),
    workout: new Proxy(
      {},
      {
        get: (_target, name: string) => ({
          useQuery: (input?: any, options?: any) => {
            if (name === "getExerciseHistory") {
              mocks.queryCalls.push({ input, options });
              return {
                data: mocks.history,
                error: mocks.historyError,
                isLoading: !mocks.history,
                isFetching: mocks.historyFetching,
                refetch: mocks.refetch,
              };
            }
            return {
              data:
                name === "getSessions"
                  ? mocks.sessions
                  : name === "getSessionWithSets"
                    ? input?.sessionId
                      ? mocks.detail
                      : null
                    : name === "getCustomExercises"
                      ? mocks.custom
                      : name === "getExerciseUsage"
                        ? mocks.usage
                        : name === "getExercisePRs"
                          ? {}
                          : name === "getProgressionSuggestion"
                            ? null
                            : [],
              isLoading: false,
              isFetching: false,
              error: null,
            };
          },
          useMutation: () => ({
            mutate: (mocks.mutations[name] ??= vi.fn()),
            mutateAsync: name === "analyzeExercise" ? mocks.analyze : vi.fn(),
            isPending: false,
          }),
        }),
      }
    ),
  },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "zh-TW" },
  }),
}));
vi.mock("../client/src/contexts/OwnerContext", () => ({
  useIsOwner: () => true,
}));
vi.mock("wouter", () => ({ useLocation: () => ["/workout", vi.fn()] }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../client/src/components/WorkoutMuscleAnalytics", () => ({
  default: () => null,
}));
vi.mock("../client/src/components/GymDirectoryPanel", () => ({
  default: () => null,
}));
vi.mock("../client/src/components/MuscleMap", () => ({
  default: () => null,
  MUSCLE_GROUPS: [
    { id: "chest", label: "胸部" },
    { id: "abductors", label: "髖外展肌" },
    { id: "back", label: "背部" },
    { id: "cardio", label: "有氧" },
  ],
}));
vi.mock("../client/src/components/ExerciseMotionPreview", () => ({
  default: () =>
    React.createElement(
      "span",
      { "data-testid": "motion-preview" },
      "Movement"
    ),
}));
vi.mock("../client/src/components/ExerciseMuscleAnatomy", () => ({
  default: () =>
    React.createElement(
      "span",
      { "data-testid": "anatomy" },
      "Primary and secondary anatomy"
    ),
}));
vi.mock("../client/src/components/MuscleModel3D", () => ({
  default: () =>
    React.createElement("span", { "data-testid": "muscles-3d" }, "3D muscles"),
}));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) =>
    React.createElement("div", null, children),
  LineChart: ({ data, children }: any) => {
    mocks.chartData = data;
    return React.createElement("div", null, children);
  },
  Line: (props: any) => {
    mocks.lineProps = props;
    return null;
  },
  ...Object.fromEntries(
    [
      "XAxis",
      "YAxis",
      "CartesianGrid",
      "Tooltip",
      "BarChart",
      "Bar",
      "AreaChart",
      "Area",
    ].map(name => [name, () => null])
  ),
}));
vi.mock("../client/src/components/ui/dialog", async () => {
  const R = await import("react");
  const Context = R.createContext(false);
  const wrapper = ({ children }: any) =>
    React.createElement("div", null, children);
  return {
    Dialog: ({ open, children }: any) =>
      React.createElement(Context.Provider, { value: open }, children),
    DialogContent: ({ children }: any) =>
      R.useContext(Context)
        ? React.createElement("div", { role: "dialog" }, children)
        : null,
    DialogHeader: wrapper,
    DialogTitle: wrapper,
    DialogDescription: wrapper,
    DialogFooter: wrapper,
    useDialogComposition: () => ({
      justEndedComposing: () => false,
      setComposing: vi.fn(),
      markCompositionEnd: vi.fn(),
    }),
  };
});
vi.mock("../client/src/components/ui/tabs", async () => {
  const R = await import("react");
  const Context = R.createContext<any>({});
  return {
    Tabs: ({ value, onValueChange, children }: any) =>
      React.createElement(
        Context.Provider,
        { value: { value, onValueChange } },
        children
      ),
    TabsList: ({ children }: any) =>
      React.createElement("div", { role: "tablist" }, children),
    TabsTrigger: ({ value, children }: any) => {
      const tabs = R.useContext(Context);
      return React.createElement(
        "button",
        {
          role: "tab",
          "aria-selected": tabs.value === value,
          onClick: () => tabs.onValueChange(value),
        },
        children
      );
    },
    TabsContent: ({ value, forceMount, children }: any) => {
      const tabs = R.useContext(Context);
      return forceMount || tabs.value === value
        ? React.createElement(
            "div",
            { role: "tabpanel", hidden: tabs.value !== value },
            children
          )
        : null;
    },
  };
});

import WorkoutExerciseHistoryPanel from "../client/src/components/WorkoutExerciseHistoryPanel";
import ExerciseDetailModal from "../client/src/components/ExerciseDetailModal";

let root: Root;
let host: HTMLDivElement;
const exercise = {
  name: "Hip Abduction",
  nameZh: "髖外展",
  muscleGroup: "abductors",
  equipment: "Machine",
};
function history(name = "Hip Abduction", page = 1) {
  return {
    exerciseName: name,
    aliases: [name],
    summary: {
      totalSets: 3,
      sessionCount: 10,
      firstDateHK: "2020-01-01",
      lastDateHK: "2020-01-02",
      maxWeightKg: 20,
      totalVolumeKg: 200,
    },
    trend: [
      {
        dateHK: "2020-01-01",
        sessionCount: 1,
        setCount: 2,
        totalReps: 10,
        totalVolumeKg: 200,
        maxWeightKg: 20,
        averageWeightKg: 10,
        missingLoadSetCount: 0,
      },
      {
        dateHK: "2020-01-02",
        sessionCount: 1,
        setCount: 1,
        totalReps: 0,
        totalVolumeKg: 0,
        maxWeightKg: null,
        averageWeightKg: null,
        missingLoadSetCount: 1,
      },
    ],
    trendMetadata: { truncated: false },
    sessions: [
      {
        id: 9,
        dateHK: "2020-01-02",
        name: "已保存的腿日",
        location: "香港健身室",
        startTime: "2020-01-01T16:30:00.000Z",
        sets: [
          {
            id: 1,
            setNumber: 1,
            reps: 10,
            weight: 20,
            duration: null,
            distance: null,
          },
          {
            id: 2,
            setNumber: 2,
            reps: 0,
            weight: 0,
            duration: null,
            distance: null,
          },
          {
            id: 3,
            setNumber: 3,
            reps: null,
            weight: null,
            duration: null,
            distance: null,
          },
        ],
      },
    ],
    page,
    pageSize: 8,
    totalPages: 2,
    hasNextPage: page === 1,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(mocks, {
    history: null,
    historyError: null,
    historyFetching: false,
    queryCalls: [],
    sessions: [],
    detail: null,
    custom: [],
    usage: [],
    mutations: {},
    chartData: [],
    lineProps: null,
  });
  mocks.analyze.mockResolvedValue({
    analysis: "已保存負重呈上升趨勢。",
    recommendations: [
      {
        title: "循序加重",
        detail: "先穩定完成既定次數，再小幅增加負重。",
        type: "overload",
      },
    ],
  });
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  HTMLElement.prototype.scrollIntoView = vi.fn();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
async function renderPanel(name = "Hip Abduction", open = true) {
  await act(async () =>
    root.render(
      React.createElement(WorkoutExerciseHistoryPanel, {
        exerciseName: name,
        open,
      })
    )
  );
}
function button(text: string) {
  const found = Array.from(document.querySelectorAll("button")).find(element =>
    element.textContent?.includes(text)
  );
  if (!found) throw new Error(`Missing button ${text}`);
  return found;
}
async function click(text: string) {
  await act(async () => button(text).click());
}
async function select(label: string, value: string) {
  const element = document.querySelector(
    `[aria-label="${label}"]`
  ) as HTMLSelectElement;
  await act(async () => {
    element.value = value;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function input(label: string, value: string) {
  const element = document.querySelector(
    `[aria-label="${label}"]`
  ) as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function renderWorkout() {
  const { default: Workout } = await import("../client/src/pages/Workout");
  await act(async () => root.render(React.createElement(Workout)));
}

describe("read-only exercise history DOM", () => {
  it("does not request history until open, and exposes bounded page input and loading", async () => {
    await renderPanel("Hip Abduction", false);
    expect(mocks.queryCalls).toHaveLength(0);
    await renderPanel();
    expect(mocks.queryCalls.at(-1)?.input).toEqual({
      exerciseName: "Hip Abduction",
      page: 1,
      pageSize: 8,
    });
    expect(document.querySelector('[role="status"]')?.textContent).toContain(
      "正在載入"
    );
    expect(mocks.analyze).not.toHaveBeenCalled();
  });
  it("shows dates in returned HK calendar, set numbers, null gaps and actual zero", async () => {
    mocks.history = history();
    await renderPanel();
    const table = document.querySelector(
      '[aria-label="2020-01-02 每組紀錄"] table'
    ) as HTMLTableElement;
    expect(table.caption?.textContent).toContain("2020-01-02");
    const rows = table.querySelectorAll("tbody tr");
    expect(
      Array.from(rows[0].querySelectorAll("th,td")).map(
        cell => cell.textContent
      )
    ).toEqual(["1", "10", "20"]);
    expect(
      Array.from(rows[1].querySelectorAll("th,td")).map(
        cell => cell.textContent
      )
    ).toEqual(["2", "0", "0"]);
    expect(
      Array.from(rows[2].querySelectorAll("th,td")).map(
        cell => cell.textContent
      )
    ).toEqual(["3", "—", "—"]);
    expect(document.body.textContent).toContain("香港健身室");
    expect(document.body.textContent).toContain("UTC+8");
    expect(table.parentElement?.className).toContain("overflow-x-auto");
    await click("lbs");
    expect(rows[0].textContent).toBe("11044.1");
    expect(rows[1].textContent).toBe("200");
    expect(mocks.history.sessions[0].sets[0].weight).toBe(20);
  });
  it("hides stale page and movement data immediately and resets pages on change/reopen", async () => {
    mocks.history = history();
    await renderPanel();
    await click("下一頁");
    expect(mocks.queryCalls.at(-1)?.input.page).toBe(2);
    expect(document.body.textContent).not.toContain("已保存的腿日");
    mocks.history = history("Hip Abduction", 2);
    await renderPanel();
    expect(document.body.textContent).toContain("第 2 / 2 頁");
    await renderPanel("Hip Adduction");
    expect(mocks.queryCalls.at(-1)?.input).toMatchObject({
      exerciseName: "Hip Adduction",
      page: 1,
    });
    expect(document.body.textContent).not.toContain("已保存的腿日");
    await renderPanel("Hip Adduction", false);
    await renderPanel("Hip Adduction", true);
    expect(mocks.queryCalls.at(-1)?.input.page).toBe(1);
  });
  it("renders retryable errors and a genuine empty history without charts or fake metrics", async () => {
    mocks.historyError = new Error("受控連線失敗");
    await renderPanel();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      "受控連線失敗"
    );
    await click("重試載入");
    expect(mocks.refetch).toHaveBeenCalledOnce();
    mocks.historyError = null;
    mocks.history = {
      ...history(),
      summary: {
        totalSets: 0,
        sessionCount: 0,
        firstDateHK: null,
        lastDateHK: null,
        maxWeightKg: null,
        totalVolumeKg: 0,
      },
      sessions: [],
      trend: [],
      totalPages: 0,
      hasNextPage: false,
    };
    await renderPanel();
    expect(document.body.textContent).toContain("尚未記錄此動作");
    expect(document.querySelector('[aria-label="負重時間序列"]')).toBeNull();
    expect(mocks.analyze).not.toHaveBeenCalled();
  });
  it("uses full-history ascending trend independent of pagination and preserves missing/zero weights", async () => {
    mocks.history = history();
    await renderPanel();
    expect(mocks.chartData.map(point => point.dateHK)).toEqual([
      "2020-01-01",
      "2020-01-02",
    ]);
    expect(mocks.chartData.map(point => point.value)).toEqual([200, null]);
    expect(mocks.lineProps.connectNulls).toBe(false);
    expect(document.body.textContent).toContain("重量 × 次數");
    await click("lbs");
    expect(mocks.chartData[0].value).toBeCloseTo(440.9245);
    await select("時間序列指標", "totalReps");
    expect(mocks.chartData.map(point => point.value)).toEqual([10, 0]);
    await select("時間序列指標", "averageWeightKg");
    expect(mocks.chartData[0].value).toBeCloseTo(22.0462);
    expect(mocks.chartData[1].value).toBeNull();
    expect(document.body.textContent).toContain("算術平均");
    await select("時間序列期間", "3");
    expect(document.querySelector('[role="img"]')).toBeNull();
    expect(document.body.textContent).toContain("此期間未有可顯示的紀錄");
  });
  it("runs AI only on request and discards an obsolete movement's response", async () => {
    let resolve!: (data: any) => void;
    mocks.analyze.mockImplementationOnce(
      () =>
        new Promise(result => {
          resolve = result;
        })
    );
    mocks.history = history();
    await renderPanel();
    expect(mocks.analyze).not.toHaveBeenCalled();
    await click("分析進展");
    expect(mocks.analyze).toHaveBeenCalledWith({
      exerciseName: "Hip Abduction",
    });
    mocks.history = history("Hip Adduction");
    await renderPanel("Hip Adduction");
    await act(async () =>
      resolve({ analysis: "舊動作的過期分析", recommendations: [] })
    );
    expect(document.body.textContent).not.toContain("舊動作的過期分析");
    await click("分析進展");
    expect(document.body.textContent).toContain("已保存負重呈上升趨勢");
    expect(document.body.textContent).toContain("循序加重");
    expect(mocks.mutations.addSet).toBeUndefined();
  });
  it("defaults detail to history, retains independent add action, demonstration and richer 3D anatomy tabs", async () => {
    mocks.history = history();
    const onAdd = vi.fn(),
      onClose = vi.fn();
    await act(async () =>
      root.render(
        React.createElement(ExerciseDetailModal, {
          exercise,
          open: true,
          onClose,
          onAddToSession: onAdd,
          hasActiveSession: true,
        })
      )
    );
    expect(
      document.querySelector('[role="tab"][aria-selected="true"]')?.textContent
    ).toContain("訓練紀錄");
    expect(mocks.queryCalls).not.toHaveLength(0);
    await click("動作與技巧");
    expect(
      document.querySelector('[data-testid="motion-preview"]')
    ).not.toBeNull();
    expect(document.body.textContent).toContain("Gymwork");
    await click("肌群 / 3D");
    expect(document.querySelector('[data-testid="anatomy"]')).not.toBeNull();
    await click("3D 肌群檢視");
    expect(document.querySelector('[data-testid="muscles-3d"]')).not.toBeNull();
    await click("加入訓練");
    expect(onAdd).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("unified library and chooser interaction DOM", () => {
  it("shows one equivalent Hip Abduction choice, preserves visible ambiguous variants and alias/equipment filters", async () => {
    mocks.custom = [
      { ...exercise, id: 31, nameZh: "已用髖外展", instructions: "已核對器械" },
      {
        id: 32,
        name: "Iso-Lateral High Row",
        nameZh: "自訂高位划船",
        muscleGroup: "back",
        equipment: "Machine",
        instructions: "俯臥說明待核對",
      },
    ];
    mocks.usage = [
      { exerciseName: "Hip Abduction", setRows: 6, sessionCount: 2 },
    ];
    await renderWorkout();
    await click("workout.exercise_library");
    expect(
      document.querySelectorAll('article[data-exercise-name="Hip Abduction"]')
    ).toHaveLength(1);
    expect(document.body.textContent).toContain("已用髖外展");
    expect(
      document.querySelectorAll(
        'article[data-exercise-name="Iso-Lateral High Row"]'
      )
    ).toHaveLength(2);
    expect(document.body.textContent).toContain("自訂說明待核對");
    expect(document.body.textContent).toContain("坐姿高位划船指引");
    expect(document.body.textContent).toContain("無法分辨坐姿／俯臥來源");
    await select("篩選器材", "Cable");
    await input("搜尋動作名稱或器材", "Lat Pulldown");
    expect(
      document.querySelectorAll('article[data-exercise-name="Lat Pulldown"]')
    ).toHaveLength(1);
    await select("篩選器材", "Machine");
    expect(
      document.querySelectorAll('article[data-exercise-name="Lat Pulldown"]')
    ).toHaveLength(1);
    expect(document.querySelector("button button")).toBeNull();
  });
  it("ordinary library title opens read-only history, and equivalent custom submission routes to existing choice", async () => {
    mocks.custom = [{ ...exercise, id: 31 }];
    mocks.history = history();
    await renderWorkout();
    await click("workout.exercise_library");
    const title = document.querySelector(
      'article[data-exercise-name="Hip Abduction"] h3 button'
    ) as HTMLButtonElement;
    await act(async () => title.click());
    expect(
      document.querySelector(
        '[role="dialog"] [role="tab"][aria-selected="true"]'
      )?.textContent
    ).toContain("訓練紀錄");
    expect(mocks.mutations.addSet).not.toHaveBeenCalled();
    await click("關閉");
    await click("自訂／拍照新增");
    await input("自訂動作英文名稱", "  Hip   Abduction  ");
    // The custom apparatus picker is a Radix select; choose via pointer-independent keyboard click.
    const triggers = Array.from(document.querySelectorAll('[role="combobox"]'));
    const equipmentTrigger = triggers.find(element =>
      element.textContent?.includes("Barbell")
    ) as HTMLElement;
    await act(async () => equipmentTrigger.click());
    const machine = Array.from(
      document.querySelectorAll('[role="option"]')
    ).find(element => element.textContent?.includes("Machine")) as HTMLElement;
    await act(async () => machine.click());
    await click("新增動作");
    expect(mocks.mutations.createCustomExercise).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("你的訓練紀錄");
  });
  it("session title and chooser history open the same history without adding a set; chooser selection still opens set form", async () => {
    const { todayHKString } = await import("../client/src/lib/hkTime");
    const session = {
      id: 7,
      name: "今日腿日",
      startTime: `${todayHKString()}T08:00:00+08:00`,
      endTime: null,
      location: "香港",
      duration: null,
    };
    mocks.sessions = [session];
    mocks.detail = {
      session,
      sets: [
        {
          id: 80,
          exerciseName: "Hip Abduction",
          reps: 10,
          weight: 20,
          setNumber: 1,
        },
      ],
    };
    mocks.history = history();
    await renderWorkout();
    const heading = document.querySelector(
      'button[aria-label="查看訓練紀錄 Hip Abduction"]'
    ) as HTMLButtonElement;
    await act(async () => heading.click());
    expect(document.body.textContent).toContain("你的訓練紀錄");
    expect(mocks.mutations.addSet).not.toHaveBeenCalled();
    await click("關閉");
    await click("Add Exercise");
    await input("搜尋課程動作", "Hip Abduction");
    const chooserHistory = Array.from(
      document.querySelectorAll(
        '[role="dialog"] button[aria-label="查看訓練紀錄 Hip Abduction"]'
      )
    ).at(-1) as HTMLButtonElement;
    await act(async () => chooserHistory.click());
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(2);
    expect(mocks.mutations.addSet).not.toHaveBeenCalled();
    await click("關閉");
    expect(document.querySelector("button button")).toBeNull();
    const selectChoice = document.querySelector(
      'button[aria-label="選擇 Hip Abduction 記錄組數"]'
    ) as HTMLButtonElement;
    await act(async () => selectChoice.click());
    expect(document.body.textContent).toContain("Log Set");
    expect(mocks.mutations.addSet).not.toHaveBeenCalled();
  });
});
