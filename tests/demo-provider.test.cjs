const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function loadModule(file) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(require, mod, mod.exports)
  return mod.exports
}
function provider({ storageFails = false, role = 'student', load } = {}) {
  let loads = 0
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
  const listeners = new Set(), demoState = { clubs: [{id:'mii'}], perspective: {role,clubId:'mii'} }
  const changes = [], store = { subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn) }, stop() { active = false }, active: () => active, get: () => demoState, start() { if (storageFails) throw Error('Storage unavailable'); active = true; listeners.forEach(fn => fn()) }, mutate(fn) { fn(demoState); changes.push(structuredClone(demoState)); listeners.forEach(fn => fn()) }, reset() { changes.push('reset') } }
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync('contexts/demo-context.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const mocks = { react, '@/contexts/demo-mode': { DemoContext: react.createContext(null), useDemoMode() {} }, '@/components/outclass-loading-screen': { OutClassLoadingScreen: 'OutClassLoadingScreen' }, '@/lib/demo/store': { demoStore: store, demoUser: () => ({ id: 'demo-student' }) }, '@/lib/student-navigation': { resolveStudentView: value => ['corkboard','tracker','explore'].includes(value) ? value : null }, '@/lib/navigation': require('./helpers/navigation-module.cjs') }
  // The provider loads the store through the shared loader and records activation
  // in lib/demo/activation (a fresh real copy per provider, so state never leaks).
  mocks['@/lib/demo/loader'] = { loadDemoStore: () => { loads++; return load ? load(mocks['@/lib/demo/store']) : Promise.resolve(mocks['@/lib/demo/store']) } }
  mocks['@/lib/demo/activation'] = loadModule('lib/demo/activation.ts')
  const fetch = (...args) => new Promise((resolve, reject) => requests.push({ args, resolve, reject }))
  const window = { addEventListener() {}, removeEventListener() {}, location: { href: 'http://localhost/preview?workspace=student&view=corkboard&section=decisions&demoClub=mii', reload() {}, assign(url) { window.location.href = String(url) } }, history: { replaceState(_state, _title, url) { window.location.href = String(url) } } }
  new Function('require', 'module', 'exports', 'fetch', 'window', 'localStorage', code)(name => mocks[name] || require(name), mod, mod.exports, fetch, window, {removeItem(){}})
  return {
    requests, changes, window, store, activation: mocks['@/lib/demo/activation'], loads: () => loads,
    render(props = {}) { cursor = 0; return mod.exports.DemoDataProvider({ children: 'NORMAL_ACCOUNT', clearStaleSession: true, ...props }) },
    effects() { pending.splice(0).forEach(fn => fn()) },
  }
}
const settle = () => new Promise(resolve => setImmediate(resolve))
// Demo data loads with a dynamic import once Demo Mode is enabled; perspective
// and reset controls exist only in that state.
const enabledDemo = { clearStaleSession: false, enabled: true, allowed: true }
async function demoReady(h, props = enabledDemo) { h.render(props); h.effects(); await settle(); return props }
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
  await settle()
  assert.equal(normal.render({ clearStaleSession: false }).props.value.demoIdentity, null, 'normal accounts never receive a demo identity')
  const stale = provider()
  stale.render()
  stale.effects()
  assert.equal(stale.render().props.children[1].type, 'OutClassLoadingScreen')
  stale.requests[0].resolve({ ok: true })
  await settle()
  assert.equal(stale.render().props.children[1].props.children, 'NORMAL_ACCOUNT')
})

test('demo initialization uses the branded fallback only until isolated data is ready', async () => {
  const h = provider(), props = { clearStaleSession: false, enabled: true, allowed: true }
  assert.equal(h.render(props).props.children[1].type, 'OutClassLoadingScreen')
  h.effects()
  assert.equal(h.render(props).props.children[1].type, 'OutClassLoadingScreen', 'still loading until demo data is ready')
  await settle()
  const ready = h.render(props)
  assert.equal(ready.props.children[1].props.children, 'NORMAL_ACCOUNT')
  assert.equal(ready.props.value.state.perspective.clubId, 'mii')
  assert.deepEqual(ready.props.value.demoIdentity, { id: 'demo-student' }, 'the sample student identity is provided once demo data is ready')
  assert.equal(h.requests.length, 0)
})

test('demo storage failures expose the existing exit action without an indefinite loader', async () => {
  const h = provider({ storageFails: true }), props = { clearStaleSession: false, enabled: true, allowed: true }
  h.render(props); h.effects(); await settle()
  const failed = h.render(props)
  assert.equal(failed.props.children[0].props.role, 'alert')
  assert.equal(failed.props.children[0].props.children[1].props.children, 'Exit demo')
  assert.equal(failed.props.children[1], null)
})

test('demo perspective changes and reset clear obsolete student view/section routing without touching live data', async () => {
  const h = provider(), props = await demoReady(h), tree = h.render(props)
  tree.props.value.viewAs('leader', 'mii')
  assert.equal(h.changes[0].perspective.role, 'leader')
  assert.equal(new URL(h.window.location.href).search, '')
  h.window.location.href = 'http://localhost/preview?workspace=student&view=tracker&section=interviews'
  h.render(props).props.value.resetDemo()
  assert.equal(h.changes[1], 'reset')
  const resetUrl = new URL(h.window.location.href)
  assert.equal(resetUrl.searchParams.get('view'), 'student-dashboard')
  assert.equal(resetUrl.searchParams.get('workspace'), 'student')
  assert.equal(resetUrl.searchParams.has('section'), false)
  assert.equal(h.requests.length, 0)
})

test('an explicit student bookmark survives the perspective change needed to open it', async () => {
  const h = provider(), props = await demoReady(h)
  h.render(props).props.value.viewAs('student', 'mii')
  const url = new URL(h.window.location.href)
  assert.equal(url.searchParams.get('workspace'), 'student')
  assert.equal(url.searchParams.get('view'), 'corkboard')
  assert.equal(url.searchParams.has('demoClub'), false)
})

test('reset from a club route returns to canonical student Home instead of re-entering leadership', async () => {
 const h = provider(), props = await demoReady(h)
 h.window.location.href = 'http://localhost/club/mii/workspace?section=recruitment&tool=decisions'
 h.render(props).props.value.resetDemo()
 const url = new URL(h.window.location.href)
 assert.equal(url.pathname, '/home')
 assert.equal(url.searchParams.get('view'), null)
 assert.equal(url.searchParams.get('workspace'), null)
 assert.equal(url.searchParams.has('tool'), false)
})

test('reselecting the active demo leader preserves the interview route and mounted drafts', async () => {
  const h = provider({ role: 'leader' }), props = await demoReady(h)
  const tree = h.render(props), key = tree.props.children[1].key
  const href = 'http://localhost/club/mii/workspace?section=recruitment&tool=interviews&interview=1&roundId=round&applicantId=app'
  h.window.location.href = href
  tree.props.value.viewAs('leader', 'mii')
  tree.props.value.viewAs('leader', 'mii')
  assert.equal(h.window.location.href, href)
  assert.equal(h.render(props).props.children[1].key, key, 'Repeated selection must not remount draft editors')
  assert.deepEqual(h.changes, [], 'Repeated selection must not rewrite saved Demo data')
  assert.equal(h.requests.length, 0)
})

test('opening a direct demo interview link from a saved student perspective retains its full destination', async () => {
  const h = provider(), props = await demoReady(h)
  const href = 'http://localhost/club/mii/workspace?section=recruitment&tool=interviews&interview=1&roundId=round&applicantId=app'
  h.window.location.href = href + '&demoClub=mii'
  h.render(props).props.value.viewAs('leader', 'mii')
  assert.equal(h.window.location.href, href)
  assert.equal(h.changes[0].perspective.role, 'leader')
  h.render(props).props.value.viewAs('leader', 'mii')
  assert.equal(h.window.location.href, href)
  assert.equal(h.changes.length, 1)
  assert.equal(h.requests.length, 0)
})

test('preserving club deep links never permits management of another demo club', async () => {
  const h = provider(), props = await demoReady(h)
  const href = 'http://localhost/club/other/workspace?section=recruitment&tool=interviews&interview=1'
  h.window.location.href = href
  h.render(props).props.value.viewAs('leader', 'other')
  assert.equal(h.window.location.href, href)
  assert.deepEqual(h.changes, [])
  assert.equal(h.requests.length, 0)
  assert.equal(h.render(props).props.children[0].props.role, 'alert')
})

// Timeout, failure and retry paths. The requested flag is browser-only, so these
// tests provide a window for the activation module and restore it afterwards.
function inBrowser(t) { global.window = {}; t.after(() => delete global.window) }
const alertOf = tree => tree.props.children[0]
const buttons = tree => alertOf(tree).props.children.filter(child => child && child.type === 'button')

test('a stalled demo load times out to the error alert with Try again and Exit, never an indefinite loader', async t => {
  inBrowser(t); t.mock.timers.enable({ apis: ['setTimeout'] })
  const h = provider({ load: () => new Promise(() => {}) })
  assert.equal(h.render(enabledDemo).props.children[1].type, 'OutClassLoadingScreen')
  h.effects()
  t.mock.timers.tick(h.activation.DEMO_READY_TIMEOUT_MS)
  const failed = h.render(enabledDemo)
  assert.equal(alertOf(failed).props.role, 'alert')
  assert.match(alertOf(failed).props.children[0], /taking too long/)
  assert.deepEqual(buttons(failed).map(b => b.props.children), ['Exit demo', 'Try again'])
  assert.equal(failed.props.children[1], null, 'no loader and no live children after the timeout')
  await assert.rejects(h.activation.demoGate(), { name: 'DemoUnavailableError' }, 'waiting adapter calls fail closed')
})

test('a failed demo load offers Try again, which reloads and then renders demo children', async t => {
  inBrowser(t)
  let attempt = 0
  const h = provider({ load: store => ++attempt === 1 ? Promise.reject(Error('ChunkLoadError')) : Promise.resolve(store) })
  h.render(enabledDemo); h.effects(); await settle()
  const failed = h.render(enabledDemo)
  assert.match(alertOf(failed).props.children[0], /could not load/)
  await assert.rejects(h.activation.demoGate(), { name: 'DemoUnavailableError' })
  buttons(failed).find(b => b.props.children === 'Try again').props.onClick()
  const retrying = h.render(enabledDemo)
  assert.equal(retrying.props.children[0], '', 'the alert clears while retrying')
  assert.equal(retrying.props.children[1].type, 'OutClassLoadingScreen')
  h.effects(); await settle()
  const ready = h.render(enabledDemo)
  assert.equal(h.loads(), 2)
  assert.equal(ready.props.children[0], '')
  assert.equal(ready.props.children[1].props.children, 'NORMAL_ACCOUNT')
})

test('a load that finishes after the timeout clears the stale alert and renders demo children', async t => {
  inBrowser(t); t.mock.timers.enable({ apis: ['setTimeout'] })
  let finish
  const h = provider({ load: store => new Promise(resolve => { finish = () => resolve(store) }) })
  h.render(enabledDemo); h.effects()
  t.mock.timers.tick(h.activation.DEMO_READY_TIMEOUT_MS)
  assert.equal(alertOf(h.render(enabledDemo)).props.role, 'alert')
  finish(); await settle()
  const ready = h.render(enabledDemo)
  assert.equal(ready.props.children[0], '', 'no stale "taking too long" alert over working demo content')
  assert.equal(ready.props.children[1].props.children, 'NORMAL_ACCOUNT')
})

test('a storage failure during start rolls the store back and fails waiting calls closed', async t => {
  inBrowser(t)
  const h = provider()
  // Like the real store: start() marks itself active, then the first save throws.
  const start = h.store.start.bind(h.store)
  let activeWhenThrown = false
  h.store.start = (...args) => { start(...args); activeWhenThrown = h.store.active(); throw Error('QuotaExceededError') }
  h.render(enabledDemo); h.effects(); await settle()
  const failed = h.render(enabledDemo)
  assert.match(alertOf(failed).props.children[0], /storage is unavailable/)
  assert.equal(activeWhenThrown, true, 'the fake failed after marking itself active, like the real store')
  assert.equal(h.store.active(), false, 'the store is stopped, not left half-started')
  await assert.rejects(h.activation.demoGate(), { name: 'DemoUnavailableError' })
})

test('pages without Demo Mode never load the demo store', async t => {
  inBrowser(t)
  const h = provider()
  h.render({ clearStaleSession: false }); h.effects(); await settle()
  assert.equal(h.loads(), 0)
  assert.equal(h.activation.isDemoRequested(), false)
  assert.equal(await h.activation.demoGate(), false)
})
