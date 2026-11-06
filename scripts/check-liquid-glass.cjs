/** Screenshot, accessibility and frame-time audit of the real public UI and
 * the existing isolated ProductShell fixture. Never signs in or writes data.
 * Start `node scripts/check-floating-header.cjs --serve` for the shell URL.
 * OUTCLASS_GLASS_SCOPE=dashboard audits Club home instead: it builds and serves the isolated
 * fixture itself (tests/fixtures/club-home) for a small and a large club, in every display mode.
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
        await page.getByRole('button', { name: 'More sections', exact: true }).click()
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
async function auditDashboard() {
  const { startClubHome, blurredSurfaces } = require('../tests/helpers/club-home-fixture.cjs')
  const browserName = engine === chromium ? 'chromium' : 'webkit'
  const dir = path.join(output, `dashboard-${browserName}`)
  await fs.mkdir(dir, { recursive: true })
  const fixture = await startClubHome()
  const browser = await engine.launch({ headless: true, ...(engine === chromium && !require('node:fs').existsSync(chromium.executablePath()) ? (require('node:fs').existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : { channel: 'chrome' }) : {}) })
  const report = { phase, browser: browserName, screenshots: [], accessibility: [], blur: {}, performance: {}, errors: [] }
  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    page.on('pageerror', error => report.errors.push(error.message))
    const open = async (query, width, height = 900) => {
      await page.setViewportSize({ width, height })
      await page.goto(fixture.url(query), { waitUntil: 'networkidle' })
      await page.locator('.oc-club-home').waitFor()
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(900)
    }
    const shot = async name => { await page.screenshot({ path: path.join(dir, `${name}.png`) }); report.screenshots.push(name) }
    const axe = async name => {
      const results = await new AxeBuilder({ page }).include('#workspace-content').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
      report.accessibility.push({ name, violations: results.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })) })
    }
    for (const club of ['small', 'large']) {
      for (const width of [1440, 1100, 1024, 820, 390]) {
        await open(`fixture=${club}&role=owner`, width, width === 390 ? 844 : 900)
        await shot(`${club}-${width}`)
        report.blur[`${club}-${width}`] = (await page.evaluate(blurredSurfaces)).map(b => b.name)
        if (width === 1440 || width === 390) await axe(`${club}-${width}`)
      }
      await open(`fixture=${club}&role=owner`, 1440)
      await page.evaluate(() => scrollTo(0, 120)); await page.waitForTimeout(300)
      await shot(`${club}-1440-scrolled`)
    }
    for (const role of ['reviewer', 'member']) { await open(`fixture=large&role=${role}`, 1440); await shot(`large-${role}-1440`); await axe(`large-${role}-1440`) }
    await open('fixture=clear&role=member', 1440); await shot('clear-member-1440'); await axe('clear-member-1440')
    // Display modes. Reduced transparency has no Playwright option; Chromium takes it through CDP.
    const modes = [['reduced-motion', { reducedMotion: 'reduce' }], ['higher-contrast', { contrast: 'more' }], ['forced-colors', { forcedColors: 'active' }]]
    for (const [name, media] of modes) {
      await page.emulateMedia(media)
      for (const width of [1440, 390]) { await open('fixture=large&role=owner', width, width === 390 ? 844 : 900); await shot(`large-${width}-${name}`); if (width === 1440) await axe(`large-${name}`) }
      await page.emulateMedia({ reducedMotion: null, contrast: null, forcedColors: null })
    }
    if (engine === chromium) {
      const cdp = await context.newCDPSession(page)
      await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] })
      for (const width of [1440, 390]) { await open('fixture=large&role=owner', width, width === 390 ? 844 : 900); await shot(`large-${width}-reduced-transparency`) }
      report.reducedTransparencyBlur = (await page.evaluate(blurredSurfaces)).map(b => b.name)
      await axe('large-reduced-transparency')
      await cdp.send('Emulation.setEmulatedMedia', { features: [] })
    }
    // Scroll frame times with the glass, then with the solid fallback (higher contrast turns every glass token solid).
    await open('fixture=large&role=owner', 1440)
    report.performance.glass = await frames(page, '.oc-product-header')
    await page.emulateMedia({ contrast: 'more' })
    await open('fixture=large&role=owner', 1440)
    report.performance.solid = await frames(page, '.oc-product-header')
    await page.emulateMedia({ contrast: null })
    await fs.writeFile(path.join(dir, 'report.json'), JSON.stringify(report, null, 2) + '\n')
    const violations = report.accessibility.filter(v => v.violations.length)
    console.log(JSON.stringify({ dir, screenshots: report.screenshots.length, blur: Object.fromEntries(Object.entries(report.blur).map(([k, v]) => [k, v.length])), performance: report.performance, violations, errors: report.errors }, null, 2))
    if (phase === 'final') {
      assert.deepEqual(report.errors, [], 'No browser exceptions')
      assert.deepEqual(violations, [], 'Club home passes automated WCAG checks in every mode')
      for (const [name, list] of Object.entries(report.blur)) assert.ok(list.length <= 6, `${name}: at most six blurred surfaces`)
      assert.deepEqual(report.reducedTransparencyBlur ?? [], [], 'No blur with reduced transparency')
    }
  } finally { await browser.close(); await fixture.close() }
}
;(process.env.OUTCLASS_GLASS_SCOPE === 'dashboard' ? auditDashboard() : audit()).catch(error => { console.error(error); process.exitCode = 1 })
