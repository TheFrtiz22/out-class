/** Before/after screenshots and axe for the glass rollout, on pages that render without a session:
 * the primitives gallery (/design-system, including its fictional product patterns) and public pages.
 * Local server only. Usage: OUTCLASS_GLASS_BASE_URL=http://127.0.0.1:3311 OUTCLASS_GLASS_PHASE=before|after
 *   [OUTCLASS_GLASS_MODES=1] node scripts/check-glass-rollout.cjs
 */
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict')
const { chromium, webkit } = require('playwright')
const { AxeBuilder } = require('@axe-core/playwright')
const base = process.env.OUTCLASS_GLASS_BASE_URL || 'http://127.0.0.1:3311'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Local audit only')
const phase = process.env.OUTCLASS_GLASS_PHASE || 'after'
const engine = process.env.OUTCLASS_NAV_BROWSER === 'webkit' ? webkit : chromium
const out = path.resolve('test-results/glass-rollout', `${phase}-${engine === chromium ? 'chromium' : 'webkit'}`)
const patterns = ['Explore', 'Club profile', 'Applications', 'Club overview', 'Recruitment', 'Scheduling']
const pages = [['home', '/'], ['login', '/login'], ['signup', '/signup'], ['forgot-password', '/forgot-password'], ['uva', '/uva'], ['request-school', '/request-school'], ['explore', '/explore']]

async function main() {
  await fs.mkdir(out, { recursive: true })
  const fsSync = require('node:fs')
  const browser = await engine.launch({ headless: true, ...(engine === chromium && !fsSync.existsSync(chromium.executablePath()) && fsSync.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {}) })
  const report = { phase, screenshots: [], accessibility: [], errors: [] }
  const context = await browser.newContext(), page = await context.newPage()
  page.on('pageerror', error => report.errors.push(`${page.url()}: ${error.message}`))
  const settle = async () => { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(600) }
  const shot = async (name, full = false) => { await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: full }); report.screenshots.push(name) }
  const axe = async (name, include = 'body') => { const r = await new AxeBuilder({ page }).include(include).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze(); report.accessibility.push({ name, violations: r.violations.map(v => ({ id: v.id, nodes: v.nodes.slice(0, 5).map(n => n.target) })) }) }
  const modes = process.env.OUTCLASS_GLASS_MODES === '1' ? [['reduced-transparency'], ['forced-colors', { forcedColors: 'active' }], ['higher-contrast', { contrast: 'more' }]] : []
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    await page.goto(`${base}/design-system`, { waitUntil: 'networkidle' }); await settle()
    await shot(`design-system-${width}`, true); if (width === 1440) await axe('design-system')
    const group = page.getByRole('group', { name: 'Preview product patterns' })
    for (const tab of patterns) {
      await group.getByRole('button', { name: tab, exact: true }).click(); await page.waitForTimeout(400)
      await page.locator('.oc-pattern-content').scrollIntoViewIfNeeded()
      await page.locator('.oc-pattern-content').screenshot({ path: path.join(out, `pattern-${tab.toLowerCase().replaceAll(' ', '-')}-${width}.png`) }); report.screenshots.push(`pattern-${tab}-${width}`)
    }
    if (width === 1440) {
      await page.getByRole('button', { name: /open dialog/i }).first().click().catch(() => {})
      if (await page.getByRole('dialog').count()) { await settle(); await shot('overlay-dialog-1440'); await axe('dialog', '[role="dialog"]'); await page.keyboard.press('Escape') }
      const menu = page.locator('[data-slot="dropdown-menu-trigger"]').first()
      if (await menu.count()) { await menu.scrollIntoViewIfNeeded(); await menu.click(); await settle(); await shot('overlay-menu-1440'); await page.keyboard.press('Escape') }
      const tip = page.locator('[data-slot="tooltip-trigger"]').first()
      if (await tip.count()) { await tip.scrollIntoViewIfNeeded(); await tip.hover(); await page.waitForTimeout(700); await shot('overlay-tooltip-1440') }
    }
    for (const [name, url] of pages) { await page.goto(base + url, { waitUntil: 'networkidle' }).catch(() => {}); await settle(); await shot(`${name}-${width}`); if (width === 1440) await axe(name) }
  }
  for (const [name, media] of modes) {
    await page.setViewportSize({ width: 1440, height: 900 })
    let cdp
    if (name === 'reduced-transparency') { if (engine !== chromium) continue; cdp = await context.newCDPSession(page); await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] }) } else await page.emulateMedia(media)
    for (const [label, url] of [['design-system', '/design-system'], ['login', '/login']]) { await page.goto(base + url, { waitUntil: 'networkidle' }); await settle(); await shot(`${label}-1440-${name}`, label === 'design-system'); await axe(`${label}-${name}`) }
    if (cdp) await cdp.send('Emulation.setEmulatedMedia', { features: [] }); else await page.emulateMedia({ forcedColors: null, contrast: null })
  }
  await browser.close()
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ out, screenshots: report.screenshots.length, violations: report.accessibility.filter(a => a.violations.length).map(a => [a.name, a.violations.map(v => v.id)]), errors: report.errors.length }, null, 1))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
