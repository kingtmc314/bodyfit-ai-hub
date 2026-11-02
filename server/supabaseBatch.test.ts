import { describe, expect, it } from "vitest";
import { persistSupabaseBatch } from "./supabaseBatch";

describe("Supabase spreadsheet batch persistence", () => {
  it("persists every valid row without requiring a Google Sheets request", async () => {
    const saved: string[] = [];
    const results = await persistSupabaseBatch(
      [
        { rowIndex: 0, data: { date: "2026-11-01", value: 70.1 } },
        { rowIndex: 1, data: { date: "2026-11-02", value: 69.9 } },
      ],
      async (row) => {
        saved.push(row.date);
        return "created";
      },
    );

    expect(saved).toEqual(["2026-11-01", "2026-11-02"]);
    expect(results).toEqual([
      { rowIndex: 0, status: "created" },
      { rowIndex: 1, status: "created" },
    ]);
  });

  it("reports only a failing row and continues saving subsequent rows", async () => {
    const results = await persistSupabaseBatch(
      [
        { rowIndex: 0, data: { date: "2026-11-01" } },
        { rowIndex: 1, data: { date: "2026-11-02" } },
        { rowIndex: 2, data: { date: "2026-11-03" } },
      ],
      async (row) => {
        if (row.date === "2026-11-02") throw new Error("invalid measurement");
        return row.date === "2026-11-03" ? "updated" : "created";
      },
    );

    expect(results).toEqual([
      { rowIndex: 0, status: "created" },
      { rowIndex: 1, status: "failed", message: "invalid measurement" },
      { rowIndex: 2, status: "updated" },
    ]);
  });
});
