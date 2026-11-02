import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const routerSource = fs.readFileSync(path.join(projectRoot, "server/routers.ts"), "utf8");
const schemaSource = fs.readFileSync(path.join(projectRoot, "drizzle/schema.ts"), "utf8");

function sourceBlock(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) throw new Error(`Unable to find ${start}`);
  return source.slice(startIndex, endIndex);
}

describe("running data display schema contract", () => {
  it("keeps the legacy running log schema explicitly free of a user_id column", () => {
    const runningLogSchema = sourceBlock(schemaSource, 'export const runningLogs = pgTable("running_logs"', "export type RunningLog");
    expect(runningLogSchema).not.toContain("userId:");
    expect(runningLogSchema).not.toContain('integer("user_id")');
  });

  it("does not apply a user_id filter to legacy running log reads", () => {
    const getLogs = sourceBlock(routerSource, "  getLogs: publicProcedure", "  getLogsPage: publicProcedure");
    const getLogsPage = sourceBlock(routerSource, "  getLogsPage: publicProcedure", "  getShoePerformance: publicProcedure");
    const healthBrief = sourceBlock(routerSource, "  getGarminHealthBrief: publicProcedure", "  getGarminRunDetail: publicProcedure");
    const labPersonalization = sourceBlock(routerSource, "  getLabPersonalization: publicProcedure", "  lookupHistoricalWeather: ownerProcedure");

    expect(getLogs).toContain("SELECT * FROM running_logs ORDER BY date DESC");
    expect(getLogs).not.toMatch(/FROM running_logs\s+WHERE\s+user_id/i);
    expect(getLogsPage).toContain("const conditions = []");
    expect(getLogsPage).not.toMatch(/conditions\s*=\s*\[sql`user_id/i);
    expect(healthBrief).not.toContain("FROM running_logs\n          WHERE user_id");
    expect(labPersonalization).not.toContain("FROM running_logs\n          WHERE user_id");
  });
});
