/** One CSV cell: spreadsheet formulas from free text are neutralized, then the value is quoted if needed. */
export const csvCell = (v: string) => {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Rows → CSV text (CRLF, as spreadsheets expect). */
export const toCsv = (rows: string[][]) => rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
