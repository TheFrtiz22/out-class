// Real built CSS/font transport on the reserved disposable fixture only.
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), { chromium } = require('playwright');
const { Actor, readConfig } = require('./helpers/onboarding-e2e.cjs');
const configFile = process.env.OUTCLASS_ONBOARDING_E2E_CONFIG;
for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`workspace avoids unused font transfers and renders real italic/variable faces on demand at ${viewport.width}px`, { skip: !configFile, timeout: 90000 }, async () => {
    const config = readConfig(configFile), fixture = JSON.parse(fs.readFileSync(path.join(path.dirname(configFile), 'navigation-fixture.json')));
    const actor = new Actor(config); await actor.signIn(fixture.email, fixture.password);
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport, storageState: { cookies: [...actor.cookies].map(([name, value]) => ({ name, value, domain: '127.0.0.1', path: '/' })), origins: [] } });
    const page = await context.newPage(), fonts = [], errors = [];
    page.on('response', response => { if (response.request().resourceType() === 'font') fonts.push({ url: response.url(), status: response.status() }); });
    page.on('pageerror', error => errors.push(error.name));
    try {
      await page.goto(config.appUrl + '/club/' + fixture.clubIds[0] + '/workspace?section=recruitment&tool=overview');
      await page.getByText('Current pipeline', { exact: false }).first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator('link[rel="preload"][as="font"]').count(), 0);
      const initial = await page.evaluate(() => [...document.fonts].filter(f => !f.family.includes('Fallback')).map(f => ({ family: f.family, style: f.style, weight: f.weight, status: f.status })));
      assert.equal(initial.length, 4); assert.equal(initial.filter(f => f.style === 'italic' && f.status === 'unloaded').length, 2);
      assert.equal(fonts.length, 2, 'Only the two rendered upright faces transfer');
      const initialUrls = new Set(fonts.map(f => f.url));
      // Demand the actual CSS families at multiple variable weights, as real
      // italic content does. No font API fetch or synthetic font substitution.
      await page.evaluate(() => {
        const probe = document.createElement('div'); probe.id = 'phase10-font-probe';
        for (const family of ['--font-source-sans-3', '--font-libre-caslon-text']) for (const weight of [400, 600]) {
          const text = document.createElement('em'); text.textContent = 'OutClass italic typography';
          text.style.cssText = `display:block;font-family:var(${family});font-style:italic;font-weight:${weight};font-size:20px`;
          probe.append(text);
        }
        document.body.append(probe); probe.getBoundingClientRect();
      });
      await page.evaluate(() => document.fonts.ready);
      const after = await page.evaluate(() => ({ faces: [...document.fonts].filter(f => !f.family.includes('Fallback')).map(f => ({ style: f.style, weight: f.weight, status: f.status })), probes: [...document.querySelectorAll('#phase10-font-probe em')].map(el => { const s = getComputedStyle(el); return { style: s.fontStyle, weight: s.fontWeight, width: el.getBoundingClientRect().width }; }) }));
      assert.equal(after.faces.filter(f => f.style === 'italic' && f.status === 'loaded').length, 2);
      assert.equal(after.faces.filter(f => f.style === 'italic' && /400 700|200 900/.test(f.weight)).length, 2);
      assert.deepEqual(after.probes.map(p => p.weight), ['400', '600', '400', '600']); assert.ok(after.probes.every(p => p.style === 'italic' && p.width > 0));
      assert.equal(new Set(fonts.filter(f => !initialUrls.has(f.url)).map(f => f.url)).size, 2); assert.ok(fonts.every(f => f.status === 200));
      assert.deepEqual(errors, []);
    } finally { await context.close(); await browser.close(); }
  });
}
