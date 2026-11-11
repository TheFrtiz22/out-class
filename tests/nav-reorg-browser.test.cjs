// Nav reorganization in a real browser: the real shell and ClubWorkspace on Demo Mode data (leader-screens fixture).
// Old links land on their new homes; Decide's round picker, steps and counts; the Recruiting settings drawer from
// both entry points; the Calendar sections; Review applicants with ←/→.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { chromium } = require('playwright')
const { expect } = require('playwright/test')
const { startLeaderScreens } = require('./helpers/leader-screens-fixture.cjs')

test('browser: old links, Decide stepper, Recruiting settings drawer, Calendar sections and Review applicants', { timeout: 300000 }, async t => {
  const fixture = await startLeaderScreens(); t.after(() => fixture.close(), { timeout: 30000 })
  const browser = await chromium.launch({ headless: true, ...(!fs.existsSync(chromium.executablePath()) ? { channel: 'chrome' } : {}) }); t.after(() => browser.close(), { timeout: 30000 })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } }); t.after(() => context.close())
  const page = await context.newPage(), errors = []
  page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message))
  const rail = page.locator('aside.oc-expanding-dock')
  const params = () => Object.fromEntries(new URL(page.url()).searchParams)
  const open = async query => { await page.goto(fixture.url(query)); await page.locator('main h1').first().waitFor() }

  // Old links normalize on the client to their new homes (the server page applies the same mapping).
  const moves = [
    ['section=meetings', { section: 'calendar', type: 'meetings' }, 'Calendar'],
    ['section=events', { section: 'calendar', type: 'events' }, 'Calendar'],
    ['section=announcements', { section: 'overview', focus: 'announcements' }, 'Home'],
    ['section=recruitment&tool=scheduled-decisions', { section: 'recruitment', tool: 'decisions', decisionTab: 'letters' }, 'Decide'],
    ['section=recruitment&tool=decisions&decisionTab=voting', { section: 'recruitment', tool: 'decisions', decisionTab: 'voting' }, 'Decide'],
    ['section=recruitment&tool=rules', { section: 'recruitment', tool: 'applicants', recruitingSettings: 'rules' }, 'Applicants'],
    ['section=recruitment&tool=rounds', { section: 'recruitment', tool: 'applicants', recruitingSettings: 'anonymous' }, 'Applicants'],
  ]
  for (const [from, to, current] of moves) {
    await open(from)
    await expect.poll(params, { message: from }).toEqual(expect.objectContaining(to))
    await expect(rail.locator('[aria-current="page"]')).toHaveAttribute('aria-label', current)
  }
  // The rules link opened the drawer on its section.
  await open('section=recruitment&tool=rules')
  const drawer = page.getByRole('dialog', { name: 'Recruiting settings', exact: true })
  await drawer.waitFor()
  await expect(drawer.getByRole('tab', { name: 'Auto-reject rules', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Escape'); await drawer.waitFor({ state: 'hidden' })
  await expect.poll(params).not.toHaveProperty('recruitingSettings')

  // Recruiting settings from the Applicants ⋯ menu: focus is trapped inside, Escape closes and returns to the ⋯ button.
  await open('section=recruitment&tool=applicants')
  const gear = page.getByRole('button', { name: 'More applicant tools', exact: true })
  await gear.click(); await page.getByRole('menuitem', { name: 'Recruiting settings', exact: true }).click(); await drawer.waitFor()
  await expect(drawer.getByRole('tab', { name: 'Anonymous review', exact: true })).toHaveAttribute('aria-selected', 'true')
  for (let i = 0; i < 12; i++) await page.keyboard.press('Tab')
  assert.equal(await drawer.evaluate(el => el.contains(document.activeElement)), true, 'focus stays in the drawer')
  await drawer.getByRole('tab', { name: 'Auto-reject rules', exact: true }).click()
  await expect.poll(params).toEqual(expect.objectContaining({ recruitingSettings: 'rules' }))
  await page.keyboard.press('Escape'); await drawer.waitFor({ state: 'hidden' }); await expect(gear).toBeFocused()
  // …and from club Settings → Application → Recruiting, in place.
  await open('section=settings&setting=application')
  const recruiting = page.getByRole('region', { name: 'Recruiting', exact: true })
  await recruiting.getByRole('button', { name: 'Auto-reject rules', exact: true }).click(); await drawer.waitFor()
  assert.equal(params().section, 'settings')
  await page.keyboard.press('Escape'); await drawer.waitFor({ state: 'hidden' })
  await expect(recruiting.getByRole('button', { name: 'Auto-reject rules', exact: true })).toBeFocused()

  // Decide: Review → Vote → Send as a stepper with counts as badges, the round dropdown in the header row, both in the URL.
  await open('section=recruitment&tool=decisions')
  await expect(page.locator('main h1').first()).toHaveText('Decide')
  const steps = page.getByRole('navigation', { name: 'Decide steps', exact: true })
  await expect(steps.getByRole('button')).toHaveCount(3)
  const reviewStep = steps.getByRole('button', { name: /^Review/ }), vote = steps.getByRole('button', { name: /^Vote/ }), send = steps.getByRole('button', { name: /^Send/ })
  await expect(reviewStep).toHaveAttribute('aria-current', 'step')
  await expect(page.getByRole('button', { name: 'Review applicants needing a decision', exact: true })).toBeVisible()
  await expect(reviewStep).toHaveText(/^1Review$/); await expect(vote).toHaveText(/^2Vote, \d+ sessions? to run\d+$/); await expect(send).toHaveText(/^3Send, \d+ applicants? ready to send\d+$/)
  await expect(vote.locator('.oc-stepper-badge')).toHaveText(/^\d+$/); await expect(send.locator('.oc-stepper-badge')).toHaveText(/^\d+$/)
  await expect(page.locator('.oc-decide-steps li:first-child')).toHaveCSS('display', 'flex')
  await page.getByRole('button', { name: 'Next: Vote', exact: true }).click()
  await expect.poll(params).toEqual(expect.objectContaining({ decisionTab: 'voting' }))
  await expect(vote).toHaveAttribute('aria-current', 'step')
  const picker = page.getByRole('combobox', { name: 'Round', exact: true })
  await expect(picker).toHaveText(/Round:?\s*All/)
  const header = await page.locator('.oc-decide-header').boundingBox(), pickerBox = await picker.boundingBox()
  assert.ok(pickerBox.y >= header.y && pickerBox.y + pickerBox.height <= header.y + header.height + 1, 'the round dropdown sits in the header row')
  await picker.click(); const round = page.getByRole('option').nth(1), roundName = (await round.textContent()).trim()
  await round.click(); await expect.poll(params).toEqual(expect.objectContaining({ roundId: expect.any(String) }))
  await expect(picker).toContainText(roundName)
  await send.click(); await expect.poll(params).toEqual(expect.objectContaining({ decisionTab: 'letters', roundId: expect.any(String) }))
  await expect(send).toHaveAttribute('aria-current', 'step')
  await page.getByRole('heading', { name: 'Decision letters', exact: true }).waitFor()
  await expect(page.getByRole('group', { name: 'Letter outcome' }).getByRole('button')).toHaveText(['Accepted', 'Not accepted', 'Waitlisted'])
  await expect(page.getByRole('button', { name: /^Next:/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Back to Vote', exact: true }).click()
  await expect.poll(params).toEqual(expect.objectContaining({ decisionTab: 'voting' }))
  await page.goBack(); await expect.poll(params).toEqual(expect.objectContaining({ decisionTab: 'letters' }))

  // Calendar: no All / Meetings / Events switcher; both sections show with "Jump to" links; old type= links still work.
  await open('section=calendar')
  await expect(page.getByRole('group', { name: 'Show', exact: true })).toHaveCount(0)
  const jump = page.getByRole('navigation', { name: 'Calendar sections', exact: true })
  await expect(jump.getByRole('link')).toHaveText(['Meetings', 'Events'])
  await expect(page.getByRole('heading', { name: 'Meetings', exact: true })).toBeVisible()
  await expect(page.getByText(/Event management is not available in Demo/)).toBeVisible()
  await jump.getByRole('link', { name: 'Events', exact: true }).click()
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#calendar-events')
  await expect(page.getByRole('switch', { name: 'Show past', exact: true })).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByRole('combobox', { name: 'Audience', exact: true })).toHaveText(/Audience:?\s*All/)
  await open('section=calendar&type=events')
  await expect(page.getByRole('heading', { name: 'Meetings', exact: true })).toBeAttached()
  await expect(page.getByText(/Event management is not available in Demo/)).toBeInViewport()

  // Review applicants opens the full-screen review on Pending; ←/→ move between applicants ("X of N").
  await open('section=recruitment&tool=applicants')
  await page.getByRole('button', { name: 'Review applicants', exact: true }).click()
  const review = page.getByRole('dialog').filter({ has: page.getByRole('navigation', { name: 'Applicant navigation' }) })
  await review.waitFor()
  const position = review.locator('#review-flow-progress')
  const first = await position.textContent()
  await page.keyboard.press('ArrowRight'); await expect(position).not.toHaveText(first)
  await page.keyboard.press('ArrowLeft'); await expect(position).toHaveText(first)

  // The Overview review card lands on Applicants with the review open (removing review=1 from the URL).
  await page.keyboard.press('Escape')
  await open('section=recruitment&tool=applicants&review=1')
  await review.waitFor(); await expect.poll(params).not.toHaveProperty('review')

  assert.deepEqual(errors, [])
})
