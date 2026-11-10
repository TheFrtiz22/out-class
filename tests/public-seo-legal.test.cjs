// Phase 3: page titles, social cards, legal pages and the shared footer.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => {
    if (name in mocks) return mocks[name]
    if (name.endsWith('.css')) return {}
    if (name === '@/components/icons') return require('./helpers/icons.cjs')
    if (name.startsWith('@/') || name.startsWith('.')) {
      const base = name.startsWith('@/') ? path.resolve(name.slice(2)) : path.resolve(path.dirname(file), name)
      const resolved = ['', '.ts', '.tsx'].map(ext => base + ext).find(f => fs.existsSync(f) && fs.statSync(f).isFile())
      if (resolved) return load(resolved, mocks)
    }
    return require(name)
  }, mod, mod.exports)
  return mod.exports
}
const seo = load('lib/seo.ts')

test('one title shape, suffix added once at the source', () => {
  assert.equal(seo.pageTitle('Sign in'), 'Sign in · OutClass')
  assert.equal(seo.pageTitle('Explore clubs · OutClass'), 'Explore clubs · OutClass')
  assert.equal(seo.pageTitle('About | OutClass'), 'About · OutClass')
  assert.equal(seo.publicPageMetadata('About', 'd', '/about').title.absolute, 'About · OutClass')
  assert.equal(seo.publicPageMetadata(seo.SITE_TITLE, 'd', '/').title.absolute, seo.SITE_TITLE)
  assert.match(fs.readFileSync('app/layout.tsx', 'utf8'), /template: "%s · OutClass"[\s\S]*socialDefaults\(\)/)
})

test('every public page has a unique title and none repeats "OutClass"', () => {
  const finalTitle = file => {
    const source = fs.readFileSync(file, 'utf8')
    const template = source.match(/export const metadata = \{\s*title: "([^"]+)"/)
    if (template) return seo.pageTitle(template[1])
    const pub = source.match(/publicPageMetadata\((?:pageTitle\()?(?:"([^"]+)"|(title)|(SITE_TITLE))/)
    if (pub?.[1]) return seo.pageTitle(pub[1])
    if (pub?.[3]) return seo.SITE_TITLE
    if (pub?.[2]) return seo.pageTitle(source.match(/const title = "([^"]+)"/)[1])
    throw Error(`no title in ${file}`)
  }
  const expected = {
    'app/page.tsx': 'OutClass · UVA club applications and recruitment',
    'app/uva/page.tsx': 'Club recruitment at UVA · OutClass',
    'app/about/page.tsx': 'About · OutClass',
    'app/request-school/page.tsx': 'Request your school · OutClass',
    'app/login/page.tsx': 'Sign in · OutClass',
    'app/signup/page.tsx': 'Create your profile · OutClass',
    'app/forgot-password/page.tsx': 'Forgot password · OutClass',
    'app/reset-password/page.tsx': 'Reset password · OutClass',
    'app/privacy/page.tsx': 'Privacy Policy · OutClass',
    'app/terms/page.tsx': 'Terms of Service · OutClass',
    'app/not-found.tsx': 'Page not found · OutClass',
    'app/(workspace)/invitations/[id]/page.tsx': 'Club invitation · OutClass',
    'app/(workspace)/club-access/[clubId]/page.tsx': 'Workspace access · OutClass',
    'app/(workspace)/club-claims/[clubId]/page.tsx': 'Claim a club · OutClass',
    'app/(focus)/check-in/page.tsx': 'Meeting check-in · OutClass',
    'app/(focus)/interviews/book/page.tsx': 'Book your interview · OutClass',
    'app/(focus)/voting/[sessionId]/join/page.tsx': 'Join live voting · OutClass',
  }
  for (const [file, title] of Object.entries(expected)) {
    const actual = file === 'app/page.tsx' ? seo.SITE_TITLE : finalTitle(file)
    assert.equal(actual, title, file)
    assert.equal((actual.match(/OutClass/g) || []).length, 1, file)
  }
  assert.equal(new Set(Object.values(expected)).size, Object.keys(expected).length)
  for (const file of ['app/forgot-password/page.tsx', 'app/reset-password/page.tsx', 'app/about/page.tsx', 'app/request-school/page.tsx', 'app/uva/page.tsx']) assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /\| OutClass|OutClass \||· OutClass"/, file)
})

test('every page inherits a social image; public pages carry their own with the page title', () => {
  const defaults = seo.socialDefaults()
  assert.equal(defaults.openGraph.images[0].url, 'https://www.out-class.net/og/outclass.png')
  assert.equal(defaults.twitter.card, 'summary_large_image')
  const about = seo.publicPageMetadata('About', 'd', '/about')
  assert.equal(about.openGraph.title, 'About · OutClass'); assert.ok(about.openGraph.images.length)
  assert.ok(fs.existsSync('app/og/outclass.png/route.tsx'))
})

test('Privacy and Terms: formal text from one source, rendered by one component, and not public until the switch is on', async () => {
  const legal = load('lib/legal-content.ts')
  assert.equal(legal.LEGAL_PAGES_PUBLIC, false)
  const { LegalPage } = load('components/landing/legal-page.tsx', { './public-page-frame': { PublicPageFrame: ({ children }) => React.createElement('main', null, children) } })
  for (const content of [legal.privacyPolicy, legal.termsOfService]) {
    const html = renderToStaticMarkup(React.createElement(LegalPage, content))
    assert.equal((html.match(/<h1/g) || []).length, 1); assert.match(html, new RegExp(`<h1[^>]*>${content.title}</h1>`))
    assert.match(html, /OutClassPlatforms LLC/); assert.match(html, /href="mailto:/)
    assert.ok(content.sections.length >= 10, content.title)
  }
  assert.match(JSON.stringify(legal.termsOfService), /Commonwealth of Virginia/)
  assert.match(JSON.stringify(legal.privacyPolicy), /do not sell personal information/)
  // While the switch is off: middleware serves the real 404 page for both routes (no streamed 200,
  // no titles), the footer has no Legal column, and the sitemap omits them.
  assert.match(fs.readFileSync('middleware.ts', 'utf8'), /if \(!LEGAL_PAGES_PUBLIC && \(path === "\/privacy" \|\| path === "\/terms"\)\) \{\n\s*return NextResponse\.rewrite\(new URL\("\/__not-public"/)
  for (const file of ['app/privacy/page.tsx', 'app/terms/page.tsx']) {
    const source = fs.readFileSync(file, 'utf8')
    assert.match(source, /if \(!LEGAL_PAGES_PUBLIC\) notFound\(\)/, file)
    const page = load(file, { 'next/navigation': { notFound: () => { throw Error('NEXT_NOT_FOUND') } }, '@/components/landing/legal-page': { LegalPage: () => null } }).default
    assert.throws(() => page(), /NEXT_NOT_FOUND/, file)
  }
  const { PublicFooter } = load('components/landing/public-footer.tsx', { '@/components/landing/interactive-footer-wordmark': { InteractiveFooterWordmark: () => null } })
  const footer = renderToStaticMarkup(React.createElement(PublicFooter))
  assert.doesNotMatch(footer, /<h[23]>Legal<\/h[23]>|href="\/privacy"|href="\/terms"|mailto:/)
  const sitemap = load('app/sitemap.ts', { '@/lib/public-club-seo': { getIndexableClubs: async () => [] } }).default
  const urls = (await sitemap()).map(entry => entry.url)
  assert.equal(urls.some(url => /\/(privacy|terms)$/.test(url)), false)
  // One footer component, used by the homepage, information pages and the public frame; no legal dialogs remain.
  for (const file of ['components/views/landing-page-view.tsx', 'components/landing/public-information-page.tsx', 'components/landing/public-page-frame.tsx']) assert.match(fs.readFileSync(file, 'utf8'), /<PublicFooter/, file)
  assert.doesNotMatch(fs.readFileSync('components/views/landing-page-view.tsx', 'utf8'), /Dialog|has not yet been published/)
})

test('robots allows the new public pages and keeps the private disallows', () => {
  const robots = load('app/robots.ts').default()
  for (const p of ['/privacy', '/terms', '/request-school']) assert.equal(robots.rules.disallow.some(d => p.startsWith(d.replace('*', ''))), false, p)
  for (const p of ['/login', '/signup', '/invitations/', '/club-access/', '/club-claims/', '/check-in', '/voting/', '/platform', '/settings/']) assert.ok(robots.rules.disallow.includes(p), p)
})
