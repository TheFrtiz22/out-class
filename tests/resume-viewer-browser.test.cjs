// Real browser, real Radix Dialog: the leader résumé viewer opens in-page, closes on X, Esc and
// backdrop, returns focus, offers Download through the same authorized href, and fits a phone.
// pdf.js page rendering is stubbed here (next/dynamic); it is the existing InterviewResumePreview.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const { chromium } = require('playwright')
const AxeBuilder = require('@axe-core/playwright').default
const { bundle } = require('./helpers/browser-bundle.cjs')

const pdfHref = '/api/recruiting-resumes?clubId=00000000-0000-4000-8000-000000000001&applicationId=00000000-0000-4000-8000-000000000002'
const entry = `import React from'react';import{createRoot}from'react-dom/client';import{ResumeViewerDialog}from'@/components/resume-viewer-dialog';
function App(){return <main><h1>Dossier</h1>
<ResumeViewerDialog href=${JSON.stringify(pdfHref)} name="Ada Lovelace" clubId="00000000-0000-4000-8000-000000000001" applicationId="00000000-0000-4000-8000-000000000002" trigger="Open résumé"/>
<ResumeViewerDialog href="https://files.example.edu/ada/resume.docx" name="Ada Doc" clubId="00000000-0000-4000-8000-000000000001" applicationId="00000000-0000-4000-8000-000000000003" trigger="Word résumé"/>
<ResumeViewerDialog href="https://files.example.edu/ada/resume.png" name="Ada Image" clubId="00000000-0000-4000-8000-000000000001" applicationId="00000000-0000-4000-8000-000000000004" trigger="Image résumé"/>
<ResumeViewerDialog href="https://drive.example.com/view/abc" name="Ada Link" clubId="00000000-0000-4000-8000-000000000001" applicationId="00000000-0000-4000-8000-000000000005" trigger="Linked résumé"/>
</main>}
createRoot(document.getElementById('root')).render(<App/>)`
const mocks = { 'next/dynamic': `module.exports={__esModule:true,default:()=>function PdfPages(p){return require('react').createElement('div',{'data-testid':'pdf-pages','data-path':p.resource.path,role:'region','aria-label':p.name+' résumé preview',tabIndex:0},'PDF pages')}}`, '@/components/interview-resume-preview': 'module.exports={default:()=>null}' }

async function withPage(viewport, run) {
  const js = bundle(entry, mocks)
  const css = fs.readFileSync('styles/tokens.css', 'utf8') + fs.readFileSync('styles/interface-primitives.css', 'utf8') + fs.readFileSync('components/resume-viewer.css', 'utf8') +
    // Minimal stand-ins for the Tailwind utilities on the shared Dialog primitive.
    '[data-slot=dialog-overlay]{position:fixed;inset:0}[data-slot=dialog-content]{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--card)}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}body{margin:0;font-family:sans-serif}'
  const server = http.createServer((req, res) => { if (req.url === '/fixture.js') { res.setHeader('content-type', 'text/javascript'); res.end(js); return } res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Résumé viewer</title><style>${css}</style><div id="root"></div><script src="/fixture.js"></script></html>`) })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await (await browser.newContext({ viewport, reducedMotion: 'reduce' })).newPage(), errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto(`http://127.0.0.1:${server.address().port}/`)
    await run(page)
    assert.deepEqual(errors, [])
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
}

test('browser: the résumé viewer opens in-page and closes on X, Esc and backdrop with focus returned', { timeout: 120000 }, async () => {
  await withPage({ width: 1280, height: 900 }, async page => {
    const trigger = page.getByRole('button', { name: 'Open résumé' })
    // Radix moves focus into the dialog once its focus scope and dismiss layer are mounted.
    const inside = () => page.waitForFunction(() => !!document.activeElement?.closest('[role=dialog]'), null, { timeout: 3000 })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Résumé · Ada Lovelace' })
    await dialog.waitFor()
    assert.equal(await dialog.getAttribute('aria-labelledby') !== null, true)
    assert.equal(await page.getByTestId('pdf-pages').getAttribute('data-path'), pdfHref, 'PDF pages load from the authorized route')
    const download = dialog.getByRole('link', { name: 'Download' })
    assert.equal(await download.getAttribute('href'), pdfHref, 'Download uses the same authorized href')
    assert.equal(await download.getAttribute('download'), 'Ada-Lovelace.pdf')
    const box = await dialog.boundingBox()
    assert.ok(box.width >= 900 && box.height >= 800, `fills most of the screen (${box.width}x${box.height})`)
    assert.equal((await new AxeBuilder({ page }).include('[role=dialog]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(v => v.id).join(','), '')
    // Focus is trapped inside the dialog.
    for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); assert.ok(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]')), 'focus stays in the dialog') }
    await dialog.getByRole('button', { name: 'Close résumé' }).click()
    await dialog.waitFor({ state: 'detached' })
    await page.waitForFunction(() => document.activeElement?.textContent === 'Open résumé', null, { timeout: 3000 }) // focus returns to the trigger after X

    await trigger.click(); await dialog.waitFor(); await inside()
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' })
    await page.waitForFunction(() => document.activeElement?.textContent === 'Open résumé', null, { timeout: 3000 }) // focus returns after Esc

    await trigger.click(); await dialog.waitFor(); await inside()
    assert.equal(await page.evaluate(() => document.elementFromPoint(8, 8)?.getAttribute('data-slot')), 'dialog-overlay', 'the backdrop is under the pointer')
    await page.mouse.click(8, 8) // the backdrop, outside the dialog
    await dialog.waitFor({ state: 'detached' })
    await page.waitForFunction(() => document.activeElement?.textContent === 'Open résumé', null, { timeout: 3000 }) // focus returns after a backdrop click
  })
})

test('browser: non-PDF résumés show an image, a clear unavailable message, or an external link', { timeout: 120000 }, async () => {
  await withPage({ width: 1280, height: 900 }, async page => {
    await page.getByRole('button', { name: 'Word résumé' }).click()
    let dialog = page.getByRole('dialog', { name: 'Résumé · Ada Doc' })
    await dialog.getByText('Preview isn’t available for this file type.').waitFor()
    assert.equal(await dialog.getByRole('link', { name: 'Download' }).getAttribute('href'), 'https://files.example.edu/ada/resume.docx')
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' })

    await page.getByRole('button', { name: 'Image résumé' }).click()
    dialog = page.getByRole('dialog', { name: 'Résumé · Ada Image' })
    assert.equal(await dialog.getByRole('img', { name: 'Résumé · Ada Image' }).getAttribute('src'), 'https://files.example.edu/ada/resume.png')
    assert.equal(await dialog.getByRole('link', { name: 'Download' }).count(), 1)
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' })

    await page.getByRole('button', { name: 'Linked résumé' }).click()
    dialog = page.getByRole('dialog', { name: 'Résumé · Ada Link' })
    await dialog.getByText('Preview isn’t available for linked résumés.').waitFor()
    const link = dialog.getByRole('link', { name: /Open link/ })
    assert.equal(await link.getAttribute('target'), '_blank')
    assert.equal(await link.getAttribute('rel'), 'noopener noreferrer')
  })
})

test('browser: on a phone the viewer is full-screen without horizontal overflow', { timeout: 120000 }, async () => {
  await withPage({ width: 390, height: 844 }, async page => {
    await page.getByRole('button', { name: 'Open résumé' }).click()
    const dialog = page.getByRole('dialog', { name: 'Résumé · Ada Lovelace' })
    await dialog.waitFor()
    const box = await dialog.boundingBox()
    assert.deepEqual([Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)], [0, 0, 390, 844])
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow')
    const close = await dialog.getByRole('button', { name: 'Close résumé' }).boundingBox()
    assert.ok(close.x + close.width <= 390 && close.width >= 32, 'close control visible and tappable')  })
})
