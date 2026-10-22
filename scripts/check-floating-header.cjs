/** Bundles the real shell/Radix UI with isolated identity/data boundaries.
 * No app routes, sessions, credentials, databases, or production data are changed.
 */
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
const assert = require('node:assert/strict')
const { chromium, webkit } = require('playwright')
const repo = path.resolve(__dirname, '..')
const fixture = path.join(repo, 'tests/fixtures/floating-header')
const engine = process.env.OUTCLASS_NAV_BROWSER === 'webkit' ? webkit : chromium
async function build(root, { realNotificationState = false } = {}) {
  const tsLoader = path.join(root, 'typescript-loader.cjs'), cssLoader = path.join(root, 'style-loader.cjs')
  await fs.writeFile(tsLoader, `const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=function(source){return ts.transpileModule(source,{fileName:this.resourcePath,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText}`)
  await fs.writeFile(cssLoader, 'module.exports = ' + function(source) { return 'const style=document.createElement("style");style.textContent=' + JSON.stringify(source) + ';document.head.append(style);' }.toString())
  const compiled = require('next/dist/compiled/webpack/webpack'); compiled.init()
  const boundaries = path.join(fixture, 'boundaries.jsx')
  const alias = { 'next/link$': path.join(fixture, 'navigation.jsx'), 'next/navigation$': path.join(fixture, 'navigation.jsx'), 'next/image$': boundaries }
  for (const key of ['@/contexts/auth-context', '@/contexts/demo-context', '@/contexts/organization-invitations-context', '@/lib/application-state', '@/lib/workspace-api', '@/actions/communications', '@/actions/club-onboarding', '@/utils/supabase/client', '@/components/tutorial-walkthrough']) alias[`${key}$`] = boundaries
  if (realNotificationState) delete alias['@/lib/application-state$']
  alias['@'] = repo
  await new Promise((resolve, reject) => compiled.webpack({ mode: 'development', context: repo, entry: path.join(fixture, 'app.jsx'), output: { path: root, filename: 'bundle.js' }, devtool: false, resolve: { alias, extensions: ['.tsx', '.ts', '.jsx', '.js'], modules: ['node_modules'] }, module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, use: tsLoader }, { test: /\.css$/, use: cssLoader }] }, performance: { hints: false } }, (error, stats) => { if (error) reject(error); else if (stats.hasErrors()) reject(Error(stats.toString({ all: false, errors: true }))); else resolve() }))
  const postcss = require('postcss'), plugin = require('@tailwindcss/postcss')
  const css = await fs.readFile(path.join(repo, 'app/globals.css'), 'utf8')
  const result = await postcss([plugin({ base: repo })]).process(css, { from: path.join(repo, 'app/globals.css') })
  const fonts = `@font-face{font-family:"Source Sans 3";src:url('/assets/fonts/source-sans-3/source-sans-3-upright.woff2');font-weight:200 900;font-display:swap}@font-face{font-family:"Libre Caslon Text";src:url('/assets/fonts/libre-caslon-text/libre-caslon-text-variable.woff2');font-weight:400 700;font-display:swap}`
  await fs.writeFile(path.join(root, 'styles.css'), fonts + result.css + ':root{--font-source-sans-3:"Source Sans 3";--font-libre-caslon-text:"Libre Caslon Text";}')
}
async function check() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'outclass-floating-header-'))
  let server, browser
  try {
    await build(root)
    server = http.createServer(async (request, response) => {
      const url = new URL(request.url, 'http://localhost'), resource = url.pathname
      if (resource === '/api/platform/eligibility') { response.setHeader('Content-Type', 'application/json'); response.end('{"eligible":false}'); return }
      if (resource === '/api/communications/stream') { response.writeHead(204); response.end(); return }
      if (resource === '/api/auth/logout') { response.setHeader('Content-Type', 'application/json'); response.end('{"ok":true}'); return }
      const file = resource === '/bundle.js' || resource === '/styles.css' ? path.join(root, resource.slice(1)) : resource.startsWith('/assets/fonts/') ? path.join(repo, 'app/fonts', resource.slice('/assets/fonts/'.length)) : resource.startsWith('/assets/media/') ? path.join(repo, '.next/static/media', path.basename(resource)) : path.join(repo, 'public', resource)
      try { const data = await fs.readFile(file); response.setHeader('Content-Type', resource.endsWith('.js') ? 'text/javascript' : resource.endsWith('.css') ? 'text/css' : resource.endsWith('.svg') ? 'image/svg+xml' : resource.endsWith('.woff2') ? 'font/woff2' : resource.endsWith('.jpg') ? 'image/jpeg' : 'image/png'); response.end(data) }
      catch { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>') }
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const base = `http://127.0.0.1:${server.address().port}`
    browser = await engine.launch({ headless: true, ...(engine === chromium && !require('node:fs').existsSync(chromium.executablePath()) ? { channel: 'chrome' } : {}) })
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${base}/club/fixture-mii/workspace?section=recruitment&role=owner`, { waitUntil: 'networkidle' })
    await page.locator('.oc-product-header').waitFor({ state: 'visible' })
    await page.screenshot({ path: '/tmp/outclass-floating-header-desktop.png' })
    // The desktop dock expands without changing the shell's reserved content width.
    const dockRail = page.locator('aside .oc-dock-rail'), dock = page.getByRole('complementary', { name: 'Workspace dock' })
    assert.equal(await dockRail.count(), 1)
    assert.equal(await dock.getAttribute('data-dock-expanded'), 'false')
    const contentWidth = await page.locator('main').evaluate(el => el.getBoundingClientRect().width)
    await dockRail.getByRole('link', { name: 'Overview', exact: true }).hover()
    await page.waitForFunction(() => document.querySelector('[data-dock-expanded]')?.dataset.dockExpanded === 'true')
    await page.waitForTimeout(350)
    assert.equal(await page.locator('main').evaluate(el => el.getBoundingClientRect().width), contentWidth)
    await page.mouse.move(900, 600)
    await page.waitForFunction(() => document.querySelector('[data-dock-expanded]')?.dataset.dockExpanded === 'false')
    console.log('PASS automatic dock expansion, delayed collapse and constant content reservation')

    console.log('FIXTURE READY', base)
    if (process.argv.includes('--serve')) { console.log('Isolated header fixture is running; no production data or sessions.'); await new Promise(() => {}); return }
    // Browser assertions are kept below so all role and action checks exercise this same shell.
    const header = page.locator('.oc-product-header'), modes = page.getByRole('navigation', { name: 'Product modes', exact: true })
    assert.equal(await header.locator('.oc-header-context').count(), 0)
    assert.equal(await header.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)')
    assert.equal(await header.evaluate(el => getComputedStyle(el).borderBottomWidth), '0px')
    assert.equal(await modes.getByRole('link', { name: 'Recruiting', exact: true }).getAttribute('aria-current'), 'page')
    await modes.getByRole('link', { name: 'Club', exact: true }).click()
    await page.waitForURL('**/workspace?section=overview&role=owner')
    assert.equal(await modes.getByRole('link', { name: 'Club', exact: true }).getAttribute('aria-current'), 'page')
    await page.goBack(); await modes.getByRole('link', { name: 'Recruiting', exact: true }).waitFor()
    assert.equal(await modes.getByRole('link', { name: 'Recruiting', exact: true }).getAttribute('aria-current'), 'page')
    await page.goForward()
    assert.equal(await modes.getByRole('link', { name: 'Club', exact: true }).getAttribute('aria-current'), 'page')
    console.log('PASS floating layout and route-derived selection after tab changes and browser back/forward')
    const utilityPositions = () => header.locator('.oc-product-utilities').evaluate(el => Array.from(el.children).map(child => { const rect = child.getBoundingClientRect(); return [rect.x, rect.y, rect.width, rect.height] }))
    const beforeSearch = await utilityPositions()
    await page.getByRole('button', { name: /^Search OutClass(?: |$)/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Search OutClass', exact: true })
    await dialog.getByRole('combobox').fill('Avery')
    await dialog.getByRole('option', { name: /Avery Morgan/ }).waitFor()
    assert.deepEqual(await utilityPositions(), beforeSearch)
    assert.equal(await header.locator('.oc-floating-search').evaluate(el => { const rect = el.getBoundingClientRect(), scale = new DOMMatrix(getComputedStyle(el, '::before').transform).a, bell = document.querySelector('[data-tour="notifications"]').getBoundingClientRect(); return rect.right + (scale - 1) * rect.width / 2 < bell.left }), true)
    assert.equal(await page.evaluate(() => window.fixtureSearchCalls.at(-1).leader), true)
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Escape')
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label')?.startsWith('Search OutClass') && document.activeElement?.tagName === 'BUTTON')
    for (const shortcut of ['Meta+k', 'Control+k']) {
      await modes.getByRole('link', { name: 'Club', exact: true }).focus()
      await page.keyboard.press(shortcut); await dialog.waitFor(); await page.keyboard.press('Escape')
      await page.waitForFunction(() => document.activeElement?.getAttribute('data-tour') === 'mode-club')
    }
    await page.getByRole('button', { name: /^Search OutClass(?: |$)/ }).click()
    await dialog.getByRole('combobox').fill('Profile')
    await dialog.getByRole('option', { name: 'Profile', exact: true }).click()
    await page.waitForURL('**view=student-profile')
    await page.waitForFunction(() => document.activeElement?.id === 'workspace-content')
    console.log('PASS one global search, both keyboard shortcuts, authorized record UI, and result navigation')
    const bell = header.locator('[data-tour="notifications"]')
    assert.match(await bell.getAttribute('aria-label'), /2 unread, 1 pending invitation/)
    assert.equal(await bell.locator('.oc-floating-unread').count(), 1)
    const currentURL = page.url()
    await bell.click(); await page.getByRole('dialog', { name: 'Notifications', exact: true }).waitFor()
    assert.equal(page.url(), currentURL)
    await page.getByRole('button', { name: 'Expand notifications', exact: true }).click(); await page.waitForURL('**view=inbox')
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('fixture:counts', { detail: { unread: 0, invitations: 0 } })))
    await page.waitForFunction(() => document.querySelector('[data-tour="notifications"]').getAttribute('aria-label') === 'Notifications')
    assert.equal(await bell.locator('.oc-floating-unread').count(), 0)
    console.log('PASS existing inbox destination and reactive unread/invitation indicator')
    await page.evaluate(() => scrollTo(0, 700))
    await header.locator('[data-tour="profile"]').click()
    const menu = page.getByRole('menu')
    await menu.getByRole('menuitem', { name: 'Settings', exact: true }).waitFor()
    assert.equal(await menu.evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight }), true)
    await page.keyboard.press('Escape')
    await page.evaluate(() => scrollTo(0, 0))
    await header.getByRole('button', { name: /^Switch club:/ }).click()
    await page.getByRole('menuitem', { name: /Virginia Volunteers/ }).click()
    await page.waitForURL('**/club/fixture-volunteers/workspace*')
    assert.equal(await header.getByRole('button', { name: /^Switch club:/ }).getAttribute('aria-expanded'), 'false')
    console.log('PASS portaled account menu while scrolling and preserved header club switching')
    await page.goto(`${base}/club/fixture-mii/workspace?section=overview&role=owner&searchError=1`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /^Search OutClass(?: |$)/ }).click()
    await dialog.getByRole('combobox').fill('Profile')
    await dialog.getByRole('alert').waitFor()
    assert.equal(await dialog.getByRole('option', { name: 'Profile', exact: true }).count(), 1)
    await page.keyboard.press('Escape')
    console.log('PASS search failure remains visible and page navigation remains available')
    for (const role of ['owner', 'reviewer', 'settings', 'student', 'member', 'platform']) {
      await page.route('**/api/platform/eligibility', route => route.fulfill({ json: { eligible: role === 'platform' } }))
      await page.goto(role === 'platform' ? `${base}/platform?role=platform` : `${base}/club/fixture-mii/workspace?section=overview&role=${role}`, { waitUntil: 'networkidle' })
      const expected = role === 'platform' ? [] : role === 'settings' ? ['Club'] : ['student', 'member'].includes(role) ? ['Explore', 'Apply', 'My Clubs'] : ['Recruiting', 'Club']
      assert.deepEqual(await header.locator('.oc-product-modes .oc-floating-mode-link').allTextContents(), expected)
      for (const width of [1600, 1440, 1280, 1024, 900, 768, 640, 540, 390, 320]) {
        await page.setViewportSize({ width, height: 844 })
        assert.equal(await header.evaluate(el => {
          const controls = Array.from(el.querySelectorAll('a,button')).filter(item => item.getBoundingClientRect().width > 0)
          const rects = controls.map(item => item.getBoundingClientRect())
          const minLeft = innerWidth >= 1024 ? document.querySelector('aside').getBoundingClientRect().right : 0
          return rects.every(rect => rect.left >= minLeft && rect.right <= innerWidth + 1 && rect.height >= 44) && rects.every((a, i) => rects.slice(i + 1).every(b => a.right <= b.left + .5 || b.right <= a.left + .5 || a.bottom <= b.top + .5 || b.bottom <= a.top + .5))
        }), true, `${role}: no overlap and accessible targets at ${width}px`)
        if (role === 'owner' && width === 390) await page.screenshot({ path: '/tmp/outclass-floating-header-mobile.png' })
      }
    }
    await page.unroute('**/api/platform/eligibility')
    console.log('PASS six permission roles and ten desktop/tablet/mobile widths')
    await page.goto(`${base}/club/fixture-mii/workspace?section=overview&role=settings`, { waitUntil: 'networkidle' })
    await header.locator('.oc-product-modes .oc-floating-mode-link').evaluate(el => { el.textContent = 'Local workspace preview' })
    assert.equal(await header.evaluate(el => { const mode = el.querySelector('.oc-product-modes').getBoundingClientRect(), utilities = el.querySelector('.oc-product-utilities').getBoundingClientRect(); return (mode.right + 7 <= utilities.left || mode.top >= utilities.bottom) && utilities.right <= innerWidth && el.scrollWidth <= innerWidth }), true)
    console.log('PASS long single-mode labels wrap without crowding mobile utilities')
    await page.goto(`${base}/club/fixture-mii/workspace?section=overview&role=owner`, { waitUntil: 'networkidle' })
    await header.locator('[data-tour="profile"]').click()
    assert.equal(await menu.evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight }), true)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'More navigation and workspaces', exact: true }).click()
    const drawer = page.getByRole('dialog', { name: 'Workspace navigation', exact: true })
    await drawer.waitFor()
    await page.setViewportSize({ width: 1280, height: 900 })
    await drawer.waitFor({ state: 'hidden' })
    console.log('PASS mobile account menu and existing drawer close correctly on desktop resize')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${base}/club/fixture-mii/workspace?section=recruitment&role=owner&avatar=1`, { waitUntil: 'networkidle' })
    await header.locator('[data-tour="profile"] img').waitFor(); assert.equal(await header.locator('[data-tour="profile"] img').getAttribute('alt'), '')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    assert.ok(await modes.locator('.oc-floating-mode-indicator').evaluate(el => getComputedStyle(el).transitionDuration.split(',').every(value => parseFloat(value) <= .001)))
    await page.evaluate(() => { const guard = document.createElement('div'); guard.id = 'fixture-saving'; guard.dataset.saving = 'true'; document.body.append(guard) })
    const guardedURL = page.url()
    await modes.getByRole('link', { name: 'Club', exact: true }).click()
    await bell.click()
    assert.equal(page.url(), guardedURL)
    await page.evaluate(() => document.getElementById('fixture-saving').remove())
    await page.route('**/api/auth/logout', route => route.fulfill({ status: 500, body: '{}' }))
    await header.locator('[data-tour="profile"]').click()
    await page.getByRole('menuitem', { name: 'Sign out', exact: true }).click()
    await page.getByText('Could not sign out. Try again.', { exact: true }).waitFor()
    assert.equal(page.url(), guardedURL)
    await page.unroute('**/api/auth/logout')
    await header.locator('[data-tour="profile"]').click()
    await page.getByRole('menuitem', { name: 'Sign out', exact: true }).click()
    await page.waitForURL(`${base}/`)
    assert.equal(await page.evaluate(() => sessionStorage.getItem('fixtureSignOuts')), '1')
    assert.deepEqual(errors, [])
    console.log('PASS existing avatar, reduced motion, sign-out redirect, and no browser errors')
  } finally { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); await fs.rm(root, { recursive: true, force: true }) }
}
module.exports = { build }
if (require.main === module) check().catch(error => { console.error(error); process.exitCode = 1 })
