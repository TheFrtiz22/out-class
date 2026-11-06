const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const ts = require('typescript')
const React = require('react')
const { renderToString } = require('react-dom/server')
const { chromium } = require('playwright')
const { bundle } = require('./helpers/browser-bundle.cjs')
function load(file) {
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText)(name => name.endsWith('.css') ? {} : name.startsWith('@/') ? load(['.ts', '.tsx'].map(ext => path.resolve(name.slice(2) + ext)).find(fs.existsSync)) : require(name), mod, mod.exports)
  return mod.exports
}

test('browser: hydrates safely, follows local time and workspace changes, and fits iPhone/desktop', async () => {
  const { WelcomeHeader } = load('components/product/welcome-header.tsx')
  const personal = { mode: 'personal', applications: [{ id: 'app', clubId: 'one', status: 'SUBMITTED', club: { name: 'One' } }], events: [], memberClubIds: [] }
  const membership = { id: 'member', status: 'ACTIVE', permissions: ['applications.review'] }
  const club = { mode: 'club', clubId: 'one', membership, data: { club: { id: 'one' }, membership, work: [], operations: { tasks: { overdue: 0, awaitingReview: null }, team: null, rounds: [{ pending: 12, needsBooking: 0 }], bookings: [], meetings: [], announcements: [], reviewWork: [], intake: null } } }
  const controls = ['personal', 'club', 'other', 'revoked', 'loading', 'deadline', 'long name', 'unmount']
  const headerProps = { context: personal, now: null, firstName: 'Alex', eyebrow: 'OutClass', density: 'compact' }
  const ssr = renderToString(React.createElement(React.Fragment, null, React.createElement('main', null, React.createElement(WelcomeHeader, headerProps)), React.createElement('nav', { 'aria-label': 'Test controls' }, controls.map(mode => React.createElement('button', { key: mode }, mode)))))
  const js = bundle(`import React,{useState}from'react';import{hydrateRoot}from'react-dom/client';import{LocalWelcomeHeader as WelcomeHeader}from'@/components/product/welcome-header';const personal=${JSON.stringify(personal)},club=${JSON.stringify(club)},controls=${JSON.stringify(controls)};function App(){const[mode,setMode]=useState('personal');let context=personal;if(mode==='club')context=club;if(mode==='other')context={...club,clubId:'two'};if(mode==='revoked')context={...club,membership:{...club.membership,permissions:[]}};if(mode==='loading')context={...personal,applications:null};if(mode==='deadline')context={...personal,applications:[{...personal.applications[0],status:'DRAFTING',club:{name:'One',applicationDeadline:'2026-11-02T01:00:00Z'}}]};return <><main>{mode !== 'unmount' && <WelcomeHeader context={context} firstName={mode==='long name'?'Alexandria-Christina': 'Alex'} eyebrow="OutClass" density="compact"/>}</main><nav aria-label="Test controls">{controls.map(value=><button key={value} onClick={()=>setMode(value)}>{value}</button>)}</nav></>};hydrateRoot(document.getElementById('root'),<App/>,{onRecoverableError:error=>window.hydrationErrors.push(error.message)});`)
  const css = ['styles/tokens.css', 'styles/typography.css', 'styles/product-components.css', 'styles/editorial.css', 'components/product/welcome-header.css'].map(file => fs.readFileSync(file, 'utf8')).join('\n')
  const server = http.createServer((req, res) => {
    if (req.url === '/fixture.js') { res.setHeader('content-type', 'text/javascript'); return res.end(js) }
    if (req.url === '/display.woff2') { res.setHeader('content-type', 'font/woff2'); return res.end(fs.readFileSync('app/fonts/libre-caslon-text/libre-caslon-text-variable.woff2')) }
    if (req.url === '/sans.woff2') { res.setHeader('content-type', 'font/woff2'); return res.end(fs.readFileSync('app/fonts/source-sans-3/source-sans-3-upright.woff2')) }
    res.setHeader('content-type', 'text/html')
    res.end(`<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>@font-face{font-family:Display;src:url('/display.woff2')}@font-face{font-family:Sans;src:url('/sans.woff2')}*{box-sizing:border-box}body{margin:0;background:var(--background);color:var(--foreground)}h1,p{margin:0}main{max-width:1120px;margin:auto;padding:32px 24px}nav{margin:24px}button{margin:4px;padding:8px}${css}:root{--oc-font-display:Display,serif;--oc-font-sans:Sans,sans-serif}</style><div id="root">${ssr}</div><script>window.hydrationErrors=[]</script><script src="/fixture.js"></script>`)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true, ...(fs.existsSync(chromium.executablePath()) ? {} : { channel: 'chrome' }) })
    fs.mkdirSync('/tmp/outclass-welcome', { recursive: true })
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
      const page = await context.newPage(), errors = [], requests = []
      const cdp = await context.newCDPSession(page)
      await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' })
      page.on('pageerror', error => errors.push(error.message))
      page.on('request', request => requests.push(request.url()))
      await page.clock.install({ time: new Date('2026-11-01T11:59:59Z') })
      await page.goto(`http://127.0.0.1:${server.address().port}`)
      const heading = page.getByRole('heading', { level: 1 }), subtitle = page.locator('.oc-page-description')
      await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'Good morning, Alex.')
      assert.equal(await subtitle.textContent(), 'You have 1 application in progress.')
      await page.clock.fastForward(1000)
      assert.equal(await heading.textContent(), 'Good afternoon, Alex.')
      const initialHeight = await page.locator('[data-slot="page-header"]').evaluate(node => node.getBoundingClientRect().height)
      const choose = name => page.getByRole('button', { name, exact: true }).click()
      await choose('club'); assert.equal(await subtitle.textContent(), '12 applications are ready for your review.')
      await choose('other'); assert.equal(await subtitle.textContent(), "Here's what's happening in your club.")
      await choose('revoked'); assert.equal(await subtitle.textContent(), "Here's what's happening in your club.")
      await choose('loading'); assert.equal(await subtitle.textContent(), "Explore what's new in OutClass.")
      await choose('personal'); assert.equal(await subtitle.textContent(), 'You have 1 application in progress.')
      await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Tokyo' })
      await page.evaluate(() => dispatchEvent(new Event('focus')))
      assert.equal(await heading.textContent(), 'Still up, Alex?')
      await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' })
      await page.clock.setSystemTime(new Date('2026-11-01T23:59:59Z'))
      await choose('deadline'); await page.evaluate(() => dispatchEvent(new Event('pageshow')))
      assert.match(await subtitle.textContent(), /tomorrow/)
      await page.clock.fastForward(1000)
      assert.match(await subtitle.textContent(), /today/)
      await choose('long name')
      assert.equal(await heading.textContent(), 'Still up, Alexandria-Christina?')
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal scrolling')
      await choose('personal')
      assert.equal(await page.locator('[data-slot="page-header"]').evaluate(node => node.getBoundingClientRect().height), initialHeight, 'stable welcome geometry')
      assert.equal(await heading.locator('span').evaluate(node => getComputedStyle(node).animationName), 'none')
      assert.equal(await page.locator('[data-slot="page-header"] [aria-live],[data-slot="page-header"][aria-live],[data-slot="page-header"] [role="status"]').count(), 0)
      assert.deepEqual(await page.evaluate(() => window.hydrationErrors), [])
      assert.deepEqual(errors, [])
      assert.ok(requests.every(url => !url.includes('/api/') && !url.includes('/workspace')), 'welcome makes no data requests')
      await page.clock.setSystemTime(new Date('2026-11-01T09:00:00Z')); await page.evaluate(() => dispatchEvent(new Event('focus')))
      await page.screenshot({ path: `/tmp/outclass-welcome/${viewport.width}.png`, fullPage: true })
      await context.close()
    }
    // Fake clock installation replaces the native timer functions and can hide
    // illegal Window receivers. Exercise the real browser APIs separately.
    const nativeContext = await browser.newContext()
    try {
      const page = await nativeContext.newPage(), errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(`http://127.0.0.1:${server.address().port}`)
      await page.waitForFunction(() => /^(Good morning|Good afternoon|Good evening|Still up)/.test(document.querySelector('h1')?.textContent ?? '') || document.querySelector('#root')?.childElementCount === 0, { timeout: 3000 })
      assert.deepEqual(errors, [], 'native timer setup must not crash the dashboard')
      assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1)
      await page.evaluate(() => {
        dispatchEvent(new Event('focus'))
        dispatchEvent(new Event('pageshow'))
        document.dispatchEvent(new Event('visibilitychange'))
      })
      await page.getByRole('button', { name: 'unmount', exact: true }).click()
      assert.equal(await page.getByRole('heading', { level: 1 }).count(), 0)
      await page.getByRole('button', { name: 'personal', exact: true }).click()
      assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1)
      assert.deepEqual(errors, [], 'native timer refresh and cleanup must preserve the dashboard')
      assert.deepEqual(await page.evaluate(() => window.hydrationErrors), [])
    } finally { await nativeContext.close() }
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
})
