const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');

test('Events: desktop/tablet/mobile views share filters, saves, RSVP, details and pagination; calendar downloads actual instants', { skip: !process.env.OUTCLASS_EVENTS_TEST_DATABASE_URL }, async () => {
  const fixture = await require('./helpers/event-discovery-browser-fixture.cjs').start();
  let browser, page;
  try {
    browser = await chromium.launch({ headless: true, ...(fs.existsSync(chromium.executablePath()) ? {} : { channel: 'chrome' }) });
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(fixture.url);
    await page.getByText('65 approved events · Times shown in Eastern Time', { exact: true }).waitFor();
    assert.equal(await page.locator('.oc-pinned-flyer').count(), 60);
    const reads = () => fixture.calls.filter(c => c.name === 'getPublicCorkboard').length;
    let before = reads();
    await page.getByRole('button', { name: 'List View', exact: true }).click();
    assert.equal(await page.locator('.oc-smart-event-card').count(), 60);
    await page.waitForTimeout(200); assert.equal(reads(), before, 'changing only the layout must not refetch');
    await page.getByRole('button', { name: 'Save After Hours at the Art Museum', exact: true }).click();
    await page.getByRole('button', { name: 'Unsave After Hours at the Art Museum', exact: true }).waitFor();
    assert.equal(await page.getByRole('dialog').count(), 0, 'Save must not open the parent card');
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Add After Hours at the Art Museum to calendar', exact: true }).click();
    const download = await downloaded, calendar = fs.readFileSync(await download.path(), 'utf8').replace(/\r\n /g, '');
    const stamp = value => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    assert.ok(calendar.includes('DTSTART:' + stamp(fixture.events[0].date)));
    assert.ok(calendar.includes('DTEND:' + stamp(fixture.events[0].endDate)));
    assert.equal(await page.getByRole('dialog').count(), 0, 'Calendar must not open the parent card');
    await page.getByLabel('Search events', { exact: true }).fill('After Hours');
    await page.getByText('13 approved events · Times shown in Eastern Time', { exact: true }).waitFor();
    before = reads(); await page.getByRole('button', { name: 'Corkboard', exact: true }).click();
    assert.equal(await page.locator('.oc-pinned-flyer').count(), 13);
    assert.equal(await page.getByLabel('Search events', { exact: true }).inputValue(), 'After Hours');
    assert.equal(reads(), before);
    await page.getByRole('button', { name: 'View After Hours at the Art Museum, hosted by OutClass Events Test', exact: true }).click();
    const dialog = page.getByRole('dialog'); await dialog.waitFor();
    await dialog.getByRole('button', { name: 'Unsave After Hours at the Art Museum', exact: true }).waitFor();
    await dialog.getByRole('button', { name: 'RSVP', exact: true }).click();
    await dialog.getByText('You’re going', { exact: false }).waitFor();
    await dialog.getByText('1 / 20 capacity · 19 remaining', { exact: false }).waitFor();
    await dialog.getByRole('button', { name: 'Cancel RSVP', exact: true }).click();
    await dialog.getByRole('button', { name: 'RSVP', exact: true }).waitFor();
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    assert.equal(await page.locator('.oc-pinned-flyer').first().evaluate(el => el === document.activeElement), true);
    await page.getByRole('button', { name: 'List View', exact: true }).click();
    await page.reload();
    await page.locator('.oc-smart-event-card').first().waitFor();
    assert.equal(await page.getByRole('button', { name: 'List View', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByText('Page 2', { exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelectorAll('.oc-smart-event-card').length === 5);
    await page.getByRole('button', { name: 'Corkboard', exact: true }).click();
    assert.equal(await page.locator('.oc-pinned-flyer').count(), 5);
    await page.getByRole('button', { name: 'Previous', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.oc-pinned-flyer').length === 60);
    await page.getByRole('button', { name: 'Saved events', exact: true }).click();
    await page.getByText('1 approved event · Times shown in Eastern Time', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'List View', exact: true }).click();
    assert.equal(await page.locator('.oc-smart-event-card').count(), 1);
    await page.getByRole('button', { name: 'Unsave After Hours at the Art Museum', exact: true }).click();
    await page.getByRole('heading', { name: 'No saved events here yet.', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Show all events', exact: true }).click();
    await page.getByText('65 approved events · Times shown in Eastern Time', { exact: true }).waitFor();
    await page.locator('.oc-event-filter > summary').click();
    await page.getByLabel('Category').selectOption('Sports');
    await page.getByRole('heading', { name: 'No events match your filters.', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
    await page.locator('.oc-event-filter > summary').click();
    await page.getByText('65 approved events · Times shown in Eastern Time', { exact: true }).waitFor();
    await page.getByLabel('Search events', { exact: true }).fill('no matching campus event');
    await page.getByRole('heading', { name: 'No search results.', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Show all events', exact: true }).click();
    await page.getByText('65 approved events · Times shown in Eastern Time', { exact: true }).waitFor();
    const screenshots = process.env.OUTCLASS_EVENTS_SCREENSHOTS;
    for (const [name, width, height] of [['desktop', 1440, 1000], ['tablet', 820, 1180], ['mobile', 390, 844]]) {
      await page.setViewportSize({ width, height });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name} should not overflow`);
      assert.equal(await page.locator('.oc-smart-event-media').nth(1).locator('img').count(), 0, 'broken media uses the branded fallback');
      if (screenshots) { fs.mkdirSync(screenshots, { recursive: true }); await page.screenshot({ path: path.join(screenshots, `events-${name}.png`) }); }
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.oc-event-view').evaluate(el => getComputedStyle(el).animationName), 'none');
    assert.ok(await page.locator('.oc-smart-event-card').first().evaluate(el => parseFloat(getComputedStyle(el).transitionDuration) <= .001));
    await page.getByRole('link', { name: 'After Hours at the Art Museum', exact: true }).press('Enter');
    await dialog.waitFor(); await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    assert.equal(await page.locator('.oc-smart-event-link').first().evaluate(el => el === document.activeElement), true);
    assert.deepEqual(errors, []);
  } catch (error) {
    if (page && process.env.OUTCLASS_EVENTS_SCREENSHOTS) {
      fs.mkdirSync(process.env.OUTCLASS_EVENTS_SCREENSHOTS, { recursive: true });
      await page.screenshot({ path: path.join(process.env.OUTCLASS_EVENTS_SCREENSHOTS, 'events-failure.png') });
    }
    throw error;
  } finally { await browser?.close(); await fixture.close(); }
});
