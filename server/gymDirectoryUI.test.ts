// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  GymEquipmentResult,
  GymLocation,
  GymSearchResult,
} from "../shared/gymDirectory";

const mocks = vi.hoisted(() => ({
  searchData: null as GymSearchResult | null,
  searchError: null as Error | null,
  searchLoading: false,
  saved: [] as GymLocation[],
  savedError: null as Error | null,
  inventory: {} as Record<number, GymEquipmentResult>,
  inventoryError: null as Error | null,
  catalogError: null as Error | null,
  owner: true,
  searchInputs: vi.fn(),
  equipmentInputs: vi.fn(),
  save: vi.fn(),
  upsert: vi.fn(),
  remove: vi.fn(),
  identify: vi.fn(),
  prepare: vi.fn(),
  invalidateSaved: vi.fn(),
  invalidateEquipment: vi.fn(),
  refetchSearch: vi.fn(),
  refetchSaved: vi.fn(),
  refetchEquipment: vi.fn(),
  refetchCatalog: vi.fn(),
}));
vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      gym: {
        getSaved: { invalidate: mocks.invalidateSaved },
        getEquipment: { invalidate: mocks.invalidateEquipment },
      },
    }),
    gym: {
      search: {
        useQuery: (input: unknown, options: { enabled: boolean }) => {
          mocks.searchInputs(input, options);
          return {
            data: options.enabled ? mocks.searchData : undefined,
            error: options.enabled ? mocks.searchError : null,
            isFetching: options.enabled && mocks.searchLoading,
            refetch: mocks.refetchSearch,
          };
        },
      },
      getSaved: {
        useQuery: () => ({
          data: mocks.saved,
          error: mocks.savedError,
          isLoading: false,
          refetch: mocks.refetchSaved,
        }),
      },
      getEquipment: {
        useQuery: (input: { gymId: number }, options: { enabled: boolean }) => {
          mocks.equipmentInputs(input, options);
          return {
            data: options.enabled ? mocks.inventory[input.gymId] : undefined,
            error: options.enabled ? mocks.inventoryError : null,
            isLoading: false,
            isFetching: false,
            refetch: mocks.refetchEquipment,
          };
        },
      },
      getMachineCatalog: {
        useQuery: () => ({
          data: [
            {
              machineKey: "chest-press",
              displayName: "Chest Press Machine",
              nameZh: "胸推機",
              equipment: "Machine",
            },
            {
              machineKey: "seated-row",
              displayName: "Seated Row Machine",
              nameZh: "坐姿划船機",
              equipment: "Machine",
            },
          ],
          error: mocks.catalogError,
          isLoading: false,
          refetch: mocks.refetchCatalog,
        }),
      },
      saveLocation: {
        useMutation: () => ({ mutateAsync: mocks.save, isPending: false }),
      },
      upsertEquipment: {
        useMutation: () => ({ mutateAsync: mocks.upsert, isPending: false }),
      },
      deleteEquipment: {
        useMutation: () => ({ mutateAsync: mocks.remove, isPending: false }),
      },
    },
    workout: {
      identifyExerciseFromPhoto: {
        useMutation: () => ({ mutateAsync: mocks.identify, isPending: false }),
      },
    },
  },
}));
vi.mock("../client/src/contexts/OwnerContext", () => ({
  useIsOwner: () => mocks.owner,
}));
vi.mock("../client/src/lib/prepareReportPhoto", () => ({
  prepareReportPhoto: mocks.prepare,
}));
import GymDirectoryPanel, {
  type GymDirectoryPanelProps,
} from "../client/src/components/GymDirectoryPanel";

const official: GymLocation = {
  id: "official:branch-a",
  savedId: null,
  name: "24/7 Fitness — Branch A",
  address: "1 Example Street, London",
  country: "United Kingdom",
  brand: "24/7 Fitness",
  source: "official_seed",
  sourceUrl: "https://www.247.fitness/branches",
  placeId: null,
  latitude: null,
  longitude: null,
  sourceCheckedAt: "2026-11-14T00:00:00Z",
  createdAt: null,
  updatedAt: null,
};
const selected: GymLocation = {
  ...official,
  id: 11,
  savedId: 11,
  source: "owner_saved",
};
const second: GymLocation = {
  ...selected,
  id: 22,
  savedId: 22,
  name: "24/7 Fitness — Branch B",
  address: "22 Other Street, London",
};
const google: GymLocation = {
  ...official,
  id: "google:place-2",
  name: "Local Gym Tokyo",
  address: "2 Example Street, Tokyo",
  country: "Japan",
  brand: null,
  source: "google_places",
  sourceUrl: "https://www.google.com/maps/search/?api=1&query=Local+Gym",
  placeId: "place-2",
};
const timestamp = "2026-11-14T00:00:00Z";
function emptyInventory(gym: GymLocation): GymEquipmentResult {
  return {
    gym,
    equipment: [],
    officialEquipment: [],
    officialInventory: null,
    availableExercises: [],
    coverage: {
      status: "unknown",
      confirmedEquipmentCount: 0,
      officialEquipmentCount: 0,
      mappedEquipmentCount: 0,
      unmappedMachineKeys: [],
      completeInventory: false,
      message: "此分店器械未知；尚無擁有人確認資料。",
    },
  };
}
function populatedInventory(): GymEquipmentResult {
  return {
    gym: selected,
    equipment: [
      {
        id: 91,
        gymId: 11,
        machineKey: "chest-press",
        displayName: "胸推機",
        equipment: "Machine",
        source: "owner_confirmed",
        notes: "一樓，親自核對",
        sourceUrl: null,
        confirmedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    officialEquipment: [],
    officialInventory: null,
    availableExercises: [
      {
        machineKey: "chest-press",
        equipmentId: 91,
        guideId: "chest-press",
        name: "Chest Press Machine",
        nameZh: "胸推機",
        equipment: "Machine",
        aliases: ["Chest Press Machine"],
        primary: ["chest"],
        secondary: ["triceps"],
        primaryLabels: ["胸肌"],
        secondaryLabels: ["三頭肌"],
        referenceUrls: [],
        confirmationSource: "owner_confirmed",
      },
    ],
    coverage: {
      status: "partially_confirmed",
      confirmedEquipmentCount: 1,
      officialEquipmentCount: 0,
      mappedEquipmentCount: 1,
      unmappedMachineKeys: [],
      completeInventory: false,
      message: "只包含此分店已確認器械，並非完整器械盤點。",
    },
  };
}
let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.owner = true;
  mocks.saved = [];
  mocks.savedError = null;
  mocks.inventoryError = null;
  mocks.catalogError = null;
  mocks.searchError = null;
  mocks.searchLoading = false;
  mocks.searchData = {
    results: [official, google],
    total: 2,
    source: "官方、已保存及全球地點供應商搜尋",
    providerStatus: "OK",
    providerHasMore: true,
    attribution: "Google Maps",
    completeWorldwide: false,
  };
  mocks.inventory = {
    11: emptyInventory(selected),
    22: emptyInventory(second),
  };
  mocks.save.mockResolvedValue(selected);
  mocks.upsert.mockResolvedValue({ id: 91 });
  mocks.remove.mockResolvedValue({ success: true });
  mocks.prepare.mockResolvedValue({
    base64: "/9j/bounded",
    mimeType: "image/jpeg",
    fileName: "machine.jpg",
  });
  mocks.identify.mockResolvedValue({
    name: "Chest Press Machine",
    nameZh: "胸推機",
    equipment: "Machine",
    muscleGroup: "chest",
    confidence: "low",
    instructions: "Uncertain proposal",
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
async function render(props: GymDirectoryPanelProps = {}) {
  await act(async () =>
    root.render(React.createElement(GymDirectoryPanel, props))
  );
}
function button(text: string): HTMLButtonElement {
  const result = [...host.querySelectorAll("button")].find(node =>
    node.textContent?.includes(text)
  );
  if (!result) throw new Error(`Missing button: ${text}`);
  return result;
}
async function click(text: string) {
  await act(async () => button(text).click());
}
async function input(label: string, value: string) {
  const node = host.querySelector(
    `input[aria-label="${label}"]`
  ) as HTMLInputElement;
  if (!node) throw new Error(`Missing input: ${label}`);
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )!.set!.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function selectMachine(key = "chest-press") {
  const node = host.querySelector(
    'select[aria-label="已核對的器械類型"]'
  ) as HTMLSelectElement;
  await act(async () => {
    node.value = key;
    node.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function checkConfirmation() {
  await act(async () =>
    (host.querySelector('input[type="checkbox"]') as HTMLInputElement).click()
  );
}
async function searchAndSelect(props: GymDirectoryPanelProps = {}) {
  await render(props);
  await click("搜尋分店");
  await click("選擇分店／保存及查看");
}
async function photo() {
  const node = host.querySelector(
    'input[aria-label="匯入器械證據相片"]'
  ) as HTMLInputElement;
  const file = new File(["photo evidence"], "machine.png", {
    type: "image/png",
  });
  Object.defineProperty(node, "files", { configurable: true, value: [file] });
  await act(async () =>
    node.dispatchEvent(new Event("change", { bubbles: true }))
  );
  return file;
}

describe("GymDirectoryPanel — address discovery is not machine discovery", () => {
  it("defaults to 24/7 Fitness with globally optional city/country and never writes on mount or search", async () => {
    await render();
    expect(
      (
        host.querySelector(
          'input[aria-label="健身室名稱／地址"]'
        ) as HTMLInputElement
      ).value
    ).toBe("24/7 Fitness");
    expect(
      (
        host.querySelector(
          'input[aria-label="國家／地區（選填）"]'
        ) as HTMLInputElement
      ).value
    ).toBe("");
    expect(mocks.searchInputs.mock.lastCall?.[1].enabled).toBe(false);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
    await click("搜尋分店");
    expect(mocks.searchInputs.mock.lastCall?.[0]).toEqual({
      query: "24/7 Fitness",
      limit: 20,
      offset: 0,
    });
    expect(host.textContent).toContain("1 Example Street, London");
    expect(host.textContent).toContain("官方分店目錄");
    expect(host.textContent).toContain("Google Places");
    expect(
      host.querySelector("[data-provider-attribution]")?.textContent
    ).toContain("Google Maps");
    expect(host.textContent).toContain("不是完整全球名錄");
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("passes city and country to server search and permits explicit retry", async () => {
    await render();
    await input("健身室名稱／地址", "Anytime Fitness");
    await input("城市（選填）", "London");
    await input("國家／地區（選填）", "United Kingdom");
    await click("搜尋分店");
    expect(mocks.searchInputs.mock.lastCall?.[0]).toEqual({
      query: "Anytime Fitness London",
      country: "United Kingdom",
      limit: 20,
      offset: 0,
    });
    await click("搜尋分店");
    expect(mocks.refetchSearch).toHaveBeenCalledOnce();
  });
  it("shows provider failure and honest zero results without fabricating equipment", async () => {
    mocks.searchData = {
      results: [],
      total: 0,
      source: "官方及已保存地址搜尋",
      providerStatus: "NOT_CONFIGURED",
      providerWarning: "全球供應商未設定；仍可手動新增。",
      providerHasMore: false,
      attribution: null,
      completeWorldwide: false,
    };
    await render();
    await click("搜尋分店");
    expect(host.textContent).toContain("NOT_CONFIGURED");
    expect(host.textContent).toContain("全球供應商未設定");
    expect(host.textContent).toContain("這不表示當地沒有健身室");
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("shows loading and error retry states", async () => {
    mocks.searchLoading = true;
    await render();
    // Disabled query must not show a fake loading state before explicit search.
    expect(host.textContent).not.toContain("正在查詢分店地址");
    mocks.searchLoading = false;
    mocks.searchError = new Error("搜尋連線失敗");
    await click("搜尋分店");
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "搜尋連線失敗"
    );
    await click("重試搜尋");
    expect(mocks.refetchSearch).toHaveBeenCalledOnce();
  });
  it("saves only the explicitly selected branch, then reads its unknown inventory", async () => {
    const callback = vi.fn();
    await searchAndSelect({ onSelectLocation: callback });
    expect(mocks.save).toHaveBeenCalledOnce();
    expect(mocks.save).toHaveBeenCalledWith({
      name: official.name,
      address: official.address,
      country: official.country,
      brand: official.brand,
      sourceUrl: official.sourceUrl,
    });
    expect(mocks.equipmentInputs.mock.lastCall?.[0]).toEqual({ gymId: 11 });
    expect(host.textContent).toContain("此分店器械未知");
    expect(host.querySelector('[aria-label="此分店可用動作"]')).toBeNull();
    expect(callback).not.toHaveBeenCalled();
    await click("用作新訓練地點");
    expect(callback).toHaveBeenCalledWith(
      `${selected.name} · ${selected.address}`
    );
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("shows selection failure with user-controlled retry, not a hidden retry write", async () => {
    mocks.save.mockRejectedValueOnce(new Error("地址保存失敗"));
    await searchAndSelect();
    expect(host.textContent).toContain("地址保存失敗");
    expect(host.querySelector('[aria-label="所選分店器械"]')).toBeNull();
    expect(mocks.save).toHaveBeenCalledOnce();
    await click("選擇分店／保存及查看");
    expect(mocks.save).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[aria-label="所選分店器械"]')).not.toBeNull();
  });
  it("opens saved branches without saving again and never carries another branch inventory", async () => {
    mocks.saved = [selected, second];
    mocks.inventory[11] = populatedInventory();
    await render();
    await click("選擇已保存分店及查看");
    expect(
      host.querySelector('[aria-label="此分店可用動作"]')?.textContent
    ).toContain("胸推機");
    const savedButtons = [...host.querySelectorAll("button")].filter(node =>
      node.textContent?.includes("選擇已保存分店及查看")
    );
    await act(async () => savedButtons[1].click());
    expect(mocks.equipmentInputs.mock.lastCall?.[0]).toEqual({ gymId: 22 });
    expect(host.querySelector('[aria-label="此分店可用動作"]')).toBeNull();
    expect(host.querySelector('[aria-label="已確認器械"]')).toBeNull();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("supports manual name/address/country entry without adding machines", async () => {
    await render();
    await click("手動新增地址");
    expect(button("保存地址及查看器械").disabled).toBe(true);
    await input("手動分店名稱", "Neighbourhood Gym");
    await input("手動完整地址", "8 Real Address, Toronto");
    await input("手動國家／地區", "Canada");
    await click("保存地址及查看器械");
    expect(mocks.save).toHaveBeenCalledWith({
      name: "Neighbourhood Gym",
      address: "8 Real Address, Toronto",
      country: "Canada",
    });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("requires exact catalogue choice and explicit owner confirmation before saving", async () => {
    await searchAndSelect();
    await click("新增／確認現場器械");
    expect(button("確認並保存器械").disabled).toBe(true);
    await selectMachine("seated-row");
    expect(button("確認並保存器械").disabled).toBe(true);
    await checkConfirmation();
    await click("確認並保存器械");
    expect(mocks.upsert).toHaveBeenCalledWith({
      gymId: 11,
      machineKey: "seated-row",
      displayName: "坐姿划船機",
      equipment: "Machine",
      source: "owner_confirmed",
    });
    expect(mocks.invalidateEquipment).toHaveBeenCalledWith({ gymId: 11 });
  });
  it("requires renewed confirmation if the equipment choice changes", async () => {
    await searchAndSelect();
    await click("新增／確認現場器械");
    await selectMachine();
    await checkConfirmation();
    expect(button("確認並保存器械").disabled).toBe(false);
    await selectMachine("seated-row");
    expect(button("確認並保存器械").disabled).toBe(true);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("renders only server availableExercises and opens exact Gymwork original references", async () => {
    mocks.inventory[11] = populatedInventory();
    const open = vi.fn();
    await searchAndSelect({ onOpenExercise: open });
    const list = host.querySelector('[aria-label="此分店可用動作"]')!;
    expect(list.querySelectorAll("li")).toHaveLength(1);
    expect(list.textContent).toContain("胸肌");
    expect(list.textContent).not.toContain("坐姿划船");
    const link = [...list.querySelectorAll("a")].find(node =>
      node.textContent?.includes("Gymwork 原作頁")
    );
    expect(link?.href).toContain("https://www.gymwork.pro/exercises/");
    expect(link?.target).toBe("_blank");
    await click("查看動作詳情");
    expect(open).toHaveBeenCalledWith({
      name: "Chest Press Machine",
      nameZh: "胸推機",
      muscleGroup: "chest",
      equipment: "Machine",
    });
    expect(host.querySelector("iframe")).toBeNull();
  });
  it("deletes only after explicit confirmation and invalidates that branch", async () => {
    mocks.inventory[11] = populatedInventory();
    await searchAndSelect();
    await act(async () =>
      (
        host.querySelector(
          'button[aria-label="移除 胸推機"]'
        ) as HTMLButtonElement
      ).click()
    );
    expect(mocks.remove).not.toHaveBeenCalled();
    await click("確認移除器械");
    expect(mocks.remove).toHaveBeenCalledWith({ id: 91 });
    expect(mocks.invalidateEquipment).toHaveBeenCalledWith({ gymId: 11 });
  });
  it("prepares photos through the existing helper and never autosaves or auto-confirms AI proposals", async () => {
    await searchAndSelect();
    await click("新增／確認現場器械");
    const file = await photo();
    expect(mocks.prepare).toHaveBeenCalledWith(file);
    expect(mocks.identify).toHaveBeenCalledWith({
      base64: "/9j/bounded",
      mimeType: "image/jpeg",
    });
    expect(host.textContent).toContain("AI 建議（未確認）");
    expect(host.textContent).toContain("信心：低");
    expect((host.querySelector("select") as HTMLSelectElement).value).toBe("");
    expect(
      (host.querySelector('input[type="checkbox"]') as HTMLInputElement).checked
    ).toBe(false);
    expect(mocks.upsert).not.toHaveBeenCalled();
    await click("捨棄 AI 建議");
    expect(host.textContent).not.toContain("AI 建議（未確認）");
  });
  it("rejects photo requests at or above 3 MB before calling AI", async () => {
    mocks.prepare.mockResolvedValueOnce({
      base64: "A".repeat(3_000_000),
      mimeType: "image/jpeg",
      fileName: "too-large.jpg",
    });
    await searchAndSelect();
    await click("新增／確認現場器械");
    await photo();
    expect(host.textContent).toContain("小於 3 MB");
    expect(mocks.identify).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("can retry a prepared photo after an AI failure without persisting equipment", async () => {
    mocks.identify.mockRejectedValueOnce(new Error("AI 暫時未能回應"));
    await searchAndSelect();
    await click("新增／確認現場器械");
    await photo();
    expect(host.textContent).toContain("AI 暫時未能回應");
    await click("重試相片辨識");
    expect(mocks.prepare).toHaveBeenCalledOnce();
    expect(mocks.identify).toHaveBeenCalledTimes(2);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("renders inventory/catalog failures with retry rather than invented machines", async () => {
    mocks.inventoryError = new Error("器械讀取失敗");
    mocks.catalogError = new Error("器械目錄讀取失敗");
    await searchAndSelect();
    expect(host.textContent).toContain("器械讀取失敗");
    await click("重試器械清單");
    expect(mocks.refetchEquipment).toHaveBeenCalledOnce();
    await click("新增／確認現場器械");
    expect(host.textContent).toContain("器械目錄讀取失敗");
    await click("重試器械目錄");
    expect(mocks.refetchCatalog).toHaveBeenCalledOnce();
    expect(button("確認並保存器械").disabled).toBe(true);
  });
  it("shows failed explicit equipment save and allows review/retry without automatic writes", async () => {
    mocks.upsert.mockRejectedValueOnce(new Error("器械保存失敗"));
    await searchAndSelect();
    await click("新增／確認現場器械");
    await selectMachine();
    await checkConfirmation();
    await click("確認並保存器械");
    expect(host.textContent).toContain("器械保存失敗");
    expect(mocks.upsert).toHaveBeenCalledOnce();
    await click("確認並保存器械");
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
  });
  it("hides writes in readonly mode but still permits choosing saved branches", async () => {
    mocks.owner = false;
    mocks.saved = [selected];
    await render();
    expect(host.textContent).not.toContain("手動新增地址");
    await click("選擇已保存分店及查看");
    expect(host.textContent).toContain("唯讀模式");
    expect(host.textContent).not.toContain("新增／確認現場器械");
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("separates branch-specific official raw machines from owner records and recommends only server-mapped entries", async () => {
    const result = populatedInventory();
    result.officialInventory = {
      sourceUrl: "https://www.247.fitness/branches/branch-a",
      checkedAt: timestamp,
      status: "verified",
      gymReferenceId: "branch-a",
    };
    result.officialEquipment = [
      {
        id: "published-chest",
        name: "Chest Press Machine",
        manufacturer: "Official Manufacturer",
        model: "Model 123",
        category: "Strength",
        total: 2,
        normal: 1,
        damaged: 1,
        sourceUrl: result.officialInventory.sourceUrl,
      },
      {
        id: "unknown-model",
        name: "Official Special Machine X",
        manufacturer: null,
        model: null,
        category: null,
        total: null,
        normal: null,
        damaged: null,
        sourceUrl: result.officialInventory.sourceUrl,
      },
    ];
    result.equipment = [];
    result.availableExercises[0] = {
      ...result.availableExercises[0],
      equipmentId: "official:branch-a:published-chest",
      confirmationSource: "official_inventory",
    };
    result.coverage = {
      ...result.coverage,
      status: "official_snapshot",
      officialEquipmentCount: 2,
      confirmedEquipmentCount: 0,
    };
    mocks.inventory[11] = result;
    await searchAndSelect();
    const officialList = host.querySelector('[aria-label="官方已公開器械"]')!;
    expect(officialList.querySelectorAll("li")).toHaveLength(2);
    expect(officialList.textContent).toContain("Official Special Machine X");
    expect(officialList.textContent).toContain("製造商：官方未提供");
    expect(officialList.textContent).toContain("型號：官方未提供");
    expect(officialList.textContent).toContain("數量：官方未提供");
    expect(officialList.textContent).toContain("製造商：Official Manufacturer");
    expect(officialList.textContent).toContain("型號：Model 123");
    expect(officialList.textContent).toContain("數量：2");
    expect(officialList.textContent).toContain("1／1（非即時）");
    expect(officialList.querySelectorAll("li")[0].textContent).not.toContain(
      "尚無精確動作對應"
    );
    expect(officialList.querySelectorAll("li")[1].textContent).toContain(
      "尚無精確動作對應"
    );
    expect(officialList.querySelector("button")).toBeNull();
    const officialSource = host.querySelector(
      '[aria-label="官方分店器械"] a'
    ) as HTMLAnchorElement;
    expect(officialSource.href).toBe(result.officialInventory.sourceUrl);
    expect(
      host.querySelector('[aria-label="此分店可用動作"]')?.textContent
    ).toContain("此分店官方公開快照");
    expect(
      host.querySelector('[aria-label="此分店可用動作"]')?.textContent
    ).not.toContain("Official Special Machine X");
    expect(host.querySelector('[aria-label="已確認器械"]')).toBeNull();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("does not carry an official snapshot to another branch with unknown official inventory", async () => {
    mocks.saved = [selected, second];
    mocks.inventory[11] = {
      ...emptyInventory(selected),
      officialEquipment: [
        {
          id: "branch-a-only",
          name: "Branch A Published Machine",
          manufacturer: null,
          model: null,
          category: null,
          total: null,
          normal: null,
          damaged: null,
          sourceUrl: "https://www.247.fitness/branches/branch-a",
        },
      ],
      officialInventory: {
        sourceUrl: "https://www.247.fitness/branches/branch-a",
        checkedAt: timestamp,
        status: "verified",
        gymReferenceId: "branch-a",
      },
    };
    await render();
    await click("選擇已保存分店及查看");
    expect(
      host.querySelector('[aria-label="官方已公開器械"]')?.textContent
    ).toContain("Branch A Published Machine");
    const choices = [...host.querySelectorAll("button")].filter(node =>
      node.textContent?.includes("選擇已保存分店及查看")
    );
    await act(async () => choices[1].click());
    expect(host.querySelector('[aria-label="官方已公開器械"]')).toBeNull();
    expect(
      host.querySelector('[aria-label="官方分店器械"]')?.textContent
    ).toContain("官方設備資料未知");
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("paginates large official address result sets without writing data", async () => {
    mocks.searchData = { ...mocks.searchData!, total: 325 };
    await render();
    await click("搜尋分店");
    await click("下一頁地址");
    expect(mocks.searchInputs.mock.lastCall?.[0]).toEqual({
      query: "24/7 Fitness",
      limit: 20,
      offset: 20,
    });
    await click("上一頁地址");
    expect(mocks.searchInputs.mock.lastCall?.[0].offset).toBe(0);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("retains responsive 44px controls and excludes front-end Maps SDK, video/procedural substitutes, and session mutations", () => {
    const source = readFileSync(
      `${process.cwd()}/client/src/components/GymDirectoryPanel.tsx`,
      "utf8"
    );
    expect(source).toContain("min-height:44px");
    expect(source).toContain("grid-cols-1");
    expect(source).toContain("min-w-0");
    expect(source).toContain("overflow-wrap:anywhere");
    expect(source).not.toMatch(
      /google\.maps|useGoogleMaps|<iframe|<video|youtube\.com|createSession|updateSession|addSet/
    );
    expect(source).toContain("availableExercises");
    expect(source).toContain('source: "owner_confirmed"');
  });
});
