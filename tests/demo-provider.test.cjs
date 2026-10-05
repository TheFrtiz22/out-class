const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function provider({ storageFails = false } = {}) {
  const states = [], effects = [], pending = []
  let cursor = 0
  const requests = []
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    useState(initial) {
      const key = cursor++
      if (!(key in states)) states[key] = initial
      return [states[key], value => { states[key] = typeof value === 'function' ? value(states[key]) : value }]
    },
    useEffect(effect, deps) {
      const key = cursor++
      if (!effects[key] || deps.some((value, index) => value !== effects[key][index])) {
        effects[key] = deps
        pending.push(effect)
      }
    },
  }
  let active = false
  const listeners = new Set(), demoState = { clubs: [{id:'mii'}], perspective: {role:'student',clubId:'mii'} }
  const changes = [], store = { subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn) }, stop() { active = false }, active: () => active, get: () => demoState, start() { if (storageFails) throw Error('Storage unavailable'); active = true; listeners.forEach(fn => fn()) }, mutate(fn) { const state = { clubs: [{id:'mii'}], perspective: {role:'student',clubId:'mii'} }; fn(state); changes.push(state) }, reset() { changes.push('reset') } }
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync('contexts/demo-context.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const mocks = { react, '@/components/outclass-loading-screen': { OutClassLoadingScreen: 'OutClassLoadingScreen' }, '@/lib/demo/store': { demoStore: store }, '@/lib/student-navigation': { resolveStudentView: value => ['corkboard','tracker','explore'].includes(value) ? value : null } }
  const fetch = (...args) => new Promise((resolve, reject) => requests.push({ args, resolve, reject }))
  const window = { addEventListener() {}, removeEventListener() {}, location: { href: 'http://localhost/preview?workspace=student&view=corkboard&section=decisions&demoClub=mii', reload() {}, assign(url) { window.location.href = String(url) } }, history: { replaceState(_state, _title, url) { window.location.href = String(url) } } }
  new Function('require', 'module', 'exports', 'fetch', 'window', 'localStorage', code)(name => mocks[name] || require(name), mod, mod.exports, fetch, window, {removeItem(){}})
  return {
    requests, changes, window,
    render(props = {}) { cursor = 0; return mod.exports.DemoDataProvider({ children: 'NORMAL_ACCOUNT', clearStaleSession: true, ...props }) },
    effects() { pending.splice(0).forEach(fn => fn()) },
  }
}
const settle = () => new Promise(resolve => setImmediate(resolve))
test('failed stale-cookie cleanup keeps live account children gated; retry clears rather than enables demo', async () => {
  const h = provider()
  assert.equal(h.render().props.children[1].type, 'OutClassLoadingScreen')
  h.effects()
  h.requests[0].reject(new Error('Offline'))
  await settle()
  const failure = h.render()
  assert.equal(failure.props.children[1], null, 'Show the failure alert without a permanent loader or live account children')
  assert.equal(failure.props.children[0].props.role, 'alert')
  failure.props.children[0].props.children[1].props.onClick()
  h.render()
  h.effects()
  assert.equal(h.requests.length, 2)
  const [url, options] = h.requests[1].args
  assert.equal(url, '/api/demo')
  assert.equal(options.method, 'POST')
  assert.deepEqual(JSON.parse(options.body), { enabled: false })
  h.requests[1].resolve({ ok: true })
  await settle()
  assert.equal(h.render().props.children[1].props.children, 'NORMAL_ACCOUNT')
})
test('normal users mount without demo calls; successful stale cleanup precedes account mounting', async () => {
  const normal = provider()
  assert.equal(normal.render({ clearStaleSession: false }).props.children[1].props.children, 'NORMAL_ACCOUNT')
  normal.effects()
  assert.equal(normal.requests.length, 0)
  const stale = provider()
  stale.render()
  stale.effects()
  assert.equal(stale.render().props.children[1].type, 'OutClassLoadingScreen')
  stale.requests[0].resolve({ ok: true })
  await settle()
  assert.equal(stale.render().props.children[1].props.children, 'NORMAL_ACCOUNT')
})

test('demo initialization uses the branded fallback only until isolated data is ready', () => {
  const h = provider(), props = { clearStaleSession: false, enabled: true, allowed: true }
  assert.equal(h.render(props).props.children[1].type, 'OutClassLoadingScreen')
  h.effects()
  const ready = h.render(props)
  assert.equal(ready.props.children[1].props.children, 'NORMAL_ACCOUNT')
  assert.equal(ready.props.value.state.perspective.clubId, 'mii')
  assert.equal(h.requests.length, 0)
})

test('demo storage failures expose the existing exit action without an indefinite loader', () => {
  const h = provider({ storageFails: true }), props = { clearStaleSession: false, enabled: true, allowed: true }
  h.render(props); h.effects()
  const failed = h.render(props)
  assert.equal(failed.props.children[0].props.role, 'alert')
  assert.equal(failed.props.children[0].props.children[1].props.children, 'Exit demo')
  assert.equal(failed.props.children[1], null)
})

test('demo perspective changes and reset clear obsolete student view/section routing without touching live data', () => {
  const h = provider(), tree = h.render({ clearStaleSession: false })
  tree.props.value.viewAs('leader', 'mii')
  assert.equal(h.changes[0].perspective.role, 'leader')
  assert.equal(new URL(h.window.location.href).search, '')
  h.window.location.href = 'http://localhost/preview?workspace=student&view=tracker&section=interviews'
  h.render({ clearStaleSession: false }).props.value.resetDemo()
  assert.equal(h.changes[1], 'reset')
  const resetUrl = new URL(h.window.location.href)
  assert.equal(resetUrl.searchParams.get('view'), 'student-dashboard')
  assert.equal(resetUrl.searchParams.get('workspace'), 'student')
  assert.equal(resetUrl.searchParams.has('section'), false)
  assert.equal(h.requests.length, 0)
})

test('an explicit student bookmark survives the perspective change needed to open it', () => {
  const h = provider()
  h.render({ clearStaleSession: false }).props.value.viewAs('student', 'mii')
  const url = new URL(h.window.location.href)
  assert.equal(url.searchParams.get('workspace'), 'student')
  assert.equal(url.searchParams.get('view'), 'corkboard')
  assert.equal(url.searchParams.has('demoClub'), false)
})

test('reset from a club route returns to canonical student Home instead of re-entering leadership', () => {
 const h = provider()
 h.window.location.href = 'http://localhost/club/mii/workspace?section=recruitment&tool=decisions'
 h.render({clearStaleSession:false}).props.value.resetDemo()
 const url = new URL(h.window.location.href)
 assert.equal(url.pathname, '/')
 assert.equal(url.searchParams.get('view'), 'student-dashboard')
 assert.equal(url.searchParams.get('workspace'), 'student')
 assert.equal(url.searchParams.has('tool'), false)
})
