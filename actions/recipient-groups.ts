"use server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireClubPermission } from "@/utils/auth";
import { clubWriteTransaction } from "@/utils/club-write-transaction";
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization";
import { hasPermission } from "@/lib/permissions";
import { recipientAudienceSchema, audienceKey, audienceCapabilities } from "@/lib/recipient-audience";
import { resolveRecipientAudience } from "@/utils/recipient-audience";
const uuid = z.string().uuid();
const saveInput = z.object({ clubId: uuid, id: uuid, revision: z.number().int().nonnegative().nullable(), name: z.string().trim().min(1).max(100),
  kind: z.enum(["MANUAL", "RULES"]), userIds: z.array(uuid).max(1000).default([]), rules: recipientAudienceSchema.optional(),
}).strict().superRefine((d,ctx)=>{
  if (d.kind === "RULES" && (!d.rules || d.userIds.length || [...d.rules.include, ...d.rules.exclude].some(r=>r.source === "PEOPLE")) || d.kind === "MANUAL" && d.rules) ctx.addIssue({code:"custom",message:"Choose manual recipients or audience rules."});
});
export async function previewRecipientAudience(clubId: string, input: unknown) {
  uuid.parse(clubId);
  const { user } = await requireClubPermission(clubId, ["meetings.manage"]);
  return clubWriteTransaction(async tx => {
    const ids = await resolveRecipientAudience(tx, clubId, user.id, input);
    const recipients = await tx.user.findMany({ where: { id: { in: ids } }, orderBy: { email: "asc" },
      select: { id: true, email: true, studentProfile: { select: { firstName: true, lastName: true } } }, take: 1000 });
    return { count: ids.length, recipients, evaluatedAt: new Date().toISOString(), capabilities: audienceCapabilities };
  });
}
export async function getRecipientGroups(clubId: string) {
  uuid.parse(clubId);
  const { user } = await requireClubPermission(clubId, ["meetings.manage"]);
  return clubWriteTransaction(async tx => {
    const member = await authorizeClubTransaction(tx, clubId, user.id, ["meetings.manage"], { readOnly: true });
    const groups = await tx.recipientGroup.findMany({ where: { clubId }, orderBy: { name: "asc" }, take: 101 });
    if (groups.length > 100) throw Error("This club exceeds the 100-group limit.");
    // Counts and identities are resolved on demand, never leaked from a stored group.
    return { groups, canEdit: hasPermission(member, "members.manage"), capabilities: audienceCapabilities,
      cohorts: (await tx.clubMember.findMany({ where: { clubId, status: "ACTIVE", cohort: { not: null } }, select: { cohort: true }, distinct: ["cohort"], take: 100 })).map(r=>r.cohort!),
      cycles: await tx.recruitmentCycle.findMany({where:{clubId},select:{id:true,name:true},orderBy:{createdAt:"desc"},take:100}),
      rounds: await tx.pipelineRound.findMany({ where: { clubId, archivedAt: null, anonymousReview: false }, select: { id: true, name: true }, orderBy: { order: "asc" }, take: 100 }),
      events: await tx.meeting.findMany({ where: { clubId }, select: { id: true, title: true }, orderBy: { date: "desc" }, take: 100 }),
    };
  });
}
export async function saveRecipientGroup(input: unknown) {
  const d = saveInput.parse(input);
  const { user } = await requireClubPermission(d.clubId, ["meetings.manage", "members.manage"]);
  return clubWriteTransaction(async tx => {
    await authorizeClubTransaction(tx, d.clubId, user.id, ["meetings.manage", "members.manage"]);
    const previous = await tx.recipientGroup.findFirst({ where: { id: d.id, clubId: d.clubId } });
    const ids = [...new Set(d.userIds)].sort();
    const rules = d.kind === "RULES" ? d.rules! : null;
    if (previous) {
      const entries = await tx.recipientGroupEntry.findMany({ where: { groupId: d.id, clubId: d.clubId }, select: { userId: true }, orderBy: { userId: "asc" } });
      if (previous.kind === d.kind && previous.name === d.name && audienceKey(previous.rules) === audienceKey(rules) && audienceKey(entries.map(e=>e.userId)) === audienceKey(ids)) return previous;
      if (d.revision === null || previous.revision !== d.revision) throw Error("Group changed. Reload before saving.");
    } else if (d.revision !== null) throw Error("Recipient group unavailable in this club.");
    const spec = d.kind === "MANUAL" ? { include: [{ source: "PEOPLE", userIds: ids }] } : rules;
    const resolved = await resolveRecipientAudience(tx, d.clubId, user.id, spec);
    if (d.kind === "MANUAL" && resolved.length !== ids.length) throw Error("One or more recipients are unavailable in this club.");
    if (!previous && await tx.recipientGroup.count({ where: { clubId: d.clubId } }) >= 100) throw Error("A club can have up to 100 recipient groups.");
    const data = { name: d.name, kind: d.kind, rules: rules ?? Prisma.DbNull };
    const group = previous ? await tx.recipientGroup.update({ where: { id: d.id }, data: { ...data, revision: { increment: 1 } } })
      : await tx.recipientGroup.create({ data: { id: d.id, clubId: d.clubId, ...data } });
    await tx.recipientGroupEntry.deleteMany({ where: { groupId: d.id, clubId: d.clubId } });
    if (ids.length) await tx.recipientGroupEntry.createMany({ data: ids.map(userId=>({ groupId: d.id, clubId: d.clubId, userId })) });
    // Resolve the saved graph too: updating an indirect dependency must not create cycles.
    await resolveRecipientAudience(tx, d.clubId, user.id, { include: [{ source: "GROUP", groupId: d.id }] });
    await tx.auditLog.create({ data: { actorId: user.id, clubId: d.clubId, action: "recipient.group.save", targetId: d.id, details: { kind: d.kind, revision: group.revision, recipients: resolved.length } } });
    return group;
  });
}
export async function deleteRecipientGroup(clubId: string, groupId: string, revision: number) {
  uuid.parse(clubId); uuid.parse(groupId); z.number().int().nonnegative().parse(revision);
  const { user } = await requireClubPermission(clubId, ["meetings.manage", "members.manage"]);
  return clubWriteTransaction(async tx => {
    await authorizeClubTransaction(tx, clubId, user.id, ["meetings.manage", "members.manage"]);
    const group = await tx.recipientGroup.findFirst({ where: { id: groupId, clubId, revision } });
    if (!group) throw Error("Group unavailable or changed. Reload before deleting.");
    const others = await tx.recipientGroup.findMany({ where: { clubId, kind: "RULES", id: { not: groupId } }, select: { rules: true }, take: 100 });
    if (others.some(g=>{const r=recipientAudienceSchema.parse(g.rules);return [...r.include,...r.exclude].some(rule=>rule.source==="GROUP"&&rule.groupId===groupId);})) throw Error("Remove this group from other saved rules first.");
    await tx.recipientGroup.delete({ where: { id: groupId } });
    await tx.auditLog.create({ data: { actorId: user.id, clubId, action: "recipient.group.delete", targetId: groupId } });
    return { deleted: true };
  });
}
