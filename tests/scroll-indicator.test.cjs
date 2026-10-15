const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function IndicatorHarness({ reduced = false, href = 'https://outclass.test/?campaign=fall#students' } = {}) {
  const states = [], effects = [], observers = [], resizes = [], events = [], navigation = [], focus = [], attributes = new Map(), listeners = new Map()
  let cursor = 0, headerBottom = 86, contentBottom = 800
  const heroRect = { top: 0, bottom: 1000, height: 1000 }
  const buttonRect = { top: 880, bottom: 936, width: 56 }
  const target = { getBoundingClientRect: () => ({ top: 1200 }), hasAttribute: name => attributes.has(name), setAttribute: (name, value) => attributes.set(name, value), focus: options => focus.push(options) }
  const content = { getBoundingClientRect: () => ({ bottom: contentBottom }) }
  const region = { getBoundingClientRect: () => heroRect, querySelector: () => content }
  const button = { closest: () => region, getBoundingClientRect: () => buttonRect }
  const ref = { current: button }
  const window = { innerHeight: 1000, scrollY: 100, location: { href }, history: { state: { __NA: true }, pushState(state, _, href) { navigation.push({ state, href }); window.location.href = href } }, dispatchEvent: event => events.push(event), scrollTo: options => navigation.push(options), matchMedia: () => ({ matches: reduced }), addEventListener: (name, callback) => listeners.set(`window:${name}`, callback), removeEventListener: name => listeners.delete(`window:${name}`) }
  const document = { hidden: false, querySelector: () => ({ getBoundingClientRect: () => ({ bottom: headerBottom }) }), getElementById: () => target, addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name) }
  class IntersectionObserver { constructor(callback, options) { this.callback = callback; this.options = options; this.targets = []; observers.push(this) } observe(element) { this.targets.push(element) } disconnect() { this.disconnected = true } }
  class ResizeObserver { constructor(callback) { this.callback = callback; this.targets = []; resizes.push(this) } observe(element) { this.targets.push(element) } disconnect() { this.disconnected = true } }
  class HashChangeEvent { constructor(type, options) { Object.assign(this, { type }, options) } }
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync('components/landing/scroll-indicator.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('require', 'module', 'exports', 'window', 'document', 'getComputedStyle', 'IntersectionObserver', 'ResizeObserver', 'HashChangeEvent', code)(name => {
    if (name === 'react') return { useState: initial => { const i = cursor++; states[i] ??= initial; return [states[i], value => { states[i] = value }] }, useRef: () => ref, useEffect: effect => effects.push(effect) }
    if (name === '@/components/icons') return { Triangle: 'Triangle' }
    if (name === '@/lib/utils') return { cn: (...args) => args.filter(Boolean).join(' ') }
    if (name.endsWith('.css')) return {}
    return require(name)
  }, mod, mod.exports, window, document, () => ({ scrollMarginTop: '112px' }), IntersectionObserver, ResizeObserver, HashChangeEvent)
  const render = () => { cursor = 0; effects.length = 0; return mod.exports.ScrollIndicator({ className: 'oc-intro-scroll' }) }
  render()
  const cleanup = effects[0]()
  return { render, cleanup, observers, resizes, events, navigation, focus, attributes, window, document, heroRect, buttonRect, listeners, set headerBottom(value) { headerBottom = value }, set contentBottom(value) { contentBottom = value }, update() { observers.at(-1).callback() } }
}
test('indicator is a labelled native button with a decorative icon and stable target', () => {
  const h = IndicatorHarness(), tree = h.render()
  assert.equal(tree.type, 'button')
  assert.equal(tree.props.type, 'button')
  assert.equal(tree.props['aria-label'], 'Scroll to learn how OutClass works')
  assert.equal(tree.props['aria-controls'], 'about')
  assert.equal(tree.props.disabled, false)
  assert.equal(tree.props.tabIndex, 0)
  assert.equal(tree.props.children.props['aria-hidden'], 'true')
})
test('activation preserves query/history state, updates the native fragment contract and focuses without jumping', () => {
  const h = IndicatorHarness()
  h.headerBottom = 180
  h.render().props.onClick()
  assert.deepEqual(h.navigation[0], { state: { __NA: true }, href: 'https://outclass.test/?campaign=fall#about' })
  assert.deepEqual(h.navigation[1], { top: 1096, behavior: 'smooth' })
  assert.equal(h.events[0].type, 'hashchange')
  assert.equal(h.events[0].oldURL, 'https://outclass.test/?campaign=fall#students')
  assert.equal(h.attributes.get('tabindex'), '-1')
  assert.deepEqual(h.focus, [{ preventScroll: true }])
})
test('reduced motion scrolls instantly and a repeated target does not add duplicate history entries', () => {
  const h = IndicatorHarness({ reduced: true, href: 'https://outclass.test/#about' })
  h.render().props.onClick()
  assert.deepEqual(h.navigation, [{ top: 1188, behavior: 'instant' }])
  assert.equal(h.events.length, 0)
  h.document.getElementById = () => null
  h.render().props.onClick()
  assert.equal(h.navigation.length, 1)
})
test('leaving the hero removes the indicator from interaction and pauses its repeating animation', () => {
  const h = IndicatorHarness()
  h.heroRect.top = -700; h.heroRect.bottom = 300
  h.buttonRect.top = 180; h.buttonRect.bottom = 236
  h.contentBottom = 100; h.update()
  const tree = h.render()
  assert.equal(tree.props['data-available'], false)
  assert.equal(tree.props['data-running'], false)
  assert.equal(tree.props.disabled, true)
  assert.equal(tree.props.tabIndex, -1)
  assert.equal(tree.props['aria-hidden'], true)
  h.heroRect.top = -450; h.heroRect.bottom = 550; h.update()
  assert.equal(h.render().props['data-available'], false)
  h.heroRect.top = -350; h.heroRect.bottom = 650; h.update()
  assert.equal(h.render().props['data-available'], true)
})
test('mobile availability measures visible viewport area and suppresses collisions or offscreen controls', () => {
  const h = IndicatorHarness()
  h.window.innerHeight = 800
  h.heroRect.height = 1400; h.heroRect.top = -500; h.heroRect.bottom = 900
  h.buttonRect.top = 680; h.buttonRect.bottom = 728; h.contentBottom = 660
  h.resizes[0].callback()
  assert.equal(h.render().props['data-available'], true)
  h.contentBottom = 675; h.update()
  assert.equal(h.render().props['data-available'], false)
  h.contentBottom = 660; h.buttonRect.top = 780; h.buttonRect.bottom = 828; h.update()
  assert.equal(h.render().props['data-available'], false)
  h.buttonRect.top = 50; h.buttonRect.bottom = 98; h.contentBottom = 10; h.update()
  assert.equal(h.render().props['data-available'], false)
})
test('hidden tabs pause the indicator and unmount cleans up observers and listeners', () => {
  const h = IndicatorHarness()
  assert.equal(h.observers[0].targets.length, 2)
  assert.equal(h.resizes[0].targets.length, 2)
  h.document.hidden = true; h.listeners.get('visibilitychange')()
  assert.equal(h.render().props['data-running'], false)
  h.document.hidden = false; h.listeners.get('visibilitychange')()
  assert.equal(h.render().props['data-running'], true)
  h.cleanup()
  assert.equal(h.observers.every(observer => observer.disconnected), true)
  assert.equal(h.resizes[0].disconnected, true)
  assert.equal(h.listeners.size, 0)
})
