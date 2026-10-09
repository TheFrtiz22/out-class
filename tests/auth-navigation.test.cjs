const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

function load(file, mocks = {}, window = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  new Function('require', 'module', 'exports', 'window', code)(name => {
    if (name in mocks) return mocks[name]
    if (name.endsWith('.css')) return {}
    if (name === 'next/link') return { default: 'a' }
    if (name.startsWith('@/components/')) return new Proxy({}, { get: (_, key) => key })
    if (name.startsWith('@/')) {
      const path = name.slice(2)
      return load(fs.existsSync(`${path}.ts`) ? `${path}.ts` : `${path}.tsx`, mocks, window)
    }
    return require(name)
  }, mod, mod.exports, window)
  return mod.exports
}
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]
const policy = load('lib/auth.ts')
const user = { id: 'verified', email: 'student@virginia.edu', email_confirmed_at: '2026-10-09', user_metadata: { first_name: 'Student' } }
function entry({ session = user, account = { studentProfile: { id: 'profile' }, memberships: [] }, error = null } = {}) {
  let reads = 0
  const mocks = {
    '@/utils/auth': { getSessionUser: async () => ({ data: { user: session }, error }) },
    '@/utils/prisma': { prisma: { user: { findUnique: async query => {
      reads++
      assert.deepEqual(query.select.memberships.where, { status: 'ACTIVE', club: { suspendedAt: null } })
      return account
    } } } },
    'next/navigation': { redirect: path => { throw Object.assign(Error('redirect'), { destination: path }) } },
  }
  return {
    read: () => load('utils/auth-entry.ts', mocks).getAuthEntryAccount(),
    page: (route, params = {}) => load(`app/${route}/page.tsx`, mocks).default({ searchParams: Promise.resolve(params) }),
    reads: () => reads,
  }
}
async function destination(promise, path) {
  await assert.rejects(promise, error => error.destination === path)
}

test('public header exposes separate signup and login links without identity-dependent administration routing', () => {
  const { PublicNavigation } = load('components/landing/public-navigation.tsx', {
    react: { useState: v => [v, () => {}], useRef: () => ({ current: null }), useEffect() {} },
    'next/navigation': { usePathname: () => '/' },
  })
  for (const hero of [true, false]) {
    const tree = nodes(PublicNavigation({ hero }))
    assert.equal(tree.find(n => n.props?.children === 'Get Started').props.href, '/signup')
    assert.equal(tree.find(n => n.props?.children === 'Log In').props.href, '/login')
    assert.ok(!tree.some(n => n.props?.href?.startsWith('/platform')))
    assert.equal(tree.find(n => n.props?.className === 'oc-public-account').props.children.length, 3)
  }
})
test('new visitors get normal signup and login; only confirmed UVA sessions reach existing accounts', async () => {
  for (const session of [null, { ...user, email_confirmed_at: null }, { ...user, email: 'outsider@example.com' }]) {
    const h = entry({ session })
    assert.equal((await h.page('signup')).props.initialUser, null)
    assert.equal((await h.page('login')).type, 'LoginPageView')
    assert.equal(h.reads(), 0)
  }
  assert.equal(await entry({ error: Error('provider unavailable') }).read(), null)
})
test('completed students, club leaders, ordinary members and platform operators get permission-based public destinations', async () => {
  for (const [memberships, expected] of [
    [[], '/?workspace=student'],
    [[{ clubId: 'club-a', status: 'ACTIVE', isOwner: true }], '/club/club-a/workspace'],
    [[{ clubId: 'club-b', status: 'ACTIVE', permissions: ['applications.review'] }], '/club/club-b/workspace'],
    [[{ clubId: 'club-c', status: 'ACTIVE', permissions: [], role: 'PRESIDENT' }], '/?workspace=student'],
    [[{ clubId: 'club-d', status: 'REMOVED', isOwner: true }], '/?workspace=student'],
  ]) {
    const h = entry({ account: { studentProfile: { id: 'p' }, memberships, role: 'SUPERADMIN' } })
    await destination(h.page('signup'), expected)
    await destination(h.page('login'), expected)
  }
})
test('incomplete profiles resume existing onboarding and retain invitation/claim context', async () => {
  const h = entry({ account: { studentProfile: null, memberships: [] } })
  assert.deepEqual((await h.page('signup')).props.initialUser, user)
  const context = { next: '/invitations/invited', intent: 'leader', campaign: 'welcome' }
  await destination(h.page('login', context), '/signup?next=%2Finvitations%2Finvited&intent=leader&campaign=welcome')
  await destination(entry().page('signup', { next: '/club-claims/unclaimed' }), '/club-claims/unclaimed')
  await destination(entry().page('login', { next: '/invitations/invited' }), '/invitations/invited')
})
test('disabled accounts cannot enter either flow and signup excludes platform destinations', async () => {
  const h = entry({ account: { disabledAt: new Date(), memberships: [] } })
  for (const route of ['login', 'signup']) assert.equal((await h.page(route)).type, 'main')
  for (const next of ['/platform', '/platform/login', '/%70latform', '//evil.invalid', '/a/../platform', '/signup']) {
    await destination(entry().page('signup', { next }), '/?workspace=student')
  }
  await destination(entry().page('login', { next: '/platform' }), '/platform')
})
test('switching login/signup retains the exact return query; signup completion returns to invitations', () => {
  const search = '?next=%2Finvitations%2Fa&intent=leader&campaign=fall'
  const window = { location: { search, href: '' } }
  const login = load('components/auth/login-page-view.tsx', {}, window).LoginPageView()
  login.props.onCreateAccount()
  assert.equal(window.location.href, '/signup' + search)
  const h = signup({}, window)
  const wizard = nodes(h.render()).find(n => n.type === 'StudentOnboardingWizard')
  wizard.props.onSignIn(); assert.equal(window.location.href, '/login' + search)
  wizard.props.onComplete(); assert.equal(window.location.href, '/invitations/a')
  window.location.search = ''; wizard.props.onComplete(); assert.equal(window.location.href, '/login')
  assert.equal(policy.loginReturnPath('//evil.invalid'), '/login')
})
function signup(auth, window, state = {}) {
  const values = []; let cursor = 0
  const C = load('components/auth/signup-page-view.tsx', {
    "@/lib/auth-features": { MICROSOFT_AUTH_ENABLED: state.microsoftEnabled === true },
    react: { useState: value => { const i = cursor++; if (!(i in values)) values[i] = value; return [values[i], next => { values[i] = next }] } },
    '@/contexts/auth-context': { useAuth: () => ({ isImpersonating: false, ...state }) },
    '@/contexts/demo-context': { useDemoMode: () => ({ isDemoEnabled: false, ...state }) },
    '@/utils/supabase/client': { createClient: () => ({ auth }) },
    './login-brand-panel': { LoginBrandPanel: 'LoginBrandPanel' },
  }, window).SignupPageView
  return { render: () => { cursor = 0; return C({ initialUser: null }) } }
}
test('enabled signup Microsoft authentication uses guarded route and preserves claim context', async () => {
  const window = { location: { origin: 'https://outclass.test', search: '?next=%2Fclub-claims%2Fa&intent=leader', href: '' } }
  const h = signup({}, window, { microsoftEnabled: true })
  await nodes(h.render()).find(n => n.props?.className === 'oc-login-uva').props.onClick()
  const target = new URL(window.location.href, window.location.origin)
  assert.equal(target.pathname, '/auth/microsoft')
  assert.equal(target.searchParams.get('next'), '/signup?intent=leader&next=%2Fclub-claims%2Fa')
  assert.equal(nodes(h.render()).find(n => n.props?.className === 'oc-login-uva').props.disabled, true)
})
test('default signup exposes onboarding without any Microsoft option or provider loading state', () => {
  const tree = nodes(signup({ signInWithOAuth() { assert.fail('OAuth must not run') } }, {}).render())
  assert.ok(!tree.some(n => n.props?.className === 'oc-login-uva'))
  assert.ok(tree.some(n => n.type === 'StudentOnboardingWizard'))
  assert.equal(tree.find(n => n.type === 'fieldset').props.disabled, false)
})
test('signup blocks identity changes in support/demo modes', () => {
  for (const state of [{ isImpersonating: true }, { isDemoEnabled: true }]) {
    const tree = nodes(signup({}, {}, state).render())
    assert.ok(!tree.some(n => n.type === 'StudentOnboardingWizard' || n.props?.className === 'oc-login-uva'))
  }
})

test('OAuth callback preserves signup, invitations and claims on both success and failure', async () => {
  for (const next of ['/signup?next=%2Finvitations%2Fa&intent=leader', '/invitations/a', '/club-claims/a']) {
    let written = false, signedOut = false
    const mocks = {
      'next/headers': { cookies: async () => ({ has: () => false }) },
      '@/utils/prisma': { prisma: { user: { upsert: async input => { assert.equal(input.create.role, 'STUDENT'); written = true } } } },
      '@/utils/supabase/server': { createClient: async () => ({ auth: {
        exchangeCodeForSession: async () => ({ data: { user }, error: null }),
        signOut: async () => { signedOut = true },
      } }) },
    }
    const request = new Request(`https://outclass.test/auth/callback?code=valid&next=${encodeURIComponent(next)}`)
    const success = await load('app/auth/callback/route.ts', mocks).GET(request)
    assert.equal(success.headers.get('location'), 'https://outclass.test' + next)
    assert.equal(written, true)
    for (const [data, error, expectedCode] of [
      [{ user: null }, Error('Expired'), 'auth-code-expired'],
      [{ user: { ...user, email: 'outsider@example.com' } }, null, 'uva_only'],
    ]) {
      written = false
      mocks['@/utils/supabase/server'].createClient = async () => ({ auth: {
        exchangeCodeForSession: async () => ({ data, error }),
        signOut: async () => { signedOut = true },
      } })
      const failed = await load('app/auth/callback/route.ts', mocks).GET(request)
      const destination = new URL(failed.headers.get('location'))
      assert.equal(destination.origin, 'https://outclass.test')
      assert.equal(destination.searchParams.get('error'), expectedCode)
      if (next.startsWith('/signup')) {
        assert.equal(destination.pathname, '/signup')
        assert.equal(destination.searchParams.get('next'), '/invitations/a')
        assert.equal(destination.searchParams.get('intent'), 'leader')
      } else {
        assert.equal(destination.pathname, '/login')
        assert.equal(destination.searchParams.get('next'), next)
      }
      assert.equal(written, false)
    }
    assert.equal(signedOut, true)
  }
})
