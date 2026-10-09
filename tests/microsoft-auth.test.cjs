const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

function load(file, mocks = {}, env = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  new Function('require', 'module', 'exports', 'process', code)(name => {
    if (name in mocks) return mocks[name]
    if (name.startsWith('@/')) return load(`${name.slice(2)}.ts`, mocks, env)
    return require(name)
  }, mod, mod.exports, { env })
  return mod.exports
}

test('Microsoft auth defaults off in every environment; only exact true opts in', () => {
  for (const mode of ['development', 'test', 'production']) {
    for (const value of [undefined, '', 'false', '0', '1', 'TRUE', ' true ', 'true']) {
      assert.equal(load('lib/auth-features.ts', {}, { NODE_ENV: mode, NEXT_PUBLIC_ENABLE_MICROSOFT_AUTH: value }).MICROSOFT_AUTH_ENABLED, value === 'true')
    }
  }
})

test('direct Microsoft initiation requests are rejected without provider, cookie or database calls', async () => {
  const mocks = {
    'next/headers': { cookies() { assert.fail('Disabled initiation must not read or mutate sessions') } },
    '@/utils/supabase/server': { createClient() { assert.fail('Disabled initiation must not contact Supabase') } },
  }
  for (const value of [undefined, 'false', 'TRUE']) {
    const route = load('app/auth/microsoft/route.ts', mocks, { NEXT_PUBLIC_ENABLE_MICROSOFT_AUTH: value })
    for (const query of ['', '?enabled=true', '?provider=google&next=%2Fplatform', '?next=%2Fsignup']) {
      const response = await route.GET(new Request('https://outclass.test/auth/microsoft' + query))
      assert.equal(response.status, 403)
      assert.equal(response.headers.get('location'), null)
      assert.equal(response.headers.get('set-cookie'), null)
      assert.equal(response.headers.get('cache-control'), 'private, no-store')
      assert.match((await response.json()).error, /Use email sign-in/)
    }
  }
})

test('enabled server initiation retains Azure configuration, cookie-backed client and safe redirects', async () => {
  const cookieStore = { has: () => false, get: () => undefined, set: () => {} }
  let input
  const route = load('app/auth/microsoft/route.ts', {
    'next/headers': { cookies: async () => cookieStore },
    '@/utils/supabase/server': { createClient: async store => {
      assert.equal(store, cookieStore)
      return { auth: { signInWithOAuth: async payload => {
        input = payload
        return { data: { url: 'https://auth.example/authorize?provider=azure' }, error: null }
      } } }
    } },
  }, { NEXT_PUBLIC_ENABLE_MICROSOFT_AUTH: 'true' })
  for (const [next, expected] of [['/signup?next=%2Finvitations%2Fa', '/signup?next=%2Finvitations%2Fa'], ['/club-claims/a', '/club-claims/a'], ['//evil.test', '/login'], ['https://evil.test', '/login']]) {
    const response = await route.GET(new Request(`https://outclass.test/auth/microsoft?next=${encodeURIComponent(next)}`, { headers: { 'x-forwarded-host': 'evil.test' } }))
    assert.equal(response.status, 307)
    assert.equal(response.headers.get('location'), 'https://auth.example/authorize?provider=azure')
    assert.equal(input.provider, 'azure')
    assert.equal(input.options.scopes, 'email')
    assert.equal(input.options.skipBrowserRedirect, true)
    const callback = new URL(input.options.redirectTo)
    assert.equal(callback.origin, 'https://outclass.test')
    assert.equal(callback.pathname, '/auth/callback')
    assert.equal(callback.searchParams.get('provider'), 'azure')
    assert.equal(callback.searchParams.get('next'), expected)
  }
})

test('enabled Microsoft initiation still rejects impersonation and demo sessions', async () => {
  for (const mode of ['support', 'demo']) {
    const route = load('app/auth/microsoft/route.ts', {
      'next/headers': { cookies: async () => ({ has: () => mode === 'support', get: () => mode === 'demo' ? { value: '1' } : undefined }) },
      '@/utils/supabase/server': { createClient() { assert.fail('Protected mode must not initiate OAuth') } },
    }, { NEXT_PUBLIC_ENABLE_MICROSOFT_AUTH: 'true' })
    assert.equal((await route.GET(new Request('https://outclass.test/auth/microsoft'))).status, 403)
  }
})

test('provider errors never redirect or expose configuration details', async () => {
  const route = load('app/auth/microsoft/route.ts', {
    'next/headers': { cookies: async () => ({ has: () => false, get: () => undefined }) },
    '@/utils/supabase/server': { createClient: async () => ({ auth: { signInWithOAuth: async () => ({ data: { url: null }, error: { message: 'Internal configuration detail' } }) } }) },
  }, { NEXT_PUBLIC_ENABLE_MICROSOFT_AUTH: 'true' })
  const response = await route.GET(new Request('https://outclass.test/auth/microsoft'))
  assert.equal(response.status, 503)
  assert.doesNotMatch(JSON.stringify(await response.json()), /Internal configuration/)
})

test('disabled Microsoft callbacks are rejected before code exchange and leave existing sessions intact', async () => {
  const route = load('app/auth/callback/route.ts', {
    'next/headers': { cookies: async () => ({ has: () => false }) },
    '@/utils/supabase/server': { createClient() { assert.fail('Disabled callback must not exchange, sign out or replace a session') } },
  })
  const response = await route.GET(new Request('https://outclass.test/auth/callback?provider=azure&code=valid&next=%2Fsignup'))
  assert.equal(response.status, 403)
  assert.equal(response.headers.get('set-cookie'), null)
})
