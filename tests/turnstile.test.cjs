const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
function load(file) {
  const m = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.resolve(file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', 'process', code)(require, m, m.exports, process)
  return m.exports
}
const t = load('lib/turnstile.ts')
const env = { NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site', TURNSTILE_SECRET_KEY: 'secret' }
const reply = (body, ok = true) => async () => ({ ok, status: ok ? 200 : 503, json: async () => body })
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
  assert.match(t.turnstileMessage('rejected'), /expired\. Please submit again/)
})

test('remote IP uses the first forwarded hop only', () => {
  assert.equal(t.turnstileRemoteIp('9.9.9.9, 10.0.0.1'), '9.9.9.9')
  assert.equal(t.turnstileRemoteIp(null), undefined)
  assert.equal(t.turnstileRemoteIp(' '), undefined)
  assert.equal(t.turnstileRemoteIp('x'.repeat(65)), undefined)
})

test('a wrong or missing secret is an operator problem, not a bot: unavailable, and logged without the token', async () => {
  const warnings = [], warn = console.warn
  console.warn = (...args) => warnings.push(JSON.stringify(args))
  try {
    for (const code of ['invalid-input-secret', 'missing-input-secret', 'internal-error']) {
      assert.deepEqual(await t.verifyTurnstile('tok-secret-value', { action: 'school-request', env, fetcher: reply({ success: false, 'error-codes': [code] }) }), { ok: false, reason: 'unavailable' })
    }
    assert.deepEqual(await t.verifyTurnstile('tok-secret-value', { action: 'school-request', env, fetcher: reply({ success: false, 'error-codes': ['invalid-input-response'] }) }), { ok: false, reason: 'rejected' })
    assert.equal(warnings.length, 3)
    assert.ok(warnings.every(line => !line.includes('tok-secret-value')), 'the token is never logged')
  } finally { console.warn = warn }
})

test('Supabase captcha helpers: only well-formed tokens are passed, and captcha failures are recognised', () => {
  assert.deepEqual(t.withCaptcha({ email: 'a', options: { shouldCreateUser: false } }, 'tok'), { email: 'a', options: { shouldCreateUser: false, captchaToken: 'tok' } })
  const params = { email: 'a', password: 'p' }
  assert.equal(t.withCaptcha(params, null), params, 'requests are unchanged without a token')
  assert.deepEqual(t.captchaOption('tok'), { captchaToken: 'tok' })
  for (const bad of [undefined, null, '', true, 'x'.repeat(2049)]) assert.deepEqual(t.captchaOption(bad), {})
  assert.equal(t.captchaFailed({ code: 'captcha_failed', message: 'captcha protection: request disallowed (no captcha response)' }), true)
  assert.equal(t.captchaFailed({ message: 'captcha verification process failed' }), true)
  assert.equal(t.captchaFailed({ code: 'invalid_credentials', message: 'Invalid login credentials' }), false)
  assert.equal(t.captchaFailed(null), false)
})

function loadWith(file, mocks) {
  const m = { exports: {} }
  const code = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), m, m.exports)
  return m.exports
}

test('signup hands the token to Supabase Auth and reports a failed check without revealing anything else', async () => {
  const originalFetch = global.fetch, calls = []
  let result = { data: { user: { id: 'u', identities: [{}] }, session: null }, error: null }
  global.fetch = async () => ({ ok: true, json: async () => ({ mailer_autoconfirm: false, external: { email: true } }) })
  const { registerStudent } = loadWith('actions/onboarding.ts', {
    'next/headers': { cookies: async () => ({ has: () => false }) },
    '@/lib/platform-view-as': { PLATFORM_VIEW_COOKIE: 'outclass-platform-view' },
    '@/lib/onboarding-schemas': loadWith('lib/onboarding-schemas.ts', { '@/lib/student-profile': { gpaSchema: require('zod').z.string(), linkedinUrlSchema: require('zod').z.string() } }),
    '@/lib/auth-email': { authEmailError: () => 'email error' },
    '@/lib/turnstile': t,
    '@/utils/supabase/server': { createClient: async () => ({ auth: { signUp: async input => { calls.push(input); return result }, signOut: async () => {} } }) },
  })
  const account = { firstName: 'Test', lastName: 'Student', email: 'test@virginia.edu', password: 'a-valid-password' }
  try {
    assert.deepEqual(await registerStudent(account, 'tok'), { authenticated: false })
    assert.equal(calls[0].options.captchaToken, 'tok')
    assert.deepEqual(calls[0].options.data, { first_name: 'Test', last_name: 'Student' })
    await registerStudent(account, true)
    assert.equal('captchaToken' in calls[1].options, false, 'obsolete boolean arguments never become a token')
    result = { data: { user: null, session: null }, error: { code: 'captcha_failed', status: 400, message: 'captcha protection: request disallowed' } }
    assert.deepEqual(await registerStudent(account, 'spent'), { error: t.turnstileMessage('rejected') })
  } finally { global.fetch = originalFetch }
})

test('every Supabase Auth call that sends email or checks a password carries the token', () => {
  const expectations = [
    ['actions/onboarding.ts', /auth\.signUp\(withCaptcha\(\{[\s\S]{0,200}\}, turnstileToken\)\)/],
    ['app/api/auth/password-recovery/route.ts', /resetPasswordForEmail\(email\.data, \{[\s\S]{0,120}captchaOption\(input\.turnstileToken\)/],
    ['components/views/auth-view.tsx', /signInWithPassword\(withCaptcha\([\s\S]{0,160}, turnstileToken\)\)/],
    ['components/views/auth-view.tsx', /signInWithOtp\(withCaptcha\([\s\S]{0,160}, turnstileToken\)\)/],
    ['components/views/student-onboarding-wizard.tsx', /auth\.resend\(withCaptcha\([\s\S]{0,160}, turnstileToken\)\)/],
    ['app/api/platform/elevation/route.ts', /signInWithPassword\(withCaptcha\([\s\S]{0,160}, input\.turnstileToken\)\)/],
  ]
  for (const [file, pattern] of expectations) assert.match(read(file), pattern, file)
  // Any new direct Auth call must be added above.
  const callers = ['actions', 'app', 'components', 'lib', 'utils', 'contexts', 'hooks'].flatMap(function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : /\.tsx?$/.test(entry.name) ? [path.join(dir, entry.name)] : [])
  }).filter(file => /auth\.(signUp|signInWithPassword|signInWithOtp|resetPasswordForEmail|resend|signInAnonymously)\(/.test(read(file)))
  assert.deepEqual(callers.sort(), ['actions/onboarding.ts', 'app/api/auth/password-recovery/route.ts', 'app/api/platform/elevation/route.ts', 'components/views/auth-view.tsx', 'components/views/student-onboarding-wizard.tsx'])
  const recovery = read('app/api/auth/password-recovery/route.ts')
  assert.ok(recovery.indexOf('captchaFailed(error)') > recovery.indexOf('resetPasswordForEmail'), 'a failed check is reported; other provider errors keep the uniform response')
})

test('school requests verify with siteverify before storage; the token is stripped and never persisted', () => {
  const school = read('app/api/school-requests/route.ts')
  assert.ok(school.indexOf('action: "school-request"') < school.indexOf('schoolRequest.create'))
  assert.match(school, /const \{ turnstileToken: token, \.\.\.fields \} = body/)
})

test('every form renders its widget, refreshes single-use tokens after each submission, and waits for a token', () => {
  for (const [file, action] of [['components/views/student-onboarding-wizard.tsx', 'signup'], ['components/views/auth-view.tsx', 'login'], ['components/password-recovery.tsx', 'password-recovery'], ['components/settings/account-settings.tsx', 'password-recovery'], ['components/landing/school-request-form.tsx', 'school-request'], ['app/(focus)/platform/login/page.tsx', 'admin']]) {
    const source = read(file)
    assert.match(source, new RegExp(`<TurnstileWidget[^>]*action="${action}"`), `${file} renders the ${action} widget`)
    assert.match(source, /setTurnstileReset\(/, `${file} refreshes tokens`)
    assert.match(source, /turnstileRequired && !turnstileToken/, `${file} waits for a token`)
  }
  const widget = read('components/security/turnstile-widget.tsx')
  assert.match(widget, /"error-callback": \(\) => \{ callback\.current\(null\); setFailed\(true\) \}/, 'widget errors are shown')
  assert.match(widget, /role="alert"[\s\S]*try again/, 'a blocked script offers a retry instead of a dead end')
  assert.match(widget, /cancelled = true\n      \/\/ A token[^\n]*\n      callback\.current\(null\)/, 'unmounting forgets a possibly spent token')
})
