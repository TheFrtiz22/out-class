/**
 * Signed-out audit of every public page: screenshots (1440 + 390), status, title,
 * server-HTML headings, horizontal overflow, text below 12px, tap targets below 44px
 * and axe. Every page opens in a fresh browser context (no cookies, no storage), so
 * nothing here can use a signed-in session. Never submits a form.
 *
 *   OUTCLASS_AUDIT_URL=http://127.0.0.1:3201 OUTCLASS_AUDIT_OUT=docs/public-site/before node scripts/public-site-audit.cjs
 *
 * OUTCLASS_AUDIT_CLUB selects the club profile; OUTCLASS_AUDIT_ONLY=name,name limits pages.
 */
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')
const AxeBuilder = require('@axe-core/playwright').default

const base = process.env.OUTCLASS_AUDIT_URL || 'http://127.0.0.1:3000'
const out = process.env.OUTCLASS_AUDIT_OUT || 'test-results/public-site'
const club = process.env.OUTCLASS_AUDIT_CLUB || 'vcg-uva'
const only = (process.env.OUTCLASS_AUDIT_ONLY || '').split(',').filter(Boolean)
const zero = '00000000-0000-4000-8000-000000000000'
const pages = [
  ['home-students', '/?audience=student'],
  ['home-leaders', '/?audience=leader'],
  ['uva', '/uva'],
  ['about', '/about'],
  ['request-school', '/request-school'],
  ['club', `/club/${club}`],
  ['login', '/login'],
  ['signup', '/signup'],
  ['forgot-password', '/forgot-password'],
  ['reset-password', '/reset-password'],
  ['corkboard', '/corkboard'],
  ['explore', '/explore'],
  ['invitation', `/invitations/${zero}`],
  ['club-access', `/club-access/${club}`],
  ['club-claims', `/club-claims/${club}`],
  ['check-in', '/check-in'],
  ['interviews-book', '/interviews/book'],
  ['voting-join', `/voting/${zero}/join`],
  ['short-link', '/q/NOPE1234'],
  ['not-found', '/this-page-does-not-exist'],
  ['privacy', '/privacy'],
  ['terms', '/terms'],
].filter(([name]) => !only.length || only.includes(name))
const widths = [
  ['1440', { viewport: { width: 1440, height: 1000 } }],
  ['390', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }],
]
const modes = [
  ['reduced-motion', { reducedMotion: 'reduce' }],
  ['forced-colors', { forcedColors: 'active' }],
]
const modePages = new Set(['home-students', 'club', 'login'])

async function measure(page) {
  return page.evaluate(() => {
    const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('[aria-hidden="true"],[inert]') }
    const label = el => (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60)
    const small = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const seen = new Set()
    while (walker.nextNode()) {
      const el = walker.currentNode.parentElement
      if (!el || seen.has(el) || !walker.currentNode.textContent.trim() || !visible(el)) continue
      seen.add(el)
      const size = parseFloat(getComputedStyle(el).fontSize)
      if (size < 12) small.push(`${size}px ${label(el)}`)
    }
    const targets = [...document.querySelectorAll('a[href],button,[role="button"],[role="tab"],[role="radio"],input[type="checkbox"],input[type="radio"],summary')]
      .filter(visible).filter(el => !el.closest('p,li:not([role]),dd') || el.matches('button,[role]'))
      .map(el => ({ el, r: el.getBoundingClientRect() })).filter(({ r }) => r.height < 44 || r.width < 24)
      .map(({ el, r }) => `${Math.round(r.width)}x${Math.round(r.height)} ${el.tagName.toLowerCase()} ${label(el)}`)
    return {
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      h1: [...document.querySelectorAll('h1')].filter(visible).map(label),
      loadingCover: !!document.querySelector('.oc-loading-screen'),
      smallText: small.slice(0, 40), smallTextCount: small.length,
      smallTargets: targets.slice(0, 40), smallTargetCount: targets.length,
    }
  })
}

;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch(process.env.OUTCLASS_CHROMIUM ? { executablePath: process.env.OUTCLASS_CHROMIUM } : {})
  const report = []
  try {
    for (const [name, url] of pages) {
      const raw = await fetch(base + url, { redirect: 'manual' })
      const html = raw.status >= 300 && raw.status < 400 ? '' : await raw.text()
      const server = {
        status: raw.status, location: raw.headers.get('location'),
        title: (html.match(/<title>([^<]*)<\/title>/) || [])[1] || null,
        description: (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || null,
        ogImage: /property="og:image"/.test(html),
        robots: (html.match(/<meta name="robots" content="([^"]*)"/) || [])[1] || null,
        h1: [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map(m => m[1].replace(/<[^>]+>/g, '').trim()),
        headings: [...html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/g)].map(m => `h${m[1]} ${m[2].replace(/<[^>]+>/g, '').trim().slice(0, 50)}`),
        loadingCover: /oc-loading-screen/.test(html),
      }
      const entry = { name, url, server, widths: {} }
      for (const [width, options] of [...widths, ...(modePages.has(name) ? modes.map(([m, o]) => [m, { ...widths[0][1], ...o }]) : [])]) {
        const context = await browser.newContext(options)
        const page = await context.newPage()
        const errors = []
        page.on('pageerror', error => errors.push(error.message.slice(0, 160)))
        let status = null
        try {
          const response = await page.goto(base + url, { waitUntil: 'load', timeout: 60000 })
          status = response?.status() ?? null
          await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
          await page.waitForTimeout(800)
          const metrics = await measure(page)
          await page.screenshot({ path: path.join(out, `${name}-${width}.jpg`), type: 'jpeg', quality: 60, fullPage: true, timeout: 60000 }).catch(async () => page.screenshot({ path: path.join(out, `${name}-${width}.jpg`), type: 'jpeg', quality: 60 }))
          let axe = null
          if (width === '1440' || width === '390' || width === 'forced-colors') {
            const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
            axe = result.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, sample: v.nodes[0]?.target?.join(' ') }))
          }
          entry.widths[width] = { status, finalUrl: page.url().replace(base, ''), ...metrics, axe, errors }
        } catch (error) {
          entry.widths[width] = { status, error: error.message.slice(0, 200), errors }
        }
        await context.close()
      }
      report.push(entry)
      const w = entry.widths
      console.log(`${name.padEnd(16)} ${server.status} ${String(server.title).slice(0, 44).padEnd(44)} h1:${server.h1.length} overflow390:${w['390']?.overflowX} small:${w['390']?.smallTextCount} taps:${w['390']?.smallTargetCount} axe:${['1440', '390'].map(k => (w[k]?.axe || []).filter(v => ['serious', 'critical'].includes(v.impact)).length).join('/')}`)
    }
  } finally {
    await browser.close()
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 })
