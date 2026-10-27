/** Compare saved pre-change and current real-shell fixtures, without Axe or
 * screenshot overhead in the measured contexts. Local synthetic measurements;
 * these are not field INP or mobile-device benchmarks. */
const fs = require('node:fs/promises')
const assert = require('node:assert/strict')
const { chromium } = require('playwright')
const urls = { before: process.env.OUTCLASS_BASELINE_SHELL_URL, after: process.env.OUTCLASS_SHELL_BASE_URL }

async function sampleFrames(page, action) {
  await page.evaluate(() => {
    window.frameSamples = []; window.lastFrame = 0
    window.frameProbe = () => {
      const now = performance.now()
      if (window.lastFrame) window.frameSamples.push(now - window.lastFrame)
      window.lastFrame = now
      window.frameHandle = requestAnimationFrame(window.frameProbe)
    }
    window.frameHandle = requestAnimationFrame(window.frameProbe)
  })
  await action()
  return page.evaluate(() => {
    cancelAnimationFrame(window.frameHandle)
    const values = window.frameSamples.sort((a, b) => a - b)
    return { frames: values.length, medianMs: +values[Math.floor(values.length * .5)].toFixed(2), p95Ms: +values[Math.floor(values.length * .95)].toFixed(2), over34Ms: values.filter(v => v > 34).length }
  })
}

async function run() {
  for (const url of Object.values(urls)) assert.ok(url && ['127.0.0.1', 'localhost'].includes(new URL(url).hostname), 'Provide both local fixture URLs')
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const report = { note: 'Same local Chrome, isolated fixture contexts, three samples per size. Frame intervals include compositor work; hover uses real pointer events. GC-normalized JS heap is diagnostic, not a leak proof.', samples: {} }
  try {
    for (const [label, base] of Object.entries(urls)) {
      const samples = []
      for (const [width, height] of [[1440, 900], [390, 844]]) {
        for (let run = 0; run < 3; run++) {
          const context = await browser.newContext({ viewport: { width, height } })
          const page = await context.newPage()
          await page.goto(`${base}/club/fixture-mii/workspace?section=recruitment&role=president`, { waitUntil: 'networkidle' })
          await page.evaluate(() => document.fonts.ready)
          const cdp = await context.newCDPSession(page)
          await cdp.send('Performance.enable')
          await cdp.send('HeapProfiler.collectGarbage')
          const before = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(v => [v.name, v.value]))
          const scroll = await sampleFrames(page, () => page.evaluate(async () => {
            const start = performance.now()
            await new Promise(resolve => {
              function tick(now) {
                scrollTo(0, Math.round((Math.sin((now - start) / 450) + 1) * 350))
                if (now - start < 2200) requestAnimationFrame(tick)
                else resolve()
              }
              requestAnimationFrame(tick)
            })
          }))
          let hover = null
          if (width === 1440) hover = await sampleFrames(page, async () => {
            await page.evaluate(() => scrollTo(0, 0))
            const items = page.locator('aside [data-dock-item]')
            for (let cycle = 0; cycle < 3; cycle++) {
              for (let index = 0; index < Math.min(6, await items.count()); index++) {
                const bounds = await items.nth(index).boundingBox()
                await page.mouse.move(bounds.x + 30, bounds.y + bounds.height / 2, { steps: 4 })
                await page.waitForTimeout(80)
              }
              await page.mouse.move(900, 650)
              await page.waitForTimeout(600)
            }
          })
          await cdp.send('HeapProfiler.collectGarbage')
          const after = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(v => [v.name, v.value]))
          samples.push({ width, run: run + 1, scroll, hover, initialHeapMB: +(before.JSHeapUsedSize / 1048576).toFixed(2), settledHeapMB: +(after.JSHeapUsedSize / 1048576).toFixed(2), initialNodes: before.Nodes, settledNodes: after.Nodes })
          await context.close()
        }
      }
      report.samples[label] = samples
    }
    await fs.mkdir('test-results/liquid-glass', { recursive: true })
    await fs.writeFile('test-results/liquid-glass/performance-comparison.json', JSON.stringify(report, null, 2) + '\n')
    for (const [label, samples] of Object.entries(report.samples)) {
      for (const width of [1440, 390]) {
        const group = samples.filter(s => s.width === width)
        console.log(JSON.stringify({ label, width, scrollP95: group.map(s => s.scroll.p95Ms), hoverP95: group.map(s => s.hover?.p95Ms ?? null), framesOver34Ms: group.reduce((n, s) => n + s.scroll.over34Ms + (s.hover?.over34Ms ?? 0), 0), heapMB: group.map(s => s.settledHeapMB), nodes: group.map(s => [s.initialNodes, s.settledNodes]) }))
      }
    }
  } finally { await browser.close() }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
