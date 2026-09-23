const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), mod, mod.exports)
  return mod.exports
}

const helpers = load('lib/student-profile.ts')

const MY_UUID = '123e4567-e89b-12d3-a456-426614174000';
const OTHER_UUID = '00000000-0000-0000-0000-000000000000';

function setupApi({ authUserId, mockHasAccess, dbProfile, redirectError, noSecret = false }) {
  if (noSecret) {
    delete process.env.SUPABASE_SECRET_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
  } else {
    process.env.SUPABASE_SECRET_KEY = 'mock-key'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock'
  }

  let createdSignedUrl = false;
  
  const api = load('app/api/resumes/route.ts', {
    '@/lib/student-profile': helpers,
    '@supabase/supabase-js': { createClient: () => ({ storage: { from: () => ({ createSignedUrl: () => { createdSignedUrl = true; return { data: { signedUrl: 'https://supabase/signed' } } } }) } }) },
    '@/utils/auth': { 
      requireAuth: async () => { 
        if (redirectError) {
          const err = new Error('Redirect')
          err.digest = 'NEXT_REDIRECT;/'
          throw err
        }
        if (!authUserId) throw new Error('Unauthenticated DB error')
        return { user: { id: authUserId } } 
      } 
    },
    '@/utils/prisma': { 
      prisma: { 
        studentProfile: { findUnique: async () => dbProfile },
        application: { findFirst: async () => mockHasAccess } 
      } 
    },
    'next/server': { 
      NextResponse: class { 
        constructor(body, init) { this.body = body; this.status = init?.status || 200 } 
        static redirect(url) { return { status: 302, url } } 
      } 
    }
  })
  return { api, getCreatedSignedUrl: () => createdSignedUrl }
}

test('API allows owner current resume', async () => {
  const reqPath = `${MY_UUID}/current.pdf`
  const { api, getCreatedSignedUrl } = setupApi({
    authUserId: MY_UUID,
    dbProfile: { userId: MY_UUID, resumeUrl: reqPath }
  })
  const res = await api.GET({ url: `http://localhost/api/resumes?path=${reqPath}` })
  assert.equal(res.status, 302)
  assert.equal(getCreatedSignedUrl(), true)
})

test('API denies owner requesting a different/old object under own UUID', async () => {
  const reqPath = `${MY_UUID}/old.pdf`
  const currentPath = `${MY_UUID}/current.pdf`
  const { api, getCreatedSignedUrl } = setupApi({
    authUserId: MY_UUID,
    dbProfile: { userId: MY_UUID, resumeUrl: currentPath }
  })
  const res = await api.GET({ url: `http://localhost/api/resumes?path=${reqPath}` })
  assert.ok(res.status === 403 || res.status === 404)
  assert.equal(getCreatedSignedUrl(), false)
})

test('API allows authorized reviewer current resume', async () => {
  const reqPath = `${OTHER_UUID}/current.pdf`
  const { api, getCreatedSignedUrl } = setupApi({
    authUserId: MY_UUID,
    dbProfile: { userId: OTHER_UUID, resumeUrl: reqPath },
    mockHasAccess: { id: 'app1' }
  })
  const res = await api.GET({ url: `http://localhost/api/resumes?path=${reqPath}` })
  assert.equal(res.status, 302)
  assert.equal(getCreatedSignedUrl(), true)
})

test('API denies authorized reviewer guessed old resume under same student UUID', async () => {
  const reqPath = `${OTHER_UUID}/old.pdf`
  const currentPath = `${OTHER_UUID}/current.pdf`
  const { api, getCreatedSignedUrl } = setupApi({
    authUserId: MY_UUID,
    dbProfile: { userId: OTHER_UUID, resumeUrl: currentPath },
    mockHasAccess: { id: 'app1' }
  })
  const res = await api.GET({ url: `http://localhost/api/resumes?path=${reqPath}` })
  assert.ok(res.status === 403 || res.status === 404)
  assert.equal(getCreatedSignedUrl(), false)
})

test('API blocks valid UUID + ../ traversal', async () => {
  const { api } = setupApi({})
  const res = await api.GET({ url: `http://localhost/api/resumes?path=${MY_UUID}/../secret.pdf` })
  assert.equal(res.status, 400)
})

test('API blocks extra path segments', async () => {
  const { api } = setupApi({})
  const res = await api.GET({ url: `http://localhost/api/resumes?path=${MY_UUID}/folder/file.pdf` })
  assert.equal(res.status, 400)
})

test('API denies unrelated club member', async () => {
  const reqPath = `${OTHER_UUID}/current.pdf`
  const { api } = setupApi({
    authUserId: MY_UUID,
    dbProfile: { userId: OTHER_UUID, resumeUrl: reqPath },
    mockHasAccess: null
  })
  const res = await api.GET({ url: `http://localhost/api/resumes?path=${reqPath}` })
  assert.equal(res.status, 403)
})

test('API denies unauthenticated', async () => {
  const reqPath = `${MY_UUID}/current.pdf`
  const { api } = setupApi({
    redirectError: true
  })
  // We expect Next.js redirect to bubble up, but if caught it throws. We assert it throws the redirect
  await assert.rejects(
    async () => await api.GET({ url: `http://localhost/api/resumes?path=${reqPath}` }),
    (err) => err.digest === 'NEXT_REDIRECT;/'
  )
})

test('API missing server secret does not become 401', async () => {
  const reqPath = `${MY_UUID}/current.pdf`
  const { api } = setupApi({
    authUserId: MY_UUID,
    dbProfile: { userId: MY_UUID, resumeUrl: reqPath },
    noSecret: true
  })
  const res = await api.GET({ url: `http://localhost/api/resumes?path=${reqPath}` })
  assert.equal(res.status, 500)
})
