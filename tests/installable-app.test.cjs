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

// Runs a worker script against a fake worker scope and records what it intercepts and caches.
// `fetchError` makes fetch reject with a network TypeError ('network') or an AbortError ('abort');
// `onLine` is navigator.onLine; `putThrows`/`openThrows` break the Cache API; `status` sets the reply.
function runWorker({ script = 'public/sw.js', fetchError = null, onLine = true, status = 200, putThrows = false, openThrows = false, stores = new Map(), windows = [] } = {}) {
  const listeners = {}
  const puts = []
  const cacheFor = name => {
    if (!stores.has(name)) stores.set(name, new Map())
    const store = stores.get(name)
    return {
      match: async request => store.get(typeof request === 'string' ? request : request.url) ?? null,
      put: (request, response) => {
        if (putThrows) throw new Error('QuotaExceededError')
        puts.push({ cache: name, url: request.url }); store.set(request.url, response); return Promise.resolve()
      },
      addAll: async requests => { for (const request of requests) { puts.push({ cache: name, url: request.url }); store.set(request.url, { offline: true, url: request.url }) } },
      keys: async () => [...store.keys()].map(url => ({ url })),
      delete: async request => store.delete(request.url),
    }
  }
  const origin = 'https://www.out-class.net'
  const network = []
  const unregistered = []
  const self = {
    location: { origin },
    navigator: { onLine },
    addEventListener: (type, fn) => { listeners[type] = fn },
    skipWaiting: async () => {},
    clients: { claim: async () => {}, matchAll: async () => windows },
    registration: { unregister: async () => { unregistered.push(true); return true } },
  }
  const context = vm.createContext({
    self, URL, Promise, Math,
    Request: class { constructor(url, init) { this.url = new URL(url, origin).href; this.init = init } },
    Response: { error: () => ({ error: true }) },
    caches: {
      open: async name => { if (openThrows) throw new Error('SecurityError'); return cacheFor(name) },
      keys: async () => [...stores.keys()],
      delete: async name => stores.delete(name),
      match: async (url, { cacheName } = {}) => stores.get(cacheName)?.get(new URL(url, origin).href) ?? null,
    },
  })
  const WorkerTypeError = vm.runInContext('TypeError', context)
  context.fetch = async request => {
    network.push(request.url)
    if (fetchError === 'network') throw new WorkerTypeError('Failed to fetch')
    if (fetchError === 'abort') throw Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' })
    return { ok: status >= 200 && status < 300, status, type: 'basic', headers: new Map([['cache-control', 'public, max-age=31536000, immutable']]), clone() { return this } }
  }
  vm.runInContext(read(script), context)
  async function request(pathname, { method = 'GET', mode = 'cors', headers = {} } = {}) {
    let responded = null
    const pending = []
    const url = pathname.startsWith('http') ? pathname : origin + pathname
    const event = { request: { url, method, mode, headers: new Map(Object.entries(headers)) }, respondWith: promise => { responded = promise }, waitUntil: promise => { pending.push(promise) } }
    listeners.fetch(event)
    if (!responded) return { intercepted: false }
    const outcome = await responded.then(response => ({ intercepted: true, response }), error => ({ intercepted: true, error }))
    await Promise.all(pending)
    return { ...outcome, waited: pending.length }
  }
  async function lifecycle(types = ['install', 'activate']) {
    for (const type of types) {
      let wait
      listeners[type]({ waitUntil: promise => { wait = promise } })
      await wait
    }
  }
  return { request, lifecycle, puts, stores, network, unregistered }
}

test('service worker caches hashed /_next/static assets cache-first and nothing else', async () => {
  const worker = runWorker()
  await worker.lifecycle()
  const precached = worker.puts.map(put => new URL(put.url).pathname)
  assert.deepEqual(precached.sort(), ['/brand/pwa/icon-192.png', '/offline.html'])
  worker.puts.length = 0

  const asset = await worker.request('/_next/static/chunks/app-1a2b3c.js')
  assert.ok(asset.intercepted)
  assert.equal(asset.waited, 1, 'the cache write and trim run inside event.waitUntil')
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

test('a failing Cache API or a 206 never breaks or pollutes a static asset response', async () => {
  const throwing = runWorker({ putThrows: true })
  const put = await throwing.request('/_next/static/chunks/a.js')
  assert.equal(put.error, undefined)
  assert.equal(put.response.status, 200, 'cache.put throwing still returns the network response')

  const unopenable = runWorker({ openThrows: true })
  const opened = await unopenable.request('/_next/static/chunks/b.js')
  assert.equal(opened.response.status, 200, 'caches.open throwing still returns the network response')

  const partial = runWorker({ status: 206 })
  const range = await partial.request('/_next/static/media/clip.mp4')
  assert.equal(range.response.status, 206, 'the 206 is returned')
  assert.deepEqual(partial.puts, [], 'and never stored')
  assert.equal(range.waited, 0)
})

test('navigations hit the network, are never cached, and fall back only to the offline page', async () => {
  const online = runWorker()
  await online.lifecycle()
  online.puts.length = 0
  const page = await online.request('/home', { mode: 'navigate' })
  assert.ok(page.intercepted)
  assert.equal(page.response.ok, true)
  assert.deepEqual(online.puts, [], 'page HTML is not cached')

  const failed = runWorker({ fetchError: 'network' })
  await failed.lifecycle()
  assert.equal((await failed.request('/club/abc', { mode: 'navigate' })).response.url, 'https://www.out-class.net/offline.html', 'network TypeError')

  const offline = runWorker({ fetchError: 'abort', onLine: false })
  await offline.lifecycle()
  assert.equal((await offline.request('/club/abc', { mode: 'navigate' })).response.url, 'https://www.out-class.net/offline.html', 'navigator.onLine false')

  const aborted = runWorker({ fetchError: 'abort' })
  await aborted.lifecycle()
  const abortedPage = await aborted.request('/club/abc', { mode: 'navigate' })
  assert.equal(abortedPage.response, undefined, 'an aborted navigation does not show the offline page')
  assert.equal(abortedPage.error.name, 'AbortError')

  for (const url of ['/api/club/abc/export', '/auth/callback?code=1', '/q/AbC123', '/check-in/xyz', '/platform', '/platform/clubs', '/preview/x', '/club/abc/calendar.ics', '/exports/roster.csv', '/_next/data/b/x.json']) {
    assert.equal((await failed.request(url, { mode: 'navigate' })).intercepted, false, `navigate ${url} is not intercepted`)
  }
})

test('sw.js source: versioned caches, old ones deleted, skipWaiting + clients.claim, no HTML or API caching', () => {
  const source = read('public/sw.js')
  assert.match(source, /const VERSION = "v\d+"/)
  assert.match(source, /skipWaiting\(\)/)
  assert.match(source, /clients\.claim\(\)/)
  assert.match(source, /caches\.delete\(key\)/)
  assert.equal((source.match(/cache\.put\(/g) || []).length, 1, 'one cache write, inside cacheFirst')
  assert.match(source, /response\.status === 200/)
  assert.match(source, /url\.pathname\.startsWith\("\/_next\/static\/"\)/)
  assert.doesNotMatch(source, /addEventListener\("push"|pushManager|PushSubscription/, "push is S1-8")
  const config = read('next.config.mjs')
  assert.match(config, /source: "\/sw\.js", headers: \[\{ key: "Cache-Control", value: "no-cache" \}/)
  for (const header of ['X-Content-Type-Options', 'Referrer-Policy', 'Content-Security-Policy', 'X-Frame-Options']) assert.match(config, new RegExp(header))
  assert.match(read('middleware.ts'), /"\/sw\.js", "\/offline\.html"\]/)
  const offline = read('public/offline.html')
  assert.doesNotMatch(offline, /<script/i, 'offline page is static, with no user data')
})

// Executes the registration component's effect in a sandbox and records what it did.
function runRegistration({ env = 'production', demo = false, pathname = '/home', disabled = false } = {}) {
  const component = read('components/service-worker-registration.tsx')
  const code = ts.transpileModule(component, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const registered = []
  const unregistered = []
  const cacheNames = new Set(['outclass-static-v1', 'outclass-offline-v1', 'third-party-cache'])
  let effect
  const mod = { exports: {} }
  const sandbox = {
    process: { env: { NODE_ENV: env } },
    navigator: { serviceWorker: {
      register: (url, options) => { registered.push([url, options]); return Promise.resolve() },
      getRegistrations: async () => [1, 2].map(id => ({ unregister: async () => { unregistered.push(id); return true } })),
    } },
    caches: { keys: async () => [...cacheNames], delete: async name => cacheNames.delete(name) },
    window: { location: { pathname }, addEventListener() {}, removeEventListener() {} },
    document: { readyState: 'complete' },
  }
  const req = name => name === 'react' ? { useEffect: fn => { effect = fn } } : name === '@/lib/demo/activation' ? { isDemoRequested: () => demo } : require(name)
  vm.runInNewContext(`(function (require, module, exports) {${code}\n})`, sandbox)(req, mod, mod.exports)
  mod.exports.ServiceWorkerRegistration({ disabled })
  effect()
  return { registered, unregistered, cacheNames }
}

test('registration is skipped in development, Demo Mode, support sessions and /platform', () => {
  const layout = read('app/layout.tsx')
  assert.match(layout, /process\.env\.NODE_ENV === "production" && \(process\.env\.OUTCLASS_SERVICE_WORKER === "off"\s*\? <ServiceWorkerRegistration disabled \/>\s*: !demoEnabled && !cookieStore\.has\(PLATFORM_VIEW_COOKIE\) && <ServiceWorkerRegistration \/>\)/)
  const component = read('components/service-worker-registration.tsx')
  assert.match(component, /^"use client"/)

  assert.deepEqual(runRegistration().registered.map(([url, options]) => [url, options.scope]), [['/sw.js', '/']])
  assert.equal(runRegistration({ env: 'development' }).registered.length, 0)
  assert.equal(runRegistration({ env: 'test' }).registered.length, 0)
  assert.equal(runRegistration({ demo: true }).registered.length, 0)
  assert.equal(runRegistration({ pathname: '/platform/clubs' }).registered.length, 0)
})

test('kill switch: OUTCLASS_SERVICE_WORKER=off unregisters workers and clears OutClass caches', async () => {
  const killed = runRegistration({ disabled: true })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(killed.registered.length, 0, 'does not register')
  assert.deepEqual(killed.unregistered, [1, 2], 'unregisters every registration')
  assert.deepEqual([...killed.cacheNames], ['third-party-cache'], 'deletes only outclass-* caches')
  assert.match(read('.env.example'), /^OUTCLASS_SERVICE_WORKER=""$/m)
})

test('sw-kill.js template: skips waiting, deletes outclass-* caches, unregisters and reloads open tabs', async () => {
  const navigated = []
  const windows = ['https://www.out-class.net/home', 'https://www.out-class.net/club/abc'].map(url => ({ url, navigate: async to => { navigated.push(to) } }))
  const stores = new Map([['outclass-static-v1', new Map()], ['outclass-offline-v1', new Map()], ['other', new Map()]])
  const worker = runWorker({ script: 'public/sw-kill.js', stores, windows })
  await worker.lifecycle()
  assert.deepEqual([...stores.keys()], ['other'])
  assert.equal(worker.unregistered.length, 1)
  assert.deepEqual(navigated, windows.map(client => client.url))
  const source = read('public/sw-kill.js')
  assert.match(source, /skipWaiting\(\)/)
  assert.doesNotMatch(source, /addEventListener\("fetch"/, 'the kill worker intercepts nothing')
  assert.match(read('docs/service-worker.md'), /OUTCLASS_SERVICE_WORKER=off/)
})
