const { test, before, after } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path'), { spawn } = require('node:child_process'), { chromium } = require('playwright')
// The real interview room (real components and room CSS, mocked Auth and database) in Chromium.
// The on-screen keyboard is simulated as Playwright does it: the viewport loses height while a field is
// focused. The field must end up fully inside the remaining viewport. OUTCLASS_KEYBOARD_TEST_MODE=before
// with OUTCLASS_INTERACTION_BASELINE=<old commit> runs the same checks against the previous room.
const PORT = '4331', ORIGIN = `http://127.0.0.1:${PORT}`, MODE = process.env.OUTCLASS_KEYBOARD_TEST_MODE || 'after'
let server, browser
before(async () => {
  server = spawn(process.execPath, [path.join(__dirname, 'helpers/interview-browser-fixture.cjs')], { cwd: path.join(__dirname, '..'), env: { ...process.env, OUTCLASS_INTERACTION_PORT: PORT, OUTCLASS_INTERACTION_BASELINE: process.env.OUTCLASS_INTERACTION_BASELINE || 'HEAD' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  await new Promise((resolve, reject) => { server.stdout.on('data', b => { output += b; if (output.includes('fixture ready:')) resolve() }); server.stderr.on('data', b => { output += b }); server.on('exit', code => reject(Error('Fixture exited ' + code + ': ' + output))) })
  browser = await chromium.launch({ headless: true })
})
after(async () => { await browser?.close(); server?.kill() })

const sizes = [{ name: 'phone', width: 390, height: 844, keyboard: 464 }, { name: 'tablet', width: 820, height: 1180, keyboard: 649 }]
const fields = {
  'miscellaneous notes': async page => { const field = page.getByRole('textbox', { name: 'Miscellaneous notes', exact: true }); await field.focus(); return field },
  'final interview thoughts': async page => { await page.getByRole('button', { name: 'End current interview', exact: true }).click(); const field = page.getByRole('textbox', { name: 'Final interview thoughts', exact: true }); await field.focus(); return field },
  // The original-question field opens focused (autoFocus).
  'original question': async page => { await page.getByRole('button', { name: 'Add original question', exact: true }).click(); const field = page.getByRole('textbox', { name: 'Original question', exact: true }); await page.waitForFunction(() => document.activeElement?.id === 'new-interview-question'); return field },
}

async function open(viewport, reducedMotion = 'reduce') {
  const context = await browser.newContext({ viewport, reducedMotion }), page = await context.newPage(), errors = [], external = []
  page.on('pageerror', e => errors.push(e.message))
  await page.route('**/*', r => { if (r.request().url().startsWith(ORIGIN + '/') || r.request().url().startsWith('blob:')) return r.continue(); external.push(r.request().url()); return r.abort() })
  await page.goto(`${ORIGIN}/?mode=${MODE}&latency=0`)
  await page.getByRole('textbox', { name: 'Miscellaneous notes', exact: true }).waitFor()
  return { context, page, errors, external }
}
const box = field => field.evaluate(el => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: innerHeight, focused: document.activeElement === el } })
async function visible(field, ms = 2000) {
  const end = Date.now() + ms
  for (;;) {
    const b = await box(field)
    if (b.top >= 0 && b.bottom <= b.height) return b
    if (Date.now() > end) return b
    await new Promise(r => setTimeout(r, 50))
  }
}

for (const size of sizes) for (const [name, focus] of Object.entries(fields)) {
  test(`${size.name} ${size.width}×${size.height}: ${name} stays visible when the keyboard leaves ${size.keyboard}px`, async () => {
    const { context, page, errors, external } = await open({ width: size.width, height: size.height })
    try {
      const field = await focus(page)
      await page.setViewportSize({ width: size.width, height: size.keyboard })
      const b = await visible(field)
      assert.equal(b.focused, true, 'focus stays in the field')
      assert.ok(b.top >= 0 && b.bottom <= b.height, `${name} at ${b.top}–${b.bottom} is outside the ${b.height}px viewport`)
      assert.deepEqual(errors, []); assert.deepEqual(external, [])
    } finally { await context.close() }
  })
}

test('smooth scrolling (no reduced-motion preference) also lands the field inside the viewport', async () => {
  const { context, page } = await open({ width: 390, height: 844 }, 'no-preference')
  try {
    const field = await fields['miscellaneous notes'](page)
    await page.setViewportSize({ width: 390, height: 464 })
    const b = await visible(field, 3000)
    assert.ok(b.top >= 0 && b.bottom <= b.height, `notes at ${b.top}–${b.bottom} is outside the ${b.height}px viewport`)
  } finally { await context.close() }
})

test('a field taller than the space above the keyboard keeps its caret line visible', async () => {
  const { context, page } = await open({ width: 390, height: 844 })
  try {
    const field = await fields['miscellaneous notes'](page)
    await field.fill(Array.from({ length: 30 }, (_, i) => `Line ${i + 1}`).join('\n'))
    await field.evaluate(el => { el.style.height = '600px'; el.setSelectionRange(el.value.length, el.value.length) })
    await page.setViewportSize({ width: 390, height: 300 })
    await page.waitForTimeout(300)
    const caret = await field.evaluate(el => { const r = el.getBoundingClientRect(), line = parseFloat(getComputedStyle(el).lineHeight) || 24; return { fieldTop: r.top, fieldBottom: r.bottom, height: innerHeight, line } })
    // 30 lines in a 600px box: the caret (last line) is near the bottom, so the bottom of the field is on screen.
    assert.ok(caret.fieldBottom <= caret.height && caret.fieldBottom >= caret.line, `field bottom ${caret.fieldBottom} should be within the ${caret.height}px viewport`)
  } finally { await context.close() }
})

test('desktop: focusing a visible field does not scroll the room or the page', async () => {
  const { context, page } = await open({ width: 1440, height: 1000 })
  try {
    const notes = page.getByRole('textbox', { name: 'Miscellaneous notes', exact: true })
    const scroll = () => page.evaluate(() => ({ page: scrollY, panes: [...document.querySelectorAll('#interview-completed, .oc-question-workspace')].map(el => el.scrollTop) }))
    const before = await scroll()
    await notes.click(); await page.waitForTimeout(200)
    assert.deepEqual(await scroll(), before)
    // Window resize on desktop (no keyboard) while the field is visible is also a no-op.
    await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(200)
    assert.deepEqual(await scroll(), before)
  } finally { await context.close() }
})

test('reading elsewhere with the keyboard open: a toolbar-sized resize does not snap back to the field', async () => {
  const { context, page } = await open({ width: 390, height: 844 })
  try {
    const field = await fields['miscellaneous notes'](page)
    await page.setViewportSize({ width: 390, height: 464 })
    await visible(field); await page.waitForTimeout(500)
    await page.evaluate(() => scrollBy(0, -300)); await page.waitForTimeout(100)
    const before = await page.evaluate(() => scrollY)
    // The browser toolbar reappearing while scrolling up takes about 56px.
    await page.setViewportSize({ width: 390, height: 408 }); await page.waitForTimeout(300)
    assert.equal(await page.evaluate(() => scrollY), before)
    assert.equal((await box(field)).focused, true)
  } finally { await context.close() }
})
