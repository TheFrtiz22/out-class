"use client"
import { useEffect, useState } from "react"
import { useDemoMode } from "@/contexts/demo-context"
import { demoStore } from "@/lib/demo/store"
import { Bell, Check } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
export function SubscribeButton({
  clubId,
  disabled = false,
}: {
  clubId: string
  disabled?: boolean
}) {
  const demo = useDemoMode()
  const { user, loading } = useAuth()
  const key = `outclass.club-subscriptions.${user?.id || "preview"}`
  const [subscribed, setSubscribed] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)
  useEffect(() => {
    const read = () => {
      if (demo.isDemoEnabled) { setSubscribed(demo.state?.subscriptions.includes(clubId) || false); setReady(true); return }
      try {
        const ids = JSON.parse(localStorage.getItem(key) || "[]")
        setSubscribed(Array.isArray(ids) && ids.includes(clubId))
      } catch {
        setSubscribed(false)
      }
      setReady(true)
    }
    read()
    window.addEventListener("outclass-subscriptions", read)
    window.addEventListener("storage", read)
    return () => {
      window.removeEventListener("outclass-subscriptions", read)
      window.removeEventListener("storage", read)
    }
  }, [key, clubId, demo.state, demo.isDemoEnabled])
  function toggle() {
    if (demoStore.active()) { demoStore.mutate(s => { s.subscriptions = subscribed ? s.subscriptions.filter(id => id !== clubId) : [...s.subscriptions, clubId] }); return }
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "[]")
      const ids = new Set<string>(Array.isArray(saved) ? saved : [])
      subscribed ? ids.delete(clubId) : ids.add(clubId)
      localStorage.setItem(key, JSON.stringify([...ids]))
      setSubscribed(!subscribed)
      setError(false)
      window.dispatchEvent(new Event("outclass-subscriptions"))
    } catch {
      setError(true)
    }
  }
  return (
    <div className="oc-club-subscribe">
      <Button
        variant="outline"
        aria-pressed={subscribed}
        disabled={disabled || loading || !ready}
        onClick={toggle}
      >
        {subscribed ? <Check size={15} /> : <Bell size={15} />}{" "}
        {subscribed ? "Subscribed" : "Subscribe"}
      </Button>
      <small role={error ? "status" : undefined}>
        {error
          ? "Couldn’t save. Check your browser storage settings."
          : "Saved on this device · email updates not yet available"}
      </small>
    </div>
  )
}
