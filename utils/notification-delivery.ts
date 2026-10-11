import { randomUUID } from "node:crypto";
import { prisma } from "@/utils/prisma";
import { nextDigestAt, optionalEmailAllowed, requireCommunicationAccess } from "@/lib/communications-policy";
import { buildNotificationEmail, communicationEmailConfig, NotificationDeliveryError, notificationEmailPayload, sendNotificationEmail } from "@/lib/notification-email";

// Retry the exact persisted payload inside Resend's 24-hour deduplication window.
// A crash outside that window requires receipt reconciliation, never a blind resend.
const RETRY_WINDOW_MS = 23 * 3600000;
export async function processNotificationEmails(limit = 10) {
  const config = communicationEmailConfig();
  if (!config) return { enabled: false, sent: 0, failed: 0, suppressed: 0 };
  const batchSize = Math.max(1, Math.min(limit, 25)), started = Date.now();
  let sent = 0, failed = 0, suppressed = 0;
  // Capture recipients with pending intent, even if instant email is disabled now.
  // Preferences are evaluated before grouping and again on every send/retry.
  const pending = await prisma.$queryRaw<{ userId: string }[]>`
    SELECT n."userId" FROM "NotificationEmailOutbox" o JOIN "UserNotification" n ON n.id=o."notificationId"
    LEFT JOIN "UserNotificationPreference" p ON p."userId"=n."userId"
    WHERE o.status='PENDING' AND (COALESCE(p."emailFrequency",'INSTANT')<>'DAILY' OR o."createdAt"<date_trunc('day',CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))
    GROUP BY n."userId" ORDER BY MIN(o."createdAt") LIMIT ${batchSize}`;
  const users = pending.map(row => row.userId);
  for (const userId of users) {
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: userId }, include: { notificationPreferences: true } });
      if (!user) return;
      const rows = await tx.notificationEmailOutbox.findMany({ where: { status: "PENDING", notification: { userId } }, include: { notification: { include: { club: { select: { name: true, suspendedAt: true } } } } }, orderBy: { createdAt: "asc" }, take: 100 });
      const eligible = [];
      for (const row of rows) {
        if (user.disabledAt || row.notification.archivedAt || !optionalEmailAllowed(user.notificationPreferences, row.notification.type)) {
          await tx.notificationEmailOutbox.update({ where: { notificationId: row.notificationId }, data: { status: "SUPPRESSED" } }); suppressed++; continue;
        }
        if (row.notification.club?.suspendedAt) continue;
        if (row.notification.type === "MESSAGE") {
          const conversationId = new URL(row.notification.href, config.siteUrl).searchParams.get("conversation");
          const conversation = conversationId ? await tx.clubConversation.findUnique({ where: { id: conversationId }, select: { clubId: true, studentId: true } }) : null;
          if (!conversation || !await requireCommunicationAccess(tx, conversation.clubId, conversation.studentId, userId).catch(() => null)) {
            await tx.notificationEmailOutbox.update({ where: { notificationId: row.notificationId }, data: { status: "SUPPRESSED" } }); suppressed++; continue;
          }
        }
        if (user.notificationPreferences?.emailFrequency === "DAILY" && nextDigestAt(row.createdAt) > new Date()) continue;
        eligible.push(row);
      }
      if (!eligible.length) return;
      const groups = user.notificationPreferences?.emailFrequency === "DAILY" ? [eligible] : eligible.map(row => [row]);
      for (const group of groups.slice(0, batchSize)) {
        const payload = buildNotificationEmail({ from: config.from, to: user.email, siteUrl: config.siteUrl, digest: user.notificationPreferences?.emailFrequency === "DAILY", items: group.map(row => row.notification) });
        const delivery = await tx.notificationEmailDelivery.create({ data: { userId, payload } });
        await tx.notificationEmailOutbox.updateMany({ where: { notificationId: { in: group.map(row => row.notificationId) }, status: "PENDING" }, data: { status: "ASSIGNED", deliveryId: delivery.id } });
      }
    }, { timeout: 15000 });
  }
  const now = new Date();
  const candidates = await prisma.notificationEmailDelivery.findMany({ where: { OR: [{ status: "QUEUED", nextAttemptAt: { lte: now } }, { status: "SENDING", leaseUntil: { lt: now } }] }, select: { id: true }, orderBy: { createdAt: "asc" }, take: batchSize });
  for (const candidate of candidates) {
    if (Date.now() - started > 35000) break;
    const claim = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "NotificationEmailDelivery" WHERE id=${candidate.id} FOR UPDATE`;
      const row = await tx.notificationEmailDelivery.findUniqueOrThrow({ where: { id: candidate.id }, include: { user: { include: { notificationPreferences: true } }, items: { include: { notification: { include: { club: { select: { suspendedAt: true } } } } } } } });
      if (!(row.status === "QUEUED" && row.nextAttemptAt <= new Date() || row.status === "SENDING" && row.leaseUntil && row.leaseUntil < new Date())) return null;
      const payload = notificationEmailPayload.parse(row.payload);
      let inaccessibleMessage = false;
      for (const item of row.items.filter(item => item.notification.type === "MESSAGE")) {
        const conversationId = new URL(item.notification.href, config.siteUrl).searchParams.get("conversation");
        const conversation = conversationId ? await tx.clubConversation.findUnique({ where: { id: conversationId }, select: { clubId: true, studentId: true } }) : null;
        if (!conversation || !await requireCommunicationAccess(tx, conversation.clubId, conversation.studentId, row.userId).catch(() => null)) inaccessibleMessage = true;
      }
      if (inaccessibleMessage || row.user.disabledAt || row.user.email !== payload.to || payload.categories.some(type => !optionalEmailAllowed(row.user.notificationPreferences, type)) || row.items.some(item => item.notification.archivedAt)) {
        await tx.notificationEmailDelivery.update({ where: { id: row.id }, data: { status: "SUPPRESSED", failureCode: "PREFERENCE_OR_ACCOUNT_CHANGED", leaseToken: null, leaseUntil: null } }); suppressed++; return null;
      }
      if (row.items.some(item => item.notification.club?.suspendedAt)) return null;
      if (row.firstAttemptAt && Date.now() - +row.firstAttemptAt >= RETRY_WINDOW_MS || row.attemptCount >= 8) {
        await tx.notificationEmailDelivery.update({ where: { id: row.id }, data: { status: "UNCERTAIN", failureCode: "RECEIPT_RECONCILIATION_REQUIRED", leaseToken: null, leaseUntil: null } }); failed++; return null;
      }
      // A frequency change before the first attempt postpones instant mail.
      if (!row.firstAttemptAt && !payload.digest && row.user.notificationPreferences?.emailFrequency === "DAILY" && nextDigestAt(row.createdAt) > new Date()) {
        await tx.notificationEmailDelivery.update({ where: { id: row.id }, data: { nextAttemptAt: nextDigestAt(row.createdAt) } }); return null;
      }
      const token = randomUUID();
      await tx.notificationEmailDelivery.update({ where: { id: row.id }, data: { status: "SENDING", leaseToken: token, leaseUntil: new Date(Date.now() + 60000), firstAttemptAt: row.firstAttemptAt ?? new Date(), attemptCount: { increment: 1 } } });
      return { ...row, payload, token };
    });
    if (!claim) continue;
    try {
      const receipt = await sendNotificationEmail(claim.payload, claim.id, config.key);
      await prisma.notificationEmailDelivery.updateMany({ where: { id: claim.id, status: "SENDING", leaseToken: claim.token }, data: { status: "SENT", sentAt: new Date(), providerMessageId: receipt.id, failureCode: null, leaseToken: null, leaseUntil: null } });
      sent++;
    } catch (error) {
      const retryable = !(error instanceof NotificationDeliveryError) || error.retryable;
      const exhausted = claim.attemptCount + 1 >= 8;
      const delay = Math.max(30000 * 2 ** claim.attemptCount + Math.floor(Math.random() * 5000), error instanceof NotificationDeliveryError ? error.retryAfterMs : 0);
      await prisma.notificationEmailDelivery.updateMany({ where: { id: claim.id, status: "SENDING", leaseToken: claim.token }, data: { status: retryable ? exhausted ? "UNCERTAIN" : "QUEUED" : "FAILED", nextAttemptAt: new Date(Date.now() + delay), failureCode: error instanceof NotificationDeliveryError ? error.code : "RECEIPT_PERSISTENCE_UNAVAILABLE", leaseToken: null, leaseUntil: null } });
      failed++;
    }
  }
  return { enabled: true, sent, failed, suppressed };
}
