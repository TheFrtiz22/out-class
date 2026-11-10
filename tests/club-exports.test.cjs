const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.replace('@/', '') + '.ts', mocks) : require(n), mod, mod.exports)
  return mod.exports
}
const { csvCell, toCsv, csvFilename } = load('lib/csv.ts')
const { canExport } = load('lib/club-exports-access.ts')
const clubId = '00000000-0000-4000-8000-000000000002'

test('CSV quoting and spreadsheet formula injection protection', () => {
  assert.equal(csvCell('plain'), 'plain')
  assert.equal(csvCell('a,b'), '"a,b"')
  assert.equal(csvCell('say "hi"'), '"say ""hi"""')
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`)
  assert.equal(csvCell('+1'), "'+1")
  assert.equal(csvCell('@SUM(A1)'), "'@SUM(A1)")
  assert.equal(csvCell(-3), '-3')
  assert.equal(csvCell(null), '')
  assert.equal(csvCell(Number.NaN), '')
  assert.equal(toCsv(['A', 'B'], [[1, 'x']]), '﻿A,B\r\n1,x\r\n')
  assert.equal(csvFilename('McIntire Investment Institute!', 'roster', new Date('2026-11-09T12:00:00Z')), 'mcintire-investment-institute-roster-2026-11-09.csv')
})

test('export permissions require every listed capability', () => {
  assert.equal(canExport({ isOwner: true }, 'applicants'), true)
  assert.equal(canExport({ permissions: ['recruitment.manage'] }, 'applicants'), false)
  assert.equal(canExport({ permissions: ['recruitment.manage', 'applicants.identify'] }, 'applicants'), true)
  assert.equal(canExport({ permissions: ['members.manage'] }, 'roster'), true)
  assert.equal(canExport({ permissions: ['members.manage'], status: 'REMOVED' }, 'roster'), false)
  assert.equal(canExport({ permissions: ['meetings.attendance'] }, 'attendance'), true)
  assert.equal(canExport(null, 'attendance'), false)
})

function route({ deny = false, denyInTx = false } = {}) {
  const state = { audits: [], checks: [] }
  const member = { id: 'm1', userId: 'u1', isOwner: true, status: 'ACTIVE' }
  const tx = {
    club: { findUniqueOrThrow: async () => ({ name: 'Test Club' }) },
    clubMember: { findMany: async q => { assert.equal(q.where.clubId, clubId); return [{ title: '=evil', status: 'ACTIVE', joinedAt: new Date('2026-09-01T00:00:00Z'), cohort: null, isOwner: false, accessRole: 'MEMBER', user: { email: 'a@virginia.edu', studentProfile: { firstName: 'Ada', lastName: 'Lee', gradYear: 2028 } } }] } },
    eventAttendance: { findMany: async q => { assert.deepEqual(q.where, { event: { clubId } }); return [] } },
    auditLog: { create: async q => { state.audits.push(q.data) } },
  }
  const mod = load('app/api/club-exports/route.ts', {
    '@/utils/prisma': { prisma: { $transaction: async fn => fn(tx) } },
    '@/utils/auth': { requireClubPermission: async (id, perms) => { state.checks.push(['request', id, perms]); if (deny) throw new Error('denied'); return { user: { id: 'u1' }, membership: member } } },
    '@/lib/club-transaction-authorization': { authorizeClubTransaction: async (_tx, id, user, perms, opts) => { state.checks.push(['tx', id, user, perms, opts]); if (denyInTx) throw new Error('changed'); return member } },
  })
  state.get = q => mod.GET(new Request(`https://out-class.net/api/club-exports?${q}`))
  return state
}

test('roster export: authorized twice, audited, private headers, injection-safe', async () => {
  const s = route()
  const res = await s.get(`clubId=${clubId}&kind=roster`)
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('cache-control'), 'private, no-store')
  assert.match(res.headers.get('content-disposition'), /attachment; filename="test-club-roster-\d{4}-\d{2}-\d{2}\.csv"/)
  const body = await res.text()
  assert.match(body, /Ada,Lee,a@virginia\.edu,2028,'=evil,Member,Active,,2026-09-01/)
  assert.deepEqual(s.checks.map(c => c[0]), ['request', 'tx'])
  assert.deepEqual(s.checks[1][4], { readOnly: true, allowSuspendedRead: true })
  assert.deepEqual(s.audits, [{ actorId: 'u1', action: 'club.export.roster', targetId: clubId, clubId, details: { rows: 1 } }])
})

test('denied, revoked mid-request, or malformed exports return no data and no audit', async () => {
  for (const [opts, q, status] of [[{ deny: true }, `clubId=${clubId}&kind=roster`, 403], [{ denyInTx: true }, `clubId=${clubId}&kind=attendance`, 403], [{}, `clubId=${clubId}&kind=essays`, 400], [{}, `clubId=not-a-uuid&kind=roster`, 400]]) {
    const s = route(opts)
    const res = await s.get(q)
    assert.equal(res.status, status)
    assert.equal(s.audits.length, 0)
    assert.doesNotMatch(await res.text(), /virginia\.edu/)
  }
})

test('applicant export reuses the pipeline privacy projection', () => {
  const src = fs.readFileSync('lib/club-exports.ts', 'utf8')
  assert.match(src, /pipelineSummaryProjection\(app, member\)/)
  assert.match(src, /status: \{ not: "DRAFTING" \}/)
  assert.doesNotMatch(src, /gpa|satScore|actScore/)
})
