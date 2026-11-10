"use client"

import { useEffect } from "react"
import { isDemoRequested } from "@/lib/demo/activation"

/**
 * Registers public/sw.js (installable app, S1-7). The root layout renders this only in production
 * and outside Demo Mode and support sessions; the checks below repeat that on the client and also
 * skip the platform admin console. Registration waits for the page load so it never competes with
 * the first render's requests.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || isDemoRequested()) return
    if (!("serviceWorker" in navigator) || window.location.pathname.startsWith("/platform")) return
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
  }, [])
  return null
}
