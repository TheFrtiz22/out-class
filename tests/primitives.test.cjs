// One set of primitives in components/ui, one page title, two page widths.
const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const { execFileSync } = require("node:child_process")
const tsx = execFileSync("git", ["ls-files", "app", "components", "lib", "contexts"], { encoding: "utf8" }).split("\n").filter(file => file.endsWith(".tsx"))

test("PageHeader, Panel, DataTable, EmptyState and StatusPill live in components/ui; the old copies are gone", () => {
  for (const file of ["page-header", "panel", "data-table", "empty-state", "status-pill"]) assert.ok(fs.existsSync(`components/ui/${file}.tsx`), file)
  for (const gone of ["components/product/page-header.tsx", "components/status-badge.tsx", "components/ui/surface.tsx", "components/ui/empty.tsx"]) assert.ok(!fs.existsSync(gone), gone)
  for (const file of tsx) assert.doesNotMatch(fs.readFileSync(file, "utf8"), /@\/components\/(product\/page-header|status-badge|ui\/surface|ui\/empty)"/, file)
})

// Display and document headings that are not page titles keep their own typography.
const h1Exceptions = {
  "components/landing/landing-hero.tsx": "marketing hero display headline",
  "components/auth/login-auth-panel.tsx": "sign-in card serif display headline (public frame)",
  "components/auth/signup-page-view.tsx": "sign-up card serif display headline (public frame)",
  "components/password-recovery.tsx": "forgot/reset password card serif display headline (public frame)",
  "components/landing/sign-in-card.tsx": "signed-out link card headline (invitation, club access, club claim)",
  "components/landing/legal-page.tsx": "Privacy and Terms document title",
  "app/not-found.tsx": "public 404 card headline",
  "app/error.tsx": "error card headline (no product shell to provide PageHeader)",
  "app/global-error.tsx": "root error fallback headline (renders its own <html>, no product shell or PageHeader)",
  "components/interview-applicant-panel.tsx": "candidate name inside the interview room",
  "components/communications/decision-letter.tsx": "the letter's own title on the printed page",
  "components/maintenance-gate.tsx": "maintenance page headline (replaces the product shell and its PageHeader)",
}
test("every page title is PageHeader; raw <h1> appears only in the documented display/document headings", () => {
  const raw = tsx.filter(file => file !== "components/ui/page-header.tsx" && /<h1[\s>]/.test(fs.readFileSync(file, "utf8")))
  assert.deepEqual(raw.sort(), Object.keys(h1Exceptions).sort())
  assert.equal((fs.readFileSync("components/communications/decision-letter.tsx", "utf8").match(/<h1[\s>]/g) || []).length, 2, "letter title and fallback letter heading only")
  assert.doesNotMatch(fs.readFileSync("components/ui/section-heading.tsx", "utf8"), /"h1"/, "SectionHeading never renders a page title")
})

test("page wrappers use only --oc-content-width or --oc-reading-width", () => {
  const offenders = []
  for (const file of tsx) for (const [line, text] of fs.readFileSync(file, "utf8").split("\n").entries()) {
    if (/className=["{`][^"`]*\bmx-auto\b[^"`]*\bmax-w-(2xl|3xl|4xl|5xl|6xl|7xl|\[1440px\])/.test(text) || /className=["{`][^"`]*\bmax-w-(2xl|3xl|4xl|5xl|6xl|7xl)\b[^"`]*\bmx-auto\b/.test(text)) offenders.push(`${file}:${line + 1}`)
  }
  assert.deepEqual(offenders, [])
  assert.match(fs.readFileSync("components/shell/product-shell.tsx", "utf8"), /max-w-\[var\(--oc-content-width\)\]/)
})

test("Panel and DataTable render the shared surfaces", () => {
  const React = require("react"), { renderToStaticMarkup } = require("react-dom/server"), { loadComponent } = require("./helpers/component-module.cjs")
  const { Panel } = loadComponent("components/ui/panel.tsx"), { DataTableFrame, DataTable } = loadComponent("components/ui/data-table.tsx"), { PageHeader } = loadComponent("components/ui/page-header.tsx")
  assert.equal(renderToStaticMarkup(React.createElement(Panel, { as: "section", className: "space-y-2" }, "x")), '<section data-slot="panel" data-tone="card" class="oc-content-panel space-y-2">x</section>')
  assert.match(renderToStaticMarkup(React.createElement(DataTableFrame, { caption: "Applicants" }, React.createElement("tbody"))), /^<div data-slot="data-table" class="oc-data-surface">.*<caption class="sr-only">Applicants<\/caption><tbody><\/tbody><\/table>/)
  // The shared list: one table (sortable headers, priority columns, open control) and label-free cards from the same rows.
  const list = renderToStaticMarkup(React.createElement(DataTable, { caption: "Members", rows: [{ id: "a", name: "Ada", year: "First Year" }], rowKey: r => r.id, onOpen() {}, openLabel: r => `Open ${r.name}`, sort: { key: "name", descending: false, toggle() {} },
    columns: [{ id: "name", header: "Member", sortKey: "name", primary: true, cell: r => r.name }, { id: "year", header: "Year", sortKey: "year", showFrom: "md", cell: r => r.year }],
    card: { title: r => r.name, meta: r => r.year } }))
  assert.match(list, /<div data-slot="data-table" data-density="default" class="oc-dt">/)
  assert.match(list, /<th scope="col" data-primary="true" aria-sort="ascending">/); assert.match(list, /<th scope="col" aria-sort="none" class="oc-dt-from-md">/)
  assert.match(list, /<button type="button" class="oc-dt-open" aria-label="Open Ada">Ada<\/button>/)
  assert.match(list, /<li data-list-card=""><span class="oc-dt-card-body"><button type="button" class="oc-dt-card-open" aria-label="Open Ada"><span class="oc-dt-card-title">Ada<\/span><\/button><span class="oc-dt-card-meta">First Year<\/span><\/span><\/li>/)
  assert.doesNotMatch(list, /Year:|data-label/, "cards carry no field labels")
  const header = renderToStaticMarkup(React.createElement(PageHeader, { title: "Interviews", focusable: true, titleId: "t" }))
  assert.match(header, /^<div data-slot="page-header" class="oc-page-header"/); assert.match(header, /<h1 id="t" tabindex="-1" class="outline-none">Interviews<\/h1>/)
})
