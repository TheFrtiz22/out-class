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

test('Needs you: most urgent first, at most four, only what the member may act on', () => {
  assert.deepEqual(cards(overview('large', club, owner)), ['vote-live', 'overdue', 'interviews', 'reviews'])
  assert.deepEqual(cards(overview('large', club, member(['applications.review']))), ['overdue', 'reviews'])
  assert.deepEqual(cards(overview('large', club, member([]))), ['overdue'])
  // An interviewer who can identify applicants but not manage interviews never gets the scheduler card.
  assert.deepEqual(cards(overview('large', club, member(['applicants.identify'], { interviewOffices: ['PRESIDENT'] }))), ['overdue'])
  assert.deepEqual(cards(overview('clear', club, owner)), [])
  const data = overview('large', club, owner)
  data.operations.votes = []; data.operations.tasks.overdue = 0
  assert.deepEqual(cards(data), ['interviews', 'reviews', 'submissions'])
  const reviews = model.needsYou(data, model.railHrefs(owner, club.id)).find(card => card.id === 'reviews')
  assert.deepEqual(reviews.progress, { done: 26, total: 40 })
  const submissions = model.needsYou(data, model.railHrefs(owner, club.id)).find(card => card.id === 'submissions')
  assert.equal(submissions.action.kind, 'task'); assert.equal(submissions.action.review, true)
})

test('every dashboard destination is a rail item for the same member', () => {
  const nav = load('lib/navigation.ts')
  for (const access of [owner, member(['applications.review']), member([]), member(['meetings.manage'])]) {
    const rail = nav.railItems(nav.leaderRailSections(access, club.id)).map(item => item.href)
    for (const href of Object.values(model.railHrefs(access, club.id))) if (href) assert.ok(rail.includes(href), href)
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
  const week = model.thisWeek({ ...data, operations: { ...data.operations, rounds: anonymous } })
  assert.ok(week.filter(item => item.kind === 'interview').every(item => !/Jordan|Avery/.test(item.title)))
})

test('pipeline counts come from status counts and are absent without applicant access', () => {
  assert.equal(model.pipeline(null), null)
  const result = model.pipeline(overview('large', club, owner).recruitment)
  assert.deepEqual(result.stages.map(s => [s.id, s.count]), [['applied', 213], ['review', 145], ['interviews', 24], ['offers', 9]])
  assert.equal(result.waitlisted, 4); assert.equal(result.declined, 31)
  assert.equal(overview('large', club, member([])).recruitment, null)
})

test('This week is soonest first and empty for a clear club', () => {
  const week = model.thisWeek(overview('large', club, owner))
  assert.ok(week.length >= 6)
  assert.deepEqual(week.map(item => +item.at), week.map(item => +item.at).sort((a, b) => a - b))
  assert.deepEqual(new Set(week.map(item => item.kind)), new Set(['meeting', 'interview', 'deadline']))
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
  assert.deepEqual((await api.getClubWorkspaceOverview(clubId)).members, { active: 3, pendingInvitations: 3 })
  const [members, invitations] = counts.filter(([name]) => name === 'clubMember' || name === 'clubInvitation')
  assert.deepEqual(members[1].where, { clubId, status: 'ACTIVE', user: { disabledAt: null } })
  assert.equal(invitations[1].where.clubId, clubId); assert.equal(invitations[1].where.status, 'PENDING'); assert.equal(invitations[1].where.applicationId, null)
  assert.equal(invitations[1].where.requestedRole, 'MEMBER'); assert.deepEqual(invitations[1].where.purpose, { in: ['MEMBERSHIP', 'ACCESS_GRANT'] })
  for (const permissions of [[], ['applications.review'], ['meetings.manage', 'tasks.manage']]) {
    access = member(permissions); counts = []
    assert.equal((await api.getClubWorkspaceOverview(clubId)).members, null)
    assert.equal(counts.filter(([name]) => name === 'clubMember' || name === 'clubInvitation').length, 0)
  }
  access = member(['leaders.manage'])
  assert.deepEqual((await api.getClubWorkspaceOverview(clubId)).members, { active: 3, pendingInvitations: 3 })
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
  // A single tab (e.g. members who only see the interview kit) gets a full-width indicator.
  assert.match(fs.readFileSync('styles/interface-primitives.css', 'utf8'), /\[data-variant="segmented"\]:not\(:has\(> :nth-child\(2\)\)\) \{ --segments: 1; \}/)
  // Overlays share the frosted navigation material; tables, the projector and fields keep solid surfaces.
  assert.match(fs.readFileSync('styles/product-components.css', 'utf8'), /\[data-slot="alert-dialog-content"\]\):not\([^)]*\) \{ background: var\(--oc-glass-frosted-material\)/)
  assert.match(fs.readFileSync('styles/workspace-composition.css', 'utf8'), /\.oc-data-surface \{[^}]*background: var\(--oc-content-solid\)/)
  const tokens = fs.readFileSync('styles/tokens.css', 'utf8')
  assert.match(tokens, /--oc-content-surface: var\(--oc-surface-glass\);/)
  assert.match(tokens.slice(tokens.indexOf('[data-theme="present"]')), /--oc-content-surface: #162638;[\s\S]*--oc-content-shadow: var\(--oc-content-shadow-solid\);/)
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
