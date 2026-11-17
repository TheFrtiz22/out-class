"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { DateField } from "@/components/ui/date-picker"
import { LoadingState } from "@/components/ui/loading-state"
import { Panel } from "@/components/ui/panel"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { useDemoMode } from "@/contexts/demo-context"
import { addDays, monday, today, WEEK_DAYS } from "@/lib/availability"
import { getMeetingTimePlanner, getMeetingTimeRoster } from "@/lib/availability-workspace-read"
import { bestMeetingTimes, DEFAULT_MEETING_DURATION, durationLabel, MEETING_DURATIONS, plannerWeekRange, type MeetingPlannerHeatmap, type MeetingSlotRoster } from "@/lib/meeting-time-planner"
import { minuteLabel, SCHEDULING_TIMEZONE, SCHEDULING_TIMEZONE_LABEL } from "@/lib/scheduling-config"
import { userMessage } from "@/lib/user-message"
import { WeeklyCalendar } from "./weekly-calendar"

type Slot = { day: number; slot: number }
const timeRange = (slot: number, minutes: number) => `${minuteLabel(slot * 15)}–${minuteLabel(slot * 15 + minutes)}`

/**
 * "Find a meeting time" for leaders who can create the club's meetings: a heatmap of how many active
 * members are free for the whole meeting at each start time, and, for a chosen time, who is free or
 * busy (names only). Reads go through server authorization (meetings.manage, this club, not suspended).
 */
export function MeetingTimePlanner({ clubId }: { clubId: string }) {
  const demo = useDemoMode()
  // This week through MEETING_PLANNER_WEEKS_AHEAD weeks ahead; the server refuses any other week.
  const range = useMemo(() => plannerWeekRange(), [])
  const [week, setWeek] = useState(() => monday(today(SCHEDULING_TIMEZONE))), [duration, setDuration] = useState<number>(DEFAULT_MEETING_DURATION)
  const [data, setData] = useState<MeetingPlannerHeatmap | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(""), [attempt, setAttempt] = useState(0)
  const [selected, setSelected] = useState<Slot | null>(null), [roster, setRoster] = useState<MeetingSlotRoster | null>(null), [rosterError, setRosterError] = useState(""), [rosterLoading, setRosterLoading] = useState(false)
  useEffect(() => {
    if (!demo.ready || demo.isDemoEnabled) return
    let active = true
    setLoading(true); setError("")
    getMeetingTimePlanner({ clubId, week, duration }).then(value => { if (active) setData(value) }).catch(e => { if (active) setError(userMessage(e, "Could not load member availability.")) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [clubId, week, duration, attempt, demo.ready, demo.isDemoEnabled])
  useEffect(() => {
    setRoster(null); setRosterError("")
    if (!selected || demo.isDemoEnabled) return
    let active = true
    setRosterLoading(true)
    getMeetingTimeRoster({ clubId, week, duration, ...selected }).then(value => { if (active) setRoster(value) }).catch(e => { if (active) setRosterError(userMessage(e, "Could not load who is free.")) }).finally(() => { if (active) setRosterLoading(false) })
    return () => { active = false }
  }, [clubId, week, duration, selected, demo.isDemoEnabled])
  // Until the read for the chosen week and length returns, the previous grid stays visible but dimmed and inert.
  const current = data && data.week === week && data.duration === duration ? data : null
  const best = useMemo(() => current ? bestMeetingTimes(current.free, current.duration) : [], [current])
  const rosterPanel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Where the roster sits below the grid (phones and tablets), bring it into view when a time is chosen.
    if (!selected || window.matchMedia("(min-width: 1280px)").matches) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    rosterPanel.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" })
  }, [selected])
  const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week])
  if (demo.isDemoEnabled) return <p className="text-sm text-muted-foreground">Meeting-time planning is available in your signed-in workspace.</p>
  const changeWeek = (next: string) => { const start = monday(next); setWeek(start < range.first ? range.first : start > range.last ? range.last : start); setSelected(null) }
  return <section className="oc-availability space-y-4" aria-label="Find a meeting time" aria-busy={loading}>
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex items-end gap-2">
        <Button variant="outline" aria-label="Previous week" disabled={week <= range.first} onClick={() => changeWeek(addDays(week, -7))}><ChevronLeft className="size-4" aria-hidden="true" /></Button>
        <div className="text-sm"><span className="block">Week of</span><DateField label="Week of" className="mt-1" value={week} onChange={value => { if (value) changeWeek(value) }} /></div>
        <Button variant="outline" aria-label="Next week" disabled={week >= range.last} onClick={() => changeWeek(addDays(week, 7))}><ChevronRight className="size-4" aria-hidden="true" /></Button>
      </div>
      <SegmentedControl label="Meeting length" size="compact" value={String(duration)} onChange={value => { setDuration(Number(value)); setSelected(null) }} options={MEETING_DURATIONS.map(minutes => ({ value: String(minutes), label: durationLabel(minutes) }))} />
      <p className="text-xs text-muted-foreground">{SCHEDULING_TIMEZONE_LABEL} · 8:00 AM–9:00 PM</p>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error} <Button variant="outline" size="sm" disabled={loading} onClick={() => setAttempt(v => v + 1)}>Try again</Button></p>}
    {loading && <LoadingState label={data ? "Updating availability…" : "Loading member availability…"} layout={data ? "inline" : "calendar"} calendarView="week" />}
    {data && !error && <div className="space-y-4">
      {current && <p role="status" className="text-sm">{current.withAvailability} of {current.members} active member{current.members === 1 ? "" : "s"} have saved their availability.</p>}
      {current && best.length > 0 && <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">Best times</span>{best.map(time => <Button key={`${time.day}:${time.slot}`} size="sm" variant={selected?.day === time.day && selected.slot === time.slot ? "default" : "outline"} className="min-h-11" onClick={() => setSelected({ day: time.day, slot: time.slot })}>{WEEK_DAYS[time.day].slice(0, 3)} {minuteLabel(time.slot * 15)} · {time.count} free</Button>)}</div>}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
        <div className={current ? undefined : "pointer-events-none opacity-50"} inert={!current} aria-hidden={!current || undefined}><WeeklyCalendar readOnly days={data.free.map(day => day.map(n => n > 0))} counts={data.free} countMax={Math.max(1, data.members)} countLabel={`members free for ${durationLabel(duration)}`} gridLabel="Members free to meet, by start time" dates={dates} selected={selected} onSelect={(day, slot) => setSelected({ day, slot })} />
          <p className="mt-2 text-xs text-muted-foreground">Each time shows how many members are free for the whole {durationLabel(duration)} meeting starting then. Choose a time to see who is free.</p></div>
        <div ref={rosterPanel} className="scroll-mt-4"><Panel as="aside" variant="glass" className="space-y-3" aria-live="polite">
          {!selected ? <p className="text-sm text-muted-foreground">Choose a start time to see who can make it.</p> : <>
            <h3 className="oc-card-heading">{WEEK_DAYS[selected.day]} · {timeRange(selected.slot, duration)}</h3>
            <p className="text-xs text-muted-foreground">{dates[selected.day]} · {SCHEDULING_TIMEZONE_LABEL}</p>
            {rosterLoading && <LoadingState label="Loading who is free…" layout="inline" />}
            {rosterError && <p role="alert" className="text-sm text-destructive">{rosterError}</p>}
            {roster && <div className="space-y-3 text-sm">
              <RosterGroup title="Free" names={roster.free} empty="No one has said they’re free then." />
              <RosterGroup title="Busy" names={roster.busy} />
              <RosterGroup title="No availability saved" names={roster.unknown} />
            </div>}
          </>}
        </Panel></div>
      </div>
    </div>}
  </section>
}

function RosterGroup({ title, names, empty }: { title: string; names: string[]; empty?: string }) {
  if (!names.length && !empty) return null
  return <div><h4 className="font-medium">{title} · {names.length}</h4>{names.length ? <ul className="mt-1 max-h-48 space-y-1 overflow-auto">{names.map((name, i) => <li key={`${name}:${i}`}>{name}</li>)}</ul> : <p className="mt-1 text-xs text-muted-foreground">{empty}</p>}</div>
}
