const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

const jsxRuntime = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'Fragment' }
function load(file, mocks = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  new Function('require', 'module', 'exports', code)(name => {
    if (name in mocks) return mocks[name]
    if (name === 'react/jsx-runtime') return jsxRuntime
    throw new Error(`unexpected import ${name}`)
  }, mod, mod.exports)
  return mod.exports
}

// FE-33: the signup wizard has no leader path, so the landing CTA no longer sends a dead intent parameter.
test('landing leader CTA goes to plain /signup; no source emits the dead intent=leader parameter', () => {
  const landing = fs.readFileSync('components/views/landing-page-view.tsx', 'utf8')
  assert.doesNotMatch(landing, /intent=/)
  assert.match(landing, /const createProfile = \(\) => \{ window\.location\.href = "\/signup" \}/)
  assert.match(landing, /const enterLeader = createProfile/)
  assert.match(landing, /onLeaderEnter=\{enterLeader\}/)
  const wizard = fs.readFileSync('components/views/student-onboarding-wizard.tsx', 'utf8')
  assert.doesNotMatch(wizard, /intent/, 'if the wizard gains an intent-driven leader path, restore the CTA parameter and test it')
  for (const dir of ['app', 'components']) {
    for (const file of fs.readdirSync(dir, { recursive: true })) {
      if (!/\.tsx?$/.test(file)) continue
      assert.doesNotMatch(fs.readFileSync(`${dir}/${file}`, 'utf8'), /[?&]intent=leader/, `${dir}/${file}`)
    }
  }
})

// FE-34: the design-system reference is platform-admin only and 404s for everyone else.
class AdminAccessError extends Error { constructor(code) { super(code); this.code = code } }
const NOT_FOUND = Object.assign(new Error('NEXT_HTTP_ERROR_FALLBACK;404'), { digest: 'NEXT_HTTP_ERROR_FALLBACK;404' })
function designSystemPage(gate) {
  const calls = []
  const page = load('app/design-system/page.tsx', {
    'next/navigation': {
      notFound: () => { throw NOT_FOUND },
      unstable_rethrow: error => { if (error?.digest) throw error },
    },
    '@/lib/admin-failure': { AdminAccessError },
    '@/utils/platform-admin': { requirePlatformAdmin: async (...args) => { calls.push(args); return gate() } },
    './design-system-reference': { DesignSystemReference: 'DesignSystemReference' },
  })
  return { page, calls }
}

test('design-system page is a server component that calls requirePlatformAdmin and stays dynamic', () => {
  const source = fs.readFileSync('app/design-system/page.tsx', 'utf8')
  assert.doesNotMatch(source, /^['"]use client['"]/m)
  const { page } = designSystemPage(async () => ({ id: 'admin' }))
  assert.equal(page.dynamic, 'force-dynamic')
  const layout = fs.readFileSync('app/design-system/layout.tsx', 'utf8')
  assert.match(layout, /robots: \{ index: false, follow: false \}/)
  assert.match(fs.readFileSync('app/robots.ts', 'utf8'), /"\/design-system"/)
})

test('platform admins see the reference', async () => {
  const { page, calls } = designSystemPage(async () => ({ id: 'admin' }))
  const element = await page.default()
  assert.equal(calls.length, 1)
  assert.equal(element.type, 'DesignSystemReference')
})

test('signed-out users, non-admins, revoked grants and unverified MFA get not-found', async () => {
  for (const code of ['ADMIN_AUTH_REQUIRED', 'ADMIN_ACCESS_DENIED', 'ADMIN_GRANT_REVOKED', 'ADMIN_MFA_REQUIRED', 'ADMIN_SESSION_EXPIRED']) {
    const { page, calls } = designSystemPage(async () => { throw new AdminAccessError(code) })
    await assert.rejects(page.default(), error => error === NOT_FOUND, code)
    assert.equal(calls.length, 1)
  }
})

test('framework control flow and operational failures are not disguised as not-found', async () => {
  const redirect = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/;307;' })
  await assert.rejects(designSystemPage(async () => { throw redirect }).page.default(), error => error === redirect)
  const outage = new Error('database unavailable')
  await assert.rejects(designSystemPage(async () => { throw outage }).page.default(), error => error === outage)
})
