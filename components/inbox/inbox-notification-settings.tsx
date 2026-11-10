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
import { closeStep, urlClosedStep } from "@/lib/notification-settings-sheet"

// The same preferences form Settings used: same server actions, same save behavior. Loaded only when opened.
const CommunicationsPreferences = dynamic(() => import("@/components/communications-preferences").then(module => module.CommunicationsPreferences), {
  loading: () => <LoadingState label="Loading notification settings…" layout="form" rows={3} />,
})
const SAVE_TOAST = "notification-settings-save"

/**
 * Notification settings, opened from the Inbox header. URL-driven (`?tab=preferences`), so email links, the old
 * Settings URL and Back all work; the sheet traps focus, closes on Escape and returns focus to the gear.
 * Visibility is local state that follows the URL, so browser Back with unsaved edits can put the sheet back
 * (the form never unmounts) and ask, instead of dropping the edits. History rules: lib/notification-settings-sheet.
 * Hidden in Demo Mode, which never reads or writes the signed-in account's real preferences.
 */
export function InboxNotificationSettings() {
  const params = useSearchParams(), pathname = usePathname(), router = useRouter(), demo = useDemoMode()
  const trigger = useRef<HTMLButtonElement>(null), content = useRef<HTMLDivElement>(null), keep = useRef<HTMLButtonElement>(null)
  const urlOpen = isNotificationSettingsOpen(params)
  const [open, setOpen] = useState(urlOpen), [confirming, setConfirming] = useState(false), [saving, setSaving] = useState(false)
  const openRef = useRef(open), savingRef = useRef(false), openedInApp = useRef(false), closing = useRef(false), background = useRef(false)
  useEffect(() => { openRef.current = open }, [open])
  const href = (next: boolean) => {
    const query = new URLSearchParams(params.toString())
    if (next) query.set("tab", "preferences"); else query.delete("tab")
    return `${pathname}${query.size ? `?${query}` : ""}`
  }
  const sheetState = () => ({ openedInApp: openedInApp.current, saving: savingRef.current, dirty: !!content.current?.querySelector('[data-unsaved="true"]') })
  // Called from the form's own save, so it still reports after the sheet closed and the form unmounted.
  const onSave = useCallback((state: "saving" | "saved" | "failed") => {
    savingRef.current = state === "saving"; setSaving(state === "saving")
    if (state === "saving" || !background.current && openRef.current) return
    background.current = false
    if (state === "saved") toast.success("Notification settings saved.", { id: SAVE_TOAST })
    else toast.error("Could not save notification settings.", { id: SAVE_TOAST })
  }, [])
  function finishClose() {
    setOpen(false); setConfirming(false)
    if (savingRef.current) { background.current = true; toast.loading("Saving notification settings…", { id: SAVE_TOAST }) }
  }
  function requestClose(discard = false) {
    const step = closeStep(sheetState(), discard)
    if (step === "confirm") { setConfirming(true); return }
    closing.current = true
    if (step === "back") { openedInApp.current = false; router.back() } else router.replace(href(false), { scroll: false })
  }
  function keepEditing() { setConfirming(false); content.current?.focus() }
  useEffect(() => {
    if (urlOpen) { setOpen(true); return }
    if (!openRef.current) { closing.current = false; return }
    if (closing.current) { closing.current = false; finishClose(); return }
    // Browser Back/Forward took the param away. Unsaved edits: put it back and ask; otherwise close.
    if (urlClosedStep(sheetState()) === "restore") { openedInApp.current = true; router.push(href(true), { scroll: false }); setConfirming(true); return }
    openedInApp.current = false; finishClose()
    // Only URL changes drive this; the helpers read refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlOpen])
  useEffect(() => { if (confirming) keep.current?.focus() }, [confirming])
  // Reload, tab close, or Back out of the site from a deep link: the browser's own prompt.
  useEffect(() => {
    if (!open) return
    const warn = (event: BeforeUnloadEvent) => { const state = sheetState(); if (state.dirty || state.saving) { event.preventDefault(); event.returnValue = "" } }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [open])
  if (demo.isDemoEnabled) return null
  return <>
    <IconButton ref={trigger} variant="outline" aria-label="Notification settings" title="Notification settings" aria-haspopup="dialog" aria-expanded={open}
      onClick={() => { openedInApp.current = true; router.push(href(true), { scroll: false }) }}><Settings aria-hidden="true" /></IconButton>
    <Sheet open={open} onOpenChange={next => { if (next) return; if (confirming) keepEditing(); else requestClose() }}>
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
          <Button size="sm" variant="destructive" onClick={() => requestClose(true)}>Discard</Button>
        </div>}
        {open && <CommunicationsPreferences embedded onSave={onSave} />}
      </SheetContent>
    </Sheet>
  </>
}
