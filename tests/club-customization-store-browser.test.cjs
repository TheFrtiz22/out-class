// Real Chromium: the club-customization store that replaced the root-layout provider.
// Components share one state, writes persist across reloads, demo and live keys stay
// separate, storage failures are reported, and server/hydration renders read nothing.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const { chromium } = require('playwright')
const { bundle } = require('./helpers/browser-bundle.cjs')

// Demo Mode is chosen per page by ?demo, on one origin, so both keys share one localStorage.
const mocks = { '@/contexts/demo-context': "exports.useDemoMode=()=>({isDemoEnabled:new URLSearchParams(location.search).has('demo')})" }
const shared = `import React from 'react';import{useClubCustomization}from'@/lib/club-customization';
function Editor(){const{update,ready,setApplicants}=useClubCustomization('club');return <>
 <button id="rename" disabled={!ready} onClick={()=>update(p=>({...p,profile:{...p.profile,name:'Renamed club'}}))}>Rename</button>
 <button id="add-stages" disabled={!ready} onClick={()=>{update(p=>({...p,stages:[...p.stages,{id:'S'+p.stages.length,name:'Stage '+p.stages.length}]}));update(p=>({...p,stages:[...p.stages,{id:'S'+p.stages.length,name:'Stage '+p.stages.length}]}))}}>Add two stages</button>
 <button id="place" disabled={!ready} onClick={()=>setApplicants(()=>[{id:'applicant-1',status:'Round 2'}])}>Place applicant</button>
</>}
function Reader({id}){const{state,ready,configured,storageError,applicants,stageName}=useClubCustomization('club');return <p id={id} data-ready={String(ready)} data-configured={String(configured)} data-error={String(storageError)} data-stages={state.stages.length} data-applicants={applicants.length} data-round={stageName('Round 2')}>{state.profile.name}</p>}`
const main = `${shared}import{createRoot}from'react-dom/client';createRoot(document.getElementById('root')).render(<><Editor/><Reader id="a"/><Reader id="b"/></>)`
// Server render then hydration, recording the first client render and storage reads.
const hydration = `${shared}import{hydrateRoot}from'react-dom/client';import{renderToString}from'react-dom/server.browser';
let reads=0;const getItem=Storage.prototype.getItem;Storage.prototype.getItem=function(...a){reads++;return getItem.apply(this,a)};
window.__first=null;window.__recoverable=[];
function Probe(){const{state,ready}=useClubCustomization('club');if(window.__hydrating&&!window.__first)window.__first={name:state.profile.name,ready,reads};return <p id="p" data-ready={String(ready)}>{state.profile.name}</p>}
const root=document.getElementById('root');window.__server=renderToString(<Probe/>);window.__serverReads=reads;root.innerHTML=window.__server;window.__hydrating=true;
hydrateRoot(root,<Probe/>,{onRecoverableError:e=>window.__recoverable.push(String(e))})`

function serve(pages) {
  const server = http.createServer((req, res) => {
    const name = new URL(req.url, 'http://x').pathname.slice(1)
    if (name.endsWith('.js') && pages[name.slice(0, -3)]) { res.setHeader('content-type', 'text/javascript'); res.end(pages[name.slice(0, -3)]); return }
    const script = name === 'hydration' ? 'hydration' : 'main'
    res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(`<div id="root"></div><script src="/${script}.js"></script>`)
  })
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)))
}

test('club customization store: shared state, persistence, applicants, demo/live keys, storage errors, hydration', async t => {
  const server = await serve({ main: bundle(main, mocks), hydration: bundle(hydration, mocks) })
  t.after(() => server.close())
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(chromium.executablePath()) ? {} : { channel: 'chrome' }) })
  t.after(() => browser.close())
  const context = await browser.newContext(), page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  const url = (path = '') => `http://127.0.0.1:${server.address().port}/${path}`
  const live = () => page.evaluate(() => JSON.parse(localStorage.getItem('outclass.customization.v1')))

  await t.test('components share one state and writes persist', async () => {
    await page.goto(url())
    await page.locator('#a[data-ready="true"]').waitFor()
    assert.equal(await page.locator('#a').getAttribute('data-configured'), 'false')
    await page.click('#rename')
    assert.equal(await page.locator('#a').textContent(), 'Renamed club', 'the reader sees the editor write')
    assert.equal(await page.locator('#b').textContent(), 'Renamed club', 'every component shares one state')
    assert.equal(await page.locator('#b').getAttribute('data-configured'), 'true')
    assert.equal((await live()).club.profile.name, 'Renamed club')
    await page.reload()
    await page.locator('#a[data-ready="true"]').waitFor()
    assert.equal(await page.locator('#a').textContent(), 'Renamed club', 'the write persists across a reload')
  })

  await t.test('leader paths: updates compose on the latest state, and applicant placements persist', async () => {
    const before = Number(await page.locator('#a').getAttribute('data-stages'))
    await page.click('#add-stages')
    // Two updates in one click must compose; a stale snapshot would add only one stage.
    assert.equal(Number(await page.locator('#b').getAttribute('data-stages')), before + 2)
    await page.click('#place')
    assert.deepEqual((await live()).club.positions, { 'applicant-1': 'Round 2' }, 'setApplicants records positions')
    assert.equal(await page.locator('#a').getAttribute('data-round'), 'Round 2')
    await page.reload()
    await page.locator('#a[data-ready="true"]').waitFor()
    assert.equal(Number(await page.locator('#a').getAttribute('data-stages')), before + 2, 'stage changes persist')
    assert.deepEqual((await live()).club.positions, { 'applicant-1': 'Round 2' })
  })

  await t.test('Demo Mode uses its own key on the same origin', async () => {
    const demoPage = await context.newPage() // same context, so both keys share one localStorage
    await demoPage.goto(url('?demo'))
    await demoPage.locator('#a[data-ready="true"]').waitFor()
    assert.equal(await demoPage.locator('#a').textContent(), 'Your club', 'demo shows defaults, not the live customization')
    await demoPage.click('#rename')
    assert.equal(JSON.parse(await demoPage.evaluate(() => localStorage.getItem('outclass.demo.customization.v1'))).club.profile.name, 'Renamed club')
    assert.equal((await live()).club.profile.name, 'Renamed club', 'the live key is untouched')
    await demoPage.close()
  })

  await t.test('storage failures are reported: damaged data on read, quota on write', async () => {
    await page.evaluate(() => localStorage.setItem('outclass.customization.v1', '{"club":{"stages":[]}}'))
    await page.reload()
    await page.locator('#a[data-ready="true"]').waitFor()
    assert.equal(await page.locator('#a').getAttribute('data-error'), 'true', 'damaged storage is reported')
    assert.equal(await page.locator('#a').getAttribute('data-configured'), 'false', 'damaged storage falls back to defaults')
    await page.evaluate(() => { localStorage.clear(); Storage.prototype.setItem = () => { throw new DOMException('Quota', 'QuotaExceededError') } })
    await page.click('#rename')
    assert.equal(await page.locator('#a').getAttribute('data-error'), 'true', 'a failed write is reported')
    assert.equal(await page.locator('#b').textContent(), 'Renamed club', 'the change still applies for this page')
  })

  await t.test('server and hydration renders read nothing and show defaults', async () => {
    const fresh = await browser.newPage(), hydrationErrors = []
    fresh.on('console', message => { if (message.type() === 'error') hydrationErrors.push(message.text()) })
    // Seed a valid customization through the real UI (a fresh page has its own storage).
    await fresh.goto(url())
    await fresh.locator('#a[data-ready="true"]').waitFor()
    await fresh.click('#rename')
    await fresh.goto(url('hydration'))
    await fresh.locator('#p[data-ready="true"]').waitFor()
    const result = await fresh.evaluate(() => ({ server: window.__server, serverReads: window.__serverReads, first: window.__first, recoverable: window.__recoverable }))
    assert.match(result.server, /Your club/, 'the server render shows defaults')
    assert.equal(result.serverReads, 0, 'the server render reads no storage')
    assert.deepEqual(result.first, { name: 'Your club', ready: false, reads: 0 }, 'the hydration render matches the server and reads no storage')
    assert.deepEqual(result.recoverable, [], 'no hydration mismatch')
    assert.equal(await fresh.locator('#p').textContent(), 'Renamed club', 'stored customization appears after mount')
    assert.deepEqual(hydrationErrors, [])
    await fresh.close()
  })

  assert.deepEqual(errors, [])
})
