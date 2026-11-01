export type SpreadsheetCell = Record<string, string>;

export type SpreadsheetColumn = {
  key: string;
  label: string;
  aliases?: string[];
};

export type SpreadsheetSubmitResult = {
  rowIndex: number;
  status: "created" | "updated" | "synced" | "failed" | "skipped";
  message?: string;
};

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

/** Parses an Excel/Google Sheets TSV or a standard CSV string without importing a large spreadsheet library. */
export function parseSpreadsheetText(text: string): string[][] {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];
  const firstLine = normalized.split("\n")[0] ?? "";
  const delimiter = firstLine.includes("\t") ? "\t" : ",";
  return normalized
    .split("\n")
    .map((line) => parseDelimitedLine(line, delimiter))
    .filter((row) => row.some((cell) => cell.trim().length > 0));
}

function normalizedHeader(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[\s_\-()（）/%]+/g, "");
}

function columnForHeader(header: string, columns: SpreadsheetColumn[]): SpreadsheetColumn | undefined {
  const normal = normalizedHeader(header);
  return columns.find((column) =>
    [column.key, column.label, ...(column.aliases ?? [])]
      .some((candidate) => normalizedHeader(candidate) === normal)
  );
}

/**
 * Converts an entire pasted block into the grid's field keys. If the first row resembles headers,
 * columns are matched by name; otherwise data follows the visible left-to-right table order.
 */
export function spreadsheetTextToRows(text: string, columns: SpreadsheetColumn[]): SpreadsheetCell[] {
  const matrix = parseSpreadsheetText(text);
  if (!matrix.length) return [];

  const headerMatches = matrix[0]
    .map((cell) => columnForHeader(cell, columns))
    .filter(Boolean);
  const hasHeader = headerMatches.length >= Math.min(2, columns.length);
  const headers = hasHeader ? matrix[0] : columns.map((column) => column.key);
  const dataRows = hasHeader ? matrix.slice(1) : matrix;

  return dataRows.map((cells) => {
    const row: SpreadsheetCell = {};
    cells.forEach((cell, index) => {
      const column = hasHeader ? columnForHeader(headers[index] ?? "", columns) : columns[index];
      if (column) row[column.key] = cell.trim();
    });
    return row;
  }).filter((row) => Object.values(row).some((cell) => cell.length > 0));
}

/** Maps a pasted block to cells beginning at a specific row/column, matching native spreadsheet paste behaviour. */
export function pasteCellsIntoGrid(
  currentRows: SpreadsheetCell[],
  text: string,
  startRow: number,
  startColumn: number,
  columns: SpreadsheetColumn[],
): SpreadsheetCell[] {
  const cells = parseSpreadsheetText(text);
  const rows = currentRows.map((row) => ({ ...row }));
  const requiredLength = startRow + cells.length;
  while (rows.length < requiredLength) rows.push({});

  cells.forEach((pastedRow, rowOffset) => {
    pastedRow.forEach((value, columnOffset) => {
      const column = columns[startColumn + columnOffset];
      if (column) rows[startRow + rowOffset][column.key] = value.trim();
    });
  });

  return rows;
}

export function isEmptySpreadsheetRow(row: SpreadsheetCell): boolean {
  return Object.values(row).every((value) => !value.trim());
}

function isRealCalendarDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * All app-level calendar dates are Hong Kong dates, never browser-local timestamps.
 * ISO is preferred; slash and dot forms follow the common Hong Kong day/month/year convention.
 */
export function normalizeHKDate(value: string): string | null {
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) {
    const normalized = `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    return isRealCalendarDate(normalized) ? normalized : null;
  }

  const dmy = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    const normalized = `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
    return isRealCalendarDate(normalized) ? normalized : null;
  }

  return null;
}

/** Converts an Excel local date/time to an explicit Asia/Hong_Kong ISO timestamp for the API. */
export function normalizeHKDateTime(value: string): string | null {
  const trimmed = value.trim().replace(" ", "T");
  const match = trimmed.match(/^(.+?)[T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const date = normalizeHKDate(match[1]);
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  const second = Number(match[4] ?? "0");
  if (!date || hour > 23 || minute > 59 || second > 59) return null;
  return `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}+08:00`;
}

export function optionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function fieldNumberError(value: string, label: string, min?: number, max?: number, integer = false): string | null {
  if (!value.trim()) return null;
  const parsed = optionalNumber(value);
  if (parsed === undefined) return `${label} 必須為數字`;
  if (integer && !Number.isInteger(parsed)) return `${label} 必須為整數`;
  if (min !== undefined && parsed < min) return `${label} 不可低於 ${min}`;
  if (max !== undefined && parsed > max) return `${label} 不可高於 ${max}`;
  return null;
}
