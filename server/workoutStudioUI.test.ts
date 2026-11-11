// @vitest-environment jsdom
import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GymLocationInput, {
  getGymLocationSuggestions,
  normalizeGymLocation,
} from "../client/src/components/GymLocationInput";

const mocks = vi.hoisted(() => ({
  sessions: [] as any[],
  detail: null as any,
  mutations: {} as Record<string, ReturnType<typeof vi.fn>>,
  prepare: vi.fn(),
  identify: vi.fn(),
  owner: true,
}));
const invalidate = vi.fn();
vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      workout: new Proxy({}, { get: () => ({ invalidate }) }),
    }),
    workout: new Proxy(
      {},
      {
        get: (_target, name: string) => ({
          useQuery: (input?: any) => ({
            data:
              name === "getSessions"
                ? mocks.sessions
                : name === "getSessionWithSets"
                  ? input?.sessionId
                    ? mocks.detail
                    : null
                  : name === "getExercisePRs"
                    ? {}
                    : name === "getProgressionSuggestion"
                      ? null
                      : [],
            isLoading: false,
            error: null,
          }),
          useMutation: () => ({
            mutate: (mocks.mutations[name] ??= vi.fn()),
            mutateAsync:
              name === "identifyExerciseFromPhoto" ? mocks.identify : vi.fn(),
            isPending: false,
          }),
        }),
      }
    ),
  },
}));
vi.mock("../client/src/lib/prepareReportPhoto", () => ({
  prepareReportPhoto: mocks.prepare,
}));
vi.mock("../client/src/contexts/OwnerContext", () => ({
  useIsOwner: () => mocks.owner,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("wouter", () => ({ useLocation: () => ["/workout", vi.fn()] }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../client/src/components/MuscleMap", () => ({
  default: () => null,
  MUSCLE_GROUPS: [
    { id: "chest", label: "胸部" },
    { id: "back", label: "背部" },
    { id: "cardio", label: "有氧" },
  ],
}));
vi.mock("../client/src/components/ExerciseDetailModal", () => ({
  default: ({ open, exercise }: any) =>
    open
      ? React.createElement(
          "div",
          { "data-testid": "exercise-detail" },
          exercise?.name
        )
      : null,
}));
vi.mock("recharts", () =>
  Object.fromEntries(
    [
      "BarChart",
      "Bar",
      "XAxis",
      "YAxis",
      "CartesianGrid",
      "Tooltip",
      "ResponsiveContainer",
      "LineChart",
      "Line",
      "AreaChart",
      "Area",
    ].map(name => [name, () => null])
  )
);
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
        { role: "tab", onClick: () => tabs.onValueChange(value) },
        children
      );
    },
    TabsContent: ({ value, children }: any) =>
      R.useContext(Context).value === value
        ? React.createElement("div", null, children)
        : null,
  };
});

let root: Root;
let host: HTMLDivElement;
const prepared = {
  base64: "/9j/bounded-jpeg",
  mimeType: "image/jpeg",
  fileName: "equipment.jpg",
};
const estimate = {
  activeKcal: 180,
  lowKcal: 140,
  highKcal: 225,
  bodyWeightKg: 62,
  weightSource: "body_log",
  effectiveMinutes: 45,
  intensity: "moderate",
  source: "met",
  warnings: ["強度估算存在個人差異"],
};
beforeEach(() => {
  mocks.sessions = [];
  mocks.detail = null;
  mocks.mutations = {};
  mocks.owner = true;
  vi.clearAllMocks();
  mocks.prepare.mockResolvedValue(prepared);
  mocks.identify.mockResolvedValue({
    name: "Cable Fly",
    nameZh: "繩索飛鳥",
    muscleGroup: "chest",
    equipment: "Cable",
    instructions: "控制動作",
    confidence: "medium",
  });
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function renderWorkout() {
  const { default: Workout } = await import("../client/src/pages/Workout");
  await act(async () => root.render(React.createElement(Workout)));
}
function button(text: string) {
  const result = [...document.querySelectorAll("button")].find(element =>
    element.textContent?.includes(text)
  );
  if (!result) throw new Error(`Missing button: ${text}`);
  return result as HTMLButtonElement;
}
async function click(text: string) {
  await act(async () => button(text).click());
}
async function setInput(selector: string, value: string) {
  const input = document.querySelector(selector) as HTMLInputElement;
  if (!input) throw new Error(`Missing input: ${selector}`);
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function select(selector: string, value: string) {
  const input = document.querySelector(selector) as HTMLSelectElement;
  await act(async () => {
    input.value = value;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function photo(name = "large.png") {
  const input = document.querySelector(
    'input[aria-label="拍攝器材或動作相片"]'
  ) as HTMLInputElement;
  const file = new File(["large original png"], name, { type: "image/png" });
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  await act(async () =>
    input.dispatchEvent(new Event("change", { bubbles: true }))
  );
  return file;
}

function LocationHarness() {
  const [value, setValue] = useState("");
  return React.createElement(GymLocationInput, {
    value,
    onChange: setValue,
    locations: ["Pure 中環", "24/7 旺角", " pure 中環 "],
  });
}

describe("private accessible gym location input", () => {
  it("normalizes, searches and deduplicates only actual saved locations", () => {
    expect(normalizeGymLocation("  Pure   中環 \n ")).toBe("Pure 中環");
    expect(
      getGymLocationSuggestions(
        [null, " Pure 中環 ", "pure 中環", "旺角健身室", ""],
        "PURE"
      )
    ).toEqual(["Pure 中環"]);
    expect(getGymLocationSuggestions(["旺角健身室"], "未知分店")).toEqual([]);
    expect(
      getGymLocationSuggestions(
        Array.from({ length: 30 }, (_, index) => `Gym ${index}`),
        ""
      )
    ).toHaveLength(12);
  });
  it("supports keyboard selection, arbitrary text, home/outdoor and explicit clearing without external requests", async () => {
    const external = vi.fn();
    vi.stubGlobal("fetch", external);
    await act(async () => root.render(React.createElement(LocationHarness)));
    const input = document.querySelector(
      '[role="combobox"]'
    ) as HTMLInputElement;
    expect(input.getAttribute("aria-describedby")).toBeTruthy();
    await act(async () => input.focus());
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(2);
    await act(async () =>
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      )
    );
    expect(input.getAttribute("aria-activedescendant")).toBe(
      document.querySelector('[role="option"]')?.id
    );
    await act(async () =>
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      )
    );
    expect(input.value).toBe("Pure 中環");
    await setInput('[role="combobox"]', "我的私人健身室");
    expect(input.value).toBe("我的私人健身室");
    await click("家中");
    expect(input.value).toBe("家中");
    await click("戶外");
    expect(input.value).toBe("戶外");
    await act(async () =>
      (
        document.querySelector(
          '[aria-label="清除訓練地點"]'
        ) as HTMLButtonElement
      ).click()
    );
    expect(input.value).toBe("");
    expect(external).not.toHaveBeenCalled();
  });
});

describe("workout studio DOM contracts", () => {
  it("embeds APP_VERSION, saves actual location and preserves templates with an explicit manual start and duration", async () => {
    await renderWorkout();
    const { APP_VERSION } = await import("../client/src/lib/appMeta");
    expect(document.querySelector("h1")?.textContent).toContain(
      `v${APP_VERSION}`
    );
    await click("workout.start_workout");
    await setInput("#workout-session-name", "我的腿日");
    await setInput('[role="combobox"]', "旺角私人健身室");
    await click("補錄已完成課程");
    await setInput("#workout-session-date", "2020-01-02");
    await setInput('[aria-label="補錄開始時間"]', "19:30");
    await setInput('[aria-label="補錄有效時長"]', "42");
    await click("建立補錄課程");
    expect(mocks.mutations.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "我的腿日",
        location: "旺角私人健身室",
        date: "2020-01-02",
        startTime: "2020-01-02T19:30:00+08:00",
        endTime: "2020-01-02T12:12:00.000Z",
        duration: 42,
      })
    );
    expect(document.body.textContent).toContain("全身力量");
    expect(mocks.mutations.finishSession).not.toHaveBeenCalled();
  });
  it("filters equipment and muscle, and an actual button opens detail without logging a set", async () => {
    await renderWorkout();
    await click("workout.exercise_library");
    await select('[aria-label="篩選器材"]', "Dumbbell");
    await select('[aria-label="篩選肌群"]', "chest");
    const actions = [
      ...document.querySelectorAll('button[aria-label^="肌群與步驟 "]'),
    ];
    expect(actions).toHaveLength(1);
    expect(actions[0].getAttribute("aria-label")).toBe(
      "肌群與步驟 Dumbbell Fly"
    );
    await act(async () => (actions[0] as HTMLButtonElement).click());
    expect(
      document.querySelector('[data-testid="exercise-detail"]')?.textContent
    ).toBe("Dumbbell Fly");
    expect(mocks.mutations.addSet).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("卡片圖示不是動作動畫");
    await select('[aria-label="篩選器材"]', "Barbell");
    expect(
      document.querySelector('button[aria-label="動態示範 Bench Press"]')
    ).not.toBeNull();
    expect(
      document.querySelector('button[aria-label="肌群與步驟 Bench Press"]')
    ).toBeNull();
  });
  it("shows saved location and backend active range, then submits duration/intensity/bodyweight only after finish confirmation", async () => {
    const { todayHKString } = await import("../client/src/lib/hkTime");
    const session = {
      id: 7,
      name: "今日力量",
      startTime: `${todayHKString()}T08:00:00+08:00`,
      endTime: null,
      location: "Pure 中環",
      duration: null,
      calorieEstimate: estimate,
    };
    mocks.sessions = [session];
    mocks.detail = { session, sets: [] };
    await renderWorkout();
    expect(document.body.textContent).toContain("Pure 中環");
    expect(document.body.textContent).toContain("140–225");
    expect(document.body.textContent).toContain("62 kg");
    expect(document.body.textContent).toContain("強度估算存在個人差異");
    await click("結束訓練");
    expect(mocks.mutations.finishSession).not.toHaveBeenCalled();
    await setInput('[aria-label="結束訓練有效時長"]', "38");
    await setInput('[aria-label="本次參考體重修正"]', "63.5");
    await select('[aria-label="結束訓練強度"]', "vigorous");
    await click("確認結束並儲存");
    expect(mocks.mutations.finishSession).toHaveBeenCalledWith({
      id: 7,
      duration: 38,
      intensity: "vigorous",
      bodyWeightKg: 63.5,
    });
  });
  it("history is searchable by location and legacy duration correction never force-finishes old records", async () => {
    const session = {
      id: 9,
      name: "舊課程",
      startTime: "2020-01-02T08:00:00+08:00",
      endTime: null,
      location: "旺角健身室",
      duration: null,
      caloriesBurned: 0,
    };
    mocks.sessions = [session];
    mocks.detail = { session, sets: [] };
    await renderWorkout();
    await click("workout.history");
    await setInput('[aria-label="搜尋訓練名稱或地點"]', "旺角");
    expect(document.body.textContent).toContain("舊課程");
    await act(async () =>
      (
        document.querySelector(
          '[aria-label="查看課程 舊課程"]'
        ) as HTMLButtonElement
      ).click()
    );
    expect(document.body.textContent).toContain("歷史補錄");
    expect(
      [...document.querySelectorAll("button")].some(
        element => element.textContent === "結束訓練"
      )
    ).toBe(false);
    await click("修改");
    await setInput('[aria-label="修改有效訓練時長"]', "35");
    await act(async () =>
      (
        document.querySelector(
          '[aria-label="清除訓練地點"]'
        ) as HTMLButtonElement
      ).click()
    );
    await click("儲存");
    expect(mocks.mutations.updateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 9,
        location: "",
        duration: 35,
        endTime: undefined,
      }),
      expect.any(Object)
    );
    expect(mocks.mutations.finishSession).not.toHaveBeenCalled();
  });
  it("changes only location on long completed legacy sessions without submitting corrected duration or truncated timestamps", async () => {
    const session = {
      id: 14,
      name: "長時間舊記錄",
      startTime: "2020-01-02T12:00:27+08:00",
      endTime: "2020-01-02T23:34:58+08:00",
      rawDuration: 694,
      duration: 8,
      location: "原有地點",
      calorieEstimate: { ...estimate, effectiveMinutes: 8 },
    };
    mocks.sessions = [session];
    mocks.detail = { session, sets: [] };
    await renderWorkout();
    await click("workout.history");
    await act(async () =>
      (
        document.querySelector(
          '[aria-label="查看課程 長時間舊記錄"]'
        ) as HTMLButtonElement
      ).click()
    );
    await click("修改");
    expect(
      (
        document.querySelector(
          '[aria-label="修改有效訓練時長"]'
        ) as HTMLInputElement
      ).value
    ).toBe("8");
    await setInput('[role="combobox"]', "新訓練地點");
    await click("儲存");
    expect(mocks.mutations.updateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 14,
        location: "新訓練地點",
        duration: undefined,
        startTime: undefined,
        endTime: undefined,
      }),
      expect.any(Object)
    );
    expect(mocks.mutations.finishSession).not.toHaveBeenCalled();
    mocks.mutations.updateSession.mockClear();
    await setInput('[aria-label="修改有效訓練時長"]', "10");
    await click("儲存");
    expect(mocks.mutations.updateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: 10,
        startTime: undefined,
        endTime: undefined,
      }),
      expect.any(Object)
    );
  });
  it("honestly distinguishes machine-reported energy and handles missing or zero estimates", async () => {
    const { WorkoutEnergyPanel, formatActiveEnergyRange } = await import(
      "../client/src/pages/Workout"
    );
    expect(formatActiveEnergyRange(null)).toBe("—");
    expect(
      formatActiveEnergyRange({
        ...estimate,
        activeKcal: 0,
        lowKcal: 0,
        highKcal: 0,
      } as any)
    ).toBe("0–0");
    await act(async () =>
      root.render(
        React.createElement(WorkoutEnergyPanel, {
          estimate: {
            ...estimate,
            source: "machine_reported",
            weightSource: "assumed_70kg",
          } as any,
        })
      )
    );
    expect(document.body.textContent).toContain("無法確認為純活動消耗");
    expect(document.body.textContent).toContain("假設 70 kg");
    expect(document.body.textContent).toContain("並非統計信賴區間");
  });
  it("sends bounded prepared JPEG, requires applying reviewed AI draft, and never automatically saves an exercise", async () => {
    await renderWorkout();
    await click("workout.exercise_library");
    await click("自訂／拍照新增");
    const file = await photo();
    expect(mocks.prepare).toHaveBeenCalledWith(file);
    expect(mocks.identify).toHaveBeenCalledWith({
      base64: prepared.base64,
      mimeType: "image/jpeg",
    });
    expect(
      document.querySelector('input[capture="environment"]')
    ).not.toBeNull();
    expect(document.body.textContent).toContain("尚未儲存");
    expect(
      (
        document.querySelector(
          '[aria-label="自訂動作英文名稱"]'
        ) as HTMLInputElement
      ).value
    ).toBe("");
    expect(mocks.mutations.createCustomExercise).not.toHaveBeenCalled();
    await click("填入草稿並核對");
    expect(
      (
        document.querySelector(
          '[aria-label="自訂動作英文名稱"]'
        ) as HTMLInputElement
      ).value
    ).toBe("Cable Fly");
    expect(mocks.mutations.createCustomExercise).not.toHaveBeenCalled();
    await act(async () =>
      (
        [...document.querySelectorAll("button")].find(
          element => element.textContent === "新增動作"
        ) as HTMLButtonElement
      ).click()
    );
    expect(mocks.mutations.createCustomExercise).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Cable Fly",
        equipment: "Cable",
        muscleGroup: "chest",
      })
    );
  });
  it("retries from cached normalized bytes and ignores an obsolete response after closing", async () => {
    mocks.identify.mockRejectedValueOnce(new Error("受控辨識失敗"));
    await renderWorkout();
    await click("workout.exercise_library");
    await click("自訂／拍照新增");
    await photo();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      "受控辨識失敗"
    );
    await click("重試辨識");
    expect(mocks.prepare).toHaveBeenCalledOnce();
    expect(mocks.identify).toHaveBeenCalledTimes(2);
    expect(mocks.identify.mock.calls[0]).toEqual(mocks.identify.mock.calls[1]);
    expect(mocks.mutations.createCustomExercise).not.toHaveBeenCalled();
    let resolve!: (result: any) => void;
    mocks.identify.mockImplementationOnce(
      () =>
        new Promise(result => {
          resolve = result;
        })
    );
    await photo("obsolete.png");
    await click("取消");
    await act(async () => resolve({ name: "Obsolete" }));
    await click("自訂／拍照新增");
    expect(document.body.textContent).not.toContain("Obsolete");
  });
  it("keeps complete history, comparisons, PR and exercise AI while removing the divergent calorie algorithm", () => {
    const source = readFileSync("client/src/pages/Workout.tsx", "utf8");
    expect(source).toContain("trpc.workout.getSessions.useQuery()");
    for (const retained of [
      "getComparisonPeriod",
      "HistorySummaryCard",
      "weeklyVolume",
      "volumeByExercise",
      "getPRHistory",
      "getProgressionSuggestion",
      "analyzeExercise.mutate",
      "WORKOUT_TEMPLATES",
    ])
      expect(source).toContain(retained);
    expect(source).not.toContain("liveCaloriesEstimate");
    expect(source).not.toContain("met * 70");
    const locationSource = readFileSync(
      "client/src/components/GymLocationInput.tsx",
      "utf8"
    );
    expect(locationSource).not.toMatch(
      /navigator\.geolocation|fetch\(|google\.maps|localStorage/
    );
  });
});
