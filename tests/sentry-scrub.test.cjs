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
    server_name: 'vercel-host-42', tags: { route: 'tag-secret' }, contexts: { cookies: { sb: 'sb-access-jwt' }, nextjs: { request: 'private-applicant-note' }, trace: { trace_id: 'a'.repeat(32), span_id: 'b'.repeat(16), data: { 'http.url': '/q/sharecode' }, op: 'tag-secret' } },
    sdkProcessingMetadata: { capturedSpanScope: { note: 'private-applicant-note' }, normalizedRequest: { cookies: { sb: 'sb-access-jwt' } }, dynamicSamplingContext: { trace_id: 'a'.repeat(32), public_key: 'pk', sample_rate: '0.1', sampled: 'true', environment: 'production', release: 'r1', transaction: 'GET /invitations/invite-token-xyz', user_segment: 'student@virginia.edu', replay_id: 'tag-secret' } },
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
  assert.deepEqual(event.contexts, { trace: { trace_id: 'a'.repeat(32), span_id: 'b'.repeat(16) } }, 'errors link to their timed request, nothing more')
  assert.deepEqual(event.sdkProcessingMetadata, { dynamicSamplingContext: { trace_id: 'a'.repeat(32), public_key: 'pk', sample_rate: '0.1', sampled: 'true', environment: 'production', release: 'r1', transaction: 'GET /invitations/[id]' } })
  for (const key of ['server_name', 'tags', 'extra', 'modules', 'fingerprint']) assert.equal(key in event, false, key)
  assert.equal(s.scrubEvent({ contexts: { trace: { trace_id: 'not-hex-student@virginia.edu' } } }).contexts, undefined)
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

test('reports are off without a DSN, never default PII; timings sampled in production only; no server breadcrumbs', () => {
  const off = s.sentryOptions(undefined, undefined)
  assert.equal(off.enabled, false); assert.equal(off.environment, 'development'); assert.equal(off.tracesSampleRate, 0)
  const on = s.sentryOptions('https://key@o1.ingest.sentry.io/1', 'production')
  assert.equal(on.enabled, true); assert.equal(on.sendDefaultPii, false)
  assert.equal(on.tracesSampleRate, 0.1); assert.ok(on.tracesSampleRate > 0 && on.tracesSampleRate <= 0.25, 'sampled, not every request')
  for (const env of ['preview', 'development', undefined]) assert.equal(s.sentryOptions('dsn', env).tracesSampleRate, 0, `no timings from ${env}`)
  assert.equal(on.beforeSend, s.scrubEvent); assert.equal(on.beforeBreadcrumb, s.scrubBreadcrumb)
  assert.equal(on.beforeSendTransaction, s.scrubTransaction)
  assert.equal(on.maxBreadcrumbs, 30); assert.equal('tracePropagationTargets' in on, false, 'browser keeps the same-origin default')
  const server = s.sentryOptions('dsn', 'production', 'server')
  assert.equal(server.maxBreadcrumbs, 0)
  assert.deepEqual(server.tracePropagationTargets, [], 'no trace headers on calls to Supabase, Storage or email providers')
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
  assert.match(client, /if \(process\.env\.NEXT_PUBLIC_SENTRY_DSN\) \{\n  void Promise\.all\(\[import\("@sentry\/nextjs"\), import\("@\/lib\/sentry-scrub"\)\]\)/)
  assert.match(client, /export function onRouterTransitionStart\(href: string, navigationType: string\) \{\n  sdk\?\.captureRouterTransitionStart\(href, navigationType\)/, 'navigation timing waits for the lazily loaded SDK')
  assert.doesNotMatch(client, /^import /m, "the privacy filter is not in the initial bundle either")
  for (const file of ['instrumentation-client.ts', 'sentry.server.config.ts', 'sentry.edge.config.ts', 'lib/sentry-scrub.ts']) {
    assert.doesNotMatch(read(file), /replayIntegration|Replay\(|feedbackIntegration/, `${file} adds no session replay or feedback widget`)
    if (file !== 'lib/sentry-scrub.ts') assert.match(read(file), /sentryOptions\(/, `${file} uses the shared scrubbed options`)
  }
  for (const file of ['app/error.tsx', 'app/(focus)/error.tsx', 'app/(workspace)/platform/error.tsx', 'app/global-error.tsx']) assert.match(read(file), /useEffect\(\(\) => reportClientError\(error\), \[error\]\)/)
})

function realisticTransaction() {
  return {
    type: 'transaction', event_id: 't1', timestamp: 2, start_timestamp: 1, platform: 'javascript', environment: 'production', release: 'r1', sdk: { name: 'sentry.javascript.nextjs' },
    transaction: 'GET /invitations/invite-token-xyz', transaction_info: { source: 'url' },
    server_name: 'vercel-host-42', tags: { route: 'tag-secret' }, extra: { note: 'private-applicant-note' },
    user: { id: 'acct-1', email: 'student@virginia.edu', ip_address: '203.0.113.9' },
    request: { url: 'https://www.out-class.net/q/sharecode?token=invite-token-xyz', headers: { cookie: 'sb=sb-access-jwt', 'user-agent': 'Safari' }, data: 'private-applicant-note' },
    breadcrumbs: [{ category: 'console', message: 'console-secret' }],
    contexts: {
      trace: { trace_id: 'a'.repeat(32), span_id: 'b'.repeat(16), op: 'http.server', status: 'ok', data: { 'sentry.sample_rate': 0.1, 'sentry.source': 'route', 'http.url': 'https://www.out-class.net/q/sharecode', 'http.request.header.cookie': 'sb-access-jwt' } },
      cookies: { sb: 'sb-access-jwt' }, nextjs: { request: 'private-applicant-note' },
    },
    measurements: { lcp: { value: 1830, unit: 'millisecond' }, 'ttfb.requestTime': { value: 40, unit: 'millisecond' }, 'student@virginia.edu': { value: 1 }, cls: { value: 'frame-local-secret' } },
    sdkProcessingMetadata: { capturedSpanScope: { note: 'private-applicant-note' }, dynamicSamplingContext: { trace_id: 'a'.repeat(32), sample_rate: '0.1', sampled: 'true', transaction: '/check-in/sharecode', user_segment: 'tag-secret' } },
    spans: [
      { span_id: 'c'.repeat(16), parent_span_id: 'b'.repeat(16), trace_id: 'a'.repeat(32), op: 'db', description: "SELECT * FROM \"Note\" WHERE body = 'private-applicant-note'", start_timestamp: 1, timestamp: 1.1, data: { 'db.statement': 'private-applicant-note' } },
      { span_id: 'd'.repeat(16), op: 'http.client', description: 'GET https://project.supabase.co/storage/v1/object/resume-object-key?token=Bearer-secret', data: { url: 'https://project.supabase.co/storage/v1/object/resume-object-key' } },
      { span_id: 'e'.repeat(16), op: 'function.nextjs', description: 'render route (app) /club/4f9c2e1a-0b2c-4d1e-8f00-123456789abc/workspace' },
      { span_id: 'f'.repeat(16), op: 'ui.long-task', description: 'Main UI thread blocked by student@virginia.edu' },
      { span_id: '1'.repeat(16), op: 'resource.script', description: '/_next/static/chunks/app/page-abc.js', data: { 'element': 'click-label-secret' } },
    ],
  }
}

test('a realistic performance event leaks none of the canary values anywhere', () => {
  const json = JSON.stringify(s.scrubTransaction(realisticTransaction()))
  for (const canary of CANARIES) assert.ok(!json.includes(canary), `leaked ${canary}: ${json}`)
})

test('performance events keep what is needed to find slow routes: timings, operations, route shapes, web vitals', () => {
  const event = s.scrubTransaction(realisticTransaction())
  assert.equal(event.type, 'transaction', 'Sentry drops events without the type')
  assert.equal(event.transaction, 'GET /invitations/[id]')
  assert.deepEqual([event.start_timestamp, event.timestamp], [1, 2])
  assert.deepEqual(event.contexts, { trace: { trace_id: 'a'.repeat(32), span_id: 'b'.repeat(16), parent_span_id: undefined, op: 'http.server', description: undefined, status: 'ok', origin: undefined, start_timestamp: undefined, timestamp: undefined, data: { 'sentry.sample_rate': 0.1, 'sentry.source': 'route' } } })
  assert.deepEqual(event.sdkProcessingMetadata, { dynamicSamplingContext: { trace_id: 'a'.repeat(32), sample_rate: '0.1', sampled: 'true', transaction: '/check-in/[id]' } }, 'the trace header keeps the sample rate so Sentry scales counts')
  assert.deepEqual(event.measurements, { lcp: { value: 1830, unit: 'millisecond' }, 'ttfb.requestTime': { value: 40, unit: 'millisecond' } })
  assert.deepEqual(event.request, { url: 'https://www.out-class.net/q/[id]', headers: { 'user-agent': 'Safari' } })
  const [db, http, render, longTask, resource] = event.spans
  assert.deepEqual([db.op, db.description, db.start_timestamp, db.timestamp, db.parent_span_id], ['db', undefined, 1, 1.1, 'b'.repeat(16)], 'SQL is never kept; timing is')
  assert.equal(http.description, 'GET https://project.supabase.co/storage/[id]')
  assert.equal(render.description, 'render route (app) /club/[id]/workspace')
  assert.equal(longTask.description, undefined, 'UI spans keep timing only')
  assert.equal(resource.description, '/[id]/static/chunks/app/[id]')
  for (const value of event.spans) assert.equal('data' in value, false)
  for (const key of ['user', 'tags', 'extra', 'breadcrumbs', 'server_name']) assert.equal(key in event, false, key)
})

test('span names: only request, route and asset spans keep names, and only plain words survive', () => {
  for (const op of ['db', 'db.query', 'prisma:engine:db_query', 'cache.get', 'redis', 'ui.click', 'function', 'custom', undefined]) assert.equal(s.describeSpan(op, 'SELECT note'), undefined, op)
  assert.equal(s.describeSpan('http.client', 'POST /api/applications/submit'), 'POST /api/applications/[id]')
  assert.equal(s.describeSpan('function.nextjs', "save note 'hello' 42"), 'save note [id] [id]')
  assert.equal(s.describeSpan('function.nextjs', 'a b c d e f g h i j'), 'a b c d e f g h', 'eight words at most')
  assert.equal(s.describeSpan('function.nextjs', undefined), undefined)
  assert.equal(s.describeSpan('http.client', 'GET https://user:Bearer-secret@h.co/x/y'), 'GET https://h.co/x/[id]', 'credentials in URLs never kept')
  assert.equal(s.describeSpan('http.client', 'GET https://project.supabase.co/rest/v1/OrganizationMember?userId=eq.1'), 'GET https://project.supabase.co/rest/[id]')
  assert.equal(s.describeSpan('http.client', 'POST https://api.resend.com/emails'), 'POST https://api.resend.com/emails')
  assert.equal(s.describeSpan('http.client', 'GET https://example.org'), 'GET https://example.org')
})

test('source maps are uploaded to Sentry only on Vercel with a token, then deleted; the build fails if any are public', () => {
  const config = read('next.config.mjs'), pkg = JSON.parse(read('package.json'))
  assert.doesNotMatch(config, /^import .*@sentry/m, 'builds without a token never load the Sentry build plugin')
  assert.match(config, /const uploadSourceMaps = Boolean\(process\.env\.SENTRY_AUTH_TOKEN\) && process\.env\.VERCEL === "1"/)
  assert.match(config, /uploadSourceMaps\n  \? \(await import\("@sentry\/nextjs\/config"\)\)\.withSentryConfig\(nextConfig, \{/)
  assert.match(config, /: nextConfig\n$/)
  assert.match(config, /sourcemaps: \{ deleteSourcemapsAfterUpload: true \}/)
  assert.doesNotMatch(config, /productionBrowserSourceMaps:\s*true/)
  for (const flag of ['autoInstrumentServerFunctions', 'autoInstrumentMiddleware', 'autoInstrumentAppDirectory']) assert.match(config, new RegExp(`${flag}: false`), `${flag} stays off: no build-time wrapping of server code`)
  assert.match(pkg.scripts.build, /^next build && node scripts\/check-no-public-sourcemaps\.cjs$/)
})

test('the public source map check finds map files and sourceMappingURL comments, and passes a clean build', () => {
  const os = require('node:os')
  const { findPublicSourceMaps } = require(path.resolve('scripts/check-no-public-sourcemaps.cjs'))
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-maps-'))
  fs.mkdirSync(path.join(dir, 'chunks/app'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'chunks/app/page.js'), 'console.log(1)\n')
  fs.writeFileSync(path.join(dir, 'chunks/inline.js'), 'x\n//# sourceMappingURL=data:application/json;base64,e30=')
  assert.deepEqual(findPublicSourceMaps(dir), { missing: false, problems: [] })
  fs.writeFileSync(path.join(dir, 'chunks/app/page.js.map'), '{}')
  fs.writeFileSync(path.join(dir, 'chunks/main.js'), 'x\n//# sourceMappingURL=main.js.map')
  fs.writeFileSync(path.join(dir, 'chunks/app.css'), 'a{}\n/*# sourceMappingURL=app.css.map */')
  assert.equal(findPublicSourceMaps(dir).problems.length, 3)
  assert.equal(findPublicSourceMaps(path.join(dir, 'nope')).missing, true)
  fs.rmSync(dir, { recursive: true, force: true })
})
