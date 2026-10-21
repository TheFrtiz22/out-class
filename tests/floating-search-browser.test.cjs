const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const { chromium } = require('playwright')
const { expect } = require('playwright/test')
const AxeBuilder = require('@axe-core/playwright').default
const { bundle } = require('./helpers/browser-bundle.cjs')

test('browser: global search label matches visible text on Mac, Windows and Linux', async () => {
  const script = bundle(`import React from 'react';import{createRoot}from'react-dom/client';import{FloatingSearchTrigger}from'@/components/shell/floating-header-controls';createRoot(document.getElementById('root')).render(<FloatingSearchTrigger open={false} onOpen={()=>{window.searchOpened=true}}/>);`)
  const css = fs.readFileSync('components/shell/floating-header.css', 'utf8')
  const server = http.createServer((req, res) => {
    if (req.url === '/fixture.js') {
      res.setHeader('Content-Type', 'text/javascript')
      return res.end(script)
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(`<!doctype html><html lang="en"><head><title>Search accessibility fixture</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main class="oc-product-header" id="root"></main><script src="/fixture.js"></script></body></html>`)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true, ...(fs.existsSync(chromium.executablePath()) ? {} : { channel: 'chrome' }) })
    for (const [platform, shortcut] of [['MacIntel', '⌘ K'], ['Win32', 'Ctrl K'], ['Linux x86_64', 'Ctrl K']]) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
      const page = await context.newPage()
      try {
        await page.addInitScript(value => Object.defineProperty(navigator, 'platform', { get: () => value }), platform)
        await page.goto(`http://127.0.0.1:${server.address().port}`)
        const trigger = page.getByRole('button', { name: `Search OutClass ${shortcut}`, exact: true })
        await trigger.waitFor()
        for (const width of [1280, 320]) {
          await page.setViewportSize({ width, height: 900 })
          const result = await new AxeBuilder({ page }).withRules(['label-content-name-mismatch']).analyze()
          assert.deepEqual(result.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), [], `${platform} at ${width}px`)
        }
        await trigger.focus()
        await page.keyboard.press('Enter')
        assert.equal(await page.evaluate(() => window.searchOpened), true)
        await expect(trigger).toHaveAttribute('aria-keyshortcuts', 'Meta+K Control+K')
      } finally {
        await context.close()
      }
    }
  } finally {
    await browser?.close()
    await new Promise(resolve => server.close(resolve))
  }
})
