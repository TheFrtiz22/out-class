const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")

function load(file, mocks) {
  const mod = { exports: {} }
  const out = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function("require", "module", "exports", out)(name => {
    if (name in mocks) return mocks[name]
    if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "Fragment" }
    return new Proxy({}, { get: (_, key) => key === "__esModule" ? false : String(key) })
  }, mod, mod.exports)
  return mod.exports
}
const nodes = n => !n || typeof n !== "object" ? [] : Array.isArray(n) ? n.flatMap(nodes) : [n, ...nodes(n.props?.children)]
const { MobileNavigation } = load("components/shell/mobile-navigation.tsx", { "next/link": { default: "Link" } })
const bar = [{ id: "club-home", label: "Home", matches: ["overview"] }, { id: "recruiting", label: "Recruiting", matches: ["applicants", "interviews", "decisions"] }, { id: "meetings", label: "Calendar" }, { id: "members", label: "Members" }]
const more = active => nodes(MobileNavigation({ items: bar, active, onSelect() {}, onLink() {}, onMore() {} })).find(node => node.props?.["aria-label"] === "More sections")

test("More lights up when the open section lives in the More drawer", () => {
  assert.equal(more("alumni").props["data-current"], true)
  assert.equal(more("club-tasks").props["data-current"], true)
})

test("More stays plain when a bar tab already shows the section", () => {
  for (const active of ["overview", "applicants", "members", ""]) assert.equal(more(active).props["data-current"], undefined, active)
})

test("the highlighted More uses the same marker styles as a current tab", () => {
  const css = fs.readFileSync("components/shell/authenticated-product.css", "utf8")
  for (const part of ["", " svg", "::before", " span"]) assert.ok(css.includes(`.oc-mobile-destination[data-current]${part}`), part || "base")
})
