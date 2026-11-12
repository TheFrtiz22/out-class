/**
 * Encrypted on-device copy of an interviewer's OWN unsaved interview-room notes, so they survive a
 * dropped connection and a page reload (docs/interview-offline-notes.md). The server stays
 * authoritative: a copy only holds notes the server has not acknowledged, it is deleted as soon as
 * the server confirms the save, and it is restored only through the existing revision checks.
 *
 * - IndexedDB database `outclass-offline`: store `interview-notes` (one record per unsaved interview)
 *   and store `device-keys` (one non-extractable AES-GCM key for this browser profile).
 * - Record key: user id + club id + application id + round id. The ciphertext is bound to that key
 *   (AES-GCM additional data), and every read checks the signed-in user; other accounts' records and
 *   records older than seven days are deleted on read.
 * - Never stored: scores, submitted evaluations, other people's notes or shared room content,
 *   Demo Mode, support (impersonation) sessions and anonymous rounds (which never open a room).
 * - localStorage is never used. Sign-out deletes every record and the device key.
 */
import type { InterviewDraft } from "@/lib/interview-kits"

export const OFFLINE_NOTES_DB = "outclass-offline"
export const OFFLINE_NOTES_STORE = "interview-notes"
export const OFFLINE_KEYS_STORE = "device-keys"
export const OFFLINE_NOTES_MAX_AGE = 7 * 86400000
export const OFFLINE_NOTES_MESSAGE = "You're offline. Your notes are kept on this device and will save when you reconnect."
export const OFFLINE_NOTES_UNREADABLE = "A saved copy on this device couldn't be opened. It has been kept; your notes here still save to OutClass."
const DEVICE_KEY_ID = "interview-notes-v1"
const OWNER = /^[A-Za-z0-9_.@-]{1,120}$/
const ID = /^[A-Za-z0-9_-]{1,80}$/

export type InterviewNotesScope = { clubId: string; applicationId: string; roundId: string }
/** The interviewer's own notes: the draft without its score fields. */
export type LocalInterviewNotes = Omit<InterviewDraft, "score" | "rubricScores">
export type OfflineNotesCopy = { owner: string; scope: InterviewNotesScope; sessionId: string; revision: number; baseline: string; value: LocalInterviewNotes; at: number }
/** What IndexedDB holds: only the key, owner and age are readable; the notes are ciphertext. */
export type StoredOfflineNotes = { key: string; owner: string; at: number; iv: Uint8Array<ArrayBuffer>; data: ArrayBuffer }

/** Storage boundary. The browser uses IndexedDB; unit tests pass an in-memory backend. */
export interface OfflineNotesBackend {
  get(key: string): Promise<StoredOfflineNotes | undefined>
  put(record: StoredOfflineNotes): Promise<void>
  delete(key: string): Promise<void>
  all(): Promise<StoredOfflineNotes[]>
  clear(): Promise<void>
  getKey(): Promise<CryptoKey | undefined>
  /** Store `key` unless another tab stored one first; returns the key that is stored. */
  addKey(key: CryptoKey): Promise<CryptoKey>
  dropKey(): Promise<void>
}

export function interviewNotesOnly(draft: InterviewDraft | LocalInterviewNotes): LocalInterviewNotes {
  const { score: _score, rubricScores: _rubric, ...notes } = draft as InterviewDraft
  return notes
}
/** Order-independent JSON of the notes (server drafts come back in schema key order, edits in typing order). */
export function notesFingerprint(draft: InterviewDraft | LocalInterviewNotes) {
  const sort = (value: unknown): unknown => Array.isArray(value) ? value.map(sort)
    : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().filter(key => (value as Record<string, unknown>)[key] !== undefined).map(key => [key, sort((value as Record<string, unknown>)[key])])) : value
  return JSON.stringify(sort(interviewNotesOnly(draft)))
}
export function validNotesOwner(owner: string | null | undefined): owner is string {
  return typeof owner === "string" && owner !== "undefined" && owner !== "null" && OWNER.test(owner)
}
export function offlineNotesKey(owner: string, scope: InterviewNotesScope) {
  if (!validNotesOwner(owner) || ![scope.clubId, scope.applicationId, scope.roundId].every(id => typeof id === "string" && ID.test(id))) throw Error("Invalid offline notes scope.")
  return `${owner}:${scope.clubId}:${scope.applicationId}:${scope.roundId}`
}

// ---------------------------------------------------------------- IndexedDB backend
function idbRequest<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
}
let database: Promise<IDBDatabase> | null = null
function openDatabase() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_NOTES_DB, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(OFFLINE_NOTES_STORE)) db.createObjectStore(OFFLINE_NOTES_STORE, { keyPath: "key" })
      if (!db.objectStoreNames.contains(OFFLINE_KEYS_STORE)) db.createObjectStore(OFFLINE_KEYS_STORE)
    }
    request.onsuccess = () => {
      const db = request.result
      // Another tab upgrading or deleting the database: close and reopen on next use.
      db.onversionchange = () => { db.close(); database = null }
      resolve(db)
    }
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(Error("Offline notes storage is blocked."))
  })
  database.catch(() => { database = null })
  return database
}
async function run<T>(store: string, mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDatabase()
  const tx = db.transaction(store, mode), result = idbRequest(work(tx.objectStore(store)))
  await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error ?? Error("Offline notes transaction aborted.")) })
  return result
}
const indexedDbBackend: OfflineNotesBackend = {
  get: key => run(OFFLINE_NOTES_STORE, "readonly", s => s.get(key) as IDBRequest<StoredOfflineNotes | undefined>),
  put: async record => { await run(OFFLINE_NOTES_STORE, "readwrite", s => s.put(record)) },
  delete: async key => { await run(OFFLINE_NOTES_STORE, "readwrite", s => s.delete(key)) },
  all: () => run(OFFLINE_NOTES_STORE, "readonly", s => s.getAll() as IDBRequest<StoredOfflineNotes[]>),
  clear: async () => { await run(OFFLINE_NOTES_STORE, "readwrite", s => s.clear()) },
  getKey: () => run(OFFLINE_KEYS_STORE, "readonly", s => s.get(DEVICE_KEY_ID) as IDBRequest<CryptoKey | undefined>),
  addKey: async key => {
    try { await run(OFFLINE_KEYS_STORE, "readwrite", s => s.add(key, DEVICE_KEY_ID)); return key }
    catch { const stored = await indexedDbBackend.getKey(); if (stored) return stored; throw Error("Offline notes key unavailable.") }
  },
  dropKey: async () => { await run(OFFLINE_KEYS_STORE, "readwrite", s => s.delete(DEVICE_KEY_ID)) },
}

let override: OfflineNotesBackend | null = null
/** Test hook: an in-memory backend in Node, where IndexedDB does not exist. */
export function setOfflineNotesBackendForTests(backend: OfflineNotesBackend | null) { override = backend; sealed = false; pending.clear(); chains.clear() }
function backend() { return override ?? indexedDbBackend }
function subtle() { try { return globalThis.crypto?.subtle ?? null } catch { return null } }
/** IndexedDB and Web Crypto are both required; without them nothing is written to the device. */
/** False only when the browser can list databases and ours is not among them (nothing to clean up). */
async function databasePresent() {
  if (override) return true
  try {
    if (typeof indexedDB.databases !== "function") return true
    return (await indexedDB.databases()).some(db => db.name === OFFLINE_NOTES_DB)
  } catch { return true }
}
export function offlineNotesSupported() {
  if (override) return !!subtle()
  try { return typeof indexedDB !== "undefined" && !!indexedDB && !!subtle() } catch { return false }
}

// ---------------------------------------------------------------- encryption
async function deviceKey(create: boolean) {
  const store = backend(), existing = await store.getKey()
  if (existing || !create) return existing ?? null
  // Non-extractable: page script can use it to encrypt/decrypt, never read or export its bytes.
  const generated = await subtle()!.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
  return store.addKey(generated)
}
const encoder = new TextEncoder(), decoder = new TextDecoder()
async function seal(copy: OfflineNotesCopy, key: string): Promise<StoredOfflineNotes> {
  const cryptoKey = await deviceKey(true)
  if (!cryptoKey) throw Error("Offline notes key unavailable.")
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const data = await subtle()!.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(key) }, cryptoKey, encoder.encode(JSON.stringify(copy)))
  return { key, owner: copy.owner, at: copy.at, iv, data }
}
async function open(record: StoredOfflineNotes): Promise<OfflineNotesCopy | null> {
  try {
    const cryptoKey = await deviceKey(false)
    if (!cryptoKey) return null
    const plain = await subtle()!.decrypt({ name: "AES-GCM", iv: record.iv, additionalData: encoder.encode(record.key) }, cryptoKey, record.data)
    return JSON.parse(decoder.decode(plain)) as OfflineNotesCopy
  } catch { return null }
}

// ---------------------------------------------------------------- per-record ordering
// Writes and deletes for one record run in order, so a late write can never resurrect a deleted copy.
const chains = new Map<string, Promise<unknown>>()
const generations = new Map<string, number>()
function enqueue<T>(key: string, op: () => Promise<T>) {
  const next = (chains.get(key) ?? Promise.resolve()).catch(() => {}).then(op)
  chains.set(key, next)
  void next.catch(() => {}).finally(() => { if (chains.get(key) === next) chains.delete(key) })
  return next
}
/** Keys this page has written and not yet deleted: lets sign-out know there are unsaved notes. */
const pending = new Set<string>()
let sealed = false
export function hasPendingOfflineNotes() { return pending.size > 0 }

// ---------------------------------------------------------------- public API
/** Save (or replace) the copy. Returns false when nothing was stored (unsupported, sealed or failed). */
export function writeOfflineNotes(copy: OfflineNotesCopy): Promise<boolean> {
  if (sealed || !offlineNotesSupported()) return Promise.resolve(false)
  let key: string
  try { key = offlineNotesKey(copy.owner, copy.scope) } catch { return Promise.resolve(false) }
  const generation = (generations.get(key) ?? 0) + 1
  generations.set(key, generation)
  const value: OfflineNotesCopy = { ...copy, value: interviewNotesOnly(copy.value) }
  pending.add(key)
  return enqueue(key, async () => {
    // A newer write for this record is already queued: it carries the latest notes.
    if (sealed) return false
    if (generations.get(key) !== generation) return true
    try { await backend().put(await seal(value, key)); return true } catch { return false }
  })
}
/** Delete this interview's copy (saved, submitted, or dismissed by the interviewer). */
export function deleteOfflineNotes(owner: string, scope: InterviewNotesScope): Promise<void> {
  let key: string
  try { key = offlineNotesKey(owner, scope) } catch { return Promise.resolve() }
  generations.set(key, (generations.get(key) ?? 0) + 1)
  pending.delete(key)
  if (!offlineNotesSupported()) return Promise.resolve()
  return enqueue(key, async () => { try { await backend().delete(key) } catch { /* Expiry still removes it. */ } })
}
/**
 * Delete expired copies and every copy that belongs to another account. With `owner` omitted only
 * expired copies are removed. Never throws.
 */
export async function purgeOfflineNotes({ owner, now = Date.now(), onlyIfPresent = false }: { owner?: string | null; now?: number; onlyIfPresent?: boolean } = {}) {
  if (!offlineNotesSupported()) return
  try {
    // Page-load cleanup never creates the database for people who have never needed it.
    if (onlyIfPresent && !(await databasePresent())) return
    const store = backend()
    for (const record of await store.all()) {
      const stale = typeof record?.at !== "number" || now - record.at > OFFLINE_NOTES_MAX_AGE
      const foreign = owner != null && record?.owner !== owner
      if (stale || foreign) await enqueue(record.key, () => store.delete(record.key))
    }
  } catch { /* Storage can be unavailable; reads still check age and owner. */ }
}
export type OfflineNotesRead = { copy: OfflineNotesCopy | null; unreadable: boolean }
/**
 * The signed-in interviewer's copy for this interview. Only copies that are provably another
 * account's or expired are deleted. A copy that cannot be opened (missing key, decryption or storage
 * failure) is kept and reported as `unreadable`, never silently removed.
 */
export async function readOfflineNotes(owner: string, scope: InterviewNotesScope, now = Date.now()): Promise<OfflineNotesRead> {
  const none = { copy: null, unreadable: false }
  if (!offlineNotesSupported() || !validNotesOwner(owner)) return none
  let key: string
  try { key = offlineNotesKey(owner, scope) } catch { return none }
  await purgeOfflineNotes({ owner, now })
  let record: StoredOfflineNotes | undefined
  const store = backend()
  try { await chains.get(key)?.catch(() => {}); record = await store.get(key) } catch { return { copy: null, unreadable: true } }
  if (!record) return none
  const copy = await open(record)
  if (!copy) return { copy: null, unreadable: true }
  const expired = typeof copy.at !== "number" || now - copy.at > OFFLINE_NOTES_MAX_AGE
  if (copy.owner !== owner || expired) { await enqueue(key, () => store.delete(key)).catch(() => {}); return none }
  const valid = typeof copy.baseline === "string" && typeof copy.sessionId === "string" && Number.isInteger(copy.revision) && !!copy.value && typeof copy.value === "object"
  return valid ? { copy: { ...copy, value: interviewNotesOnly(copy.value) }, unreadable: false } : { copy: null, unreadable: true }
}
/**
 * Sign-out and account switch: delete every copy and the device key. With `seal`, later writes from
 * this page (a last keystroke, an unmount) are refused until the next page load.
 */
export async function clearOfflineNotes({ seal: refuseWrites = false }: { seal?: boolean } = {}) {
  if (refuseWrites) sealed = true
  pending.clear()
  for (const key of generations.keys()) generations.set(key, (generations.get(key) ?? 0) + 1)
  if (!offlineNotesSupported()) return
  await Promise.allSettled([...chains.values()])
  if (!(await databasePresent())) return
  try { const store = backend(); await store.clear(); await store.dropKey() } catch { /* The next signed-in load purges other accounts' copies. */ }
}
/** Readable text of a copy's notes, for a read-only view (never applied or saved from there). */
export function offlineNotesText(value: LocalInterviewNotes | null | undefined) {
  if (!value) return ""
  const parts = [
    ...(value.questionNotes ?? []).map(note => note.notes),
    ...(value.additionalQuestions ?? []).flatMap(question => [question.question, question.notes]),
    value.finalInterviewThoughts ?? "",
    value.additionalNotes ?? value.overallReview ?? "",
  ]
  return parts.filter(part => typeof part === "string" && part.trim()).join("\n\n")
}
