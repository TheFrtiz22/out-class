const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function provider() {
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
  const store = { subscribe: () => () => {}, stop() {}, active: () => false }
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync('contexts/demo-context.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const mocks = { react, '@/lib/demo/store': { demoStore: store } }
  const fetch = (...args) => new Promise((resolve, reject) => requests.push({ args, resolve, reject }))
  const window = { addEventListener() {}, removeEventListener() {}, location: { reload() {}, assign() {} } }
  new Function('require', 'module', 'exports', 'fetch', 'window', code)(name => mocks[name] || require(name), mod, mod.exports, fetch, window)
  return {
    requests,
    render(props = {}) { cursor = 0; return mod.exports.DemoDataProvider({ children: 'NORMAL_ACCOUNT', clearStaleSession: true, ...props }) },
    effects() { pending.splice(0).forEach(fn => fn()) },
  }
}
const settle = () => new Promise(resolve => setImmediate(resolve))
test('failed stale-cookie cleanup keeps live account children gated; retry clears rather than enables demo', async () => {
  const h = provider()
  assert.equal(h.render().props.children[1].type, 'p')
  h.effects()
  h.requests[0].reject(new Error('Offline'))
  await settle()
  const failure = h.render()
  assert.equal(failure.props.children[1].type, 'p', 'Live account must not mount with a blocking cookie')
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
  assert.equal(stale.render().props.children[1].type, 'p')
  stale.requests[0].resolve({ ok: true })
  await settle()
  assert.equal(stale.render().props.children[1].props.children, 'NORMAL_ACCOUNT')
})
