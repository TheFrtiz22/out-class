import { prisma } from "@/utils/prisma";
import { optionalEmailAllowed } from "@/lib/communications-policy";
import { buildPushPayload, nativePushConfig, nativePushToken, parsePushSubscription, pushRecipients, PUSH_MAX_AGE_MS, PUSH_MAX_FAILURES, webPushConfig } from "@/lib/web-push";
import { notificationStillCurrent } from "@/utils/notification-currency";

// Web Push (S1-8) is an extra channel on top of the notification email outbox, never a
// replacement. A notification is queued only after the email worker's grouping transaction
// has committed it to instant (non-digest) delivery, and it is sent only while that email
// delivery is still live (QUEUED, SENDING or SENT) and the email claim's own access and
// currency checks still pass. Nothing here can roll back, block or fail an email.
//
// Idempotency: WebPushDelivery's primary key (notificationId, subscriptionId) is created
// once with skipDuplicates, and each row is claimed PENDING -> SENDING by a conditional
// update before the network call. A row is never reclaimed, so a push is sent at most once
// per notification and subscription, even across retries, overlapping cron runs or crashes.

const BUDGET_MS = 40000;          // the cron's maxDuration is 60 s; push stops starting work after 40 s
const HARD_STOP_MS = 48000;       // and no send may run past 48 s, leaving margin under 60 s
const SEND_TIMEOUT_MS = 10000;
const RETENTION_MS = 7 * 24 * 3600000;
const RETENTION_BATCH = 500;
const LIVE_EMAIL = ["QUEUED", "SENDING", "SENT"];
const URL_BASE = "https://outclass.invalid";

/** Called after the email grouping transaction commits. Errors are logged, never thrown. */
export async function enqueueNotificationPushes(userId: string, notifications: { id: string; createdAt: Date }[], now = Date.now()) {
  try {
    // Native push (the app) is a second channel of this same path: its devices are rows of the same table.
    const enabled = { web: !!webPushConfig(), native: !!nativePushConfig() };
    if (!enabled.web && !enabled.native) return 0;
    const fresh = notifications.filter(notification => now - +notification.createdAt < PUSH_MAX_AGE_MS);
    if (!fresh.length) return 0;
    // One push per event per device: a phone with the app does not also get its browser's web push.
    const subscriptions = pushRecipients(await prisma.webPushSubscription.findMany({ where: { userId, failureCount: { lt: PUSH_MAX_FAILURES } }, select: { id: true, kind: true, platform: true } }), enabled);
    let created = 0;
    // One insert per subscription, so a subscription deleted in between (FK 23503) skips only itself.
    for (const subscription of subscriptions) {
      try {
        created += (await prisma.webPushDelivery.createMany({ data: fresh.map(notification => ({ notificationId: notification.id, subscriptionId: subscription.id })), skipDuplicates: true })).count;
      } catch (error) {
        if (!isForeignKeyError(error)) throw error;
        console.error("notification-push enqueue skipped a removed subscription", { code: "23503" });
      }
    }
    return created;
  } catch (error) {
    console.error("notification-push enqueue failed", { code: errorCode(error) });
    return 0;
  }
}

function isForeignKeyError(error: unknown) {
  const e = error as { code?: string; meta?: { code?: string } } | null;
  return e?.code === "P2003" || e?.code === "23503" || e?.meta?.code === "23503";
}
function errorCode(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[A-Z0-9_]{1,20}$/.test(code) ? code : error instanceof Error ? error.name : "UNKNOWN";
}
/** 429, 5xx and network/timeouts are the push service's problem, not the subscription's. */
export function transientPushError(status: number | undefined) {
  return typeof status !== "number" || status === 429 || status >= 500;
}

type Sender = Pick<typeof import("web-push"), "sendNotification">;
/** Sends one native push. Resolves "gone" when the push service says the device token is no longer registered. */
export type NativeSender = (message: { to: string; title: string; body: string; data: { url: string } }, options: { accessToken: string | null; url: string; timeout: number }) => Promise<"sent" | "gone">;
type Options = { startedAt?: number; now?: () => number; sender?: Sender; nativeSender?: NativeSender };

/** Expo's push service. A non-2xx answer or a ticket error other than DeviceNotRegistered throws with `statusCode`. */
export const expoPushSender: NativeSender = async (message, { accessToken, url, timeout }) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    body: JSON.stringify({ ...message, sound: "default", priority: "default", ttl: 3600, channelId: "default" }),
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw Object.assign(new Error("Expo push request failed"), { statusCode: response.status });
  const ticket = ((await response.json()) as { data?: { status?: string; details?: { error?: string } } | { status?: string; details?: { error?: string } }[] }).data;
  const first = Array.isArray(ticket) ? ticket[0] : ticket;
  if (first?.status === "ok") return "sent";
  if (first?.details?.error === "DeviceNotRegistered") return "gone";
  // InvalidCredentials, MessageTooBig, MessageRateExceeded: 429 is transient, the rest count against the device.
  throw Object.assign(new Error("Expo push ticket error"), { statusCode: first?.details?.error === "MessageRateExceeded" ? 429 : 400 });
};

export async function processNotificationPushes(limit = 50, { startedAt, now = Date.now, sender, nativeSender = expoPushSender }: Options = {}) {
  const config = webPushConfig(), native = nativePushConfig();
  if (!config && !native) return { enabled: false, sent: 0, failed: 0, skipped: 0, removed: 0, pruned: 0 };
  const start = startedAt ?? now();
  let sent = 0, failed = 0, skipped = 0, removed = 0, pruned = 0;
  if (now() - start > BUDGET_MS) return { enabled: true, sent, failed, skipped, removed, pruned, deferred: true };
  // Retention: delivery rows are only an idempotency ledger; a week is far past any resend.
  const expired = await prisma.webPushDelivery.findMany({ where: { createdAt: { lt: new Date(now() - RETENTION_MS) } }, take: RETENTION_BATCH, select: { notificationId: true, subscriptionId: true } });
  if (expired.length) pruned = (await prisma.webPushDelivery.deleteMany({ where: { OR: expired } })).count;
  // Loaded only when push is configured, so the email worker never depends on it.
  const push: Sender | null = config ? sender ?? await import("web-push") : null;
  const pending = await prisma.webPushDelivery.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: Math.max(1, Math.min(limit, 100)), select: { notificationId: true, subscriptionId: true } });
  for (const key of pending) {
    if (now() - start > BUDGET_MS) break;
    // The claim is the idempotency gate: only the caller whose update matched sends.
    const claim = await prisma.webPushDelivery.updateMany({ where: { ...key, status: "PENDING" }, data: { status: "SENDING", attemptedAt: new Date(now()) } });
    if (claim.count !== 1) continue;
    const skip = async () => { await prisma.webPushDelivery.updateMany({ where: { ...key, status: "SENDING" }, data: { status: "SKIPPED" } }); skipped++; };
    const row = await prisma.webPushDelivery.findUnique({
      where: { notificationId_subscriptionId: key },
      include: { subscription: true, notification: { include: { club: { select: { name: true, suspendedAt: true } }, user: { select: { disabledAt: true, notificationPreferences: true } }, emailOutbox: { select: { status: true, delivery: { select: { status: true } } } } } } },
    });
    if (!row) continue;
    const { notification, subscription } = row;
    const deviceToken = subscription.kind === "EXPO" ? nativePushToken(subscription.endpoint) : null;
    const stored = subscription.kind === "EXPO" ? null : parsePushSubscription({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } });
    // A channel switched off after queueing: leave the row out rather than send through it.
    if (subscription.kind === "EXPO" ? !native : !config || !push) { await skip(); continue; }
    if (subscription.kind === "EXPO" ? !deviceToken : !stored || stored.endpoint !== subscription.endpoint) {
      // Never POST to an endpoint that would not be accepted today.
      await prisma.webPushSubscription.deleteMany({ where: { id: subscription.id } });
      removed++; continue;
    }
    const emailLive = notification.emailOutbox?.status === "ASSIGNED" && LIVE_EMAIL.includes(notification.emailOutbox.delivery?.status ?? "");
    if (!emailLive || subscription.userId !== notification.userId || notification.archivedAt || notification.readAt || notification.user.disabledAt
      || notification.club?.suspendedAt || now() - +notification.createdAt >= PUSH_MAX_AGE_MS || subscription.failureCount >= PUSH_MAX_FAILURES
      || !optionalEmailAllowed(notification.user.notificationPreferences, notification.type)
      // Push is Instant-only: a switch to Daily (or Off) after queueing skips it at send time.
      || (notification.user.notificationPreferences?.emailFrequency ?? "INSTANT") !== "INSTANT"
      || !await prisma.$transaction(tx => notificationStillCurrent(tx, notification, notification.userId, URL_BASE, { panel: true }))) {
      await skip(); continue;
    }
    const timeout = Math.min(SEND_TIMEOUT_MS, HARD_STOP_MS - (now() - start));
    if (timeout < 1000) { await prisma.webPushDelivery.updateMany({ where: { ...key, status: "SENDING" }, data: { status: "PENDING" } }); break; }
    try {
      if (subscription.kind === "EXPO") {
        const payload = buildPushPayload(notification);
        // The same lock-screen-safe payload as the web: a category, a club name for club-wide updates, a path.
        const outcome = await nativeSender({ to: deviceToken!, title: payload.title, body: payload.body, data: { url: payload.url } }, { accessToken: native!.accessToken, url: native!.url, timeout });
        if (outcome === "gone") { await prisma.webPushSubscription.deleteMany({ where: { id: subscription.id } }); removed++; continue; }
      } else await push!.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify(buildPushPayload(notification)),
        { vapidDetails: { subject: config!.subject, publicKey: config!.publicKey, privateKey: config!.privateKey }, TTL: 3600, urgency: "normal", timeout },
      );
      await prisma.webPushDelivery.updateMany({ where: { ...key, status: "SENDING" }, data: { status: "SENT" } });
      await prisma.webPushSubscription.updateMany({ where: { id: subscription.id }, data: { lastSuccessAt: new Date(now()), failureCount: 0 } });
      sent++;
    } catch (error) {
      const status = (error as { statusCode?: number } | null)?.statusCode;
      if (status === 404 || status === 410) {
        // The push service says this endpoint is gone: drop it (its delivery rows cascade).
        await prisma.webPushSubscription.deleteMany({ where: { id: subscription.id } });
        removed++; continue;
      }
      await prisma.webPushDelivery.updateMany({ where: { ...key, status: "SENDING" }, data: { status: "FAILED" } });
      // Only a permanent 4xx counts toward the cap; 429, 5xx and timeouts do not.
      if (!transientPushError(status)) await prisma.webPushSubscription.updateMany({ where: { id: subscription.id }, data: { failureCount: { increment: 1 } } });
      failed++;
      console.error("notification-push failed", { status: typeof status === "number" ? status : "NETWORK" });
    }
  }
  return { enabled: true, sent, failed, skipped, removed, pruned };
}
