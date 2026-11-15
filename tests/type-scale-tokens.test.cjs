const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")

// FE-9: these stylesheets take font sizes from the type scale in styles/tokens.css (--oc-text-*, --oc-size-*).
// A literal px/rem size is allowed only on a line that says why with a `type-literal-ok:` comment.
const files = ["components/events/events.css", "components/landing/journey-tabs.css", "components/landing/journey.css", "components/product/operational-dashboard.css"]
const literal = /font-size:[^;}]*?(?<![\w.-])\d*\.?\d+(?:px|rem)\b/

test("events, landing journey and operational dashboard CSS use type tokens, not literal font sizes", () => {
  for (const file of files) {
    const offenders = fs.readFileSync(file, "utf8").split("\n")
      .map((line, i) => [i + 1, line])
      .filter(([, line]) => literal.test(line) && !/\/\* type-literal-ok: [^*]+\*\//.test(line))
    assert.deepEqual(offenders.map(([n, line]) => `${file}:${n}: ${line.trim()}`), [], file)
  }
})

test("every type token these files use is defined, including the 13px step", () => {
  const tokens = fs.readFileSync("styles/tokens.css", "utf8")
  assert.match(tokens, /--oc-size-13: 0\.8125rem;/)
  for (const file of files) {
    for (const [declaration] of fs.readFileSync(file, "utf8").matchAll(/font-size:[^;}]*/g)) {
      for (const [, name] of declaration.matchAll(/var\((--oc-(?:text|size)-[\w-]+)\)/g)) {
        assert.match(tokens, new RegExp(`${name}:`), `${file} uses undefined ${name}`)
      }
    }
  }
})

test("the allowlist stays small and explained", () => {
  const allowed = files.flatMap(file => fs.readFileSync(file, "utf8").match(/type-literal-ok: [^*]+/g) ?? [])
  // 7: the flyer thumbnail title (10px inside an 84px preview) joined the thumbnail literals.
  assert.ok(allowed.length <= 7, `${allowed.length} allowed literals`)
})
