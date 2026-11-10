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
    event.respondWith(cacheFirst(request))
    return
  }

  // Page navigations go to the network as usual and are never cached; only a network failure
  // shows the static offline page. A path with a file extension is a download (.ics, .csv, …).
  if (request.mode === "navigate" && !BYPASS_NAVIGATION.test(url.pathname) && !/\.[a-z0-9]+$/i.test(url.pathname)) {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL, { cacheName: OFFLINE_CACHE }).then(response => response || Response.error())))
  }
})

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  const cacheControl = response.headers.get("cache-control") || ""
  if (response.ok && response.type === "basic" && !/no-store|private/i.test(cacheControl)) {
    await cache.put(request, response.clone())
    trim(cache)
  }
  return response
}

async function trim(cache) {
  const keys = await cache.keys()
  await Promise.all(keys.slice(0, Math.max(0, keys.length - STATIC_LIMIT)).map(key => cache.delete(key)))
}
