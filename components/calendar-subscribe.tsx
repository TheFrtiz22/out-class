"use client"
import { useState } from "react"
import { CalendarPlus, Copy } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useDemoMode } from "@/contexts/demo-context"
import { createCalendarFeedLink, disableCalendarFeed, getCalendarFeedStatus } from "@/actions/calendar-feed"

type Links = Awaited<ReturnType<typeof createCalendarFeedLink>>

/** Subscribe the OutClass schedule in Google, Apple or Outlook calendar. The
 * private link is shown once; making a new one turns the old one off. */
export function CalendarSubscribe() {
  const demo = useDemoMode()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<boolean | null>(null)
  const [links, setLinks] = useState<Links | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  if (demo.isDemoEnabled) return null
  async function run(work: () => Promise<void>) {
    setBusy(true); setMessage("")
    try { await work() } catch { setMessage("Couldn’t update your calendar link. Try again.") } finally { setBusy(false) }
  }
  return <Dialog open={open} onOpenChange={next => { setOpen(next); if (next) { setLinks(null); setMessage(""); void getCalendarFeedStatus().then(s => setActive(s.active)).catch(() => setActive(null)) } }}>
    <DialogTrigger asChild><Button variant="outline"><CalendarPlus aria-hidden="true" className="size-4" />Subscribe</Button></DialogTrigger>
    <DialogContent className="max-w-md space-y-4">
      <DialogTitle>Add OutClass to your calendar</DialogTitle>
      <DialogDescription>Your meetings, interviews and RSVPs show up in Google, Apple or Outlook calendar and stay up to date.</DialogDescription>
      {links ? <div className="space-y-3">
        <Button asChild className="w-full"><a href={links.google} target="_blank" rel="noreferrer">Add to Google Calendar</a></Button>
        <Button asChild variant="outline" className="w-full"><a href={links.webcal}>Open in Apple or Outlook calendar</a></Button>
        <div className="flex gap-2"><Input readOnly aria-label="Private calendar link" value={links.https} onFocus={e => e.currentTarget.select()} />
          <Button variant="outline" size="icon" aria-label="Copy link" onClick={() => void navigator.clipboard?.writeText(links.https).then(() => setMessage("Link copied.")).catch(() => setMessage("Select the link and copy it."))}><Copy aria-hidden="true" className="size-4" /></Button></div>
        <p className="text-xs text-muted-foreground">Keep this link private: anyone with it can see your OutClass schedule. This is the only time it’s shown.</p>
      </div> : <div className="space-y-3">
        {active && <p className="text-sm text-muted-foreground">Your calendar is subscribed. A new link replaces the current one, which then stops updating.</p>}
        <Button className="w-full" disabled={busy} onClick={() => void run(async () => { setLinks(await createCalendarFeedLink()); setActive(true) })}>{active ? "Create a new link" : "Create my calendar link"}</Button>
        {active && <Button variant="ghost" className="w-full" disabled={busy} onClick={() => void run(async () => { await disableCalendarFeed(); setActive(false); setMessage("Calendar link turned off.") })}>Turn off calendar link</Button>}
      </div>}
      {message && <p role="status" className="text-sm">{message}</p>}
    </DialogContent>
  </Dialog>
}
