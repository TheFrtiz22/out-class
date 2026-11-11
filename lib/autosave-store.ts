/**
 * Local recovery copies for autosaving editors. The server stays authoritative:
 * a copy only holds edits that have not been acknowledged yet, and it is offered
 * back through the caller's revision/conflict checks, never applied silently.
 *
 * - "device": localStorage (survives a browser restart) plus sessionStorage.
 * - "tab": sessionStorage only. Screens holding private data about other students
 *   (review notes, voting setup, task feedback, interview notes) use this.
 * Every copy is bound to its owner; sign-out and a different signed-in account clear them
 * (including the older v1 tab-only copies used by interview notes).
 */
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

/** Sign-out: remove every recovery copy (both storages, every account) and the owner marker. */
export function clearAutosaveDrafts() {
  for (const store of [storage("localStorage"), storage("sessionStorage")]) {
    try {
      if (!store) continue
      const keys: string[] = []
      for (let i = 0; i < store.length; i++) { const key = store.key(i); if (key?.startsWith(AUTOSAVE_PREFIX)) keys.push(key) }
      for (const key of keys) store.removeItem(key)
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
  if ((previous && previous !== owner) || (!previous && hasCopies)) clearAutosaveDrafts()
  for (const store of [storage("localStorage"), storage("sessionStorage")]) {
    try { store?.setItem(OWNER_MARKER, owner) } catch { /* Ignore. */ }
  }
}

export function browserOnline() {
  try { return typeof navigator === "undefined" || navigator.onLine !== false } catch { return true }
}
/** fetch() and Next server actions reject with a TypeError when the request never reached the server. */
export function isNetworkError(error: unknown, online = browserOnline()) {
  if (!online) return true
  if (!(error instanceof Error)) return false
  return error.name === "TypeError" && /failed to fetch|networkerror|network request failed|load failed|network connection was lost|internet connection appears to be offline/i.test(error.message)
}
export function offlineMessage(stored: DraftWriteResult | undefined) {
  return stored === "device" ? "Offline — changes saved on this device"
    : stored === "tab" ? "Offline — changes kept in this tab until you reconnect"
    : "Offline — keep this page open; changes save when you reconnect"
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
