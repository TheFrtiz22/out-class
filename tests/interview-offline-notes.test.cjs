const { test, beforeEach } = require('node:test'), assert = require('node:assert/strict')
const { loader } = require('./helpers/communications-loader.cjs')
// Encrypted on-device interview notes (lib/interview-offline-notes.ts) with an in-memory IndexedDB
// stand-in and Node's real Web Crypto. Browser behavior (real IndexedDB, offline, reload) is covered
// by tests/interview-offline-notes-browser.test.cjs.
class MemoryStorage {
  constructor() { this.map = new Map() }
  get length() { return this.map.size }
  key(i) { return [...this.map.keys()][i] ?? null }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null }
  setItem(k, v) { this.map.set(k, String(v)) }
  removeItem(k) { this.map.delete(k) }
  clear() { this.map.clear() }
}
function memoryBackend() {
  const records = new Map(); let key
  return {
    records, get key() { return key },
    get: async k => records.get(k), put: async r => { records.set(r.key, r) }, delete: async k => { records.delete(k) },
    all: async () => [...records.values()], clear: async () => records.clear(),
    getKey: async () => key, addKey: async k => (key ??= k), dropKey: async () => { key = undefined },
  }
}
const load = loader({}), vault = load('lib/interview-offline-notes.ts'), store = load('lib/autosave-store.ts')
const A = '00000000-0000-4000-8000-0000000000a1', B = '00000000-0000-4000-8000-0000000000b2'
const scope = { clubId: '00000000-0000-4000-8000-000000000001', applicationId: '00000000-0000-4000-8000-000000000002', roundId: '00000000-0000-4000-8000-000000000003' }
const draft = (notes, score = null) => ({ questionNotes: [{ questionId: '00000000-0000-4000-8000-000000000011', notes }], additionalQuestions: [], overallReview: '', additionalNotes: 'misc', completedQuestionIds: [], score })
const copy = (owner, notes, extra = {}) => ({ owner, scope, sessionId: 'session-1', revision: 3, baseline: vault.notesFingerprint(draft('')), value: draft(notes, 7.5), at: Date.now(), ...extra })
let backend
beforeEach(() => { backend = memoryBackend(); vault.setOfflineNotesBackendForTests(backend); globalThis.localStorage = new MemoryStorage(); globalThis.sessionStorage = new MemoryStorage(); store.resetAutosaveSealForTests() })

test('stores only the interviewer\'s notes, encrypted with a non-extractable AES-GCM key bound to user + scope', async () => {
  assert.equal(await vault.writeOfflineNotes(copy(A, 'Strong evidence about the candidate')), true)
  const [record] = backend.records.values()
  assert.equal(record.key, `${A}:${scope.clubId}:${scope.applicationId}:${scope.roundId}`); assert.equal(record.owner, A)
  assert.equal(record.iv.length, 12); assert.ok(record.data instanceof ArrayBuffer)
  const raw = JSON.stringify({ ...record, data: Buffer.from(record.data).toString('latin1') })
  assert.doesNotMatch(raw, /Strong evidence|candidate|misc/)
  assert.equal(backend.key.extractable, false); assert.equal(backend.key.algorithm.name, 'AES-GCM'); assert.equal(backend.key.algorithm.length, 256)
  await assert.rejects(crypto.subtle.exportKey('raw', backend.key))
  const read = (await vault.readOfflineNotes(A, scope)).copy
  assert.equal(read.value.questionNotes[0].notes, 'Strong evidence about the candidate')
  // Scores are never stored.
  assert.equal('score' in read.value, false); assert.equal('rubricScores' in read.value, false)
  // Ciphertext moved under another key does not decrypt (additional data binds it): never returned.
  const other = { ...scope, roundId: '00000000-0000-4000-8000-000000000009' }, otherKey = `${A}:${scope.clubId}:${scope.applicationId}:${other.roundId}`
  backend.records.set(otherKey, { ...record, key: otherKey })
  assert.deepEqual(await vault.readOfflineNotes(A, other), { copy: null, unreadable: true })
})

test('another account on the same browser gets nothing, and the stale entry is deleted', async () => {
  await vault.writeOfflineNotes(copy(A, 'Account A private notes'))
  assert.equal(backend.records.size, 1)
  assert.equal((await vault.readOfflineNotes(B, scope)).copy, null)
  assert.equal(backend.records.size, 0)
  assert.equal((await vault.readOfflineNotes(A, scope)).copy, null)
  // A record relabelled as B's never decrypts for B (the key is the additional data): B gets nothing.
  await vault.writeOfflineNotes(copy(A, 'Account A again'))
  const [record] = backend.records.values(), forged = `${B}:${scope.clubId}:${scope.applicationId}:${scope.roundId}`
  backend.records.clear(); backend.records.set(forged, { ...record, key: forged, owner: B })
  assert.deepEqual(await vault.readOfflineNotes(B, scope), { copy: null, unreadable: true })
  backend.records.clear()
  // Signing in as another account purges the previous account's copies on load.
  await vault.writeOfflineNotes(copy(A, 'left behind'))
  store.adoptAutosaveOwner(A); store.adoptAutosaveOwner(B); await new Promise(r => setTimeout(r, 20))
  assert.equal(backend.records.size, 0)
})

test('copies expire after 7 days and are purged on load (fake time)', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-11T12:00:00Z') })
  await vault.writeOfflineNotes(copy(A, 'Week-old notes', { at: Date.now() }))
  t.mock.timers.tick(7 * 86400000 - 1000)
  assert.equal((await vault.readOfflineNotes(A, scope)).copy.value.questionNotes[0].notes, 'Week-old notes')
  t.mock.timers.tick(2000)
  store.adoptAutosaveOwner(A); await new Promise(r => setImmediate(r)); await new Promise(r => setImmediate(r))
  assert.equal(backend.records.size, 0)
  await vault.writeOfflineNotes(copy(A, 'expired', { at: Date.now() - 8 * 86400000 }))
  assert.equal((await vault.readOfflineNotes(A, scope)).copy, null); assert.equal(backend.records.size, 0)
})

test('sign-out deletes every copy and the device key, and refuses later writes from the page', async () => {
  await vault.writeOfflineNotes(copy(A, 'unsaved at sign-out'))
  assert.equal(store.hasUnsavedAutosaveCopies(), true)
  await store.sealAutosaveDraftsForSignOut()
  assert.equal(backend.records.size, 0); assert.equal(backend.key, undefined)
  assert.equal(store.hasUnsavedAutosaveCopies(), false)
  assert.equal(await vault.writeOfflineNotes(copy(A, 'late keystroke')), false); assert.equal(backend.records.size, 0)
})

test('writes and deletes stay ordered: a delete after a write wins, and the newest write is what is stored', async () => {
  const writes = [vault.writeOfflineNotes(copy(A, 'one')), vault.writeOfflineNotes(copy(A, 'two')), vault.writeOfflineNotes(copy(A, 'three'))]
  await Promise.all(writes)
  assert.equal((await vault.readOfflineNotes(A, scope)).copy.value.questionNotes[0].notes, 'three')
  void vault.writeOfflineNotes(copy(A, 'saved meanwhile')); await vault.deleteOfflineNotes(A, scope)
  assert.equal(backend.records.size, 0); assert.equal(vault.hasPendingOfflineNotes(), false)
})

test('invalid owners and scopes are never stored; unsupported storage stores nothing', async () => {
  for (const owner of ['', 'undefined', 'null', null, 'a b']) assert.equal(await vault.writeOfflineNotes(copy(owner, 'x')), false)
  assert.equal(await vault.writeOfflineNotes(copy(A, 'x', { scope: { ...scope, roundId: '../x' } })), false)
  assert.equal(backend.records.size, 0)
  vault.setOfflineNotesBackendForTests(null)
  const hadIdb = 'indexedDB' in globalThis; assert.equal(hadIdb, false)
  assert.equal(vault.offlineNotesSupported(), false); assert.equal(await vault.writeOfflineNotes(copy(A, 'x')), false)
})

test('fingerprints ignore key order and scores; readable text never includes ids', () => {
  const a = { score: 4, questionNotes: [], additionalQuestions: [], overallReview: '', additionalNotes: 'x' }
  const b = { additionalNotes: 'x', overallReview: '', additionalQuestions: [], questionNotes: [], score: 9, rubricScores: { a: 1 } }
  assert.equal(vault.notesFingerprint(a), vault.notesFingerprint(b))
  assert.equal(vault.offlineNotesText(draft('Visible note')), 'Visible note\n\nmisc')
})

test('a copy that cannot be opened (missing key, failed decryption, storage error) is kept and reported, never deleted', async () => {
  await vault.writeOfflineNotes(copy(A, 'Keep me even if unreadable'))
  const saved = backend.key
  await backend.dropKey()
  assert.deepEqual(await vault.readOfflineNotes(A, scope), { copy: null, unreadable: true }); assert.equal(backend.records.size, 1)
  await backend.addKey(await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']))
  assert.deepEqual(await vault.readOfflineNotes(A, scope), { copy: null, unreadable: true }); assert.equal(backend.records.size, 1)
  const get = backend.get; backend.get = async () => { throw Error('transient') }
  assert.deepEqual(await vault.readOfflineNotes(A, scope), { copy: null, unreadable: true }); assert.equal(backend.records.size, 1)
  backend.get = get; await backend.dropKey(); await backend.addKey(saved)
  assert.equal((await vault.readOfflineNotes(A, scope)).copy.value.questionNotes[0].notes, 'Keep me even if unreadable')
})
