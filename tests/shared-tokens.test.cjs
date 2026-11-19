// packages/shared is the single source for design tokens: tokens.json renders styles/tokens.css (web) and
// resolves into the React Native theme (light + dark). The motion port must match lib/spring.ts.
const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")

const root = path.join(__dirname, "..")
const { render, WEB_GROUPS } = require("../packages/shared/scripts/build-web-tokens.cjs")
const tokens = require("../packages/shared/src/tokens/tokens.json")
const css = fs.readFileSync(path.join(root, "styles/tokens.css"), "utf8")

// Loads a TypeScript module (and its relative .ts/.json imports) as CommonJS, the way tests/spring.test.cjs does.
const cache = new Map()
function loadTs(file) {
  const full = path.resolve(root, file)
  if (cache.has(full)) return cache.get(full).exports
  const code = ts.transpileModule(fs.readFileSync(full, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const m = { exports: {} }
  cache.set(full, m)
  const localRequire = id => {
    if (!id.startsWith(".")) return require(id)
    const base = path.resolve(path.dirname(full), id)
    if (id.endsWith(".json")) return require(base)
    return loadTs([base + ".ts", path.join(base, "index.ts")].find(candidate => fs.existsSync(candidate)))
  }
  new Function("module", "exports", "require", code)(m, m.exports, localRequire)
  return m.exports
}
const shared = loadTs("packages/shared/src/index.ts")
const light = shared.resolveTheme("light")
const dark = shared.resolveTheme("dark")

const luminance = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }

// Custom properties declared in the stylesheet, by scope, comments excluded (the school template is a comment).
function declared() {
  const scopes = { root: new Set(), present: new Set(), presentLight: new Set(), supportsSpring: new Set() }
  let scope = null
  for (const [, selector, name] of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(@supports|\[data-theme="present"\]|\[data-theme="present-light"\]|:root \{)|--([a-z0-9-]+):/g)) {
    if (selector === "@supports") scope = "supportsSpring"
    else if (selector === ":root {") scope = scope === "supportsSpring" ? scope : "root"
    else if (selector) scope = selector.includes("present-light") ? "presentLight" : "present"
    else scopes[scope].add(name)
  }
  return scopes
}

test("the generator output is byte-identical to the committed styles/tokens.css", () => {
  assert.equal(render(), css)
})

test("every custom property in the stylesheet is in tokens.json, and every web token is in the stylesheet", () => {
  const scopes = declared()
  const school = tokens.schools[tokens.defaultSchool]
  assert.deepEqual([...scopes.root].sort(), [...Object.keys(tokens.root), ...Object.keys(school)].sort())
  for (const group of WEB_GROUPS.filter(name => name !== "root")) assert.deepEqual([...scopes[group]].sort(), Object.keys(tokens[group]).sort(), group)
  assert.deepEqual(Object.keys(school).sort(), ["school-accent", "school-accent-on-dark", "school-accent-text", "school-primary", "school-ring"])
  for (const name of Object.keys(school)) assert.ok(!(name in tokens.root), `--${name} lives only in the school layer`)
  for (const [id, layer] of Object.entries(tokens.schools)) assert.deepEqual(Object.keys(layer).sort(), Object.keys(school).sort(), `${id} overrides exactly the school layer`)
})

test("a token change reaches both outputs", () => {
  const changed = structuredClone(tokens)
  changed.root.background = "#010203"
  assert.ok(render(changed).includes("--background: #010203;"))
  assert.throws(() => render({ ...tokens, root: { ...tokens.root, "oc-not-in-template": "1px" } }), /never emits/)
  const { background, ...missing } = tokens.root
  assert.throws(() => render({ ...tokens, root: missing }), /does not define/)
})

test("the light theme resolves to the stylesheet's root values", () => {
  assert.equal(light.colors.background, "#f6f5f1")
  assert.equal(light.colors.foreground, "#232d4b")
  assert.equal(light.colors.brandInk, "#a04d00")
  assert.equal(light.colors.ring, "#c86400")
  assert.equal(light.colors.primary, "#232d4b")
  assert.equal(light.colors.overlay, "rgba(12,25,43,0.42)")
  assert.equal(light.colors.voteHeld, "#e57200")
})

test("lengths, type, motion and layers are derived from the raw CSS values", () => {
  assert.deepEqual(light.radius, { sm: 6, md: 10, lg: 16, xl: 22, xl2: 24, full: 999 })
  assert.deepEqual(light.space, { unit: 4, control: 12, content: 20, section: 24 })
  assert.deepEqual(light.text, { caption: 12, small: 14, body: 15, card: 17, modal: 22, metric: 28, section: 20, title: 26 })
  assert.deepEqual(light.duration, { micro: 140, ui: 220, entrance: 360, signature: 900, pressIn: 90 })
  assert.deepEqual(light.press, { scale: 0.98, scaleLarge: 0.99 })
  assert.deepEqual(light.controlHeight, { default: 40, compact: 36, large: 44 })
  assert.deepEqual(light.z, { sticky: 20, overlay: 40, modal: 50, popover: 60, tooltip: 70, toast: 80 })
  assert.deepEqual(light.weights, { regular: 400, medium: 500, semibold: 600, bold: 650, title: 500, display: 500 })
  assert.deepEqual(light.leading, { heading: 1.14, subheading: 1.3, compact: 1.45, body: 1.6, display: 1.15 })
  assert.deepEqual(light.tracking, { heading: -0.03, title: -0.022, section: -0.016, card: -0.01, small: 0, caps: 0.06, display: -0.025 })
  const steps = Object.keys(tokens.root).filter(name => name.startsWith("oc-size-")).map(name => Number(name.slice(8)))
  assert.deepEqual(Object.keys(light.size).map(Number), steps)
  for (const step of steps) assert.equal(light.size[step], step, `--oc-size-${step} is ${step}px`)
  for (const group of ["radius", "space", "size", "text", "weights", "leading", "tracking", "duration", "press", "controlHeight", "z"]) assert.deepEqual(dark[group], light[group], `${group} does not change with the scheme`)
})

test("both themes are fully resolved colours React Native accepts", () => {
  for (const theme of [light, dark]) for (const [name, value] of Object.entries(theme.colors)) {
    assert.ok(!value.includes("var("), `${theme.scheme} ${name} is resolved`)
    assert.match(value, /^(#[0-9a-f]{6}|rgba\(\d{1,3},\d{1,3},\d{1,3},(0|1|0?\.\d+)\))$/, `${theme.scheme} ${name}: ${value}`)
  }
  assert.deepEqual(Object.keys(dark.colors), Object.keys(light.colors))
  assert.deepEqual(shared.schools, ["uva"])
  assert.throws(() => shared.resolveTheme("light", "nowhere"), /Unknown school/)
})

test("the dark theme starts from the projector palette", () => {
  for (const [name, value] of Object.entries(tokens.present)) {
    if (!(name in tokens.dark)) continue // the projector's shadow aliases are not colours
    // The projector's #e07a86 is 4.30:1 on --secondary/--accent; the app theme lightens it to clear 4.5:1 there.
    if (name === "destructive") { assert.equal(tokens.dark[name], "#e4838e"); continue }
    assert.equal(tokens.dark[name], value, `dark --${name} matches the projector theme`)
  }
  assert.equal(dark.colors.background, "#0f1c2b")
  assert.equal(dark.colors.card, "#162638")
  assert.equal(dark.colors.primary, "#f6f5f1")
  assert.equal(dark.colors.primaryForeground, "#232d4b")
  assert.equal(dark.colors.ring, light.colors.ring)
  assert.equal(dark.colors.brandInk, "#f3a274")
  for (const name of Object.keys(tokens.dark)) assert.ok(name in tokens.root, `dark --${name} overrides a root token`)
})

test("dark theme text meets WCAG AA on every dark surface", () => {
  const c = dark.colors
  const surfaces = ["background", "card", "popover", "muted", "secondary", "accent", "contentSoft", "contentSoftBlue", "surfaceBlue", "surfaceSage", "surfaceLilac", "surfaceWarm", "brandSubtle", "errorSubtle", "successSubtle", "warningSubtle", "infoSubtle", "interviewSubtle"]
  const inks = ["foreground", "cardForeground", "popoverForeground", "secondaryForeground", "accentForeground", "mutedForeground", "brandInk", "destructive", "success", "warning", "info", "interview"]
  for (const surface of surfaces) {
    for (const ink of inks) assert.ok(contrast(c[ink], c[surface]) >= 4.5, `${ink} on ${surface}: ${contrast(c[ink], c[surface]).toFixed(2)}`)
    assert.ok(contrast(c.ring, c[surface]) >= 3, `ring on ${surface}: ${contrast(c.ring, c[surface]).toFixed(2)}`)
  }
  // Filled elements: text on its own fill, and the ring against the fill or its cream halo.
  for (const [ink, fill] of [["primaryForeground", "primary"], ["destructiveForeground", "destructive"], ["railText", "rail"], ["railMuted", "rail"], ["railText", "railSelected"]]) assert.ok(contrast(c[ink], c[fill]) >= 4.5, `${ink} on ${fill}: ${contrast(c[ink], c[fill]).toFixed(2)}`)
  assert.ok(contrast(c.ring, c.focusHalo) >= 3)
  // Non-text UI parts: accent, the input outline and the vote segments against the canvas and cards.
  for (const part of ["brandOrange", "input", "votePass", "voteFail", "voteHeld"]) for (const surface of ["background", "card"]) assert.ok(contrast(c[part], c[surface]) >= 3, `${part} on ${surface}: ${contrast(c[part], c[surface]).toFixed(2)}`)
})

test("the dark group is never emitted to the web stylesheet", () => {
  const emitted = new Set(WEB_GROUPS.flatMap(group => Object.values(tokens[group])).concat(Object.values(tokens.schools[tokens.defaultSchool])))
  const darkOnly = [...new Set(Object.values(tokens.dark))].filter(value => !emitted.has(value))
  assert.ok(darkOnly.length > 0, "the dark group adds values of its own")
  for (const value of darkOnly) assert.ok(!css.includes(value), `${value} is not in styles/tokens.css`)
  assert.ok(!/prefers-color-scheme|data-theme="dark"/.test(css))
  const withoutDark = structuredClone(tokens); delete withoutDark.dark
  assert.equal(render(withoutDark), css)
})

test("the native motion port matches lib/spring.ts", () => {
  const web = loadTs("lib/spring.ts")
  for (const velocity of [0, 1, 420, -1000, 2500.5]) {
    assert.equal(shared.project(velocity), web.project(velocity))
    assert.equal(shared.project(velocity, 0.99), web.project(velocity, 0.99))
  }
  for (const [overshoot, dimension, constant] of [[50, 400], [-50, 400], [200, 400, 0.3], [12.5, 812], [80, 0]]) assert.equal(shared.rubberband(overshoot, dimension, constant), web.rubberband(overshoot, dimension, constant))
  for (const response of [0.24, 0.3, 0.35]) {
    assert.equal(shared.springDuration(response), web.springDuration(response))
    assert.equal(shared.bounceDuration(response), web.bounceDuration(response))
  }
  const a = shared.createVelocityTracker(), b = web.createVelocityTracker()
  for (const [value, time] of [[0, 0], [10, 16], [35, 48], [90, 96], [140, 130]]) { a.add(value, time); b.add(value, time) }
  assert.equal(a.velocity(), b.velocity())
  assert.equal(a.velocity(400), 0)
  assert.equal(shared.springDuration(shared.SPRING_RESPONSE.ui), Number.parseInt(tokens.root["oc-spring-ui"]))
})

test("springConfig gives Reanimated the physical constants for a response and damping ratio", () => {
  const ui = shared.springConfig(0.35)
  assert.equal(ui.mass, 1)
  assert.ok(Math.abs(ui.stiffness - (2 * Math.PI / 0.35) ** 2) < 1e-9)
  assert.ok(Math.abs(ui.damping - 2 * Math.sqrt(ui.stiffness)) < 1e-9, "critically damped at ratio 1")
  const thrown = shared.springConfig(0.35, 0.8)
  assert.equal(thrown.stiffness, ui.stiffness)
  assert.ok(Math.abs(thrown.damping / ui.damping - 0.8) < 1e-9)
  assert.ok(shared.springConfig(0.24).stiffness > ui.stiffness, "a shorter response is a stiffer spring")
})
