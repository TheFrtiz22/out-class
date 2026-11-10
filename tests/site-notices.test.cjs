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
  const resolve = n => n in mocks ? mocks[n] : n.startsWith('@/') ? load(fs.existsSync(n.slice(2) + '.tsx') ? n.slice(2) + '.tsx' : n.slice(2) + '.ts', mocks) : require(n)
  new Function('require', 'module', 'exports', source)(resolve, m, m.exports)
  return m.exports
}
// React.cache stand-in: one memo per request scope (tests create a new scope per "request").
function requestCache() {
  const scopes = []
  return { cache: fn => { const memo = new Map(); scopes.push(memo); return (...args) => { const key = JSON.stringify(args); if (!memo.has(key)) memo.set(key, fn(...args)); return memo.get(key) } }, newRequest: () => scopes.forEach(s => s.clear()) }
}
const Icon = name => props => React.createElement('svg', { 'data-icon': name, 'aria-hidden': true, className: props.className })
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
  assert.match(html, /role="alert"[^>]*aria-label="Maintenance notice"/)
  assert.match(html, /role="status"[^>]*aria-label="Campus notice"/)
  assert.match(html, /<button[^>]*aria-label="Dismiss campus notice"/, 'campus notice is dismissible by keyboard button')
  assert.equal((html.match(/<button/g) || []).length, 1, 'maintenance notice has no dismiss control')
  assert.notEqual(CampusNoticeKey('A'), CampusNoticeKey('B'))
  function CampusNoticeKey(t) { return load('components/campus-notice.tsx', uiMocks).noticeDismissKey(t) }
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
    '@/utils/club-asset-storage': { assertClubImageAssignment: async () => {} },
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

test('the maintenance gate shows the maintenance page only to signed-in non-admins', async () => {
  process.env.OUTCLASS_PLATFORM_ADMIN_IDS = 'admin'
  const s = settingsHarness({ stored: { maintenanceMode: true }, admins: ['admin'] })
  let user = null, support = false
  const gateMocks = { ...uiMocks, ...s.mocks, '@/utils/site-settings': s.settings, 'next/headers': { cookies: async () => ({ has: () => support }) }, '@/utils/auth': { getSessionUser: async () => ({ data: { user }, error: null }) } }
  const { MaintenanceGate } = load('components/maintenance-gate.tsx', gateMocks)
  const render = async () => renderToStaticMarkup(await MaintenanceGate({ children: React.createElement('p', null, 'product') }))
  assert.equal(await render(), '<p>product</p>', 'signed-out visitors and sign-in pages, including /platform/login, pass through')
  user = { id: 'admin' }; s.newRequest()
  assert.equal(await render(), '<p>product</p>', '/platform stays reachable for platform admins')
  user = { id: 'student' }; s.newRequest()
  assert.match(await render(), /OutClass is undergoing maintenance/)
  support = true
  assert.equal(await render(), '<p>product</p>', 'audited support sessions keep the product view')
  const off = settingsHarness()
  const offGate = load('components/maintenance-gate.tsx', { ...gateMocks, ...off.mocks, '@/utils/site-settings': off.settings }).MaintenanceGate
  assert.equal(renderToStaticMarkup(await offGate({ children: 'product' })), 'product')
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
