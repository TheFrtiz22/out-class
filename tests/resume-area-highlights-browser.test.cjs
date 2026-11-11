// Real browser, real résumé viewer (components/interview-resume-viewer.tsx) on a stubbed
// image-only PDF.js page: no selectable text, like a scanned résumé. Covers drawing an area
// with a mouse and with touch, keyboard creation, edit (move) and delete, alignment after
// zoom and after a viewport resize, accessible names, focus and reduced motion.
// Only loopback requests; mocked annotation actions hold synthetic rows in the page.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const { chromium } = require('playwright')
const AxeBuilder = require('@axe-core/playwright').default
const { bundle } = require('./helpers/browser-bundle.cjs')

const ids = { clubId: '00000000-0000-4000-8000-000000000001', applicationId: '00000000-0000-4000-8000-000000000002', roundId: '00000000-0000-4000-8000-000000000003' }
const documentId = '00000000-0000-4000-8000-000000000004'
const entry = `import React from 'react';import{createRoot}from'react-dom/client';import Viewer from'@/components/interview-resume-viewer';
const scope=${JSON.stringify(ids)};
createRoot(document.getElementById('root')).render(<main style={{display:'flex',flexDirection:'column',height:'100vh'}}><h1>Résumé</h1><Viewer scope={scope} documentId=${JSON.stringify(documentId)} isDemo={false} onAccessLost={()=>{window.__lost=true}}/></main>)`
// A one-page, letter-size, image-only document: getTextContent returns no items.
const pdfjs = `const page={getViewport:({scale})=>({width:612*scale,height:792*scale}),render:()=>({promise:Promise.resolve(),cancel(){}}),getTextContent:async()=>({items:[]})};
const pdf={numPages:1,getPage:async()=>page};
exports.GlobalWorkerOptions={};exports.getDocument=()=>({promise:Promise.resolve(pdf),destroy:async()=>{}});
exports.TextLayer=class{constructor(){}render(){return Promise.resolve()}cancel(){}};`
const api = `const rows=[];window.__areaStore=rows;
exports.getInterviewResumeAnnotations=async()=>({document:{id:${JSON.stringify(documentId)}},annotations:rows.filter(r=>!r.deletedAt).map(r=>({...r,authorName:'Avery Panel',canEdit:true}))});
exports.saveInterviewResumeAnnotation=async input=>{const old=rows.find(r=>r.id===input.id);if(old){if(old.revision!==input.revision)throw Error('changed');Object.assign(old,input.content,{revision:old.revision+1});return {id:old.id,revision:old.revision}}rows.push({id:input.id,revision:0,deletedAt:null,...input.content});return {id:input.id,revision:0}};
exports.deleteInterviewResumeAnnotation=async input=>{const old=rows.find(r=>r.id===input.id);old.deletedAt=new Date().toISOString();old.revision++;return {id:old.id,deleted:true}};`
const mocks = { 'pdfjs-dist': pdfjs, '@/lib/workspace-api': api, '@/contexts/auth-context': `exports.useAuth=()=>({user:{id:'00000000-0000-4000-8000-000000000009'}})` }

async function withPage(options, run) {
  const js = bundle(entry, mocks)
  const css = fs.readFileSync('styles/tokens.css', 'utf8') + fs.readFileSync('styles/interface-primitives.css', 'utf8') + fs.readFileSync('components/interview-resume-viewer.css', 'utf8') +
    '.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}.hidden{display:none}body{margin:0;font-family:sans-serif}.overflow-auto{overflow:auto}.p-3{padding:12px}' +
    // Tailwind's lg: variants, which the viewer uses to show the document beside the comments.
    '@media (min-width:1024px){[class~="lg:block"]{display:block}[class~="lg:hidden"]{display:none}}'
  const server = http.createServer((req, res) => {
    if (req.url === '/fixture.js') { res.setHeader('content-type', 'text/javascript'); res.end(js); return }
    if (req.url.startsWith('/api/interview-resumes?')) { res.setHeader('content-type', 'application/pdf'); res.end('%PDF-1.4 synthetic scanned stub'); return }
    res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Area highlights</title><style>${css}</style><div id="root"></div><script src="/fixture.js"></script></html>`)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ reducedMotion: 'reduce', ...options })
    const page = await context.newPage(), errors = [], external = []
    page.on('pageerror', e => errors.push(e.message))
    await page.route('**/*', route => { const url = route.request().url(); if (url.startsWith(`http://127.0.0.1:${server.address().port}/`) || url.startsWith('blob:')) return route.continue(); external.push(url); return route.abort() })
    await page.goto(`http://127.0.0.1:${server.address().port}/`)
    await page.getByRole('button', { name: 'Add area highlight' }).waitFor()
    await run(page, context)
    assert.deepEqual(errors, []); assert.deepEqual(external, [], 'no résumé data leaves the page')
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
}

/** Saved means the mocked server holds it and the composer has closed. */
const saved = (page, check) => page.waitForFunction(check, null, { timeout: 10000 }).then(() => page.locator('[data-resume-comment-draft]').waitFor({ state: 'detached' }))
const store = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__areaStore)))
const pageBox = page => page.locator('.oc-pdf-page').boundingBox()
const near = (a, b, tolerance, label) => assert.ok(Math.abs(a - b) <= tolerance, `${label}: ${a} vs ${b}`)
/** The saved mark must cover exactly rect × page box, whatever the zoom or viewport. */
async function assertAligned(page, id, rect, label) {
  const p = await pageBox(page), m = await page.locator(`[data-area-id="${id}"]`).boundingBox()
  assert.ok(p && m, `${label}: page and mark are visible`)
  near(m.x, p.x + rect.x * p.width, 1.5, `${label} left`); near(m.y, p.y + rect.y * p.height, 1.5, `${label} top`)
  near(m.width, rect.width * p.width, 1.5, `${label} width`); near(m.height, rect.height * p.height, 1.5, `${label} height`)
}

test('browser: draw an area with the mouse, note it, and it stays aligned after zoom and a viewport resize', { timeout: 120000 }, async () => {
  await withPage({ viewport: { width: 1280, height: 900 } }, async page => {
    assert.match(await page.getByRole('status').filter({ hasText: 'scanned page' }).innerText(), /no selectable text/)
    await page.getByRole('button', { name: 'Add area highlight' }).click()
    const region = page.getByRole('button', { name: 'Area highlight on page 1' })
    await region.waitFor()
    assert.equal(await region.getAttribute('aria-roledescription'), 'area selection')
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-roledescription')), 'area selection', 'the region takes focus')
    assert.equal((await new AxeBuilder({ page }).include('.oc-pdf-page').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(v => v.id).join(','), '')
    // Drag a new region from 10%,10% to 40%,30% of the page (outside the default box).
    let p = await pageBox(page)
    await page.mouse.move(p.x + p.width * 0.1, p.y + p.height * 0.1); await page.mouse.down()
    await page.mouse.move(p.x + p.width * 0.4, p.y + p.height * 0.3, { steps: 6 }); await page.mouse.up()
    await page.getByRole('button', { name: 'Add note to area' }).click()
    const note = page.getByLabel('Area highlight note', { exact: true })
    await note.waitFor()
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'resume-comment', 'the note composer takes focus')
    await note.pressSequentially('Scholarship seal'); await page.keyboard.press('Enter')
    await saved(page, () => window.__areaStore.length === 1)
    const [row] = await store(page)
    assert.equal(row.kind, 'AREA_HIGHLIGHT'); assert.equal(row.anchor.page, 1); assert.equal(row.comment, 'Scholarship seal'); assert.equal(row.anchor.quote, undefined)
    near(row.anchor.rect.x, 0.1, 0.004, 'x'); near(row.anchor.rect.y, 0.1, 0.004, 'y'); near(row.anchor.rect.width, 0.3, 0.004, 'width'); near(row.anchor.rect.height, 0.2, 0.004, 'height')
    // Labelled as an area highlight, never as quoted text.
    const item = page.locator('#resume-comments li').first()
    assert.equal(await item.getByRole('button', { name: 'Area highlight · Page 1' }).count(), 1)
    assert.doesNotMatch(await item.innerText(), /[“”]/)
    assert.equal(await page.locator(`[data-area-id="${row.id}"]`).getAttribute('aria-label'), 'Area highlight · Page 1 · Avery Panel')
    await assertAligned(page, row.id, row.anchor.rect, '100%')
    await page.getByLabel('Résumé zoom').selectOption('2')
    await page.waitForFunction(() => document.querySelector('.oc-pdf-page')?.getBoundingClientRect().width > 1200)
    await assertAligned(page, row.id, row.anchor.rect, '200%')
    await page.getByLabel('Résumé zoom').selectOption('0.5')
    await page.waitForFunction(() => document.querySelector('.oc-pdf-page')?.getBoundingClientRect().width < 320)
    await assertAligned(page, row.id, row.anchor.rect, '50%')
    await page.setViewportSize({ width: 390, height: 800 })
    await page.getByRole('button', { name: 'Document', exact: true }).click()
    await assertAligned(page, row.id, row.anchor.rect, '390px viewport')
    p = await pageBox(page); assert.ok(p.width < 320)
  })
})

test('browser: keyboard creates, moves and deletes an area highlight; Escape cancels without losing the page', { timeout: 120000 }, async () => {
  await withPage({ viewport: { width: 1280, height: 900 } }, async page => {
    // Escape leaves area mode and keeps the viewer.
    await page.getByRole('button', { name: 'Add area highlight' }).focus(); await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Area highlight on page 1' }).waitFor()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Area highlight on page 1' }).waitFor({ state: 'detached' })
    assert.equal(await store(page).then(r => r.length), 0)
    // Create: default band, 5 steps right, 5 taller, Enter, type, Enter.
    await page.getByRole('button', { name: 'Add area highlight' }).focus(); await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Area highlight on page 1' }).waitFor()
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight')
    for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+ArrowDown')
    assert.equal(await page.locator('[data-area-position]').innerText(), '25% from left, 40% from top, 60% wide, 20% tall')
    const focus = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle)
    assert.notEqual(focus, 'none', 'visible focus outline on the region')
    await page.keyboard.press('Enter')
    await page.getByLabel('Area highlight note', { exact: true }).waitFor()
    await page.keyboard.type('Keyboard region'); await page.keyboard.press('Enter')
    await saved(page, () => window.__areaStore.length === 1)
    let [row] = await store(page)
    assert.deepEqual(row.anchor, { page: 1, rect: { x: 0.25, y: 0.4, width: 0.6, height: 0.2 } })
    // Edit: move it up 10 steps with the keyboard and save; the server revision advances.
    await page.locator('#resume-comments li').first().getByRole('button', { name: 'Edit' }).click()
    await page.getByRole('button', { name: 'Move or resize area' }).click()
    await page.getByRole('button', { name: 'Area highlight on page 1' }).waitFor()
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowUp')
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => document.activeElement?.id === 'resume-comment')
    await page.keyboard.press('Enter')
    await saved(page, () => window.__areaStore[0]?.revision === 1);
    [row] = await store(page)
    assert.equal(row.revision, 1); assert.deepEqual(row.anchor.rect, { x: 0.25, y: 0.3, width: 0.6, height: 0.2 })
    await assertAligned(page, row.id, row.anchor.rect, 'after edit')
    // Delete through the shared confirmation dialog.
    await page.locator('#resume-comments li').first().getByRole('button', { name: 'Delete' }).click()
    await page.getByRole('button', { name: 'Delete comment' }).click()
    await page.getByText('No shared comments yet.').waitFor();
    [row] = await store(page)
    assert.ok(row.deletedAt); assert.equal(await page.locator('[data-area-id]').count(), 0)
  })
})

test('browser: touch drag draws an area on a phone and reduced motion turns transitions off', { timeout: 120000 }, async () => {
  await withPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, async (page, context) => {
    await page.getByRole('button', { name: 'Add area highlight' }).tap()
    await page.getByRole('button', { name: 'Area highlight on page 1' }).waitFor()
    const p = await pageBox(page), cdp = await context.newCDPSession(page)
    const at = (fx, fy) => [{ x: p.x + p.width * fx, y: p.y + p.height * fy }]
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(0.05, 0.05) })
    for (const f of [0.1, 0.2, 0.3, 0.35]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(f, f) })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await cdp.detach()
    // Headless Chromium drops the click of the first emulated tap after a raw CDP touch drag,
    // wherever the drag happened (also outside the viewer). A neutral tap absorbs that.
    await page.locator('h1').tap()
    assert.equal(await page.locator('[data-area-position]').innerText(), '5% from left, 5% from top, 30% wide, 30% tall')
    await page.getByRole('button', { name: 'Add note to area' }).tap()
    await page.getByLabel('Area highlight note', { exact: true }).fill('Touch region')
    await page.getByRole('button', { name: 'Save comment' }).tap()
    await saved(page, () => window.__areaStore.length === 1)
    const [row] = await store(page)
    near(row.anchor.rect.x, 0.05, 0.01, 'touch x'); near(row.anchor.rect.y, 0.05, 0.01, 'touch y')
    near(row.anchor.rect.width, 0.3, 0.01, 'touch width'); near(row.anchor.rect.height, 0.3, 0.01, 'touch height')
    await page.getByRole('button', { name: 'Document', exact: true }).tap()
    assert.equal(await page.locator(`[data-area-id="${row.id}"]`).evaluate(el => getComputedStyle(el).transitionDuration), '0s')
    await assertAligned(page, row.id, row.anchor.rect, 'phone')
  })
})
