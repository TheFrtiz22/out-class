"use client"

import { LoadingState } from "@/components/ui/loading-state"
import { ActionWorkflow } from "@/components/product/action-workflow";
import {ScheduleAvailabilityRequest,AvailabilitySchedules} from "./scheduled-requests"
import { useEffect, useMemo, useState } from "react"
import { requestRoundAvailability } from "@/actions/availability"
import { getAvailabilityOverview } from "@/lib/availability-workspace-read"
import { getRoomWorkspace } from "@/lib/workspace-api"
import { addDays, monday, today, WEEK_DAYS, responseLabels, type AvailabilityOverview } from "@/lib/availability"
import { simultaneousStaffing, staffingShortageSessionIds } from "@/lib/interview-staffing-capacity"
import { organizationRoles, organizationRoleLabels } from "@/lib/organization-authorization"
import { useDemoMode } from "@/contexts/demo-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { WeeklyCalendar, minuteLabel } from "./weekly-calendar"
import { SCHEDULING_TIMEZONE, SCHEDULING_TIMEZONE_LABEL } from "@/lib/scheduling-config"

export function AdminAvailabilityOverview({ clubId, roundId: controlledRound, week: controlledWeek, onWeekChange, onData, onOpenSession }: {
  clubId: string; roundId?: string; week?: string; onWeekChange?: (week: string) => void
  onData?: (data: AvailabilityOverview) => void; onOpenSession?: (roomId: string, slotId: string) => void
}) {
  const demo = useDemoMode()
  const [rounds, setRounds] = useState<{ id: string; name: string }[]>([]), [localRound, setRoundId] = useState("")
  const timezone = SCHEDULING_TIMEZONE
  const [localWeek, setWeek] = useState(() => monday(today(SCHEDULING_TIMEZONE))), [role, setRole] = useState("")
  const roundId = controlledRound ?? localRound, week = controlledWeek ?? localWeek
  const [data, setData] = useState<AvailabilityOverview | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(""), [attempt, setAttempt] = useState(0)
  const [selected, setSelected] = useState({ day: 0, slot: 36 }), [checked, setChecked] = useState<string[]>([]), [busy, setBusy] = useState(false), [notice, setNotice] = useState("")
  useEffect(() => {
    if (!demo.ready || demo.isDemoEnabled || controlledRound !== undefined) return
    let active = true
    getRoomWorkspace(clubId).then(value => { if (active) setRounds(value.rounds.filter(r => r.type === "INTERVIEW" || /interview/i.test(r.name) || value.rooms.some(room => room.roundId === r.id))) }).catch(() => { if (active) setError("Could not load interview rounds.") })
    return () => { active = false }
  }, [clubId, demo.ready, demo.isDemoEnabled, controlledRound])
  useEffect(() => {
    const refresh = () => setAttempt(v => v + 1)
    window.addEventListener("focus", refresh); window.addEventListener("outclass:availability-changed", refresh); window.addEventListener("outclass:staffing-changed", refresh)
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("outclass:availability-changed", refresh); window.removeEventListener("outclass:staffing-changed", refresh) }
  }, [])
  useEffect(() => {
    if (!demo.ready || demo.isDemoEnabled) return
    let active = true
    setLoading(true); setError("")
    getAvailabilityOverview({ clubId, week, timezone, ...(roundId ? { roundId } : {}), ...(role ? { role } : {}) }).then(value => { if (active) { setData(value); onData?.(value) } }).catch(error => { if (active) setError(error instanceof Error ? error.message : "Could not load availability.") }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [clubId, week, timezone, roundId, role, attempt, demo.ready, demo.isDemoEnabled, onData])
  const rawCounts = useMemo(() => Array.from({ length: 7 }, (_, day) => Array.from({ length: 96 }, (_, slot) => data?.members.reduce((sum, member) => sum + Number(member.available[day][slot]), 0) ?? 0)), [data])
  const sessionsAt = (day: number, slot: number) => { const cell = data?.cells[day][slot]; return cell?.start == null ? [] : data!.slots.filter(s => s.active && +new Date(s.startTime) < cell.end! && +new Date(s.endTime) + (s.buffer ?? 0) * 60_000 > cell.start!) }
  const selectedSessions = sessionsAt(selected.day, selected.slot), needed = selectedSessions.reduce((n, s) => n + s.required, 0)
  const candidateIds = new Set(selectedSessions.flatMap(s => s.availableMemberIds))
  const available = data?.members.filter(member => selectedSessions.length ? candidateIds.has(member.id) : member.available[selected.day][selected.slot]) ?? []
  const selectedCapacity = simultaneousStaffing(selectedSessions)
  const shortageIds = useMemo(() => staffingShortageSessionIds(data?.slots ?? []), [data])
  const selectedCell = data?.cells[selected.day][selected.slot]
  const counts = rawCounts
  async function request(reminder: boolean) {
    if (!data || !roundId) return
    const candidates = data.members.filter(m => reminder ? m.canRemind : m.response === "NOT_REQUESTED")
    const memberIds = candidates.filter(m => !checked.length || checked.includes(m.id)).map(m => m.id)
    if (!memberIds.length) return
    setBusy(true); setError(""); setNotice("")
    try { const result = await requestRoundAvailability({ clubId, roundId, memberIds, reminder }); setNotice(`${result.sent} ${reminder ? "reminder" : "request"}${result.sent === 1 ? "" : "s"} sent. Email follows each member’s interview notification preferences.`); setChecked([]); setAttempt(v => v + 1) }
    catch (error) { setError(error instanceof Error ? error.message : "Could not send availability requests.") }
    finally { setBusy(false) }
  }
  if (demo.isDemoEnabled) return <p className="text-sm text-muted-foreground">Availability management is available in your signed-in workspace.</p>
  return <section className="oc-availability space-y-4" aria-label="Team availability" aria-busy={busy}>
    <div className="flex flex-wrap items-end gap-3">
      {controlledRound === undefined && <label className="text-sm">Interview round<select aria-label="Interview round" className="oc-av-select mt-1 block" value={roundId} onChange={e => setRoundId(e.target.value)}><option value="">Global declarations</option>{rounds.map(round => <option key={round.id} value={round.id}>{round.name}</option>)}</select></label>}
      <label className="text-sm">Member role<select aria-label="Member role" className="oc-av-select mt-1 block" value={role} onChange={e => { setRole(e.target.value); setChecked([]) }}><option value="">All roles</option>{organizationRoles.map(value => <option key={value} value={value}>{organizationRoleLabels[value]}</option>)}</select></label>
      <label className="text-sm">Week of<Input aria-label="Week of" type="date" value={week} onChange={e => { if (e.target.value) { const next = monday(e.target.value); onWeekChange ? onWeekChange(next) : setWeek(next) } }} /></label><p className="text-xs text-muted-foreground">{SCHEDULING_TIMEZONE_LABEL} · 8:00 AM–9:00 PM</p><Button variant="outline" onClick={() => setAttempt(v => v + 1)}>Refresh overview</Button>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}{notice && <p role="status" className="text-sm">{notice}</p>}
    {loading && <LoadingState label={data ? "Updating availability…" : "Loading team availability…"} layout={data ? "inline" : "calendar"} calendarView="week" />}
    {data && !error && <div className={loading ? "pointer-events-none opacity-50" : ""}>
      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-2 border-y py-3 text-sm"><span><strong>{data.members.length}</strong> eligible</span><span><strong>{data.members.filter(m => m.confirmed).length}</strong> confirmed participants</span><span><strong>{data.members.filter(m => m.response === "SUBMITTED" || m.response === "DECLINED").length}</strong> responses received</span><span><strong>{data.members.filter(m => m.response === "AWAITING").length}</strong> awaiting response</span><span><strong>{data.members.filter(m => m.response === "NOT_REQUESTED").length}</strong> not requested</span></div>
      {roundId && <ActionWorkflow title="Collect availability" description="Choose interviewers, send availability requests, and review responses." trigger="Collect availability" presentation="sheet"><div className="space-y-4" data-saving={busy}>
        <div className="mb-3 flex flex-wrap items-center gap-2"><Button disabled={busy || loading || !data.members.some(m => m.response === "NOT_REQUESTED" && (!checked.length || checked.includes(m.id)))} onClick={() => request(false)}>Request availability{checked.length ? " from selected" : " from all"}</Button><Button variant="outline" disabled={busy || loading || !data.members.some(m => m.canRemind && (!checked.length || checked.includes(m.id)))} onClick={() => request(true)}>Remind nonresponders</Button><p className="text-xs text-muted-foreground">Reminders become available 24 hours after the last request. Submitted and declined members are skipped.</p></div>
        {data.members.length ? <div className="max-h-64 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th className="py-2"><input aria-label="Select all eligible members" type="checkbox" checked={data.members.length > 0 && data.members.every(member => checked.includes(member.id))} onChange={e => setChecked(e.target.checked ? data.members.map(m => m.id) : [])} /></th><th>Interviewer</th><th>Role</th><th>Response</th></tr></thead><tbody>{data.members.map(member => <tr key={member.id} className="border-t"><td className="h-11 pr-3"><input type="checkbox" aria-label={`Select ${member.name}`} checked={checked.includes(member.id)} onChange={e => setChecked(values => e.target.checked ? [...values, member.id] : values.filter(id => id !== member.id))} /></td><td>{member.name}</td><td className="text-xs text-muted-foreground">{organizationRoleLabels[member.role as typeof organizationRoles[number]]}</td><td className="text-xs">{responseLabels[member.response]}</td></tr>)}</tbody></table></div> : <p className="text-sm text-muted-foreground">No eligible interviewers. Designate members as interviewers in the Members workspace.</p>}
        <ScheduleAvailabilityRequest clubId={clubId} roundId={roundId} reminder={false} memberIds={data.members.filter(m=>m.response==="NOT_REQUESTED"&&(!checked.length||checked.includes(m.id))).map(m=>m.id)}/>
        <ScheduleAvailabilityRequest clubId={clubId} roundId={roundId} reminder memberIds={data.members.filter(m=>m.response==="AWAITING"&&(!checked.length||checked.includes(m.id))).map(m=>m.id)}/>
        <AvailabilitySchedules clubId={clubId}/>
      </div></ActionWorkflow>}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]"><div><WeeklyCalendar readOnly days={counts.map(day => day.map(n => n > 0))} counts={counts} dates={Array.from({ length: 7 }, (_, i) => addDays(data.week, i))} onSelect={(day, slot) => setSelected({ day, slot })} /><p className="mt-2 text-xs text-muted-foreground">Heatmap: confirmed participants who can interview at each time, including access and official commitment checks. Session capacity below also requires the full interview and buffer.</p></div>
        <aside className="space-y-3 rounded-xl border p-4"><h3 className="oc-card-heading">{WEEK_DAYS[selected.day]} · {minuteLabel(selected.slot * 15)}</h3><p className="text-xs text-muted-foreground">{selectedCell?.date} · {SCHEDULING_TIMEZONE_LABEL}</p>{selectedCell?.start === null ? <p className="text-sm">Daylight saving gap or repeated time. Check precise session times below.</p> : <><p role="status" className={`text-sm font-medium ${selectedCapacity.shortage > 0 ? "text-amber-800" : ""}`}>{available.length} eligible interviewers available{needed ? `; ${needed} needed${selectedCapacity.shortage > 0 ? " · Understaffed" : ""}` : "; no sessions configured"}.</p>{selectedCapacity.shortage > 0 && <p className="text-sm text-amber-800">Only {selectedCapacity.filled}/{needed} positions can be covered simultaneously with these candidates.</p>}<ul className="space-y-2 text-sm">{available.map(member => <li key={member.id}>{member.name}</li>)}</ul>{!available.length && <p className="text-xs text-muted-foreground">No confirmed availability at this time.</p>}{selectedSessions.map(s => <Button key={s.id} variant="outline" className="h-auto min-h-11 w-full whitespace-normal" onClick={() => onOpenSession?.(s.roomId, s.id)} disabled={!onOpenSession}>Open {s.roomName} · {s.availableMemberIds.length}/{s.required} available</Button>)}</>}</aside>
      </div>
      {roundId && <section className="mt-4 space-y-2"><h3 className="oc-card-heading">Session coverage</h3><p className="text-xs text-muted-foreground">Shared staffing shortages account for candidates needed in overlapping rooms. Auto-Fill also checks transfer buffers, locks and duty limits across the full schedule.</p>{data.slots.length ? <div className="overflow-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="bg-muted/30"><tr>{["Room", "Time", "Available / needed", "Officially assigned", "Action"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{data.slots.map(slot => <tr key={slot.id} className="border-t"><td className="p-3">{slot.roomName}</td><td className="p-3">{new Date(slot.startTime).toLocaleString("en-US", { timeZone: SCHEDULING_TIMEZONE, hour12: true, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td><td className="p-3">{slot.availableMemberIds.length}/{slot.required}{shortageIds.has(slot.id) ? " · Shared staffing shortage" : " · Candidates available"}{!slot.active && " · Inactive"}</td><td className="p-3">{slot.assigned}/{slot.required}</td><td className="p-3">{onOpenSession && <Button size="sm" variant="outline" onClick={() => onOpenSession(slot.roomId, slot.id)}>Configure session</Button>}</td></tr>)}</tbody></table></div> : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No room sessions this week. Continue to Rooms to configure interview times.</p>}</section>}
    </div>}
  </section>
}
