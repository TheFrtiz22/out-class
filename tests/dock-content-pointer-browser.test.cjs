const { test } = require('node:test'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { startDockFixture } = require('./helpers/expanding-dock-browser.cjs');

test('flyout destination releases the first content-row pointer target during collapse', async () => {
  const fixture = await startDockFixture();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(fixture.base + '/club/fixture-mii/workspace?section=recruitment&role=president', { waitUntil: 'networkidle' });
    const trigger = page.locator('.oc-expanding-dock [data-dock-group="applicants"]');
    await trigger.hover();
    await page.waitForFunction(() => document.querySelector('.oc-expanding-dock').getBoundingClientRect().width >= 271.9);
    const menu = page.getByRole('dialog', { name: 'Applicants navigation', exact: true });
    const parent = await trigger.boundingBox(), lower = await menu.getByRole('link').last().boundingBox();
    const from = { x: parent.x + 140, y: parent.y + 24 }, to = { x: lower.x + 100, y: lower.y + 22 };
    await page.mouse.move(from.x, from.y);
    for (let step = 1; step <= 16; step++) {
      await page.mouse.move(from.x + (to.x - from.x) * step / 16, from.y + (to.y - from.y) * step / 16);
      await page.waitForTimeout(60);
    }
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true', 'continued diagonal movement retains the intended flyout');
    await page.getByRole('dialog', { name: 'Applicants navigation', exact: true }).getByRole('link', { name: 'All Applicants', exact: true }).click();
    await page.waitForURL('**tool=applicants');
    // A first-column content button in the compact rail's reserved content area.
    // Its center is inside the *expanded* rail, recreating the real obstruction.
    await page.locator('main').evaluate(main => {
      const row = document.createElement('button'); row.textContent = 'First applicant pointer target';
      Object.assign(row.style, { position: 'fixed', left: '150px', top: '190px', width: '180px', height: '48px' });
      row.onclick = () => { row.dataset.clicked = 'true'; }; main.append(row);
    });
    const row = page.getByRole('button', { name: 'First applicant pointer target', exact: true });
    await row.click({ timeout: 3000 });
    assert.equal(await row.getAttribute('data-clicked'), 'true');
    await trigger.hover();
    await page.getByRole('dialog', { name: 'Applicants navigation', exact: true }).getByRole('link', { name: 'Rejected Applicants', exact: true }).click();
    await page.waitForURL('**tool=rejected');
    const bounds = await trigger.boundingBox();
    await page.mouse.move(82, bounds.y + bounds.height / 2, { steps: 8 });
    await page.getByRole('dialog', { name: 'Applicants navigation', exact: true }).getByRole('link', { name: 'All Applicants', exact: true }).click();
    await page.waitForURL('**tool=applicants');
    await row.click({ timeout: 3000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await trigger.hover();
    await page.getByRole('dialog', { name: 'Applicants navigation', exact: true }).getByRole('link', { name: 'Rejected Applicants', exact: true }).click();
    await page.waitForURL('**tool=rejected');
    await row.click({ timeout: 3000 });
  } finally { await browser.close(); await fixture.close(); }
});
