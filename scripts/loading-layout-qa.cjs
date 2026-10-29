// Actual design-system route: inspect abstract states that need specific live data
// to reach naturally (interview session, candidate presentation, decision paper).
// This validates component geometry, not authenticated destination workflows.
const fs = require('node:fs'), assert = require('node:assert/strict'), { chromium } = require('playwright')
async function main() {
  const browser = await chromium.launch({ headless: true }), results = [], output = 'docs/loading-experience/evidence'
  try {
    for (const width of [1440, 1280, 768, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      await page.goto('http://127.0.0.1:3147/design-system', { waitUntil: 'domcontentloaded' })
      const reference = page.getByRole('region', { name: 'Loading layout reference' })
      for (const layout of ['interview', 'voting', 'presentation', 'form', 'document', 'calendar', 'schedule', 'feed', 'table']) {
        await reference.getByRole('combobox').selectOption(layout)
        const loader = reference.locator('[data-slot="loading-state"]')
        assert.equal(await loader.getAttribute('data-layout'), layout)
        assert.equal(await reference.getByRole('status').count(), 1)
        assert.equal(await loader.locator('button,input,a').count(), 0, 'Decorative skeletons must never steal focus')
        assert.equal(await loader.evaluate(el => el.scrollWidth <= el.clientWidth), true)
        if (layout === 'interview' || layout === 'presentation' || layout === 'voting') {
          const avatar = loader.locator('.rounded-full').first()
          assert.equal(await avatar.evaluate(el => parseFloat(getComputedStyle(el).borderRadius) >= el.getBoundingClientRect().width / 2), true, 'Avatar placeholders retain circular geometry')
        }
        await page.emulateMedia({ reducedMotion: 'reduce' })
        assert.equal(await loader.locator('[data-slot="skeleton"]').evaluateAll(nodes => nodes.every(el => getComputedStyle(el, '::after').animationName === 'none')), true)
        await page.emulateMedia({ reducedMotion: 'no-preference' })
        const screenshot = `layout-${layout}-${width}.png`
        await reference.screenshot({ path: `${output}/${screenshot}`, animations: 'disabled' })
        results.push({ layout, width, screenshot, reducedMotion: 'static', statusCount: 1, focusablePlaceholders: 0 })
      }
      await page.close()
      console.log(`${width}px: nine contextual layouts fit, one status, decorative, reduced motion static`)
    }
  } finally { fs.writeFileSync(`${output}/layout-results.json`, JSON.stringify(results, null, 2) + '\n'); await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
