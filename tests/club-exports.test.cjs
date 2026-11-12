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
const { canExport, clubExportHref } = load('lib/club-exports-access.ts')
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

// The real server switch reader, with the server-only marker stubbed.
const clubFeatures = () => load('utils/club-features.ts', { 'server-only': {} })
const on = { csvExport: true }
function route({ deny = false, denyInTx = false, features = on } = {}) {
  const state = { audits: [], checks: [], featureReads: [] }
  const member = { id: 'm1', userId: 'u1', isOwner: true, status: 'ACTIVE' }
  const tx = {
    club: { findUniqueOrThrow: async () => ({ name: 'Test Club' }), findUnique: async q => { state.featureReads.push(q); return { features } } },
    clubMember: { findMany: async q => { assert.deepEqual(q.where, { clubId, status: 'ACTIVE' }); return [{ title: '=evil', cohort: null, isOwner: false, accessRole: 'MEMBER', role: 'GENERAL_MEMBER', interviewOffices: [], user: { email: 'ada@virginia.edu', studentProfile: { firstName: 'Ada', lastName: 'Lee', gradYear: 2028, computingId: 'al1x' }, applications: [] } }] } },
    eventAttendance: { findMany: async q => { assert.deepEqual(q.where, { event: { clubId } }); return [] } },
    auditLog: { create: async q => { state.audits.push(q.data) } },
  }
  const mod = load('app/api/club-exports/route.ts', {
    '@/utils/club-features': clubFeatures(),
    '@/utils/support-audit': { auditSupportAction: async () => {} },
    '@/utils/prisma': { prisma: { $transaction: async fn => fn(tx), auditLog: { findMany: async () => [] } } },
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
  assert.match(body, /^First name,Last name,Grad year,Role within org,Exec,Recruitment cycle,Email,Computing ID\r\nAda,Lee,2028,'=evil,false,,ada@virginia\.edu,al1x\r\n$/)
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

test('CSV guard also covers tab/CR prefixes, embedded newlines and the BOM', () => {
  assert.equal(csvCell('\tcmd'), "'\tcmd")
  assert.equal(csvCell('\rcmd'), `"'\rcmd"`)
  assert.equal(csvCell('-2+3'), "'-2+3")
  assert.equal(csvCell('line 1\nline 2'), '"line 1\nline 2"')
  assert.equal(csvCell('a = b'), 'a = b')
  assert.equal(csvCell('Zoë Ñúñez'), 'Zoë Ñúñez')
  assert.ok(toCsv(['A'], []).startsWith('﻿A\r\n'))
})

test('RSVP export needs attendance capability; filters only attach to the kind they narrow', () => {
  assert.equal(canExport({ permissions: ['meetings.attendance'] }, 'rsvps'), true)
  assert.equal(canExport({ permissions: ['meetings.manage'] }, 'rsvps'), false)
  assert.equal(canExport({ permissions: ['recruitment.manage', 'applicants.identify'] }, 'rsvps'), false)
  const round = '00000000-0000-4000-8000-0000000000aa'
  assert.equal(clubExportHref(clubId, 'applicants', round), `/api/club-exports?clubId=${clubId}&kind=applicants&roundId=${round}`)
  assert.equal(clubExportHref(clubId, 'rsvps', round), `/api/club-exports?clubId=${clubId}&kind=rsvps&eventId=${round}`)
  assert.equal(clubExportHref(clubId, 'roster', round), `/api/club-exports?clubId=${clubId}&kind=roster`)
})

// Route harness with real permission logic: the mocked auth helpers apply
// lib/permissions to a per-club membership map, so denials come from capabilities.
const otherClub = '00000000-0000-4000-8000-000000000009'
const roundA = '00000000-0000-4000-8000-0000000000a1'
const eventA = '00000000-0000-4000-8000-0000000000e1'
const { hasPermission } = load('lib/permissions.ts')
function harness(memberships, data = {}, { support = null, profileFieldVisibility = null, features = on, suspendedAt = null } = {}) {
  const state = { audits: [], supportAudits: [], queries: {} }
  const access = id => { const m = memberships[id]; return m ? { id: 'm1', userId: 'u1', status: 'ACTIVE', ...m } : null }
  const check = (id, perms) => { const m = access(id); if (!m || !perms.every(p => hasPermission(m, p))) throw new Error('You do not have permission for this club action.'); return m }
  const record = (name, rows) => async q => { state.queries[name] = q; return rows }
  const tx = {
    club: { findUniqueOrThrow: async () => ({ name: 'Test Club', profileFieldVisibility, suspendedAt }), findUnique: async ({ where }) => where.id === clubId ? { features } : null },
    applicantRecusal: { findMany: async q => { state.queries.applicantRecusal = q; return (data.recusals || []).filter(id => q.where.applicationId.in.includes(id)).map(applicationId => ({ applicationId })) } },
    application: { findMany: record('application', data.applications || []) },
    pipelineRound: { findMany: record('pipelineRound', data.rounds || []) },
    clubMember: { findMany: record('clubMember', data.members || []) },
    eventAttendance: { findMany: record('eventAttendance', data.attendance || []) },
    eventRsvp: { findMany: record('eventRsvp', data.rsvps || []) },
    auditLog: { create: async q => { state.audits.push(q.data) } },
  }
  // The real support-audit module, with the view-as session and cookie stubbed.
  const supportAudit = load('utils/support-audit.ts', {
    'next/headers': { cookies: async () => ({ has: name => !!support && name === 'outclass-platform-view' }) },
    '@/utils/platform-view-as': { platformViewSession: async () => support },
    '@/utils/prisma': { prisma: { auditLog: { create: async q => { state.supportAudits.push(q.data) } } } },
  })
  const mod = load('app/api/club-exports/route.ts', {
    '@/utils/club-features': clubFeatures(),
    '@/utils/support-audit': supportAudit,
    '@/utils/prisma': { prisma: { $transaction: async fn => fn(tx), auditLog: { findMany: async () => [] } } },
    '@/utils/auth': { requireClubPermission: async (id, perms, opts) => { state.requestOpts = opts; check(id, perms); return { user: { id: 'u1' } } } },
    '@/lib/club-transaction-authorization': { authorizeClubTransaction: async (_tx, id, _user, perms, opts) => { state.txOpts = opts; return check(id, perms) } },
  })
  state.get = q => mod.GET(new Request(`https://out-class.net/api/club-exports?${q}`))
  return state
}
const person = (first, last, email, anonymousApplications = 0) => ({ email, studentProfile: { firstName: first, lastName: last }, applications: Array.from({ length: anonymousApplications }, (_, i) => ({ id: `a${i}` })) })

test('member without the capability, and another club\'s leader, are denied with no data and no audit', async () => {
  const cases = [
    [{ [clubId]: { permissions: [] } }, 'rsvps'],
    [{ [clubId]: { permissions: ['recruitment.manage'] } }, 'applicants'],
    [{ [clubId]: { permissions: ['meetings.attendance'] } }, 'roster'],
    [{ [otherClub]: { isOwner: true } }, 'applicants'],
    [{ [otherClub]: { isOwner: true } }, 'attendance'],
    [{ [clubId]: { isOwner: true, status: 'REMOVED' } }, 'rsvps'],
  ]
  for (const [memberships, kind] of cases) {
    const s = harness(memberships, { rsvps: [{ createdAt: new Date(), event: { title: 'E', date: new Date() }, user: person('Ada', 'Lee', 'ada@virginia.edu') }] })
    const res = await s.get(`clubId=${clubId}&kind=${kind}`)
    assert.equal(res.status, 403, `${kind} ${JSON.stringify(memberships)}`)
    assert.equal(await res.text(), 'Export unavailable')
    assert.equal(s.audits.length, 0)
    assert.deepEqual(Object.keys(s.queries), [])
  }
})

test('a filter on the wrong kind or a malformed filter is rejected before any read', async () => {
  for (const q of [`kind=roster&roundId=${roundA}`, `kind=applicants&eventId=${eventA}`, `kind=rsvps&roundId=${roundA}`, `kind=rsvps&eventId=nope`]) {
    const s = harness({ [clubId]: { isOwner: true } })
    const res = await s.get(`clubId=${clubId}&${q}`)
    assert.equal(res.status, 400, q)
    assert.equal(s.audits.length, 0)
  }
})

test('RSVP export: club-scoped, event filter, anonymous applicants masked, audited', async () => {
  const s = harness({ [clubId]: { permissions: ['meetings.attendance'] } }, { rsvps: [
    { createdAt: new Date('2026-11-01T15:00:00Z'), event: { title: '=Info session', date: new Date('2026-11-05T22:00:00Z') }, user: person('Ada', 'Lee', 'ada@virginia.edu') },
    { createdAt: new Date('2026-11-02T15:00:00Z'), event: { title: '=Info session', date: new Date('2026-11-05T22:00:00Z') }, user: person('Hidden', 'Person', 'hidden@virginia.edu', 1) },
  ] })
  const res = await s.get(`clubId=${clubId}&kind=rsvps&eventId=${eventA}`)
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('content-type'), 'text/csv; charset=utf-8')
  assert.equal(res.headers.get('cache-control'), 'private, no-store')
  assert.match(res.headers.get('content-disposition'), /attachment; filename="test-club-rsvps-\d{4}-\d{2}-\d{2}\.csv"/)
  const body = await res.text()
  const lines = body.replace(/^\uFEFF/, '').trim().split('\r\n')
  assert.equal(lines[0], 'Event,Event date,First name,Last name,Email,RSVP at')
  assert.equal(lines[1], "'=Info session,2026-11-05,Ada,Lee,ada@virginia.edu,2026-11-01T15:00:00.000Z")
  assert.equal(lines[2], "'=Info session,2026-11-05,Anonymous applicant,,,2026-11-02T15:00:00.000Z")
  assert.doesNotMatch(body, /Hidden|hidden@/)
  const q = s.queries.eventRsvp
  assert.deepEqual(q.where, { event: { clubId, publication: { isNot: null } }, eventId: eventA })
  assert.deepEqual(q.select.user.select.applications.where, { clubId, status: { not: 'DRAFTING' }, round: { anonymousReview: true } })
  assert.deepEqual(s.audits, [{ actorId: 'u1', action: 'club.export.rsvps', targetId: clubId, clubId, details: { rows: 2, eventId: eventA } }])
})

test('attendance export masks applicants in anonymous review, like the attendance screen', async () => {
  const s = harness({ [clubId]: { permissions: ['meetings.attendance'] } }, { attendance: [
    { checkedInAt: new Date('2026-11-03T23:00:00Z'), event: { title: 'GBM', date: new Date('2026-11-03T22:00:00Z') }, student: person('Hidden', 'Person', 'hidden@virginia.edu', 1) },
  ] })
  const body = await (await s.get(`clubId=${clubId}&kind=attendance`)).text()
  assert.match(body, /GBM,2026-11-03,Anonymous applicant,,,2026-11-03T23:00:00\.000Z/)
  assert.doesNotMatch(body, /Hidden|hidden@/)
  assert.deepEqual(s.queries.eventAttendance.where, { event: { clubId } })
  assert.deepEqual(s.audits[0].details, { rows: 1 })
})

function application(id, { anonymous = false, studentId = 's-' + id, evaluations = [] } = {}) {
  return { id, roundId: roundA, status: 'SUBMITTED', studentId, submittedAt: new Date('2026-10-01T12:00:00Z'), recruitmentCycle: { name: 'Fall 2026' },
    round: { anonymousReview: anonymous },
    student: { email: `${id}@virginia.edu`, studentProfile: { firstName: 'Real' + id, lastName: 'Name', computingId: 'cid' + id, major: 'Economics', gradYear: 2028, transferStudent: false, gpa: 3.9, satScore: 1500, actScore: null } },
    evaluations, interviewAssignments: [] }
}

test('applicant export: per round, anonymous round hides names, no notes/votes/resume columns, scores only when visible', async () => {
  const evals = [{ interviewerId: 'm2', roundId: roundA, submittedAt: new Date(), score: 4 }]
  const recruiter = { permissions: ['recruitment.manage', 'applicants.identify'] }
  const s = harness({ [clubId]: recruiter }, { rounds: [{ id: roundA, name: 'First round' }], members: [{ userId: 's-x1', title: null, isOwner: false, accessRole: 'ADMIN', role: 'GENERAL_MEMBER', interviewOffices: [] }],
    applications: [application('x1', { evaluations: evals }), application('x2', { anonymous: true, evaluations: evals })] })
  const res = await s.get(`clubId=${clubId}&kind=applicants&roundId=${roundA}`)
  assert.equal(res.status, 200)
  const body = await res.text()
  const [header, identified, anonymous] = body.replace(/^\uFEFF/, '').trim().split('\r\n')
  assert.equal(header, 'First name,Last name,Grad year,Role within org,Exec,Recruitment cycle,Email,Computing ID,Status,Round,Submitted,Average score,Reviews submitted')
  assert.doesNotMatch(header, /note|vote|ballot|resume|résumé|gpa|sat|act\b|linkedin/i)
  assert.match(identified, /^Realx1,Name,2028,Admin,true,Fall 2026,x1@virginia\.edu,cidx1,Submitted,/)
  assert.match(anonymous, /^Applicant,[^,]+,,,,Fall 2026,,,Submitted,/)
  assert.doesNotMatch(body, /cidx2/)
  // Only the identified applicant is looked up as a club member.
  assert.deepEqual(s.queries.clubMember.where, { clubId, userId: { in: ['s-x1'] } })
  assert.doesNotMatch(body, /Realx2|x2@virginia\.edu/)
  // This recruiter has no interview read capability, so no score columns are filled.
  assert.match(identified, /,First round,2026-10-01,,$/)
  assert.doesNotMatch(body, /3\.9|1500/)
  assert.deepEqual(s.queries.application.where, { clubId, status: { not: 'DRAFTING' }, roundId: roundA })
  assert.deepEqual(s.audits, [{ actorId: 'u1', action: 'club.export.applicants', targetId: clubId, clubId, details: { rows: 2, roundId: roundA } }])
})

test('roster: pilot column order, exec derived from role data, cycle from accepted application else cohort', async () => {
  const m = (over) => ({ title: null, cohort: null, isOwner: false, accessRole: 'MEMBER', role: 'GENERAL_MEMBER', interviewOffices: [],
    user: { email: 'f@virginia.edu', studentProfile: { firstName: 'F', lastName: 'L', gradYear: 2027, computingId: 'fl1' }, applications: [] }, ...over })
  const s = harness({ [clubId]: { permissions: ['members.manage'] } }, { members: [
    m({ title: 'VP of Recruitment', accessRole: 'RECRUITING_ADMIN', user: { email: 'vp@virginia.edu', studentProfile: { firstName: 'Vee', lastName: 'Pee', gradYear: 2027, computingId: 'vp9' }, applications: [{ recruitmentCycle: { name: 'Spring 2026' } }] } }),
    m({ isOwner: true, accessRole: 'OWNER' }),
    m({ interviewOffices: ['BOARD'] }),
    m({ role: 'PRESIDENT' }),
    m({ accessRole: 'INTERVIEWER', cohort: 'Fall 2025' }),
    m({}),
  ] })
  const body = (await (await s.get(`clubId=${clubId}&kind=roster`)).text()).replace(/^﻿/, '')
  assert.deepEqual(body.trim().split('\r\n'), [
    'First name,Last name,Grad year,Role within org,Exec,Recruitment cycle,Email,Computing ID',
    'Vee,Pee,2027,VP of Recruitment,true,Spring 2026,vp@virginia.edu,vp9',
    'F,L,2027,Owner,true,,f@virginia.edu,fl1',
    'F,L,2027,Member,true,,f@virginia.edu,fl1',
    'F,L,2027,Member,true,,f@virginia.edu,fl1',
    'F,L,2027,Interviewer,false,Fall 2025,f@virginia.edu,fl1',
    'F,L,2027,Member,false,,f@virginia.edu,fl1',
  ])
  const sel = s.queries.clubMember.select.user.select.applications
  assert.deepEqual(sel.where, { clubId, status: 'ACCEPTED', recruitmentCycleId: { not: null } })
  assert.equal(sel.take, 1)
})

const csvLines = async res => (await res.text()).replace(/^﻿/, '').trim().split('\r\n')
const closingReader = { permissions: ['recruitment.manage', 'applicants.identify'], interviewOffices: ['BOARD'] }
const scored = [{ interviewerId: 'm2', roundId: roundA, submittedAt: new Date(), score: 4 }, { interviewerId: 'm3', roundId: roundA, submittedAt: new Date(), score: 2 }]

test('recusal blanks score cells for that applicant only; the row and name stay', async () => {
  const s = harness({ [clubId]: closingReader }, { rounds: [{ id: roundA, name: 'R1' }], recusals: ['x1'],
    applications: [application('x1', { evaluations: scored }), application('x2', { evaluations: scored })] })
  const [, x1, x2] = await csvLines(await s.get(`clubId=${clubId}&kind=applicants`))
  assert.match(x1, /^Realx1,Name,.*,R1,2026-10-01,,$/)
  assert.match(x2, /^Realx2,Name,.*,R1,2026-10-01,3,2$/)
  assert.deepEqual(s.queries.applicantRecusal.where, { clubId, memberId: 'm1', liftedAt: null, applicationId: { in: ['x1', 'x2'] } })
})

test('anonymous round with score visibility: scores shown, identity still masked', async () => {
  const s = harness({ [clubId]: closingReader }, { rounds: [{ id: roundA, name: 'R1' }], members: [{ userId: 's-x2', title: 'Treasurer', isOwner: false, accessRole: 'ADMIN', role: 'GENERAL_MEMBER', interviewOffices: [] }],
    applications: [application('x2', { anonymous: true, evaluations: scored })] })
  const body = await (await s.get(`clubId=${clubId}&kind=applicants`)).text()
  const [, row] = body.replace(/^﻿/, '').trim().split('\r\n')
  assert.match(row, /^Applicant,[^,]+,,,,Fall 2026,,,.*,3,2$/)
  assert.doesNotMatch(body, /Realx2|x2@|cidx2|Treasurer|2028/)
  assert.equal(s.queries.clubMember, undefined)
})

test('identified non-member applicant has blank Role and Exec', async () => {
  const s = harness({ [clubId]: closingReader }, { rounds: [{ id: roundA, name: 'R1' }], applications: [application('x3')] })
  const [, row] = await csvLines(await s.get(`clubId=${clubId}&kind=applicants`))
  assert.match(row, /^Realx3,Name,2028,,,Fall 2026,x3@virginia\.edu,cidx3,/)
})

test('clubs that hide class year get no Grad year column in roster or applicants', async () => {
  const hidden = { profileFieldVisibility: { academicYear: false } }
  const roster = harness({ [clubId]: { isOwner: true } }, { members: [{ title: null, cohort: null, isOwner: false, accessRole: 'MEMBER', role: 'GENERAL_MEMBER', interviewOffices: [], user: { email: 'f@virginia.edu', studentProfile: { firstName: 'F', lastName: 'L', gradYear: 2027, computingId: 'fl1' }, applications: [] } }] }, hidden)
  assert.deepEqual(await csvLines(await roster.get(`clubId=${clubId}&kind=roster`)), ['First name,Last name,Role within org,Exec,Recruitment cycle,Email,Computing ID', 'F,L,Member,false,,f@virginia.edu,fl1'])
  const apps = harness({ [clubId]: closingReader }, { rounds: [{ id: roundA, name: 'R1' }], applications: [application('x1')] }, hidden)
  const [header, row] = await csvLines(await apps.get(`clubId=${clubId}&kind=applicants`))
  assert.equal(header, 'First name,Last name,Role within org,Exec,Recruitment cycle,Email,Computing ID,Status,Round,Submitted,Average score,Reviews submitted')
  assert.doesNotMatch(row, /2028/)
})

test('attendance export with an event filter scopes the query and records the event in the audit', async () => {
  const s = harness({ [clubId]: { permissions: ['meetings.attendance'] } }, { attendance: [] })
  assert.deepEqual(await csvLines(await s.get(`clubId=${clubId}&kind=attendance&eventId=${eventA}`)), ['Meeting,Meeting date,First name,Last name,Email,Checked in'])
  assert.deepEqual(s.queries.eventAttendance.where, { event: { clubId }, eventId: eventA })
  assert.deepEqual(s.audits, [{ actorId: 'u1', action: 'club.export.attendance', targetId: clubId, clubId, details: { rows: 0, eventId: eventA } }])
})

test('RECRUITMENT_LEAD club role with no title is Exec', async () => {
  const s = harness({ [clubId]: { isOwner: true } }, { members: [{ title: '  ', cohort: null, isOwner: false, accessRole: 'MEMBER', role: 'RECRUITMENT_LEAD', interviewOffices: [], user: { email: 'r@virginia.edu', studentProfile: { firstName: 'R', lastName: 'L', gradYear: 2027, computingId: 'rl2' }, applications: [] } }] })
  assert.deepEqual((await csvLines(await s.get(`clubId=${clubId}&kind=roster`)))[1], 'R,L,2027,Member,true,,r@virginia.edu,rl2')
})

test('support view-as export writes a support audit with admin actor, target user and session id', async () => {
  const support = { id: 'support-session-1', actorId: 'admin-1', targetUserId: 'u1', reason: 'Pilot support ticket' }
  const s = harness({ [clubId]: { isOwner: true } }, { members: [] }, { support })
  const res = await s.get(`clubId=${clubId}&kind=roster`)
  assert.equal(res.status, 200)
  assert.deepEqual(s.supportAudits, [{ actorId: 'admin-1', effectiveUserId: 'u1', supportSessionId: 'support-session-1',
    action: 'platform.impersonation.club-export.roster', targetId: clubId, details: { outcome: 'attempt', reason: 'Pilot support ticket' } }])
  assert.equal(s.audits.length, 1)
  const plain = harness({ [clubId]: { isOwner: true } }, { members: [] })
  await plain.get(`clubId=${clubId}&kind=roster`)
  assert.deepEqual(plain.supportAudits, [])
})

// ---- csvExport pilot switch (PR #273 registry; default off) ----
const kinds = [['applicants', { permissions: ['recruitment.manage', 'applicants.identify'] }], ['roster', { permissions: ['members.manage'] }], ['attendance', { permissions: ['meetings.attendance'] }], ['rsvps', { permissions: ['meetings.attendance'] }]]
const sample = { rounds: [{ id: roundA, name: 'R1' }], applications: [application('x1')],
  members: [{ title: null, cohort: null, isOwner: false, accessRole: 'MEMBER', role: 'GENERAL_MEMBER', interviewOffices: [], user: { email: 'f@virginia.edu', studentProfile: { firstName: 'F', lastName: 'L', gradYear: 2027, computingId: 'fl1' }, applications: [] } }],
  attendance: [{ checkedInAt: new Date(), event: { title: 'GBM', date: new Date() }, student: person('Ada', 'Lee', 'ada@virginia.edu') }],
  rsvps: [{ createdAt: new Date(), event: { title: 'E', date: new Date() }, user: person('Ada', 'Lee', 'ada@virginia.edu') }] }

test('csvExport off (NULL, {}, false, malformed): every kind refused with a plain 403, no rows read, no audit', async () => {
  for (const [kind, access] of kinds) for (const features of [null, {}, { csvExport: false }, '{"csvExport":true}', { csvExport: 'true' }]) {
    const s = harness({ [clubId]: access }, sample, { features })
    const res = await s.get(`clubId=${clubId}&kind=${kind}`)
    assert.equal(res.status, 403, `${kind} ${JSON.stringify(features)}`)
    assert.equal(res.headers.get('cache-control'), 'private, no-store')
    assert.equal(res.headers.get('content-disposition'), null)
    assert.equal(await res.text(), 'CSV export is not enabled for this club.')
    assert.deepEqual(Object.keys(s.queries), [], 'no export query ran')
    assert.equal(s.audits.length, 0)
    assert.deepEqual(s.supportAudits, [])
  }
})

test('csvExport on: every kind exports, with exactly one audit row', async () => {
  for (const [kind, access] of kinds) {
    const s = harness({ [clubId]: access }, sample)
    const res = await s.get(`clubId=${clubId}&kind=${kind}`)
    assert.equal(res.status, 200, kind)
    assert.match(res.headers.get('content-type'), /^text\/csv/)
    assert.deepEqual(s.audits.map(a => a.action), [`club.export.${kind}`])
  }
})

test('the switch is checked after both capability checks: outsiders get the generic refusal either way', async () => {
  for (const features of [null, on]) {
    const outsider = harness({ [otherClub]: { isOwner: true } }, sample, { features })
    const res = await outsider.get(`clubId=${clubId}&kind=roster`)
    assert.equal(res.status, 403)
    assert.equal(await res.text(), 'Export unavailable')
  }
  const r = route({ features: null })
  assert.equal((await r.get(`clubId=${clubId}&kind=roster`)).status, 403)
  assert.deepEqual(r.checks.map(c => c[0]), ['request', 'tx'], 'auth ran first')
  assert.deepEqual(r.featureReads, [{ where: { id: clubId }, select: { features: true } }], 'read on the server via clubHasFeature')
  const denied = route({ deny: true, features: null })
  assert.equal(await (await denied.get(`clubId=${clubId}&kind=roster`)).text(), 'Export unavailable')
  assert.deepEqual(denied.featureReads, [], 'switch never read for a denied caller')
})

test('support view-as: may export when on (both audits written); refused when off with no audits', async () => {
  const support = { id: 'support-session-2', actorId: 'admin-1', targetUserId: 'u1', reason: 'Pilot support ticket' }
  const onRun = harness({ [clubId]: { isOwner: true } }, sample, { support })
  assert.equal((await onRun.get(`clubId=${clubId}&kind=roster`)).status, 200)
  assert.deepEqual(onRun.audits.map(a => a.action), ['club.export.roster'])
  assert.deepEqual(onRun.supportAudits.map(a => [a.action, a.actorId, a.supportSessionId]), [['platform.impersonation.club-export.roster', 'admin-1', 'support-session-2']])
  const offRun = harness({ [clubId]: { isOwner: true } }, sample, { support, features: null })
  assert.equal((await offRun.get(`clubId=${clubId}&kind=roster`)).status, 403)
  assert.equal(offRun.audits.length + offRun.supportAudits.length, 0)
})

test('suspended club with csvExport on keeps exporting (suspended-read allowed at both checks)', async () => {
  for (const [kind, access] of kinds) {
    const s = harness({ [clubId]: access }, sample, { suspendedAt: new Date('2026-11-01T00:00:00Z') })
    assert.equal((await s.get(`clubId=${clubId}&kind=${kind}`)).status, 200, kind)
    assert.deepEqual(s.requestOpts, { allowSuspendedRead: true })
    assert.deepEqual(s.txOpts, { readOnly: true, allowSuspendedRead: true })
    assert.equal(s.audits.length, 1)
  }
})

// UI: the real ClubExportLink rendered with stubbed auth/demo hooks.
function renderLink({ features, demo = false, membership = { isOwner: true }, kind = 'roster', showNotice, user = true } = {}) {
  const React = require('react')
  const Button = ({ children, asChild, variant, size, ...rest }) => asChild ? children : React.createElement('button', rest, children)
  const { ClubExportLink } = load('components/club-export-link.tsx', {
    '@/components/icons': { Download: () => null },
    '@/components/ui/button': { Button },
    '@/contexts/demo-context': { useDemoMode: () => ({ isDemoEnabled: demo }) },
    '@/contexts/auth-context': { useAuth: () => ({ user: user ? { memberships: [{ clubId, club: { id: clubId, features } }, { clubId: otherClub, club: { id: otherClub, features: on } }] } : null }) },
  })
  return require('react-dom/server').renderToStaticMarkup(React.createElement(ClubExportLink, { clubId, kind, membership, label: 'Export CSV', showNotice }))
}

test('UI: export link shown only when the club switch is on; off shows one short note instead', () => {
  assert.match(renderLink({ features: on }), /<a href="\/api\/club-exports\?clubId=[^"]+&amp;kind=roster" download="">Export CSV<\/a>/)
  for (const features of [undefined, null, {}, { csvExport: false }]) {
    const html = renderLink({ features })
    assert.doesNotMatch(html, /<a |Export CSV/, JSON.stringify(features))
    assert.match(html, /CSV export isn&#x27;t turned on for this club yet\./)
  }
  assert.equal(renderLink({ features: null, showNotice: false }), '', 'second link beside the first adds no duplicate note')
  assert.equal(renderLink({ features: on, membership: { permissions: [] } }), '', 'no capability: nothing, not even the note')
  assert.equal(renderLink({ features: null, membership: { permissions: [] } }), '')
  assert.equal(renderLink({ features: on, demo: true }), '', 'demo stays hidden')
  assert.equal(renderLink({ features: on, user: false }), '', 'no account loaded yet: nothing')
  assert.match(fs.readFileSync('components/organization-member-management.tsx', 'utf8'), /kind="attendance" membership=\{data\.actor\} label="Export attendance" showNotice=\{false\}/)
})

test('switch state reaches the UI only through the account\'s own memberships, not application clubs', () => {
  const src = fs.readFileSync('lib/account-data.ts', 'utf8')
  assert.doesNotMatch(src.slice(src.indexOf('export const accountClubSelect'), src.indexOf('} as const')), /features/)
  assert.match(src, /memberships: \{\n    where: \{ status: "ACTIVE" \},\n    include: \{ club: \{ select: accountMembershipClubSelect \} \}/)
  assert.match(src, /applications: \{\n    omit: \{ anonymousReviewText: true \},\n    include: \{ club: \{ select: accountClubSelect \} \}/)
})
