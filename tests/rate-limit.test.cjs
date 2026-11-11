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
  assert.equal(limiter.size(), 5)
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
  // Signing out must always work; it only tears down the caller's own session.
  "app/api/auth/logout/route.ts": "sign-out",
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
  assert.match(read("actions/typesense-search.ts"), /limitAction\(RATE_LIMITS\.search\)/)
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
  let last
  for (let i = 0; i <= 120; i++) last = await middleware(request())
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
  })
  const res = await GET(new Request(`https://out-class.net/api/club-exports?clubId=${clubId}&kind=roster`))
  assert.equal(res.status, 429)
  const retry = Number(res.headers.get("retry-after"))
  assert.ok(retry > 500 && retry <= 600, `retry after ${retry}s, when the oldest of the ten leaves the window`)
  assert.equal(transactions, 0)
})
