/**
 * Leader-private data (notes, evaluations, ballots, resumes) lives only here and in the query
 * cache: in memory, never written to disk. Everything registered is cleared on sign-out, on an
 * account change, and after the app has been in the background past its timeout (lib/auth.tsx).
 */
const stores = new Set<() => void>();

export function registerPrivateStore(clear: () => void): () => void {
  stores.add(clear);
  return () => { stores.delete(clear); };
}

export function clearPrivateMemory() {
  for (const clear of stores) { try { clear(); } catch { /* keep clearing the rest */ } }
}
