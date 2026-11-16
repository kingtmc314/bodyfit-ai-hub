import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";
import {
  requireWorkoutSession,
  validateWorkoutSetChange,
  refreshWorkoutSessionCalories,
} from "./workoutCalorieService";
import {
  getExerciseHistoryNames,
  getCanonicalExerciseName,
  REVIEWED_EXERCISE_MERGES,
} from "@shared/workoutExerciseIdentity";
import {
  assertCustomExerciseNotDuplicate,
  getWorkoutExerciseHistory,
} from "./workoutExerciseHistory";

vi.mock("./db", () => ({ getDb: vi.fn(), getPool: vi.fn() }));
vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn(), listLLMModels: vi.fn() }));
vi.mock("./storage", () => ({
  storagePut: vi.fn(),
  storageReadBuffer: vi.fn(),
  storageGetSignedUrl: vi.fn(),
}));
vi.mock("./workoutCalorieService", async importOriginal => {
  const actual =
    await importOriginal<typeof import("./workoutCalorieService")>();
  return {
    ...actual,
    requireWorkoutSession: vi.fn(),
    validateWorkoutSetChange: vi.fn(),
    refreshWorkoutSessionCalories: vi.fn(),
  };
});

const dialect = new PgDialect();
const context = {
  user: null,
  req: { protocol: "https", headers: {} } as any,
  res: {} as any,
};
const caller = appRouter.createCaller(context);
interface SessionFixture {
  id: number;
  userId: number;
  startTime: string;
  name: string | null;
  location: string | null;
}
interface SetFixture {
  id: number;
  sessionId: number;
  exerciseName: string | null;
  setNumber: number;
  reps: number | null;
  weight: number | null;
  duration: number | null;
  distance: number | null;
  exerciseId?: number | null;
}
const session = (
  id: number,
  startTime: string,
  userId = 2
): SessionFixture => ({ id, userId, startTime, name: null, location: null });
const savedSet = (
  id: number,
  sessionId: number,
  exerciseName: string,
  overrides: Partial<SetFixture> = {}
): SetFixture => ({
  id,
  sessionId,
  exerciseName,
  setNumber: 1,
  reps: 10,
  weight: 40,
  duration: null,
  distance: null,
  exerciseId: null,
  ...overrides,
});
const hkDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Hong_Kong",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dateHK = (iso: string) => hkDateFormatter.format(new Date(iso));
const normalize = (name: string) =>
  name.trim().replace(/\s+/g, " ").toLowerCase();

const validLoad = (value: number | null): value is number =>
  value != null && Number.isFinite(value) && value >= 0;
const validReps = (value: number | null): value is number =>
  value != null && Number.isInteger(value) && value >= 0;

/** Isolated fixture adapter, not a SQL engine: verifies compiled SQL structure and bound
 * parameters before returning independently aggregated fixtures. No network/real DB.
 * A real temporary PostgreSQL integration test can separately validate dialect execution.
 */
function fakeDb(
  sessions: SessionFixture[] = [],
  sets: SetFixture[] = [],
  custom: Array<{
    id: number;
    userId: number;
    name: string;
    equipment: string;
  }> = [],
  rawRows = false
) {
  const reads: Array<{ sql: string; params: unknown[] }> = [];
  const writes: Array<{ table: string; values: any }> = [];
  const db = {
    execute: vi.fn(async (statement: SQL) => {
      const query = dialect.sqlToQuery(statement);
      const text = query.sql.replace(/\s+/g, " ").trim();
      reads.push({ sql: text, params: query.params });
      const pack = (rows: unknown[]) => (rawRows ? rows : { rows });
      expect(text).toContain("LIMIT");
      expect(text).not.toMatch(/SELECT \*/);
      expect(text).not.toMatch(/\b(?:INSERT|UPDATE|DELETE)\b/);
      if (text.startsWith("SELECT id FROM custom_exercises")) {
        expect(text).toContain("WHERE user_id = $1");
        expect(text).toContain("lower(trim(regexp_replace(name,");
        expect(text).toContain("lower(trim(regexp_replace(equipment,");
        expect(text).toMatch(/LIMIT 1$/);
        const [owner, name, equipment] = query.params;
        return pack(
          custom
            .filter(
              row =>
                row.userId === owner &&
                normalize(row.name) === name &&
                normalize(row.equipment) === equipment
            )
            .slice(0, 1)
            .map(row => ({ id: row.id }))
        );
      }
      expect(text).toContain(
        "INNER JOIN workout_sessions sess ON sess.id = ws.session_id"
      );
      expect(text).toContain("WHERE sess.user_id = $1");
      expect(text).not.toMatch(
        /exercise_id|custom_exercises|body_composition|running_logs|CURRENT_DATE|NOW\(/i
      );
      const selectedSessions = new Map(
        sessions
          .filter(row => row.userId === query.params[0])
          .map(row => [row.id, row])
      );
      const ownedSets = sets.filter(row => selectedSessions.has(row.sessionId));
      if (text.startsWith("WITH usage AS")) {
        expect(query.params).toHaveLength(1);
        expect(text).toContain("COUNT(DISTINCT sess.id)");
        expect(text).toContain("GROUP BY ws.exercise_name");
        expect(text).toContain(
          'ORDER BY ws.exercise_name COLLATE "C" LIMIT ALL'
        );
        const usage = [
          ...new Set(
            ownedSets.map(row => row.exerciseName).filter(name => name != null)
          ),
        ]
          .sort()
          .map(exerciseName => {
            const selected = ownedSets.filter(
              row => row.exerciseName === exerciseName
            );
            return {
              exerciseName,
              setRows: selected.length,
              sessionCount: new Set(selected.map(row => row.sessionId)).size,
            };
          });
        return pack([{ usage }]);
      }
      expect(text).toContain("WITH matched AS MATERIALIZED");
      expect(text).toContain("ws.exercise_name IN (");
      expect(text).toContain(
        "AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Hong_Kong'"
      );
      expect(text).toContain("MIN(date_hk)");
      expect(text).toContain("MAX(date_hk)");
      expect(text).toContain("COUNT(DISTINCT session_id)");
      expect(text).toContain("FILTER (WHERE valid_load AND valid_reps)");
      expect(text).toContain("ws.weight >= 0 AND ws.weight < 'Infinity'::real");
      expect(text).toContain(
        "AVG(weight::double precision) FILTER (WHERE valid_load)"
      );
      expect(text).toContain("COUNT(*) FILTER (WHERE valid_load IS NOT TRUE)");
      expect(text).toContain(
        "FROM matched GROUP BY date_hk ORDER BY date_hk ASC LIMIT ALL"
      );
      expect(text).toContain(
        'jsonb_agg(to_jsonb(daily_trend) ORDER BY daily_trend."dateHK" ASC)'
      );
      expect(text).toContain(
        "ORDER BY date_hk DESC, start_time DESC, session_id DESC LIMIT"
      );
      expect(text).toContain(
        "ORDER BY page.date_hk DESC, page.start_time DESC, page.session_id DESC"
      );
      expect(text).toContain("ORDER BY matched.set_number, matched.set_id");
      expect(text).toContain(
        "FROM matched WHERE matched.session_id = page.session_id LIMIT 1"
      );
      const names = query.params.slice(1, -2) as string[];
      const [pageSize, offset] = query.params.slice(-2) as number[];
      expect(new Set(names).size).toBe(names.length);
      expect(pageSize).toBeGreaterThan(0);
      expect(pageSize).toBeLessThanOrEqual(20);
      const matched = ownedSets.filter(row =>
        names.includes(row.exerciseName!)
      );
      const matchedIds = new Set(matched.map(row => row.sessionId));
      const allSessions = [...selectedSessions.values()]
        .filter(row => matchedIds.has(row.id))
        .sort(
          (a, b) =>
            dateHK(b.startTime).localeCompare(dateHK(a.startTime)) ||
            Date.parse(b.startTime) - Date.parse(a.startTime) ||
            b.id - a.id
        );
      const dates = allSessions.map(row => dateHK(row.startTime)).sort();
      const weights = matched.map(row => row.weight).filter(validLoad);
      const trend = [...new Set(dates)].map(day => {
        const dailySets = matched.filter(
          set => dateHK(selectedSessions.get(set.sessionId)!.startTime) === day
        );
        const loads = dailySets.map(set => set.weight).filter(validLoad);
        return {
          dateHK: day,
          sessionCount: new Set(dailySets.map(set => set.sessionId)).size,
          setCount: dailySets.length,
          totalReps: dailySets.reduce(
            (sum, set) => sum + (validReps(set.reps) ? set.reps : 0),
            0
          ),
          totalVolumeKg: dailySets.reduce(
            (sum, set) =>
              sum +
              (validLoad(set.weight) && validReps(set.reps)
                ? set.weight * set.reps
                : 0),
            0
          ),
          maxWeightKg: loads.length ? Math.max(...loads) : null,
          averageWeightKg: loads.length
            ? loads.reduce((sum, load) => sum + load, 0) / loads.length
            : null,
          missingLoadSetCount: dailySets.length - loads.length,
        };
      });
      const page = allSessions.slice(offset, offset + pageSize).map(row => ({
        id: row.id,
        dateHK: dateHK(row.startTime),
        name: row.name,
        location: row.location,
        startTime: row.startTime,
        sets: matched
          .filter(set => set.sessionId === row.id)
          .sort((a, b) => a.setNumber - b.setNumber || a.id - b.id)
          .map(set => ({
            id: set.id,
            setNumber: set.setNumber,
            reps: set.reps,
            weight: set.weight,
            duration: set.duration,
            distance: set.distance,
          })),
      }));
      return pack([
        {
          totalSets: String(matched.length),
          sessionCount: String(allSessions.length),
          firstDateHK: dates[0] ?? null,
          lastDateHK: dates.at(-1) ?? null,
          maxWeightKg: weights.length ? Math.max(...weights) : null,
          totalVolumeKg: String(
            matched.reduce(
              (sum, row) =>
                sum +
                (validLoad(row.weight) && validReps(row.reps)
                  ? row.weight * row.reps
                  : 0),
              0
            )
          ),
          // Exercise JSON string adapter as well as PostgreSQL's already parsed JSONB result.
          sessions: rawRows ? JSON.stringify(page) : page,
          trend: rawRows ? JSON.stringify(trend) : trend,
        },
      ]);
    }),
    insert: vi.fn((table: any) => ({
      values: (values: any) => {
        writes.push({ table: getTableName(table), values });
        return { returning: async () => [{ id: 999, ...values }] };
      },
    })),
    update: vi.fn(() => {
      throw new Error("Unexpected update");
    }),
    delete: vi.fn(() => {
      throw new Error("Unexpected delete");
    }),
  };
  return { db: db as any, reads, writes };
}

beforeEach(() => vi.resetAllMocks());

describe("workout exercise history owner-fixed read API", () => {
  it("validates nonempty names, one-based pages and max20 page sizes before reading", async () => {
    for (const input of [
      { exerciseName: "", page: 1 },
      { exerciseName: " \t", page: 1 },
      { exerciseName: "Bench Press", page: 0 },
      { exerciseName: "Bench Press", page: 1.5 },
      { exerciseName: "Bench Press", page: 1, pageSize: 21 },
      { exerciseName: "Bench Press", page: 1, pageSize: 0 },
      { exerciseName: "Bench Press", page: Number.MAX_SAFE_INTEGER },
    ])
      await expect(caller.workout.getExerciseHistory(input)).rejects.toThrow();
    expect(getDb).not.toHaveBeenCalled();
  });

  it("does not imply empty history when the database is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValue(null);
    await expect(
      caller.workout.getExerciseHistory({
        exerciseName: "Bench Press",
        page: 1,
      })
    ).rejects.toThrow("DB unavailable");
    await expect(caller.workout.getExerciseUsage()).rejects.toThrow(
      "DB unavailable"
    );
  });

  it("returns the exact empty contract with default8 and canonical approved aliases", async () => {
    const mock = fakeDb();
    vi.mocked(getDb).mockResolvedValue(mock.db);
    const result = await caller.workout.getExerciseHistory({
      exerciseName: "Back Extension Machine",
      page: 1,
    });
    expect(result).toEqual({
      exerciseName: "Back Extension",
      aliases: getExerciseHistoryNames("Back Extension Machine"),
      summary: {
        totalSets: 0,
        sessionCount: 0,
        firstDateHK: null,
        lastDateHK: null,
        maxWeightKg: null,
        totalVolumeKg: 0,
      },
      trend: [],
      trendMetadata: { truncated: false },
      sessions: [],
      page: 1,
      pageSize: 8,
      totalPages: 0,
      hasNextPage: false,
    });
    expect(mock.reads).toHaveLength(1);
    expect(mock.writes).toEqual([]);
  });

  it("aggregates the whole history independently of each stable newest session page", async () => {
    const sessions = [
      session(1, "2010-01-01T15:59:59Z"),
      session(2, "2026-11-15T16:00:00Z"),
      session(3, "2026-11-15T16:00:00Z"),
      session(4, "2026-11-16T01:00:00Z"),
    ];
    const sets = [
      savedSet(1, 1, "Bench Press", { reps: 2, weight: 200 }),
      savedSet(4, 2, "Bench Press"),
      savedSet(3, 2, "Bench Press"),
      savedSet(5, 3, "Bench Press"),
      savedSet(6, 4, "Bench Press"),
    ];
    const mock = fakeDb(sessions, sets);
    vi.mocked(getDb).mockResolvedValue(mock.db);
    const first = await caller.workout.getExerciseHistory({
      exerciseName: "Bench Press",
      page: 1,
      pageSize: 2,
    });
    const second = await caller.workout.getExerciseHistory({
      exerciseName: "Bench Press",
      page: 2,
      pageSize: 2,
    });
    expect(first.sessions.map(row => row.id)).toEqual([4, 3]);
    expect(second.sessions.map(row => row.id)).toEqual([2, 1]);
    expect(second.sessions[0].sets.map(row => row.id)).toEqual([3, 4]);
    expect(first.summary).toEqual({
      totalSets: 5,
      sessionCount: 4,
      firstDateHK: "2010-01-01",
      lastDateHK: "2026-11-16",
      maxWeightKg: 200,
      totalVolumeKg: 2000,
    });
    expect(second.summary).toEqual(first.summary);
    expect(first.hasNextPage).toBe(true);
    expect(second.hasNextPage).toBe(false);
    expect(first.totalPages).toBe(2);
    expect(mock.reads).toHaveLength(2);
    expect(mock.writes).toEqual([]);
  });

  it("includes current and future saved sessions with HK midnight dates, no history cutoff", async () => {
    const mock = fakeDb(
      [
        session(1, "2026-11-15T15:59:59.999Z"),
        session(2, "2026-11-15T16:00:00.000Z"),
        session(3, "2030-01-01T00:00:00Z"),
      ],
      [
        savedSet(1, 1, "Bench Press"),
        savedSet(2, 2, "Bench Press"),
        savedSet(3, 3, "Bench Press"),
      ]
    );
    vi.mocked(getDb).mockResolvedValue(mock.db);
    const result = await caller.workout.getExerciseHistory({
      exerciseName: "Bench Press",
      page: 1,
    });
    expect(result.sessions.map(row => row.dateHK)).toEqual([
      "2030-01-01",
      "2026-11-16",
      "2026-11-15",
    ]);
    expect(result.sessions[1].startTime).toBe("2026-11-15T16:00:00.000Z");
    expect(result.summary.firstDateHK).toBe("2026-11-15");
    expect(result.summary.lastDateHK).toBe("2030-01-01");
  });

  it("preserves null versus zero and accepts duration/distance-only cardio and unloaded warmups", async () => {
    const mock = fakeDb(
      [session(1, "2026-11-16T00:00:00Z")],
      [
        savedSet(1, 1, "Stationary Bike", {
          reps: null,
          weight: null,
          duration: 15,
          distance: 5,
        }),
        savedSet(2, 1, "Stationary Bike", {
          reps: 0,
          weight: 0,
          duration: 0,
          distance: 0,
        }),
        savedSet(3, 1, "Stationary Bike", { reps: 10, weight: null }),
      ],
      [],
      true
    );
    vi.mocked(getDb).mockResolvedValue(mock.db);
    const result = await caller.workout.getExerciseHistory({
      exerciseName: "Stationary Bike",
      page: 1,
    });
    expect(result.sessions[0].sets).toEqual([
      {
        id: 1,
        setNumber: 1,
        reps: null,
        weight: null,
        duration: 15,
        distance: 5,
      },
      { id: 2, setNumber: 1, reps: 0, weight: 0, duration: 0, distance: 0 },
      {
        id: 3,
        setNumber: 1,
        reps: 10,
        weight: null,
        duration: null,
        distance: null,
      },
    ]);
    expect(result.summary.maxWeightKg).toBe(0);
    expect(result.summary.totalVolumeKg).toBe(0);
  });

  it("returns all 603 sets in a selected session without truncating at 500", async () => {
    const mock = fakeDb(
      [session(1, "2026-11-16T00:00:00Z")],
      Array.from({ length: 603 }, (_, index) =>
        savedSet(index + 1, 1, "Bench Press", { setNumber: index + 1 })
      )
    );
    vi.mocked(getDb).mockResolvedValue(mock.db);
    const result = await caller.workout.getExerciseHistory({
      exerciseName: "Bench Press",
      page: 1,
    });
    expect(result.sessions[0].sets).toHaveLength(603);
    expect(result.summary.totalSets).toBe(603);
    expect(mock.reads).toHaveLength(1);
    expect(mock.reads[0].sql).not.toMatch(/LIMIT 500|LIMIT 1000/);
  });

  it("returns an empty out-of-range page without losing full-history summary", async () => {
    const mock = fakeDb(
      [session(1, "2010-01-01T00:00:00Z")],
      [savedSet(1, 1, "Bench Press")]
    );
    vi.mocked(getDb).mockResolvedValue(mock.db);
    const result = await caller.workout.getExerciseHistory({
      exerciseName: "Bench Press",
      page: 99,
      pageSize: 20,
    });
    expect(result.sessions).toEqual([]);
    expect(result.summary.totalSets).toBe(1);
    expect(result.summary.sessionCount).toBe(1);
    expect(result.page).toBe(99);
    expect(result.pageSize).toBe(20);
    expect(result.totalPages).toBe(1);
    expect(result.hasNextPage).toBe(false);
  });

  it.each(
    REVIEWED_EXERCISE_MERGES.map(
      rule => [rule.target, [...rule.names]] as const
    )
  )(
    "uses only exact approved aliases for %s, never double-counting the same saved row",
    async (target, names) => {
      const mock = fakeDb(
        [session(1, "2026-11-16T00:00:00Z")],
        names.map((name, i) => savedSet(i + 1, 1, name))
      );
      vi.mocked(getDb).mockResolvedValue(mock.db);
      const result = await caller.workout.getExerciseHistory({
        exerciseName: names.at(-1)!,
        page: 1,
      });
      expect(result.exerciseName).toBe(target);
      expect(result.aliases).toEqual(getExerciseHistoryNames(target));
      expect(result.summary.totalSets).toBe(names.length);
      expect(result.summary.sessionCount).toBe(1);
      expect(result.sessions[0].sets).toHaveLength(names.length);
    }
  );

  it("never infers variants or UI source ownership from old exercise IDs or other-owner rows", async () => {
    const mock = fakeDb(
      [
        session(1, "2026-11-16T00:00:00Z"),
        session(2, "2026-11-17T00:00:00Z", 77),
      ],
      [
        savedSet(1, 1, "Pec Deck", { exerciseId: 9 }),
        savedSet(2, 1, "Pectoral Fly", { exerciseId: 9 }),
        savedSet(3, 2, "Pec Deck", { weight: 999 }),
        savedSet(4, 2, "Secret Other Owner Name"),
        savedSet(5, 1, "Dumbbell Row"),
        savedSet(6, 1, "Barbell Row"),
      ]
    );
    vi.mocked(getDb).mockResolvedValue(mock.db);
    const result = await caller.workout.getExerciseHistory({
      exerciseName: "Pec Deck",
      page: 1,
    });
    expect(result.aliases).toEqual(["Pec Deck"]);
    expect(result.summary.totalSets).toBe(1);
    expect(result.sessions[0].sets.map(row => row.id)).toEqual([1]);
    expect(result.summary.maxWeightKg).toBe(40);
    const usage = await caller.workout.getExerciseUsage();
    expect(usage.map(row => row.exerciseName)).not.toContain(
      "Secret Other Owner Name"
    );
    expect(usage).toContainEqual({
      exerciseName: "Pec Deck",
      setRows: 1,
      sessionCount: 1,
    });
    expect(usage).toContainEqual({
      exerciseName: "Pectoral Fly",
      setRows: 1,
      sessionCount: 1,
    });
    expect(usage).toContainEqual({
      exerciseName: "Dumbbell Row",
      setRows: 1,
      sessionCount: 1,
    });
    expect(usage).toContainEqual({
      exerciseName: "Barbell Row",
      setRows: 1,
      sessionCount: 1,
    });
    expect(mock.reads.every(row => row.params[0] === 2)).toBe(true);
    expect(mock.writes).toEqual([]);
  });

  it("full usage is grouped by saved name, includes old sessions and all rows, not a recent cap", async () => {
    const mock = fakeDb(
      [session(1, "2010-01-01T00:00:00Z"), session(2, "2026-11-16T00:00:00Z")],
      [
        ...Array.from({ length: 603 }, (_, index) =>
          savedSet(index + 1, 1, "Back Extension Machine")
        ),
        savedSet(604, 2, "Back Extension"),
        savedSet(605, 2, "Back Extension", { exerciseName: null }),
      ],
      [],
      true
    );
    vi.mocked(getDb).mockResolvedValue(mock.db);
    expect(await caller.workout.getExerciseUsage()).toEqual([
      { exerciseName: "Back Extension", setRows: 1, sessionCount: 1 },
      { exerciseName: "Back Extension Machine", setRows: 603, sessionCount: 1 },
    ]);
    expect(mock.reads).toHaveLength(1);
  });

  it("binds hostile names as SQL parameters, not raw SQL", async () => {
    const name = "Odd'); DROP TABLE workout_sets; --";
    const mock = fakeDb();
    vi.mocked(getDb).mockResolvedValue(mock.db);
    const result = await caller.workout.getExerciseHistory({
      exerciseName: name,
      page: 1,
    });
    expect(result.aliases).toEqual([name]);
    expect(mock.reads[0].params).toContain(name);
    expect(mock.reads[0].sql).not.toContain(name);
  });

  it("scopes helper callers by supplied owner while public API cannot switch owner via context", async () => {
    const mock = fakeDb(
      [session(1, "2026-11-16T00:00:00Z", 77)],
      [savedSet(1, 1, "Bench Press")]
    );
    const direct = await getWorkoutExerciseHistory(mock.db, 77, {
      exerciseName: "Bench Press",
      page: 1,
    });
    expect(direct.summary.totalSets).toBe(1);
    expect(mock.reads[0].params[0]).toBe(77);
    vi.mocked(getDb).mockResolvedValue(mock.db);
    const otherCaller = appRouter.createCaller({
      ...context,
      user: { id: 77 } as any,
    });
    expect(
      (
        await otherCaller.workout.getExerciseHistory({
          exerciseName: "Bench Press",
          page: 1,
        })
      ).summary.totalSets
    ).toBe(0);
    expect(mock.reads[1].params[0]).toBe(2);
  });
});

describe("safe future workout naming and custom creation", () => {
  it("canonicalizes reviewed aliases before validation and insertion without changing workload", async () => {
    const mock = fakeDb();
    vi.mocked(getDb).mockResolvedValue(mock.db);
    vi.mocked(requireWorkoutSession).mockResolvedValue({
      id: 42,
      userId: 2,
    } as any);
    vi.mocked(refreshWorkoutSessionCalories).mockResolvedValue({
      totalVolume: 0,
      caloriesBurned: 0,
      calorieEstimate: null,
    } as any);
    const input = {
      sessionId: 42,
      exerciseId: null,
      exerciseName: "  Triceps   Extension Machine ",
      setNumber: 3,
      reps: 0,
      weight: 0,
      duration: 15,
      distance: 0,
      avgHr: 100,
      calories: 0,
      notes: "Keep evidence",
    };
    await caller.workout.addSet(input);
    expect(requireWorkoutSession).toHaveBeenCalledWith(mock.db, 42, 2);
    expect(validateWorkoutSetChange).toHaveBeenCalledWith(
      mock.db,
      { id: 42, userId: 2 },
      {
        sessionId: 42,
        exerciseName: "Triceps Extension",
        setNumber: 3,
        reps: 0,
        weight: 0,
        duration: 15,
        distance: 0,
        avgHr: 100,
        calories: 0,
        notes: "Keep evidence",
      }
    );
    expect(mock.writes).toEqual([
      {
        table: "workout_sets",
        values: { ...input, exerciseName: "Triceps Extension" },
      },
    ]);
    expect(validateWorkoutSetChange.mock.invocationCallOrder[0]).toBeLessThan(
      mock.db.insert.mock.invocationCallOrder[0]
    );
    expect(mock.db.update).not.toHaveBeenCalled();
    expect(mock.db.delete).not.toHaveBeenCalled();
  });

  it("keeps uncertain Pec Deck separate and preserves old foreign IDs, warmup/cardio missing values", async () => {
    const mock = fakeDb();
    vi.mocked(getDb).mockResolvedValue(mock.db);
    vi.mocked(requireWorkoutSession).mockResolvedValue({
      id: 42,
      userId: 2,
    } as any);
    vi.mocked(refreshWorkoutSessionCalories).mockResolvedValue({
      totalVolume: 0,
      caloriesBurned: 0,
      calorieEstimate: null,
    } as any);
    await caller.workout.addSet({
      sessionId: 42,
      exerciseId: 9,
      exerciseName: "Pec Deck",
      setNumber: 1,
      duration: 10,
    });
    expect(getCanonicalExerciseName("Pec Deck")).toBe("Pec Deck");
    expect(mock.writes[0].values).toEqual({
      sessionId: 42,
      exerciseId: 9,
      exerciseName: "Pec Deck",
      setNumber: 1,
      reps: null,
      weight: null,
      duration: 10,
      distance: null,
      avgHr: null,
      calories: null,
      notes: null,
    });
  });

  it("blocks insert if existing validation fails, after canonicalization", async () => {
    const mock = fakeDb();
    vi.mocked(getDb).mockResolvedValue(mock.db);
    vi.mocked(requireWorkoutSession).mockResolvedValue({
      id: 42,
      userId: 2,
    } as any);
    vi.mocked(validateWorkoutSetChange).mockRejectedValue(
      new Error("Existing workload validation failed")
    );
    await expect(
      caller.workout.addSet({
        sessionId: 42,
        exerciseName: "Back Extension Machine",
        setNumber: 1,
      })
    ).rejects.toThrow("Existing workload validation failed");
    expect(
      vi.mocked(validateWorkoutSetChange).mock.calls[0][2].exerciseName
    ).toBe("Back Extension");
    expect(mock.writes).toEqual([]);
  });

  it("rejects exact case/space-normalized owner custom duplicates before uploading or inserting", async () => {
    const mock = fakeDb(
      [],
      [],
      [
        {
          id: 4,
          userId: 2,
          name: "  Bench   Press ",
          equipment: "Smith   Machine",
        },
      ]
    );
    vi.mocked(getDb).mockResolvedValue(mock.db);
    await expect(
      caller.workout.createCustomExercise({
        name: "bench press",
        equipment: " smith machine ",
        muscleGroup: "chest",
        photoBase64: "fake",
        photoMimeType: "image/jpeg",
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("動作列表"),
    });
    expect(storagePut).not.toHaveBeenCalled();
    expect(mock.writes).toEqual([]);
    expect(mock.reads[0].params).toEqual([2, "bench press", "smith machine"]);
  });

  it("does not merge same names with different equipment or expose/reuse other owners' custom rows", async () => {
    const mock = fakeDb(
      [],
      [],
      [
        { id: 4, userId: 77, name: "Bench Press", equipment: "Barbell" },
        { id: 5, userId: 2, name: "Bench Press", equipment: "Machine" },
      ]
    );
    vi.mocked(getDb).mockResolvedValue(mock.db);
    const result = await caller.workout.createCustomExercise({
      name: "Bench Press",
      equipment: "Barbell",
      muscleGroup: "chest",
    });
    expect(result).toEqual({
      id: 999,
      userId: 2,
      name: "Bench Press",
      nameZh: "",
      muscleGroup: "chest",
      equipment: "Barbell",
      instructions: "",
      photoUrl: undefined,
      fileKey: undefined,
    });
    expect(mock.writes).toHaveLength(1);
    expect(mock.db.update).not.toHaveBeenCalled();
    expect(mock.db.delete).not.toHaveBeenCalled();
  });

  it("duplicate guard uses parameter-safe exact normalized names, not movement aliases", async () => {
    const name = "Odd'); DROP TABLE custom_exercises; --";
    const mock = fakeDb(
      [],
      [],
      [
        {
          id: 1,
          userId: 2,
          name: "Back Extension Machine",
          equipment: "Machine",
        },
      ]
    );
    await assertCustomExerciseNotDuplicate(
      mock.db,
      2,
      "Back Extension",
      "Machine"
    );
    await assertCustomExerciseNotDuplicate(mock.db, 2, name, "Other");
    expect(mock.reads[1].sql).not.toContain(name);
    expect(mock.reads[1].params).toEqual([2, normalize(name), "other"]);
    expect(mock.writes).toEqual([]);
  });
});

describe("full-history HK-day load time series and existing AI action", () => {
  it("groups all daily points ascending across old and current sessions independently of page, with arithmetic set-load average", async () => {
    const mock = fakeDb(
      [
        session(1, "2010-01-01T00:00:00Z"),
        session(2, "2026-11-15T16:00:00Z"),
        session(3, "2026-11-16T01:00:00Z"),
        session(4, "2026-11-16T02:00:00Z", 77),
      ],
      [
        savedSet(1, 1, "Back Extension Machine", { reps: 1, weight: 100 }),
        savedSet(2, 2, "Back Extension", { reps: 1, weight: 20 }),
        savedSet(3, 3, "Back Extension Machine", { reps: 9, weight: 40 }),
        savedSet(4, 4, "Back Extension", { reps: 999, weight: 999 }),
      ]
    );
    vi.mocked(getDb).mockResolvedValue(mock.db);
    const first = await caller.workout.getExerciseHistory({
      exerciseName: "Back Extension",
      page: 1,
      pageSize: 1,
    });
    const third = await caller.workout.getExerciseHistory({
      exerciseName: "Back Extension Machine",
      page: 3,
      pageSize: 1,
    });
    expect(first.trend).toEqual([
      {
        dateHK: "2010-01-01",
        sessionCount: 1,
        setCount: 1,
        totalReps: 1,
        totalVolumeKg: 100,
        maxWeightKg: 100,
        averageWeightKg: 100,
        missingLoadSetCount: 0,
      },
      {
        dateHK: "2026-11-16",
        sessionCount: 2,
        setCount: 2,
        totalReps: 10,
        totalVolumeKg: 380,
        maxWeightKg: 40,
        averageWeightKg: 30,
        missingLoadSetCount: 0,
      },
    ]);
    expect(third.trend).toEqual(first.trend);
    expect(first.trendMetadata).toEqual({ truncated: false });
    expect(first.trend.reduce((sum, point) => sum + point.setCount, 0)).toBe(
      first.summary.totalSets
    );
    expect(
      first.trend.reduce((sum, point) => sum + point.totalVolumeKg, 0)
    ).toBe(first.summary.totalVolumeKg);
    // Same-day mean is (20 + 40)/2 = 30, not volume/reps = 38.
    expect(first.trend[1].averageWeightKg).toBe(30);
    expect(mock.writes).toEqual([]);
  });

  it("preserves cardio missing loads and real zeros, excludes negative/non-finite loads and invalid reps without altering raw sets", async () => {
    const mock = fakeDb(
      [session(1, "2026-11-15T00:00:00Z"), session(2, "2026-11-16T00:00:00Z")],
      [
        savedSet(1, 1, "Stationary Bike", {
          weight: null,
          reps: null,
          duration: 20,
          distance: 5,
        }),
        savedSet(2, 2, "Stationary Bike", { weight: 0, reps: 0 }),
        savedSet(3, 2, "Stationary Bike", { weight: -5, reps: 10 }),
        savedSet(4, 2, "Stationary Bike", {
          weight: Number.POSITIVE_INFINITY,
          reps: 10,
        }),
        savedSet(5, 2, "Stationary Bike", { weight: Number.NaN, reps: 10 }),
        savedSet(6, 2, "Stationary Bike", { weight: 40, reps: -2 }),
      ]
    );
    vi.mocked(getDb).mockResolvedValue(mock.db);
    const result = await caller.workout.getExerciseHistory({
      exerciseName: "Stationary Bike",
      page: 1,
    });
    expect(result.trend).toEqual([
      {
        dateHK: "2026-11-15",
        sessionCount: 1,
        setCount: 1,
        totalReps: 0,
        totalVolumeKg: 0,
        maxWeightKg: null,
        averageWeightKg: null,
        missingLoadSetCount: 1,
      },
      {
        dateHK: "2026-11-16",
        sessionCount: 1,
        setCount: 5,
        totalReps: 30,
        totalVolumeKg: 0,
        maxWeightKg: 40,
        averageWeightKg: 20,
        missingLoadSetCount: 3,
      },
    ]);
    expect(result.summary.totalSets).toBe(6);
    expect(result.summary.totalVolumeKg).toBe(0);
    expect(result.summary.maxWeightKg).toBe(40);
    expect(result.sessions[0].sets[1].weight).toBe(-5);
    expect(result.sessions[0].sets[4].reps).toBe(-2);
    expect(mock.writes).toEqual([]);
  });

  it("returns every one of 603 historical daily points, not just the eight paginated sessions", async () => {
    const sessions = Array.from({ length: 603 }, (_, i) =>
      session(i + 1, new Date(Date.UTC(2010, 0, 1 + i)).toISOString())
    );
    const mock = fakeDb(
      sessions,
      sessions.map(row => savedSet(row.id, row.id, "Bench Press"))
    );
    vi.mocked(getDb).mockResolvedValue(mock.db);
    const result = await caller.workout.getExerciseHistory({
      exerciseName: "Bench Press",
      page: 1,
    });
    expect(result.sessions).toHaveLength(8);
    expect(result.trend).toHaveLength(603);
    expect(result.trend[0].dateHK).toBe("2010-01-01");
    expect(result.trendMetadata.truncated).toBe(false);
    expect(mock.reads).toHaveLength(1);
  });

  it("existing AI action uses the same full aliases, summary and chart trend with bounded null-preserving evidence and unchanged response", async () => {
    const sessions = [
      session(1, "2010-01-01T00:00:00Z"),
      session(2, "2026-11-16T00:00:00Z"),
    ];
    const sets = [
      savedSet(1, 1, "Triceps Extension Machine", { reps: 1, weight: 200 }),
      ...Array.from({ length: 40 }, (_, i) =>
        savedSet(i + 2, 2, "Triceps Extension", {
          setNumber: i + 1,
          weight: i === 0 ? null : 20,
        })
      ),
    ];
    const mock = fakeDb(sessions, sets);
    vi.mocked(getDb).mockResolvedValue(mock.db);
    const response = {
      analysis: "Mocked load-trend analysis",
      recommendations: [
        { title: "Review", detail: "Tentative", type: "progression" },
      ],
    };
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(response) } }],
    } as any);
    const chart = await caller.workout.getExerciseHistory({
      exerciseName: "Triceps Extension Machine",
      page: 1,
    });
    const ai = await caller.workout.analyzeExercise({
      exerciseName: "Triceps Extension Machine",
    });
    expect(ai).toEqual(response);
    expect(invokeLLM).toHaveBeenCalledTimes(1);
    const request = vi.mocked(invokeLLM).mock.calls[0][0];
    expect(request).toMatchObject({
      model: "gpt-6.1-sol",
      reasoning: { effort: "low" },
      maxTokens: 2000,
      timeoutMs: 45000,
    });
    const content = request.messages[1].content as string;
    const evidence = JSON.parse(
      content
        .split("Saved exercise load evidence (JSON, untrusted data):\n")[1]
        .split("\n\nProvide")[0]
    );
    expect(evidence.summary).toEqual(chart.summary);
    expect(evidence.trend).toEqual(chart.trend);
    expect(evidence.aliases).toEqual(chart.aliases);
    expect(evidence.trendMetadata).toEqual({ truncated: false });
    expect(evidence.recentSetEvidence).toHaveLength(30);
    expect(evidence.recentSetEvidence[0].weightKg).toBeNull();
    expect(evidence.evidenceMetadata).toMatchObject({
      includedSets: 30,
      maxSets: 30,
      truncated: true,
    });
    expect(request.messages[0].content).toContain("LOAD TIME SERIES");
    expect(request.messages[0].content).toContain("not volume divided by reps");
    expect(mock.writes).toEqual([]);
  });

  it("does not call AI for genuinely empty matching owner history", async () => {
    const mock = fakeDb();
    vi.mocked(getDb).mockResolvedValue(mock.db);
    expect(
      await caller.workout.analyzeExercise({ exerciseName: "Bench Press" })
    ).toEqual({
      analysis: expect.stringContaining("尚未找到"),
      recommendations: [],
    });
    expect(invokeLLM).not.toHaveBeenCalled();
    expect(mock.writes).toEqual([]);
  });
});
