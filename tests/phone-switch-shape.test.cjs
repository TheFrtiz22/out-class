const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const root = path.join(__dirname, "..")
const phone = fs.readFileSync(path.join(root, "components/shell/responsive-workspace.css"), "utf8")
const base = fs.readFileSync(path.join(root, "styles/interface-primitives.css"), "utf8")

test("the phone 44px button rule does not stretch switches into tall pills", () => {
  const i = phone.indexOf("[data-product-shell] button,")
  assert.ok(i > 0)
  const rest = phone.slice(i)
  assert.match(rest, /\[data-product-shell\][^{]*\) button\[data-slot="switch"\] \{ min-height: 0; \}/)
})

test("switches keep a 44px touch target through their ::after", () => {
  assert.match(base, /\[data-slot="switch"\]::after \{ content: ""; position: absolute; inset: min\(0px, calc\(\(100% - 2\.75rem\) \/ 2\)\); \}/)
})
