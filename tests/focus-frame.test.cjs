// Focus frame: single-task screens share one frame (app/(focus)/layout.tsx) with the
// OutClass mark, club, task and Exit. URLs do not change; the frame owns <main>.
const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { loadComponent } = require("./helpers/component-module.cjs")
const routes = loadComponent("lib/focus-routes.ts")

const moved = {
  "/live-voting": "live-voting/page.tsx", "/vote": "vote/page.tsx", "/check-in": "check-in/page.tsx",
  "/voting/x/join": "voting/[sessionId]/join/page.tsx", "/voting/rooms/new": "voting/rooms/new/page.tsx",
  "/voting/rooms/x": "voting/rooms/[sessionId]/page.tsx", "/voting/rooms/x/prepare": "voting/rooms/[sessionId]/prepare/page.tsx",
  "/interviews/book": "interviews/book/page.tsx", "/applications/x/decision": "applications/[applicationId]/decision/page.tsx",
  "/q/x": "q/[code]/page.tsx", "/auth/student-claim": "auth/student-claim/page.tsx", "/platform/login": "platform/login/page.tsx",
  "/club/x/interview": "club/[clubId]/interview/page.tsx",
}

test("every focus screen lives in app/(focus), keeps its URL, and has a task name", () => {
  assert.match(fs.readFileSync("app/(focus)/layout.tsx", "utf8"), /<FocusFrame>\{children\}<\/FocusFrame>/)
  for (const [url, file] of Object.entries(moved)) {
    assert.ok(fs.existsSync(path.join("app/(focus)", file)), file)
    assert.ok(!fs.existsSync(path.join("app", file)), `${file} exists only in the (focus) group, so the URL has one page`)
    const route = routes.focusRouteFor(url)
    assert.ok(route?.task, url)
  }
  for (const url of ["/home", "/clubs", "/club/x/workspace", "/applications", "/applications/x", "/platform", "/settings"]) assert.equal(routes.focusRouteFor(url), null, url)
  assert.deepEqual(routes.focusRouteFor("/voting/rooms/x", new URLSearchParams("view=present")), { task: "Presentation", width: "full", theme: "present" })
  assert.equal(routes.focusRouteFor("/voting/rooms/x", new URLSearchParams("view=leader")).theme, undefined, "only the projector is dark")
  assert.equal(fs.readFileSync("app/(focus)/vote/page.tsx", "utf8").trim(), 'export { default } from "@/app/(focus)/live-voting/page"')
})

test("Exit only returns to same-site product pages", () => {
  assert.equal(routes.safeExitHref("/clubs/meetings?x=1#a"), "/clubs/meetings?x=1#a")
  for (const bad of ["https://evil.test/", "//evil.test/x", "/\\evil.test", "javascript:alert(1)", "clubs", "", null, "/check-in", "/club/x/interview?applicationId=a"]) assert.equal(routes.safeExitHref(bad), null, String(bad))
})

test("the frame owns <main>; moved screens drop their full-screen wrappers", () => {
  const screens = [...Object.values(moved).map(file => path.join("app/(focus)", file)), "components/live-voting/room-view.tsx", "components/live-voting/room-setup.tsx", "components/live-voting/slide-preparation.tsx", "components/live-voting/session-join.tsx", "components/qr/meeting-check-in.tsx", "components/communications/decision-letter.tsx", "components/interviews/booking-link-page.tsx", "components/views/interview-workspace-view.tsx", "components/interviews/club-interview-room.tsx"]
  for (const file of screens) assert.doesNotMatch(fs.readFileSync(file, "utf8"), /<main\b|min-h-(svh|dvh|screen)/, file)
  for (const file of ["components/views/leader-dashboard/speed-review-mode.tsx", "components/live-voting/proctor-presentation-view.tsx"]) {
    const source = fs.readFileSync(file, "utf8")
    assert.doesNotMatch(source, /fixed inset-0/, `${file} renders in a FocusFrame instead`)
    assert.match(source, /<FocusFrame [^>]*onExit=/, file)
  }
  assert.doesNotMatch(fs.readFileSync("components/live-voting/room.css", "utf8"), /\.vr-page\{[^}]*(min-height|100dvh)/)
})

test("the projector theme is a dark variant of the same tokens, set only on the presentation route", () => {
  const tokens = fs.readFileSync("styles/tokens.css", "utf8")
  const theme = tokens.slice(tokens.indexOf('[data-theme="present"] {'))
  for (const token of ["--background:", "--foreground:", "--card:", "--border:", "--ring:", "--muted-foreground:"]) assert.ok(theme.includes(token), token)
  const css = fs.readFileSync("components/shell/focus-frame.css", "utf8")
  assert.match(css, /\[data-theme="present"\] \.oc-focus-bar \{ position: fixed;[^}]*opacity: 0;/, "the projector bar overlays the slide")
  assert.match(css, /\[data-theme="present"\] \.oc-focus-bar:is\(:hover, :focus-within\) \{ opacity: 1; \}/, "and appears for pointer or keyboard")
  const markup = require("node:child_process").execFileSync("git", ["ls-files", "app", "components"], { encoding: "utf8" }).split("\n").filter(file => /\.tsx?$/.test(file))
  for (const file of markup) if (file !== "components/shell/focus-frame.tsx" && file !== "components/shell/focus-frame-context.ts") assert.doesNotMatch(fs.readFileSync(file, "utf8"), /data-theme=|theme: "present"|theme="present"/, file)
})

test("the frame renders the mark, club, task, Exit and one main", () => {
  const React = require("react"), { renderToStaticMarkup } = require("react-dom/server")
  const { FocusFrame } = loadComponent("components/shell/focus-frame.tsx")
  const html = renderToStaticMarkup(React.createElement(FocusFrame, { task: "Meeting check-in", club: { name: "Synthetic Club", color: "#123456" }, exitHref: "/clubs" }, React.createElement("p", null, "Body")))
  assert.equal(html.match(/<main\b/g).length, 1)
  assert.match(html, /<header class="oc-focus-bar">/)
  assert.match(html, /alt="OutClass"/)
  assert.match(html, /Synthetic Club/); assert.match(html, /--oc-club-accent:#123456/)
  assert.match(html, /<span class="oc-focus-task">Meeting check-in<\/span>/)
  assert.match(html, /<a class="oc-focus-exit" href="\/clubs">.*Exit<\/a>/)
  const unsafe = renderToStaticMarkup(React.createElement(FocusFrame, { exitHref: "https://evil.test" }, null))
  assert.match(unsafe, /href="\/home"/, "an unsafe exit falls back to /home")
  const overlay = renderToStaticMarkup(React.createElement(FocusFrame, { overlay: true, task: "Speed review", onExit() {} }, null))
  assert.match(overlay, /data-focus-frame="overlay"/); assert.match(overlay, /<button type="button" class="oc-focus-exit">.*Exit<\/button>/)
})

test("the interview room has its own route; old in-workspace room URLs and every producer point to it", () => {
  const workspace = fs.readFileSync("app/club/[clubId]/workspace/page.tsx", "utf8")
  assert.match(workspace, /legacyInterviewRoomHref\(clubId, search\.toString\(\)\)/)
  const room = fs.readFileSync("app/(focus)/club/[clubId]/interview/page.tsx", "utf8")
  for (const rule of [/canAccessDemo/, /getCurrentUser\(\)/, /suspendedAt/, /redirect\(`\/login\?next=/, /getSessionUser\(\)[\s\S]*getCurrentUser\(\)/, /<AuthSessionBoundary><ClubInterviewRoom/]) assert.match(room, rule)
  assert.match(fs.readFileSync("components/interviews/club-interview-room.tsx", "utf8"), /hasPermission\(membership, "applications\.review"\)/)
  const producers = require("node:child_process").spawnSync("git", ["grep", "-l", "interview=1", "--", "app", "components", "lib", "utils", "actions", ":!lib/interview-entry.ts"], { encoding: "utf8" }).stdout.trim()
  assert.equal(producers, "", "only the legacy reader in lib/interview-entry.ts still mentions ?interview=1")
})
