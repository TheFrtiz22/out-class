// Club workspace pages at phone width match the OutClass app; desktop keeps its own layout.
// Runs the real workspace shell and ClubWorkspace on Demo Mode's fictional in-browser data
// (tests/fixtures/leader-screens). No sessions, server actions or production data.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { chromium } = require('playwright')
const { startLeaderScreens } = require('./helpers/leader-screens-fixture.cjs')

const css = file => fs.readFileSync(file, 'utf8')

test('leader phone rules apply only below 1024px and never to the personal shell', () => {
  const leader = css('styles/leader-phone.css')
  for (const block of leader.split(/@media /).slice(1).filter(b => !b.startsWith('(forced-colors'))) {
    assert.match(block, /^\(max-width: (1023|759)px\)/, 'every layout rule sits in a phone/tablet media block')
    for (const rule of block.match(/^ {2}[^ /@}][^{]*\{/gm) || []) assert.match(rule, /^\s*\[data-product-shell="manager"\] /, `${rule.trim()} is scoped to the club workspace`)
  }
  assert.match(css('app/globals.css'), /@import "\.\.\/styles\/leader-phone\.css";/)
  for (const file of ['components/product/dashboard/dashboard.css', 'components/club-home/club-home.css']) {
    const s = css(file), at = s.indexOf('/* Phones and tablets inside the signed-in shell')
    assert.ok(at > 0, `${file} has the app-style block`)
    const block = s.slice(s.indexOf('@media (max-width: 1023px) {', at), s.indexOf('\n}\n', at))
    for (const rule of block.match(/^ {2}[^ /}][^{]*\{/gm) || []) assert.match(rule, /^\s*\[data-product-shell\]:not\(\[data-product-shell="personal"\]\) /, `${file}: ${rule.trim()} leaves personal Home alone`)
  }
})

test('browser: leader pages at 390px use the app switch, grouped lists and the five-tab bar', async t => {
  const fixture = await startLeaderScreens(); t.after(() => fixture.close())
  const browser = await chromium.launch({ headless: true, ...(!fs.existsSync(chromium.executablePath()) ? { channel: 'chrome' } : {}) }); t.after(() => browser.close())
  const open = async (query, width = 390) => {
    const context = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, isMobile: width < 500, hasTouch: width < 500 }); t.after(() => context.close())
    const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message))
    await page.goto(fixture.url(query)); await page.locator('main h1').first().waitFor(); await page.waitForTimeout(600)
    assert.deepEqual(errors, [], `${query}: no page errors`)
    return page
  }

  const applicants = await open('section=recruitment&tool=applicants')
  const bar = applicants.locator('.oc-mobile-destination')
  assert.deepEqual(await bar.evaluateAll(items => items.map(item => item.getAttribute('aria-label'))), ['Club home', 'Recruiting', 'Meetings', 'Members', 'More sections'])
  assert.equal(await applicants.locator('.oc-mobile-destination[aria-current="page"]').getAttribute('aria-label'), 'Recruiting')
  const sw = applicants.locator('.oc-recruiting-switch')
  assert.equal(await sw.evaluate(el => getComputedStyle(el).display), 'grid', 'recruiting sections are the pill switch')
  assert.equal(await sw.locator('a[aria-current="page"]').textContent(), 'Applicants')
  const list = applicants.locator('.oc-applicant-mobile-list')
  const shape = await list.evaluate(el => ({ gap: getComputedStyle(el).rowGap, radius: parseFloat(getComputedStyle(el).borderTopLeftRadius), cardBorder: getComputedStyle(el.querySelector('li > button')).borderTopWidth, divider: getComputedStyle(el.children[1]).borderTopWidth }))
  assert.deepEqual([shape.gap, shape.radius > 0, shape.cardBorder, shape.divider], ['0px', true, '0px', '1px'], 'applicants are rows in one card')
  const target = await list.locator('li > button').first().boundingBox()
  assert.ok(target.height >= 44, 'each applicant row stays a 44px target')

  const members = await open('section=members')
  const row = members.locator('.oc-member-row').first()
  const [nameBox, roleBox] = await Promise.all([row.locator('> :nth-child(1)').boundingBox(), row.locator('> :nth-child(2)').boundingBox()])
  assert.ok(Math.abs(nameBox.y - roleBox.y) < 4 && roleBox.x > nameBox.x, 'role sits beside the name')

  const desktop = await open('section=recruitment&tool=applicants', 1440)
  assert.equal(await desktop.locator('.oc-recruiting-switch').evaluate(el => getComputedStyle(el).display), 'none', 'desktop keeps the rail')
  assert.equal(await desktop.locator('.oc-applicant-mobile-list').evaluate(el => getComputedStyle(el).display), 'none', 'desktop keeps the table')
})
