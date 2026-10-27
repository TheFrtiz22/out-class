/** JSON object key order is not an edit. Array order and every value are. */
export function editorValue(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}
export function sameEditorBase(a: string, b: string): boolean {
  if (a === b) return true;
  try { return editorValue(JSON.parse(a)) === editorValue(JSON.parse(b)); } catch { return false; }
}
