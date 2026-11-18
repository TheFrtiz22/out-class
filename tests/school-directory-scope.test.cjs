// Multi-school isolation of every public listing: two schools, each with a discoverable club and a published
// public event. Each school's student (or subdomain) sees only its own school's clubs, events, search hits,
// club pages and sitemap entries; another school's club or event is "not found" even by direct id.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { schoolScope, schoolHost } = require('./helpers/school-scope.cjs')

const ROOT = path.resolve(__dirname, '..')
function load(file, mocks) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(ROOT, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('require', 'module', 'exports', code)(name => {
    if (name in mocks) return mocks[name]
    if (name.startsWith('@/lib/')) return load(name.slice(2) + '.ts', mocks)
    return require(name)
  }, mod, mod.exports)
  return mod.exports
}

// ---- A small in-memory Prisma that evaluates the where clauses these reads use. ----
const isPlain = v => v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)
const cmp = v => (v instanceof Date ? +v : v)
function matches(row, where) {
  if (!where) return true
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'OR') return cond.some(w => matches(row, w))
    if (key === 'AND') return cond.every(w => matches(row, w))
    const value = row?.[key]
    if (!isPlain(cond)) return value === cond
    if ('is' in cond) return cond.is === null ? value == null : value != null && matches(value, cond.is)
    if ('isNot' in cond) return cond.isNot === null ? value != null : !(value && matches(value, cond.isNot))
    if ('some' in cond) return (value || []).some(item => matches(item, cond.some))
    const ops = ['in', 'not', 'gte', 'gt', 'lt', 'lte', 'contains', 'mode', 'equals']
    if (Object.keys(cond).every(op => ops.includes(op))) {
      if ('in' in cond && !cond.in.includes(value)) return false
      if ('not' in cond && (cond.not === null ? value == null : value === cond.not)) return false
      if ('equals' in cond && value !== cond.equals) return false
      if ('gte' in cond && !(value != null && cmp(value) >= cmp(cond.gte))) return false
      if ('gt' in cond && !(value != null && cmp(value) > cmp(cond.gt))) return false
      if ('lt' in cond && !(value != null && cmp(value) < cmp(cond.lt))) return false
      if ('lte' in cond && !(value != null && cmp(value) <= cmp(cond.lte))) return false
      if ('contains' in cond && !String(value ?? '').toLowerCase().includes(cond.contains.toLowerCase())) return false
      return true
    }
    return value != null && matches(value, cond)
  })
}
const SCHOOLS = { uva: { id: 'school-uva', key: 'uva' }, tech: { id: 'school-tech', key: 'tech' } }
const future = new Date(Date.now() + 7 * 864e5)
function world() {
  const clubs = Object.values(SCHOOLS).map((school, i) => ({
    id: `00000000-0000-4000-8000-00000000000${i + 1}`, slug: `${school.key}-club`, schoolId: school.id, campusKey: school.key,
    name: `${school.key.toUpperCase()} Investing Club`, tagline: 'Investing together', category: 'Finance', color: '#142d45',
    description: 'A long enough public description of what this club does for students on its own campus every semester.',
    logoUrl: null, bannerUrl: null, marketing: null, testRequirement: 'OPTIONAL', claimedAt: new Date('2026-09-01'), directorySource: null,
    acceptanceRate: null, aumValue: null, isDiscoverable: true, suspendedAt: null, applicationOpen: true, applicationDeadline: null,
    pipelineRounds: [{ id: `round-${i}`, name: 'Application', order: 0, archivedAt: null }], questions: [],
  }))
  const meetings = clubs.map((club, i) => ({
    id: `00000000-0000-4000-9000-00000000000${i + 1}`, clubId: club.id, club, title: `${club.campusKey.toUpperCase()} info session`,
    description: 'Come meet us', date: future, endDate: new Date(+future + 3600e3), allDay: false, location: 'Hall', isPublic: true,
    audience: 'RECRUITMENT', revision: 1, saves: [], _count: { rsvps: 0 },
    publication: { status: 'PUBLISHED', category: 'Info Session', contact: null, rsvpEnabled: false, rsvpRequired: false, capacity: null, rsvpDeadline: null, template: null, flyerId: null, approvedRevision: 1 },
  }))
  for (const club of clubs) club.events = meetings.filter(m => m.clubId === club.id)
  const queries = []
  const table = (name, rows) => ({
    findMany: async q => { queries.push([name, q]); const r = rows.filter(row => matches(row, q.where)); return q.take ? r.slice(0, q.take) : r },
    findFirst: async q => { queries.push([name, q]); return rows.find(row => matches(row, q.where)) ?? null },
    findUnique: async q => { queries.push([name, q]); return rows.find(row => matches(row, q.where)) ?? null },
    count: async q => rows.filter(row => matches(row, q.where)).length,
  })
  return { clubs, meetings, queries, prisma: { club: table('club', clubs), meeting: table('meeting', meetings), clubMember: { findMany: async () => [] }, application: { findMany: async () => [] }, pipelineRound: { findMany: async () => [] } } }
}
function modules(school, w = world(), extra = {}) {
  const mocks = {
    'next/cache': { unstable_cache: fn => fn, revalidatePath() {}, revalidateTag() {} },
    '@/utils/prisma': { prisma: w.prisma },
    '@/utils/school-scope': schoolScope(school),
    '@/utils/auth': { requireAuth: async () => ({ user: { id: 'student' } }), requireClubPermission: async () => assert.fail('no leader access') },
    '@/utils/platform-admin': { requirePlatformAdmin: async () => assert.fail('no admin access') },
    '@/utils/club-write-transaction': { clubWriteTransaction: async () => assert.fail('no writes'), isWriteContention: () => false },
    '@/utils/graduation': { alumniRefusal: async () => null, assertNotAlumni: async () => {} },
    '@/lib/club-transaction-authorization': {},
    '@/actions/typesense-search': { searchPublicClubIds: async () => null },
    ...extra,
  }
  mocks['@/actions/campus-events'] = load('actions/campus-events.ts', mocks)
  return { w, mocks, directory: load('actions/club-directory.ts', mocks), events: mocks['@/actions/campus-events'] }
}
const own = school => w => w.clubs.find(c => c.schoolId === school.id)
const other = school => w => w.clubs.find(c => c.schoolId !== school.id)

for (const [name, school] of Object.entries(SCHOOLS)) {
  test(`${name}: directory, Explore and club pages list only its own school's clubs and events`, async () => {
    const { w, directory } = modules(school)
    const { clubs } = await directory.getClubDirectory()
    assert.deepEqual(clubs.map(c => c.id), [own(school)(w).id])
    assert.deepEqual(clubs[0].publicEvents.map(e => e.id), [own(school)(w).events[0].id])
    assert.ok(w.queries.some(([t, q]) => t === 'club' && q.where.schoolId === school.id))
    // A direct id or slug of another school's club is not found (the club page 404s).
    assert.equal((await directory.getPublicClub(other(school)(w).id)).club, null)
    assert.equal((await directory.getPublicClub(other(school)(w).slug)).club, null)
    const page = (await directory.getPublicClub(own(school)(w).slug)).club
    assert.equal(page.id, own(school)(w).id)
    assert.deepEqual(page.publicEvents.map(e => e.id), [own(school)(w).events[0].id])

    // Saving another school's club by id is refused before any write.
    await assert.rejects(directory.setCorkboardClub({ clubId: other(school)(w).id, saved: true }), /no longer available/)
  })

  test(`${name}: campus events board and shared event links show only its own school's events`, async () => {
    const { w, events } = modules(school)
    const board = await events.getPublicCorkboard({})
    assert.deepEqual(board.events.map(e => e.clubId), [own(school)(w).id])
    assert.deepEqual(board.clubs.map(c => c.id), [own(school)(w).id])
    assert.equal(board.total, 1)
    assert.deepEqual((await events.getDefaultPublicCorkboard()).events.map(e => e.clubId), [own(school)(w).id])
    // Filtering by another school's club id cannot widen the board.
    assert.deepEqual((await events.getPublicCorkboard({ clubId: other(school)(w).id })).events, [])
    assert.equal(await events.getPublicCampusEvent(other(school)(w).events[0].id), null)
    assert.equal((await events.getPublicCampusEvent(own(school)(w).events[0].id)).clubId, own(school)(w).id)
  })

  test(`${name}: account search re-validates public clubs, including Typesense IDs, against its own school`, async () => {
    const w = world()
    const ids = w.clubs.map(c => c.id)
    for (const typesense of [async () => null, async () => ids]) {
      const search = load('actions/workspace-search.ts', { '@/utils/prisma': { prisma: w.prisma }, '@/utils/auth': { requireAuth: async () => ({ user: { id: 'student' } }) }, '@/utils/school-scope': schoolScope(school), '@/actions/typesense-search': { searchPublicClubIds: typesense } })
      const results = await search.searchWorkspace('investing')
      assert.deepEqual(results.filter(r => r.kind === 'club').map(r => r.id), [own(school)(w).id])
    }
  })

  test(`${name}: sitemap and SEO lookups list only its own school's clubs`, async () => {
    const w = world()
    const seoLib = load('lib/public-club-seo.ts', { react: { cache: fn => fn }, 'next/cache': { unstable_cache: fn => fn }, '@/utils/prisma': { prisma: w.prisma }, '@/utils/school-scope': schoolScope(school) })
    assert.deepEqual((await seoLib.getIndexableClubs(school.id)).map(c => c.id), [own(school)(w).id])
    assert.equal(await seoLib.getPublicClubSeo(other(school)(w).id), null)
    const share = load('lib/club-share-profile.ts', { 'server-only': {}, react: { cache: fn => fn }, '@/utils/prisma': { prisma: w.prisma }, '@/utils/school-scope': schoolScope(school) })
    assert.equal(await share.getClubShareProfile(other(school)(w).id), null)
    const { default: sitemap } = load('app/sitemap.ts', { '@/lib/public-club-seo': seoLib, '@/lib/school-host': schoolHost(), '@/utils/school-scope': schoolScope(school), '@/lib/legal-content': { LEGAL_PAGES_PUBLIC: false } })
    const urls = (await sitemap()).map(entry => entry.url)
    const origin = school.id === 'school-uva' ? 'https://www.out-class.net' : 'https://tech.out-class.net'
    assert.ok(urls.includes(`${origin}/club/${own(school)(w).id}`))
    assert.ok(!urls.some(url => url.includes(other(school)(w).id)))
    assert.ok(urls.every(url => url.startsWith(origin)))
  })
}

test('Typesense search filters by the viewer school in the query and drops any hit from another school', async () => {
  const requests = []
  const previous = { url: process.env.TYPESENSE_URL, key: process.env.TYPESENSE_SEARCH_KEY, fetch: global.fetch }
  process.env.TYPESENSE_URL = 'https://search.example.test'; process.env.TYPESENSE_SEARCH_KEY = 'search-only'
  global.fetch = async url => { requests.push(new URL(url)); return { ok: true, json: async () => ({ hits: [{ document: { id: 'tech-club', schoolId: 'school-tech' } }, { document: { id: 'uva-club', schoolId: 'school-uva' } }, { document: { id: 'legacy-doc' } }] }) } }
  try {
    const search = load('actions/typesense-search.ts', {
      'next/headers': { cookies: async () => ({ getAll: () => [] }) },
      '@/lib/rate-limit': { RATE_LIMITS: { searchUser: {}, searchAnonymous: {} } },
      '@/lib/rate-limit-action': { limitAction: async () => ({ ok: true }) },
      '@/utils/supabase/server': { createClient: async () => assert.fail('signed out') },
      '@/utils/school-scope': schoolScope(SCHOOLS.tech),
    })
    assert.deepEqual(await search.searchPublicClubIds('investing'), ['tech-club'])
    assert.equal(requests[0].searchParams.get('filter_by'), 'schoolId:=`school-tech`')
    assert.match(requests[0].searchParams.get('include_fields'), /schoolId/)
  } finally {
    process.env.TYPESENSE_URL = previous.url; process.env.TYPESENSE_SEARCH_KEY = previous.key; global.fetch = previous.fetch
    if (previous.url === undefined) delete process.env.TYPESENSE_URL
    if (previous.key === undefined) delete process.env.TYPESENSE_SEARCH_KEY
  }
})

test('Typesense sync indexes each club with its schoolId and adds the field to an existing collection', () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts/sync-typesense-public-clubs.cjs'), 'utf8')
  assert.match(source, /\{ name: "schoolId", type: "string", facet: true \}/)
  assert.match(source, /id: club\.id, schoolId: club\.schoolId/)
  assert.match(source, /method: "PATCH"/)
})

test('school hosts: <key>.out-class.net names a school; www, the apex and preview hosts do not', () => {
  const { schoolKeyFromHost, schoolOrigin, DEFAULT_SCHOOL } = schoolHost()
  assert.equal(schoolKeyFromHost('uva.out-class.net', true), 'uva')
  assert.equal(schoolKeyFromHost('Tech.Out-Class.net:443', true), 'tech')
  for (const host of ['www.out-class.net', 'out-class.net', 'a.b.out-class.net', 'out-class-git-x.vercel.app', 'evil-out-class.net', '', null, 'tech.localhost:3000'])
    assert.equal(schoolKeyFromHost(host, true), null, String(host))
  assert.equal(schoolKeyFromHost('tech.localhost:3000', false), 'tech')
  assert.equal(schoolOrigin(DEFAULT_SCHOOL), 'https://www.out-class.net')
  assert.equal(schoolOrigin(SCHOOLS.tech), 'https://tech.out-class.net')
})

test('viewer school: the account school wins over the host; then the host school; then the launch school', async () => {
  const resolve = async ({ host, userId = null, user = null, emailSchool = null, schools = [SCHOOLS.uva, SCHOOLS.tech].map(s => ({ ...s, active: true })), platformView = null, viewCookie = !!platformView }) => {
    const prisma = {
      user: { findUnique: async ({ where }) => (where.id === userId ? user : null) },
      schoolIdentifierType: { findFirst: async ({ where }) => { assert.deepEqual(where.school, { active: true }); return emailSchool && where.emailDomain === emailSchool.domain ? { school: emailSchool.school } : null } },
      school: { findUnique: async ({ where }) => schools.find(s => s.key === where.key) ?? null },
    }
    const scope = load('utils/school-scope.ts', {
      react: { cache: fn => fn },
      'next/headers': { cookies: async () => ({ has: () => viewCookie }), headers: async () => ({ get: name => (name === 'host' ? host : null) }) },
      '@/utils/prisma': { prisma },
      // With a valid support session the signed-in Auth user is the administrator, not the target.
      '@/utils/auth': { getSessionUser: async () => ({ data: { user: platformView ? { id: 'admin' } : userId ? { id: userId } : null } }) },
      '@/utils/platform-view-as': { platformViewSession: async () => platformView },
      '@/lib/platform-view-as': { PLATFORM_VIEW_COOKIE: 'view' },
      '@/lib/school-host': schoolHost(),
    })
    const { id, key } = await scope.resolveViewerSchool()
    return { id, key }
  }
  const NODE_ENV = process.env.NODE_ENV; process.env.NODE_ENV = 'production'
  try {
    // Signed out: the main domain is the launch school; a school subdomain is that school.
    assert.deepEqual(await resolve({ host: 'www.out-class.net' }), SCHOOLS.uva)
    assert.deepEqual(await resolve({ host: 'tech.out-class.net' }), SCHOOLS.tech)
    assert.deepEqual(await resolve({ host: 'unknown.out-class.net' }), SCHOOLS.uva)
    // An inactive school's subdomain lists nothing (an id no club has), never the launch school.
    const inactive = await resolve({ host: 'tech.out-class.net', schools: [{ ...SCHOOLS.tech, active: false }] })
    assert.notEqual(inactive.id, SCHOOLS.tech.id); assert.notEqual(inactive.id, SCHOOLS.uva.id)
    // Signed in: the verified identity's school, even on another school's host.
    const techStudent = { email: 'student@tech.edu', schoolIdentities: [{ school: SCHOOLS.tech }] }
    assert.deepEqual(await resolve({ host: 'www.out-class.net', userId: 'u1', user: techStudent }), SCHOOLS.tech)
    assert.deepEqual(await resolve({ host: 'uva.out-class.net', userId: 'u1', user: techStudent }), SCHOOLS.tech)
    // No verified identity yet: the school that claims the account's email domain.
    assert.deepEqual(await resolve({ host: 'www.out-class.net', userId: 'u2', user: { email: 'new@tech.edu', schoolIdentities: [] }, emailSchool: { domain: 'tech.edu', school: SCHOOLS.tech } }), SCHOOLS.tech)
    // No school at all: the host decides.
    assert.deepEqual(await resolve({ host: 'tech.out-class.net', userId: 'u3', user: { email: 'x@example.com', schoolIdentities: [] } }), SCHOOLS.tech)
    // A support session scopes to the target account, not the administrator.
    assert.deepEqual(await resolve({ host: 'www.out-class.net', userId: 'target', user: techStudent, platformView: { targetUserId: 'target' } }), SCHOOLS.tech)
    // A junk or expired view-as cookie falls back to the signed-in account's school, never the host's.
    assert.deepEqual(await resolve({ host: 'uva.out-class.net', userId: 'u1', user: techStudent, viewCookie: true }), SCHOOLS.tech)
  } finally { process.env.NODE_ENV = NODE_ENV }
})

test('every public listing reads through the viewer school', () => {
  const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8')
  for (const file of ['actions/club-directory.ts', 'actions/campus-events.ts', 'actions/typesense-search.ts', 'actions/workspace-search.ts', 'actions/applications.ts', 'actions/meetings.ts', 'lib/public-club-seo.ts', 'lib/public-link-preview.ts', 'app/api/event-flyers/route.ts', 'app/page.tsx', 'components/student-workspace-page.tsx'])
    assert.match(read(file), /resolveViewerSchool\(\)/, file)
  // Anything a shared cache may hold is host-scoped, never viewer-scoped.
  for (const file of ['app/sitemap.ts', 'lib/club-share-profile.ts', 'lib/club-share-card.tsx', 'app/api/club-assets/route.ts']) {
    assert.match(read(file), /resolveHostSchool\(\)/, file)
    assert.doesNotMatch(read(file), /resolveViewerSchool/, file)
  }
  // Cached public reads take the school as an argument, so it is part of the cache key.
  assert.match(read('actions/club-directory.ts'), /unstable_cache\(\s*async \(schoolId: string\)/)
  assert.match(read('lib/public-club-seo.ts'), /unstable_cache\(async \(schoolId: string\)/)
  // Student calendars list other clubs' public meetings from the student's school only.
  assert.match(read('actions/applications.ts'), /schoolPublicMeetingVisibility\(school\.id\)/)
  assert.match(read('actions/meetings.ts'), /schoolPublicMeetingVisibility\(school\.id\)/)
})

// ---- By-id reads, cached responses and writes (authz review follow-up) ----
const realScope = ({ host, signedInUser = null }) => load('utils/school-scope.ts', {
  react: { cache: fn => fn },
  'next/headers': { cookies: async () => ({ has: () => false }), headers: async () => ({ get: name => (name === 'host' ? host : null) }) },
  '@/utils/prisma': { prisma: {
    user: { findUnique: async ({ where }) => (signedInUser && where.id === signedInUser.id ? signedInUser : null) },
    schoolIdentifierType: { findFirst: async () => null },
    school: { findUnique: async ({ where }) => Object.values(SCHOOLS).map(s => ({ ...s, name: s.key.toUpperCase(), active: true })).find(s => s.key === where.key) ?? null },
  } },
  '@/utils/auth': { getSessionUser: async () => ({ data: { user: signedInUser ? { id: signedInUser.id } : null } }) },
  '@/utils/platform-view-as': { platformViewSession: async () => null },
  '@/lib/platform-view-as': { PLATFORM_VIEW_COOKIE: 'view' },
  '@/lib/school-host': schoolHost(),
})

test('share cards depend on the host only: signed-in and signed-out requests on one host get the same card data', async () => {
  const NODE_ENV = process.env.NODE_ENV; process.env.NODE_ENV = 'production'
  try {
    const techStudent = { id: 'u-tech', email: 'student@tech.edu', schoolIdentities: [{ school: SCHOOLS.tech }] }
    for (const host of ['www.out-class.net', 'tech.out-class.net']) {
      const results = []
      for (const signedInUser of [null, techStudent]) {
        const w = world()
        const share = load('lib/club-share-profile.ts', { 'server-only': {}, react: { cache: fn => fn }, '@/utils/prisma': { prisma: w.prisma }, '@/utils/school-scope': realScope({ host, signedInUser }) })
        results.push(await Promise.all(w.clubs.map(club => share.getClubShareProfile(club.id).then(card => card?.id ?? null))))
      }
      assert.deepEqual(results[0], results[1], host)
      const hostSchool = host.startsWith('tech') ? 'school-tech' : 'school-uva'
      assert.deepEqual(results[0].filter(Boolean), [world().clubs.find(c => c.schoolId === hostSchool).id])
    }
  } finally { process.env.NODE_ENV = NODE_ENV }
})

test('share card fallback names the host school (no UVA copy or photograph) for another school', async () => {
  const captured = []
  const card = load('lib/share-card.tsx', {
    'server-only': {}, sharp: () => assert.fail('no campus photograph for another school'),
    'next/og': { ImageResponse: class { constructor(element, options) { captured.push({ element, options }) } } },
    '@/lib/school-host': schoolHost(),
  })
  await card.renderSiteShareCard('public, max-age=3600, s-maxage=3600', { ...SCHOOLS.tech, name: 'Tech University' })
  const text = JSON.stringify(captured[0].element)
  assert.match(text, /Tech University/)
  assert.doesNotMatch(text, /University of Virginia|UVA/)
  await card.renderSiteShareCard('x', { ...SCHOOLS.tech, name: '' })
  assert.match(JSON.stringify(captured[1].element), /"OutClass"|>OutClass</)
  assert.match(fs.readFileSync(path.join(ROOT, 'lib/club-share-card.tsx'), 'utf8'), /renderSiteShareCard\(CACHE, await resolveHostSchool\(\)/)
})

test('sitemap renders per request (per host), never prerendered as the launch school only', () => {
  const sitemap = load('app/sitemap.ts', { '@/lib/public-club-seo': {}, '@/lib/school-host': schoolHost(), '@/utils/school-scope': schoolScope(), '@/lib/legal-content': {} })
  assert.equal(sitemap.dynamic, 'force-dynamic')
  assert.equal(sitemap.revalidate, undefined)
})

for (const [name, school] of Object.entries(SCHOOLS)) {
  test(`${name}: another school's meeting, club link preview, event flyer, RSVP and saved event are refused by id`, async () => {
    const w = world()
    const mine = own(school)(w), theirs = other(school)(w)
    // Meeting by id (student calendar / meeting links).
    const meetings = load('actions/meetings.ts', {
      '@/utils/prisma': { prisma: w.prisma }, '@/utils/school-scope': schoolScope(school),
      '@/utils/auth': { requireAuth: async () => ({ user: { id: 'student' } }), requireClubPermission: async () => assert.fail() },
      '@/utils/graduation': { assertNotAlumni: async () => {} }, 'next/cache': { revalidatePath() {}, revalidateTag() {} },
    })
    assert.equal((await meetings.getMeeting(theirs.events[0].id)).code, 'NOT_FOUND')
    assert.equal((await meetings.getMeeting(mine.events[0].id)).ok, true)
    // Sign-in card club names on club-scoped links.
    const preview = load('lib/public-link-preview.ts', { 'server-only': {}, '@/utils/prisma': { prisma: w.prisma }, '@/utils/school-scope': schoolScope(school) })
    assert.equal(await preview.clubLinkPreview(theirs.id), null)
    assert.equal(await preview.clubLinkPreview(theirs.slug), null)
    assert.equal((await preview.clubLinkPreview(mine.id)).name, mine.name)
    // Public event flyers (private, no-store responses, so per-viewer scope is cache-safe).
    for (const m of w.meetings) m.publication.flyer = { path: `flyers/${m.id}.png` }, m.publication.flyerId = 'flyer'
    const flyers = load('app/api/event-flyers/route.ts', {
      '@/utils/prisma': { prisma: w.prisma }, '@/utils/school-scope': schoolScope(school),
      '@/utils/auth': { requireAuth: async () => assert.fail('public read') }, '@/utils/platform-admin': { requirePlatformAdmin: async () => assert.fail() },
      '@/utils/event-flyer-storage': { privateFlyerStorage: async () => ({ download: async () => ({ data: new Blob([Buffer.from('png')]), error: null }) }) },
      '@/utils/support-audit': { auditSupportAction: async () => {} },
    })
    const flyer = id => flyers.GET(new Request(`https://www.out-class.net/api/event-flyers?eventId=${id}&revision=1`))
    assert.equal((await flyer(theirs.events[0].id)).status, 404)
    assert.notEqual((await flyer(mine.events[0].id)).status, 404)
    // RSVP and save: another school's event is unavailable; nothing is written.
    const writes = []
    const tx = { ...w.prisma, $queryRaw: async () => [], eventRsvp: { findUnique: async () => null, create: async q => writes.push(q), deleteMany: async () => ({}), count: async () => 0 }, savedCampusEvent: { upsert: async q => writes.push(q) }, auditLog: { create: async () => {} } }
    const { events } = modules(school, w, {
      '@/utils/club-write-transaction': { clubWriteTransaction: async fn => fn(tx), isWriteContention: () => false },
      '@/utils/prisma': { prisma: { ...w.prisma, $transaction: async fn => fn(tx) } },
    })
    for (const m of w.meetings) m.publication.rsvpEnabled = true
    assert.deepEqual(await events.setCampusEventRsvp({ eventId: theirs.events[0].id, going: true }), { ok: false, error: 'This event is no longer available.' })
    assert.equal((await events.setSavedCampusEvent({ eventId: theirs.events[0].id, saved: true })).ok, false)
    assert.equal(writes.length, 0)
    assert.equal((await events.setCampusEventRsvp({ eventId: mine.events[0].id, going: true })).ok, true)
    assert.equal((await events.setSavedCampusEvent({ eventId: mine.events[0].id, saved: true })).ok, true)
    assert.equal(writes.length, 2)
  })
}

test('club images: a school host serves only its own clubs; the shared main domain keeps serving all (CDN-public bytes)', async () => {
  const NODE_ENV = process.env.NODE_ENV; process.env.NODE_ENV = 'production'
  try {
    const w = world()
    const refs = w.clubs.map(c => (c.logoUrl = `club-assets/${c.id}/00000000-0000-4000-a000-000000000001.png`))
    const route = load('app/api/club-assets/route.ts', {
      'next/server': { NextResponse: class { constructor(body, init = {}) { this.status = init.status ?? 200; this.headers = new Headers(init.headers) } } },
      '@/utils/prisma': { prisma: w.prisma },
      '@/utils/club-asset-storage': { privateClubAssetStorage: async () => ({ download: async () => ({ data: new Blob([Buffer.from('png')]), error: null }) }) },
      '@/utils/auth': { requireClubPermission: async () => assert.fail('public read') }, '@/utils/platform-admin': { requirePlatformAdmin: async () => assert.fail() },
      '@/lib/rate-limit': { RATE_LIMITS: { clubAssets: {} }, limitRequest: () => null },
      '@/utils/school-scope': realScope({ host: 'tech.out-class.net' }),
      '@/lib/school-host': schoolHost(),
    })
    const get = (host, reference) => route.GET({ headers: new Headers({ host }), nextUrl: new URL(`https://${host}/api/club-assets?reference=${encodeURIComponent(reference)}`) })
    const [uvaLogo, techLogo] = refs
    assert.equal((await get('tech.out-class.net', uvaLogo)).status, 404)
    assert.equal((await get('tech.out-class.net', techLogo)).status, 200)
    assert.equal((await get('www.out-class.net', uvaLogo)).status, 200)
    assert.equal((await get('www.out-class.net', techLogo)).status, 200)
  } finally { process.env.NODE_ENV = NODE_ENV }
})
