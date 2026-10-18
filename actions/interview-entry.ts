"use server";
import { z } from "zod";
import { prisma } from "@/utils/prisma";
import { requireAuth } from "@/utils/auth";
import { interviewActor, authorizeInterview, interviewTransactionOptions } from "@/utils/interview-access";
import { ownPanelAssignments } from "@/utils/official-panel-schedule";
import { approvedBookingPanel } from "@/utils/interview-collaboration";
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
    const rows: InterviewRoomEntry[] = [];
    for (const slot of slots) {
      const room = slot.room!;
      const base = { slotId: slot.id, roomId: room.id, clubId, roundId: room.roundId, roundName: room.round.name, roomName: room.name, location: room.location, timezone: room.timezone, startTime: slot.startTime.toISOString(), endTime: slot.endTime.toISOString() };
      const cancelled = !room.isOpen;
      if (cancelled) { rows.push({ ...base, id: slot.id, bookingId: null, applicationId: null, candidate: null, interviewers: [], completed: false, started: false, cancelled: true, canOpen: false }); continue; }
      if (!slot.bookings.length && official.some(r => r.id === slot.id)) rows.push({ ...base, id: slot.id, bookingId: null, applicationId: null, candidate: null, interviewers: [], completed: false, started: false, cancelled: false, canOpen: false });
      for (const booking of slot.bookings) {
        if (booking.roundId !== room.roundId || booking.application.clubId !== clubId || booking.application.studentId === user.id || booking.application.status === "DRAFTING") continue;
        const scope = { clubId, applicationId: booking.applicationId, roundId: room.roundId };
        const assignment = await tx.interviewPanelAssignment.findUnique({ where: { applicationId_roundId_memberId: { applicationId: scope.applicationId, roundId: scope.roundId, memberId: member.id } } });
        if (!assignment || assignment.revokedAt) continue;
        const panel = await approvedBookingPanel(tx, scope, { ...booking, slot });
        if (!panel?.includes(member.id)) continue;
        const record = await tx.interviewRecord.findUnique({ where: { applicationId_interviewerId_roundId: { applicationId: booking.applicationId, interviewerId: member.id, roundId: room.roundId } } });
        const anonymous = room.round.anonymousReview || booking.application.round.anonymousReview || !!record?.anonymousReview;
        const reviewId = anonymous && record?.completedAt && caps.readClosing ? record.id : undefined;
        const canOpen = !!reviewId || !anonymous && (!!record?.completedAt || !room.round.archivedAt && booking.application.roundId === room.roundId);
        const colleagues = canOpen && !anonymous ? await tx.clubMember.findMany({ where: { id: { in: panel }, clubId, status: "ACTIVE", user: { disabledAt: null } }, select: { id: true, user: { select: { studentProfile: { select: { firstName: true, lastName: true } } } } } }) : [];
        const p = booking.application.student.studentProfile;
        rows.push({ ...base, ...(reviewId ? { reviewId } : {}), id: booking.id, bookingId: booking.id, applicationId: canOpen ? booking.applicationId : null, candidate: anonymous ? anonymousApplicantLabel(booking.applicationId) : p ? `${p.firstName} ${p.lastName}` : "Applicant", interviewers: colleagues.filter(m => m.id !== member.id).map(m => m.user.studentProfile ? `${m.user.studentProfile.firstName} ${m.user.studentProfile.lastName}` : "Interviewer"), completed: !!record?.completedAt, started: !!record && !record.completedAt, cancelled: false, canOpen });
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
