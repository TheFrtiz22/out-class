const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

// Readable text respects the browser/OS text-size setting: font sizes are rem or type tokens, never px,
// and nothing readable is below 12px (0.75rem). A line may opt out only with a `type-literal-ok:` comment
// (flyer thumbnails, SVG seal artwork). The live voting room is projector-tuned and sized separately.
// Email HTML (lib/transactional-email.ts) and share-card images render outside the browser's text setting.
const roots = ["app", "components", "lib", "styles"]
const skip = [/^components\/live-voting\//, /^lib\/transactional-email\.ts$/, /^lib\/(club-)?share-card\.tsx$/]
const allowed = /\/\*\s*type-literal-ok: [^*]+\*\//

function files(dir, ext) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.posix.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : files(file, ext)
    return ext.test(entry.name) && !skip.some(pattern => pattern.test(file)) ? [file] : []
  })
}
const css = roots.flatMap(dir => files(dir, /\.css$/))
const tsx = roots.flatMap(dir => files(dir, /\.tsx$/))
const tokens = fs.readFileSync("styles/tokens.css", "utf8")
const tokenPx = name => {
  const value = tokens.match(new RegExp(`${name}:\\s*([\\d.]+)rem;`))?.[1]
  return value ? Number(value) * 16 : undefined
}
const px = value => {
  value = value.trim()
  const token = value.match(/^var\((--oc-(?:size|text)-[\w-]+)\)$/)
  if (token) return tokenPx(token[1])
  const literal = value.match(/^(\d*\.?\d+)(px|rem)$/)
  return literal ? Number(literal[1]) * (literal[2] === "rem" ? 16 : 1) : undefined
}
function lines(file, fn) {
  return fs.readFileSync(file, "utf8").split("\n").flatMap((line, i) => allowed.test(line) ? [] : fn(line).map(problem => `${file}:${i + 1}: ${problem}`))
}

test("CSS font sizes are rem or tokens, not px", () => {
  const offenders = css.flatMap(file => lines(file, line => [...line.matchAll(/font-size:\s*([^;}]+)/g)]
    .filter(([, value]) => /(?<![\w.-])\d*\.?\d+px\b/.test(value)).map(([declaration]) => declaration.trim())))
  assert.deepEqual(offenders, [])
})

test("no CSS font size below 12px, including clamp() minimums", () => {
  const offenders = css.flatMap(file => lines(file, line => [...line.matchAll(/font-size:\s*([^;}]+)/g)].filter(([, value]) => {
    const size = px(value.replace(/\s*!important$/, ""))
    const floor = value.match(/^\s*clamp\(\s*([^,]+),/)?.[1]
    return (size !== undefined && size < 12) || (floor !== undefined && px(floor) !== undefined && px(floor) < 12)
  }).map(([declaration]) => declaration.trim())))
  assert.deepEqual(offenders, [])
})

test("Tailwind classes use no px font sizes and nothing below 12px", () => {
  const offenders = tsx.flatMap(file => lines(file, line => [...line.matchAll(/\btext-\[(?:length:)?([^\]]+)\]/g)].filter(([, value]) => {
    if (/^\d*\.?\d+px$/.test(value)) return true
    const size = px(value)
    return size !== undefined && size < 12
  }).map(([match]) => match)))
  assert.deepEqual(offenders, [])
})

test("errors, helper text and control labels have a 13px step; the sign-in error is 14px", () => {
  assert.match(tokens, /--oc-size-13: 0\.8125rem;/)
  assert.match(fs.readFileSync("app/globals.css", "utf8"), /--text-control: var\(--oc-size-13\);/)
  const login = fs.readFileSync("components/auth/login.css", "utf8")
  assert.match(login, /\.oc-login-error \{[^}]*font-size: var\(--oc-size-14\)/)
  assert.match(login, /\.oc-login-hint \{[^}]*font-size: var\(--oc-size-13\)/)
  const smallErrors = tsx.flatMap(file => lines(file, line => [...line.matchAll(/className="([^"]*)"/g)]
    .filter(([, value]) => /(?<![\w-])text-xs\b/.test(value) && /(?<![\w:-])(text-destructive|text-red-\d+)\b/.test(value)).map(([match]) => match)))
  assert.deepEqual(smallErrors, [], "error text uses text-control (13px), not text-xs")
})

test("the allowlist stays small and explained", () => {
  const literals = [...css, ...tsx].flatMap(file => fs.readFileSync(file, "utf8").match(/type-literal-ok: [^*]+/g) ?? [])
  assert.ok(literals.length <= 9, `${literals.length} allowed literals`)
})
