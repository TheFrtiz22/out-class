// FE-4: /club/[clubId] reads the public profile and the session together, after the Demo redirect.
const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")

const FILE = "app/(workspace)/club/[clubId]/page.tsx"
function page({ demo = false, demoAllowed = false, user = null, club = { id: "c1", name: "Club", marketing: {} }, error } = {}) {
  const calls = []
  const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
  const session = deferred(), profile = deferred()
  const mocks = {
    "next/headers": { cookies: async () => ({ get: name => name === "demo" && demo ? { value: "1" } : undefined, has: () => false, getAll: () => [] }) },
    "next/navigation": { redirect: destination => { throw Object.assign(Error("redirect"), { destination }) }, notFound: () => { throw Object.assign(Error("notFound"), { notFound: true }) } },
    "@/lib/demo/access": { DEMO_COOKIE: "demo", canAccessDemo: () => demoAllowed },
    "@/utils/auth": { getSessionUser: () => { calls.push("session"); return session.promise } },
    "@/actions/club-directory": { getPublicClub: () => { calls.push("club"); return profile.promise } },
    "@/lib/public-clubs": { publicClubs: [] },
    "@/components/shell/authenticated-page-layout": { AuthenticatedPageLayout: "AuthenticatedPageLayout" },
    "@/components/qr/public-club-page": { PublicClubPage: "PublicClubPage" },
    "@/components/ui/page-header": { PageHeader: "PageHeader" },
    "@/lib/public-club-content": { presentPublicMarketing: value => value },
    "@/lib/club-marketing": { readMarketing: value => value },
  }
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(FILE, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function("require", "module", "exports", code)(name => mocks[name] || (name.startsWith("@/") ? {} : require(name)), mod, mod.exports)
  const run = mod.exports.default({ params: Promise.resolve({ clubId: "c1" }) })
  return { calls, run, settle: () => { session.resolve({ data: { user }, error: null }); profile.resolve({ club, error }) } }
}
const tick = () => new Promise(resolve => setImmediate(resolve))

test("both reads start before either finishes, and the session still decides authenticated/embedded", async () => {
  const p = page({ user: { id: "u", email_confirmed_at: "x" } })
  await tick()
  assert.deepEqual(p.calls.sort(), ["club", "session"], "started together")
  p.settle()
  const tree = await p.run
  const card = tree.props.children
  assert.equal(card.type, "PublicClubPage"); assert.equal(card.props.authenticated, true); assert.equal(card.props.embedded, true)
  assert.equal(typeof card.props.serverNow, "number")
})

test("signed-out visitors get the public page; a missing club is a 404; a read error offers retry", async () => {
  let p = page(); p.settle(); assert.equal((await p.run).props.children.props.authenticated, false)
  p = page({ club: null }); p.settle(); await assert.rejects(p.run, error => error.notFound)
  p = page({ club: null, error: "Unavailable" }); p.settle()
  assert.equal(JSON.stringify(await p.run).includes("Try again"), true)
})

test("Demo still redirects to the preview before any live club read", async () => {
  const p = page({ demo: true, demoAllowed: true, user: { email: "a@virginia.edu", email_confirmed_at: "x" } })
  await tick(); p.settle()
  await assert.rejects(p.run, error => error.destination === "/preview?demoClub=c1")
  assert.deepEqual(p.calls, ["session"], "no club read for a Demo redirect")
})
