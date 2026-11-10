// The club profile field setting also governs the member roster, applicant CSV export and voting setup.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.replace('@/', '') + '.ts', mocks) : n.startsWith('@/utils/') || n.startsWith('@/actions/') ? {} : require(n), mod, mod.exports)
  return mod.exports
}
const lib = load('lib/profile-field-visibility.ts')
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const clubId = id(1), roundId = id(2), cycleId = id(3)

// ---- Member roster --------------------------------------------------------
test('roster reads clear hidden academic fields on the server and keep identity, role and access', () => {
  const rows = [{ id: 'm1', role: 'GENERAL_MEMBER', accessRole: 'ADMIN', permissions: ['members.manage'], isOwner: false, club: { profileFieldVisibility: { major: false, academicYear: false } }, user: { email: 'ada@virginia.edu', studentProfile: { firstName: 'Ada', lastName: 'Lee', major: 'Math', academicYear: 'Third Year' } } }]
  const [m] = lib.rosterMembers(rows)
  assert.equal('club' in m, false, 'the club relation is not returned')
  assert.deepEqual(m.user.studentProfile, { firstName: 'Ada', lastName: 'Lee', major: '', academicYear: '' })
  assert.equal(m.user.email, 'ada@virginia.edu'); assert.equal(m.accessRole, 'ADMIN'); assert.deepEqual(m.permissions, ['members.manage'])
  const [d] = lib.rosterMembers([{ ...rows[0], club: { profileFieldVisibility: null } }])
  assert.deepEqual(d.user.studentProfile, rows[0].user.studentProfile, 'defaults keep major and year')
})

test('getClubMembers and getClubAccess read the setting with the members and return filtered profiles', async () => {
  let query
  const rows = [{ id: 'm1', clubId, club: { profileFieldVisibility: { major: false } }, user: { email: 'ada@virginia.edu', studentProfile: { firstName: 'Ada', lastName: 'Lee', major: 'Math', gradYear: 2028, transferStudent: false } } }]
  const actions = load('actions/club-access.ts', {
    '@/utils/auth': { requireClubPermission: async () => ({ user: { id: 'u' } }), requireAuth: async () => ({ user: { id: 'u' } }) },
    '@/utils/prisma': { prisma: { clubMember: { findMany: async q => { query = q; return structuredClone(rows) } }, clubInvitation: { findMany: async () => [] } } },
  })
  const [member] = await actions.getClubMembers(clubId)
  assert.deepEqual(query.include.club, { select: { profileFieldVisibility: true } })
  assert.equal(member.user.studentProfile.major, '')
  assert.match(member.user.studentProfile.academicYear, /Year|Student/)
  assert.equal('club' in member, false)
  const access = await actions.getClubAccess(clubId)
  assert.equal(access.members[0].user.studentProfile.major, '')
  const src = fs.readFileSync('actions/organization-members.ts', 'utf8')
  assert.match(src, /select: \{ schoolId: true, profileFieldVisibility: true \}/)
  assert.match(src, /restrictProfileFields\(memberAcademicProfile\(m\.user\.studentProfile\), profileFields\)/)
  assert.match(src, /return \{ actor, profileFields, members:/)
})

// ---- Applicant CSV export --------------------------------------------------
function exportRoute(profileFieldVisibility) {
  const member = { id: 'm1', userId: 'u1', isOwner: true, status: 'ACTIVE' }
  const tx = {
    club: { findUniqueOrThrow: async () => ({ name: 'Test Club', profileFieldVisibility }) },
    application: { findMany: async () => [{ id: id(10), roundId, status: 'IN_REVIEW', studentId: id(11), submittedAt: new Date('2026-10-01T00:00:00Z'), recruitmentCycle: { name: 'Fall' }, round: { anonymousReview: false }, student: { email: 'ada@virginia.edu', studentProfile: { firstName: 'Ada', lastName: 'Lee', major: 'Mathematics', gradYear: 2028, transferStudent: false, gpa: 3.9, satScore: 1500, actScore: 34 } }, evaluations: [], interviewAssignments: [] }] },
    pipelineRound: { findMany: async () => [{ id: roundId, name: 'Review' }] },
    clubMember: { findMany: async () => [{ title: null, status: 'ACTIVE', joinedAt: new Date('2026-09-01T00:00:00Z'), cohort: null, isOwner: false, accessRole: 'MEMBER', user: { email: 'ada@virginia.edu', studentProfile: { firstName: 'Ada', lastName: 'Lee', gradYear: 2028 } } }] },
    auditLog: { create: async () => {} },
  }
  const mod = load('app/api/club-exports/route.ts', {
    '@/utils/prisma': { prisma: { $transaction: async fn => fn(tx) } },
    '@/utils/auth': { requireClubPermission: async () => ({ user: { id: 'u1' }, membership: member }) },
    '@/lib/club-transaction-authorization': { authorizeClubTransaction: async () => member },
  })
  return kind => mod.GET(new Request(`https://out-class.net/api/club-exports?clubId=${clubId}&kind=${kind}`)).then(r => r.text())
}

test('applicant CSV leaves out the columns for fields the club hides, on the server', async () => {
  const shown = await exportRoute(null)('applicants')
  assert.match(shown.split('\n')[0], /^First name,Last name,Email,Major,Year,Status,/)
  assert.match(shown, /Mathematics/)
  const hidden = await exportRoute({ major: false, academicYear: false })('applicants')
  assert.match(hidden.split('\n')[0], /^First name,Last name,Email,Status,Round,Cycle,Submitted,Average score,Reviews submitted\r?$/)
  assert.doesNotMatch(hidden, /Mathematics|Year/)
  for (const csv of [shown, hidden]) assert.doesNotMatch(csv, /GPA|3\.9|1500|SAT|ACT|LinkedIn|linkedin|resume/i, 'no GPA, test score, LinkedIn or résumé columns at all')
})

test('roster CSV leaves out graduation year when the club hides class year', async () => {
  assert.match((await exportRoute(null)('roster')).split('\n')[0], /Graduation year/)
  const hidden = await exportRoute({ academicYear: false })('roster')
  assert.doesNotMatch(hidden, /Graduation year|2028/)
  assert.match(hidden, /Ada,Lee,ada@virginia\.edu,,MEMBER|Ada,Lee,ada@virginia\.edu/)
})

// ---- Voting setup ------------------------------------------------------------
function setupTx(profileFieldVisibility) {
  return {
    pipelineRound: { findFirst: async () => ({ id: roundId, clubId, anonymousReview: false, archivedAt: null, club: { profileFieldVisibility } }) },
    recruitmentCycle: { findFirst: async () => ({ id: cycleId }) },
    application: { findMany: async () => { throw new Error('past field validation') } },
  }
}
const setup = () => load('utils/voting-room-setup.ts', { '@/utils/voting-room-presentation': { votingHighlightChoices: async () => [] } })
const input = fields => ({ clubId, sessionId: id(20), cycleId, roundId, leaderMemberIds: [id(21)], participantIds: [id(21)], applicationIds: [id(22)], targetSize: null, presentationOptions: { fields, highlights: {} } })

test('new and edited voting setups refuse a field the club hides; starting a stored session does not', async () => {
  const { validateVotingSetup } = setup()
  await assert.rejects(validateVotingSetup(setupTx(null), input(['name', 'gpa']), { id: 'u' }, { rejectHiddenProfileFields: true }), /hidden by the club’s applicant profile settings/)
  await assert.rejects(validateVotingSetup(setupTx({ major: false }), input(['name', 'major']), { id: 'u' }, { rejectHiddenProfileFields: true }), /hidden by the club/)
  await assert.rejects(validateVotingSetup(setupTx({ gpa: true }), input(['name', 'gpa']), { id: 'u' }, { rejectHiddenProfileFields: true }), /past field validation/, 'allowed when the club shows GPA')
  await assert.rejects(validateVotingSetup(setupTx(null), input(['name', 'gpa', 'interviewScore']), { id: 'u' }), /past field validation/, 'start-time revalidation keeps the stored config')
  assert.match(fs.readFileSync('actions/voting-room.ts', 'utf8'), /validateVotingSetup\(tx,d,user,\{rejectHiddenProfileFields:true\}\)/)
  assert.match(fs.readFileSync('actions/voting-session-setup.ts', 'utf8'), /validateVotingSetup\(tx,d,user,\{rejectHiddenProfileFields:true\}\)/)
})

test('the setup read offers only allowed fields and names the hidden ones; preview refuses hidden fields', () => {
  const src = fs.readFileSync('actions/voting-room-setup.ts', 'utf8')
  assert.match(src, /const allowedFields=permittedFields\.filter\(f=>allowedByProfileCeiling\(f,profileFields\)\)/)
  assert.match(src, /hiddenProfileFields,canEditProfileFields:hasPermission\(m,"club\.settings"\)/)
  // The setup preview rejects any field outside allowedFields, which now excludes hidden ones.
  assert.match(fs.readFileSync('actions/voting-session-setup.ts', 'utf8'), /d\.options\.fields\.some\(f=>!setup\.allowedFields\.includes\(f\)\)/)
  const demo = fs.readFileSync('lib/demo/voting-room.ts', 'utf8')
  assert.match(demo, /allowedFields:permitted\.filter\(f=>allowedByProfileCeiling\(f,ceiling\)\),hiddenProfileFields:/)
  assert.match(demo, /d\.presentationOptions\?\.fields\.some\(f=>setup\.hiddenProfileFields\.includes\(f\)\)/)
})

test('setup step 3 does not offer hidden fields, explains them and links leaders to the setting', () => {
  const src = fs.readFileSync('components/live-voting/room-setup.tsx', 'utf8')
  assert.match(src, /\{data\.allowedFields\.map\(f=><label key=\{f\}><input type="checkbox"/)
  assert.match(src, /: hidden by club profile settings\./)
  assert.match(src, /data\.canEditProfileFields&&<> <Link className="underline underline-offset-4" href=\{`\/club\/\$\{encodeURIComponent\(clubId\)\}\/workspace\?section=settings&setting=profiles`\}>/)
  assert.match(src, /setFields\(old=>old\.some\(f=>hidden\.includes\(f\)\)\?old\.filter\(f=>!hidden\.includes\(f\)\):old\)/)
})

test('slide preparation cannot cite a profile field the club hides', async () => {
  const prep = load('utils/voting-slide-preparation.ts', { '@/utils/voting-room-presentation': {}, '@/utils/additional-observations': {} })
  const tx = v => ({ pipelineRound: { findFirst: async q => { assert.deepEqual(q.select.club, { select: { profileFieldVisibility: true } }); return { applicantDisplay: {}, club: { profileFieldVisibility: v } } } } })
  assert.deepEqual(await prep.roundProfileFields(tx(null), clubId, roundId), ['major', 'academicYear', 'sat', 'act', 'experiences', 'answers', 'applicationContext'], 'GPA is hidden by default')
  assert.deepEqual(await prep.roundProfileFields(tx({ gpa: true, major: false, experiences: false }), clubId, roundId), ['academicYear', 'gpa', 'sat', 'act', 'answers', 'applicationContext'])
})
