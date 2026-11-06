// Real browser, real FocusFrame + useFocusFrame (bundled), stubbed Next router/link/logo.
// Proves Exit's return route, registration merge/cleanup, onExit, and the projector bar reveal.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const { chromium } = require('playwright')
const { bundle } = require('./helpers/browser-bundle.cjs')

test('browser: focus frame Exit target, registration merge and cleanup, onExit, projector bar', { timeout: 120000 }, async () => {
  const mocks = {
    'next/navigation': "exports.usePathname=()=>location.pathname;",
    'next/link': "const React=require('react');exports.__esModule=true;exports.default=({href,children,...rest})=>React.createElement('a',{href,...rest},children);",
    '@/components/outclass-logo': "const React=require('react');exports.OutClassLogo=()=>React.createElement('img',{alt:'OutClass'});",
    '@/contexts/auth-context': "exports.useAuth=()=>({user:window.fixtureUser?{id:window.fixtureUser}:null});",
    '@/contexts/demo-context': "exports.useDemoMode=()=>({isDemoEnabled:false});",
  }
  const entry = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{FocusFrame,useFocusFrame,rememberProductRoute,productRouteAccount}from'@/components/shell/focus-frame';window.fixtureUser=localStorage.getItem('fixture-user');
function Screen({task,club,onExit}){useFocusFrame({task,club,onExit});return <p>screen {task||''}</p>}
function App(){const[step,setStep]=useState(0);window.setStep=setStep;window.exits=window.exits||0;window.remember=()=>rememberProductRoute(productRouteAccount(window.fixtureUser,false));const present=new URLSearchParams(location.search).get('view')==='present';
if(present)return <FocusFrame><div data-theme="present" className="oc-present-surface"><button style={{margin:20}} onClick={()=>{window.qr=(window.qr||0)+1}}>Join QR</button></div></FocusFrame>;
return <FocusFrame>{step>=1&&<Screen task="Interview · Round 2" club={{name:'Synthetic Club',color:'#123456'}}/>}{step>=2&&<Screen task={undefined} club={undefined} onExit={step>=3?()=>{window.exits++}:undefined}/>}</FocusFrame>}
createRoot(document.getElementById('root')).render(<App/>)`
  const js = bundle(entry, mocks)
  const css = fs.readFileSync('styles/tokens.css', 'utf8') + fs.readFileSync('components/shell/focus-frame.css', 'utf8')
    // Tailwind preflight and sr-only, as in the app.
    + 'body{margin:0}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}.sr-only:focus{position:fixed;width:auto;height:auto;clip:auto}'
  const server = http.createServer((req, res) => {
    if (req.url === '/fixture.js') { res.setHeader('content-type', 'text/javascript'); res.end(js); return }
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.end(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="root"></div><script src="/fixture.js"></script>`)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage(), errors = []
    page.on('pageerror', e => errors.push(e.message))
    const exitHref = () => page.locator('.oc-focus-exit').getAttribute('href')

    // Empty storage: /home. The product shell records the page; the frame offers it.
    await page.goto(base + '/check-in'); await page.locator('.oc-focus-bar').waitFor()
    assert.equal(await exitHref(), '/home')
    assert.equal(await page.locator('.oc-focus-task').textContent(), 'Meeting check-in')
    await page.goto(base + '/clubs/meetings?q=1'); await page.evaluate(() => window.remember())
    assert.deepEqual(await page.evaluate(() => JSON.parse(sessionStorage.getItem('outclass.last-product-route'))), { href: '/clubs/meetings?q=1', account: 'live:anonymous' })
    await page.goto(base + '/check-in'); await page.waitForFunction(() => document.querySelector('.oc-focus-exit')?.getAttribute('href') === '/clubs/meetings?q=1')
    // Another account's page (sign-out then sign-in in the same tab) is not offered.
    await page.evaluate(() => localStorage.setItem('fixture-user', 'someone-else')); await page.goto(base + '/check-in'); await page.locator('.oc-focus-bar').waitFor(); await page.waitForTimeout(50)
    assert.equal(await exitHref(), '/home')
    await page.evaluate(() => localStorage.removeItem('fixture-user'))
    // A focus URL or an external URL in storage is ignored.
    for (const bad of ['/q/abc', '//evil.test/x', 'https://evil.test']) {
      await page.evaluate(value => sessionStorage.setItem('outclass.last-product-route', JSON.stringify({ href: value, account: 'live:anonymous' })), bad)
      await page.goto(base + '/check-in'); await page.locator('.oc-focus-bar').waitFor(); await page.waitForTimeout(50)
      assert.equal(await exitHref(), '/home', bad)
    }
    // remember() on a focus page does not overwrite the stored product page.
    await page.evaluate(() => { sessionStorage.setItem('outclass.last-product-route', JSON.stringify({ href: '/clubs', account: 'live:anonymous' })); window.remember() })
    assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('outclass.last-product-route')).href), '/clubs')

    // A screen names its task and club; a later registration with undefined values keeps them.
    await page.evaluate(() => window.setStep(1))
    await page.waitForFunction(() => document.querySelector('.oc-focus-task')?.textContent === 'Interview · Round 2')
    assert.equal(await page.locator('.oc-focus-club').textContent(), 'Synthetic Club')
    assert.equal(await page.locator('[data-focus-frame]').evaluate(el => el.style.getPropertyValue('--oc-club-accent')), '#123456')
    await page.evaluate(() => window.setStep(2)); await page.waitForTimeout(50)
    assert.equal(await page.locator('.oc-focus-task').textContent(), 'Interview · Round 2')
    // onExit turns Exit into a button that runs the screen's handler instead of navigating.
    await page.evaluate(() => window.setStep(3))
    await page.getByRole('button', { name: 'Exit', exact: true }).click()
    assert.equal(await page.evaluate(() => window.exits), 1); assert.equal(new URL(page.url()).pathname, '/check-in')
    // Unmounting the screens restores the route defaults.
    await page.evaluate(() => window.setStep(0))
    await page.waitForFunction(() => document.querySelector('.oc-focus-task')?.textContent === 'Meeting check-in')
    assert.equal(await page.locator('.oc-focus-club').count(), 0); assert.equal(await page.getByRole('link', { name: 'Exit', exact: true }).count(), 1)

    // Projector: the page's marker makes the surface and the bar dark; the slide keeps the whole screen.
    await page.goto(base + '/voting/rooms/x?view=present')
    await page.locator('.oc-present-surface').waitFor()
    assert.equal(await page.locator('.oc-present-surface').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(15, 28, 43)')
    assert.equal(await page.locator('.oc-focus-bar').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(22, 38, 56)')
    assert.equal(await page.locator('.oc-present-surface').evaluate(el => Math.round(el.getBoundingClientRect().top)), 0)
    // The hidden bar takes no clicks: a control at the top of the slide works and Exit is not hit.
    await page.getByRole('button', { name: 'Join QR', exact: true }).click()
    assert.equal(await page.evaluate(() => window.qr), 1); assert.equal(new URL(page.url()).pathname, '/voting/rooms/x')
    const bar = page.locator('.oc-focus-bar')
    assert.equal(await bar.evaluate(el => getComputedStyle(el).position), 'fixed')
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.oc-focus-bar')).opacity === '0')
    await page.locator('a[href="#focus-content"]').focus(); await page.keyboard.press('Tab') // after the skip link, Exit is next
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Exit')
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.oc-focus-bar')).opacity === '1')
    await page.mouse.click(640, 400); await page.evaluate(() => document.activeElement?.blur())
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.oc-focus-bar')).opacity === '0')
    await page.mouse.move(640, 2); await page.waitForFunction(() => getComputedStyle(document.querySelector('.oc-focus-bar')).opacity === '1')
    await page.mouse.move(640, 20); await page.waitForTimeout(400)
    assert.equal(await bar.evaluate(el => getComputedStyle(el).opacity), '1', 'stays open while the pointer is on the bar')
    assert.deepEqual(errors, [])
  } finally {
    await browser?.close(); await new Promise(resolve => server.close(resolve))
  }
})
