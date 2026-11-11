"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { useDemoMode } from "@/contexts/demo-context"
import { Settings } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import { LoadingState } from "@/components/ui/loading-state"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { isNotificationSettingsOpen } from "@/lib/settings-navigation"
import { closeStep } from "@/lib/notification-settings-sheet"

// The same preferences form Settings used: same server actions, same save behavior. Loaded only when opened.
const CommunicationsPreferences = dynamic(() => import("@/components/communications-preferences").then(module => module.CommunicationsPreferences), {
  loading: () => <LoadingState label="Loading notification settings…" layout="form" rows={3} />,
})
const SAVE_TOAST = "notification-settings-save"

/**
 * Notification settings, opened from the Inbox header. The gear opens the sheet with local state only (no history
 * entry, so Back behaves as if there were no sheet); a deep link (`?tab=preferences`: email, the old Settings URL,
 * Cmd-K) opens it from the URL, and closing replaces the URL once. Close, Escape and the overlay ask inline before
 * dropping unsaved edits. The sheet traps focus and returns it to the gear. Rules: lib/notification-settings-sheet.
 * Hidden in Demo Mode, which never reads or writes the signed-in account's real preferences.
 */
export function InboxNotificationSettings() {
  const params = useSearchParams(), pathname = usePathname(), router = useRouter(), demo = useDemoMode()
  const trigger = useRef<HTMLButtonElement>(null), content = useRef<HTMLDivElement>(null), keep = useRef<HTMLButtonElement>(null)
  const urlOpen = isNotificationSettingsOpen(params)
  const [open, setOpen] = useState(urlOpen), [confirming, setConfirming] = useState(false), [saving, setSaving] = useState(false)
  const openRef = useRef(open), savingRef = useRef(false), fromUrl = useRef(urlOpen), background = useRef(false)
  useEffect(() => { openRef.current = open }, [open])
  const sheetState = () => ({ fromUrl: fromUrl.current, saving: savingRef.current, dirty: !!content.current?.querySelector('[data-unsaved="true"]') })
  // Called from the form's own save, so it still reports after the sheet closed and the form unmounted.
  const onSave = useCallback((state: "saving" | "saved" | "failed") => {
    savingRef.current = state === "saving"; setSaving(state === "saving")
    if (state === "saving" || !background.current && openRef.current) return
    background.current = false
    if (state === "saved") toast.success("Notification settings saved.", { id: SAVE_TOAST })
    else toast.error("Could not save notification settings.", { id: SAVE_TOAST })
  }, [])
  // Closing is a state change first, so the sheet never waits on the router; a deep link then clears its param once.
  function close(discard = false) {
    const step = closeStep(sheetState(), discard)
    if (step === "confirm") { setConfirming(true); return }
    setOpen(false); setConfirming(false); fromUrl.current = false
    if (savingRef.current) { background.current = true; toast.loading("Saving notification settings…", { id: SAVE_TOAST }) }
    if (step === "clear-url" && isNotificationSettingsOpen(new URLSearchParams(window.location.search))) {
      const query = new URLSearchParams(window.location.search); query.delete("tab")
      router.replace(`${pathname}${query.size ? `?${query}` : ""}`, { scroll: false })
    }
  }
  function keepEditing() { setConfirming(false); content.current?.focus() }
  // A deep link opens the sheet. If the param goes away by itself (Back to a plain Inbox entry), the sheet follows.
  useEffect(() => {
    if (urlOpen) { fromUrl.current = true; setOpen(true) }
    else if (fromUrl.current) { fromUrl.current = false; setOpen(false); setConfirming(false) }
  }, [urlOpen])
  useEffect(() => { if (confirming) keep.current?.focus() }, [confirming])
  // Reload, tab close, or leaving the site: the browser's own prompt.
  useEffect(() => {
    if (!open) return
    const warn = (event: BeforeUnloadEvent) => { const state = sheetState(); if (state.dirty || state.saving) { event.preventDefault(); event.returnValue = "" } }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [open])
  if (demo.isDemoEnabled) return null
  return <>
    <IconButton ref={trigger} variant="outline" aria-label="Notification settings" title="Notification settings" aria-haspopup="dialog" aria-expanded={open}
      onClick={() => setOpen(true)}><Settings aria-hidden="true" /></IconButton>
    <Sheet open={open} onOpenChange={next => { if (next) return; if (confirming) keepEditing(); else close() }}>
      <SheetContent ref={content} className="oc-workspace-drawer w-full overflow-y-auto sm:max-w-lg" data-notification-settings
        onCloseAutoFocus={event => { const target = trigger.current; if (target?.isConnected) { event.preventDefault(); target.focus() } }}>
        <div className="flex min-h-11 items-center gap-3 pr-12">
          <SheetTitle>Notification settings</SheetTitle>
          {saving && <p role="status" className="text-xs text-muted-foreground">Saving…</p>}
        </div>
        <SheetDescription className="sr-only">Choose which club updates reach your email.</SheetDescription>
        {confirming && <div role="group" aria-labelledby="notification-settings-discard" className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2" data-discard-confirm>
          <p id="notification-settings-discard" className="mr-auto text-sm font-medium">Discard changes?</p>
          <Button ref={keep} size="sm" variant="ghost" onClick={keepEditing}>Keep editing</Button>
          <Button size="sm" variant="destructive" onClick={() => close(true)}>Discard</Button>
        </div>}
        {open && <CommunicationsPreferences embedded onSave={onSave} />}
      </SheetContent>
    </Sheet>
  </>
}
