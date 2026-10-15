"use client"
import { SCHEDULING_TIMEZONE, SCHEDULING_TIMEZONE_LABEL } from "@/lib/scheduling-config"
import { LoadingState } from "@/components/ui/loading-state"
import { NativeSelect } from "@/components/ui/native-select"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Copy, DoorOpen, MapPin, Plus, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getRoomWorkspace, setInterviewRoomOpen, setInterviewStaffingRequirement } from "@/lib/workspace-api"
import { useDemoMode } from "@/contexts/demo-context"
import { type InterviewRoom, type RoomWorkspace, dayKey, slotTime, zonedInstant } from "@/lib/interview-rooms"
import { InterviewBookingPublication } from "./booking-publication"
import { BookingPicker } from "./booking-picker"
import { CreateRoomDialog } from "./create-room-dialog"
import { PanelPreviewWorkspace } from "./panel-preview-workspace"
import { getRoundStaffingCoverage } from "@/lib/availability-workspace-read"
import Link from "next/link"
import { AdminAvailabilityOverview } from "@/components/availability/admin-overview"
import { addDays, availabilityHref, localDateSchema, monday, today, type AvailabilityOverview, type SessionCoverage } from "@/lib/availability"
import { staffingShortageSessionIds } from "@/lib/interview-staffing-capacity"
import { interviewRoundWeek } from "@/lib/interview-scheduling-context"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import "./scheduling.css"

const scheduleSections = ["availability", "rooms", "fill", "review", "bookings", "preview"]
export function RoomManager({ clubId }: { clubId: string }) {
  const demo = useDemoMode()
  const [data, setData] = useState<RoomWorkspace | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true), [refresh, setRefresh] = useState(0)
  const [tab, setTab] = useState("availability"), [round, setRound] = useState(""), [date, setDate] = useState(""), [week, setWeek] = useState(() => monday(today(SCHEDULING_TIMEZONE)))
  const [create, setCreate] = useState(false), [source, setSource] = useState<InterviewRoom>(), [busy, setBusy] = useState(""), [notice, setNotice] = useState("")
  const [panelVisited, setPanelVisited] = useState(false), [autoStart, setAutoStart] = useState(false), [autoRequest, setAutoRequest] = useState(0), [autoFillPublished, setAutoFillPublished] = useState(false), [selectedSession, setSelectedSession] = useState("")
  const [overview, setOverview] = useState<AvailabilityOverview | null>(null), [coverage, setCoverage] = useState<Awaited<ReturnType<typeof getRoundStaffingCoverage>> | null>(null), [draftSummary, setDraftSummary] = useState<{ required: number; filled: number; state: string; hasDraft: boolean } | null>(null)
  const receiveOverview = useCallback((value: AvailabilityOverview) => setOverview(value), [])
  const receiveSummary = useCallback((value: { required: number; filled: number; state: string; hasDraft: boolean }) => setDraftSummary(value), [])
  const proposalGenerated = useCallback(() => { setTab("review"); const next = new URL(window.location.href); next.searchParams.set("schedule", "review"); window.history.replaceState(null, "", next.pathname + next.search) }, [])
  function url(section: string, roundId = round, filterDate = date, selectedWeek = week, sessionId = selectedSession) {
    const next = new URL(window.location.href)
    next.searchParams.set("schedule", section); next.searchParams.set("roundId", roundId)
    for (const [key, value] of [["date", filterDate], ["week", selectedWeek], ["sessionId", sessionId]]) { if (value) next.searchParams.set(key, value); else next.searchParams.delete(key) }
    return next.pathname + next.search
  }
  function navigateSection(section: string, auto = false, sessionId = selectedSession, fillPublished = false) {
    // Internal sections retain the same mounted draft; only changing round leaves it.
    setTab(section); setSelectedSession(sessionId)
    if (section === "fill" || section === "review") { setPanelVisited(true); if (auto) { setAutoFillPublished(fillPublished); setAutoStart(true); setAutoRequest(v => v + 1) } }
    window.history.pushState(null, "", url(section, round, date, week, sessionId))
  }
  useEffect(() => {
    if (!demo.ready) return
    let active = true
    setLoading(true)
    getRoomWorkspace(clubId).then(value => { if (active) { setData({ ...value, rounds: value.rounds.filter(r => r.type === "INTERVIEW" || r.type === "GROUP_INTERVIEW" || /interview/i.test(r.name) || value.rooms.some(room => room.roundId === r.id)) }); setError("") } }).catch(() => { if (active) setError("Could not load interview scheduling.") }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [clubId, refresh, demo.ready])
  useEffect(() => {
    if (!data || round) return
    const params = new URLSearchParams(window.location.search)
    const nextRound = data.rounds.find(r => r.id === params.get("roundId"))?.id ?? data.rounds[0]?.id ?? ""
    setRound(nextRound); setDate(localDateSchema.safeParse(params.get("date")).success ? params.get("date")! : ""); setSelectedSession(params.get("sessionId") ?? "")
    const nextWeek = (localDateSchema.safeParse(params.get("week")).success ? monday(params.get("week")!) : null) ?? interviewRoundWeek(data, nextRound)
    setWeek(nextWeek)
    const section = params.get("schedule") ?? "availability"
    if (scheduleSections.includes(section)) { setTab(section); if (section === "fill" || section === "review") setPanelVisited(true) }
  }, [data, round, week])
  useEffect(() => {
    const back = () => {
      const params = new URLSearchParams(window.location.search), nextRound = data?.rounds.find(r => r.id === params.get("roundId"))?.id ?? data?.rounds[0]?.id ?? round
      if (nextRound !== round && !canLeaveWorkspace()) { window.history.pushState(null, "", url(tab)); return }
      if (nextRound !== round) { setPanelVisited(false); setDraftSummary(null); setOverview(null); setAutoStart(false) }
      setRound(nextRound); setDate(localDateSchema.safeParse(params.get("date")).success ? params.get("date")! : ""); setWeek(localDateSchema.safeParse(params.get("week")).success ? monday(params.get("week")!) : data ? interviewRoundWeek(data, nextRound) : week); setSelectedSession(params.get("sessionId") ?? "")
      const section = params.get("schedule") ?? "availability"; if (scheduleSections.includes(section)) { setTab(section); if (section === "fill" || section === "review") setPanelVisited(true) }
    }
    const changed = () => setRefresh(v => v + 1)
    window.addEventListener("popstate", back); window.addEventListener("outclass:panels-changed", changed); window.addEventListener("outclass:availability-changed", changed)
    return () => { window.removeEventListener("popstate", back); window.removeEventListener("outclass:panels-changed", changed); window.removeEventListener("outclass:availability-changed", changed) }
  })
  const roundTimezone = SCHEDULING_TIMEZONE
  useEffect(() => {
    if (!round || !demo.ready || demo.isDemoEnabled) return
    let active = true
    getRoundStaffingCoverage({ clubId, roundId: round, ...(date ? { window: { start: zonedInstant(date, "00:00", roundTimezone).toISOString(), end: zonedInstant(addDays(date, 1), "00:00", roundTimezone).toISOString() } } : {}) }).then(value => { if (active) setCoverage(value) }).catch(() => { if (active) setError("Could not refresh session coverage. Retry before filling panels.") })
    return () => { active = false }
  }, [clubId, round, date, roundTimezone, refresh, demo.ready, demo.isDemoEnabled])
  const rooms = data?.rooms.filter(r => r.roundId === round && (!date || r.slots.some(s => dayKey(s.startTime, SCHEDULING_TIMEZONE) === date))) ?? []
  const bookings = data?.bookings.filter(b => rooms.some(r => r.id === b.roomId) && (!date || dayKey(b.startTime, SCHEDULING_TIMEZONE) === date)) ?? []
  const slots = rooms.flatMap(r => r.slots.filter(s => !date || dayKey(s.startTime, SCHEDULING_TIMEZONE) === date).map(s => ({ s, r })))
  const required = slots.filter(({ s, r }) => r.isOpen && +new Date(s.startTime) > Date.now()).reduce((n, { s, r }) => n + (s.interviewersNeeded ?? r.interviewersNeeded ?? 2), 0)
  const assigned = slots.filter(({ s, r }) => r.isOpen && +new Date(s.startTime) > Date.now()).reduce((n, { s, r }) => n + (s.panelScheduleVersionId ? s.publishedPanelMemberIds?.length ?? 0 : r.approvedPanelMemberIds?.length ?? 0), 0)
  const shortageIds = useMemo(() => staffingShortageSessionIds(coverage?.slots ?? []), [coverage])
  const weekShortageIds = useMemo(() => staffingShortageSessionIds(overview?.slots ?? []), [overview])
  const roundName = data?.rounds.find(r => r.id === round)?.name
  const state = draftSummary?.state ?? coverage?.state ?? (slots.some(({ s }) => s.panelScheduleVersionId) ? "Published" : "No panel draft")
  return <div className="ir-manager space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="oc-section-heading">Interview Scheduling</h2><div className="flex flex-wrap gap-3">{coverage?.myEligible && <Link href={availabilityHref(clubId, round)} className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">Set My Availability</Link>}{tab !== "availability" && <Button variant="outline" onClick={() => navigateSection("availability")}>View Team Availability</Button>}</div></header>
    {error && <div role="alert" className="text-sm text-destructive">{error} <Button variant="outline" onClick={() => setRefresh(v => v + 1)}>Retry</Button></div>}{notice && <p role="status" className="text-sm">{notice}</p>}
    {!data && loading ? <LoadingState label="Loading interview scheduling…" rows={3} /> : data && <>
      <div className="flex flex-wrap items-end gap-3"><label className="ir-field">Interview round<NativeSelect aria-label="Recruitment round" value={round} onChange={e => { if (!canLeaveWorkspace()) return; const nextWeek = interviewRoundWeek(data, e.target.value); setWeek(nextWeek); setDate(""); setRound(e.target.value); setPanelVisited(false); setAutoStart(false); setDraftSummary(null); setOverview(null); setCoverage(null); setSelectedSession(""); window.history.pushState(null, "", url(tab, e.target.value, "", nextWeek, "")) }}>{data.rounds.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</NativeSelect></label><label className="ir-field">Interview date<Input aria-label="Filter interview date" type="date" value={date} onChange={e => { setDate(e.target.value); if (e.target.value) setWeek(monday(e.target.value)); window.history.pushState(null, "", url(tab, round, e.target.value, e.target.value ? monday(e.target.value) : week)) }} /></label>{date && <Button variant="ghost" onClick={() => { setDate(""); window.history.pushState(null, "", url(tab, round, "")) }}>All dates</Button>}<span className="pb-2 text-xs font-medium text-muted-foreground">{state}</span></div>
      <div aria-label="Scheduling progress" className="flex flex-wrap gap-x-5 gap-y-2 border-y py-3 text-sm"><span>{coverage ? `${coverage.confirmed}/${coverage.eligible} availability submitted` : "Availability loading"}</span><span>{rooms.length} rooms · {slots.length} sessions</span><span>{Math.max(0, draftSummary ? draftSummary.required - draftSummary.filled : required - assigned)} positions unfilled{draftSummary?.hasDraft ? " in draft" : " officially"}</span>{overview && <span>{weekShortageIds.size} sessions need coverage this week</span>}</div>
      <nav aria-label="Scheduling workflow" className="flex flex-wrap gap-1">{[["availability", "Availability"], ["rooms", "Rooms"], ["fill", "Fill Panels"], ["review", "Review & Publish"]].map(([id, label], i) => <Button key={id} variant={tab === id ? "secondary" : "ghost"} aria-label={label} aria-current={tab === id ? "step" : undefined} onClick={() => navigateSection(id)}><span className="text-xs text-muted-foreground">{i + 1}</span>{label}</Button>)}</nav>
      {!round ? <p className="rounded-xl border border-dashed p-4 text-sm">Create an interview round in recruitment settings to begin.</p> : <>
        {data.rounds.find(r=>r.id===round)?.booking && <InterviewBookingPublication key={`${round}:${data.rounds.find(r=>r.id===round)!.booking!.bookingRevision}`} clubId={clubId} roundId={round} settings={data.rounds.find(r=>r.id===round)!.booking!} cycles={data.cycles??[]} rooms={data.rooms.filter(r=>r.roundId===round)} onChanged={()=>setRefresh(v=>v+1)} />}
        <div hidden={tab !== "availability"}><AdminAvailabilityOverview key={round} clubId={clubId} roundId={round} week={week} onWeekChange={value => { setWeek(value); window.history.pushState(null, "", url(tab, round, date, value)) }} onData={receiveOverview} onOpenSession={(_roomId, slotId) => navigateSection("rooms", false, slotId)} /><div className="mt-4 flex gap-2"><Button onClick={() => navigateSection("rooms")}>Continue to Rooms</Button></div></div>
        <div hidden={!["rooms", "bookings", "preview"].includes(tab)} className="space-y-4"><div className="flex flex-wrap justify-between gap-2"><div className="flex flex-wrap gap-1">{[["rooms", "Rooms"], ["bookings", "Bookings"], ["preview", "Applicant preview"]].map(([id, label]) => <Button key={id} variant={tab === id ? "secondary" : "ghost"} aria-pressed={tab === id} onClick={() => navigateSection(id)}>{label}</Button>)}</div><Button onClick={() => { setSource(undefined); setCreate(true) }}><Plus size={16} />Create interview room</Button></div>
          <div hidden={tab !== "rooms"}><div className="grid gap-4 lg:grid-cols-2">{rooms.map(room => <RoomCard key={room.id} room={room} workspace={data} date={date} selectedSession={selectedSession} coverage={coverage?.slots ?? []} shortageIds={shortageIds} busy={busy === room.id || loading} onAutoFill={() => navigateSection("review", !!room.slots.some(s => s.panelScheduleVersionId), room.slots.find(s => +new Date(s.startTime) > Date.now())?.id ?? "")} onStaffing={async (needed, slotId) => { setBusy(room.id); setError(""); try { const saved = await setInterviewStaffingRequirement({ clubId, roomId: room.id, slotId, needed, revision: slotId ? room.slots.find(s => s.id === slotId)?.staffingRevision ?? 0 : room.staffingRevision ?? 0 }); setData(previous => previous ? { ...previous, rooms: previous.rooms.map(current => current.id !== room.id ? current : slotId ? { ...current, slots: current.slots.map(slot => slot.id === slotId ? { ...slot, interviewersNeeded: needed, staffingRevision: saved.revision } : slot) } : { ...current, interviewersNeeded: needed!, staffingRevision: saved.revision }) } : previous); setNotice("Staffing requirement saved. Availability coverage updated; any existing proposal must be revalidated."); setRefresh(v => v + 1); window.dispatchEvent(new Event("outclass:staffing-changed")) } catch (error) { setError(error instanceof Error ? error.message : "Could not save staffing requirement.") } finally { setBusy("") } }} onCopy={() => { setSource(room); setCreate(true) }} onToggle={async () => { setBusy(room.id); try { await setInterviewRoomOpen({ roomId: room.id, open: !room.isOpen }); setRefresh(v => v + 1); window.dispatchEvent(new Event("outclass:staffing-changed")) } catch { setError("Could not update room.") } finally { setBusy("") } }} />)}</div>{!rooms.length && <div className="rounded-xl border border-dashed p-5"><h3 className="oc-card-heading">No rooms for {roundName}{date ? " on this date" : ""}</h3><p className="my-2 text-sm text-muted-foreground">Create a room with interview times, location and required interviewers.</p><Button onClick={() => { setSource(undefined); setCreate(true) }}>Create interview room</Button></div>}</div>
          {tab === "bookings" && <ul className="divide-y rounded-xl border">{bookings.map(b => <li key={b.id} className="flex flex-wrap justify-between gap-2 p-4"><span>{b.candidate} · {rooms.find(r => r.id === b.roomId)?.name}</span><span className="text-sm">{new Date(b.startTime).toLocaleDateString("en-US", { timeZone: SCHEDULING_TIMEZONE, month: "short", day: "numeric" })} · {slotTime(b.startTime, SCHEDULING_TIMEZONE)} · {SCHEDULING_TIMEZONE_LABEL}</span></li>)}{!bookings.length && <li className="p-4 text-sm text-muted-foreground">No bookings match these filters.</li>}</ul>}
          {tab === "preview" && <BookingPicker key={round} rooms={data.rooms.filter(r => r.roundId === round)} clubName={data.clubName} roundName={roundName ?? "Interview"} preview />}
          <div className="flex flex-wrap gap-2"><Button disabled={!rooms.length} onClick={() => navigateSection("review", true, "", true)}>Auto-Fill Panels</Button></div>
        </div>
        {panelVisited && <div hidden={tab !== "fill" && tab !== "review"}>{<PanelPreviewWorkspace key={round} clubId={clubId} roundId={round} autoStart={autoStart} autoRequest={autoRequest} autoFillPublished={autoFillPublished} initialWindow={date && rooms[0] ? { start: zonedInstant(date, "00:00", SCHEDULING_TIMEZONE).toISOString(), end: zonedInstant(addDays(date, 1), "00:00", SCHEDULING_TIMEZONE).toISOString() } : undefined} initialSession={selectedSession} onSummary={receiveSummary} onGenerated={proposalGenerated} onRooms={() => navigateSection("rooms")} />}</div>}
      </>}
      {create && <CreateRoomDialog clubId={clubId} workspace={{ ...data, rounds: data.rounds.filter(r => r.id === round) }} source={source} initialDate={date || undefined} onClose={() => setCreate(false)} onCreated={() => { setCreate(false); setNotice("Room created. Continue to Fill Panels when staffing is ready."); setRefresh(v => v + 1); window.dispatchEvent(new Event("outclass:staffing-changed")) }} />}
    </>}
  </div>
}
function RoomCard({room,workspace,date,coverage,shortageIds,selectedSession,busy,onCopy,onToggle,onAutoFill,onStaffing}:{room:InterviewRoom;workspace:RoomWorkspace;date:string;coverage:SessionCoverage[];shortageIds:Set<string>;selectedSession:string;busy:boolean;onCopy:()=>void;onToggle:()=>void;onAutoFill:()=>void;onStaffing:(needed:number|null,slotId?:string)=>void}){
  const [expanded,setExpanded]=useState(false)
  useEffect(()=>{if(room.slots.some(s=>s.id===selectedSession))setExpanded(true)},[room.slots,selectedSession])
  const [copied,setCopied]=useState("")
  const slots=room.slots.filter(s=>!date||dayKey(s.startTime,SCHEDULING_TIMEZONE)===date)
  const open=slots.reduce((n,s)=>n+(+new Date(s.startTime)>Date.now()&&room.isOpen?Math.max(0,s.capacity-s.booked):0),0)
  return <article className="ir-room-card"><div className="flex items-start justify-between gap-3"><div className="ir-symbol">{room.kind==="VIRTUAL"?<Video/>:<DoorOpen/>}</div><span className={`rounded-full px-3 py-1 text-xs font-medium ${room.isOpen?"bg-emerald-50 text-emerald-700":"bg-muted text-muted-foreground"}`}>{room.isOpen?"Room active":"Room inactive"}</span></div><h3 className="oc-card-heading mt-4">{room.name}</h3><p className="mt-1 flex items-start gap-2 break-all text-sm text-muted-foreground"><MapPin className="mt-0.5 size-4 shrink-0"/>{room.location}</p><p className="mt-3 text-xs text-muted-foreground">{workspace.rounds.find(r=>r.id===room.roundId)?.name} · {room.duration} min{room.buffer?` + ${room.buffer} min buffer`:""} · {open} openings</p><p className="mt-1 text-xs text-muted-foreground">{SCHEDULING_TIMEZONE_LABEL}</p><div className="mt-3 flex flex-wrap items-center gap-3"><label className="ir-field">Interviewers Needed<NativeSelect aria-label={`Interviewers needed for ${room.name}`} disabled={busy||room.slots.some(s=>!!s.panelScheduleVersionId)} value={room.interviewersNeeded??2} onChange={e=>onStaffing(Number(e.target.value))}>{[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n}</option>)}</NativeSelect></label>{room.slots.some(s=>!!s.panelScheduleVersionId)&&<p className="text-xs text-muted-foreground">Change published requirements through Edit Published Panels; official staffing stays active until approval.</p>}<p className="text-xs text-muted-foreground">{room.slots.some(s=>!!s.panelScheduleVersionId)?`${room.slots.filter(s=>!!s.panelScheduleVersionId).length} sessions with published panels`:`${room.approvedPanelMemberIds?.length??0}/${room.interviewersNeeded??2} officially assigned · ${room.panelMemberIds.length} configured`}</p><Button variant="outline" disabled={busy} onClick={onAutoFill}>{room.slots.some(s=>!!s.panelScheduleVersionId)?"Edit Published Panels":"Review Panels"}</Button></div>{room.panelMemberIds.length>0&&<p className="mt-3 text-xs"><span className="text-muted-foreground">Panel: </span>{room.panelMemberIds.map(id=>workspace.members.find(m=>m.id===id)?.name??"Former member").join(", ")}</p>}<div className="ir-room-slots">{slots.slice(0,expanded?slots.length:8).map(s=><div key={s.id} className={`${s.booked>=s.capacity?"is-full":""} ${selectedSession===s.id?"ring-2 ring-primary":""}`}><span>{new Date(s.startTime).toLocaleDateString("en-US",{timeZone:SCHEDULING_TIMEZONE,month:"short",day:"numeric"})}</span><strong>{slotTime(s.startTime,SCHEDULING_TIMEZONE)}</strong><small>{s.booked}/{s.capacity} booked · {+new Date(s.startTime)<=Date.now()?"Past session":coverage.find(c=>c.id===s.id)?`${coverage.find(c=>c.id===s.id)!.availableMemberIds.length} eligible available`:"Availability loading"} · {s.panelScheduleVersionId?s.publishedPanelMemberIds?.length??0:room.approvedPanelMemberIds?.length??0}/{s.interviewersNeeded??room.interviewersNeeded??2} staffed</small>{coverage.find(c=>c.id===s.id) && <small className="text-muted-foreground">{shortageIds.has(s.id) ? "Shared staffing shortage" : "Candidates available"}</small>}<NativeSelect density="compact" aria-label={`Interviewers needed for ${room.name} ${s.startTime}`} disabled={busy||!!s.panelScheduleVersionId} value={s.interviewersNeeded??"inherit"} onChange={e=>onStaffing(e.target.value==="inherit"?null:Number(e.target.value),s.id)}><option value="inherit">Room default ({room.interviewersNeeded??2})</option>{[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n} interviewers</option>)}</NativeSelect></div>)}</div>{slots.length>8&&<Button variant="ghost" size="sm" onClick={()=>setExpanded(!expanded)}>{expanded?"Show fewer":`Show all ${slots.length} slots`}</Button>}<div className="mt-4 flex flex-wrap justify-between gap-2 border-t pt-4"><Button variant="outline" size="sm" onClick={async()=>{try{await navigator.clipboard.writeText(`${window.location.origin}/interviews/book?clubId=${encodeURIComponent(room.clubId)}&roundId=${encodeURIComponent(room.roundId)}`);setCopied("Booking link copied.")}catch{setCopied("Could not copy. Your browser may require clipboard access.")}}}>Copy booking link</Button><Button variant="outline" size="sm" onClick={onCopy}><Copy size={14}/>Add dates</Button><Button variant="ghost" size="sm" disabled={busy} onClick={onToggle}>{busy?"Saving…":room.isOpen?"Close room":"Reopen room"}</Button></div>{copied&&<p role="status" className="mt-2 text-xs text-muted-foreground">{copied}</p>}</article>
}
