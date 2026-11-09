/**
 * Homepage decision moment, "A season on Grounds" and feature grid against a local production build,
 * signed out: per-audience content, illustrations with no focusable or button-role elements, keyboard Tab
 * never stops inside them, six season steps i–vi, six text-only features, no horizontal overflow at
 * 360/390/1440, no transitions under reduced motion, axe on all three sections. Screenshots go to <out>.
 *
 *   node scripts/check-landing-moments.cjs http://127.0.0.1:3204 /tmp/moments-shots
 */
const assert = require('node:assert/strict'); const { chromium } = require('playwright'); const AxeBuilder = require('@axe-core/playwright').default
const [base, out] = process.argv.slice(2)
const sections = ['section[aria-labelledby="moment-title"]', 'section[aria-labelledby="season-title"]', 'section[aria-labelledby="features-title"]']
;(async () => {
  const b = await chromium.launch()
  for (const [w, h] of [[1440, 1000], [390, 844], [360, 740]]) for (const a of ['leader', 'student']) {
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w === 360 ? 1 : 2, reducedMotion: 'reduce', isMobile: w < 800, hasTouch: w < 800 }); const p = await c.newPage()
    await p.goto(`${base}/?audience=${a}`, { waitUntil: 'networkidle' })
    const facts = await p.evaluate(sel => {
      const moment = document.querySelector(sel[0]), illo = moment.querySelector('[role="img"]')
      return {
        title: document.getElementById('moment-title').textContent,
        illoLabel: illo?.getAttribute('aria-label'),
        actions: [...moment.querySelectorAll('.oc-moment-action')].map(e => e.textContent),
        focusableInIllustration: illo.querySelectorAll('button, a, input, select, textarea, [tabindex], [role="button"]').length,
        seasonNumerals: [...document.querySelectorAll('.oc-season-numeral')].map(e => e.textContent),
        seasonStyle: getComputedStyle(document.querySelector('.oc-season-numeral')).fontStyle,
        caption: document.querySelector('.oc-moments-caption')?.textContent,
        features: document.querySelectorAll('.oc-features > li').length,
        featureMedia: document.querySelectorAll('.oc-features svg, .oc-features img').length,
        overflow: document.documentElement.scrollWidth - innerWidth,
        animated: sel.flatMap(s => [...document.querySelectorAll(s + ' *')]).filter(e => { const st = getComputedStyle(e); return (st.animationName !== 'none' && parseFloat(st.animationDuration) > 0) || parseFloat(st.transitionDuration) > .02 }).length,
        italic: sel.flatMap(s => [...document.querySelectorAll(s + ' *')]).filter(e => getComputedStyle(e).fontStyle === 'italic').length,
      }
    }, sections)
    assert.equal(facts.title, a === 'leader' ? 'Decision night, without the whiteboard.' : 'The best message of the semester.')
    assert.deepEqual(facts.actions, a === 'leader' ? ['Pass', 'Hold', 'Not pass'] : ['Accept offer', 'Decline'])
    assert.ok(facts.illoLabel?.startsWith('Sample'), 'illustration is one labelled image')
    assert.equal(facts.focusableInIllustration, 0)
    assert.deepEqual(facts.seasonNumerals, ['i', 'ii', 'iii', 'iv', 'v', 'vi']); assert.equal(facts.seasonStyle, 'normal')
    assert.equal(facts.caption, 'A typical recruitment cycle')
    assert.equal(facts.features, 6); assert.equal(facts.featureMedia, 0)
    assert.equal(facts.overflow, 0); assert.equal(facts.animated, 0); assert.equal(facts.italic, 0)
    // Keyboard: Tab through the whole page never focuses anything inside the three sections.
    if (w === 1440) {
      let inside = 0
      for (let i = 0; i < 80; i++) { await p.keyboard.press('Tab'); if (await p.evaluate(sel => sel.some(s => document.querySelector(s)?.contains(document.activeElement)), sections)) inside++ }
      assert.equal(inside, 0, 'no tab stop inside the illustrations or cards')
    }
    const axe = await new AxeBuilder({ page: p }).include(sections[0]).include(sections[1]).include(sections[2]).analyze()
    assert.equal(axe.violations.length, 0, axe.violations.map(v => v.id + ' ' + v.nodes.map(n => n.target).join(';')).join('|'))
    if (w !== 360 && out) for (const [i, s] of sections.entries()) { const el = p.locator(s); await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: `${out}/${['moment', 'season', 'features'][i]}-${a}-${w}.png` }) }
    console.log(`PASS ${w} ${a}: overflow 0, no tab stops, axe 0`)
    await c.close()
  }
  await b.close()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
