const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")

function load(file, mocks = {}) {
  const resolved = [file, `${file}.ts`, `${file}.tsx`].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(resolved, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function("require", "module", "exports", code)(name => mocks[name] || (name.startsWith("@/") ? load(path.join(name.slice(2)), mocks) : require(name)), mod, mod.exports)
  return mod.exports
}
const nav = load("lib/student-routes.ts")
const redirect = query => nav.legacyStudentRedirect(new URLSearchParams(query))

test("every old student workspace URL maps to its real path", () => {
  const cases = {
    "workspace=student": "/home",
    "workspace=student&view=student-dashboard": "/home",
    "workspace=student&view=explore": "/explore",
    "workspace=student&view=discover": "/explore",
    "workspace=student&view=discovery": "/explore",
    // Today the categories alias canonicalizes to plain Discover; keep that.
    "workspace=student&view=categories": "/explore",
    "workspace=student&view=corkboard": "/corkboard",
    "workspace=student&view=tracker": "/applications",
    "workspace=student&view=tracker&section=applications": "/applications",
    "workspace=student&view=tracker&section=status": "/applications?tab=in-review",
    "workspace=student&view=status&section=status": "/applications?tab=in-review",
    "workspace=student&view=interviews": "/applications?tab=in-review",
    "workspace=student&view=decisions": "/applications?tab=in-review",
    "workspace=student&view=my-clubs": "/clubs",
    "workspace=student&view=my-clubs&section=clubs": "/clubs",
    "workspace=student&view=my-clubs&section=meetings": "/calendar?type=meeting",
    "workspace=student&view=my-clubs&section=tasks": "/clubs/tasks",
    "workspace=student&view=calendar": "/calendar",
    "workspace=student&view=calendar&section=meetings": "/calendar?section=meetings",
    "workspace=student&view=calendar&section=explore": "/calendar",
    "workspace=student&view=inbox": "/inbox",
    "workspace=student&view=student-profile": "/profile",
    "view=tracker": "/applications",
    "workspace=student&view=leader-dashboard": "/home",
    "workspace=student&view=bogus": "/home",
    // AppShell rendered the student view for these too; the session is unchanged.
    "workspace=leader&view=inbox": "/inbox",
  }
  for (const [query, expected] of Object.entries(cases)) assert.equal(redirect(query), expected, query)
})

test("focus ids, tabs and repeated parameters carry over; routing parameters do not", () => {
  assert.equal(redirect("workspace=student&view=tracker&applicationClubId=fund&applicationId=a"), "/applications?applicationClubId=fund&applicationId=a")
  assert.equal(redirect("workspace=student&view=inbox&tab=preferences"), "/inbox?tab=preferences")
  assert.equal(redirect("workspace=student&view=status&section=status&tag=a&tag=b"), "/applications?tag=a&tag=b&tab=in-review")
  assert.equal(redirect("workspace=student&view=explore&demoClub=jis"), "/explore?demoClub=jis")
})

test("landing, sign-in, leader and demo entry URLs are not redirected", () => {
  for (const query of ["", "next=%2Fsettings", "error=uva_only", "workspace=leader", "view=leader-dashboard", "view=interview-scheduler", "demoClub=jis", "audience=student"]) {
    assert.equal(redirect(query), null, query || "(empty)")
  }
})

test("paths round-trip to the view and section they render", () => {
  for (const route of nav.STUDENT_ROUTES) {
    const resolved = nav.studentRouteForPath(route.path)
    assert.deepEqual(resolved, { view: route.view, section: route.section }, route.path)
    // Status and Meetings were folded into Applications and Calendar; their paths redirect.
    if (route.path !== "/explore/categories") assert.equal(nav.studentPath(route.view, route.section), nav.movedStudentHref(route.path) ?? route.path, route.path)
  }
  assert.deepEqual(nav.studentRouteForPath("/calendar", new URLSearchParams("section=tasks")), { view: "calendar", section: "tasks" })
  assert.equal(nav.studentRouteForPath("/settings"), null)
  assert.equal(nav.studentRouteForPath("/"), null)
})

test("application code links to student paths, not the old homepage workspace URLs", () => {
  const { execFileSync } = require("node:child_process")
  const files = execFileSync("git", ["ls-files", "app", "components", "lib", "actions", "utils", "contexts", "middleware.ts"], { encoding: "utf8" }).split("\n").filter(file => /\.tsx?$/.test(file))
  // Comments that describe the redirect, and the /preview demo, which keeps its query form.
  const allowed = new Set(["lib/student-routes.ts", "lib/notification-presentation.ts", "middleware.ts", "components/student-workspace-page.tsx", "components/app-shell.tsx"])
  const offenders = files.filter(file => !allowed.has(file) && /workspace=student|[?&]view=(student-|explore|tracker|status|inbox|calendar|my-clubs|corkboard|categories)/.test(fs.readFileSync(file, "utf8")))
  assert.deepEqual(offenders, [])
  const shell = fs.readFileSync("components/app-shell.tsx", "utf8")
  assert.match(shell, /const href = embedded \? `\/preview\?\$\{params\}` : studentPath\(next, nextSection\)/)
})

// Authorization: every student path gates exactly as the homepage did for each actor.
function entryHarness({ session = null, authError = null, cookies = {}, account = {}, demoAllowed = false, platformUser = null } = {}) {
  const calls = { dashboard: 0, prisma: 0, requireAuth: 0 }
  const mocks = {
    "next/headers": { cookies: async () => ({ has: name => name in cookies, get: name => name in cookies ? { value: cookies[name] } : undefined }) },
    "next/navigation": { redirect: destination => { throw Object.assign(Error("redirect"), { destination }) } },
    "next/cache": { unstable_cache: fn => fn },
    "@/utils/auth": { getSessionUser: async () => ({ data: { user: session }, error: authError }), requireAuth: async () => { calls.requireAuth++; return { user: platformUser } } },
    "@/lib/platform-view-as": { PLATFORM_VIEW_COOKIE: "platform-view" },
    "@/lib/demo/access": { DEMO_COOKIE: "demo", canAccessDemo: () => demoAllowed },
    "@/lib/launch-clubs": { getLaunchClubs: async () => [] },
    "@/actions/applications": { getStudentDashboardData: async () => { calls.dashboard++; return { applications: ["private"] } } },
    "@/actions/club-directory": { getClubDirectory: async () => { calls.directory = (calls.directory ?? 0) + 1; return { clubs: [{ id: "public-club" }] } } },
    "@/utils/prisma": { prisma: {
      user: { findUnique: async () => { calls.prisma++; return { disabledAt: account.disabledAt ?? null } } },
      studentProfile: { findUnique: async () => { calls.prisma++; return account.profile === false ? null : { id: "profile" } } },
    } },
    "@/components/home-entry": { HomeEntry: "HomeEntry" },
    "@/lib/auth": load("lib/auth.ts"),
    "@/lib/navigation": nav, "@/lib/student-routes": nav,
  }
  const { StudentWorkspacePage } = load("components/student-workspace-page.tsx", mocks)
  return { calls, render: (path, params = {}) => StudentWorkspacePage({ path, searchParams: Promise.resolve(params) }) }
}
const confirmed = { id: "student-a", email: "abc1de@virginia.edu", email_confirmed_at: "2026-11-01" }
const deniedTo = async (promise, destination) => assert.rejects(promise, error => error.destination === destination)

test("authz: logged-out, expired, unconfirmed and non-UVA sessions are sent to sign-in with no data read", async () => {
  for (const actor of [{}, { authError: Error("expired") }, { session: { ...confirmed, email_confirmed_at: null } }, { session: { ...confirmed, email: "a@example.com" } }]) {
    const h = entryHarness(actor)
    await deniedTo(h.render("/applications", { applicationClubId: "fund" }), "/login?next=%2Fapplications%3FapplicationClubId%3Dfund")
    await deniedTo(h.render("/calendar", { section: "tasks" }), "/login?next=%2Fcalendar%3Fsection%3Dtasks")
    assert.deepEqual(h.calls, { dashboard: 0, prisma: 0, requireAuth: 0 })
  }
})

test("authz: a disabled account gets the unavailable notice before any dashboard read", async () => {
  const h = entryHarness({ session: confirmed, account: { disabledAt: new Date() } })
  const page = await h.render("/home")
  assert.equal(page.type, "main")
  assert.equal(h.calls.dashboard, 0)
})

test("authz: demo renders fictional client data only, with no session, database or dashboard reads", async () => {
  for (const session of [null, confirmed]) {
    const h = entryHarness({ session, cookies: { demo: "1" }, demoAllowed: true })
    const page = await h.render("/explore", { demoClub: "jis" })
    assert.equal(page.type, "HomeEntry")
    assert.equal(page.props.initialView, "explore")
    assert.equal(page.props.initialSession, undefined)
    assert.equal(page.props.initialData, undefined)
    assert.deepEqual(h.calls, { dashboard: 0, prisma: 0, requireAuth: 0 })
  }
  // A demo cookie without demo access falls through to live authorization.
  await deniedTo(entryHarness({ cookies: { demo: "1" }, demoAllowed: false }).render("/home"), "/login?next=%2Fhome")
})

test("authz: platform view-as resolves identity through requireAuth, never the raw session", async () => {
  const viewed = { ...confirmed, id: "viewed-student" }
  const h = entryHarness({ session: { ...confirmed, id: "admin" }, cookies: { "platform-view": "1" }, platformUser: viewed })
  const page = await h.render("/inbox")
  assert.equal(h.calls.requireAuth, 1)
  assert.equal(page.props.initialSession.id, "viewed-student")
})

test("authz: a confirmed UVA student gets their own workspace view; onboarding is preserved when there is no profile", async () => {
  const h = entryHarness({ session: confirmed })
  const page = await h.render("/clubs/meetings")
  assert.equal(page.type, "HomeEntry")
  assert.equal(page.props.initialView, "my-clubs")
  assert.equal(page.props.initialSession.id, "student-a")
  assert.equal(page.props.hasProfile, true)
  assert.equal((await entryHarness({ session: confirmed, account: { profile: false } }).render("/home")).props.hasProfile, false)
  await assert.rejects(h.render("/settings"), /Not a student workspace path/)
})

// Mocks for the homepage server component (app/page.tsx).
function pageMocks(opts = {}) {
  return {
    "next/headers": { cookies: async () => ({ has: name => name in (opts.cookies || {}), get: name => name in (opts.cookies || {}) ? { value: opts.cookies[name] } : undefined, getAll: () => [] }) },
    "next/navigation": { redirect: destination => { throw Object.assign(Error("redirect"), { destination }) } },
    "next/cache": { unstable_cache: fn => fn }, next: {},
    "@/utils/auth": { getSessionUser: async () => ({ data: { user: opts.session ?? null }, error: null }), requireAuth: async () => ({ user: opts.platformUser }) },
    "@/lib/platform-view-as": { PLATFORM_VIEW_COOKIE: "platform-view" },
    "@/lib/demo/access": { DEMO_COOKIE: "demo", canAccessDemo: () => !!opts.demoAllowed },
    "@/lib/launch-clubs": { getLaunchClubs: async () => [] },
    "@/actions/applications": { getStudentDashboardData: async () => ({}) },
    "@/utils/prisma": { prisma: { user: { findUnique: async () => ({ disabledAt: opts.disabled ? new Date() : null, memberships: opts.memberships ?? [] }) }, studentProfile: { findUnique: async () => opts.noProfile ? null : { id: "p" } } } },
    "@/lib/permissions": load("lib/permissions.ts"),
    "@/components/home-entry": { HomeEntry: "HomeEntry" },
    "@/lib/auth": load("lib/auth.ts"), "@/lib/navigation": nav, "@/lib/student-routes": nav,
    "@/lib/seo": { SITE_TITLE: "", SITE_DESCRIPTION: "", publicPageMetadata: () => ({}), privateRobots: {}, privateHomepageParams: [], websiteStructuredData: {} },
    "@/lib/landing-audience": { initialLandingAudience: () => "student", landingAudienceBootScript: "", LANDING_AUDIENCE_PREFERENCE: "aud" },
  }
}

test("authz: signed-in visitors to / go to /home or a same-origin ?next; demo, leader and signed-out keep the homepage", async () => {
  const home = (opts = {}, params = {}) => load("app/page.tsx", pageMocks(opts)).default({ searchParams: Promise.resolve(params) })
  await deniedTo(home({ session: confirmed }), "/home")
  await deniedTo(home({ session: confirmed }, { next: "/settings/profile" }), "/settings/profile")
  for (const next of ["//evil.example", "https://evil.example", "/\\evil"]) await deniedTo(home({ session: confirmed }, { next }), "/home")
  await deniedTo(home({ cookies: { "platform-view": "1" }, platformUser: confirmed }), "/home")
  // Onboarding hand-off: requireCompletedStudentProfile sends profile-less users to /?next=<page>.
  // They must stay on / for onboarding (redirecting to next would loop); without next they go Home.
  const handoff = nodes => !nodes || typeof nodes !== "object" ? [] : [nodes, ...[nodes.props?.children].flat(Infinity).flatMap(handoff)]
  for (const next of ["/invitations/abc", "/settings/organizations"]) {
    const entry = handoff(await home({ session: confirmed, noProfile: true }, { next })).find(node => node.type === "HomeEntry")
    assert.ok(entry, next); assert.equal(entry.props.hasProfile, false); assert.equal(entry.props.initialSession.id, "student-a")
  }
  await deniedTo(home({ session: confirmed, noProfile: true }), "/home")
  // A disabled account gets the notice, not a redirect to its requested destination.
  for (const params of [{}, { next: "/settings/profile" }]) assert.equal((await home({ session: confirmed, disabled: true }, params)).type, "main")
  const nodes = node => !node || typeof node !== "object" ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)]
  const entry = async (...args) => nodes(await home(...args)).find(node => node.type === "HomeEntry")
  assert.equal((await entry({})).props.initialView, "landing")
  assert.equal((await entry({ session: confirmed, cookies: { demo: "1" }, demoAllowed: true })).props.initialView, "landing")
  assert.equal((await entry({ session: confirmed }, { workspace: "leader" })).props.initialSession.id, "student-a")
})

test("old leader views on / open the matching club workspace section for the leader's club", async () => {
  const pageFor = async (opts, params) => {
    try { await load("app/page.tsx", pageMocks(opts)).default({ searchParams: Promise.resolve(params) }) } catch (error) { return error.destination }
    return "rendered"
  }
  const owner = [{ clubId: "club-x", status: "ACTIVE", isOwner: true, permissions: [], interviewOffices: [] }]
  const cases = [
    [{ view: "leader-dashboard" }, "/club/club-x/workspace?section=recruitment&tool=applicants"],
    [{ view: "interview-scheduler", applicantId: "a", roundId: "r" }, "/club/club-x/workspace?section=recruitment&tool=interviews&applicantId=a&roundId=r"],
    [{ view: "screening-dashboard" }, "/club/club-x/workspace?section=recruitment&tool=applicants&recruitingSettings=rules"],
    [{ view: "broadcast-messages" }, "/club/club-x/workspace?section=overview&focus=announcements"],
    [{ view: "club-manager" }, "/club/club-x/workspace?section=settings"],
    [{ view: "club-management-portal" }, "/club/club-x/workspace?section=settings"],
  ]
  for (const [params, expected] of cases) assert.equal(await pageFor({ session: confirmed, memberships: owner }, params), expected, params.view)
  // No leader workspace (ordinary member or none): Home, as before.
  assert.equal(await pageFor({ session: confirmed, memberships: [{ clubId: "club-y", status: "ACTIVE", isOwner: false, permissions: [], interviewOffices: [] }] }, { view: "leader-dashboard" }), "/home")
  // Signed out: sign in first, then come back to the same URL.
  assert.equal(await pageFor({}, { view: "leader-dashboard" }), "/login?next=" + encodeURIComponent("/?view=leader-dashboard"))
  // Library helper and the client redirect share one mapping.
  assert.equal(nav.leaderWorkspaceHref("broadcast-messages", "c 1"), "/club/c%201/workspace?section=overview&focus=announcements")
})

test("old URLs: middleware 307s on real hosts; loopback IPs fall through to the homepage redirect", async () => {
  class FakeResponse {
    constructor(body, init = {}) { this.status = init.status; this.headers = new Headers(init.headers) }
    static next() { return new FakeResponse(null, { status: 200 }) }
    static json(body, init) { return new FakeResponse(null, init) }
    static redirect(url, status) { return new FakeResponse(null, { status, headers: { location: String(url) } }) }
  }
  const { middleware } = load("middleware.ts", {
    "next/server": { NextResponse: FakeResponse },
    "@/utils/supabase/middleware": { createClient: async () => FakeResponse.next() },
    "@/lib/platform-view-as": { PLATFORM_VIEW_COOKIE: "platform-view" },
    "@/lib/demo/access": { DEMO_COOKIE: "demo" },
    "@/lib/navigation": nav, "@/lib/student-routes": nav,
  })
  const request = (origin, query) => {
    const url = new URL(`${origin}/${query}`)
    return { method: "GET", url: url.toString(), nextUrl: url, headers: new Headers({ host: url.host }), cookies: { get: () => undefined, has: () => false, getAll: () => [] } }
  }
  const response = await middleware(request("https://www.outclass.example", "?workspace=student&view=tracker&applicationClubId=fund"))
  assert.equal(response.status, 307)
  assert.equal(response.headers.get("location"), "https://www.outclass.example/applications?applicationClubId=fund")
  assert.equal(response.headers.get("cache-control"), "private, no-store")
  assert.equal((await middleware(request("http://localhost:3109", "?workspace=student"))).headers.get("location"), "http://localhost:3109/home")
  // Next would rewrite these hosts to localhost (losing cookies), so the page redirects instead.
  for (const origin of ["http://127.0.0.1:3109", "http://[::1]:3109"]) assert.equal((await middleware(request(origin, "?workspace=student"))).status, 200, origin)
  assert.equal((await middleware(request("https://www.outclass.example", "?audience=student"))).status, 200)
  // Only GET/HEAD redirect: a POST (server action) to / with old params reaches the normal path.
  const post = request("https://www.outclass.example", "?workspace=student&view=inbox"); post.method = "POST"
  assert.equal((await middleware(post)).status, 200)
  // Every new path is kept out of search; /corkboard predates the move and stays public.
  const at = path => { const url = new URL(`https://www.outclass.example${path}`); return { method: "GET", url: url.toString(), nextUrl: url, headers: new Headers({ host: url.host }), cookies: { get: () => undefined, has: () => false, getAll: () => [] } } }
  for (const route of nav.STUDENT_ROUTES) {
    const robots = (await middleware(at(route.path))).headers.get("x-robots-tag")
    assert.equal(robots, route.path === "/corkboard" ? null : "noindex, nofollow", route.path)
  }

  const page = params => load("app/page.tsx", pageMocks({})).default({ searchParams: Promise.resolve(params) })
  await deniedTo(page({ workspace: "student", view: "tracker", applicationClubId: "fund" }), "/applications?applicationClubId=fund")
  await deniedTo(page({ workspace: "student", view: "calendar", section: "tasks" }), "/calendar?section=tasks")
})

test("FE-4: / reads the session with the cookie jar, and the dashboard with the launch clubs, in parallel after the auth gates", async () => {
  const source = fs.readFileSync("app/page.tsx", "utf8")
  assert.match(source, /Promise\.all\(\[cookies\(\), getSessionUser\(\)\]\)/)
  assert.match(source, /Promise\.all\(\[\s*user \? getStudentDashboardData\(\)\.catch\(/)
  assert.ok(source.indexOf("disabledAt") < source.indexOf("getStudentDashboardData()"), "disabled-account check precedes the dashboard read")
  assert.ok(source.lastIndexOf("redirect(next !== \"/\"") < source.indexOf("getStudentDashboardData()"), "signed-in redirect precedes the dashboard read")
  // Behaviour: a dashboard failure still renders Home with no dashboard; signed-out visitors never read it.
  const nodes = node => !node || typeof node !== "object" ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)]
  let reads = 0
  const mocks = opts => ({ ...pageMocks(opts), "@/actions/applications": { getStudentDashboardData: async () => { reads++; throw Error("db down") } } })
  const realError = console.error; console.error = () => {}
  try {
    const failed = nodes(await load("app/page.tsx", mocks({ session: confirmed })).default({ searchParams: Promise.resolve({ workspace: "leader" }) })).find(node => node.type === "HomeEntry")
    assert.equal(failed.props.initialData, null); assert.equal(reads, 1)
    await load("app/page.tsx", mocks({})).default({ searchParams: Promise.resolve({}) })
    assert.equal(reads, 1, "signed-out visitors do not read the dashboard")
  } finally { console.error = realError }
})

test("FE-4: a direct /explore load seeds Explore with the public directory after the gates; other paths do not read it", async () => {
  const h = entryHarness({ session: confirmed })
  const page = await h.render("/explore")
  assert.deepEqual(page.props.initialDirectory, { clubs: [{ id: "public-club" }] })
  assert.equal(typeof page.props.serverNow, "number")
  const home = await h.render("/home")
  assert.equal(home.props.initialDirectory, undefined); assert.equal(typeof home.props.serverNow, "number")
  assert.equal(h.calls.directory, 1)
  const disabled = entryHarness({ session: confirmed, account: { disabledAt: new Date() } })
  assert.equal((await disabled.render("/explore")).type, "main"); assert.equal(disabled.calls.directory, undefined)
  const demo = entryHarness({ session: confirmed, cookies: { demo: "1" }, demoAllowed: true })
  assert.equal((await demo.render("/explore")).props.initialDirectory, undefined); assert.equal(demo.calls.directory, undefined)
  const source = fs.readFileSync("components/student-workspace-page.tsx", "utf8")
  assert.match(source, /Promise\.all\(\[cookies\(\), getSessionUser\(\)\]\)/)
  assert.ok(source.indexOf("disabledAt") < source.indexOf("await Promise.all([\n    getStudentDashboardData()"), "reads start after the disabled-account gate")
})

test("FE-4: Explore renders the server seed on first mount, still reads live on later mounts, retry and Demo", () => {
  const view = fs.readFileSync("components/views/explore-view.tsx", "utf8")
  assert.match(view, /useState<DirectoryClub\[\]>\(\(\) => initialDirectory\?\.clubs \?\? \[\]\)/)
  assert.match(view, /useState\(!initialDirectory\)/)
  assert.match(view, /if \(seeded\.current\) \{ seeded\.current = false; onInitialDirectoryUsed\?\.\(\); return \}/)
  assert.match(view, /\}, \[retry, isDemoEnabled\]\)/)
  assert.match(view, /useServerAnchoredNow\(serverNow\)/, "seeded recruitment state uses the server render time while hydrating")
  const shell = fs.readFileSync("components/app-shell.tsx", "utf8")
  assert.match(shell, /initialDirectory=\{demo\.isDemoEnabled \? undefined : directorySeed\}/)
  assert.match(shell, /onInitialDirectoryUsed=\{\(\) => setDirectorySeed\(undefined\)\}/)
})
