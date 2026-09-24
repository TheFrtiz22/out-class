const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const clubId = '00000000-0000-4000-8000-000000000001'
function load(file, mocks) {
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in mocks ? mocks[n] : require(n), mod, mod.exports)
  return mod.exports
}
test('claim requests reject managed clubs, reuse pending requests, and audit new requests', async () => {
  let claimedAt = new Date(), existing = null, created = 0, audited = 0
  const tx = { $queryRaw: async () => [], club: { findUnique: async () => ({ claimedAt }) }, clubMember: { count: async () => 0 }, clubClaim: { findFirst: async () => existing, create: async ({ data }) => { created++; return { ...data, id: 'claim' } } }, auditLog: { create: async () => { audited++ } } }
  const api = load('actions/club-workspace.ts', { '@/utils/prisma': { prisma: { ...tx, $transaction: fn => fn(tx) } }, '@/utils/auth': { requireAuth: async () => ({ user: { id: 'student' } }) } })
  await assert.rejects(api.requestClubClaim(clubId, 'I am the current president.'), /already managed/)
  claimedAt = null; existing = { id: 'pending' }
  assert.equal((await api.requestClubClaim(clubId, 'I am the current president.')).id, 'pending')
  assert.equal(created, 0)
  existing = null
  assert.equal((await api.requestClubClaim(clubId, 'I am the current president.')).userId, 'student')
  assert.equal(created, 1); assert.equal(audited, 1)
})
test('approving claims is atomic and cannot replace existing club ownership', async () => {
  let claimedAt = new Date(), owners = 0, changes = 0
  const tx = { $queryRaw: async () => [], clubClaim: { findUnique: async () => ({ id: clubId, clubId, userId: 'student', status: 'PENDING' }), updateMany: async () => ({ count: 1 }) }, club: { findUnique: async () => ({ claimedAt }), update: async () => { claimedAt = new Date() } }, user: { findUnique: async () => ({ disabledAt: null }) }, clubMember: { count: async () => owners, upsert: async ({ create }) => { assert.equal(create.userId, 'student'); assert.equal(create.isOwner, true); changes++ } }, auditLog: { create: async () => {} } }
  const api = load('actions/platform-admin.ts', { '@/utils/prisma': { prisma: { $transaction: fn => fn(tx) } }, '@/utils/platform-admin': { requirePlatformAdmin: async () => ({ id: 'admin' }) }, '@/lib/demo/validate': {}, '@/lib/permissions': load('lib/permissions.ts', {}) })
  await assert.rejects(api.changePlatformResource({ kind: 'claim', id: clubId, approved: true }, 'Verified official leadership.'), /already has an owner/)
  claimedAt = null; owners = 1
  await assert.rejects(api.changePlatformResource({ kind: 'claim', id: clubId, approved: true }, 'Verified official leadership.'), /already has an owner/)
  owners = 0
  await api.changePlatformResource({ kind: 'claim', id: clubId, approved: true }, 'Verified official leadership.')
  assert.equal(changes, 1)
  await assert.rejects(api.changePlatformResource({ kind: 'claim', id: clubId, approved: true }, 'Verified official leadership.'), /already has an owner/)
})
test('decline only closes a pending invitation belonging to the signed-in email and is audited', async () => {
  let available = true, audited = 0
  const tx = { $queryRaw: async () => [], clubInvitation: { findUnique: async () => ({ clubId }), updateMany: async ({ where, data }) => {
    assert.equal(where.email, 'student@virginia.edu'); assert.equal(where.acceptedAt, null); assert.equal(where.revokedAt, null); assert.equal(where.declinedAt, null); assert.ok(where.expiresAt.gt instanceof Date); assert.ok(data.declinedAt instanceof Date)
    const count = available ? 1 : 0; available = false; return { count }
  } }, auditLog: { create: async ({ data }) => { assert.equal(data.action, 'club.invite.decline'); audited++ } } }
  const api = load('actions/club-access.ts', { '@/utils/prisma': { prisma: { $transaction: fn => fn(tx) } }, '@/utils/auth': { requireAuth: async () => ({ user: { id: 'student', email: 'Student@virginia.edu' } }) }, '@/lib/permissions': load('lib/permissions.ts', {}), '@/lib/auth': load('lib/auth.ts', {}) })
  await api.declineClubInvitation(clubId)
  await assert.rejects(api.declineClubInvitation(clubId), /unavailable or expired/)
  assert.equal(audited, 1)
})
