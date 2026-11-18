// Site-review backlog (Nov 2026): recruiting counts agree across screens, the unpublished-profile line, the review
// grade shown once, plurals, Decide's Review and Send, accepted applicants' round, opt-in test scores for new clubs,
// the Eastern-time deadline, and the application form living in Recruiting.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { overview } = require('./fixtures/club-home/data.cjs')

function load(file, mocks = {}) {
  const resolved = [file, `${file}.ts`, `${file}.tsx`].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name === '@/components/icons' ? require('./helpers/icons.cjs') : name.endsWith('.css') ? {} : name.startsWith('@/') ? load(path.join(name.slice(2)), mocks) : require(name), mod, mod.exports)
  return mod.exports
}
const read = file => fs.readFileSync(file, 'utf8')
const model = load('components/club-home/club-home-model.ts')
const club = { id: 'fixture-mii', name: 'Fixture Club' }
const member = (permissions, extra = {}) => ({ id: 'member', isOwner: false, permissions, interviewOffices: [], status: 'ACTIVE', ...extra })
const owner = member([], { isOwner: true })

test('#3 the Club home strip counts exactly the items on the Recruiting Overview Needs you, for every access level', () => {
  const accesses = [owner, member(['applications.review']), member(['applications.review', 'interviews.manage', 'applicants.identify']), member(['applications.review', 'decisions.vote'])]
  for (const access of accesses) for (const size of ['large', 'small']) {
    const data = overview(size, club, access)
    data.operations.offers = [{ id: 'offer', applicationId: 'app', expiresAt: new Date(Date.now() + 86400000), label: 'Jordan Avery' }]
    data.operations.votes = [...data.operations.votes, { id: 'done', state: 'COMPLETED', joinOpenedAt: null, participants: [], publishedAt: null, round: { name: 'Round 1 vote' } }]
    const hrefs = model.railHrefs(access, club.id), strip = model.recruitingStrip(data, hrefs)
    if (!strip) continue
    // Each Needs you card's own number, as the card states it.
    const cards = model.recruitingNeeds(data, hrefs)
    const stated = cards.reduce((n, card) => n + card.count, 0)
    assert.equal(strip.attention, model.recruitingAttention(data, hrefs))
    assert.ok(cards.length < 4 ? strip.attention === stated : strip.attention >= stated, `${size}: strip ${strip.attention} vs cards ${stated}`)
    // Nothing the member cannot act on: no reviews card means no reviews counted.
    if (!cards.some(card => card.id === 'reviews')) assert.ok(strip.attention < data.operations.rounds.reduce((n, r) => n + r.pending, 0) || data.operations.rounds.every(r => r.pending === 0))
  }
  // A reviewer without interview management: interview times neither show nor count.
  const reviewer = overview('large', club, member(['applications.review']))
  const hrefs = model.railHrefs(reviewer.membership, club.id)
  assert.equal(model.recruitingStrip(reviewer, hrefs).attention, reviewer.operations.rounds.reduce((n, r) => n + r.pending, 0))
})

test('#3 Club home does not say "You’re clear" beside a strip that says recruiting items need you', () => {
  const src = read('components/manager-overview.tsx')
  assert.match(src, /clear=\{strip && strip\.attention > 0/)
  assert.match(src, /No club work needs you\.<\/strong> Recruiting items are on the Recruiting overview\./)
})

test('#3 a voting session is listed once; two sessions in one round are summarized, not repeated', () => {
  const data = overview('large', club, owner)
  const open = { ...data.operations.votes[0], id: 'a', state: 'OPEN', roundId: 'r-final', round: { name: 'Final Round' } }
  data.operations.votes = [open, { ...open }, { ...open, id: 'b' }]
  const card = model.recruitingNeeds(data, model.railHrefs(owner, club.id)).find(c => c.id === 'vote-live')
  assert.equal(card.count, 2, 'the duplicated row counts once')
  assert.equal(card.title, '2 voting sessions are open')
  assert.equal(card.detail, 'Final Round · 2 sessions')
  data.operations.votes = [open]
  assert.equal(model.recruitingNeeds(data, model.railHrefs(owner, club.id)).find(c => c.id === 'vote-live').detail, 'Final Round · Open')
})

test('#3 Accepted means the same applicants in Pipeline, Decisions delivered and Conversion', () => {
  const insights = load('lib/recruiting-insights.ts')
  const apps = [{ status: 'ACCEPTED' }, { status: 'ACCEPTED' }, { status: 'ACCEPTED' }, { status: 'IN_REVIEW' }, { status: 'REJECTED' }]
  const counts = Object.entries(apps.reduce((m, a) => ({ ...m, [a.status]: (m[a.status] ?? 0) + 1 }), {})).map(([status, count]) => ({ status, count }))
  const stages = model.pipeline(counts).stages
  const accepted = stages.find(stage => stage.id === 'offers')
  assert.equal(accepted.label, 'Accepted')
  assert.equal(accepted.count, insights.recruitingFunnel(apps.map(a => ({ ...a, interviewed: false, offerAccepted: false }))).admitted)
  assert.match(read('components/recruiting-insights-card.tsx'), /label: `Accepted · \$\{rate\(f\.admitted\)\}`/)
  // Both reads use the same population: the active cycle when there is exactly one.
  const action = read('actions/club-overview.ts'), insightsAction = read('actions/recruiting-insights.ts')
  assert.match(insightsAction, /activeRecruitmentCycle\(tx, clubId\)/)
  assert.match(action, /activeRecruitmentCycle\(prisma, clubId\)\.then\(cycle =>/)
  assert.match(action, /AND \(\$\{cycle\?\.id \?\? null\}::text IS NULL OR a\."recruitmentCycleId" = \$\{cycle\?\.id \?\? null\}\)/)
})

test('#5 the Recruiting Overview says quietly when students cannot find the club', () => {
  const src = read('components/recruiting-overview.tsx')
  assert.match(src, /\{club\.isDiscoverable === false && <p className="oc-command-footnote oc-dashboard-note" data-testid="recruiting-unpublished">Not visible to students\./)
  assert.match(src, /hasPermission\(membership, "club\.settings"\) && <> <Link[^>]*section=settings&setting=general`\)\}>Publish profile<\/Link>/)
  assert.match(read('actions/club-overview.ts'), /select: \{ id: true, name: true, tagline: true, isDiscoverable: true \}/)
})

test('#21 scheduled decisions pluralize the candidate count', () => {
  const src = read('components/decision-schedules.tsx')
  assert.match(src, /trigger=\{`View \$\{pluralize\(row\.targets\.length,"candidate"\)\}`\}/)
  const terms = load('lib/copy/terms.ts')
  assert.equal(`View ${terms.pluralize(1, 'candidate')}`, 'View 1 candidate')
  assert.equal(`View ${terms.pluralize(3, 'candidate')}`, 'View 3 candidates')
})

test('#23 Decide: Review summarizes and links to Applicants; Open applicants sits outside the letters card', () => {
  const src = read('components/live-voting/decide-page.tsx')
  assert.doesNotMatch(src, /LiveLeaderWorkspace|DecideReview/, 'Review no longer repeats the Applicants table')
  const send = src.slice(src.indexOf('function SendStep'))
  const letters = send.slice(send.indexOf('aria-labelledby="decide-letters-heading"'))
  assert.ok(send.indexOf('>Open applicants<') < send.indexOf('aria-labelledby="decide-letters-heading"'))
  assert.doesNotMatch(letters.slice(0, letters.indexOf('</Panel>')), /Open applicants/)
  const page = load('lib/decide.ts')
  assert.equal(page.pendingApplicantsHref('club', 'r1', true), '/club/club/workspace?section=recruitment&tool=applicants&decision=pending&roundId=r1&review=1')
  assert.equal(page.pendingApplicantsHref('club', ''), '/club/club/workspace?section=recruitment&tool=applicants&decision=pending')
})

test('#18 accepted applicants read "Accepted" in the Round column, not their last round', () => {
  const views = read('components/views/leader-dashboard/live-applicant-views.tsx')
  const match = views.match(/export const applicantRoundLabel = [^\n]+/)[0]
  const label = new Function(`${ts.transpileModule(match.replace('export ', ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText}; return applicantRoundLabel`)()
  const rounds = [{ id: 'r1', name: 'First Round' }]
  assert.equal(label(rounds, { roundId: 'r1', status: 'ACCEPTED' }), 'Accepted')
  assert.equal(label(rounds, { roundId: 'r1', status: 'IN_REVIEW' }), 'First Round')
  assert.equal((views.match(/applicantRoundLabel\(rounds, app\)/g) || []).length, 2, 'both tables use it')
})

test('#18 SAT and ACT are opt-in for new clubs only; existing clubs keep their saved or default settings', () => {
  const v = load('lib/profile-field-visibility.ts', { zod: require('zod') })
  const fresh = v.newClubProfileFieldVisibility()
  assert.equal(fresh.sat, false); assert.equal(fresh.act, false)
  for (const key of v.profileFieldKeys.filter(key => !['sat', 'act'].includes(key))) assert.equal(fresh[key], v.defaultProfileFieldVisibility()[key], key)
  // Existing clubs: NULL and older saved maps still read SAT and ACT as on.
  assert.equal(v.normalizeProfileFieldVisibility(null).sat, true)
  assert.equal(v.normalizeProfileFieldVisibility({ gpa: true }).act, true)
  // A new club stores the explicit map, so later default changes never flip it.
  assert.deepEqual(v.normalizeProfileFieldVisibility(fresh), fresh)
  for (const file of ['actions/admin-clubs.ts', 'actions/platform-admin.ts', 'actions/platform-organization-onboarding.ts']) assert.match(read(file), /profileFieldVisibility: newClubProfileFieldVisibility\(\)/, file)
  assert.ok(!fs.readdirSync('prisma/migrations').some(dir => /profile_field/.test(dir) && dir > '20261118'), 'no data migration')
})

test('#24 the application deadline is shown and entered in Eastern Time', () => {
  const rooms = load('lib/interview-rooms.ts', { zod: require('zod') })
  // 5 PM Eastern on Dec 1 is 22:00 UTC (EST); on Jul 1 it is 21:00 UTC (EDT), whatever the browser's zone.
  assert.equal(rooms.zonedInputValue('2026-12-01T22:00:00.000Z', 'America/New_York'), '2026-12-01T17:00')
  assert.equal(rooms.zonedInstant('2026-07-01', '17:00', 'America/New_York').toISOString(), '2026-07-01T21:00:00.000Z')
  const src = read('components/views/club-manager/application-builder-view.tsx')
  assert.match(src, /const localDate = \(date: Date \| string \| null\) => deadlineInputValue\(date\)/)
  assert.match(src, /deadline: deadline \|\| null,/, 'the Eastern wall time is sent as shown')
  assert.match(src, /Deadline \(optional, \{SCHEDULING_TIMEZONE_LABEL\}\)/)
  assert.doesNotMatch(src, /getTimezoneOffset|your local time/)
})

test('#7 the application form lives in Recruiting; the old Settings URL redirects; no duplicate rounds/cycles links', () => {
  const routes = load('lib/workspace-routes.ts')
  const next = routes.canonicalClubWorkspaceQuery(new URLSearchParams('section=settings&setting=application'))
  assert.equal(next.get('section'), 'recruitment'); assert.equal(next.get('tool'), 'application'); assert.equal(next.get('setting'), null)
  assert.equal(routes.clubWorkspaceTitle(new URLSearchParams('section=recruitment&tool=application')), 'Application')
  const nav = load('lib/product-navigation.ts')
  const ids = permissions => nav.managerNavigation({ permissions, status: 'ACTIVE' }, 'club', 'recruiting').map(item => item.id)
  assert.ok(ids(['application.manage']).includes('application'))
  assert.ok(!ids(['applications.review']).includes('application'))
  assert.equal(nav.managerNavigation({ permissions: ['application.manage'], status: 'ACTIVE' }, 'club', 'recruiting').find(i => i.id === 'application').href, '/club/club/workspace?section=recruitment&tool=application')
  // Not a rail entry (the rail has no room for another item); it lights Recruiting overview, which links to it.
  const app = nav.managerNavigation({ isOwner: true, status: 'ACTIVE' }, 'club', 'recruiting').find(i => i.id === 'application')
  assert.equal(app.hidden, true)
  const rail = load('lib/navigation.ts')
  assert.equal(rail.activeNavItem('/club/c/workspace', new URLSearchParams('section=recruitment&tool=application')), 'overview')
  assert.ok(rail.leaderRailSections({ permissions: ['application.manage'], status: 'ACTIVE' }, 'c').some(section => section.id === 'recruiting'), 'an application editor still reaches Recruiting')
  assert.match(read('components/recruiting-overview.tsx'), /hasPermission\(membership, "application\.manage"\) && <Button variant="ghost" size="lg" asChild><Link \{\.\.\.clubLinkProps\(clubId, `[^`]*tool=application`\)\}><FileText aria-hidden="true" \/>Application<\/Link>/)
  const { availableSettings } = load('lib/club-settings.ts')
  assert.ok(!availableSettings({ isOwner: true }).some(item => item.id === 'application'))
  const settings = read('components/club-settings-workspace.tsx')
  for (const copy of ['Configure recruitment rounds', 'Manage application cycles', 'ApplicationBuilder']) assert.ok(!settings.includes(copy), copy)
  const page = read('components/recruiting-application.tsx')
  assert.match(page, /<section id="voting-rules"/, 'the Voting room’s #voting-rules link still lands on voting defaults')
  assert.ok(!/setting=(pipeline|cycles)/.test(page))
  const workspace = read('components/club-workspace.tsx')
  assert.match(workspace, /active === "application" \? <RecruitingApplication clubId=\{clubId\} member=\{membership\} \/>/)
  for (const file of ['components/live-voting/room-landing.tsx', 'components/views/leader-dashboard/live-leader-workspace.tsx']) assert.ok(!read(file).includes('setting=application'), file)
})

test('#19 a single grading category is the overall score, shown once', () => {
  const src = read('components/applicant-review/review-grading.tsx')
  assert.match(src, /\{rubric\.categories\.length > 1 && <div className="oc-review-overall-row">/)
  assert.doesNotMatch(src, /"Out of 10"/)
})

// The strip counts every pending offer with a count query (no names), under the Overview's gate.
async function summaryWith({ permissions, isOwner = false, pending = 6, view = 'strip' }) {
  const calls = []
  const model = name => ({
    findMany: async args => { calls.push([name, 'findMany', args]); return [] },
    findUniqueOrThrow: async () => ({ applicationOpen: true, applicationDeadline: null }),
    count: async args => { calls.push([name, 'count', args]); return name === 'clubInvitation' ? pending : 0 },
  })
  const prisma = new Proxy({ $queryRaw: async () => [] }, { get: (target, key) => key in target ? target[key] : model(String(key)) })
  const { dashboardSummary } = load('utils/dashboard-summary.ts', { '@/utils/prisma': { prisma }, '@prisma/client': { Prisma: { sql: (strings, ...values) => ({ strings, values }) } } })
  const result = await dashboardSummary('club-1', { id: 'member', userId: 'user', isOwner, permissions }, view)
  return { result, calls: calls.filter(([name]) => name === 'clubInvitation') }
}

test('#3 the strip reads pending offers as a count: 6 offers count 6, and no offer names reach Club home', async () => {
  const leader = await summaryWith({ permissions: ['applications.review', 'applicants.identify', 'decisions.manage'] })
  assert.equal(leader.result.offerCount, 6)
  assert.deepEqual(leader.result.offers, [], 'the strip view fetches no offer rows')
  assert.deepEqual(leader.calls.map(([, op]) => op), ['count'])
  const where = leader.calls[0][2].where
  assert.equal(where.clubId, 'club-1'); assert.equal(where.status, 'PENDING'); assert.deepEqual(where.application, { clubId: 'club-1', status: 'ACCEPTED' })
  // The Recruiting Overview still lists the four soonest, with the same scope.
  const overview = await summaryWith({ permissions: ['applications.review', 'applicants.identify', 'decisions.manage'], view: 'recruiting' })
  const list = overview.calls.find(([, op]) => op === 'findMany')[2]
  const scope = ({ expiresAt, ...rest }) => ({ ...rest, expires: expiresAt.gt instanceof Date })
  assert.equal(list.take, 4); assert.deepEqual(scope(list.where), scope(where))
  // Without decisions.manage or applicants.identify: nothing queried, 0.
  for (const permissions of [['applications.review', 'applicants.identify'], ['applications.review', 'decisions.manage']]) {
    const member = await summaryWith({ permissions })
    assert.equal(member.result.offerCount, 0); assert.deepEqual(member.calls, [], permissions.join())
  }
  // Six pending offers with no list rows (strip view): the strip and the card both say 6.
  const data = overview_('large', owner)
  data.operations.offers = []; data.operations.offerCount = 6
  data.operations.rounds = data.operations.rounds.map(r => ({ ...r, pending: 0, needsBooking: 0 })); data.operations.votes = []
  const hrefs = model.railHrefs(owner, club.id)
  assert.equal(model.recruitingStrip(data, hrefs).attention, 6)
  const card = model.recruitingNeeds(data, hrefs).find(c => c.id === 'offers')
  assert.equal(card.title, '6 offers awaiting a response'); assert.equal(card.action.kind, 'link')
  // With the Overview's four listed, the title still counts all six.
  data.operations.offers = [1, 2, 3, 4].map(i => ({ id: `o${i}`, applicationId: `a${i}`, expiresAt: new Date(Date.now() + i * 86400000), label: `Applicant ${i}` }))
  assert.equal(model.recruitingNeeds(data, hrefs).find(c => c.id === 'offers').title, '6 offers awaiting a response')
})
function overview_(size, access) { return overview(size, club, access) }

test('#24 deadlineInstant resolves Eastern wall time the same in the browser and on the server', () => {
  const d = load('lib/application-deadline.ts', { zod: require('zod') })
  // Spring forward: 2:30 AM on Mar 8 2026 never happens.
  assert.throws(() => d.deadlineInstant('2026-03-08T02:30'), { name: 'DeadlineError', message: /doesn’t exist on Mar 8/ })
  // Fall back: 1:30 AM on Nov 1 2026 happens twice.
  assert.throws(() => d.deadlineInstant('2026-11-01T01:30'), { name: 'DeadlineError', message: 'This time happens twice on Nov 1; pick another time.' })
  // Either side of the change, same day: EST after the fall-back, EST before the spring-forward.
  assert.equal(d.deadlineInstant('2026-11-01T23:59').toISOString(), '2026-11-02T04:59:00.000Z')
  assert.equal(d.deadlineInstant('2026-03-08T00:00').toISOString(), '2026-03-08T05:00:00.000Z')
  assert.equal(d.deadlineInstant('2026-07-01T17:00').toISOString(), '2026-07-01T21:00:00.000Z')
  // An ISO instant (imports, stored values) is kept; malformed or zone-less-with-seconds values are refused, never server-local.
  assert.equal(d.deadlineInstant('2026-12-01T22:00:00.000Z').toISOString(), '2026-12-01T22:00:00.000Z')
  for (const bad of ['2026-02-30T10:00', '2026-12-01T22:00:00', 'tomorrow', '2026-12-01']) assert.throws(() => d.deadlineInstant(bad), { name: 'DeadlineError' }, bad)
  assert.equal(d.deadlineInputValue('2026-12-01T22:00:00.000Z'), '2026-12-01T17:00')
  // The club and admin save schemas share the check, and both actions resolve with deadlineInstant.
  assert.equal(d.deadlineInput.safeParse('2026-11-01T01:30').error.issues[0].message, 'This time happens twice on Nov 1; pick another time.')
  assert.match(read('lib/club-settings.ts'), /deadline: deadlineInput\.nullable\(\)/)
  assert.match(read('lib/admin-clubs.ts'), /applicationDeadline: deadlineInput\.nullable\(\)/)
  assert.match(read('actions/club-settings.ts'), /applicationDeadline: data\.deadline \? deadlineInstant\(data\.deadline\) : null/)
  assert.match(read('actions/admin-clubs.ts'), /applicationDeadline: d\.applicationDeadline \? deadlineInstant\(d\.applicationDeadline\) : null/)
  for (const file of ['actions/club-settings.ts', 'actions/admin-clubs.ts', 'components/views/club-manager/application-builder-view.tsx', 'components/admin/admin-clubs.tsx']) assert.doesNotMatch(read(file), /new Date\((?:data\.deadline|d\.applicationDeadline|e\.target\.value)/, file)
})

test('#18 a directory-imported club claimed for the first time gets the new-club SAT/ACT default; claimed clubs keep theirs', async () => {
  const v = load('lib/profile-field-visibility.ts', { zod: require('zod') })
  const claim = async club => {
    const writes = []
    await v.markClubClaimed({ club: { findUnique: async () => club, update: async args => { writes.push(args.data) } } }, 'club-1')
    return writes[0]
  }
  const first = await claim({ claimedAt: null, profileFieldVisibility: null })
  assert.ok(first.claimedAt instanceof Date)
  assert.deepEqual(first.profileFieldVisibility, v.newClubProfileFieldVisibility())
  // Already claimed (an active club), or settings saved: only the claim time changes.
  for (const club of [{ claimedAt: new Date('2026-01-01'), profileFieldVisibility: null }, { claimedAt: null, profileFieldVisibility: { sat: true } }]) {
    const write = await claim(club)
    assert.ok(write.claimedAt instanceof Date); assert.equal('profileFieldVisibility' in write, false)
  }
  // Every claim path uses it: admin claim approval, owner grant, and owner invitation acceptance.
  assert.equal((read('actions/platform-admin.ts').match(/markClubClaimed\(tx, /g) || []).length, 2)
  assert.match(read('utils/club-onboarding.ts'), /if \(isOwner\) await markClubClaimed\(tx, invitation\.clubId\);/)
  assert.doesNotMatch(read('actions/platform-admin.ts') + read('utils/club-onboarding.ts'), /data: \{ claimedAt: new Date\(\) \}/)
})
