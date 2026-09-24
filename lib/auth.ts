/** Exact UVA domain only; reject lookalike domains, whitespace, and malformed addresses. */
export function isUvaEmail(value: string): boolean {
  return /^[a-z0-9]+(?:[._+-][a-z0-9]+)*@virginia\.edu$/i.test(value.trim())
}

/** Keep sign-in return destinations on this origin. */
export function safeReturnPath(raw: string | null | undefined): string {
  const value = raw?.trim() || "/"
  return !value.startsWith("/") || value.startsWith("//") || value.includes("://") || /[\\\x00-\x20]/.test(value) ? "/" : value
}
