// No imports: client components and tests load this without the asset or schema modules.
const MINOR_WORDS = new Set(["of", "the", "and", "at", "for", "in", "a", "an", "&"]);
/** The letters shown when a club has no logo: up to three initials, skipping minor words ("Club of Investing" -> "CI"). */
export function clubMonogram(name: string | null | undefined) {
  const clean = (name ?? "").trim();
  const words = clean.split(/\s+/).filter(word => word && !MINOR_WORDS.has(word.toLowerCase()));
  return (words.length ? words : [clean]).slice(0, 3).map(word => Array.from(word.replace(/[^\p{L}\p{N}]/gu, ""))[0] ?? "").join("").toUpperCase() || "OC";
}
