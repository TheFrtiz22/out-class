// Real browser, real ConfirmProvider (Radix AlertDialog): focus, Esc, outside click, labelling, focus return.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const { chromium } = require('playwright')
const AxeBuilder = require('@axe-core/playwright').default
const { bundle } = require('./helpers/browser-bundle.cjs')

test('browser: confirm dialog is labelled, starts on the safe button, cancels on Esc/outside click and returns focus', { timeout: 120000 }, async () => {
  const entry = `import React from'react';import{createRoot}from'react-dom/client';import{ConfirmProvider,useConfirm}from'@/components/ui/confirm-dialog';
function App(){const confirm=useConfirm();window.results=window.results||[];return <main>
<button id="danger" onClick={async()=>{window.results.push(await confirm({title:'Delete round?',description:'Historical records are retained.',confirmLabel:'Delete round',tone:'danger'}))}}>Remove round</button>
<button id="plain" onClick={async()=>{window.results.push(await confirm({title:'Save settings?',confirmLabel:'Save settings'}))}}>Save</button>
</main>}
createRoot(document.getElementById('root')).render(<ConfirmProvider><App/></ConfirmProvider>)`
  const js = bundle(entry)
  const css = fs.readFileSync('styles/tokens.css', 'utf8') + fs.readFileSync('styles/interface-primitives.css', 'utf8') + 'body{margin:0;font-family:sans-serif}[data-slot=alert-dialog-overlay]{position:fixed;inset:0;background:rgb(0 0 0/.4)}[data-slot=alert-dialog-content]{position:fixed;top:30%;left:30%;background:#fff;padding:16px}'
  const server = http.createServer((req, res) => { if (req.url === '/fixture.js') { res.setHeader('content-type', 'text/javascript'); res.end(js); return } res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirm</title><style>${css}</style><div id="root"></div><script src="/fixture.js"></script></html>`) })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true, ...(fs.existsSync(chromium.executablePath()) ? {} : { channel: 'chrome' }) })
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })).newPage(), errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto(`http://127.0.0.1:${server.address().port}/`)
    const results = () => page.evaluate(() => window.results)
    const activeId = () => page.evaluate(() => document.activeElement?.id || document.activeElement?.textContent)
    const dialog = page.getByRole('alertdialog', { name: 'Delete round?' })

    // Danger: labelled + described, focus on Cancel, Esc cancels, focus returns to the trigger.
    await page.locator('#danger').focus(); await page.keyboard.press('Enter')
    await dialog.waitFor()
    assert.equal(await dialog.getAttribute('aria-describedby') !== null, true)
    assert.equal(await page.evaluate(() => document.getElementById(document.querySelector('[role=alertdialog]').getAttribute('aria-describedby')).textContent), 'Historical records are retained.')
    assert.equal(await activeId(), 'Cancel', 'danger confirms start on the safer button')
    assert.equal(await page.getByRole('button', { name: 'Delete round' }).getAttribute('data-variant'), 'destructive')
    assert.match(await dialog.getAttribute('class'), /motion-reduce:animate-none/)
    assert.equal((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(v => v.id).join(','), '')
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'detached' })
    await page.waitForFunction(() => document.activeElement?.id === 'danger', null, { timeout: 3000 })
    assert.deepEqual(await results(), [false])

    // Outside click cancels.
    await page.locator('#danger').click(); await dialog.waitFor()
    await page.mouse.click(5, 5)
    await dialog.waitFor({ state: 'detached' })
    assert.deepEqual(await results(), [false, false])
    await page.waitForFunction(() => document.activeElement?.id === 'danger', null, { timeout: 3000 })

    // Confirming resolves true once.
    await page.locator('#danger').click(); await dialog.waitFor()
    await page.getByRole('button', { name: 'Delete round' }).click()
    await dialog.waitFor({ state: 'detached' })
    assert.deepEqual(await results(), [false, false, true])

    // Default tone: title-only, focus on the specific action, Enter confirms, focus returns.
    await page.locator('#plain').click()
    const plain = page.getByRole('alertdialog', { name: 'Save settings?' }); await plain.waitFor()
    assert.equal(await plain.getAttribute('aria-describedby'), null, 'no description, no dangling reference')
    assert.equal(await activeId(), 'Save settings')
    await page.keyboard.press('Enter')
    await plain.waitFor({ state: 'detached' })
    await page.waitForFunction(() => document.activeElement?.id === 'plain', null, { timeout: 3000 })
    assert.deepEqual(await results(), [false, false, true, true])
    assert.deepEqual(errors, [])
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
})
