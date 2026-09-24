const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '..', file)
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name === "@/lib/test-scores" ? load("lib/test-scores.ts") : require(name), mod, mod.exports)
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

test('skip creates a new password account and authenticates, without an email request', async () => {
  process.env.ALLOW_UNVERIFIED_SIGNUP = 'true'
  process.env.SUPABASE_SECRET_KEY = 'test-only-key'
  const calls = []
  const { registerStudent } = load('actions/onboarding.ts', {
    'next/headers': { cookies: async () => ({}) },
    '@/lib/onboarding-schemas': schemas,
    '@/utils/supabase/server': { createClient: async () => ({ auth: {
      signInWithPassword: async input => { calls.push(['signin', input]); return { error: null } },
      signUp: async () => { throw new Error('Must not send signup email') },
    } }) },
    '@supabase/supabase-js': { createClient: () => ({ auth: { admin: {
      createUser: async input => { calls.push(['create', input]); return { error: null } },
    } } }) },
  })
  assert.deepEqual(await registerStudent(account, true), { authenticated: true })
  assert.equal(calls[0][1].email_confirm, true)
  assert.equal(calls[0][1].app_metadata.email_verification_skipped, true)
  assert.equal(calls[1][1].password, account.password)
})

test('duplicate account never signs in or modifies an existing user', async () => {
  let signedIn = false
  const { registerStudent } = load('actions/onboarding.ts', {
    'next/headers': { cookies: async () => ({}) },
    '@/lib/onboarding-schemas': schemas,
    '@/utils/supabase/server': { createClient: async () => ({ auth: { signInWithPassword: async () => { signedIn = true } } }) },
    '@supabase/supabase-js': { createClient: () => ({ auth: { admin: { createUser: async () => ({ error: { message: 'duplicate' } }) } } }) },
  })
  assert.match((await registerStudent(account, true)).error, /sign in/i)
  assert.equal(signedIn, false)
  assert.ok((await registerStudent({ ...account, email: 'wrong@example.com' }, true)).error)
})

test('verification remains required when skipping is disabled in both app and Supabase', async () => {
  process.env.ALLOW_UNVERIFIED_SIGNUP = 'false'
  const originalFetch = global.fetch
  global.fetch = async () => ({ ok: true, json: async () => ({ mailer_autoconfirm: false }) })
  try {
    const { registerStudent } = load('actions/onboarding.ts', {
      'next/headers': { cookies: async () => ({}) },
      '@/lib/onboarding-schemas': schemas,
      '@/utils/supabase/server': { createClient: async () => ({ auth: {} }) },
      '@supabase/supabase-js': { createClient: () => { throw new Error('Admin must not be used') } },
    })
    assert.match((await registerStudent(account, true)).error, /still required/)
  } finally { global.fetch = originalFetch }
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
