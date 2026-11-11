"use client"

import { useEffect, useId, useState } from "react"
import { getPushSettings, removePushSubscription, savePushSubscription } from "@/actions/push-subscriptions"
import { Switch } from "@/components/ui/switch"

type State = "loading" | "hidden" | "unsupported" | "blocked" | "off" | "on"

function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
}

function applicationServerKey(base64url: string) {
  const padded = (base64url + "=".repeat((4 - base64url.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/")
  return Uint8Array.from(atob(padded), char => char.charCodeAt(0))
}

/**
 * Web Push opt-in for this device (S1-8), in the Inbox notification settings sheet. Browser permission is
 * requested only from the switch's click, never on load. Hidden when the server has no VAPID keys; the sheet
 * itself is hidden in Demo Mode, and the server actions refuse Demo and support sessions.
 */
export function PushNotificationsToggle() {
  const [state, setState] = useState<State>("loading"), [busy, setBusy] = useState(false), [error, setError] = useState("")
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const id = useId()
  useEffect(() => {
    let active = true
    getPushSettings().then(async settings => {
      if (!active) return
      if (!settings.enabled) { setState("hidden"); return }
      setPublicKey(settings.publicKey)
      if (!pushSupported()) { setState("unsupported"); return }
      if (Notification.permission === "denied") { setState("blocked"); return }
      const registration = await navigator.serviceWorker.getRegistration("/")
      const subscription = await registration?.pushManager.getSubscription()
      if (active) setState(subscription && Notification.permission === "granted" ? "on" : "off")
    }).catch(() => { if (active) setState("hidden") })
    return () => { active = false }
  }, [])

  async function turnOn() {
    // Asked here, inside the click, and nowhere else.
    const permission = await Notification.requestPermission()
    if (permission !== "granted") { setState(permission === "denied" ? "blocked" : "off"); return }
    const registration = await navigator.serviceWorker.getRegistration("/")
    if (!registration || !publicKey) throw new Error("unavailable")
    const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(publicKey) })
    try { await savePushSubscription(subscription.toJSON()) }
    catch (cause) { await subscription.unsubscribe().catch(() => {}); throw cause }
    setState("on")
  }

  async function turnOff() {
    const registration = await navigator.serviceWorker.getRegistration("/")
    const subscription = await registration?.pushManager.getSubscription()
    if (subscription) {
      await removePushSubscription({ endpoint: subscription.endpoint })
      await subscription.unsubscribe().catch(() => {})
    }
    setState("off")
  }

  async function toggle(next: boolean) {
    setBusy(true); setError("")
    try { await (next ? turnOn() : turnOff()) }
    catch { setError(next ? "Could not turn on push notifications." : "Could not turn off push notifications.") }
    finally { setBusy(false) }
  }

  if (state === "loading" || state === "hidden") return null
  return <section className="space-y-2" aria-label="Push notifications" data-push-notifications={state}>
    {state === "unsupported"
      ? <p className="text-sm text-muted-foreground">Push notifications need the installed app. On iPhone, add OutClass to your Home Screen first (iOS 16.4 or later).</p>
      : <div className="flex min-h-11 items-center gap-3 rounded-md border px-4 py-3 text-sm">
        <label htmlFor={id} className="mr-auto">Push notifications on this device</label>
        <Switch id={id} checked={state === "on"} disabled={busy || state === "blocked"} onCheckedChange={value => void toggle(value)} />
      </div>}
    {state !== "unsupported" && <p className="text-xs text-muted-foreground">Sent for the updates you get by instant email.</p>}
    {state === "blocked" && <p className="text-sm text-muted-foreground">Notifications are blocked for OutClass in this browser&apos;s settings.</p>}
    {error && <p role="alert" className="text-sm">{error}</p>}
  </section>
}
