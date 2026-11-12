/**
 * Local recovery copies for autosaving editors. The server stays authoritative:
 * a copy only holds edits that have not been acknowledged yet, and it is offered
 * back through the caller's revision/conflict checks, never applied silently.
 *
 * - "device": localStorage (survives a browser restart) plus sessionStorage.
 * - "tab": sessionStorage only. Screens holding private data about other students
 *   (review notes, voting setup, task feedback, interview notes) use this.
 * Every copy is bound to its owner; sign-out and a different signed-in account clear them
 * (including the older v1 tab-only copies). Interview-room notes use their own encrypted IndexedDB
 * copy (lib/interview-offline-notes.ts); the same sign-out, account-switch and expiry rules clear it.
 */
import { clearOfflineNotes, hasPendingOfflineNotes, purgeOfflineNotes } from "@/lib/interview-offline-notes"
export type DraftPersistence = "device" | "tab"
export type DraftRecord<T = unknown> = { v: 2; owner: string; value: T; baseline: string; writer: string; at: number; revision?: number }
export type StoredDraft<T = unknown> = DraftRecord<T> & { source: "tab" | "device" }
/** Where the newest write landed: "device" or "tab", or false when storage is unavailable. */
export type DraftWriteResult = DraftPersistence | false

export const AUTOSAVE_PREFIX = "outclass:autosave:"
const MAX_AGE = 7 * 86400000
const OWNER = /^[A-Za-z0-9_.@-]{1,120}$/

function storage(kind: "localStorage" | "sessionStorage"): Storage | null {
  try { return (globalThis as unknown as Record<string, Storage | undefined>)[kind] ?? null } catch { return null }
}
/** A real, signed-in account id. Demo, preview and anonymous editors get no device copy. */
export function validDraftOwner(owner: string | null | undefined): owner is string {
  return typeof owner === "string" && owner !== "undefined" && owner !== "null" && OWNER.test(owner)
}
export function draftStorageKey(owner: string, identity: string) { return `${AUTOSAVE_PREFIX}v2:${owner}:${identity}` }

function parse<T>(raw: string | null, owner: string, now: number): DraftRecord<T> | null {
  if (!raw) return null
  try {
    const record = JSON.parse(raw) as DraftRecord<T>
    if (record?.v !== 2 || record.owner !== owner || typeof record.at !== "number" || now - record.at > MAX_AGE || typeof record.baseline !== "string") return null
    return record
  } catch { return null }
}

export function createDraftStore<T>({ owner, identity, persistence }: { owner: string; identity: string; persistence: DraftPersistence }) {
  const key = draftStorageKey(owner, identity)
  const stores = () => ({ tab: storage("sessionStorage"), device: persistence === "device" ? storage("localStorage") : null })
  return {
    key,
    read(now = Date.now()): StoredDraft<T> | null {
      const { tab, device } = stores()
      let tabRecord: DraftRecord<T> | null = null, deviceRecord: DraftRecord<T> | null = null
      try { const raw = tab?.getItem(key) ?? null; tabRecord = parse<T>(raw, owner, now); if (raw && !tabRecord) tab?.removeItem(key) } catch { /* Unavailable storage never blocks editing. */ }
      try { const raw = device?.getItem(key) ?? null; deviceRecord = parse<T>(raw, owner, now); if (raw && !deviceRecord) device?.removeItem(key) } catch { /* Unavailable storage never blocks editing. */ }
      if (tabRecord && (!deviceRecord || tabRecord.at >= deviceRecord.at)) return { ...tabRecord, source: "tab" }
      return deviceRecord ? { ...deviceRecord, source: "device" } : null
    },
    write(record: Omit<DraftRecord<T>, "v" | "owner">): DraftWriteResult {
      // After an explicit sign-out cleared the copies, late writes (beforeunload, a last keystroke) are dropped.
      if (sealed) return false
      const { tab, device } = stores(), text = JSON.stringify({ ...record, v: 2, owner })
      let result: DraftWriteResult = false
      try { tab?.setItem(key, text); if (tab) result = "tab" } catch { /* Quota or blocked storage. */ }
      try { device?.setItem(key, text); if (device) result = "device" } catch { /* Quota or blocked storage. */ }
      return result
    },
    /** Remove the copy. With `writer`, only a copy written by that writer (another tab's newer copy survives). */
    clear(writer?: string) {
      const { tab, device } = stores()
      for (const store of [tab, device]) {
        try {
          if (!store) continue
          if (writer) { const raw = store.getItem(key); const current = raw ? JSON.parse(raw) : null; if (current && current.writer !== writer) continue }
          store.removeItem(key)
        } catch { try { store?.removeItem(key) } catch { /* Ignore. */ } }
      }
    },
  }
}

const OWNER_MARKER = `${AUTOSAVE_PREFIX}owner`
let sealed = false

function autosaveKeys(store: Storage) {
  const keys: string[] = []
  for (let i = 0; i < store.length; i++) { const key = store.key(i); if (key?.startsWith(AUTOSAVE_PREFIX)) keys.push(key) }
  return keys
}
/** True while any unsaved recovery copy exists in this browser (any editor, any record). */
export function hasUnsavedAutosaveCopies() {
  for (const store of [storage("localStorage"), storage("sessionStorage")]) {
    try { if (store && autosaveKeys(store).some(key => key !== OWNER_MARKER)) return true } catch { /* Ignore. */ }
  }
  return hasPendingOfflineNotes()
}
/**
 * Explicit sign-out from this tab. Copies are kept on a passive SIGNED_OUT (expiry, revocation,
 * another tab): they are owner-keyed, and adoptAutosaveOwner clears them if another account signs in.
 * "clean": nothing unsaved. "flushed": everything saved within the timeout. "discard": the user
 * confirmed discarding. "cancel": keep the session and the copies.
 */
export async function prepareSignOut({ flush, confirm, timeoutMs = 3000 }: { flush: () => Promise<void>; confirm: () => Promise<boolean>; timeoutMs?: number }): Promise<"clean" | "flushed" | "discard" | "cancel"> {
  if (!hasUnsavedAutosaveCopies()) return "clean"
  let timer: ReturnType<typeof setTimeout> | undefined
  try { await Promise.race([flush().catch(() => {}), new Promise<void>(resolve => { timer = setTimeout(resolve, timeoutMs) })]) }
  finally { if (timer) clearTimeout(timer) }
  if (!hasUnsavedAutosaveCopies()) return "flushed"
  return (await confirm()) ? "discard" : "cancel"
}
/**
 * Clear every copy after a confirmed explicit sign-out, and refuse further writes from this page.
 * Await it before navigating away: the encrypted interview-notes copy is deleted asynchronously.
 */
export function sealAutosaveDraftsForSignOut(timeoutMs = 2000): Promise<void> {
  sealed = true; clearStorageCopies()
  // A blocked IndexedDB never holds sign-out hostage; the next signed-in load purges other accounts' copies.
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([clearOfflineNotes({ seal: true }), new Promise<void>(resolve => { timer = setTimeout(resolve, timeoutMs) })]).finally(() => clearTimeout(timer))
}
/** Test hook: a fresh page load starts unsealed. */
export function resetAutosaveSealForTests() { sealed = false }

/** Remove every recovery copy (both storages, IndexedDB interview notes, every account) and the owner marker. */
export function clearAutosaveDrafts() { clearStorageCopies(); return clearOfflineNotes() }
function clearStorageCopies() {
  for (const store of [storage("localStorage"), storage("sessionStorage")]) {
    try {
      if (!store) continue
      for (const key of autosaveKeys(store)) store.removeItem(key)
    } catch { /* Storage can be blocked; nothing was stored there either. */ }
  }
}
/**
 * Called whenever a signed-in account is known. If this browser last held copies for a
 * different account (sign-out never ran: expired session, closed tab), clear them all first.
 */
export function adoptAutosaveOwner(owner: string) {
  if (!validDraftOwner(owner)) return
  let previous: string | null = null
  for (const store of [storage("localStorage"), storage("sessionStorage")]) {
    try { previous ??= store?.getItem(OWNER_MARKER) ?? null } catch { /* Ignore. */ }
  }
  let hasCopies = false
  if (!previous) for (const store of [storage("localStorage"), storage("sessionStorage")]) {
    try { for (let i = 0; store && i < store.length; i++) if (store.key(i)?.startsWith(`${AUTOSAVE_PREFIX}v2:`)) hasCopies = true } catch { /* Ignore. */ }
  }
  // Unknown provenance (copies but no marker) is treated as another account.
  if ((previous && previous !== owner) || (!previous && hasCopies)) clearStorageCopies()
  for (const store of [storage("localStorage"), storage("sessionStorage")]) {
    try { store?.setItem(OWNER_MARKER, owner) } catch { /* Ignore. */ }
  }
  // Interview notes carry their owner: on every signed-in load, drop expired copies and any copy
  // another account left in this browser (including after a sign-out in another tab).
  void purgeOfflineNotes({ owner, onlyIfPresent: true })
}

export function browserOnline() {
  try { return typeof navigator === "undefined" || navigator.onLine !== false } catch { return true }
}
export type ConnectionProblem = "offline" | "unreachable"
/**
 * "offline": the browser reports no connection. "unreachable": online, but fetch()/a server action
 * rejected with a TypeError before reaching OutClass. null: a real server answer (an error state).
 */
export function connectionProblem(error: unknown, online = browserOnline()): ConnectionProblem | null {
  if (!online) return "offline"
  if (!(error instanceof Error)) return null
  return error.name === "TypeError" && /failed to fetch|networkerror|network request failed|load failed|network connection was lost|internet connection appears to be offline/i.test(error.message) ? "unreachable" : null
}
export function isNetworkError(error: unknown, online = browserOnline()) { return connectionProblem(error, online) !== null }
/** Status text from the problem and where the unsaved copy is (DraftWriteResult). */
export function connectionMessage(problem: ConnectionProblem, stored: DraftWriteResult | undefined) {
  const lead = problem === "offline" ? "Offline" : "Couldn’t reach OutClass"
  return stored === "device" ? `${lead}. Changes saved on this device`
    : stored === "tab" ? `${lead}. Changes kept in this tab`
    : problem === "offline" ? `${lead}. Keep this page open; changes save when you reconnect` : `${lead}. Keep this page open and retry`
}
export function offlineMessage(stored: DraftWriteResult | undefined) { return connectionMessage("offline", stored) }
/** Readable, read-only text of a stored copy: its string fields in order (never applied or saved). */
export function recoveryText(value: unknown): string {
  const parts: string[] = []
  const walk = (v: unknown) => { if (typeof v === "string") { if (v.trim() && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(v)) parts.push(v) } else if (typeof v === "number") parts.push(String(v)); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.values(v).forEach(walk) }
  walk(value)
  return parts.join("\n\n")
}

/**
 * What to do with a stored copy when an editor opens. `baseline` is the server state the editor loaded.
 * - discard: identical to the server, or unusable.
 * - apply: same tab (reload/crash restore) and the server has not moved: continue silently.
 * - offer: a copy left on this device by an earlier session, newer than the server: ask.
 * - conflict: the server moved on since the copy was made: show the conflict UI, never auto-apply.
 */
export function recoveryDecision(stored: StoredDraft | null, baseline: string, serialize: (value: unknown) => string = JSON.stringify): "none" | "discard" | "apply" | "offer" | "conflict" {
  if (!stored) return "none"
  if (serialize(stored.value) === baseline) return "discard"
  if (stored.baseline !== baseline) return "conflict"
  return stored.source === "tab" ? "apply" : "offer"
}
