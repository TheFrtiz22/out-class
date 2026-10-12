"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { CalendarDays, Check, ChevronLeft, ChevronRight, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import { getMyRoundAvailability, saveMyAvailability, saveMyRoundAvailability } from "@/actions/availability"
import { addDays, cellsToRanges, dayKnown, dayRanges, monday, rangesToCells, timezoneSchema, today, WEEK_DAYS, type AvailabilityDocument, type AvailabilityRound, type AvailabilitySchedule } from "@/lib/availability"
import { AvailabilitySaveQueue } from "@/lib/availability-save-queue"
import { WeeklyCalendar } from "./weekly-calendar"

export function TimezonePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const listId = useId()
  const [draft, setDraft] = useState(value), [error, setError] = useState("")
  const [zones, setZones] = useState<string[]>([])
  useEffect(() => { setZones(Intl.supportedValuesOf("timeZone")) }, [])
  useEffect(() => { setDraft(value) }, [value])
  return <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); const result = timezoneSchema.safeParse(draft.trim()); if (!result.success) { setError("Choose a valid IANA time zone, for example America/New_York."); return } setError(""); onChange(result.data) }}>
    <label className="text-xs font-medium">Time zone<Input className="mt-1 min-h-11 w-60 max-w-full" aria-label="Time zone" list={listId} value={draft} onChange={e => setDraft(e.target.value)} /></label>
    <datalist id={listId}><option value="UTC" />{zones.map(zone => <option key={zone} value={zone} />)}</datalist>
    <Button variant="outline" className="min-h-11">Apply time zone</Button>{error && <p role="alert" className="w-full text-xs text-destructive">{error}</p>}
  </form>
}

export function AvailabilityEditor({ initial, scope, initialConfirmed = false, title = "Your weekly rhythm" }: {
  initial: AvailabilityDocument; scope?: { clubId: string; roundId: string }; initialConfirmed?: boolean; title?: string
}) {
  const [, render] = useState(0), [confirmed, setConfirmed] = useState(initialConfirmed), [confirming, setConfirming] = useState(false), [notice, setNotice] = useState("")
  const [mode, setMode] = useState<"recurring" | "week">(scope ? "week" : "recurring")
  const [week, setWeek] = useState(() => monday(today(initial.schedule.timezone))), [copyFrom, setCopyFrom] = useState(0), [copyTo, setCopyTo] = useState(1)
  const queueRef = useRef<AvailabilitySaveQueue | null>(null)
  if (!queueRef.current) queueRef.current = new AvailabilitySaveQueue(initial, async payload => {
    return scope ? (await saveMyRoundAvailability({ ...payload, ...scope, confirm: false })).document : saveMyAvailability(payload)
  }, () => render(value => value + 1))
  const queue = queueRef.current, schedule = queue.document.schedule
  useEffect(() => {
    queue.activate()
    const unload = (event: BeforeUnloadEvent) => { if (queue.dirty || queue.saving) { event.preventDefault(); event.returnValue = "" } }
    window.addEventListener("beforeunload", unload)
    return () => { window.removeEventListener("beforeunload", unload); queue.dispose() }
  }, [queue])
  const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week])
  const days = useMemo(() => dates.map((date, i) => rangesToCells(mode === "recurring" ? schedule.weekly[i] : dayRanges(schedule, date))), [dates, mode, schedule])
  function change(value: AvailabilitySchedule) { if (confirming) return; setConfirmed(false); setNotice(""); queue.change(value) }
  function editDays(next: boolean[][], changedDays: number[]) {
    const current = queue.document.schedule
    if (mode === "recurring") change({ ...current, weeklySubmitted: true, weekly: current.weekly.map((ranges, i) => changedDays.includes(i) ? cellsToRanges(next[i]) : ranges) })
    else change({ ...current, exceptions: { ...current.exceptions, ...Object.fromEntries(changedDays.map(i => [dates[i], cellsToRanges(next[i])])) } })
  }
  function clear(indices: number[]) { editDays(days.map((cells, i) => indices.includes(i) ? cells.map(() => false) : cells), indices) }
  function copyDay() {
    if (!(mode === "recurring" ? schedule.weeklySubmitted : dayKnown(schedule, dates[copyFrom]))) { setNotice("The source day has no submitted availability."); return }
    editDays(days.map((cells, i) => i === copyTo ? [...days[copyFrom]] : cells), [copyTo])
  }
  function copyPrevious() {
    const exceptions = { ...schedule.exceptions }
    for (const date of dates) {
      const previous = addDays(date, -7)
      if (dayKnown(schedule, previous)) exceptions[date] = dayRanges(schedule, previous).map(range => [...range] as [number, number])
      else delete exceptions[date]
    }
    change({ ...schedule, exceptions })
  }
  return <section className="oc-availability space-y-5 rounded-2xl border bg-card p-4 sm:p-6" data-unsaved={queue.dirty} data-saving={queue.saving || queue.state === "saving" || confirming} aria-busy={confirming}>
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="oc-section-heading">{title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{scope ? "Your global schedule is prefilled. Adjust specific dates here and confirm your participation for this club and round." : "Enter your usual free time once. Your schedule follows local clock time, including daylight saving changes."}</p></div><p role="status" aria-live="polite" className={`text-xs font-medium ${queue.state === "error" ? "text-destructive" : "text-muted-foreground"}`}>{queue.state === "saving" ? "Saving…" : queue.state === "unsaved" ? "Unsaved changes" : queue.state === "error" ? "Save failed · edits retained" : queue.document.revision === 0 ? "No schedule saved" : "All changes saved"}</p></header>
    <fieldset disabled={confirming} className="space-y-5">
      <TimezonePicker value={schedule.timezone} onChange={timezone => change({ ...schedule, timezone })} />
      <p className="text-xs text-muted-foreground">Changing the time zone keeps your chosen local hours and dates. Recheck them when travelling. Repeated daylight saving hours share the same availability; skipped hours have no real time.</p>
      {!scope && <div className="flex flex-wrap gap-2" aria-label="Availability editing mode"><Button variant={mode === "recurring" ? "default" : "outline"} aria-pressed={mode === "recurring"} onClick={() => setMode("recurring")}><CalendarDays className="size-4" />Recurring week</Button><Button variant={mode === "week" ? "default" : "outline"} aria-pressed={mode === "week"} onClick={() => setMode("week")}>Specific dates</Button></div>}
      {mode === "week" && <div className="flex flex-wrap items-center gap-2"><Button variant="outline" aria-label="Previous week" onClick={() => setWeek(addDays(week, -7))}><ChevronLeft className="size-4" /></Button><label className="text-sm">Week of<Input type="date" min="1900-01-01" max="2200-12-31" aria-label="Week of" value={week} onChange={e => { if (e.target.value) setWeek(monday(e.target.value)) }} /></label><Button variant="outline" aria-label="Next week" onClick={() => setWeek(addDays(week, 7))}><ChevronRight className="size-4" /></Button><Button variant="outline" onClick={copyPrevious}><Copy className="size-4" />Copy previous week</Button></div>}
      <div className="flex flex-wrap items-center gap-4 text-xs"><span className="flex items-center gap-2"><span className="size-3 rounded-sm bg-primary" />Available</span><span className="text-muted-foreground">Unmarked times are {schedule.weeklySubmitted ? "unavailable" : "unknown until you submit a schedule"}.{mode === "week" && " Date changes replace the entire day."}</span></div>
      <WeeklyCalendar days={days} dates={mode === "week" ? dates : undefined} onChange={editDays} />
      <div className="flex flex-wrap gap-2">{WEEK_DAYS.map((day, i) => <div key={day} className="flex gap-1"><Button variant="outline" size="sm" className="min-h-11" onClick={() => clear([i])}>Clear {day.slice(0, 3)}</Button>{mode === "week" && Object.hasOwn(schedule.exceptions, dates[i]) && <Button variant="ghost" size="sm" className="min-h-11" aria-label={`Restore recurring availability on ${day}`} onClick={() => { const exceptions = { ...schedule.exceptions }; delete exceptions[dates[i]]; change({ ...schedule, exceptions }) }}>Use recurring</Button>}</div>)}</div>
      <div className="flex flex-wrap items-center gap-2"><select aria-label="Copy from day" className="oc-av-select" value={copyFrom} onChange={e => setCopyFrom(Number(e.target.value))}>{WEEK_DAYS.map((day, i) => <option key={day} value={i}>{day}</option>)}</select><span className="text-xs text-muted-foreground">to</span><select aria-label="Copy to day" className="oc-av-select" value={copyTo} onChange={e => setCopyTo(Number(e.target.value))}>{WEEK_DAYS.map((day, i) => <option key={day} value={i}>{day}</option>)}</select><Button variant="outline" disabled={copyFrom === copyTo} onClick={copyDay}>Copy day</Button><Button variant="outline" onClick={() => clear([0, 1, 2, 3, 4, 5, 6])}>Clear entire week</Button></div>
      {!schedule.weeklySubmitted && !scope && <Button variant="outline" onClick={() => change({ ...schedule, weeklySubmitted: true })}>Submit this recurring week (including an empty week)</Button>}
      {scope && <div className="space-y-3 border-t pt-4"><p role="status" className="text-sm font-medium">{confirmed ? "Participation confirmed. Your club can use this availability for staffing." : "Participation not confirmed. This availability is excluded from confirmed staffing counts."}</p><div className="flex flex-wrap gap-2"><Button disabled={confirming} onClick={async () => {
        setConfirming(true); setNotice("")
        try { await queue.flush(); const result = await saveMyRoundAvailability({ ...queue.document, ...scope, confirm: true }); queue.document = result.document; setConfirmed(result.confirmed); render(v => v + 1) }
        catch (error) { setNotice(error instanceof Error ? error.message : "Could not confirm participation.") }
        finally { setConfirming(false) }
      }}><Check className="size-4" />{confirmed ? "Reconfirm participation" : "Confirm participation"}</Button><Button variant="outline" onClick={async () => {
        setConfirming(true)
        try { const latest = await getMyRoundAvailability(scope); setConfirmed(false); queue.change(structuredClone(latest.global)) }
        catch (error) { setNotice(error instanceof Error ? error.message : "Could not refresh the global schedule.") }
        finally { setConfirming(false) }
      }}>Use current global schedule</Button><Button variant="outline" onClick={async () => {
        setConfirming(true)
        try { await queue.flush(); const result = await saveMyRoundAvailability({ ...queue.document, ...scope, confirm: false }); queue.document = result.document; setConfirmed(false) }
        catch (error) { setNotice(error instanceof Error ? error.message : "Could not withdraw confirmation.") }
        finally { setConfirming(false) }
      }}>Withdraw confirmation</Button>{!schedule.weeklySubmitted && !Object.keys(schedule.exceptions).length && <Button variant="outline" onClick={() => change({ ...schedule, weeklySubmitted: true })}>Declare no availability</Button>}</div></div>}
    </fieldset>
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {queue.error && <div className="space-y-3"><p role="alert" className="text-sm text-destructive">{queue.error}</p><div className="flex gap-2"><Button variant="outline" onClick={() => void queue.flush().catch(() => {})}>Retry save</Button><Button variant="outline" onClick={() => { if (canLeaveWorkspace()) window.location.reload() }}>Reload saved version</Button></div></div>}
  </section>
}

export function MyAvailability({ initial, rounds }: { initial: AvailabilityDocument; rounds: AvailabilityRound[] }) {
  const [selected, setSelected] = useState("")
  useEffect(() => {
    const guard = (event: MouseEvent) => { if (event.target instanceof Element && event.target.closest("a[href]") && !canLeaveWorkspace()) { event.preventDefault(); event.stopPropagation() } }
    document.addEventListener("click", guard, true)
    return () => document.removeEventListener("click", guard, true)
  }, [])
  return <div className="space-y-8"><AvailabilityEditor initial={initial} />
    <section className="space-y-4"><h2 className="oc-section-heading">Interview round participation</h2><p className="text-sm leading-6 text-muted-foreground">Confirm each club and round separately. Adjustments here are private to that club; they do not change your general availability.</p>{!rounds.length ? <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No eligible interview rounds yet. Club administrators designate interviewers in Members.</p> : <><label className="block text-sm">Choose an interview round<select aria-label="Choose an interview round" className="oc-av-select mt-2 block w-full sm:w-auto" value={selected} onChange={e => { if (canLeaveWorkspace()) setSelected(e.target.value) }}><option value="">Select a club and round</option>{rounds.map(round => <option key={round.id} value={round.id}>{round.clubName} · {round.name}{round.confirmed ? " · Confirmed" : ""}</option>)}</select></label>{selected && <RoundEditor key={selected} round={rounds.find(round => round.id === selected)!} />}</>}</section>
  </div>
}
function RoundEditor({ round }: { round: AvailabilityRound }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getMyRoundAvailability>> | null>(null), [error, setError] = useState(""), [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    getMyRoundAvailability({ clubId: round.clubId, roundId: round.id }).then(value => { if (active) setData(value) }).catch(error => { if (active) setError(error instanceof Error ? error.message : "Could not load this round.") })
    return () => { active = false }
  }, [round.clubId, round.id, attempt])
  if (error) return <div role="alert" className="space-y-3 text-sm text-destructive">{error}<Button variant="outline" onClick={() => { setError(""); setAttempt(v => v + 1) }}>Retry loading round</Button></div>
  return data ? <AvailabilityEditor initial={data.document} initialConfirmed={data.confirmed} scope={{ clubId: round.clubId, roundId: round.id }} title={data.name} /> : <p role="status">Loading round availability…</p>
}
