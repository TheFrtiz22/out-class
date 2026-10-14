const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const React = require('react')
function load(file, mocks = {}, globals = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(name => name in mocks ? mocks[name] : require(name), mod, mod.exports, ...Object.values(globals))
  return mod.exports
}
const { journeyNavigationMerged } = load('hooks/use-journey-navigation.ts')
test('handoff enters at the navbar edge and requires 24px of upward travel to reverse', () => {
  assert.equal(journeyNavigationMerged(false, 101, 500, 100), false)
  assert.equal(journeyNavigationMerged(false, 100, 500, 100), true)
  for (const start of [99, 100, 101, 120, 124]) assert.equal(journeyNavigationMerged(true, start, 500, 100), true)
  assert.equal(journeyNavigationMerged(true, 125, 500, 100), false)
})
test('showcase exit has its own hysteresis and never exposes a compact toggle beyond the section', () => {
  assert.equal(journeyNavigationMerged(true, -200, 100, 100), false)
  assert.equal(journeyNavigationMerged(false, -200, 124, 100), false)
  assert.equal(journeyNavigationMerged(false, -200, 125, 100), true)
  assert.equal(journeyNavigationMerged(false, 600, 800, 100), false)
  assert.equal(journeyNavigationMerged(false, -1000, -20, 100), false)
  assert.equal(journeyNavigationMerged(true, -200, 420, 100, 420), false)
  assert.equal(journeyNavigationMerged(false, -200, 440, 100, 420), false)
  assert.equal(journeyNavigationMerged(false, -200, 445, 100, 420), true)
})
function Harness() {
  const refs = [], effects = [], observers = [], resizes = [], states = [], frames = new Map(), focused = []
  let frameId = 0, start = 2000, end = 5000, bottom = 86
  const element = name => ({ getBoundingClientRect: () => ({ width: 196 }), focus(options) { focused.push({ name, options }) } })
  const compact = element('compact'), original = element('original'), menu = element('menu'), logo = element('logo')
  const header = { getBoundingClientRect: () => ({ bottom }), querySelector: selector => selector === '.oc-public-nav-surface' ? header : selector.includes('oc-public-journey-desktop') ? compact : selector.includes('menu-toggle') ? menu : logo }
  const controls = { getBoundingClientRect: () => ({ top: start }), parentElement: { querySelector: () => original } }
  const endElement = { getBoundingClientRect: () => ({ top: end }) }
  const document = { activeElement: null, documentElement: { scrollHeight: 6000 } }
  class IntersectionObserver { constructor(callback, options) { this.callback = callback; this.options = options; this.targets = []; this.disconnected = false; observers.push(this) } observe(target) { this.targets.push(target) } disconnect() { this.disconnected = true } }
  class ResizeObserver { constructor(callback) { this.callback = callback; this.targets = []; this.disconnected = false; resizes.push(this) } observe(target) { this.targets.push(target) } disconnect() { this.disconnected = true } }
  const { useJourneyNavigation } = load('hooks/use-journey-navigation.ts', {
    react: { useRef: initial => { const ref = { current: initial }; refs.push(ref); return ref }, useState: () => [false, value => states.push(value)], useEffect: effect => effects.push(effect) },
  }, { window: { innerHeight: 900 }, document, IntersectionObserver, ResizeObserver, getComputedStyle: () => ({ visibility: 'visible' }), requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId }, cancelAnimationFrame: id => frames.delete(id) })
  useJourneyNavigation()
  refs[0].current = header; refs[1].current = controls; refs[2].current = endElement; refs[3].current = {}
  const cleanup = effects[0]()
  return { states, observers, resizes, cleanup, focused, document, compact, set start(value) { start = value }, set end(value) { end = value }, set bottom(value) { bottom = value }, update() { observers.find(o => !o.disconnected).callback() }, flush() { for (const fn of frames.values()) fn(); frames.clear() } }
}
test('observers detect large scroll jumps, coordinate one state, and rebuild after navbar resize', () => {
  const h = Harness()
  assert.equal(h.observers.length, 4)
  assert.equal(h.observers[0].options.rootMargin, '-98px 0px 6900px 0px')
  assert.equal(h.observers[1].options.rootMargin, '-122px 0px 6900px 0px')
  assert.equal(h.observers[0].targets.length, 1)
  h.start = -500; h.update(); assert.deepEqual(h.states, [true])
  h.start = 110; h.update(); assert.deepEqual(h.states, [true])
  h.bottom = 60; h.resizes[0].callback(); assert.deepEqual(h.states, [true, false])
  assert.equal(h.observers.slice(0, 4).every(o => o.disconnected), true)
  h.start = -800; h.end = -10; h.update(); assert.deepEqual(h.states, [true, false])
  h.end = 500; h.update(); assert.deepEqual(h.states, [true, false, true])
  h.cleanup()
  assert.equal(h.observers.every(o => o.disconnected), true)
  assert.equal(h.resizes[0].disconnected, true)
})
test('keyboard focus follows the original control into the compact control and back without scrolling', () => {
  const h = Harness()
  h.document.activeElement = { dataset: { perspectiveOption: 'leader' }, closest: selector => selector === '.oc-journey-controls' }
  h.start = 90; h.update(); h.flush()
  assert.deepEqual(h.focused[0], { name: 'compact', options: { preventScroll: true } })
  h.document.activeElement = { dataset: { perspectiveOption: 'leader' }, closest: selector => selector === '.oc-public-journey' }
  h.start = 150; h.update(); h.flush()
  assert.equal(h.focused[1].name, 'original')
  h.start = 90; h.update(); h.flush()
  h.end = 80; h.update(); h.flush()
  assert.equal(h.focused.at(-1).name, 'logo')
})
test('mobile handoff yields keyboard focus to the accessible menu entry point', () => {
  const h = Harness()
  h.compact.getBoundingClientRect = () => ({ width: 0 })
  h.document.activeElement = { dataset: { perspectiveOption: 'student' }, closest: selector => selector === '.oc-journey-controls' }
  h.start = 90; h.update(); h.flush()
  assert.equal(h.focused[0].name, 'menu')
})
test('original and compact controls expose the same state and invoke the same switching callback', () => {
  const { PerspectiveSwitcher } = load('components/landing/perspective-switcher.tsx')
  const changed = []
  const onChange = value => changed.push(value)
  for (const compact of [false, true]) {
    const tree = PerspectiveSwitcher({ perspective: 'leader', onChange, compact })
    const buttons = tree.props.children.filter(child => child.type === 'button')
    assert.equal(buttons[0].props['aria-pressed'], false)
    assert.equal(buttons[1].props['aria-pressed'], true)
    assert.equal(buttons[0].props['aria-controls'], 'product-journey')
    buttons[0].props.onClick(); buttons[1].props.onClick()
    assert.equal(tree.props['aria-label'], compact ? 'Showcase perspective' : undefined)
  }
  assert.deepEqual(changed, ['student', 'leader', 'student', 'leader'])
})
