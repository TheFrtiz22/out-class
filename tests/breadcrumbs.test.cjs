const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
const React = require("react")
const { renderToStaticMarkup } = require("react-dom/server")

function load(file, mocks = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function("require", "module", "exports", "process", code)(name => mocks[name] || require(name), mod, mod.exports, { env: {} })
  return mod.exports
}
const Link = ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children)
const { Breadcrumbs } = load("components/ui/breadcrumbs.tsx", {
  "next/link": { __esModule: true, default: Link },
  "@/components/icons": { ChevronRight: props => React.createElement("svg", props) },
  "@/lib/utils": { cn: (...classes) => classes.filter(Boolean).join(" ") },
})
const seo = load("lib/seo.ts")

test("breadcrumbs are a labelled nav with an ordered list ending at the current page", () => {
  const html = renderToStaticMarkup(React.createElement(Breadcrumbs, { items: [{ label: "Settings", href: "/settings" }, { label: "Account" }] }))
  assert.match(html, /^<nav aria-label="Breadcrumb" class="oc-breadcrumbs"><ol>/)
  assert.match(html, /<a href="\/settings">Settings<\/a><svg[^>]*aria-hidden="true"/)
  assert.match(html, /<span aria-current="page">Account<\/span><\/li><\/ol><\/nav>$/)
  assert.equal(renderToStaticMarkup(React.createElement(Breadcrumbs, { items: [{ label: "Only" }] })), "", "one level is not a trail")
})

test("public club trail matches its BreadcrumbList JSON-LD; signed in it starts at Explore", () => {
  assert.deepEqual(seo.clubBreadcrumbs("Chess Club"), [{ label: "OutClass", href: "/" }, { label: "UVA", href: "/uva" }, { label: "Chess Club" }])
  assert.deepEqual(seo.clubBreadcrumbs("Chess Club", { signedIn: true }), [{ label: "Explore", href: "/explore" }, { label: "Chess Club" }])
  const graph = seo.clubStructuredData({ id: "chess", name: "Chess Club", description: "x" })["@graph"]
  const list = graph.find(node => node["@type"] === "BreadcrumbList")
  assert.deepEqual(list.itemListElement, [
    { "@type": "ListItem", position: 1, name: "OutClass", item: "https://www.out-class.net/" },
    { "@type": "ListItem", position: 2, name: "UVA", item: "https://www.out-class.net/uva" },
    { "@type": "ListItem", position: 3, name: "Chess Club", item: "https://www.out-class.net/club/chess" },
  ])
})

test("the public club page and nested personal settings show breadcrumbs", () => {
  const club = fs.readFileSync("components/qr/public-club-page.tsx", "utf8")
  assert.match(club, /breadcrumbs=\{<Breadcrumbs [^>]*items=\{clubBreadcrumbs\(club\.name, \{ signedIn: embedded \}\)\}/)
  const settings = fs.readFileSync("components/settings/personal-settings-layout.tsx", "utf8")
  assert.match(settings, /\{section && <Breadcrumbs [^>]*items=\{\[\{ label: "Settings", href: "\/settings" \}, \{ label: section\.label \}\]\} onLinkClick=\{guard\} \/>\}/)
})
