const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name.startsWith('@/') ? {} : require(name), mod, mod.exports)
  return mod.exports
}
const seo = load('lib/seo.ts')
const club = { id: 'real-club', name: 'Real Club', claimedAt: new Date(), description: 'Students collaborate on real projects, learn from their peers, and participate in university organization recruitment.' }
function publicClubs(records) {
  const queries = []
  const api = load('lib/public-club-seo.ts', {
    react: { cache: fn => fn }, 'next/cache': { unstable_cache: fn => fn },
    '@/utils/prisma': { prisma: { club: { findMany: async query => { queries.push(query); return records }, findFirst: async query => { queries.push(query); return records[0] ?? null } } } },
  })
  return { api, queries }
}
test('public metadata uses one absolute www canonical and factual social text', () => {
  const meta = seo.publicPageMetadata(seo.SITE_TITLE, seo.SITE_DESCRIPTION, '/')
  assert.equal(meta.alternates.canonical, 'https://www.out-class.net/')
  assert.equal(meta.openGraph.url, meta.alternates.canonical)
  assert.equal(meta.twitter.card, 'summary_large_image')
  assert.equal(meta.robots.index, true)
  assert.ok(seo.SITE_DESCRIPTION.length >= 140 && seo.SITE_DESCRIPTION.length <= 160)
  assert.equal(meta.twitter.creator, undefined)
})
test('sitemap candidates exclude unclaimed listings, empty profiles, and seed boilerplate', async () => {
  const h = publicClubs([club, { ...club, id: 'unclaimed', claimedAt: null }, { ...club, id: 'empty', description: '' }, { ...club, id: 'seed', description: 'Basic directory listing provided by OutClass. Club leadership has not yet claimed this profile.' }])
  assert.deepEqual((await h.api.getIndexableClubs()).map(c => c.id), ['real-club'])
  assert.deepEqual(h.queries[0].where, { claimedAt: { not: null } })
  assert.deepEqual(Object.keys(h.queries[0].select).sort(), ['claimedAt', 'description', 'id', 'isDiscoverable', 'name'])
})
test('club metadata lookup selects public identity and copy, never recruitment or account relations', async () => {
  const h = publicClubs([club])
  assert.equal((await h.api.getPublicClubSeo('alias')).id, 'real-club')
  assert.deepEqual(h.queries[0].where, { OR: [{ id: 'alias' }, { slug: 'alias' }] })
  assert.deepEqual(Object.keys(h.queries[0].select).sort(), ['claimedAt', 'description', 'id', 'isDiscoverable', 'name'])
})
test('public SEO fails closed during a database outage without loading sample clubs', async () => {
  const api = load('lib/public-club-seo.ts', { react: { cache: fn => fn }, 'next/cache': { unstable_cache: fn => fn }, '@/utils/prisma': { prisma: { club: { findMany: async () => { throw Error('offline') }, findFirst: async () => { throw Error('offline') } } } } })
  assert.deepEqual(await api.getIndexableClubs(), [])
  assert.equal(await api.getPublicClubSeo('unknown'), null)
})
test('sitemap emits canonical public pages without query strings or fabricated timestamps', async () => {
  const { default: sitemap } = load('app/sitemap.ts', { '@/lib/seo': seo, '@/lib/public-club-seo': { getIndexableClubs: async () => [club] } })
  assert.deepEqual(await sitemap(), [{ url: 'https://www.out-class.net/' }, { url: 'https://www.out-class.net/club/real-club' }])
})
test('robots permits marketing and public clubs while excluding actual product interfaces', () => {
  const result = load('app/robots.ts', { '@/lib/seo': seo }).default()
  assert.equal(result.rules.allow, '/')
  assert.equal(result.sitemap, 'https://www.out-class.net/sitemap.xml')
  assert.equal(result.rules.disallow.includes('/club/'), false)
  for (const route of ['/api/', '/auth/', '/platform', '/club/*/workspace', '/club/*/tasks', '/*?*workspace=']) assert.ok(result.rules.disallow.includes(route))
})
test('account queries and session cookies opt out of indexing, tracking queries retain the homepage canonical', async () => {
  let stored = []
  const jar = { has: key => stored.some(c => c.name === key), get: key => stored.find(c => c.name === key), getAll: () => stored }
  const { generateMetadata } = load('app/page.tsx', { '@/lib/seo': seo, 'next/cache': { unstable_cache: fn => fn }, 'next/headers': { cookies: async () => jar }, '@/lib/platform-view-as': { PLATFORM_VIEW_COOKIE: 'outclass-platform-view' }, '@/lib/demo/access': { DEMO_COOKIE: 'demo-mode' } })
  assert.equal((await generateMetadata({ searchParams: Promise.resolve({ utm_source: 'campus' }) })).robots.index, true)
  for (const key of seo.privateHomepageParams) assert.equal((await generateMetadata({ searchParams: Promise.resolve({ [key]: 'student' }) })).robots.index, false)
  for (const cookie of [{ name: 'sb-test-auth-token.0', value: 'session' }, { name: 'outclass-platform-view', value: 'support' }, { name: 'demo-mode', value: '1' }]) {
    stored = [cookie]
    const meta = await generateMetadata({ searchParams: Promise.resolve({}) })
    assert.equal(meta.robots.index, false)
    assert.equal(meta.alternates.canonical, 'https://www.out-class.net/')
  }
})
test('structured data identifies only the established organization and website', () => {
  const data = JSON.parse(JSON.stringify(seo.websiteStructuredData))
  assert.equal(data['@context'], 'https://schema.org')
  assert.deepEqual(data['@graph'].map(item => item['@type']), ['Organization', 'WebSite'])
  assert.equal(data['@graph'][1].publisher['@id'], data['@graph'][0]['@id'])
  for (const item of data['@graph']) for (const key of ['aggregateRating', 'review', 'sameAs', 'address', 'offers']) assert.equal(item[key], undefined)
})
test('landing entry preserves student and leader sign-in intent without loading a workspace view first', () => {
  let role
  const { HomeEntry } = load('components/home-entry.tsx', {
    'next/dynamic': { __esModule: true, default: () => 'AppShell' },
    react: { useState: () => [role, value => { role = value }] },
    'next/navigation': { useSearchParams: () => new URLSearchParams() },
    '@/components/views/landing-page-view': { LandingPageView: 'LandingPageView' },
  })
  for (const selected of ['student', 'leader']) {
    role = undefined
    const landing = HomeEntry({ initialView: 'landing', launchClubs: [] })
    assert.equal(landing.type, 'LandingPageView')
    landing.props.onNavigateToApp(selected)
    const account = HomeEntry({ initialView: 'landing', launchClubs: [] })
    assert.equal(account.type, 'AppShell')
    assert.equal(account.props.initialAuthRole, selected)
  }
})
test('sign-in intent overrides a saved demo perspective or existing session and survives the landing effect', () => {
  for (const role of ['student', 'leader']) {
    const changes = [], effects = []
    const { AppShell } = load('components/app-shell.tsx', {
      'next/dynamic': { __esModule: true, default: () => 'LazyView' },
      'next/navigation': { useRouter: () => ({}), useSearchParams: () => new URLSearchParams() },
      react: { useState: value => [value, next => changes.push(next)], useEffect: fn => effects.push(fn) },
      '@/contexts/auth-context': { useAuth: () => ({ user: null, selectClub() {} }) },
      '@/contexts/demo-context': { useDemoMode: () => ({ isDemoEnabled: true, state: { perspective: { role: 'leader', clubId: 'sample' } } }) },
      '@/lib/demo/store': { demoDashboard: () => ({}) },
      '@/lib/student-navigation': { canonicalStudentParams: () => null },
    })
    const tree = AppShell({ initialView: 'landing', initialAuthRole: role, initialSession: { id: 'existing' }, hasProfile: true })
    assert.equal(tree.props.initialRole, role)
    // The first effect reads browser-only auth errors; exercise the route effect.
    effects[2]()
    assert.equal(changes.includes('landing'), false)
  }
})
