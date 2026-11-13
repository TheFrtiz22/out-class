const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { NextRequest } = require('next/server')

function load(file, mocks = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), mod, mod.exports)
  return mod.exports
}
const csp = load('lib/csp.ts')
const reports = load('lib/csp-report.ts')
const directive = (policy, name) => policy.split('; ').find(part => part === name || part.startsWith(`${name} `))
const withEnv = async (patch, fn) => {
  const saved = { ...process.env }
  try {
    for (const [key, value] of Object.entries(patch)) { if (value === undefined) delete process.env[key]; else process.env[key] = value }
    return await fn()
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]
    Object.assign(process.env, saved)
  }
}
const loadMiddleware = (live = { calls: 0, forwarded: [] }) => load('middleware.ts', {
  '@/lib/demo/access': { DEMO_COOKIE: 'outclass-demo' },
  '@/lib/platform-view-as': { PLATFORM_VIEW_COOKIE: 'outclass-platform-view' },
  '@/utils/supabase/middleware': { createClient: async request => {
    live.calls++
    live.forwarded.push({ nonce: request.headers.get('x-nonce'), policy: request.headers.get('content-security-policy') || request.headers.get('content-security-policy-report-only') })
    return new Response('page')
  } },
  '@/lib/student-routes': require('./helpers/navigation-module.cjs'),
  '@/lib/legal-content': { LEGAL_PAGES_PUBLIC: true },
  '@/lib/csp': csp,
  // Harmless until middleware imports it (rate limits, #279); then these tests keep loading.
  '@/lib/rate-limit-core': fs.existsSync('lib/rate-limit-core.ts') ? load('lib/rate-limit-core.ts') : {},
})

test('middleware sends a fresh nonce per page request and forwards the same nonce to rendering', async () => {
  await withEnv({ OUTCLASS_CSP_ENFORCE: undefined }, async () => {
    const live = { calls: 0, forwarded: [] }
    const { middleware } = loadMiddleware(live)
    const nonces = []
    for (let i = 0; i < 3; i++) {
      const response = await middleware(new NextRequest('https://outclass.example/about', { headers: { 'content-security-policy': "script-src 'nonce-attacker'" } }))
      const policy = response.headers.get('content-security-policy-report-only')
      const nonce = /'nonce-([^']+)'/.exec(directive(policy, 'script-src'))[1]
      assert.match(nonce, /^[A-Za-z0-9+/]{22}==$/, '128-bit base64 nonce')
      assert.equal(live.forwarded[i].nonce, nonce, 'the layout reads the same nonce through x-nonce')
      assert.equal(live.forwarded[i].policy, policy, 'Next.js reads the nonce from the forwarded policy')
      assert.doesNotMatch(live.forwarded[i].policy, /attacker/)
      nonces.push(nonce)
    }
    assert.equal(new Set(nonces).size, 3)
  })
})

test('API routes, public files and metadata routes get no document policy; the report endpoint skips session work', async () => {
  const live = { calls: 0, forwarded: [] }
  const { middleware } = loadMiddleware(live)
  for (const path of ['/api/recruiting-resumes?clubId=a', '/api/workspace', '/robots.txt', '/sw.js', '/pdfjs/pdf.worker.min.mjs', '/images/campus/a.webp', '/club/x/opengraph-image']) {
    const response = await middleware(new NextRequest(`https://outclass.example${path}`))
    assert.equal(response.headers.get('content-security-policy-report-only'), null, path)
    assert.equal(response.headers.get('content-security-policy'), null, path)
  }
  const before = live.calls
  const report = await middleware(new NextRequest('https://outclass.example/api/csp-report', { method: 'POST', headers: { cookie: 'outclass-demo=1' } }))
  assert.equal(report.headers.get('x-middleware-next'), '1', 'not blocked by the Demo Mode write guard')
  assert.equal(live.calls, before)
  for (const path of ['/', '/about', '/uva', '/login', '/club/abc', '/home']) assert.equal(csp.cspAppliesTo(path), true, path)
})

test('Report-Only unless OUTCLASS_CSP_ENFORCE=1; upgrade-insecure-requests only when enforcing', async () => {
  const { middleware } = loadMiddleware()
  await withEnv({ OUTCLASS_CSP_ENFORCE: undefined }, async () => {
    const response = await middleware(new NextRequest('https://outclass.example/'))
    assert.ok(response.headers.get('content-security-policy-report-only'))
    assert.equal(response.headers.get('content-security-policy'), null)
    assert.equal(directive(response.headers.get('content-security-policy-report-only'), 'upgrade-insecure-requests'), undefined)
  })
  for (const value of ['0', 'true', '']) assert.equal(csp.cspHeaderName({ OUTCLASS_CSP_ENFORCE: value }), 'Content-Security-Policy-Report-Only', value)
  await withEnv({ OUTCLASS_CSP_ENFORCE: '1', NODE_ENV: 'production' }, async () => {
    const response = await middleware(new NextRequest('https://outclass.example/'))
    const policy = response.headers.get('content-security-policy')
    assert.ok(policy)
    assert.equal(response.headers.get('content-security-policy-report-only'), null)
    assert.equal(directive(policy, 'upgrade-insecure-requests'), 'upgrade-insecure-requests')
  })
})

test('policy allows only the inventoried origins', () => {
  const env = { NODE_ENV: 'production', NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co', NEXT_PUBLIC_SENTRY_DSN: 'https://key@o1.ingest.us.sentry.io/2' }
  const policy = csp.buildCsp({ nonce: 'n0nce', env })
  assert.equal(directive(policy, 'script-src'), "script-src 'self' 'nonce-n0nce' 'strict-dynamic' 'wasm-unsafe-eval'")
  assert.equal(directive(policy, 'connect-src'), "connect-src 'self' https://abc.supabase.co wss://abc.supabase.co https://o1.ingest.us.sentry.io")
  assert.equal(directive(policy, 'style-src'), "style-src 'self' 'unsafe-inline'")
  assert.equal(directive(policy, 'font-src'), "font-src 'self'")
  assert.equal(directive(policy, 'worker-src'), "worker-src 'self'")
  assert.equal(directive(policy, 'frame-src'), "frame-src 'self'")
  for (const fixed of ["object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'self'", 'report-uri /api/csp-report']) assert.ok(policy.split('; ').includes(fixed), fixed)
  assert.doesNotMatch(policy, /[ ]'unsafe-eval'|key@/)
  const bare = csp.buildCsp({ nonce: 'n', env: { NODE_ENV: 'production' } })
  assert.equal(directive(bare, 'connect-src'), "connect-src 'self'")
  assert.match(directive(csp.buildCsp({ nonce: 'n', env: { NODE_ENV: 'development' } }), 'script-src'), /'unsafe-eval'/)
})

test('Turnstile origins appear only when Turnstile is enabled', () => {
  for (const value of [undefined, '', '0']) {
    const policy = csp.buildCsp({ nonce: 'n', env: { NODE_ENV: 'production', TURNSTILE_ENABLED: value } })
    assert.doesNotMatch(policy, /challenges\.cloudflare\.com/)
  }
  const on = csp.buildCsp({ nonce: 'n', env: { NODE_ENV: 'production', TURNSTILE_ENABLED: '1' } })
  assert.match(directive(on, 'script-src'), / https:\/\/challenges\.cloudflare\.com$/)
  assert.equal(directive(on, 'frame-src'), "frame-src 'self' https://challenges.cloudflare.com")
  assert.doesNotMatch(directive(on, 'connect-src'), /cloudflare/)
})

test('inline scripts carry the request nonce', async () => {
  for (const file of ['app/page.tsx', 'app/about/page.tsx', 'app/uva/page.tsx']) {
    const source = fs.readFileSync(file, 'utf8')
    const scripts = source.match(/<script\b[^>]*>/g) || []
    assert.ok(scripts.length, file)
    for (const tag of scripts) assert.match(tag, /nonce=\{nonce\}/, `${file}: ${tag}`)
    assert.match(source, /const nonce = await cspNonce\(\)/, file)
  }
  // No other page or component renders an inline executable script or next/script.
  const { execFileSync } = require('node:child_process')
  const files = execFileSync('git', ['ls-files', 'app', 'components', 'contexts', 'hooks'], { encoding: 'utf8' }).split('\n').filter(f => /\.tsx$/.test(f))
  const offenders = files.filter(f => !['app/page.tsx', 'app/about/page.tsx', 'app/uva/page.tsx', 'app/(workspace)/club/[clubId]/page.tsx'].includes(f) && /<script\b|from ["']next\/script["']/.test(fs.readFileSync(f, 'utf8')))
  assert.deepEqual(offenders, [])
  // Club pages emit JSON-LD (data, not executed) for indexable clubs; it still carries the nonce.
  const club = fs.readFileSync('app/(workspace)/club/[clubId]/page.tsx', 'utf8')
  for (const tag of club.match(/<script\b[^>]*>/g) || []) assert.match(tag, /nonce=\{nonce\}/, `club page: ${tag}`)
  assert.match(club, /await cspNonce\(\)/)
  // Rendered: the nonce reaches the JSON-LD tag React emits.
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
  const About = load('app/about/page.tsx', {
    '@/utils/csp-nonce': { cspNonce: async () => 'rendered-nonce' },
    '@/components/landing/public-information-page': { PublicInformationPage: ({ children }) => React.createElement('main', null, children) },
    '@/components/motion/scroll-motion': { SectionReveal: ({ children }) => React.createElement('section', null, children) },
    '@/components/ui/button': { Button: ({ children }) => children },
    'next/image': { __esModule: true, default: () => null }, 'next/link': { __esModule: true, default: ({ children }) => children },
    '@/lib/seo': { publicPageMetadata: () => ({}), publicPageStructuredData: () => ({ '@type': 'AboutPage' }) },
    '@/components/landing/promo-video': { PromoVideoFigure: () => null },
  })
  const html = renderToStaticMarkup(await About.default())
  assert.match(html, /<script type="application\/ld\+json" nonce="rendered-nonce">/)
})

test('report endpoint ignores oversized bodies and logs a masked, deduplicated summary', async () => {
  const lines = []
  const warn = console.warn
  console.warn = (...args) => lines.push(args)
  try {
    const route = load('app/api/csp-report/route.ts', { '@/lib/csp-report': reports })
    const post = (body, type = 'application/csp-report', headers = {}) => route.POST(new Request('https://outclass.example/api/csp-report', { method: 'POST', headers: { 'content-type': type, ...headers }, body }))
    const violation = { 'csp-report': { 'document-uri': 'https://outclass.example/club/3f0b1c2d-1111-4222-8333-444455556666/workspace?email=a@b.c', 'effective-directive': 'script-src-elem', 'blocked-uri': 'https://evil.example/x.js?token=secret', 'script-sample': 'alert(document.cookie)', referrer: 'https://outclass.example/private?x=1' } }
    assert.equal((await post('x'.repeat(9000))).status, 413)
    assert.equal((await post(JSON.stringify(violation), 'application/csp-report', { 'content-length': '999999' })).status, 413)
    assert.equal((await post(JSON.stringify(violation), 'text/plain')).status, 415)
    assert.equal(lines.length, 0)
    assert.equal((await post(JSON.stringify(violation))).status, 204)
    assert.equal((await post(JSON.stringify(violation))).status, 204)
    assert.equal((await post('{not json')).status, 204)
    assert.equal(lines.length, 1, 'duplicates are not re-logged')
    assert.deepEqual(lines[0], ['CSP violation', { directive: 'script-src-elem', blocked: 'https://evil.example', path: '/club/:id/workspace', disposition: 'report' }])
    assert.doesNotMatch(JSON.stringify(lines), /secret|cookie|email|private/)
    const modern = [{ type: 'csp-violation', body: { documentURL: 'https://outclass.example/login', effectiveDirective: 'connect-src', blockedURL: 'wss://abc.supabase.co/realtime', disposition: 'enforce' } }, { type: 'deprecation', body: {} }]
    assert.equal((await post(JSON.stringify(modern), 'application/reports+json')).status, 204)
    assert.deepEqual(lines[1], ['CSP violation', { directive: 'connect-src', blocked: 'wss://abc.supabase.co', path: '/login', disposition: 'enforce' }])
  } finally { console.warn = warn }
})

test('report log is rate limited and bounded per window', () => {
  let clock = 0
  const log = reports.cspReportLog({ windowMs: 1000, maxLogs: 3, maxKeys: 5, now: () => clock })
  const v = i => ({ directive: 'img-src', blocked: `https://h${i}.example`, path: '/', disposition: 'report' })
  assert.equal(log.accept([v(1), v(2), v(3), v(4), v(5), v(1)]).length, 3)
  clock = 1000
  const rolled = log.accept([v(9)])
  assert.deepEqual(rolled[0], { message: 'CSP violations repeated', data: { distinct: 3, repeats: 1, dropped: 2 } })
  assert.equal(rolled[1].data.blocked, 'https://h9.example')
})
