/** RFC 4180 CSV with spreadsheet formula-injection protection. A text cell that
 * begins with = + - @ (or a tab/CR) is prefixed with an apostrophe so Excel,
 * Numbers and Google Sheets show it as text instead of evaluating it. */
export type CsvCell = string | number | null | undefined

export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : ""
  let text = value
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(header: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  // Leading BOM so Excel opens UTF-8 names correctly.
  return "﻿" + [header, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n"
}

export function csvFilename(clubName: string, kind: string, now = new Date()) {
  const slug = clubName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "club"
  return `${slug}-${kind}-${now.toISOString().slice(0, 10)}.csv`
}
