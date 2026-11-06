const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")

const read = path => fs.readFileSync(path, "utf8")
const tokens = read("styles/tokens.css")
const primitives = read("styles/product-components.css")
const home = read("components/views/student-home.css")
const operations = read("components/product/operational-dashboard.css")
const applications = read("components/applications/application-tracker.css")
const navigation = read("styles/navigation-glass.css")

test("authenticated surfaces share a restrained material vocabulary distinct from navigation", () => {
  for (const token of ["--oc-content-surface:", "--oc-content-soft:", "--oc-content-edge:", "--oc-content-radius:", "--oc-content-padding:", "--oc-content-shadow:", "--oc-content-motion:"]) {
    assert.ok(tokens.includes(token), token)
  }
  assert.match(primitives, /\[data-product-shell\] \[data-slot="card"\][^\n]+--oc-content-radius/)
  assert.match(primitives, /\.oc-metric-strip > div \{[^\n]+--oc-content-surface/)
  assert.match(primitives, /\.oc-segmented-control \{[^\n]+border-radius: 999px/)
  assert.match(navigation, /--oc-glass-light-material/)
  assert.doesNotMatch(tokens, /backdrop-filter\s*:/, "scrolling content tokens must not add glass blur")
})

test("editorial overview compositions use shared tokens without imposing identical cards", () => {
  const editorial = read("styles/editorial.css")
  assert.match(home, /gap: 2rem var\(--oc-editorial-gap\)/)
  assert.match(home, /\.oc-home-agenda \{[^\n]+var\(--oc-surface-blue\)/)
  assert.match(editorial, /\.oc-featured-action \{[\s\S]*?background: var\(--oc-rail\)/)
  assert.match(operations, /\.oc-pipeline-section \{[^\n]+var\(--oc-editorial-radius\)/)
  assert.match(operations, /\.oc-command-club \.oc-command-context \{[^\n]+border-bottom: 1px solid var\(--command-line\)/)
  assert.doesNotMatch(home + editorial, /backdrop-filter\s*:/, "editorial content must not compete with optical navigation")
})

test("application drafts, statuses and writing questions inherit the same calm surfaces", () => {
  assert.match(applications, /\.oc-application-management-row \{[^\n]+--oc-content-radius/)
  assert.match(applications, /\.oc-status-card \{[^\n]+--oc-content-radius/)
  assert.match(applications, /\.oc-writing-question \{[^\n]+--oc-content-radius/)
  assert.doesNotMatch(applications, /\.oc-application-row:hover \{[^\n]+translateY/)
})

test("OutClass has exactly one palette: tokens.css :root, with no scoped override", () => {
  const { execFileSync } = require("node:child_process")
  assert.ok(!fs.existsSync("styles/product-tokens.css"), "product-tokens.css was merged into tokens.css")
  assert.doesNotMatch(read("app/globals.css"), /product-tokens/)
  // The palette is :root. The only other block is the projector's dark variant, which redefines colors only.
  const [palette, ...themes] = tokens.split(/^\[data-theme="present"\] \{$/m)
  assert.equal(themes.length, 1, "one projector theme block")
  assert.doesNotMatch(themes[0], /--oc-(rail|surface|shell|content-width|reading-width|font|text|space)/, "the projector theme changes colors, not geometry or type")
  for (const token of ["--background:", "--primary:", "--ring:", "--oc-rail:", "--oc-surface-blue:", "--oc-shell-rail-width:"]) {
    assert.equal(palette.split(token).length - 1, 1, `${token} is declared once in :root`)
  }
  const css = execFileSync("git", ["ls-files", "*.css"], { encoding: "utf8" }).split("\n").filter(Boolean)
  for (const file of css) assert.doesNotMatch(read(file), /data-workspace-detail|data-outclass-design/, file)
  const markup = execFileSync("git", ["ls-files", "app", "components"], { encoding: "utf8" }).split("\n").filter(file => file.endsWith(".tsx"))
  for (const file of markup) assert.doesNotMatch(read(file), /data-workspace-detail|data-outclass-design/, file)
})

test("rules that used the removed attributes still have a hook in the markup", () => {
  const css = file => read(file)
  // Interview room: same specificity as the old attribute selector, and its main still carries the class.
  assert.match(css("components/views/interview/interview-mode.css"), /^\.oc-interview-room\.oc-interview-room \.oc-focused-interview \{/m)
  assert.doesNotMatch(css("components/views/interview/interview-mode.css"), /^\.oc-interview-room \.oc-/m)
  assert.match(css("styles/product-workflows.css"), /^\.oc-interview-room \.oc-focused-interview > header \{/m)
  // The focus frame owns <main>; the interview room is its content.
  assert.match(read("components/views/interview-workspace-view.tsx"), /<div className="oc-interview-room\b/)
  assert.match(read("components/shell/focus-frame.tsx"), /<main id="focus-content"/)
  assert.match(read("components/interview-kit-session.tsx"), /className="oc-focused-interview\b/)
  // Mobile inputs/touch targets and checkbox hit areas: every main, the voting pad's role="main", and the projector stage.
  const scope = ':is(main, [role="main"], .oc-voting-stage'
  assert.ok(css("components/shell/responsive-workspace.css").includes(`${scope}) button`))
  assert.ok(css("styles/interface-primitives.css").includes(`${scope}, .oc-workspace-drawer) button[data-slot="checkbox"]`))
  assert.match(read("components/live-voting/member-voting-pad.tsx"), /role=\{embedded \? "group" : "main"\}/)
  assert.match(read("components/live-voting/proctor-presentation-view.tsx"), /className="oc-voting-stage\b/)
  // The embedded pad renders only inside the projector stage, which the scope covers.
  assert.match(read("components/live-voting/proctor-presentation-view.tsx"), /<MemberVotingPad [^>]*embedded/)
  // Dialog titles and status badges apply on every page now that there is one palette.
  assert.match(primitives, /^:root :is\(\[data-slot="dialog-title"\], \[data-slot="sheet-title"\]\) \{/m)
  for (const status of ["ACCEPTED", "REJECTED", "WAITLISTED", "IN_REVIEW", "INTERVIEWING"]) {
    assert.match(primitives, new RegExp(`^:root \\[data-slot="badge"\\]\\[data-status-code="${status}"\\] \\{ --badge-accent: var\\(--`, "m"), status)
  }
  assert.doesNotMatch(read("styles/product-components.css") + read("styles/tokens.css"), /:root:has\(/)
})

test("focus and selection outlines on light public surfaces use --ring (WCAG 1.4.11 ≥ 3:1)", () => {
  for (const [file, selector] of [
    ["components/auth/login.css", ".oc-login :is(button, a):focus-visible"],
    ["components/landing/journey.css", ".oc-landing .oc-perspective-switcher button:focus-visible"],
    ["components/landing/public-navigation.css", ".oc-landing .oc-public-nav .oc-perspective-switcher button:focus-visible"],
    ["styles/product-workflows.css", '.oc-voting-pad button[aria-pressed="true"]'],
    ["styles/product-workflows.css", '[data-product-shell] .ir-calendar button[aria-pressed="true"]'],
  ]) {
    const rule = read(file).split("\n").find(line => line.startsWith(selector))
    assert.ok(rule, `${file}: ${selector}`)
    assert.match(rule, /outline[a-z-]*: [^;]*var\(--ring\)/, selector)
    assert.doesNotMatch(rule, /outline[a-z-]*: [^;]*var\(--brand-orange\)/, selector)
  }
  // Inherited mid-word wrapping stays on product surfaces, not every <main>.
  const wrap = read("components/shell/responsive-workspace.css").split("\n").find(line => line.includes("overflow-wrap: anywhere") && line.includes("min-width: 0"))
  assert.ok(wrap.startsWith(":is([data-product-shell] main, .oc-interview-room, .oc-voting-pad, .oc-voting-stage)"), wrap)
})
