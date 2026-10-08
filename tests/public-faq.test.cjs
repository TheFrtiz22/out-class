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
const content = load('lib/public-faq.ts')
const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)]

function entry({ reduced = false, hash = '' } = {}) {
  const refs = [], effects = [], frames = [], animations = [], listeners = new Map()
  let focused = 0, scrolled = 0, prevented = 0
  const details = { open: false, scrollIntoView() { scrolled++ }, querySelector: () => ({ focus() { focused++ } }) }
  const body = { height: 160, scrollHeight: 160, getBoundingClientRect() { return { height: this.height } }, animate(keyframes, options) { const animation = { keyframes, options, cancelled: false, cancel() { this.cancelled = true }, onfinish: null }; animations.push(animation); return animation } }
  const window = { location: { hash }, matchMedia: () => ({ matches: reduced }), addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) }
  const { PublicFaq } = load('components/landing/public-faq.tsx', {
    react: { ...React, useRef: value => { const ref = { current: value }; refs.push(ref); return ref }, useEffect: fn => effects.push(fn) },
    '@/lib/public-faq': content,
  }, { window, requestAnimationFrame: fn => { frames.push(fn); return frames.length }, cancelAnimationFrame() {} })
  const component = nodes(PublicFaq()).find(node => typeof node.type === 'function')
  const tree = component.type(component.props)
  refs[0].current = details; refs[1].current = body
  const cleanup = effects[0]()
  return {
    details, body, animations, refs, cleanup,
    click: () => nodes(tree).find(node => node.type === 'summary').props.onClick({ preventDefault() { prevented++ } }),
    initial: () => frames.forEach(fn => fn()),
    visit: value => { window.location.hash = value; listeners.get('hashchange')?.() },
    get focused() { return focused }, get scrolled() { return scrolled }, get prevented() { return prevented }, listeners,
  }
}

test('FAQ opening and closing animate measured content height without dropping the native summary', () => {
  const faq = entry()
  faq.click()
  assert.equal(faq.details.open, true)
  assert.equal(faq.animations[0].keyframes[0].height, '0px')
  assert.equal(faq.animations[0].keyframes[1].height, '160px')
  faq.animations[0].onfinish()
  faq.click()
  assert.equal(faq.details.open, true)
  assert.equal(faq.animations[1].keyframes[1].height, '0px')
  faq.animations[1].onfinish()
  assert.equal(faq.details.open, false)
})
test('rapid accordion toggles cancel the prior animation and reverse from the current height', () => {
  const faq = entry()
  faq.click(); faq.body.height = 50; faq.click()
  assert.equal(faq.animations[0].cancelled, true)
  assert.equal(faq.animations[1].keyframes[0].height, '50px')
  assert.equal(faq.animations[1].keyframes[1].height, '0px')
  faq.animations[1].onfinish()
  assert.equal(faq.details.open, false)
})
test('reduced motion preserves immediate native open/close semantics without animation', () => {
  const faq = entry({ reduced: true })
  faq.click(); assert.equal(faq.details.open, true)
  faq.click(); assert.equal(faq.details.open, false)
  assert.equal(faq.animations.length, 0)
})
test('initial and subsequent question links open the right answer and focus its summary', () => {
  const faq = entry({ hash: '#faq-answer-what-is-outclass' })
  faq.initial()
  assert.equal(faq.details.open, true)
  assert.equal(faq.focused, 1)
  assert.equal(faq.scrolled, 1)
  faq.details.open = false
  faq.visit('#faq-answer-who-can-use-outclass')
  assert.equal(faq.details.open, false)
  faq.visit('#faq-answer-what-is-outclass')
  assert.equal(faq.details.open, true)
  assert.equal(faq.focused, 2)
  faq.cleanup(); assert.equal(faq.listeners.size, 0)
})
test('unmounting a FAQ cancels unfinished animations', () => {
  const faq = entry()
  faq.click(); faq.cleanup()
  assert.equal(faq.animations[0].cancelled, true)
})
