const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), ts = require('typescript')
const nodes = n => !n || typeof n !== 'object' ? [] : Array.isArray(n) ? n.flatMap(nodes) : [n, ...nodes(n.props?.children)]
const text = n => typeof n === 'string' ? n : Array.isArray(n) ? n.map(text).join('') : n?.props ? text(n.props.children) : ''
function load(file, mocks, globals = {}) {
  const mod = { exports: {} }
  let code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
  if (file.endsWith('public-event-board.tsx')) code += '\nexports.MyEventRsvps = MyEventRsvps;'
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(name => name in mocks ? mocks[name] : name.startsWith('@/') || name.startsWith('./') || name.endsWith('.css') ? new Proxy({}, { get: (_, key) => key }) : require(name), mod, mod.exports, ...Object.values(globals))
  return mod.exports
}
function hooks() {
  const slots = [], effects = [], cleanup = new Map(); let cursor = 0
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], next => slots[i] = typeof next === 'function' ? next(slots[i]) : next] },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial } },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((v, j) => v !== slots[i][j])) { slots[i] = deps; effects.push([i, fn]) } },
  }
  return { react, render(fn) { cursor = 0; return fn() }, async flush() { for (const [i, fn] of effects.splice(0)) { cleanup.get(i)?.(); cleanup.set(i, fn()) } for (let i = 0; i < 30; i++) await Promise.resolve() } }
}
const button = (tree, label) => nodes(tree).find(n => n.type === 'Button' && text(n).includes(label))
const deferred = () => { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej }); return { promise, resolve, reject } }
test('club search selection honors unsaved and in-flight guards before leaving the page', async () => {
  const h = hooks(), assigned = [], closed = []; let saving = false, consent = false, prompts = 0
  const C = load('components/shell/navigation-search.tsx', { react: h.react, '@/contexts/auth-context': { useAuth: () => ({ user: { id: 'student' } }) }, '@/lib/application-state': { useApplicationState: () => ({}) }, '@/lib/demo/store': { demoStore: { active: () => false } }, '@/lib/workspace-api': { searchWorkspace: async () => [{ kind: 'club', id: 'club', clubId: 'club', title: 'Club', detail: '' }] } }, { window: { setTimeout: fn => { fn(); return 1 }, clearTimeout() {}, confirm: () => { prompts++; return consent }, location: { assign: path => assigned.push(path) } }, document: { querySelector: selector => selector.includes('saving') ? saving : true } }).NavigationSearch
  const render = () => h.render(() => C({ open: true, items: [], onOpenChange: v => closed.push(v), onNavigate() {} }))
  nodes(render()).find(n => n.type === 'CommandInput').props.onValueChange('club'); render(); await h.flush()
  const select = () => nodes(render()).find(n => n.type === 'CommandItem').props.onSelect()
  select(); assert.equal(prompts, 1); assert.deepEqual(assigned, []); assert.deepEqual(closed, [])
  saving = true; consent = true; select(); assert.deepEqual(assigned, []); assert.equal(prompts, 1)
  saving = false; select(); assert.deepEqual(assigned, ['/club/club']); assert.deepEqual(closed, [false])
})
function boardHarness(api, id = '00000000-0000-4000-8000-000000000001') {
  const h = hooks(); let currentId = id
  const C = load('components/events/public-event-board.tsx', { react: h.react, '@/lib/campus-events': { eventCategories: [], eventDateLabel: value => value, eventTimeLabel: value => value }, 'next/navigation': { useSearchParams: () => new URLSearchParams(currentId ? { event: currentId } : {}) }, '@/contexts/auth-context': { useAuth: () => ({ user: null }) }, '@/lib/workspace-api': { getPublicCorkboard: async () => ({ events: [], clubs: [], total: 0, hasMore: false }), ...api } }, { window: { location: { search: '?event=' + id } }, setTimeout: fn => { fn(); return 1 }, clearTimeout() {} }).PublicEventBoard
  return { render: () => h.render(() => C()), flush: h.flush, setId: id => currentId = id }
}
test('failed event deep links provide retry and distinguish unavailable events from request errors', async () => {
  let fail = true
  const h = boardHarness({ getPublicCampusEvent: async () => { if (fail) throw Error('offline'); return null } })
  h.render(); await h.flush(); let tree = h.render()
  assert.ok(nodes(tree).some(n => n.props?.role === 'alert'))
  assert.ok(button(tree, 'Retry event'))
  fail = false; button(tree, 'Retry event').props.onClick(); h.render(); await h.flush(); tree = h.render()
  assert.match(text(tree), /no longer available/i)
  assert.equal(button(tree, 'Retry event'), undefined)
})
test('same-route event changes invalidate old lookups and open the currently linked event', async () => {
  const first = deferred(), second = deferred(); let reads = 0
  const h = boardHarness({ getPublicCampusEvent: () => ++reads === 1 ? first.promise : second.promise })
  h.render(); await h.flush(); h.setId('00000000-0000-4000-8000-000000000002'); h.render(); await h.flush()
  second.resolve({ id: 'second', title: 'Second event', capacity: null, date: '2030-01-01', endDate: '2030-01-01', rsvpCount: 0 }); await h.flush()
  first.resolve({ id: 'first', title: 'Stale event', capacity: null, date: '2030-01-01', endDate: '2030-01-01', rsvpCount: 0 }); await h.flush()
  assert.equal(reads, 2); assert.match(text(h.render()), /Second event/); assert.doesNotMatch(text(h.render()), /Stale event/)
  h.setId(''); h.render(); await h.flush(); assert.equal(nodes(h.render()).find(n => n.type === 'Dialog').props.open, false)
})
function rsvpHarness(api) {
  const h = hooks(), listeners = {}
  const C = load('components/events/public-event-board.tsx', { react: h.react, '@/lib/workspace-api': api }, { window: { addEventListener: (name, fn) => listeners[name] = fn, removeEventListener() {} } }).MyEventRsvps
  return { render: () => h.render(() => C({ onCancelled() {} })), flush: h.flush, refresh: () => listeners['outclass-event-rsvp']() }
}
test('RSVP history distinguishes loading from empty and does not show a false zero', async () => {
  const pending = deferred(), h = rsvpHarness({ getMyCampusEventRsvps: () => pending.promise })
  assert.ok(nodes(h.render()).some(n => n.type === 'LoadingState'))
  assert.doesNotMatch(text(h.render()), /Your RSVPs \(0\)/)
  await h.flush(); pending.resolve([]); await h.flush(); assert.match(text(h.render()), /No RSVPs yet/)
})
test('a stale RSVP refresh cannot resurrect a successfully cancelled RSVP', async () => {
  const stale = deferred(); let reads = 0
  const row = { eventId: 'event', title: 'Event', available: true }
  const h = rsvpHarness({ getMyCampusEventRsvps: () => ++reads === 1 ? Promise.resolve([row]) : stale.promise, setCampusEventRsvp: async () => ({ going: false, count: 0 }) })
  h.render(); await h.flush(); h.refresh(); await button(h.render(), 'Cancel RSVP').props.onClick(); await h.flush()
  stale.resolve([row]); await h.flush()
  assert.equal(button(h.render(), 'Cancel RSVP'), undefined); assert.match(text(h.render()), /RSVP was cancelled/)
})

test('malformed event identifiers are unavailable links rather than endless request retries', async () => {
  let reads = 0
  const h = boardHarness({ getPublicCampusEvent: async () => { reads++; throw Error('Invalid uuid') } }, 'broken-link')
  h.render(); await h.flush()
  assert.match(text(h.render()), /no longer available/i)
  assert.equal(button(h.render(), 'Retry event'), undefined); assert.equal(reads, 0)
})
