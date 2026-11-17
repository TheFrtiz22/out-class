// /security ("How OutClass protects student data") and /.well-known/security.txt. The page makes
// factual claims about the product, so each one is pinned to the code or text that makes it true:
// if that anchor changes, this test fails and the page copy must be re-checked.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { NextRequest } = require('next/server')

function load(file, mocks = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name === '@/components/icons' ? require('./helpers/icons.cjs') : name.startsWith('@/') ? {} : require(name), mod, mod.exports)
  return mod.exports
}
const read = file => fs.readFileSync(file, 'utf8')
const seo = load('lib/seo.ts')
const legal = load('lib/legal-content.ts', { '@/lib/seo': seo })
const securityTxt = load('lib/security-txt.ts', { '@/lib/seo': seo, '@/lib/legal-content': legal })

async function renderPage({ legalPublic = false } = {}) {
  const page = load('app/security/page.tsx', {
    '@/lib/seo': seo,
    '@/lib/security-txt': securityTxt,
    '@/lib/legal-content': { ...legal, LEGAL_PAGES_PUBLIC: legalPublic },
    '@/components/landing/public-information-page': { PublicInformationPage: ({ eyebrow, title, introduction, children }) => React.createElement('main', null, React.createElement('p', null, eyebrow), React.createElement('h1', null, title), React.createElement('p', null, introduction), children) },
    '@/components/motion/scroll-motion': { SectionReveal: ({ children, ...props }) => React.createElement('section', props, children) },
    'next/link': { __esModule: true, default: ({ prefetch, ...props }) => React.createElement('a', props) },
    '@/utils/csp-nonce': { cspNonce: async () => 'test-nonce' },
  })
  return { page, html: renderToStaticMarkup(await page.default()) }
}
const text = html => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ')

const HEADINGS = [
  'How OutClass protects student data.',
  'An independent student platform.',
  'Only what recruiting needs.',
  'Your information goes only where you send it.',
  'Checked on our servers, every time.',
  'Résumés and uploads stay private.',
  'Sign-in built to resist misuse.',
  'Hosted in the United States.',
  'You can delete your account.',
  'Access rules are tested continuously.',
  'Found a security issue? Tell us.',
]

test('security page renders one h1, the topic headings, metadata, JSON-LD and the last-updated date', async () => {
  const { page, html } = await renderPage()
  assert.equal((html.match(/<h1/g) || []).length, 1)
  const headings = [...html.matchAll(/<h[12][^>]*>([^<]+)<\/h[12]>/g)].map(m => m[1].replace(/&#x27;/g, "'"))
  assert.deepEqual(headings, HEADINGS)
  assert.equal(page.metadata.title.absolute, 'Security and student data · OutClass')
  assert.equal(page.metadata.alternates.canonical, `${seo.SITE_URL}/security`)
  assert.equal(page.metadata.robots.index, true)
  const data = JSON.parse(html.match(/<script type="application\/ld\+json" nonce="test-nonce">([\s\S]*?)<\/script>/)[1])
  assert.equal(data['@type'], 'WebPage')
  assert.equal(data.url, page.metadata.alternates.canonical)
  assert.equal(data.isPartOf['@id'], `${seo.SITE_URL}/#website`)
  assert.match(text(html), /Last updated November 15, 2026\./)
  assert.doesNotMatch(html, /—/)
  // No certification or third-party audit claims, and no internal specifics on a public page.
  assert.doesNotMatch(text(html), /certif|SOC ?2|ISO ?27001|penetration test|third-party audit|\b\d+ (?:tries|attempts|requests)\b|\bprisma\b|\/api\/|\.ts\b/i)
})

test('security page links the contact, security.txt, and the Privacy Policy only when legal pages are public', async () => {
  const hidden = (await renderPage()).html
  assert.ok(hidden.includes(`href="mailto:${legal.CONTACT_EMAIL}"`))
  assert.ok(hidden.includes('href="/.well-known/security.txt"'))
  assert.doesNotMatch(hidden, /href="\/privacy"/)
  assert.match((await renderPage({ legalPublic: true })).html, /href="\/privacy"[^>]*>Read the Privacy Policy</)
})

test('each factual claim on the page is anchored in the code or text that makes it true', async () => {
  const page = text((await renderPage()).html)
  const claims = [
    // [sentence on the page, file, pattern that must still hold there]
    ['operated by OutClassPlatforms LLC', 'components/landing/public-footer.tsx', /OutClass is operated by OutClassPlatforms LLC and is not an official University of Virginia service/],
    ['not owned, sponsored, or endorsed by the university', 'app/about/page.tsx', /not owned, sponsored, or endorsed by the university/],
    ['We do not sell personal information or share it for advertising', 'lib/legal-content.ts', /We do not sell personal information and we do not share it for cross-context behavioral advertising/],
    ['nothing about your applications to other clubs', 'lib/legal-content.ts', /nothing about your applications to other Clubs/],
    ['only the profile fields it shows its reviewers', 'lib/legal-content.ts', /only the fields the Club has chosen to show its reviewers/],
    ['Applicants never see a club’s evaluations or notes', 'lib/legal-content.ts', /Evaluations, notes, scores and votes are visible to the Club's members according to the roles the Club assigns\. They are not shown to applicants\./],
    ['Clubs cannot see them', 'lib/interest-survey.ts', /Answers are private to the student/],
    ['reviewers do not see your name or photo', 'lib/legal-content.ts', /In anonymous review rounds, your name and photo are hidden from reviewers/],
    ['verified, read-only support view', 'lib/legal-content.ts', /staff access to Club workspaces is read-only, verified and recorded in an audit log/],
    ['Row-level security in the database adds a second layer', 'docs/staging-security-rls-20261101.md', /All \*\*94 public tables\*\* have RLS enabled/],
    ['links that expire within minutes', 'app/api/resumes/route.ts', /createSignedUrl\(path, 60 \* 5\)/],
    ['checked by their contents', 'lib/task-file-content.ts', /reads the first bytes of the stored\s+\* object and checks them against the declared type/],
    ['kept in private storage', 'prisma/migrations/20260928000000_private_resume_storage/migration.sql', /public = false/],
    ['Students sign in with their UVA email address', 'lib/onboarding-schemas.ts', /Only @virginia\.edu email addresses are accepted/],
    ['One password standard applies everywhere a password is set', 'lib/password-policy.ts', /The one password rule for every flow that sets a password/],
    ['rate limited', 'lib/rate-limit-core.ts', /twoStep: \{ name: "two-step"/],
    ['bot protection', 'lib/legal-content.ts', /Cloudflare Turnstile checks that sign-up, sign-in/],
    ['Optional two-step sign-in with an authenticator app', 'components/settings/two-step-settings.tsx', /Two-step sign-in/],
    ['Signing out ends your session on that device', 'app/api/auth/logout/route.ts', /auth\.signOut\(\{ scope: "local" \}\)/],
    ['hosted on Vercel and Supabase in the United States', 'vercel.json', /"pdx1"/],
    ['removes personal details before a report is sent', 'lib/sentry-scrub.ts', /sendDefaultPii: false/],
    ['we do not record your sessions', 'lib/sentry-scrub.ts', /No session replay/],
    ['Request deletion in Settings, under Account & Security', 'lib/settings-navigation.ts', /label: "Account & Security", href: "\/settings\/account"/],
    ['You can cancel within 14 days', 'components/settings/account-deletion.tsx', /You can cancel within 14 days\./],
    ['Decision letters and interview copies of your résumé that a club already holds stay with that club', 'components/settings/account-deletion.tsx', /Decision letters and interview copies of your résumé that a club already holds stay with that club’s records/],
    ['records of the terms you accepted', 'docs/account-deletion.md', /Terms\/Privacy acceptance records/],
    ['test our access rules automatically on every proposed change', '.github/workflows/disposable-integrations.yml', /Runs on every PR[\s\S]*'\["security","transactions"\]'/],
    ['attack-style tests against a disposable test copy', 'tests/attacker-pass-e2e.test.cjs', /attacker pass against the disposable local stack/],
  ]
  for (const [sentence, file, anchor] of claims) {
    assert.ok(page.includes(sentence), `page no longer says: ${sentence}`)
    assert.match(read(file), anchor, `${file} no longer supports: ${sentence}`)
  }
  // The browser never queries application tables through the Supabase client.
  const { execFileSync } = require('node:child_process')
  const clientFiles = execFileSync('git', ['ls-files', 'components', 'hooks', 'contexts'], { encoding: 'utf8' }).split('\n').filter(f => /\.(tsx?|jsx?)$/.test(f))
  assert.deepEqual(clientFiles.filter(f => /supabase[\s\S]{0,80}\.from\(["'][A-Z]/.test(read(f))), [])
  assert.ok(page.includes('Your browser never reads our database directly'))
})

test('security.txt follows RFC 9116 and is served as plain text', async () => {
  const route = load('app/.well-known/security.txt/route.ts', { '@/lib/security-txt': securityTxt })
  const response = route.GET()
  assert.equal(response.headers.get('content-type'), 'text/plain; charset=utf-8')
  const body = await response.text()
  const fields = Object.fromEntries(body.trim().split('\n').map(line => [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 2)]))
  assert.equal(fields.Contact, `mailto:${legal.CONTACT_EMAIL}`)
  assert.equal(fields['Preferred-Languages'], 'en')
  assert.equal(fields.Canonical, 'https://www.out-class.net/.well-known/security.txt')
  assert.equal(fields.Policy, 'https://www.out-class.net/security')
  // Expires is required, ISO 8601, in the future and at most a year after the last review.
  const expires = Date.parse(fields.Expires)
  assert.ok(Number.isFinite(expires) && fields.Expires === new Date(expires).toISOString())
  assert.ok(expires > Date.now(), 'security.txt has expired: review it and move Expires forward')
  assert.ok(expires - Date.parse('2026-11-15T00:00:00Z') <= 366 * 86400000)
  assert.ok(body.endsWith('\n'))
})

test('security.txt skips session middleware and CSP, and robots allows it and /security', async () => {
  const csp = load('lib/csp.ts')
  assert.equal(csp.cspAppliesTo('/.well-known/security.txt'), false)
  assert.equal(csp.cspAppliesTo('/security'), true)
  let sessions = 0
  const { middleware } = load('middleware.ts', {
    '@/lib/demo/access': { DEMO_COOKIE: 'outclass-demo' },
    '@/lib/platform-view-as': { PLATFORM_VIEW_COOKIE: 'outclass-platform-view' },
    '@/utils/supabase/middleware': { createClient: async () => { sessions++; return new Response('page') } },
    '@/lib/student-routes': require('./helpers/navigation-module.cjs'),
    '@/lib/legal-content': { LEGAL_PAGES_PUBLIC: false },
    '@/lib/csp': csp,
    '@/lib/rate-limit-core': load('lib/rate-limit-core.ts'),
  })
  const response = await middleware(new NextRequest('https://www.out-class.net/.well-known/security.txt', { headers: { cookie: 'sb-x-auth-token=1' } }))
  assert.equal(sessions, 0)
  assert.equal(response.headers.get('content-security-policy'), "frame-ancestors 'self'", 'framing policy only, no document policy')
  assert.equal(response.headers.get('content-security-policy-report-only'), null)
  assert.equal(response.headers.get('location'), null)
  const robots = load('app/robots.ts', { '@/lib/seo': seo }).default()
  for (const rule of robots.rules.disallow) assert.ok(!'/.well-known/security.txt'.startsWith(rule) && !'/security'.startsWith(rule), rule)
})

test('footer, sitemap and llms.txt link the security page', async () => {
  assert.match(read('components/landing/public-footer.tsx'), /<a href="\/security">Security<\/a>/)
  assert.match(read('app/sitemap.ts'), /\$\{SITE_URL\}\/security` \}/)
  assert.match(read('app/llms.txt/route.ts'), /\[Security\]\(\$\{SITE_URL\}\/security\)/)
})
