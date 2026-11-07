const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const flush = () => new Promise(resolve => setImmediate(resolve))
const nodes = n => !n || typeof n !== 'object' ? [] : Array.isArray(n) ? n.flatMap(nodes) : [n, ...nodes(n.props?.children)]
const text = n => typeof n === 'number' ? String(n) : typeof n === 'string' ? n : Array.isArray(n) ? n.map(text).join('') : n?.props ? text(n.props.children) : ''

function harness() {
  const slots = [], effects = [], cleanups = new Map(), timers = new Map(), reads = []
  let index = 0, nextTimer = 0, revalidate = null
  const react = {
    useState(v) { const i = index++; if (!(i in slots)) slots[i] = v; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }] },
    useRef(v) { const i = index++; return slots[i] ??= { current: v } },
    useMemo(fn, deps) { const i = index++; if (!slots[i] || deps.some((v, j) => v !== slots[i].deps[j])) slots[i] = { deps, value: fn() }; return slots[i].value },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps) },
    useEffect(fn, deps) { const i = index++; if (!slots[i] || deps.some((v, j) => v !== slots[i][j])) { slots[i] = deps; effects.push([i, fn]) } },
  }
  const api = { meetingAttendance: () => new Promise((resolve, reject) => reads.push({ resolve: count => resolve(Array.from({ length: count }, (_, id) => ({ id }))), reject })) }
  const mocks = { react, '@/lib/workspace-api': api, '@/hooks/use-revalidate': { useRevalidate(fn, options) { revalidate = { fn, options } } } }
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync('components/meeting-workspace.tsx', 'utf8') + '\nexports.MeetingAttendanceState = MeetingAttendanceState;', { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('require', 'module', 'exports', 'document', 'setInterval', 'clearInterval', code)(
    name => mocks[name] || (name === 'react/jsx-runtime' ? require(name) : new Proxy({}, { get: (_, key) => String(key) })),
    mod, mod.exports, { visibilityState: 'visible' },
    fn => { const id = ++nextTimer; timers.set(id, fn); return id }, id => timers.delete(id))
  const now = Date.now()
  const meeting = { id: 'meeting', clubId: 'club', date: new Date(now - 60_000).toISOString(), endDate: new Date(now + 3_600_000).toISOString() }
  return {
    reads, timers, revalidate: () => revalidate,
    render(props = {}) { index = 0; const tree = mod.exports.MeetingAttendanceState({ meeting, polling: true, onOpen() {}, ...props }); while (effects.length) { const [slot, setup] = effects.shift(); cleanups.get(slot)?.(); cleanups.set(slot, setup()) } return tree },
    tick() { for (const fn of [...timers.values()]) fn() },
  }
}

test('a failed live attendance poll keeps the last count, keeps polling, and clears the note on the next success', async () => {
  const h = harness(); let opened = null
  let tree = h.render({ onOpen: id => { opened = id } })
  nodes(tree).find(n => n.type === 'Button').props.onClick(); assert.equal(opened, 'meeting')
  h.reads[0].resolve(4); await flush(); tree = h.render()
  assert.match(text(tree), /4 recorded check-ins · updating live/)
  h.tick(); h.reads[1].reject(Error('offline')); await flush(); tree = h.render()
  assert.match(text(tree), /4 recorded check-ins · Couldn’t update/, 'the last good count stays with a quiet note')
  assert.equal(nodes(tree).some(n => n.type === 'Button'), false)
  assert.equal(h.timers.size, 1, 'polling continues after a transient failure')
  h.tick(); h.reads[2].resolve(6); await flush(); tree = h.render()
  assert.match(text(tree), /6 recorded check-ins · updating live/); assert.doesNotMatch(text(tree), /Couldn’t update/)
})

test('attendance ticks never overlap, and only the meeting being followed polls', async () => {
  const h = harness()
  let tree = h.render(); nodes(tree).find(n => n.type === 'Button').props.onClick(); h.render()
  h.tick(); h.tick(); void h.revalidate().fn(); assert.equal(h.reads.length, 1, 'no request starts while one is in flight')
  h.reads[0].resolve(2); await flush(); h.render(); h.tick(); assert.equal(h.reads.length, 2)
  h.reads[1].resolve(3); await flush(); h.render({ polling: false })
  assert.equal(h.timers.size, 0, 'another opened meeting took over live updates')
  assert.equal(h.revalidate().options.enabled, true, 'it still reloads when the person returns')
})
