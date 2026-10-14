const { test } = require('node:test'), assert = require('node:assert/strict')
const { harness } = require('./helpers/interview-sql-harness.cjs')
async function fixture(t) {
  const h = await harness({permissiveDefaults:true}); t.after(() => h.db.close())
  const api = h.load('actions/availability.ts'), core = h.load('lib/availability.ts')
  const schedule = core.emptySchedule('America/New_York'); schedule.weeklySubmitted = true; schedule.weekly[0] = [[540, 600]]
  await h.db.query('UPDATE "ClubMember" SET "accessRole"=\'INTERVIEWER\' WHERE id=$1', [h.ids.panelMember])
  return { ...h, api, core, schedule }
}
test('global availability is account-bound, revision-safe and shared across clubs; confirmed rounds remain independent snapshots', async t => {
  const h = await fixture(t), { api, ids, schedule } = h
  h.as(ids.panel)
  assert.equal((await api.getMyAvailability()).document.revision, 0)
  const saved = await api.saveMyAvailability({ schedule, revision: 0 }); assert.equal(saved.revision, 1)
  await assert.rejects(api.saveMyAvailability({ schedule, revision: 0 }), /another tab/)
  await assert.rejects(api.saveMyAvailability({ schedule, revision: 1, userId: ids.owner }))
  await assert.rejects(api.saveMyAvailability({ schedule, revision: 1, accountId: ids.owner }), /Account changed/)
  const scope = { clubId: ids.club, roundId: ids.round }
  const initial = await api.getMyRoundAvailability(scope); assert.deepEqual(initial.document.schedule, schedule); assert.equal(initial.confirmed, false)
  const confirmed = await api.saveMyRoundAvailability({ ...scope, ...initial.document, confirm: true }); assert.equal(confirmed.confirmed, true)
  await h.db.query('INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES (\'club-two\',\'club-two\',\'Other club\',\'\',\'\',\'\',\'\')')
  const { randomUUID } = require('node:crypto'), otherClub = randomUUID(), otherRound = randomUUID(), otherMember = randomUUID()
  await h.db.query('UPDATE "Club" SET id=$1 WHERE id=\'club-two\'', [otherClub])
  await h.db.query('INSERT INTO "ClubMember"(id,"clubId","userId","accessRole") VALUES ($1,$2,$3,\'INTERVIEWER\')', [otherMember, otherClub, ids.panel])
  await h.db.query('INSERT INTO "PipelineRound"(id,"clubId",name,"order") VALUES ($1,$2,\'Interview\',1)', [otherRound, otherClub])
  const other = { clubId: otherClub, roundId: otherRound }, otherInitial = await api.getMyRoundAvailability(other)
  assert.deepEqual(otherInitial.document.schedule, schedule)
  const adjusted = { ...schedule, exceptions: { '2026-10-12': [] } }
  await api.saveMyRoundAvailability({ ...other, ...otherInitial.document, schedule: adjusted, confirm: true })
  await api.saveMyAvailability({ schedule: adjusted, revision: 1 })
  assert.deepEqual((await api.getMyRoundAvailability(scope)).document.schedule, schedule)
  assert.deepEqual((await api.getMyRoundAvailability(other)).document.schedule, adjusted)
  assert.equal((await api.getMyAvailability()).rounds.length, 2)
  assert.equal((await h.db.query('SELECT count(*)::int AS n FROM "UserAvailability" WHERE "userId"=$1', [ids.panel])).rows[0].n, 1)
})
test('admin overview and pool count only eligible confirmed participants and whole sessions; no raw or foreign schedules escape', async t => {
  const h = await fixture(t), { api, ids, schedule } = h, scope = { clubId: ids.club, roundId: ids.round }
  h.as(ids.panel); await api.saveMyAvailability({ schedule, revision: 0 })
  h.as(ids.owner)
  let overview = await api.getAvailabilityOverview({ ...scope, week: '2026-10-12', timezone: 'America/New_York' })
  assert.equal(overview.members.length, 1); assert.equal(overview.members[0].confirmed, false); assert.equal(overview.members[0].available[0][36], false)
  assert.deepEqual(await api.getEligibleInterviewerPool({ ...scope, start: '2026-10-12T13:00:00Z', end: '2026-10-12T14:00:00Z' }), [])
  h.as(ids.panel); const initial = await api.getMyRoundAvailability(scope); await api.saveMyRoundAvailability({ ...scope, ...initial.document, confirm: true })
  // A 20-minute existing slot must fit fully, not just begin inside a green cell.
  await h.db.query('INSERT INTO "InterviewRoom"(id,"clubId","roundId",name,location,kind,timezone,duration) VALUES (\'coverage-room\',$1,$2,\'Existing room\',\'Hall\',\'IN_PERSON\',\'UTC\',20)', [ids.club, ids.round])
  await h.db.query('INSERT INTO "InterviewSlot"(id,"clubId","roomId","startTime","endTime",location) VALUES (\'covered\',$1,\'coverage-room\',\'2026-10-12 13:00\',\'2026-10-12 13:20\',\'Hall\'),(\'partial\',$1,\'coverage-room\',\'2026-10-12 13:45\',\'2026-10-12 14:05\',\'Hall\')', [ids.club])
  h.as(ids.owner)
  overview = await api.getAvailabilityOverview({ ...scope, week: '2026-10-12', timezone: 'Europe/London', role: 'INTERVIEWER' })
  assert.equal(overview.timezone, 'America/New_York') // Overrides caller timezone for the application display.
  assert.equal(overview.members[0].available[0][36], true)
  assert.deepEqual(overview.slots.map(s => s.availableMemberIds.length), [1, 0])
  assert.equal('schedule' in overview.members[0], false); assert.equal('userId' in overview.members[0], false)
  const pool = await api.getEligibleInterviewerPool({ ...scope, start: '2026-10-12T13:00:00Z', end: '2026-10-12T14:00:00Z' })
  assert.deepEqual(pool, [{ memberId: ids.panelMember, evidenceAccess: true }])
  assert.deepEqual(await api.getEligibleInterviewerPool({ ...scope, start: '2026-10-12T13:45:00Z', end: '2026-10-12T14:01:00Z' }), [])
  h.as(ids.peer); await assert.rejects(api.getAvailabilityOverview({ ...scope, week: '2026-10-12', timezone: 'UTC' }), /access denied/)
  h.as(ids.panel); await assert.rejects(api.getAvailabilityOverview({ ...scope, week: '2026-10-12', timezone: 'UTC' }), /access denied/)
  h.as(ids.scheduler); await assert.rejects(api.setInterviewerEligibility({ clubId: ids.club, revision: 0, targets: [{ memberId: ids.peerMember, eligible: true }] }), /access denied/)
  h.as(ids.owner); await assert.rejects(api.getAvailabilityOverview({ clubId: require('node:crypto').randomUUID(), week: '2026-10-12', timezone: 'UTC' }), /access denied/)
  assert.equal((await h.db.query('SELECT count(*)::int AS n FROM "InterviewPanelAssignment"')).rows[0].n, 0)
})
test('bulk and role defaults, membership overrides, round overrides, and revocation never grant permissions or touch panels', async t => {
  const h = await fixture(t), { api, ids, schedule } = h
  h.as(ids.owner)
  await api.setInterviewerEligibility({ clubId: ids.club, revision: 0, roles: ['INTERVIEWER', 'MEMBER'] })
  await api.setInterviewerEligibility({ clubId: ids.club, revision: 1, targets: [{ memberId: ids.peerMember, eligible: false }, { memberId: ids.schedulerMember, eligible: true }] })
  await assert.rejects(api.setInterviewerEligibility({ clubId: ids.club, revision: 1, roles: [] }), /changed/)
  const before = (await h.db.query('SELECT permissions,"isOwner","interviewOffices" FROM "ClubMember" WHERE id=$1', [ids.schedulerMember])).rows[0]
  h.as(ids.peer); await assert.rejects(api.getMyRoundAvailability({ clubId: ids.club, roundId: ids.round }), /not eligible/)
  h.as(ids.owner); await api.setInterviewerEligibility({ clubId: ids.club, revision: 2, roundId: ids.round, targets: [{ memberId: ids.peerMember, eligible: true }] })
  h.as(ids.peer); const initial = await api.getMyRoundAvailability({ clubId: ids.club, roundId: ids.round })
  await api.saveMyRoundAvailability({ ...initial.document, clubId: ids.club, roundId: ids.round, schedule, confirm: true })
  h.as(ids.owner); await api.setInterviewerEligibility({ clubId: ids.club, revision: 3, roundId: ids.round, targets: [{ memberId: ids.peerMember, eligible: false }] })
  assert.equal((await h.db.query('SELECT "confirmedAt" FROM "InterviewRoundParticipation" WHERE "memberId"=$1', [ids.peerMember])).rows[0].confirmedAt, null)
  h.as(ids.peer); await assert.rejects(api.saveMyRoundAvailability({ clubId: ids.club, roundId: ids.round, revision: 2, schedule, confirm: true }), /not eligible/)
  const after = (await h.db.query('SELECT permissions,"isOwner","interviewOffices" FROM "ClubMember" WHERE id=$1', [ids.schedulerMember])).rows[0]
  assert.deepEqual(after, before)
  h.as(ids.owner); await assert.rejects(api.setInterviewerEligibility({ clubId: ids.club, revision: 4, targets: [{ memberId: require('node:crypto').randomUUID(), eligible: true }] }), /active members/)
  await api.setInterviewerEligibility({ clubId: ids.club, revision: 4, targets: [{ memberId: ids.peerMember, eligible: null }] })
  await h.db.query('UPDATE "ClubMember" SET status=\'LEFT\',permissions=\'{}\',\"accessRole\"=\'MEMBER\' WHERE id=$1', [ids.panelMember])
  h.as(ids.panel); await assert.rejects(api.getMyRoundAvailability({ clubId: ids.club, roundId: ids.round }), /access denied/)
  h.as(ids.owner); await h.db.query('UPDATE "Club" SET "suspendedAt"=now() WHERE id=$1', [ids.club])
  await assert.rejects(api.getAvailabilityOverview({ clubId: ids.club, week: '2026-10-12', timezone: 'UTC' }), /suspended/)
})
test('migration enforces compact schedules, cross-club foreign keys and browser isolation even with permissive default grants', async t => {
  const h = await fixture(t), { ids, schedule } = h
  await assert.rejects(h.db.query('INSERT INTO "UserAvailability"("userId",schedule) VALUES ($1,$2)', [ids.panel, JSON.stringify({ ...schedule, weekly: [] })]), /check constraint/)
  await assert.rejects(h.db.query('INSERT INTO "UserAvailability"("userId",schedule) VALUES ($1,$2)', [ids.panel, JSON.stringify({ ...schedule, exceptions: { '2026-02-30': [] } })]), /check constraint/)
  await h.db.query('INSERT INTO "UserAvailability"("userId",schedule) VALUES ($1,$2)', [ids.panel, JSON.stringify(schedule)])
  await assert.rejects(h.db.query('INSERT INTO "InterviewRoundParticipation"(id,"clubId","memberId","roundId") VALUES (\'foreign\',\'foreign-club\',$1,$2)', [ids.panelMember, ids.round]), /foreign key/)
  await assert.rejects(h.db.query('INSERT INTO "InterviewRoundParticipation"(id,"clubId","memberId","roundId","confirmedAt") VALUES (\'unknown\',$1,$2,$3,now())', [ids.club, ids.panelMember, ids.round]), /check constraint/)
  for (const role of ['anon', 'authenticated']) {
    await h.db.exec(`SET ROLE ${role}`)
    for (const table of ['UserAvailability', 'InterviewRoundParticipation']) {
      await assert.rejects(h.db.query(`SELECT * FROM "${table}"`), /permission denied/)
      await assert.rejects(h.db.query(`DELETE FROM "${table}"`), /permission denied/)
    }
    await assert.rejects(h.db.query('SELECT public.outclass_valid_availability($1)', [JSON.stringify(schedule)]), /permission denied/)
    await h.db.exec('RESET ROLE')
  }
})
test('private availability tables remain usable by the bounded runtime owner while browser roles are denied', async t => {
  const h = await harness({ runtimeRole: true, permissiveDefaults: true }); t.after(() => h.db.close())
  const schedule = h.load('lib/availability.ts').emptySchedule('UTC')
  await h.db.exec('SET ROLE outclass_production_app')
  await h.db.query('INSERT INTO "UserAvailability"("userId",schedule) VALUES ($1,$2)', [h.ids.panel, JSON.stringify(schedule)])
  assert.equal((await h.db.query('SELECT count(*)::int AS n FROM "UserAvailability"')).rows[0].n, 1)
  await h.db.exec('RESET ROLE')
  assert.equal((await h.db.query("SELECT has_schema_privilege('outclass_production_app','public','CREATE') AS allowed")).rows[0].allowed, false)
})
test('eligibility changes preserve existing panel grants and room approval exactly', async t => {
  const h = await fixture(t), { ids, api } = h
  await h.db.query('INSERT INTO "InterviewRoom"(id,"clubId","roundId",name,location,kind,timezone,duration,"panelMemberIds","approvedPanelMemberIds","panelApprovedBy","panelApprovalRevision") VALUES (\'preserve-room\',$1,$2,\'Existing staffed room\',\'Hall\',\'IN_PERSON\',\'UTC\',20,$3,$3,$4,1)', [ids.club, ids.round, '{' + ids.panelMember + '}', ids.owner])
  await h.db.query('INSERT INTO "InterviewPanelAssignment"(id,"applicationId","roundId","memberId","grantedBy") VALUES (\'preserve-grant\',$1,$2,$3,$4)', [ids.app, ids.round, ids.panelMember, ids.owner])
  const grants = (await h.db.query('SELECT * FROM "InterviewPanelAssignment"')).rows
  const rooms = (await h.db.query('SELECT * FROM "InterviewRoom"')).rows
  await api.setInterviewerEligibility({ clubId: ids.club, revision: 0, targets: [{ memberId: ids.panelMember, eligible: false }] })
  assert.deepEqual((await h.db.query('SELECT * FROM "InterviewPanelAssignment"')).rows, grants)
  assert.deepEqual((await h.db.query('SELECT * FROM "InterviewRoom"')).rows, rooms)
})

test('both save actions reject new hidden hours atomically and retain saved history on visible edits', async t => {
  const h = await fixture(t), { api, core, ids } = h, scope = { clubId: ids.club, roundId: ids.round }
  h.as(ids.panel)
  const hidden = core.emptySchedule(); hidden.weeklySubmitted = true; hidden.weekly[0] = [[465, 495]]
  await assert.rejects(api.saveMyAvailability({ revision: 0, schedule: hidden }), /8:00 AM and 9:00 PM/)
  await assert.rejects(api.saveMyRoundAvailability({ ...scope, revision: 0, schedule: hidden, confirm: true }), /8:00 AM and 9:00 PM/)
  assert.equal(await h.prisma.userAvailability.count({ where: {} }), 0)
  assert.equal(await h.prisma.interviewRoundParticipation.count({ where: {} }), 0)
  const legacy = core.emptySchedule(); legacy.weeklySubmitted = true; legacy.weekly[0] = [[0, 60], [480, 1260], [1380, 1440]]
  await h.prisma.userAvailability.create({ data: { userId: ids.panel, schedule: legacy } })
  const original = (await api.getMyAvailability()).document
  const initial = await api.getMyRoundAvailability(scope)
  await api.saveMyRoundAvailability({ ...scope, ...initial.document, confirm: true })
  const snapshot = await Promise.all(['interviewRoom', 'interviewSlot', 'interviewBooking', 'interviewPanelAssignment', 'interviewPanelScheduleVersion'].map(model => h.prisma[model].findMany({})))
  const days = core.availabilityEditorDays(legacy, '2026-10-12', true); days[0][83] = false
  const edited = core.editAvailabilityDays(legacy, '2026-10-12', true, days, [0])
  const saved = await api.saveMyAvailability({ ...original, schedule: edited })
  assert.deepEqual(saved.schedule.weekly[0], [[0, 60], [480, 1245], [1380, 1440]])
  assert.deepEqual((await api.getMyRoundAvailability(scope)).document.schedule, legacy)
  assert.deepEqual(await Promise.all(['interviewRoom', 'interviewSlot', 'interviewBooking', 'interviewPanelAssignment', 'interviewPanelScheduleVersion'].map(model => h.prisma[model].findMany({}))), snapshot)
  const bad = structuredClone(saved.schedule); bad.exceptions['2026-10-13'] = [[1260, 1275]]
  await assert.rejects(api.saveMyAvailability({ ...saved, schedule: bad }), /8:00 AM and 9:00 PM/)
  assert.deepEqual((await api.getMyAvailability()).document, saved)
})

test('eligibility and Auto-Fill candidates honor the final Eastern block on either side of DST', async t => {
  const h = await fixture(t), { api, core, ids } = h, scope = { clubId: ids.club, roundId: ids.round }
  h.as(ids.panel)
  const schedule = core.emptySchedule(); schedule.weeklySubmitted = true; schedule.weekly[0] = [[1245, 1260]]
  await api.saveMyRoundAvailability({ ...scope, revision: 0, schedule, confirm: true })
  h.as(ids.owner)
  for (const [start, end] of [['2026-10-27T00:45:00Z', '2026-10-27T01:00:00Z'], ['2026-11-03T01:45:00Z', '2026-11-03T02:00:00Z']]) {
    assert.deepEqual(await api.getEligibleInterviewerPool({ ...scope, start, end }), [{ memberId: ids.panelMember, evidenceAccess: true }])
    assert.deepEqual(await api.getEligibleInterviewerPool({ ...scope, start, end: new Date(+new Date(end) + 60000).toISOString() }), [])
  }
})
