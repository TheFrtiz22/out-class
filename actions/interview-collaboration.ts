"use server";

import { z } from "zod";
import { prisma } from "@/utils/prisma";
import type { AppTransactionClient } from "@/utils/prisma";
import { requireAuth } from "@/utils/auth";
import { interviewCapabilities, interviewScopeSchema, type InterviewScope } from "@/lib/interview-access";
import { kitSchema, interviewDraftSchema } from "@/lib/interview-kits";
import { PRESENCE_TTL_MS, INVITATION_TTL_MS, type CollaborationView } from "@/lib/interview-collaboration";
import { collaborationAccess, collaborationScope, collaborationSession, eligibleDestination, memberName } from "@/utils/interview-collaboration";
import { getInterviewWorkspace } from "@/actions/interview-kits";
import { nextInterviewApplicant } from "@/lib/interview-queue";

const inputSchema = interviewScopeSchema.extend({ clientId: z.string().uuid() });
// Current-access checks for each peer span several pooler round trips. Keep the
// transaction bounded while allowing cold hosted connections to finish safely.
const transactionOptions = { maxWait: 5000, timeout: 20000 };
async function validInvite(tx: AppTransactionClient, id: string, sourceId: string, recipientId: string, userId: string) {
  const invite = await tx.interviewInvitation.findUnique({ where: { id } });
  if (!invite || invite.recipientId !== recipientId || invite.dismissedAt) throw Error("Invitation unavailable.");
  const move = await tx.interviewMove.findUnique({ where: { id: invite.moveId } });
  if (!move?.confirmedAt || move.sourceId !== sourceId || move.expiresAt.getTime() <= Date.now()) throw Error("Invitation expired.");
  const newest = await tx.interviewMove.findFirst({ where: { memberId: move.memberId, confirmedAt: { not: null } }, orderBy: [{ confirmedAt: "desc" }, { id: "desc" }] });
  if (newest?.id !== move.id) throw Error("Interviewer has moved again.");
  const destination = await tx.interviewCollaboration.findUniqueOrThrow({ where: { id: move.destinationId } });
  const sender = await tx.clubMember.findUniqueOrThrow({ where: { id: move.memberId } });
  const senderAccess = await collaborationAccess(tx, collaborationScope(destination), sender.userId);
  if (senderAccess.roomKey !== destination.roomKey) throw Error("Room changed.");
  const recipient = await eligibleDestination(tx, collaborationScope(destination), userId);
  if (recipient.roomKey !== destination.roomKey) throw Error("Room changed.");
  return { invite, move, destination };
}

/** Authorized polling replaces the old unauthenticated shared-notes broadcast.
 * No browser SQL/realtime subscription exists; every refresh checks current access. */
export async function getInterviewCollaboration(input: z.infer<typeof inputSchema>): Promise<CollaborationView> {
  const data = inputSchema.parse(input); const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const { member, session, roomKey, app } = await collaborationSession(tx, data, user.id);
    const now = new Date();
    await tx.interviewPresence.deleteMany({ where: { sessionId: session.id, seenAt: { lt: new Date(Date.now() - PRESENCE_TTL_MS) } } });
    const old = await tx.interviewPresence.findUnique({ where: { memberId_clientId: { memberId: member.id, clientId: data.clientId } } });
    if (!old || old.sessionId !== session.id || now.getTime() - old.seenAt.getTime() > 12000) await tx.interviewPresence.upsert({ where: { memberId_clientId: { memberId: member.id, clientId: data.clientId } }, create: { sessionId: session.id, memberId: member.id, clientId: data.clientId }, update: { sessionId: session.id, seenAt: now } });
    const presences = await tx.interviewPresence.findMany({ where: { sessionId: session.id, seenAt: { gt: new Date(Date.now() - PRESENCE_TTL_MS) } }, orderBy: [{ memberId: "asc" }] });
    const presentIds = [...new Set(presences.map(p => p.memberId))];
    // The actor already holds the club/application/round locks. Check current
    // peer grants together rather than rerunning the whole room authorization
    // for every name (which blocked private saves on hosted pooler connections).
    const ids = [...new Set([...presentIds, ...(session.selectedBy ? [session.selectedBy] : [])])];
    await tx.$queryRaw`SELECT u.id FROM "User" u JOIN "ClubMember" m ON m."userId" = u.id WHERE m.id = ANY(${ids}::text[]) ORDER BY u.id FOR SHARE OF u, m`;
    const peers = await tx.clubMember.findMany({ where: { id: { in: ids }, clubId: data.clubId, status: "ACTIVE", user: { disabledAt: null }, interviewAssignments: { some: { applicationId: data.applicationId, roundId: data.roundId, revokedAt: null } } }, include: { user: { select: { studentProfile: { select: { firstName: true, lastName: true } } } } } });
    const booking = await tx.interviewBooking.findUnique({ where: { applicationId_roundId: { applicationId: data.applicationId, roundId: data.roundId } }, include: { slot: { include: { room: true } } } });
    const authorized = peers.filter(peer => peer.userId !== app.studentId && interviewCapabilities(peer).participate && (!booking || (roomKey === `booking:${booking.id}:${booking.slot.roomId}` && booking.slot.room?.panelMemberIds.includes(peer.id) && booking.slot.room.approvedPanelMemberIds.includes(peer.id))));
    const peerName = (peer: typeof authorized[number]) => peer.user.studentProfile ? `${peer.user.studentProfile.firstName} ${peer.user.studentProfile.lastName}` : "Interviewer";
    const participants: CollaborationView["participants"] = authorized.filter(peer => presentIds.includes(peer.id)).map(peer => ({ id: peer.id, name: peerName(peer) }));
    let invitation: CollaborationView["invitation"] = null;
    const moves = await tx.interviewMove.findMany({ where: { sourceId: session.id, confirmedAt: { not: null }, expiresAt: { gt: now } }, orderBy: [{ confirmedAt: "desc" }, { id: "desc" }], take: 10 });
    const invites = moves.length ? await tx.interviewInvitation.findMany({ where: { recipientId: member.id, dismissedAt: null, moveId: { in: moves.map(m => m.id) } } }) : [];
    const available = [];
    for (const i of invites) {
      try { available.push(await validInvite(tx, i.id, session.id, member.id, user.id)); } catch { /* Stale/access-invalid invitations expose no destination data. */ }
    }
    available.sort((a,b) => b.move.confirmedAt!.getTime() - a.move.confirmedAt!.getTime() || b.move.id.localeCompare(a.move.id));
    if (available[0]) {
      const { invite, move, destination } = available[0];
      const app = await tx.application.findUniqueOrThrow({ where: { id: destination.applicationId }, include: { student: { include: { studentProfile: true } } } });
      const p = app.student.studentProfile;
      invitation = { id: invite.id, sender: await memberName(tx, move.memberId), candidate: p ? `${p.firstName} ${p.lastName}` : "Candidate" };
    }
    let selection: CollaborationView["selection"] = null;
    if (session.selectedQuestionId && session.selectedBy) {
      const selector = authorized.find(peer => peer.id === session.selectedBy);
      if (selector) {
        const question = kitSchema.parse(session.questions).find(q => q.id === session.selectedQuestionId);
        if (question) selection = { question, by: peerName(selector), memberId: selector.id };
      }
    }
    return { sessionId: session.id, revision: session.revision, participants, selection, invitation };
  }, transactionOptions);
}

export async function selectSharedInterviewQuestion(input: z.infer<typeof inputSchema> & { questionId: string }) {
  const data = inputSchema.extend({ questionId: z.string().uuid() }).parse(input); const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const { session, record, member, round, app } = await collaborationSession(tx, data, user.id);
    if (record.completedAt || interviewDraftSchema.parse(record.draft).postInterview || round.archivedAt || app.roundId !== round.id) throw Error("Only active interviews can select shared questions.");
    // Application lock orders concurrent selections. No last-write-wins private draft write.
    const questions = kitSchema.parse(session.questions);
    let question = questions.find(q => q.id === data.questionId);
    if (!question) {
      const draft = interviewDraftSchema.parse(record.draft);
      const added = draft.additionalQuestions.find(q => q.id === data.questionId && q.bankQuestion);
      question = kitSchema.parse(record.questions).find(q => q.id === data.questionId) || (added ? { id: added.id, prompt: added.question, guidance: added.bankQuestion!.guidance } : kitSchema.parse(round.interviewKit).find(q => q.id === data.questionId));
      if (!question) throw Error("Select an authorized bank question.");
      if (questions.length >= 50) throw Error("This room has reached its saved bank limit.");
      questions.push(question);
    }
    const updated = await tx.interviewCollaboration.update({ where: { id: session.id }, data: { questions, selectedQuestionId: question.id, selectedBy: member.id, revision: { increment: 1 } } });
    return { revision: updated.revision, question };
  }, transactionOptions);
}

export async function leaveInterviewCollaboration(input: z.infer<typeof inputSchema>) {
  const data = inputSchema.parse(input); const { user } = await requireAuth();
  return prisma.$transaction(async tx => { const { member, session } = await collaborationSession(tx, data, user.id); await tx.interviewPresence.deleteMany({ where: { memberId: member.id, clientId: data.clientId, sessionId: session.id } }); }, transactionOptions);
}

export async function dismissInterviewInvitation(input: z.infer<typeof inputSchema> & { invitationId: string }) {
  const data = inputSchema.extend({ invitationId: z.string().uuid() }).parse(input); const { user } = await requireAuth();
  return prisma.$transaction(async tx => { const { member } = await collaborationSession(tx, data, user.id); await tx.interviewInvitation.updateMany({ where: { id: data.invitationId, recipientId: member.id, dismissedAt: null }, data: { dismissedAt: new Date() } }); }, transactionOptions);
}

/** Issues an expiring receipt; no invitation until destination UI confirms arrival. */
export async function prepareInterviewAdvance(input: z.infer<typeof inputSchema> & { invitationId?: string }) {
  const data = inputSchema.extend({ invitationId: z.string().uuid().optional() }).parse(input); const { user } = await requireAuth();
  await prisma.$transaction(async tx => { const { record } = await collaborationSession(tx, data, user.id); if (!record.completedAt) throw Error("Finish your current review before joining."); }, transactionOptions);
  const workspace = data.invitationId ? null : await getInterviewWorkspace(data.clubId);
  const next = workspace ? nextInterviewApplicant(workspace.applications, data.roundId, data.applicationId) : null;
  return prisma.$transaction(async tx => {
    const { member, record, session } = await collaborationSession(tx, data, user.id);
    if (!record.completedAt) throw Error("Finish your current review before joining.");
    const invited = data.invitationId ? await validInvite(tx, data.invitationId, session.id, member.id, user.id) : null;
    if (!invited && !next) return null;
    const scope: InterviewScope = invited ? collaborationScope(invited.destination) : { clubId: data.clubId, applicationId: next!.id, roundId: data.roundId };
    const dest = await eligibleDestination(tx, scope, user.id);
    // Creation does not create/change a private review or pin a résumé.
    const destination = invited?.destination || await tx.interviewCollaboration.upsert({ where: { applicationId_roundId_roomKey: { applicationId: scope.applicationId, roundId: scope.roundId, roomKey: dest.roomKey } }, create: { ...scope, roomKey: dest.roomKey, questions: kitSchema.parse(dest.round.interviewKit) }, update: {} });
    const move = await tx.interviewMove.create({ data: { sourceId: session.id, destinationId: destination.id, memberId: member.id, invited: !!invited, acceptedInvitationId: invited?.invite.id || null, expiresAt: new Date(Date.now() + INVITATION_TTL_MS) } });
    return { scope, moveId: move.id };
  }, transactionOptions);
}

export async function confirmInterviewAdvance(input: { moveId: string; clientId: string }) {
  const data = z.object({ moveId: z.string().uuid(), clientId: z.string().uuid() }).parse(input); const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    let move = await tx.interviewMove.findUniqueOrThrow({ where: { id: data.moveId } });
    const source = await tx.interviewCollaboration.findUniqueOrThrow({ where: { id: move.sourceId } });
    const { member, record, session } = await collaborationSession(tx, collaborationScope(source), user.id);
    // Another tab may have confirmed while this request waited for the source
    // application lock. Read the receipt again before its immutable update.
    move = await tx.interviewMove.findUniqueOrThrow({ where: { id: data.moveId } });
    if (member.id !== move.memberId || session.id !== source.id || !record.completedAt || move.expiresAt.getTime() <= Date.now()) throw Error("Advance receipt unavailable.");
    if (move.confirmedAt) return { confirmed: true };
    if (move.acceptedInvitationId) await validInvite(tx, move.acceptedInvitationId, source.id, member.id, user.id);
    const destination = await tx.interviewCollaboration.findUniqueOrThrow({ where: { id: move.destinationId } });
    const access = await eligibleDestination(tx, collaborationScope(destination), user.id);
    if (destination.roomKey !== access.roomKey) throw Error("Destination room changed.");
    const destRecord = await tx.interviewRecord.findUnique({ where: { applicationId_interviewerId_roundId: { applicationId: destination.applicationId, roundId: destination.roundId, interviewerId: member.id } } });
    if (!destRecord) throw Error("Destination must be loaded before confirming.");
    const peers = await tx.interviewPresence.findMany({ where: { sessionId: source.id, memberId: { not: member.id }, seenAt: { gt: new Date(Date.now() - PRESENCE_TTL_MS) } } });
    if (!move.invited) for (const id of [...new Set(peers.map(p => p.memberId))]) {
      const peer = await tx.clubMember.findUnique({ where: { id } });
      if (!peer) continue;
      try {
        const old = await collaborationAccess(tx, collaborationScope(source), peer.userId);
        const next = await eligibleDestination(tx, collaborationScope(destination), peer.userId);
        if (old.roomKey === source.roomKey && next.roomKey === destination.roomKey) await tx.interviewInvitation.upsert({ where: { moveId_recipientId: { moveId: move.id, recipientId: id } }, create: { moveId: move.id, recipientId: id }, update: {} });
      } catch { /* No notification for an unauthorized destination. */ }
    }
    await tx.interviewMove.update({ where: { id: move.id }, data: { confirmedAt: new Date() } });
    await tx.interviewPresence.upsert({ where: { memberId_clientId: { memberId: member.id, clientId: data.clientId } }, create: { memberId: member.id, clientId: data.clientId, sessionId: destination.id }, update: { sessionId: destination.id, seenAt: new Date() } });
    return { confirmed: true };
  }, transactionOptions);
}
