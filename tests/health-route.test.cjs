// /api/health: 200 with a reachable database, 503 without one, nothing leaked, and middleware lets
// it through without a session refresh. Also covers the dependency-audit gate and its CI wiring.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
// js-yaml is a transitive dependency (not hoisted), so resolve it from pnpm's store directory.
const yaml = require(require.resolve('js-yaml', { paths: fs.readdirSync('node_modules/.pnpm').filter(d => d.startsWith('js-yaml@')).map(d => path.resolve('node_modules/.pnpm', d, 'node_modules')) }))
const { NextRequest } = require('next/server')

function load(file, mocks = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), mod, mod.exports)
  return mod.exports
}
const route = queryRaw => load('app/api/health/route.ts', { '@/utils/prisma': { prisma: { $queryRaw: queryRaw } } })
const SECRET_HOST = 'db.secretproject.supabase.co'

test('health returns 200 with the version after SELECT 1, uncached', async t => {
  const saved = process.env.VERCEL_GIT_COMMIT_SHA
  t.after(() => { if (saved === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA; else process.env.VERCEL_GIT_COMMIT_SHA = saved })
  process.env.VERCEL_GIT_COMMIT_SHA = 'b2476112aabbccddeeff00112233445566778899'
  let sql = ''
  const response = await route(async strings => { sql = strings.join('?'); return [{ '?column?': 1 }] }).GET()
  assert.equal(sql, 'SELECT 1')
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true, version: 'b2476112aabb' })
  assert.match(response.headers.get('cache-control'), /no-store/)
})

test('health returns 503 without leaking the database error', async t => {
  const logged = []
  t.mock.method(console, 'error', (...args) => logged.push(args.join(' ')))
  const response = await route(async () => { throw new Error(`Can't reach database server at \`${SECRET_HOST}\`:5432 password=hunter2`) }).GET()
  assert.equal(response.status, 503)
  const body = await response.text()
  assert.deepEqual(JSON.parse(body), { ok: false, version: JSON.parse(body).version })
  assert.equal(typeof JSON.parse(body).version, 'string')
  for (const text of [body, ...logged, ...[...response.headers.values()]]) {
    assert.doesNotMatch(text, /secretproject|supabase|5432|hunter2|reach database/i)
  }
  assert.match(response.headers.get('cache-control'), /no-store/)
})

test('health returns 503 when the database does not answer within 2 seconds', async t => {
  t.mock.method(console, 'error', () => {})
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const health = route(() => new Promise(() => {}))
  assert.match(fs.readFileSync('app/api/health/route.ts', 'utf8'), /\bconst DATABASE_TIMEOUT_MS = 2000\b/)
  const pending = health.GET()
  await Promise.resolve()
  t.mock.timers.tick(1999)
  let settled = false
  pending.then(() => { settled = true })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(settled, false, 'still waiting just before the timeout')
  t.mock.timers.tick(1)
  const response = await pending
  assert.equal(response.status, 503)
  assert.equal((await response.json()).ok, false)
})

test('middleware passes /api/health through with no session refresh, even with demo or support cookies', async () => {
  let refreshed = 0
  const { middleware } = load('middleware.ts', {
    '@/lib/demo/access': { DEMO_COOKIE: 'outclass-demo-session' },
    '@/lib/platform-view-as': { PLATFORM_VIEW_COOKIE: 'outclass-platform-view' },
    '@/utils/supabase/middleware': { createClient: async () => { refreshed++; return new Response('refreshed') } },
    '@/lib/student-routes': require('./helpers/navigation-module.cjs'),
    '@/lib/legal-content': { LEGAL_PAGES_PUBLIC: false },
    // The real CSP helpers (#278): the health path must stay a plain pass-through with them in place.
    '@/lib/csp': load('lib/csp.ts'),
  })
  for (const cookie of ['', 'outclass-demo-session=1', 'outclass-platform-view=x; sb-abc-auth-token=y']) {
    for (const method of ['GET', 'HEAD']) {
      const res = await middleware(new NextRequest('https://out-class.net/api/health', { method, headers: cookie ? { cookie } : {} }))
      assert.equal(res.status, 200)
      assert.equal(res.headers.get('x-middleware-next'), '1')
      assert.equal(res.headers.get('set-cookie'), null)
    }
  }
  assert.equal(refreshed, 0)
  // Anything else under /api still gets the normal session refresh.
  await middleware(new NextRequest('https://out-class.net/api/healthz'))
  assert.equal(refreshed, 1)
})

test('CI workflow parses and runs the dependency audit gate', () => {
  const workflow = yaml.load(fs.readFileSync('.github/workflows/deploy.yml', 'utf8'))
  const job = workflow.jobs['dependency-audit']
  assert.ok(job, 'dependency-audit job exists')
  assert.ok(job.steps.some(step => step.run === 'node scripts/check-dependency-audit.cjs'))
  assert.match(fs.readFileSync('scripts/check-dependency-audit.cjs', 'utf8'), /'audit', '--audit-level=high', '--prod'/)
  for (const other of ['validate', 'accessibility']) assert.ok(workflow.jobs[other], `${other} job kept`)
})

test('dependency audit blocks unallowed high/critical advisories and rejects stale exceptions', () => {
  const { evaluate, loadAllowlist } = require('../scripts/check-dependency-audit.cjs')
  const advisory = (id, module_name, severity) => ({ github_advisory_id: id, module_name, severity, title: id, patched_versions: '>=9' })
  const report = { advisories: { 1: advisory('GHSA-a', 'zod', 'high'), 2: advisory('GHSA-b', 'x', 'critical'), 3: advisory('GHSA-c', 'y', 'moderate') } }
  const result = evaluate(report, new Set(['GHSA-a']))
  assert.deepEqual(result.allowed.map(a => a.id), ['GHSA-a'])
  assert.deepEqual(result.blocking.map(a => a.id), ['GHSA-b'])
  assert.deepEqual(result.informational.map(a => a.id), ['GHSA-c'])
  assert.throws(() => evaluate({ error: { code: 'ENOTFOUND' } }, new Set()), /no advisories/)

  const allowlist = loadAllowlist('.github/audit-allowlist.json', new Date('2026-11-11T00:00:00Z'))
  assert.deepEqual(allowlist.problems, [])
  assert.ok(allowlist.ids.has('GHSA-mrhx-c7xc-m3w5'))
  const expired = loadAllowlist('.github/audit-allowlist.json', new Date('2027-03-01T00:00:00Z'))
  assert.match(expired.problems.join('\n'), /expired/)
  assert.match(JSON.parse(fs.readFileSync('.github/audit-allowlist.json', 'utf8')).advisories[0].mitigation, /lib\/bounded-input\.ts/)
})
