const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")

const css = fs.readFileSync("components/landing/landing-moments.css", "utf8")
const tsx = fs.readFileSync("components/landing/landing-moments.tsx", "utf8")

function content() {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync("components/landing/landing-sections-content.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function("require", "module", "exports", code)(() => ({}), mod, mod.exports)
  return mod.exports
}

test("the features section is an editorial ledger, not a 3-column card grid", () => {
  // The only repeat() grids left belong to the ruled season timeline; no ledger rule tiles cards.
  const repeatRules = [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{[^{}]*repeat\(/g)].map(match => match[1].trim())
  assert.ok(repeatRules.length > 0 && repeatRules.every(selector => selector === ".oc-season"), `repeat() grids only on the timeline: ${repeatRules}`)
  assert.doesNotMatch(css, /\.oc-ledger[^{]*\{[^}]*repeat\(/, "the ledger is not a repeated card grid")
  assert.doesNotMatch(css, /\.oc-features?\b/, "the old feature-card classes are gone")
  assert.doesNotMatch(tsx, /oc-features?\b/)
  assert.match(css, /\.oc-ledger-row\s*\{[^}]*grid-template-columns:\s*minmax\(0, 5fr\) minmax\(0, 6fr\)/, "copy and product fragment share a row")
  assert.match(css, /\.oc-ledger-row:nth-child\(even\)\s*\{[^}]*grid-template-areas:\s*"specimen copy"/, "rows alternate sides")
  assert.match(css, /@media \(max-width: 700px\)\s*\{[^}]*grid-template-areas:\s*"copy" "specimen"/, "rows stack on phones")
  assert.match(tsx, /<ol className="oc-ledger">/)
  assert.match(tsx, /<h3>\{feature\.title\}<\/h3>/)
})

test("each feature is paired with real product UI and a text alternative", () => {
  assert.match(tsx, /import \{ StatusMark \} from "@\/components\/ui\/status-pill"/, "fragments reuse the product's status component")
  assert.match(tsx, /className="oc-ledger-specimen" role="img" aria-label=\{description\}/)
  const { featureGrid } = content()
  for (const perspective of ["leader", "student"]) {
    const features = featureGrid[perspective].features
    assert.equal(features.length, 6)
    for (const feature of features) {
      assert.ok(feature.title && feature.body, "copy kept")
      assert.ok(feature.specimen.label && feature.specimen.rows.length >= 2, `${feature.title} has a product fragment`)
    }
  }
  assert.deepEqual(featureGrid.leader.features.map(f => f.title), ["Shared rubrics", "Interview rooms and panels", "Focused interview room", "Live voting", "Meetings and attendance", "Roles and access"])
  assert.deepEqual(featureGrid.student.features.map(f => f.title), ["One profile", "Club-specific questions", "Book your interview", "Status in one place", "Follow clubs", "My Clubs"])
})

test("moments avoid generated-page tells: glass cards, hover on static content, uniform radius", () => {
  assert.doesNotMatch(css, /:hover/, "nothing in this section is interactive, so nothing hovers")
  assert.doesNotMatch(css, /box-shadow|radial-gradient/)
  assert.doesNotMatch(tsx, /oc-season-step oc-public-glass/, "the season timeline is ruled, not six glass cards")
  assert.equal((tsx.match(/oc-public-glass/g) ?? []).length, 1, "only the decision screen frame keeps glass")
  assert.match(css, /\.oc-season-step\s*\{[^}]*border-top:/)
  assert.match(css, /\.oc-ledger-specimen\s*\{[^}]*border-radius: var\(--oc-radius-lg\)/, "fragments use the panel radius, not the soft card radius")
  assert.doesNotMatch(tsx, /Sparkle|Check(?:Circle)?\b/, "no sparkle icons or checkmark bullets")
})
