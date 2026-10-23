import type { AppTransactionClient } from "@/utils/prisma";
import { authorizeInterview } from "@/utils/interview-access";
import type { InterviewScope } from "@/lib/interview-access";
import { kitSchema } from "@/lib/interview-kits";
import type { Prisma } from "@prisma/client";

type PanelBooking = Prisma.InterviewBookingGetPayload<{ include: { slot: { include: { room: true; panelScheduleVersion: true } } } }>;
function bookingPanelApproval(scope: InterviewScope, booking: PanelBooking) {
  const { slot } = booking, room = slot.room;
  if (!room || !room.isOpen || booking.applicationId !== scope.applicationId || booking.roundId !== scope.roundId || room.clubId !== scope.clubId || room.roundId !== scope.roundId) return null;
  const version = slot.panelScheduleVersion;
  if (slot.panelScheduleVersionId && (!version || version.id !== slot.panelScheduleVersionId || version.clubId !== scope.clubId || version.roundId !== scope.roundId)) return null;
  const approvedBy = slot.panelScheduleVersionId ? version!.publishedBy : room.panelApprovedBy;
  return approvedBy ? { approvedBy, panel: slot.panelScheduleVersionId ? slot.publishedPanelMemberIds : room.approvedPanelMemberIds.filter(id => room.panelMemberIds.includes(id)) } : null;
}
/** Reuse the official scheduling authority: published slot panels supersede
 * legacy room attestations, while the approving owner must still be active. */
export async function approvedBookingPanel(tx: AppTransactionClient, scope: InterviewScope, booking: PanelBooking): Promise<string[] | null> {
  const approval = bookingPanelApproval(scope, booking);
  if (!approval || !await tx.clubMember.findFirst({ where: { clubId: scope.clubId, userId: approval.approvedBy, isOwner: true, status: "ACTIVE", user: { disabledAt: null } } })) return null;
  return approval.panel;
}

/** Transaction-local bulk projection. Never retains successful approval across requests. */
export async function approvedBookingPanels(tx: AppTransactionClient, entries: { scope: InterviewScope; booking: PanelBooking }[]) {
  const panels = new Map<string, string[]>();
  for (let offset = 0; offset < entries.length; offset += 128) {
    const approvals = entries.slice(offset, offset + 128).flatMap(({ scope, booking }) => {
      const approval = bookingPanelApproval(scope, booking);
      return approval ? [{ ...approval, clubId: scope.clubId, bookingId: booking.id }] : [];
    });
    if (!approvals.length) continue;
    const ownerScopes = new Map(approvals.map(a => [`${a.clubId}:${a.approvedBy}`, { clubId: a.clubId, userId: a.approvedBy }]));
    const owners = await tx.clubMember.findMany({ where: { isOwner: true, status: "ACTIVE", user: { disabledAt: null }, OR: [...ownerScopes.values()] }, select: { clubId: true, userId: true } });
    const active = new Set(owners.map(owner => `${owner.clubId}:${owner.userId}`));
    for (const approval of approvals) if (active.has(`${approval.clubId}:${approval.approvedBy}`)) panels.set(approval.bookingId, approval.panel);
  }
  return panels;
}

export function collaborationScope(session: { clubId: string; applicationId: string; roundId: string }): InterviewScope {
  return { clubId: session.clubId, applicationId: session.applicationId, roundId: session.roundId };
}

export class CollaborationInitializationRequired extends Error {}

export async function collaborationAccess(tx: AppTransactionClient, scope: InterviewScope, userId: string, applicationLock: "share" | "update" = "update") {
  const actor = await authorizeInterview(tx, scope, userId, "panel", applicationLock);
  const booking = await tx.interviewBooking.findUnique({ where: { applicationId_roundId: { applicationId: scope.applicationId, roundId: scope.roundId } }, include: { slot: { include: { room: true, panelScheduleVersion: true } } } });
  const room = booking?.slot.room;
  const panelIds = booking ? await approvedBookingPanel(tx, scope, booking) : null;
  if (booking && !panelIds) throw Error("Current room panel approval required.");
  if (booking && !panelIds?.includes(actor.member.id)) throw Error("Current room assignment required.");
  // A manually assigned, unscheduled panel has one candidate-specific room.
  // A booking is scoped to its actual room AND slot, never just club/round.
  const roomKey = booking ? `booking:${booking.id}:${room!.id}` : `panel:${scope.applicationId}`;
  return { ...actor, roomKey, booking, panelIds };
}

export async function collaborationSession(tx: AppTransactionClient, scope: InterviewScope, userId: string, readOnly = false) {
  const actor = await collaborationAccess(tx, scope, userId, readOnly ? "share" : "update");
  const record = await tx.interviewRecord.findUnique({ where: { applicationId_interviewerId_roundId: { applicationId: scope.applicationId, roundId: scope.roundId, interviewerId: actor.member.id } } });
  if (!record || record.anonymousReview) throw Error("Open your authorized interview first.");
  const session = readOnly ? await tx.interviewCollaboration.findUnique({ where: { applicationId_roundId_roomKey: { applicationId: scope.applicationId, roundId: scope.roundId, roomKey: actor.roomKey } } }) : await tx.interviewCollaboration.upsert({
    where: { applicationId_roundId_roomKey: { applicationId: scope.applicationId, roundId: scope.roundId, roomKey: actor.roomKey } },
    create: { ...collaborationScope(scope), roomKey: actor.roomKey, questions: kitSchema.parse(record.questions) }, update: {},
  });
  if (!session) throw new CollaborationInitializationRequired("Room initialization required.");
  return { ...actor, record, session };
}

export async function memberName(tx: AppTransactionClient, memberId: string) {
  const member = await tx.clubMember.findUnique({ where: { id: memberId }, include: { user: { include: { studentProfile: true } } } });
  const p = member?.user.studentProfile;
  return p ? `${p.firstName} ${p.lastName}` : "Interviewer";
}

export async function eligibleDestination(tx: AppTransactionClient, scope: InterviewScope, userId: string, applicationLock: "share" | "update" = "update") {
  const actor = await collaborationAccess(tx, scope, userId, applicationLock);
  if (actor.app.roundId !== scope.roundId || actor.round.archivedAt) throw Error("Destination is no longer eligible.");
  const record = await tx.interviewRecord.findUnique({ where: { applicationId_interviewerId_roundId: { applicationId: scope.applicationId, roundId: scope.roundId, interviewerId: actor.member.id } } });
  if (record?.completedAt) throw Error("You have already completed that interview.");
  return actor;
}
