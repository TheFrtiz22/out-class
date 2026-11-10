// Real Next + Auth + PostgreSQL on the reserved disposable onboarding stack (run-onboarding-e2e.cjs --shell).
// Persistent workspace shell: one header node across Personal → club → Admin → Personal, no full-screen
// loader, a sliding pill indicator (and an instant one under reduced motion), a cancelled switch that slides
// back, and shell jobs (notification polling, live updates, search) started once per session.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path')
const { chromium } = require('playwright')
const { shellAccount, signedInContext, watchShell, contentPainted, switchWorkspace } = require('./helpers/workspace-shell-e2e.cjs')
const configFile = process.env.OUTCLASS_ONBOARDING_E2E_CONFIG

test('the workspace shell persists across workspace switches', { skip: !configFile, timeout: 240000 }, async t => {
  const account = await shellAccount(configFile)
  const browser = await chromium.launch({ headless: true })
  const timings = []
  t.after(async () => { await browser.close(); await account.db.$disconnect() })
  const personal = 'Personal workspace', club = `${account.clubName} club workspace`, admin = 'Admin workspace'

  await t.test('Personal → club → Admin → Personal keeps one header and never shows the loader', async () => {
    const context = await signedInContext(browser, account)
    const page = await context.newPage(), errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(account.config.appUrl + '/home')
    await contentPainted(page, personal)
    await watchShell(page)
    for (const [label, from] of [[club, 'personal'], [admin, 'club'], [personal, 'admin'], [club, 'personal (warm)'], [personal, 'club (warm)']]) {
      const result = await switchWorkspace(page, label)
      timings.push({ from, to: label.replace(account.clubName, 'club'), ms: result.ms })
      assert.ok(result.transforms.length > 2, `the indicator animates on the way to ${label} (${result.transforms.length} distinct frames)`)
      assert.ok(result.offset <= 2 && result.widthDelta <= 2, `the indicator ends under ${label} (offset ${result.offset}px, width ${result.widthDelta}px)`)
      assert.equal(await page.evaluate(() => window.__shellHeader === document.querySelector('.oc-product-header') && window.__shellHeader.isConnected), true, `same header node after switching to ${label}`)
    }
    // In-workspace navigation through the rail keeps the same shell and starts nothing again.
    const beforeRail = await page.evaluate(() => ({ ...window.__outclassShellStarts }))
    for (const id of ['explore', 'applications', 'student-dashboard']) {
      await page.locator(`.oc-dock-rail [data-tour="nav-${id}"]`).click()
      await page.waitForFunction(id => document.querySelector(`.oc-dock-rail [data-tour="nav-${id}"]`)?.getAttribute('aria-current') === 'page', id)
    }
    assert.equal(await page.evaluate(() => window.__shellHeader === document.querySelector('.oc-product-header')), true, 'same header after rail navigation')
    assert.equal(await page.evaluate(() => window.__loaderSeen), false, 'the full-screen "Loading OutClass…" cover never appears')
    const starts = await page.evaluate(() => window.__outclassShellStarts)
    assert.equal(starts['task-poll'], 1, 'notification polling starts once')
    assert.equal(starts['communications-live'], 1, 'communications live updates start once')
    assert.equal(starts.search, 1, 'the search dialog mounts once')
    // The walkthrough loads once per tutorial experience entered (student, leader, student, leader, student; Admin has
    // none), never on navigation inside a workspace.
    assert.equal(starts.tutorial, 5, 'tutorial loads only when its experience changes')
    assert.deepEqual(starts, beforeRail, 'rail navigation starts no shell job again')
    assert.deepEqual(errors, [])
    await context.close()
  })

  await t.test('reduced motion moves the indicator without animating', async () => {
    const context = await signedInContext(browser, account, { reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.goto(account.config.appUrl + '/home')
    await contentPainted(page, personal)
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.oc-evolving-indicator')).transitionDuration.split(',').every(value => parseFloat(value) === 0)), true)
    const result = await switchWorkspace(page, club)
    assert.ok(result.transforms.length <= 2, `no intermediate frames under reduced motion (${result.transforms.length})`)
    assert.ok(result.offset <= 2, 'the indicator still ends under the selected segment')
    await context.close()
  })

  await t.test('a cancelled switch (unsaved changes) slides the indicator back', async () => {
    const context = await signedInContext(browser, account)
    const page = await context.newPage()
    await page.goto(account.config.appUrl + '/home')
    await contentPainted(page, personal)
    const before = await page.evaluate(() => document.querySelector('.oc-evolving-indicator').getBoundingClientRect().left)
    await page.evaluate(() => { const marker = document.createElement('div'); marker.dataset.unsaved = 'true'; marker.id = 'unsaved-marker'; document.querySelector('main').append(marker) })
    let prompted = false
    page.once('dialog', dialog => { prompted = true; void dialog.dismiss() })
    const url = page.url()
    await page.locator(`a[data-workspace-option][aria-label$="${club}"]`).click()
    await page.waitForTimeout(900)
    assert.equal(prompted, true, 'the unsaved-changes prompt appeared')
    assert.equal(page.url(), url, 'no navigation after cancelling')
    const after = await page.evaluate(() => ({ left: document.querySelector('.oc-evolving-indicator').getBoundingClientRect().left, pending: document.querySelector('.oc-workspace-selector').dataset.pendingWorkspace ?? null }))
    assert.equal(after.pending, null)
    assert.ok(Math.abs(after.left - before) <= 2, 'the indicator returned to Personal')
    await context.close()
  })

  const out = path.resolve('test-results/workspace-shell')
  fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(path.join(out, `switch-timings-${process.env.OUTCLASS_SHELL_PHASE || 'after'}.json`), JSON.stringify(timings, null, 2))
})
