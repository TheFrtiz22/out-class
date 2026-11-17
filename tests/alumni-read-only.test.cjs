// Owner decision (Nov 16): alumni accounts are purely read-only (lib/graduation.ts). Covers the
// remaining student writes now refused, the personal settings that stay available, a graduate kept as
// club owner (read-only except handing the club over), and voter eligibility.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), ts = require('typescript')

function load(file, mocks = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const req = name => {
    if (name in mocks) return mocks[name]
    if (name.startsWith('@/')) {
      const base = name.slice(2)
      const found = [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find(f => fs.existsSync(f))
      if (!found) throw Error(`Unexpected import ${name}`)
      return load(found, mocks)
    }
    return require(name)
  }
  new Function('require', 'module', 'exports', code)(req, mod, mod.exports)
  return mod.exports
}
const src = file => fs.readFileSync(file, 'utf8')
const g = load('lib/graduation.ts')
const perms = load('lib/permissions.ts')
const ALUMNI_AT = new Date('2026-08-01T04:00:00Z')
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const refused = action => e => e?.code === g.ALUMNI_REFUSED && e.message === g.ALUMNI_REFUSALS[action]
const envelope = action => ({ $action: 'outclass.action/v1', ok: false, error: g.ALUMNI_REFUSALS[action], code: g.ALUMNI_REFUSED })
const profile = (graduatedAt, userId = 'grad') => ({ findUnique: async ({ where, select }) => { assert.deepEqual(select, { graduatedAt: true }); assert.equal(where.userId, userId); return { graduatedAt } } })
const GRAD = id(50)

// ---- Student writes now refused ----

test('interest survey: alumni cannot save answers (no write); dismissing the prompt stays available', async () => {
  const writes = []
  const prisma = {
    studentProfile: profile(ALUMNI_AT),
    $transaction: async () => assert.fail('no survey write for alumni'),
    studentInterestProfile: { upsert: async ({ update }) => { writes.push(Object.keys(update)); return { interests: [], goals: [], weeklyHours: null, selectivity: null, revision: 0, completedAt: null, dismissedAt: new Date() } } },
  }
  const survey = load('actions/interest-survey.ts', { '@/utils/prisma': { prisma }, '@/utils/auth': { requireAuth: async () => ({ user: { id: 'grad' }, impersonation: null }) } })
  assert.deepEqual(await survey.saveMyInterestSurvey({ interests: [], goals: [], weeklyHours: null, selectivity: null, revision: 0 }), envelope('survey'))
  assert.equal((await survey.dismissInterestSurveyPrompt()).ok, true)
  assert.deepEqual(writes, [['dismissedAt']])
  // The form shows answers read-only with the refusal; the Home prompt does not show.
  const form = src('components/interests/interest-survey-form.tsx')
  assert.match(form, /<fieldset disabled=\{alumni\} className="contents">/)
  assert.match(form, /\{alumni \? <p role="status"[^>]*>\{ALUMNI_REFUSALS\.survey\}<\/p> : <div/)
  assert.match(src('components/interests/interest-survey-prompt.tsx'), /if \(alumni \|\| !enabled/)
})

function availabilityApi({ graduatedAt, member = { id: 'm1', clubId: id(1), userId: GRAD } }) {
  const tx = {
    $queryRaw: async () => [],
    user: { findUnique: async () => ({ disabledAt: null }) },
    studentProfile: profile(graduatedAt, GRAD),
    userAvailability: { findUnique: async () => { throw new Error('reached availability read') } },
    pipelineRound: { findFirst: async () => { throw new Error('reached round read') } },
    auditLog: { findFirst: async () => { throw new Error('reached declaration read') } },
  }
  return load('actions/availability.ts', {
    '@/utils/prisma': { prisma: { $transaction: async work => work(tx) } },
    '@/utils/auth': { requireAuth: async () => ({ user: { id: GRAD }, impersonation: null }) },
    '@/lib/club-transaction-authorization': { authorizeClubTransaction: async () => member },
    '@/utils/club-write-transaction': { clubWriteTransaction: async () => assert.fail() },
    '@/utils/availability-requests': { publishAvailabilityRequest: async () => assert.fail() },
  })
}
const emptyWeek = { timezone: 'America/New_York', weekly: [[], [], [], [], [], [], []], weeklySubmitted: false, exceptions: {} }

test('availability: alumni cannot edit general or round availability, decline participation or declare no time', async () => {
  const api = availabilityApi({ graduatedAt: ALUMNI_AT })
  assert.deepEqual(await api.saveMyAvailability({ schedule: emptyWeek, revision: 0 }), envelope('availability'))
  assert.deepEqual(await api.saveMyRoundAvailability({ schedule: emptyWeek, revision: 0, clubId: id(1), roundId: id(2), confirm: false }), envelope('availability'))
  assert.deepEqual(await api.declineRoundParticipation({ clubId: id(1), roundId: id(2), revision: 0, accountId: GRAD }), envelope('respond'))
  assert.deepEqual(await api.completeAvailabilityRequirement({ noRegularTime: true }), envelope('availability'))
  // A current student reaches the reads behind the check.
  const student = availabilityApi({ graduatedAt: null })
  await assert.rejects(student.saveMyAvailability({ schedule: emptyWeek, revision: 0 }), /reached availability read/)
  await assert.rejects(student.declineRoundParticipation({ clubId: id(1), roundId: id(2), revision: 0, accountId: GRAD }), /reached round read/)
  // Alumni stay exempt from the required-availability gate; the editor is read-only for them.
  const requirement = load('lib/availability-requirement.ts')
  assert.equal(requirement.availabilityRequirementExempt({ disabled: false, platformAdmin: false, alumni: true }), true)
  assert.equal(requirement.availabilityRequirementExempt({ disabled: false, platformAdmin: false, alumni: false }), false)
  const editor = src('components/availability/my-availability.tsx')
  assert.match(editor, /<fieldset disabled=\{alumni \|\| confirming \|\| !!recovery\}/)
  assert.match(editor, /function change\(value: AvailabilitySchedule\) \{ if \(alumni \|\|/)
  assert.match(editor, /\{alumni && <p role="status"[^>]*>\{ALUMNI_REFUSALS\.availability\}<\/p>\}/)
})

test('invitations and offers: alumni cannot decline any kind (email, identity, offer); accepting stays refused', async () => {
  const tx = {
    studentProfile: profile(ALUMNI_AT),
    clubInvitation: { findUnique: async () => assert.fail('refused before reading the invitation'), update: async () => assert.fail() },
  }
  const common = {
    '@/utils/prisma': { prisma: {} },
    '@/utils/auth': { requireAuth: async () => ({ user: { id: 'grad', email: 'grad@virginia.edu' } }), requireClubPermission: async () => assert.fail() },
    '@/utils/club-write-transaction': { clubWriteTransaction: async work => work(tx) },
    '@/utils/school-identity': { prepareVerifiedSchoolAccount: async () => {}, previewVerifiedSchoolIdentities: async () => [] },
    '@/utils/verified-email-policy': { hasConfirmedUniversityEmail: () => true },
    '@/utils/platform-admin': { requirePlatformAdmin: async () => assert.fail() },
    '@/utils/club-onboarding': { recipientInvitation: async () => assert.fail('refused before reading the invitation') },
    'next/cache': { revalidatePath() {}, revalidateTag() {} },
  }
  const access = load('actions/club-access.ts', common)
  assert.deepEqual(await access.declineClubInvitation(id(9)), envelope('respond'))
  const onboarding = load('actions/club-onboarding.ts', common)
  assert.deepEqual(await onboarding.declineIdentityClubInvitation(id(9)), envelope('respond'))
  // Offer declines (also reached through declineClubInvitation) refuse inside the shared offer path.
  assert.match(src('utils/recruitment-offers.ts'), /if \(response === "DECLINE"\) \{\n\s*\/\/[^\n]*\n\s*await assertNotAlumni\(tx, userId, "respond"\);\n\s*await tx\.clubInvitation\.update/)
  // UI: offer and invitation cards replace Accept/Decline with the refusal for alumni.
  assert.match(src('components/applications/recruitment-offer.tsx'), /\{alumni\?<p role="status"[^>]*>\{ALUMNI_REFUSALS\.respond\}<\/p>:<div/)
  assert.match(src('components/communications/decision-letter.tsx'), /\{isAlumniProfile\(user\?\.profile\)\?<p role="status">\{ALUMNI_REFUSALS\.respond\}<\/p>:<div/)
  assert.match(src('components/invitation-response.tsx'), /if \(alumni\) return <p role="status"[^>]*>\{ALUMNI_REFUSALS\.respond\}<\/p>;/)
  const card = src('components/organization-invitation-card.tsx')
  assert.match(card, /\{alumni \? <p role="status"[^>]*>\{ALUMNI_REFUSALS\.respond\}<\/p> : <Button/)
  assert.match(card, /\{allowDecline && !alumni && <Button/)
})

test('interview booking: the applicant view shows a booked time read-only for alumni', () => {
  const booking = src('components/interviews/applicant-booking.tsx')
  assert.match(booking, /\{alumni\?<><p role="status"[^>]*>\{ALUMNI_REFUSALS\.book\}<\/p><BookingPicker rooms=\{\[\]\}[^>]*allowRescheduling=\{false\}\/><\/>:/)
  // The read-only picker has neither reserve nor cancel handlers.
  const readOnly = booking.slice(booking.indexOf('{alumni?'), booking.indexOf('</>:'))
  assert.doesNotMatch(readOnly, /onReserve|onCancel/)
})

// ---- Still allowed: personal account settings ----

test('alumni keep personal account settings: profile, uploads, notifications, push, calendar feed, graduation answers, export, deletion, reports', () => {
  for (const file of ['actions/profile.ts', 'actions/graduation.ts', 'actions/push-subscriptions.ts', 'actions/calendar-feed.ts', 'actions/account-deletion.ts', 'actions/content-reports.ts', 'actions/feedback-reports.ts', 'actions/communications.ts', 'app/api/users/me/route.ts', 'app/api/profile-photos/route.ts', 'app/api/resumes/route.ts', 'utils/notification-preferences.ts'])
    assert.doesNotMatch(src(file), /assertNotAlumni|alumniRefusal/, file)
  // "I'm not graduating" (a graduation-year change) still restores a mis-marked student.
  assert.match(src('actions/profile.ts'), /await applyGraduationYearChange\(tx, user\.id, parsed\.gradYear/)
  const change = g.graduationYearChange({ gradYear: 2026, graduatedAt: ALUMNI_AT, graduationConfirmedAt: null, graduationPromptDismissedAt: null }, 2028, new Date('2026-09-01T00:00:00Z'))
  assert.ok(change?.restoreAlumniSince, 'a defaulted graduate moving to a future year is restored')
})

// ---- Graduate kept as owner: read-only except handing the club over ----

const CLUB = id(1)
const keptOwner = { id: 'm-owner', clubId: CLUB, userId: 'owner', status: 'ACTIVE', alumniSince: null, isOwner: true, accessRole: 'OWNER', permissions: [], interviewOffices: [] }
const target = { id: id(60), clubId: CLUB, userId: 'target', status: 'ACTIVE', alumniSince: null, isOwner: false, accessRole: 'MEMBER', permissions: [], interviewOffices: [], updatedAt: new Date('2026-09-01T00:00:00Z'), user: { disabledAt: null, email: 'target@virginia.edu' } }
function membersApi(graduatedAt) {
  const writes = []
  const tx = {
    $queryRaw: async strings => strings.join('?').includes('FROM "StudentProfile"') ? [{ graduatedAt }] : [],
    user: { findUnique: async () => ({ disabledAt: null }), findUniqueOrThrow: async () => ({ email: 'x@virginia.edu' }) },
    clubMember: {
      findUnique: async () => keptOwner,
      findFirst: async () => target,
      findMany: async () => [target],
      count: async () => 1,
      update: async ({ where, data }) => { writes.push(['update', where.id, data.accessRole]); return {} },
      updateMany: async ({ data }) => { writes.push(['updateMany', data]); return { count: 1 } },
    },
    clubInvitation: { findFirst: async () => ({ id: 'inv', status: 'PENDING', requestedRole: 'MEMBER', permissions: [] }), findMany: async () => [] },
    invitationDelivery: { updateMany: async () => ({ count: 0 }) },
    club: { findUniqueOrThrow: async () => ({ schoolId: 's', profileFieldVisibility: null }) },
    schoolIdentifierType: { findMany: async () => [] },
    auditLog: { create: async ({ data }) => { writes.push(['audit', data.action]); return {} } },
  }
  const api = load('actions/organization-members.ts', {
    '@/utils/prisma': { prisma: { $transaction: async work => work(tx) } },
    '@/utils/auth': { requireAuth: async () => ({ user: { id: 'owner' } }) },
    '@/lib/club-suspension': { lockOperationalClub: async () => {} },
    '@/utils/revoke-club-invitations': { revokeClubInvitations: async () => {} },
    '@/utils/invitation-delivery': { enqueueInvitationEmails: async () => assert.fail() },
    '@/utils/email': { invitationEmailConfig: () => ({}) },
    '@/utils/invitation-background': { scheduleInvitationDelivery() {} },
    '@/actions/invitation-emails': { resendOrganizationInvitation: async () => assert.fail() },
    '@/actions/club-onboarding': { createClubIdentityInvitation: async () => assert.fail() },
    '@/utils/interview-assignment-notifications': { notifyInterviewAssignment: async () => {} },
    '@/utils/panel-publication': { lockSchedulingPeople: async () => {} },
    '@/utils/official-panel-conflicts': { assertOfficialPanelConflicts: async () => {} },
    '@/utils/club-write-transaction': { contentionResult: async (_n, work) => work(), retryTransactionConflict: work => work() },
  })
  return { api, writes }
}

test('kept-owner graduate: ownership transfer and naming a current member owner work; every other member change is refused', async () => {
  const { api, writes } = membersApi(ALUMNI_AT)
  // Hand-over: transfer, or make a current member owner (single or bulk).
  assert.equal((await api.transferOrganizationOwnership({ clubId: CLUB, memberId: target.id, confirm: true })).ok, true)
  assert.deepEqual(writes.filter(w => w[0] === 'update'), [['update', id(60), 'OWNER'], ['update', 'm-owner', 'ADMIN']])
  assert.equal((await api.changeOrganizationMemberRole({ clubId: CLUB, memberId: target.id, role: 'OWNER' })).ok, true)
  assert.equal((await api.bulkOrganizationMembers({ clubId: CLUB, targets: [{ id: target.id, updatedAt: target.updatedAt }], action: 'ROLE', role: 'OWNER' })).ok, true)
  // Everything else is refused.
  const before = writes.length
  for (const role of ['ADMIN', 'RECRUITING_ADMIN', 'INTERVIEWER', 'MEMBER'])
    assert.equal((await api.changeOrganizationMemberRole({ clubId: CLUB, memberId: target.id, role })).ok, false, role)
  assert.equal((await api.removeOrganizationMember({ clubId: CLUB, memberId: target.id })).ok, false)
  for (const [action, extra] of [['REMOVE', {}], ['ROLE', { role: 'ADMIN' }], ['PERMISSIONS', { permissions: ['leaders.manage'] }]]) {
    const result = await api.bulkOrganizationMembers({ clubId: CLUB, targets: [{ id: target.id, updatedAt: target.updatedAt }], action, ...extra })
    assert.equal(result.ok, false, action)
  }
  assert.deepEqual(await api.bulkOrganizationMembers({ clubId: CLUB, targets: [{ id: target.id, updatedAt: target.updatedAt }], action: 'REMOVE' }), { $action: 'outclass.action/v1', ok: false, error: g.ALUMNI_REFUSALS.manage, code: g.ALUMNI_REFUSED })
  assert.equal((await api.manageOrganizationInvitation({ clubId: CLUB, invitationId: id(7), action: 'REVOKE' })).ok, false)
  assert.equal((await api.setMemberInterviewOffices({ clubId: CLUB, memberId: target.id, offices: ['BOARD'] })).ok, false)
  assert.equal((await api.assignOrganizationMemberGroups({ clubId: CLUB, targets: [{ id: target.id, updatedAt: target.updatedAt }], group: 'A', operation: 'ADD' })).ok, false)
  assert.equal(writes.length, before, 'no writes for refused changes')
  // The roster read hands the UI the marked actor, so only hand-over controls show.
  const { actor } = await api.getOrganizationMemberManagement(CLUB)
  assert.equal(actor.handOverOnly, true)
  // A current student owner keeps full member management.
  const current = membersApi(null)
  assert.equal((await current.api.changeOrganizationMemberRole({ clubId: CLUB, memberId: target.id, role: 'ADMIN' })).ok, true)
})

test('kept-owner graduate: access editor and invitations allow only making someone owner', () => {
  const auth = load('lib/organization-authorization.ts')
  const onboarding = load('lib/club-onboarding.ts')
  const graduate = { ...keptOwner, handOverOnly: true }
  const caps = auth.organizationCapabilities(graduate)
  assert.deepEqual(caps, { canManageMembers: false, canManageRecruiting: false, canManageInterviews: false, canManageOrganization: false, canChangeRoles: true, canTransferOwnership: true })
  assert.equal(auth.canChangeOrganizationRole(graduate, target, 'OWNER'), true)
  for (const role of ['ADMIN', 'RECRUITING_ADMIN', 'INTERVIEWER', 'MEMBER']) assert.equal(auth.canChangeOrganizationRole(graduate, target, role), false, role)
  assert.equal(auth.canRemoveOrganizationMember(graduate, target), false)
  assert.equal(auth.canManageOrganizationInvitation(graduate, { requestedRole: 'MEMBER', permissions: [] }), false)
  assert.equal(onboarding.canGrantOnboardingRole(graduate, 'OWNER'), true)
  assert.equal(onboarding.canGrantOnboardingRole(graduate, 'MEMBER'), false)
  const interview = load('lib/interview-access.ts').interviewCapabilities({ ...graduate, interviewOffices: ['PRESIDENT'] })
  assert.deepEqual(interview, { editKit: false, readClosing: false, moderateResume: false, overrideAvailability: false, participate: false, manageGrants: false })
  // Server: the access editor accepts only isOwner: true from a graduate; identity invitations are refused.
  assert.match(src('actions/club-access.ts'), /throw new ActionError\("Access denied\."\);\n\s*\/\/[^\n]*\n\s*if \(actor\.handOverOnly && !data\.isOwner\) throw new ActionError\(ALUMNI_REFUSALS\.manage, ALUMNI_REFUSED\);/)
  assert.match(src('utils/club-onboarding.ts'), /if \(!data\.platformDesignation && \(member\?\.handOverOnly \|\| !canGrantOnboardingRole\(member, data\.requestedRole\)\)\)/)
  // Workspace navigation: Members (for the transfer) stays; recruiting and settings do not.
  const workspace = load('lib/club-workspace.ts', { '@/lib/club-settings': { availableSettings: m => perms.hasPermission(m, 'club.settings') ? ['general'] : [] } })
  assert.deepEqual(workspace.clubWorkspaceSections(graduate), ['overview', 'members', 'calendar', 'tasks', 'alumni'])
})

test('kept-owner graduate: direct membership loads mark the actor too', () => {
  const pins = {
    'actions/organization-members.ts': /const actor = await graduateClubAccessOrNull\(tx, await tx\.clubMember\.findUnique\(\{ where: \{ userId_clubId: \{ userId, clubId \} \} \}\)\);/,
    'actions/panel-proposals.ts': /const member=await graduateClubAccessOrNull\(tx,await tx\.clubMember\.findUnique/,
    'utils/invitation-delivery.ts': /const actor = await graduateClubAccessOrNull\(tx, await tx\.clubMember\.findUnique/,
    'utils/voting-room-page-access.ts': /!hasPermission\(await graduateClubAccessOrNull\(prisma, member\), "applications\.review"\)/,
  }
  // Writes behind a plain membership check refuse a marked actor explicitly.
  pins['actions/recusals.ts'] = /const actor = await authorizeClubTransaction\(tx, d\.clubId, user\.id, \[\]\)\n\s*\/\/[^\n]*\n\s*assertGraduateMayOperate\(actor\)/
  pins['actions/editor-drafts.ts'] = /assertGraduateMayOperate\(member\)\n\s*const assignment/
  pins['actions/availability.ts'] = /authorizeClubTransaction\(tx, input\.clubId, user\.id, \[\]\)\n\s*\/\/[^\n]*\n\s*await assertNotAlumni\(tx, user\.id, "availability"\)/
  for (const [file, pattern] of Object.entries(pins)) assert.match(src(file), pattern, file)
  assert.equal(src('actions/club-access.ts').match(/graduateClubAccessOrNull\(tx, await tx\.clubMember\.findUnique/g).length, 6, 'five actor loads and the accept-time inviter')
  // Private task files: a marked actor no longer holds tasks.manage.
  assert.equal(src('actions/tasks.ts').match(/graduateClubAccessOrNull\(prisma, await prisma\.clubMember\.findUnique/g).length, 1)
  assert.equal(src('actions/club-onboarding.ts').match(/graduateClubAccessOrNull\(tx, await tx\.clubMember\.findUnique/g).length, 3, 'revoke, roster upload and roster read')
})

// ---- Voter eligibility ----

test('voting: a graduate (kept owner included) is never an eligible voter', async () => {
  const at = new Date('2026-09-01T00:00:00Z')
  assert.equal(g.isGraduatedMember({ user: { studentProfile: { graduatedAt: ALUMNI_AT } } }, at), true)
  for (const member of [{ user: { studentProfile: { graduatedAt: null } } }, { user: { studentProfile: { graduatedAt: new Date('2027-08-01T04:00:00Z') } } }, { user: { studentProfile: null } }, {}])
    assert.equal(g.isGraduatedMember(member, at), false, JSON.stringify(member))
  let args
  const rules = load('utils/voting-rules.ts')
  const voter = (id, graduatedAt) => ({ id, isOwner: true, status: 'ACTIVE', alumniSince: null, permissions: [], user: { studentProfile: { graduatedAt } } })
  const tx = { clubMember: { findMany: async a => { args = a; return [voter('m1', ALUMNI_AT), voter('m2', null)] } } }
  assert.deepEqual(await rules.currentEligibleVoterIds(tx, CLUB, ['m1', 'm2'], true), ['m2'], 'the kept-owner graduate is excluded')
  assert.deepEqual(args.include, { user: { select: { studentProfile: { select: { graduatedAt: true } } } } })
  // The setup electorate and the live room apply the same predicate.
  assert.match(src('actions/voting-room-setup.ts'), /const voters=members\.filter\(v=>!isGraduatedMember\(v\)&&hasPermission/)
  assert.match(src('actions/voting-room.ts'), /const eligible=members\.filter\(v=>!isGraduatedMember\(v\)&&hasPermission/)
  for (const file of ['actions/voting-room-setup.ts', 'actions/voting-room.ts']) assert.match(src(file), /studentProfile:\{select:\{firstName:true,lastName:true,graduatedAt:true\}\}/, file)
})

// ---- Review follow-ups (Nov 17) ----

const INVITE_CLUB = id(1)
const graduatedProfileRaw = graduated => async strings => strings.join('?').includes('FROM "StudentProfile"') ? [{ graduatedAt: graduated }] : []
function accessApi(tx, userId = 'owner') {
  return load('actions/club-access.ts', {
    '@/utils/prisma': { prisma: { $transaction: async work => work(tx) } },
    '@/utils/auth': { requireAuth: async () => ({ user: { id: userId, email: 'student@virginia.edu' } }), requireClubPermission: async () => assert.fail() },
    '@/utils/club-write-transaction': { clubWriteTransaction: async work => work(tx) },
    '@/utils/school-identity': { prepareVerifiedSchoolAccount: async () => {} },
    '@/utils/verified-email-policy': { hasConfirmedUniversityEmail: () => true },
    '@/lib/club-suspension': { lockOperationalClub: async () => {} },
    'next/cache': { revalidatePath() {}, revalidateTag() {} },
  })
}

test('kept-owner graduate cannot invite anyone; nothing is written', async () => {
  const tx = {
    $queryRaw: graduatedProfileRaw(ALUMNI_AT),
    clubMember: { findUnique: async () => ({ ...keptOwner, clubId: INVITE_CLUB }) },
    clubInvitation: { create: async () => assert.fail('no invitation for a graduate') },
    auditLog: { create: async () => assert.fail() },
  }
  for (const permissions of [[], ['leaders.manage']])
    assert.deepEqual(await accessApi(tx).inviteClubManager({ clubId: INVITE_CLUB, email: 'new@virginia.edu', permissions }), { $action: 'outclass.action/v1', ok: false, error: g.ALUMNI_REFUSALS.manage, code: g.ALUMNI_REFUSED })
})

test('an invitation issued before the inviter graduated can no longer be accepted (email and identity) or delivered', async () => {
  const invitation = { id: id(30), clubId: INVITE_CLUB, status: 'PENDING', email: 'student@virginia.edu', expiresAt: new Date(Date.now() + 86400000), invitedBy: 'inviter', permissions: [], declinedAt: null, acceptedAt: null, revokedAt: null, applicationId: null, schoolIdentityId: null }
  const inviter = { ...keptOwner, id: 'm-inviter', userId: 'inviter', clubId: INVITE_CLUB }
  const emailTx = graduated => ({
    $queryRaw: graduatedProfileRaw(graduated),
    clubInvitation: { findUnique: async () => invitation },
    clubMember: { findUnique: async ({ where }) => where.userId_clubId.userId === 'inviter' ? inviter : null, upsert: async () => assert.fail('no membership') },
    user: { findUnique: async () => ({ disabledAt: null }) },
    studentProfile: { findUnique: async () => { throw new Error('reached the join check') } },
  })
  const refusedEmail = await accessApi(emailTx(ALUMNI_AT), 'student').acceptClubInvitation(invitation.id)
  assert.equal(refusedEmail.ok, false); assert.match(refusedEmail.error, /inviter no longer has permission/)
  await assert.rejects(accessApi(emailTx(null), 'student').acceptClubInvitation(invitation.id), /reached the join check/, 'a current inviter still passes')

  const identity = { ...invitation, schoolIdentityId: 'sid', authoritySource: 'CLUB', requestedRole: 'MEMBER', expiredAt: null }
  const onboarding = load('utils/club-onboarding.ts', {
    '@/lib/club-suspension': { lockOperationalClub: async () => {} },
    '@/utils/school-identity': { verifiedSchoolIdentities: async () => [{ id: 'sid' }] },
  })
  const identityTx = graduated => ({
    $queryRaw: graduatedProfileRaw(graduated),
    clubInvitation: { findUnique: async () => identity, findUniqueOrThrow: async () => identity },
    clubMember: { findUnique: async () => inviter },
    user: { findUnique: async () => ({ id: 'inviter', disabledAt: null }) },
    studentProfile: { findUnique: async () => { throw new Error('reached the join check') } },
  })
  const account = { user: { id: 'student' } }
  await assert.rejects(onboarding.acceptIdentityInvitationInTransaction(identityTx(ALUMNI_AT), identity.id, account), /inviter can no longer grant/)
  await assert.rejects(onboarding.acceptIdentityInvitationInTransaction(identityTx(null), identity.id, account), /reached the join check/)
  // Delivery re-reads the inviter the same way (canManageOrganizationInvitation refuses handOverOnly).
  assert.match(src('utils/invitation-delivery.ts'), /const inviter = await graduateClubAccessOrNull\(tx, await tx\.clubMember\.findUnique\(\{ where: \{ userId_clubId: \{ userId: invitation\.invitedBy[^\n]*\n\s*if \(!canManageOrganizationInvitation\(inviter, invitation\)\) return null;/)
  assert.equal(load('lib/organization-authorization.ts').canManageOrganizationInvitation({ ...inviter, handOverOnly: true }, { requestedRole: 'OWNER', permissions: [] }), false)
})

test('"Not now" on an invitation is refused for alumni and hidden', async () => {
  const tx = { studentProfile: profile(ALUMNI_AT), clubInvitation: { update: async () => assert.fail('no dismissal') } }
  const onboarding = load('actions/club-onboarding.ts', {
    '@/utils/prisma': { prisma: {} },
    '@/utils/auth': { requireAuth: async () => ({ user: { id: 'grad' } }), requireClubPermission: async () => assert.fail() },
    '@/utils/club-write-transaction': { clubWriteTransaction: async work => work(tx) },
    '@/utils/school-identity': { prepareVerifiedSchoolAccount: async () => {}, previewVerifiedSchoolIdentities: async () => [] },
    '@/utils/platform-admin': { requirePlatformAdmin: async () => assert.fail() },
    '@/utils/club-onboarding': { recipientInvitation: async () => assert.fail('refused before reading the invitation') },
  })
  assert.deepEqual(await onboarding.setOrganizationInvitationDismissed(id(9), true), envelope('respond'))
  assert.match(src('components/organization-invitation-card.tsx'), /\{!alumni && <Button[^\n]*respond\(dismissed \? "restored" : "dismissed"\)\}>/)
})

test('voting: a graduate cannot be seated as a voter or leader; the legacy eligible list skips graduates', () => {
  assert.match(src('utils/voting-room-setup.ts'), /include:\{user:\{select:\{disabledAt:true,studentProfile:\{select:\{graduatedAt:true\}\}\}\}\}\}\);\n\s*\/\/[^\n]*\n\s*if\(members\.length!==memberIds\.length\|\|members\.some\(m=>m\.user\.disabledAt\|\|isGraduatedMember\(m\)\|\|/)
  const legacy = src('actions/voting.ts')
  assert.match(legacy, /include:\{user:\{select:\{email:true,studentProfile:\{select:\{graduatedAt:true\}\}\}\}\}\}\)\)\.filter\(v=>!isGraduatedMember\(v\)&&hasPermission/)
  assert.match(legacy, /eligible:eligible\.map\(v=>\(\{id:v\.id,label:v\.user\.email\}\)\)/, 'the graduation date is not returned')
})

test('share links: refused for alumni (every shareable target is club-scoped); terms and tutorials stay allowed', async () => {
  const short = load('actions/short-links.ts', {
    '@/utils/prisma': { prisma: { studentProfile: profile(ALUMNI_AT) } },
    '@/utils/auth': { requireAuth: async () => ({ user: { id: 'grad' } }) },
    '@/lib/short-link-store': { findOrCreateReusableShortLink: async () => assert.fail('no link for alumni') },
  })
  await assert.rejects(short.createShortLink({ target: '/club/synthetic-club' }), e => e.message === g.ALUMNI_REFUSALS.share)
  for (const file of ['actions/terms.ts', 'actions/tutorials.ts']) assert.doesNotMatch(src(file), /assertNotAlumni|alumniRefusal/, file)
  // The QR card already falls back to the full address when a short link is refused.
  assert.match(src('components/qr/qr-code-card.tsx'), /\.catch\(\(\) => \{[^}]*setOptimizedUrl\(`\$\{orig\}\$\{path\}`\);/)
})

test('in-transaction rechecks and the request-scoped graduation read', async () => {
  const pins = {
    'actions/club-settings.ts': /!hasPermission\(await graduateClubAccessOrNull\(tx, member\), permission\)/,
    'actions/roster-import.ts': /const member = await graduateClubAccessOrNull\(tx, await tx\.clubMember\.findUnique/,
    'actions/club-onboarding.ts': /const manager = await graduateClubAccessOrNull\(tx, await tx\.clubMember\.findUnique/,
    'utils/recipient-audience.ts': /const actor = await graduateClubAccessOrNull\(tx, await tx\.clubMember\.findUnique\(\{ where: \{ userId_clubId: \{ clubId, userId: actorId \} \} \}\)\);/,
    'utils/auth.ts': /const requestGraduation = cache\(\(userId: string\) => readGraduation\(prisma\)\(userId\)\);[\s\S]*graduateMemberFor\(prisma, found, permissions, requestGraduation\)/,
  }
  for (const [file, pattern] of Object.entries(pins)) assert.match(src(file), pattern, file)
  // A supplied reader replaces the database read.
  const access = load('lib/graduate-access.ts')
  let reads = 0
  const db = { $queryRaw: async () => assert.fail('the supplied reader is used') }
  const read = async () => { reads++; return { graduatedAt: ALUMNI_AT } }
  assert.equal((await access.graduateClubAccess(db, { ...keptOwner }, read)).handOverOnly, true)
  assert.equal(reads, 1)
})
