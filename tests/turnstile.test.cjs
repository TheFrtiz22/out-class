const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
function load(file) {
  const m = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.resolve(file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', 'process', code)(require, m, m.exports, process)
  return m.exports
}
const t = load('lib/turnstile.ts')
const env = { NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site', TURNSTILE_SECRET_KEY: 'secret' }
const reply = (body, ok = true) => async () => ({ ok, json: async () => body })
const read = file => fs.readFileSync(path.resolve(file), 'utf8')

test('unconfigured deployments skip the check entirely', async () => {
  let called = false
  for (const partial of [{}, { NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site' }, { TURNSTILE_SECRET_KEY: 'secret' }]) {
    assert.deepEqual(await t.verifyTurnstile(undefined, { action: 'signup', env: partial, fetcher: async () => { called = true } }), { ok: true })
  }
  assert.equal(called, false)
})

test('configured: missing, oversized and non-string tokens fail before any network call', async () => {
  let called = false
  const fetcher = async () => { called = true }
  for (const token of [undefined, null, '', 42, 'x'.repeat(2049)]) {
    assert.deepEqual(await t.verifyTurnstile(token, { action: 'signup', env, fetcher }), { ok: false, reason: 'missing' })
  }
  assert.equal(called, false)
})

test('configured: only a successful token for the same action passes', async () => {
  let sent
  const ok = await t.verifyTurnstile('tok', { action: 'signup', remoteIp: '1.2.3.4', env, fetcher: async (url, init) => { sent = { url, body: init.body }; return { ok: true, json: async () => ({ success: true, action: 'signup' }) } } })
  assert.deepEqual(ok, { ok: true })
  assert.equal(sent.url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify')
  assert.equal(sent.body.get('secret'), 'secret')
  assert.equal(sent.body.get('response'), 'tok')
  assert.equal(sent.body.get('remoteip'), '1.2.3.4')
  assert.deepEqual(await t.verifyTurnstile('tok', { action: 'signup', env, fetcher: reply({ success: true, action: 'school-request' }) }), { ok: false, reason: 'rejected' })
  assert.deepEqual(await t.verifyTurnstile('tok', { action: 'signup', env, fetcher: reply({ success: false, 'error-codes': ['timeout-or-duplicate'] }) }), { ok: false, reason: 'rejected' })
  assert.deepEqual(await t.verifyTurnstile('tok', { action: 'signup', env, fetcher: reply({ success: 'true', action: 'signup' }) }), { ok: false, reason: 'rejected' })
})

test('configured: Cloudflare outages fail closed as unavailable', async () => {
  assert.deepEqual(await t.verifyTurnstile('tok', { action: 'signup', env, fetcher: reply({}, false) }), { ok: false, reason: 'unavailable' })
  assert.deepEqual(await t.verifyTurnstile('tok', { action: 'signup', env, fetcher: async () => { throw new Error('down') } }), { ok: false, reason: 'unavailable' })
  assert.deepEqual(await t.verifyTurnstile('tok', { action: 'signup', env, fetcher: async () => ({ ok: true, json: async () => { throw new Error('bad json') } }) }), { ok: false, reason: 'unavailable' })
  assert.match(t.turnstileMessage('unavailable'), /temporarily unavailable/)
  assert.match(t.turnstileMessage('rejected'), /security check/)
})

test('remote IP uses the first forwarded hop only', () => {
  assert.equal(t.turnstileRemoteIp('9.9.9.9, 10.0.0.1'), '9.9.9.9')
  assert.equal(t.turnstileRemoteIp(null), undefined)
  assert.equal(t.turnstileRemoteIp(' '), undefined)
  assert.equal(t.turnstileRemoteIp('x'.repeat(65)), undefined)
})

test('every public email-sending or record-creating form checks its own action before side effects', () => {
  const signup = read('actions/onboarding.ts')
  assert.ok(signup.indexOf('action: "signup"') > 0 && signup.indexOf('action: "signup"') < signup.indexOf('/auth/v1/settings'), 'signup verifies before contacting Supabase')
  const recovery = read('app/api/auth/password-recovery/route.ts')
  assert.ok(recovery.indexOf('action: "password-recovery"') < recovery.indexOf('resetPasswordForEmail'), 'recovery verifies before sending email')
  assert.ok(recovery.indexOf('action: "password-recovery"') > recovery.indexOf('input.action === "request" && email.success'), 'reset-link submissions are not challenged')
  const school = read('app/api/school-requests/route.ts')
  assert.ok(school.indexOf('action: "school-request"') < school.indexOf('schoolRequest.create'), 'school requests verify before storage')
  assert.match(school, /const \{ turnstileToken: token, \.\.\.fields \} = body/, 'the token is stripped before the strict schema and never persisted')
  for (const [file, action] of [['components/views/student-onboarding-wizard.tsx', 'signup'], ['components/password-recovery.tsx', 'password-recovery'], ['components/settings/account-settings.tsx', 'password-recovery'], ['components/landing/school-request-form.tsx', 'school-request']]) {
    const source = read(file)
    assert.match(source, new RegExp(`<TurnstileWidget[^>]*action="${action}"`), `${file} renders the ${action} widget`)
    assert.match(source, /setTurnstileReset\(/, `${file} refreshes single-use tokens after submitting`)
  }
})

test('configured signup stops before Supabase when the token is missing, reused or for another form', async () => {
  const loadWith = (file, mocks) => {
    const m = { exports: {} }
    const code = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
    new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), m, m.exports)
    return m.exports
  }
  Object.assign(process.env, env)
  const originalFetch = global.fetch, urls = []
  let verdict = { success: false }, signups = 0
  global.fetch = async url => { urls.push(String(url)); return String(url).includes('siteverify') ? { ok: true, json: async () => verdict } : { ok: true, json: async () => ({ mailer_autoconfirm: false, external: { email: true } }) } }
  const { registerStudent } = loadWith('actions/onboarding.ts', {
    'next/headers': { cookies: async () => ({ has: () => false }), headers: async () => new Headers({ 'x-forwarded-for': '9.9.9.9' }) },
    '@/lib/platform-view-as': { PLATFORM_VIEW_COOKIE: 'outclass-platform-view' },
    '@/lib/onboarding-schemas': loadWith('lib/onboarding-schemas.ts', { '@/lib/student-profile': { gpaSchema: require('zod').z.string(), linkedinUrlSchema: require('zod').z.string() } }),
    '@/lib/auth-email': { authEmailError: () => 'email error' },
    '@/lib/turnstile': loadWith('lib/turnstile.ts', {}),
    '@/utils/supabase/server': { createClient: async () => ({ auth: { signUp: async () => { signups++; return { data: { user: { id: 'u', identities: [{}] }, session: null }, error: null } }, signOut: async () => {} } }) },
  })
  const account = { firstName: 'Test', lastName: 'Student', email: 'test@virginia.edu', password: 'a-valid-password' }
  try {
    for (const token of [undefined, true, 'reused']) {
      assert.match((await registerStudent(account, token)).error, /security check/)
    }
    verdict = { success: true, action: 'school-request' }
    assert.match((await registerStudent(account, 'other-form')).error, /security check/)
    assert.equal(signups, 0)
    assert.ok(urls.every(url => url.includes('siteverify')), 'Supabase is never contacted')
    verdict = { success: true, action: 'signup' }
    assert.deepEqual(await registerStudent(account, 'good'), { authenticated: false })
    assert.equal(signups, 1)
  } finally {
    global.fetch = originalFetch
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY; delete process.env.TURNSTILE_SECRET_KEY
  }
})
