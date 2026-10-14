const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

function load(file, mocks = {}, globals = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(name => name in mocks ? mocks[name] : name.endsWith('.css') ? {} : require(name), mod, mod.exports, ...Object.values(globals))
  return mod.exports
}
const { RollingNavigationLabel } = load('components/landing/rolling-navigation-label.tsx')
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]
function headerHarness({ pathname = '/', hash = '', scrollY = 0 } = {}) {
  const states = [], refs = [], effects = [], windowListeners = new Map(), documentListeners = new Map()
  let cursor = 0, refCursor = 0
  const desktop = { matches: false, addEventListener: (name, fn) => windowListeners.set(`desktop:${name}`, fn), removeEventListener: name => windowListeners.delete(`desktop:${name}`) }
  const window = { scrollY, location: { hash }, matchMedia: () => desktop, addEventListener: (name, fn) => windowListeners.set(name, fn), removeEventListener: name => windowListeners.delete(name) }
  const document = { activeElement: null, addEventListener: (name, fn) => documentListeners.set(name, fn), removeEventListener: name => documentListeners.delete(name) }
  const { PublicNavigation } = load('components/landing/public-navigation.tsx', {
    react: { ...React, useId: () => 'test-mobile-menu', useState: initial => { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next }] }, useRef: initial => { const i = refCursor++; return refs[i] ??= { current: initial } }, useEffect: fn => effects.push(fn) },
    'next/navigation': { usePathname: () => pathname },
    'next/link': { __esModule: true, default: 'a' },
    '@/components/outclass-logo': { OutClassLogo: 'Logo' },
    '@/components/ui/button': { Button: 'Button' },
    './rolling-navigation-label': { RollingNavigationLabel },
    './perspective-switcher': { PerspectiveSwitcher: 'PerspectiveSwitcher' },
  }, { window, document })
  function render() { cursor = 0; refCursor = 0; effects.length = 0; return PublicNavigation({ hero: true }) }
  render()
  return { render, refs, effects, states, window, document, desktop, windowListeners, documentListeners }
}
function toggle(tree) { return nodes(tree).find(n => n.type === 'button') }
function mobile(tree) { return nodes(tree).find(n => n.props?.className === 'oc-public-mobile') }

test('every public destination is preserved in desktop and mobile navigation', () => {
  const tree = nodes(headerHarness().render())
  for (const className of ['oc-public-desktop', 'oc-public-mobile']) {
    const nav = tree.find(n => n.props?.className === className)
    assert.deepEqual(nodes(nav).filter(n => n.type === 'a').map(n => n.props.href).slice(0, 4), ['/#about', '/about', '/uva#faq', '/request-school'])
  }
  assert.ok(tree.some(n => n.type === 'a' && n.props.href === '/signup'))
  assert.ok(tree.some(n => n.type === 'a' && n.props.href === '/login'))
  assert.equal(mobile(tree).props.inert, true)
  assert.equal(mobile(tree).props['aria-hidden'], true)
  assert.equal(toggle(tree).props['aria-controls'], mobile(tree).props.id)
})
test('opening the menu exposes its links and Escape restores focus to the toggle', () => {
  const h = headerHarness(); let focused = 0
  h.refs[0].current = { focus() { focused++ } }
  toggle(h.render()).props.onClick()
  const tree = h.render()
  assert.equal(toggle(tree).props['aria-expanded'], true)
  assert.equal(mobile(tree).props.inert, false)
  assert.equal(tree.props['data-hero'], true)
  const cleanup = h.effects[1]()
  h.documentListeners.get('keydown')({ key: 'Escape' })
  assert.equal(toggle(h.render()).props['aria-expanded'], false)
  assert.equal(focused, 1)
  cleanup()
  assert.equal(h.documentListeners.size, 0)
  assert.equal(h.windowListeners.size, 0)
})
test('outside pointer, focus departure, and link activation dismiss the disclosure', () => {
  const h = headerHarness()
  h.refs[1].current = { contains: node => node === 'inside' }
  toggle(h.render()).props.onClick(); h.render(); h.effects[1]()
  h.documentListeners.get('pointerdown')({ target: 'inside' }); assert.equal(h.states[1], true)
  h.documentListeners.get('pointerdown')({ target: 'outside' }); assert.equal(h.states[1], false)
  toggle(h.render()).props.onClick(); h.render().props.onBlur({ currentTarget: h.refs[1].current, relatedTarget: 'outside' }); assert.equal(h.states[1], false)
  toggle(h.render()).props.onClick()
  nodes(mobile(h.render())).find(n => n.props?.href === '/#about').props.onClick()
  assert.equal(h.states[1], false)
})
test('resizing an open mobile menu to desktop moves focus to the visible home link', () => {
  const h = headerHarness(); let focused = 0
  h.refs[0].current = {}
  h.document.activeElement = h.refs[0].current
  h.refs[1].current = { querySelector: () => ({ focus() { focused++ } }) }
  toggle(h.render()).props.onClick(); h.render(); h.effects[1]()
  h.desktop.matches = true
  h.windowListeners.get('desktop:change')()
  assert.equal(h.states[1], false)
  assert.equal(focused, 1)
})
test('scroll and fragment updates preserve hero styling, current link, and dismissal semantics', () => {
  const h = headerHarness({ pathname: '/uva', hash: '#faq-answer-who-can-use-outclass' })
  const cleanup = h.effects[0]()
  assert.equal(nodes(h.render()).find(n => n.props?.href === '/uva#faq').props['aria-current'], 'location')
  h.window.scrollY = 80; h.windowListeners.get('scroll')()
  assert.equal(h.render().props['data-hero'], false)
  toggle(h.render()).props.onClick()
  h.window.location.hash = '#faq'; h.windowListeners.get('hashchange')()
  assert.equal(h.states[1], false)
  cleanup(); assert.equal(h.windowListeners.size, 0)
  const about = nodes(headerHarness({ pathname: '/about' }).render()).find(n => n.props?.href === '/about')
  assert.equal(about.props['aria-current'], 'page')
})
test('rolling labels have one readable accessible name and hide decorative copies', () => {
  const tree = RollingNavigationLabel({ children: 'Log In' })
  assert.equal(tree.props.children[0].props.children, 'Log In')
  assert.equal(tree.props.children[1].props['aria-hidden'], 'true')
  const html = renderToStaticMarkup(React.createElement(RollingNavigationLabel, null, 'Log In'))
  assert.match(html, /aria-hidden="true"/)
  assert.equal((html.match(/class="oc-public-letter"/g) || []).length, 6)
})
