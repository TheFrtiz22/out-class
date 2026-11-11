// FE-7, real Chromium: the real UI primitives with the real compiled CSS show one focus-ring colour on
// light, glass-navy and projector surfaces, and a cream halo wherever the ring sits on a dark fill.
// This catches Tailwind focus utilities, inline styles and specificity overrides a CSS scan cannot see.
const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const http = require("node:http")
const postcss = require("postcss")
const { chromium } = require("playwright")
const { bundle } = require("./helpers/browser-bundle.cjs")

const RING = "rgb(200, 100, 0)" // --school-ring #c86400
const HALO = "rgb(255, 254, 250)" // --focus-halo #fffefa

const entry = `import React from 'react';import{createRoot}from'react-dom/client';
import{Button}from'@/components/ui/button';import{Input}from'@/components/ui/input';
import{Tabs,TabsList,TabsTrigger}from'@/components/ui/tabs';
function Set({name}){return <div style={{display:'flex',gap:16,flexWrap:'wrap',padding:24}} data-set={name}>
  <Button data-probe={name+':default'}>Primary</Button>
  <Button variant="outline" data-probe={name+':outline'}>Outline</Button>
  <Button variant="ghost" data-probe={name+':ghost'}>Ghost</Button>
  <Input aria-label={name+' field'} data-probe={name+':input'} defaultValue="Text"/>
  <Tabs defaultValue="a"><TabsList aria-label={name+' tabs'}><TabsTrigger value="a" data-probe={name+':tab-active'}>Active</TabsTrigger><TabsTrigger value="b" data-probe={name+':tab'}>Other</TabsTrigger></TabsList></Tabs>
</div>}
createRoot(document.getElementById('root')).render(<main>
  <section><Set name="light"/></section>
  <section data-variant="glass-navy" style={{background:'var(--school-primary)'}}><Set name="navy"/></section>
  <section data-theme="present" style={{background:'var(--background)'}}><Set name="present"/></section>
</main>)`

test("one focus ring on light, glass-navy and projector surfaces, with a halo on dark fills", { timeout: 120000 }, async t => {
  const css = (await postcss([require("@tailwindcss/postcss")()]).process('@import "../app/globals.css";', { from: path.resolve("tests/visual-fixture.css") })).css
  const js = bundle(entry, {})
  const server = http.createServer((req, res) => {
    if (req.url === "/fixture.js") { res.setHeader("content-type", "text/javascript"); res.end(js); return }
    if (req.url === "/fixture.css") { res.setHeader("content-type", "text/css"); res.end(css); return }
    res.setHeader("content-type", "text/html; charset=utf-8"); res.end('<link rel="stylesheet" href="/fixture.css"><div id="root"></div><script src="/fixture.js"></script>')
  })
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve)); t.after(() => server.close())
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(chromium.executablePath()) ? {} : { channel: "chrome" }) }); t.after(() => browser.close())
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } }), errors = []
  page.on("pageerror", error => errors.push(error.message))
  // Reduced motion (the global kill switch) makes focus styles final at once, so reads do not race transitions.
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto(`http://127.0.0.1:${server.address().port}/`)
  await page.locator('[data-probe="present:tab"]').waitFor()

  // Keyboard only: tab through every control and record what the focused element draws.
  const seen = []
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab")
    const focus = await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const cs = getComputedStyle(el)
      return { probe: el.getAttribute("data-probe") || el.getAttribute("aria-label") || el.textContent.trim(), outline: cs.outlineStyle === "none" ? "none" : cs.outlineColor, width: parseFloat(cs.outlineWidth), shadow: cs.boxShadow }
    })
    if (!focus) continue
    if (seen.some(entry => entry.probe === focus.probe)) break
    seen.push(focus)
  }
  assert.ok(seen.length >= 12, `keyboard reached the controls on all three surfaces (${seen.length})`)
  for (const focus of seen) {
    assert.equal(focus.outline, RING, `${focus.probe}: focus outline is the ring colour`)
    assert.ok(focus.width >= 2, `${focus.probe}: focus outline is at least 2px`)
  }
  // On navy fills, the ring is separated from the fill by the cream halo.
  for (const probe of ["light:default", "navy:default", "navy:ghost", "light:tab-active"]) {
    const focus = seen.find(entry => entry.probe === probe)
    assert.ok(focus, `${probe} was reached by keyboard`)
    assert.ok(focus.shadow.includes(HALO), `${probe}: cream halo present (${focus.shadow})`)
  }
  assert.deepEqual(errors, [])
})
