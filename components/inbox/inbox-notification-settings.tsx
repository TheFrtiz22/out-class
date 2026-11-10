"use client"

import { useRef } from "react"
import dynamic from "next/dynamic"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useDemoMode } from "@/contexts/demo-context"
import { Settings } from "@/components/icons"
import { IconButton } from "@/components/ui/icon-button"
import { LoadingState } from "@/components/ui/loading-state"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { isNotificationSettingsOpen } from "@/lib/settings-navigation"

// The same preferences form Settings used: same server actions, same save behavior. Loaded only when opened.
const CommunicationsPreferences = dynamic(() => import("@/components/communications-preferences").then(module => module.CommunicationsPreferences), {
  loading: () => <LoadingState label="Loading notification settings…" layout="form" rows={3} />,
})

/**
 * Notification settings, opened from the Inbox header. URL-driven (`?tab=preferences`), so email links,
 * the old Settings URL and Back all work; the sheet traps focus, closes on Escape and returns focus to the gear.
 * Hidden in Demo Mode, which never reads or writes the signed-in account's real preferences.
 */
export function InboxNotificationSettings() {
  const params = useSearchParams(), pathname = usePathname(), router = useRouter(), demo = useDemoMode()
  const trigger = useRef<HTMLButtonElement>(null)
  const open = isNotificationSettingsOpen(params)
  function href(next: boolean) {
    const query = new URLSearchParams(params.toString())
    if (next) query.set("tab", "preferences"); else query.delete("tab")
    return `${pathname}${query.size ? `?${query}` : ""}`
  }
  function close() {
    if (document.querySelector('[data-notification-settings] [data-saving="true"]')) return
    if (document.querySelector('[data-notification-settings] [data-unsaved="true"]') && !window.confirm("Discard unsaved notification settings?")) return
    router.replace(href(false), { scroll: false })
  }
  if (demo.isDemoEnabled) return null
  return <>
    <IconButton ref={trigger} variant="outline" aria-label="Notification settings" title="Notification settings" aria-haspopup="dialog" aria-expanded={open}
      onClick={() => router.push(href(true), { scroll: false })}><Settings aria-hidden="true" /></IconButton>
    <Sheet open={open} onOpenChange={next => { if (!next) close() }}>
      <SheetContent className="oc-workspace-drawer w-full overflow-y-auto sm:max-w-lg" data-notification-settings
        onCloseAutoFocus={event => { const target = trigger.current; if (target?.isConnected) { event.preventDefault(); target.focus() } }}>
        <SheetTitle>Notification settings</SheetTitle>
        <SheetDescription className="sr-only">Choose which club updates reach your email.</SheetDescription>
        {open && <CommunicationsPreferences embedded />}
      </SheetContent>
    </Sheet>
  </>
}
