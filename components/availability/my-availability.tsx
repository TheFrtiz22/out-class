"use client"
import { userMessage } from "@/lib/user-message"
import { PillSelect } from "@/components/ui/pill-select"
import { DateField } from "@/components/ui/date-picker"
import { LoadingState } from "@/components/ui/loading-state"

import { useEffect, useMemo, useRef, useState } from "react"
import { CalendarDays, Check, ChevronLeft, ChevronRight, Copy } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import { declineRoundParticipation, saveMyAvailability, saveMyRoundAvailability } from "@/actions/availability"
import { availabilityHref, responseLabels, addDays, availabilityEditorDays, availabilityEditorKnownDays, editAvailabilityDays, restoreVisibleRecurring, monday, today, WEEK_DAYS, type AvailabilityDocument, type AvailabilityRound, type AvailabilitySchedule } from "@/lib/availability"
import { getMyAvailability, getMyRoundAvailability } from "@/lib/availability-workspace-read"
import { saveAvailabilityWithRecovery } from "@/lib/availability-save-recovery"
import { AvailabilitySaveQueue } from "@/lib/availability-save-queue"
import { SCHEDULING_TIMEZONE, SCHEDULING_TIMEZONE_LABEL } from "@/lib/scheduling-config"
import { WeeklyCalendar } from "./weekly-calendar"
import { OutlookBusyImport } from "./outlook-busy-import"
import { OUTLOOK_BUSY_ENABLED } from "@/lib/outlook-busy"
import { Panel } from "@/components/ui/panel"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { NativeSelect } from "@/components/ui/native-select"

export function AvailabilityEditor({ initial, scope, initialConfirmed = false, initialDeclined = false, onSaved, onStatus, initialWeek, title = "Your weekly rhythm" }: {
  initial: AvailabilityDocument; scope?: { clubId: string; roundId: string }; initialWeek?: string; initialConfirmed?: boolean; initialDeclined?: boolean; onSaved?: (value: AvailabilityDocument) => void; onStatus?: (confirmed: boolean, declined: boolean) => void; title?: string
}) {
  const [, render] = useState(0), [confirmed, setConfirmed] = useState(initialConfirmed), [declined, setDeclined] = useState(initialDeclined), [confirming, setConfirming] = useState(false), [notice, setNotice] = useState("")
  const [mode, setMode] = useState<"recurring" | "week">(scope || initial.schedule.timezone !== SCHEDULING_TIMEZONE ? "week" : "recurring")
  const [week, setWeek] = useState(() => initialWeek ?? monday(today(SCHEDULING_TIMEZONE))), [copyFrom, setCopyFrom] = useState(0), [copyTo, setCopyTo] = useState(1)
  const queueRef = useRef<AvailabilitySaveQueue | null>(null)
  if (!queueRef.current) queueRef.current = new AvailabilitySaveQueue(initial, async payload => {
    const saved = await saveAvailabilityWithRecovery(payload,
      async () => scope ? (await saveMyRoundAvailability({ ...payload, ...scope, confirm: false })).document : saveMyAvailability(payload),
      async () => { if (scope) { const current = await getMyRoundAvailability(scope); return { document: current.document, responseMatches: !current.confirmed && !current.declined } } return { document: (await getMyAvailability()).document, responseMatches: true } })
    onSaved?.(saved); return saved
  }, () => render(value => value + 1))
  const queue = queueRef.current, schedule = queue.document.schedule
  useEffect(() => {
    queue.activate()
    const unload = (event: BeforeUnloadEvent) => { if (queue.dirty || queue.saving) { event.preventDefault(); event.returnValue = "" } }
    window.addEventListener("beforeunload", unload)
    return () => { window.removeEventListener("beforeunload", unload); queue.dispose() }
  }, [queue])
  const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week])
  const days = useMemo(() => availabilityEditorDays(schedule, week, mode === "recurring"), [week, mode, schedule])
  const knownDays = useMemo(() => mode === "recurring" ? Array(7).fill(schedule.weeklySubmitted) as boolean[] : availabilityEditorKnownDays(schedule, week), [mode, schedule, week])
  function change(value: AvailabilitySchedule) { if (confirming || JSON.stringify(value) === JSON.stringify(queue.document.schedule)) return; setConfirmed(false); setDeclined(false); onStatus?.(false, false); setNotice(""); queue.change(value) }
  function editDays(next: boolean[][], changedDays: number[]) {
    const current = queue.document.schedule
    change(editAvailabilityDays(current, week, mode === "recurring", next, changedDays))
  }
  function clear(indices: number[]) { editDays(days.map((cells, i) => indices.includes(i) ? cells.map(() => false) : cells), indices) }
  function copyDay() {
    if (!knownDays[copyFrom]) { setNotice("The source day has no submitted availability."); return }
    editDays(days.map((cells, i) => i === copyTo ? [...days[copyFrom]] : cells), [copyTo])
  }
  function copyPrevious() {
    const previous = availabilityEditorDays(schedule, addDays(week, -7), false)
    const indices = availabilityEditorKnownDays(schedule, addDays(week, -7)).flatMap((known, i) => known ? [i] : [])
    editDays(previous, indices)
  }
  return <Panel as="section" className="oc-availability space-y-5 sm:p-6" data-unsaved={queue.dirty} data-saving={queue.saving || queue.state === "saving" || confirming} aria-busy={confirming}>
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="oc-section-heading">{title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{scope ? "Your global schedule is prefilled. Adjust specific dates here and confirm your participation for this club and round." : "Enter your usual free time once. Your schedule follows local clock time, including daylight saving changes."}</p></div><p role="status" aria-live="polite" className={`text-xs font-medium ${queue.state === "error" ? "text-destructive" : "text-muted-foreground"}`}>{queue.state === "saving" ? "Saving…" : queue.state === "unsaved" ? "Unsaved changes" : queue.state === "error" ? "Save failed · edits retained" : queue.document.revision === 0 ? "No schedule saved" : "All changes saved"}</p></header>
    <fieldset disabled={confirming} className="min-w-0 space-y-5">
      <p className="text-xs text-muted-foreground">8:00 AM–9:00 PM · {SCHEDULING_TIMEZONE_LABEL}. Daylight saving changes are automatic. Previously saved hours outside this window are retained.</p>
      {!scope && schedule.timezone === SCHEDULING_TIMEZONE && <SegmentedControl label="Availability editing mode" value={mode} onChange={setMode} options={[{ value: "recurring", label: <span className="inline-flex items-center gap-2"><CalendarDays className="size-4" aria-hidden="true" />Recurring week</span> }, { value: "week", label: "Specific dates" }]} />}
      {mode === "week" && <div className="flex flex-wrap items-center gap-2"><Button variant="outline" aria-label="Previous week" onClick={() => setWeek(addDays(week, -7))}><ChevronLeft className="size-4" /></Button><div className="text-sm"><span className="block">Week of</span><DateField label="Week of" className="mt-1" value={week} onChange={value => { if (value) setWeek(monday(value)) }} /></div><Button variant="outline" aria-label="Next week" onClick={() => setWeek(addDays(week, 7))}><ChevronRight className="size-4" /></Button><Button variant="outline" onClick={copyPrevious}><Copy className="size-4" />Copy previous week</Button></div>}
      {mode === "week" && OUTLOOK_BUSY_ENABLED && <OutlookBusyImport week={week} days={days} disabled={confirming} onApply={editDays} afterApply={scope ? "Submit your round availability again to share the change." : ""} />}
      <div className="flex flex-wrap items-center gap-4 text-xs"><span className="flex items-center gap-2"><span className="size-3 rounded-sm bg-primary" />Available</span><span className="flex items-center gap-2"><span className="size-3 rounded-sm border bg-card" />Unavailable</span><span className="flex items-center gap-2"><span className="oc-av-cell is-unknown !size-3 rounded-sm border" />Unknown</span><span className="text-muted-foreground">Unmarked times on submitted days are unavailable. Striped days are unknown.{mode === "week" && " Date changes replace the editable hours on that day."}</span></div>
      {scope && <div className="space-y-3 border-t pt-4"><p role="status" className="text-sm font-medium">{confirmed ? "Submitted · Participation confirmed. Your club can use this availability for staffing." : declined ? "Declined participation. You are excluded from confirmed staffing counts." : "Not submitted for this round. Saved edits are excluded from confirmed staffing counts until you submit."}</p><div className="flex flex-wrap gap-2"><Button disabled={confirming} onClick={async () => {
        setConfirming(true); setNotice("")
        try { await queue.flush(); const saved = await saveAvailabilityWithRecovery(queue.document,
          async () => (await saveMyRoundAvailability({ ...queue.document, ...scope, confirm: true })).document,
          async () => { const current = await getMyRoundAvailability(scope); return { document: current.document, responseMatches: current.confirmed && !current.declined } }); queue.document = saved; setConfirmed(true); setDeclined(false); onStatus?.(true, false); window.dispatchEvent(new Event("outclass:availability-changed")); render(v => v + 1) }
        catch (error) { setNotice(userMessage(error, "Could not confirm participation.")) }
        finally { setConfirming(false) }
      }}><Check className="size-4" />{confirmed ? "Update submitted availability" : "Submit round availability"}</Button><Button variant="outline" onClick={async () => {
        setConfirming(true)
        try { const latest = await getMyRoundAvailability(scope); if (JSON.stringify(latest.global) === JSON.stringify(queue.document.schedule)) setNotice("Already using your current global schedule. Your response is unchanged."); else { setConfirmed(false); setDeclined(false); onStatus?.(false, false); queue.change(structuredClone(latest.global)) } }
        catch (error) { setNotice(userMessage(error, "Could not refresh the global schedule.")) }
        finally { setConfirming(false) }
      }}>Use current global schedule</Button><Button variant="outline" disabled={!confirmed} onClick={async () => {
        setConfirming(true)
        try { await queue.flush(); const result = await saveMyRoundAvailability({ ...queue.document, ...scope, confirm: false }); queue.document = result.document; setConfirmed(false); onStatus?.(false, false); window.dispatchEvent(new Event("outclass:availability-changed")) }
        catch (error) { setNotice(userMessage(error, "Could not withdraw confirmation.")) }
        finally { setConfirming(false) }
      }}>Withdraw confirmation</Button><Button variant="ghost" disabled={confirming || declined} onClick={async () => {
        setConfirming(true); setNotice("")
        try { await queue.flush(); const result = await declineRoundParticipation({ ...scope, revision: queue.document.revision, accountId: queue.document.accountId }); queue.document = { ...queue.document, revision: result.revision }; setDeclined(true); setConfirmed(false); onStatus?.(false, true); window.dispatchEvent(new Event("outclass:availability-changed")) }
        catch (error) { setNotice(userMessage(error, "Could not decline participation.")) }
        finally { setConfirming(false) }
      }}>Decline participation</Button>{!schedule.weeklySubmitted && !Object.keys(schedule.exceptions).length && <Button variant="outline" onClick={() => change({ ...schedule, weeklySubmitted: true })}>Declare no availability</Button>}</div></div>}
      <WeeklyCalendar knownDays={knownDays} days={days} dates={mode === "week" ? dates : undefined} onChange={editDays} />
      <div className="flex flex-wrap gap-2">{WEEK_DAYS.map((day, i) => <div key={day} className="flex gap-1"><Button variant="outline" size="sm" className="min-h-11" onClick={() => clear([i])}>Clear {day.slice(0, 3)}</Button>{mode === "week" && schedule.timezone === SCHEDULING_TIMEZONE && Object.hasOwn(schedule.exceptions, dates[i]) && <Button variant="ghost" size="sm" className="min-h-11" aria-label={`Restore recurring availability on ${day}`} onClick={() => change(restoreVisibleRecurring(schedule, dates[i]))}>Use recurring</Button>}</div>)}</div>
      <div className="flex flex-wrap items-center gap-2"><NativeSelect aria-label="Copy from day" className="oc-av-select" value={copyFrom} onChange={e => setCopyFrom(Number(e.target.value))}>{WEEK_DAYS.map((day, i) => <option key={day} value={i}>{day}</option>)}</NativeSelect><span className="text-xs text-muted-foreground">to</span><NativeSelect aria-label="Copy to day" className="oc-av-select" value={copyTo} onChange={e => setCopyTo(Number(e.target.value))}>{WEEK_DAYS.map((day, i) => <option key={day} value={i}>{day}</option>)}</NativeSelect><Button variant="outline" disabled={copyFrom === copyTo} onClick={copyDay}>Copy day</Button><Button variant="outline" onClick={() => clear([0, 1, 2, 3, 4, 5, 6])}>Clear entire week</Button></div>
      {!schedule.weeklySubmitted && !scope && <Button variant="outline" className="h-auto min-h-11 whitespace-normal" onClick={() => change({ ...schedule, weeklySubmitted: true })}>Submit this recurring week (including an empty week)</Button>}

    </fieldset>
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {queue.error && <div className="space-y-3"><p role="alert" className="text-sm text-destructive">{queue.error}</p><div className="flex gap-2"><Button variant="outline" onClick={() => void queue.flush().catch(() => {})}>Retry save</Button><Button variant="outline" onClick={() => { if (canLeaveWorkspace()) window.location.reload() }}>Reload saved version</Button></div></div>}
  </Panel>
}

export function MyAvailability({ initial, rounds, initialRoundId = "" }: { initial: AvailabilityDocument; rounds: AvailabilityRound[]; initialRoundId?: string }) {
  const [global, setGlobal] = useState(initial), [options, setOptions] = useState(rounds)
  useEffect(() => {
    let active = true
    const refresh = () => { void getMyAvailability().then(data => { if (active) setOptions(data.rounds) }).catch(() => {}) }
    window.addEventListener("outclass:availability-changed", refresh)
    return () => { active = false; window.removeEventListener("outclass:availability-changed", refresh) }
  }, [])
  const [selected, setSelected] = useState(rounds.some(round => round.id === initialRoundId) ? initialRoundId : "")
  useEffect(() => {
    const guard = (event: MouseEvent) => { if (event.target instanceof Element && event.target.closest("a[href]") && !canLeaveWorkspace()) { event.preventDefault(); event.stopPropagation() } }
    const back = () => { const id = new URLSearchParams(window.location.search).get("roundId") ?? ""; if (canLeaveWorkspace()) setSelected(rounds.some(round => round.id === id) ? id : ""); else window.history.pushState(null, "", selected ? availabilityHref(rounds.find(round => round.id === selected)?.clubId, selected) : availabilityHref()) }
    document.addEventListener("click", guard, true); window.addEventListener("popstate", back)
    return () => { document.removeEventListener("click", guard, true); window.removeEventListener("popstate", back) }
  }, [rounds, selected])
  const round = options.find(round => round.id === selected)
  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3"><div className="min-w-0 max-w-full text-sm font-medium"><span className="block">Editing</span><PillSelect label="Choose an interview round" className="mt-1 w-full" allLabel="My global availability · all clubs" active={false} value={selected} onChange={value => { if (!canLeaveWorkspace()) return; setSelected(value); const next = rounds.find(r => r.id === value); window.history.pushState(null, "", availabilityHref(next?.clubId, next?.id)) }} options={options.map(round => ({ value: round.id, label: `${round.clubName} · ${round.name} · ${responseLabels[round.response]}` }))} /></div><a href="/settings/interviews" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">View my published interviews</a></div>
    <p className="text-xs text-muted-foreground">{round ? "This response belongs only to this club and round. It does not change your global schedule." : "Save your usual week once. Round requests prefill this schedule and require a separate submission."}</p>
    {round ? <RoundEditor key={round.id} round={round} onStatus={(confirmed, declined) => setOptions(previous => previous.map(value => value.id === round.id ? { ...value, confirmed, response: confirmed ? "SUBMITTED" : declined ? "DECLINED" : value.requested ? "AWAITING" : "NOT_REQUESTED" } : value))} /> : <AvailabilityEditor key="global" initial={global} onSaved={setGlobal} />}
  </div>
}
function RoundEditor({ round, onStatus }: { round: AvailabilityRound; onStatus: (confirmed: boolean, declined: boolean) => void }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getMyRoundAvailability>> | null>(null), [error, setError] = useState(""), [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    getMyRoundAvailability({ clubId: round.clubId, roundId: round.id }).then(value => { if (active) setData(value) }).catch(error => { if (active) setError(userMessage(error, "Could not load this round.")) })
    return () => { active = false }
  }, [round.clubId, round.id, attempt])
  if (error) return <div role="alert" className="space-y-3 text-sm text-destructive">{error}<Button variant="outline" onClick={() => { setError(""); setAttempt(v => v + 1) }}>Retry loading round</Button></div>
  return data ? <AvailabilityEditor initial={data.document} onStatus={onStatus} initialConfirmed={data.confirmed} initialDeclined={data.declined} initialWeek={data.preferredWeek} scope={{ clubId: round.clubId, roundId: round.id }} title={data.name} /> : <LoadingState label="Loading round availability…" layout="calendar" calendarView="week" rows={3} />
}
