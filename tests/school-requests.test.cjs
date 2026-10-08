const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { NextRequest } = require('next/server')

function load(file, mocks = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name.startsWith('@/lib/') ? load(name.replace('@/', '') + '.ts', mocks) : require(name), mod, mod.exports)
  return mod.exports
}
const schemas = load('lib/school-requests.ts')
const input = { fullName: 'Sam Student', email: 'SAM@example.edu', university: 'Example University', role: 'STUDENT', organization: '', message: 'Interested in joining the campus pilot.', website: '' }
function endpoint({ total = 0, personal = 0, offline = false } = {}) {
  const records = [], operations = []
  const tx = {
    $queryRaw: async () => { operations.push('lock'); return [] },
    schoolRequest: {
      count: async query => { operations.push('count'); return query.where.email ? personal : total },
      create: async ({ data }) => { operations.push('create'); if (offline) throw Error('private connection details'); records.push(data) },
    },
  }
  const route = load('app/api/school-requests/route.ts', {
    '@/utils/prisma': { prisma: { $transaction: fn => fn(tx) } },
    '@/lib/demo/access': { DEMO_COOKIE: 'demo' },
    '@/lib/platform-view-as': { PLATFORM_VIEW_COOKIE: 'support-view' },
  })
  return { route, records, operations }
}
function request(body = input, { origin = 'http://localhost:3108', cookie = '' } = {}) {
  return new NextRequest('http://localhost:3108/api/school-requests', { method: 'POST', headers: { host: 'localhost:3108', origin, cookie, 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) })
}
test('school requests accept each role and unrestricted university emails, normalize and bound fields', () => {
  for (const role of schemas.schoolRequestRoles) assert.equal(schemas.schoolRequestSchema.parse({ ...input, role }).email, 'sam@example.edu')
  for (const bad of [{ role: 'ADMIN' }, { email: 'not-an-email' }, { university: ' ' }, { message: 'x'.repeat(2001) }, { approved: true }]) assert.equal(schemas.schoolRequestSchema.safeParse({ ...input, ...bad }).success, false)
})
test('public submission saves anonymous requests only after locked database limits; no grants are created', async () => {
  for (const role of schemas.schoolRequestRoles) {
    const api = endpoint()
    const response = await api.route.POST(request({ ...input, role }))
    assert.equal(response.status, 201)
    assert.equal(api.records[0].role, role)
    assert.equal(api.records[0].email, 'sam@example.edu')
    assert.equal('website' in api.records[0], false)
    assert.equal('status' in api.records[0], false)
    assert.deepEqual(api.operations, ['lock', 'count', 'count', 'create'])
    assert.match((await response.json()).message, /does not approve/)
  }
})
test('public endpoint rejects foreign origins, demo/support writes, malformed and oversized input', async () => {
  for (const [body, options, expected] of [
    [input, { origin: 'https://attacker.example' }, 403],
    [input, { origin: '' }, 403],
    [input, { cookie: 'demo=1' }, 403],
    [input, { cookie: 'support-view=opaque' }, 403],
    ['{broken', {}, 400],
    [{ ...input, email: 'invalid' }, {}, 400],
    ['x'.repeat(16385), {}, 413],
  ]) {
    const api = endpoint()
    assert.equal((await api.route.POST(request(body, options))).status, expected)
    assert.equal(api.records.length, 0)
  }
})
test('honeypot, durable limits and storage failures never report a real unsaved request as successful', async () => {
  const bot = endpoint()
  assert.equal((await bot.route.POST(request({ ...input, website: 'bot' }))).status, 200)
  assert.equal(bot.records.length, 0)
  for (const options of [{ total: 100 }, { personal: 3 }]) {
    const api = endpoint(options)
    assert.equal((await api.route.POST(request())).status, 429)
    assert.equal(api.records.length, 0)
  }
  const response = await endpoint({ offline: true }).route.POST(request())
  assert.equal(response.status, 503)
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  assert.doesNotMatch(JSON.stringify(await response.json()), /private connection/)
})
test('superadmin list and review require live elevation; stale reviews cannot mutate requests', async () => {
  const operations = []
  let denied = true
  const row = { id: '00000000-0000-4000-8000-000000000001', status: 'PENDING', revision: 2 }
  const tx = {
    $queryRaw: async () => { operations.push('lock') },
    schoolRequest: { findUnique: async () => row, update: async data => { operations.push(data) } },
    auditLog: { create: async data => { operations.push(data) } },
  }
  const prisma = { $transaction: fn => fn(tx), schoolRequest: { findMany: async () => { operations.push('read'); return [] } }, auditLog: tx.auditLog }
  const api = load('actions/school-requests.ts', { '@/utils/prisma': { prisma }, '@/utils/platform-admin': { requirePlatformAdmin: async () => { if (denied) throw Error('elevation required'); return { id: 'admin' } } } })
  const review = { id: row.id, revision: 2, status: 'CONTACTED', note: 'Followed up about campus interest.' }
  await assert.rejects(api.listSchoolRequests({}), /elevation/)
  await assert.rejects(api.reviewSchoolRequest(review), /elevation/)
  assert.equal(operations.length, 0)
  denied = false
  await assert.rejects(api.reviewSchoolRequest({ ...review, revision: 1 }), /Request changed/)
  assert.deepEqual(operations, ['lock'])
  operations.length = 0
  await api.reviewSchoolRequest(review)
  assert.equal(operations[1].data.reviewedBy, 'admin')
  assert.equal(operations[1].data.status, 'CONTACTED')
  assert.equal(operations[2].data.action, 'platform.school-request.review')
  assert.equal(operations[2].data.reason, review.note)
  operations.length = 0
  await api.listSchoolRequests({})
  assert.equal(operations[1].data.action, 'platform.school-requests.read')
})
test('school request migration persists pending interest and denies browser access or unaudited review state', async () => {
  const { PGlite } = require('@electric-sql/pglite')
  const db = new PGlite()
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE TABLE "User" (id TEXT PRIMARY KEY);')
    await db.exec(fs.readFileSync('prisma/migrations/20261008000000_school_requests/migration.sql', 'utf8'))
    await db.exec(`INSERT INTO "SchoolRequest" (id,"fullName",email,university,role,"updatedAt") VALUES ('request','Sam Student','sam@example.edu','Example University','STUDENT',NOW())`)
    assert.equal((await db.query('SELECT status FROM "SchoolRequest"')).rows[0].status, 'PENDING')
    for (const role of ['anon', 'authenticated']) for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) assert.equal((await db.query(`SELECT has_table_privilege($1,'"SchoolRequest"',$2) AS allowed`, [role, privilege])).rows[0].allowed, false)
    await assert.rejects(db.exec(`UPDATE "SchoolRequest" SET status='CONTACTED'`), /check constraint/)
    await assert.rejects(db.exec(`UPDATE "SchoolRequest" SET role='ADMIN'`), /check constraint/)
    await db.exec(`INSERT INTO "User" VALUES ('admin')`)
    await assert.rejects(db.exec(`UPDATE "SchoolRequest" SET status='CONTACTED',"reviewedBy"='admin',"reviewedAt"=NOW()`), /check constraint/)
    await db.exec(`UPDATE "SchoolRequest" SET status='CONTACTED',"reviewNote"='Followed up with requester.',"reviewedBy"='admin',"reviewedAt"=NOW(),revision=1`)
    assert.equal((await db.query('SELECT status FROM "SchoolRequest"')).rows[0].status, 'CONTACTED')
  } finally { await db.close() }
})
