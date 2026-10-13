"use server";
import { z } from "zod";
import { recipientAudienceSchema } from "@/lib/recipient-audience";
import { publishAnnouncementTransaction } from "@/utils/announcement-publication";
import { clubWriteTransaction } from "@/utils/club-write-transaction";
import { authorizeClubTransaction } from '@/lib/club-transaction-authorization';
import { letterTemplatesSchema, type LetterContent } from '@/lib/decision-letters';
import { Prisma } from '@prisma/client';
import { prisma } from "@/utils/prisma";
import { requireAuth, requireClubPermission } from "@/utils/auth";
import { identifiableApplication, notificationDefaults } from "@/lib/communications-policy";
import { panelScheduleNotificationPrefix,currentPanelScheduleNotification } from "@/utils/official-panel-schedule";
import { assignmentNotificationPrefix, currentAssignmentNotification } from "@/utils/interview-assignment-notifications";

const uuid = z.string().uuid();
const publishInput = z.object({
  clubId: uuid,
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
  audience: z.enum(["MEMBERS", "APPLICANTS", "CUSTOM"]),
  audienceSpec: recipientAudienceSchema.optional(),
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
  const items = await prisma.$transaction(async tx => {
    const contexts = new Map<string, ReturnType<typeof currentAssignmentNotification>>();
    return Promise.all(rows.slice(0, 50).map(async row => {
    if(row.eventKey?.startsWith(panelScheduleNotificationPrefix)){const context=await currentPanelScheduleNotification(tx,row,user.id);return {...row,...(context?{title:context.title,body:context.body,href:context.href}:{title:"Interview panel schedule changed",body:"Your assignment is no longer available. Check your current official interview schedule.",href:"/settings/interviews"})}}
    if (!row.eventKey?.startsWith(assignmentNotificationPrefix)) return row;
    // Several reschedule notices can refer to the same current authorized context.
    const key = `${row.clubId}:${row.href}:${row.eventKey.includes(":cancelled:")}`;
    if (!contexts.has(key)) contexts.set(key, currentAssignmentNotification(tx, row, user.id));
    const context = await contexts.get(key)!;
    return { ...row, ...(context || { title: "Interview assignment changed", body: "This assignment is no longer available. Check your current interview list.", href: `/club/${row.clubId}/workspace?section=recruitment&tool=interviews` }) };
    }));
  }, { maxWait: 10000, timeout: 20000 });
  return { items, nextCursor: rows.length > 50 ? rows[49].id : null, unread };
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
  if ((data.audience === "CUSTOM") !== !!data.audienceSpec) throw Error("Custom audience rules are required only for custom recipients.");
  const { user } = await requireClubPermission(data.clubId, ["meetings.manage"]);
  return clubWriteTransaction(tx => publishAnnouncementTransaction(tx, { ...data, senderId: user.id }));
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

// Retained exports reject old clients without touching Auth, database, or email.
export async function findCommunicationRecipients(_clubId: string, _query: string): Promise<never> {
  throw new Error("Direct messaging is not available in OutClass.");
}
export async function startClubConversation(_input: unknown): Promise<never> {
  throw new Error("Direct messaging is not available in OutClass.");
}
export async function listClubConversations(_clubId?: string): Promise<never> {
  throw new Error("Direct messaging is not available in OutClass.");
}
export async function getClubConversation(_conversationId: string, _before?: string): Promise<never> {
  throw new Error("Direct messaging is not available in OutClass.");
}
export async function sendClubMessage(_input: unknown): Promise<never> {
  throw new Error("Direct messaging is not available in OutClass.");
}

export async function getDecisionLetter(applicationId:string,letterId?:string) {
 z.string().uuid().parse(applicationId);if(letterId)z.string().uuid().parse(letterId);
 const {user}=await requireAuth();
 const app=await prisma.application.findFirst({where:{id:applicationId,studentId:user.id},select:{id:true,status:true,decisionVersion:true,clubId:true,club:{select:{name:true,logoUrl:true,color:true,suspendedAt:true}},recruitmentOffer:{select:{status:true,expiresAt:true}},decisionLetters:{where:letterId?{id:letterId}:{},orderBy:{version:'desc'},take:1,select:{id:true,version:true,decision:true,content:true,createdAt:true}}}});
 if(!app)return null;
 if(!app.decisionLetters[0]||!letterId&&app.decisionLetters[0].version!==app.decisionVersion) {
  if(letterId||!['ACCEPTED','WAITLISTED','REJECTED'].includes(app.status))return null;
  const notification=await prisma.userNotification.findUnique({where:{userId_eventKey:{userId:user.id,eventKey:`decision:${app.id}:${app.decisionVersion}`}},select:{id:true}});
  return {notificationId:notification?.id,applicationId:app.id,clubId:app.clubId,currentStatus:app.status,isCurrent:true,suspended:!!app.club.suspendedAt,offer:app.recruitmentOffer,letter:null};
 }
 const letter=app.decisionLetters[0];
 const notification=await prisma.userNotification.findUnique({where:{userId_eventKey:{userId:user.id,eventKey:`decision:${app.id}:${letter.version}`}},select:{id:true}});
 return {notificationId:notification?.id,applicationId:app.id,clubId:app.clubId,currentStatus:app.status,isCurrent:letter.version===app.decisionVersion,suspended:!!app.club.suspendedAt,offer:app.recruitmentOffer,letter:{...letter,content:letter.content as unknown as LetterContent}};
}
export async function getDecisionTemplates(clubId:string) {
 z.string().uuid().parse(clubId);await requireClubPermission(clubId,['recruitment.manage']);
 const club=await prisma.club.findUniqueOrThrow({where:{id:clubId},select:{name:true,logoUrl:true,color:true,decisionLetterTemplates:true,sendFormalDecisionLetters:true}});
 return {...club,templates:letterTemplatesSchema.parse(club.decisionLetterTemplates ?? {})};
}
export async function saveDecisionTemplates(clubId:string,input:unknown) {
 z.string().uuid().parse(clubId);const templates=letterTemplatesSchema.parse(input);
 const {user}=await requireClubPermission(clubId,['recruitment.manage']);
 await clubWriteTransaction(async tx=>{
  await authorizeClubTransaction(tx,clubId,user.id,['recruitment.manage']);
  await tx.club.update({where:{id:clubId},data:{decisionLetterTemplates:templates as Prisma.InputJsonValue}});
  await tx.auditLog.create({data:{actorId:user.id,clubId,targetId:clubId,action:'recruitment.letter.templates.updated',details:{types:Object.keys(templates)}}});
 });return {success:true};
}

export async function setFormalDecisionLetters(clubId:string, enabled:boolean) {
 uuid.parse(clubId);z.boolean().parse(enabled);
 const {user}=await requireClubPermission(clubId,['recruitment.manage']);
 return clubWriteTransaction(async tx=>{
  await authorizeClubTransaction(tx,clubId,user.id,['recruitment.manage']);
  await tx.club.update({where:{id:clubId},data:{sendFormalDecisionLetters:enabled}});
  await tx.auditLog.create({data:{actorId:user.id,clubId,targetId:clubId,action:'recruitment.letter.setting.updated',details:{enabled}}});
  return {success:true};
 });
}
