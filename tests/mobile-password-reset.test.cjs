// The emailed reset link opened in the app (mobile/src/app/reset-password.tsx): the public
// auth.resetPassword operation runs the website's own reset steps (lib/password-reset-complete.ts)
// through an isolated provider client. The website route's own checks are in password-recovery.test.cjs.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const root = path.join(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const REAL = new Set(['@/lib/password-reset-complete', '@/lib/password-recovery', '@/lib/password-policy', '@/lib/auth', '@/lib/action-result'])

function load(file, mocks) {
  const mod = { exports: {} }
  const req = name => {
    if (name in mocks) return mocks[name]
    if (REAL.has(name)) return load(name.slice(2) + '.ts', mocks)
    if (name.startsWith('@/')) return new Proxy({}, { get: (_, key) => key === '__esModule' ? false : `stub:${String(key)}` })
    return require(name)
  }
  const source = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', source)(req, mod, mod.exports)
  return mod.exports
}

function harness({ allow = true, auth: overrides = {} } = {}) {
  const calls = []
  const auth = {
    verifyOtp: async args => { calls.push(['verify', args]); return { data: { session: {}, user: { id: 'u1', email: 'student@virginia.edu' } }, error: null } },
    updateUser: async args => { calls.push(['update', args]); return { error: null } },
    signOut: async args => { calls.push(['signOut', args]); return { error: null } },
    ...overrides,
  }
  const clients = []
  const mod = load('lib/mobile-api/auth.ts', {
    '@supabase/supabase-js': { createClient: (url, key, options) => { clients.push({ url, key, options }); return { auth } } },
    '@/lib/rate-limit': {
      RATE_LIMITS: { passwordRecovery: 'password-recovery-limit' }, RATE_LIMIT_MESSAGE: 'Too many requests.',
      rateLimitKey: () => 'address-key', nodeIsIp: () => true,
      rateLimiter: { check: (limit, key) => { calls.push(['limit', limit, key]); return { ok: allow } } },
    },
    '@/utils/auth': { AUTH_UNAVAILABLE: 'AUTH_UNAVAILABLE' },
  })
  const request = new Request('https://outclass.example/api/mobile/v1/auth.resetPassword', { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.5' } })
  return { calls, clients, reset: input => mod.mobileResetPassword(input, request), schema: mod.mobileResetPasswordInput }
}

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'public-test-key'
delete process.env.SUPABASE_SECRET_KEY; delete process.env.SUPABASE_SERVICE_ROLE_KEY
const input = { tokenHash: 'a'.repeat(64), password: 'a sufficiently long password', confirmation: 'a sufficiently long password' }
const refused = async (promise, code) => { await assert.rejects(promise, error => { assert.equal(error.name, 'ActionError'); assert.equal(error.code, code); return true }) }

test('a valid link sets the password through an isolated client, then signs out everywhere', async () => {
  const h = harness()
  assert.deepEqual(await h.reset(input), { message: 'Your password has been updated. Sign in with your new password.' })
  assert.deepEqual(h.calls.map(call => call[0]), ['limit', 'verify', 'update', 'signOut'])
  assert.deepEqual(h.calls[1][1], { token_hash: input.tokenHash, type: 'recovery' })
  assert.deepEqual(h.calls[2][1], { password: input.password })
  assert.deepEqual(h.calls[3][1], { scope: 'global' })
  assert.equal(h.clients.length, 1)
  assert.deepEqual(h.clients[0].options.auth, { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false })
})

test('the per-address limit runs before anything else, and input problems never reach Auth', async () => {
  const limited = harness({ allow: false })
  await refused(limited.reset(input), 'RATE_LIMITED')
  assert.deepEqual(limited.calls.map(call => call[0]), ['limit'])
  for (const bad of [{ ...input, confirmation: 'a different long password' }, { ...input, tokenHash: 'not/a token' }, { ...input, password: 'short', confirmation: 'short' }, { ...input, authenticatorCode: '12ab' }]) {
    const h = harness()
    await refused(h.reset(bad), 'RESET_REFUSED')
    assert.deepEqual(h.calls.map(call => call[0]), ['limit'])
  }
})

test('an expired, used or non-UVA link asks for a new link and changes nothing', async () => {
  for (const verifyOtp of [async () => ({ data: {}, error: { code: 'otp_expired' } }), async () => ({ data: { session: {}, user: { email: 'someone@example.com' } }, error: null })]) {
    const h = harness({ auth: { verifyOtp } })
    await refused(h.reset(input), 'RESET_LINK_INVALID')
    assert.ok(!h.calls.some(call => call[0] === 'update'))
  }
})

test('a provider outage is reported as unavailable, not as a bad link', async () => {
  const h = harness({ auth: { verifyOtp: async () => { throw new Error('network') } } })
  await refused(h.reset(input), 'AUTH_UNAVAILABLE')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  try { await refused(harness().reset(input), 'AUTH_UNAVAILABLE') } finally { process.env.NEXT_PUBLIC_SUPABASE_URL = url }
})

test('the operation is public, strict and takes no identity; the website route uses the same reset steps', () => {
  const h = harness()
  assert.equal(h.schema.safeParse({ ...input, userId: 'u2' }).success, false)
  assert.match(read('lib/mobile-api/operations.ts'), /"auth\.resetPassword": operation\("POST", mobileResetPasswordInput, async \(input, request\) => \(await import\("@\/lib\/mobile-api\/auth"\)\)\.mobileResetPassword\(input, request\), \{ public: true \}\),/)
  assert.match(read('app/api/auth/password-recovery/route.ts'), /completePasswordReset\(client, reset\.data, url\)/)
})
