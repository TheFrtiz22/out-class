// Club home model, overview action gating, welcome deadline, and the glass primitive variants.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { overview } = require('./fixtures/club-home/data.cjs')

function load(file, mocks = {}) {
  if (!fs.existsSync(file) && file.endsWith('.ts')) file += 'x'
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name === '@/components/icons' ? require('./helpers/icons.cjs') : name.endsWith('.css') ? {} : name.startsWith('@/') ? load(name.slice(2) + '.ts', mocks) : require(name), mod, mod.exports)
  return mod.exports
}
const model = load('components/club-home/club-home-model.ts')
const club = { id: 'fixture-mii', name: 'Fixture Club' }
const member = (permissions, extra = {}) => ({ id: 'member', isOwner: false, permissions, interviewOffices: [], status: 'ACTIVE', ...extra })
const owner = member([], { isOwner: true })
const cards = data => model.needsYou(data, model.railHrefs(data.membership, club.id)).map(card => card.id)

const recruiting = data => model.recruitingNeeds(data, model.railHrefs(data.membership, club.id)).map(card => card.id)
const RECRUITING_CARDS = ['vote-live', 'vote-upcoming', 'vote-complete', 'interviews', 'reviews', 'offers']

test('Club home Needs you: club work only, most urgent first, at most four, only what the member may act on', () => {
  // Owner: own overdue task, team overdue, submissions to review, a task due soon. No vote, interview or review cards.
  assert.deepEqual(cards(overview('large', club, owner)), ['overdue', 'team-overdue', 'submissions', 'due-soon'])
  for (const access of [owner, member(['applications.review']), member(['applicants.identify', 'interviews.manage', 'decisions.view', 'applications.review'])]) {
    assert.deepEqual(cards(overview('large', club, access)).filter(id => RECRUITING_CARDS.includes(id)), [], 'no recruiting cards on Club home')
  }
  assert.deepEqual(cards(overview('large', club, member(['applications.review']))), ['overdue', 'due-soon'])
  assert.deepEqual(cards(overview('large', club, member([]))), ['overdue', 'due-soon'])
  assert.deepEqual(cards(overview('clear', club, owner)), [])
  const data = overview('large', club, owner)
  data.operations.tasks.overdue = 0; data.operations.team.overdue = 0; data.work = data.work.filter(w => +new Date(w.task.dueAt) > Date.now() + 3 * 86400000)
  // A meeting in the next 48 hours with no agenda, for members who run meetings; pending invitations for directory access.
  data.operations.meetings[0].agenda = ''
  assert.deepEqual(cards(data), ['submissions', 'agenda', 'invitations'])
  const submissions = model.needsYou(data, model.railHrefs(owner, club.id)).find(card => card.id === 'submissions')
  assert.equal(submissions.action.kind, 'task'); assert.equal(submissions.action.review, true)
  assert.equal(model.needsYou(data, model.railHrefs(owner, club.id)).find(card => card.id === 'agenda').action.kind, 'meeting')
  assert.ok(!cards({ ...data, membership: member([]) }).includes('agenda'), 'agenda card needs meetings.manage')
})

test('Recruiting Needs you keeps its order: live vote, reviews, interview times, voting complete, offers', () => {
  const data = overview('large', club, owner)
  data.operations.votes = [...data.operations.votes, { ...data.operations.votes[0], id: 'done', state: 'COMPLETED', round: { name: 'Round 1 vote' } }]
  data.operations.offers = [{ id: 'offer', applicationId: 'app', expiresAt: new Date(Date.now() + 3 * 86400000), label: 'Jordan Avery' }]
  assert.deepEqual(model.recruitingNeeds(data, model.railHrefs(owner, club.id)).map(card => card.id), ['vote-live', 'reviews', 'interviews', 'vote-complete'])
  data.operations.votes = data.operations.votes.filter(v => v.id === 'done')
  assert.deepEqual(recruiting(data), ['reviews', 'interviews', 'vote-complete', 'offers'])
  const reviews = model.recruitingNeeds(data, model.railHrefs(owner, club.id)).find(card => card.id === 'reviews')
  assert.deepEqual(reviews.progress, { done: 26, total: 40 })
  assert.equal(model.recruitingNeeds(data, model.railHrefs(owner, club.id)).find(card => card.id === 'offers').action.kind, 'applicant')
  // Permission subsets: a reviewer gets reviews only; a plain member nothing.
  assert.deepEqual(recruiting(overview('large', club, member(['applications.review']))), ['reviews'])
  assert.deepEqual(recruiting(overview('large', club, member([]))), [])
})

test('the recruiting strip shows only with recruiting access and an active cycle', () => {
  const strip = (data, access = data.membership) => model.recruitingStrip(data, model.railHrefs(access, club.id))
  const data = overview('large', club, owner)
  assert.deepEqual(strip(data), { open: true, applicants: 213, attention: 14 + 6 + 1, href: model.railHrefs(owner, club.id).recruiting })
  assert.equal(strip(overview('large', club, member([]))), null, 'no recruiting tool, no strip')
  assert.equal(strip(overview('clear', club, owner)), null, 'no active cycle, no strip')
  const closed = overview('small', club, owner)
  closed.operations.intake.applicationOpen = false
  assert.equal(strip(closed).open, false)
  assert.equal(model.recruitingActive(overview('clear', club, owner).operations), false)
  // Clubs accept applications by default: an open intake with no cycle and no rounds is not an active cycle.
  assert.equal(model.recruitingActive({ ...overview('clear', club, owner).operations, intake: { applicationOpen: true, applicationDeadline: null } }), false)
})

test('every dashboard destination is a rail item for the same member', () => {
  const nav = load('lib/navigation.ts')
  for (const access of [owner, member(['applications.review']), member([]), member(['meetings.manage'])]) {
    const rail = nav.railItems(nav.leaderRailSections(access, club.id)).map(item => item.href)
    // A dashboard link is a rail destination, optionally narrowed (Calendar's type filter, Home's announcements).
    for (const href of Object.values(model.railHrefs(access, club.id))) if (href) assert.ok(rail.some(item => href === item || href.startsWith(`${item}&`)), href)
  }
  const plain = model.railHrefs(member([]), club.id)
  assert.equal(plain.applicants, null); assert.equal(plain.interviews, null); assert.equal(plain.announcements, null)
  assert.ok(plain.meetings && plain.tasks)
})

test('interviews never show a name or initials where the round is anonymized', () => {
  const data = overview('large', club, owner)
  const booking = data.operations.bookings[0]
  assert.deepEqual(model.interviewPerson(booking, data.operations.rounds), { label: 'Jordan Avery', initials: 'JA', anonymous: false })
  const anonymous = data.operations.rounds.map(r => r.id === booking.roundId ? { ...r, anonymous: true } : r)
  const person = model.interviewPerson(booking, anonymous)
  assert.equal(person.anonymous, true); assert.equal(person.initials, ''); assert.doesNotMatch(person.label, /Jordan|Avery/)
  assert.match(person.label, /^Applicant [0-9A-F]+$/)
  assert.equal(model.interviewPerson({ ...booking, candidate: person.label }, data.operations.rounds).initials, '')
  // Club home's week has no interviews at all; they live on the Recruiting Overview.
  assert.ok(model.thisWeek(data).every(item => !/Jordan|Avery|Interview/.test(item.title)))
})

test('pipeline counts come from status counts and are absent without applicant access', () => {
  assert.equal(model.pipeline(null), null)
  const result = model.pipeline(overview('large', club, owner).recruitment)
  assert.deepEqual(result.stages.map(s => [s.id, s.count]), [['applied', 213], ['review', 145], ['interviews', 24], ['offers', 9]])
  assert.equal(result.waitlisted, 4); assert.equal(result.declined, 31)
  assert.equal(overview('large', club, member([])).recruitment, null)
})

test('This week is club work only (meetings and task due dates), soonest first, and empty for a clear club', () => {
  const week = model.thisWeek(overview('large', club, owner))
  assert.ok(week.length >= 4)
  assert.deepEqual(week.map(item => +item.at), week.map(item => +item.at).sort((a, b) => a - b))
  assert.deepEqual(new Set(week.map(item => item.kind)), new Set(['meeting', 'task']))
  assert.ok(!week.some(item => /Applications close|Decisions/.test(item.title)), 'no recruiting dates')
  const keys = model.keyDates(overview('large', club, owner).operations)
  assert.deepEqual(keys.map(item => item.title), ['Applications close', 'Decisions scheduled to send'])
  assert.deepEqual(model.thisWeek(overview('clear', club, owner)), [])
})

test('welcome deadline: time left only while recruiting is open and for members who may see intake', () => {
  const welcome = load('lib/welcome.ts')
  const data = overview('large', club, owner), now = new Date(data.operations.asOf)
  const context = access => ({ mode: 'club', clubId: club.id, membership: access, data: { ...data, membership: access } })
  assert.equal(welcome.welcomeDeadline(context(owner), now), 'Applications close in 2 days.')
  assert.equal(welcome.welcomeDeadline(context(member([])), now), null)
  assert.equal(welcome.welcomeDeadline(context(owner), new Date(+now + 2 * 86400000)), 'Applications close in 5 hours.')
  assert.equal(welcome.welcomeDeadline(context(owner), new Date(+now + 3 * 86400000)), null)
  assert.equal(welcome.welcomeDeadline({ mode: 'personal', applications: [], events: [], memberClubIds: [] }, now), null)
  assert.equal(welcome.welcomeDeadline(context(owner), null), null)
})

test('overview action: member counts only with member-directory access, scoped to the club', async () => {
  const clubId = '00000000-0000-4000-8000-000000000001'
  let access = owner, counts = []
  const model = name => ({ findUniqueOrThrow: async () => ({ id: clubId, name: 'Club', tagline: '' }), findFirst: async () => null, findMany: async () => [], groupBy: async () => [], count: async query => { counts.push([name, query]); return 3 } })
  const prisma = { club: model('club'), meeting: model('meeting'), taskAssignment: model('taskAssignment'), application: model('application'), interviewBooking: model('interviewBooking'), votingSession: model('votingSession'), clubMember: model('clubMember'), clubInvitation: model('clubInvitation') }
  const api = load('actions/club-overview.ts', { '@/utils/prisma': { prisma }, '@/utils/auth': { requireClubMembership: async () => ({ membership: access }), requireClubPermission: async () => ({}) }, '@/utils/dashboard-summary': { dashboardSummary: async () => ({}), dashboardReviewQueue: async () => [] } })
  assert.deepEqual((await api.getClubWorkspaceOverview(clubId)).members, { active: 3, pendingInvitations: 3, recent: 3 })
  const [members, invitations, recent] = counts.filter(([name]) => name === 'clubMember' || name === 'clubInvitation')
  assert.equal(recent[1].where.clubId, clubId); assert.ok(recent[1].where.joinedAt.gte instanceof Date)
  assert.deepEqual(members[1].where, { clubId, status: 'ACTIVE', user: { disabledAt: null } })
  assert.equal(invitations[1].where.clubId, clubId); assert.equal(invitations[1].where.status, 'PENDING'); assert.equal(invitations[1].where.applicationId, null)
  assert.equal(invitations[1].where.requestedRole, 'MEMBER'); assert.deepEqual(invitations[1].where.purpose, { in: ['MEMBERSHIP', 'ACCESS_GRANT'] })
  for (const permissions of [[], ['applications.review'], ['meetings.manage', 'tasks.manage']]) {
    access = member(permissions); counts = []
    assert.equal((await api.getClubWorkspaceOverview(clubId)).members, null)
    assert.equal(counts.filter(([name]) => name === 'clubMember' || name === 'clubInvitation').length, 0)
  }
  access = member(['leaders.manage'])
  assert.deepEqual((await api.getClubWorkspaceOverview(clubId)).members, { active: 3, pendingInvitations: 3, recent: 3 })
  // The recruiting views never read member counts; Club home's view does.
  assert.equal((await api.getClubWorkspaceOverview(clubId, 'recruiting')).members, null)
  assert.deepEqual((await api.getClubWorkspaceOverview(clubId, 'club')).members, { active: 3, pendingInvitations: 3, recent: 3 })
  await assert.rejects(api.getClubWorkspaceOverview(clubId, 'everything'))
})

test('glass defaults: Card, Panel, Skeleton and Tabs default to glass; variant="default" keeps the solid surface', () => {
  const { Card } = load('components/ui/card.tsx'), { Panel } = load('components/ui/panel.tsx'), { Skeleton } = load('components/ui/skeleton.tsx'), { LoadingState } = load('components/ui/loading-state.tsx'), { Button } = load('components/ui/button.tsx')
  const html = element => renderToStaticMarkup(element)
  assert.match(html(React.createElement(Card, null, 'x')), /data-slot="card" data-variant="glass"/)
  assert.doesNotMatch(html(React.createElement(Card, { variant: 'default' }, 'x')), /data-variant/)
  for (const variant of ['glass', 'glass-raised', 'glass-navy']) {
    assert.match(html(React.createElement(Card, { variant }, 'x')), new RegExp(`data-slot="card" data-variant="${variant}"`))
    assert.match(html(React.createElement(Panel, { variant, as: 'section' }, 'x')), new RegExp(`<section data-slot="panel" data-tone="card" data-variant="${variant}"`))
  }
  // Panel's card tone is glass through the content tokens, so its markup is unchanged.
  assert.equal(html(React.createElement(Panel, null, 'x')), '<div data-slot="panel" data-tone="card" class="oc-content-panel">x</div>')
  assert.equal(html(React.createElement(Panel, { tone: 'subtle' }, 'x')), '<div data-slot="panel" data-tone="subtle" class="oc-content-panel">x</div>')
  assert.equal(html(React.createElement(Skeleton)), '<div data-slot="skeleton" aria-hidden="true" data-variant="glass" class="oc-skeleton rounded-md"></div>')
  assert.doesNotMatch(html(React.createElement(Skeleton, { variant: 'default' })), /data-variant/)
  assert.match(html(React.createElement(LoadingState, { variant: 'glass', layout: 'rows', rows: 1 })), /data-layout="rows" data-variant="glass"/)
  assert.doesNotMatch(html(React.createElement(LoadingState, { layout: 'rows', rows: 1 })), /data-layout="rows" data-variant/)
  assert.match(html(React.createElement(Button, { variant: 'glass' }, 'Post')), /data-variant="glass"/)
  assert.match(html(React.createElement(Button, { variant: 'glass-primary' }, 'New')), /data-variant="glass-primary"/)
  assert.match(html(React.createElement(Button, null, 'Save')), /data-variant="default"/)
  const tabs = fs.readFileSync('components/ui/tabs.tsx', 'utf8')
  assert.match(tabs, /variant\?: 'subtle' \| 'underline' \| 'segmented'/)
  assert.match(tabs, /variant = 'segmented'/)
  // Three or more tabs scroll inside the track at full label width instead of clipping on phones.
  assert.match(fs.readFileSync('styles/interface-primitives.css', 'utf8'), /\[data-variant="segmented"\]:has\(> \[data-slot="tabs-trigger"\] ~ \[data-slot="tabs-trigger"\] ~ \[data-slot="tabs-trigger"\]\) \[data-slot="tabs-trigger"\] \{ flex: 1 0 auto; min-width: max-content; \}/)
  // A single tab (e.g. members who only see the interview kit) gets a full-width indicator.
  assert.match(fs.readFileSync('styles/interface-primitives.css', 'utf8'), /\[data-variant="segmented"\]:not\(:has\(> \[data-slot="tabs-trigger"\] ~ \[data-slot="tabs-trigger"\]\)\) \{ --segments: 1; \}/)
  // Overlays share the frosted navigation material; tables, the projector and fields keep solid surfaces.
  assert.match(fs.readFileSync('styles/product-components.css', 'utf8'), /\[data-slot="alert-dialog-content"\]\):not\([^)]*\) \{ background: var\(--oc-glass-frosted-material\)/)
  assert.match(fs.readFileSync('styles/workspace-composition.css', 'utf8'), /\.oc-data-surface \{[^}]*background: var\(--oc-content-solid\)/)
  const tokens = fs.readFileSync('styles/tokens.css', 'utf8')
  assert.match(tokens, /--oc-content-surface: var\(--oc-surface-glass\);/)
  assert.match(tokens.slice(tokens.indexOf('[data-theme="present"]')), /--oc-content-surface: #162638;[\s\S]*--oc-elevation-surface: var\(--oc-content-shadow-solid\);[\s\S]*--oc-content-shadow: var\(--oc-elevation-surface\);/)
})

test('glass tokens: solid default, backdrop-filter enhancement, reduced-transparency and forced-colors overrides', () => {
  const css = fs.readFileSync('styles/navigation-glass.css', 'utf8')
  const blocks = { supports: css.slice(css.indexOf('@supports ((backdrop-filter'), css.indexOf('/* Portaled')), reduced: css.slice(css.indexOf('@media (prefers-reduced-transparency')), forced: css.slice(css.indexOf('@media (forced-colors')) }
  const base = css.slice(css.indexOf(':root, [data-product-shell] {'), css.indexOf('@supports', css.indexOf(':root, [data-product-shell] {')))
  for (const token of ['--oc-surface-glass', '--oc-surface-glass-raised', '--oc-surface-glass-navy', '--oc-surface-ambient']) {
    assert.match(base, new RegExp(`${token}:`), `${token} solid default`)
    for (const [name, block] of Object.entries(blocks)) assert.match(block, new RegExp(`${token}:`), `${token} in ${name}`)
  }
  assert.match(base, /--oc-surface-ambient: none;/)
  assert.match(blocks.reduced, /--oc-surface-glass-filter: none;/)
  // Text never passes through a filter: blur in the primitives sits on ::before layers or bare tracks.
  const primitives = fs.readFileSync('styles/interface-primitives.css', 'utf8')
  for (const rule of primitives.split('}').filter(rule => /backdrop-filter:\s*var/.test(rule))) assert.match(rule, /::before|tabs-list|sonner-toast/, rule.trim().slice(0, 120))
  assert.doesNotMatch(fs.readFileSync('components/club-home/club-home.css', 'utf8'), /backdrop-filter:\s*(?!none)/)
})

test('each dashboard reads only its own data: Club home never queries applicants, bookings, votes or offers', async () => {
  const reads = view => {
    const seen = new Set(), model = name => ({ findMany: async () => { seen.add(name); return [] }, findUniqueOrThrow: async () => { seen.add(name); return { applicationOpen: true, applicationDeadline: null } }, count: async () => { seen.add(name); return 0 } })
    const prisma = { club: model('club'), recruitmentCycle: model('cycle'), meeting: model('meeting'), clubAnnouncement: model('announcement'), taskAssignment: model('task'), interviewBooking: model('booking'), votingSession: model('vote'), scheduledCommunication: model('scheduled'), clubInvitation: model('offer'), clubTask: model('teamTasks'), $queryRaw: async () => { seen.add('raw'); return [] } }
    const { dashboardSummary } = load('utils/dashboard-summary.ts', { '@/utils/prisma': { prisma } })
    const everyone = ['applications.review', 'applicants.identify', 'interviews.manage', 'decisions.manage', 'decisions.view', 'decisions.vote', 'decisions.publish', 'tasks.manage']
    return dashboardSummary('club', { id: 'member', userId: 'user', isOwner: true, permissions: everyone }, view).then(() => seen)
  }
  const recruiting = ['club', 'cycle', 'booking', 'vote', 'scheduled', 'offer', 'raw']
  const home = await reads('club')
  for (const name of recruiting.filter(name => name !== 'raw')) assert.ok(!home.has(name), `Club home does not read ${name}`)
  for (const name of ['meeting', 'announcement', 'task', 'teamTasks']) assert.ok(home.has(name), `Club home reads ${name}`)
  const cycle = await reads('recruiting')
  for (const name of ['meeting', 'announcement', 'task', 'teamTasks']) assert.ok(!cycle.has(name), `Recruiting does not read ${name}`)
  for (const name of ['club', 'cycle', 'booking', 'vote', 'raw']) assert.ok(cycle.has(name), `Recruiting reads ${name}`)
  const strip = await reads('strip')
  assert.deepEqual([...strip].sort(), ['club', 'cycle', 'raw', 'vote'], 'the strip reads intake, cycles, round counts and votes only')
})

test('authz: new overview fields keep their gates in every view', async () => {
  for (const view of ['all', 'club', 'recruiting', 'strip']) {
    const seen = new Set(), model = name => ({ findMany: async () => { seen.add(name); return [] }, findUniqueOrThrow: async () => { seen.add(name); return {} }, count: async () => { seen.add(name); return 0 } })
    const prisma = { club: model('club'), recruitmentCycle: model('cycle'), meeting: model('meeting'), clubAnnouncement: model('announcement'), taskAssignment: model('task'), interviewBooking: model('booking'), votingSession: model('vote'), scheduledCommunication: model('scheduled'), clubInvitation: model('offer'), clubTask: model('teamTasks'), $queryRaw: async () => { seen.add('raw'); return [] } }
    const { dashboardSummary } = load('utils/dashboard-summary.ts', { '@/utils/prisma': { prisma } })
    // A plain member: no task-manager list (teamTasks), no round counts (reviewed lives in the rounds query), no team aggregate.
    const result = await dashboardSummary('club', { id: 'member', userId: 'user', isOwner: false, permissions: [] }, view)
    assert.deepEqual(result.teamTasks, [], view); assert.deepEqual(result.rounds, [], view); assert.equal(result.team, null, view)
    assert.ok(!seen.has('teamTasks') && !seen.has('raw') && !seen.has('booking') && !seen.has('offer'), `${view}: nothing gated was queried`)
  }
})
