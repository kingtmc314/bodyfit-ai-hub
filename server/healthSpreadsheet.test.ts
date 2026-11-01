import { describe, expect, it } from "vitest";
import {
  normalizeHKDate,
  normalizeHKDateTime,
  pasteCellsIntoGrid,
  spreadsheetTextToRows,
} from "../shared/healthSpreadsheet";
import { HEALTH_SPREADSHEET_COLUMNS, prepareHealthSpreadsheetRow } from "../client/src/lib/healthSpreadsheetRows";

describe("Excel-style health spreadsheet entry", () => {
  it("maps English or Chinese-style header columns from a pasted TSV block", () => {
    const rows = spreadsheetTextToRows(
      "Date\tSteps\tFloors climbed\tDistance (km)\n2026-10-30\t12,345\t18\t8.75",
      HEALTH_SPREADSHEET_COLUMNS.steps,
    );
    expect(rows).toEqual([{ date: "2026-10-30", steps: "12,345", floorsClimbed: "18", distanceKm: "8.75" }]);
  });

  it("preserves native multi-cell paste behaviour from any grid cell", () => {
    const rows = pasteCellsIntoGrid([{}, {}], "2026-10-31\t10000\t8\n2026-11-01\t9000\t5", 0, 0, HEALTH_SPREADSHEET_COLUMNS.steps);
    expect(rows[0]).toMatchObject({ date: "2026-10-31", steps: "10000", floorsClimbed: "8" });
    expect(rows[1]).toMatchObject({ date: "2026-11-01", steps: "9000", floorsClimbed: "5" });
  });

  it("normalizes Hong Kong calendar dates and rejects impossible dates", () => {
    expect(normalizeHKDate("31/10/2026")).toBe("2026-10-31");
    expect(normalizeHKDate("2026.11.01")).toBe("2026-11-01");
    expect(normalizeHKDate("2026-02-30")).toBeNull();
    expect(normalizeHKDateTime("01/11/2026 07:45")).toBe("2026-11-01T07:45:00+08:00");
  });

  it("prepares a valid sleep grid row with Chinese quality text and all recovery fields", () => {
    const prepared = prepareHealthSpreadsheetRow("sleep", {
      date: "01/11/2026", score: "88", duration: "7.5", quality: "良好", hrv: "62", restingHr: "49", bedtime: "23:10", waketime: "06:40",
    }, 2);
    expect(prepared.errors).toEqual([]);
    expect(prepared.data).toMatchObject({ date: "2026-11-01", score: 88, duration: 7.5, quality: "Good", hrv: 62, restingHr: 49, bedtime: "23:10", waketime: "06:40" });
  });

  it("prepares explicit Asia/Hong_Kong timestamps for blood-pressure rows", () => {
    const prepared = prepareHealthSpreadsheetRow("bloodPressure", {
      measuredAt: "2026-11-01 20:30", systolic: "118", diastolic: "76", pulse: "54",
    }, 0);
    expect(prepared.errors).toEqual([]);
    expect(prepared.data).toMatchObject({ measuredAt: "2026-11-01T20:30:00+08:00", systolic: 118, diastolic: 76, pulse: 54 });
  });

  it("flags an out-of-range health value before submission", () => {
    const prepared = prepareHealthSpreadsheetRow("heartRate", { date: "2026-11-01", restingHr: "999" }, 0);
    expect(prepared.errors.join(" ")).toContain("靜息心率");
  });
});
