// FE-8: one radius scale and three elevation levels (owner decision 2026-11-09: consolidate at the current look).
const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const { execSync } = require("node:child_process")

const tokens = fs.readFileSync("styles/tokens.css", "utf8")
const value = name => tokens.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim()

test("the radius scale is sm 6 / md 10 / lg 16 / xl 22 / 2xl 24 / full, and every other radius token is an alias of it", () => {
  assert.deepEqual(["sm", "md", "lg", "xl", "2xl", "full"].map(step => value(`oc-radius-${step}`)), [".375rem", ".625rem", "1rem", "1.375rem", "1.5rem", "999px"])
  for (const [alias, step] of [["radius", "md"], ["oc-content-radius", "lg"], ["oc-content-radius-small", "lg"], ["oc-editorial-radius", "2xl"], ["oc-overlay-radius", "2xl"]])
    assert.equal(value(alias), `var(--oc-radius-${step})`, `--${alias}`)
})

test("Tailwind rounded-* utilities have one source (the @theme block), pinned to today's values", () => {
  assert.doesNotMatch(fs.readFileSync("tailwind.config.js", "utf8"), /borderRadius/, "no competing borderRadius mapping in tailwind.config.js")
  const theme = fs.readFileSync("app/globals.css", "utf8")
  for (const [utility, step] of [["sm", "sm"], ["md", "md"], ["lg", "lg"], ["xl", "xl"], ["2xl", "xl"], ["3xl", "2xl"]])
    assert.match(theme, new RegExp(`--radius-${utility}: var\\(--oc-radius-${step}\\);`), `rounded-${utility}`)
})

test("three elevation levels; older shadow names are aliases, hover is a state of the surface level", () => {
  assert.equal(value("oc-elevation-surface"), "var(--oc-surface-glass-depth)")
  assert.equal(value("oc-elevation-popover"), "var(--oc-shadow-popover)")
  assert.equal(value("oc-elevation-modal"), "var(--oc-shadow-modal)")
  const levels = [...tokens.matchAll(/--oc-elevation-([a-z-]+):/g)].map(m => m[1]).filter(name => !name.endsWith("-hover"))
  assert.deepEqual([...new Set(levels)].sort(), ["modal", "popover", "surface"])
  assert.equal(value("oc-content-shadow"), "var(--oc-elevation-surface)")
  // Raised controls keep today's 1px contact shadow (not an elevation level; review finding, 2026-11-09).
  assert.match(value("oc-shadow-surface"), /^0 1px 3px /)
  assert.match(value("oc-shadow-surface-hover"), /^0 4px 12px /)
  const config = fs.readFileSync("tailwind.config.js", "utf8")
  for (const level of ["popover", "modal"]) assert.match(config, new RegExp(`${level}: 'var\\(--oc-elevation-${level}\\)'`))
})

test("component CSS uses the scale: no literal radius outside it except documented geometry", () => {
  const files = execSync("git ls-files 'components/*.css' 'components/**/*.css' 'styles/*.css'", { encoding: "utf8" }).split("\n")
    .filter(file => file && file !== "styles/tokens.css" && !file.startsWith("components/shell/") && file !== "styles/navigation-glass.css")
  const literals = []
  for (const file of files) for (const m of fs.readFileSync(file, "utf8").matchAll(/(?<![-\w])border(?:-(?:top|bottom)-(?:left|right))?-radius:\s*([^;}]+)/g))
  {
    let v = m[1].replace(/!important/g, "")
    while (/(var|calc)\([^()]*\)/.test(v)) v = v.replace(/(var|calc)\([^()]*\)/g, "")
    for (const part of v.trim().split(/\s+/).filter(Boolean))
      if (!/^(0|inherit|50%|100%|initial|unset)$/.test(part)) literals.push(`${file}: ${part}`)
  }
  // Navigation (components/shell, styles/navigation-glass.css) owns its optics and is out of scope. The one
  // documented exception: the public nav bar's 34px capsule radius, which must stay 34px when the open menu
  // makes the bar taller (a full radius would turn it into an oval).
  assert.deepEqual(literals, ["components/landing/public-navigation.css: 34px", "components/landing/public-navigation.css: 34px"])
})

test("browser: the projector theme resolves every surface-shadow alias to the solid level, the app to the glass depth", async () => {
  const { chromium } = require("playwright")
  const css = ["styles/navigation-glass.css", "styles/tokens.css"].map(file => fs.readFileSync(file, "utf8")).join("\n")
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(chromium.executablePath()) ? {} : { channel: "chrome" }) })
  try {
    const page = await browser.newPage()
    await page.setContent(`<style>${css}</style><div id="app"></div><div data-theme="present"><div id="projector"></div></div>`)
    const read = id => page.evaluate(id => { const s = getComputedStyle(document.getElementById(id)); return ["--oc-elevation-surface", "--oc-content-shadow", "--oc-shadow-surface", "--oc-content-shadow-solid", "--oc-surface-glass-depth"].map(name => s.getPropertyValue(name).trim()) }, id)
    const [app, projector] = [await read("app"), await read("projector")]
    assert.ok(app[0] && app[0] === app[1], "app: the surface level and --oc-content-shadow agree")
    assert.equal(app[0], app[4], "app: the surface level is the glass depth")
    assert.deepEqual(projector.slice(0, 2), [projector[3], projector[3]], "projector: the level and --oc-content-shadow are the solid shadow")
    assert.match(app[2], /^0 1px 3px/, "raised controls keep the hairline")
    await page.emulateMedia({ forcedColors: "active" })
    const forced = await read("app")
    assert.equal(forced[0], forced[4], "forced colours: the surface level follows the glass depth override")
    assert.match(forced[2], /^0 1px 3px/, "forced colours: raised controls keep their hairline cue")
  } finally { await browser.close() }
})

test("every --oc-* custom property used without a fallback is defined somewhere (removed tokens leave no dangling var())", () => {
  const files = execSync("git ls-files '*.css' '*.tsx' '*.ts'", { encoding: "utf8" }).split("\n").filter(file => file && !file.startsWith("tests/"))
  const defined = new Set(), used = new Map()
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8")
    for (const m of source.matchAll(/(--oc-[a-z0-9-]+)\s*:/g)) defined.add(m[1])
    for (const m of source.matchAll(/["'`{,\s](--oc-[a-z0-9-]+)["'`]\s*:/g)) defined.add(m[1])
    for (const m of source.matchAll(/var\(\s*(--oc-[a-z0-9-]+)\s*\)/g)) if (!used.has(m[1])) used.set(m[1], file)
  }
  assert.deepEqual([...used].filter(([name]) => !defined.has(name)).map(([name, file]) => `${name} (${file})`), [])
})
