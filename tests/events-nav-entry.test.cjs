// FE-12 (owner decision 2026-11-05): club events are one click from the leader nav; old links redirect.
const { test } = require('node:test'), assert = require('node:assert/strict')
const { harness: demoHarness } = require('./helpers/demo-harness.cjs')

test('Events sits after Meetings for members who manage meetings, links to section=events, and reaches phones', () => {
  const h = demoHarness(), { createDemoSeed } = h.load('lib/demo/seed.ts'), seed = createDemoSeed('2026-10-18')
  const nav = h.load('lib/product-navigation.ts'), routes = h.load('lib/workspace-routes.ts')
  const owner = seed.memberships.find(m => m.isOwner)
  const items = nav.managerNavigation(owner, owner.clubId, 'club')
  const ids = items.map(i => i.id)
  assert.equal(ids[ids.indexOf('meetings') + 1], 'events', `owner nav: ${ids.join(', ')}`)
  const events = items.find(i => i.id === 'events')
  assert.equal(events.label, 'Events')
  assert.equal(new URL(events.href, 'https://out-class.net').searchParams.get('section'), 'events')
  assert.ok(nav.mobileDestinations(items).some(i => i.id === 'events'), 'phones list Events too')
  const member = { ...owner, isOwner: false, accessRole: 'MEMBER', permissions: [] }
  assert.ok(!nav.managerNavigation(member, owner.clubId, 'club').some(i => i.id === 'events'), 'members without meetings.manage do not see Events')
  assert.equal(routes.clubWorkspaceTitle(new URLSearchParams('section=events')), 'Events')
  assert.equal(routes.canonicalClubWorkspaceHref('club', new URLSearchParams('section=meetings&meetingTab=events')), '/club/club/workspace?section=events')
})
