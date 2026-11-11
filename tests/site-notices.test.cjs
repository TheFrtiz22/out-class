const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { sessionFor } = require('./helpers/auth-session.cjs')

function load(file, mocks = {}) {
  const m = { exports: {} }
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const resolve = n => n in mocks ? mocks[n] : n.endsWith('.css') ? {} : n.startsWith('@/') ? load(fs.existsSync(n.slice(2) + '.tsx') ? n.slice(2) + '.tsx' : n.slice(2) + '.ts', mocks) : require(n)
  new Function('require', 'module', 'exports', source)(resolve, m, m.exports)
  return m.exports
}
// React.cache stand-in: one memo per request scope (tests create a new scope per "request").
function requestCache() {
  const scopes = []
  return { cache: fn => { const memo = new Map(); scopes.push(memo); return (...args) => { const key = JSON.stringify(args); if (!memo.has(key)) memo.set(key, fn(...args)); return memo.get(key) } }, newRequest: () => scopes.forEach(s => s.clear()) }
}
const Icon = name => Object.assign(props => React.createElement('svg', { 'data-icon': name, 'aria-hidden': true, className: props.className }), { displayName: name })
const uiMocks = {
  '@/components/icons': { TriangleAlert: Icon('TriangleAlert'), Megaphone: Icon('Megaphone'), X: Icon('X') },
  '@/components/ui/icon-button': { IconButton: ({ children, ...p }) => React.createElement('button', { type: 'button', 'aria-label': p['aria-label'] }, children) },
  '@/components/site-notice-offset': { SiteNoticeOffset: () => null },
}
function settingsHarness({ stored = null, admins = [] } = {}) {
  const rc = requestCache(), cacheCalls = []
  let reads = 0, grants = 0, value = stored
  const prisma = {
    platformContent: { findUnique: async ({ where }) => { reads++; assert.equal(where.key, 'platform:settings'); return value ? { value } : null } },
    platformAdmin: { findUnique: async ({ where }) => { grants++; return admins.includes(where.userId) ? { active: true } : null } },
  }
  const mocks = { react: { ...React, cache: rc.cache }, '@/utils/prisma': { prisma }, 'next/cache': { unstable_cache: (fn, keys, opts) => { cacheCalls.push({ keys, opts }); return fn }, revalidateTag() {}, revalidatePath() {} } }
  const settings = load('utils/site-settings.ts', mocks)
  return { prisma, mocks, settings, cacheCalls, newRequest: rc.newRequest, set: v => { value = v }, reads: () => reads, grants: () => grants }
}

test('maintenance mode defaults OFF and malformed settings never turn it on', () => {
  const { platformSettingsSchema, siteNoticesFrom } = load('lib/site-settings.ts')
  assert.equal(platformSettingsSchema.parse({}).maintenanceMode, false)
  assert.throws(() => platformSettingsSchema.parse({ maintenanceMode: 'true' }))
  assert.deepEqual(siteNoticesFrom(null), { campusNotice: '', maintenanceNotice: '', maintenanceMode: false })
  assert.deepEqual(siteNoticesFrom({ maintenanceMode: 'yes', campusNotice: 42, maintenanceNotice: '  Back at 9  ' }), { campusNotice: '', maintenanceNotice: 'Back at 9', maintenanceMode: false })
  assert.equal(siteNoticesFrom({ maintenanceMode: true }).maintenanceMode, true)
})

test('the notice reader is cached: one database call for two reads in one request, with a 60 s tagged revalidation', async () => {
  const h = settingsHarness({ stored: { campusNotice: 'Activities fair Friday', maintenanceNotice: '', maintenanceMode: false, supportEmail: 'private@virginia.edu' } })
  const [a, b] = await Promise.all([h.settings.getSiteNotices(), h.settings.getSiteNotices()])
  assert.equal(await h.settings.getSiteNotices(), a)
  assert.equal(h.reads(), 1)
  assert.deepEqual(b, { campusNotice: 'Activities fair Friday', maintenanceNotice: '', maintenanceMode: false }, 'only public notice fields leave the reader')
  assert.deepEqual(h.cacheCalls.map(c => c.opts), [{ revalidate: 60, tags: ['platform-settings'] }])
  h.newRequest(); await h.settings.getSiteNotices(); assert.equal(h.reads(), 2)
})

test('a failed settings read shows no notices and leaves maintenance mode OFF', async () => {
  const h = settingsHarness()
  h.prisma.platformContent.findUnique = async () => { throw Error('db down') }
  const error = console.error; console.error = () => {}
  try { assert.deepEqual(await h.settings.getSiteNotices(), { campusNotice: '', maintenanceNotice: '', maintenanceMode: false }) } finally { console.error = error }
})

test('empty notices render nothing; notice text is escaped, never HTML', () => {
  const { SiteNotices, MaintenanceNotice } = load('components/site-notices.tsx', uiMocks)
  const { CampusNotice } = load('components/campus-notice.tsx', uiMocks)
  assert.equal(renderToStaticMarkup(React.createElement(SiteNotices, { notices: { campusNotice: '', maintenanceNotice: '' } })), '')
  assert.equal(renderToStaticMarkup(React.createElement(MaintenanceNotice, { text: '' })), '')
  assert.equal(renderToStaticMarkup(React.createElement(CampusNotice, { text: '' })), '')
  const hostile = '<script>alert(1)</script><img src=x onerror=alert(2)> & "quotes"'
  const html = renderToStaticMarkup(React.createElement(SiteNotices, { notices: { campusNotice: hostile, maintenanceNotice: hostile } }))
  assert.ok(!html.includes('<script>') && !html.includes('<img'), 'no markup from notice text')
  assert.equal(html.split('&lt;script&gt;alert(1)&lt;/script&gt;&lt;img src=x onerror=alert(2)&gt; &amp; &quot;quotes&quot;').length, 3)
  assert.match(html, /role="status"[^>]*aria-label="Maintenance notice"/, 'persistent strip is polite, not assertive')
  assert.ok(!html.includes('role="alert"'))
  assert.match(html, /role="status"[^>]*aria-label="Campus notice"/)
  assert.match(html, /<button[^>]*aria-label="Dismiss campus notice"/, 'campus notice is dismissible by keyboard button')
  assert.equal((html.match(/<button/g) || []).length, 1, 'maintenance notice has no dismiss control')
  const { campusNoticeDismissKey, campusNoticeDismissCookie } = load('lib/campus-notice-dismiss.ts')
  assert.notEqual(campusNoticeDismissKey('A'), campusNoticeDismissKey('B'))
  assert.match(campusNoticeDismissKey(hostile), /^oc-campus-notice-[a-z0-9]+$/, 'cookie-safe name')
  assert.equal(campusNoticeDismissCookie('A'), `${campusNoticeDismissKey('A')}=1; path=/; SameSite=Lax`, 'session cookie: no Max-Age or Expires')
})

const clubId = '00000000-0000-4000-8000-000000000001'
function writeHarness({ action = true, maintenance = true } = {}) {
  process.env.OUTCLASS_PLATFORM_ADMIN_IDS = 'admin'
  let signedIn = 'leader'; const writes = []
  const s = settingsHarness({ stored: { maintenanceMode: maintenance }, admins: ['admin'] })
  const member = { id: 'member', userId: 'leader', clubId, status: 'ACTIVE', isOwner: true, permissions: ['club.settings'] }
  const prisma = Object.assign(s.prisma, {
    $queryRaw: async strings => strings.join('').includes('FROM auth.sessions') ? [{ live: true }] : [],
    user: { findUnique: async ({ where }) => ({ id: where.id, email: `${where.id}@virginia.edu`, disabledAt: null }) },
    clubMember: { findUnique: async ({ where }) => ({ ...member, userId: where.userId_clubId.userId }) },
    club: { findUniqueOrThrow: async () => ({}), update: async ({ data }) => { writes.push(data); return { id: clubId, ...data } } },
    auditLog: { create: async () => ({}) },
  })
  prisma.$transaction = async fn => fn(prisma)
  const mocks = {
    ...s.mocks,
    '@/utils/prisma': { prisma }, './prisma': { prisma },
    '@/utils/club-write-transaction': { clubWriteTransaction: fn => prisma.$transaction(fn) },
    '@/utils/club-asset-storage': { assertClubImageAssignment: async () => {}, releaseReplacedClubImages: async () => {} },
    '@/utils/platform-view-as': { platformViewSession: async () => null },
    'next/headers': { cookies: async () => ({ has: () => false, get: () => undefined }), headers: async () => new Headers(action ? { 'next-action': 'abc123' } : {}) },
    './supabase/server': { createClient: async () => ({ auth: { getSession: async () => sessionFor(signedIn), getUser: async () => ({ data: { user: { id: signedIn, email: `${signedIn}@virginia.edu`, email_confirmed_at: '2026-01-01' } } }) } }) },
    'next/navigation': { redirect() { throw Error('Unauthenticated') } },
  }
  mocks['@/utils/site-settings'] = s.settings
  const auth = load('utils/auth.ts', mocks); mocks['@/utils/auth'] = auth
  return { auth, writes, settings: s, signIn: id => { signedIn = id; s.newRequest() }, workspace: load('actions/club-workspace.ts', mocks) }
}
const input = { clubId, name: 'Test club', tagline: 'Test', description: 'Description' }

test('maintenance mode refuses a representative Server Action write for a normal user before any write', async () => {
  const h = writeHarness()
  await assert.rejects(h.workspace.updateClubSettings(input), /undergoing maintenance\. Changes are paused/)
  assert.equal(h.writes.length, 0)
})

test('platform admins keep writing during maintenance, and writes reopen when it is OFF', async () => {
  const h = writeHarness(); h.signIn('admin')
  await h.workspace.updateClubSettings(input)
  assert.equal(h.writes.length, 1)
  const off = writeHarness({ maintenance: false })
  await off.workspace.updateClubSettings(input)
  assert.equal(off.writes.length, 1)
  assert.equal(off.settings.grants(), 0, 'no admin lookup while maintenance is OFF')
})

test('maintenance mode leaves page reads and admin entry points (/platform) usable', async () => {
  const read = writeHarness({ action: false })
  assert.equal((await read.auth.requireAuth()).user.id, 'leader', 'GET renders are not refused')
  const h = writeHarness()
  // requirePlatformAdmin uses adminDiagnostics and verifies admin authority itself.
  assert.equal((await h.auth.requireAuth({ allowPlatformView: true, adminDiagnostics: true })).user.id, 'leader')
})

test('the maintenance gate shows the maintenance page only to signed-in non-admins, whatever cookies they send', async () => {
  process.env.OUTCLASS_PLATFORM_ADMIN_IDS = 'admin'
  const s = settingsHarness({ stored: { maintenanceMode: true }, admins: ['admin'] })
  let user = null
  const gateMocks = { ...uiMocks, ...s.mocks, '@/utils/site-settings': s.settings, 'next/headers': { cookies: async () => ({ has: () => true, get: () => ({ value: 'f'.repeat(64) }) }) }, '@/utils/auth': { getSessionUser: async () => ({ data: { user }, error: null }) } }
  const { MaintenanceGate } = load('components/maintenance-gate.tsx', gateMocks)
  const render = async () => renderToStaticMarkup(await MaintenanceGate({ children: React.createElement('p', null, 'product') }))
  assert.equal(await render(), '<p>product</p>', 'signed-out visitors and sign-in pages, including /platform/login, pass through')
  user = { id: 'admin' }; s.newRequest()
  assert.equal(await render(), '<p>product</p>', '/platform and verified support sessions (the admin login is retained) stay reachable')
  user = { id: 'student' }; s.newRequest()
  assert.match(await render(), /OutClass is undergoing maintenance/, 'a bogus view-as cookie does not bypass the gate')
  const off = settingsHarness()
  const offGate = load('components/maintenance-gate.tsx', { ...gateMocks, ...off.mocks, '@/utils/site-settings': off.settings }).MaintenanceGate
  assert.equal(renderToStaticMarkup(await offGate({ children: 'product' })), 'product')
})

function renderRootLayout({ stored, cookies = {}, viewSession = null }) {
  const s = settingsHarness({ stored })
  const pass = ({ children }) => React.createElement(React.Fragment, null, children)
  const mocks = {
    ...uiMocks, ...s.mocks, '@/utils/site-settings': s.settings,
    'next/font/local': () => ({ variable: 'font' }),
    '@vercel/analytics/next': { Analytics: () => null }, '@vercel/speed-insights/next': { SpeedInsights: () => null },
    '@/components/ui/sonner': { Toaster: () => null }, '@/components/support-session-sync': { SupportSessionSync: () => null },
    '@/components/platform-view-banner': { PlatformViewBanner: ({ label }) => React.createElement('aside', { 'data-view-as': label }) },
    '@/components/route-content': { RouteContent: ({ children }) => React.createElement('div', { className: 'oc-route-content' }, children) },
    '@/utils/platform-view-as': { platformViewSession: async () => viewSession },
    '@/lib/seo': { SITE_URL: 'https://example.test', SITE_TITLE: 'OutClass', SITE_DESCRIPTION: '', LEGAL_ORGANIZATION_NAME: '', privateRobots: {}, socialDefaults: () => ({}) },
    '@/utils/auth': { getSessionUser: async () => ({ data: { user: null }, error: null }) }, '@/utils/current-user': { getCurrentUser: async () => null },
    '@/lib/auth': { isUvaEmail: () => true }, '@/lib/demo/access': { canAccessDemo: () => false, DEMO_COOKIE: 'outclass-demo-session' },
    '@/utils/prisma': { prisma: { ...s.prisma, user: { findUnique: async () => null } } }, '@/lib/demo/validate': { readDemoTemplate: v => v },
    '@/contexts/corkboard-context': { CorkboardProvider: pass }, '@/contexts/auth-context': { AuthProvider: pass },
    '@/contexts/organization-invitations-context': { OrganizationInvitationsProvider: pass }, '@/contexts/demo-context': { DemoDataProvider: pass },
    'next/headers': { cookies: async () => ({ has: n => n in cookies, get: n => n in cookies ? { value: cookies[n] } : undefined, getAll: () => [] }) },
  }
  const { default: RootLayout } = load('app/layout.tsx', mocks)
  return RootLayout({ children: React.createElement('p', null, 'page') }).then(renderToStaticMarkup)
}

test('root layout: a bogus view-as cookie still sees the notices; only a verified support session omits them', async () => {
  const stored = { campusNotice: 'Fair Friday', maintenanceNotice: 'Upgrade tonight', maintenanceMode: false }
  const bogus = await renderRootLayout({ stored, cookies: { 'outclass-platform-view': 'forged' } })
  assert.match(bogus, /Upgrade tonight/); assert.match(bogus, /Fair Friday/)
  assert.match(bogus, /data-site-notices="" style="padding-top:var\(--support-banner-height, 120px\)"/, 'starts below the stale view-as banner')
  const support = await renderRootLayout({ stored, cookies: { 'outclass-platform-view': 'a'.repeat(64) }, viewSession: { id: 's', targetUserId: 't', expiresAt: new Date(Date.now() + 60000) } })
  assert.ok(!support.includes('data-site-notices'))
  const plain = await renderRootLayout({ stored })
  assert.match(plain, /<div data-site-notices="">/)
})

test('root layout skips a campus notice dismissed this session (cookie) but never the maintenance notice', async () => {
  const { campusNoticeDismissKey } = load('lib/campus-notice-dismiss.ts')
  const stored = { campusNotice: 'Fair Friday', maintenanceNotice: 'Upgrade tonight' }
  const html = await renderRootLayout({ stored, cookies: { [campusNoticeDismissKey('Fair Friday')]: '1' } })
  assert.ok(!html.includes('Fair Friday')); assert.match(html, /Upgrade tonight/)
  const changed = await renderRootLayout({ stored: { ...stored, campusNotice: 'New notice' }, cookies: { [campusNoticeDismissKey('Fair Friday')]: '1' } })
  assert.match(changed, /New notice/, 'a new campus notice shows again')
  const modeOnly = await renderRootLayout({ stored: { maintenanceMode: true } })
  assert.match(modeOnly, /OutClass is undergoing maintenance/, 'maintenance mode without text still shows a banner')
})

test('a hanging settings read times out after 1.5 s and the outage is not retried for 10 s', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })
  const h = settingsHarness()
  let calls = 0
  h.prisma.platformContent.findUnique = () => { calls++; return new Promise(() => {}) }
  const error = console.error; console.error = () => {}
  try {
    const pending = h.settings.getSiteNotices()
    t.mock.timers.tick(1500)
    assert.deepEqual(await pending, { campusNotice: '', maintenanceNotice: '', maintenanceMode: false })
    h.newRequest(); await h.settings.getSiteNotices()
    t.mock.timers.tick(9000); h.newRequest(); await h.settings.getSiteNotices()
    assert.equal(calls, 1, 'no database retry inside the 10 s backoff')
    t.mock.timers.tick(1001); h.newRequest()
    h.prisma.platformContent.findUnique = async () => { calls++; return { value: { campusNotice: 'Back' } } }
    assert.equal((await h.settings.getSiteNotices()).campusNotice, 'Back')
    assert.equal(calls, 2)
  } finally { console.error = error }
})

test('route handlers: every app/api write handler is guarded by the maintenance check or explicitly exempted', () => {
  // Server Actions are refused in requireAuth. Route handlers cannot be detected there, so any
  // handler that writes must call assertSiteWritable itself or be listed here with its reason.
  const exempt = {
    'app/api/auth/logout/route.ts': 'sign-out must always work',
    'app/api/auth/student-claim/route.ts': 'account claim is an auth flow',
    'app/api/auth/password-recovery/route.ts': 'password recovery is an auth flow',
    'app/api/demo/route.ts': 'demo mode toggle; demo never writes production data',
    'app/api/school-requests/route.ts': 'unauthenticated public marketing form',
    'app/api/platform/view-as/route.ts': 'platform admin only (requirePlatformAdmin)',
    'app/api/platform/elevation/route.ts': 'platform admin only (requirePlatformAdmin)',
    'app/api/internal/scheduled-communications/route.ts': 'cron, bearer secret',
    'app/api/internal/notification-delivery/route.ts': 'cron, bearer secret',
    'app/api/internal/invitation-delivery/route.ts': 'cron, bearer secret',
    'app/api/csp-report/route.ts': 'browser CSP reports; logs a bounded summary, writes no data',
  }
  const routes = []
  const walk = dir => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const f = `${dir}/${e.name}`; if (e.isDirectory()) walk(f); else if (/^route\.tsx?$/.test(e.name)) routes.push(f) } }
  walk('app/api')
  const writers = routes.filter(f => /export\s+(async\s+)?(function|const)\s+(POST|PUT|PATCH|DELETE)\b/.test(fs.readFileSync(f, 'utf8')))
  assert.ok(writers.length >= Object.keys(exempt).length - 1, 'inventory found the write handlers')
  for (const f of writers) {
    const source = fs.readFileSync(f, 'utf8')
    assert.ok(f in exempt || /assertSiteWritable\(/.test(source), `${f} writes: call assertSiteWritable (utils/site-settings) after authentication, or add it to the reviewed exemptions`)
  }
  for (const f of Object.keys(exempt)) assert.ok(fs.existsSync(f), `${f} listed as exempt but missing`)
})

test('admin settings expose the maintenance switch, site-wide copy, and revalidate the notice cache on save', () => {
  const ui = fs.readFileSync('components/admin/admin-settings.tsx', 'utf8')
  assert.match(ui, /Notices are shown site-wide/)
  assert.match(ui, /<Toggle label="Maintenance mode"/)
  const actions = fs.readFileSync('actions/admin-workspace.ts', 'utf8')
  assert.match(actions, /const settingsSchema = platformSettingsSchema;/)
  assert.match(actions, /revalidateTag\(SITE_SETTINGS_TAG\)/)
  const layout = fs.readFileSync('app/layout.tsx', 'utf8')
  assert.match(layout, /<SiteNotices notices=/)
  for (const group of ['app/(workspace)/layout.tsx', 'app/(focus)/layout.tsx']) assert.match(fs.readFileSync(group, 'utf8'), /<MaintenanceGate>/)
})
