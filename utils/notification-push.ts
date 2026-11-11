import { prisma, type AppTransactionClient } from "@/utils/prisma";
import { buildPushPayload, PUSH_MAX_AGE_MS, PUSH_MAX_FAILURES, webPushConfig } from "@/lib/web-push";

// Web Push (S1-8) is an extra channel on top of the notification email outbox, never a
// replacement. A notification is pushed only when the email worker has already decided it
// qualifies for immediate (non-digest) delivery: the same preference, currency, suspension
// and archive checks apply, and the email path itself is unchanged.
//
// Idempotency: WebPushDelivery's primary key (notificationId, subscriptionId) is created
// once with skipDuplicates, and each row is claimed PENDING -> SENDING by a conditional
// update before the network call. A row is never reclaimed, so a push is sent at most once
// per notification and subscription, even across retries, overlapping cron runs or crashes.

/** Called inside the email grouping transaction for rows assigned to instant delivery. */
export async function enqueueNotificationPushes(tx: AppTransactionClient, userId: string, notifications: { id: string; createdAt: Date }[], now = Date.now()) {
  if (!webPushConfig()) return 0;
  const fresh = notifications.filter(notification => now - +notification.createdAt < PUSH_MAX_AGE_MS);
  if (!fresh.length) return 0;
  const subscriptions = await tx.webPushSubscription.findMany({ where: { userId, failureCount: { lt: PUSH_MAX_FAILURES } }, select: { id: true } });
  if (!subscriptions.length) return 0;
  const created = await tx.webPushDelivery.createMany({
    data: fresh.flatMap(notification => subscriptions.map(subscription => ({ notificationId: notification.id, subscriptionId: subscription.id }))),
    skipDuplicates: true,
  });
  return created.count;
}

type Sender = Pick<typeof import("web-push"), "sendNotification">;

export async function processNotificationPushes(limit = 50, sender?: Sender) {
  const config = webPushConfig();
  if (!config) return { enabled: false, sent: 0, failed: 0, skipped: 0, removed: 0 };
  // Loaded only when push is configured, so the email worker never depends on it.
  const push: Sender = sender ?? await import("web-push");
  let sent = 0, failed = 0, skipped = 0, removed = 0;
  const started = Date.now();
  const pending = await prisma.webPushDelivery.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: Math.max(1, Math.min(limit, 100)), select: { notificationId: true, subscriptionId: true } });
  for (const key of pending) {
    if (Date.now() - started > 15000) break;
    // The claim is the idempotency gate: only the caller whose update matched sends.
    const claim = await prisma.webPushDelivery.updateMany({ where: { ...key, status: "PENDING" }, data: { status: "SENDING", attemptedAt: new Date() } });
    if (claim.count !== 1) continue;
    const row = await prisma.webPushDelivery.findUnique({
      where: { notificationId_subscriptionId: key },
      include: { subscription: true, notification: { include: { club: { select: { name: true, suspendedAt: true } }, user: { select: { disabledAt: true } } } } },
    });
    if (!row) continue;
    const { notification, subscription } = row;
    if (subscription.userId !== notification.userId || notification.archivedAt || notification.readAt || notification.user.disabledAt
      || notification.club?.suspendedAt || Date.now() - +notification.createdAt >= PUSH_MAX_AGE_MS || subscription.failureCount >= PUSH_MAX_FAILURES) {
      await prisma.webPushDelivery.updateMany({ where: { ...key, status: "SENDING" }, data: { status: "SKIPPED" } });
      skipped++; continue;
    }
    try {
      await push.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify(buildPushPayload(notification)),
        { vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey }, TTL: 3600, urgency: "normal", timeout: 10000 },
      );
      await prisma.webPushDelivery.updateMany({ where: { ...key, status: "SENDING" }, data: { status: "SENT" } });
      await prisma.webPushSubscription.updateMany({ where: { id: subscription.id }, data: { lastSuccessAt: new Date(), failureCount: 0 } });
      sent++;
    } catch (error) {
      const status = (error as { statusCode?: number } | null)?.statusCode;
      if (status === 404 || status === 410) {
        // The push service says this endpoint is gone: drop it (its delivery rows cascade).
        await prisma.webPushSubscription.deleteMany({ where: { id: subscription.id } });
        removed++; continue;
      }
      await prisma.webPushDelivery.updateMany({ where: { ...key, status: "SENDING" }, data: { status: "FAILED" } });
      await prisma.webPushSubscription.updateMany({ where: { id: subscription.id }, data: { failureCount: { increment: 1 } } });
      failed++;
      console.error("notification-push failed", { status: typeof status === "number" ? status : "NETWORK" });
    }
  }
  return { enabled: true, sent, failed, skipped, removed };
}
