/* OutClass service worker (S1-7, installable app). Kept deliberately small:
 *  - cache-first for content-hashed build assets under /_next/static/;
 *  - a static offline page for top-level page navigations that fail on the network;
 *  - everything else (pages, RSC payloads, /api, /_next/data, /_next/image, server actions, auth,
 *    QR and check-in links, downloads, other origins, non-GET) is not intercepted at all.
 * No page HTML or user data is ever written to a cache. Bump VERSION to drop every old cache. */
const VERSION = "v1"
const STATIC_CACHE = `outclass-static-${VERSION}`
const OFFLINE_CACHE = `outclass-offline-${VERSION}`
const OFFLINE_URL = "/offline.html"
const OFFLINE_ASSETS = [OFFLINE_URL, "/brand/pwa/icon-192.png"]
const STATIC_LIMIT = 300
// Navigations that must reach the network untouched, even when offline (auth redirects, QR
// check-in, downloads, admin, previews).
const BYPASS_NAVIGATION = /^\/(?:api|auth|q|check-in|platform|preview|demo|_next)(?:\/|$)/

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE)
      .then(cache => cache.addAll(OFFLINE_ASSETS.map(url => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("outclass-") && key !== STATIC_CACHE && key !== OFFLINE_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", event => {
  const request = event.request
  if (request.method !== "GET" || request.headers.has("authorization")) return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(event))
    return
  }

  // Page navigations go to the network as usual and are never cached. Only a real network failure
  // (offline, or fetch's TypeError) shows the static offline page; an aborted navigation is a
  // DOMException and passes through. A path with a file extension is a download (.ics, .csv, …).
  if (request.mode === "navigate" && !BYPASS_NAVIGATION.test(url.pathname) && !/\.[a-z0-9]+$/i.test(url.pathname)) {
    event.respondWith(fetch(request).catch(error => {
      if (self.navigator.onLine !== false && !(error instanceof TypeError)) throw error
      return caches.match(OFFLINE_URL, { cacheName: OFFLINE_CACHE }).then(response => response || Response.error())
    }))
  }
})

// The network response is always returned: a cache that fails to open, match or store never
// breaks the asset. Only full 200 responses are stored (never a 206 range response).
async function cacheFirst(event) {
  const request = event.request
  let cache = null
  try {
    cache = await caches.open(STATIC_CACHE)
    const cached = await cache.match(request)
    if (cached) return cached
  } catch { cache = null }
  const response = await fetch(request)
  const cacheControl = response.headers.get("cache-control") || ""
  if (cache && response.status === 200 && response.type === "basic" && !/no-store|private/i.test(cacheControl)) {
    const copy = response.clone()
    event.waitUntil(Promise.resolve().then(() => cache.put(request, copy)).then(() => trim(cache)).catch(() => {}))
  }
  return response
}

async function trim(cache) {
  const keys = await cache.keys()
  await Promise.all(keys.slice(0, Math.max(0, keys.length - STATIC_LIMIT)).map(key => cache.delete(key)))
}

// Web Push (S1-8). The payload is only { title, body, url } (no applicant details; see
// lib/web-push.ts). Clicking opens or focuses a same-origin URL only; anything else falls back
// to the Inbox. Caching rules above are unchanged.
const PUSH_ICON = "/brand/pwa/icon-192.png"

function samePath(value) {
  try {
    const url = new URL(typeof value === "string" ? value : "/inbox", self.location.origin)
    return url.origin === self.location.origin ? url.href : new URL("/inbox", self.location.origin).href
  } catch { return new URL("/inbox", self.location.origin).href }
}

self.addEventListener("push", event => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = {} }
  const title = typeof data.title === "string" && data.title ? data.title.slice(0, 80) : "OutClass"
  const body = typeof data.body === "string" ? data.body.slice(0, 160) : ""
  event.waitUntil(self.registration.showNotification(title, { body, icon: PUSH_ICON, data: { url: samePath(data.url) } }))
})

self.addEventListener("notificationclick", event => {
  event.notification.close()
  const target = samePath(event.notification.data && event.notification.data.url)
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(windows => {
    const open = windows.find(client => client.url === target && "focus" in client)
    return open ? open.focus() : self.clients.openWindow(target)
  }))
})
