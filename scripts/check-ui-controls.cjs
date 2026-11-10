#!/usr/bin/env node
/* UI control guard (part of `pnpm run lint`). Fails when a page hand-builds a control the primitives own,
   or adds glass-breaking literals to page CSS. Exceptions live in scripts/ui-controls-allowlist.json, each
   with a reason; a file may not exceed its allowlisted count for a rule.

   Rules
   - native-select   a native <select> outside components/ui (use NativeSelect or Select)
   - raw-toggle      a raw <button> with aria-pressed (use SegmentedControl, or Button for one toggle)
   - toggle-group    aria-pressed Buttons generated in a .map( or placed side by side (use SegmentedControl)
   - raw-button      a raw <button> styled as a button, link or chip (use Button / IconButton); raw buttons
                     are for whole-surface targets (rows, cards, cells) styled by an oc-* class
   - css-hex | css-shadow | css-radius   literals in page or dashboard CSS where a token belongs
                     (styles/navigation-glass.css). Dashboard CSS allows none.

   Usage: node scripts/check-ui-controls.cjs [--report]   (--report prints counts and never fails) */
const fs = require("node:fs"), path = require("node:path")
const repo = path.resolve(__dirname, "..")
const allowlist = JSON.parse(fs.readFileSync(path.join(__dirname, "ui-controls-allowlist.json"), "utf8"))
const report = process.argv.includes("--report")

function walk(dir, ext, out = []) {
  for (const entry of fs.readdirSync(path.join(repo, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, entry.name)
    if (entry.isDirectory()) { if (entry.name !== "node_modules" && !entry.name.startsWith(".")) walk(rel, ext, out) }
    else if (ext.some(e => entry.name.endsWith(e))) out.push(rel)
  }
  return out
}
const lineOf = (src, index) => src.slice(0, index).split("\n").length
/** The opening tag starting at `index` (balances braces so `>` inside expressions is skipped). */
function openingTag(src, index) {
  let depth = 0
  for (let i = index; i < Math.min(src.length, index + 4000); i++) {
    const c = src[i]
    if (c === "{") depth++
    else if (c === "}") depth--
    else if (c === ">" && depth === 0) return src.slice(index, i + 1)
  }
  return src.slice(index, index + 400)
}
const buttonLike = /(?:^|[\s"'`{])(?:[a-z-]+:)*(?:rounded(?:-[\w[\]./-]+)?|border(?:-[\w[\]./-]+)?|bg-[\w[\]./-]+|px-[\w[\].-]+|py-[\w[\].-]+|underline|inline-flex)(?=[\s"'`}]|$)|oc-[\w-]*(?:button|btn|link|chip|pill)\b/

const findings = []
const add = (rule, file, line, text) => findings.push({ rule, file, line, text: text.replace(/\s+/g, " ").slice(0, 120) })

for (const file of [...walk("components", [".tsx"]), ...walk("app", [".tsx"])]) {
  if (file.startsWith("components/ui/")) continue
  const src = fs.readFileSync(path.join(repo, file), "utf8")
  for (const m of src.matchAll(/<select\b/g)) add("native-select", file, lineOf(src, m.index), openingTag(src, m.index))
  for (const m of src.matchAll(/<button\b/g)) {
    const tag = openingTag(src, m.index)
    if (/aria-pressed/.test(tag)) add("raw-toggle", file, lineOf(src, m.index), tag)
    else if (buttonLike.test((tag.match(/className=(?:"[^"]*"|\{[\s\S]*?\}(?=\s|>|\/))/) || [""])[0])) add("raw-button", file, lineOf(src, m.index), tag)
  }
  const pressed = [...src.matchAll(/<Button\b/g)].map(m => ({ index: m.index, tag: openingTag(src, m.index) })).filter(b => /aria-pressed/.test(b.tag))
  for (const [i, b] of pressed.entries()) {
    const before = src.slice(Math.max(0, b.index - 160), b.index)
    const near = pressed.some((other, j) => j !== i && Math.abs(other.index - b.index) < 600)
    if (/\.map\(/.test(before) || near) add("toggle-group", file, lineOf(src, b.index), b.tag)
  }
}

/* Page and dashboard CSS: component stylesheets. styles/ holds the tokens and primitives; navigation
   (components/shell) is fixed and owns its optics. */
const dashboardCss = new Set(["components/product/dashboard/dashboard.css", "components/club-home/club-home.css", "components/views/student-home.css", "components/product/operational-dashboard.css"])
for (const file of walk("components", [".css"])) {
  if (file.startsWith("components/shell/")) continue
  const src = fs.readFileSync(path.join(repo, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "))
  for (const m of src.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) add("css-hex", file, lineOf(src, m.index), m[0])
  for (const m of src.matchAll(/box-shadow\s*:\s*([^;}]+)/g)) if (!/^\s*(?:none|inherit|initial|unset)\s*$/.test(m[1]) && /\d+px|rgb|hsl|#/.test(m[1].replace(/var\([^)]*\)/g, ""))) add("css-shadow", file, lineOf(src, m.index), m[0])
  for (const m of src.matchAll(/border(?:-(?:top|bottom|start|end)-(?:left|right|start|end))?-radius\s*:\s*([^;}]+)/g)) if (!/^\s*(?:0|inherit|initial|unset|999px|50%|9999px|100%)\s*$/.test(m[1].replace(/var\([^)]*\)/g, "0").replace(/\s+/g, " ").trim()) && !/^(?:0\s*)+$/.test(m[1].replace(/var\([^)]*\)/g, "0").trim())) add("css-radius", file, lineOf(src, m.index), m[0])
}

const counts = new Map()
for (const f of findings) counts.set(`${f.rule} ${f.file}`, (counts.get(`${f.rule} ${f.file}`) || 0) + 1)
const allowed = new Map(allowlist.entries.map(e => [`${e.rule} ${e.file}`, e]))
const failures = [], stale = []
for (const [key, count] of counts) {
  const [rule, file] = key.split(" ")
  const entry = allowed.get(key), max = dashboardCss.has(file) ? 0 : entry?.max ?? 0
  if (count > max) failures.push({ rule, file, count, max, examples: findings.filter(f => f.rule === rule && f.file === file).slice(0, 3) })
}
for (const [key, entry] of allowed) if ((counts.get(key) || 0) < entry.max) stale.push(`${key} (allowlisted ${entry.max}, found ${counts.get(key) || 0})`)

const totals = {}
for (const f of findings) totals[f.rule] = (totals[f.rule] || 0) + 1
if (report) { console.log(JSON.stringify({ totals, files: Object.fromEntries([...counts].sort()) }, null, 1)); process.exit(0) }
if (stale.length) console.log(`ui-controls: allowlist can shrink:\n  ${stale.join("\n  ")}`)
if (failures.length) {
  console.error(`ui-controls: ${failures.length} file/rule pair(s) exceed the allowlist (scripts/ui-controls-allowlist.json):`)
  for (const f of failures) {
    console.error(`  ${f.rule}  ${f.file}  found ${f.count}, allowed ${f.max}`)
    for (const e of f.examples) console.error(`    ${f.file}:${e.line}  ${e.text}`)
  }
  console.error("Use the primitives in components/ui (Button, IconButton, SegmentedControl, NativeSelect) and the tokens in styles/navigation-glass.css, or add a justified allowlist entry.")
  process.exit(1)
}
console.log(`ui-controls: OK (${Object.entries(totals).map(([r, n]) => `${r} ${n}`).join(", ") || "no findings"}, all allowlisted)`)
