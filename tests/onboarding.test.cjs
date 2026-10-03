const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

function load(file, mocks = {}) {
  mocks = { "@/lib/platform-view-as": { PLATFORM_VIEW_COOKIE: "outclass-platform-view" }, ...mocks };
  const filename = path.resolve(__dirname, '..', file)
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name.startsWith("@/lib/") ? load(name.slice(2) + ".ts") : require(name), mod, mod.exports)
  return mod.exports
}
const schemas = load('lib/onboarding-schemas.ts')
const account = { firstName: 'Test', lastName: 'Student', email: 'test@virginia.edu', password: 'a-valid-password' }

test('validates and normalizes account and academic fields', () => {
  assert.equal(schemas.registrationSchema.parse({ ...account, email: ' TEST@VIRGINIA.EDU ' }).email, 'test@virginia.edu')
  for (const data of [{ ...account, password: '' }, { ...account, email: 'test@virginia.edu.evil.com' }, { ...account, firstName: ' ' }]) {
    assert.equal(schemas.registrationSchema.safeParse(data).success, false)
  }
  for (const extra of [{ gpa: '3.5oops' }, { satScore: '1400x' }, { satScore: '1400.5' }]) {
    assert.equal(schemas.academicProfileSchema.safeParse({ gradYear: '2028', major: 'Math', ...extra }).success, false)
  }
  assert.equal(schemas.experienceAssetsSchema.safeParse({ linkedinUrl: 'https://notlinkedin.com/profile' }).success, false)
  assert.equal(schemas.experienceAssetsSchema.safeParse({ linkedinUrl: 'https://www.linkedin.com/in/student', experiences: [{ title: 'Member', subtitle: 'Club', period: '2026' }] }).success, true)
})

test('signup never bypasses confirmation, even with obsolete skip arguments and environment flag', async () => {
  process.env.ALLOW_UNVERIFIED_SIGNUP = 'true'
  const originalFetch = global.fetch
  let settings = { mailer_autoconfirm: false, external: { email: true } }, result = { data: { user: { id: 'new', identities: [{}] }, session: null }, error: null }
  const calls = []
  global.fetch = async () => ({ ok: true, json: async () => settings })
  const { registerStudent } = load('actions/onboarding.ts', {
    'next/headers': { cookies: async () => ({ has: () => false }) },
    '@/lib/onboarding-schemas': schemas,
    '@/lib/auth-email': load('lib/auth-email.ts', { '@/lib/auth': load('lib/auth.ts') }),
    '@/utils/supabase/server': { createClient: async () => ({ auth: {
      signUp: async input => { calls.push(input); return result },
      signOut: async () => calls.push('signout'),
    } }) },
  })
  try {
    assert.deepEqual(await registerStudent(account, true), { authenticated: false })
    assert.deepEqual(calls[0], { email: account.email, password: account.password, options: { data: { first_name: 'Test', last_name: 'Student' } } })
    for (const unsafe of [{ mailer_autoconfirm: true, external: { email: true } }, {}, { mailer_autoconfirm: false, external: { email: false } }]) {
      settings = unsafe; assert.ok((await registerStudent(account)).error); assert.equal(calls.length, 1)
    }
    settings = { mailer_autoconfirm: false, external: { email: true } }
    result = { data: { user: { identities: [] }, session: null }, error: null }
    assert.match((await registerStudent(account)).error, /sign in/i)
    result = { data: { user: { identities: [{}], email_confirmed_at: '2026-01-01' }, session: {} }, error: null }
    assert.ok((await registerStudent(account)).error); assert.equal(calls.at(-1), 'signout')
    global.fetch = async () => { throw Error('offline') }
    assert.match((await registerStudent(account)).error, /reach/)
  } finally { global.fetch = originalFetch; delete process.env.ALLOW_UNVERIFIED_SIGNUP }
})

test('OTP format, confirmed identity/session and safe errors are enforced', () => {
  const api = load('lib/auth-email.ts', { '@/lib/auth': load('lib/auth.ts') })
  for (const code of ['12345', '1234567', 'abcdef', '123 45', '１２３４５６']) assert.equal(schemas.otpVerifySchema.safeParse({ code }).success, false)
  assert.equal(schemas.otpVerifySchema.safeParse({ code: '012345' }).success, true)
  const user = { id: 'verified', email: account.email, email_confirmed_at: '2026-01-01' }
  assert.equal(api.confirmedEmailSession({ session: { user }, user }, account.email), true)
  for (const data of [{ session: null, user }, { session: { user }, user: { ...user, id: 'other' } }, { session: { user }, user: { ...user, email_confirmed_at: null } }, { session: { user }, user: { ...user, email: 'other@virginia.edu' } }]) assert.equal(api.confirmedEmailSession(data, account.email), false)
  assert.match(api.authEmailError({ status: 429 }, 'send'), /Too many/)
  assert.match(api.authEmailError({ code: 'otp_expired' }, 'verify'), /expired/)
  assert.ok(!api.authEmailError({ message: 'internal secret' }, 'verify').includes('internal secret'))
})

test('profile saving derives identity from session and persists experience', async () => {
  let saved
  const { upsertStudentProfile } = load('actions/profile.ts', {
    '@/lib/student-profile': load('lib/student-profile.ts'),
    '@/utils/prisma': { prisma: { studentProfile: { upsert: async data => { saved = data; return { id: 'profile' } } } } },
    '@/utils/auth': { requireAuth: async () => ({ user: { id: 'authenticated-user', email: 'actual@virginia.edu' } }) },
    'next/cache': { revalidatePath() {} },
  })
  await upsertStudentProfile({ firstName: 'Test', lastName: 'Student', computingId: 'spoofed', major: 'Math', gradYear: 2028, bio: 'Bio', experiences: [{ title: 'Member', subtitle: 'Club', period: '2026' }] })
  assert.equal(saved.where.userId, 'authenticated-user')
  assert.equal(saved.create.computingId, 'actual')
  assert.equal(saved.create.experiences.create[0].title, 'Member')
})
