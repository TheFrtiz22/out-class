const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const net = require("node:net")
const ts = require("typescript")
const root = path.resolve(__dirname, "..")
const read = file => fs.readFileSync(path.join(root, file), "utf8")
function load(file, mocks = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function("require", "module", "exports", code)(name => name in mocks ? mocks[name] : name.startsWith("@/lib/") ? load(name.slice(2) + ".ts", mocks) : require(name), mod, mod.exports)
  return mod.exports
}
const core = load("lib/rate-limit-core.ts")
const policy = { name: "test", limit: 3, windowMs: 10_000 }

test("fixed window: allows the limit, blocks the next call with a Retry-After, then resets", () => {
  let now = 1_000_000
  const logs = []
  const limiter = core.createRateLimiter({ now: () => now, log: m => logs.push(m) })
  assert.deepEqual([1, 2, 3].map(() => limiter.check(policy, "ip:1.2.3.4").ok), [true, true, true])
  now += 4_000
  assert.deepEqual(limiter.check(policy, "ip:1.2.3.4"), { ok: false, retryAfterSeconds: 6 })
  assert.equal(limiter.check(policy, "ip:1.2.3.4").ok, false)
  assert.equal(logs.length, 1, "logged once per key and window")
  assert.doesNotMatch(logs[0], /1\.2\.3\.4/, "the key never reaches logs")
  now += 6_000
  assert.deepEqual(limiter.check(policy, "ip:1.2.3.4"), { ok: true, remaining: 2 })
  now += 20_000
  for (let i = 0; i < 4; i++) limiter.check(policy, "ip:1.2.3.4")
  assert.equal(logs.length, 2, "a later window logs again")
})

test("keys and policies are independent, and the key table stays bounded", () => {
  const limiter = core.createRateLimiter({ maxKeys: 5, log: () => {} })
  for (let i = 0; i < 3; i++) limiter.check(policy, "ip:1.1.1.1")
  assert.equal(limiter.check(policy, "ip:1.1.1.1").ok, false)
  assert.equal(limiter.check(policy, "ip:2.2.2.2").ok, true)
  assert.equal(limiter.check({ ...policy, name: "other" }, "ip:1.1.1.1").ok, true)
  for (let i = 0; i < 20; i++) limiter.check(policy, `ip:10.0.0.${i}`)
  assert.equal(limiter.size(policy.name), 5)
})

test("each policy has its own key table: a flood against one policy never evicts another's counters", () => {
  const limiter = core.createRateLimiter({ maxKeys: 5, log: () => {} })
  const strict = { name: "strict", limit: 1, windowMs: 60_000 }, noisy = { name: "noisy", limit: 1000, windowMs: 60_000 }
  limiter.check(strict, "ip:1.1.1.1")
  assert.equal(limiter.check(strict, "ip:1.1.1.1").ok, false)
  for (let i = 0; i < 1000; i++) limiter.check(noisy, `ip:10.0.${i >> 8}.${i & 255}`)
  assert.equal(limiter.size("noisy"), 5)
  assert.equal(limiter.check(strict, "ip:1.1.1.1").ok, false, "the strict counter survived")
  assert.equal(limiter.size(), 6)
})

test("requests without a valid client address log once per window that the shared bucket is in use", () => {
  let now = 0
  const logs = []
  const limiter = core.createRateLimiter({ now: () => now, log: m => logs.push(m) })
  for (let i = 0; i < 3; i++) limiter.check({ ...policy, limit: 100 }, core.UNKNOWN_ADDRESS_KEY)
  limiter.check({ ...policy, limit: 100 }, "ip:1.2.3.4")
  assert.equal(logs.length, 1)
  assert.match(logs[0], /test request without a valid client address/)
  now += policy.windowMs
  limiter.check({ ...policy, limit: 100 }, core.UNKNOWN_ADDRESS_KEY)
  assert.equal(logs.length, 2, "logged again in the next window")
})

test("keys: account id when signed in, else the validated first forwarded hop, else one shared bucket", () => {
  assert.equal(core.rateLimitKey({ userId: "u1", forwardedFor: "1.2.3.4" }), "user:u1")
  assert.equal(core.rateLimitKey({ forwardedFor: " 203.0.113.9 , 10.0.0.1" }), "ip:203.0.113.9")
  assert.equal(core.rateLimitKey({ forwardedFor: "2001:DB8::1, 10.0.0.1" }), "ip:2001:db8::1")
  for (const bad of [null, "", "unknown", "1.2.3.4.5", "999.1.1.1", "<script>", "a".repeat(80), "1.2.3.4:80"])
    assert.equal(core.rateLimitKey({ forwardedFor: bad }), "ip:unknown", String(bad))
  assert.equal(core.clientIp("1.2.3.4", () => false), null, "the injected validator decides")
})

test("edge IP validator agrees with net.isIP", () => {
  const samples = ["1.2.3.4", "0.0.0.0", "255.255.255.255", "256.1.1.1", "01.2.3.4", "1.2.3", "1.2.3.4.5", " 1.2.3.4", "::", "::1", "2001:db8::1",
    "2001:0db8:0000:0000:0000:ff00:0042:8329", "::ffff:192.0.2.1", "::ffff:999.0.2.1", "1::2::3", "12345::", "g::1", ":::", "1:2:3:4:5:6:7:8",
    "1:2:3:4:5:6:7:8:9", "[::1]", "localhost", "", "1.2.3.4/24", "::1/128", "2001:db8::", "1:2:3:4:5:6:1.2.3.4", "1:2:3:4:5:6:7:1.2.3.4"]
  for (const value of samples) assert.equal(core.isIpAddress(value), net.isIP(value) !== 0, value)
  // One deliberate difference: scoped (zone-id) addresses never arrive from a proxy, so the edge copy refuses them.
  assert.equal(net.isIP("fe80::1%eth0"), 6); assert.equal(core.isIpAddress("fe80::1%eth0"), false)
})

test("429 response: calm generic message, Retry-After, never cached", async () => {
  const res = core.rateLimitedResponse(42)
  assert.equal(res.status, 429)
  assert.equal(res.headers.get("retry-after"), "42")
  assert.equal(res.headers.get("cache-control"), "private, no-store")
  assert.deepEqual(await res.json(), { error: core.RATE_LIMIT_MESSAGE })
})

test("limitRequest keys by forwarded address or account and answers 429 over the limit", async () => {
  const { limitRequest, rateLimiter } = load("lib/rate-limit.ts")
  rateLimiter.reset()
  const p = { name: "route-test", limit: 2, windowMs: 60_000 }
  const req = ip => new Request("https://out-class.net/api/x", { method: "POST", headers: { "x-forwarded-for": ip } })
  assert.equal(limitRequest(req("198.51.100.7"), p), null)
  assert.equal(limitRequest(req("198.51.100.7, 10.0.0.2"), p), null)
  const blocked = limitRequest(req("198.51.100.7"), p)
  assert.equal(blocked.status, 429)
  assert.ok(Number(blocked.headers.get("retry-after")) >= 59)
  assert.equal(limitRequest(req("198.51.100.8"), p), null, "another address has its own bucket")
  assert.equal(limitRequest(req("198.51.100.7"), p, { userId: "u9" }), null, "a signed-in caller has its own bucket")
})

const POST_EXEMPT = {
  // Bearer-protected cron routes (CRON_SECRET, timingSafeEqual); Vercel Cron is the only caller.
  "app/api/internal/invitation-delivery/route.ts": "cron",
  "app/api/internal/notification-delivery/route.ts": "cron",
  "app/api/internal/scheduled-communications/route.ts": "cron",
  "app/api/internal/graduation/route.ts": "cron",
  // Signing out must always work; it only tears down the caller's own session.
  "app/api/auth/logout/route.ts": "sign-out",
  // Browser CSP violation reports: body capped at CSP_REPORT_MAX_BYTES, nothing stored, and lib/csp-report
  // keeps its own deduplicated, rate-limited log. A per-IP limit here would only drop real reports.
  "app/api/csp-report/route.ts": "csp-report",
}

function routeFiles(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => {
    const rel = path.join(dir, entry.name)
    return entry.isDirectory() ? routeFiles(rel) : entry.name === "route.ts" ? [rel] : []
  })
}

test("every app/api route with a POST handler calls the shared limiter or is a reviewed exemption", () => {
  const posts = routeFiles("app/api").filter(file => /export\s+(async\s+function|const)\s+POST\b|export\s*\{[^}]*\bas\s+POST\b|export\s*\{[^}]*\bPOST\b/.test(read(file)))
  assert.ok(posts.length >= 10, `found ${posts.length} POST routes`)
  for (const file of Object.keys(POST_EXEMPT)) assert.ok(posts.includes(file), `stale exemption: ${file}`)
  for (const file of posts.filter(file => !(file in POST_EXEMPT))) {
    const source = read(file)
    assert.match(source, /from "@\/lib\/rate-limit"/, `${file} imports the shared limiter`)
    assert.match(source, /limitRequest\(request, RATE_LIMITS\.\w+/, `${file} calls the shared limiter`)
  }
})

test("abusable GET routes, public actions and short links are limited", () => {
  for (const [file, name] of [["app/api/club-exports/route.ts", "clubExports"], ["app/api/club-assets/route.ts", "clubAssets"], ["app/api/calendar-feed/[token]/route.ts", "calendarFeed"]])
    assert.match(read(file), new RegExp(`limitRequest\\(request, RATE_LIMITS\\.${name}`), file)
  assert.match(read("actions/typesense-search.ts"), /limitAction\(userId \? RATE_LIMITS\.searchUser : RATE_LIMITS\.searchAnonymous, \{ userId \}\)/)
  assert.match(read("actions/onboarding.ts"), /limitAction\(RATE_LIMITS\.signup\)\)\.ok\) return \{ error: RATE_LIMIT_MESSAGE \}/)
  assert.match(read("middleware.ts"), /path\.startsWith\("\/q\/"\)[\s\S]{0,200}RATE_LIMITS\.shortLinks/)
  // Exports also count this account's recent audit rows, which every instance shares.
  assert.match(read("app/api/club-exports/route.ts"), /auditLog\.findMany\(\{ where: \{ actorId: user\.id, action: \{ startsWith: "club\.export\." \}/)
  // Cron and health routes are never limited.
  for (const file of routeFiles("app/api/internal")) assert.doesNotMatch(read(file), /rate-limit/, file)
})

test("published club images are CDN-cacheable; previews stay private", () => {
  const source = read("app/api/club-assets/route.ts")
  assert.match(source, /'Cache-Control': preview \? 'private, no-store' : publicImageCache/)
  assert.match(source, /const publicImageCache = 'public, max-age=\d+, s-maxage=\d+/)
  assert.match(source, /const missing = \(\) => new NextResponse\(null, \{ status: 404, headers: \{ 'Cache-Control': 'private, no-store' \} \}\)/)
})

test("short-link middleware answers 429 per address before resolving", async () => {
  const { NextRequest } = require("next/server")
  const { middleware } = load("middleware.ts", { "@/utils/supabase/middleware": { createClient: async () => new Response(null) } })
  const request = () => new NextRequest("https://out-class.net/q/Ab12Cd", { headers: { "x-forwarded-for": "192.0.2.50" } })
  // A 200-person check-in behind one campus address: the first 130 scans within a minute all pass.
  for (let i = 0; i < 130; i++) assert.notEqual((await middleware(request())).status, 429, `scan ${i + 1}`)
  let last
  for (let i = 130; i <= 600; i++) last = await middleware(request())
  assert.equal(last.status, 429)
  assert.ok(Number(last.headers.get("retry-after")) >= 1)
  const other = await middleware(new NextRequest("https://out-class.net/q/Ab12Cd", { headers: { "x-forwarded-for": "192.0.2.51" } }))
  assert.notEqual(other.status, 429)
})

test("calendar feed: valid tokens reuse a built feed briefly and answer If-None-Match with 304", async () => {
  const state = { transactions: 0 }
  const feed = { userId: "u1", lastUsedAt: new Date(), user: { disabledAt: null } }
  let current = feed
  const mod = load("app/api/calendar-feed/[token]/route.ts", {
    "@/utils/prisma": { prisma: { calendarFeedToken: { findUnique: async () => current, updateMany: async () => ({}) }, $transaction: async fn => { state.transactions++; return fn({}) } } },
    "@/utils/calendar-feed": { calendarFeedEvents: async () => [] },
  })
  const { newCalendarFeedToken } = load("lib/calendar-feed.ts")
  const token = newCalendarFeedToken()
  const get = headers => mod.GET(new Request("https://out-class.net/x", { headers }), { params: Promise.resolve({ token }) })
  const first = await get({})
  assert.equal(first.status, 200)
  const etag = first.headers.get("etag")
  const second = await get({ "if-none-match": etag })
  assert.equal(second.status, 304)
  assert.equal(state.transactions, 1, "the second poll reused the built feed")
  current = null
  assert.equal((await get({})).status, 404, "a revoked link stops at once, cache or not")
})

test("exports: ten recent exports by this account answer 429 before any transaction opens", async () => {
  const clubId = "11111111-1111-4111-8111-111111111111"
  let transactions = 0
  const recent = Array.from({ length: 10 }, (_, i) => ({ createdAt: new Date(Date.now() - (9 - i) * 1000) }))
  const { GET } = load("app/api/club-exports/route.ts", {
    "@/utils/prisma": { prisma: { $transaction: async () => { transactions++ }, auditLog: { findMany: async q => { assert.equal(q.where.actorId, "u1"); return recent.slice().reverse() } } } },
    "@/utils/auth": { requireClubPermission: async () => ({ user: { id: "u1" } }) },
    "@/utils/support-audit": { auditSupportAction: async () => {} },
    "@/lib/club-transaction-authorization": { authorizeClubTransaction: async () => ({}) },
    // The csvExport switch is checked inside the transaction, which the limit never reaches.
    "@/utils/club-features": { clubHasFeature: async () => true },
  })
  const res = await GET(new Request(`https://out-class.net/api/club-exports?clubId=${clubId}&kind=roster`))
  assert.equal(res.status, 429)
  const retry = Number(res.headers.get("retry-after"))
  assert.ok(retry > 500 && retry <= 600, `retry after ${retry}s, when the oldest of the ten leaves the window`)
  assert.equal(transactions, 0)
})

test("calendar feed: random tokens from one address hit the per-address limit before any lookup", async () => {
  let lookups = 0
  const mod = load("app/api/calendar-feed/[token]/route.ts", {
    "@/utils/prisma": { prisma: { calendarFeedToken: { findUnique: async () => { lookups++; return null } } } },
    "@/utils/calendar-feed": { calendarFeedEvents: async () => [] },
  })
  const { newCalendarFeedToken } = load("lib/calendar-feed.ts")
  const { RATE_LIMITS } = core
  const get = ip => mod.GET(new Request("https://out-class.net/x", { headers: { "x-forwarded-for": ip } }), { params: Promise.resolve({ token: newCalendarFeedToken() }) })
  const { limit } = RATE_LIMITS.calendarFeedAddress
  const statuses = []
  // Fill the address's window, then send 200 more random tokens: every one of those is refused unlooked-up.
  for (let i = 0; i < limit + 200; i++) statuses.push((await get("203.0.113.77")).status)
  assert.deepEqual([...new Set(statuses.slice(0, limit))], [404])
  assert.deepEqual([...new Set(statuses.slice(limit))], [429])
  assert.equal(lookups, limit, "no lookup once the address is over its limit")
  assert.equal((await get("203.0.113.78")).status, 404, "another address is unaffected")
})

test("calendar feed: a failed build logs its cause and answers 503", async () => {
  const errors = []
  const original = console.error
  console.error = (...args) => errors.push(args)
  try {
    const mod = load("app/api/calendar-feed/[token]/route.ts", {
      "@/utils/prisma": { prisma: { calendarFeedToken: { findUnique: async () => ({ userId: "u1", lastUsedAt: new Date(), user: { disabledAt: null } }) }, $transaction: async () => { throw new Error("database timeout") } } },
      "@/utils/calendar-feed": { calendarFeedEvents: async () => [] },
    })
    const { newCalendarFeedToken } = load("lib/calendar-feed.ts")
    const res = await mod.GET(new Request("https://out-class.net/x"), { params: Promise.resolve({ token: newCalendarFeedToken() }) })
    assert.equal(res.status, 503)
    assert.equal(errors.length, 1)
    assert.equal(errors[0][0], "calendar-feed: feed unavailable")
    assert.match(errors[0][1].message, /database timeout/)
  } finally { console.error = original }
})

test("search: one signed-in user at the limit does not null out other users on the same address", async () => {
  const env = { ...process.env }
  process.env.TYPESENSE_URL = "https://search.example.test"
  process.env.TYPESENSE_SEARCH_KEY = "public-search-key"
  const savedFetch = global.fetch
  let fetches = 0
  global.fetch = async () => { fetches++; return { ok: true, json: async () => ({ hits: [{ document: { id: "club-1" } }] }) } }
  let current = "user-a"
  try {
    const { searchPublicClubIds } = load("actions/typesense-search.ts", {
      "next/headers": {
        cookies: async () => ({ getAll: () => current ? [{ name: "sb-project-auth-token", value: "x" }] : [] }),
        headers: async () => new Headers({ "x-forwarded-for": "198.51.100.20" }),
      },
      "@/utils/supabase/server": { createClient: async () => ({ auth: { getClaims: async () => ({ data: { claims: { sub: current } }, error: null }) } }) },
    })
    const { RATE_LIMITS } = load("lib/rate-limit.ts")
    for (let i = 0; i < RATE_LIMITS.searchUser.limit; i++) assert.deepEqual(await searchPublicClubIds("consulting"), ["club-1"])
    assert.equal(await searchPublicClubIds("consulting"), null, "user A is over the per-account limit")
    current = "user-b"
    assert.deepEqual(await searchPublicClubIds("consulting"), ["club-1"], "user B on the same address still gets results")
    current = null
    assert.deepEqual(await searchPublicClubIds("consulting"), ["club-1"], "a signed-out visitor on that address uses the address bucket")
    assert.equal(fetches, RATE_LIMITS.searchUser.limit + 2)
  } finally {
    global.fetch = savedFetch
    process.env = env
  }
})

test("a failing logger never breaks a request", () => {
  const limiter = core.createRateLimiter({ log: () => { throw new Error("logger down") } })
  const p = { name: "x", limit: 1, windowMs: 60_000 }
  assert.equal(limiter.check(p, core.UNKNOWN_ADDRESS_KEY).ok, true)
  assert.equal(limiter.check(p, core.UNKNOWN_ADDRESS_KEY).ok, false)
})
