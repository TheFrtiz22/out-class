const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path')
const ts = require('typescript')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.replace('@/', '') + '.ts', mocks) : require(n), mod, mod.exports)
  return mod.exports
}
const { calendarFeedFile } = load('lib/ical.ts')
const { newCalendarFeedToken, calendarFeedTokenHash, isCalendarFeedToken, calendarFeedUrls } = load('lib/calendar-feed.ts')
const at = s => new Date(s)

test('feed: one VCALENDAR, a VEVENT per valid event, escaped text, invalid dates skipped', () => {
  const ics = calendarFeedFile('OutClass', [
    { id: 'meeting-1', title: 'GBM, week 3; bring laptops', description: 'Line one\nline two', location: 'Rice 130', start: at('2026-11-10T23:00:00Z'), end: at('2026-11-11T00:00:00Z') },
    { id: 'bad', title: 'x', description: '', location: '', start: at('nope'), end: at('2026-11-11T00:00:00Z') },
    { id: 'booking-2', title: 'TAMID interview', description: '', location: 'Robertson 201', start: at('2026-11-12T15:00:00Z'), end: at('2026-11-12T15:30:00Z') },
  ], at('2026-11-09T12:00:00Z'))
  assert.equal((ics.match(/BEGIN:VCALENDAR/g) || []).length, 1)
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2)
  assert.ok(ics.includes('SUMMARY:GBM\\, week 3\\; bring laptops\r\n'))
  assert.match(ics, /DESCRIPTION:Line one\\nline two\r\n/)
  assert.match(ics, /DTSTART:20261112T150000Z\r\n/)
  assert.match(ics, /UID:booking-2@outclass\r\n/)
  assert.match(ics, /X-WR-CALNAME:OutClass\r\n/)
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'))
  assert.ok(ics.split('\r\n').every(line => Buffer.byteLength(line) <= 75))
})

test('tokens: 256-bit URL-safe secret, only the hash is stored, webcal and Google links', () => {
  const token = newCalendarFeedToken()
  assert.ok(isCalendarFeedToken(token)); assert.notEqual(token, newCalendarFeedToken())
  assert.match(calendarFeedTokenHash(token), /^[0-9a-f]{64}$/)
  assert.equal(isCalendarFeedToken('short'), false); assert.equal(isCalendarFeedToken('a'.repeat(42) + '/'), false)
  const links = calendarFeedUrls('https://www.out-class.net/', token)
  assert.equal(links.https, `https://www.out-class.net/api/calendar-feed/${token}`)
  assert.equal(links.webcal, `webcal://www.out-class.net/api/calendar-feed/${token}`)
  assert.equal(links.google, `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(links.webcal)}`)
})

function route({ feed, events = [] } = {}) {
  const state = { lookups: [], updates: [], transactions: 0 }
  const calendarFeedToken = { findUnique: async q => { state.lookups.push(q.where); return feed ?? null }, updateMany: async q => { state.updates.push(q); return { count: 1 } } }
  const mod = load('app/api/calendar-feed/[token]/route.ts', {
    '@/utils/prisma': { prisma: { calendarFeedToken, $transaction: async fn => { state.transactions++; return fn({}) } } },
    '@/utils/calendar-feed': { calendarFeedEvents: async (_tx, userId) => { state.userId = userId; return events } },
  })
  state.get = token => mod.GET(new Request('https://out-class.net/x'), { params: Promise.resolve({ token }) })
  return state
}

test('route: valid token returns the owner\'s calendar; lookups use the hash, never the token', async () => {
  const token = newCalendarFeedToken()
  const s = route({ feed: { userId: 'u1', lastUsedAt: null, user: { disabledAt: null } }, events: [{ id: 'x', title: 'Meeting', description: '', location: '', start: at('2026-11-10T23:00:00Z'), end: at('2026-11-11T00:00:00Z') }] })
  const res = await s.get(token + '.ics')
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('content-type'), 'text/calendar; charset=utf-8')
  assert.equal(res.headers.get('cache-control'), 'private, no-cache')
  assert.match(res.headers.get('etag'), /^"[\w-]{27}"$/)
  assert.match(await res.text(), /SUMMARY:Meeting/)
  assert.deepEqual(s.lookups, [{ tokenHash: calendarFeedTokenHash(token) }])
  assert.equal(s.userId, 'u1')
  assert.equal(s.updates.length, 1, 'first use recorded')
  const recent = route({ feed: { userId: 'u1', lastUsedAt: new Date(), user: { disabledAt: null } } })
  await recent.get(token); assert.equal(recent.updates.length, 0, 'not rewritten on every poll')
  // An unknown token costs one indexed lookup and never opens a transaction.
  const unknown = route({}); assert.equal((await unknown.get(newCalendarFeedToken())).status, 404); assert.equal(unknown.transactions, 0)
})

test('route: unknown, malformed, or disabled-account tokens look the same (404) and leak nothing', async () => {
  for (const [opts, token] of [[{}, newCalendarFeedToken()], [{}, 'not-a-token'], [{ feed: { userId: 'u1', lastUsedAt: null, user: { disabledAt: new Date() } } }, newCalendarFeedToken()]]) {
    const s = route(opts)
    const res = await s.get(token)
    assert.equal(res.status, 404)
    assert.equal(s.userId, undefined)
  }
})

test('feed contents: own bookings, member-club meetings, RSVPs and own panels; deduplicated', async () => {
  const { calendarFeedEvents } = load('utils/calendar-feed.ts', { '@/utils/official-panel-schedule': { ownPanelAssignments: async (_tx, userId) => { assert.equal(userId, 'u1'); return [{ id: 's1', clubName: 'MII', roundName: 'Round 2', roomName: 'Room A', location: 'Rouss 403', startTime: '2026-11-12T18:00:00.000Z', endTime: '2026-11-12T18:30:00.000Z' }] } } })
  const queries = {}
  const m = { id: 'm1', title: 'GBM', date: at('2026-11-10T23:00:00Z'), endDate: null, allDay: false, location: 'Rice', description: null, club: { name: 'TAMID' } }
  const tx = {
    clubMember: { findMany: async q => { queries.members = q.where; return [{ clubId: 'c1' }] } },
    interviewBooking: { findMany: async q => { queries.bookings = q.where; return [{ id: 'b1', slot: { startTime: at('2026-11-12T15:00:00Z'), endTime: at('2026-11-12T15:30:00Z'), location: 'Robertson' }, application: { club: { name: 'GMG' } } }] } },
    meeting: { findMany: async q => { queries.meetings = q.where; return [m] } },
    eventRsvp: { findMany: async q => { queries.rsvps = q.where; return [{ event: m }] } },
  }
  const events = await calendarFeedEvents(tx, 'u1', at('2026-11-09T12:00:00Z'))
  assert.deepEqual(events.map(e => e.id), ['meeting-m1', 'booking-b1', 'panel-s1'])
  assert.equal(events[0].title, 'GBM · TAMID')
  assert.equal(+events[0].end - +events[0].start, 3600000, 'meetings without an end default to an hour')
  assert.deepEqual(queries.members, { userId: 'u1', status: 'ACTIVE', club: { suspendedAt: null } })
  assert.equal(queries.bookings.application.studentId, 'u1')
  assert.deepEqual(queries.meetings.clubId, { in: ['c1'] })
  // Bounded: nothing more than 180 days ahead, and capped row counts.
  const horizon = at('2026-11-09T12:00:00Z').getTime() + 180 * 24 * 3600000
  assert.equal(+queries.meetings.date.lte, horizon)
  assert.equal(+queries.bookings.slot.startTime.lte, horizon)
  assert.equal(queries.rsvps.userId, 'u1')
})

test('migration: hash-only storage, one link per user, runtime-only access', { timeout: 240000 }, async () => {
  const { PGlite } = require('@electric-sql/pglite')
  const db = new PGlite()
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app;')
    for (const n of fs.readdirSync('prisma/migrations').filter(n => fs.existsSync(path.join('prisma/migrations', n, 'migration.sql'))).sort()) await db.exec(fs.readFileSync(path.join('prisma/migrations', n, 'migration.sql'), 'utf8'))
    await db.exec(`INSERT INTO "User"(id,email) VALUES('u1','u1@virginia.edu')`)
    const hash = calendarFeedTokenHash(newCalendarFeedToken())
    await db.query(`INSERT INTO "CalendarFeedToken"("userId","tokenHash") VALUES('u1',$1)`, [hash])
    await assert.rejects(db.query(`INSERT INTO "CalendarFeedToken"("userId","tokenHash") VALUES('u1',$1)`, [calendarFeedTokenHash('x')]), /duplicate|unique/i)
    await assert.rejects(db.query(`UPDATE "CalendarFeedToken" SET "tokenHash"='plain-token'`), /tokenHash_format/)
    for (const role of ['anon', 'authenticated']) for (const p of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) assert.equal((await db.query(`SELECT has_table_privilege($1,'"CalendarFeedToken"',$2) ok`, [role, p])).rows[0].ok, false)
    assert.equal((await db.query(`SELECT relrowsecurity FROM pg_class WHERE relname='CalendarFeedToken'`)).rows[0].relrowsecurity, true)
    // The runtime role must be able to read, create, rotate and delete links, or the feed route turns every request into a 503.
    for (const p of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) assert.equal((await db.query(`SELECT has_table_privilege('outclass_production_app','"CalendarFeedToken"',$1) ok`, [p])).rows[0].ok, true, `runtime ${p}`)
    assert.deepEqual((await db.query(`SELECT cmd FROM pg_policies WHERE tablename='CalendarFeedToken' AND 'outclass_production_app'=ANY(roles) ORDER BY cmd`)).rows.map(r => r.cmd), ['DELETE', 'INSERT', 'SELECT', 'UPDATE'])
    await db.exec(`DELETE FROM "User" WHERE id='u1'`)
    assert.equal((await db.query(`SELECT count(*)::int n FROM "CalendarFeedToken"`)).rows[0].n, 0)
  } finally { await db.close() }
})

// Minimal evaluator for the Prisma where-shapes the feed uses, so the RSVP
// filter is checked against concrete events rather than by its literal shape.
function matches(row, where) {
  if (row === null || row === undefined) return false
  return Object.entries(where).every(([k, v]) => {
    if (k === 'AND') return v.every(w => matches(row, w))
    if (k === 'OR') return v.some(w => matches(row, w))
    const x = row[k]
    if (v === null) return x === null || x === undefined
    if (v instanceof Date || typeof v !== 'object') return x === v
    if ('gte' in v) return x !== null && x !== undefined && +x >= +v.gte
    if ('lte' in v) return x !== null && x !== undefined && +x <= +v.lte
    if ('is' in v) return v.is === null ? x === null || x === undefined : matches(x, v.is)
    if ('some' in v) return (x || []).some(r => matches(r, v.some))
    if ('in' in v) return v.in.includes(x)
    return matches(x, v)
  })
}

test('feed contents: RSVP\'d events follow event visibility (public+published, or active member)', async () => {
  const { calendarFeedEvents } = load('utils/calendar-feed.ts', { '@/utils/official-panel-schedule': { ownPanelAssignments: async () => [] } })
  const club = members => ({ name: 'TAMID', suspendedAt: null, members })
  const base = { title: 'Mixer', date: at('2026-11-12T23:00:00Z'), endDate: null, allDay: false, location: 'Rice', description: 'Bring friends', audience: 'RECRUITMENT', isPublic: true, publication: { status: 'PUBLISHED' } }
  const rows = [
    { ...base, id: 'published' },
    { ...base, id: 'withdrawn', publication: { status: 'CANCELLED' } },
    { ...base, id: 'members-only', audience: 'MEMBERS' },
    { ...base, id: 'private', isPublic: false },
    { ...base, id: 'suspended', clubSuspended: true },
  ]
  for (const [memberStatus, expected] of [[null, ['meeting-published']], ['INACTIVE', ['meeting-published']], ['ACTIVE', ['meeting-members-only', 'meeting-private', 'meeting-published', 'meeting-withdrawn']]]) {
    const membership = memberStatus ? [{ userId: 'u1', status: memberStatus }] : []
    const events = rows.map(r => ({ ...r, club: { ...club(membership), suspendedAt: r.clubSuspended ? new Date() : null } }))
    const tx = {
      clubMember: { findMany: async () => [] },
      interviewBooking: { findMany: async () => [] },
      meeting: { findMany: async () => [] },
      eventRsvp: { findMany: async q => { assert.equal(q.where.userId, 'u1'); return events.filter(e => matches(e, q.where.event)).map(event => ({ event })) } },
    }
    const ids = (await calendarFeedEvents(tx, 'u1', at('2026-11-09T12:00:00Z'))).map(e => e.id).sort()
    assert.deepEqual(ids, expected, `membership ${memberStatus}`)
  }
})

function actions({ impersonating = false } = {}) {
  const writes = []
  const tx = {
    calendarFeedToken: { upsert: async q => { writes.push(['upsert', q]) }, deleteMany: async q => { writes.push(['deleteMany', q]); return { count: 1 } } },
    auditLog: { create: async q => { writes.push(['audit', q]) } },
  }
  const mod = load('actions/calendar-feed.ts', {
    'next/headers': { headers: async () => new Headers({ host: 'www.out-class.net' }) },
    '@/utils/prisma': { prisma: { $transaction: async fn => fn(tx), calendarFeedToken: { findUnique: async () => ({ createdAt: new Date(), lastUsedAt: null }) } } },
    '@/utils/auth': { requireAuth: async () => ({ user: { id: 'student' }, impersonation: impersonating ? { actorId: 'admin', targetUserId: 'student' } : undefined }) },
    '@/lib/seo': { SITE_URL: 'https://www.out-class.net' },
  })
  return { mod, writes }
}

test('actions: support view-as cannot create or disable the student\'s link and writes nothing', async () => {
  const s = actions({ impersonating: true })
  await assert.rejects(s.mod.createCalendarFeedLink(), /Exit support impersonation/)
  await assert.rejects(s.mod.disableCalendarFeed(), /Exit support impersonation/)
  assert.deepEqual(s.writes, [])
  assert.equal((await s.mod.getCalendarFeedStatus()).active, true, 'read-only status stays visible to support')
  const own = actions()
  assert.match((await own.mod.createCalendarFeedLink()).https, /^https:\/\/www\.out-class\.net\/api\/calendar-feed\//)
  await own.mod.disableCalendarFeed()
  assert.deepEqual(own.writes.map(w => w[0]), ['upsert', 'audit', 'deleteMany', 'audit'])
})
