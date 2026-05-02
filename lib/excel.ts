import * as XLSX from "xlsx";

export type ParsedExcel = {
  sheets: Array<{
    name: string;
    rows: unknown[];
  }>;
};

/** Sheet name used for schedule import (case-insensitive). */
export const PERECHEN_SHEET_LC = "перечень";

/**
 * Parse workbook: only the **Перечень** sheet is kept (other sheets ignored).
 * If the sheet is missing, the first worksheet is used as a fallback.
 */
export function parseXlsxBuffer(buf: Buffer): ParsedExcel {
  const wb = XLSX.read(buf, { type: "buffer" });
  const preferred = wb.SheetNames.find((n) => String(n).trim().toLowerCase() === PERECHEN_SHEET_LC);
  const names = preferred ? [preferred] : wb.SheetNames.length ? [wb.SheetNames[0]!] : [];
  const sheets = names.map((name) => {
    const ws = wb.Sheets[name]!;
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
    return { name, rows };
  });
  return { sheets };
}

/** Rows from active project `excel_json` (prefers лист «Перечень», else first sheet). */
export function rowsFromProjectExcelJson(excelJson: unknown): unknown[] {
  const sheets = (excelJson as ParsedExcel | null | undefined)?.sheets;
  if (!Array.isArray(sheets) || sheets.length === 0) return [];
  const perechen = sheets.find((s) => s?.name && String(s.name).trim().toLowerCase() === PERECHEN_SHEET_LC);
  if (perechen && Array.isArray(perechen.rows)) return perechen.rows;
  const first = sheets[0];
  return Array.isArray(first?.rows) ? first.rows : [];
}

