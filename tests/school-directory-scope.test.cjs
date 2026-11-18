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
  const code = ts.transpileModule(fs.readFileSync(path.join(ROOT, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
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
  const resolve = async ({ host, userId = null, user = null, emailSchool = null, schools = [SCHOOLS.uva, SCHOOLS.tech].map(s => ({ ...s, active: true })), platformView = null }) => {
    const prisma = {
      user: { findUnique: async ({ where }) => (where.id === userId ? user : null) },
      schoolIdentifierType: { findFirst: async ({ where }) => { assert.deepEqual(where.school, { active: true }); return emailSchool && where.emailDomain === emailSchool.domain ? { school: emailSchool.school } : null } },
      school: { findUnique: async ({ where }) => schools.find(s => s.key === where.key) ?? null },
    }
    const scope = load('utils/school-scope.ts', {
      react: { cache: fn => fn },
      'next/headers': { cookies: async () => ({ has: () => !!platformView }), headers: async () => ({ get: name => (name === 'host' ? host : null) }) },
      '@/utils/prisma': { prisma },
      '@/utils/auth': { getSessionUser: async () => ({ data: { user: userId && !platformView ? { id: userId } : null } }) },
      '@/utils/platform-view-as': { platformViewSession: async () => platformView },
      '@/lib/platform-view-as': { PLATFORM_VIEW_COOKIE: 'view' },
      '@/lib/school-host': schoolHost(),
    })
    return scope.resolveViewerSchool()
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
  } finally { process.env.NODE_ENV = NODE_ENV }
})

test('every public listing reads through the viewer school', () => {
  const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8')
  for (const file of ['actions/club-directory.ts', 'actions/campus-events.ts', 'actions/typesense-search.ts', 'actions/workspace-search.ts', 'actions/applications.ts', 'actions/meetings.ts', 'lib/public-club-seo.ts', 'lib/club-share-profile.ts', 'app/page.tsx', 'components/student-workspace-page.tsx'])
    assert.match(read(file), /resolveViewerSchool\(\)/, file)
  assert.match(read('app/sitemap.ts'), /resolveHostSchool\(\)/)
  // Cached public reads take the school as an argument, so it is part of the cache key.
  assert.match(read('actions/club-directory.ts'), /unstable_cache\(\s*async \(schoolId: string\)/)
  assert.match(read('lib/public-club-seo.ts'), /unstable_cache\(async \(schoolId: string\)/)
  // Student calendars list other clubs' public meetings from the student's school only.
  assert.match(read('actions/applications.ts'), /schoolPublicMeetingVisibility\(school\.id\)/)
  assert.match(read('actions/meetings.ts'), /schoolPublicMeetingVisibility\(school\.id\)/)
})
