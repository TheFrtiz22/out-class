"use client"
import { userMessage } from "@/lib/user-message"
import { ActionWorkflow } from "@/components/product/action-workflow";
import { useConfirm } from "@/components/ui/confirm-dialog"
import { AvailabilityButton } from "@/components/availability/availability-button"
import { SCHEDULING_TIMEZONE, SCHEDULING_TIMEZONE_LABEL } from "@/lib/scheduling-config"
import { LoadingState } from "@/components/ui/loading-state"
import { NativeSelect } from "@/components/ui/native-select"
import { RoundSelect } from "@/components/ui/round-select"
import { DateField } from "@/components/ui/date-picker"
import { Stepper, StepperNav } from "@/components/ui/stepper"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Copy, DoorOpen, MapPin, MoreHorizontal, Plus, Video } from "@/components/icons"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { IconButton } from "@/components/ui/icon-button"
import { pluralize } from "@/lib/copy/terms"
import { Button } from "@/components/ui/button"
import { getRoomWorkspace, removeInterviewRoomTime, renameInterviewRoom, setInterviewRoomExternallyBooked, setInterviewRoomOpen, setInterviewStaffingRequirement } from "@/lib/workspace-api"
import { EditableRoomName, ExternalBookingToggle, RoomBookingLink, RoomSavedReminder } from "./room-external-booking"
import { useDemoMode } from "@/contexts/demo-context"
import { type InterviewRoom, type RoomWorkspace, dayKey, slotHasInterviewers, slotTime, zonedInstant } from "@/lib/interview-rooms"
import { InterviewBookingPublication } from "./booking-publication"
import { BookingPicker } from "./booking-picker"
import { CreateRoomDialog } from "./create-room-dialog"
import { PanelPreviewWorkspace } from "./panel-preview-workspace"
import { getRoundStaffingCoverage } from "@/lib/availability-workspace-read"
import { schedulingEntry, schedulingSections, bookingState, bookingProgress } from "@/lib/interview-scheduling-ui"
import { AdminAvailabilityOverview } from "@/components/availability/admin-overview"
import { addDays, localDateSchema, monday, today, type SessionCoverage } from "@/lib/availability"
import { staffingShortageSessionIds } from "@/lib/interview-staffing-capacity"
import { interviewRoundWeek } from "@/lib/interview-scheduling-context"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import "./scheduling.css"
import Link from "next/link"
import { useAssignedInterviewRooms } from "./interview-read-scope"
import { SchedulingOverflowMenu, SchedulingToolsProvider } from "@/components/interviews/scheduling-tools"
import { interviewEntryAction, interviewEntryHref, type InterviewRoomEntry } from "@/lib/interview-entry"


export function RoomManager({ clubId, active = true, interviewerAccess }: { clubId: string; active?: boolean; interviewerAccess?: ReactNode }) {
  const demo = useDemoMode()
  const confirm = useConfirm()
  const assignedRooms = useAssignedInterviewRooms(clubId)
  // A retained draft is never authority to reveal a workspace on re-entry.
  // Advance synchronously so no frame exposes old content before the effect.
  const activation = useRef({ active, authority: assignedRooms, version: 0 })
  if (activation.current.active !== active || activation.current.authority !== assignedRooms) activation.current = { active, authority: assignedRooms, version: activation.current.version + 1 }
  const activationVersion = activation.current.version
  const [validatedVersion, setValidatedVersion] = useState(-1)
  const validated = validatedVersion === activationVersion
  const restoredActivation = useRef(-1)
  const [ownEntries, setOwnEntries] = useState<InterviewRoomEntry[]>([])

  const [data, setData] = useState<RoomWorkspace | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true), [refresh, setRefresh] = useState(0)
  const [tab, setTab] = useState("rooms"), [round, setRound] = useState(""), [date, setDate] = useState(""), [week, setWeek] = useState(() => monday(today(SCHEDULING_TIMEZONE)))
  const [create, setCreate] = useState(false), [source, setSource] = useState<InterviewRoom>(), [busy, setBusy] = useState(""), [notice, setNotice] = useState(""), [roomReminder, setRoomReminder] = useState(false)
  const [panelVisited, setPanelVisited] = useState(false), [autoStart, setAutoStart] = useState(false), [autoRequest, setAutoRequest] = useState(0), [autoFillPublished, setAutoFillPublished] = useState(false), [selectedSession, setSelectedSession] = useState("")
  const [coverage, setCoverage] = useState<Awaited<ReturnType<typeof getRoundStaffingCoverage>> | null>(null), [bookingSettingsOpen, setBookingSettingsOpen] = useState(false)
  useEffect(() => { const changed = () => setRefresh(v => v + 1); window.addEventListener("outclass:interview-rounds-changed", changed); return () => window.removeEventListener("outclass:interview-rounds-changed", changed); }, []);
  const proposalGenerated = useCallback(() => { setTab("review"); const next = new URL(window.location.href); next.searchParams.set("schedule", "review"); window.history.replaceState(null, "", next.pathname + next.search) }, [])
  function url(section: string, roundId = round, filterDate = date, selectedWeek = week, sessionId = selectedSession) {
    const next = new URL(window.location.href)
    next.searchParams.set("schedule", section); next.searchParams.set("roundId", roundId)
    for (const [key, value] of [["date", filterDate], ["week", selectedWeek], ["sessionId", sessionId]]) { if (value) next.searchParams.set(key, value); else next.searchParams.delete(key) }
    return next.pathname + next.search
  }
  function navigateSection(section: string, auto = false, sessionId = selectedSession, fillPublished = false) {
    // Internal sections retain the same mounted draft; only changing round leaves it.
    setTab(section); setSelectedSession(sessionId); setNotice("")
    if (section === "fill" || section === "review") { setPanelVisited(true); if (auto) { setAutoFillPublished(fillPublished); setAutoStart(true); setAutoRequest(v => v + 1) } }
    window.history.pushState(null, "", url(section, round, date, week, sessionId))
  }
  useEffect(() => {
    if (!demo.ready || !active) return
    let current = true
    setLoading(true); setError("")
    getRoomWorkspace(clubId).then(value => { if (current) { setValidatedVersion(activationVersion); setData({ ...value, rounds: value.rounds.filter(r => r.type === "INTERVIEW" || r.type === "GROUP_INTERVIEW" || value.rooms.some(room => room.roundId === r.id)) }); setError("") } }).catch(() => { if (current) { setValidatedVersion(-1); setError("Could not load interview scheduling. Check your current access and retry.") } }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [clubId, refresh, demo.ready, active, activationVersion])
  useEffect(() => {
    if (!data || round) return
    const params = new URLSearchParams(window.location.search)
    const nextRound = data.rounds.find(r => r.id === params.get("roundId"))?.id ?? data.rounds[0]?.id ?? ""
    setRound(nextRound); setDate(localDateSchema.safeParse(params.get("date")).success ? params.get("date")! : ""); setSelectedSession(params.get("sessionId") ?? "")
    const nextWeek = (localDateSchema.safeParse(params.get("week")).success ? monday(params.get("week")!) : null) ?? interviewRoundWeek(data, nextRound)
    setWeek(nextWeek)
    const section = schedulingEntry(data, nextRound, params.get("schedule"))
    if (schedulingSections.includes(section as typeof schedulingSections[number])) { setTab(section); if (section === "fill" || section === "review") setPanelVisited(true) }
  }, [data, round, week])
  useEffect(() => {
    const back = () => {
      const params = new URLSearchParams(window.location.search)
      if (!active || params.get("interviewTab") && !["schedule", "availability"].includes(params.get("interviewTab")!)) return
      const nextRound = data?.rounds.find(r => r.id === params.get("roundId"))?.id ?? data?.rounds[0]?.id ?? round
      if (nextRound !== round && !canLeaveWorkspace()) { window.history.pushState(null, "", url(tab)); return }
      if (nextRound !== round) { setPanelVisited(false); setAutoStart(false) }
      setRound(nextRound); setDate(localDateSchema.safeParse(params.get("date")).success ? params.get("date")! : ""); setWeek(localDateSchema.safeParse(params.get("week")).success ? monday(params.get("week")!) : data ? interviewRoundWeek(data, nextRound) : week); setSelectedSession(params.get("sessionId") ?? "")
      const section = data ? schedulingEntry(data, nextRound, params.get("schedule")) : "rooms"; if (schedulingSections.includes(section as typeof schedulingSections[number])) { setTab(section); if (section === "fill" || section === "review") setPanelVisited(true) }
    }
    if (active && validated && restoredActivation.current !== activationVersion) { restoredActivation.current = activationVersion; back() }
    const changed = () => setRefresh(v => v + 1)
    window.addEventListener("popstate", back); window.addEventListener("outclass:panels-changed", changed); window.addEventListener("outclass:availability-changed", changed)
    return () => { window.removeEventListener("popstate", back); window.removeEventListener("outclass:panels-changed", changed); window.removeEventListener("outclass:availability-changed", changed) }
  })
  useEffect(() => {
    if (!demo.ready) return
    let current = true
    assignedRooms().then(rows => { if (current) setOwnEntries(rows) }).catch(() => { if (current) setOwnEntries([]) })
    return () => { current = false }
  }, [clubId, demo.ready, refresh, assignedRooms])
  const roundTimezone = SCHEDULING_TIMEZONE
  useEffect(() => {
    if (!round || !demo.ready || demo.isDemoEnabled) return
    let active = true
    getRoundStaffingCoverage({ clubId, roundId: round, ...(date ? { window: { start: zonedInstant(date, "00:00", roundTimezone).toISOString(), end: zonedInstant(addDays(date, 1), "00:00", roundTimezone).toISOString() } } : {}) }).then(value => { if (active) setCoverage(value) }).catch(() => { if (active) setError("Could not refresh session coverage. Retry before filling panels.") })
    return () => { active = false }
  }, [clubId, round, date, roundTimezone, refresh, demo.ready, demo.isDemoEnabled])
  const rooms = data?.rooms.filter(r => r.roundId === round && (!date || r.slots.some(s => dayKey(s.startTime, SCHEDULING_TIMEZONE) === date))) ?? []
  const bookings = data?.bookings.filter(b => rooms.some(r => r.id === b.roomId) && (!date || dayKey(b.startTime, SCHEDULING_TIMEZONE) === date)) ?? []
  const shortageIds = useMemo(() => staffingShortageSessionIds(coverage?.slots ?? []), [coverage])
  const roundName = data?.rounds.find(r => r.id === round)?.name
  // The four ordered steps; "fill" is the auto-fill pass of Confirm interviewers.
  const step = tab === "fill" ? "review" : tab, stepIndex = schedulingSteps.findIndex(item => item.id === step)
  // A step shows a check only when it is actually done for this round, whichever step is open.
  const roundBooking = data?.rounds.find(r => r.id === round)?.booking
  const upcoming = (data?.rooms.filter(r => r.roundId === round) ?? []).flatMap(room => room.slots.filter(slot => +new Date(slot.startTime) > Date.now()).map(slot => ({ room, slot })))
  const assigned = upcoming.filter(({ room, slot }) => slotHasInterviewers(slot, room)).length
  const stepDone: Record<string, boolean> = { availability: false, rooms: upcoming.length > 0, review: upcoming.length > 0 && assigned === upcoming.length, publish: !!roundBooking?.bookingPublishedAt && !roundBooking.bookingPaused }
  async function removeTime(roomId: string, slotId: string) {
    if (!(await confirm({ title: "Remove this time?", description: "It hasn't been booked.", confirmLabel: "Remove time", tone: "danger" }))) return
    setBusy(roomId); setError(""); setNotice("")
    try {
      await removeInterviewRoomTime({ clubId, roomId, slotId })
      setData(previous => previous ? { ...previous, rooms: previous.rooms.map(current => current.id === roomId ? { ...current, slots: current.slots.filter(slot => slot.id !== slotId) } : current) } : previous)
      setNotice("Time removed."); setRefresh(v => v + 1); window.dispatchEvent(new Event("outclass:staffing-changed"))
    } catch (error) { setError(userMessage(error, "Could not remove this time.")) } finally { setBusy("") }
  }
  // One rename path for the room card, the Manage room sheet and the bookings list.
  async function renameRoom(roomId: string, name: string) {
    await renameInterviewRoom({ clubId, roomId, name })
    setData(previous => previous ? { ...previous, rooms: previous.rooms.map(current => current.id === roomId ? { ...current, name } : current) } : previous)
    window.dispatchEvent(new Event("outclass:interview-room-renamed"))
  }
  // Optimistic: the box, check mark and amber tag flip on click; a failed save restores the previous state.
  async function markExternallyBooked(roomId: string, previousValue: string | null, booked: boolean) {
    const setValue = (externallyBookedAt: string | null) => setData(previous => previous ? { ...previous, rooms: previous.rooms.map(current => current.id === roomId ? { ...current, externallyBookedAt } : current) } : previous)
    setBusy(roomId); setError(""); setValue(booked ? previousValue ?? new Date().toISOString() : null)
    try { setValue((await setInterviewRoomExternallyBooked({ clubId, roomId, booked })).externallyBookedAt) }
    catch (error) { setValue(previousValue); setError(userMessage(error, "Could not update 25Live status.")) }
    finally { setBusy("") }
  }
  return <SchedulingToolsProvider>
    {active && !validated && (error ? <div role="alert">{error} <Button variant="outline" onClick={() => setRefresh(v => v + 1)}>Retry</Button></div> : <LoadingState label="Loading interview scheduling…" layout="calendar" calendarView="week" rows={3} />)}
    <div hidden={!active || !validated}><div className="ir-manager space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="oc-section-heading">Interview schedule</h2><div className="flex flex-wrap items-center gap-2">{coverage?.myEligible && <AvailabilityButton clubId={clubId} roundId={round} />}<SchedulingOverflowMenu items={[{ id: "preview", label: "Applicant preview", onSelect: () => navigateSection("preview") }, { id: "booking", label: "Booking settings", disabled: !roundBooking, onSelect: () => setBookingSettingsOpen(true) }]} /></div></header>
    {validated && error && <div role="alert" className="text-sm text-destructive">{error} <Button variant="outline" onClick={() => setRefresh(v => v + 1)}>Retry</Button></div>}{notice && <p role="status" className="text-sm">{notice}</p>}{roomReminder && <RoomSavedReminder onDismiss={() => setRoomReminder(false)} />}
    {!data && loading ? <LoadingState label="Loading interview scheduling…" layout="calendar" calendarView="week" rows={3} /> : data && <>
      <div className="flex flex-wrap items-end gap-3"><RoundSelect label="Recruitment round" includeAll={false} value={round} onChange={value => { if (!canLeaveWorkspace()) return; const nextWeek = interviewRoundWeek(data, value); setWeek(nextWeek); setDate(""); setRound(value); setPanelVisited(false); setAutoStart(false); setCoverage(null); setSelectedSession(""); const nextSection = schedulingEntry(data,value); setTab(nextSection); if (nextSection === "review") setPanelVisited(true); window.history.pushState(null, "", url(nextSection, value, "", nextWeek, "")) }} rounds={data.rounds} /><div className="oc-filter-field"><span className="oc-filter-field-label">Interview date</span><DateField label="Filter interview date" value={date} placeholder="All dates" clearLabel="All dates" onChange={value => { setDate(value); if (value) setWeek(monday(value)); window.history.pushState(null, "", url(tab, round, value, value ? monday(value) : week)) }} /></div></div>
      {tab !== "bookings" && <Stepper label="Scheduling workflow" current={step} onSelect={navigateSection} steps={schedulingSteps.map(item => ({ ...item, complete: stepDone[item.id] }))} />}
      {!round ? <p className="rounded-xl border border-dashed p-4 text-sm">Create an interview round in recruitment settings to begin.</p> : <>
        <div hidden={tab !== "publish"}>{data.rounds.find(r=>r.id===round)?.booking && <InterviewBookingPublication key={`${round}:${data.rounds.find(r=>r.id===round)!.booking!.bookingRevision}`} clubId={clubId} roundId={round} settings={data.rounds.find(r=>r.id===round)!.booking!} cycles={data.cycles??[]} rooms={data.rooms.filter(r=>r.roundId===round)} onChanged={()=>setRefresh(v=>v+1)} onPublished={() => navigateSection("bookings")} onFixSlot={slotId => navigateSection("review", true, slotId)} onTimes={() => navigateSection("rooms")} settingsOpen={bookingSettingsOpen} onSettingsOpenChange={setBookingSettingsOpen} />}</div>
        <div hidden={tab !== "availability"}><AdminAvailabilityOverview key={round} clubId={clubId} roundId={round} week={week} onWeekChange={value => { setWeek(value); window.history.pushState(null, "", url(tab, round, date, value)) }} onOpenSession={(_roomId, slotId) => navigateSection("review", true, slotId)} /></div>
        <div hidden={!["rooms", "bookings", "preview"].includes(tab)} className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-base font-medium">{tab === "bookings" ? "Bookings" : tab === "preview" ? "Applicant preview" : "Rooms and time slots"}</h3>{tab === "rooms" ? <Button variant={rooms.length ? "outline" : "default"} onClick={() => { setSource(undefined); setCreate(true) }}><Plus size={16}/>Add interview times</Button> : tab === "bookings" && <div className="flex items-center gap-3"><span className="text-sm text-muted-foreground">{data.rounds.find(r=>r.id===round)?.booking ? bookingState(data.rounds.find(r=>r.id===round)!.booking!,rooms) : "Draft"}</span><Button variant="outline" onClick={() => navigateSection("review")}>Edit schedule</Button></div>}</div>
          <div hidden={tab !== "rooms"}><div className="grid gap-4 lg:grid-cols-2">{rooms.map(room => <RoomCard key={room.id} room={room} workspace={data} date={date} selectedSession={selectedSession} coverage={coverage?.slots ?? []} shortageIds={shortageIds} busy={busy === room.id || loading} onAutoFill={() => navigateSection("review", !!room.slots.some(s => s.panelScheduleVersionId), room.slots.find(s => +new Date(s.startTime) > Date.now())?.id ?? "")} onStaffing={async (needed, slotId) => { setBusy(room.id); setError(""); try { const saved = await setInterviewStaffingRequirement({ clubId, roomId: room.id, slotId, needed, revision: slotId ? room.slots.find(s => s.id === slotId)?.staffingRevision ?? 0 : room.staffingRevision ?? 0 }); setData(previous => previous ? { ...previous, rooms: previous.rooms.map(current => current.id !== room.id ? current : slotId ? { ...current, slots: current.slots.map(slot => slot.id === slotId ? { ...slot, interviewersNeeded: needed, staffingRevision: saved.revision } : slot) } : { ...current, interviewersNeeded: needed!, staffingRevision: saved.revision }) } : previous); setNotice("Saved. Check this room again under Confirm interviewers."); setRefresh(v => v + 1); window.dispatchEvent(new Event("outclass:staffing-changed")) } catch (error) { setError(userMessage(error, "Could not save staffing requirement.")) } finally { setBusy("") } }} onRename={name => renameRoom(room.id, name)} onRemoveTime={slotId => removeTime(room.id, slotId)} onExternalBooked={booked => markExternallyBooked(room.id, room.externallyBookedAt ?? null, booked)} onCopy={() => { setSource(room); setCreate(true) }} onToggle={async () => { if (room.isOpen && !(await confirm({ title: "Stop new bookings for this room?", description: "Confirmed reservations keep their time and location.", confirmLabel: "Stop bookings" }))) return; setBusy(room.id); try { const saved = await setInterviewRoomOpen({ roomId: room.id, open: !room.isOpen }); if (saved?.noLongerOffered) setNotice(offeredNotice(saved.noLongerOffered)); setRefresh(v => v + 1); window.dispatchEvent(new Event("outclass:staffing-changed")) } catch { setError("Could not update room.") } finally { setBusy("") } }} />)}</div>{!rooms.length && <div className="rounded-xl border border-dashed p-5"><h3 className="oc-card-heading">No rooms for {roundName}{date ? " on this date" : ""}</h3><p className="my-2 text-sm text-muted-foreground">Add a room and its time slots. You assign interviewers in the next step.</p></div>}</div>
          {tab === "bookings" && (progress => progress ? <p className="text-sm text-muted-foreground">{bookingProgress(progress)}</p> : null)(data.rounds.find(r => r.id === round)?.progress)}
          {tab === "bookings" && <ul className="divide-y rounded-xl border">{bookings.map(b => <li key={b.id} className="flex flex-wrap justify-between gap-2 p-4"><span className="inline-flex min-w-0 flex-wrap items-center gap-x-1">{b.candidate} ·{(room => room ? <EditableRoomName room={room} disabled={busy === room.id} onRename={name => renameRoom(room.id, name)} className="" /> : null)(rooms.find(r => r.id === b.roomId))}</span>{ownEntries.filter(row => row.bookingId === b.id && row.canOpen).map(row => <Link key={row.id} className="inline-flex min-h-10 items-center text-sm underline" href={interviewEntryHref(row, typeof window === "undefined" ? undefined : window.location.href)}>{interviewEntryAction(row)}</Link>)}<span className="text-sm">{new Date(b.startTime).toLocaleDateString("en-US", { timeZone: SCHEDULING_TIMEZONE, month: "short", day: "numeric" })} · {slotTime(b.startTime, SCHEDULING_TIMEZONE)} · {SCHEDULING_TIMEZONE_LABEL}</span></li>)}{!bookings.length && <li className="p-4 text-sm text-muted-foreground">{date ? "No interviews on this date." : data.rounds.find(r => r.id === round)?.booking?.bookingPublishedAt ? "No one has booked yet. Invited applicants get a notice to pick a time." : "Bookings show here once you publish the schedule."}</li>}</ul>}
          {tab === "preview" && <BookingPicker key={round} rooms={data.rooms.filter(r => r.roundId === round)} clubName={data.clubName} roundName={roundName ?? "Interview"} preview />}
        </div>
        {panelVisited && <div hidden={tab !== "fill" && tab !== "review"}>{<PanelPreviewWorkspace key={round} visible={tab === "fill" || tab === "review"} clubId={clubId} roundId={round} bookingSettings={data.rounds.find(r => r.id === round)?.booking} autoStart={autoStart} autoRequest={autoRequest} autoFillPublished={autoFillPublished} initialWindow={date && rooms[0] ? { start: zonedInstant(date, "00:00", SCHEDULING_TIMEZONE).toISOString(), end: zonedInstant(addDays(date, 1), "00:00", SCHEDULING_TIMEZONE).toISOString() } : undefined} initialSession={selectedSession} initialDate={date || undefined} onGenerated={proposalGenerated} onRooms={() => navigateSection("rooms")} onApproved={() => navigateSection("publish")} />}</div>}
        {interviewerAccess && <details hidden={tab !== "fill" && tab !== "review"} className="border-t pt-2"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Interviewer access and question editors</summary>{interviewerAccess}</details>}
        {stepIndex >= 0 && <StepperNav onBack={stepIndex > 0 ? () => navigateSection(schedulingSteps[stepIndex - 1].id) : undefined} backLabel={stepIndex > 0 ? `Back: ${schedulingSteps[stepIndex - 1].label}` : undefined}
          onNext={stepIndex < schedulingSteps.length - 1 ? () => navigateSection(schedulingSteps[stepIndex + 1].id) : undefined} nextLabel={stepIndex < schedulingSteps.length - 1 ? `Next: ${schedulingSteps[stepIndex + 1].label}` : undefined}
          nextDisabled={step === "rooms" && !upcoming.length || step === "review" && !assigned} />}
      </>}
      {create && <CreateRoomDialog clubId={clubId} workspace={{ ...data, rounds: data.rounds.filter(r => r.id === round) }} source={source} initialDate={date || undefined} onClose={() => setCreate(false)} onCreated={(_created, noLongerOffered) => { setCreate(false); setNotice(`Interview times saved.${noLongerOffered ? ` ${offeredNotice(noLongerOffered)}` : ""}`); navigateSection("review"); setRoomReminder(true); setRefresh(v => v + 1); window.dispatchEvent(new Event("outclass:staffing-changed")) }} />}
    </>}
  </div></div></SchedulingToolsProvider>
}
/** Retiring an outdated room approval can take published times out of booking. */
function offeredNotice(count: number) { return `${count} ${count === 1 ? "time slot is" : "time slots are"} no longer offered until interviewers are confirmed.` }
const schedulingSteps = [{ id: "availability", label: "Availability" }, { id: "rooms", label: "Set interview times" }, { id: "review", label: "Confirm interviewers" }, { id: "publish", label: "Publish schedule" }]

type RoomProps = { room: InterviewRoom; workspace: RoomWorkspace; date: string; coverage: SessionCoverage[]; shortageIds: Set<string>; selectedSession: string; busy: boolean; onCopy: () => void; onToggle: () => void; onAutoFill: () => void; onStaffing: (needed: number | null, slotId?: string) => void; onRename: (name: string) => Promise<void>; onRemoveTime: (slotId: string) => void }
const slotDay = (value: string) => new Date(value).toLocaleDateString("en-US", { timeZone: SCHEDULING_TIMEZONE, month: "short", day: "numeric" })
const hasConfirmed = (room: InterviewRoom) => room.slots.some(s => !!s.panelScheduleVersionId)

/** The Manage room sheet: this room's time slots and settings. Interviewers are assigned in one place, Confirm interviewers. */
function RoomOptions({ room, date, coverage, shortageIds, selectedSession, busy, onCopy, onToggle, onStaffing, onRename, onRemoveTime }: RoomProps) {
  const [expanded, setExpanded] = useState(false), [copied, setCopied] = useState("")
  // The per-slot number stays out of the way unless a time slot already differs from the room.
  const [perSlot, setPerSlot] = useState(() => room.slots.some(s => s.interviewersNeeded != null))
  useEffect(() => { if (room.slots.some(s => s.id === selectedSession)) setExpanded(true) }, [room.slots, selectedSession])
  const slots = room.slots.filter(s => !date || dayKey(s.startTime, SCHEDULING_TIMEZONE) === date)
  const places = slots.reduce((n, s) => n + (+new Date(s.startTime) > Date.now() && room.isOpen ? Math.max(0, s.capacity - s.booked) : 0), 0)
  const confirmed = hasConfirmed(room), needed = room.interviewersNeeded ?? 2
  return <article className="ir-room-card">
    <div className="flex items-start justify-between gap-3"><div className="ir-symbol">{room.kind === "VIRTUAL" ? <Video /> : <DoorOpen />}</div><span className={`oc-status-label px-3 py-1 text-xs font-medium ${room.isOpen ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{room.isOpen ? "Open for booking" : "Bookings stopped"}</span></div>
    <h3 className="oc-card-heading mt-4"><EditableRoomName room={room} disabled={busy} onRename={onRename} className="" /></h3>
    {room.location !== room.name && <p className="mt-1 flex items-start gap-2 break-all text-sm text-muted-foreground"><MapPin className="mt-0.5 size-4 shrink-0" />{room.location}</p>}
    <p className="mt-3 text-xs text-muted-foreground">{room.duration} min{room.buffer ? ` + ${room.buffer} min buffer` : ""} · {pluralize(places, "open place")} · {SCHEDULING_TIMEZONE_LABEL}</p>
    <div className="mt-3 flex flex-wrap items-end gap-3"><label className="ir-field">Interviewers per time slot<NativeSelect aria-label={`Interviewers per time slot for ${room.name}`} disabled={busy || confirmed} value={needed} onChange={e => onStaffing(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}</option>)}</NativeSelect></label>{!confirmed && !perSlot && <Button variant="ghost" size="sm" onClick={() => setPerSlot(true)}>Different for one time slot</Button>}</div>
    {confirmed && <p className="mt-2 text-xs text-muted-foreground">Interviewers are confirmed for this room. Change the number under Confirm interviewers.</p>}
    <div className="ir-room-slots">{slots.slice(0, expanded ? slots.length : 8).map(s => { const available = coverage.find(c => c.id === s.id), past = +new Date(s.startTime) <= Date.now(); return <div key={s.id} className={`${s.booked >= s.capacity ? "is-full" : ""} ${selectedSession === s.id ? "ring-2 ring-primary" : ""}`}>
      <span>{slotDay(s.startTime)}</span><strong>{slotTime(s.startTime, SCHEDULING_TIMEZONE)}</strong>
      <small>{s.booked}/{s.capacity} booked · {s.panelScheduleVersionId ? s.publishedPanelMemberIds?.length ?? 0 : room.approvedPanelMemberIds?.length ?? 0} of {s.interviewersNeeded ?? needed} interviewers{past ? " · Past" : available ? ` · ${available.availableMemberIds.length} available` : ""}</small>
      {!past && available && shortageIds.has(s.id) && <small className="text-muted-foreground">Not enough interviewers available</small>}
      {perSlot && !s.panelScheduleVersionId && <NativeSelect density="compact" aria-label={`Interviewers for ${slotDay(s.startTime)} ${slotTime(s.startTime, SCHEDULING_TIMEZONE)}`} disabled={busy} value={s.interviewersNeeded ?? "inherit"} onChange={e => onStaffing(e.target.value === "inherit" ? null : Number(e.target.value), s.id)}><option value="inherit">Same as room ({needed})</option>{[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n} interviewers</option>)}</NativeSelect>}
      {s.booked === 0 && !slotHasInterviewers(s, room) && <Button variant="ghost" size="sm" disabled={busy} aria-label={`Remove time ${slotTime(s.startTime, SCHEDULING_TIMEZONE)} ${slotDay(s.startTime)}`} onClick={() => onRemoveTime(s.id)}>Remove</Button>}
    </div> })}</div>
    {slots.length > 8 && <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>{expanded ? "Show fewer" : `Show all ${slots.length} time slots`}</Button>}
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4"><Button variant="outline" size="sm" onClick={onCopy}><Copy size={14} />Add dates</Button><Button variant="outline" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/interviews/book?clubId=${encodeURIComponent(room.clubId)}&roundId=${encodeURIComponent(room.roundId)}`); setCopied("Booking link copied.") } catch { setCopied("Could not copy. Your browser may require clipboard access.") } }}>Copy booking link</Button>
      <DropdownMenu><DropdownMenuTrigger asChild><IconButton variant="outline" className="ml-auto" aria-label={`More actions for ${room.name}`} disabled={busy}><MoreHorizontal aria-hidden="true" /></IconButton></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem className="min-h-11" disabled={busy} onSelect={onToggle}>{room.isOpen ? "Stop bookings" : "Reopen bookings"}</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
    {copied && <p role="status" className="mt-2 text-xs text-muted-foreground">{copied}</p>}
  </article>
}

/** One room: where it is, its time slots and who interviews there. */
function RoomCard({ onExternalBooked, ...props }: RoomProps & { onExternalBooked: (booked: boolean) => void }) {
  const { room, workspace } = props
  const [manage, setManage] = useState(false)
  const confirmed = hasConfirmed(room)
  const ids = confirmed ? [...new Set(room.slots.flatMap(s => s.publishedPanelMemberIds ?? []))] : room.panelMemberIds
  const names = ids.map(id => workspace.members.find(m => m.id === id)?.name ?? "Former member")
  return <article className="rounded-lg border px-4 py-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="min-w-0 text-sm font-medium"><EditableRoomName room={room} disabled={props.busy} onRename={props.onRename} /></h4><span className="text-xs text-muted-foreground">{pluralize(room.slots.length, "time slot")} · {room.duration} min{room.isOpen ? "" : " · Bookings stopped"}</span></div>
    {room.location !== room.name && <p className="mt-1 break-words text-sm text-muted-foreground">{room.location}</p>}
    <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm"><span className="text-muted-foreground">Interviewers:</span><span className="min-w-0 break-words">{names.length ? `${names.join(", ")}${confirmed || room.approvedPanelMemberIds?.length ? "" : " · not confirmed yet"}` : `None yet · ${room.interviewersNeeded ?? 2} needed per time slot`}</span><Button variant="link" size="sm" className="h-auto min-h-9 p-0" disabled={props.busy} onClick={props.onAutoFill} aria-label={`${names.length ? "Edit" : "Assign"} interviewers for ${room.name}`}>{names.length ? "Edit" : "Assign"}</Button></p>
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1"><ExternalBookingToggle room={room} disabled={props.busy} onChange={onExternalBooked} />{!room.externallyBookedAt && <RoomBookingLink />}</div>
    <div className="mt-3"><ActionWorkflow title="Manage room" description="Time slots and settings for this room." trigger="Manage room" presentation="sheet" open={manage} onOpenChange={setManage}><RoomOptions {...props} /></ActionWorkflow></div>
  </article>
}
