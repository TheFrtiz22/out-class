"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { useApplicationState } from "@/lib/application-state"
import type { ClubEvent, EventType } from "@/lib/data"
import type { ViewId } from "@/lib/views"

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const WEEKDAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const MONTH_LABEL = "September 2026"
// September 2026 starts on a Tuesday (index 2), 30 days.
const START_OFFSET = 2
const DAYS_IN_MONTH = 30
const TODAY = 16

// Time axis for Day/Week views: 6 AM to midnight, 48px per hour.
const TIME_START = 6
const TIME_END = 24
const HOUR_HEIGHT = 48
const AXIS_HEIGHT = (TIME_END - TIME_START) * HOUR_HEIGHT

type FilterId = "all" | "deadline" | "info" | "interview"
type ViewMode = "day" | "week" | "month"

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All Events" },
  { id: "deadline", label: "App Deadlines" },
  { id: "info", label: "Info Sessions" },
  { id: "interview", label: "My Interviews" },
]

function matchesFilter(type: EventType, filter: FilterId) {
  if (filter === "all") return true
  if (filter === "deadline") return type === "Deadline"
  if (filter === "interview") return type === "Interview"
  return type === "Interest Meeting" || type === "Coffee Chat"
}

const CHIP_STYLE: Record<EventType, string> = {
  Deadline: "bg-primary text-white",
  "Interest Meeting": "bg-slate-200 text-foreground",
  "Coffee Chat": "bg-slate-200 text-foreground",
  Interview: "bg-foreground text-white",
}

const BLOCK_STYLE: Record<EventType, string> = {
  Deadline: "bg-primary text-white",
  "Interest Meeting": "bg-gray-100 text-foreground",
  "Coffee Chat": "bg-gray-100 text-foreground",
  Interview: "bg-foreground text-white",
}

function weekdayIndex(day: number) {
  return (day - 1 + START_OFFSET) % 7
}

function weekStartOf(day: number) {
  return day - weekdayIndex(day)
}

function parseTimeToHour(time: string) {
  const match = time.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!match) return TIME_START
  let hour = Number.parseInt(match[1], 10)
  const minute = Number.parseInt(match[2], 10)
  const period = match[3].toUpperCase()
  if (period === "PM" && hour !== 12) hour += 12
  if (period === "AM" && hour === 12) hour = 0
  return hour + minute / 60
}

function clampDay(day: number) {
  return Math.min(DAYS_IN_MONTH, Math.max(1, day))
}

export function CalendarView({ onNavigate }: { onNavigate?: (view: ViewId) => void }) {
  const { events } = useApplicationState()
  const [filter, setFilter] = useState<FilterId>("all")
  const [calendarView, setCalendarView] = useState<ViewMode>("month")
  const [selectedDay, setSelectedDay] = useState(TODAY)

  const clubList = useMemo(() => {
    const seen = new Map<string, string>()
    for (const e of events) {
      if (!seen.has(e.club)) seen.set(e.club, e.color)
    }
    return Array.from(seen, ([name, color]) => ({ name, color }))
  }, [events])

  const [subscribed, setSubscribed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(clubList.map((c) => [c.name, true])),
  )

  const visibleEvents = events.filter((e) => matchesFilter(e.type, filter) && subscribed[e.club] !== false)

  const eventsByDay = visibleEvents.reduce<Record<number, ClubEvent[]>>((acc, e) => {
    ;(acc[e.day] ??= []).push(e)
    return acc
  }, {})

  const cells: (number | null)[] = [
    ...Array.from({ length: START_OFFSET }, () => null),
    ...Array.from({ length: DAYS_IN_MONTH }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const weekStart = weekStartOf(selectedDay)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = weekStart + i
    return day >= 1 && day <= DAYS_IN_MONTH ? day : null
  })

  const headerLabel = useMemo(() => {
    if (calendarView === "month") return MONTH_LABEL
    if (calendarView === "week") {
      const start = Math.max(weekStart, 1)
      const end = Math.min(weekStart + 6, DAYS_IN_MONTH)
      return `Sep ${start} – ${end}, 2026`
    }
    return `${WEEKDAYS_FULL[weekdayIndex(selectedDay)]}, Sep ${selectedDay}`
  }, [calendarView, selectedDay, weekStart])

  const approachingNext = [...visibleEvents].sort((a, b) => a.day - b.day).slice(0, 5)

  function handleStep(direction: -1 | 1) {
    const amount = calendarView === "day" ? 1 : calendarView === "week" ? 7 : DAYS_IN_MONTH
    setSelectedDay((d) => clampDay(d + direction * amount))
  }

  return (
    <div className="-m-4 grid gap-6 bg-slate-50 p-4 sm:-m-6 sm:p-6 lg:grid-cols-[70%_minmax(0,1fr)]">
      {/* Left panel: master calendar, 70% width */}
      <Card className="border-gray-200 bg-white shadow-none">
        <CardHeader className="gap-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg text-foreground">My Calendar</CardTitle>
              <Button
                variant="outline"
                size="icon"
                className="size-8 border-gray-200"
                aria-label="Previous"
                onClick={() => handleStep(-1)}
              >
                <ChevronLeft className="size-4 text-foreground" />
              </Button>
              <span className="w-44 text-center text-sm font-medium text-foreground">{headerLabel}</span>
              <Button
                variant="outline"
                size="icon"
                className="size-8 border-gray-200"
                aria-label="Next"
                onClick={() => handleStep(1)}
              >
                <ChevronRight className="size-4 text-foreground" />
              </Button>
            </div>
            <ToggleGroup
              type="single"
              value={calendarView}
              onValueChange={(value) => value && setCalendarView(value as ViewMode)}
              className="gap-0 rounded-lg border border-gray-200 bg-slate-50 p-0.5"
            >
              <ToggleGroupItem
                value="day"
                className="h-7 rounded-md px-3 text-xs text-foreground data-[state=on]:bg-foreground data-[state=on]:text-white"
              >
                Day
              </ToggleGroupItem>
              <ToggleGroupItem
                value="week"
                className="h-7 rounded-md px-3 text-xs text-foreground data-[state=on]:bg-foreground data-[state=on]:text-white"
              >
                Week
              </ToggleGroupItem>
              <ToggleGroupItem
                value="month"
                className="h-7 rounded-md px-3 text-xs text-foreground data-[state=on]:bg-foreground data-[state=on]:text-white"
              >
                Month
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="flex items-center gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === f.id
                    ? "border-foreground bg-primary text-white"
                    : "border-gray-200 bg-white text-foreground hover:bg-slate-50",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {calendarView === "month" && (
            <>
              <div className="grid grid-cols-7 pb-2 text-center text-xs font-medium text-slate-500">
                {WEEKDAYS.map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200">
                {cells.map((day, i) => {
                  const dayEvents = day ? eventsByDay[day] ?? [] : []
                  const isToday = day === TODAY
                  return (
                    <div key={i} className={cn("flex min-h-24 flex-col gap-1 bg-white p-1.5", !day && "bg-slate-50")}>
                      {day && (
                        <>
                          <span
                            className={cn(
                              "inline-flex size-6 items-center justify-center rounded-full text-xs font-medium",
                              isToday ? "bg-primary text-white" : "text-foreground",
                            )}
                          >
                            {day}
                          </span>
                          <div className="flex flex-col gap-1">
                            {dayEvents.map((e) => (
                              <span
                                key={e.id}
                                className={cn(
                                  "truncate rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight",
                                  CHIP_STYLE[e.type],
                                )}
                                title={`${e.time} — ${e.title}`}
                              >
                                {e.time.replace(" ", "")} · {e.title}
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {calendarView === "week" && (
            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-gray-200 pb-2 text-center text-xs font-medium text-slate-500">
                  <div />
                  {weekDays.map((day, i) => (
                    <div key={i} className={cn(day === TODAY && "font-semibold text-muted-foreground")}>
                      <div>{WEEKDAYS[i]}</div>
                      {day && <div className="text-[11px] text-slate-400">{day}</div>}
                    </div>
                  ))}
                </div>
                <div className="relative grid grid-cols-[56px_repeat(7,1fr)]" style={{ height: AXIS_HEIGHT }}>
                  {/* Time axis */}
                  <div className="relative border-r border-gray-100">
                    {Array.from({ length: TIME_END - TIME_START }, (_, i) => TIME_START + i).map((hour) => (
                      <div
                        key={hour}
                        className="absolute right-2 -translate-y-1/2 text-[10px] text-slate-400"
                        style={{ top: (hour - TIME_START) * HOUR_HEIGHT }}
                      >
                        {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
                      </div>
                    ))}
                  </div>
                  {/* Day columns */}
                  {weekDays.map((day, colIndex) => (
                    <div key={colIndex} className="relative border-l border-gray-100">
                      {Array.from({ length: TIME_END - TIME_START }, (_, i) => i).map((i) => (
                        <div
                          key={i}
                          className="absolute w-full border-t border-gray-100"
                          style={{ top: i * HOUR_HEIGHT }}
                        />
                      ))}
                      {day &&
                        (eventsByDay[day] ?? []).map((e) => {
                          const hour = parseTimeToHour(e.time)
                          return (
                            <div
                              key={e.id}
                              className={cn(
                                "absolute inset-x-0.5 overflow-hidden rounded px-1.5 py-1 text-[10px] font-medium leading-tight shadow-none",
                                BLOCK_STYLE[e.type],
                              )}
                              style={{ top: (hour - TIME_START) * HOUR_HEIGHT, height: 44 }}
                              title={`${e.time} — ${e.title}`}
                            >
                              <div className="truncate">{e.title}</div>
                              <div className="truncate opacity-80">{e.time}</div>
                            </div>
                          )
                        })}
                      {day === TODAY && (
                        <div className="pointer-events-none absolute inset-0 bg-orange-50/40" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {calendarView === "day" && (
            <div className="overflow-x-auto">
              <div className="min-w-[420px]">
                <div className="grid grid-cols-[56px_1fr] relative" style={{ height: AXIS_HEIGHT }}>
                  <div className="relative border-r border-gray-100">
                    {Array.from({ length: TIME_END - TIME_START }, (_, i) => TIME_START + i).map((hour) => (
                      <div
                        key={hour}
                        className="absolute right-2 -translate-y-1/2 text-[10px] text-slate-400"
                        style={{ top: (hour - TIME_START) * HOUR_HEIGHT }}
                      >
                        {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
                      </div>
                    ))}
                  </div>
                  <div className="relative">
                    {Array.from({ length: TIME_END - TIME_START }, (_, i) => i).map((i) => (
                      <div key={i} className="absolute w-full border-t border-gray-100" style={{ top: i * HOUR_HEIGHT }} />
                    ))}
                    {(eventsByDay[selectedDay] ?? []).length === 0 && (
                      <p className="pt-6 text-center text-sm text-slate-400">No events on this day.</p>
                    )}
                    {(eventsByDay[selectedDay] ?? []).map((e) => {
                      const hour = parseTimeToHour(e.time)
                      return (
                        <div
                          key={e.id}
                          className={cn(
                            "absolute inset-x-2 overflow-hidden rounded-md px-3 py-2 text-xs font-medium leading-tight shadow-none",
                            BLOCK_STYLE[e.type],
                          )}
                          style={{ top: (hour - TIME_START) * HOUR_HEIGHT, height: 52 }}
                          title={`${e.time} — ${e.title}`}
                        >
                          <div className="truncate">{e.title}</div>
                          <div className="truncate opacity-80">
                            {e.club} · {e.time}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right panel: subscriptions + urgent deadlines, 30% width */}
      <div className="flex min-w-0 flex-col gap-4">
        <Card className="border-gray-200 bg-white shadow-none">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Subscribed Clubs</CardTitle>
            <p className="text-sm text-slate-500">Toggle a club to show or hide its events.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {clubList.map((club) => (
              <div key={club.name} className="flex items-center gap-2.5">
                <Checkbox
                  id={`club-${club.name}`}
                  checked={subscribed[club.name] !== false}
                  onCheckedChange={(checked) => setSubscribed((prev) => ({ ...prev, [club.name]: checked === true }))}
                  className="border-gray-300 data-[state=checked]:border-foreground data-[state=checked]:bg-primary"
                />
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: club.color }} />
                <Label htmlFor={`club-${club.name}`} className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {club.name}
                </Label>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="flex-1 border-gray-200 bg-white shadow-none">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Approaching Next</CardTitle>
            <p className="text-sm text-slate-500">Your next events, in order.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {approachingNext.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">No upcoming events match your filters.</p>
            )}
            {approachingNext.map((e) => {
              const daysAway = e.day - TODAY
              const isDueSoon = e.type === "Deadline" && daysAway >= 0 && daysAway <= 2
              const isDeadlineOrInterview = e.type === "Deadline" || e.type === "Interview"
              return (
                <div
                  key={e.id}
                  className={cn(
                    "flex gap-3 rounded-lg border p-3",
                    isDueSoon ? "border-foreground bg-orange-50" : "border-gray-200 bg-white",
                  )}
                >
                  <div className="flex flex-col items-center justify-center rounded-md border border-gray-200 bg-slate-50 px-2.5 py-1 text-center">
                    <span className="text-[10px] font-medium uppercase text-slate-500">Sep</span>
                    <span className="text-base font-semibold leading-none text-foreground">{e.day}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-medium text-foreground">{e.title}</p>
                      {isDueSoon && (
                        <span className="shrink-0 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          Due Soon
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-slate-500">
                      {e.club} · {e.time}
                    </p>
                    <Button
                      size="sm"
                      variant={isDeadlineOrInterview ? "default" : "outline"}
                      className={cn(
                        "mt-2 h-7 text-xs",
                        isDeadlineOrInterview
                          ? "bg-primary text-white hover:bg-primary/90"
                          : "border-gray-200 text-foreground",
                      )}
                      onClick={() => isDeadlineOrInterview && onNavigate?.("tracker")}
                    >
                      {isDeadlineOrInterview ? "View Application" : "RSVP"}
                    </Button>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
