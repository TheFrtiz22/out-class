import { normalizeSchoolIdentifier } from "@/lib/club-onboarding";

export const ROSTER_MAX_BYTES = 1024 * 1024;
export const ROSTER_MAX_ROWS = 1000;
export type RosterInputRow = { name: string; year: string; computing_id: string };
export type RosterRow = {
  rowNumber: number; input: RosterInputRow; name: string; year: string;
  identifier: string; normalizedIdentifier: string | null;
  status: "READY" | "INVALID" | "DUPLICATE" | "ALREADY_MEMBER" | "ALREADY_INVITED";
  errors: string[]; warnings: string[]; existingUser: boolean;
};

/** Strict comma-separated CSV, including escaped quotes and quoted newlines. */
export function parseRosterCsv(text: string): RosterInputRow[] {
  if (new TextEncoder().encode(text).length > ROSTER_MAX_BYTES) throw new Error("CSV must be 1 MB or smaller.");
  if (text.includes("\0")) throw new Error("CSV contains unsupported binary content.");
  text = text.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let record: string[] = [], cell = "", state: "plain" | "quoted" | "closed" = "plain";
  function finishCell() {
    record.push(cell); cell = ""; state = "plain";
    if (record.length > 3) throw new Error("CSV must contain only name, year, and computing_id columns.");
  }
  function finishRecord() {
    finishCell();
    if (record.length > 1 || record.some(value => value.trim())) records.push(record);
    record = [];
    if (records.length > ROSTER_MAX_ROWS + 1) throw new Error(`CSV cannot exceed ${ROSTER_MAX_ROWS} data rows.`);
  }
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (state === "quoted") {
      if (char === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else state = "closed";
      } else cell += char;
    } else if (char === ",") finishCell();
    else if (char === "\r" || char === "\n") { finishRecord(); if (char === "\r" && text[i + 1] === "\n") i++; }
    else if (char === '"' && state === "plain" && cell === "") state = "quoted";
    else {
      if (state === "closed" || char === '"') throw new Error("Malformed CSV quoting. Export the file as comma-separated CSV again.");
      cell += char;
    }
    if (cell.length > 2000) throw new Error("CSV cells cannot exceed 2,000 characters.");
  }
  if (state === "quoted") throw new Error("CSV contains an unclosed quoted field.");
  if (cell || record.length || state === "closed") finishRecord();
  const headers = records.shift();
  if (!headers) throw new Error("CSV is empty.");
  const aliases: Record<string, keyof RosterInputRow> = { name: "name", fullname: "name", year: "year", graduationyear: "year", gradyear: "year", computingid: "computing_id" };
  const columns = headers.map(header => {
    const key = header.trim().toLowerCase().replace(/[ _-]/g, "");
    if (!Object.hasOwn(aliases, key)) throw new Error(`Unsupported column: ${header.slice(0, 80)}. Use name, year, computing_id.`);
    return aliases[key];
  });
  if (new Set(columns).size !== columns.length) throw new Error("CSV has duplicate column headers.");
  if (!columns.includes("name") || !columns.includes("computing_id")) throw new Error("CSV requires name and computing_id columns. Year is optional.");
  if (!records.length) throw new Error("CSV contains no data rows.");
  return records.map((values, index) => {
    if (values.length !== columns.length) throw new Error(`Data row ${index + 1} has ${values.length} columns; expected ${columns.length}.`);
    const row: RosterInputRow = { name: "", year: "", computing_id: "" };
    columns.forEach((column, i) => { row[column] = values[i]; });
    return row;
  });
}

export function validateRosterRows(inputs: readonly RosterInputRow[], config: { normalization: "TRIM_LOWERCASE" | "TRIM"; validationRegex: string | null }): RosterRow[] {
  const seen = new Set<string>();
  return inputs.map((input, i) => {
    const name = input.name.trim(), year = input.year.trim(), identifier = input.computing_id.replace(/^ +| +$/g, "");
    const errors: string[] = [], warnings: string[] = [];
    let normalizedIdentifier: string | null = null;
    if (!name) errors.push("Missing name");
    else if (name.length > 200 || /[\x00-\x1f\x7f\uFFFD]/.test(input.name) || /^[=+@-]/.test(name) || !/[\p{L}\p{N}]/u.test(name)) errors.push("Malformed name");
    if (!identifier) errors.push("Missing computing ID");
    else try { normalizedIdentifier = normalizeSchoolIdentifier(identifier, config); } catch { errors.push("Malformed computing ID"); }
    if (!year) warnings.push("Missing year");
    else if (!/^(202[5-9]|2030)$/.test(year)) errors.push("Unsupported year; use 2025–2030 or leave blank");
    const duplicate = normalizedIdentifier !== null && seen.has(normalizedIdentifier);
    // Invalid rows never reserve an identity and prevent a later valid row from being used.
    if (normalizedIdentifier && !errors.length) seen.add(normalizedIdentifier);
    if (duplicate) errors.push("Duplicate computing ID in upload");
    return { rowNumber: i + 1, input, name, year, identifier, normalizedIdentifier,
      status: errors.length ? duplicate && errors.length === 1 ? "DUPLICATE" : "INVALID" : "READY", errors, warnings, existingUser: false };
  });
}

export function rosterSummary(rows: readonly RosterRow[]) {
  return { total: rows.length, ready: rows.filter(r => r.status === "READY").length,
    duplicates: rows.filter(r => r.status === "DUPLICATE").length, invalid: rows.filter(r => r.status === "INVALID").length,
    alreadyMember: rows.filter(r => r.status === "ALREADY_MEMBER").length,
    alreadyInvited: rows.filter(r => r.status === "ALREADY_INVITED").length };
}
