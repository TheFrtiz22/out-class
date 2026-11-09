const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.replace('@/', '') + '.ts', mocks) : require(n), mod, mod.exports)
  return mod.exports
}
const { suggestClubs } = load('lib/club-suggestions.ts')
const c = (id, category, recruiting = false) => ({ id, name: id, category, recruiting })

test('same-category clubs, excluding ones already engaged with; stronger interest and open applications first', () => {
  const candidates = [c('tamid', 'Investing'), c('mii', 'Investing', true), c('vcg', 'Consulting'), c('acap', 'A cappella'), c('gmg', 'Consulting')]
  const signals = [{ clubId: 'tamid', category: 'Investing' }, { clubId: 'gmg', category: 'consulting' }, { clubId: 'x', category: 'Investing' }]
  assert.deepEqual(suggestClubs(candidates, signals), ['mii', 'vcg'])
  assert.deepEqual(suggestClubs(candidates, []), [])
  assert.equal(suggestClubs([...Array(10)].map((_, i) => c('i' + i, 'Investing')), signals).length, 3)
})

test('action reads only the signed-in student\'s own activity and discoverable clubs', async () => {
  const where = {}
  const club = (id, category) => ({ club: { id, category } })
  const prisma = {
    corkboardClub: { findMany: async q => { where.saved = q.where; return [club('a', 'Investing')] } },
    application: { findMany: async q => { where.applied = q.where; return [] } },
    clubMember: { findMany: async q => { where.joined = q.where; return [] } },
    eventAttendance: { findMany: async q => { where.attended = q.where; return [] } },
    club: { findMany: async q => { where.clubs = q.where; return [{ id: 'b', name: 'B', category: 'Investing', applicationOpen: true, applicationDeadline: null }, { id: 'a', name: 'A', category: 'Investing', applicationOpen: false, applicationDeadline: null }] } },
  }
  const { getClubSuggestions } = load('actions/club-suggestions.ts', { '@/utils/prisma': { prisma }, '@/utils/auth': { requireAuth: async () => ({ user: { id: 'me' } }) } })
  assert.deepEqual(await getClubSuggestions(), ['b'])
  assert.deepEqual(where.saved, { userId: 'me' }); assert.equal(where.applied.studentId, 'me'); assert.equal(where.joined.userId, 'me'); assert.equal(where.attended.studentId, 'me')
  assert.equal(where.clubs.isDiscoverable, true); assert.equal(where.clubs.suspendedAt, null)
})
