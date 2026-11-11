const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const { spawnSync } = require("node:child_process")

// FE-28 (decision 2): the signed-out local leader preview is retired; Demo Mode is the way to try the product.
const removed = [
  "components/views/club-management-portal-view.tsx",
  "components/views/club-manager/broadcast-messages-view.tsx",
  "components/views/leader-dashboard/local-leader-dashboard.tsx",
  "components/views/leader-dashboard/pipeline-view.tsx",
  "components/views/leader-dashboard/speed-review-mode.tsx",
]

test("the retired preview views are gone and nothing imports them", () => {
  for (const file of removed) assert.equal(fs.existsSync(file), false, file)
  const sources = spawnSync("git", ["ls-files", "app", "components", "lib", "contexts", "actions", "utils", "middleware.ts", "scripts", "tests"], { encoding: "utf8" }).stdout
    .split("\n").filter(file => /\.(tsx?|cjs|mjs|js|json)$/.test(file) && file !== "tests/preview-retirement.test.cjs" && fs.existsSync(file))
  const modules = removed.map(file => file.replace(/\.tsx$/, ""))
  for (const file of sources) {
    const source = fs.readFileSync(file, "utf8")
    for (const module of modules) assert.ok(!source.includes(module), `${file} still references ${module}`)
    assert.doesNotMatch(source, /ClubManagementPortalView|BroadcastMessagesView|LocalLeaderDashboard|SpeedReviewMode/, file)
  }
  const views = fs.readFileSync("lib/views.ts", "utf8")
  assert.doesNotMatch(views, /"club-management-portal"/, "no ViewId or nav entry for the retired portal")
  assert.doesNotMatch(fs.readFileSync("components/dashboard-layout.tsx", "utf8"), /Local workspace preview|mode="preview"/)
  assert.doesNotMatch(fs.readFileSync("components/views/leader-dashboard-view.tsx", "utf8"), /dynamic\(|Local preview/)
})

test("old leader preview URLs still redirect, and /preview stays a gated Demo Mode route", () => {
  // `/?view=club-management-portal` (and the other old homepage leader views) keep their redirect.
  const routes = fs.readFileSync("lib/student-routes.ts", "utf8")
  assert.match(routes, /LEADER_WORKSPACE_VIEWS = \[[^\]]*"club-management-portal"/)
  assert.match(routes, /view === "club-manager" \|\| view === "club-management-portal" \? "settings"/)
  const home = fs.readFileSync("app/page.tsx", "utf8")
  assert.match(home, /if \(isLeaderWorkspaceView\(requestedView\)\)[\s\S]*redirect\(club \? leaderWorkspaceHref\(requestedView, club\.clubId, focus\) : STUDENT_HOME\)/)
  assert.match(home, /if \(!user && \["workspace", "view", "demoClub"\]\.some\(key => params\[key\] !== undefined\)\)[\s\S]*redirect\(`\/login\?next=/)
  // /preview is Demo Mode's presenter entry (demo club deep links), never a public page: 404 without the demo cookie,
  // GET/HEAD only, and the layout requires a confirmed demo-allowlisted account.
  const middleware = fs.readFileSync("middleware.ts", "utf8")
  assert.match(middleware, /path === "\/preview" \|\| path\.startsWith\("\/preview\/"\)[\s\S]{0,200}request\.cookies\.get\(DEMO_COOKIE\)\?\.value !== "1"[\s\S]{0,200}status: 404/)
  assert.match(middleware, /Live account access and production writes are disabled in Demo Mode\./)
  const layout = fs.readFileSync("app/preview/layout.tsx", "utf8")
  assert.match(layout, /canAccessDemo\(user\.email\)\) notFound\(\)/)
})
