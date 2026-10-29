const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")

const read = path => fs.readFileSync(path, "utf8")
const tokens = read("styles/tokens.css") + read("styles/product-tokens.css")
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
