// Terms acceptance (clickwrap): server refusal without acceptance, stored versions, re-prompt on
// a version bump, no acceptance from support sessions, Demo Mode unaffected. Uses an in-memory
// Prisma double (no database, no network); the table itself is tested in terms-acceptance-migration.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript')

const root = path.join(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
function loader(mocks) {
  const cache = new Map()
  function resolve(name) {
    for (const ext of ['.ts', '.tsx']) if (fs.existsSync(path.join(root, name + ext))) return name + ext
    return name + '.ts'
  }
  function load(file) {
    file = path.resolve(root, file)
    if (cache.has(file)) return cache.get(file).exports
    const mod = { exports: {} }; cache.set(file, mod)
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText
    new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(resolve(name.slice(2))) : require(name), mod, mod.exports)
    return mod.exports
  }
  return load
}
const PUBLIC = { '@/lib/legal-content': { LEGAL_PAGES_PUBLIC: true } }
const DRAFT = { '@/lib/legal-content': { LEGAL_PAGES_PUBLIC: false } }

function fakeDb(rows = [], profiles = []) {
  const db = {
    rows, writes: 0,
    studentProfile: { findUnique: async ({ where }) => profiles.includes(where.userId) ? { id: `p-${where.userId}` } : null },
    termsAcceptance: {
      findFirst: async ({ where }) => rows.find(r => r.userId === where.userId && r.termsVersion === where.termsVersion && r.privacyVersion === where.privacyVersion) ?? null,
      createMany: async ({ data, skipDuplicates }) => {
        assert.equal(skipDuplicates, true, 'insert-only: a repeat keeps the first row')
        let count = 0
        for (const row of data) {
          db.writes++
          if (rows.some(r => r.userId === row.userId && r.termsVersion === row.termsVersion && r.privacyVersion === row.privacyVersion)) continue
          rows.push({ ...row, id: `t${rows.length + 1}`, acceptedAt: new Date() }); count++
        }
        return { count }
      },
    },
  }
  return db
}
const jar = (names = {}) => ({ has: n => n in names, get: n => n in names ? { value: names[n] } : undefined })
const VIEW = 'oc-view-as', DEMO = 'oc-demo'
const common = (cookies, extra = {}) => ({
  ...PUBLIC,
  'next/headers': { cookies: async () => cookies, headers: async () => new Map() },
  '@/lib/platform-view-as': { PLATFORM_VIEW_COOKIE: VIEW },
  '@/lib/demo/access': { DEMO_COOKIE: DEMO },
  ...extra,
})

test('clickwrap answer: off while the pages are drafts; when required, only an explicit tick for the current versions passes', () => {
  const draft = loader(DRAFT)('lib/legal-versions.ts')
  assert.equal(draft.TERMS_ACCEPTANCE_REQUIRED, false, 'nobody is asked to accept unpublished text')
  assert.deepEqual(draft.checkClickwrap(undefined), { ok: true })
  const v = loader(PUBLIC)('lib/legal-versions.ts')
  assert.equal(v.TERMS_ACCEPTANCE_REQUIRED, true)
  const current = { termsVersion: v.TERMS_VERSION, privacyVersion: v.PRIVACY_VERSION }
  for (const answer of [undefined, null, {}, { ...current }, { ...current, acceptTerms: 'true' }, { ...current, acceptTerms: 1 }, { ...current, acceptTerms: false }])
    assert.deepEqual(v.checkClickwrap(answer), { ok: false, error: v.TERMS_REQUIRED_MESSAGE }, JSON.stringify(answer))
  assert.deepEqual(v.checkClickwrap({ acceptTerms: true, termsVersion: 'old', privacyVersion: v.PRIVACY_VERSION }), { ok: false, error: v.TERMS_STALE_MESSAGE })
  assert.deepEqual(v.checkClickwrap({ acceptTerms: true, ...current, privacyVersion: 'old' }), { ok: false, error: v.TERMS_STALE_MESSAGE })
  assert.deepEqual(v.checkClickwrap({ acceptTerms: true, ...current }), { ok: true })
  for (const p of ['/settings/account', '/auth/student-claim']) assert.equal(v.termsGateExempt(p), true, p)
  for (const p of ['/home', '/settings', '/settings/accounts', '/club/x/workspace', '/q/abc']) assert.equal(v.termsGateExempt(p), false, p)
})

test('published versions are dates once the legal pages are public', () => {
  const { LEGAL_PAGES_PUBLIC } = loader({ '@/lib/seo': { LEGAL_ORGANIZATION_NAME: 'OutClassPlatforms LLC' } })('lib/legal-content.ts')
  const v = loader({})('lib/legal-versions.ts')
  assert.equal(v.TERMS_ACCEPTANCE_REQUIRED, LEGAL_PAGES_PUBLIC, 'one switch: pages and acceptance go live together')
  if (LEGAL_PAGES_PUBLIC) for (const version of [v.TERMS_VERSION, v.PRIVACY_VERSION]) assert.match(version, /^\d{4}-\d{2}-\d{2}$/, 'set TERMS_VERSION/PRIVACY_VERSION to the publication date')
})

test('sign-up: the server refuses to create an account without the clickwrap, before any provider call', async () => {
  let providerCalls = 0
  const savedFetch = global.fetch
  global.fetch = async () => { providerCalls++; return { ok: true, json: async () => ({ mailer_autoconfirm: false, external: { email: true } }) } }
  try {
    const load = loader(common(jar(), {
      '@/utils/supabase/server': { createClient: async () => ({ auth: { signUp: async () => { providerCalls++; return { data: { user: { id: 'u1', identities: [{}] }, session: null }, error: null } }, signOut: async () => {} } }) },
      '@/lib/turnstile': { authTurnstile: async () => ({ ok: true, captcha: {} }), captchaFailed: () => false, turnstileMessage: r => r },
      '@/lib/auth-email': { authEmailError: () => 'error' },
    }))
    const { registerStudent } = load('actions/onboarding.ts')
    const v = load('lib/legal-versions.ts')
    const form = { firstName: 'Jordan', lastName: 'Avery', email: 'jav1x@virginia.edu', password: 'correct horse battery' }
    assert.deepEqual(await registerStudent(form, 'token'), { error: v.TERMS_REQUIRED_MESSAGE })
    assert.deepEqual(await registerStudent(form, 'token', { acceptTerms: false, termsVersion: v.TERMS_VERSION, privacyVersion: v.PRIVACY_VERSION }), { error: v.TERMS_REQUIRED_MESSAGE })
    assert.deepEqual(await registerStudent(form, 'token', { acceptTerms: true, termsVersion: 'stale', privacyVersion: v.PRIVACY_VERSION }), { error: v.TERMS_STALE_MESSAGE })
    assert.equal(providerCalls, 0, 'no settings check and no Auth signUp without acceptance')
    assert.deepEqual(await registerStudent(form, 'token', { acceptTerms: true, termsVersion: v.TERMS_VERSION, privacyVersion: v.PRIVACY_VERSION }), { authenticated: false })
    assert.equal(providerCalls, 2, 'with acceptance the existing flow runs unchanged')
  } finally { global.fetch = savedFetch }
})

test('student claim: refused without the clickwrap before the one-use link is touched', async () => {
  let touched = 0
  const json = (body, init = {}) => ({ body, status: init.status ?? 200 })
  const load = loader(common(jar(), {
    'next/server': { NextResponse: { json } },
    '@/lib/request-origin': { sameOriginRequest: () => true },
    '@/lib/turnstile': { verifyTurnstile: async () => ({ ok: true }), turnstileMessage: r => r, turnstileRemoteIp: () => null },
    '@/utils/admin-elevation': { freshAuthClient: () => { touched++ } },
    '@/utils/supabase/server': { createClient: async () => { touched++; return { auth: { getUser: async () => ({ data: { user: null } }) } } } },
    '@/utils/prisma': { prisma: new Proxy({}, { get: () => { touched++; return {} } }) },
    '@supabase/supabase-js': { createClient: () => { touched++ } },
  }))
  const { POST } = load('app/api/auth/student-claim/route.ts')
  const v = load('lib/legal-versions.ts')
  const body = { email: 'jav1x@virginia.edu', password: 'a-long-enough-password', tokenHash: 'a'.repeat(56) }
  for (const extra of [{}, { acceptTerms: false, termsVersion: v.TERMS_VERSION, privacyVersion: v.PRIVACY_VERSION }, { acceptTerms: true, termsVersion: 'stale', privacyVersion: v.PRIVACY_VERSION }]) {
    const response = await POST({ json: async () => ({ ...body, ...extra }), headers: new Map() })
    assert.equal(response.status, 400)
    assert.match(response.body.error, /Terms/)
  }
  assert.equal(touched, 0, 'no account lookup or provider call without acceptance')
  const route = read('app/api/auth/student-claim/route.ts')
  assert.ok(route.indexOf('checkClickwrap(') < route.indexOf('verifyOtp('), 'checked before the link is consumed')
  assert.ok(route.indexOf('recordTermsAcceptance(prisma, user.id, "CLAIM")') > route.indexOf('updateUser('), 'stored once the claim succeeded, for the verified user')
})

test('student claim: a failed acceptance write after a successful claim still signs the student in', async () => {
  const calls = [], logged = []
  const json = (body, init = {}) => ({ body, status: init.status ?? 200 })
  const tokenHash = 'b'.repeat(56), email = 'jav1x@virginia.edu'
  const { studentInvitationFingerprint } = loader({})('lib/student-invitation.ts')
  const session = { access_token: 'x', refresh_token: 'y' }
  const prisma = {
    user: { findFirst: async () => ({ id: 'u1', email, disabledAt: null }) },
    auditLog: {
      findFirst: async ({ where }) => where.details.equals === studentInvitationFingerprint(tokenHash) ? { id: 'a1' } : null,
      create: async () => { calls.push('audit') },
    },
    termsAcceptance: { createMany: async () => { calls.push('terms'); throw Object.assign(new Error('relation "TermsAcceptance" does not exist for jav1x@virginia.edu'), { name: 'PrismaClientKnownRequestError' }) } },
  }
  const load = loader(common(jar(), {
    'next/server': { NextResponse: { json } },
    '@/lib/request-origin': { sameOriginRequest: () => true },
    '@/lib/turnstile': { verifyTurnstile: async () => ({ ok: true }), turnstileMessage: r => r, turnstileRemoteIp: () => null },
    '@/utils/admin-elevation': { freshAuthClient: () => ({ auth: {
      verifyOtp: async () => ({ data: { session, user: { id: 'u1', email } }, error: null }),
      updateUser: async () => { calls.push('password'); return { error: null } },
    } }) },
    '@/utils/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }), setSession: async s => { calls.push(s === session ? 'session' : 'wrong-session'); return { error: null } } } }) },
    '@/utils/prisma': { prisma },
    '@supabase/supabase-js': { createClient: () => ({ auth: { admin: { getUserById: async () => ({ data: { user: { id: 'u1', email, invited_at: '2026-11-01', email_confirmed_at: null } }, error: null }) } } }) },
  }))
  const { POST } = load('app/api/auth/student-claim/route.ts')
  const v = load('lib/legal-versions.ts')
  const savedEnv = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY }
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'; process.env.SUPABASE_SECRET_KEY = 'test-only'
  const savedError = console.error; console.error = (...args) => { logged.push(args) }
  try {
    const response = await POST({ json: async () => ({ email, tokenHash, password: 'a-long-enough-password', acceptTerms: true, termsVersion: v.TERMS_VERSION, privacyVersion: v.PRIVACY_VERSION }), headers: new Map() })
    assert.equal(response.status, 200)
    assert.deepEqual(response.body, { success: true })
    assert.deepEqual(calls, ['password', 'audit', 'terms', 'session'], 'the session is attached after the failed write')
    assert.equal(logged.length, 1)
    assert.deepEqual(logged[0].slice(1), ['PrismaClientKnownRequestError'], 'only the error name is logged')
    assert.doesNotMatch(JSON.stringify(logged), /virginia\.edu|does not exist/, 'no message, address or SQL detail in the log')
  } finally {
    console.error = savedError
    for (const [k, name] of [['url', 'NEXT_PUBLIC_SUPABASE_URL'], ['key', 'SUPABASE_SECRET_KEY']]) if (savedEnv[k] === undefined) delete process.env[name]; else process.env[name] = savedEnv[k]
  }
})

function acceptAction({ cookies = jar(), auth = { user: { id: 'u1' }, impersonation: null }, db = fakeDb(), extra = {} } = {}) {
  let authCalls = 0
  const load = loader(common(cookies, {
    '@/utils/auth': { requireAuth: async () => { authCalls++; return auth } },
    '@/utils/prisma': { prisma: db },
    ...extra,
  }))
  return { ...load('actions/terms.ts'), v: load('lib/legal-versions.ts'), db, authCalls: () => authCalls }
}

test('acceptance is stored server-side with the user id, both versions and the source', async () => {
  const a = acceptAction()
  const answer = { acceptTerms: true, termsVersion: a.v.TERMS_VERSION, privacyVersion: a.v.PRIVACY_VERSION }
  assert.deepEqual(await a.acceptCurrentTerms({ ...answer, source: 'PROMPT' }), { accepted: true })
  assert.equal(a.db.rows.length, 1)
  assert.deepEqual({ ...a.db.rows[0], id: undefined, acceptedAt: undefined }, { userId: 'u1', termsVersion: a.v.TERMS_VERSION, privacyVersion: a.v.PRIVACY_VERSION, source: 'SIGNUP', id: undefined, acceptedAt: undefined })
  assert.ok(a.db.rows[0].acceptedAt instanceof Date)
  // Repeat: the first row and its time are kept.
  await a.acceptCurrentTerms({ ...answer, source: 'ADMIN' })
  assert.equal(a.db.rows.length, 1)
  // The source is derived on the server (profile exists: PROMPT; none yet: SIGNUP); a client value is ignored.
  for (const sent of [undefined, 'SIGNUP', 'CLAIM', 'ADMIN']) {
    const b = acceptAction({ db: fakeDb([], ['u1']) })
    await b.acceptCurrentTerms({ ...answer, source: sent })
    assert.equal(b.db.rows[0].source, 'PROMPT', `profile exists, client sent ${sent}`)
    const c = acceptAction({ db: fakeDb([], []) })
    await c.acceptCurrentTerms({ ...answer, source: sent ?? 'PROMPT' })
    assert.equal(c.db.rows[0].source, 'SIGNUP', `no profile yet, client sent ${sent ?? 'PROMPT'}`)
  }
  // Not ticked or stale: nothing stored.
  const c = acceptAction()
  assert.deepEqual(await c.acceptCurrentTerms({ ...answer, acceptTerms: false }), { error: c.v.TERMS_REQUIRED_MESSAGE })
  assert.deepEqual(await c.acceptCurrentTerms({ ...answer, termsVersion: 'old' }), { error: c.v.TERMS_STALE_MESSAGE })
  assert.equal(c.db.writes, 0)
})

test('a support (view-as) session can never accept on the user\'s behalf', async () => {
  const answer = v => ({ acceptTerms: true, termsVersion: v.TERMS_VERSION, privacyVersion: v.PRIVACY_VERSION })
  const cookie = acceptAction({ cookies: jar({ [VIEW]: 'session' }) })
  assert.match((await cookie.acceptCurrentTerms(answer(cookie.v))).error, /account holder/)
  assert.equal(cookie.authCalls(), 0, 'refused before resolving the effective user')
  assert.equal(cookie.db.writes, 0)
  // Defence in depth: if requireAuth ever reports a support session, still refuse.
  const resolved = acceptAction({ auth: { user: { id: 'target' }, impersonation: { targetUserId: 'target' } } })
  assert.match((await resolved.acceptCurrentTerms(answer(resolved.v))).error, /account holder/)
  assert.equal(resolved.db.writes, 0)
})

test('Demo Mode: no write, no prompt; and nothing changes while the pages are drafts', async () => {
  const demo = acceptAction({ cookies: jar({ [DEMO]: '1' }) })
  assert.match((await demo.acceptCurrentTerms({ acceptTerms: true, termsVersion: demo.v.TERMS_VERSION, privacyVersion: demo.v.PRIVACY_VERSION })).error, /Demo Mode/)
  assert.equal(demo.db.writes, 0); assert.equal(demo.authCalls(), 0)
  const draft = acceptAction({ extra: DRAFT })
  assert.deepEqual(await draft.acceptCurrentTerms({}), { accepted: true })
  assert.equal(draft.db.writes, 0); assert.equal(draft.authCalls(), 0)
})

function gate(extra = {}) {
  return loader({
    ...common(jar(), extra),
    './terms-acceptance-screen': { TermsAcceptanceScreen: () => null },
    '@/utils/auth': { getSessionUser: async () => ({ data: { user: null } }) },
    '@/utils/prisma': { prisma: fakeDb() },
  })('components/legal/terms-gate.tsx')
}

test('one-time prompt: missing acceptance asks; current acceptance passes; a version bump asks again', async () => {
  const db = fakeDb([{ userId: 'u1', termsVersion: '2026-11-30', privacyVersion: '2026-11-30', source: 'SIGNUP' }])
  const atV1 = loader({ '@/lib/legal-versions': { TERMS_VERSION: '2026-11-30', PRIVACY_VERSION: '2026-11-30' } })('utils/terms-acceptance.ts')
  const termsBump = loader({ '@/lib/legal-versions': { TERMS_VERSION: '2027-02-01', PRIVACY_VERSION: '2026-11-30' } })('utils/terms-acceptance.ts')
  const privacyBump = loader({ '@/lib/legal-versions': { TERMS_VERSION: '2026-11-30', PRIVACY_VERSION: '2027-02-01' } })('utils/terms-acceptance.ts')
  const { termsGateDecision } = gate()
  const decide = (mod, userId = 'u1') => termsGateDecision({ required: true, demo: false, impersonating: false, userId, accepted: id => mod.hasCurrentTermsAcceptance(db, id) })
  assert.equal(await decide(atV1), 'pass')
  assert.equal(await decide(atV1, 'u2'), 'ask', 'never accepted')
  assert.equal(await decide(termsBump), 'ask', 'Terms version changed')
  assert.equal(await decide(privacyBump), 'ask', 'Privacy version changed')
  await termsBump.recordTermsAcceptance(db, 'u1', 'PROMPT')
  assert.equal(await decide(termsBump), 'pass', 'asked once per version')
  assert.equal(db.rows.length, 2, 'the earlier acceptance is kept as history')
})

test('the prompt never shows for Demo Mode, support sessions, signed-out visitors or while acceptance is off; a database fault fails open', async () => {
  const { termsGateDecision } = gate()
  let checks = 0
  const accepted = async () => { checks++; return false }
  const base = { required: true, demo: false, impersonating: false, userId: 'u1', accepted }
  assert.equal(await termsGateDecision({ ...base, demo: true }), 'pass')
  assert.equal(await termsGateDecision({ ...base, impersonating: true }), 'pass')
  assert.equal(await termsGateDecision({ ...base, userId: null }), 'pass')
  assert.equal(await termsGateDecision({ ...base, required: false }), 'pass')
  assert.equal(checks, 0)
  const savedError = console.error; console.error = () => {}
  try { assert.equal(await termsGateDecision({ ...base, accepted: async () => { throw Object.assign(new Error('relation does not exist'), { code: 'P2021' }) } }), 'pass') } finally { console.error = savedError }
})

test('wiring: every account-creation path and both signed-in route groups use the shared clickwrap and gate', () => {
  for (const layout of ['app/(workspace)/layout.tsx', 'app/(focus)/layout.tsx']) assert.match(read(layout), /<TermsGate>/, layout)
  const wizard = read('components/views/student-onboarding-wizard.tsx')
  assert.match(wizard, /registerStudent\(values, turnstileToken, clickwrapAnswer\(acceptTerms\)\)/)
  assert.match(wizard, /const \[acceptTerms, setAcceptTerms\] = useState\(false\)/, 'unticked by default')
  assert.match(wizard, /saveClickwrapAcceptance\(acceptCurrentTerms\)/)
  assert.doesNotMatch(wizard + read('components/legal/terms-acceptance-screen.tsx'), /source:/, 'the client never sends a source')
  assert.match(read('app/(focus)/auth/student-claim/page.tsx'), /<TermsClickwrap/)
  assert.match(read('actions/profile.ts'), /TERMS_ACCEPTANCE_REQUIRED && !await prisma\.studentProfile\.findUnique[\s\S]*hasCurrentTermsAcceptance\(prisma, user\.id\)[\s\S]*throw new Error\(TERMS_REQUIRED_MESSAGE\)/, 'a new profile needs acceptance (Microsoft first sign-in)')
  const clickwrap = read('components/legal/terms-clickwrap.tsx')
  assert.match(clickwrap, /href="\/terms"/); assert.match(clickwrap, /href="\/privacy"/)
  assert.doesNotMatch(clickwrap, /defaultChecked/)
  const screen = read('components/legal/terms-acceptance-screen.tsx')
  assert.match(screen, /termsGateExempt\(pathname\)/); assert.match(screen, /Sign out/)
})

test('sign-up wizard: a failed save after email verification shows the box again on step 3 and retries before moving on', async () => {
  const load = loader({ ...PUBLIC, 'next/link': () => null, '@/components/ui/checkbox': { Checkbox: () => null } })
  const { saveClickwrapAcceptance, TERMS_SAVE_FAILED, clickwrapAnswer } = load('components/legal/terms-clickwrap.tsx')
  const sent = []
  assert.equal(await saveClickwrapAcceptance(async answer => { sent.push(answer); return { accepted: true } }), null)
  assert.deepEqual(sent, [clickwrapAnswer(true)], 'the ticked answer for the shown versions, no source')
  assert.equal(await saveClickwrapAcceptance(async () => { throw new Error('network') }), TERMS_SAVE_FAILED)
  assert.equal(await saveClickwrapAcceptance(async () => ({ error: 'Exit Demo Mode to accept the Terms.' })), 'Exit Demo Mode to accept the Terms.')

  const wizard = read('components/views/student-onboarding-wizard.tsx')
  const verify = wizard.slice(wizard.indexOf('async function onStep2Submit'), wizard.indexOf('async function resendCode'))
  assert.match(verify, /if \(askTerms && acceptTerms && await saveClickwrapAcceptance\(acceptCurrentTerms\)\) \{\s*setTermsUnsaved\(true\); setAcceptTerms\(false\); setGlobalError\(TERMS_SAVE_FAILED\)/, 'failure re-arms the box with a recoverable message')
  assert.ok(verify.indexOf('setTermsUnsaved(true)') < verify.indexOf('setStep(3)'), 'the student still reaches step 3')
  const step3 = wizard.slice(wizard.indexOf('async function onStep3Submit'), wizard.indexOf('// ── Step 4'))
  assert.match(step3, /if \(termsUnsaved\) \{[\s\S]*if \(!acceptTerms\) \{ setGlobalError\(TERMS_REQUIRED_MESSAGE\); return \}[\s\S]*saveClickwrapAcceptance\(acceptCurrentTerms\)[\s\S]*if \(failed\) \{ setGlobalError\(failed\); return \}[\s\S]*setTermsUnsaved\(false\)/)
  assert.ok(step3.indexOf('setTermsUnsaved(false)') < step3.indexOf('setStep(4)'), 'step 4 (which creates the profile) only after the acceptance is stored')
  const render3 = wizard.slice(wizard.indexOf('{step === 3 && ('), wizard.indexOf('{step === 4 && ('))
  assert.match(render3, /\{termsUnsaved && <TermsClickwrap id="accept-terms-retry" checked=\{acceptTerms\}/, 'the agree box is shown again on step 3')
})
