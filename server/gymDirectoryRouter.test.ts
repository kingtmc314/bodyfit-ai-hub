import { beforeEach, describe, expect, it, vi } from "vitest";
import { gymRouter } from "./gymDirectoryRouter";
import {
  searchGyms,
  getSavedGyms,
  getGymEquipment,
  saveGymLocation,
  upsertGymEquipment,
  deleteGymEquipment,
  getGymMachineCatalog,
} from "./gymDirectory";
import type { TrpcContext } from "./_core/context";
vi.mock("./gymDirectory", async importOriginal => {
  const real = await importOriginal<typeof import("./gymDirectory")>();
  return {
    ...real,
    searchGyms: vi.fn(),
    getSavedGyms: vi.fn(),
    getGymEquipment: vi.fn(),
    saveGymLocation: vi.fn(),
    upsertGymEquipment: vi.fn(),
    deleteGymEquipment: vi.fn(),
    getGymMachineCatalog: vi.fn(),
  };
});
const context: TrpcContext = {
  user: null,
  req: { protocol: "https", headers: {} } as any,
  res: {} as any,
};
const caller = gymRouter.createCaller(context);
beforeEach(() => vi.clearAllMocks());
describe("gym personal owner router API", () => {
  it("exposes the contract publicly but never accepts client owner scopes", async () => {
    vi.mocked(searchGyms).mockResolvedValue({
      results: [],
      total: 0,
      source: "官方及已保存地址搜尋",
      providerStatus: "NOT_REQUESTED",
      providerHasMore: false,
      attribution: null,
      completeWorldwide: false,
    });
    expect((await caller.search({ query: "" })).completeWorldwide).toBe(false);
    expect(searchGyms).toHaveBeenCalledWith({
      query: "",
      limit: 20,
      offset: 0,
    });
    await expect(
      caller.search({ query: "gym", userId: 100 } as any)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.saveLocation({ name: "Gym", address: "Road", userId: 100 } as any)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("passes bounded global page token input through with stable defaults", async () => {
    await caller.search({
      query: "24/7 Fitness",
      country: "Hong Kong",
      limit: 50,
      offset: 20,
      pageToken: "TOKEN_ABC",
    });
    expect(searchGyms).toHaveBeenCalledWith({
      query: "24/7 Fitness",
      country: "Hong Kong",
      limit: 50,
      offset: 20,
      pageToken: "TOKEN_ABC",
    });
    for (const bad of [
      { limit: 51 },
      { offset: -1 },
      { pageToken: "x&key=bad" },
    ])
      await expect(
        caller.search({ query: "gym", ...bad })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("saved and catalog reads are independent of auth context and preserve results", async () => {
    vi.mocked(getSavedGyms).mockResolvedValue([]);
    vi.mocked(getGymMachineCatalog).mockReturnValue([]);
    expect(await caller.getSaved()).toEqual([]);
    expect(await caller.getMachineCatalog()).toEqual([]);
    expect(getSavedGyms).toHaveBeenCalledWith();
    expect(getGymMachineCatalog).toHaveBeenCalledWith();
  });
  it("accepts official/saved gym IDs but rejects malformed/unsafe IDs", async () => {
    await caller.getEquipment({ gymId: 7 });
    expect(getGymEquipment).toHaveBeenLastCalledWith(7);
    await caller.getEquipment({ gymId: "official:hk-central" });
    expect(getGymEquipment).toHaveBeenLastCalledWith("official:hk-central");
    await caller.getEquipment({ gymId: "google:place_abc" });
    expect(getGymEquipment).toHaveBeenLastCalledWith("google:place_abc");
    for (const gymId of [-1, 0, 1.5, "7", "official:../../x"])
      await expect(caller.getEquipment({ gymId })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
  });
  it("location save validates sources and coordinate pairs before service writes", async () => {
    await caller.saveLocation({
      name: " Gym ",
      address: " Public Road ",
      sourceUrl: "https://www.247.fitness/locations",
      latitude: 22.3,
      longitude: 114.1,
    });
    expect(saveGymLocation).toHaveBeenCalledWith({
      name: "Gym",
      address: "Public Road",
      sourceUrl: "https://www.247.fitness/locations",
      latitude: 22.3,
      longitude: 114.1,
    });
    const calls = vi.mocked(saveGymLocation).mock.calls.length;
    for (const values of [
      { sourceUrl: "javascript:alert(1)" },
      { latitude: 22.3 },
      { latitude: 91, longitude: 114.1 },
    ])
      await expect(
        caller.saveLocation({ name: "Gym", address: "Road", ...values })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(saveGymLocation).toHaveBeenCalledTimes(calls);
  });
  it("equipment requires explicit confirmation and a saved gym numeric ID", async () => {
    const values = {
      gymId: 7,
      machineKey: "chest-press",
      displayName: "Chest Press",
      equipment: "Machine" as const,
      source: "owner_confirmed" as const,
    };
    await caller.upsertEquipment(values);
    expect(upsertGymEquipment).toHaveBeenCalledWith(values);
    for (const bad of [
      { source: "official_seed" },
      { source: "brand_inferred" },
      { gymId: "official:hk" },
      { userId: 3 },
      { machineKey: "../bad" },
    ])
      await expect(
        caller.upsertEquipment({ ...values, ...bad } as any)
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(upsertGymEquipment).toHaveBeenCalledTimes(1);
  });
  it("single record deletion validates positive IDs and returns service result", async () => {
    vi.mocked(deleteGymEquipment).mockResolvedValue({ success: true });
    expect(await caller.deleteEquipment({ id: 6 })).toEqual({ success: true });
    expect(deleteGymEquipment).toHaveBeenCalledWith(6);
    await expect(caller.deleteEquipment({ id: -1 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      caller.deleteEquipment({ id: 6, gymId: 8 } as any)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
