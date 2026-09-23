const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { NextRequest } = require('next/server')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), mod, mod.exports)
  return mod.exports
}
const access = load('lib/demo/access.ts', { '@/lib/auth': load('lib/auth.ts') })
test('deployed demo endpoint verifies identity, issues secure cookie, and rejects failed auth', async () => {
  const saved = { ...process.env }
  try {
    process.env.NODE_ENV = 'production'
    process.env.VERCEL_ENV = 'preview'
    process.env.OUTCLASS_DEMO_ENABLED = 'true'
    process.env.OUTCLASS_DEMO_ALLOWED_EMAILS = 'presenter@virginia.edu'
    let email = "presenter@virginia.edu"
    let authError = null
    let authCalls = 0
    const api = load('app/api/demo/route.ts', {
      '@/lib/demo/access': access,
      'next/headers': { cookies: async () => ({ get: () => ({ value: '1' }) }) },
      '@/utils/supabase/server': { createClient: async () => ({ auth: { getUser: async () => { authCalls++; return { data: { user: { email } }, error: authError } } } }) },
    })
    const request = (enabled, origin = 'https://demo.example') => new NextRequest('https://demo.example/api/demo', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ enabled }) })
    const on = await api.POST(request(true))
    assert.equal(on.status, 200)
    assert.equal(on.cookies.get(access.DEMO_COOKIE).value, '1')
    assert.match(on.headers.get('set-cookie'), /HttpOnly/)
    assert.match(on.headers.get('set-cookie'), /Secure/)
    assert.match(on.headers.get('set-cookie'), /SameSite=strict/i)
    process.env.VERCEL_ENV = 'production'
    assert.equal((await api.POST(request(true))).status, 200)
    email = 'other@virginia.edu'
    const denied = await api.POST(request(true))
    assert.equal(denied.status, 403)
    assert.equal((await denied.json()).reason, 'not-allowlisted')
    email = 'presenter@virginia.edu'
    assert.equal((await api.POST(request(true, 'https://other.example'))).status, 403)
    authError = new Error('expired')
    assert.equal((await api.POST(request(true))).status, 403)
    const get = await api.GET()
    assert.equal(get.cookies.get(access.DEMO_COOKIE).value, '')
    assert.deepEqual(await get.json(), { allowed: false, enabled: false, reason: 'sign-in-required' })
    const before = authCalls
    const off = await api.POST(request(false))
    assert.equal(off.status, 200)
    assert.equal(off.cookies.get(access.DEMO_COOKIE).value, '')
    assert.equal(off.cookies.getAll().length, 1, 'Exit must not clear Supabase authentication cookies')
    assert.equal(authCalls, before)
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]
    Object.assign(process.env, saved)
  }
})
test('demo cookie blocks live identity reads and mutations without granting a session', async () => {
  let live = 0
  const { middleware } = load('middleware.ts', {
    '@/lib/demo/access': access,
    '@/utils/supabase/middleware': { createClient: async () => { live++; return new Response('ordinary') } },
  })
  for (const [path, method] of [['/api/users/me', 'GET'], ['/', 'POST']]) {
    const res = await middleware(new NextRequest(`https://demo.example${path}`, { method, headers: { cookie: `${access.DEMO_COOKIE}=1` } }))
    assert.equal(res.status, 403)
  }
  assert.equal(live, 0)
  await middleware(new NextRequest('https://demo.example/api/users/me'))
  await middleware(new NextRequest('https://demo.example/api/demo', { method: 'POST', headers: { cookie: `${access.DEMO_COOKIE}=1` } }))
  assert.equal(live, 2)
})
