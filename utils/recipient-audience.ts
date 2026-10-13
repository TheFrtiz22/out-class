import type { Prisma } from "@prisma/client";
import type { AppTransactionClient } from "@/utils/prisma";
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization";
import { canIdentifyRecipients } from "@/lib/communications-policy";
import { recipientAudienceSchema, type AudienceRule, type RecipientAudience } from "@/lib/recipient-audience";

const limit = 1000;
const identified = { submittedAt: { not: null }, status: { not: "DRAFTING" as const }, round: { anonymousReview: false, archivedAt: null } };
const memberScope = (clubId: string) => ({ clubId, status: "ACTIVE" as const });
const visibleScope = (clubId: string, identify: boolean): Prisma.UserWhereInput => ({ OR: [
  { memberships: { some: memberScope(clubId) } },
  ...(identify ? [{ applications: { some: { clubId, ...identified } } }] : []),
  { AND: [{ OR: [{ eventRsvps: { some: { event: { clubId } } } }, { attendances: { some: { event: { clubId } } } }] },
    { applications: { none: { clubId, submittedAt: { not: null }, round: { anonymousReview: true } } } }] },
] });
/** Shared server resolver. Caller must hold the club serialization lock through use
 * of the result. Never applies channel preferences or sends provider requests. */
export async function resolveRecipientAudience(tx: AppTransactionClient, clubId: string, actorId: string, input: unknown) {
  const audience = recipientAudienceSchema.parse(input);
  const actor = await authorizeClubTransaction(tx, clubId, actorId, ["meetings.manage"], { readOnly: true });
  const identify = canIdentifyRecipients(actor);
  let evaluatedRules = 0;
  async function rule(r: AudienceRule, stack: Set<string>): Promise<string[]> {
    if (++evaluatedRules > 100) throw Error("Audience rule graph exceeds 100 evaluations. Simplify saved groups.");
    let where: Prisma.UserWhereInput;
    if (r.source === "GROUP") {
      if (stack.has(r.groupId) || stack.size >= 5) throw Error("Group rules contain a cycle or exceed five levels.");
      const group = await tx.recipientGroup.findFirst({ where: { id: r.groupId, clubId } });
      if (!group) throw Error("Recipient group unavailable in this club.");
      const next = new Set(stack).add(group.id);
      if (group.kind === "RULES") return evaluate(recipientAudienceSchema.parse(group.rules), next);
      const entries = await tx.recipientGroupEntry.findMany({ where: { groupId: group.id, clubId }, select: { userId: true }, take: limit + 1 });
      if (entries.length > limit) throw Error("Audience exceeds 1,000 recipients.");
      return rule({ source: "PEOPLE", userIds: entries.map(e => e.userId) }, next);
    }
    if (r.source === "MEMBERS" || r.source === "OFFICERS") {
      where = { memberships: { some: { ...memberScope(clubId),
        ...(r.source === "OFFICERS" ? { OR: [{ isOwner: true }, { interviewOffices: { hasSome: ["PRESIDENT", "VICE_PRESIDENT", "BOARD"] } }, { role: { in: ["PRESIDENT", "RECRUITMENT_LEAD"] } }] } : {}),
        ...(r.accessRoles.length ? { accessRole: { in: r.accessRoles } } : {}),
        ...(r.cohorts.length ? { cohort: { in: r.cohorts } } : {}),
        ...(r.labels.length ? { groups: { hasSome: r.labels } } : {}),
        ...(r.joinedAfter || r.joinedBefore ? { joinedAt: { ...(r.joinedAfter ? { gte: new Date(r.joinedAfter) } : {}), ...(r.joinedBefore ? { lte: new Date(r.joinedBefore) } : {}) } } : {}),
      } } };
    } else if (r.source === "APPLICANTS" || r.source === "REJECTED") {
      if (!identify) throw Error("Identified applicant recipient access required.");
      if (r.roundIds.length && await tx.pipelineRound.count({ where: { clubId, id: { in: r.roundIds } } }) !== new Set(r.roundIds).size) throw Error("Round unavailable in this club.");
      const now = new Date();
      const offers: Prisma.ApplicationWhereInput[] = r.offerStatuses.map(status => status === "NONE" ? { recruitmentOffer: null }
        : status === "EXPIRED" ? { recruitmentOffer: { OR: [{ status: "EXPIRED" }, { status: "PENDING", expiresAt: { lte: now } }] } }
        : { recruitmentOffer: { status, ...(status === "PENDING" ? { expiresAt: { gt: now } } : {}) } });
      where = { applications: { some: { clubId, ...identified,
        status: r.source === "REJECTED" ? "REJECTED" : r.statuses.length ? { in: r.statuses } : { notIn: ["DRAFTING", "REJECTED"] },
        ...(r.roundIds.length ? { roundId: { in: r.roundIds } } : {}),
        ...(r.interview === "INTERVIEWING" ? { AND: [{ status: "INTERVIEWING" }] } : {}),
        ...(r.interview === "BOOKED" ? { bookings: { some: {} } } : {}),
        ...(r.interview === "UNBOOKED" ? { bookings: { none: {} } } : {}),
        ...(r.interview === "COMPLETED" ? { interviewRecords: { some: { completedAt: { not: null } } } } : {}),
        ...(offers.length ? { OR: offers } : {}),
      } } };
    } else if (r.source === "EVENT" || r.source === "LEADS") {
      if (await tx.meeting.count({ where: { clubId, id: { in: r.eventIds } } }) !== new Set(r.eventIds).size) throw Error("Event unavailable in this club.");
      const event = { clubId, id: { in: r.eventIds } };
      where = { AND: [{ OR: [
        ...(r.participation !== "ATTENDED" ? [{ eventRsvps: { some: { event } } }] : []),
        ...(r.participation !== "RSVP" ? [{ attendances: { some: { event } } }] : []),
      ] }, { applications: { none: { clubId, submittedAt: { not: null }, round: { anonymousReview: true } } } },
      ...(r.source === "LEADS" ? [{ memberships: { none: memberScope(clubId) }, applications: { none: { clubId, submittedAt: { not: null }, status: { not: "DRAFTING" as const } } } }] : [])] };
    } else if (r.source === "PEOPLE") {
      where = { id: { in: r.userIds }, ...visibleScope(clubId, identify) };
    }
    else throw Error("Unsupported audience source.");
    if ("gradYears" in r && r.gradYears.length) where = { AND: [where, { studentProfile: { gradYear: { in: r.gradYears } } }] };
    const rows = await tx.user.findMany({ where: { AND: [where, { disabledAt: null }] }, select: { id: true }, take: limit + 1, orderBy: { id: "asc" } });
    if (rows.length > limit) throw Error("Audience exceeds 1,000 recipients. Narrow the filters.");
    return rows.map(row => row.id);
  }
  async function evaluate(spec: RecipientAudience, stack: Set<string>): Promise<string[]> {
    const included = new Set<string>();
    for (const r of spec.include) for (const id of await rule(r, stack)) included.add(id);
    for (const r of spec.exclude) for (const id of await rule(r, stack)) included.delete(id);
    if (included.size > limit) throw Error("Audience exceeds 1,000 recipients. Narrow the filters.");
    return [...included].sort();
  }
  return evaluate(audience, new Set());
}
export type AudienceSnapshot = { clubId: string; audience: RecipientAudience; userIds: string[]; capturedAt: string };
export async function captureRecipientAudience(tx: AppTransactionClient, clubId: string, actorId: string, audience: unknown): Promise<AudienceSnapshot> {
  return { clubId, audience: recipientAudienceSchema.parse(audience), userIds: await resolveRecipientAudience(tx, clubId, actorId, audience), capturedAt: new Date().toISOString() };
}
/** Fixed mode preserves captured IDs, but rechecks current club visibility/account
 * and actor authority. Dynamic mode reevaluates rules and group membership. Only
 * persisted server snapshots may be passed here; never accept client snapshots. */
export async function evaluateRecipientSnapshot(tx: AppTransactionClient, clubId: string, actorId: string, snapshot: AudienceSnapshot, mode: "FIXED" | "SEND_TIME") {
  if (snapshot.clubId !== clubId) throw Error("Audience snapshot belongs to another club.");
  if (mode === "SEND_TIME") return resolveRecipientAudience(tx, clubId, actorId, snapshot.audience);
  // Fixed identities are an upper bound: loss of membership/eligibility suppresses
  // a captured recipient, but newly matching people cannot enter the snapshot.
  const current = new Set(await resolveRecipientAudience(tx, clubId, actorId, snapshot.audience));
  return [...new Set(snapshot.userIds)].filter(id => current.has(id)).sort();
}
