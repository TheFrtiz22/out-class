// A signed-in student who opened a missing page, About or the FAQ saw the signed-out header (Sign in, Get Started)
// and a 404 card offering Sign in. Signed-in visitors now get "Open OutClass" and "Go to your Home" instead.
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), ts = require('typescript')

function load(file, mocks) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name.endsWith('.css') ? {} : require(name), mod, mod.exports)
  return mod.exports
}
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]
const text = node => typeof node === 'string' ? node : !node || typeof node !== 'object' ? '' : Array.isArray(node) ? node.map(text).join('') : text(node.props?.children)
const auth = user => ({ useOptionalAuth: () => user === undefined ? undefined : { user } })

function header(user) {
  const { PublicNavigation } = load('components/landing/public-navigation.tsx', {
    react: { useState: v => [v, () => {}], useRef: () => ({ current: null }), useId: () => 'menu', useEffect() {} },
    'next/navigation': { usePathname: () => '/about' },
    'next/link': { __esModule: true, default: 'a' },
    '@/components/outclass-logo': { OutClassLogo: 'Logo' }, '@/components/ui/button': { Button: 'Button' }, '@/components/icons': { Menu: 'Menu', X: 'X' },
    './rolling-navigation-label': { RollingNavigationLabel: 'RollingNavigationLabel' }, './perspective-switcher': { PerspectiveSwitcher: 'PerspectiveSwitcher' },
    '@/contexts/auth-context': auth(user),
  })
  return nodes(PublicNavigation({}))
}
const links = tree => tree.filter(n => n.props?.href).map(n => [n.props.href, text(n)])

test('the public header offers a signed-in visitor their OutClass, not Sign in', () => {
  const signedIn = links(header({ id: 'u1' }))
  assert.ok(signedIn.some(([href, label]) => href === '/home' && label === 'Open OutClass'), JSON.stringify(signedIn))
  assert.ok(!signedIn.some(([, label]) => label === 'Sign in' || label === 'Get Started'))
  for (const user of [undefined, null]) {
    const signedOut = links(header(user))
    assert.ok(signedOut.some(([href, label]) => href === '/login' && label === 'Sign in'))
    assert.ok(signedOut.some(([href, label]) => href === '/signup' && label === 'Get Started'))
  }
})

test('the 404 card sends a signed-in visitor Home without offering Sign in', () => {
  const card = user => {
    const { NotFoundActions } = load('components/landing/not-found-actions.tsx', {
      'next/link': { __esModule: true, default: 'a' }, '@/components/icons': { ArrowRight: 'ArrowRight' }, '@/components/ui/button': { Button: 'Button' },
      '@/contexts/auth-context': auth(user),
    })
    return links(nodes(NotFoundActions()))
  }
  assert.deepEqual(card({ id: 'u1' }), [['/home', 'Go to your Home']])
  assert.deepEqual(card(null), [['/', 'Go to OutClass home'], ['/login', 'Sign in']])
  assert.doesNotMatch(fs.readFileSync('app/not-found.tsx', 'utf8'), /href="\/login"/)
})
