const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs')
const {loadComponent}=require('./helpers/component-module.cjs')
const text=loadComponent('lib/club-share-text.ts')

test('club share text uses the pitch, never unclaimed placeholder copy', () => {
  assert.equal(text.initials('McIntire Investment Institute'), 'MII')
  assert.equal(text.initials('  '), 'OC')
  assert.equal(text.shareSummary('Student-run venture fund.', 'Long description.'), 'Student-run venture fund.')
  assert.equal(text.shareSummary('', 'We manage a real student portfolio and train analysts. Members pitch weekly.'), 'We manage a real student portfolio and train analysts.')
  assert.equal(text.shareSummary('', 'Club leadership has not yet claimed this profile.'), '')
  assert.equal(text.shareDescription('VVF', ''), 'See VVF on OutClass and apply with one profile.')
})

test('club share metadata points at the canonical club URL and leaves images to the route files', () => {
  const meta = text.clubShareMetadata({ id: 'abc', name: 'Virginia Venture Fund', summary: 'Student-run venture fund.' })
  assert.equal(meta.openGraph.url, 'https://www.out-class.net/club/abc')
  assert.equal(meta.openGraph.title, 'Virginia Venture Fund · OutClass')
  assert.equal(meta.twitter.card, 'summary_large_image')
  assert.equal(meta.openGraph.images, undefined)
})

test('share card renderer only reads assets the club publicly shows and never fetches remote URLs', () => {
  const card = fs.readFileSync('lib/club-share-card.tsx', 'utf8')
  assert.match(card, /^import "server-only"/)
  assert.match(card, /clubProfileImages\(club, true\)\.includes\(stored\)/)
  assert.match(card, /stored\.split\("\/"\)\[1\] !== club\.id/)
  assert.doesNotMatch(card, /\bfetch\(/)
  const fields = /const shareFields = \{([\s\S]*?)\} as const/.exec(fs.readFileSync('lib/club-share-profile.ts', 'utf8'))[1]
  assert.deepEqual([...fields.matchAll(/(\w+): (?:true|\{)/g)].map(m => m[1]), ['id', 'name', 'tagline', 'description', 'category', 'color', 'logoUrl', 'bannerUrl', 'marketing', 'suspendedAt', 'school', 'select', 'name'])
  for (const kind of ['opengraph', 'twitter']) assert.match(fs.readFileSync(`app/(workspace)/club/[clubId]/${kind}-image.tsx`, 'utf8'), /renderClubShareCard\(\(await params\)\.clubId\)/)
})

test('middleware skips session refresh only for club preview image routes', () => {
  const source = fs.readFileSync('middleware.ts', 'utf8')
  const route = /^\/club\/[^/]+\/(?:opengraph|twitter)-image(?:-[\w-]+)?$/
  assert.ok(source.includes(`${route}.test(request.nextUrl.pathname)) return NextResponse.next()`))
  assert.ok(route.test('/club/b90c1444/opengraph-image'))
  assert.ok(route.test('/club/vvf/twitter-image-1a2b3c'))
  assert.ok(!route.test('/club/vvf'))
  assert.ok(!route.test('/club/vvf/workspace'))
  assert.ok(!route.test('/club/vvf/workspace/opengraph-image'))
})
