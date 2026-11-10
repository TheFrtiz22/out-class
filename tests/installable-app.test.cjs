// Installable app (S1-7): web app manifest, icons, service worker scope and registration gates.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.join(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

function loadManifest() {
  const mod = { exports: {} }
  const code = ts.transpileModule(read('app/manifest.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const pwa = {}
  new Function('exports', ts.transpileModule(read('lib/pwa.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(pwa)
  new Function('require', 'module', 'exports', code)(name => name === '@/lib/pwa' ? pwa : require(name), mod, mod.exports)
  return mod.exports.default()
}

function pngSize(file) {
  const buffer = fs.readFileSync(path.join(root, 'public', file))
  assert.equal(buffer.toString('ascii', 1, 4), 'PNG', `${file} is a PNG`)
  return `${buffer.readUInt32BE(16)}x${buffer.readUInt32BE(20)}`
}

test('manifest has the installability fields and brand colors', () => {
  const manifest = loadManifest()
  assert.equal(manifest.id, '/')
  assert.equal(manifest.name, 'OutClass')
  assert.equal(manifest.short_name, 'OutClass')
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.scope, '/')
  assert.match(manifest.start_url, /^\/\?source=pwa$/)
  assert.equal(manifest.theme_color.toLowerCase(), '#232d4b')
  const tokens = read('styles/tokens.css')
  assert.match(tokens, new RegExp(`--school-primary:\\s*${manifest.theme_color}`, 'i'))
  assert.match(tokens, new RegExp(`--background:\\s*${manifest.background_color}`, 'i'))
})

test('manifest icons: 192, 512 and a 512 maskable PNG that exist at their declared size', () => {
  const icons = loadManifest().icons
  const png = icons.filter(icon => icon.type === 'image/png')
  const find = (sizes, purpose) => png.find(icon => icon.sizes === sizes && icon.purpose === purpose)
  for (const [sizes, purpose] of [['192x192', 'any'], ['512x512', 'any'], ['512x512', 'maskable']]) {
    const icon = find(sizes, purpose)
    assert.ok(icon, `${sizes} ${purpose} icon`)
    assert.equal(pngSize(icon.src), sizes)
  }
  for (const icon of icons) assert.ok(fs.existsSync(path.join(root, 'public', icon.src)), icon.src)
})

test('layout wires the manifest, iOS web-app metadata and an opaque apple-touch-icon', () => {
  const layout = read('app/layout.tsx')
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/)
  assert.match(layout, /appleWebApp: \{ capable: true, title: "OutClass"/)
  assert.match(layout, /themeColor: PWA_THEME_COLOR/)
  assert.match(read('app/apple-icon.tsx'), /brand\/pwa\/apple-touch-icon-180\.png/)
  const buffer = fs.readFileSync(path.join(root, 'public/brand/pwa/apple-touch-icon-180.png'))
  assert.equal(pngSize('brand/pwa/apple-touch-icon-180.png'), '180x180')
  assert.equal(buffer[25], 2, 'colour type 2 (RGB, no alpha): iOS paints transparency black')
})

// Runs public/sw.js against a fake worker scope and records what it intercepts and caches.
function runWorker({ online = true } = {}) {
  const listeners = {}
  const stores = new Map()
  const puts = []
  const cacheFor = name => {
    if (!stores.has(name)) stores.set(name, new Map())
    const store = stores.get(name)
    return {
      match: async request => store.get(typeof request === 'string' ? request : request.url) ?? null,
      put: async (request, response) => { puts.push({ cache: name, url: request.url }); store.set(request.url, response) },
      addAll: async requests => { for (const request of requests) { puts.push({ cache: name, url: request.url }); store.set(request.url, { offline: true, url: request.url }) } },
      keys: async () => [...store.keys()].map(url => ({ url })),
      delete: async request => store.delete(request.url),
    }
  }
  const origin = 'https://www.out-class.net'
  const network = []
  const self = {
    location: { origin },
    addEventListener: (type, fn) => { listeners[type] = fn },
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  }
  const context = {
    self, URL, Promise, Math,
    Request: class { constructor(url, init) { this.url = new URL(url, origin).href; this.init = init } },
    Response: { error: () => ({ error: true }) },
    caches: {
      open: async name => cacheFor(name),
      keys: async () => [...stores.keys()],
      delete: async name => stores.delete(name),
      match: async (url, { cacheName } = {}) => stores.get(cacheName)?.get(new URL(url, origin).href) ?? null,
    },
    fetch: async request => {
      network.push(request.url)
      if (!online) throw new TypeError('offline')
      return { ok: true, type: 'basic', headers: new Map([['cache-control', 'public, max-age=31536000, immutable']]), clone() { return this } }
    },
  }
  vm.runInNewContext(read('public/sw.js'), context)
  async function request(pathname, { method = 'GET', mode = 'cors', headers = {} } = {}) {
    let responded = null
    const url = pathname.startsWith('http') ? pathname : origin + pathname
    const event = { request: { url, method, mode, headers: new Map(Object.entries(headers)) }, respondWith: promise => { responded = promise } }
    listeners.fetch(event)
    return responded ? { intercepted: true, response: await responded } : { intercepted: false }
  }
  async function lifecycle() {
    let wait
    listeners.install({ waitUntil: promise => { wait = promise } }); await wait
    listeners.activate({ waitUntil: promise => { wait = promise } }); await wait
  }
  return { request, lifecycle, puts, stores, network }
}

test('service worker caches hashed /_next/static assets cache-first and nothing else', async () => {
  const worker = runWorker()
  await worker.lifecycle()
  const precached = worker.puts.map(put => new URL(put.url).pathname)
  assert.deepEqual(precached.sort(), ['/brand/pwa/icon-192.png', '/offline.html'])
  worker.puts.length = 0

  const asset = await worker.request('/_next/static/chunks/app-1a2b3c.js')
  assert.ok(asset.intercepted)
  await worker.request('/_next/static/chunks/app-1a2b3c.js')
  assert.equal(worker.network.filter(url => url.endsWith('app-1a2b3c.js')).length, 1, 'second request is served from cache')

  const bypassed = [
    ['/api/club/abc/applicants.csv'], ['/api/recruiting-resumes/1'], ['/api/calendar/feed.ics'], ['/_next/data/build/home.json'],
    ['/_next/image?url=%2Fx.png&w=64&q=75'], ['/home', { headers: { rsc: '1' } }], ['/club/abc/workspace'],
    ['/club/abc/workspace', { method: 'POST', headers: { 'next-action': 'abc' } }], ['/api/auth/callback?code=1'],
    ['/_next/static/chunks/x.js', { headers: { authorization: 'Bearer t' } }], ['https://xyz.supabase.co/storage/v1/object/resume.pdf'],
    ['/_next/static/chunks/y.js', { method: 'POST' }],
  ]
  for (const [url, options] of bypassed) assert.equal((await worker.request(url, options)).intercepted, false, `${options?.method ?? 'GET'} ${url} passes through`)
  assert.deepEqual(worker.puts.map(put => new URL(put.url).pathname), ['/_next/static/chunks/app-1a2b3c.js'], 'only the static asset was cached')
})

test('navigations hit the network, are never cached, and fall back only to the offline page', async () => {
  const online = runWorker()
  await online.lifecycle()
  online.puts.length = 0
  const page = await online.request('/home', { mode: 'navigate' })
  assert.ok(page.intercepted)
  assert.equal(page.response.ok, true)
  assert.deepEqual(online.puts, [], 'page HTML is not cached')

  const offline = runWorker({ online: false })
  await offline.lifecycle()
  const fallback = await offline.request('/club/abc', { mode: 'navigate' })
  assert.equal(fallback.response.url, 'https://www.out-class.net/offline.html')

  for (const url of ['/api/club/abc/export', '/auth/callback?code=1', '/q/AbC123', '/check-in/xyz', '/platform', '/platform/clubs', '/preview/x', '/club/abc/calendar.ics', '/exports/roster.csv', '/_next/data/b/x.json']) {
    assert.equal((await offline.request(url, { mode: 'navigate' })).intercepted, false, `navigate ${url} is not intercepted`)
  }
})

test('sw.js source: versioned caches, old ones deleted, skipWaiting + clients.claim, no HTML or API caching', () => {
  const source = read('public/sw.js')
  assert.match(source, /const VERSION = "v\d+"/)
  assert.match(source, /skipWaiting\(\)/)
  assert.match(source, /clients\.claim\(\)/)
  assert.match(source, /caches\.delete\(key\)/)
  assert.equal((source.match(/cache\.put\(/g) || []).length, 1, 'one cache write, inside cacheFirst')
  assert.match(source, /url\.pathname\.startsWith\("\/_next\/static\/"\)/)
  assert.doesNotMatch(source, /addEventListener\("push"|pushManager|PushSubscription/, "push is S1-8")
  const config = read('next.config.mjs')
  assert.match(config, /source: "\/sw\.js", headers: \[\{ key: "Cache-Control", value: "no-cache" \}/)
  for (const header of ['X-Content-Type-Options', 'Referrer-Policy', 'Content-Security-Policy', 'X-Frame-Options']) assert.match(config, new RegExp(header))
  assert.match(read('middleware.ts'), /"\/sw\.js", "\/offline\.html"\]/)
  const offline = read('public/offline.html')
  assert.doesNotMatch(offline, /<script/i, 'offline page is static, with no user data')
})

test('registration is skipped in development, Demo Mode, support sessions and /platform', () => {
  const layout = read('app/layout.tsx')
  assert.match(layout, /process\.env\.NODE_ENV === "production" && !demoEnabled && !cookieStore\.has\(PLATFORM_VIEW_COOKIE\) && <ServiceWorkerRegistration \/>/)
  const component = read('components/service-worker-registration.tsx')
  assert.match(component, /^"use client"/)
  assert.match(component, /process\.env\.NODE_ENV !== "production" \|\| isDemoRequested\(\)\) return/)
  assert.match(component, /pathname\.startsWith\("\/platform"\)\) return/)

  // Execute the effect under each condition and record whether register() is called.
  const code = ts.transpileModule(component, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  function attempt({ env, demo = false, pathname = '/home' }) {
    const registered = []
    let effect
    const mod = { exports: {} }
    const sandbox = {
      process: { env: { NODE_ENV: env } },
      navigator: { serviceWorker: { register: (url, options) => { registered.push([url, options]); return Promise.resolve() } } },
      window: { location: { pathname }, addEventListener() {}, removeEventListener() {} },
      document: { readyState: 'complete' },
    }
    const req = name => name === 'react' ? { useEffect: fn => { effect = fn } } : name === '@/lib/demo/activation' ? { isDemoRequested: () => demo } : require(name)
    vm.runInNewContext(`(function (require, module, exports) {${code}\n})`, sandbox)(req, mod, mod.exports)
    mod.exports.ServiceWorkerRegistration()
    effect()
    return registered
  }
  assert.deepEqual(attempt({ env: 'production' }).map(([url, options]) => [url, options.scope]), [['/sw.js', '/']])
  assert.equal(attempt({ env: 'development' }).length, 0)
  assert.equal(attempt({ env: 'test' }).length, 0)
  assert.equal(attempt({ env: 'production', demo: true }).length, 0)
  assert.equal(attempt({ env: 'production', pathname: '/platform/clubs' }).length, 0)
})
