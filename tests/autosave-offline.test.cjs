const { test, beforeEach } = require('node:test'), assert = require('node:assert/strict')
const { loader } = require('./helpers/communications-loader.cjs')
// Offline-safe autosave: device copies, offline status, restore, stale-copy conflicts and per-account isolation.
class MemoryStorage {
  constructor() { this.map = new Map() }
  get length() { return this.map.size }
  key(i) { return [...this.map.keys()][i] ?? null }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null }
  setItem(k, v) { this.map.set(k, String(v)) }
  removeItem(k) { this.map.delete(k) }
  clear() { this.map.clear() }
}
const load = loader({})
const store = load('lib/autosave-store.ts'), { AutosaveQueue, OfflineError } = load('lib/autosave-queue.ts'), { AvailabilitySaveQueue } = load('lib/availability-save-queue.ts')
beforeEach(() => { globalThis.localStorage = new MemoryStorage(); globalThis.sessionStorage = new MemoryStorage(); store.resetAutosaveSealForTests() })
const tick = () => new Promise(resolve => setImmediate(resolve))
const failedFetch = () => Object.assign(new TypeError('Failed to fetch'))
function deviceQueue(owner, identity, save, online, persistence = 'device') {
  const drafts = store.createDraftStore({ owner, identity, persistence }), writer = 'writer-' + Math.random()
  let baseline = '""'
  const queue = new AutosaveQueue('', save, () => {}, value => { if (value === null) { drafts.clear(writer); return } return drafts.write({ value, baseline, writer, at: Date.now() }) }, 850, online)
  return { queue, drafts }
}

test('offline: edits stay on this device, no request is sent, and the status says so', async () => {
  let online = false; const calls = []
  const { queue, drafts } = deviceQueue('user-a', 'application:1', async value => { calls.push(value) }, () => online)
  queue.change('typed on the train')
  assert.equal(queue.state, 'offline'); assert.equal(queue.error, 'Offline — changes saved on this device')
  await assert.rejects(queue.flush(), OfflineError); assert.deepEqual(calls, []); assert.equal(queue.dirty, true)
  assert.equal(JSON.parse(localStorage.getItem(drafts.key)).value, 'typed on the train')
  online = true; await queue.flush()
  assert.deepEqual(calls, ['typed on the train']); assert.equal(queue.state, 'saved')
  assert.equal(localStorage.getItem(drafts.key), null); assert.equal(sessionStorage.getItem(drafts.key), null)
})

test('a fetch failure while navigator.onLine is true says OutClass could not be reached (not "Offline"), keeps Retry semantics and does not loop', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let calls = 0
  const { queue } = deviceQueue('user-a', 'kit:1', async () => { calls++; throw failedFetch() }, () => true)
  queue.change('draft'); t.mock.timers.tick(850); await tick()
  assert.equal(queue.state, 'unreachable'); assert.equal(queue.error, 'Couldn’t reach OutClass — changes saved on this device'); assert.equal(calls, 1)
  t.mock.timers.tick(60000); await tick(); assert.equal(calls, 1)
  // A server rejection is still an error with its own message.
  const rejected = new AutosaveQueue('', async () => { throw Error('Draft is too large.') }, () => {}, () => 'device', 850, () => true)
  rejected.change('x'); await assert.rejects(rejected.flush(), /too large/); assert.equal(rejected.state, 'error')
  assert.equal(store.connectionProblem(new TypeError('Load failed'), true), 'unreachable'); assert.equal(store.connectionProblem(new TypeError('Failed to fetch'), true), 'unreachable')
  assert.equal(store.connectionProblem(Error('Failed to fetch'), true), null); assert.equal(store.connectionProblem(Error('x'), false), 'offline'); assert.equal(store.connectionProblem(new TypeError('Failed to fetch'), false), 'offline')
  assert.equal(store.connectionMessage('offline', 'device'), 'Offline — changes saved on this device'); assert.equal(store.connectionMessage('unreachable', 'tab'), 'Couldn’t reach OutClass — changes kept in this tab')
})

test('tab-only screens never touch localStorage and say where the copy is', () => {
  const { queue, drafts } = deviceQueue('user-a', 'review:club:app', async () => {}, () => false, 'tab')
  queue.change('private notes about an applicant')
  assert.equal(localStorage.length, 0); assert.ok(sessionStorage.getItem(drafts.key))
  assert.equal(queue.error, 'Offline — changes kept in this tab')
  const unstored = new AutosaveQueue('', async () => {}, () => {}, () => false, 850, () => false)
  unstored.change('x'); assert.equal(unstored.error, 'Offline — keep this page open; changes save when you reconnect')
  queue.markOffline(); assert.equal(queue.state, 'offline')
})

test('restore after reload: same tab continues, a device copy from an earlier session is offered', () => {
  const drafts = store.createDraftStore({ owner: 'user-a', identity: 'profile:about', persistence: 'device' })
  drafts.write({ value: { bio: 'unsaved' }, baseline: JSON.stringify({ bio: 'server' }), writer: 'w1', at: Date.now() })
  const sameTab = drafts.read(); assert.equal(sameTab.source, 'tab')
  assert.equal(store.recoveryDecision(sameTab, JSON.stringify({ bio: 'server' })), 'apply')
  sessionStorage.clear() // browser restart or a crash that lost the tab
  const reopened = store.createDraftStore({ owner: 'user-a', identity: 'profile:about', persistence: 'device' }).read()
  assert.equal(reopened.source, 'device'); assert.deepEqual(reopened.value, { bio: 'unsaved' })
  assert.equal(store.recoveryDecision(reopened, JSON.stringify({ bio: 'server' })), 'offer')
  assert.equal(store.recoveryDecision({ ...reopened, value: { bio: 'server' } }, JSON.stringify({ bio: 'server' })), 'discard')
  // Expired and corrupt copies are dropped rather than offered.
  localStorage.setItem(drafts.key, JSON.stringify({ ...JSON.parse(localStorage.getItem(drafts.key)), at: Date.now() - 8 * 86400000 }))
  assert.equal(drafts.read(), null); assert.equal(localStorage.getItem(drafts.key), null)
  localStorage.setItem(drafts.key, '{not json'); assert.equal(drafts.read(), null)
})

test('stale copy: when the server moved on, the copy is a conflict and the revision check still guards the write', async () => {
  const drafts = store.createDraftStore({ owner: 'user-a', identity: 'application:9', persistence: 'device' })
  drafts.write({ value: 'old offline answer', baseline: JSON.stringify('v1 answer'), writer: 'w1', at: Date.now() })
  sessionStorage.clear()
  const stored = drafts.read()
  for (const source of ['tab', 'device']) assert.equal(store.recoveryDecision({ ...stored, source }, JSON.stringify('v2 answer from another device')), 'conflict')
  // Nothing auto-applied: a queue that only writes on change never sent the stale value.
  let server = { revision: 2, value: 'v2 answer from another device' }; const sent = []
  const queue = new AutosaveQueue(server.value, async value => { sent.push(value); if (1 !== server.revision) throw Error('Changed on another device.') }, () => {}, () => 'device', 850, () => true)
  assert.equal(queue.dirty, false); assert.deepEqual(sent, [])
  // A stale write that does reach the server (expected revision 1) is rejected, not silently accepted.
  queue.change(stored.value); await assert.rejects(queue.flush(), /another device/); assert.equal(queue.state, 'error'); assert.equal(server.value, 'v2 answer from another device')
})

test('per-account isolation: other accounts cannot read a copy, and sign-out or an account switch clears them', () => {
  const a = store.createDraftStore({ owner: 'user-a', identity: 'application:1', persistence: 'device' })
  a.write({ value: 'A private answer', baseline: '""', writer: 'w', at: Date.now() })
  assert.equal(store.createDraftStore({ owner: 'user-b', identity: 'application:1', persistence: 'device' }).read(), null)
  // A record copied under another account's key is still rejected by its owner field.
  localStorage.setItem(store.draftStorageKey('user-b', 'application:1'), localStorage.getItem(a.key)); sessionStorage.clear()
  assert.equal(store.createDraftStore({ owner: 'user-b', identity: 'application:1', persistence: 'device' }).read(), null)
  for (const bad of [undefined, null, '', 'undefined', 'null', 'a b']) assert.equal(store.validDraftOwner(bad), false)
  store.adoptAutosaveOwner('user-a'); a.write({ value: 'A private answer', baseline: '""', writer: 'w', at: Date.now() })
  store.adoptAutosaveOwner('user-a'); assert.ok(a.read(), 'same account keeps its copies')
  store.adoptAutosaveOwner('user-b')
  assert.equal(a.read(), null); assert.equal([...localStorage.map.keys()].filter(k => k.startsWith('outclass:autosave:v2:')).length, 0)
  // Sign-out clears every copy, including v1 tab copies used by interview notes, and unrelated keys survive.
  const b = store.createDraftStore({ owner: 'user-b', identity: 'kit:1', persistence: 'device' }); b.write({ value: 'q', baseline: '""', writer: 'w', at: Date.now() })
  sessionStorage.setItem('outclass:autosave:v1:interview:session-1', '{}'); localStorage.setItem('outclass-landing-audience', 'students')
  store.clearAutosaveDrafts()
  assert.equal([...localStorage.map.keys(), ...sessionStorage.map.keys()].filter(k => k.startsWith('outclass:autosave:')).length, 0)
  assert.equal(localStorage.getItem('outclass-landing-audience'), 'students')
  // Copies with no owner marker are treated as another account's.
  b.write({ value: 'q', baseline: '""', writer: 'w', at: Date.now() }); store.adoptAutosaveOwner('user-c'); assert.equal(b.read(), null)
})

test('blocked storage never breaks editing or saving', async () => {
  const blocked = { get length() { throw Error('SecurityError') }, key() { throw Error('SecurityError') }, getItem() { throw Error('SecurityError') }, setItem() { throw Error('QuotaExceeded') }, removeItem() { throw Error('SecurityError') } }
  globalThis.localStorage = blocked; globalThis.sessionStorage = blocked
  const drafts = store.createDraftStore({ owner: 'user-a', identity: 'x', persistence: 'device' })
  assert.equal(drafts.write({ value: 1, baseline: '0', writer: 'w', at: Date.now() }), false); assert.equal(drafts.read(), null)
  drafts.clear(); store.clearAutosaveDrafts(); store.adoptAutosaveOwner('user-a')
  const queue = new AutosaveQueue(0, async () => {}, () => {}, v => v === null ? undefined : drafts.write({ value: v, baseline: '0', writer: 'w', at: Date.now() }), 850, () => false)
  queue.change(1); assert.equal(queue.error, 'Offline — keep this page open; changes save when you reconnect')
})

test('availability queue: offline status, device copy, and cleanup after the reconnect save', async () => {
  let online = false; const writes = [], records = []
  const queue = new AvailabilitySaveQueue({ schedule: { weekly: [] }, revision: 3 }, async value => { writes.push(value); return { ...value, revision: value.revision + 1 } }, () => {}, 10000, { online: () => online, recover: value => { records.push(value); return value ? 'device' : undefined } })
  queue.change({ weekly: [[1]] })
  assert.equal(queue.state, 'offline'); assert.equal(queue.error, 'Offline — changes saved on this device'); assert.equal(records.at(-1).revision, 3)
  await assert.rejects(queue.flush(), OfflineError); assert.equal(writes.length, 0)
  online = true; await queue.flush(); assert.equal(queue.state, 'saved'); assert.equal(queue.document.revision, 4); assert.equal(records.at(-1), null)
  const failing = new AvailabilitySaveQueue({ schedule: { weekly: [] }, revision: 1 }, async () => { throw failedFetch() }, () => {}, 10000, { online: () => true, recover: () => 'device' })
  failing.change({ weekly: [[2]] }); await assert.rejects(failing.flush(), OfflineError); assert.equal(failing.state, 'unreachable'); assert.equal(failing.error, 'Couldn’t reach OutClass — changes saved on this device'); assert.equal(failing.dirty, true)
  failing.dispose(); queue.dispose()
})

test('a passive SIGNED_OUT keeps unsaved copies; only another account signing in clears them', () => {
  const fs = require('node:fs'), auth = fs.readFileSync('contexts/auth-context.tsx', 'utf8')
  assert.doesNotMatch(auth, /clearAutosaveDrafts|sealAutosaveDrafts/, 'auth state changes must not clear copies')
  store.adoptAutosaveOwner('user-a')
  const a = store.createDraftStore({ owner: 'user-a', identity: 'application:1', persistence: 'device' })
  a.write({ value: 'typed before the session expired', baseline: '""', writer: 'w', at: Date.now() })
  store.adoptAutosaveOwner('user-a') // the same account signs back in
  assert.equal(a.read().value, 'typed before the session expired')
})

test('explicit sign-out: flushes first, asks before discarding, and clears only after confirmation', async t => {
  const confirms = []
  assert.equal(await store.prepareSignOut({ flush: async () => {}, confirm: async () => { confirms.push(1); return true } }), 'clean'); assert.equal(confirms.length, 0)
  const a = store.createDraftStore({ owner: 'user-a', identity: 'profile:about', persistence: 'device' })
  const write = () => a.write({ value: 'unsaved', baseline: '""', writer: 'w', at: Date.now() })
  write(); assert.equal(await store.prepareSignOut({ flush: async () => a.clear(), confirm: async () => { confirms.push(1); return true } }), 'flushed'); assert.equal(confirms.length, 0)
  write(); assert.equal(await store.prepareSignOut({ flush: async () => { throw new TypeError('Failed to fetch') }, confirm: async () => { confirms.push('no'); return false } }), 'cancel')
  assert.deepEqual(confirms, ['no']); assert.equal(a.read().value, 'unsaved', 'cancelling keeps the copy')
  // A flush that never settles is bounded by the timeout, then the user is asked.
  assert.equal(await store.prepareSignOut({ flush: () => new Promise(() => {}), confirm: async () => true, timeoutMs: 5 }), 'discard')
  assert.equal(a.read().value, 'unsaved', 'confirmation alone does not clear; the sign-out path does after it succeeds')
  store.sealAutosaveDraftsForSignOut(); assert.equal(a.read(), null); assert.equal(store.hasUnsavedAutosaveCopies(), false)
})

test('after the sign-out clear, beforeunload recover() and later change() calls cannot rewrite a copy', () => {
  const { queue, drafts } = deviceQueue('user-a', 'application:1', async () => {}, () => false)
  queue.change('before sign-out'); assert.ok(drafts.read())
  store.sealAutosaveDraftsForSignOut()
  queue.change('late keystroke'); assert.equal(drafts.write({ value: 'beforeunload', baseline: '""', writer: 'w', at: Date.now() }), false)
  assert.equal(drafts.read(), null); assert.equal(localStorage.length + sessionStorage.length, 0)
  assert.equal(queue.error, 'Offline — keep this page open; changes save when you reconnect', 'status no longer claims a device copy')
})

test('an offered copy survives change() and is never saved while held', async () => {
  const drafts = store.createDraftStore({ owner: 'user-a', identity: 'kit:1', persistence: 'device' })
  drafts.write({ value: 'offered copy', baseline: '""', writer: 'old', at: Date.now() }); sessionStorage.clear()
  const saves = []
  const queue = new AutosaveQueue('', async v => { saves.push(v) }, () => {}, v => v === null ? drafts.clear('new') : drafts.write({ value: v, baseline: '""', writer: 'new', at: Date.now() }), 850, () => true)
  assert.equal(store.recoveryDecision(drafts.read(), '""'), 'offer')
  queue.hold(); queue.change('typing while the prompt is open'); await queue.flush()
  assert.equal(queue.value, ''); assert.equal(queue.dirty, false); assert.deepEqual(saves, []); assert.equal(drafts.read().value, 'offered copy')
  queue.release(); queue.change('offered copy'); await queue.flush(); assert.deepEqual(saves, ['offered copy'])
})

test('a stale-baseline copy is shown as a conflict, offers only Keep newer version / Review my copy, and is never saved', async () => {
  const fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
  const file = path.resolve('components/ui/autosave-status.tsx'), mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('require', 'module', 'exports', code)(n => n === '@/lib/autosave-store' ? store : n === '@/components/ui/loading-indicator' ? { LoadingIndicator: () => null } : require(n), mod, mod.exports)
  const { AutosaveStatus } = mod.exports, html = save => renderToStaticMarkup(React.createElement(AutosaveStatus, { save: { state: 'idle', error: '', flush: async () => {}, ...save } }))
  const drafts = store.createDraftStore({ owner: 'user-a', identity: 'application:9', persistence: 'device' })
  drafts.write({ value: { answer: 'my offline answer' }, baseline: JSON.stringify({ answer: 'v1' }), writer: 'w', at: Date.now() })
  const stored = drafts.read(), decision = store.recoveryDecision(stored, JSON.stringify({ answer: 'v2 saved elsewhere' }))
  assert.equal(decision, 'conflict')
  const shown = html({ recovery: stored.value, recoveryKind: 'conflict' })
  assert.match(shown, /This device has changes from before a newer version was saved elsewhere\./); assert.match(shown, /Keep newer version/); assert.match(shown, /Review my copy/)
  assert.doesNotMatch(shown, /Restore/); assert.doesNotMatch(shown, /my offline answer/)
  const reviewing = html({ recovery: stored.value, recoveryKind: 'conflict', reviewing: true })
  assert.match(reviewing, /<textarea readOnly="" aria-label="Your earlier copy \(read-only\)"[^>]*>my offline answer<\/textarea>/); assert.doesNotMatch(reviewing, /Review my copy/)
  // The editor's queue is held for the whole conflict: nothing is saved on its own, even with timers and flushes.
  const saves = [], queue = new AutosaveQueue({ answer: 'v2 saved elsewhere' }, async v => { saves.push(v) }, () => {}, () => 'device', 1, () => true)
  queue.hold(); queue.change(stored.value); await new Promise(r => setTimeout(r, 5)); await queue.flush()
  assert.deepEqual(saves, []); assert.deepEqual(drafts.read().value, { answer: 'my offline answer' })
  // Offline and unreachable get the same Retry control as the error state.
  for (const state of ['offline', 'unreachable', 'error']) assert.match(html({ state, error: 'x' }), />Retry</)
})
