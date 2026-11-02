import type { SpreadsheetSubmitResult } from "@shared/healthSpreadsheet";

export type SpreadsheetBatchRow<T extends Record<string, unknown>> = {
  rowIndex: number;
  data: T;
};

export type SupabaseBatchStatus = "created" | "updated";

/**
 * Persists each validated spreadsheet row independently in Supabase.
 * A malformed or conflicting row reports its own error but never prevents the other rows
 * in the same paste from being saved.
 */
export async function persistSupabaseBatch<T extends Record<string, unknown>>(
  rows: SpreadsheetBatchRow<T>[],
  persistRow: (row: T) => Promise<SupabaseBatchStatus>,
): Promise<SpreadsheetSubmitResult[]> {
  const results: SpreadsheetSubmitResult[] = [];
  for (const { rowIndex, data } of rows) {
    try {
      results.push({ rowIndex, status: await persistRow(data) });
    } catch (error) {
      results.push({
        rowIndex,
        status: "failed",
        message: error instanceof Error ? error.message : "未能儲存至 Supabase",
      });
    }
  }
  return results;
}
