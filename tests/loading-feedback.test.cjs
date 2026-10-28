const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")

const css = fs.readFileSync("styles/loading.css", "utf8")
const component = fs.readFileSync("components/outclass-loading-screen.tsx", "utf8")

test("full-destination loading continues moving instead of stopping after its entrance", () => {
  assert.match(component, /role="status" aria-busy="true"/)
  assert.match(component, /Loading OutClass/)
  assert.match(component, /className="oc-loading-line" aria-hidden="true"/)
  assert.match(css, /\.oc-loading-mark\s*\{[^}]*animation:\s*oc-loading-mark-breathe\s+2100ms\s+ease-in-out\s+infinite/s)
  assert.match(css, /\.oc-loading-line::after\s*\{[^}]*animation:\s*oc-loading-sweep\s+1300ms\s+[^;]+\s+infinite/s)
  assert.doesNotMatch(css, /oc-loading-line-reveal|oc-loading-resolve/)
})

test("indeterminate motion uses compositor-friendly transforms rather than layout animations", () => {
  const sweep = css.match(/@keyframes oc-loading-sweep\s*\{([\s\S]*?)\n\}/)?.[1] ?? ""
  const breathe = css.match(/@keyframes oc-loading-mark-breathe\s*\{([\s\S]*?)\n\}/)?.[1] ?? ""
  assert.match(sweep, /translate3d\(/)
  assert.match(breathe, /translate3d\(/)
  assert.doesNotMatch(sweep + breathe, /(?:width|height|left|top|filter|box-shadow)\s*:/)
  assert.match(css, /\.oc-loading-line\s*\{[^}]*contain:\s*paint/s)
})

test("reduced-motion users receive an always-visible static loading indicator", () => {
  const rule = css.split("@media (prefers-reduced-motion: reduce)")[1] ?? ""
  assert.match(rule, /\.oc-loading-mark,\s*\.oc-loading-line::after,[\s\S]*?animation:\s*none/)
  assert.match(rule, /\.oc-loading-line::after\s*\{\s*transform:\s*translate3d\(/)
  assert.match(css, /\.oc-loading-caption\s*\{/)
})
