/**
 * Public pages in the homepage design language against a local production build, signed out:
 * /about, /uva, /request-school, /login, /signup, /forgot-password, /reset-password and the legal routes
 * (404 while LEGAL_PAGES_PUBLIC is off). One h1, no horizontal overflow at 390/1440, axe 0 on the page,
 * no italics, no orange text, underlines or borders outside the logos (main and header), and at least one round glass surface in <main>.
 *
 *   node scripts/check-public-pages-glass.cjs http://127.0.0.1:3206 /tmp/pages-shots
 */
const assert = require('node:assert/strict'); const { chromium } = require('playwright'); const AxeBuilder = require('@axe-core/playwright').default
const [base, out] = process.argv.slice(2)
const pages = ['/about', '/uva', '/request-school', '/login', '/signup', '/forgot-password', '/reset-password', '/privacy', '/terms']
const orange = ['rgb(232, 121, 62)', 'rgb(159, 61, 18)', 'rgb(186, 80, 31)']
;(async () => {
  const b = await chromium.launch()
  for (const path of pages) for (const [w, h] of [[1440, 1000], [390, 844]]) {
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, reducedMotion: 'reduce', isMobile: w < 800, hasTouch: w < 800 }); const p = await c.newPage()
    const res = await p.goto(base + path, { waitUntil: 'networkidle' })
    const f = await p.evaluate(colors => {
      const main = document.querySelector('main'), all = [...document.querySelectorAll('main *, header.oc-public-nav *')]
      return {
        h1: document.querySelectorAll('h1').length, overflow: document.documentElement.scrollWidth - innerWidth,
        italic: all.filter(e => getComputedStyle(e).fontStyle === 'italic').map(e => e.textContent.trim().slice(0, 40)),
        orange: all.filter(e => !e.closest('img, svg, .oc-footer-letters') && (colors.includes(getComputedStyle(e).color) && e.textContent.trim() || ['borderTopColor', 'borderLeftColor', 'backgroundColor', 'textDecorationColor'].some(k => colors.includes(getComputedStyle(e)[k])))).map(e => e.className.toString().slice(0, 40) + ':' + e.textContent.trim().slice(0, 30)),
        glass: main.querySelectorAll('.oc-public-glass, .oc-public-glass-navy, .oc-login-auth-content, .oc-login-brand, .oc-signup-content, .oc-faq-next').length,
      }
    }, orange)
    assert.equal(f.h1, 1, path); assert.equal(f.overflow, 0, path + ' overflow'); assert.deepEqual(f.italic, [], path + ' italics'); assert.deepEqual(f.orange, [], path + ' orange'); if (res.status() !== 404) assert.ok(f.glass > 0, path + ' glass surfaces')
    // The shared footer is checked by scripts/check-public-footer-panel.cjs (#174).
    const axe = await new AxeBuilder({ page: p }).exclude('footer').analyze()
    assert.equal(axe.violations.length, 0, path + ' ' + axe.violations.map(v => v.id + ' ' + v.nodes.map(n => n.target).join(';')).join('|'))
    if (out) await p.screenshot({ path: `${out}/${path.slice(1)}-${w}.png`, fullPage: w === 390 ? false : true })
    console.log(`PASS ${path} ${w} (${res.status()}): one h1, overflow 0, no italics, no orange, ${f.glass} glass surfaces, axe 0`)
    await c.close()
  }
  await b.close()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
