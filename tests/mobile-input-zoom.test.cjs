const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

// iOS Safari zooms the page when a focused text control is under 16px. On phones every
// text input, textarea and select must therefore compute to at least 16px.
const MOBILE_MAX = 767
const SKIP_DIRS = new Set(["components/live-voting", "node_modules", ".next"])

function cssFiles(dir, out = []) {
  if (SKIP_DIRS.has(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.posix.join(dir, entry.name)
    if (entry.isDirectory()) cssFiles(full, out)
    else if (entry.name.endsWith(".css")) out.push(full)
  }
  return out
}

/** Flat list of { selector, body, context: [at-rule preludes] } for a stylesheet. */
function rules(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, "")
  const out = [], stack = []
  let buffer = ""
  for (const ch of css) {
    if (ch === "{") { stack.push(buffer.trim()); buffer = "" }
    else if (ch === "}") {
      const prelude = stack.pop()
      if (prelude !== undefined && !prelude.startsWith("@") && buffer.trim()) out.push({ selector: prelude, body: buffer, context: stack.filter(s => s.startsWith("@")) })
      buffer = ""
    } else if (ch === ";" && stack.length && stack[stack.length - 1].startsWith("@") && !buffer.includes("{")) buffer = ""
    else buffer += ch
  }
  return out
}

const tokens = Object.fromEntries([...fs.readFileSync("styles/tokens.css", "utf8").matchAll(/(--oc-(?:text|size)-[\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]))
function px(value) {
  value = value.replace(/!important/, "").trim()
  for (let i = 0; i < 4; i++) value = value.replace(/var\((--[\w-]+)\)/g, (_, name) => tokens[name] ?? "NaN")
  const one = v => { const m = v.trim().match(/^([\d.]+)(px|rem)$/); return m ? +m[1] * (m[2] === "rem" ? 16 : 1) : NaN }
  const max = value.match(/^max\((.*)\)$/)
  if (max) return Math.max(...max[1].split(",").map(one))
  return one(value)
}
// Element selectors, plus class names that name a control (".ir-select", ".oc-range-slider-input").
const isTextControl = selector => (/(^|[\s>+~(,])(input|textarea|select)(?![\w-])/.test(selector) || /\.[\w-]+-(select|input|textarea)(?![\w-])/.test(selector)) && !/\[type="?(checkbox|radio|range|color|file)/.test(selector)
const isMobile = context => context.some(c => { const m = c.match(/max-width:\s*(\d+)px/); return m && +m[1] >= MOBILE_MAX })
const isLayered = context => context.some(c => c.startsWith("@layer"))

test("the mobile form-control floor is at least 16px and loses to more specific sizes", () => {
  const globals = rules(fs.readFileSync("app/globals.css", "utf8"))
  const floor = globals.find(r => isMobile(r.context) && !isLayered(r.context) && /:where\(input/.test(r.selector) && /font-size/.test(r.body))
  assert.ok(floor, "app/globals.css keeps an unlayered mobile font-size floor for text controls")
  assert.ok(px(floor.body.match(/font-size:\s*([^;]+)/)[1]) >= 16)
})

test("no unlayered stylesheet sets a text control below 16px on phones", () => {
  const failures = []
  for (const file of cssFiles("app").concat(cssFiles("components"), cssFiles("styles"))) {
    const all = rules(fs.readFileSync(file, "utf8"))
    for (const rule of all) {
      if (isLayered(rule.context) || rule.context.some(c => /min-width|hover|pointer: fine|print/.test(c))) continue
      const size = rule.body.match(/font-size:\s*([^;]+)/)
      if (!size || !isTextControl(rule.selector) || px(size[1]) >= 16 || Number.isNaN(px(size[1]))) continue
      if (isMobile(rule.context)) { failures.push(`${file}: ${rule.selector} (${size[1].trim()} on mobile)`); continue }
      const parts = rule.selector.split(",").map(s => s.trim()).filter(isTextControl)
      const covered = parts.every(part => all.some(o => isMobile(o.context) && !isLayered(o.context) && o.selector.split(",").map(s => s.trim()).includes(part) && px((o.body.match(/font-size:\s*([^;]+)/) || [])[1] || "") >= 16))
      if (!covered) failures.push(`${file}: ${rule.selector} (${size[1].trim()})`)
    }
  }
  assert.deepEqual(failures, [], `Add a mobile (max-width: ${MOBILE_MAX}px) override of at least 16px:\n${failures.join("\n")}`)
})
