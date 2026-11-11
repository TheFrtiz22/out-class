const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
function load(file) {
  const m = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.resolve(file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', 'process', code)(require, m, m.exports, process)
  return m.exports
}
const t = load('lib/turnstile.ts')
const env = { TURNSTILE_ENABLED: '1', NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site', TURNSTILE_SECRET_KEY: 'secret' }
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
    ['actions/onboarding.ts', /auth\.signUp\(\{[\s\S]{0,200}\.\.\.check\.captcha \}/],
    ['app/api/auth/password-recovery/route.ts', /resetPasswordForEmail\(email\.data, \{[\s\S]{0,120}\.\.\.captcha,/],
    ['components/views/auth-view.tsx', /signInWithPassword\(withCaptcha\([\s\S]{0,160}, turnstileToken\)\)/],
    ['components/views/auth-view.tsx', /signInWithOtp\(withCaptcha\([\s\S]{0,160}, turnstileToken\)\)/],
    ['components/views/student-onboarding-wizard.tsx', /auth\.resend\(withCaptcha\([\s\S]{0,160}, turnstileToken\)\)/],
    ['app/api/platform/elevation/route.ts', /signInWithPassword\(withCaptcha\([\s\S]{0,160}, input\.turnstileToken\)\)/],
    ['app/api/auth/two-step/route.ts', /signInWithPassword\(withCaptcha\([\s\S]{0,160}, turnstileToken\)\)/],
  ]
  for (const [file, pattern] of expectations) assert.match(read(file), pattern, file)
  // Any new direct Auth call must be added above.
  const callers = ['actions', 'app', 'components', 'lib', 'utils', 'contexts', 'hooks'].flatMap(function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : /\.tsx?$/.test(entry.name) ? [path.join(dir, entry.name)] : [])
  }).filter(file => /auth\.(signUp|signInWithPassword|signInWithOtp|resetPasswordForEmail|resend|signInAnonymously)\(/.test(read(file)))
  assert.deepEqual(callers.sort(), ['actions/onboarding.ts', 'app/api/auth/password-recovery/route.ts', 'app/api/auth/two-step/route.ts', 'app/api/platform/elevation/route.ts', 'components/views/auth-view.tsx', 'components/views/student-onboarding-wizard.tsx'])
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

test('Siteverify that hangs past the 2–3 s budget fails closed as unavailable', async () => {
  assert.ok(t.TURNSTILE_TIMEOUT_MS >= 2000 && t.TURNSTILE_TIMEOUT_MS <= 3000)
  const hanging = (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)))
  const started = Date.now(), keepAlive = setTimeout(() => {}, 2000) // AbortSignal.timeout timers do not hold the event loop open
  try {
    assert.deepEqual(await t.verifyTurnstile('tok', { action: 'student-claim', env, fetcher: hanging, timeoutMs: 50 }), { ok: false, reason: 'unavailable' })
  } finally { clearTimeout(keepAlive) }
  assert.ok(Date.now() - started < 1000)
  assert.match(t.turnstileMessage('unavailable'), /try again/)
})

test('the widget is off unless both keys were set at build; the browser never gets the secret', async () => {
  const withEnv = envVars => {
    const m = { exports: {} }
    const code = ts.transpileModule(read('lib/turnstile.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    new Function('require', 'module', 'exports', 'process', code)(require, m, m.exports, { env: envVars })
    return m.exports
  }
  assert.equal(withEnv({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site' }).TURNSTILE_SITE_KEY, '')
  assert.equal(withEnv({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site' }).turnstileRequired, false)
  assert.equal(withEnv({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site', TURNSTILE_ENABLED: '1' }).TURNSTILE_SITE_KEY, 'site')
  const { pathToFileURL } = require('node:url'), saved = { ...process.env }
  const flag = async (site, secret, n) => {
    for (const [k, v] of [['NEXT_PUBLIC_TURNSTILE_SITE_KEY', site], ['TURNSTILE_SECRET_KEY', secret]]) v ? process.env[k] = v : delete process.env[k]
    delete process.env.SENTRY_AUTH_TOKEN
    return (await import(`${pathToFileURL(path.resolve('next.config.mjs')).href}?case=${n}`)).default.env
  }
  try {
    assert.deepEqual(await flag('', '', 1), { TURNSTILE_ENABLED: '' })
    assert.deepEqual(await flag('site', '', 2), { TURNSTILE_ENABLED: '' })
    assert.deepEqual(await flag('', 'secret', 3), { TURNSTILE_ENABLED: '' })
    assert.deepEqual(await flag('site', 'secret', 4), { TURNSTILE_ENABLED: '1' })
  } finally { for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]; Object.assign(process.env, saved) }
  const widget = read('components/security/turnstile-widget.tsx')
  assert.match(widget, /if \(!TURNSTILE_SITE_KEY \|\| !container\.current\) return/, 'no script is loaded when off')
  assert.match(widget, /if \(!TURNSTILE_SITE_KEY\) return null/, 'nothing renders when off')
})

test('Auth server paths: one verifier per token, chosen by TURNSTILE_AUTH_ENFORCED_BY_SUPABASE', async () => {
  assert.equal(t.turnstileTokenPresent(undefined, {}), true, 'unconfigured: no-op')
  assert.equal(t.turnstileTokenPresent(undefined, env), false)
  assert.equal(t.turnstileTokenPresent('x'.repeat(2049), env), false)
  assert.equal(t.turnstileTokenPresent('tok', env), true)
  let calls = 0
  const fetcher = async () => { calls++; return { ok: true, json: async () => ({ success: true, action: 'signup' }) } }
  // Unconfigured: no check, any token passes through unchanged.
  assert.deepEqual(await t.authTurnstile('tok', { action: 'signup', env: {}, fetcher }), { ok: true, captcha: { captchaToken: 'tok' } })
  // Keys set, flag unset: OutClass verifies and does not forward the spent token.
  assert.deepEqual(await t.authTurnstile('tok', { action: 'signup', env, fetcher }), { ok: true, captcha: {} })
  assert.equal(calls, 1)
  assert.deepEqual(await t.authTurnstile(undefined, { action: 'signup', env, fetcher }), { ok: false, reason: 'missing' })
  // Flag "1": presence check only, token forwarded to Supabase, siteverify never called.
  const enforced = { ...env, TURNSTILE_AUTH_ENFORCED_BY_SUPABASE: '1' }
  assert.deepEqual(await t.authTurnstile('tok', { action: 'signup', env: enforced, fetcher }), { ok: true, captcha: { captchaToken: 'tok' } })
  assert.deepEqual(await t.authTurnstile(undefined, { action: 'signup', env: enforced, fetcher }), { ok: false, reason: 'missing' })
  assert.equal(calls, 1)
  const signup = read('actions/onboarding.ts'), recovery = read('app/api/auth/password-recovery/route.ts')
  assert.ok(signup.indexOf('authTurnstile(turnstileToken') < signup.indexOf('auth/v1/settings'))
  assert.ok(recovery.indexOf('authTurnstile(input.turnstileToken') < recovery.indexOf('resetPasswordForEmail'))
})

test('flag unset: registerStudent runs siteverify first and never reaches signUp when it rejects', async () => {
  const originalFetch = global.fetch, saved = { ...process.env }, urls = []
  let signUps = 0
  Object.assign(process.env, env)
  delete process.env.TURNSTILE_AUTH_ENFORCED_BY_SUPABASE
  global.fetch = async url => { urls.push(String(url)); return { ok: true, status: 200, json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }) } }
  try {
    const { registerStudent } = loadWith('actions/onboarding.ts', {
      'next/headers': { cookies: async () => ({ has: () => false }) },
      '@/lib/platform-view-as': { PLATFORM_VIEW_COOKIE: 'outclass-platform-view' },
      '@/lib/onboarding-schemas': loadWith('lib/onboarding-schemas.ts', { '@/lib/student-profile': { gpaSchema: require('zod').z.string(), linkedinUrlSchema: require('zod').z.string() } }),
      '@/lib/auth-email': { authEmailError: () => 'email error' },
      '@/lib/turnstile': t,
      '@/utils/supabase/server': { createClient: async () => ({ auth: { signUp: async () => { signUps++; return {} }, signOut: async () => {} } }) },
    })
    const account = { firstName: 'Test', lastName: 'Student', email: 'test@virginia.edu', password: 'a-valid-password' }
    assert.deepEqual(await registerStudent(account, 'x'), { error: t.turnstileMessage('rejected') })
    assert.deepEqual(urls, ['https://challenges.cloudflare.com/turnstile/v0/siteverify'])
    assert.equal(signUps, 0)
  } finally {
    global.fetch = originalFetch
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]
    Object.assign(process.env, saved)
  }
})

test('server checks follow the build: keys without TURNSTILE_ENABLED (no rebuild) stay off', async () => {
  const keysOnly = { NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site', TURNSTILE_SECRET_KEY: 'secret' }
  assert.equal(t.turnstileConfigured(keysOnly), false)
  assert.equal(t.turnstileConfigured({ ...keysOnly, TURNSTILE_ENABLED: '' }), false)
  assert.equal(t.turnstileConfigured(env), true)
  assert.equal(t.turnstileConfigured({ TURNSTILE_ENABLED: '1', NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site' }), false)
  assert.deepEqual(await t.verifyTurnstile(undefined, { action: 'school-request', env: keysOnly, fetcher: async () => { throw new Error('not called') } }), { ok: true })
  assert.equal(t.turnstileTokenPresent(undefined, keysOnly), true)
  assert.match(read('lib/turnstile.ts'), /const BUILT_ENABLED = process\.env\.TURNSTILE_ENABLED\n/, 'the server reads the inlined build flag')
})

test('Admin password re-check refuses a missing token before recording an attempt or calling Supabase', () => {
  const elevation = read('app/api/platform/elevation/route.ts')
  const check = elevation.indexOf('turnstileTokenPresent(input.turnstileToken)')
  assert.ok(check > 0 && check < elevation.indexOf('platform.elevation.password-attempt') && check < elevation.indexOf('signInWithPassword('))
})

test('student claims verify with siteverify before any account lookup; the token is stripped from the strict schema', () => {
  const claim = read('app/api/auth/student-claim/route.ts')
  const verify = claim.indexOf('action: "student-claim"')
  assert.ok(verify > 0 && verify < claim.indexOf('prisma.user.findFirst') && verify < claim.indexOf('await cookies()'))
  assert.match(claim, /const \{ turnstileToken, \.\.\.fields \} =/)
  assert.match(claim, /schema\.parse\(fields\)/)
  const page = read('app/(focus)/auth/student-claim/page.tsx')
  assert.match(page, /<TurnstileWidget[^>]*action="student-claim"/)
  assert.match(page, /setTurnstileReset\(/)
  assert.match(page, /turnstileRequired && !turnstileToken/)
})
