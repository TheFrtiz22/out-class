// Live voting with several real people at once: separately signed-up and email-verified accounts, the production
// Next build, local Supabase Auth and PostgreSQL, real browsers. One leader (owner), five voters on phones (one joins
// late, one is revoked mid-session), a member without voting rights, a student outside the club, and a projector.
// Covers: joining, concurrent ballots, a tie, reconnecting, a late joiner, revocation, who sees what while voting is
// open and after it closes, ending, and finalization that sends nothing. Synthetic data on the disposable fixture only.
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), { randomUUID } = require('node:crypto')
const { PrismaClient } = require('@prisma/client')
const { chromium } = require('playwright')
const { Actor, readConfig, confirmationMessage } = require('./helpers/onboarding-e2e.cjs')
const configFile = process.env.OUTCLASS_ONBOARDING_E2E_CONFIG
const out = path.resolve('test-results/live-voting-multi-person')

async function verifiedAccount(config, db, label, i) {
  const identifier = 'livevote' + randomUUID().replaceAll('-', '').slice(0, 10)
  const email = identifier + '@virginia.edu', password = 'Local-live-voting-only!' + randomUUID()
  const actor = new Actor(config)
  const signup = await actor.client.auth.signUp({ email, password }); assert.ok(!signup.error, 'disposable signup succeeds')
  const token = (await confirmationMessage(config, email)).Text.match(/\b(\d{6})\b/)?.[1]; assert.ok(token)
  const verified = await actor.client.auth.verifyOtp({ email, token, type: 'email' }); assert.ok(!verified.error)
  const userId = verified.data.user.id
  await db.user.create({ data: { id: userId, email, studentProfile: { create: { firstName: label, lastName: 'Person ' + i, computingId: identifier, major: 'Economics', gradYear: 2028 } } } })
  await actor.signIn(email, password)
  return { actor, userId, email }
}

test('live voting with several signed-in people: ties, late joiners, reconnects, revocation, privacy and finalization', { skip: !configFile, timeout: 900000 }, async t => {
  fs.mkdirSync(out, { recursive: true })
  const config = readConfig(configFile), root = path.dirname(configFile)
  const nav = JSON.parse(fs.readFileSync(path.join(root, 'navigation-fixture.json')))
  const clubId = nav.clubIds[1], db = new PrismaClient({ datasourceUrl: config.status.DB_URL })
  t.after(() => db.$disconnect())
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close())
  const errors = [], contexts = []
  t.after(async () => { for (const c of contexts) await c.close().catch(() => {}) })

  // Fixture: a cycle with four applicants in the review round, five voters, an observer and an outsider.
  const applied = await db.pipelineRound.findFirstOrThrow({ where: { clubId, type: 'APPLICATION_REVIEW' } })
  const next = await db.pipelineRound.findFirstOrThrow({ where: { clubId, type: 'INTERVIEW' } })
  const cycle = await db.recruitmentCycle.create({ data: { clubId, name: 'Live voting E2E ' + randomUUID().slice(0, 8) } })
  const apps = await db.application.findMany({ where: { clubId, roundId: applied.id, status: 'SUBMITTED' }, orderBy: { student: { studentProfile: { lastName: 'asc' } } }, take: 4, include: { student: { include: { studentProfile: true } } } })
  assert.equal(apps.length, 4)
  await db.application.updateMany({ where: { id: { in: apps.map(a => a.id) } }, data: { recruitmentCycleId: cycle.id } })
  const leader = new Actor(config); await leader.signIn(nav.email, nav.password)
  const leaderMember = await db.clubMember.findUniqueOrThrow({ where: { userId_clubId: { userId: nav.userId, clubId } } })
  const voters = []
  for (let i = 0; i < 5; i++) {
    const account = await verifiedAccount(config, db, 'Voter', i + 1)
    account.member = await db.clubMember.create({ data: { clubId, userId: account.userId, accessRole: 'MEMBER', permissions: ['applications.review', 'applicants.identify', 'decisions.vote'] } })
    voters.push(account)
  }
  const observer = await verifiedAccount(config, db, 'Observer', 1)
  observer.member = await db.clubMember.create({ data: { clubId, userId: observer.userId, accessRole: 'MEMBER', permissions: ['applications.review'] } })
  const outsider = await verifiedAccount(config, db, 'Outsider', 1)
  const notificationsBefore = await db.userNotification.count({ where: { clubId } })

  // The leader creates an open-electorate session (anyone eligible who joins votes, late arrivals included).
  // Voting-room actions are owned by the club workspace page; post them there.
  const act = (actor, file, name, args) => actor.action(file, name, args, { params: { clubId } })
  const scope = { clubId, sessionId: randomUUID() }
  await act(leader, 'actions/voting-room.ts', 'createLiveVotingRoom', [{ ...scope, cycleId: cycle.id, roundId: applied.id, applicationIds: apps.map(a => a.id), leaderMemberIds: [leaderMember.id], targetSize: 2, presentationOptions: { fields: ['name'], highlights: {} } }])
  const room = actor => act(actor, 'actions/voting-room.ts', 'getLiveVotingRoom', [scope])
  // Room conflicts come back as { ok: false, code, message } (actions/voting-room.ts domainResult), not as a thrown refusal.
  const command = async (action, extra = {}) => { const r = await room(leader); const res = await act(leader, 'actions/voting-room.ts', 'commandLiveVotingRoom', [{ ...scope, action, revision: r.revision, requestId: randomUUID(), ...extra }]); if (res && res.ok === false) throw new Error(`Room command ${action} refused: ${res.code} ${res.message}`); return res }
  await command('START')

  // Browsers: the leader on a laptop, the projector, four voters on phones (the fifth joins later).
  const url = view => `${config.appUrl}/voting/rooms/${scope.sessionId}?clubId=${clubId}&view=${view}`
  const open = async (actor, view, viewport) => {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 500, hasTouch: viewport.width < 500, storageState: { cookies: [...actor.cookies].map(([name, value]) => ({ name, value, domain: '127.0.0.1', path: '/' })), origins: [] } })
    contexts.push(context); const page = await context.newPage(); page.on('pageerror', e => errors.push(`${view}: ${e.message}`)); await page.goto(url(view)); return page
  }
  const join = async page => { const b = page.getByRole('button', { name: 'Join session', exact: true }); await b.waitFor({ timeout: 20000 }); await b.click(); await page.getByText(/in the room voted/).first().waitFor({ timeout: 20000 }) }
  const leaderPage = await open(leader, 'leader', { width: 1440, height: 900 }), projector = await open(leader, 'present', { width: 1280, height: 720 })
  const phones = []
  for (const v of voters.slice(0, 4)) { const p = await open(v.actor, 'member', { width: 390, height: 844 }); await join(p); phones.push(p) }
  await leaderPage.getByText('4 members joined', { exact: false }).waitFor({ timeout: 20000 })

  // Applicant 1: four people vote at the same moment, two Pass and two Do not pass.
  await leaderPage.getByRole('button', { name: 'Open voting', exact: true }).click()
  for (const p of phones) await p.getByRole('button', { name: 'Pass', exact: true }).waitFor({ timeout: 20000 })
  const choices = ['Pass', 'Pass', 'Do not pass', 'Do not pass']
  await Promise.all(phones.map((p, i) => p.getByRole('button', { name: choices[i], exact: true }).click()))
  for (const [i, p] of phones.entries()) await p.getByText(`Vote recorded · ${choices[i]}`, { exact: true }).waitFor({ timeout: 20000 })
  await leaderPage.getByText('4 of 4 in the room voted', { exact: false }).first().waitFor({ timeout: 20000 })

  // While open: nobody but the voter learns a choice. Leader, observer and projector see counts only.
  const leaderOpen = await room(leader)
  assert.equal(JSON.stringify(leaderOpen).includes(voters[0].member.id) && /"choice":"ACCEPT"/.test(JSON.stringify(leaderOpen)), false, 'no member id paired with a choice in the leader snapshot')
  assert.equal(JSON.stringify(leaderOpen).match(/"totals":\{[^}]*"ACCEPT":2/), null, 'no totals while voting is open')
  await assert.rejects(room(observer.actor), 'a member without voting rights cannot read the room')
  await assert.rejects(room(outsider.actor), 'a student outside the club cannot read the room')
  assert.equal(await projector.getByText('Pass 2', { exact: false }).count(), 0, 'the projector shows no totals while open')
  for (const [i, p] of phones.entries()) for (const [j, other] of choices.entries()) if (j !== i && other !== choices[i]) assert.equal(await p.getByText(`Vote recorded · ${other}`, { exact: true }).count(), 0)

  // Reconnect: voter 1 reloads and their ballot is still there.
  await phones[0].reload(); await phones[0].getByText('Vote recorded · Pass', { exact: true }).waitFor({ timeout: 20000 })

  // Close: a tie. The leader sees the totals and must choose and record a reason; the projector shows the totals now.
  await leaderPage.getByRole('button', { name: 'Close vote', exact: true }).click()
  const confirm = leaderPage.getByRole('region', { name: 'Confirm applicant outcome' })
  await confirm.getByText('Pass 2 · Hold 0 · Do not pass 2 · 0 missing', { exact: true }).waitFor({ timeout: 20000 })
  await confirm.getByText('Tie or no ballots. Choose an outcome and record a reason.', { exact: true }).waitFor()
  for (const name of ['Pass', 'Hold', 'Do not pass']) assert.equal(await confirm.getByRole('button', { name, exact: true }).isDisabled(), true, `${name} needs a reason on a tie`)
  await projector.getByText(/Pass\s*2/).first().waitFor({ timeout: 20000 })
  await confirm.getByRole('textbox', { name: 'Decision reason' }).fill('Tie: discuss again in the held pass')
  await confirm.getByRole('button', { name: 'Hold', exact: true }).click()
  for (const p of [...phones, projector, leaderPage]) await p.getByText(/^Applicant 2 of 4\./).first().waitFor({ state: 'attached', timeout: 20000 })

  // A late joiner arrives on applicant 2 and votes on it.
  const late = await open(voters[4].actor, 'member', { width: 390, height: 844 }); await join(late); phones.push(late)
  await command('OPEN_VOTING')
  for (const p of phones) await p.getByRole('button', { name: 'Pass', exact: true }).waitFor({ timeout: 20000 })
  // Revocation mid-vote: voter 4 leaves the club; their next ballot is refused and nothing is stored for them.
  await db.clubMember.update({ where: { id: voters[3].member.id }, data: { status: 'LEFT', permissions: [] } })
  await Promise.all([0, 1, 2, 4].map(i => phones[i].getByRole('button', { name: 'Pass', exact: true }).click()))
  await phones[3].getByRole('button', { name: 'Pass', exact: true }).click().catch(() => {})
  for (const i of [0, 1, 2, 4]) await phones[i].getByText('Vote recorded · Pass', { exact: true }).waitFor({ timeout: 20000 })
  await phones[3].getByRole('alert').first().waitFor({ timeout: 20000 })
  const ballots = where => db.votingBallot.count({ where: { sessionId: scope.sessionId, passNumber: 1, ...where } })
  assert.equal(await ballots({ memberId: voters[3].member.id, applicationId: apps[1].id }), 0, 'the revoked member has no ballot on applicant 2')
  assert.equal(await ballots({ memberId: voters[3].member.id, applicationId: apps[0].id }), 1, 'their earlier ballot is kept')
  assert.equal(await ballots({ memberId: voters[4].member.id, applicationId: apps[1].id }), 1, 'the late joiner voted on the applicant on screen')
  assert.equal(await ballots({ memberId: voters[4].member.id, applicationId: apps[0].id }), 0, 'and not on one decided before they arrived')

  // Close and confirm the clear Pass, then decide 3 and 4 quickly; then the held applicant in pass 2.
  await leaderPage.getByRole('button', { name: 'Close vote', exact: true }).click()
  // Someone counted in the room has no ballot (the revoked member), so the room asks before closing early.
  const early = leaderPage.getByRole('button', { name: 'Close voting now', exact: true })
  if (await early.waitFor({ timeout: 3000 }).then(() => true, () => false)) await early.click()
  // A clear result: when the session's voting rule decides, the room asks to confirm the rule's outcome;
  // otherwise it shows the leading choice. Either way the outcome is Pass.
  const ruled = leaderPage.getByRole('region', { name: 'Confirm rule outcome' })
  await ruled.or(confirm).first().waitFor({ timeout: 20000 }).catch(async error => { throw new Error(error.message + '\nLEADER SCREEN: ' + (await leaderPage.locator('main').innerText().catch(() => '?')).slice(0, 1500)) })
  if (await ruled.isVisible()) await ruled.getByRole('button', { name: 'Confirm Pass', exact: true }).click()
  else { await confirm.getByText(/^Leading choice: Pass$/).waitFor(); await confirm.getByRole('button', { name: 'Pass', exact: true }).click() }
  await leaderPage.getByText(/^Applicant 3 of 4\./).first().waitFor({ state: 'attached', timeout: 20000 })
  const decide = async (applicationId, passNumber, choice) => { await command('OPEN_VOTING'); await command('CLOSE_VOTING', { confirmed: true, applicationId, passNumber }); const r = await command('DECIDE_AND_ADVANCE', { applicationId, passNumber, choice, reason: 'Synthetic decision' }); return r }
  await decide(apps[2].id, 1, 'REJECT'); await decide(apps[3].id, 1, 'ACCEPT')
  await command('NEXT_PASS')
  await decide(apps[0].id, 2, 'ACCEPT')
  await command('END', { confirmed: true })
  assert.equal((await db.votingSession.findUnique({ where: { id: scope.sessionId }, select: { state: true } })).state, 'COMPLETED', 'END with confirmation completes the session')
  // Members' phones say "Session ended"; the projector says "Voting ended".
  const ended = async (page, text, label) => page.getByText(text).first().waitFor({ timeout: 25000 }).catch(async error => {
    const session = await db.votingSession.findUnique({ where: { id: scope.sessionId }, select: { state: true, endedAt: true, revision: true } }).catch(e => String(e))
    throw new Error(error.message + '\n' + label + ' ' + page.url() + ' session=' + JSON.stringify(session) + '\n' + (await page.locator('body').innerText().catch(() => '?')).slice(0, 1200))
  })
  await ended(projector, /Voting ended/, 'PROJECTOR')
  await ended(phones[0], /Session ended|Voting ended/, 'PHONE')
  assert.equal(await projector.locator('.vr-aud-join').count(), 0, 'no join code after the end')

  // Finalization: Pass means advance to the interview round; nothing is sent.
  const mapping = { kind: 'ADVANCE', roundId: next.id }
  const preview = await act(leader, 'actions/voting-room-finalization.ts', 'previewLiveVotingFinalization', [{ ...scope, mapping }])
  const r = await room(leader)
  await act(leader, 'actions/voting-room-finalization.ts', 'finalizeLiveVotingRoom', [{ ...scope, mapping, requestId: randomUUID(), revision: r.revision, guard: preview.guard, confirmed: true }])
  const moved = await db.application.findMany({ where: { id: { in: apps.map(a => a.id) } }, select: { id: true, roundId: true } })
  assert.deepEqual(moved.filter(a => a.roundId === next.id).map(a => a.id).sort(), [apps[0].id, apps[1].id, apps[3].id].sort(), 'the three passed applicants advance; the rejected one stays')
  assert.equal(await db.userNotification.count({ where: { clubId } }), notificationsBefore, 'voting and finalization notify no one')
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ voters: 5, lateJoiner: true, tie: 'Hold with reason', finalized: true, pageErrors: errors }, null, 1))
  assert.deepEqual(errors, [], 'no page errors in any browser')
})
