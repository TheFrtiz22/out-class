"use client"

import { useEffect, useMemo, useState } from "react"
import { getAvailabilityOverview } from "@/actions/availability"
import { getRoomWorkspace } from "@/lib/workspace-api"
import { addDays, monday, today, WEEK_DAYS, type AvailabilityOverview } from "@/lib/availability"
import { organizationRoles, organizationRoleLabels } from "@/lib/organization-authorization"
import { useDemoMode } from "@/contexts/demo-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { WeeklyCalendar, minuteLabel } from "./weekly-calendar"
import { TimezonePicker } from "./my-availability"

export function AdminAvailabilityOverview({ clubId }: { clubId: string }) {
  const demo = useDemoMode()
  const [rounds, setRounds] = useState<{ id: string; name: string }[]>([]), [roundId, setRoundId] = useState("")
  const [timezone, setTimezone] = useState("America/New_York"), [week, setWeek] = useState(() => monday(today("America/New_York"))), [role, setRole] = useState("")
  const [data, setData] = useState<AvailabilityOverview | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(""), [attempt, setAttempt] = useState(0)
  const [selected, setSelected] = useState({ day: 0, slot: 36 }), [target, setTarget] = useState(2)
  useEffect(() => {
    if (!demo.ready || demo.isDemoEnabled) return
    let active = true
    getRoomWorkspace(clubId).then(value => {
      if (!active) return
      setRounds(value.rounds.filter(r => r.type === "INTERVIEW" || /interview/i.test(r.name) || value.rooms.some(room => room.roundId === r.id)))
    }).catch(error => { if (active) setError(error instanceof Error ? error.message : "Could not load interview rounds.") })
    return () => { active = false }
  }, [clubId, demo.ready, demo.isDemoEnabled, attempt])
  useEffect(() => {
    if (!demo.ready || demo.isDemoEnabled) return
    let active = true
    setLoading(true); setError("")
    getAvailabilityOverview({ clubId, week, timezone, ...(roundId ? { roundId } : {}), ...(role ? { role } : {}) }).then(value => { if (active) setData(value) }).catch(error => { if (active) setError(error instanceof Error ? error.message : "Could not load availability.") }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [clubId, week, timezone, roundId, role, attempt, demo.ready, demo.isDemoEnabled])
  const counts = useMemo(() => Array.from({ length: 7 }, (_, day) => Array.from({ length: 96 }, (_, slot) => data?.members.reduce((sum, member) => sum + Number(member.available[day][slot]), 0) ?? 0)), [data])
  const selectedCell = data?.cells[selected.day][selected.slot]
  const available = data?.members.filter(member => member.available[selected.day][selected.slot]) ?? []
  if (demo.isDemoEnabled) return <p className="text-sm text-muted-foreground">Availability management is available in your signed-in workspace.</p>
  return <section className="oc-availability space-y-6">
    <header><p className="text-xs font-medium uppercase tracking-widest text-primary">Interview scheduling</p><h2 className="oc-section-heading mt-2">Find time for a full panel.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Only eligible members of this club appear. Select a round to count confirmed participants and check coverage of your existing interview rooms.</p></header>
    <div className="flex flex-wrap items-end gap-4 rounded-xl border bg-card p-4"><label className="text-sm">Interview round<select aria-label="Interview round" className="oc-av-select mt-1 block" value={roundId} onChange={e => setRoundId(e.target.value)}><option value="">Global schedules · declarations only</option>{rounds.map(round => <option key={round.id} value={round.id}>{round.name}</option>)}</select></label><label className="text-sm">Member role<select aria-label="Member role" className="oc-av-select mt-1 block" value={role} onChange={e => setRole(e.target.value)}><option value="">All roles</option>{organizationRoles.map(value => <option key={value} value={value}>{organizationRoleLabels[value]}</option>)}</select></label><label className="text-sm">Week of<Input aria-label="Week of" type="date" min="1900-01-01" max="2200-12-31" value={week} onChange={e => { if (e.target.value) setWeek(monday(e.target.value)) }} /></label><TimezonePicker value={timezone} onChange={setTimezone} /><label className="text-sm">Interviewer target<Input aria-label="Interviewer target" type="number" min={1} max={100} className="w-24" value={target} onChange={e => setTarget(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} /></label><Button variant="outline" onClick={() => setAttempt(v => v + 1)}>Refresh overview</Button></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {loading ? <p role="status">Loading availability…</p> : data && !error && <>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm"><span><strong>{data.members.length}</strong> eligible members</span><span><strong>{data.members.filter(m => !m.submitted).length}</strong> have not submitted{roundId ? " for this round" : ""}</span>{roundId && <span><strong>{data.members.filter(m => !m.confirmed).length}</strong> have not confirmed</span>}<span className="text-muted-foreground">{roundId ? "Counts include confirmed participants only." : "Global counts are declared availability, awaiting round confirmation."}</span></div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]"><div><WeeklyCalendar readOnly days={counts.map(day => day.map(n => n > 0))} counts={counts} dates={Array.from({ length: 7 }, (_, i) => addDays(data.week, i))} onSelect={(day, slot) => setSelected({ day, slot })} /><p className="mt-3 text-xs text-muted-foreground">Darker cells mean more available interviewers. Counts show headcount, not assignments. Daylight saving gaps or repeated times are marked when selected.</p></div>
        <aside className="space-y-4 rounded-xl border bg-card p-5"><h3 className="oc-card-heading">{WEEK_DAYS[selected.day]} · {minuteLabel(selected.slot * 15)}</h3><p className="text-xs text-muted-foreground">{selectedCell?.date} · {data.timezone}</p>{selectedCell?.start === null ? <p role="status" className="text-sm">This local time is skipped or repeated by daylight saving. Use the existing session coverage below for precise UTC times.</p> : <><p role="status" className={`text-sm font-medium ${available.length >= target ? "text-emerald-700" : "text-muted-foreground"}`}>{available.length} available · target {target}</p>{available.length ? <ul className="space-y-3 text-sm">{available.map(member => <li key={member.id}>{member.name}<span className="block text-xs text-muted-foreground">{organizationRoleLabels[member.role as typeof organizationRoles[number]]}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">No available interviewers for this interval.</p>}</>}</aside></div>
      {roundId && <section className="space-y-3"><h3 className="oc-card-heading">Existing interview session coverage</h3><p className="text-xs text-muted-foreground">Each count requires availability for the full slot. An interviewer can appear in overlapping rooms; these are potential candidates. Set the target to your panel headcount.</p>{data.slots.length ? <div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="bg-muted/30"><tr>{["Room", "Time", "Available / target", "Available interviewers"].map(label => <th key={label} scope="col" className="p-3 font-medium">{label}</th>)}</tr></thead><tbody>{data.slots.map(slot => <tr key={slot.id} className="border-t"><td className="p-3">{slot.roomName}</td><td className="p-3">{new Date(slot.startTime).toLocaleString([], { timeZone: data.timezone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })} – {new Date(slot.endTime).toLocaleTimeString([], { timeZone: data.timezone, hour: "numeric", minute: "2-digit", timeZoneName: "short" })}</td><td className="p-3 font-medium">{slot.availableMemberIds.length} / {target}{slot.availableMemberIds.length < target ? " · Needs coverage" : " · Target met"}</td><td className="p-3">{slot.availableMemberIds.map(id => data.members.find(m => m.id === id)?.name).join(", ") || "No confirmed availability"}</td></tr>)}</tbody></table></div> : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No open room sessions this week. Manage sessions in Rooms & Booking.</p>}</section>}
      <details className="rounded-xl border p-4"><summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">Submission and confirmation status</summary><ul className="mt-3 grid gap-3 text-sm sm:grid-cols-2">{data.members.map(member => <li key={member.id}><span className="font-medium">{member.name}</span><span className="block text-xs text-muted-foreground">{member.submitted ? "Availability submitted" : "Availability unknown"}{roundId ? member.confirmed ? " · Confirmed" : " · Not confirmed" : ""}</span></li>)}</ul></details>
    </>}
  </section>
}
