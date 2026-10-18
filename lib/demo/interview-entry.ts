import { demoStore, demoMember } from "./store";
import { interviewCapabilities } from "@/lib/interview-access";
import { getInterviewWorkspace } from "./interview-foundation";
import { sortInterviewEntries, type InterviewRoomEntry } from "@/lib/interview-entry";
import { anonymousApplicantLabel } from "@/lib/anonymous-review";

export function getAssignedInterviewRooms(clubId: string): InterviewRoomEntry[] {
  const s = demoStore.get(), member = demoMember(), caps = interviewCapabilities(member);
  if (s.perspective.role !== "leader" || member.clubId !== clubId || member.status !== "ACTIVE" || !caps.participate) throw Error("Current interviewer access required.");
  const rows: InterviewRoomEntry[] = [];
  for (const room of s.interviewRooms.filter(r => r.clubId === clubId)) {
    const round = s.clubs.find(c => c.id === clubId)?.rounds.find(r => r.id === room.roundId);
    if (!round || !room.panelApprovedBy || !s.memberships.some(m => m.clubId === clubId && m.userId === room.panelApprovedBy && m.isOwner && m.status === "ACTIVE")) continue;
    for (const slot of room.slots) {
      const panel = slot.panelScheduleVersionId ? slot.publishedPanelMemberIds || [] : (room.approvedPanelMemberIds || []).filter(id => room.panelMemberIds.includes(id));
      if (!panel.includes(member.id)) continue;
      const base = { slotId: slot.id, roomId: room.id, clubId, roundId: room.roundId, roundName: round.name, roomName: room.name, location: room.location, timezone: room.timezone, startTime: new Date(slot.startTime).toISOString(), endTime: new Date(slot.endTime).toISOString() };
      const bookings = s.roomBookings.filter(b => b.slotId === slot.id && b.roomId === room.id && b.roundId === room.roundId);
      if (!room.isOpen || !bookings.length) { rows.push({ ...base, id: slot.id, bookingId: null, applicationId: null, candidate: null, interviewers: [], completed: false, started: false, cancelled: !room.isOpen, canOpen: false }); continue; }
      for (const b of bookings) {
        const app = s.applications.find(a => a.id === b.applicationId && a.clubId === clubId && a.studentId !== member.userId && a.status !== "DRAFTING");
        if (!app || !s.interviewFoundation.assignments.some(a => a.applicationId === app.id && a.roundId === round.id && a.memberId === member.id && !a.revokedAt)) continue;
        const record = s.interviews.find(r => r.applicationId === app.id && r.roundId === round.id && r.interviewerId === member.id);
        const anonymous = round.anonymousReview || s.clubs.find(c => c.id === clubId)?.rounds.find(r => r.id === app.roundId)?.anonymousReview || !!record?.anonymousReview;
        const p = s.students.find(u => u.id === app.studentId)?.profile;
        const reviewId = anonymous && record?.completedAt && caps.readClosing ? record.id : undefined;
        const canOpen = !!reviewId || !anonymous && (!!record?.completedAt || app.roundId === round.id);
        rows.push({ ...base, ...(reviewId ? { reviewId } : {}), id: b.id, bookingId: b.id, applicationId: canOpen ? app.id : null, candidate: anonymous ? anonymousApplicantLabel(app.id) : p ? `${p.firstName} ${p.lastName}` : "Applicant", interviewers: canOpen && !anonymous ? s.memberships.filter(m => m.clubId === clubId && m.status === "ACTIVE" && panel.includes(m.id) && m.id !== member.id).map(m => { const p = s.students.find(u => u.id === m.userId)?.profile; return p ? `${p.firstName} ${p.lastName}` : "Interviewer"; }) : [], completed: !!record?.completedAt, started: !!record && !record.completedAt, cancelled: false, canOpen });
      }
    }
  }
  return sortInterviewEntries(rows);
}
export function resolveInterviewRoomEntry(input: { clubId: string; applicationId: string; roundId: string; bookingId?: string; slotId?: string; roomId?: string }) {
  const workspace = getInterviewWorkspace(input.clubId);
  const app = workspace.applications.find(a => a.id === input.applicationId && a.assignedRoundIds.includes(input.roundId) && (a.roundId === input.roundId || a.completedRoundIds.includes(input.roundId)));
  if (!app) throw Error("This interview assignment is no longer available.");
  const s = demoStore.get(), booking = s.roomBookings.find(b => b.applicationId === app.id && b.roundId === input.roundId);
  if (booking || input.bookingId || input.slotId || input.roomId) {
    const match = getAssignedInterviewRooms(input.clubId).find(r => r.applicationId === app.id && r.roundId === input.roundId && r.canOpen && !r.reviewId && (!input.bookingId || r.bookingId === input.bookingId) && (!input.slotId || r.slotId === input.slotId) && (!input.roomId || r.roomId === input.roomId));
    if (!match) throw Error("This booking changed or was cancelled. Return to Interview rooms.");
  }
  return { applicationId: app.id, roundId: input.roundId };
}
