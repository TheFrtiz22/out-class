// requireAuth during a Supabase Auth outage: a Server Action is refused with a retryable reason
// instead of redirecting (which drops the user's change silently). Real denials still sign out.
// Supabase and Next are mocked: no provider is contacted.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript')

function loader(mocks = {}) { const cache = new Map(); function load(file) { file = path.resolve(file); if (cache.has(file)) return cache.get(file).exports; const mod = { exports: {} }; cache.set(file, mod); const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText; new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(['.ts', '.tsx'].map(ext => name.slice(2) + ext).find(f => fs.existsSync(f))) : require(name), mod, mod.exports); return mod.exports } return load }

const id = '00000000-0000-4000-8000-000000000001'
const token = ['fixture', Buffer.from(JSON.stringify({ sub: id, session_id: '00000000-0000-4000-8000-000000000099', aal: 'aal1' })).toString('base64url'), 'sig'].join('.')
const authError = (name, status, code) => Object.assign(new Error(name), { name, status, ...(code ? { code } : {}) })

function harness({ action, error, user = null }) {
  const cache = new Map()
  return loader({
    react: { cache: fn => { const key = Symbol(); return () => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key) } } },
    'next/headers': { headers: async () => new Headers(action ? { 'next-action': 'x' } : {}), cookies: async () => ({ has: () => false, get: () => undefined }) },
    'next/navigation': { redirect: to => { throw Object.assign(Error('redirect'), { to }) } },
    '@/utils/site-settings': { assertSiteWritable: async () => {} },
    './supabase/server': { createClient: async () => ({ auth: { getSession: async () => ({ data: { session: { access_token: token } }, error: null }), getUser: async () => ({ data: { user }, error }) } }) },
    './prisma': { prisma: { $queryRaw: async () => [{ live: true }], user: { findUnique: async () => null } } },
  })('utils/auth.ts')
}

const outages = [
  ['network failure', authError('AuthRetryableFetchError', 0)],
  ['provider 500', authError('AuthApiError', 500, 'unexpected_failure')],
  ['provider 503', authError('AuthApiError', 503)],
  ['unknown response', authError('AuthUnknownError', undefined)],
]

for (const [label, error] of outages) test(`Server Action during an Auth outage (${label}) is refused with a retryable reason, not redirected`, async () => {
  const api = harness({ action: true, error })
  await assert.rejects(api.requireAuth(), e => e.name === 'ActionError' && e.code === api.AUTH_UNAVAILABLE && /Try again/.test(e.message) && e.to === undefined)
})

test('a real sign-in denial still signs the user out, in a Server Action too', async () => {
  for (const error of [authError('AuthApiError', 401, 'bad_jwt'), authError('AuthApiError', 403, 'session_not_found'), authError('AuthSessionMissingError', 400)]) {
    await assert.rejects(harness({ action: true, error }).requireAuth(), e => e.to === '/')
  }
  await assert.rejects(harness({ action: true, error: null }).requireAuth(), e => e.to === '/', 'no session: signed out')
})

test('page renders keep the existing redirect during an outage', async () => {
  await assert.rejects(harness({ action: false, error: outages[0][1] }).requireAuth(), e => e.to === '/')
})

test('the refusal is an ActionError, so wrapped actions return it to the user instead of a redacted error', () => {
  const auth = fs.readFileSync('utils/auth.ts', 'utf8')
  assert.match(auth, /throw new ActionError\(AUTH_UNAVAILABLE_MESSAGE, AUTH_UNAVAILABLE\)/)
})
