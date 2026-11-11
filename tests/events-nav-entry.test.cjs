// Meetings and Events are one Calendar rail item with a type filter (nav reorganization, superseding FE-12's
// separate Events entry). Old Meetings/Events links land on Calendar filtered to that type.
const { test } = require('node:test'), assert = require('node:assert/strict')
const { harness: demoHarness } = require('./helpers/demo-harness.cjs')

test('Calendar replaces Meetings and Events in the club nav for every member, reaches phones, and old links redirect', () => {
  const h = demoHarness(), { createDemoSeed } = h.load('lib/demo/seed.ts'), seed = createDemoSeed('2026-10-18')
  const nav = h.load('lib/product-navigation.ts'), routes = h.load('lib/workspace-routes.ts')
  const owner = seed.memberships.find(m => m.isOwner)
  const items = nav.managerNavigation(owner, owner.clubId, 'club')
  const ids = items.map(i => i.id)
  assert.deepEqual(ids.filter(id => ['meetings', 'events', 'calendar'].includes(id)), ['calendar'], `owner nav: ${ids.join(', ')}`)
  const calendar = items.find(i => i.id === 'calendar')
  assert.equal(calendar.label, 'Calendar')
  assert.equal(new URL(calendar.href, 'https://out-class.net').searchParams.get('section'), 'calendar')
  assert.ok(nav.mobileDestinations(items).some(i => i.id === 'calendar'), 'phones list Calendar too')
  const as = permissions => ({ ...owner, isOwner: false, accessRole: 'MEMBER', permissions })
  assert.ok(nav.managerNavigation(as([]), owner.clubId, 'club').some(i => i.id === 'calendar'), 'everyone has meetings')
  assert.ok(!nav.managerNavigation(owner, owner.clubId, 'recruiting').some(i => i.id === 'calendar'), 'the recruiting nav does not list Calendar')
  assert.equal(routes.clubWorkspaceTitle(new URLSearchParams('section=calendar')), 'Calendar')
  assert.equal(routes.canonicalClubWorkspaceHref('club', new URLSearchParams('section=meetings&meetingTab=events')), '/club/club/workspace?section=calendar&type=events')
  assert.equal(routes.canonicalClubWorkspaceHref('club', new URLSearchParams('section=events')), '/club/club/workspace?section=calendar&type=events')
  assert.equal(routes.canonicalClubWorkspaceHref('club', new URLSearchParams('section=meetings')), '/club/club/workspace?section=calendar&type=meetings')
})
