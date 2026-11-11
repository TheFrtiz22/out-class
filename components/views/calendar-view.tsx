"use client"
import { SCHEDULING_TIMEZONE, SCHEDULING_TIMEZONE_LABEL, minuteLabel } from "@/lib/scheduling-config"
import { AvailabilityButton } from "@/components/availability/availability-button"
import { CalendarSubscribe } from "@/components/calendar-subscribe"
import { localParts } from "@/lib/availability"
import Link from "next/link";

import { SegmentedControl } from "@/components/product/segmented-control"
import { useEffect, useMemo, useState } from "react"
import { useServerAnchoredNow } from "@/hooks/use-server-now"
import { ChevronLeft, ChevronRight, CalendarDays, Download, MapPin } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { SearchField } from "@/components/ui/search-field"
import { PillSelect } from "@/components/ui/pill-select"
import { PillGroup } from "@/components/ui/segmented-control"
import { Toggle } from "@/components/ui/toggle"
import { DateField } from "@/components/ui/date-picker"
import { FilterButton } from "@/components/ui/filter-popover"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useApplicationState } from "@/lib/application-state"
import { dateKey, dateFromKey, eventStart, calendarFile, timeMinutes, eventOccursOn } from "@/lib/calendar"
import { StudentBookingPreview } from "@/components/views/scheduler/student-booking-preview"
import { agendaGroups } from "@/lib/student-agenda"
import { cn } from "@/lib/utils"
import type { ClubEvent } from "@/lib/data"
import type { ViewId } from "@/lib/views"

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const eventStyle = {
  Other: "bg-secondary/60 text-foreground",
  Deadline: "bg-secondary text-foreground",
  Interview: "bg-secondary text-foreground",
  "Interest Meeting": "bg-secondary/60 text-foreground",
  "Coffee Chat": "bg-secondary/60 text-foreground",
}

const MEETINGS_FILTER = "club-meetings"
function readSearchParam(key: string) { return typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(key) }

export function CalendarView({ onNavigate, serverNow }: { onNavigate?: (view: ViewId) => void; serverNow?: number }) {
  const {
    events,
    trackedApps,
    notifications,
    focusApplication,
    focusEventId,
    focusEvent,
    focusNotification,
    respondToEvent,
    scheduleBlocks,
    cancelInterview,
    setCalendarYear,
  } = useApplicationState()
  const [date, setDate] = useState(() => localParts(new Date(), SCHEDULING_TIMEZONE).date)
  const [view, setView] = useState<"agenda" | "month" | "week" | "day">("agenda")
  const [includePast, setIncludePast] = useState(false)
  const [includeDeclined, setIncludeDeclined] = useState(false)
  // `?type=meeting` (old /clubs/meetings) opens Calendar filtered to club meetings.
  const [filter, setFilter] = useState("all")
  const [phoneFilters, setPhoneFilters] = useState(false)
  useEffect(() => { if (readSearchParam("type") === "meeting") setFilter(MEETINGS_FILTER) }, [])
  const [query, setQuery] = useState("")
  const phoneActive = Number(!!query) + Number(filter !== "all") + Number(includePast) + Number(includeDeclined)
  const [hiddenClubs, setHiddenClubs] = useState<Set<string>>(new Set())
  const clearCalendarFilters = () => { setQuery(""); setFilter("all"); setHiddenClubs(new Set()) }
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [booking, setBooking] = useState(false)
  const [bookingDate, setBookingDate] = useState("")
  const nowMs = useServerAnchoredNow(serverNow)
  const now = useMemo(() => new Date(nowMs), [nowMs])
  const today = localParts(now, SCHEDULING_TIMEZONE).date
  useEffect(() => {
    if (!focusEventId) return
    const event = events.find((item) => item.id === focusEventId)
    if (event) {
      setDate(event.date)
      setSelectedId(event.id)
      focusEvent(null)
    }
  }, [events, focusEventId, focusEvent])
  const clubs = useMemo(() => [...new Set(events.map((event) => event.club))].sort(), [events])
  const visible = useMemo(
    () =>
      events
        .filter(
          (event) =>
            !hiddenClubs.has(event.club) &&
            (filter === "all" || (filter === MEETINGS_FILTER ? event.id.startsWith("meeting-") : event.type === filter)) &&
            `${event.title} ${event.club} ${event.location ?? ""}`
              .toLowerCase()
              .includes(query.trim().toLowerCase()),
        )
        .sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime()),
    [events, filter, query, hiddenClubs],
  )
  const cursor = dateFromKey(date)
  useEffect(() => setCalendarYear(Number(date.slice(0, 4))), [date, setCalendarYear])
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const gridStart = new Date(first)
  gridStart.setDate(1 - first.getDay())
  const weekStart = new Date(cursor)
  weekStart.setDate(cursor.getDate() - cursor.getDay())
  const days = Array.from(
    {
      length:
        view === "month"
          ? Math.ceil(
              (first.getDay() +
                new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()) /
                7,
            ) * 7
          : view === "week"
            ? 7
            : 1,
    },
    (_, index) => {
      const day = new Date(view === "month" ? gridStart : view === "week" ? weekStart : cursor)
      day.setDate(day.getDate() + index)
      return day
    },
  )
  const selected = events.find((event) => event.id === selectedId)
  const application = trackedApps.find((app) => app.clubId === selected?.clubId)
  const linkedNotifications = notifications.filter(
    (notification) => notification.eventId === selectedId,
  )
  const upcoming = visible
    .filter((event) => (event.endTime ? new Date(event.endTime) : eventStart(event)) >= now && event.response !== "declined")
    .slice(0, 6)
  const agenda = agendaGroups(
    visible.filter((event) => includeDeclined || event.response !== "declined"),
    now,
    includePast,
  )
  const bookingDates = [
    ...new Set(scheduleBlocks.filter((block) => block.date >= today).map((block) => block.date)),
  ].sort()
  const activeBookingDate = bookingDates.includes(bookingDate)
    ? bookingDate
    : (bookingDates[0] ?? "")
  function step(direction: number) {
    const next = new Date(cursor)
    if (view === "month") {
      next.setDate(1)
      next.setMonth(next.getMonth() + direction)
    } else next.setDate(next.getDate() + direction * (view === "week" ? 7 : 1))
    setDate(dateKey(next))
  }
  function open(event: ClubEvent) {
    setSelectedId(event.id)
    setDate(event.date)
  }
  function exportEvent(event: ClubEvent) {
    const url = URL.createObjectURL(
      new Blob([calendarFile(event)], { type: "text/calendar;charset=utf-8" }),
    )
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "outclass-event.ics"
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <div className="oc-calendar-workspace oc-workspace-stack">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-sm text-muted-foreground">
            Meetings, interviews, and recruiting dates, together.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Times shown in {SCHEDULING_TIMEZONE_LABEL}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3"><AvailabilityButton label="Availability" variant="outline" /><CalendarSubscribe />{bookingDates.length > 0 && (
          <Button variant="outline" onClick={() => setBooking(true)}>
            Book / change interview
          </Button>
        )}</div>
      </header>
      {/* With nothing scheduled, show the agenda empty state only; views and filters appear once there are events. */}
      {events.length > 0 && <SegmentedControl label="Calendar view" value={view} onChange={setView} options={(["agenda", "month", "week", "day"] as const).map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }))} />}
      {events.length > 0 && view !== "agenda" && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous period"
            onClick={() => step(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <h2 className="oc-section-heading ">
            {cursor.toLocaleDateString(
              "en-US",
              view === "day"
                ? { month: "long", day: "numeric", year: "numeric" }
                : { month: "long", year: "numeric" },
            )}
          </h2>
          <Button variant="outline" size="icon" aria-label="Next period" onClick={() => step(1)}>
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="ghost" onClick={() => setDate(today)}>
            Today
          </Button>
          <DateField label="Go to date" value={date} onChange={(value) => { if (value) setDate(value) }} placeholder="Choose a date" clearLabel="Today" />
        </div>
      )}
      {/* Phones, as in the app: search and filters sit behind a Filter button. */}
      {events.length > 0 && <FilterButton size="sm" label="Filter" count={phoneActive} className="oc-calendar-filter-toggle" aria-expanded={phoneFilters} aria-controls="calendar-tools" onClick={() => setPhoneFilters(open => !open)} />}
      {events.length > 0 && <div id="calendar-tools" className="oc-toolbar oc-calendar-tools" data-phone-open={phoneFilters || undefined}>
        <SearchField
          aria-label="Search calendar"
          placeholder="Search events, clubs, or locations"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onClear={() => setQuery("")}
          containerClassName="min-w-0 flex-1 basis-60 max-w-sm"
        />
        <PillSelect
          label="Filter event type"
          value={filter}
          active={filter !== "all"}
          onChange={setFilter}
          options={[{ value: "all", label: "All event types" }, { value: MEETINGS_FILTER, label: "Club meetings" }, ...Object.keys(eventStyle).map((type) => ({ value: type, label: type }))]}
        />
        {view === "agenda" && (
          <>
            <Toggle label="Include past events" checked={includePast} onCheckedChange={setIncludePast} />
            <Toggle label="Include declined" checked={includeDeclined} onCheckedChange={setIncludeDeclined} />
          </>
        )}
      </div>}
      <div className="grid min-w-0 items-start gap-[var(--oc-content-gap)] xl:grid-cols-[minmax(0,1fr)_17rem]">
        <div
          className={
            view === "agenda"
              ? "oc-content-panel"
              : "oc-data-surface"
          }
        >
          {view === "agenda" ? (
            <div className="space-y-8">
              {agenda.map((group) => (
                <section key={group.label} aria-label={group.label}>
                  <h3 className="oc-card-heading border-b border-border pb-3">
                    {group.label}
                  </h3>
                  <ul className="divide-y divide-border">
                    {group.events.map((event) => (
                      <li key={event.id}>
                        <button
                          type="button"
                          onClick={() => open(event)}
                          className="flex w-full items-start gap-4 rounded-sm py-5 text-left transition-colors hover:bg-secondary/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:gap-7"
                        >
                          <div className="w-16 shrink-0 text-sm">
                            <p className="font-medium tabular-nums">
                              {event.allDay ? "All day" : eventStart(event).toLocaleTimeString("en-US", {
                                timeZone: SCHEDULING_TIMEZONE, hour12: true,
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {dateFromKey(event.date).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="mb-1 text-xs font-medium text-muted-foreground">
                              {event.type}
                              {event.response === "declined" && " · Declined"}
                              {event.response === "confirmed" && " · Confirmed"}
                            </p>
                            <h4 className="break-words text-sm font-semibold leading-6">
                              {event.title}
                            </h4>
                            <p className="mt-1 text-xs leading-6 text-muted-foreground">
                              {event.club}
                              {event.location && ` · ${event.location}`}
                            </p>
                          </div>
                          <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {!agenda.length && (
                <div className="space-y-3 border-y border-border py-12">
                  <CalendarDays className="size-6 text-muted-foreground" />
                  <h3 className="oc-card-heading ">
                    {query || filter !== "all" || hiddenClubs.size
                      ? "No events match these filters"
                      : "A little breathing room"}
                  </h3>
                  <p className="max-w-md text-sm leading-7 text-muted-foreground">
                    {query || filter !== "all" || hiddenClubs.size
                      ? "Your search, type filter or hidden club calendars leave nothing to show."
                      : "You have no interviews or RSVP’d events coming up."}
                  </p>
                  <CalendarEmptyAction filtered={!!(query || filter !== "all" || hiddenClubs.size)} onClear={clearCalendarFilters} onNavigate={onNavigate} />
                </div>
              )}
            </div>
          ) : (
            <>
              {view === "month" ? (
                <div className="min-w-[650px]">
                  <div className="grid grid-cols-7 border-b bg-muted">
                    {weekdays.map((day) => (
                      <div key={day} className="p-3 text-center text-xs text-muted-foreground">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {days.map((day) => {
                      const key = dateKey(day),
                        dayEvents = visible.filter((event) => eventOccursOn(event, key))
                      return (
                        <div
                          key={key}
                          className={cn(
                            "min-h-32 space-y-1 border-b border-r border-border p-2",
                            day.getMonth() !== cursor.getMonth() &&
                              "bg-muted text-muted-foreground",
                          )}
                        >
                          <button
                            type="button"
                            aria-label={`Show events on ${key}`}
                            onClick={() => {
                              setDate(key)
                              setView("day")
                            }}
                            className={cn(
                              "mb-1 flex size-7 items-center justify-center rounded-full text-xs hover:ring-1 hover:ring-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                              key === today && "bg-primary text-white",
                            )}
                          >
                            {day.getDate()}
                          </button>
                          {dayEvents.slice(0, 3).map((event) => (
                            <button
                              key={event.id}
                              type="button"
                              onClick={() => open(event)}
                              title={`${(event.allDay ? "All day" : minuteLabel(timeMinutes(event.time)))} · ${event.title}`}
                              className={cn(
                                "block w-full rounded p-1.5 text-left text-control leading-snug hover:ring-1 hover:ring-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                                eventStyle[event.type],
                                event.response === "declined" && "opacity-50",
                              )}
                            >
                              <span className="block font-semibold">{(event.allDay ? "All day" : minuteLabel(timeMinutes(event.time)))}</span>
                              <span className="line-clamp-2">{event.title}</span>
                            </button>
                          ))}
                          {dayEvents.length > 3 && (
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              onClick={() => {
                                setDate(key)
                                setView("day")
                              }}
                              className="h-auto px-0 py-0.5 text-xs"
                            >
                              +{dayEvents.length - 3} more
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="divide-y">
                  {days.map((day) => {
                    const key = dateKey(day),
                      dayEvents = visible.filter((event) => eventOccursOn(event, key))
                    return (
                      <section key={key} className="p-5">
                        <h3 className="oc-card-heading mb-3">
                          {day.toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "short",
                            day: "numeric",
                          })}
                          {key === today && " · Today"}
                        </h3>
                        {dayEvents.length ? (
                          <div className="space-y-2">
                            {dayEvents.map((event) => (
                              <button
                                key={event.id}
                                type="button"
                                onClick={() => open(event)}
                                className={cn(
                                  "flex w-full flex-wrap items-center gap-3 rounded-lg p-3 text-left text-sm hover:ring-1 hover:ring-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                                  eventStyle[event.type],
                                )}
                              >
                                <span className="w-24 font-medium">{(event.allDay ? "All day" : minuteLabel(timeMinutes(event.time)))}</span>
                                <span className="flex-1">
                                  <strong className="block">{event.title}</strong>
                                  <span className="text-xs">
                                    {event.club}
                                    {event.location && ` · ${event.location}`}
                                  </span>
                                </span>
                                <span className="text-xs">{event.response ?? event.type}</span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-2 text-sm text-muted-foreground">
                            <p>{query || filter !== "all" || hiddenClubs.size ? "No events on this day match your filters." : "Nothing is scheduled on this day."}</p>
                            <CalendarEmptyAction filtered={!!(query || filter !== "all" || hiddenClubs.size)} onClear={clearCalendarFilters} onNavigate={onNavigate} />
                          </div>
                        )}
                      </section>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
        <aside className="space-y-5">
          <section className="border-t border-border py-5">
            <h3 className="oc-card-heading mb-3">Your club calendars</h3>
            {!clubs.length && (
              <p className="text-xs leading-6 text-muted-foreground">
                Clubs appear here when they have events on your calendar.
              </p>
            )}
            <div className="space-y-3">
              {clubs.map((club) => (
                <label key={club} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={!hiddenClubs.has(club)}
                    onCheckedChange={() =>
                      setHiddenClubs((previous) => {
                        const next = new Set(previous)
                        next.has(club) ? next.delete(club) : next.add(club)
                        return next
                      })
                    }
                  />
                  {club}
                </label>
              ))}
            </div>
          </section>
          {view !== "agenda" && (
            <section className="border-t border-border py-5">
              <h3 className="oc-card-heading mb-3">Up next</h3>
              <div className="space-y-2">
                {upcoming.map((event) => (
                  <button
                    type="button"
                    key={event.id}
                    onClick={() => open(event)}
                    className="w-full rounded-[var(--oc-content-radius-small)] border border-border oc-glass-surface p-3 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <p className="text-xs text-muted-foreground">
                      {dateFromKey(event.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      · {(event.allDay ? "All day" : minuteLabel(timeMinutes(event.time)))}
                    </p>
                    <p className="mt-1 text-sm font-medium">{event.title}</p>
                  </button>
                ))}
                {!upcoming.length && (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>{query || filter !== "all" || hiddenClubs.size ? "No upcoming events match your filters." : "Nothing upcoming on your calendar."}</p>
                    <CalendarEmptyAction filtered={!!(query || filter !== "all" || hiddenClubs.size)} onClear={clearCalendarFilters} onNavigate={onNavigate} />
                  </div>
                )}
              </div>
            </section>
          )}
        </aside>
      </div>
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.title}</DialogTitle>
                {selected.id.startsWith("meeting-") && <a className="text-sm underline" href={`/meetings/${selected.id.slice(8)}`}>Agenda, resources, and recap</a>}
                <DialogDescription>
                  {selected.club} · {selected.type}
                </DialogDescription>
              </DialogHeader>
              <p className="flex items-center gap-2 text-sm">
                <CalendarDays className="size-4" />
                {dateFromKey(selected.date).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}{" "}
                · {(selected.allDay ? "All day" : minuteLabel(timeMinutes(selected.time)))}
              </p>
              <p className="flex items-center gap-2 text-sm">
                <MapPin className="size-4" />
                {selected.location ??
                  (selected.type === "Deadline" ? "Online application" : "Location not announced")}
              </p>
              {application && (
                <p className="text-xs text-muted-foreground">Application status: {application.status}</p>
              )}
              <p className="text-sm leading-6 text-muted-foreground">
                {selected.description ??
                  (selected.readOnly
                    ? "Review your scheduled event details below."
                    : selected.type === "Deadline"
                      ? "Open your application to review your progress and next steps before this deadline."
                      : "Review this club event and manage your attendance below.")}
              </p>
              {selected.readOnly && (
                <p className="text-sm text-muted-foreground">
                  Contact the club if you need to change these arrangements.
                </p>
              )}
              {selected.response && (
                <p role="status" className="text-sm font-medium">
                  {selected.response === "declined"
                    ? "Attendance cancelled"
                    : selected.response === "confirmed"
                      ? "Interview confirmed"
                      : "You're going"}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {!selected.readOnly &&
                  selected.type !== "Deadline" &&
                  !selected.bookingSlotId &&
                  eventStart(selected) >= now && (
                    <Button
                      onClick={() =>
                        respondToEvent(
                          selected.id,
                          selected.type === "Interview" ? "confirmed" : "going",
                        )
                      }
                      disabled={selected.response === "going" || selected.response === "confirmed"}
                    >
                      {selected.type === "Interview" ? "Confirm interview" : "RSVP · Going"}
                    </Button>
                  )}
                {!selected.readOnly &&
                  (selected.response === "going" || selected.response === "confirmed") &&
                  !selected.bookingSlotId && (
                    <Button
                      variant="outline"
                      onClick={() => respondToEvent(selected.id, "declined")}
                    >
                      Cancel attendance
                    </Button>
                  )}
                {!selected.readOnly && selected.bookingSlotId && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      cancelInterview()
                      setSelectedId(null)
                    }}
                  >
                    Cancel booking
                  </Button>
                )}
                {!selected.readOnly && selected.bookingSlotId && (
                  <Button
                    onClick={() => {
                      setSelectedId(null)
                      setBooking(true)
                    }}
                  >
                    Change interview time
                  </Button>
                )}
                {application && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      focusApplication(application.clubId)
                      onNavigate?.("tracker")
                    }}
                  >
                    View application
                  </Button>
                )}
                {linkedNotifications.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      focusNotification(linkedNotifications[0].id)
                      onNavigate?.("inbox")
                    }}
                  >
                    View notification
                  </Button>
                )}
                <Button variant="outline" onClick={() => exportEvent(selected)}>
                  <Download className="size-4" />
                  Export event
                </Button>
                {selected.location && (
                  <Button variant="outline" asChild>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open map
                    </a>
                  </Button>
                )}
                {selected.meetingUrl && /^https:\/\//i.test(selected.meetingUrl) && (
                  <Button variant="outline" asChild>
                    <a href={selected.meetingUrl} target="_blank" rel="noopener noreferrer">
                      Join online
                    </a>
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={booking} onOpenChange={setBooking}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Virginia Venture Fund interview</DialogTitle>
            <DialogDescription>
              Available times from the club&#39;s interview scheduler. Booking another slot replaces
              your previous reservation.
            </DialogDescription>
          </DialogHeader>
          {bookingDates.length ? (
            <>
              <PillGroup label="Interview date" size="compact" value={activeBookingDate} onChange={setBookingDate}
                options={bookingDates.map((day) => ({ value: day, label: day }))} />
              <StudentBookingPreview
                key={activeBookingDate}
                blocks={scheduleBlocks.filter((block) => block.date === activeBookingDate)}
                date={activeBookingDate}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No future interview slots have been published.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** One next step for an empty calendar: clear what hides events, or go find some. */
function CalendarEmptyAction({ filtered, onClear, onNavigate }: { filtered: boolean; onClear: () => void; onNavigate?: (view: ViewId) => void }) {
  return filtered
    ? <Button variant="outline" size="sm" onClick={onClear}>Clear filters</Button>
    : onNavigate ? <Button variant="outline" size="sm" onClick={() => onNavigate("corkboard")}>Browse events</Button> : null
}
