"use server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { prisma } from "@/utils/prisma";
import { requireAuth, requireClubPermission } from "@/utils/auth";
import { lockOperationalClub } from "@/lib/club-suspension";

const uuid = z.string().uuid();
const publishInput = z.object({
  clubId: uuid,
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
  audience: z.enum(["MEMBERS", "APPLICANTS"]),
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
  return row ?? { userId: user.id, emailAnnouncements: true, emailMessages: true, emailApplications: true, emailInterviews: true, emailInvitations: true, emailTasks: true, emailPlatform: false, emailFrequency: "INSTANT" };
}

export async function saveNotificationPreferences(input: unknown) {
  const { user } = await requireAuth();
  const values = preferenceInput.parse(input);
  return prisma.userNotificationPreference.upsert({ where: { userId: user.id }, create: { userId: user.id, ...values }, update: values });
}

export async function getDurableNotifications(cursor?: string) {
  const { user } = await requireAuth();
  if (cursor) uuid.parse(cursor);
  const rows = await prisma.userNotification.findMany({
    where: { userId: user.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 51,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: { club: { select: { name: true, color: true, logoUrl: true } } },
  });
  return { items: rows.slice(0, 50), nextCursor: rows.length > 50 ? rows[49].id : null };
}

export async function setDurableNotificationsRead(ids: string[], read: boolean) {
  const { user } = await requireAuth();
  const selected = z.array(uuid).max(100).parse(ids);
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

/** No email is sent in this phase: publication is an in-app-only operation. */
export async function publishClubAnnouncement(input: unknown) {
  const data = publishInput.parse(input);
  const { user } = await requireClubPermission(data.clubId, ["meetings.manage"]);
  return prisma.$transaction(async (tx) => {
    await lockOperationalClub(tx, data.clubId);
    // Recheck membership after acquiring the operational lock.
    const member = await tx.clubMember.findUnique({ where: { userId_clubId: { userId: user.id, clubId: data.clubId } } });
    if (!member || member.status !== "ACTIVE" || !(member.isOwner || member.permissions.includes("meetings.manage"))) throw new Error("Announcement publishing unavailable.");
    const recipients = data.audience === "MEMBERS"
      ? await tx.clubMember.findMany({ where: { clubId: data.clubId, status: "ACTIVE", user: { disabledAt: null } }, select: { userId: true }, take: 1001 })
      : await tx.application.findMany({ where: { clubId: data.clubId, submittedAt: { not: null }, student: { disabledAt: null } }, select: { studentId: true }, take: 1001 });
    if (recipients.length > 1000) throw new Error("This audience exceeds the initial safe publishing limit of 1,000.");
    if (!recipients.length) throw new Error("No eligible recipients for this audience.");
    const announcement = await tx.clubAnnouncement.create({ data: { id: randomUUID(), clubId: data.clubId, authorId: user.id, title: data.title, body: data.body, audience: data.audience } });
    const userIds = [...new Set(recipients.map(item => "userId" in item ? item.userId : item.studentId))];
    await tx.userNotification.createMany({ data: userIds.map(userId => ({
      id: randomUUID(), userId, clubId: data.clubId, announcementId: announcement.id,
      eventKey: "announcement:" + announcement.id, type: "ANNOUNCEMENT",
      title: data.title, body: data.body,
      href: "/?workspace=student&view=inbox",
    })) });
    return { id: announcement.id, recipientCount: userIds.length };
  });
}
