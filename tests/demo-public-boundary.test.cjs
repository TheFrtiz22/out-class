const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { NextRequest } = require('next/server')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name.startsWith('@/') ? {} : require(name), mod, mod.exports)
  return mod.exports
}
const access = load('lib/demo/access.ts', { '@/lib/auth': load('lib/auth.ts') })
const environment = { OUTCLASS_DEMO_ENABLED: 'true', OUTCLASS_DEMO_ALLOWED_EMAILS: 'presenter@virginia.edu' }
const privateAccess = { ...access, canAccessDemo: email => access.canAccessDemo(email, environment) }
const presenter = { email: 'presenter@virginia.edu', email_confirmed_at: '2026-10-08T12:00:00Z' }

test('preview and sample asset URLs deny public/forged sessions before static bypasses', async () => {
  let user = null, error = null, calls = 0
  const client = load('utils/supabase/middleware.ts', {
    '@/lib/demo/access': privateAccess,
    '@supabase/ssr': { createServerClient: () => ({ auth: { getUser: async () => { calls++; return { data: { user }, error } } } }) },
  })
  const { middleware } = load('middleware.ts', {
    '@/lib/demo/access': privateAccess,
    '@/lib/platform-view-as': { PLATFORM_VIEW_COOKIE: 'support-view' },
    '@/utils/supabase/middleware': client,
  })
  for (const path of ['/preview', '/preview?view=leader-dashboard', '/preview/nested', '/demo/sample-resume.pdf', '/demo/sample-headshot.svg', '/demo/sample-research.txt', '/de%6do/sample-headshot.svg', '/demo%2Fsample-resume.pdf']) {
    const request = cookie => new NextRequest('https://outclass.example'+path, { headers: cookie ? { cookie } : {} })
    assert.equal((await middleware(request())).status, 404)
    assert.equal(calls, 0)
    const forged = await middleware(request(`${access.DEMO_COOKIE}=1`))
    assert.equal(forged.status, 404)
    assert.equal(forged.cookies.get(access.DEMO_COOKIE).value, '')
    assert.match(forged.headers.get('Cache-Control'), /no-store/)
    calls = 0
  }
  const request = () => new NextRequest('https://outclass.example/preview', { headers: { cookie: `${access.DEMO_COOKIE}=1` } })
  for (const identity of [{ ...presenter, email: 'other@virginia.edu' }, { ...presenter, email_confirmed_at: null }]) {
    user = identity; assert.equal((await middleware(request())).status, 404)
  }
  user = presenter; error = new Error('expired'); assert.equal((await middleware(request())).status, 404)
  error = null
  assert.equal((await middleware(new NextRequest('https://outclass.example/preview', { headers: { cookie: `${access.DEMO_COOKIE}=1; support-view=active` } }))).status, 404)
  assert.equal((await middleware(request())).status, 200)
  assert.match((await middleware(request())).headers.get('Cache-Control'), /no-store/)
})

test('preview layout requires an active demo and a confirmed allowlisted presenter', async () => {
  let cookie = '', user = null, error = null
  const { default: PreviewLayout } = load('app/preview/layout.tsx', {
    '@/lib/demo/access': privateAccess,
    '@/lib/platform-view-as': { PLATFORM_VIEW_COOKIE: 'support-view' },
    'next/headers': { cookies: async () => ({ get: () => ({ value: cookie }), has: () => false }) },
    '@/utils/auth': { getSessionUser: async () => ({ data: { user }, error }) },
    'next/navigation': { notFound() { throw Error('NOT_FOUND') } },
  })
  await assert.rejects(PreviewLayout({ children: 'demo' }), /NOT_FOUND/)
  cookie = '1'
  for (const identity of [null, { ...presenter, email: 'other@virginia.edu' }, { ...presenter, email_confirmed_at: null }]) {
    user = identity; await assert.rejects(PreviewLayout({ children: 'demo' }), /NOT_FOUND/)
  }
  user = presenter; error = new Error('expired'); await assert.rejects(PreviewLayout({ children: 'demo' }), /NOT_FOUND/)
  error = null; assert.equal(await PreviewLayout({ children: 'private demo' }), 'private demo')
})

test('anonymous homepage workspace and demo query URLs use the existing login return flow', async () => {
  const { default: Page } = load('app/page.tsx', {
    'next/cache': { unstable_cache: fn => fn },
    'next/headers': { cookies: async () => ({ has: () => false, get: () => undefined }) },
    'next/navigation': { redirect(location) { const e = new Error('REDIRECT'); e.location = location; throw e } },
    '@/lib/auth': load('lib/auth.ts'), '@/lib/demo/access': privateAccess,
    '@/utils/auth': { getSessionUser: async () => ({ data: { user: null }, error: null }) },
    '@/lib/platform-view-as': { PLATFORM_VIEW_COOKIE: 'support-view' },
  })
  for (const params of [{ workspace: 'student' }, { view: 'leader-dashboard' }, { demoClub: 'sample' }, { workspace: 'student', view: 'student-profile' }]) {
    await assert.rejects(Page({ searchParams: Promise.resolve(params) }), error => {
      const destination = new URL(error.location, 'https://outclass.example')
      assert.equal(destination.pathname, '/login')
      assert.equal(destination.searchParams.get('next'), '/?'+new URLSearchParams(params))
      return true
    })
  }
})
