const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")

const read = path => fs.readFileSync(path, "utf8")
const tokens = read("styles/product-tokens.css")
const primitives = read("styles/product-components.css")
const home = read("components/views/student-home.css")
const operations = read("components/product/operational-dashboard.css")
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

test("Home and recruiting / club overview consume the shared content material", () => {
  assert.match(home, /\[data-product-shell\] \.oc-home-columns > section \{[^\n]+--oc-content-surface/)
  assert.doesNotMatch(home, /\[data-product-shell\] \.oc-home-columns > section \{[^\n]+background: transparent/)
  assert.match(operations, /\.oc-command-recruiting \.oc-review-console \{[^\n]+--oc-content-radius/)
  assert.match(operations, /\.oc-command-club \.oc-command-context \{[^\n]+--oc-content-radius/)
  assert.match(operations, /\.oc-command-pipeline \{[^\n]+--oc-content-shadow/)
})
