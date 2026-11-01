import { useMemo, useState } from "react";
import { CheckCircle2, ClipboardPaste, Plus, RotateCcw, Trash2, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  isEmptySpreadsheetRow,
  pasteCellsIntoGrid,
  spreadsheetTextToRows,
  type SpreadsheetCell,
  type SpreadsheetColumn,
  type SpreadsheetSubmitResult,
} from "@shared/healthSpreadsheet";

export type PreparedSpreadsheetRow = {
  rowIndex: number;
  data?: Record<string, unknown>;
  errors: string[];
};

type HealthSpreadsheetEntryProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  columns: SpreadsheetColumn[];
  sourceLabel: string;
  prepareRow: (row: SpreadsheetCell, rowIndex: number) => PreparedSpreadsheetRow;
  submitRows: (rows: Array<{ rowIndex: number; data: Record<string, unknown> }>) => Promise<SpreadsheetSubmitResult[]>;
  onSuccess: () => void;
  initialRows?: number;
};

const emptyRows = (count: number) => Array.from({ length: count }, () => ({} as SpreadsheetCell));

export default function HealthSpreadsheetEntry({
  open,
  onOpenChange,
  title,
  description,
  columns,
  sourceLabel,
  prepareRow,
  submitRows,
  onSuccess,
  initialRows = 6,
}: HealthSpreadsheetEntryProps) {
  const [rows, setRows] = useState<SpreadsheetCell[]>(() => emptyRows(initialRows));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<Record<number, SpreadsheetSubmitResult>>({});

  const prepared = useMemo(
    () => rows.map((row, rowIndex) => prepareRow(row, rowIndex)),
    [rows, prepareRow],
  );
  const populated = prepared.filter((entry) => !isEmptySpreadsheetRow(rows[entry.rowIndex] ?? {}));
  const validRows = populated.filter((entry) => entry.errors.length === 0 && entry.data);
  const invalidRows = populated.filter((entry) => entry.errors.length > 0);

  const reset = () => {
    setRows(emptyRows(initialRows));
    setResults({});
  };

  const updateCell = (rowIndex: number, key: string, value: string) => {
    setResults({});
    setRows((current) => current.map((row, index) => index === rowIndex ? { ...row, [key]: value } : row));
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>, rowIndex: number, columnIndex: number) => {
    const text = event.clipboardData.getData("text/plain");
    if (!text.includes("\n") && !text.includes("\t")) return;
    event.preventDefault();
    setResults({});
    setRows((current) => {
      const parsedWithHeaders = rowIndex === 0 && columnIndex === 0
        ? spreadsheetTextToRows(text, columns)
        : null;
      const next = parsedWithHeaders?.length
        ? [...parsedWithHeaders, ...emptyRows(Math.max(2, initialRows - parsedWithHeaders.length))]
        : pasteCellsIntoGrid(current, text, rowIndex, columnIndex, columns);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!validRows.length) {
      toast.error("請先輸入至少一行完整有效的資料");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await submitRows(validRows.map((entry) => ({
        rowIndex: entry.rowIndex,
        data: entry.data!,
      })));
      const nextResults = Object.fromEntries(response.map((result) => [result.rowIndex, result]));
      setResults(nextResults);
      const succeeded = response.filter((result) => result.status !== "failed").length;
      if (succeeded) onSuccess();
      toast.success(`已完成 ${succeeded} 行；可保留畫面檢視每行結果`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "批量輸入未能完成，請稍後重試");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resultFor = (rowIndex: number) => results[rowIndex];

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { onOpenChange(nextOpen); if (!nextOpen) reset(); }}>
      <DialogContent className="max-h-[92dvh] max-w-[96vw] overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="border-b border-border/70 bg-gradient-to-r from-primary/10 via-card to-emerald-500/10 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/15 p-2 text-primary"><ClipboardPaste className="h-5 w-5" /></div>
            <div className="min-w-0">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription className="mt-1 max-w-3xl">{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[calc(92dvh-180px)] space-y-4 overflow-y-auto px-5 py-4 overscroll-contain">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
            <span className="font-semibold text-primary">Excel / Google Sheets 相容</span>
            <span className="text-muted-foreground">在第一格貼上含標題的 TSV／CSV，或從任何儲存格貼上多格資料。</span>
            <span className="rounded-full bg-background px-2 py-1 font-medium text-foreground">{sourceLabel}</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="w-max min-w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur">
                <tr>
                  <th className="sticky left-0 z-20 w-12 border-b border-r border-border bg-muted px-2 py-2 text-center text-[11px] font-semibold text-muted-foreground">行</th>
                  {columns.map((column) => (
                    <th key={column.key} className="min-w-32 border-b border-r border-border px-2 py-2 text-left text-[11px] font-semibold text-muted-foreground last:border-r-0">
                      {column.label}
                    </th>
                  ))}
                  <th className="w-10 border-b border-border px-1 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => {
                  const entry = prepared[rowIndex];
                  const result = resultFor(rowIndex);
                  const hasError = entry.errors.length > 0 && !isEmptySpreadsheetRow(row);
                  return (
                    <tr key={rowIndex} className={hasError ? "bg-destructive/5" : result?.status === "failed" ? "bg-destructive/5" : result ? "bg-emerald-500/5" : ""}>
                      <td className="sticky left-0 z-[1] border-b border-r border-border bg-inherit px-2 py-1 text-center text-xs font-medium text-muted-foreground">
                        <div className="flex flex-col items-center gap-0.5">
                          <span>{rowIndex + 1}</span>
                          {hasError || result?.status === "failed" ? <XCircle className="h-3.5 w-3.5 text-destructive" /> : result ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : null}
                        </div>
                      </td>
                      {columns.map((column, columnIndex) => (
                        <td key={column.key} className="border-b border-r border-border p-1 last:border-r-0">
                          <Input
                            aria-label={`第 ${rowIndex + 1} 行 ${column.label}`}
                            value={row[column.key] ?? ""}
                            onChange={(event) => updateCell(rowIndex, column.key, event.target.value)}
                            onPaste={(event) => handlePaste(event, rowIndex, columnIndex)}
                            className="h-8 min-w-32 border-0 bg-transparent px-2 text-xs shadow-none focus-visible:ring-1 focus-visible:ring-primary"
                          />
                        </td>
                      ))}
                      <td className="border-b border-border p-1 text-center">
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" aria-label={`移除第 ${rowIndex + 1} 行`} onClick={() => { setResults({}); setRows((current) => current.length === 1 ? [{}] : current.filter((_, index) => index !== rowIndex)); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {populated.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className={`rounded-lg px-3 py-2 text-xs ${invalidRows.length ? "border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300" : "border border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"}`}>
                <strong>{validRows.length}</strong> 行可提交{invalidRows.length ? `；${invalidRows.length} 行需要修正` : "；所有已輸入行均有效"}。
              </div>
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                {invalidRows.slice(0, 2).map((entry) => `第 ${entry.rowIndex + 1} 行：${entry.errors.join("；")}`).join("　") || "提交後會顯示每行新增、更新、同步或失敗的結果。"}
              </div>
            </div>
          )}

          {Object.keys(results).length > 0 && (
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs">
              <p className="mb-2 font-semibold text-foreground">提交結果</p>
              <div className="flex flex-wrap gap-2">
                {Object.values(results).sort((a, b) => a.rowIndex - b.rowIndex).map((result) => (
                  <span key={result.rowIndex} className={result.status === "failed" ? "rounded-full bg-destructive/10 px-2 py-1 text-destructive" : "rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-300"}>
                    第 {result.rowIndex + 1} 行：{result.status === "created" ? "已新增" : result.status === "updated" ? "已更新" : result.status === "synced" ? "已同步" : result.message || "失敗"}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border/70 bg-card px-5 py-3 sm:justify-between">
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => { setResults({}); setRows((current) => [...current, ...emptyRows(3)]); }}><Plus className="mr-1 h-3.5 w-3.5" />加入 3 行</Button>
            <Button type="button" size="sm" variant="ghost" onClick={reset}><RotateCcw className="mr-1 h-3.5 w-3.5" />清空</Button>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting || validRows.length === 0}>
              <Upload className="mr-1.5 h-4 w-4" />{isSubmitting ? "正在提交…" : `提交 ${validRows.length} 行`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
