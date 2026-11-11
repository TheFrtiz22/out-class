/* OutClass service worker kill switch (docs/service-worker.md). Not registered by anything.
 * To retire the worker from every browser, copy this file over public/sw.js and deploy (and set
 * OUTCLASS_SERVICE_WORKER=off). Browsers re-check /sw.js on navigation (Cache-Control: no-cache),
 * install this version, delete the OutClass caches, unregister, and reload open tabs. */
self.addEventListener("install", () => self.skipWaiting())

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => key.startsWith("outclass-")).map(key => caches.delete(key)))
    await self.registration.unregister()
    const windows = await self.clients.matchAll({ type: "window" })
    await Promise.all(windows.map(client => client.navigate(client.url).catch(() => {})))
  })())
})
