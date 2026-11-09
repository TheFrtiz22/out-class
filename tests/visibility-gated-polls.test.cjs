// FE-2: hidden tabs make no poll requests, and a page without a support marker makes no view-as calls.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

function load(file, mocks = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => {
    if (name in mocks) return mocks[name]
    if (name.startsWith('@/')) return load(['.ts', '.tsx'].map(ext => path.resolve(name.slice(2)) + ext).find(f => fs.existsSync(f)), mocks)
    return require(name)
  }, mod, mod.exports)
  return mod.exports
}

/** A fake page: visibility, listeners, interval timers and a clock the test advances. */
function page() {
  const saved = Object.fromEntries(['window', 'document', 'fetch', 'localStorage', 'BroadcastChannel'].map(k => [k, global[k]]))
  const realNow = Date.now
  let now = 1_000_000, nextTimer = 0
  const timers = new Map(), windowListeners = {}, documentListeners = {}, fetches = []
  const on = store => (k, fn) => { (store[k] ??= new Set()).add(fn) }
  const off = store => (k, fn) => { store[k]?.delete(fn) }
  global.window = {
    location: { reload() { fetches.push('reload') } },
    addEventListener: on(windowListeners), removeEventListener: off(windowListeners),
    setInterval(fn, ms) { const id = ++nextTimer; timers.set(id, { fn, ms }); return id },
    clearInterval(id) { timers.delete(id) },
  }
  global.document = { visibilityState: 'visible', addEventListener: on(documentListeners), removeEventListener: off(documentListeners) }
  global.fetch = async url => { fetches.push(url); return { ok: true, json: async () => ({ marker: false, sessionId: null }) } }
  global.localStorage = { setItem() {} }
  global.BroadcastChannel = class { postMessage() {} close() {} }
  Date.now = () => now
  return {
    timers, fetches, windowListeners, documentListeners,
    advance(ms) { now += ms; for (const { fn, ms: every } of [...timers.values()]) if (ms >= every) fn() },
    setHidden(hidden) { document.visibilityState = hidden ? 'hidden' : 'visible'; for (const fn of documentListeners.visibilitychange ?? []) fn() },
    restore() { Date.now = realNow; Object.assign(global, saved) },
  }
}

test('pollWhileVisible polls only while visible, catches up once on return, and cleans up', () => {
  const p = page()
  try {
    const { pollWhileVisible } = load('hooks/use-revalidate.ts')
    let runs = 0
    const stop = pollWhileVisible(() => { runs++ }, 30_000)
    assert.equal(p.timers.size, 1)
    p.advance(30_000); assert.equal(runs, 1, 'a visible tab polls on the interval')
    p.setHidden(true)
    assert.equal(p.timers.size, 0, 'a hidden tab has no poll timer')
    p.advance(120_000); assert.equal(runs, 1, 'no polls while hidden')
    p.setHidden(false)
    assert.equal(runs, 2, 'returning after a full interval polls once')
    assert.equal(p.timers.size, 1, 'and resumes the timer')
    p.setHidden(true); p.advance(5_000); p.setHidden(false)
    assert.equal(runs, 2, 'a short absence does not poll early')
    p.setHidden(false)
    assert.equal(p.timers.size, 1, 'a repeated visible event never starts a second timer')
    stop()
    assert.equal(p.timers.size, 0)
    assert.equal(p.documentListeners.visibilitychange.size, 0, 'cleanup removes the visibility listener')
  } finally { p.restore() }
})

test('pollWhileVisible starts paused in a hidden tab and can leave catch-up to useRevalidate', () => {
  const p = page()
  try {
    const { pollWhileVisible } = load('hooks/use-revalidate.ts')
    let runs = 0
    p.setHidden(true)
    const stop = pollWhileVisible(() => { runs++ }, 5_000, { catchUp: false })
    assert.equal(p.timers.size, 0, 'a tab opened in the background does not start polling')
    p.advance(60_000); p.setHidden(false)
    assert.equal(runs, 0, 'catchUp: false leaves the return refresh to the caller')
    assert.equal(p.timers.size, 1)
    stop()
  } finally { p.restore() }
})

test('pollWhileVisible whileHidden keeps presenter polling in a hidden tab; a function is read each tick', () => {
  const p = page()
  try {
    const { pollWhileVisible } = load('hooks/use-revalidate.ts')
    let always = 0, toggled = 0, presenting = false
    const stopAlways = pollWhileVisible(() => { always++ }, 5_000, { whileHidden: true })
    const stopToggled = pollWhileVisible(() => { toggled++ }, 5_000, { whileHidden: () => presenting })
    p.setHidden(true)
    p.advance(5_000)
    assert.equal(always, 1, 'whileHidden: true polls while hidden')
    assert.equal(toggled, 0, 'not presenting: paused while hidden')
    presenting = true; p.advance(5_000)
    assert.equal(toggled, 1, 'presenting: polls while hidden')
    stopAlways(); stopToggled()
    assert.equal(p.timers.size, 0)
  } finally { p.restore() }
})

function presentation(presenting) {
  const reads = []
  let effect
  const react = { useState: v => [v, () => {}], useEffect(fn) { effect = fn } }
  const mod = load('components/live-voting/room-presentation.tsx', {
    react, '@/lib/voting-room-api': { getLiveVotingPresentation: async input => { reads.push(input); return null } },
    '@/components/ui/loading-state': { LoadingState: 'LoadingState' }, '@/components/ui/button': { Button: 'Button' }, './applicant-slide': { ApplicantSlide: 'ApplicantSlide' },
  })
  mod.RoomPresentation({ clubId: 'club', sessionId: 'session', applicationId: 'app', identity: 'id', refreshKey: 0, presenting })
  return { reads, cleanup: effect() }
}

test('the projector and leader slide keep refreshing while hidden or covered; a member slide pauses', async () => {
  const p = page()
  try {
    p.setHidden(true)
    const projector = presentation(true), memberSlide = presentation(false)
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(projector.reads.length, 1); assert.equal(memberSlide.reads.length, 1)
    p.advance(5_000); await new Promise(resolve => setImmediate(resolve))
    assert.equal(projector.reads.length, 2, 'presenting: hidden window still refreshes')
    assert.equal(memberSlide.reads.length, 1, 'member: no refresh while hidden')
    projector.cleanup(); memberSlide.cleanup()
    assert.equal(p.timers.size, 0)
  } finally { p.restore() }
  const view = fs.readFileSync('components/live-voting/room-view.tsx', 'utf8')
  assert.match(view, /<RoomPresentation [^>]*presenting=\{view!=="member"\}/, 'the room passes presenting for the leader and projector views')
  assert.match(fs.readFileSync('components/live-voting/board-decision-mode.tsx', 'utf8'), /useEffect\(\(\)=>\{presenting\.current=present\},\[present\]\)/, 'the board follows its projector toggle')
})

test('SupportSessionSync makes no view-as calls without a support marker, but still checks a restored page', async () => {
  const p = page()
  try {
    let effect
    const sync = load('components/support-session-sync.tsx', { react: { useEffect(fn) { effect = fn } } })
    sync.SupportSessionSync({ marker: false, sessionId: null })
    const cleanup = effect(); await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(p.fetches, [], 'no mount check')
    assert.equal(p.timers.size, 0, 'no interval')
    assert.equal(p.windowListeners.focus?.size ?? 0, 0, 'no focus check')
    assert.equal(p.documentListeners.visibilitychange?.size ?? 0, 0, 'no visibility check')
    assert.equal(p.windowListeners.storage.size, 1, 'another tab changing the context still reloads this one')
    for (const fn of p.windowListeners.pageshow) await fn({ persisted: true })
    assert.deepEqual(p.fetches, ['/api/platform/view-as'], 'a back/forward-cache restore still checks once')
    global.fetch = async url => { p.fetches.push(url); return { ok: true, json: async () => ({ marker: true, sessionId: 'started-elsewhere' }) } }
    for (const fn of p.windowListeners.pageshow) await fn({ persisted: true })
    assert.equal(p.fetches.at(-1), 'reload', 'a restored page that missed a session start reloads')
    cleanup()
    assert.equal(p.windowListeners.storage.size + p.windowListeners.pageshow.size, 0)
  } finally { p.restore() }
})

test('SupportSessionSync without BroadcastChannel keeps one focus check when there is no marker', async () => {
  const p = page()
  try {
    delete global.BroadcastChannel
    let effect
    const sync = load('components/support-session-sync.tsx', { react: { useEffect(fn) { effect = fn } } })
    sync.SupportSessionSync({ marker: false, sessionId: null })
    const cleanup = effect(); await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(p.fetches, [], 'still no mount check or interval')
    assert.equal(p.timers.size, 0)
    for (const fn of p.windowListeners.focus) await fn()
    assert.deepEqual(p.fetches, ['/api/platform/view-as'])
    cleanup()
    assert.equal(p.windowListeners.focus.size, 0)
  } finally { p.restore() }
})

test('starting a support session tells other tabs before navigating', () => {
  const source = fs.readFileSync('components/admin/admin-directory.tsx', 'utf8')
  assert.match(source, /action: "start"[\s\S]{0,400}?notifySupportSessionChanged\(\);\s*window\.location\.assign\("\/home"\)/)
  assert.match(fs.readFileSync('components/platform-view-banner.tsx', 'utf8'), /notifySupportSessionChanged\(/, 'ending one does too')
})

test('SupportSessionSync with a support marker checks on mount and polls only while visible', async () => {
  const p = page()
  try {
    let effect
    const sync = load('components/support-session-sync.tsx', { react: { useEffect(fn) { effect = fn } } })
    sync.SupportSessionSync({ marker: true, sessionId: 'session' })
    const cleanup = effect(); await new Promise(resolve => setImmediate(resolve))
    assert.equal(p.fetches.filter(f => f === '/api/platform/view-as').length, 1, 'mount check')
    assert.deepEqual([...p.timers.values()].map(t => t.ms), [30_000])
    p.setHidden(true)
    assert.equal(p.timers.size, 0, 'hidden: no timer')
    p.advance(300_000)
    assert.equal(p.fetches.filter(f => f === '/api/platform/view-as').length, 1, 'hidden: no calls')
    cleanup()
    assert.equal(p.timers.size, 0)
  } finally { p.restore() }
})

test('every network poll in these views pauses in hidden tabs', () => {
  // [file, interval, options]: catchUp:false where useRevalidate or a visibility check already refreshes on return.
  const files = [
    ['components/decision-schedules.tsx', 30000], ['components/invitation-schedules.tsx', 30000], ['components/availability/scheduled-requests.tsx', 30000],
    ['components/communication-schedules.tsx', 30000, '{catchUp:false}'], ['components/live-voting/room-presentation.tsx', 5000, '{whileHidden:presenting}'], ['components/live-voting/room-view.tsx', 5000],
    ['components/live-voting/session-join.tsx', 5000], ['components/live-voting/board-decision-mode.tsx', 5000, '{whileHidden:()=>presenting.current}'], ['components/support-session-sync.tsx', 30000, '{ catchUp: false }'],
  ]
  for (const [file, ms, options] of files) {
    const source = fs.readFileSync(file, 'utf8')
    assert.doesNotMatch(source, /setInterval\(/, `${file} polls through pollWhileVisible, not a raw interval`)
    const start = source.indexOf('pollWhileVisible(') + 'pollWhileVisible('.length
    let depth = 1, end = start
    while (depth && end < source.length) { const c = source[end++]; if ('({['.includes(c)) depth++; else if (')}]'.includes(c)) depth-- }
    const args = [], call = source.slice(start, end - 1)
    for (let i = 0, d = 0, from = 0; i <= call.length; i++) { const c = call[i]; if (c === undefined || (c === ',' && !d)) { args.push(call.slice(from, i).trim()); from = i + 1 } else if ('({['.includes(c)) d++; else if (')}]'.includes(c)) d-- }
    assert.equal(args[1], String(ms), `${file} keeps its ${ms} ms interval`)
    assert.equal(args.slice(2).join(',') || undefined, options, `${file} catch-up option`)
  }
})
