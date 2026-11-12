// Nav reorganization in a real browser: the real shell and ClubWorkspace on Demo Mode data (leader-screens fixture).
// Old links land on their new homes; Decide's round picker, steps and counts; the Recruiting settings drawer from
// both entry points; the Calendar filter; Review applicants with ←/→.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { chromium } = require('playwright')
const { expect } = require('playwright/test')
const { startLeaderScreens } = require('./helpers/leader-screens-fixture.cjs')

test('browser: old links, Decide, Recruiting settings drawer, Calendar filter and Review applicants', { timeout: 300000 }, async t => {
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

  // Decide: round picker, Overview (the default), then Review/Vote/Send as real tabs with per-round counts, the round kept in the URL.
  await open('section=recruitment&tool=decisions')
  await expect(page.locator('main h1').first()).toHaveText('Decide')
  const steps = page.getByRole('tablist', { name: 'Decide steps', exact: true })
  await expect(steps.getByRole('tab')).toHaveCount(4)
  const overview = steps.getByRole('tab', { name: 'Overview', exact: true })
  const reviewStep = steps.getByRole('tab', { name: /^Step 1: Review/ }), vote = steps.getByRole('tab', { name: /^Step 2: Vote/ }), send = steps.getByRole('tab', { name: /^Step 3: Send/ })
  await expect(overview).toHaveAttribute('aria-selected', 'true')
  await expect(reviewStep).toHaveText(/^1Review$/); await expect(vote).toHaveText(/^2Vote · \d+$/); await expect(send).toHaveText(/^3Send · \d+$/)
  // Review (#281): the shared applicant review, then back to Overview before the round and history checks.
  await reviewStep.click(); await expect(reviewStep).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tabpanel').getByRole('button', { name: 'Review applicants needing a decision', exact: true })).toBeVisible()
  await overview.click(); await expect(overview).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tabpanel')).toBeVisible()
  await page.getByRole('heading', { name: 'Voting sessions', exact: true }).waitFor()
  // With no round in the URL, Overview opens on the current round and writes it into the URL (no extra Back step).
  const picker = page.getByRole('group', { name: 'Round', exact: true })
  await expect.poll(() => params().roundId ?? '').not.toBe('')
  const defaultRound = params().roundId
  await expect(picker.getByRole('button', { name: 'All rounds', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('dl[aria-label="Applicants by outcome"] > div')).toHaveText([/^Passed\d+$/, /^Held\d+$/, /^Not passed\d+$/, /^Undecidedin voting sessions\d+$/])
  // Letters: each applicant once, ready to send and sent.
  await expect(page.locator('dl[aria-label="Applicants by letter status"] > div')).toHaveText([/^Ready to send\d+$/, /^Sent\d+$/])
  // "All rounds" is an explicit choice: kept in the URL and never replaced by the default.
  await picker.getByRole('button', { name: 'All rounds', exact: true }).click()
  await expect.poll(() => params().roundId).toBe('')
  await expect(page.getByText('Choose a round to see its decisions and target.', { exact: true })).toBeVisible()
  await page.waitForTimeout(500); expect(params().roundId).toBe('')
  const round = picker.getByRole('button').nth(1), roundName = await round.textContent()
  await round.click(); await expect.poll(params).toEqual(expect.objectContaining({ roundId: expect.stringMatching(/./) }))
  await expect(picker.getByRole('button', { name: roundName, exact: true })).toHaveAttribute('aria-pressed', 'true')
  // Overview's figures for the round: one count per outcome, and the reused round target summary.
  await expect(page.locator('dl[aria-label="Applicants by outcome"] > div')).toHaveText([/^Passed\d+$/, /^Held\d+$/, /^Not passed\d+$/, /^Undecidedin voting sessions\d+$/])
  await page.getByRole('region', { name: 'Round target', exact: true }).waitFor()
  await vote.click(); await expect.poll(params).toEqual(expect.objectContaining({ decisionTab: 'voting', roundId: expect.stringMatching(/./) }))
  await expect(vote).toHaveAttribute('aria-selected', 'true')
  // Round and tab changes are history entries: Back returns to Overview with the round, Back again to the explicit
  // All rounds (still not replaced by the default), Back again to the default round; Forward returns to Vote.
  const selectedRound = params().roundId
  await page.goBack(); await expect(overview).toHaveAttribute('aria-selected', 'true')
  await expect.poll(params).toEqual(expect.objectContaining({ roundId: selectedRound }))
  await expect(picker.getByRole('button', { name: roundName, exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.goBack(); await expect(overview).toHaveAttribute('aria-selected', 'true')
  await expect.poll(() => params().roundId).toBe('')
  await expect(picker.getByRole('button', { name: 'All rounds', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.goBack(); await expect.poll(() => params().roundId).toBe(defaultRound)
  await page.goForward(); await expect.poll(() => params().roundId).toBe('')
  await page.goForward(); await expect.poll(params).toEqual(expect.objectContaining({ roundId: selectedRound }))
  await page.goForward(); await expect(vote).toHaveAttribute('aria-selected', 'true')
  await expect.poll(params).toEqual(expect.objectContaining({ decisionTab: 'voting', roundId: selectedRound }))
  // Overview's step links are real links.
  await page.goBack(); await expect(page.getByRole('link', { name: 'Open Vote', exact: true })).toHaveAttribute('href', /decisionTab=voting/)
  await page.getByRole('link', { name: 'Open Vote', exact: true }).click(); await expect(vote).toHaveAttribute('aria-selected', 'true')
  await send.click(); await expect.poll(params).toEqual(expect.objectContaining({ decisionTab: 'letters', roundId: expect.any(String) }))
  await expect(send).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('heading', { name: 'Decision letters', exact: true }).waitFor()
  await expect(page.getByRole('group', { name: 'Letter outcome' }).getByRole('button')).toHaveText(['Accepted', 'Not accepted', 'Waitlisted'])
  // Arrow keys move between the steps (tab semantics).
  await send.focus(); await page.keyboard.press('ArrowLeft'); await expect(vote).toBeFocused()

  // Calendar: All / Meetings / Events, kept in the URL.
  await open('section=calendar')
  const filter = page.getByRole('group', { name: 'Show', exact: true })
  await expect(filter.getByRole('button')).toHaveText(['All', 'Meetings', 'Events'])
  await expect(filter.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await filter.getByRole('button', { name: 'Events', exact: true }).click()
  await expect.poll(params).toEqual(expect.objectContaining({ section: 'calendar', type: 'events' }))
  await expect(page.getByText(/Event management is not available in Demo/)).toBeVisible()
  await filter.getByRole('button', { name: 'Meetings', exact: true }).click()
  await expect.poll(params).toEqual(expect.objectContaining({ type: 'meetings' }))

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
