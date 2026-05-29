import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Create a chainable query builder mock that resolves to [] at any point
function makeChainable(resolveValue: unknown = []) {
  const chain: Record<string, unknown> = {};
  const methods = ["from", "where", "orderBy", "limit", "innerJoin", "leftJoin", "groupBy", "having"];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  // Make the chain itself a thenable (Promise-like)
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(resolveValue).then(resolve);
  chain.catch = (reject: (e: unknown) => unknown) => Promise.resolve(resolveValue).catch(reject);
  return chain;
}

// Mock the database module
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnValue(makeChainable([])),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        returning: vi.fn().mockResolvedValue([{ id: 42 }]),
        catch: vi.fn().mockResolvedValue(undefined),
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(undefined).then(resolve),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  }),
}));

function createAuthContext(role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user-001",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("auth.me", () => {
  it("returns user when authenticated", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toMatchObject({ id: 1, name: "Test User" });
  });

  it("returns null when not authenticated", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

describe("nutrition.getMealLogs", () => {
  it("returns empty array when no logs exist", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.nutrition.getMealLogs({ date: "2026-05-29" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("throws UNAUTHORIZED when not logged in", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.nutrition.getMealLogs({ date: "2026-05-29" })).rejects.toThrow();
  });
});

describe("nutrition.addMealLog", () => {
  it("adds a meal log successfully", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.nutrition.addMealLog({
      date: "2026-05-29",
      mealType: "breakfast",
      foodName: "Oats",
      quantity: 100,
      calories: 389,
      protein: 17,
      carbs: 66,
      fat: 7,
    });
    expect(result).toMatchObject({ success: true });
  });
});

describe("nutrition.deleteMealLog", () => {
  it("deletes a meal log successfully", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.nutrition.deleteMealLog({ id: 1 });
    expect(result).toMatchObject({ success: true });
  });
});

describe("workout.getExercises", () => {
  it("returns exercise list", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.workout.getExercises({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("filters by muscle group", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.workout.getExercises({ muscleGroup: "chest" });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("workout.createSession", () => {
  it("creates a workout session and returns id", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Mock insert to return id via .returning()
    const result = await caller.workout.createSession({
      date: "2026-05-29",
      name: "Chest Day",
      notes: "Felt strong",
    });
    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("id");
  });
});

describe("body.add", () => {
  it("adds a body metric record", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.body.add({
      date: "2026-05-29",
      weight: 75.5,
      bodyFatPct: 18.2,
    });
    expect(result).toMatchObject({ success: true });
  });
});

describe("body.getAll", () => {
  it("returns body metrics list", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.body.getAll({ limit: 30 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("heartRate.add", () => {
  it("adds a heart rate record", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.heartRate.add({
      date: "2026-05-29",
      restingHr: 58,
      maxHr: 175,
    });
    expect(result).toMatchObject({ success: true });
  });
});

describe("sleep.add", () => {
  it("adds a sleep record", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.sleep.add({
      date: "2026-05-29",
      duration: 8,
      quality: "Good",
    });
    expect(result).toMatchObject({ success: true });
  });
});

describe("dashboard.getSummary", () => {
  it("returns dashboard summary with today nested object", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.getSummary();
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("today");
    expect(result?.today).toHaveProperty("calories");
    expect(result?.today).toHaveProperty("protein");
    expect(result).toHaveProperty("workoutStreak");
  });
});

describe("auth.logout", () => {
  it("clears session cookie and returns success", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toMatchObject({ success: true });
  });
});
