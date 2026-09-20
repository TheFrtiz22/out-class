/** Exact UVA domain only; reject lookalike domains, whitespace, and malformed addresses. */
export function isUvaEmail(value: string): boolean {
  return /^[a-z0-9]+(?:[._+-][a-z0-9]+)*@virginia\.edu$/i.test(value.trim())
}
