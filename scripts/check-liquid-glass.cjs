/** Screenshot, accessibility and frame-time audit of the real public UI and
 * the existing isolated ProductShell fixture. Never signs in or writes data.
 * Start `node scripts/check-floating-header.cjs --serve` for the shell URL.
 */
const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')
const { chromium, webkit } = require('playwright')
const { AxeBuilder } = require('@axe-core/playwright')

const phase = process.env.OUTCLASS_GLASS_PHASE || 'final'
const output = path.resolve('test-results/liquid-glass', phase)
const publicURL = process.env.OUTCLASS_NAV_BASE_URL || 'http://127.0.0.1:3111'
const shellURL = process.env.OUTCLASS_SHELL_BASE_URL
const engine = process.env.OUTCLASS_NAV_BROWSER === 'webkit' ? webkit : chromium
const sizes = [[1440, 900], [1280, 800], [1024, 768], [768, 1024], [390, 844]]

async function frames(page, selector) {
  return page.evaluate(async selector => {
    const target = document.querySelector(selector)
    const samples = [], shifts = []
    const observer = PerformanceObserver.supportedEntryTypes.includes('layout-shift') ? new PerformanceObserver(list => {
      for (const entry of list.getEntries()) if (entry.sources.some(source => source.node?.closest?.(selector))) shifts.push(entry.value)
    }) : null
    observer?.observe({ type: 'layout-shift' })
    const start = performance.now()
    let previous = start
    await new Promise(resolve => {
      function tick(now) {
        samples.push(now - previous); previous = now
        window.scrollTo(0, Math.round((Math.sin((now - start) / 450) + 1) * 350))
        if (now - start < 2200) requestAnimationFrame(tick)
        else resolve()
      }
      requestAnimationFrame(tick)
    })
    observer?.disconnect()
    samples.shift()
    samples.sort((a, b) => a - b)
    const material = getComputedStyle(target)
    return { frames: samples.length, medianMs: +samples[Math.floor(samples.length * .5)].toFixed(2), p95Ms: +samples[Math.floor(samples.length * .95)].toFixed(2), over34Ms: samples.filter(v => v > 34).length, navigationShifts: shifts.length, backdropFilter: material.backdropFilter, heapBytes: performance.memory?.usedJSHeapSize ?? null }
  }, selector)
}

async function audit() {
  assert.ok(shellURL, 'Set OUTCLASS_SHELL_BASE_URL to the isolated shell fixture URL')
  for (const url of [publicURL, shellURL]) assert.ok(['127.0.0.1', 'localhost'].includes(new URL(url).hostname), 'Local audit only')
  await fs.mkdir(output, { recursive: true })
  const browser = await engine.launch({ headless: true, ...(engine === chromium ? { channel: 'chrome' } : {}) })
  const errors = [], report = { phase, browser: engine === chromium ? 'chrome' : 'webkit', screenshots: [], accessibility: [], performance: {} }
  async function capture(page, name) {
    // Radix portals animate from transparent; inspect the settled material.
    await page.waitForTimeout(350)
    await page.screenshot({ path: path.join(output, `${name}.png`) })
    report.screenshots.push(name)
  }
  async function accessibility(page, name, selector) {
    await page.waitForTimeout(200)
    const results = await new AxeBuilder({ page }).include(selector).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
    report.accessibility.push({ name, violations: results.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) })
  }
  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height })
      await page.goto(publicURL, { waitUntil: 'networkidle' })
      await page.locator('.oc-public-nav').waitFor()
      await page.evaluate(() => document.fonts.ready)
      await capture(page, `public-${width}-hero`)
      if (width === 1440 || width === 390) await accessibility(page, `public-${width}`, '.oc-public-nav')
      if (width < 1100) {
        await page.locator('.oc-public-menu-toggle').click()
        await page.waitForTimeout(500)
        await capture(page, `public-${width}-drawer`)
        if (width === 390) await accessibility(page, 'public-mobile-open', '.oc-public-nav')
        await page.keyboard.press('Escape')
      }
      await page.locator('#about').scrollIntoViewIfNeeded()
      await page.waitForTimeout(600)
      await capture(page, `public-${width}-light`)
      if (width === 1440 || width === 390) await accessibility(page, `public-${width}-light`, '.oc-public-nav')
      await page.locator('footer').last().scrollIntoViewIfNeeded()
      await page.waitForTimeout(600)
      await capture(page, `public-${width}-dark`)
      if (width === 1440 || width === 390) await accessibility(page, `public-${width}-dark`, '.oc-public-nav')
    }
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(publicURL, { waitUntil: 'networkidle' })
    report.performance.public = await frames(page, '.oc-public-nav-surface')

    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height })
      await page.goto(`${shellURL}/club/fixture-mii/workspace?section=recruitment&role=owner`, { waitUntil: 'networkidle' })
      await page.locator('.oc-product-header').waitFor()
      await page.evaluate(() => document.fonts.ready)
      await capture(page, `internal-${width}`)
      if (width === 1440 || width === 390) await accessibility(page, `internal-${width}`, '[data-product-shell]')
      if (width < 1024) {
        await page.getByRole('button', { name: 'More navigation and workspaces', exact: true }).click()
        await page.waitForTimeout(500)
        await capture(page, `internal-${width}-drawer`)
        await page.keyboard.press('Escape')
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${shellURL}/club/fixture-mii/workspace?section=overview&role=owner`, { waitUntil: 'networkidle' })
    const modes = page.getByRole('navigation', { name: 'Product modes', exact: true })
    await modes.getByRole('link', { name: 'Recruiting', exact: true }).hover()
    await capture(page, 'internal-hover')
    await modes.getByRole('link', { name: 'Club', exact: true }).focus()
    await capture(page, 'internal-focus')
    const dock = page.getByRole('complementary', { name: 'Workspace dock' })
    await page.mouse.move(900, 600)
    await page.waitForTimeout(600)
    await capture(page, 'internal-collapsed')
    await dock.getByRole('link', { name: 'Overview', exact: true }).focus()
    await capture(page, 'internal-dock-focus')
    await page.keyboard.press('Escape')
    await dock.getByRole('link', { name: 'Overview', exact: true }).hover()
    await capture(page, 'internal-expanded')
    // Recruiting contains the existing nested navigation groups.
    await modes.getByRole('link', { name: 'Recruiting', exact: true }).click()
    await dock.getByRole('button', { name: 'Applicants', exact: true }).hover()
    await capture(page, 'internal-flyout')
    await accessibility(page, 'flyout', '.oc-dock-flyout')
    await page.mouse.move(900, 600)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: /Switch club:/ }).click()
    await capture(page, 'internal-workspaces')
    await accessibility(page, 'workspace-menu', '[role="menu"]')
    assert.equal(await page.getByRole('menuitem', { name: 'Admin', exact: true }).count(), 0)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: /Search OutClass/ }).click()
    await page.getByRole('combobox').fill('Profile')
    await page.waitForTimeout(400)
    await capture(page, 'internal-search')
    await accessibility(page, 'search', '[role="dialog"]')
    await page.keyboard.press('Escape')
    await page.getByRole('dialog', { name: 'Search OutClass', exact: true }).waitFor({ state: 'hidden' })
    await page.waitForTimeout(200)
    await page.locator('[data-tour="notifications"]').click()
    await page.getByRole('dialog', { name: 'Notifications', exact: true }).waitFor()
    await capture(page, 'internal-notifications')
    await accessibility(page, 'notifications', '.oc-notification-panel')
    await page.keyboard.press('Escape')
    await page.locator('.oc-notification-panel').waitFor({ state: 'hidden' })
    await page.locator('[data-tour="profile"]').click()
    await capture(page, 'internal-account')
    await accessibility(page, 'account', '[role="menu"]')
    await page.keyboard.press('Escape')
    report.performance.internal = await frames(page, '.oc-dock-rail')
    await page.emulateMedia({ reducedMotion: 'reduce', contrast: 'more' })
    await capture(page, 'internal-increased-contrast')
    await page.goto(publicURL, { waitUntil: 'networkidle' })
    await capture(page, 'public-increased-contrast')
    report.errors = errors
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify({ output, screenshots: report.screenshots.length, performance: report.performance, violations: report.accessibility.filter(v => v.violations.length), errors }, null, 2))
    if (phase === 'final') {
      assert.deepEqual(errors, [], 'No browser exceptions')
      assert.deepEqual(report.accessibility.filter(v => v.violations.length), [], 'Navigation passes automated WCAG checks')
      for (const result of Object.values(report.performance)) assert.equal(result.navigationShifts, 0, 'No navigation layout shifts during scroll')
    }
  } finally { await browser.close() }
}
audit().catch(error => { console.error(error); process.exitCode = 1 })
