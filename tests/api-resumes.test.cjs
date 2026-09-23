const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), mod, mod.exports)
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock.supabase.co";
process.env.SUPABASE_SECRET_KEY = "mock-key";

  return mod.exports
}

const MY_UUID = '123e4567-e89b-12d3-a456-426614174000';
const OTHER_UUID = '00000000-0000-0000-0000-000000000000';

function setupApi(authUserId, mockHasAccess) {
  let createdSignedUrl = false;
  const api = load('app/api/resumes/route.ts', {
    '@supabase/supabase-js': { createClient: () => ({ storage: { from: () => ({ createSignedUrl: () => { createdSignedUrl = true; return { data: { signedUrl: 'https://supabase/signed' } } } }) } }) },
    '@/utils/auth': { requireAuth: async () => { if (!authUserId) throw new Error('Unauthenticated'); return { user: { id: authUserId } } } },
    'next/headers': { cookies: () => ({}) },
    '@/utils/prisma': { prisma: { application: { findFirst: async () => mockHasAccess } } },
    'next/server': { NextResponse: class { constructor(body, init) { this.body = body; this.status = init?.status || 200 } static redirect(url) { return { status: 302, url } } } },
    'zod': require('zod')
  })
  return { api, getCreatedSignedUrl: () => createdSignedUrl }
}

test('API allows own student resume', async () => {
  const { api, getCreatedSignedUrl } = setupApi(MY_UUID, null)
  const req = { url: `http://localhost/api/resumes?path=${MY_UUID}/file.pdf` }
  const res = await api.GET(req)
  assert.equal(res.status, 302)
  assert.equal(getCreatedSignedUrl(), true)
})

test('API allows authorized reviewer', async () => {
  const { api, getCreatedSignedUrl } = setupApi(MY_UUID, { id: 'app1' })
  const req = { url: `http://localhost/api/resumes?path=${OTHER_UUID}/file.pdf` }
  const res = await api.GET(req)
  assert.equal(res.status, 302)
  assert.equal(getCreatedSignedUrl(), true)
})

test('API forbids unrelated authenticated student', async () => {
  const { api, getCreatedSignedUrl } = setupApi(MY_UUID, null)
  const req = { url: `http://localhost/api/resumes?path=${OTHER_UUID}/file.pdf` }
  const res = await api.GET(req)
  assert.equal(res.status, 403)
  assert.equal(getCreatedSignedUrl(), false)
})

test('API blocks unauthenticated', async () => {
  const { api, getCreatedSignedUrl } = setupApi(null, null)
  const req = { url: `http://localhost/api/resumes?path=${MY_UUID}/file.pdf` }
  const res = await api.GET(req)
  assert.equal(res.status, 401)
  assert.equal(getCreatedSignedUrl(), false)
})

test('API blocks bad path formats', async () => {
  const { api, getCreatedSignedUrl } = setupApi(MY_UUID, null)
  let res = await api.GET({ url: `http://localhost/api/resumes?path=javascript:alert(1)` })
  assert.equal(res.status, 400)
  
  res = await api.GET({ url: `http://localhost/api/resumes?path=../secret.pdf` })
  assert.equal(res.status, 400)
  assert.equal(getCreatedSignedUrl(), false)
})
