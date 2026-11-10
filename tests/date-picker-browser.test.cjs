// Real browser, real DatePicker (Radix Popover), tokens and primitives CSS.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const { chromium } = require('playwright')
const AxeBuilder = require('@axe-core/playwright').default
const { bundle } = require('./helpers/browser-bundle.cjs')

test('browser: date picker opens on the value, moves by keyboard, picks, marks days and clears', { timeout: 120000 }, async () => {
  const entry = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{DatePicker}from'@/components/ui/date-picker';
function App(){const[value,setValue]=useState('2026-11-10');window.value=value;return <main><DatePicker label="Filter assigned interview date" value={value} onChange={setValue} marked={['2026-11-12']} markedLabel="has interviews" placeholder="All dates" clearLabel="All dates"/><p>after</p></main>}
createRoot(document.getElementById('root')).render(<App/>)`
  const js = bundle(entry)
  const css = fs.readFileSync('styles/tokens.css', 'utf8') + fs.readFileSync('styles/interface-primitives.css', 'utf8') + 'body{margin:0;font-family:sans-serif}button{font:inherit;background:none;border:0;cursor:pointer}'
  const server = http.createServer((req, res) => { if (req.url === '/fixture.js') { res.setHeader('content-type', 'text/javascript'); res.end(js); return } res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Date picker</title><style>${css}</style><div id="root"></div><script src="/fixture.js"></script></html>`) })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage(), errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto(`http://127.0.0.1:${server.address().port}/`)
    const trigger = page.getByRole('button', { name: /^Filter assigned interview date: / })
    assert.equal(await trigger.getAttribute('aria-label'), 'Filter assigned interview date: Tuesday, November 10, 2026')
    await trigger.click()
    await page.getByRole('grid', { name: 'November 2026' }).waitFor()
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-day')), '2026-11-10', 'focus starts on the value')
    assert.equal(await page.getByRole('gridcell', { selected: true }).textContent(), '10')
    assert.ok(await page.getByRole('button', { name: 'Thursday, November 12, 2026, has interviews' }).count())
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowDown')
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-day')), '2026-11-18')
    await page.keyboard.press('PageDown')
    await page.getByRole('grid', { name: 'December 2026' }).waitFor()
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-day')), '2026-12-18')
    await page.keyboard.press('Enter')
    assert.equal(await page.evaluate(() => window.value), '2026-12-18')
    await page.getByRole('grid').waitFor({ state: 'detached' }) // closes after picking
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Filter assigned interview date: Friday, December 18, 2026', null, { timeout: 3000 }) // focus returns to the trigger
    await trigger.click(); await page.getByRole('grid').waitFor()
    assert.equal((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(v => v.id).join(','), '')
    await page.keyboard.press('Escape'); assert.equal(await page.getByRole('grid').count(), 0)
    await trigger.click(); await page.getByRole('button', { name: 'All dates', exact: true }).click()
    assert.equal(await page.evaluate(() => window.value), '')
    assert.equal(await page.getByRole('button', { name: 'Filter assigned interview date: All dates' }).count(), 1)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow at phone width')
    assert.deepEqual(errors, [])
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
})
