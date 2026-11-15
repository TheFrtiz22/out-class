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
    'app/cookies/page.tsx': 'Cookie Policy · OutClass',
    'app/legal/page.tsx': 'Legal · OutClass',
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

test('Privacy, Terms, Cookies and Legal: formal text from one source, rendered by one component, and not public until the switch is on', async () => {
  const legal = load('lib/legal-content.ts')
  assert.equal(legal.LEGAL_PAGES_PUBLIC, false)
  const { LegalPage } = load('components/landing/legal-page.tsx', { './public-page-frame': { PublicPageFrame: ({ children }) => React.createElement('main', null, children) } })
  for (const content of [legal.privacyPolicy, legal.termsOfService, legal.cookiePolicy, legal.legalDetails(null)]) {
    const html = renderToStaticMarkup(React.createElement(LegalPage, content))
    assert.equal((html.match(/<h1/g) || []).length, 1); assert.match(html, new RegExp(`<h1[^>]*>${content.title}</h1>`))
    assert.match(html, /OutClassPlatforms LLC|OutClass/); assert.match(html, /href="mailto:/)
    assert.doesNotMatch(html, /undefined|null/, content.title)
  }
  for (const content of [legal.privacyPolicy, legal.termsOfService]) assert.ok(content.sections.length >= 10, content.title)
  assert.match(JSON.stringify(legal.termsOfService), /Commonwealth of Virginia/)
  assert.match(JSON.stringify(legal.privacyPolicy), /do not sell personal information/)
  // While the switch is off: middleware serves the real 404 page for all four routes (no streamed 200,
  // no titles), the footer has no Legal column, and the sitemap omits them.
  assert.match(fs.readFileSync('middleware.ts', 'utf8'), /if \(!LEGAL_PAGES_PUBLIC && \(path === "\/privacy" \|\| path === "\/terms" \|\| path === "\/cookies" \|\| path === "\/legal"\)\) \{\n\s*return NextResponse\.rewrite\(new URL\("\/__not-public"/)
  for (const file of ['app/privacy/page.tsx', 'app/terms/page.tsx', 'app/cookies/page.tsx', 'app/legal/page.tsx']) {
    const source = fs.readFileSync(file, 'utf8')
    assert.match(source, /if \(!LEGAL_PAGES_PUBLIC\) notFound\(\)/, file)
    const page = load(file, { 'next/navigation': { notFound: () => { throw Error('NEXT_NOT_FOUND') } }, '@/components/landing/legal-page': { LegalPage: () => null } }).default
    assert.throws(() => page(), /NEXT_NOT_FOUND/, file)
  }
  const { PublicFooter } = load('components/landing/public-footer.tsx', { '@/components/landing/interactive-footer-wordmark': { InteractiveFooterWordmark: () => null } })
  const footer = renderToStaticMarkup(React.createElement(PublicFooter))
  assert.doesNotMatch(footer, /<h[23]>Legal<\/h[23]>|href="\/privacy"|href="\/terms"|href="\/cookies"|href="\/legal"|mailto:/)
  const sitemap = load('app/sitemap.ts', { '@/lib/public-club-seo': { getIndexableClubs: async () => [] } }).default
  const urls = (await sitemap()).map(entry => entry.url)
  assert.equal(urls.some(url => /\/(privacy|terms|cookies|legal)$/.test(url)), false)
  // One footer component, used by the homepage, information pages and the public frame; no legal dialogs remain.
  for (const file of ['components/views/landing-page-view.tsx', 'components/landing/public-information-page.tsx', 'components/landing/public-page-frame.tsx']) assert.match(fs.readFileSync(file, 'utf8'), /<PublicFooter/, file)
  assert.doesNotMatch(fs.readFileSync('components/views/landing-page-view.tsx', 'utf8'), /Dialog|has not yet been published/)
})

test('Privacy Policy names every processor in use, every profile data category, what Clubs see, rights, California, DNT and contact', () => {
  const legal = load('lib/legal-content.ts')
  const text = JSON.stringify(legal.privacyPolicy)
  // Each processor named in the policy is wired in code (the evidence is the second element).
  for (const [name, evidence] of [['Supabase', ['package.json', /@supabase\/ssr/]], ['Vercel Web Analytics', ['app/layout.tsx', /@vercel\/analytics/]], ['Vercel Speed Insights', ['app/layout.tsx', /speed-insights/]], ['Resend', ['lib/notification-email.ts', /api\.resend\.com/]], ['Sentry', ['instrumentation-client.ts', /@sentry\/nextjs/]], ['Microsoft', ['lib/outlook-calendar.ts', /graph\.microsoft\.com/]], ['Cloudflare Turnstile', ['lib/turnstile.ts', /turnstile/i]], ['Typesense', ['actions/typesense-search.ts', /TYPESENSE_URL/]], ['GitHub', ['lib/transactional-email.ts', /raw\.githubusercontent\.com/]]]) {
    assert.ok(text.includes(name), name)
    assert.match(fs.readFileSync(evidence[0], 'utf8'), evidence[1], name)
  }
  // Every collected profile field is disclosed (StudentProfile columns, by their policy wording).
  const schema = fs.readFileSync('prisma/schema.prisma', 'utf8').match(/model StudentProfile \{([\s\S]*?)\n\}/)[1]
  const disclosed = { highSchool: 'high school', gender: 'gender', pronouns: 'pronouns', transferStudent: 'transfer-student', scholarStatus: 'scholar program', actScore: 'ACT', actEnglish: 'ACT', actMath: 'ACT', actReading: 'ACT', actScience: 'ACT', firstName: 'name', lastName: 'name', computingId: 'computing ID', major: 'major', gradYear: 'graduation year', gpa: 'GPA', satScore: 'SAT', linkedinUrl: 'LinkedIn', bio: 'bio', resumeUrl: 'résumé', headshotUrl: 'headshot', phone: 'phone number' }
  for (const field of [...schema.matchAll(/^\s+(\w+)\s+(?:String|Int|Float|Boolean|Json)\??/gm)].map(m => m[1]).filter(f => !['id', 'userId'].includes(f))) {
    assert.ok(disclosed[field], `StudentProfile.${field} has no policy wording`)
    assert.ok(text.includes(disclosed[field]), `${field}: ${disclosed[field]}`)
  }
  for (const phrase of ['What Clubs see', 'anonymous review', 'Access', 'Correction', 'Deletion', 'Export', 'California', 'CCPA', 'authorized agent', 'Do Not Track', 'Retention', 'effective as of', 'hello@out-class.net', '/legal']) assert.ok(text.includes(phrase), phrase)
  assert.ok(!/one preference cookie/.test(text))
})

test('Terms cover eligibility (UVA, 13+, minors), acceptable use, reporting, removal and DMCA notice-and-takedown', () => {
  const legal = load('lib/legal-content.ts'), text = JSON.stringify(legal.termsOfService)
  for (const phrase of ['@virginia.edu', 'at least 13', 'under 18', legal.LEGAL_PLACEHOLDERS.minorsClause, 'Acceptable use', 'Reporting content', 'Content removal', 'DMCA', '17 U.S.C. § 512', 'counter-notice', 'repeat infringers', legal.LEGAL_PLACEHOLDERS.dmcaAgentName, legal.LEGAL_PLACEHOLDERS.dmcaAgentAddress]) assert.ok(text.includes(phrase), phrase)
  const details = JSON.stringify(legal.legalDetails('1 Rotunda Way, Charlottesville, VA'))
  assert.match(details, /OutClassPlatforms LLC/); assert.match(details, /1 Rotunda Way/)
  assert.ok(JSON.stringify(legal.legalDetails('')).includes(legal.LEGAL_PLACEHOLDERS.mailingAddress))
  assert.match(fs.readFileSync('app/legal/page.tsx', 'utf8'), /legalDetails\(process\.env\.OUTCLASS_POSTAL_ADDRESS\)/)
})

test('cookie policy lists exactly the cookies the code sets (source scan)', () => {
  const legal = load('lib/legal-content.ts')
  const listed = legal.SITE_COOKIES.map(c => c.name)
  for (const c of legal.SITE_COOKIES) assert.ok(['Essential', 'Preference'].includes(c.category), c.name)
  const files = []
  const walk = dir => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full); else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full) } }
  for (const dir of ['app', 'lib', 'utils', 'components', 'hooks', 'contexts', 'actions']) walk(dir)
  files.push('middleware.ts')
  const constants = {}
  for (const file of files) for (const m of fs.readFileSync(file, 'utf8').matchAll(/export const ([A-Z_]+) = "([^"]+)"/g)) constants[m[1]] = m[2]
  const found = new Set()
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8')
    for (const m of source.matchAll(/(?:cookies(?:\(\))?\)?|jar|cookieStore)\.set\(\s*([^,\s)]+)/g)) {
      const token = m[1], line = source.slice(source.lastIndexOf('\n', m.index) + 1, source.indexOf('\n', m.index))
      if (/, "", \{[^}]*maxAge: 0/.test(line)) continue // clears a cookie, sets none
      if (constants[token]) found.add(constants[token])
      else if (['name', 'cookie'].includes(token) && file.startsWith(path.join('utils', 'supabase'))) found.add('sb-')
      else assert.fail(`unclassified cookie write in ${file}: ${m[0]}`)
    }
    for (const m of source.matchAll(/document\.cookie\s*=\s*([^\n]+)/g)) {
      if (/campusNoticeDismissCookie/.test(m[1])) found.add('oc-campus-notice-')
      else if (/\$\{LANDING_AUDIENCE_PREFERENCE\}/.test(m[1])) found.add(constants.LANDING_AUDIENCE_PREFERENCE)
      else assert.fail(`unclassified document.cookie write in ${file}`)
    }
  }
  assert.match(fs.readFileSync('lib/campus-notice-dismiss.ts', 'utf8'), /`oc-campus-notice-\$\{/)
  for (const name of found) assert.ok(listed.some(entry => entry.startsWith(name)), `cookie ${name} is set in code but not listed in SITE_COOKIES`)
  for (const entry of listed) assert.ok([...found].some(name => entry.startsWith(name)), `SITE_COOKIES lists ${entry}, which no code sets`)
  assert.equal(found.size, listed.length)
  const policy = JSON.stringify(legal.cookiePolicy)
  for (const entry of listed) assert.ok(policy.includes(entry), entry)
})

test('every legal placeholder and open question is in the counsel checklist', () => {
  const legal = load('lib/legal-content.ts'), checklist = fs.readFileSync('docs/legal-review-checklist.md', 'utf8')
  for (const value of Object.values(legal.LEGAL_PLACEHOLDERS)) assert.ok(checklist.includes(value), value)
  const bracketed = new Set([...fs.readFileSync('lib/legal-content.ts', 'utf8').matchAll(/"(\[[^\]"]+\])"/g)].map(m => m[1]))
  for (const value of bracketed) assert.ok(checklist.includes(value), value)
  for (const topic of ['CCPA', '17', 'FERPA', 'trademark', 'image', 'OUTCLASS_POSTAL_ADDRESS', 'EMAIL_UNSUBSCRIBE_SECRET', 'LEGAL_PAGES_PUBLIC']) assert.ok(checklist.includes(topic), topic)
})

test('GPA and test scores stay optional and labelled optional in signup and profile editing', () => {
  const schemas = fs.readFileSync('lib/onboarding-schemas.ts', 'utf8')
  for (const field of ['gpa', 'actScore', 'satScore']) assert.match(schemas, new RegExp(`${field}: z\\s*\\.string\\(\\)\\s*\\.optional\\(\\)`), field)
  const wizard = fs.readFileSync('components/views/student-onboarding-wizard.tsx', 'utf8')
  assert.match(wizard, /GPA out of 4\.0\{" "\}\s*<span[^>]*>\s*\(optional\)/)
  assert.match(wizard, /ACT composite \(optional\)/)
  assert.match(wizard, /SAT score\{" "\}\s*<span[^>]*>\s*\(optional\)/)
  const dialog = fs.readFileSync('components/edit-student-profile-dialog.tsx', 'utf8')
  for (const label of ['GPA out of 4.0 (optional)', 'SAT (optional)', 'ACT composite (optional)', 'ACT English (optional)', 'ACT Math (optional)', 'ACT Reading (optional)', 'ACT Science (optional)']) assert.ok(dialog.includes(label), label)
})

test('robots allows the new public pages and keeps the private disallows', () => {
  const robots = load('app/robots.ts').default()
  for (const p of ['/privacy', '/terms', '/cookies', '/legal', '/request-school']) assert.equal(robots.rules.disallow.some(d => p.startsWith(d.replace('*', ''))), false, p)
  for (const p of ['/login', '/signup', '/invitations/', '/club-access/', '/club-claims/', '/check-in', '/voting/', '/platform', '/settings/']) assert.ok(robots.rules.disallow.includes(p), p)
})
