const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
function load(file, mocks = {}) {
  const m = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.resolve(file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', 'process', code)(name => name in mocks ? mocks[name] : require(name), m, m.exports, process)
  return m.exports
}
const s = load('lib/sentry-scrub.ts')
const read = file => fs.readFileSync(path.resolve(file), 'utf8')
const CANARIES = ['private-applicant-note', 'student@virginia.edu', 'sb-access-jwt', 'Bearer-secret', '203.0.113.9', 'invite-token-xyz', 'sharecode', 'vercel-host-42', 'tag-secret', 'frame-local-secret', 'mechanism-secret', 'console-secret', 'click-label-secret', '4f9c2e1a-0b2c-4d1e-8f00-123456789abc', 'resume-object-key']

function realisticEvent() {
  return {
    event_id: 'e1', timestamp: 1, platform: 'javascript', level: 'error', environment: 'production', release: 'r1', sdk: { name: 'sentry.javascript.nextjs' },
    server_name: 'vercel-host-42', tags: { route: 'tag-secret' }, contexts: { cookies: { sb: 'sb-access-jwt' }, nextjs: { request: 'private-applicant-note' } },
    extra: { note: 'private-applicant-note' }, modules: { x: '1' }, fingerprint: ['student@virginia.edu'],
    transaction: 'GET /invitations/invite-token-xyz',
    message: 'Failed for student@virginia.edu',
    request: { url: 'https://www.out-class.net/q/sharecode?token=invite-token-xyz#token_hash=1', method: 'POST', data: { notes: 'private-applicant-note' }, cookies: { sb: 'sb-access-jwt' }, query_string: 'token=invite-token-xyz', env: { REMOTE_ADDR: '203.0.113.9' }, headers: { cookie: 'sb=sb-access-jwt', authorization: 'Bearer-secret', 'user-agent': 'Safari', 'x-forwarded-for': '203.0.113.9' } },
    user: { id: 'acct-1', email: 'student@virginia.edu', ip_address: '203.0.113.9' },
    exception: { values: [{ type: 'PrismaClientKnownRequestError', value: 'Unique constraint on student@virginia.edu',
      mechanism: { type: 'onerror', handled: false, data: { detail: 'mechanism-secret' } },
      stacktrace: { frames: [{ filename: 'app/x.tsx', function: 'save', lineno: 3, colno: 4, in_app: true, vars: { note: 'frame-local-secret' }, pre_context: ['frame-local-secret'], context_line: 'const note = "frame-local-secret"' }] } }] },
    breadcrumbs: [
      { category: 'console', message: 'console-secret' },
      { category: 'ui.input', message: 'console-secret' },
      { category: 'ui.click', message: 'button[aria-label="click-label-secret"]', data: { label: 'click-label-secret' } },
      { category: 'fetch', type: 'http', data: { url: '/api/resumes/resume-object-key?sig=Bearer-secret', method: 'GET', status_code: 403, request_body: 'private-applicant-note' } },
      { category: 'navigation', data: { from: '/club/4f9c2e1a-0b2c-4d1e-8f00-123456789abc/workspace', to: '/q/sharecode' } },
      { category: 'http', data: { url: 'https://project.supabase.co/storage/v1/object/resume-object-key' } },
    ],
  }
}

test('a realistic event leaks none of the canary values anywhere', () => {
  const json = JSON.stringify(s.scrubEvent(realisticEvent()))
  for (const canary of CANARIES) assert.ok(!json.includes(canary), `leaked ${canary}: ${json}`)
})

test('what remains is enough to debug: type, redacted message, frames, route shape, browser, account ID', () => {
  const event = s.scrubEvent(realisticEvent())
  assert.equal(event.exception.values[0].type, 'PrismaClientKnownRequestError')
  assert.equal(event.exception.values[0].value, 'Unique constraint on [email]')
  assert.deepEqual(event.exception.values[0].mechanism, { type: 'onerror', handled: false })
  assert.deepEqual(event.exception.values[0].stacktrace.frames, [{ filename: 'app/x.tsx', function: 'save', module: undefined, lineno: 3, colno: 4, in_app: true }])
  assert.deepEqual(event.request, { url: 'https://www.out-class.net/q/[id]', headers: { 'user-agent': 'Safari' } })
  assert.equal(event.transaction, '/invitations/[id]')
  assert.deepEqual(event.user, { id: 'acct-1' })
  assert.deepEqual(event.breadcrumbs.map(c => c.category), ['ui.click', 'fetch', 'navigation'])
  assert.deepEqual(event.breadcrumbs[1].data, { url: '/api/resumes/[id]', method: 'GET', status_code: 403 })
  assert.deepEqual(event.breadcrumbs[2].data, { from: '/club/[id]/workspace', to: '/q/[id]' })
  for (const key of ['server_name', 'tags', 'contexts', 'extra', 'modules', 'fingerprint']) assert.equal(key in event, false, key)
  assert.equal(s.scrubEvent({ user: { email: 'a@b.co' } }).user, undefined)
})

test('route shapes keep static words and hide IDs, codes and tokens', () => {
  assert.equal(s.stripUrl('/applications/status'), '/applications/status')
  assert.equal(s.stripUrl('/voting/rooms/clx9abc123'), '/voting/rooms/[id]')
  assert.equal(s.stripUrl('/invitations/abcdef'), '/invitations/[id]', 'letters-only codes after token routes are hidden too')
  assert.equal(s.stripUrl('/check-in/abc'), '/check-in/[id]')
  assert.equal(s.stripUrl('/reset-password#token_hash=1'), '/reset-password')
  assert.equal(s.stripUrl(42), undefined)
  assert.equal(s.redactText(`opaque ${'a'.repeat(48)} end`), 'opaque [token] end')
  assert.equal(s.redactText('word '.repeat(400)).length, 1000)
})

test('reports are off without a DSN, errors only, never default PII; no server breadcrumbs', () => {
  const off = s.sentryOptions(undefined, undefined)
  assert.equal(off.enabled, false); assert.equal(off.environment, 'development')
  const on = s.sentryOptions('https://key@o1.ingest.sentry.io/1', 'production')
  assert.equal(on.enabled, true); assert.equal(on.sendDefaultPii, false); assert.equal(on.tracesSampleRate, 0)
  assert.equal(on.beforeSend, s.scrubEvent); assert.equal(on.beforeBreadcrumb, s.scrubBreadcrumb)
  assert.equal(on.beforeSendTransaction(), null)
  assert.equal(on.maxBreadcrumbs, 30)
  assert.equal(s.sentryOptions('dsn', 'production', 'server').maxBreadcrumbs, 0)
  for (const file of ['sentry.server.config.ts', 'sentry.edge.config.ts']) assert.match(read(file), /process\.env\.VERCEL_ENV, "server"\)\)/)
})

test('boundaries report client errors once: not without a DSN, not server errors that carry a digest', async () => {
  const captured = []
  const sdk = { captureException: error => captured.push(error) }
  // The helper uses a dynamic import; transpiled to CommonJS it becomes require via Promise.resolve.
  const report = load('lib/report-client-error.ts', { '@sentry/nextjs': sdk })
  delete process.env.NEXT_PUBLIC_SENTRY_DSN
  report.reportClientError(new Error('a'))
  process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://key@o1.ingest.sentry.io/1'
  try {
    const digest = Object.assign(new Error('server'), { digest: '123' })
    report.reportClientError(digest)
    const client = new Error('client')
    report.reportClientError(client)
    await new Promise(resolve => setTimeout(resolve, 20))
    assert.deepEqual(captured, [client])
  } finally { delete process.env.NEXT_PUBLIC_SENTRY_DSN }
})

test('no SDK is loaded or bundled unless a DSN is configured; no replay; every boundary reports', () => {
  const server = read('instrumentation.ts'), client = read('instrumentation-client.ts')
  assert.match(server, /if \(!dsn\(\)\) return\n  if \(process\.env\.NEXT_RUNTIME/)
  assert.match(server, /onRequestError[\s\S]*if \(!dsn\(\)\) return[\s\S]*import\("@sentry\/nextjs"\)/)
  assert.doesNotMatch(server, /^import \* as Sentry/m, 'no static SDK import on the server entry')
  assert.doesNotMatch(client, /^import .*@sentry/m, 'no static SDK import in the client bundle')
  assert.match(client, /if \(process\.env\.NEXT_PUBLIC_SENTRY_DSN\) \{\n  void import\("@sentry\/nextjs"\)/)
  for (const file of ['instrumentation-client.ts', 'sentry.server.config.ts', 'sentry.edge.config.ts', 'lib/sentry-scrub.ts']) {
    assert.doesNotMatch(read(file), /replayIntegration|Replay\(|feedbackIntegration/, `${file} adds no session replay or feedback widget`)
    if (file !== 'lib/sentry-scrub.ts') assert.match(read(file), /sentryOptions\(/, `${file} uses the shared scrubbed options`)
  }
  for (const file of ['app/error.tsx', 'app/(focus)/error.tsx', 'app/global-error.tsx']) assert.match(read(file), /useEffect\(\(\) => reportClientError\(error\), \[error\]\)/)
})
