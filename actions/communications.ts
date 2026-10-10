"use server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { prisma } from "@/utils/prisma";
import { requireAuth, requireClubPermission } from "@/utils/auth";
import { lockOperationalClub } from "@/lib/club-suspension";
import { canIdentifyRecipients, communicationManager, conversationWhere, eligibleStudentWhere, identifiableApplication, notificationDefaults, requireCommunicationAccess } from "@/lib/communications-policy";

const uuid = z.string().uuid();
const publishInput = z.object({
  clubId: uuid,
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
  audience: z.enum(["MEMBERS", "APPLICANTS"]),
  requestKey: uuid,
}).strict();
const preferenceInput = z.object({
  emailAnnouncements: z.boolean(), emailMessages: z.boolean(),
  emailApplications: z.boolean(), emailInterviews: z.boolean(),
  emailInvitations: z.boolean(), emailTasks: z.boolean(),
  emailPlatform: z.boolean(),
  emailFrequency: z.enum(["INSTANT", "DAILY", "OFF"]),
}).strict();

export async function getNotificationPreferences() {
  const { user } = await requireAuth();
  const row = await prisma.userNotificationPreference.findUnique({ where: { userId: user.id } });
  return row ?? { userId: user.id, ...notificationDefaults };
}

export async function saveNotificationPreferences(input: unknown) {
  const { user } = await requireAuth();
  const values = preferenceInput.parse(input);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
    return tx.userNotificationPreference.upsert({ where: { userId: user.id }, create: { userId: user.id, ...values }, update: values });
  });
}

export async function getDurableNotifications(cursor?: string) {
  const { user } = await requireAuth();
  if (cursor) uuid.parse(cursor);
  const boundary = cursor ? await prisma.userNotification.findFirst({ where: { id: cursor, userId: user.id }, select: { id: true, createdAt: true } }) : null;
  if (cursor && !boundary) throw new Error("Invalid notification cursor.");
  const rows = await prisma.userNotification.findMany({
    where: { userId: user.id, archivedAt: null, ...(boundary ? { OR: [{ createdAt: { lt: boundary.createdAt } }, { createdAt: boundary.createdAt, id: { lt: boundary.id } }] } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 51,
    include: { club: { select: { name: true, color: true, logoUrl: true } } },
  });
  const unread = await prisma.userNotification.count({ where: { userId: user.id, archivedAt: null, readAt: null } });
  return { items: rows.slice(0, 50), nextCursor: rows.length > 50 ? rows[49].id : null, unread };
}

export async function setDurableNotificationsRead(ids: string[], read: boolean) {
  const { user } = await requireAuth();
  const selected = z.array(uuid).max(100).parse(ids);
  z.boolean().parse(read);
  if (!selected.length) return { updated: 0 };
  const result = await prisma.userNotification.updateMany({ where: { id: { in: selected }, userId: user.id }, data: { readAt: read ? new Date() : null } });
  return { updated: result.count };
}

export async function getClubAnnouncements(clubId: string) {
  uuid.parse(clubId);
  await requireClubPermission(clubId, ["meetings.manage"]);
  return prisma.clubAnnouncement.findMany({
    where: { clubId }, orderBy: { publishedAt: "desc" }, take: 50,
    select: { id: true, title: true, body: true, audience: true, publishedAt: true, _count: { select: { notifications: true } } },
  });
}

/** Publication and its email intent commit atomically. Provider I/O belongs to the worker. */
export async function publishClubAnnouncement(input: unknown) {
  const data = publishInput.parse(input);
  const { user } = await requireClubPermission(data.clubId, ["meetings.manage"]);
  return prisma.$transaction(async (tx) => {
    await lockOperationalClub(tx, data.clubId);
    // Recheck membership after acquiring the operational lock.
    const member = await tx.clubMember.findUnique({ where: { userId_clubId: { userId: user.id, clubId: data.clubId } } });
    if (!member || member.status !== "ACTIVE" || !(member.isOwner || member.permissions.includes("meetings.manage"))) throw new Error("Announcement publishing unavailable.");
    const previous = await tx.clubAnnouncement.findUnique({ where: { clubId_requestKey: { clubId: data.clubId, requestKey: data.requestKey } }, include: { _count: { select: { notifications: true } } } });
    if (previous) {
      if (previous.title !== data.title || previous.body !== data.body || previous.audience !== data.audience || previous.authorId !== user.id) throw new Error("This publication request was already used.");
      return { id: previous.id, recipientCount: previous._count.notifications };
    }
    if (await tx.clubAnnouncement.count({ where: { clubId: data.clubId, publishedAt: { gt: new Date(Date.now() - 3600000) } } }) >= 20) throw new Error("Please wait before publishing another announcement.");
    const recipients = data.audience === "MEMBERS"
      ? await tx.clubMember.findMany({ where: { clubId: data.clubId, status: "ACTIVE", user: { disabledAt: null } }, select: { userId: true }, take: 1001 })
      : await tx.application.findMany({ where: { clubId: data.clubId, status: { not: "DRAFTING" }, submittedAt: { not: null }, student: { disabledAt: null } }, select: { studentId: true }, take: 1001 });
    if (recipients.length > 1000) throw new Error("This audience exceeds the initial safe publishing limit of 1,000.");
    if (!recipients.length) throw new Error("No eligible recipients for this audience.");
    const announcement = await tx.clubAnnouncement.create({ data: { id: randomUUID(), clubId: data.clubId, authorId: user.id, title: data.title, body: data.body, audience: data.audience, requestKey: data.requestKey } });
    const userIds = [...new Set(recipients.map(item => "userId" in item ? item.userId : item.studentId))];
    await tx.userNotification.createMany({ data: userIds.map(userId => ({
      id: randomUUID(), userId, clubId: data.clubId, announcementId: announcement.id,
      eventKey: "announcement:" + announcement.id, type: "ANNOUNCEMENT",
      title: data.title, body: data.body,
      href: "/?workspace=student&view=inbox",
    })) });
    return { id: announcement.id, recipientCount: userIds.length };
  }, { timeout: 15000 });
}

export async function setDurableNotificationsArchived(ids: string[], archived: boolean) {
  const { user } = await requireAuth();
  const selected = z.array(uuid).max(100).parse(ids);
  z.boolean().parse(archived);
  return prisma.userNotification.updateMany({ where: { userId: user.id, id: { in: selected } }, data: { archivedAt: archived ? new Date() : null } });
}

export async function getMessagingClubs() {
  const { user } = await requireAuth();
  return prisma.club.findMany({ where: { suspendedAt: null, OR: [
    { members: { some: { userId: user.id, status: "ACTIVE" } } },
    { applications: { some: { studentId: user.id, ...identifiableApplication } } },
  ] }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 100 });
}

export async function findCommunicationRecipients(clubId: string, query: string) {
  throw new Error("Direct messaging is not available in OutClass.");
  uuid.parse(clubId);
  const search = z.string().trim().min(2).max(100).parse(query);
  const { membership } = await requireClubPermission(clubId, ["meetings.manage"]);
  const eligible = canIdentifyRecipients(membership) ? eligibleStudentWhere(clubId) : { disabledAt: null, memberships: { some: { clubId, status: "ACTIVE" as const } } };
  return prisma.user.findMany({ where: { AND: [eligible, { OR: [
    { email: { contains: search, mode: "insensitive" } },
    { studentProfile: { OR: [{ firstName: { contains: search, mode: "insensitive" } }, { lastName: { contains: search, mode: "insensitive" } }] } },
  ] }] }, select: { id: true, email: true, studentProfile: { select: { firstName: true, lastName: true } } }, orderBy: { email: "asc" }, take: 20 });
}

export async function startClubConversation(input: unknown) {
  throw new Error("Direct messaging is not available in OutClass.");
  const data = z.object({ clubId: uuid, studentId: uuid.optional(), subject: z.string().trim().min(1).max(200) }).strict().parse(input);
  const { user } = await requireAuth();
  const studentId = data.studentId ?? user.id;
  return prisma.$transaction(async tx => {
    await lockOperationalClub(tx, data.clubId);
    await requireCommunicationAccess(tx, data.clubId, studentId, user.id);
    const conversation = await tx.clubConversation.upsert({ where: { clubId_studentId: { clubId: data.clubId, studentId } }, create: { clubId: data.clubId, studentId, subject: data.subject }, update: {} });
    return { id: conversation.id };
  });
}

export async function listClubConversations(clubId?: string) {
  throw new Error("Direct messaging is not available in OutClass.");
  if (clubId) { uuid.parse(clubId); await requireClubPermission(clubId, ["meetings.manage"]); }
  const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const rows = await tx.clubConversation.findMany({ where: conversationWhere(user.id, clubId), orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 100,
      select: { id: true, clubId: true, studentId: true, subject: true, updatedAt: true, club: { select: { name: true } }, student: { select: { studentProfile: { select: { firstName: true, lastName: true } } } } } });
    const result = [];
    for (const row of rows) {
      const kind = await requireCommunicationAccess(tx, row.clubId, row.studentId, user.id).catch(() => null);
      if (!kind) continue;
      result.push({ id: row.id, subject: row.subject, clubName: row.club.name, updatedAt: row.updatedAt,
        name: kind === "CLUB" ? row.student.studentProfile ? `${row.student.studentProfile.firstName} ${row.student.studentProfile.lastName}` : "Student" : row.club.name });
    }
    return result;
  }, { timeout: 15000 });
}

export async function getClubConversation(conversationId: string, before?: string) {
  throw new Error("Direct messaging is not available in OutClass.");
  uuid.parse(conversationId); if (before) uuid.parse(before);
  const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const thread = await tx.clubConversation.findUnique({ where: { id: conversationId }, select: { id: true, clubId: true, studentId: true, subject: true } });
    if (!thread) throw new Error("This conversation is unavailable with your current access.");
    const kind = await requireCommunicationAccess(tx, thread.clubId, thread.studentId, user.id);
    const cursor = before ? await tx.clubMessage.findFirst({ where: { id: before, conversationId }, select: { id: true, createdAt: true } }) : null;
    if (before && !cursor) throw new Error("Invalid message cursor.");
    const rows = await tx.clubMessage.findMany({ where: { conversationId, ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {}) }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 51,
      select: { id: true, body: true, senderId: true, senderKind: true, createdAt: true } });
    return { id: thread.id, subject: thread.subject, kind, items: rows.slice(0, 50).reverse().map(({ senderId, ...row }) => ({ ...row, isMine: senderId === user.id })), nextCursor: rows.length > 50 ? rows[49].id : null };
  });
}

export async function sendClubMessage(input: unknown) {
  throw new Error("Direct messaging is not available in OutClass.");
  const data = z.object({ conversationId: uuid, body: z.string().trim().min(1).max(10000), requestKey: uuid }).strict().parse(input);
  const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const thread = await tx.clubConversation.findUnique({ where: { id: data.conversationId } });
    if (!thread) throw new Error("This conversation is unavailable with your current access.");
    await lockOperationalClub(tx, thread.clubId);
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR SHARE`;
    const sender = await tx.user.findUnique({ where: { id: user.id }, select: { disabledAt: true } });
    if (!sender || sender.disabledAt) throw new Error("Messaging unavailable.");
    const senderKind = await requireCommunicationAccess(tx, thread.clubId, thread.studentId, user.id);
    const existing = await tx.clubMessage.findUnique({ where: { conversationId_senderId_requestKey: { conversationId: thread.id, senderId: user.id, requestKey: data.requestKey } } });
    if (existing) {
      if (existing.body !== data.body) throw new Error("This message request was already used.");
      return { id: existing.id };
    }
    if (await tx.clubMessage.count({ where: { senderId: user.id, createdAt: { gt: new Date(Date.now() - 60000) } } }) >= 20) throw new Error("Please wait before sending another message.");
    const message = await tx.clubMessage.create({ data: { conversationId: thread.id, senderId: user.id, senderKind, body: data.body, requestKey: data.requestKey } });
    await tx.clubConversation.update({ where: { id: thread.id }, data: { updatedAt: new Date() } });
    const studentMember = await tx.clubMember.findUnique({ where: { userId_clubId: { clubId: thread.clubId, userId: thread.studentId } } });
    const recipients = senderKind === "CLUB" ? [{ userId: thread.studentId }] : await tx.clubMember.findMany({ where: { clubId: thread.clubId, ...communicationManager,
      ...(studentMember?.status === "ACTIVE" ? {} : { OR: [{ isOwner: true }, { permissions: { hasEvery: ["meetings.manage", "applicants.identify", "applications.review"] } }] }) }, select: { userId: true }, take: 1001 });
    if (recipients.length > 1000) throw new Error("This club team is too large for private message delivery.");
    if (!recipients.some(r => r.userId !== user.id) && senderKind === "STUDENT") throw new Error("This club has no available messaging team.");
    await tx.userNotification.createMany({ data: recipients.filter(r => r.userId !== user.id).map(r => ({ id: randomUUID(), userId: r.userId, clubId: thread.clubId, eventKey: `message:${message.id}`, type: "MESSAGE", title: "New private message", body: "Open your club conversation to read and reply.", href: r.userId === thread.studentId ? `/?workspace=student&view=inbox&conversation=${thread.id}` : `/club/${thread.clubId}/workspace?section=messages&conversation=${thread.id}` })) });
    return { id: message.id };
  }, { timeout: 15000 });
}
