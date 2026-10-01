export type CsvColumn<T> = { header: string; value: (row: T) => string | number | null | undefined };

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [
    columns.map((c) => csvCell(c.header)).join(';'),
    ...rows.map((row) => columns.map((c) => csvCell(c.value(row))).join(';')),
  ];
  return `﻿${lines.join('\r\n')}\r\n`;
}
