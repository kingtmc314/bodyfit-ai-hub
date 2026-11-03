import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";
import { loadRunningHistory } from "./runningContinuousAnalysis";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({ getDb: vi.fn(), getPool: vi.fn() }));
vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));
const dialect = new PgDialect();
const queries: Array<{ sql: string; params: unknown[] }> = [];
const start = Date.parse("2026-10-02T00:00:00Z");
const samples = Array.from({ length: 601 }, (_, elapsedSec) => ({ elapsedSec, timestamp: new Date(start + elapsedSec * 1000).toISOString(), paceSecPerKm: 300, heartRate: 150, cadence: 180 }));
const fixtureRows = Array.from({ length: 65 }, (_, i) => ({
  id: i + 1, date: i === 0 ? "2020-01-01" : "2026-10-02", average_pace: "6:00", running_type: "Easy", route_type: "Road", distance_km: "10", minutes: 10,
  source_format: i === 64 ? "FIT" : null, source_sample_count: i === 64 ? 601 : null, time_series: i === 64 ? samples : [],
  running_shoes: "Daily trainer", average_heart_rate: null, maximum_heart_rate: null,
  garmin_details: { rawFileUrl: "https://private.invalid/raw?token=secret", rawFileHash: "hash-private" },
}));
function fakeDb() {
  return { execute: vi.fn(async (query: any) => {
    const rendered = dialect.sqlToQuery(query);
    queries.push(rendered);
    if (/COUNT\(\*\) AS total, MAX\(id\)/.test(rendered.sql)) return { rows: [{ total: fixtureRows.length, max_id: fixtureRows.length }] };
    if (/FROM running_logs WHERE id >/.test(rendered.sql)) {
      const cursor = Number(rendered.params[0]);
      return { rows: fixtureRows.filter(r => r.id > cursor && r.id <= Number(rendered.params[1]) && r.date <= String(rendered.params[2])).slice(0, 20) };
    }
    if (/SELECT \* FROM races WHERE id/.test(rendered.sql)) return { rows: [{ id: 7, race_name: "Fixture race", date: "2026-10-05", distance_km: "10" }] };
    return { rows: [] };
  }) };
}
const caller = appRouter.createCaller({ user: null, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] });

beforeEach(() => {
  vi.resetAllMocks(); queries.length = 0;
  vi.mocked(getDb).mockResolvedValue(fakeDb() as any);
  vi.mocked(invokeLLM).mockResolvedValue({ id: "fixture", created: 0, model: "gpt-6.1-sol", choices: [{ index: 0, message: { role: "assistant", content: "fixture-only response" }, finish_reason: "stop" }] });
});
function prompt() {
  return JSON.stringify(vi.mocked(invokeLLM).mock.calls[0]?.[0].messages);
}
function expectReadonlyPaginatedRunningQueries() {
  const running = queries.filter(q => /FROM running_logs/.test(q.sql));
  expect(running.length).toBeGreaterThan(1);
  for (const query of running) {
    expect(query.sql).toMatch(/LIMIT\s+(?:\d+|\$\d+)/);
    expect(query.sql).not.toMatch(/user_id|SELECT \*/);
    expect(query.sql).not.toMatch(/INSERT|UPDATE|DELETE/);
  }
  const pages = running.filter(q => /WHERE id >/.test(q.sql));
  expect(pages.map(q => Number(q.params[0]))).toEqual([0, 20, 40, 60]);
  expect(pages.every(q => /ORDER BY id ASC LIMIT 20/.test(q.sql))).toBe(true);
}

describe("running endpoints consume full-history continuous evidence", () => {
  it("AI analysis sends derived FIT features for every history row, not 30 recent rows or raw JSON", async () => {
    await caller.running.getAIAnalysis({ weeks: 12 });
    expect(prompt()).toContain('\\"processedRuns\\":65');
    expect(prompt()).toContain('\\"perRunIncluded\\":65');
    expect(prompt()).toContain('\\"id\\":1,');
    expect(prompt()).toContain('\\"id\\":65,');
    expect(prompt()).toContain("2020-01-01");
    expect(prompt()).toContain("movingPace");
    expect(prompt()).toContain("decouplingPct");
    expect(prompt()).toContain("心率漂移");
    expect(prompt()).not.toContain("private.invalid");
    expect(prompt()).not.toContain("hash-private");
    expect(prompt()).not.toContain("timestamp");
    expect(prompt()).not.toContain("elapsedSec");
    expect(vi.mocked(invokeLLM).mock.calls[0][0].model).toBe("gpt-6.1-sol");
    expect(vi.mocked(invokeLLM).mock.calls[0][0].reasoning).toEqual({ effort: "low" });
    expect(vi.mocked(invokeLLM).mock.calls[0][0].maxTokens).toBe(2200);
    expect(vi.mocked(invokeLLM).mock.calls[0][0].timeoutMs).toBe(45000);
    expectReadonlyPaginatedRunningQueries();
  });

  it("lab returns only compact continuous evidence for all rows and keeps null HR/resting data honest", async () => {
    const result = await caller.running.getLabPersonalization();
    expect(result.historicalRuns).toHaveLength(65);
    expect(result.historicalRuns.at(-1)?.continuous?.meanMovingPaceSecPerKm).toBe(300);
    expect(result.historicalRuns[0].paceSecPerKm).toBe(360);
    expect(result.historicalRuns[0].averageHeartRate).toBeNull();
    expect(result.maxHeartRate).toBeNull();
    expect(result.restingHeartRate).toBeNull();
    expect(JSON.stringify(result)).not.toContain("timestamp");
    expect(JSON.stringify(result)).not.toContain("private.invalid");
    expectReadonlyPaginatedRunningQueries();
  });

  it("race analysis uses the same FIT context and all dated pre-race history without 50-run cap", async () => {
    await caller.running.analyzeRace({ raceId: 7 });
    expect(prompt()).toContain('\\"perRunIncluded\\":65');
    expect(prompt()).toContain('\\"id\\":65,');
    expect(prompt()).toContain("2020-01-01");
    expect(prompt()).toContain("2026-10-05");
    expect(prompt()).toContain("movingPace");
    expect(prompt()).toContain("心率漂移");
    expect(prompt()).not.toContain("private.invalid");
    expect(vi.mocked(invokeLLM).mock.calls[0][0].reasoning).toEqual({ effort: "low" });
    expect(vi.mocked(invokeLLM).mock.calls[0][0].maxTokens).toBe(2200);
    expect(vi.mocked(invokeLLM).mock.calls[0][0].timeoutMs).toBe(45000);
    expectReadonlyPaginatedRunningQueries();
    expect(queries.filter(q => /WHERE id >/.test(q.sql)).every(q => q.params[2] === "2026-10-05")).toBe(true);
  });

  it("reports incomplete snapshot honestly if rows disappear during paginated reads", async () => {
    const db = fakeDb();
    db.execute.mockImplementationOnce(async query => {
      queries.push(dialect.sqlToQuery(query));
      return { rows: [{ total: 66, max_id: 66 }] };
    });
    const history = await loadRunningHistory(db, "2026-11-03");
    expect(history.coverage.totalRuns).toBe(66);
    expect(history.coverage.processedRuns).toBe(65);
    expect(history.coverage.complete).toBe(false);
  });
});
