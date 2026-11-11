// Browser-side Web Push helpers (S1-8), shared by the settings switch and sign-out.

/** The active OutClass service worker registration, or null (unsupported, not registered, or turned off). */
export async function activePushRegistration() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return null
  const registration = await navigator.serviceWorker.getRegistration("/").catch(() => undefined)
  return registration?.active ? registration : null
}

/**
 * Removes this device's subscription on the server, then in the browser. Throws when either
 * step fails, so the caller can say so. `remove` is the server action (injected to keep this
 * module free of server imports).
 */
export async function unsubscribeThisDevice(remove: (input: { endpoint: string }) => Promise<unknown>) {
  const registration = await activePushRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return false
  await remove({ endpoint: subscription.endpoint })
  if (!await subscription.unsubscribe()) throw new Error("The browser kept the push subscription.")
  return true
}

/** Sign-out: best effort, bounded, never blocks or fails the sign-out itself. */
export async function unsubscribeOnSignOut(remove: (input: { endpoint: string }) => Promise<unknown>, timeoutMs = 2000) {
  await Promise.race([unsubscribeThisDevice(remove).catch(() => false), new Promise(resolve => setTimeout(resolve, timeoutMs))])
}
