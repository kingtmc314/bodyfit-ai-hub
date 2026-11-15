import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { getDb } from "./db";
import { makeRequest } from "./_core/map";
import { GYM_OFFICIAL_SEEDS } from "../shared/gymOfficialSeeds";
import { GYM_OFFICIAL_INVENTORY } from "../shared/gymOfficialInventory";
import {
  gymSearchSchema,
  gymSaveLocationSchema,
  gymUpsertEquipmentSchema,
  gymIdSchema,
  gymIdentityKey,
  escapeGymLike,
  isSafeGymSourceUrl,
  searchGyms,
  searchGymProvider,
  getSavedGyms,
  getGymEquipment,
  getGymMachineCatalog,
  feasibleGymExercises,
  saveGymLocation,
  upsertGymEquipment,
  deleteGymEquipment,
} from "./gymDirectory";
import type { GymEquipmentRecord } from "../shared/gymDirectory";
vi.mock("./db", () => ({ getDb: vi.fn() }));
vi.mock("./_core/map", () => ({ makeRequest: vi.fn() }));
vi.mock("../shared/gymOfficialSeeds", () => ({ GYM_OFFICIAL_SEEDS: [] }));
vi.mock("../shared/gymOfficialInventory", () => ({
  GYM_OFFICIAL_INVENTORY: [],
}));
const dialect = new PgDialect();
const now = new Date("2026-11-14T23:00:00Z");
const seed = (i = 1) => ({
  id: `hk-${i}`,
  name: `24/7 Fitness ${String(i).padStart(3, "0")}`,
  address: `${i} Hong Kong Road`,
  country: "Hong Kong",
  brand: "24/7 Fitness",
  sourceUrl: "https://www.247.fitness/locations",
  sourceCheckedAt: now.toISOString(),
});
const location = (
  id = 1,
  userId = 2,
  overrides: Record<string, unknown> = {}
) => ({
  id,
  userId,
  name: "Saved Gym",
  address: "1 Public Road",
  country: "Hong Kong",
  brand: null,
  source: "owner_saved",
  sourceUrl: null,
  placeId: null,
  identityKey: gymIdentityKey("Saved Gym", "1 Public Road"),
  latitude: null,
  longitude: null,
  sourceCheckedAt: null,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});
const machine = (
  overrides: Partial<GymEquipmentRecord> = {}
): GymEquipmentRecord => ({
  id: 1,
  gymId: 1,
  machineKey: "chest-press",
  displayName: "Chest Press Machine",
  equipment: "Machine",
  source: "owner_confirmed",
  notes: null,
  sourceUrl: null,
  confirmedAt: now.toISOString(),
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  ...overrides,
});
interface Read {
  table: string;
  fields: string[];
  sql: string;
  params: unknown[];
  limit: number;
  offset: number;
  ordered: boolean;
}
function fakeDb(tables: Record<string, any[]> = {}, insertRows: any[][] = []) {
  const reads: Read[] = [];
  const writes: any[] = [];
  const db: any = {
    select: vi.fn((fields: any) => {
      const read: Read = {
        table: "",
        fields: Object.keys(fields),
        sql: "",
        params: [],
        limit: 0,
        offset: 0,
        ordered: false,
      };
      const chain: any = {
        from: (table: any) => {
          read.table = getTableName(table);
          return chain;
        },
        where: (where: any) => {
          const q = dialect.sqlToQuery(where);
          read.sql = q.sql;
          read.params = q.params;
          return chain;
        },
        orderBy: () => {
          read.ordered = true;
          return chain;
        },
        limit: (n: number) => {
          read.limit = n;
          return chain;
        },
        offset: (n: number) => {
          read.offset = n;
          return chain;
        },
        then: (resolve: any, reject: any) => {
          reads.push(read);
          return Promise.resolve(
            (tables[read.table] ?? []).slice(
              read.offset,
              read.offset + read.limit
            )
          ).then(resolve, reject);
        },
      };
      return chain;
    }),
    insert: vi.fn((table: any) => {
      const record: any = { table: getTableName(table) };
      writes.push(record);
      const chain: any = {
        values: (values: any) => {
          record.values = values;
          return chain;
        },
        onConflictDoNothing: () => {
          record.ignoreConflict = true;
          return chain;
        },
        onConflictDoUpdate: (conflict: any) => {
          record.conflict = conflict;
          return chain;
        },
        returning: () => Promise.resolve(insertRows.shift() ?? []),
      };
      return chain;
    }),
    update: vi.fn(() => {
      throw new Error("unexpected update");
    }),
    delete: vi.fn((table: any) => {
      const record: any = { table: getTableName(table) };
      writes.push(record);
      return {
        where: (where: any) => {
          record.where = dialect.sqlToQuery(where);
          return { returning: () => Promise.resolve(insertRows.shift() ?? []) };
        },
      };
    }),
  };
  vi.mocked(getDb).mockResolvedValue(db);
  return { db, reads, writes, tables };
}
const input = (query = "Fitness", more = {}) =>
  gymSearchSchema.parse({ query, ...more });
beforeEach(() => {
  vi.clearAllMocks();
  (GYM_OFFICIAL_SEEDS as any[]).splice(0);
  (GYM_OFFICIAL_INVENTORY as any[]).splice(0);
  vi.mocked(getDb).mockResolvedValue(null);
  vi.mocked(makeRequest).mockResolvedValue({
    status: "ZERO_RESULTS",
    results: [],
  });
});
afterEach(() => vi.useRealTimers());

describe("gym validation and stable identity", () => {
  it("rejects unsafe IDs, injected user scopes, wild limits, invalid coordinates and sources", () => {
    for (const id of [
      0,
      -1,
      1.5,
      2147483648,
      "1",
      "google:../secret",
      "official:x/y",
    ])
      expect(gymIdSchema.safeParse(id).success).toBe(false);
    for (const values of [
      { limit: 51 },
      { limit: 0 },
      { offset: -1 },
      { offset: 1.5 },
      { userId: 3 },
      { pageToken: "a&key=secret" },
    ])
      expect(
        gymSearchSchema.safeParse({ query: "gym", ...values }).success
      ).toBe(false);
    for (const values of [
      { latitude: 91, longitude: 0 },
      { latitude: 0 },
      { latitude: NaN, longitude: 0 },
      { longitude: Infinity, latitude: 0 },
    ])
      expect(
        gymSaveLocationSchema.safeParse({
          name: "Gym",
          address: "Road",
          ...values,
        }).success
      ).toBe(false);
    expect(
      gymUpsertEquipmentSchema.safeParse({
        gymId: 1,
        machineKey: "chest-press",
        displayName: "Gym",
        equipment: "Machine",
        source: "brand_inferred",
      }).success
    ).toBe(false);
    expect(
      gymUpsertEquipmentSchema.safeParse({
        gymId: 1,
        machineKey: "../bad",
        displayName: "Gym",
        equipment: "Machine",
        source: "owner_confirmed",
      }).success
    ).toBe(false);
  });
  it("accepts only public HTTPS source URLs with no credential/key parameters", () => {
    for (const url of [
      "javascript:alert(1)",
      "http://gym.com",
      "https://localhost/a",
      "https://127.0.0.1/a",
      "https://[::1]/",
      "https://internal.local/a",
      "https://user:pass@gym.com/",
      "https://gym.com:8443/a",
      "https://gym.com/?key=secret",
      "https://gym.com/?access_token=secret",
    ])
      expect(isSafeGymSourceUrl(url)).toBe(false);
    expect(isSafeGymSourceUrl("https://www.247.fitness/locations")).toBe(true);
    expect(
      isSafeGymSourceUrl(
        "https://www.gymwork.pro/exercises/chest-press-machine?lang=en&id=758"
      )
    ).toBe(true);
  });
  it("normalizes Unicode/whitespace and escapes SQL wildcard literals", () => {
    expect(gymIdentityKey("  ＧＹＭ  One ", " PUBLIC  Road ")).toBe(
      gymIdentityKey("gym one", "public road")
    );
    expect(escapeGymLike("50%_\\")).toBe("50\\%\\_\\\\");
  });
});
describe("read-only address directory and honest provider coverage", () => {
  it("returns all indexed official seeds with stable bounded pagination during outage", async () => {
    (GYM_OFFICIAL_SEEDS as any[]).push(
      ...Array.from({ length: 123 }, (_, i) => seed(i + 1))
    );
    const { db } = fakeDb();
    vi.mocked(makeRequest).mockResolvedValue({ status: "REQUEST_DENIED" });
    const result = await searchGyms(input("24/7", { limit: 50, offset: 50 }));
    expect(result.total).toBe(123);
    expect(result.results).toHaveLength(50);
    expect(result.results[0].name).toContain("051");
    expect(result.source).toBe("官方及已保存地址搜尋");
    expect(result.providerStatus).toBe("REQUEST_DENIED");
    expect(result.providerWarning).toContain("手動新增");
    expect(result.completeWorldwide).toBe(false);
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });
  it("parameterizes ILIKE, scopes owner, projects explicit fields and paginates all local rows", async () => {
    const { reads } = fakeDb({
      gym_locations: Array.from({ length: 121 }, (_, i) => location(i + 1)),
    });
    const result = await searchGyms(
      input("%_", { country: "Hong Kong", limit: 5 })
    );
    expect(result.results.length).toBeLessThanOrEqual(5);
    expect(reads.map(r => r.offset)).toEqual([0, 50, 100]);
    for (const read of reads) {
      expect(read.table).toBe("gym_locations");
      expect(read.sql).toContain('"user_id" =');
      expect(read.params).toContain(2);
      expect(read.sql).toContain("ILIKE");
      expect(read.sql).not.toContain("%_");
      expect(read.params).toContain("%\\%\\_%");
      expect(read.fields).toContain("sourceUrl");
      expect(read.limit).toBe(50);
      expect(read.ordered).toBe(true);
    }
  });
  it("prioritizes 24/7 and dedupes provider and official against saved records", async () => {
    (GYM_OFFICIAL_SEEDS as any[]).push(seed());
    fakeDb({
      gym_locations: [
        location(1, 2, { name: seed().name, address: seed().address }),
        location(2, 2, { name: "A Gym", address: "Other Road" }),
      ],
    });
    const result = await searchGyms(input("Gym"));
    expect(result.results[0].savedId).toBe(1);
    expect(result.total).toBe(2);
  });
  it("keeps Google rows ephemeral and attributed, retains provider statuses and next-page token", async () => {
    const { db } = fakeDb();
    vi.mocked(makeRequest).mockResolvedValue({
      status: "OK",
      next_page_token: "TOKEN_123",
      results: Array.from({ length: 30 }, (_, i) => ({
        place_id: `place_${i}`,
        name: `Gym ${i}`,
        formatted_address: `${i} Public Road`,
        geometry: { location: { lat: 22.3, lng: 114.1 } },
        types: ["gym"],
      })),
    });
    const result = await searchGyms(
      input("gym", { limit: 5, pageToken: "previous_token" })
    );
    expect(result.results).toHaveLength(5);
    expect(result.total).toBe(20);
    expect(result.results[0].savedId).toBeNull();
    expect(result.attribution).toBe("Google Maps");
    expect(result.nextPageToken).toBe("TOKEN_123");
    expect(result.providerHasMore).toBe(true);
    expect(result.completeWorldwide).toBe(false);
    expect(makeRequest).toHaveBeenCalledWith(
      "/maps/api/place/textsearch/json",
      {
        query: "gym",
        type: "gym",
        language: "zh-TW",
        pagetoken: "previous_token",
      }
    );
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });
  it("does not silently label invalid provider statuses as zero-results and sanitizes credentials", async () => {
    vi.mocked(makeRequest).mockRejectedValue(
      new Error(
        "Google Maps API request failed (403 Forbidden): https://proxy/?key=SECRET_SECRET"
      )
    );
    const result = await searchGymProvider(input());
    expect(result.status).toBe("HTTP_403");
    expect(JSON.stringify(result)).not.toContain("SECRET_SECRET");
    expect(JSON.stringify(result)).not.toContain("proxy");
    vi.mocked(makeRequest).mockResolvedValue({ status: "INVALID_REQUEST" });
    expect((await searchGymProvider(input())).status).toBe("INVALID_REQUEST");
  });
  it("bounds provider deadline and clears timers; blank query performs no provider call", async () => {
    vi.useFakeTimers();
    vi.mocked(makeRequest).mockReturnValue(new Promise(() => {}));
    const resultPromise = searchGymProvider(input());
    await vi.advanceTimersByTimeAsync(4501);
    expect((await resultPromise).status).toBe("TIMEOUT");
    expect(vi.getTimerCount()).toBe(0);
    vi.mocked(makeRequest).mockClear();
    await searchGyms(input(""));
    expect(makeRequest).not.toHaveBeenCalled();
  });
  it("filters invalid provider coordinates and non-gym/permanently closed businesses", async () => {
    vi.mocked(makeRequest).mockResolvedValue({
      status: "OK",
      results: [
        {
          place_id: "bad",
          name: "Gym",
          formatted_address: "Road",
          geometry: { location: { lat: 95, lng: 0 } },
        },
        {
          place_id: "closed",
          name: "Gym",
          formatted_address: "Road",
          business_status: "CLOSED_PERMANENTLY",
        },
        {
          place_id: "shop",
          name: "Gym",
          formatted_address: "Road",
          types: ["store"],
        },
      ],
    });
    expect((await searchGymProvider(input())).results).toEqual([]);
  });
});
describe("branch equipment is explicit, owner-scoped and exact", () => {
  it("keeps zero/unavailable raw inventory visible but only maps positive or cautioned unknown quantities", async () => {
    (GYM_OFFICIAL_SEEDS as any[]).push(seed());
    const base = {
      manufacturer: null,
      model: null,
      category: "Chest",
      total: 1,
      normal: 1,
      damaged: 0,
      sourceUrl: "https://www.247.fitness/store/1",
    };
    (GYM_OFFICIAL_INVENTORY as any[]).push({
      gymReferenceId: "hk-1",
      branchName: seed().name,
      country: "Hong Kong",
      sourceUrl: base.sourceUrl,
      checkedAt: now.toISOString(),
      status: "verified",
      machines: [
        { ...base, id: "broken", name: "Chest Press Machine", normal: 0 },
        { ...base, id: "absent", name: "Leg Press", total: 0 },
        {
          ...base,
          id: "unknown",
          name: "  CHEST  PRESS MACHINE  ",
          total: null,
          normal: null,
        },
        { ...base, id: "variant", name: "Iso-Lateral Horizontal Bench Press" },
      ],
    });
    const result = await getGymEquipment("official:hk-1");
    expect(result.officialEquipment).toHaveLength(4);
    expect(result.availableExercises).toHaveLength(1);
    expect(result.availableExercises[0].equipmentId).toBe(
      "official:hk-1:unknown"
    );
    expect(result.availableExercises[0].availabilityCaution).toContain(
      "未提供可用數量"
    );
    expect(result.availableExercises[0].aliases).not.toContain("Bench Press");
  });
  it("returns dated official snapshot separately, with only exact mapped actions and no DB writes", async () => {
    (GYM_OFFICIAL_SEEDS as any[]).push(seed());
    (GYM_OFFICIAL_INVENTORY as any[]).push({
      gymReferenceId: "hk-1",
      branchName: seed().name,
      country: "Hong Kong",
      status: "verified",
      sourceUrl: "https://www.247.fitness/store/1",
      checkedAt: now.toISOString(),
      machines: [
        {
          id: "press",
          name: "Chest Press Machine",
          manufacturer: null,
          model: null,
          category: null,
          total: 1,
          normal: 1,
          damaged: 0,
          sourceUrl: "https://www.247.fitness/store/1",
        },
        {
          id: "unknown",
          name: "Unrecognized official machine",
          manufacturer: null,
          model: null,
          category: null,
          total: 1,
          normal: 1,
          damaged: 0,
          sourceUrl: "https://www.247.fitness/store/1",
        },
        {
          id: "wrong",
          name: "Generic Press",
          manufacturer: null,
          model: null,
          category: null,
          total: 1,
          normal: 1,
          damaged: 0,
          sourceUrl: "https://www.247.fitness/store/1",
        },
      ],
    });
    const { db } = fakeDb();
    const result = await getGymEquipment("official:hk-1");
    expect(result.equipment).toEqual([]);
    expect(result.officialEquipment).toHaveLength(3);
    expect(result.availableExercises).toHaveLength(1);
    expect(result.availableExercises[0]).toMatchObject({
      confirmationSource: "official_inventory",
      equipmentId: "official:hk-1:press",
      primary: ["chest"],
    });
    expect(result.officialInventory?.checkedAt).toBe(now.toISOString());
    expect(result.coverage.status).toBe("official_snapshot");
    expect(result.coverage.completeInventory).toBe(false);
    expect(db.select).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });
  it("matches saved gym exact name/address, gives owner confirmations precedence, never shares a generic source URL", async () => {
    (GYM_OFFICIAL_SEEDS as any[]).push(seed(1), seed(2));
    (GYM_OFFICIAL_INVENTORY as any[]).push({
      gymReferenceId: "hk-1",
      branchName: seed().name,
      country: "Hong Kong",
      status: "verified",
      sourceUrl: "https://www.247.fitness/store/1",
      checkedAt: now.toISOString(),
      machines: [
        {
          id: "press",
          name: "Chest Press Machine",
          manufacturer: null,
          model: null,
          category: null,
          total: 1,
          normal: 1,
          damaged: 0,
          sourceUrl: "https://www.247.fitness/store/1",
        },
      ],
    });
    fakeDb({
      gym_locations: [
        location(1, 2, { name: seed().name, address: seed().address }),
      ],
      gym_equipment: [{ ...machine(), userId: 2 }],
    });
    const result = await getGymEquipment(1);
    expect(result.officialEquipment).toHaveLength(1);
    expect(result.availableExercises).toHaveLength(1);
    expect(result.availableExercises[0].confirmationSource).toBe(
      "owner_confirmed"
    );
    fakeDb({
      gym_locations: [location(1, 2, { sourceUrl: seed().sourceUrl })],
    });
    expect((await getGymEquipment(1)).officialEquipment).toEqual([]);
    expect((await getGymEquipment("official:hk-2")).officialEquipment).toEqual(
      []
    );
  });
  it("rejects unsafe or undated official snapshots, preserving unknown inventory", async () => {
    (GYM_OFFICIAL_SEEDS as any[]).push(seed());
    (GYM_OFFICIAL_INVENTORY as any[]).push({
      gymReferenceId: "hk-1",
      branchName: seed().name,
      country: "Hong Kong",
      status: "verified",
      sourceUrl: "http://localhost/private",
      checkedAt: "invalid",
      machines: [
        {
          id: "press",
          name: "Chest Press Machine",
          manufacturer: null,
          model: null,
          category: null,
          total: 1,
          normal: 1,
          damaged: 0,
          sourceUrl: "https://www.247.fitness/store/1",
        },
      ],
    });
    const result = await getGymEquipment("official:hk-1");
    expect(result.officialInventory).toBeNull();
    expect(result.availableExercises).toEqual([]);
    expect(result.coverage.status).toBe("unknown");
  });
  it("returns unknown empty inventory for unsaved official gym, never brand-wide recommendations", async () => {
    (GYM_OFFICIAL_SEEDS as any[]).push(seed());
    const { db } = fakeDb();
    const result = await getGymEquipment("official:hk-1");
    expect(result.equipment).toEqual([]);
    expect(result.availableExercises).toEqual([]);
    expect(result.coverage.status).toBe("unknown");
    expect(result.coverage.completeInventory).toBe(false);
    expect(db.select).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    await expect(getGymEquipment("google:unknown_place")).rejects.toMatchObject(
      { code: "NOT_FOUND" }
    );
  });
  it("rejects a foreign gym before any equipment write; reads use composite owner boundary", async () => {
    const { db, reads } = fakeDb({ gym_locations: [location(9, 3)] });
    await expect(getGymEquipment(9)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      upsertGymEquipment({
        gymId: 9,
        machineKey: "chest-press",
        displayName: "Chest",
        equipment: "Machine",
        source: "owner_confirmed",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.insert).not.toHaveBeenCalled();
    expect(reads.every(r => r.params.includes(2))).toBe(true);
  });
  it("never expands machine-equipment suggestions or silently substitutes variants", () => {
    const result = feasibleGymExercises([
      machine(),
      machine({ id: 2, machineKey: "leg-curl" }),
      machine({ id: 3, machineKey: "unmapped-safe-machine" }),
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].primary).toEqual(["chest"]);
    expect(result[0].primaryLabels).toEqual(["胸肌"]);
    expect(result[0].aliases).not.toContain("Incline Chest Press");
    expect(result[0].aliases).not.toContain("Bench Press");
    expect(result[1].aliases).not.toContain("Lying Leg Curl");
    expect(result[1].aliases).not.toContain("Leg Curl");
    expect(
      feasibleGymExercises([
        machine({ equipment: "Dumbbell" }),
        machine({ source: "brand_inferred" as any }),
      ])
    ).toEqual([]);
    expect(
      getGymMachineCatalog().find(r => r.machineKey === "gymwork-802")?.aliases
    ).toContain("Lying Leg Curl");
  });
  it("only reads confirmed records from this branch and reports unmapped coverage honestly", async () => {
    fakeDb({
      gym_locations: [location()],
      gym_equipment: [
        { ...machine(), userId: 2 },
        { ...machine({ id: 2, machineKey: "unknown-machine" }), userId: 2 },
        { ...machine({ id: 3 }), userId: 3 },
        { ...machine({ id: 4, gymId: 2 }), userId: 2 },
        { ...machine({ id: 5, source: "brand_inferred" as any }), userId: 2 },
      ],
    });
    const result = await getGymEquipment(1);
    expect(result.equipment).toHaveLength(2);
    expect(result.availableExercises).toHaveLength(1);
    expect(result.coverage).toMatchObject({
      status: "partially_confirmed",
      confirmedEquipmentCount: 2,
      mappedEquipmentCount: 1,
      unmappedMachineKeys: ["unknown-machine"],
      completeInventory: false,
    });
  });
  it("save is idempotent by owner provider key or normalized name/address", async () => {
    const { db, reads } = fakeDb({
      gym_locations: [location(8, 2, { placeId: "google_id" })],
    });
    expect(
      (
        await saveGymLocation({
          name: "Different Label",
          address: "Different Road",
          placeId: "google_id",
        })
      ).id
    ).toBe(8);
    expect(db.insert).not.toHaveBeenCalled();
    expect(reads[0].params).toContain("google_id");
    expect(reads[0].params).toContain(2);
  });
  it("explicit save writes only directory rows, protects owner scope and concurrent duplicates", async () => {
    const row = location(5);
    const { writes } = fakeDb({}, [[row]]);
    const result = await saveGymLocation({
      name: "Gym",
      address: "Public Road",
    });
    expect(result.id).toBe(5);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      table: "gym_locations",
      ignoreConflict: true,
    });
    expect(writes[0].values).toMatchObject({
      userId: 2,
      source: "owner_saved",
    });
    const concurrent = fakeDb({}, [[]]);
    let calls = 0;
    concurrent.db.select.mockImplementation(() => {
      const chain: any = {
        from: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        then: (resolve: any) =>
          Promise.resolve(++calls === 1 ? [] : [row]).then(resolve),
      };
      return chain;
    });
    expect(
      (await saveGymLocation({ name: "Gym", address: "Public Road" })).id
    ).toBe(5);
  });
  it("upserts one explicit owner record and rejects incompatible exact equipment categories", async () => {
    const record = { ...machine(), userId: 2 };
    const { writes, db } = fakeDb({ gym_locations: [location()] }, [[record]]);
    await expect(
      upsertGymEquipment({
        gymId: 1,
        machineKey: "chest-press",
        displayName: "Chest",
        equipment: "Barbell",
        source: "owner_confirmed",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.insert).not.toHaveBeenCalled();
    const result = await upsertGymEquipment({
      gymId: 1,
      machineKey: "chest-press",
      displayName: "Chest",
      equipment: "Machine",
      source: "photo_confirmed",
      sourceUrl: "https://photos.gym.com/confirmed.jpg",
    });
    expect(result.id).toBe(1);
    expect(writes[0].values.userId).toBe(2);
    expect(writes[0].values.source).toBe("photo_confirmed");
    expect(writes[0].conflict.target).toHaveLength(3);
    expect(writes[0].conflict.set).not.toHaveProperty("userId");
    expect(writes[0].conflict.set).not.toHaveProperty("gymId");
  });
  it("deletion only targets this owner and missing/foreign IDs return NOT_FOUND", async () => {
    const { writes } = fakeDb({}, [[{ id: 1 }], []]);
    expect(await deleteGymEquipment(1)).toEqual({ success: true });
    expect(writes[0].where.params).toEqual([1, 2]);
    await expect(deleteGymEquipment(3)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
  it("saved response never discloses internal userId/identityKey", async () => {
    fakeDb({ gym_locations: [location()] });
    const [row] = await getSavedGyms();
    expect(row).not.toHaveProperty("userId");
    expect(row).not.toHaveProperty("identityKey");
    expect(row.createdAt).toBe(now.toISOString());
  });
});
