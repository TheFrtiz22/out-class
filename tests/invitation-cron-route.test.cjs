// The invitation cron route's club selection runs as real SQL against the full
// migration chain in PGlite; only SMTP delivery (processInvitationEmails) is stubbed.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const { PGlite } = require('@electric-sql/pglite')

function load(file, mocks) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => { if (name in mocks) return mocks[name]; throw Error(`Unexpected import ${name}`) }, mod, mod.exports)
  return mod.exports
}

async function migratedDatabase(t) {
  const db = new PGlite(); t.after(() => db.close())
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;')
  for (const name of fs.readdirSync('prisma/migrations').sort()) {
    const file = path.join('prisma/migrations', name, 'migration.sql')
    if (fs.existsSync(file)) await db.exec(fs.readFileSync(file, 'utf8'))
  }
  return db
}

// Prisma's tagged-template $queryRaw, executed as a parameterized PGlite query.
const queryRaw = db => async (strings, ...values) =>
  (await db.query(strings.reduce((sql, part, i) => sql + (i ? `$${i}` : '') + part, ''), values)).rows

async function seed(db) {
  await db.exec(`INSERT INTO "School"(id,key,name) VALUES('school-uva','uva','University of Virginia') ON CONFLICT DO NOTHING;
    INSERT INTO "User"(id,email) VALUES('inviter','inviter@virginia.edu');`)
  const clubs = { suspended: '2001-01-01', busy: '2002-01-01', quiet: '2003-01-01' }
  for (const [club, createdAt] of Object.entries(clubs)) {
    await db.exec(`INSERT INTO "Club"(id,slug,name,tagline,description,color,category,"suspendedAt")
      VALUES('${club}','${club}','${club}','','','#142d4e','Academic',${club === 'suspended' ? 'CURRENT_TIMESTAMP' : 'NULL'});
      INSERT INTO "ClubInvitation"(id,"clubId",email,"invitedBy","expiresAt") VALUES('invite-${club}','${club}','${club}@virginia.edu','inviter',CURRENT_TIMESTAMP + interval '7 days');
      INSERT INTO "InvitationDelivery"(id,"invitationId","requestedById","recipientEmail","idempotencyKey","createdAt")
      VALUES('delivery-${club}','invite-${club}','inviter','${club}@virginia.edu','key-${club}','${createdAt}');`)
  }
}

function route(db, processed, results = {}) {
  return load('app/api/internal/invitation-delivery/route.ts', {
    'node:crypto': require('node:crypto'),
    '@/utils/prisma': { prisma: { $queryRaw: queryRaw(db) } },
    '@/utils/invitation-delivery': { processInvitationEmails: async (clubId, limit) => { processed.push({ clubId, limit }); return results[clubId] ?? { sent: 1, failed: 0, cancelled: 0, uncertain: 0, remaining: 0 } } },
  })
}
const cron = (secret = 'cron-secret') => new Request('https://out-class.net/api/internal/invitation-delivery', { headers: { authorization: `Bearer ${secret}` } })

test('invitation cron skips suspended clubs instead of letting them block every other club', async t => {
  const db = await migratedDatabase(t); await seed(db)
  process.env.CRON_SECRET = 'cron-secret'; t.after(() => delete process.env.CRON_SECRET)
  const processed = []
  const response = await route(db, processed).GET(cron())
  assert.equal(response.status, 200)
  // The suspended club has the oldest queued row; it is skipped, and the next two clubs are served oldest-first.
  assert.deepEqual(processed.map(p => p.clubId), ['busy', 'quiet'])
  assert.deepEqual(await response.json(), { sent: 2, failed: 0, cancelled: 0, uncertain: 0, remaining: 0, clubs: 2 })
  // The suspended club's invitation is retained for restoration, untouched.
  assert.equal((await db.query(`SELECT status FROM "InvitationDelivery" WHERE id='delivery-suspended'`)).rows[0].status, 'QUEUED')
})

test('invitation cron ignores deliveries that are not yet due and reports an empty queue', async t => {
  const db = await migratedDatabase(t); await seed(db)
  await db.exec(`UPDATE "InvitationDelivery" SET "nextAttemptAt"=CURRENT_TIMESTAMP + interval '1 hour' WHERE id IN ('delivery-busy','delivery-quiet')`)
  process.env.CRON_SECRET = 'cron-secret'; t.after(() => delete process.env.CRON_SECRET)
  const processed = []
  const response = await route(db, processed).GET(cron())
  assert.deepEqual(processed, [])
  assert.deepEqual(await response.json(), { sent: 0, remaining: 0, clubs: 0 })
})

test('invitation cron stops after a global email pause and still rejects a wrong or missing secret', async t => {
  const db = await migratedDatabase(t); await seed(db)
  process.env.CRON_SECRET = 'cron-secret'; t.after(() => delete process.env.CRON_SECRET)
  const processed = []
  const paused = { busy: { sent: 0, failed: 0, cancelled: 0, uncertain: 0, remaining: 1, paused: true } }
  const response = await route(db, processed, paused).GET(cron())
  assert.deepEqual(processed.map(p => p.clubId), ['busy'], 'a paused provider must not be invoked for further clubs')
  assert.equal((await response.json()).paused, true)
  for (const request of [cron('wrong-secret'), new Request('https://out-class.net/api/internal/invitation-delivery')])
    assert.equal((await route(db, []).GET(request)).status, 401)
  delete process.env.CRON_SECRET
  assert.equal((await route(db, []).GET(cron())).status, 401, 'an unset CRON_SECRET fails closed')
})
