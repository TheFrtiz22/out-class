"use client"

import { useEffect, useRef, useState } from "react"
import { CalendarClock } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { OUTLOOK_BUSY_MESSAGE, busyCellsForWeek, parseBusy, removeBusy } from "@/lib/outlook-busy"
import { SCHEDULING_TIMEZONE } from "@/lib/scheduling-config"

const errors: Record<string, string> = {
  consent: "Your university needs to approve OutClass for Outlook access before calendars can be checked.",
  declined: "Outlook access wasn’t granted. Nothing changed.",
  expired: "The Outlook check expired. Try again.",
  unavailable: "Outlook couldn’t be checked right now. Nothing changed.",
}

/**
 * Week view only: reads this week's Outlook busy times once and offers to mark
 * them unavailable. Nothing changes until the person confirms, and the change
 * goes through the editor's normal save queue and revision checks.
 */
export function OutlookBusyImport({ week, days, disabled, onApply }: {
  week: string; days: boolean[][]; disabled?: boolean; onApply: (next: boolean[][], changedDays: number[]) => void
}) {
  const [checking, setChecking] = useState(false), [status, setStatus] = useState("")
  const [busy, setBusy] = useState<boolean[][] | null>(null)
  const request = useRef<{ nonce: string; week: string; popup: Window | null } | null>(null)

  // A result belongs to the week it was requested for.
  useEffect(() => { setBusy(null); setStatus(""); setChecking(false); request.current = null }, [week])

  useEffect(() => {
    function receive(event: MessageEvent) {
      const pending = request.current, data = event.data
      if (!pending || event.origin !== window.location.origin || event.source !== pending.popup) return
      if (!data || data.type !== OUTLOOK_BUSY_MESSAGE || data.nonce !== pending.nonce || data.week !== pending.week) return
      request.current = null; setChecking(false)
      if (typeof data.error === "string") { setStatus(errors[data.error] ?? errors.unavailable); return }
      const intervals = parseBusy(data.busy)
      if (!intervals) { setStatus(errors.unavailable); return }
      setBusy(busyCellsForWeek(pending.week, SCHEDULING_TIMEZONE, intervals))
    }
    window.addEventListener("message", receive)
    return () => window.removeEventListener("message", receive)
  }, [])

  useEffect(() => {
    if (!checking) return
    // Closing the popup without finishing ends the check quietly.
    const timer = window.setInterval(() => { if (request.current?.popup?.closed) { request.current = null; setChecking(false) } }, 800)
    return () => window.clearInterval(timer)
  }, [checking])

  function start() {
    const bytes = crypto.getRandomValues(new Uint8Array(18))
    const nonce = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
    const popup = window.open(`/api/calendar/outlook/start?${new URLSearchParams({ week, nonce })}`, "outclass-outlook", "popup,width=520,height=680")
    if (!popup) { setStatus("Allow pop-ups for OutClass to check Outlook."); return }
    request.current = { nonce, week, popup }
    setBusy(null); setStatus(""); setChecking(true)
  }

  const preview = busy ? removeBusy(days, busy) : null
  return <div className="space-y-2">
    <Button variant="outline" disabled={disabled || checking} loading={checking} onClick={start}><CalendarClock className="size-4" />Check Outlook</Button>
    {preview && <div className="flex flex-wrap items-center gap-2 text-sm" role="status">
      {preview.removed === 0
        ? <><span>Outlook shows no conflicts with your availability this week.</span><Button variant="ghost" size="sm" className="min-h-11" onClick={() => setBusy(null)}>Done</Button></>
        : <><span>Outlook shows you busy during {preview.removed === 1 ? "1 available quarter hour" : `${preview.removed} available quarter hours`} this week.</span>
          <Button size="sm" className="min-h-11" disabled={disabled} onClick={() => { onApply(preview.next, preview.changedDays); setBusy(null); setStatus("Outlook busy times marked unavailable.") }}>Mark unavailable</Button>
          <Button variant="ghost" size="sm" className="min-h-11" onClick={() => setBusy(null)}>Keep as is</Button></>}
    </div>}
    {status && <p role="status" className="text-sm text-muted-foreground">{status}</p>}
  </div>
}
