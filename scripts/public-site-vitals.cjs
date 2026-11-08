/**
 * LCP, CLS and INP for public pages, signed out, against a production build (`next start`).
 * Profiles: desktop (1440, no throttling) and phone (390, 4x CPU slowdown, 150 ms RTT,
 * 1.6 Mbps down / 750 kbps up). Cold = new context (empty cache); warm = second load in
 * the same context. INP is the longest event-timing duration for one real tap/click on
 * the page's first interactive control (menu, audience toggle, or field). Median of N runs.
 *
 *   OUTCLASS_VITALS_URL=http://127.0.0.1:3201 OUTCLASS_VITALS_OUT=docs/public-site/vitals-before.json node scripts/public-site-vitals.cjs
 */
const fs = require('node:fs')
const { chromium } = require('playwright')

const base = process.env.OUTCLASS_VITALS_URL || 'http://127.0.0.1:3000'
const runs = Number(process.env.OUTCLASS_VITALS_RUNS || 3)
const club = process.env.OUTCLASS_AUDIT_CLUB || 'vcg-uva'
const only = (process.env.OUTCLASS_VITALS_ONLY || '').split(',').filter(Boolean)
const pages = [['/', '/'], ['/uva', '/uva'], ['/club/[id]', `/club/${club}`], ['/login', '/login']].filter(([name]) => !only.length || only.includes(name))
const profiles = {
  desktop: { context: { viewport: { width: 1440, height: 1000 } }, throttle: null },
  phone: { context: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, throttle: { cpu: 4, latency: 150, down: 1.6e6 / 8, up: 750e3 / 8 } },
}
// Non-navigating controls only (a link or a navigating button would measure the next page).
const interactions = ['.oc-public-menu-toggle', '[data-segment]', 'input[type="email"]', 'details summary', 'h1']

const observe = () => {
  window.__vitals = { lcp: 0, cls: 0, inp: 0, lcpElement: '', content: 0 }
  // First frame where the page's h1 is painted and no full-screen loading cover is present.
  const poll = () => { const h1 = document.querySelector('h1'); const r = h1?.getBoundingClientRect(); if (r && r.width && !document.querySelector('.oc-loading-screen')) window.__vitals.content = performance.now(); else requestAnimationFrame(poll) }
  requestAnimationFrame(poll)
  new PerformanceObserver(list => { for (const e of list.getEntries()) { window.__vitals.lcp = e.startTime; window.__vitals.lcpElement = (e.element?.tagName || '') + (e.element?.className ? '.' + String(e.element.className).split(' ')[0] : '') } }).observe({ type: 'largest-contentful-paint', buffered: true })
  new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__vitals.cls += e.value }).observe({ type: 'layout-shift', buffered: true })
  new PerformanceObserver(list => { for (const e of list.getEntries()) if (e.interactionId) window.__vitals.inp = Math.max(window.__vitals.inp, e.duration) }).observe({ type: 'event', buffered: true, durationThreshold: 16 })
}

async function load(context, profile, url) {
  const page = await context.newPage()
  if (profile.throttle) {
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.throttle.cpu })
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: profile.throttle.latency, downloadThroughput: profile.throttle.down, uploadThroughput: profile.throttle.up })
  }
  await page.addInitScript(observe)
  await page.goto(base + url, { waitUntil: 'load', timeout: 120000 })
  await page.waitForTimeout(profile.throttle ? 4000 : 1500)
  // LCP and CLS are read before any interaction; INP after one interaction on the same URL.
  const loaded = await page.evaluate(() => ({ ...window.__vitals }))
  const loadedUrl = new URL(page.url()).pathname
  for (const selector of interactions) {
    const target = page.locator(selector).first()
    if (await target.isVisible().catch(() => false)) {
      if (profile.context.hasTouch) await target.tap({ timeout: 5000, noWaitAfter: true }).catch(() => {})
      else await target.click({ timeout: 5000, noWaitAfter: true, trial: false }).catch(() => {})
      break
    }
  }
  await page.waitForTimeout(800)
  const after = await page.evaluate(() => window.__vitals)
  const vitals = { ...loaded, inp: new URL(page.url()).pathname === loadedUrl ? after.inp : NaN }
  if (process.env.OUTCLASS_VITALS_DEBUG) vitals.target = await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 120))
  await page.close()
  return vitals
}
const median = values => { const s = [...values].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }

;(async () => {
  const browser = await chromium.launch(process.env.OUTCLASS_CHROMIUM ? { executablePath: process.env.OUTCLASS_CHROMIUM } : {})
  const results = []
  try {
    for (const [name, url] of pages) for (const [profileName, profile] of Object.entries(profiles)) {
      const samples = { cold: [], warm: [] }
      for (let i = 0; i < runs; i++) {
        const context = await browser.newContext(profile.context)
        samples.cold.push(await load(context, profile, url))
        samples.warm.push(await load(context, profile, url))
        await context.close()
      }
      for (const state of ['cold', 'warm']) {
        const s = samples[state]
        const row = { page: name, profile: profileName, state, lcp: Math.round(median(s.map(v => v.lcp))), cls: +median(s.map(v => v.cls)).toFixed(3), inp: Math.round(median(s.map(v => v.inp))), content: Math.round(median(s.map(v => v.content))), lcpElement: s[0].lcpElement }
        results.push(row)
        console.log(`${name.padEnd(11)} ${profileName.padEnd(8)} ${state}  LCP ${String(row.lcp).padStart(5)} ms  CLS ${row.cls.toFixed(3)}  INP ${String(row.inp).padStart(4)} ms  content ${String(row.content).padStart(5)} ms  (${row.lcpElement})`)
      }
    }
  } finally { await browser.close() }
  if (process.env.OUTCLASS_VITALS_OUT) fs.writeFileSync(process.env.OUTCLASS_VITALS_OUT, JSON.stringify({ base, runs, measuredAt: new Date().toISOString(), results }, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 })
