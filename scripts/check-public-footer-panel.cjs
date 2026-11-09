/**
 * The shared public footer panel and the /uva FAQ rows against a local production build, signed out:
 * every public page (home, About, UVA, Request School, legal and 404) renders one footer panel, only the
 * homepage carries the final call to action, no horizontal overflow at 390/1440, axe on the footer, the
 * "Built at UVA" band and the FAQ, keyboard reachability of every footer link, FAQ rows open from the
 * keyboard, and the wordmark stays still under reduced motion. Screenshots go to <out>.
 *
 *   node scripts/check-public-footer-panel.cjs http://127.0.0.1:3205 /tmp/footer-shots
 */
const assert = require('node:assert/strict'); const { chromium } = require('playwright'); const AxeBuilder = require('@axe-core/playwright').default
const [base, out] = process.argv.slice(2)
const pages = [['home', '/?audience=leader'], ['home-student', '/?audience=student'], ['about', '/about'], ['uva', '/uva'], ['request-school', '/request-school'], ['privacy', '/privacy'], ['terms', '/terms'], ['not-found', '/no-such-page']]
;(async () => {
  const b = await chromium.launch()
  for (const [name, path] of pages) for (const [w, h] of [[1440, 1000], [390, 844]]) {
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, reducedMotion: 'reduce', isMobile: w < 800, hasTouch: w < 800 }); const p = await c.newPage()
    await p.goto(base + path, { waitUntil: 'networkidle' })
    const f = await p.evaluate(() => ({
      footers: document.querySelectorAll('footer.oc-public-footer').length, panels: document.querySelectorAll('.oc-footer-panel').length,
      invitation: !!document.querySelector('.oc-public-footer .oc-footer-invitation'), band: !!document.querySelector('.oc-campus-band'),
      overflow: document.documentElement.scrollWidth - innerWidth, italic: [...document.querySelectorAll('.oc-public-footer *, .oc-campus-band *')].filter(e => getComputedStyle(e).fontStyle === 'italic').length,
      orange: [...document.querySelectorAll('.oc-public-footer *, .oc-campus-band *')].filter(e => getComputedStyle(e).color === 'rgb(232, 121, 62)' && !e.closest('.oc-footer-letters')).map(e => e.textContent.trim()),
    }))
    assert.equal(f.footers, 1, name); assert.equal(f.panels, 1, name); assert.equal(f.overflow, 0, name + ' overflow'); assert.equal(f.italic, 0)
    assert.equal(f.invitation, name.startsWith('home'), name + ' invitation only on the homepage'); assert.equal(f.band, name.startsWith('home'))
    if (name.startsWith('home')) assert.deepEqual(f.orange, ['class'], 'orange only on "class" (besides the wordmark)'); else assert.deepEqual(f.orange, [])
    const axe = await new AxeBuilder({ page: p }).include('.oc-public-footer').include(name.startsWith('home') ? '.oc-campus-band' : 'footer').include(name === 'uva' ? '#faq' : 'footer').analyze()
    assert.equal(axe.violations.length, 0, name + ' ' + axe.violations.map(v => v.id + ' ' + v.nodes.map(n => n.target).join(';')).join('|'))
    if (w === 1440) {
      // Every footer link is reachable by Tab, in order.
      const links = await p.locator('.oc-public-footer a, .oc-public-footer button').count(); let reached = 0
      for (let i = 0; i < 160 && reached < links; i++) { await p.keyboard.press('Tab'); if (await p.evaluate(() => !!document.activeElement?.closest('.oc-public-footer'))) reached++ }
      assert.equal(reached, links, name + ' footer links reachable by Tab')
      // Reduced motion: moving the mouse over the wordmark leaves every letter untransformed.
      const field = p.locator('.oc-footer-field'); await field.scrollIntoViewIfNeeded(); const box = await field.boundingBox()
      await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.move(box.x + box.width / 3, box.y + box.height / 2); await p.waitForTimeout(200)
      assert.equal(await p.evaluate(() => [...document.querySelectorAll('.oc-footer-letter')].filter(e => e.style.transform).length), 0, 'wordmark still under reduced motion')
    }
    if (name === 'uva') {
      const rows = await p.evaluate(() => [...document.querySelectorAll('#faq details.oc-faq-entry')].map(d => ({ summary: !!d.querySelector('summary'), glass: d.classList.contains('oc-public-glass'), radius: getComputedStyle(d).borderTopLeftRadius })))
      assert.ok(rows.length > 0 && rows.every(r => r.summary && r.glass && parseFloat(r.radius) >= 20), 'FAQ rows are separate round glass details')
      const first = p.locator('#faq details.oc-faq-entry summary').first(); await first.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(300)
      assert.equal(await p.evaluate(() => document.querySelector('#faq details.oc-faq-entry').open), true, 'Enter opens a FAQ row')
      if (out) await p.locator('#faq').screenshot({ path: `${out}/faq-${w}.png` })
    }
    if (out) { await p.locator('.oc-public-footer').screenshot({ path: `${out}/footer-${name}-${w}.png` }); if (name === 'home') await p.locator('.oc-campus-band').screenshot({ path: `${out}/campus-band-${w}.png` }) }
    console.log(`PASS ${name} ${w}: one panel, invitation ${f.invitation}, overflow 0, axe 0`)
    await c.close()
  }
  await b.close()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
