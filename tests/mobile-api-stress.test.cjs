// Pre-launch stress audit of the native app's API (app/api/mobile/v1, utils/mobile-api.ts,
// lib/mobile-api/*). Tests named "Pn" pin a flaw the stress test found and fixed (each failed before
// its fix). Every other test pins a property that was verified and should stay true. Nothing here touches a database, Auth or the network: real
// TypeScript modules are transpiled in memory and their dependencies are stubbed.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const root = path.join(__dirname, '..')

/** Loads TS modules from the repo with `mocks` (by import name); unmocked '@/…' modules load for real,
 * unless `stub` is set, in which case they become a Proxy of no-op functions. */
function loader(mocks = {}, { stub = false } = {}) {
  const cache = new Map()
  const resolve = name => {
    for (const ext of ['.ts', '.tsx', '/index.ts']) { const file = path.join(root, name.slice(2) + ext); if (fs.existsSync(file)) return file }
    throw new Error(`cannot resolve ${name}`)
  }
  const stubModule = name => new Proxy({}, { get: (_, key) => key === '__esModule' ? true : key === 'then' ? undefined : (...args) => { throw new Error(`unexpected call ${name}.${String(key)}(${args.length})`) } })
  const load = file => {
    if (cache.has(file)) return cache.get(file).exports
    const mod = { exports: {} }; cache.set(file, mod)
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText
    const req = name => {
      if (Object.hasOwn(mocks, name)) return mocks[name]
      if (name.startsWith('@/')) return stub ? stubModule(name) : load(resolve(name))
      if (name.startsWith('.')) return load(require.resolve(path.resolve(path.dirname(file), name), { paths: [root] }).replace(/\.js$/, '.ts'))
      return require(require.resolve(name, { paths: [root] }))
    }
    new Function('require', 'module', 'exports', '__filename', '__dirname', code)(req, mod, mod.exports, file, path.dirname(file))
    return mod.exports
  }
  return name => load(resolve(name))
}

// ---- A fake Next request environment for utils/mobile-api.ts --------------------------------------
function jar(cookies = {}) {
  return { get: name => (name in cookies ? { name, value: cookies[name] } : undefined), has: name => name in cookies, getAll: () => Object.entries(cookies).map(([name, value]) => ({ name, value })) }
}
const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLWEifQ.c2lnbmF0dXJl'
const USER_A = '11111111-1111-4111-8111-111111111111'
const CLUB = '22222222-2222-4222-8222-222222222222'

/** utils/mobile-api.ts with Auth, cookies and maintenance stubbed. `identity(token)` returns the user or null. */
function boundary({ cookies = {}, identity = () => ({ id: USER_A }), maintenance = false, extra = {} } = {}) {
  const calls = { session: 0, writable: 0 }
  const { runMobileRequest, mobileRequest } = require('node:async_hooks') && loader()('@/utils/mobile-request')
  const mocks = {
    'next/headers': { cookies: async () => jar(cookies), headers: async () => new Headers() },
    '@/utils/mobile-request': { runMobileRequest, mobileRequest },
    '@/utils/auth': {
      AUTH_UNAVAILABLE: 'AUTH_UNAVAILABLE', AUTH_UNAVAILABLE_MESSAGE: 'auth unavailable',
      getSessionState: async () => { calls.session++; const user = identity(mobileRequest()?.token); return { secondFactorPending: false, identity: { data: { user }, error: null } } },
      requireAuth: async () => { const user = identity(mobileRequest()?.token); if (!user) { const e = new Error('NEXT_REDIRECT'); e.digest = 'NEXT_REDIRECT;replace;/;307;'; throw e } return { user, supabaseUser: user, impersonation: null } },
    },
    '@/utils/site-settings': { assertSiteWritable: async () => { calls.writable++; if (maintenance) { const e = new Error('OutClass is in maintenance mode.'); e.name = 'MaintenanceModeError'; throw e } } },
    '@/utils/verified-email-policy': { UniversityVerificationError: class extends Error {} },
    ...extra,
  }
  const load = loader(mocks)
  return { load, calls, api: load('@/utils/mobile-api'), mocks }
}
function get(name, input, { token = TOKEN, ip = '203.0.113.7', headers = {} } = {}) {
  const url = new URL(`https://www.out-class.net/api/mobile/v1/${name}`)
  if (input !== undefined) url.searchParams.set('input', typeof input === 'string' ? input : JSON.stringify(input))
  return new Request(url, { method: 'GET', headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'x-forwarded-for': ip, ...headers } })
}
function post(name, body, { token = TOKEN, ip = '203.0.113.7', type = 'application/json' } = {}) {
  return new Request(`https://www.out-class.net/api/mobile/v1/${name}`, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'x-forwarded-for': ip, 'content-type': type } })
}
const op = (method, input, run, extra = {}) => ({ method, input, run, ...extra })
const json = async response => JSON.parse(await response.text())

// ---- 1. Authentication, identity and refusals at the boundary (verified, passing) ------------------

test('unknown and prototype-named operations are 404 before any Auth call', async () => {
  const { api, calls } = boundary()
  const ops = { me: op('GET', require('zod').z.undefined(), async () => ({})) }
  for (const name of ['nope', '__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
    const response = await api.handleMobileRequest(get(name), name, ops)
    assert.equal(response.status, 404, name)
  }
  assert.equal(calls.session, 0)
})

test('a private operation without a bearer token is 401 and never reaches the action', async () => {
  const { api, calls } = boundary()
  let ran = false
  const ops = { me: op('GET', require('zod').z.any(), async () => { ran = true }) }
  for (const token of ['', 'not-a-jwt', 'a.b']) {
    const response = await api.handleMobileRequest(get('me', undefined, { token }), 'me', ops)
    assert.equal(response.status, 401)
  }
  assert.equal(ran, false); assert.equal(calls.session, 0)
})

test('the caller is whoever the token names; a strict schema refuses a userId smuggled in the input', async () => {
  const { load } = boundary()
  const { mobileOperations } = load('@/lib/mobile-api/operations')
  // Every operation that is not passthrough is a strict object (or none): unknown keys such as userId are refused.
  let checked = 0
  for (const [name, entry] of Object.entries(mobileOperations)) {
    const shape = entry.input._def.typeName === 'ZodOptional' ? entry.input._def.innerType : entry.input
    if (shape._def.typeName !== 'ZodObject') continue // none (undefined/{}), passthrough (the action's own strict schema) or FormData
    checked++
    assert.equal(shape._def.unknownKeys, 'strict', `${name} must refuse unknown keys such as userId`)
    assert.ok(!Object.keys(shape.shape).some(key => /^(userId|studentId|accountId|actorId)$/.test(key)), `${name} takes an identity from input`)
  }
  assert.ok(checked >= 30, `checked ${checked}`)
})

test('a request carrying a browser session, Demo or support cookie is refused before Auth', async () => {
  for (const cookies of [{ 'sb-abc-auth-token': 'x' }, { 'sb-abc-auth-token.0': 'x' }, { 'outclass-demo-session': '1' }, { 'outclass-platform-view': 'x' }]) {
    const { api, calls } = boundary({ cookies })
    const response = await api.handleMobileRequest(get('me'), 'me', { me: op('GET', require('zod').z.any(), async () => ({ secret: true })) })
    assert.equal(response.status, 403); assert.equal((await json(response)).error.code, 'UNSUPPORTED_SESSION'); assert.equal(calls.session, 0)
  }
})

test('wrong method is 405 with Allow; GET never runs a POST operation', async () => {
  const { api } = boundary()
  let ran = false
  const ops = { 'inbox.read': op('POST', require('zod').z.any(), async () => { ran = true }) }
  const response = await api.handleMobileRequest(get('inbox.read', { ids: [], read: true }), 'inbox.read', ops)
  assert.equal(response.status, 405); assert.equal(response.headers.get('allow'), 'POST'); assert.equal(ran, false)
})

test('every answer, success or refusal, is private, uncacheable and varies on Authorization', async () => {
  const { api } = boundary()
  const z = require('zod')
  const ops = { me: op('GET', z.any(), async () => ({ email: 'a@virginia.edu' })), bad: op('GET', z.any(), async () => { throw new Error('nope') }) }
  for (const [name, request] of [['me', get('me')], ['bad', get('bad')], ['me', get('me', undefined, { token: '' })], ['missing', get('missing')]]) {
    const response = await api.handleMobileRequest(request, name, ops)
    assert.equal(response.headers.get('cache-control'), 'private, no-store', name)
    assert.equal(response.headers.get('vary'), 'Authorization', name)
  }
})

test('maintenance mode: every authenticated POST is checked and refused with 503; GETs are not checked', async () => {
  const z = require('zod')
  const { api, calls } = boundary({ maintenance: true })
  let wrote = false
  const ops = { w: op('POST', z.any(), async () => { wrote = true }), r: op('GET', z.any(), async () => ({ ok: 1 })) }
  const refused = await api.handleMobileRequest(post('w', {}), 'w', ops)
  assert.equal(refused.status, 503); assert.equal((await json(refused)).error.code, 'MAINTENANCE'); assert.equal(wrote, false)
  assert.equal((await api.handleMobileRequest(get('r'), 'r', ops)).status, 200)
  assert.equal(calls.writable, 1)
})

test('refusals never leak internals: Prisma, runtime and legacy errors come back as fixed text', async () => {
  const z = require('zod')
  const { api } = boundary()
  const secret = 'SELECT "email" FROM "User" WHERE id = \'someone-else\' — at /var/task/actions/x.ts:12'
  const prisma = Object.assign(new Error(secret), { name: 'PrismaClientKnownRequestError', code: 'P2002' })
  const cases = [[prisma, 500], [new TypeError(secret), 500], [new Error(secret), 403], [Object.assign(new Error(secret), { code: 'NOT_FOUND' }), 404], [new z.ZodError([{ code: 'custom', path: ['x'], message: secret }]), 400]]
  for (const [error, status] of cases) {
    const response = await api.handleMobileRequest(get('x'), 'x', { x: op('GET', z.any(), async () => { throw error }) })
    const text = await response.text()
    assert.equal(response.status, status, error.name)
    assert.ok(!text.includes('SELECT') && !text.includes('/var/task') && !text.includes('someone-else'), text)
  }
})

// ---- 2. Input validation (verified, passing) -------------------------------------------------------

test('oversized bodies, arrays, deep nesting and junk JSON are 400 before the action runs', async () => {
  const z = require('zod')
  const { load } = boundary()
  const { mobileOperations } = load('@/lib/mobile-api/operations')
  const { api } = boundary()
  let ran = 0
  const ops = { echo: op('POST', z.unknown(), async () => { ran++ ; return {} }), 'inbox.read': { ...mobileOperations['inbox.read'], run: async () => { ran++ } } }
  const cases = [
    ['echo', 'x'.repeat(512_001)],
    ['echo', JSON.stringify({ a: Array(501).fill(0) })],
    ['echo', JSON.stringify({ a: Array.from({ length: 5 }, () => Array(450).fill(0)) })],
    ['echo', '['.repeat(100) + ']'.repeat(100)],
    ['echo', '{"a":'],
    ['inbox.read', JSON.stringify({ ids: Array(101).fill(USER_A), read: true })],
    ['inbox.read', JSON.stringify({ ids: ['../../etc/passwd'], read: true })],
    ['inbox.read', JSON.stringify({ ids: [USER_A], read: 'yes' })],
  ]
  for (const [name, body] of cases) {
    const response = await api.handleMobileRequest(post(name, body), name, ops)
    assert.equal(response.status, 400, `${name} ${body.slice(0, 40)}`)
  }
  assert.equal(ran, 0)
})

test('prototype-pollution keys are refused by strict schemas and never pollute Object.prototype', async () => {
  const { load, api } = boundary()
  const { mobileOperations } = load('@/lib/mobile-api/operations')
  let ran = false
  const ops = { 'inbox.read': { ...mobileOperations['inbox.read'], run: async () => { ran = true } } }
  for (const body of ['{"__proto__":{"polluted":1},"ids":["' + USER_A + '"],"read":true}', '{"constructor":{"prototype":{"polluted":1}},"ids":["' + USER_A + '"],"read":true}']) {
    const response = await api.handleMobileRequest(post('inbox.read', body), 'inbox.read', ops)
    assert.equal(response.status, 400)
  }
  assert.equal(ran, false); assert.equal({}.polluted, undefined)
})

test('paging inputs: negative or huge pages, cursors and odd types are refused by the schemas', async () => {
  const { eventFiltersSchema } = loader()('@/lib/campus-event-schemas')
  for (const page of [-1, 10_001, 1.5, '1', Number.MAX_SAFE_INTEGER]) assert.equal(eventFiltersSchema.safeParse({ page }).success, false, String(page))
  const { mobileOperations } = boundary().load('@/lib/mobile-api/operations')
  for (const input of [{ cursor: 'x' }, { cursor: -1 }, { cursor: USER_A, take: 10_000 }]) assert.equal(mobileOperations.inbox.input.safeParse(input).success, false)
  assert.equal(mobileOperations['explore.search'].input.safeParse({ query: 'x'.repeat(121) }).success, false)
})

// ---- 3. Push tokens (verified, passing) ------------------------------------------------------------

function pushActions(userId) {
  const rows = new Map() // endpoint -> row
  const tx = {
    $queryRaw: async () => [],
    webPushSubscription: {
      deleteMany: async ({ where }) => { for (const [k, r] of rows) if ((!where.endpoint || k === where.endpoint) && (!where.userId || (where.userId.not ? r.userId !== where.userId.not : r.userId === where.userId)) && (!where.kind || r.kind === where.kind) && (!where.id || where.id.in.includes(r.id))) rows.delete(k) },
      upsert: async ({ where, create, update }) => { const row = rows.get(where.endpoint); rows.set(where.endpoint, row ? { ...row, ...update } : { id: `id-${rows.size}`, createdAt: new Date(), ...create }) },
      findMany: async ({ where }) => [...rows.values()].filter(r => r.userId === where.userId),
      findUnique: async ({ where }) => rows.get(where.endpoint) ?? null,
    },
  }
  let current = userId
  const load = loader({
    '@/utils/prisma': { prisma: { ...tx, $transaction: fn => fn(tx) } },
    '@/utils/auth': { requireAuth: async () => ({ user: { id: current }, impersonation: null }) },
    'next/headers': { headers: async () => new Headers() },
  })
  process.env.NATIVE_PUSH_ENABLED = '1'
  return { actions: load('@/actions/push-subscriptions'), rows, as: id => { current = id } }
}

test('push: the device belongs to the last account that registered it; unregister touches only your own row', async () => {
  const { actions, rows, as } = pushActions('user-a')
  const device = { token: 'ExponentPushToken[abcdefghijklmnop]', platform: 'IOS' }
  await actions.saveNativePushDevice(device)
  as('user-b') // a shared phone: B signs in on A's device
  await actions.saveNativePushDevice(device)
  assert.deepEqual([...rows.values()].map(r => r.userId), ['user-b'], 'A no longer gets pushes on this phone')
  as('user-a') // A (or anyone) cannot remove B's registration by naming the token
  await actions.removeNativePushDevice(device)
  assert.deepEqual([...rows.values()].map(r => r.userId), ['user-b'])
  assert.equal((await actions.getNativePushSettings(device)).subscribed, false, 'settings never reveal another account owns the token')
  await assert.rejects(actions.removeNativePushDevice({ token: 'junk', platform: 'IOS' }))
  delete process.env.NATIVE_PUSH_ENABLED
})

// ---- 4. Fixed in the stress test (each failed before its fix) ----------------------------------------

test('P1: the media route refuses past the per-address limit before any token reaches Auth', async () => {
  // The operation route calls limitRequest(RATE_LIMITS.mobileApiAddress) before any token is verified
  // (app/api/mobile/v1/[operation]/route.ts:15). The media route (app/api/mobile/v1/media/[kind]/route.ts)
  // calls handleMobileMedia directly, so each request with a well-formed junk JWT costs a remote Supabase
  // getUser call (utils/auth.ts verifiedSessionState) with no ceiling per address.
  const { load, calls } = boundary({ identity: () => null, extra: { '@/app/api/profile-photos/route': { GET: async () => new Response('photo') } } })
  const operationRoute = load('@/app/api/mobile/v1/[operation]/route')
  const mediaRoute = load('@/app/api/mobile/v1/media/[kind]/route')
  const limit = load('@/lib/rate-limit-core').RATE_LIMITS.mobileApiAddress.limit
  const flood = async (send) => { let limited = 0; const before = calls.session; for (let i = 0; i <= limit + 50; i++) if ((await send()).status === 429) limited++; return { limited, verified: calls.session - before } }
  const ops = await flood(() => operationRoute.GET(get('me', undefined, { ip: '198.51.100.1' }), { params: Promise.resolve({ operation: 'me' }) }))
  assert.ok(ops.limited > 0 && ops.verified <= limit, 'operation route: bad tokens past the address limit are refused before Auth')
  const media = await flood(() => mediaRoute.GET(new Request('https://www.out-class.net/api/mobile/v1/media/profile-photos?path=x', { headers: { authorization: `Bearer ${TOKEN}`, 'x-forwarded-for': '198.51.100.2' } }), { params: Promise.resolve({ kind: 'profile-photos' }) }))
  assert.ok(media.verified <= limit, `media route sent ${media.verified} forged tokens from one address to Auth verification (limit ${limit})`)
})

test('P2: home.view (read by the header bell on every screen) counts unread rows instead of loading an Inbox page', async () => {
  let inboxPages = 0
  const dashboard = { applications: [], attendances: [], meetings: [], panelAssignments: [] }
  const load = loader({
    '@/actions/applications': { getStudentDashboardData: async () => dashboard, getStudentApplications: async () => [] },
    '@/actions/communications': { getDurableNotifications: async () => { inboxPages++; return { items: Array(50).fill({}), nextCursor: 'x', unread: 3 } }, getUnreadNotificationCount: async () => 3 },
    '@/actions/tasks': { getTaskNotifications: async () => [] },
    '@/utils/current-user': { getCurrentUser: async () => ({}) },
  })
  const home = await load('@/lib/mobile-api/views').getMobileHome()
  assert.equal(home.inboxUnread, 3)
  // getDurableNotifications (actions/communications.ts:52-86) reads 51 rows, a separate count, and re-derives up to
  // 50 rows inside one interactive transaction with 1-4 queries per row; home.view keeps only `.unread`.
  assert.equal(inboxPages, 0, 'home.view should count unread rows (one indexed count), not hydrate an Inbox page')
})

/** An action module with every '@/…' dependency stubbed except the ones named, and a recording prisma. */
function recordingPrisma(rows = () => []) {
  const queries = []
  const model = name => new Proxy({}, { get: (_, method) => async args => { queries.push({ model: name, method, args }); return method === 'count' ? 0 : method.startsWith('find') && !method.startsWith('findFirst') && !method.startsWith('findUnique') ? rows(name, args) : null } })
  const prisma = new Proxy({}, { get: (_, key) => key === '$transaction' ? async fn => typeof fn === 'function' ? fn(prisma) : Promise.all(fn) : key === '$queryRaw' ? async () => [] : model(key) })
  return { prisma, queries }
}

test('P6: an alumni account saving a club gets ALUMNI_ACCOUNT with the read-only message', async () => {
  const z = require('zod')
  const { api, load } = boundary({
    extra: {
      '@/utils/prisma': { prisma: { studentProfile: { findUnique: async () => ({ graduatedAt: new Date('2020-01-01') }) } } },
      '@/utils/school-scope': { resolveViewerSchool: async () => ({ id: 'school-uva' }) },
    },
  })
  const { mobileOperations } = load('@/lib/mobile-api/operations')
  const response = await api.handleMobileRequest(post('clubs.save', { clubId: CLUB, saved: true }), 'clubs.save', mobileOperations)
  const body = await json(response)
  // actions/club-directory.ts setCorkboardClub (and actions/short-links.ts createShortLink) throw `new Error(alumni)`
  // where every other action uses assertNotAlumni (ActionError ALUMNI_ACCOUNT); utils/mobile-api.ts failure() turns
  // a plain Error into REFUSED / "This is not available." (docs/agent-ops/authz-matrix.md MOBILE-1 promises ALUMNI_ACCOUNT).
  assert.equal(body.error.code, 'ALUMNI_ACCOUNT', JSON.stringify(body))
})

test('P7: applications.start opens nothing in another school’s club by id', async () => {
  const created = []
  const tx = {
    $queryRaw: async () => [],
    application: { create: async ({ data }) => { created.push(data); return { id: 'app-1' } }, findFirst: async () => null },
    club: { findUnique: async () => ({ applicationOpen: true, applicationDeadline: null, schoolId: 'school-other', suspendedAt: null }) },
    pipelineRound: { findFirst: async () => ({ id: 'round-1' }) },
    studentProfile: { findUnique: async () => null },
  }
  const load = loader({
    '@/utils/prisma': { prisma: { $transaction: fn => fn(tx) } },
    '@/utils/auth': { requireAuth: async () => ({ user: { id: USER_A } }) },
    '@/utils/school-scope': { resolveViewerSchool: async () => ({ id: 'school-uva' }) },
    '@/lib/recruitment-cycle': { currentApplication: async () => null, reapplicationUnavailable: async () => null },
    '@/utils/graduation': { alumniRefusal: async () => null },
    '@/lib/club-suspension': { assertClubOperational: async () => {} },
    '@/lib/club-settings': { applicationAvailability: () => true },
    '@/lib/campus-events': { publicMeetingVisibility: {} },
    'next/cache': { unstable_cache: fn => fn },
  }, { stub: true })
  const result = await load('@/actions/club-directory').startClubApplication(CLUB)
  // getPublicClub, setCorkboardClub, RSVP and save-event refuse another school's id; start does too now.
  assert.equal(created.length, 0, `created ${JSON.stringify(result)} for a club whose school is not the viewer's`)
})

test('P4: the app\'s `meetings` operation always names one club (the all-clubs list has no date bound)', async () => {
  const { load } = boundary({ extra: { '@/actions/meetings': { listMeetings: async clubId => { assert.ok(clubId); return [] } } } })
  const { mobileOperations } = load('@/lib/mobile-api/operations')
  const meetings = mobileOperations.meetings
  assert.equal(meetings.input.safeParse(undefined).success, false)
  assert.equal(meetings.input.safeParse({}).success, false)
  assert.equal(meetings.input.safeParse({ clubId: CLUB }).success, true)
})

test('P10: home.dashboard (unused by the app, returned raw loader rows) is no longer an operation', async () => {
  const { load } = boundary()
  const { mobileOperations } = load('@/lib/mobile-api/operations')
  assert.equal(Object.hasOwn(mobileOperations, 'home.dashboard'), false)
  assert.equal(Object.hasOwn(mobileOperations, 'home.view'), true)
})

test('P11: app search is limited per account (the bearer session), not per shared campus address', () => {
  const source = fs.readFileSync(path.join(root, 'actions/typesense-search.ts'), 'utf8')
  assert.match(source, /if \(mobileRequest\(\)\) return \(await \(await import\("@\/utils\/auth"\)\)\.getSessionState\(\)\)\.identity\.data\.user\?\.id \?\? null/)
})

test('P6: a share link for an alumni account is refused with ALUMNI_ACCOUNT', () => {
  const source = fs.readFileSync(path.join(root, 'actions/short-links.ts'), 'utf8')
  assert.match(source, /await assertNotAlumni\(prisma, user\.id, "share"\)/)
  assert.doesNotMatch(source, /throw new Error\(alumni\)/)
})
