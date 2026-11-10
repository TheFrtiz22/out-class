"use client"

import { useEffect } from "react"
import { isDemoRequested } from "@/lib/demo/activation"

/**
 * Registers public/sw.js (installable app, S1-7; runbook in docs/service-worker.md). The root layout
 * renders this only in production and outside Demo Mode and support sessions; the checks below
 * repeat that on the client and also skip the platform admin console. Registration waits for the
 * page load so it never competes with the first render's requests.
 *
 * `disabled` is the kill switch (OUTCLASS_SERVICE_WORKER=off): it unregisters any worker this
 * origin installed and deletes the OutClass caches.
 */
export function ServiceWorkerRegistration({ disabled = false }: { disabled?: boolean }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    if (disabled) {
      void removeServiceWorker()
      return
    }
    if (process.env.NODE_ENV !== "production" || isDemoRequested() || window.location.pathname.startsWith("/platform")) return
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
        // Installability is progressive: the site works the same without a worker.
      })
    }
    if (document.readyState === "complete") register()
    else {
      window.addEventListener("load", register, { once: true })
      return () => window.removeEventListener("load", register)
    }
  }, [disabled])
  return null
}

async function removeServiceWorker() {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map(registration => registration.unregister()))
    if (typeof caches !== "undefined") {
      const keys = await caches.keys()
      await Promise.all(keys.filter(key => key.startsWith("outclass-")).map(key => caches.delete(key)))
    }
  } catch {
    // Best effort; the next page load tries again while the switch is on.
  }
}
