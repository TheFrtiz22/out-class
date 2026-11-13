// Issue reports and feedback: who may file, rate limit, kinds, server-built context, screenshot
// checks, admin-only reading, the content-free live signal, and the client live helper.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const root = path.resolve(__dirname, '..')
function loader(mocks) {
  const cache = {}
  return function load(file) {
    file = path.resolve(root, file)
    if (cache[file]) return cache[file].exports
    const m = { exports: {} }; cache[file] = m
    const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
    new Function('require', 'module', 'exports', out)(name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name), m, m.exports)
    return m.exports
  }
}
const lib = loader({})('lib/feedback-reports.ts')
const USER = '00000000-0000-4000-8000-0000000000u1'.replace('u1', '01'), OTHER = '00000000-0000-4000-8000-000000000002'
const SHOT = `reports/${USER}/00000000-0000-4000-8000-0000000000aa.jpg`
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

function world(over = {}) {
  const state = { recent: 0, impersonating: false, demo: false, anonymous: false, admin: true, check: 'ok', limited: false, ...over }
  const calls = { created: [], audits: [], touched: 0, prepared: [], checked: [], signed: [] }
  const tx = {
    $queryRaw: async () => [],
    platformReport: { count: async () => state.recent, create: async ({ data }) => { calls.created.push(data); return { id: 'report-1', ...data } } },
    auditLog: { create: async ({ data }) => { calls.audits.push(data) } },
  }
  const prisma = {
    $transaction: async fn => { calls.touched++; return fn(tx) },
    platformReport: {
      count: async () => state.recent,
      findUnique: async ({ where }) => state.reports?.[where.id] ?? null,
    },
    auditLog: tx.auditLog,
  }
  const bucket = {
    createSignedUploadUrl: async p => { calls.prepared.push(p); return { data: { signedUrl: 'https://storage.example/upload' }, error: null } },
    createSignedUrl: async (p, seconds) => { calls.signed.push([p, seconds]); return { data: { signedUrl: 'https://storage.example/read' }, error: null } },
  }
  const mocks = {
    'next/headers': { cookies: async () => ({ get: k => k === 'outclass-demo-session' && state.demo ? { value: '1' } : undefined, has: () => false }), headers: async () => new Map([['user-agent', UA], ['x-forwarded-for', '203.0.113.9']]) },
    '@/utils/prisma': { prisma },
    '@/utils/auth': { requireAuth: async () => { if (state.anonymous) throw Error('NEXT_REDIRECT'); return { user: { id: USER }, impersonation: state.impersonating ? { id: 's' } : null } } },
    '@/utils/platform-admin': { requirePlatformAdmin: async () => { if (!state.admin) throw Error('Platform administrator access required'); return { id: 'admin-1' } } },
    '@/utils/feedback-screenshots': { feedbackScreenshotBucket: async () => bucket, checkFeedbackScreenshot: async (_b, file) => { calls.checked.push(file); return state.check } },
    '@/lib/rate-limit-action': { limitAction: async () => ({ ok: !state.limited }) },
  }
  const server = loader(mocks)('actions/feedback-reports.ts')
  return { server, calls, state }
}
const report = (over = {}) => ({ kind: 'ISSUE', message: 'The Apply button does nothing on my phone.', context: { path: '/applications?tab=open#access_token=secret', viewport: { width: 390, height: 844 } }, ...over })

test('only a signed-in, live account can file: anonymous, support sessions and Demo Mode are refused before any write', async () => {
  await assert.rejects(world({ anonymous: true }).server.submitFeedbackReport(report()), /NEXT_REDIRECT/)
  for (const [over, code] of [[{ impersonating: true }, 'SUPPORT_SESSION'], [{ demo: true }, 'DEMO']]) {
    const w = world(over)
    const result = await w.server.submitFeedbackReport(report())
    assert.equal(result.ok, false); assert.equal(result.code, code)
    assert.equal((await w.server.prepareFeedbackScreenshot({ size: 1000, mime: 'image/jpeg' })).code, code)
    assert.equal(w.calls.touched, 0); assert.equal(w.calls.created.length, 0); assert.equal(w.calls.prepared.length, 0)
  }
})

test('issues and feedback are filed with the session identity; other kinds and forged identity fields are not', async () => {
  for (const kind of ['ISSUE', 'FEEDBACK']) {
    const w = world()
    const result = await w.server.submitFeedbackReport(report({ kind, context: { path: '/home', userId: OTHER, email: 'x@y.z' } }))
    assert.equal(result.ok, true, JSON.stringify(result))
    const row = w.calls.created[0]
    assert.equal(row.kind, kind); assert.equal(row.reporterId, USER); assert.equal(row.summary, 'The Apply button does nothing on my phone.')
    assert.deepEqual(Object.keys(row.context).sort(), ['appVersion', 'path', 'userAgent', 'viewport'], 'unknown context keys are stripped')
    assert.equal(w.calls.audits[0].action, 'platform.report.create'); assert.equal(w.calls.audits[0].details.kind, kind)
  }
  for (const bad of [report({ kind: 'SUPPORT' }), report({ kind: 'USER' }), report({ reporterId: OTHER }), report({ message: 'short' }), report({ message: 'x'.repeat(2001) })]) {
    const w = world()
    const result = await w.server.submitFeedbackReport(bad)
    assert.equal(result.ok, false, JSON.stringify(bad).slice(0, 80)); assert.equal(w.calls.created.length, 0)
  }
})

test('the hourly allowance is shared with every platform report, checked again inside the transaction', async () => {
  const w = world({ recent: 10 })
  const result = await w.server.submitFeedbackReport(report())
  assert.equal(result.ok, false); assert.equal(result.code, 'RATE_LIMITED'); assert.equal(w.calls.created.length, 0)
  assert.equal((await w.server.prepareFeedbackScreenshot({ size: 1000, mime: 'image/jpeg' })).code, 'RATE_LIMITED')
  assert.equal((await world({ limited: true }).server.prepareFeedbackScreenshot({ size: 1000, mime: 'image/jpeg' })).code, 'RATE_LIMITED', 'the shared limiter applies to upload URLs')
  assert.equal((await world({ recent: 9 }).server.submitFeedbackReport(report())).ok, true)
  assert.match(fs.readFileSync('actions/feedback-reports.ts', 'utf8'), /limitAction\(RATE_LIMITS\.feedbackScreenshots, \{ userId: user\.id \}\)/)
})

test('context is built on the server: path without fragment or secrets, device line from the header, bounded fields', async () => {
  const w = world()
  await w.server.submitFeedbackReport(report({ context: { path: '/applications?tab=open&token=abc&code=123&redirect=%2Fhome#access_token=secret', viewport: { width: 390, height: 844 } } }))
  const c = w.calls.created[0].context
  assert.equal(c.path, '/applications?tab=open&redirect=%2Fhome')
  assert.equal(c.userAgent, 'Chrome 131 on macOS (desktop)')
  assert.equal(c.viewport, '390×844')
  assert.ok(c.appVersion && c.appVersion.length <= 40)
  assert.equal(w.calls.created[0].targetId, '/applications')
  assert.doesNotMatch(JSON.stringify(c), /secret|abc|123/)
  assert.equal(lib.sanitizeReportPath('https://evil.example/x'), '/')
  assert.equal(lib.sanitizeReportPath('//evil.example/x'), '/')
  assert.equal(lib.sanitizeReportPath('/q/AbC123'), '/q/[code]')
  assert.equal(lib.sanitizeReportPath('/club/00000000-0000-4000-8000-000000000001/workspace?section=members'), '/club/00000000-0000-4000-8000-000000000001/workspace?section=members')
  assert.equal(lib.sanitizeReportPath('/invite/aBcDeFgHiJkLmNoPqRsTuVwXyZ012345'), '/invite/[redacted]')
  assert.ok(lib.sanitizeReportPath('/' + 'a/'.repeat(600)).length <= lib.FEEDBACK_PATH_MAX)
  assert.equal(lib.summarizeUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'), 'Safari 18 on iOS (phone)')
  assert.equal(lib.summarizeUserAgent(''), 'Unknown browser')
  assert.ok(lib.summarizeUserAgent('x'.repeat(5000)).length <= lib.FEEDBACK_USER_AGENT_MAX)
  assert.equal(lib.appVersion({ VERCEL_GIT_COMMIT_SHA: 'abcdef1234567890', VERCEL_ENV: 'preview' }), 'abcdef123456 (preview)')
  const viewportTooBig = await world().server.submitFeedbackReport(report({ context: { path: '/', viewport: { width: 1e9, height: 1 } } }))
  assert.equal(viewportTooBig.ok, false)
})

test('screenshots: only the reporter’s own server-issued path, verified in Storage before the row is written', async () => {
  const w = world()
  const prepared = await w.server.prepareFeedbackScreenshot({ size: 150000, mime: 'image/jpeg' })
  assert.equal(prepared.ok, true)
  assert.match(prepared.data.path, new RegExp(`^reports/${USER}/[0-9a-f-]{36}\\.jpg$`))
  for (const bad of [{ size: 3 * 1024 * 1024, mime: 'image/jpeg' }, { size: 10, mime: 'image/gif' }, { size: 10, mime: 'image/jpeg', path: 'x' }])
    assert.equal((await w.server.prepareFeedbackScreenshot(bad)).code, 'INVALID_SCREENSHOT')
  const foreign = await w.server.submitFeedbackReport(report({ screenshot: { path: `reports/${OTHER}/00000000-0000-4000-8000-0000000000aa.jpg`, size: 100, mime: 'image/jpeg' } }))
  assert.equal(foreign.ok, false); assert.equal(w.calls.checked.length, 0)
  for (const check of ['mismatch', 'incomplete', 'unavailable']) {
    const failing = world({ check })
    const result = await failing.server.submitFeedbackReport(report({ screenshot: { path: SHOT, size: 100, mime: 'image/jpeg' } }))
    assert.equal(result.ok, false, check); assert.equal(failing.calls.created.length, 0)
  }
  const ok = world()
  assert.equal((await ok.server.submitFeedbackReport(report({ screenshot: { path: SHOT, size: 100, mime: 'image/jpeg' } }))).ok, true)
  assert.equal(ok.calls.created[0].context.screenshotPath, SHOT)
  assert.equal(ok.calls.audits[0].details.screenshot, true)
})

test('a stored screenshot that is incomplete is deleted; a mismatch was already deleted by the shared check', async () => {
  const removed = []
  const { checkFeedbackScreenshot } = loader({ '@supabase/supabase-js': { createClient: () => ({}) } })('utils/feedback-screenshots.ts')
  const bucket = { list: async () => ({ data: [{ name: 'a.jpg', metadata: { size: 5, mimetype: 'image/jpeg' } }], error: null }), createSignedUrl: async () => ({ data: { signedUrl: 'u' }, error: null }), remove: async p => { removed.push(...p); return { error: null } } }
  assert.equal(await checkFeedbackScreenshot(bucket, { path: 'reports/u/a.jpg', size: 99, mime: 'image/jpeg' }), 'incomplete')
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0])
  const fetchImpl = async () => new Response(png, { status: 206 })
  assert.equal(await checkFeedbackScreenshot(bucket, { path: 'reports/u/a.jpg', size: 5, mime: 'image/jpeg' }, fetchImpl), 'mismatch', 'PNG bytes declared as JPEG')
  assert.deepEqual(removed, ['reports/u/a.jpg', 'reports/u/a.jpg'])
  const jpeg = async () => new Response(new Uint8Array([255, 216, 255, 224, 0]), { status: 206 })
  assert.equal(await checkFeedbackScreenshot(bucket, { path: 'reports/u/a.jpg', size: 5, mime: 'image/jpeg' }, jpeg), 'ok')
})

test('screenshots are readable only by platform admins, through a short-lived signed URL, audited', async () => {
  const reports = { [OTHER]: { id: OTHER, kind: 'ISSUE', context: { path: '/', screenshotPath: SHOT } }, '00000000-0000-4000-8000-000000000003': { id: 'x', kind: 'SUPPORT', context: null } }
  await assert.rejects(world({ admin: false, reports }).server.getFeedbackScreenshot({ id: OTHER }), /administrator/)
  const w = world({ reports })
  const opened = await w.server.getFeedbackScreenshot({ id: OTHER })
  assert.equal(opened.ok, true); assert.deepEqual(opened.data, { url: 'https://storage.example/read' })
  assert.deepEqual(w.calls.signed, [[SHOT, 60]])
  assert.equal(w.calls.audits.at(-1).action, 'platform.report.screenshot.read')
  const none = await w.server.getFeedbackScreenshot({ id: '00000000-0000-4000-8000-000000000003' })
  assert.equal(none.ok, false); assert.match(none.error, /no screenshot/)
})

function adminServer(rows, admin = true) {
  let where
  const prisma = {
    platformReport: { findMany: async q => { where = q; return rows }, count: async () => 4, aggregate: async () => ({ _count: { _all: 7 }, _max: { updatedAt: new Date(1000) } }) },
    clubAnnouncement: { findMany: async () => [] }, auditLog: { create: async () => {} },
  }
  const server = loader({
    'next/cache': { revalidatePath() {}, revalidateTag() {} }, '@/utils/prisma': { prisma }, '@/utils/platform-admin': { requirePlatformAdmin: async () => { if (!admin) throw Error('Platform administrator access required'); return { id: 'admin' } } }, '@/utils/auth': { requireAuth: async () => ({}) },
    '@/actions/platform-organization-onboarding': {}, '@/actions/club-onboarding': {}, '@/actions/platform-admin': {}, '@/utils/club-onboarding': {}, '@/utils/email': {}, '@/utils/invitation-delivery': {}, '@/utils/invitation-background': {}, '@supabase/supabase-js': { createClient: () => ({}) },
  })('actions/admin-workspace.ts')
  return { server, where: () => where }
}

test('admin queue: Issues / Feedback filter, captured details without the storage path, admins only', async () => {
  const reporter = { id: USER, email: 'r@virginia.edu', studentProfile: null }
  const rows = [
    { id: 'r1', kind: 'ISSUE', targetId: '/home', summary: 'Broken button on home', status: 'OPEN', revision: 0, createdAt: new Date(), reporterId: USER, reporter, context: { path: '/home', userAgent: 'Chrome 131 on macOS (desktop)', viewport: '1440×900', appVersion: 'abc', screenshotPath: SHOT } },
    { id: 'r2', kind: 'CLUB', targetId: 'club-1', summary: 'Spam · Club profile', status: 'OPEN', revision: 0, createdAt: new Date(), reporterId: USER, reporter, context: null },
  ]
  const a = adminServer(rows)
  const listed = await a.server.listAdminReports({})
  assert.deepEqual(a.where().where.kind, { notIn: ['SUPPORT', 'ACCOUNT_DELETION'] }, 'All still lists every report kind')
  assert.deepEqual(listed[0].context, { path: '/home', userAgent: 'Chrome 131 on macOS (desktop)', viewport: '1440×900', appVersion: 'abc', hasScreenshot: true })
  assert.doesNotMatch(JSON.stringify(listed), /reports\//, 'no storage path reaches the browser')
  assert.equal(listed[1].context, null)
  await a.server.listAdminReports({ kind: 'ISSUE' }); assert.equal(a.where().where.kind, 'ISSUE')
  await a.server.listAdminReports({ kind: 'FEEDBACK' }); assert.equal(a.where().where.kind, 'FEEDBACK')
  await a.server.listAdminReports({ support: true, kind: 'ISSUE' }); assert.equal(a.where().where.kind, 'SUPPORT', 'support view is unchanged')
  await assert.rejects(a.server.listAdminReports({ kind: 'SUPPORT' }))
  assert.deepEqual(await a.server.getAdminReportsPulse(), { openFeedback: 4, fingerprint: '7:1000' })
  const denied = adminServer(rows, false)
  await assert.rejects(denied.server.listAdminReports({}), /administrator/)
  await assert.rejects(denied.server.getAdminReportsPulse(), /administrator/)
})

test('the live signal carries no report content and stays off until the owner enables it', async () => {
  assert.deepEqual(lib.adminReportsSignal(), { messages: [{ topic: 'platform-reports', event: 'reports', payload: {}, private: true }] })
  const sent = []
  const fetchImpl = async (url, init) => { sent.push({ url, body: JSON.parse(init.body) }); return { ok: true } }
  const env = process.env
  process.env = { ...env, NEXT_PUBLIC_SUPABASE_URL: 'https://p.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_x' }
  try {
    const { signalAdminReportsChanged } = loader({})('lib/admin-reports-signal.ts')
    assert.equal(await signalAdminReportsChanged(fetchImpl), false); assert.equal(sent.length, 0, 'off by default')
    process.env.NEXT_PUBLIC_ADMIN_REPORTS_REALTIME = '1'
    assert.equal(await signalAdminReportsChanged(fetchImpl), true)
    assert.equal(sent[0].url, 'https://p.supabase.co/realtime/v1/api/broadcast')
    assert.deepEqual(sent[0].body, lib.adminReportsSignal())
  } finally { process.env = env }
  // Both write paths signal after their transaction, and the client ignores the payload.
  assert.match(fs.readFileSync('actions/feedback-reports.ts', 'utf8'), /\}\)\n {2}await signalAdminReportsChanged\(\)/)
  assert.match(fs.readFileSync('actions/admin-workspace.ts', 'utf8'), /\}\)\.then\(async result => \{ await signalAdminReportsChanged\(\); return result; \}\);/)
  assert.match(fs.readFileSync('lib/admin-reports-live.ts', 'utf8'), /channel\.on\("broadcast", \{ event: ADMIN_REPORTS_EVENT \}, \(\) => signal\(\)\)/)
})

test('admin live helper: polls every 20 s only while visible and without a joined channel', () => {
  const { startAdminReportsLive } = loader({ '@/utils/supabase/client': {} })('lib/admin-reports-live.ts')
  const listeners = {}, doc = { visibilityState: 'visible', addEventListener: (k, f) => { listeners[k] = f }, removeEventListener: () => {} }
  let tick, period, cleared = false
  const win = { addEventListener: (k, f) => { listeners[k] = f }, removeEventListener: () => {}, setInterval: (f, ms) => { tick = f; period = ms; return 1 }, clearInterval: () => { cleared = true } }
  let checks = 0
  const stop = startAdminReportsLive({ check: () => checks++, doc, win })
  assert.equal(period, 20000); assert.equal(checks, 1, 'checks on start')
  tick(); assert.equal(checks, 2)
  doc.visibilityState = 'hidden'; tick(); assert.equal(checks, 2, 'hidden tabs do not poll')
  doc.visibilityState = 'visible'; listeners.visibilitychange(); assert.equal(checks, 3, 'catches up when visible')
  listeners.focus(); assert.equal(checks, 4)
  let handlers
  const live = startAdminReportsLive({ check: () => checks++, doc, win, openRealtime: h => { handlers = h; return { close() {} } } })
  const before = checks; handlers.ready(); assert.equal(checks, before + 1, 'joining re-checks once')
  tick(); assert.equal(checks, before + 1, 'no polling while the channel is joined')
  handlers.signal(); assert.equal(checks, before + 2)
  handlers.failed(); tick(); assert.equal(checks, before + 3, 'falls back to polling')
  stop(); live(); assert.ok(cleared)
})

test('entry point and admin UI: account menu item for live accounts only, dialog on demand, Kind filter and badge', () => {
  const shell = fs.readFileSync('components/shell/product-shell.tsx', 'utf8')
  assert.match(shell, /\{user && !demo\.isDemoEnabled && !isImpersonating && <DropdownMenuItem onSelect=\{\(\) => setFeedback\(true\)\}><MessageSquare \/>Report an issue or send feedback<\/DropdownMenuItem>\}/)
  assert.match(shell, /dynamic\(\(\) => import\("@\/components\/feedback\/feedback-dialog"\)/)
  assert.match(shell, /useAdminReportsBadge\(platform && allowed && !!user && !demo\.isDemoEnabled && !isImpersonating\)/)
  assert.match(shell, /open issue and feedback/)
  const dialog = fs.readFileSync('components/feedback/feedback-dialog.tsx', 'utf8')
  assert.match(dialog, /from "@\/components\/icons"/); assert.match(dialog, /from "@\/components\/ui\/dialog"/)
  assert.match(dialog, /window\.location\.pathname\}\$\{window\.location\.search\}/); assert.doesNotMatch(dialog, /location\.hash|location\.href/)
  assert.match(dialog, /We include this page, your browser and device, and the app version/)
  const admin = fs.readFileSync('components/admin/admin-reports.tsx', 'utf8')
  assert.match(admin, /label="Kind"/); assert.match(admin, /ADMIN_REPORTS_CHANGED_EVENT/); assert.match(admin, /unwrapAction\(await getFeedbackScreenshot\(\{ id: row\.id \}\)\)/)
})

test('privacy policy says feedback reports include page and device details and any attached screenshot', () => {
  const legal = loader({})('lib/legal-content.ts')
  const text = JSON.stringify(legal)
  assert.match(text, /Issue reports and feedback: when you report an issue or send feedback, your message is stored with the page you were on, your browser and device type, screen size, the app version and any screenshot you choose to attach\./)
})
