const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  mocks = { ...require('./helpers/shell-stubs.cjs'), ...mocks }
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name === '@/components/icons' ? require('./helpers/icons.cjs') : name.startsWith('@/') ? {} : require(name), mod, mod.exports)
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
  assert.equal(meta.publisher, 'OutClassPlatforms LLC')
})
test('sitemap candidates exclude unclaimed listings, empty profiles, and seed boilerplate', async () => {
  const h = publicClubs([club, { ...club, id: 'unclaimed', claimedAt: null }, { ...club, id: 'empty', description: '' }, { ...club, id: 'seed', description: 'Basic directory listing provided by OutClass. Club leadership has not yet claimed this profile.' }])
  assert.deepEqual((await h.api.getIndexableClubs()).map(c => c.id), ['real-club'])
  assert.deepEqual(h.queries[0].where, { claimedAt: { not: null }, isDiscoverable: true, suspendedAt: null })
  assert.deepEqual(Object.keys(h.queries[0].select).sort(), ['claimedAt', 'description', 'id', 'isDiscoverable', 'name'])
})
test('club metadata lookup selects public identity and copy, never recruitment or account relations', async () => {
  const h = publicClubs([club])
  assert.equal((await h.api.getPublicClubSeo('alias')).id, 'real-club')
  assert.deepEqual(h.queries[0].where, { OR: [{ id: 'alias' }, { slug: 'alias' }], suspendedAt: null })
  assert.deepEqual(Object.keys(h.queries[0].select).sort(), ['claimedAt', 'description', 'id', 'isDiscoverable', 'name'])
})
test('public SEO fails closed during a database outage without loading sample clubs', async () => {
  const api = load('lib/public-club-seo.ts', { react: { cache: fn => fn }, 'next/cache': { unstable_cache: fn => fn }, '@/utils/prisma': { prisma: { club: { findMany: async () => { throw Error('offline') }, findFirst: async () => { throw Error('offline') } } } } })
  assert.deepEqual(await api.getIndexableClubs(), [])
  assert.equal(await api.getPublicClubSeo('unknown'), null)
})
test('sitemap emits canonical public pages without query strings or fabricated timestamps', async () => {
  const { default: sitemap } = load('app/sitemap.ts', { '@/lib/seo': seo, '@/lib/public-club-seo': { getIndexableClubs: async () => [club] } })
  assert.deepEqual(await sitemap(), ['/', '/uva', '/about', '/request-school', '/club/real-club'].map(path => ({ url: `https://www.out-class.net${path}` })))
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
  assert.equal(data['@graph'][0].legalName, 'OutClassPlatforms LLC')
  assert.equal(data['@graph'][0].logo.url, 'https://www.out-class.net/apple-icon.png')
  assert.deepEqual(data['@graph'][1].alternateName, ['OutClass UVA', 'Out Class'])
  for (const item of data['@graph']) {
    assert.equal(item.name, 'OutClass')
    assert.equal(item.url, 'https://www.out-class.net/')
    assert.equal(new URL(item['@id']).origin, seo.SITE_URL)
  }
  for (const item of data['@graph']) for (const key of ['aggregateRating', 'review', 'sameAs', 'address', 'offers']) assert.equal(item[key], undefined)
})
test('public information pages render factual content, consistent entity references, and matching visible FAQs', async () => {
  const { renderToStaticMarkup } = require('react-dom/server')
  const React = require('react')
  const PublicInformationPage = ({ title, introduction, children }) => React.createElement('main', null, React.createElement('h1', null, title), React.createElement('p', null, introduction), children)
  const publicFaq = load('lib/public-faq.ts')
  const promoVideo = { WatchVideoButton: ({ video, label }) => React.createElement('button', { 'data-video': video }, label), PromoVideoFigure: ({ video }) => React.createElement('figure', { 'data-video': video }) }
  const { PublicFaq } = load('components/landing/public-faq.tsx', { '@/lib/public-faq': publicFaq, '@/components/landing/promo-video': promoVideo })
  const common = {
    '@/components/landing/promo-video': promoVideo,
    '@/components/landing/public-information-page': { PublicInformationPage },
    '@/components/landing/public-faq': { PublicFaq },
    '@/lib/public-faq': publicFaq,
    '@/components/motion/scroll-motion': { SectionReveal: ({ children, ...props }) => React.createElement('section', props, children) },
    '@/components/ui/button': { Button: ({ children }) => children },
    'next/image': { __esModule: true, default: ({ priority, ...props }) => React.createElement('img', props) },
    'next/link': { __esModule: true, default: ({ prefetch, ...props }) => React.createElement('a', props) },
    '@/utils/csp-nonce': { cspNonce: async () => 'test-nonce' },
  }
  for (const path of ['/uva', '/about']) {
    const page = load(`app${path}/page.tsx`, { '@/lib/seo': seo, ...common })
    const meta = page.metadata
    assert.equal(meta.alternates.canonical, `${seo.SITE_URL}${path}`)
    assert.equal(meta.openGraph.url, meta.alternates.canonical)
    assert.equal(meta.openGraph.siteName, 'OutClass')
    assert.equal(meta.openGraph.images[0].url, `${seo.SITE_URL}/og/outclass.png`)
    assert.equal(meta.robots.index, true)
    assert.equal(meta.robots.follow, true)
    const html = renderToStaticMarkup(await page.default())
    assert.equal((html.match(/<h1/g) || []).length, 1)
    assert.match(html, /University of Virginia/)
    assert.match(html, /not an official University of Virginia service/)
    assert.match(html, /not owned, sponsored, or endorsed/)
    assert.match(html, /href="\/(uva|about)"/)
    const data = JSON.parse(html.match(/<script type="application\/ld\+json" nonce="test-nonce">([\s\S]*?)<\/script>/)[1])
    const graph = data['@graph'] || [data]
    const webpage = graph.find(item => ['WebPage', 'AboutPage'].includes(item['@type']))
    assert.equal(webpage.url, meta.alternates.canonical)
    assert.equal(webpage.isPartOf['@id'], `${seo.SITE_URL}/#website`)
    assert.equal(webpage.about['@id'], `${seo.SITE_URL}/#organization`)
    assert.equal(graph.some(item => ['Organization', 'WebSite'].includes(item['@type'])), false)
    if (path === '/uva') {
      assert.equal(meta.title.absolute, 'Club recruitment at UVA · OutClass')
      const faq = graph.find(item => item['@type'] === 'FAQPage')
      assert.equal(faq.mainEntity.length, (html.match(/<details\b/g) || []).length)
      assert.equal(new Set(publicFaq.publicFaqs.map(item => item.id)).size, faq.mainEntity.length)
      for (const item of faq.mainEntity) {
        assert.ok(html.includes(`<summary>${item.name}<span`))
        assert.ok(html.includes(`<p>${item.acceptedAnswer.text}</p>`))
      }
    } else {
      assert.equal(meta.title.absolute, 'About · OutClass')
      assert.match(html, /OutClass is operated by OutClassPlatforms LLC, a Virginia limited liability company/)
    }
  }
})
test('shared public footer connects all public pages with real HTML links', () => {
  const { renderToStaticMarkup } = require('react-dom/server')
  const React = require('react')
  const { PublicFooter } = load('components/landing/public-footer.tsx', {
    '@/components/outclass-logo': { OutClassLogo: () => null },
    '@/components/landing/footer-controls': load('components/landing/footer-controls.tsx'),
    '@/components/landing/interactive-footer-wordmark': load('components/landing/interactive-footer-wordmark.tsx'),
    '@/lib/photo-credits': load('lib/photo-credits.ts'),
  })
  const html = renderToStaticMarkup(React.createElement(PublicFooter))
  // CC attribution for the campus photographs: title, author, source and license links on every public page.
  for (const href of ['https://creativecommons.org/licenses/by/2.0/', 'https://creativecommons.org/licenses/by-sa/2.0/', 'https://commons.wikimedia.org/wiki/File:Rotunda_UVa_from_the_south_east.jpg', 'https://commons.wikimedia.org/wiki/File:Colonnade_UVa_academical_village.jpg']) assert.ok(html.includes(`href="${href}"`), href)
  assert.match(html, /Photo credits:.*terren in Virginia.*Eli Pousson.*adaptations shared under CC BY-SA 2\.0/s)
  for (const path of ['/', '/about', '/uva', '/uva#faq', '/request-school', '/signup', '/login', '/?audience=student#students', '/?audience=leader#club-leaders', '#top']) assert.ok(html.includes(`href="${path}"`))
  assert.ok(html.includes('<span class="sr-only">OutClass</span>'))
  assert.ok(html.includes('class="oc-footer-letters" aria-hidden="true"'))
  assert.ok(html.includes('OutClass is operated by OutClassPlatforms LLC'))
  assert.ok(html.includes('© 2026 OutClassPlatforms LLC. All rights reserved.'))
  // Privacy and Terms are real pages now (Phase 3), linked from the footer's Legal column.
  assert.ok(!html.includes('href="/explore"'))
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
      'next/navigation': { useRouter: () => ({}), useSearchParams: () => new URLSearchParams(), usePathname: () => '/' },
      '@/lib/navigation': require('./helpers/navigation-module.cjs'),
      react: { useState: value => [value, next => changes.push(next)], useEffect: fn => effects.push(fn), useRef: current => ({ current }), useMemo: fn => fn() },
      '@/contexts/auth-context': { useAuth: () => ({ user: null, selectClub() {} }) },
      '@/contexts/demo-context': { useDemoMode: () => ({ isDemoEnabled: true, state: { perspective: { role: 'leader', clubId: 'sample' } } }) },
      '@/lib/demo/store': { demoDashboard: () => ({}) },
      '@/lib/demo/loader': { loadedDemoStore: () => ({ demoDashboard: () => ({}) }) },
      '@/lib/student-navigation': { canonicalStudentParams: () => null },
    })
    const tree = AppShell({ initialView: 'landing', initialAuthRole: role, initialSession: { id: 'existing' }, hasProfile: true })
    assert.equal(tree.props.initialRole, role)
    // The first effect reads browser-only auth errors; exercise the route effect.
    effects[2]()
    assert.equal(changes.includes('landing'), false)
  }
})

test('every page sets its own title through metadata or generateMetadata', () => {
  const path = require('node:path')
  // Pages that only redirect never render, so the browser never shows their title.
  const redirectOnly = new Set(['app/decisions/page.tsx', 'app/interviews/page.tsx', 'app/(workspace)/club/[clubId]/tasks/page.tsx'])
  const pages = []
  const walk = dir => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.posix.join(dir, e.name); if (e.isDirectory()) walk(full); else if (e.name === 'page.tsx') pages.push(full) } }
  walk('app')
  const titled = (file, depth = 0) => {
    const source = fs.readFileSync(file, 'utf8')
    if (/export (async )?function generateMetadata[\s\S]*?(\btitle\b|publicPageMetadata\()/.test(source)) return true
    const meta = source.match(/export const metadata\b[^=]*=\s*([^\n]+(?:\n\s+[^\n]+){0,2})/)
    if (!meta) return false
    if (/\btitle\b|publicPageMetadata\(/.test(meta[1])) return true
    // A metadata alias of another page (the /vote alias of /live-voting).
    const alias = meta[1].split('\n')[0].trim().match(/^(\w+)$/), from = alias && source.match(new RegExp(`metadata as ${alias[1]} \\} from "@/(.+?)"`))
    return !!from && depth < 2 && titled(`${from[1]}.tsx`, depth + 1)
  }
  const missing = pages.filter(file => {
    if (redirectOnly.has(file)) return !/redirect\(/.test(fs.readFileSync(file, 'utf8'))
    if (titled(file)) return false
    // A client page cannot export metadata; its own segment layout carries the title instead.
    const layout = path.posix.join(path.posix.dirname(file), 'layout.tsx')
    return !(/^["']use client["']/.test(fs.readFileSync(file, 'utf8').trim()) && fs.existsSync(layout) && titled(layout))
  })
  assert.deepEqual(missing, [])
  assert.ok(pages.length > 50)
})

test('signed-in and admin titles are unique', () => {
  const titles = new Map()
  for (const file of require('node:child_process').execFileSync('git', ['ls-files', 'app/**/page.tsx', 'app/**/layout.tsx'], { encoding: 'utf8' }).trim().split('\n')) {
    const source = fs.readFileSync(file, 'utf8')
    // Old URLs that only redirect share their destination's title on purpose.
    if (/redirect\(/.test(source) && !/(return|=>)\s*\(?\s*</.test(source)) continue
    const m = source.match(/export const metadata\b[^=]*=\s*\{\s*title:\s*"([^"]+)"/)
    if (m) titles.set(m[1], [...(titles.get(m[1]) || []), file])
  }
  const duplicates = [...titles].filter(([, files]) => files.length > 1)
  assert.deepEqual(duplicates, [])
})

test('llms.txt lists only the public pages and indexable clubs, and robots lets AI crawlers read it', async () => {
  const { GET, revalidate } = load('app/llms.txt/route.ts', { '@/lib/seo': seo, '@/lib/legal-content': { LEGAL_PAGES_PUBLIC: false }, '@/lib/public-club-seo': { getIndexableClubs: async () => [{ ...club, name: 'Real [Club]' }] } })
  assert.equal(revalidate, 600)
  const response = await GET()
  assert.match(response.headers.get('content-type'), /^text\/plain/)
  const text = await response.text()
  assert.match(text, /^# OutClass\n\n> /)
  for (const path of ['/', '/uva', '/about', '/request-school', '/club/real-club', '/sitemap.xml']) assert.ok(text.includes(`(https://www.out-class.net${path})`), path)
  assert.match(text, /- \[Real Club\]\(https/, 'club names cannot break the link syntax')
  assert.doesNotMatch(text, /\/privacy|\/terms|\/platform|\/settings|workspace|—/)
  const robots = load('app/robots.ts', { '@/lib/seo': seo }).default()
  assert.equal(robots.rules.userAgent, '*', 'one rule for every crawler, so GPTBot, ClaudeBot, CCBot and Google-Extended are not singled out')
  assert.equal(robots.rules.disallow.some(rule => rule.startsWith('/llms')), false)
  assert.match(fs.readFileSync('middleware.ts', 'utf8'), /"\/sitemap\.xml", "\/llms\.txt"/)
})
