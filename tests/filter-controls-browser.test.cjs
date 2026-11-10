// Real browser, real filter primitives (Radix Popover/Select/Switch/Slider/Dialog), tokens and primitives CSS.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { chromium } = require('playwright')
const AxeBuilder = require('@axe-core/playwright').default
const { bundle } = require('./helpers/browser-bundle.cjs')

const entry = `import React,{useState}from'react';import{createRoot}from'react-dom/client';
import{SearchField}from'@/components/ui/search-field';import{FilterChips}from'@/components/ui/filter-chips';import{PillSelect}from'@/components/ui/pill-select';
import{Toggle}from'@/components/ui/toggle';import{RangeSlider}from'@/components/ui/range-slider';import{FilterPopover}from'@/components/ui/filter-popover';
import{PillGroup}from'@/components/ui/segmented-control';import{Stepper}from'@/components/ui/stepper';
const interests=['Arts','Business','Community','Culture','Engineering','Health','Media','Politics','Religion','Science','Service','Sports','Tech'].map(v=>({value:v,label:v}))
function App(){
 const[q,setQ]=useState(''),[topic,setTopic]=useState('all'),[roles,setRoles]=useState([]),[major,setMajor]=useState(''),[saved,setSaved]=useState(false),[gpa,setGpa]=useState(null),[sat,setSat]=useState(1200),[round,setRound]=useState('r1'),[step,setStep]=useState('availability')
 window.state={q,topic,roles,major,saved,gpa,sat,round,step}
 const count=[major,saved,gpa!==null].filter(Boolean).length
 return <main style={{padding:16}}>
  <div className="oc-filter-bar"><SearchField aria-label="Search applicants" placeholder="Search" value={q} onChange={e=>setQ(e.target.value)} onClear={()=>setQ('')} shortcut="/"/>
   <PillGroup label="Status" value={round} onChange={setRound} options={[{value:'r1',label:'Pending',count:1},{value:'r2',label:'Accepted',count:0}]}/>
   <div style={{marginLeft:'auto'}}><FilterPopover count={count} title="Applicant filters" footer={<button type="button" onClick={()=>{setMajor('');setSaved(false);setGpa(null)}}>Clear filters</button>}>
    <PillSelect label="Filter major" allLabel="All majors" value={major} onChange={setMajor} options={['Economics','History','Physics'].map(v=>({value:v,label:v}))}/>
    <Toggle label="Saved events" checked={saved} onCheckedChange={setSaved}/>
    <RangeSlider label="Minimum GPA" min={0} max={4} step={0.1} value={gpa} onChange={setGpa}/>
    <PillGroup label="Review state" value="all" onChange={()=>{}} options={[{value:'all',label:'All review states'},{value:'none',label:'No evaluations'},{value:'mine',label:'Reviewed by me'}]}/>
   </FilterPopover></div></div>
  <FilterChips label="Interests" visible={4} value={topic} onChange={setTopic} options={[{value:'all',label:'All'},...interests]}/>
  <FilterChips multiple label="Roles" value={roles} onChange={setRoles} options={[{value:'President',label:'President'},{value:'VP',label:'VP'}]}/>
  <RangeSlider label="Minimum SAT" min={400} max={1600} step={10} value={sat} onChange={setSat}/>
  <Stepper label="Scheduling workflow" current={step} onSelect={setStep} steps={[{id:'availability',label:'Availability',complete:true},{id:'rooms',label:'Set interview times'},{id:'publish',label:'Publish schedule'}]}/>
 </main>}
createRoot(document.getElementById('root')).render(<App/>)`

function serve(js) {
  // The app's compiled stylesheet (Tailwind + every OutClass layer), as the Sheet and Popover ship.
  const out = path.join(os.tmpdir(), `oc-filter-controls-${process.pid}.css`)
  execFileSync(process.execPath, ['tests/helpers/interview-browser-css.cjs', out])
  const css = fs.readFileSync(out, 'utf8') + 'body{margin:0}'
  return http.createServer((req, res) => {
    if (req.url === '/fixture.js') { res.setHeader('content-type', 'text/javascript'); res.end(js); return }
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.end(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Filters</title><style>${css}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`)
  })
}
const state = page => page.evaluate(() => window.state)
// Set OC_SCREENSHOT_DIR to keep reference screenshots for review.
const shot = (page, name) => process.env.OC_SCREENSHOT_DIR ? page.screenshot({ path: path.join(process.env.OC_SCREENSHOT_DIR, name), fullPage: true }) : null

test('browser: filter primitives keep keyboard, names and values; the popover stays in the viewport; phones get a sheet', { timeout: 180000 }, async () => {
  const server = serve(bundle(entry)); await new Promise(r => server.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${server.address().port}/`
  const browser = await chromium.launch()
  try {
    const page = await (await browser.newContext({ viewport: { width: 1126, height: 760 } })).newPage()
    await page.goto(base)

    // SearchField: "/" focuses it, typing filters, Escape and × clear.
    await page.keyboard.press('/')
    const search = page.getByRole('searchbox', { name: 'Search applicants' })
    assert.equal(await search.evaluate(el => el === document.activeElement), true)
    await page.keyboard.type('ada'); assert.equal((await state(page)).q, 'ada')
    await page.keyboard.press('Escape'); assert.equal((await state(page)).q, '')
    await search.fill('lin'); await page.getByRole('button', { name: 'Clear search' }).click(); assert.equal((await state(page)).q, '')
    const height = (await page.locator('.oc-search-field').boundingBox()).height
    assert.ok(height >= 44 && height <= 48, `search pill height ${height}`)

    // Pill group: counts are part of the name; arrows move focus, Enter chooses.
    await page.getByRole('button', { name: 'Pending 1' }).focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter')
    assert.equal((await state(page)).round, 'r2')

    // FilterChips: "+N" expands inline; a hidden choice stays visible once chosen.
    assert.equal(await page.getByRole('group', { name: 'Interests' }).getByRole('button', { name: 'Tech', exact: true }).count(), 0)
    await page.getByRole('button', { name: '+10 more interests' }).click()
    await page.getByRole('button', { name: 'Tech', exact: true }).click(); assert.equal((await state(page)).topic, 'Tech')
    await page.getByRole('button', { name: 'Fewer interests' }).click()
    assert.equal(await page.getByRole('button', { name: 'Tech', exact: true }).getAttribute('aria-pressed'), 'true')
    await page.getByRole('button', { name: 'VP', exact: true }).click(); await page.getByRole('button', { name: 'President', exact: true }).click()
    assert.deepEqual((await state(page)).roles, ['VP', 'President'])

    // FilterPopover at the right edge of a 1126px window: inside the viewport, focus moves in and returns.
    const trigger = page.getByRole('button', { name: /^Filters/ })
    await trigger.click()
    const panel = page.getByRole('dialog', { name: 'Applicant filters' }); await panel.waitFor()
    for (const box of await page.locator('[data-slot="popover-content"], [data-slot="popover-content"] *').evaluateAll(els => els.map(el => el.getBoundingClientRect().toJSON())))
      assert.ok(box.right <= 1126 + 0.5 && box.left >= -0.5, `inside viewport: ${JSON.stringify(box)}`)

    // PillSelect: a listbox with the "All" choice, no native select.
    await panel.getByRole('combobox', { name: 'Filter major' }).click()
    await page.getByRole('option', { name: 'Physics' }).click(); assert.equal((await state(page)).major, 'Physics')
    assert.equal(await page.locator('select').count() - await page.locator('select[aria-hidden="true"]').count(), 0)

    // Toggle: role=switch named by its visible label.
    const toggle = panel.getByRole('switch', { name: 'Saved events' })
    await toggle.press('Space'); assert.equal((await state(page)).saved, true); assert.equal(await toggle.getAttribute('aria-checked'), 'true')

    // RangeSlider: "No minimum" until moved; keyboard steps by 0.1; the value is editable; empty clears.
    const gpa = panel.getByRole('slider', { name: 'Minimum GPA' })
    assert.equal(await gpa.getAttribute('aria-valuetext'), 'No minimum')
    await gpa.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight')
    assert.equal((await state(page)).gpa, 0.2)
    await panel.getByRole('button', { name: /^Minimum GPA: 0\.2\. Edit exact value$/ }).click()
    const exact = panel.getByRole('textbox', { name: 'Minimum GPA, exact value' }); await exact.fill('3.46'); await exact.press('Enter')
    assert.equal((await state(page)).gpa, 3.5)
    await panel.getByRole('button', { name: /^Minimum GPA: 3\.5/ }).click(); await exact.fill(''); await exact.press('Enter')
    assert.equal((await state(page)).gpa, null)
    await gpa.focus(); await page.keyboard.press('End'); await shot(page, 'filters-1126.png'); await page.keyboard.press('Home')
    assert.match(await trigger.innerText(), /2/)
    await page.keyboard.press('Escape'); await panel.waitFor({ state: 'detached' })
    assert.equal(await trigger.evaluate(el => el === document.activeElement), true)

    // SAT steps by 10 and Home clears to "no minimum".
    const sat = page.getByRole('slider', { name: 'Minimum SAT' }); await sat.focus(); await page.keyboard.press('ArrowRight'); assert.equal((await state(page)).sat, 1210)
    await page.keyboard.press('Home'); assert.equal((await state(page)).sat, null)

    // Stepper: aria-current="step" follows the choice.
    await page.getByRole('button', { name: /Set interview times/ }).click()
    assert.equal(await page.getByRole('button', { name: /Set interview times/ }).getAttribute('aria-current'), 'step')

    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).include('main').analyze()
    assert.deepEqual(axe.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target).join(' ')}`), [])

    // Phones: the same trigger opens a bottom sheet that fits the screen; pill rows scroll instead of overflowing.
    const phone = await browser.newPage({ viewport: { width: 375, height: 740 } }); await phone.goto(base)
    assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= 375), 'no horizontal page scroll at 375px')
    await phone.getByRole('button', { name: /^Filters/ }).click()
    const sheet = phone.locator('.oc-filter-sheet'); await sheet.waitFor()
    await sheet.evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished)))
    const box = await sheet.boundingBox()
    assert.ok(box.x >= 0 && box.x + box.width <= 375.5 && box.y + box.height <= 740.5, `sheet inside viewport ${JSON.stringify(box)}`)
    assert.equal(await phone.getByRole('dialog', { name: 'Applicant filters' }).count(), 1)
    await shot(phone, 'filters-375.png')
  } finally { await browser.close(); await new Promise(r => server.close(r)) }
})
