"use client"

import { useEffect, useId, useState } from "react"
import { getPushSettings, removePushSubscription, savePushSubscription } from "@/actions/push-subscriptions"
import { Switch } from "@/components/ui/switch"
import { activePushRegistration, subscriptionMatchesKey, unsubscribeThisDevice, vapidKeyBytes } from "@/lib/push-device"

type State = "loading" | "hidden" | "unsupported" | "blocked" | "off" | "on"
const BLOCKED = "Notifications are blocked in your browser settings."

function pushApiAvailable() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
}

/**
 * Web Push opt-in for this device (S1-8), in the Inbox notification settings sheet. Browser permission is
 * requested only from the switch's click, never on load. On/off comes from the server row for this browser's
 * endpoint. Hidden when the server has no VAPID keys or no service worker is active (OUTCLASS_SERVICE_WORKER=off,
 * development); the sheet itself is hidden in Demo Mode, and the server actions refuse Demo and support sessions.
 */
export function PushNotificationsToggle() {
  const [state, setState] = useState<State>("loading"), [busy, setBusy] = useState(false), [message, setMessage] = useState("")
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const id = useId()
  useEffect(() => {
    let active = true
    ;(async () => {
      if (!pushApiAvailable()) {
        const settings = await getPushSettings()
        if (active) setState(settings.enabled ? "unsupported" : "hidden")
        return
      }
      const registration = await activePushRegistration()
      const subscription = await registration?.pushManager.getSubscription()
      const settings = await getPushSettings(subscription?.endpoint)
      if (!active) return
      if (!settings.enabled || !registration) { setState("hidden"); return }
      setPublicKey(settings.publicKey)
      if (Notification.permission === "denied") { setState("blocked"); return }
      // A subscription bound to a rotated-out VAPID key cannot receive pushes: show it as off.
      const current = !!subscription && subscriptionMatchesKey(subscription, settings.publicKey)
      setState(current && settings.subscribed && Notification.permission === "granted" ? "on" : "off")
    })().catch(() => { if (active) setState("hidden") })
    return () => { active = false }
  }, [])

  async function turnOn() {
    // Asked here, inside the click, and nowhere else.
    const permission = await Notification.requestPermission()
    if (permission !== "granted") { setState(permission === "denied" ? "blocked" : "off"); setMessage(BLOCKED); return }
    const registration = await activePushRegistration()
    if (!registration || !publicKey) throw new Error("unavailable")
    let existing = await registration.pushManager.getSubscription()
    if (existing && !subscriptionMatchesKey(existing, publicKey)) {
      // Made with an old VAPID key (rotation): drop it here and on the server, then subscribe anew.
      await removePushSubscription({ endpoint: existing.endpoint }).catch(() => {})
      if (!await existing.unsubscribe()) throw new Error("stale subscription")
      existing = null
    }
    const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyBytes(publicKey) })
    try { await savePushSubscription(subscription.toJSON()) }
    catch (cause) { await subscription.unsubscribe().catch(() => {}); throw cause }
    setState("on")
  }

  async function toggle(next: boolean) {
    setBusy(true); setMessage("")
    try { if (next) await turnOn(); else { await unsubscribeThisDevice(removePushSubscription); setState("off") } }
    catch { setMessage(next ? "Could not turn on push notifications." : "Could not turn off push notifications on this device.") }
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
    {(message || state === "blocked") && <p role={message && message !== BLOCKED ? "alert" : "status"} className="text-sm">{message || BLOCKED}</p>}
  </section>
}
