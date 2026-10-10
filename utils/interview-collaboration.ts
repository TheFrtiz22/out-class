import type { AppTransactionClient } from "@/utils/prisma";
import { authorizeInterview } from "@/utils/interview-access";
import type { InterviewScope } from "@/lib/interview-access";
import { kitSchema } from "@/lib/interview-kits";

export function collaborationScope(session: { clubId: string; applicationId: string; roundId: string }): InterviewScope {
  return { clubId: session.clubId, applicationId: session.applicationId, roundId: session.roundId };
}

export async function collaborationAccess(tx: AppTransactionClient, scope: InterviewScope, userId: string) {
  const actor = await authorizeInterview(tx, scope, userId);
  const booking = await tx.interviewBooking.findUnique({ where: { applicationId_roundId: { applicationId: scope.applicationId, roundId: scope.roundId } }, include: { slot: { include: { room: true } } } });
  const room = booking?.slot.room;
  if (booking && (!room || !room.isOpen || room.clubId !== scope.clubId || room.roundId !== scope.roundId || !room.panelMemberIds.includes(actor.member.id) || !room.approvedPanelMemberIds.includes(actor.member.id))) throw Error("Current room assignment required.");
  if (room && (!room.panelApprovedBy || !await tx.clubMember.findFirst({ where: { clubId: scope.clubId, userId: room.panelApprovedBy, isOwner: true, status: "ACTIVE", user: { disabledAt: null } } }))) throw Error("Current room panel approval required.");
  // A manually assigned, unscheduled panel has one candidate-specific room.
  // A booking is scoped to its actual room AND slot, never just club/round.
  const roomKey = booking ? `booking:${booking.id}:${room!.id}` : `panel:${scope.applicationId}`;
  return { ...actor, roomKey };
}

export async function collaborationSession(tx: AppTransactionClient, scope: InterviewScope, userId: string) {
  const actor = await collaborationAccess(tx, scope, userId);
  const record = await tx.interviewRecord.findUnique({ where: { applicationId_interviewerId_roundId: { applicationId: scope.applicationId, roundId: scope.roundId, interviewerId: actor.member.id } } });
  if (!record || record.anonymousReview) throw Error("Open your authorized interview first.");
  const session = await tx.interviewCollaboration.upsert({
    where: { applicationId_roundId_roomKey: { applicationId: scope.applicationId, roundId: scope.roundId, roomKey: actor.roomKey } },
    create: { ...collaborationScope(scope), roomKey: actor.roomKey, questions: kitSchema.parse(record.questions) }, update: {},
  });
  return { ...actor, record, session };
}

export async function memberName(tx: AppTransactionClient, memberId: string) {
  const member = await tx.clubMember.findUnique({ where: { id: memberId }, include: { user: { include: { studentProfile: true } } } });
  const p = member?.user.studentProfile;
  return p ? `${p.firstName} ${p.lastName}` : "Interviewer";
}

export async function eligibleDestination(tx: AppTransactionClient, scope: InterviewScope, userId: string) {
  const actor = await collaborationAccess(tx, scope, userId);
  if (actor.app.roundId !== scope.roundId || actor.round.archivedAt) throw Error("Destination is no longer eligible.");
  const record = await tx.interviewRecord.findUnique({ where: { applicationId_interviewerId_roundId: { applicationId: scope.applicationId, roundId: scope.roundId, interviewerId: actor.member.id } } });
  if (record?.completedAt) throw Error("You have already completed that interview.");
  return actor;
}
