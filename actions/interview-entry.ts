"use server";
import { z } from "zod";
import { prisma } from "@/utils/prisma";
import { requireAuth } from "@/utils/auth";
import { interviewActor, authorizeInterview, interviewTransactionOptions } from "@/utils/interview-access";
import { ownPanelAssignments } from "@/utils/official-panel-schedule";
import { approvedBookingPanel, approvedBookingPanels } from "@/utils/interview-collaboration";
import { anonymousApplicantLabel } from "@/lib/anonymous-review";
import { sortInterviewEntries, type InterviewRoomEntry } from "@/lib/interview-entry";

/** Current official slots plus this member's retained submitted interviews. No manager-wide booking projection. */
export async function getAssignedInterviewRooms(clubId: string): Promise<InterviewRoomEntry[]> {
  z.string().uuid().parse(clubId); const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const { member, caps } = await interviewActor(tx, clubId, user.id);
    if (!caps.participate) throw Error("Current interviewer access required.");
    const official = (await ownPanelAssignments(tx, user.id, true)).filter(r => r.clubId === clubId);
    const records = await tx.interviewRecord.findMany({ where: { interviewerId: member.id, application: { clubId }, completedAt: { not: null } }, select: { applicationId: true, roundId: true } });
    const slots = await tx.interviewSlot.findMany({ where: { clubId, room: { clubId }, OR: [{ id: { in: official.map(r => r.id) } }, { bookings: { some: { OR: records.map(r => ({ applicationId: r.applicationId, roundId: r.roundId })) } } }, { room: { isOpen: false }, OR: [{ publishedPanelMemberIds: { has: member.id } }, { panelScheduleVersionId: null, room: { approvedPanelMemberIds: { has: member.id } } }] }] }, include: { room: { include: { round: true } }, panelScheduleVersion: true, bookings: { include: { application: { include: { round: true, student: { select: { studentProfile: { select: { firstName: true, lastName: true } } } } } } } } }, orderBy: [{ startTime: "asc" }, { id: "asc" }] });
    const candidates = slots.flatMap(slot => slot.room!.isOpen ? slot.bookings.filter(booking => booking.roundId === slot.room!.roundId && booking.application.clubId === clubId && booking.application.studentId !== user.id && booking.application.status !== "DRAFTING").map(booking => ({ booking, slot, scope: { clubId, applicationId: booking.applicationId, roundId: slot.room!.roundId } })) : []);
    const access = new Map<string, { anonymous: boolean; reviewId?: string; canOpen: boolean; completed: boolean; started: boolean; interviewers: string[] }>();
    const scopeKey = (value: { applicationId: string; roundId: string }) => `${value.applicationId}:${value.roundId}`;
    // Sequential bounded batches use this transaction's single connection. All
    // grants, approving owners and enabled colleagues are re-read on every request.
    for (let offset = 0; offset < candidates.length; offset += 128) {
      const batch = candidates.slice(offset, offset + 128);
      const grants = await tx.interviewPanelAssignment.findMany({ where: { memberId: member.id, revokedAt: null, application: { clubId }, OR: batch.map(c => ({ applicationId: c.scope.applicationId, roundId: c.scope.roundId })) }, select: { applicationId: true, roundId: true } });
      const granted = new Set(grants.map(scopeKey));
      const eligible = batch.filter(c => granted.has(scopeKey(c.scope)));
      const panels = await approvedBookingPanels(tx, eligible.map(c => ({ scope: c.scope, booking: { ...c.booking, slot: c.slot } })));
      const approved = eligible.filter(c => panels.get(c.booking.id)?.includes(member.id));
      if (!approved.length) continue;
      const ownRecords = await tx.interviewRecord.findMany({ where: { interviewerId: member.id, application: { clubId }, OR: approved.map(c => ({ applicationId: c.scope.applicationId, roundId: c.scope.roundId })) }, select: { id: true, applicationId: true, roundId: true, completedAt: true, anonymousReview: true } });
      const byScope = new Map(ownRecords.map(record => [scopeKey(record), record]));
      const projected = approved.map(c => {
        const record = byScope.get(scopeKey(c.scope)), room = c.slot.room!;
        const anonymous = room.round.anonymousReview || c.booking.application.round.anonymousReview || !!record?.anonymousReview;
        const reviewId = anonymous && record?.completedAt && caps.readClosing ? record.id : undefined;
        const canOpen = !!reviewId || !anonymous && (!!record?.completedAt || !room.round.archivedAt && c.booking.application.roundId === room.roundId);
        return { ...c, anonymous, reviewId, canOpen, completed: !!record?.completedAt, started: !!record && !record.completedAt };
      });
      const colleagueIds = [...new Set(projected.flatMap(c => c.canOpen && !c.anonymous ? panels.get(c.booking.id)! : []))];
      const colleagues = colleagueIds.length ? await tx.clubMember.findMany({ where: { id: { in: colleagueIds }, clubId, status: "ACTIVE", user: { disabledAt: null } }, select: { id: true, user: { select: { studentProfile: { select: { firstName: true, lastName: true } } } } } }) : [];
      for (const c of projected) access.set(c.booking.id, { anonymous: c.anonymous, reviewId: c.reviewId, canOpen: c.canOpen, completed: c.completed, started: c.started, interviewers: c.canOpen && !c.anonymous ? colleagues.filter(m => m.id !== member.id && panels.get(c.booking.id)!.includes(m.id)).map(m => m.user.studentProfile ? `${m.user.studentProfile.firstName} ${m.user.studentProfile.lastName}` : "Interviewer") : [] });
    }
    const rows: InterviewRoomEntry[] = [];
    for (const slot of slots) {
      const room = slot.room!;
      const base = { slotId: slot.id, roomId: room.id, clubId, roundId: room.roundId, roundName: room.round.name, roomName: room.name, location: room.location, timezone: room.timezone, startTime: slot.startTime.toISOString(), endTime: slot.endTime.toISOString() };
      const cancelled = !room.isOpen;
      if (cancelled) { rows.push({ ...base, id: slot.id, bookingId: null, applicationId: null, candidate: null, interviewers: [], completed: false, started: false, cancelled: true, canOpen: false }); continue; }
      if (!slot.bookings.length && official.some(r => r.id === slot.id)) rows.push({ ...base, id: slot.id, bookingId: null, applicationId: null, candidate: null, interviewers: [], completed: false, started: false, cancelled: false, canOpen: false });
      for (const booking of slot.bookings) {
        const projection = access.get(booking.id);
        if (!projection) continue;
        const { anonymous, reviewId, canOpen, interviewers, completed, started } = projection;
        const p = booking.application.student.studentProfile;
        rows.push({ ...base, ...(reviewId ? { reviewId } : {}), id: booking.id, bookingId: booking.id, applicationId: canOpen ? booking.applicationId : null, candidate: anonymous ? anonymousApplicantLabel(booking.applicationId) : p ? `${p.firstName} ${p.lastName}` : "Applicant", interviewers, completed, started, cancelled: false, canOpen });
      }
    }
    return sortInterviewEntries(rows);
  }, interviewTransactionOptions);
}

/** Exact URL validation on every entry/refresh. A stale booking must never fall back to another candidate. */
export async function resolveInterviewRoomEntry(input: { clubId: string; applicationId: string; roundId: string; bookingId?: string; slotId?: string; roomId?: string }) {
  const data = z.object({ clubId: z.string().uuid(), applicationId: z.string().uuid(), roundId: z.string().uuid(), bookingId: z.string().uuid().optional(), slotId: z.string().uuid().optional(), roomId: z.string().uuid().optional() }).parse(input);
  const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const actor = await authorizeInterview(tx, data, user.id, "panel", "share");
    const booking = await tx.interviewBooking.findUnique({ where: { applicationId_roundId: { applicationId: data.applicationId, roundId: data.roundId } }, include: { slot: { include: { room: true, panelScheduleVersion: true } } } });
    if (data.bookingId || data.slotId || data.roomId) {
      if (!booking || data.bookingId && data.bookingId !== booking.id || data.slotId && data.slotId !== booking.slotId || data.roomId && data.roomId !== booking.slot.roomId) throw Error("This booking changed or was cancelled. Return to Interview rooms.");
    }
    if (booking && !(await approvedBookingPanel(tx, data, booking))?.includes(actor.member.id)) throw Error("This room assignment is no longer available.");
    const record = await tx.interviewRecord.findUnique({ where: { applicationId_interviewerId_roundId: { applicationId: data.applicationId, roundId: data.roundId, interviewerId: actor.member.id } } });
    if ((!record?.completedAt && (actor.app.roundId !== data.roundId || actor.round.archivedAt)) || record?.anonymousReview) throw Error("This interview is no longer available.");
    return { applicationId: data.applicationId, roundId: data.roundId };
  }, interviewTransactionOptions);
}
