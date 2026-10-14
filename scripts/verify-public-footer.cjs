/** Read-only public QA against a local production preview. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium, webkit } = require('playwright')
const engine = process.env.OUTCLASS_FOOTER_BROWSER === 'webkit' ? webkit : chromium
const base = process.env.OUTCLASS_FOOTER_URL || 'http://127.0.0.1:3015'
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Footer QA requires a local preview.')
const output = process.env.OUTCLASS_FOOTER_QA_DIR || '/tmp/outclass-footer-qa'
fs.mkdirSync(output, { recursive: true })

async function run() {
  const browser = await engine.launch({ headless: true, ...(engine === chromium ? { channel: 'chrome' } : {}) })
  const errors = [], mutations = [], layouts = []
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => { if (request.method() !== 'GET' && new URL(request.url()).pathname.startsWith('/api/')) mutations.push(request.url()) })
    const footer = page.locator('.oc-public-footer')
    const word = page.locator('.oc-footer-letters')
    const letters = page.locator('.oc-footer-letter')
    const open = async audience => {
      const response = await page.goto(`${base}/?audience=${audience}&utm_source=footer-qa#top`, { waitUntil: 'networkidle' })
      assert.equal(response.status(), 200)
      await page.waitForFunction(a => document.querySelector('#product-journey')?.dataset.perspective === a && document.querySelectorAll('#product-journey').length === 1, audience)
      await page.waitForFunction(() => document.querySelectorAll('.oc-public-footer').length === 1 && document.querySelector('.oc-footer-field')?.getBoundingClientRect().width > 0)
      await page.evaluate(() => document.fonts.ready)
      await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }))
    }
    const offsets = () => letters.evaluateAll(els => els.map(el => {
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform)
      return { x: m.m41, y: m.m42 }
    }))
    const rest = async () => {
      await page.mouse.move(0, 0)
      await page.waitForFunction(() => [...document.querySelectorAll('.oc-footer-letter')].every(el => !el.style.transform))
    }
    const screenshots = async label => {
      await page.locator('.oc-public-nav').evaluate(el => { el.style.visibility = 'hidden' })
      await footer.screenshot({ path: path.join(output, `${label}.png`) })
      await page.locator('.oc-public-nav').evaluate(el => { el.style.visibility = '' })
    }
    for (const [width, height] of [[1920,1080],[1440,1000],[1024,900],[768,1024],[390,844],[320,844],[844,390]]) {
      await page.setViewportSize({ width, height })
      let studentText
      for (const audience of ['student', 'leader']) {
        await open(audience)
        const layout = await page.evaluate(() => {
          const f = document.querySelector('.oc-footer-field'), w = document.querySelector('.oc-footer-letters')
          const foot = f.closest('footer'), cta = document.querySelector('.oc-final-invitation')
          const controls = [...foot.querySelectorAll('a,button')]
          return { ratio: w.getBoundingClientRect().width / f.getBoundingClientRect().width, overflow: document.documentElement.scrollWidth > innerWidth, ctaBackground: getComputedStyle(cta).backgroundColor, footerBackground: getComputedStyle(foot).backgroundColor, targets: controls.map(el => ({ label: el.textContent.trim() || el.getAttribute('aria-label'), height: el.getBoundingClientRect().height })), labelCount: f.querySelectorAll('.sr-only').length, hiddenLetters: w.getAttribute('aria-hidden') }
        })
        assert.ok(layout.ratio >= .90 && layout.ratio <= .95, `wordmark scale ${width}: ${layout.ratio}`)
        assert.equal(layout.overflow, false, `overflow at ${width}`)
        assert.equal(layout.ctaBackground, layout.footerBackground)
        assert.ok(layout.targets.every(target => target.height >= 44), '44px footer targets')
        assert.equal(layout.labelCount, 1)
        assert.equal(layout.hiddenLetters, 'true')
        const text = await footer.innerText()
        if (audience === 'student') studentText = text
        else assert.equal(text, studentText, 'audiences share the same footer')
        layouts.push({ width, height, audience, ...layout })
        await screenshots(`footer-${width}-${audience}`)
      }
    }
    console.log('PASS responsive footer, audience parity, touch targets and connected CTA at seven viewport sizes')

    await page.setViewportSize({ width: 1440, height: 1000 })
    await open('student')
    for (const label of ['Privacy', 'Terms', 'Contact']) {
      await footer.getByRole('button', { name: label, exact: true }).click()
      await page.getByRole('dialog').getByRole('heading', { name: label, exact: true }).waitFor()
      await page.keyboard.press('Escape')
      await page.getByRole('dialog').waitFor({ state: 'hidden' })
      await page.waitForFunction(label => document.activeElement?.textContent.trim() === label, label)
      assert.equal(await footer.getByRole('button', { name: label, exact: true }).evaluate(el => el === document.activeElement), true)
    }
    await page.evaluate(() => { window.footerDocumentMarker = 'same-document' })
    await footer.getByRole('link', { name: 'For Club Leaders', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('#product-journey')?.dataset.perspective === 'leader' && Math.abs(document.querySelector('#about').getBoundingClientRect().top - 112) < 2)
    assert.equal(await page.evaluate(() => window.footerDocumentMarker), 'same-document')
    assert.match(page.url(), /utm_source=footer-qa/)
    assert.match(page.url(), /audience=leader/)
    await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }))
    await footer.getByRole('link', { name: 'For Students', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('#product-journey')?.dataset.perspective === 'student')
    assert.equal(await page.evaluate(() => window.footerDocumentMarker), 'same-document')
    console.log('PASS existing dialogs, keyboard focus restoration and same-document audience navigation')

    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }))
    await page.waitForTimeout(150)
    const point = await letters.nth(3).boundingBox()
    const x = point.x + point.width / 2 - 35, y = point.y + point.height / 2 - 50
    await page.mouse.move(x, y)
    await page.waitForTimeout(500)
    const displaced = await offsets()
    assert.ok(Math.hypot(displaced[3].x, displaced[3].y) > 1, 'near letter repels')
    assert.ok(displaced[3].x > 0 && displaced[3].y > 0, 'repulsion moves away from the pointer')
    assert.equal(Math.hypot(displaced[0].x, displaced[0].y), 0, 'far letter unaffected')
    assert.ok(displaced.every(p => Math.hypot(p.x,p.y) <= 22), 'restrained displacement')
    await screenshots('footer-cursor-active')
    await page.mouse.move(0, 0)
    await page.waitForTimeout(80)
    const returning = await offsets()
    assert.ok(Math.hypot(returning[3].x,returning[3].y) > 0, 'return does not snap')
    assert.ok(Math.hypot(returning[3].x,returning[3].y) < Math.hypot(displaced[3].x,displaced[3].y), 'damped return')
    await rest()
    const box = await word.boundingBox()
    for (let i = 0; i < 40; i++) await page.mouse.move(box.x + box.width * ((i * 7 % 37) / 37), box.y + box.height * ((i * 3 % 11) / 11))
    assert.ok((await offsets()).every(p => Math.hypot(p.x,p.y) <= 22), 'fast motion remains bounded')
    const bounded = await letters.evaluateAll(els => { const f = els[0].closest('.oc-footer-field').getBoundingClientRect(); return els.every(el => { const b = el.getBoundingClientRect(); return b.left >= f.left && b.right <= f.right && b.top >= f.top && b.bottom <= f.bottom }) })
    assert.equal(bounded, true, 'letters stay inside field')
    await rest()
    await page.evaluate(() => {
      window.footerWrites = 0
      window.footerObserver = new MutationObserver(records => { window.footerWrites += records.length })
      window.footerObserver.observe(document.querySelector('.oc-footer-letters'), { subtree: true, attributes: true, attributeFilter: ['style'] })
    })
    await page.waitForTimeout(350)
    assert.equal(await page.evaluate(() => window.footerWrites), 0, 'settled footer does no animation work')
    await page.mouse.move(x,y)
    await page.waitForTimeout(150)
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }))
    await page.waitForTimeout(150)
    assert.ok((await offsets()).every(p => p.x === 0 && p.y === 0), 'offscreen motion resets')
    await page.evaluate(() => { window.footerWrites = 0 })
    await page.waitForTimeout(350)
    assert.equal(await page.evaluate(() => window.footerWrites), 0, 'offscreen footer does no animation work')
    await page.evaluate(() => window.footerObserver.disconnect())
    console.log('PASS cursor repulsion, spring return, fast movement, field bounds and zero idle/offscreen writes')

    await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }))
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const reducedBox = await letters.nth(3).boundingBox()
    await page.mouse.move(reducedBox.x + 15, reducedBox.y + 40)
    await page.waitForTimeout(200)
    assert.ok((await offsets()).every(p => p.x === 0 && p.y === 0))
    await footer.getByRole('link', { name: 'Back to Top', exact: true }).focus()
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => scrollY === 0 && location.hash === '#top')
    assert.equal(await page.locator('.oc-public-logo').evaluate(el => el === document.activeElement), true)
    assert.match(page.url(), /utm_source=footer-qa/)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }))
    await footer.getByRole('link', { name: 'Back to Top', exact: true }).click()
    assert.ok(await page.evaluate(() => scrollY > 0), 'normal back to top begins a smooth scroll')
    await page.waitForFunction(() => scrollY === 0)
    console.log('PASS reduced motion and smooth/instant keyboard-accessible Back to Top')

    for (const route of ['/about','/uva','/request-school','/signup','/login']) {
      const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle' })
      assert.equal(response.status(), 200, route)
      if (['/about','/uva','/request-school'].includes(route)) {
        await page.waitForFunction(() => document.querySelectorAll('.oc-public-footer').length === 1 && document.querySelector('.oc-footer-field')?.getBoundingClientRect().width > 0)
        await footer.waitFor()
        await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }))
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
        assert.match(await footer.innerText(), /not an official University of Virginia service/)
        await screenshots(`footer-${route.slice(1)}`)
        await footer.getByRole('link', { name: 'Back to Top', exact: true }).click()
        await page.waitForFunction(() => scrollY === 0)
      }
    }
    await page.goto(`${base}/uva#faq`, { waitUntil: 'networkidle' })
    await page.locator('#faq').waitFor()
    console.log('PASS every footer page destination, FAQ anchor and information-page footer')

    const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
    const mobile = await touch.newPage()
    await mobile.goto(base, { waitUntil: 'networkidle' })
    await mobile.waitForFunction(() => document.querySelectorAll('.oc-public-footer').length === 1 && document.querySelector('.oc-footer-field')?.getBoundingClientRect().width > 0)
    await mobile.locator('.oc-public-footer').scrollIntoViewIfNeeded()
    await mobile.evaluate(() => document.fonts.ready)
    await mobile.locator('.oc-footer-letter').nth(3).hover()
    await mobile.waitForTimeout(250)
    assert.equal(await mobile.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches), false)
    assert.equal(await mobile.locator('.oc-footer-letter').evaluateAll(els => els.every(el => !el.style.transform)), true)
    await mobile.getByRole('link', { name: 'Back to Top', exact: true }).tap()
    await mobile.waitForFunction(() => scrollY === 0)
    await touch.close()
    assert.deepEqual(errors, [])
    assert.deepEqual(mutations, [])
    fs.writeFileSync(path.join(output,'footer-verification.json'), JSON.stringify({ engine: engine === chromium ? 'chrome' : 'webkit', layouts, displaced, returning, errors, mutations, idleStyleWrites: 0, offscreenStyleWrites: 0 }, null, 2))
    console.log('PASS static touch composition, no page errors and no API mutations')
  } finally { await browser.close() }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
