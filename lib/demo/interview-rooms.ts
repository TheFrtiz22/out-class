import { syncDemoBookingPanel } from "./interview-access-setup";
import { demoBookingSettings, demoBookingCoverage, demoBookingNotice } from "./interview-booking";
import { hasPermission } from "@/lib/permissions";
import { demoStore, demoMember } from "./store"
import { roomInputSchema, roomSlots, overlaps, isPublishedBookingSlot, type RoomInput, type RoomWorkspace, type ApplicantSchedule } from "@/lib/interview-rooms"
// Snapshot hydration revives dates; match the production DTO's ISO strings at this boundary.
function presentBooking(booking: import("@/lib/interview-rooms").RoomBooking) {
  return { ...booking, startTime: new Date(booking.startTime).toISOString(), endTime: new Date(booking.endTime).toISOString() }
}
function presentSlot(slot: import("@/lib/interview-rooms").RoomSlot) {
  return { ...slot, startTime: new Date(slot.startTime).toISOString(), endTime: new Date(slot.endTime).toISOString() }
}
function manager(clubId: string) {
  const s = demoStore.get()
  if (s.perspective.role !== "leader" || clubId !== s.clubs[0].id) throw new Error("Choose the MII manager workspace.")
  return s
}
export async function getRoomWorkspace(clubId: string): Promise<RoomWorkspace> {
  const s = manager(clubId), club = s.clubs.find(c => c.id === clubId)!
  const bookings = (s.roomBookings ?? []).filter(b => (s.interviewRooms ?? []).some(r => r.id === b.roomId && r.clubId === clubId))
  return { clubName: club.name, cycles: [], rounds: club.rounds.map(r => ({ id: r.id, name: r.name, type: r.type, configuration: r.configuration, booking: demoBookingSettings(r.id) })), members: s.memberships.filter(m => m.clubId === clubId).map(m => { const u = s.students.find(u => u.id === m.userId)!; return { id: m.id, name: `${u.profile.firstName} ${u.profile.lastName}` } }), rooms: (s.interviewRooms ?? []).filter(r => r.clubId === clubId).map(r => ({ ...r, slots: r.slots.map(slot => ({ ...presentSlot(slot), booked: bookings.filter(b => b.slotId === slot.id).length })) })), bookings: bookings.map(b => {
    const app = s.applications.find(a => a.id === b.applicationId && a.clubId === clubId);
    const historical = club.rounds.find(r => r.id === b.roundId), current = club.rounds.find(r => r.id === app?.roundId);
    const identified = hasPermission(demoMember(), "applicants.identify") && historical?.anonymousReview === false && current?.anonymousReview === false;
    return { ...presentBooking(b), candidate: identified ? b.candidate : `Applicant ${b.applicationId.slice(-6)}` };
  }) }
}
export async function createInterviewRoom(raw: RoomInput) {
  const input = roomInputSchema.parse(raw), s = manager(input.clubId)
  const slots = roomSlots(input)
  if (!s.clubs[0].rounds.some(r => r.id === input.roundId)) throw new Error("Choose a round from this club.")
  if (input.panelMemberIds.some(id => !s.memberships.some(m => m.id === id && m.clubId === input.clubId))) throw new Error("Choose interviewers from this club.")
  if ((s.interviewRooms ?? []).some(r => r.clubId === input.clubId && (r.isOpen || s.roomBookings?.some(b => b.roomId === r.id)) && (r.name.toLowerCase() === input.name.toLowerCase() || r.location.toLowerCase() === input.location.toLowerCase() || r.panelMemberIds.some(id => input.panelMemberIds.includes(id))) && r.slots.some(a => slots.some(b => overlaps(a, b, Math.max(r.buffer, input.buffer)))))) throw new Error("This room or panel already has an overlapping schedule.")
  const id = crypto.randomUUID()
  demoStore.mutate(s => { s.interviewRooms ??= []; s.roomBookings ??= []; s.interviewRooms.push({ ...input, id, isOpen: true, slots: slots.map(slot => ({ ...slot, id: crypto.randomUUID(), startTime: slot.startTime.toISOString(), endTime: slot.endTime.toISOString(), booked: 0 })) }) })
  return { id, count: slots.length }
}
export async function setInterviewRoomOpen({ roomId, open }: { roomId: string; open: boolean }) {
  const room = demoStore.get().interviewRooms?.find(r => r.id === roomId)
  if (!room) throw new Error("Room not found.")
  const s = manager(room.clubId)
  if (open && s.interviewRooms.some(r => r.id !== roomId && (r.isOpen || s.roomBookings?.some(b => b.roomId === r.id)) && (r.location.toLowerCase() === room.location.toLowerCase() || r.name.toLowerCase() === room.name.toLowerCase() || r.panelMemberIds.some(id => room.panelMemberIds.includes(id))) && r.slots.some(a => room.slots.some(b => overlaps(a, b, Math.max(r.buffer, room.buffer)))))) throw new Error("Another room now overlaps this schedule.")
  demoStore.mutate(s => { const r=s.interviewRooms.find(r => r.id === roomId)!;r.isOpen = open;if(!open){r.approvedPanelMemberIds=[];r.panelApprovedBy=null;r.panelApprovalRevision=(r.panelApprovalRevision||0)+1;} })
  for(const b of demoStore.get().roomBookings.filter(b=>b.roomId===roomId))syncDemoBookingPanel(b.applicationId,b.roundId);
}
function ownApplication(id: string) {
  const s = demoStore.get(), app = s.applications.find(a => a.id === id && a.studentId === s.students[0].id)
  if (!app || app.status !== "INTERVIEWING") throw new Error("An interview invitation is required to book a time.")
  return app
}
export async function getApplicantSchedule(applicationId: string): Promise<ApplicantSchedule> {
  const app = ownApplication(applicationId), s = demoStore.get(), club = s.clubs.find(c => c.id === app.clubId)!, settings = demoBookingSettings(app.roundId)
  const booking = s.roomBookings.find(b => b.applicationId === app.id && b.roundId === app.roundId)
  const publicationState = !settings.bookingPublishedAt ? "NOT_PUBLISHED" as const : settings.bookingPaused ? "PAUSED" as const : "PUBLISHED" as const
  const available = new Set(publicationState === "PUBLISHED" ? demoBookingCoverage(app.clubId, app.roundId, app.studentId).filter(row=>row.bookable).map(row=>row.slotId) : [])
  const rooms = s.interviewRooms.filter(r=>r.clubId===app.clubId&&r.roundId===app.roundId&&r.isOpen).map(r=>({ id:r.id,clubId:r.clubId,roundId:r.roundId,name:r.name,location:r.location,kind:r.kind,timezone:r.timezone,duration:r.duration,buffer:r.buffer,isOpen:r.isOpen,panelMemberIds:[],slots:r.slots.filter(slot=>available.has(slot.id)&&isPublishedBookingSlot(s.bookingFlow.publishedSlots[app.roundId],slot,r)).map(slot=>({id:slot.id,startTime:new Date(slot.startTime).toISOString(),endTime:new Date(slot.endTime).toISOString(),capacity:slot.capacity,booked:s.roomBookings.filter(b=>b.slotId===slot.id).length})) })).filter(r=>r.slots.length)
  return { applicationId, clubName:club.name,roundName:club.rounds.find(r=>r.id===app.roundId)!.name,publicationState,allowCancellation:settings.bookingAllowCancellation,allowRescheduling:settings.bookingAllowRescheduling,booking:booking?presentBooking(booking):null,rooms }
}
export async function reserveInterview({ applicationId, slotId }: { applicationId: string; slotId: string }) {
  const app = ownApplication(applicationId), s = demoStore.get(), room = s.interviewRooms?.find(r => r.slots.some(slot => slot.id === slotId)), slot = room?.slots.find(slot => slot.id === slotId)
  if (!room || !slot || room.clubId !== app.clubId || room.roundId !== app.roundId) throw new Error("Choose a slot from your invited round.")
  const existing = s.roomBookings?.find(b => b.applicationId === app.id && b.roundId === app.roundId)
  if (existing?.slotId === slotId) { syncDemoBookingPanel(app.id, app.roundId); return { id: existing.id } }
  if (existing && +new Date(existing.startTime) <= Date.now()) throw new Error("This interview has already started.")
  const settings=demoBookingSettings(app.roundId)
  if(!isPublishedBookingSlot(s.bookingFlow.publishedSlots[app.roundId],slot,room)||!settings.bookingPublishedAt||settings.bookingPaused)throw Error("Booking has not been published or is paused.")
  if(existing&&!settings.bookingAllowRescheduling)throw Error("The club does not allow self-service rescheduling. Your original reservation is retained.")
  if(!demoBookingCoverage(app.clubId,app.roundId,app.studentId).some(row=>row.slotId===slot.id&&row.bookable))throw Error("This session is no longer fully staffed with approved interviewers.")
  if (!room.isOpen || +new Date(slot.startTime) <= Date.now() || (s.roomBookings ?? []).filter(b => b.slotId === slotId).length >= slot.capacity) throw new Error("This slot is no longer available.")
  const owned = s.applications.filter(a => a.studentId === app.studentId).map(a => a.id)
  if (s.slots.some(b => b.id !== existing?.id && b.applicationId && owned.includes(b.applicationId) && overlaps(b, slot))) throw new Error("You already have an interview at that time.")
  if (s.slots.some(b => b.applicationId === app.id && b.id !== existing?.id && +b.startTime > Date.now())) throw new Error("You already have a sample booking with this club. Use an application without an existing booking.")
  const id = crypto.randomUUID()
  demoStore.mutate(s => {
    s.roomBookings ??= []
    s.roomBookings = s.roomBookings.filter(b => b.id !== existing?.id)
    s.slots = s.slots.filter(slot => slot.id !== existing?.id)
    s.roomBookings.push({ id, applicationId, slotId, roomId: room.id, roundId: room.roundId, candidate: `${s.students[0].profile.firstName} ${s.students[0].profile.lastName}`, startTime: new Date(slot.startTime).toISOString(), endTime: new Date(slot.endTime).toISOString(), location: room.location })
    s.slots.push({ id, clubId: room.clubId, applicationId, startTime: new Date(slot.startTime), endTime: new Date(slot.endTime), location: room.location, interviewerId: room.panelMemberIds[0] || s.memberships.find(m => m.clubId === room.clubId)!.id })
  })
  syncDemoBookingPanel(app.id, app.roundId)
  demoBookingNotice(app.studentId, app.clubId, `booking-confirmed:${id}`, "Interview confirmed", "Your reserved interview details are available.", `/interviews/book?clubId=${app.clubId}&roundId=${app.roundId}`)
  return { id }
}
export async function cancelRoomBooking(id: string) {
  const booking = demoStore.get().roomBookings?.find(b => b.id === id)
  if (!booking) throw new Error("Booking not found.")
  const app=ownApplication(booking.applicationId)
  if(!demoBookingSettings(booking.roundId).bookingAllowCancellation)throw Error("The club does not allow self-service cancellation.")
  if (+new Date(booking.startTime) <= Date.now()) throw new Error("This interview has already started.")
  demoStore.mutate(s => { s.roomBookings = s.roomBookings.filter(b => b.id !== id); s.slots = s.slots.filter(slot => slot.id !== id) });
  syncDemoBookingPanel(booking.applicationId, booking.roundId)
  demoBookingNotice(app.studentId,app.clubId,`booking-cancelled:${booking.id}`,"Interview booking changed","Your reservation was released.",`/interviews/book?clubId=${app.clubId}&roundId=${app.roundId}`)
}
export async function getBookingApplication(clubId: string, roundId: string) {
  const s = demoStore.get(), app = s.applications.find(a => a.clubId === clubId && a.roundId === roundId && a.studentId === s.students[0].id && a.status === "INTERVIEWING")
  if (!app) return { status: "unavailable" as const }
  return { status: "ready" as const, applicationId: app.id }
}

export async function setInterviewStaffingRequirement(input: {clubId:string;roomId:string;slotId?:string;needed:number|null;revision:number}) {
 manager(input.clubId)
 if(input.needed!==null&&(!Number.isInteger(input.needed)||input.needed<1||input.needed>8))throw new Error("Choose one to eight interviewers.")
 demoStore.mutate(s=>{const room=s.interviewRooms.find(r=>r.id===input.roomId&&r.clubId===input.clubId);if(!room)throw new Error("Room unavailable.");if(input.slotId){const slot=room.slots.find(slot=>slot.id===input.slotId);if(!slot||input.revision!==(slot.staffingRevision??0))throw new Error("Reload staffing.");slot.interviewersNeeded=input.needed;slot.staffingRevision=(slot.staffingRevision??0)+1;}else{if(input.needed===null||input.revision!==(room.staffingRevision??0))throw new Error("Reload staffing.");room.interviewersNeeded=input.needed;room.staffingRevision=(room.staffingRevision??0)+1;}})
}
