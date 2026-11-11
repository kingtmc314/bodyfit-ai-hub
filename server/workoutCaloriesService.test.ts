import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { estimateWorkoutCalories } from "../shared/workoutCalories";
import { finishWorkoutSession, getWorkoutCalorieReadModels, refreshWorkoutSessionCalories, updateWorkoutSession } from "./workoutCalorieService";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { readFileSync } from "node:fs";

vi.mock("./db", () => ({ getDb: vi.fn(), getPool: vi.fn() }));
vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn(), listLLMModels: vi.fn() }));
vi.mock("./storage", () => ({ storagePut: vi.fn(), storageReadBuffer: vi.fn(), storageGetSignedUrl: vi.fn() }));
const now = new Date("2026-11-11T20:00:00+08:00");
const sets = [
  { id: 1, sessionId: 1, exerciseName: "Bench Press", reps: 10, weight: 40, duration: null, calories: null },
  { id: 2, sessionId: 1, exerciseName: "Stationary Bike", reps: 0, weight: 0, duration: 20, calories: 130 },
];
const baseSession = { id: 1, userId: 2, name: "synthetic", startTime: new Date("2026-11-11T18:00:00+08:00"), endTime: null, duration: 60, caloriesBurned: 350, totalVolume: 400, calorieDetails: null };
/** In-memory mock only. Deliberately never imports or constructs a real DB connection. */
function fakeDb(session: any = { ...baseSession }, loggedSets: any[] = sets.map(s => ({ ...s }))) {
  const tables: Record<string, any[]> = {
    workout_sessions: [session], workout_sets: loggedSets,
    body_composition: [{ id: 1, userId: 2, date: "2026-11-10", weight: 80 }],
    user_profile: [{ userId: 2, weight: 75 }],
  };
  const writes: Array<{ table: string; values: any }> = [];
  const db = {
    select: vi.fn((fields?: any) => {
      let table = ""; let joined = false;
      const chain: any = {
        from: (t: any) => { table = getTableName(t); return chain; },
        innerJoin: () => { joined = true; return chain; },
        where: () => chain, orderBy: () => chain, limit: () => chain, groupBy: () => chain,
        then: (resolve: any, reject: any) => Promise.resolve((tables[table] ?? []).map(row => {
          if (joined && fields?.set) return { set: row };
          if (fields?.sessionTime) return { ...row, sessionTime: session.startTime };
          return row;
        })).then(resolve, reject),
      };
      return chain;
    }),
    update: vi.fn((t: any) => ({ set: (values: any) => ({ where: async () => {
      const table = getTableName(t); writes.push({ table, values });
      if (table === "workout_sessions") Object.assign(session, values);
      if (table === "workout_sets") Object.assign(loggedSets[0], values);
      return [];
    } }) })),
    insert: vi.fn((t: any) => ({ values: (values: any) => {
      const table = getTableName(t); writes.push({ table, values });
      if (table === "workout_sets") loggedSets.push({ id: 3, ...values });
      return { returning: async () => [{ id: 1 }] };
    } })),
    delete: vi.fn((t: any) => ({ where: async () => {
      writes.push({ table: getTableName(t), values: "delete" });
      if (getTableName(t) === "workout_sets") loggedSets.splice(0, 1);
      return [];
    } })),
  };
  return { db: db as any, session, writes, loggedSets };
}
const caller = appRouter.createCaller({ user: null, req: { protocol: "https", headers: {} } as any, res: {} as any });
beforeEach(() => vi.resetAllMocks());

describe("non-destructive calorie service persistence", () => {
  it("batch reads correct old 694-minute records with zero DB writes", async () => {
    const mock = fakeDb({ ...baseSession, duration: 694, caloriesBurned: Math.round(5 * 70 * 694 / 60) });
    const original = mock.session.caloriesBurned;
    const [result] = await getWorkoutCalorieReadModels(mock.db, [mock.session], 2);
    expect(result.rawOriginalCalories).toBe(original);
    expect(result.caloriesBurned).toBeLessThan(200);
    expect(mock.writes).toEqual([]);
    expect(mock.db.update).not.toHaveBeenCalled();
    expect(mock.session.caloriesBurned).toBe(original);
  });
  it("refreshes new versioned sessions and keeps workload independent of MET", async () => {
    const details = estimateWorkoutCalories({ sets, verifiedDurationMinutes: 60 }); details.origin = "new";
    const mock = fakeDb({ ...baseSession, calorieDetails: details });
    const result = await refreshWorkoutSessionCalories(mock.db, 1, 2);
    expect(result.caloriesBurned).toBe(263);
    expect(mock.writes[0].values).toMatchObject({ totalVolume: 400, caloriesBurned: 263 });
    expect(mock.writes[0].values.calorieDetails.version).toBe("workout-active-v1");
  });
  it("legacy set refresh changes only volume, never auto-backfills calories or metadata", async () => {
    const mock = fakeDb();
    await refreshWorkoutSessionCalories(mock.db, 1, 2);
    expect(mock.writes[0].values.totalVolume).toBe(400);
    expect(mock.writes[0].values).not.toHaveProperty("caloriesBurned");
    expect(mock.writes[0].values).not.toHaveProperty("calorieDetails");
  });
  it("new manual zero survives refresh and finish", async () => {
    const details = estimateWorkoutCalories({ sets, manualCalories: 0, mode: "live" }); details.origin = "new";
    const mock = fakeDb({ ...baseSession, calorieDetails: details, caloriesBurned: 0 });
    expect((await refreshWorkoutSessionCalories(mock.db, 1, 2)).caloriesBurned).toBe(0);
    expect((await finishWorkoutSession(mock.db, 1, 2, { duration: 60 }, now)).caloriesBurned).toBe(0);
    expect(mock.session.calorieDetails.manualCalories).toBe(0);
  });
  it("reviewed legacy finish persists metadata only, preserving raw calories and duration", async () => {
    const mock = fakeDb({ ...baseSession, startTime: new Date("2026-11-01T12:00:00+08:00"), duration: 694, caloriesBurned: Math.round(5 * 70 * 694 / 60) });
    const original = mock.session.caloriesBurned;
    const finished = await finishWorkoutSession(mock.db, 1, 2, { duration: 60, intensity: "vigorous", bodyWeightKg: 80 }, now);
    expect(finished.caloriesBurned).toBe(397);
    expect(mock.session.caloriesBurned).toBe(original);
    expect(mock.session.duration).toBe(694);
    expect(mock.session.calorieDetails).toMatchObject({ origin: "legacy", rawOriginalCalories: original, intensity: "vigorous" });
    const [read] = await getWorkoutCalorieReadModels(mock.db, [mock.session], 2);
    expect(read.caloriesBurned).toBe(finished.caloriesBurned);
    expect(read.calorieEstimate.weightSource).toBe("session_override");
    expect(read.duration).toBe(60);
  });
  it("repeat finish is idempotent and has no second health write", async () => {
    const details = estimateWorkoutCalories({ sets, mode: "live" }); details.origin = "new";
    const mock = fakeDb({ ...baseSession, calorieDetails: details });
    const first = await finishWorkoutSession(mock.db, 1, 2, { duration: 60 }, now);
    const count = mock.writes.length;
    const second = await finishWorkoutSession(mock.db, 1, 2, {}, new Date("2026-11-20T20:00:00+08:00"));
    expect(second.caloriesBurned).toBe(first.caloriesBurned);
    expect(second.duration).toBe(first.duration);
    expect(second.alreadyFinished).toBe(true);
    expect(mock.writes).toHaveLength(count);
  });
  it("explicit manual correction persists original evidence and survives subsequent set edits", async () => {
    const mock = fakeDb();
    await updateWorkoutSession(mock.db, 1, 2, { caloriesBurned: 77 }, now);
    expect(mock.session.calorieDetails).toMatchObject({ manualCalories: 77, rawOriginalCalories: 350, origin: "legacy" });
    mock.loggedSets.push({ ...sets[0], id: 3, weight: 200 });
    expect((await refreshWorkoutSessionCalories(mock.db, 1, 2)).caloriesBurned).toBe(77);
    await updateWorkoutSession(mock.db, 1, 2, { clearManualCalories: true }, now);
    expect(mock.session.calorieDetails.manualCalories).toBeNull();
    expect((await getWorkoutCalorieReadModels(mock.db, [mock.session], 2))[0].caloriesBurned).not.toBe(77);
  });
});

describe("workout/dashboard routers use one corrected read model", () => {
  it("session list/detail/daily/dashboard agree and dashboard never re-adds machine kcal", async () => {
    const details = estimateWorkoutCalories({ sets, verifiedDurationMinutes: 60 }); details.origin = "new";
    const mock = fakeDb({ ...baseSession, calorieDetails: details });
    vi.mocked(getDb).mockResolvedValue(mock.db);
    const list = await caller.workout.getSessions();
    const detail = await caller.workout.getSessionWithSets({ sessionId: 1 });
    const daily = await caller.workout.getDailyCaloriesBurned({ date: "2026-11-11" });
    const dashboard = await caller.dashboard.getSummary();
    expect(list[0].caloriesBurned).toBe(263);
    expect(detail?.session.caloriesBurned).toBe(263);
    expect(daily.totalBurned).toBe(263);
    expect(dashboard?.exercise.workoutBurned).toBe(263);
    expect(dashboard?.exercise.cardioBurned).toBe(130);
    expect(dashboard?.exercise.totalBurned).toBe(263);
    expect(mock.writes).toEqual([]);
  });
  it("weekly aggregate agrees with daily corrected total and uses HK ISO week", async () => {
    const details = estimateWorkoutCalories({ sets, verifiedDurationMinutes: 60 }); details.origin = "new";
    const mock = fakeDb({ ...baseSession, calorieDetails: details });
    vi.mocked(getDb).mockResolvedValue(mock.db);
    const weekly = await caller.charts.weeklyExerciseCalories({ weeks: 8 });
    expect(weekly).toEqual([{ week: "2026-11-09", label: "11-09", workout: 263, running: 0, steps: 0, total: 263 }]);
    expect(mock.writes).toEqual([]);
  });
  it("source contract has no direct SQL SUM of legacy workout calories", () => {
    const source = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/SUM\(\$\{workoutSessions\.caloriesBurned\}/);
    const weekly = source.slice(source.indexOf("weeklyExerciseCalories:"), source.indexOf("cardioHistory:"));
    expect(weekly).toContain("getWorkoutCalorieReadModels");
    expect(weekly).toContain("workoutWeekMonday");
  });
  it("add/update/delete set each refreshes new versioned calories and volume", async () => {
    const details = estimateWorkoutCalories({ sets }); details.origin = "new";
    const mock = fakeDb({ ...baseSession, calorieDetails: details });
    vi.mocked(getDb).mockResolvedValue(mock.db);
    const add = await caller.workout.addSet({ sessionId: 1, exerciseName: "Bench Press", setNumber: 2, reps: 10, weight: 50 });
    expect(add.totalVolume).toBe(900);
    const updated = await caller.workout.updateSet({ id: 1, weight: 60 });
    expect(updated.totalVolume).toBe(1100);
    const deleted = await caller.workout.deleteSet({ id: 1 });
    expect(deleted.totalVolume).toBe(500);
    expect(mock.writes.filter(write => write.table === "workout_sessions")).toHaveLength(3);
    expect(deleted.calorieEstimate).toBeDefined();
  });
});

describe("bounded workout AI routes", () => {
  it("rejects unsupported MIME, mismatched signature, and oversize before any model or storage write", async () => {
    await expect(caller.workout.identifyExerciseFromPhoto({ base64: "abcd", mimeType: "image/svg+xml" as any })).rejects.toThrow();
    await expect(caller.workout.identifyExerciseFromPhoto({ base64: Buffer.alloc(20).toString("base64"), mimeType: "image/jpeg" })).rejects.toThrow();
    await expect(caller.workout.identifyExerciseFromPhoto({ base64: "a".repeat(4000000), mimeType: "image/jpeg" })).rejects.toThrow();
    expect(invokeLLM).not.toHaveBeenCalled();
    expect(storagePut).not.toHaveBeenCalled();
  });
  it("identification is an explicitly bounded review-only request", async () => {
    const jpeg = Buffer.from([255, 216, 255, ...Array(17).fill(0)]).toString("base64");
    vi.mocked(invokeLLM).mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ name: "Unknown", nameZh: "未能確認", muscleGroup: "other", equipment: "Other", instructions: "請確認", confidence: "low" }) } }] } as any);
    const result = await caller.workout.identifyExerciseFromPhoto({ base64: jpeg, mimeType: "image/jpeg" });
    expect(result.confidence).toBe("low");
    expect(invokeLLM).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-6.1-sol", reasoning: { effort: "low" }, maxTokens: 1500, timeoutMs: 45000 }));
    expect(storagePut).not.toHaveBeenCalled();
    expect(getDb).not.toHaveBeenCalled();
  });
  it("exercise analysis uses dated session history and explicitly limits workload/activation claims", async () => {
    const mock = fakeDb(); vi.mocked(getDb).mockResolvedValue(mock.db);
    vi.mocked(invokeLLM).mockResolvedValue({ choices: [{ message: { content: '{"analysis":"估計建議","recommendations":[]}' } }] } as any);
    await caller.workout.analyzeExercise({ exerciseName: "Bench Press" });
    const call = vi.mocked(invokeLLM).mock.calls[0][0];
    expect(call).toMatchObject({ model: "gpt-6.1-sol", maxTokens: 2000, timeoutMs: 45000, reasoning: { effort: "low" } });
    expect(JSON.stringify(call.messages)).toMatch(/2026-11-11/);
    expect(JSON.stringify(call.messages)).toMatch(/not calories or measured muscle activation/);
    expect(mock.writes).toEqual([]);
  });
});
