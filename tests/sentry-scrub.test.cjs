const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
function load(file) {
  const m = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.resolve(file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(require, m, m.exports)
  return m.exports
}
const s = load('lib/sentry-scrub.ts')
const read = file => fs.readFileSync(path.resolve(file), 'utf8')

test('request data, cookies, headers, query strings and IPs never leave', () => {
  const event = s.scrubEvent({
    request: {
      url: 'https://www.out-class.net/invitations/accept?token=secret-invite#token_hash=abc',
      data: { notes: 'private applicant note', password: 'pw' }, cookies: { 'sb-access-token': 'jwt' },
      query_string: 'token=secret-invite', env: { REMOTE_ADDR: '1.2.3.4' },
      headers: { cookie: 'sb=1', authorization: 'Bearer x', 'user-agent': 'Safari', 'x-forwarded-for': '1.2.3.4' },
    },
    user: { id: 'acct-1', email: 'student@virginia.edu', ip_address: '1.2.3.4', username: 'Student' },
    extra: { applicant: { name: 'Student' } },
  })
  assert.deepEqual(event.request, { url: 'https://www.out-class.net/invitations/accept', headers: { 'user-agent': 'Safari' } })
  assert.deepEqual(event.user, { id: 'acct-1' })
  assert.equal(event.extra, undefined)
  assert.deepEqual(s.scrubEvent({ user: { email: 'a@b.co' } }).user, undefined)
})

test('emails and tokens are redacted from messages and exception text', () => {
  const event = s.scrubEvent({
    message: 'Failed for jane.doe@virginia.edu',
    exception: { values: [{ value: 'Invalid JWT eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc_DEF-123 for x@y.org' }, { value: `opaque ${'a'.repeat(48)} end` }, {}] },
  })
  assert.equal(event.message, 'Failed for [email]')
  assert.equal(event.exception.values[0].value, 'Invalid JWT [token] for [email]')
  assert.equal(event.exception.values[1].value, 'opaque [token] end')
  assert.equal(s.redactText('Club 4f9c2e1a-0b2c-4d1e-8f00-123456789abc failed'), 'Club 4f9c2e1a-0b2c-4d1e-8f00-123456789abc failed', 'UUIDs stay for debugging')
})

test('console and typed-input breadcrumbs are dropped; navigation and fetch keep path, method and status only', () => {
  assert.equal(s.scrubBreadcrumb({ category: 'console', message: 'applicant: jane@virginia.edu' }), null)
  assert.equal(s.scrubBreadcrumb({ category: 'ui.input', message: 'input[name=password]' }), null)
  assert.deepEqual(s.scrubBreadcrumb({ category: 'fetch', data: { url: '/api/resumes?id=1&sig=abc', method: 'GET', status_code: 403, response_body: 'x', request_body: '{}' } }),
    { category: 'fetch', data: { url: '/api/resumes', method: 'GET', status_code: 403 } })
  assert.deepEqual(s.scrubBreadcrumb({ category: 'navigation', data: { from: '/reset-password#token_hash=1', to: '/s/abc?ref=x' } }),
    { category: 'navigation', data: { from: '/reset-password', to: '/s/abc' } })
  const event = s.scrubEvent({ breadcrumbs: [{ category: 'console' }, { category: 'ui.click', message: 'button.oc-save' }] })
  assert.deepEqual(event.breadcrumbs, [{ category: 'ui.click', message: 'button.oc-save' }])
})

test('reports are off without a DSN, errors only, never default PII', () => {
  const off = s.sentryOptions(undefined, undefined)
  assert.equal(off.enabled, false)
  assert.equal(off.environment, 'development')
  const on = s.sentryOptions('https://key@o1.ingest.sentry.io/1', 'production')
  assert.equal(on.enabled, true)
  assert.equal(on.sendDefaultPii, false)
  assert.equal(on.tracesSampleRate, 0)
  assert.equal(on.beforeSend, s.scrubEvent)
  assert.equal(on.beforeBreadcrumb, s.scrubBreadcrumb)
})

test('no SDK is loaded or bundled unless a DSN is configured; no replay; boundaries report', () => {
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
  for (const file of ['app/error.tsx', 'app/(focus)/error.tsx']) assert.match(read(file), /useEffect\(\(\) => reportClientError\(error\), \[error\]\)/)
})
