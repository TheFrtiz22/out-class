"use server";
import { prisma } from "@/utils/prisma";
import { requireAuth } from "@/utils/auth";
import { parsePushSubscription, PUSH_MAX_SUBSCRIPTIONS, webPushConfig } from "@/lib/web-push";

// Web Push subscriptions (S1-8). Every action acts on the signed-in user only. requireAuth
// already refuses Demo Mode; a support (view-as) session is refused here so an administrator's
// browser can never receive another user's notifications.

async function currentUser() {
  const { user, impersonation } = await requireAuth();
  if (impersonation) throw new Error("Push notifications are unavailable in a support session.");
  return user;
}

/** Whether push is configured, and the VAPID public key the browser subscribes with. */
export async function getPushSettings() {
  await currentUser();
  const config = webPushConfig();
  return config ? { enabled: true as const, publicKey: config.publicKey } : { enabled: false as const, publicKey: null };
}

export async function savePushSubscription(input: unknown) {
  const user = await currentUser();
  if (!webPushConfig()) throw new Error("Push notifications are not available.");
  const subscription = parsePushSubscription(input);
  if (!subscription) throw new Error("This browser's push subscription is not supported.");
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
    // An endpoint belongs to one browser profile. If another account subscribed it before
    // (a shared device), that row and its queued pushes go, so it never receives their pushes.
    await tx.webPushSubscription.deleteMany({ where: { endpoint: subscription.endpoint, userId: { not: user.id } } });
    await tx.webPushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: { userId: user.id, ...subscription },
      update: { p256dh: subscription.p256dh, auth: subscription.auth, failureCount: 0 },
    });
    const rows = await tx.webPushSubscription.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { id: true } });
    if (rows.length > PUSH_MAX_SUBSCRIPTIONS) await tx.webPushSubscription.deleteMany({ where: { userId: user.id, id: { in: rows.slice(PUSH_MAX_SUBSCRIPTIONS).map(row => row.id) } } });
  });
  return { subscribed: true };
}

export async function removePushSubscription(input: unknown) {
  const user = await currentUser();
  const endpoint = typeof input === "object" && input && typeof (input as { endpoint?: unknown }).endpoint === "string" ? (input as { endpoint: string }).endpoint : null;
  if (!endpoint || endpoint.length > 2048) throw new Error("Invalid subscription.");
  // Scoped to the current user: another account's endpoint is never touched.
  await prisma.webPushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  return { subscribed: false };
}
