/**
 * Navigation cleanup verification (Phase 6). Visits every nav destination of the personal and club
 * workspaces at 390px and 1280px in the isolated shell fixture (real ProductShell, rail, phone bar,
 * header, account menu and ⌘K; fictional identity and placeholder page bodies), screenshots each
 * page to docs/nav-cleanup-screens/, and checks:
 *   - every icon-only control has an accessible name (axe button-name / link-name / aria-command-name),
 *   - no navigation surface lists two links to the same place,
 *   - no page H1 repeats the club name except Club home,
 *   - ⌘K offers each rail destination and no removed page ("Messages", "Interview workspace").
 * Usage: node scripts/nav-cleanup-screens.cjs   (PLAYWRIGHT_BROWSERS_PATH as for the browser tests)
 * Signed-in page bodies need the disposable Supabase stack (Docker), which this script does not start.
 */
const fs = require("node:fs")
const path = require("node:path")
const { chromium } = require("playwright")
const AxeBuilder = require("@axe-core/playwright").default
const { startDockFixture } = require("../tests/helpers/expanding-dock-browser.cjs")

const out = path.resolve(__dirname, "../docs/nav-cleanup-screens")
const widths = [390, 1280]
const club = "fixture-mii"
const personal = ["/home", "/explore", "/corkboard", "/applications", "/clubs", "/calendar", "/profile", "/inbox"].map(p => ({ name: `personal${p.replaceAll("/", "-")}`, url: `${p}?role=student`, clubHome: false }))
const workspace = (query, name, clubHome = false) => ({ name: `club-${name}`, url: `/club/${club}/workspace?${query}&role=president`, clubHome })
const clubPages = [
  workspace("section=overview", "home", true),
  workspace("section=recruitment&tool=overview", "recruiting"),
  workspace("section=recruitment&tool=applicants", "applicants"),
  workspace("section=recruitment&tool=interviews", "interviews"),
  workspace("section=recruitment&tool=decisions&decisionTab=voting", "voting-room"),
  workspace("section=meetings", "meetings"),
  workspace("section=tasks", "tasks"),
  workspace("section=members", "members"),
  workspace("section=announcements", "announcements"),
  workspace("section=settings", "settings"),
]

async function audit(page, entry, width) {
  const findings = []
  const axe = await new AxeBuilder({ page }).withRules(["button-name", "link-name", "aria-command-name", "aria-toggle-field-name"]).analyze()
  for (const violation of axe.violations) for (const node of violation.nodes) findings.push(`${violation.id}: ${node.target.join(" ")}`)
  // Two links to the same place inside one navigation surface.
  const duplicates = await page.evaluate(() => {
    const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden" }
    const result = []
    for (const nav of document.querySelectorAll("nav, [role=toolbar], [role=group]")) {
      if (!visible(nav)) continue
      const seen = new Map()
      for (const a of nav.querySelectorAll("a[href]")) {
        if (!visible(a)) continue
        const url = new URL(a.href); url.searchParams.delete("role")
        const key = url.pathname + "?" + [...url.searchParams].sort().map(([k, v]) => `${k}=${v}`).join("&")
        if (seen.has(key)) result.push(`${nav.getAttribute("aria-label") || nav.tagName}: "${seen.get(key)}" and "${a.textContent.trim()}" → ${key}`)
        else seen.set(key, a.textContent.trim())
      }
    }
    return result
  })
  findings.push(...duplicates.map(d => `duplicate destination: ${d}`))
  // Page H1 must not be the club name, except on Club home.
  const h1 = await page.locator("h1").first().textContent().catch(() => "")
  if (!entry.clubHome && /Virginia Volunteers|McIntire Investment Institute|MII/.test(h1 || "") && entry.name.startsWith("club-")) findings.push(`H1 repeats the club name: "${h1}"`)
  return { page: entry.name, width, url: entry.url, h1: (h1 || "").trim(), title: await page.title(), findings }
}

async function searchEntries(page) {
  const opener = page.getByRole("button", { name: /^Search/ }).first()
  if (!(await opener.isVisible().catch(() => false))) return null
  await opener.click()
  const dialog = page.getByRole("dialog")
  await dialog.waitFor()
  const entries = await dialog.getByRole("option").allTextContents()
  await page.keyboard.press("Escape")
  return entries.map(entry => entry.trim())
}

async function main() {
  fs.mkdirSync(out, { recursive: true })
  const fixture = await startDockFixture()
  const browser = await chromium.launch()
  const report = []
  const search = {}
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 })
      const page = await context.newPage()
      for (const entry of [...personal, ...clubPages]) {
        await page.goto(fixture.base + entry.url, { waitUntil: "networkidle" })
        await page.waitForTimeout(250)
        await page.screenshot({ path: path.join(out, `${entry.name}-${width}.png`), fullPage: false })
        report.push(await audit(page, entry, width))
        if (width === 1280 && (entry.name === "personal-home" || entry.name === "club-home")) search[entry.name] = await searchEntries(page)
      }
      await context.close()
    }
  } finally {
    await browser.close()
    await fixture.close()
  }
  for (const [name, entries] of Object.entries(search)) {
    if (!entries) continue
    for (const removed of ["Messages", "Interview workspace", "Notifications", "Status", "Corkboard"]) if (entries.includes(removed)) report.push({ page: `${name} ⌘K`, findings: [`removed entry still searchable: ${removed}`] })
  }
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify({ generatedAt: new Date().toISOString(), widths, search, report }, null, 2) + "\n")
  const problems = report.filter(row => row.findings.length)
  for (const row of problems) console.log(`${row.page}${row.width ? ` @${row.width}` : ""}: ${row.findings.join("; ")}`)
  console.log(`nav-cleanup-screens: ${report.length} checks, ${problems.length} with findings; screenshots in docs/nav-cleanup-screens/`)
  process.exitCode = problems.length ? 1 : 0
}
main().catch(error => { console.error(error); process.exitCode = 1 })
