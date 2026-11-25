const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")

test("the Inbox settings gear stays on the title row instead of wrapping onto its own row", () => {
  const css = fs.readFileSync("styles/product-components.css", "utf8")
  const rule = css.match(/\.oc-notifications-header\s*\{([^}]*)\}/)
  assert.ok(rule, "the Inbox header has its own layout rule")
  assert.match(rule[1], /flex-wrap:\s*nowrap/)
  assert.match(rule[1], /align-items:\s*flex-start/)
})
