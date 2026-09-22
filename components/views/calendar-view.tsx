"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, CalendarDays, Download, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useApplicationState } from "@/lib/application-state"
import { dateKey, dateFromKey, eventStart, calendarFile } from "@/lib/calendar"
import { StudentBookingPreview } from "@/components/views/scheduler/student-booking-preview"
import { cn } from "@/lib/utils"
import type { ClubEvent } from "@/lib/data"
import type { ViewId } from "@/lib/views"

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const eventStyle = { Deadline: "bg-orange-50 text-orange-800", Interview: "bg-blue-50 text-blue-900", "Interest Meeting": "bg-neutral-100 text-neutral-700", "Coffee Chat": "bg-purple-50 text-purple-800" }

export function CalendarView({ onNavigate }: { onNavigate?: (view: ViewId) => void }) {
  const { events, trackedApps, notifications, focusApplication, focusEventId, focusEvent, focusNotification, respondToEvent, scheduleBlocks, cancelInterview, setCalendarYear } = useApplicationState()
  const [date, setDate] = useState(() => dateKey(new Date()))
  const [view, setView] = useState<"month" | "week" | "day">("month")
  const [filter, setFilter] = useState("all")
  const [query, setQuery] = useState("")
  const [hiddenClubs, setHiddenClubs] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [booking, setBooking] = useState(false)
  const [bookingDate, setBookingDate] = useState("")
  const now = new Date()
  const today = dateKey(now)
  useEffect(() => {
    if (!focusEventId) return
    const event = events.find((item) => item.id === focusEventId)
    if (event) { setDate(event.date); setSelectedId(event.id); focusEvent(null) }
  }, [events, focusEventId, focusEvent])
  const clubs = useMemo(() => [...new Set(events.map((event) => event.club))].sort(), [events])
  const visible = useMemo(() => events.filter((event) => !hiddenClubs.has(event.club) && (filter === "all" || event.type === filter) && `${event.title} ${event.club} ${event.location ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a,b) => eventStart(a).getTime() - eventStart(b).getTime()), [events, filter, query, hiddenClubs])
  const cursor = dateFromKey(date)
  useEffect(() => setCalendarYear(Number(date.slice(0, 4))), [date, setCalendarYear])
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const gridStart = new Date(first); gridStart.setDate(1 - first.getDay())
  const weekStart = new Date(cursor); weekStart.setDate(cursor.getDate() - cursor.getDay())
  const days = Array.from({ length: view === "month" ? Math.ceil((first.getDay() + new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()) / 7) * 7 : view === "week" ? 7 : 1 }, (_, index) => {
    const day = new Date(view === "month" ? gridStart : view === "week" ? weekStart : cursor); day.setDate(day.getDate() + index); return day
  })
  const selected = events.find((event) => event.id === selectedId)
  const application = trackedApps.find((app) => app.clubId === selected?.clubId)
  const linkedNotifications = notifications.filter((notification) => notification.eventId === selectedId)
  const upcoming = visible.filter((event) => eventStart(event) >= now && event.response !== "declined").slice(0, 6)
  const bookingDates = [...new Set(scheduleBlocks.filter((block) => block.date >= today).map((block) => block.date))].sort()
  const activeBookingDate = bookingDates.includes(bookingDate) ? bookingDate : bookingDates[0] ?? ""
  function step(direction: number) {
    const next = new Date(cursor)
    if (view === "month") { next.setDate(1); next.setMonth(next.getMonth() + direction) } else next.setDate(next.getDate() + direction * (view === "week" ? 7 : 1))
    setDate(dateKey(next))
  }
  function open(event: ClubEvent) { setSelectedId(event.id); setDate(event.date) }
  function exportEvent(event: ClubEvent) {
    const url = URL.createObjectURL(new Blob([calendarFile(event)], { type: "text/calendar;charset=utf-8" }))
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "outclass-event.ics"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <div className="space-y-5">
      <p className="text-xs text-neutral-500">Times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="icon" aria-label="Previous period" onClick={() => step(-1)}><ChevronLeft className="size-4" /></Button>
        <h2 className="min-w-44 text-lg font-semibold">{cursor.toLocaleDateString("en-US", view === "day" ? { month: "long", day: "numeric", year: "numeric" } : { month: "long", year: "numeric" })}</h2>
        <Button variant="outline" size="icon" aria-label="Next period" onClick={() => step(1)}><ChevronRight className="size-4" /></Button>
        <Button variant="outline" onClick={() => setDate(today)}>Today</Button>
        <div className="flex rounded-lg border p-1">{(["month", "week", "day"] as const).map((mode) => <button key={mode} type="button" aria-pressed={view === mode} onClick={() => setView(mode)} className={cn("rounded px-3 py-1 text-sm capitalize", view === mode && "bg-neutral-900 text-white")}>{mode}</button>)}</div>
        <Button className="sm:ml-auto" onClick={() => setBooking(true)}>Book / change interview</Button>
      </div>
      <div className="flex flex-wrap gap-3">
        <Input aria-label="Search calendar" placeholder="Search events, clubs, or locations" value={query} onChange={(event) => setQuery(event.target.value)} className="max-w-sm" />
        <select aria-label="Filter event type" value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-md border bg-white px-3 text-sm"><option value="all">All event types</option>{Object.keys(eventStyle).map((type) => <option key={type}>{type}</option>)}</select>
        <Input type="date" aria-label="Go to date" value={date} onChange={(event) => event.target.value && setDate(event.target.value)} className="w-auto" />
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          {view === "month" ? <div className="min-w-[650px]">
            <div className="grid grid-cols-7 border-b bg-neutral-50">{weekdays.map((day) => <div key={day} className="p-3 text-center text-xs text-neutral-500">{day}</div>)}</div>
            <div className="grid grid-cols-7">{days.map((day) => {
              const key = dateKey(day), dayEvents = visible.filter((event) => event.date === key)
              return <div key={key} className={cn("min-h-32 space-y-1 border-b border-r border-neutral-100 p-2", day.getMonth() !== cursor.getMonth() && "bg-neutral-50 text-neutral-400")}>
                <button type="button" aria-label={`Show events on ${key}`} onClick={() => { setDate(key); setView("day") }} className={cn("mb-1 flex size-7 items-center justify-center rounded-full text-xs hover:ring-1 hover:ring-neutral-300", key === today && "bg-primary text-white")}>{day.getDate()}</button>
                {dayEvents.slice(0, 3).map((event) => <button key={event.id} type="button" onClick={() => open(event)} title={`${event.time} · ${event.title}`} className={cn("block w-full rounded p-1.5 text-left text-[11px] leading-snug hover:ring-1 hover:ring-neutral-300", eventStyle[event.type], event.response === "declined" && "opacity-50")}><span className="block font-semibold">{event.time}</span><span className="line-clamp-2">{event.title}</span></button>)}
                {dayEvents.length > 3 && <button type="button" onClick={() => { setDate(key); setView("day") }} className="text-xs underline">+{dayEvents.length - 3} more</button>}
              </div>
            })}</div>
          </div> : <div className="divide-y">{days.map((day) => {
            const key = dateKey(day), dayEvents = visible.filter((event) => event.date === key)
            return <section key={key} className="p-5"><h3 className="mb-3 text-sm font-semibold">{day.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}{key === today && " · Today"}</h3>
              {dayEvents.length ? <div className="space-y-2">{dayEvents.map((event) => <button key={event.id} type="button" onClick={() => open(event)} className={cn("flex w-full flex-wrap items-center gap-3 rounded-lg p-3 text-left text-sm hover:ring-1 hover:ring-neutral-300", eventStyle[event.type])}><span className="w-24 font-medium">{event.time}</span><span className="flex-1"><strong className="block">{event.title}</strong><span className="text-xs">{event.club}{event.location && ` · ${event.location}`}</span></span><span className="text-xs">{event.response ?? event.type}</span></button>)}</div> : <p className="text-sm text-neutral-500">No events match your filters for this day.</p>}
            </section>
          })}</div>}
        </div>
        <aside className="space-y-5">
          <section className="rounded-xl border p-5"><h3 className="mb-3 font-semibold">Club calendars</h3><div className="space-y-3">{clubs.map((club) => <label key={club} className="flex items-center gap-2 text-sm"><Checkbox checked={!hiddenClubs.has(club)} onCheckedChange={() => setHiddenClubs((previous) => { const next = new Set(previous); next.has(club) ? next.delete(club) : next.add(club); return next })} />{club}</label>)}</div></section>
          <section className="rounded-xl border p-5"><h3 className="mb-3 font-semibold">Up next</h3><div className="space-y-2">{upcoming.map((event) => <button type="button" key={event.id} onClick={() => open(event)} className="w-full rounded-lg border p-3 text-left hover:bg-neutral-50"><p className="text-xs text-neutral-500">{dateFromKey(event.date).toLocaleDateString("en-US", {month:"short",day:"numeric"})} · {event.time}</p><p className="mt-1 text-sm font-medium">{event.title}</p></button>)}{!upcoming.length && <p className="text-sm text-neutral-500">No upcoming events match your filters.</p>}</div></section>
        </aside>
      </div>
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">{selected && <>
        <DialogHeader><DialogTitle>{selected.title}</DialogTitle><DialogDescription>{selected.club} · {selected.type}</DialogDescription></DialogHeader>
        <p className="flex items-center gap-2 text-sm"><CalendarDays className="size-4" />{dateFromKey(selected.date).toLocaleDateString("en-US", {weekday:"long",month:"long",day:"numeric",year:"numeric"})} · {selected.time}</p>
        <p className="flex items-center gap-2 text-sm"><MapPin className="size-4" />{selected.location ?? (selected.type === "Deadline" ? "Online application" : "Location not announced")}</p>
        {application && <p className="text-xs text-neutral-500">Application status: {application.status}</p>}
        <p className="text-sm leading-6 text-neutral-600">{selected.description ?? (selected.readOnly ? "Review your scheduled event details below." : selected.type === "Deadline" ? "Open your application to review your progress and next steps before this deadline." : "Review this club event and manage your attendance below.")}</p>
        {selected.readOnly && <p className="text-sm text-neutral-500">Contact the club if you need to change these arrangements.</p>}
        {selected.response && <p role="status" className="text-sm font-medium">{selected.response === "declined" ? "Attendance cancelled" : selected.response === "confirmed" ? "Interview confirmed" : "You're going"}</p>}
        <div className="flex flex-wrap gap-2">
          {!selected.readOnly && selected.type !== "Deadline" && !selected.bookingSlotId && eventStart(selected) >= now && <Button onClick={() => respondToEvent(selected.id, selected.type === "Interview" ? "confirmed" : "going")} disabled={selected.response === "going" || selected.response === "confirmed"}>{selected.type === "Interview" ? "Confirm interview" : "RSVP · Going"}</Button>}
          {!selected.readOnly && (selected.response === "going" || selected.response === "confirmed") && !selected.bookingSlotId && <Button variant="outline" onClick={() => respondToEvent(selected.id, "declined")}>Cancel attendance</Button>}
          {selected.bookingSlotId && <Button variant="outline" onClick={() => { cancelInterview(); setSelectedId(null) }}>Cancel booking</Button>}
          {selected.bookingSlotId && <Button onClick={() => { setSelectedId(null); setBooking(true) }}>Change interview time</Button>}
          {application && <Button variant="outline" onClick={() => { focusApplication(application.clubId); onNavigate?.("tracker") }}>View application</Button>}
          {linkedNotifications.length > 0 && <Button variant="outline" onClick={() => { focusNotification(linkedNotifications[0].id); onNavigate?.("inbox") }}>View notification</Button>}
          <Button variant="outline" onClick={() => exportEvent(selected)}><Download className="size-4" />Export event</Button>
          {selected.location && <Button variant="outline" asChild><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.location)}`} target="_blank" rel="noopener noreferrer">Open map</a></Button>}
          {selected.meetingUrl && /^https:\/\//i.test(selected.meetingUrl) && <Button variant="outline" asChild><a href={selected.meetingUrl} target="_blank" rel="noopener noreferrer">Join online</a></Button>}
        </div>
      </>}</DialogContent></Dialog>
      <Dialog open={booking} onOpenChange={setBooking}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Virginia Venture Fund interview</DialogTitle><DialogDescription>Available times from the club's interview scheduler. Booking another slot replaces your previous reservation.</DialogDescription></DialogHeader>
        {bookingDates.length ? <><select aria-label="Interview date" className="rounded border p-2" value={activeBookingDate} onChange={(event) => setBookingDate(event.target.value)}>{bookingDates.map((day) => <option key={day}>{day}</option>)}</select><StudentBookingPreview key={activeBookingDate} blocks={scheduleBlocks.filter((block) => block.date === activeBookingDate)} date={activeBookingDate} /></> : <p className="text-sm text-neutral-500">No future interview slots have been published.</p>}
      </DialogContent></Dialog>
    </div>
  )
}
