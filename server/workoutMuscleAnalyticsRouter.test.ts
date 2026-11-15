import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { getWorkoutMuscleAnalysis } from "./workoutMuscleAnalytics";

vi.mock("./db", () => ({ getDb: vi.fn(), getPool: vi.fn() }));
vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn(), listLLMModels: vi.fn() }));
vi.mock("./storage", () => ({
  storagePut: vi.fn(),
  storageReadBuffer: vi.fn(),
  storageGetSignedUrl: vi.fn(),
}));
const caller = appRouter.createCaller({
  user: null,
  req: { protocol: "https", headers: {} } as any,
  res: {} as any,
});
const dialect = new PgDialect();
interface ReadRecord {
  table: string;
  fields: string[];
  limit: number;
  offset: number;
  where: string;
  params: unknown[];
  joins: string[];
  ordered: boolean;
}
/** Test-only in-memory adapter. No real connection or live data are touched. */
function fakeDb(tables: Record<string, any[]> = {}) {
  const reads: ReadRecord[] = [];
  const db = {
    select: vi.fn((fields: Record<string, unknown>) => {
      const record: ReadRecord = {
        table: "",
        fields: Object.keys(fields),
        limit: 0,
        offset: 0,
        where: "",
        params: [],
        joins: [],
        ordered: false,
      };
      const chain: any = {
        from: (table: any) => {
          record.table = getTableName(table);
          return chain;
        },
        innerJoin: (table: any) => {
          record.joins.push(getTableName(table));
          return chain;
        },
        where: (where: any) => {
          const query = dialect.sqlToQuery(where);
          record.where = query.sql;
          record.params = query.params;
          return chain;
        },
        orderBy: () => {
          record.ordered = true;
          return chain;
        },
        limit: (limit: number) => {
          record.limit = limit;
          return chain;
        },
        offset: (offset: number) => {
          record.offset = offset;
          return chain;
        },
        then: (resolve: any, reject: any) => {
          reads.push(record);
          return Promise.resolve(
            (tables[record.table] ?? []).slice(
              record.offset,
              record.offset + record.limit
            )
          ).then(resolve, reject);
        },
      };
      return chain;
    }),
    insert: vi.fn(() => {
      throw new Error("writes prohibited");
    }),
    update: vi.fn(() => {
      throw new Error("writes prohibited");
    }),
    delete: vi.fn(() => {
      throw new Error("writes prohibited");
    }),
    execute: vi.fn(() => {
      throw new Error("raw execution prohibited");
    }),
  };
  return { db: db as any, reads };
}
beforeEach(() => vi.resetAllMocks());

describe("workout.getMuscleAnalysis read-only personal API", () => {
  it("validates exact period and genuine HK anchor dates before any read", async () => {
    await expect(
      caller.workout.getMuscleAnalysis({
        period: "day" as any,
        anchorDate: "2026-11-15",
      })
    ).rejects.toThrow();
    await expect(
      caller.workout.getMuscleAnalysis({
        period: "week",
        anchorDate: "2026-02-29",
      })
    ).rejects.toThrow();
    await expect(
      caller.workout.getMuscleAnalysis({
        period: "month",
        anchorDate: "2026-11-15T00:00:00Z",
      })
    ).rejects.toThrow();
    expect(getDb).not.toHaveBeenCalled();
  });
  it("returns an explicit error rather than implying unavailable DB is empty history", async () => {
    vi.mocked(getDb).mockResolvedValue(null);
    await expect(
      caller.workout.getMuscleAnalysis({
        period: "all",
        anchorDate: "2026-11-15",
      })
    ).rejects.toThrow("DB unavailable");
  });
  it("owner-scopes session and set reads, uses half-open HK timestamps and never writes or loads health models", async () => {
    const mock = fakeDb({
      workout_sessions: [
        {
          id: 1,
          startTime: new Date("2026-11-15T00:00:00+08:00"),
          endTime: null,
          finished: false,
          totalVolume: 999999,
        },
      ],
      workout_sets: [
        {
          id: 1,
          sessionId: 1,
          exerciseName: "Bench Press",
          reps: 10,
          weight: 40,
        },
      ],
    });
    vi.mocked(getDb).mockResolvedValue(mock.db);
    const result = await caller.workout.getMuscleAnalysis({
      period: "week",
      anchorDate: "2026-11-15",
    });
    expect(result.range).toEqual({
      startDate: "2026-11-09",
      endDate: "2026-11-15",
    });
    expect(result.totalVolumeKg).toBe(400);
    expect(result.completedSessionCount).toBe(0);
    expect(result.timeZone).toBe("Asia/Hong_Kong");
    expect(result.weekStartsOn).toBe("monday");
    expect(mock.reads.map(read => read.table).sort()).toEqual([
      "custom_exercises",
      "exercises",
      "workout_sessions",
      "workout_sets",
    ]);
    for (const read of mock.reads.filter(read =>
      read.table.startsWith("workout_")
    )) {
      expect(read.where).toContain('"workout_sessions"."user_id" =');
      expect(read.where).toContain('"workout_sessions"."start_time" >=');
      expect(read.where).toContain('"workout_sessions"."start_time" <');
      expect(read.params).toEqual([
        2,
        "2026-11-08T16:00:00.000Z",
        "2026-11-15T16:00:00.000Z",
      ]);
    }
    expect(
      mock.reads.find(read => read.table === "workout_sets")?.joins
    ).toEqual(["workout_sessions"]);
    expect(
      mock.reads.find(read => read.table === "workout_sessions")?.fields
    ).toEqual(["id", "startTime", "endTime", "finished"]);
    expect(
      mock.reads.find(read => read.table === "workout_sets")?.fields
    ).toEqual([
      "id",
      "sessionId",
      "exerciseId",
      "exerciseName",
      "reps",
      "weight",
      "duration",
    ]);
    expect(
      mock.reads.find(read => read.table === "custom_exercises")?.where
    ).toContain('"custom_exercises"."user_id" =');
    expect(
      mock.reads.find(read => read.table === "custom_exercises")?.params
    ).toEqual([2]);
    expect(
      mock.reads.find(read => read.table === "exercises")?.where
    ).toContain('"exercises"."user_id" =');
    expect(mock.db.insert).not.toHaveBeenCalled();
    expect(mock.db.update).not.toHaveBeenCalled();
    expect(mock.db.delete).not.toHaveBeenCalled();
    expect(mock.db.execute).not.toHaveBeenCalled();
  });
  it("paginates all history and both catalogs past a full page without an arbitrary population cap or N+1", async () => {
    const sessions = Array.from({ length: 1202 }, (_, i) => ({
      id: i + 1,
      startTime: new Date("2010-01-01T12:00:00+08:00"),
      endTime: null,
    }));
    const sets = sessions.map(session => ({
      id: session.id,
      sessionId: session.id,
      exerciseName: "Bench Press",
      reps: 10,
      weight: 40,
    }));
    const catalog = Array.from({ length: 501 }, (_, i) => ({
      id: i + 1,
      name: `Custom ${i}`,
      muscleGroup: "back",
    }));
    const mock = fakeDb({
      workout_sessions: sessions,
      workout_sets: sets,
      exercises: catalog,
      custom_exercises: catalog,
    });
    const result = await getWorkoutMuscleAnalysis(mock.db, 2, {
      period: "all",
      anchorDate: "2026-11-15",
    });
    expect(result.sessionCount).toBe(1202);
    expect(result.setCount).toBe(1202);
    expect(result.totalVolumeKg).toBe(480800);
    expect(result.range).toEqual({
      startDate: "2010-01-01",
      endDate: "2010-01-01",
    });
    for (const table of ["workout_sessions", "workout_sets"]) {
      const reads = mock.reads.filter(read => read.table === table);
      expect(reads.map(read => read.offset)).toEqual([0, 500, 1000]);
      expect(reads.every(read => read.limit === 500 && read.ordered)).toBe(
        true
      );
      expect(reads.every(read => !read.where.includes("start_time"))).toBe(
        true
      );
      expect(reads.every(read => read.params[0] === 2)).toBe(true);
    }
    for (const table of ["exercises", "custom_exercises"]) {
      expect(
        mock.reads.filter(read => read.table === table).map(read => read.offset)
      ).toEqual([0, 500]);
    }
    expect(mock.db.select).toHaveBeenCalledTimes(10);
    expect(mock.db.update).not.toHaveBeenCalled();
    expect(mock.db.insert).not.toHaveBeenCalled();
    expect(mock.db.delete).not.toHaveBeenCalled();
  });
  it("stops empty-history reads immediately with stable calendar empty-state output", async () => {
    const mock = fakeDb();
    vi.mocked(getDb).mockResolvedValue(mock.db);
    const result = await caller.workout.getMuscleAnalysis({
      period: "month",
      anchorDate: "2026-11-15",
    });
    expect(result.range).toEqual({
      startDate: "2026-11-01",
      endDate: "2026-11-30",
    });
    expect(result.sessionCount).toBe(0);
    expect(result.setCount).toBe(0);
    expect(result.muscles).toEqual([]);
    expect(mock.reads).toHaveLength(1);
  });
});
