/**
 * Homepage "How OutClass works" tabs against a local production build, signed out:
 * keyboard (arrows, Home/End, Tab out to the panel), one tabpanel, #journey-N deep links and hashchange,
 * the hero audience switch keeping the task, a bare hash following the stored preference, no horizontal overflow at 360/390/1440, no transitions under
 * reduced motion, and axe on both new sections. Screenshots go to <out>.
 *
 *   node scripts/check-journey-tabs.cjs http://127.0.0.1:3203 /tmp/journey-shots
 */
const assert = require('node:assert/strict'); const { chromium } = require('playwright'); const AxeBuilder = require('@axe-core/playwright').default
const [base, out] = process.argv.slice(2); const log = (...a) => console.log(...a)
const state = async p => { await p.waitForTimeout(150); return p.evaluate(() => ({ selected: [...document.querySelectorAll('.oc-journey-tablist [role=tab]')].filter(t => t.getAttribute('aria-selected') === 'true').map(t => t.textContent), panels: document.querySelectorAll('#product-journey [role=tabpanel]').length, stage: document.querySelector('#product-journey [role=tabpanel]')?.dataset.stage, number: document.querySelector('.oc-journey-number')?.textContent, focused: document.activeElement?.textContent, labelled: document.querySelector('#product-journey [role=tabpanel]')?.getAttribute('aria-labelledby') === document.querySelector('.oc-journey-tablist [aria-selected=true]')?.id })) }
;(async () => {
  const b = await chromium.launch()
  // Keyboard: Tab into the tablist lands on the selected tab; arrows move and select; Home/End.
  { const c = await b.newContext({ viewport: { width: 1440, height: 1000 } }); const p = await c.newPage(); await p.goto(base + '/?audience=leader', { waitUntil: 'networkidle' })
    let s = await state(p); assert.deepEqual(s.selected, ['Set Up']); assert.equal(s.panels, 1); assert.ok(s.labelled)
    await p.locator('.oc-journey-tablist [role=tab]').first().focus()
    await p.keyboard.press('ArrowRight'); s = await state(p); assert.deepEqual(s.selected, ['Recruit']); assert.equal(s.focused, 'Recruit'); assert.equal(s.number, '02'); assert.equal(s.panels, 1)
    await p.keyboard.press('End'); s = await state(p); assert.deepEqual(s.selected, ['Manage']); assert.equal(s.number, '06')
    await p.keyboard.press('ArrowRight'); s = await state(p); assert.deepEqual(s.selected, ['Set Up'], 'wraps')
    await p.keyboard.press('ArrowLeft'); s = await state(p); assert.deepEqual(s.selected, ['Manage'])
    await p.keyboard.press('Home'); s = await state(p); assert.deepEqual(s.selected, ['Set Up'])
    await p.keyboard.press('Tab'); assert.equal(await p.evaluate(() => document.activeElement?.getAttribute('role')), 'tabpanel', 'Tab leaves the tablist for the panel')
    await p.keyboard.press('Shift+Tab'); assert.equal(await p.evaluate(() => document.activeElement?.textContent), 'Set Up', 'Shift+Tab returns to the selected tab')
    await p.locator('.oc-journey-tablist [role=tab]', { hasText: 'Interview' }).click()
    assert.match(p.url(), /\?audience=leader#journey-4$/, 'tab choice keeps a shareable deep link')
    // Audience switch keeps the task: leader Interview -> student Interview; leader Decide -> student Track.
    await p.locator('.oc-hero-audience-toggle [data-segment]', { hasText: 'Students' }).click(); await p.waitForFunction(() => document.querySelector('#product-journey')?.dataset.perspective === 'student')
    s = await state(p); assert.deepEqual(s.selected, ['Interview']); assert.equal(s.number, '03')
    await p.locator('.oc-hero-audience-toggle [data-segment]', { hasText: /Club/i }).click(); await p.waitForFunction(() => document.querySelector('#product-journey')?.dataset.perspective === 'leader')
    await p.locator('.oc-journey-tablist [role=tab]', { hasText: 'Decide' }).click()
    await p.locator('.oc-hero-audience-toggle [data-segment]', { hasText: 'Students' }).click(); await p.waitForFunction(() => document.querySelector('#product-journey')?.dataset.perspective === 'student')
    s = await state(p); assert.deepEqual(s.selected, ['Track'])
    log('PASS keyboard tabs, single panel, deep link on click, audience switch keeps the task'); await c.close() }
  // Old deep links.
  for (const [url, label, num] of [['/?audience=leader#journey-4', 'Interview', '04'], ['/?audience=student#journey-3', 'Interview', '03'], ['/?audience=student#journey-5', 'Belong', '05'], ['/?audience=leader#journey-1', 'Set Up', '01'], ['/?audience=student#journey-9', 'Belong', '05']]) {
    const c = await b.newContext({ viewport: { width: 1440, height: 1000 } }); const p = await c.newPage(); await p.goto(base + url, { waitUntil: 'networkidle' }); await p.waitForTimeout(300)
    const s = await state(p); assert.deepEqual(s.selected, [label], url); assert.equal(s.number, num, url)
    const top = await p.evaluate(() => document.querySelector('#product-journey').getBoundingClientRect().top); assert.ok(top > -10 && top < 400, url + ' scrolled to section, top=' + top)
    log('PASS deep link', url, '->', label); await c.close() }
  // A bare #journey-N follows the stored audience preference (resolved before the hook commits it).
  for (const [pref, label] of [['students', 'Interview'], ['club-leaders', 'Review']]) {
    const c = await b.newContext({ viewport: { width: 1440, height: 1000 } }); await c.addInitScript(v => { try { localStorage.setItem('outclass-landing-audience', v) } catch {} }, pref)
    const p = await c.newPage(); await p.goto(base + '/#journey-3', { waitUntil: 'networkidle' }); await p.waitForTimeout(300)
    assert.deepEqual((await state(p)).selected, [label], pref); log('PASS bare #journey-3 with stored', pref, '->', label); await c.close() }
  // hashchange on the same page.
  { const c = await b.newContext({ viewport: { width: 1440, height: 1000 } }); const p = await c.newPage(); await p.goto(base + '/?audience=leader', { waitUntil: 'networkidle' })
    await p.evaluate(() => { location.hash = '#journey-5' }); await p.waitForTimeout(300); assert.deepEqual((await state(p)).selected, ['Decide']); log('PASS hashchange #journey-5 -> Decide'); await c.close() }
  // Phone widths, reduced motion, axe, screenshots.
  for (const [w, h] of [[390, 844], [360, 740], [1440, 1000]]) for (const a of ['leader', 'student']) {
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w === 360 ? 1 : 2, reducedMotion: 'reduce', isMobile: w < 800, hasTouch: w < 800 }); const p = await c.newPage(); await p.goto(base + '/?audience=' + a, { waitUntil: 'networkidle' })
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    const animated = await p.evaluate(() => [...document.querySelectorAll('.oc-scattered *, #product-journey *')].filter(e => { const s = getComputedStyle(e); return s.animationName !== 'none' && parseFloat(s.animationDuration) > 0 || parseFloat(s.transitionDuration) > .02 }).map(e => e.className).slice(0, 5))
    const axe = await new AxeBuilder({ page: p }).include('.oc-scattered').include('#about').analyze()
    for (const sel of ['.oc-scattered', '#about']) { const el = p.locator(sel); await el.scrollIntoViewIfNeeded(); if (w !== 360) await el.screenshot({ path: `${out}/${sel.replace(/[#.]/, '')}-${a}-${w}.png` }) }
    log(`${w} ${a}: overflow=${overflow} reducedMotionAnimated=${JSON.stringify(animated)} axe=${axe.violations.map(v => v.id + ':' + v.nodes.length).join(',') || 0}`)
    assert.equal(overflow, 0); assert.equal(axe.violations.length, 0); await c.close() }
  await b.close()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
