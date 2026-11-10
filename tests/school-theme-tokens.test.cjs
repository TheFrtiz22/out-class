// FE-7: the UVA school layer in styles/tokens.css. Values come from brand.virginia.edu (verified 2026-11-08);
// contrast thresholds follow WCAG 2.2 and UVA's own accessible type-colour combinations.
const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const { execSync } = require("node:child_process")

const tokens = fs.readFileSync("styles/tokens.css", "utf8")
const block = selector => {
  const start = tokens.indexOf(selector + " {")
  assert.ok(start >= 0, `${selector} block exists`)
  return tokens.slice(start, tokens.indexOf("\n}", start))
}
const raw = (css, name) => css.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim()
// School variables resolve against :root, where they are declared.
const value = (css, name) => { const v = raw(css, name); const school = v?.match(/^var\(--(school-[a-z-]+)\)$/); return school ? raw(tokens.slice(tokens.indexOf(":root {")), school[1]) : v }
const luminance = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }

const root = block(":root")
const present = block('[data-theme="present"], .oc-focus-frame:has(.oc-present-surface) .oc-focus-bar')
// Every light surface small text can sit on, tinted ones included (an axe check caught brand-ink on brand-subtle).
const surfaces = Object.fromEntries(["background", "card", "oc-content-soft", "oc-content-soft-blue", "muted", "secondary", "accent", "brand-subtle", "warning-subtle", "info-subtle", "error-subtle", "success-subtle", "interview-subtle"].map(name => [name, value(root, name)]).concat([["white", "#ffffff"]]))
for (const [name, hex] of Object.entries(surfaces)) assert.match(hex, /^#[0-9a-f]{6}$/i, `--${name} is a literal colour`)
const projector = value(present, "background")

// Every school: the UVA defaults in :root plus any [data-school="…"] override block.
const schools = { uva: root }
for (const match of tokens.matchAll(/\[data-school="([^"]+)"\]\s*\{([^}]*)\}/g)) if (!match[0].includes("#...")) schools[match[1]] = match[2]

test("UVA defaults are the official brand values", () => {
  assert.equal(value(root, "school-primary"), "#232d4b", "UVA Blue")
  assert.equal(value(root, "school-accent"), "#e57200", "UVA Orange")
})

for (const [school, css] of Object.entries(schools)) {
  test(`${school}: school colours meet their contrast thresholds on every surface`, () => {
    const primary = value(css, "school-primary"), accent = value(css, "school-accent"), text = value(css, "school-accent-text"), ring = value(css, "school-ring")
    for (const [name, hex] of Object.entries(surfaces)) {
      assert.ok(contrast(primary, hex) >= 4.5, `primary text on ${name}: ${contrast(primary, hex).toFixed(2)}`)
      assert.ok(contrast(text, hex) >= 4.5, `small accent text on ${name}: ${contrast(text, hex).toFixed(2)}`)
      assert.ok(contrast(ring, hex) >= 3, `focus ring on ${name}: ${contrast(ring, hex).toFixed(2)}`)
    }
    assert.ok(contrast(accent, "#ffffff") >= 3, `accent (large text and UI parts) on white: ${contrast(accent, "#ffffff").toFixed(2)}`)
    assert.ok(contrast(ring, primary) >= 3, `focus ring on the primary colour: ${contrast(ring, primary).toFixed(2)}`)
    assert.ok(contrast(ring, projector) >= 3, `focus ring on the projector theme: ${contrast(ring, projector).toFixed(2)}`)
  })
}

test("the on-dark accent reads on UVA Blue and the projector", () => {
  const onDark = value(root, "school-accent-on-dark")
  for (const [name, hex] of [["school primary", value(root, "school-primary")], ["projector", projector]]) assert.ok(contrast(onDark, hex) >= 4.5, `on-dark accent on ${name}: ${contrast(onDark, hex).toFixed(2)}`)
  assert.equal(raw(present, "brand-ink"), "var(--school-accent-on-dark)")
})

test("semantic tokens read the school layer, and every theme uses the one focus ring", () => {
  for (const [token, school] of [["primary", "school-primary"], ["foreground", "school-primary"], ["accent-foreground", "school-primary"], ["brand-orange", "school-accent"], ["brand-ink", "school-accent-text"], ["ring", "school-ring"], ["oc-rail", "school-primary"]])
    assert.equal(raw(root, token), `var(--${school})`, `--${token}`)
  assert.equal(raw(present, "ring"), "var(--school-ring)", "projector ring")
})

test("no stylesheet outside tokens.css hard-codes the brand navy or orange", () => {
  const files = execSync("git ls-files '*.css'", { encoding: "utf8" }).split("\n").filter(file => file && file !== "styles/tokens.css")
  assert.ok(files.length > 20, "the scan sees the stylesheets")
  // Brand values only; club colours, email templates and lib/qr are data, not chrome.
  const brand = /#(142d4e|142d45|1c2d40|232d4b|e8793e|e85b19|e57200|9f3d12|ba501f|a64317|bf6435|ef9d70|f3a16f|f3a274)(?![0-9a-f])|rgba?\(\s*20[ ,]+45[ ,]+(69|78)\b/i
  const offenders = files.filter(file => brand.test(fs.readFileSync(file, "utf8")))
  assert.deepEqual(offenders, [], "use var(--school-…) or the semantic tokens")
})

test("every focus outline uses the one ring (forced-colors system colours excepted)", () => {
  const files = execSync("git ls-files '*.css'", { encoding: "utf8" }).split("\n").filter(file => file && file !== "styles/tokens.css")
  const system = /\b(Highlight|CanvasText|ButtonText|LinkText|Canvas|ButtonFace|transparent|currentColor|inherit|none)\b/
  const offenders = []
  for (const file of files) {
    const css = fs.readFileSync(file, "utf8")
    const forced = [...css.matchAll(/@media\s*\(forced-colors:\s*active\)\s*\{/g)].map(m => { let i = m.index + m[0].length, depth = 1; while (depth) depth += { "{": 1, "}": -1 }[css[i++]] || 0; return [m.index, i] })
    for (const rule of css.matchAll(/([^{}]*:focus[^{}]*)\{([^{}]*)\}/g)) {
      const inForced = forced.some(([a, b]) => rule.index >= a && rule.index < b)
      for (const [, prop, value] of rule[2].matchAll(/(?<![-\w])(outline(?:-color)?)\s*:\s*([^;}]+)/g)) {
        // Windows high contrast: focus must stay on system colours there, never the brand ring.
        if (inForced) { if (!system.test(value)) offenders.push(`${file}: forced-colors ${rule[1].trim().slice(0, 50)} → ${value.trim()}`); continue }
        const colourless = prop === "outline" && value.trim().split(/\s+/).every(part => /^-?[\d.]+(px|rem|em)?$|^(solid|dashed|dotted|double|auto|none|0)$/.test(part))
        if (!colourless && !system.test(value) && !value.includes("var(--ring)")) offenders.push(`${file}: ${rule[1].trim().slice(0, 60)} → ${value.trim()}`)
      }
    }
  }
  assert.deepEqual(offenders, [], "focus outlines use var(--ring)")
})

test("projector theme: text and the ring meet their thresholds on every projector surface", () => {
  const surfacesDark = ["background", "card", "popover", "muted", "secondary", "accent", "oc-content-surface", "oc-content-soft", "oc-content-soft-blue", "brand-subtle", "error-subtle", "success-subtle", "warning-subtle", "info-subtle", "interview-subtle"]
  const ring = value(root, "school-ring")
  for (const name of surfacesDark) {
    const hex = value(present, name)
    assert.match(hex, /^#[0-9a-f]{6}$/i, `projector --${name} is a literal colour`)
    for (const text of ["foreground", "muted-foreground", "brand-ink"]) assert.ok(contrast(value(present, text), hex) >= 4.5, `projector ${text} on ${name}: ${contrast(value(present, text), hex).toFixed(2)}`)
    assert.ok(contrast(ring, hex) >= 3, `ring on projector ${name}: ${contrast(ring, hex).toFixed(2)}`)
  }
})

test("no Tailwind focus utility in source picks a colour other than the ring", () => {
  const files = execSync("git ls-files 'app/*.tsx' 'components/*.tsx' 'app/*.ts' 'components/*.ts' 'lib/*.ts' 'lib/*.tsx'", { encoding: "utf8" }).split("\n").filter(Boolean)
  assert.ok(files.length > 300, "the scan sees the source")
  const offenders = []
  for (const file of files) for (const [utility] of fs.readFileSync(file, "utf8").matchAll(/\b(?:focus|focus-visible|focus-within):(?:outline|ring|border)-(?!offset|hidden|none|0\b|1\b|2\b|4\b|\[\d)[a-z][\w/-]*/g))
    if (!/-(ring)(\/\d+)?$/.test(utility)) offenders.push(`${file}: ${utility}`)
  assert.deepEqual(offenders, [], "use outline-ring / ring-ring / border-ring")
})

test("the interview-kit editor's tabs take their colours from theme tokens, not literals (FE-10)", () => {
  const css = fs.readFileSync("components/clubs/interview-kit-editor.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  assert.deepEqual(css.match(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\(|:\s*(?:white|black)\b/g) ?? [], [], "no literal colours, so the editor follows the school theme and any dark theme")
  assert.match(css, /\[data-slot="tabs-trigger"\] \{[^}]*color: var\(--primary\)/)
  assert.match(css, /\[data-state="active"\] \{ background: var\(--card\); box-shadow: var\(--oc-shadow-surface\); \}/)
})
