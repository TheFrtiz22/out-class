import { createHash } from "node:crypto";
import { prisma } from "@/utils/prisma";

/** Only a revision and count cross the stream. Content uses authorized loaders. */
export async function communicationsSnapshot(userId: string) {
  const [account, notifications, unread, conversations] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { disabledAt: true } }),
    prisma.userNotification.aggregate({ where: { userId }, _count: { id: true }, _max: { updatedAt: true } }),
    prisma.userNotification.count({ where: { userId, archivedAt: null, readAt: null } }),
    prisma.$queryRaw<{ updatedAt: Date; count: bigint }[]>`
      SELECT MAX(c."updatedAt") AS "updatedAt", COUNT(*) AS count FROM "ClubConversation" c
      JOIN "Club" club ON club.id=c."clubId" JOIN "User" student ON student.id=c."studentId"
      WHERE club."suspendedAt" IS NULL AND student."disabledAt" IS NULL
        AND (EXISTS(SELECT 1 FROM "ClubMember" s WHERE s."clubId"=c."clubId" AND s."userId"=c."studentId" AND s.status='ACTIVE')
          OR EXISTS(SELECT 1 FROM "Application" a JOIN "PipelineRound" r ON r.id=a."roundId" WHERE a."clubId"=c."clubId" AND a."studentId"=c."studentId" AND a."submittedAt" IS NOT NULL AND a.status<>'DRAFTING' AND r."anonymousReview"=false AND r."archivedAt" IS NULL))
        AND (c."studentId"=${userId} OR EXISTS(SELECT 1 FROM "ClubMember" m WHERE m."clubId"=c."clubId" AND m."userId"=${userId} AND m.status='ACTIVE'
          AND (m."isOwner" OR 'meetings.manage'=ANY(m.permissions))
          AND (m."isOwner" OR ('applicants.identify'=ANY(m.permissions) AND 'applications.review'=ANY(m.permissions))
            OR EXISTS(SELECT 1 FROM "ClubMember" s WHERE s."clubId"=c."clubId" AND s."userId"=c."studentId" AND s.status='ACTIVE'))))`,
  ]);
  if (!account || account.disabledAt) throw new Error("Account access unavailable.");
  const revision = createHash("sha256").update(JSON.stringify([notifications._count.id, notifications._max.updatedAt, unread, conversations.map(row => [row.updatedAt, String(row.count)])])).digest("hex");
  return { revision, unread };
}
