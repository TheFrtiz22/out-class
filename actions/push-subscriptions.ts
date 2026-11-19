"use server";
import { prisma } from "@/utils/prisma";
import { requireAuth } from "@/utils/auth";
import { headers } from "next/headers";
import { nativePushConfig, parseNativePushDevice, parsePushSubscription, pushPlatformFromUserAgent, PUSH_MAX_FAILURES, PUSH_MAX_SUBSCRIPTIONS, webPushConfig } from "@/lib/web-push";

// Web Push subscriptions (S1-8). Every action acts on the signed-in user only. requireAuth
// already refuses Demo Mode; a support (view-as) session is refused here so an administrator's
// browser can never receive another user's notifications.

async function currentUser() {
  const { user, impersonation } = await requireAuth();
  if (impersonation) throw new Error("Push notifications are unavailable in a support session.");
  return user;
}

/**
 * Whether push is configured, the VAPID public key the browser subscribes with, and whether
 * this browser's endpoint is subscribed for the signed-in user on the server (the browser's
 * own subscription alone is not enough: another account may have taken the endpoint over).
 */
export async function getPushSettings(endpoint?: unknown) {
  const user = await currentUser();
  const config = webPushConfig();
  if (!config) return { enabled: false as const, publicKey: null, subscribed: false };
  const row = typeof endpoint === "string" && endpoint.length <= 2048
    ? await prisma.webPushSubscription.findUnique({ where: { endpoint }, select: { userId: true, failureCount: true } })
    : null;
  return { enabled: true as const, publicKey: config.publicKey, subscribed: !!row && row.userId === user.id && row.failureCount < PUSH_MAX_FAILURES };
}

export async function savePushSubscription(input: unknown) {
  const user = await currentUser();
  if (!webPushConfig()) throw new Error("Push notifications are not available.");
  const subscription = parsePushSubscription(input);
  if (!subscription) throw new Error("This browser's push subscription is not supported.");
  // Where this browser lives, so a phone that also has the native app gets one push per event.
  // Unknown (null) outside a request; such a row is always delivered to, as before.
  let platform: string | null = null;
  try { platform = pushPlatformFromUserAgent((await headers()).get("user-agent")); } catch { /* no request scope */ }
  try { await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
    // An endpoint belongs to one browser profile. If another account subscribed it before
    // (a shared device), that row and its queued pushes go, so it never receives their pushes.
    await tx.webPushSubscription.deleteMany({ where: { endpoint: subscription.endpoint, userId: { not: user.id } } });
    await tx.webPushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: { userId: user.id, ...subscription, kind: "WEB", platform },
      update: { p256dh: subscription.p256dh, auth: subscription.auth, failureCount: 0, platform },
    });
    const rows = await tx.webPushSubscription.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { id: true } });
    if (rows.length > PUSH_MAX_SUBSCRIPTIONS) await tx.webPushSubscription.deleteMany({ where: { userId: user.id, id: { in: rows.slice(PUSH_MAX_SUBSCRIPTIONS).map(row => row.id) } } });
  }); } catch (error) {
    // Two saves of the same endpoint raced (a double click, two tabs): fine if it is now ours.
    if ((error as { code?: string } | null)?.code !== "P2002") throw error;
    const row = await prisma.webPushSubscription.findUnique({ where: { endpoint: subscription.endpoint }, select: { userId: true } });
    if (row?.userId !== user.id) throw error;
  }
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

// Native push (the iOS/Android app). The same toggle semantics as the browser: the device is
// subscribed for the signed-in user only, another account's row for the same device is replaced,
// and removing acts on the caller's own row.

export async function getNativePushSettings(input?: unknown) {
  const user = await currentUser();
  if (!nativePushConfig()) return { enabled: false as const, subscribed: false };
  const device = parseNativePushDevice(input);
  const row = device ? await prisma.webPushSubscription.findUnique({ where: { endpoint: device.endpoint }, select: { userId: true, failureCount: true } }) : null;
  return { enabled: true as const, subscribed: !!row && row.userId === user.id && row.failureCount < PUSH_MAX_FAILURES };
}

export async function saveNativePushDevice(input: unknown) {
  const user = await currentUser();
  if (!nativePushConfig()) throw new Error("Push notifications are not available.");
  const device = parseNativePushDevice(input);
  if (!device) throw new Error("This device's push registration is not supported.");
  try { await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
    // A device token belongs to one install. If another account registered it (a shared phone),
    // that row and its queued pushes go, so this device never receives their pushes.
    await tx.webPushSubscription.deleteMany({ where: { endpoint: device.endpoint, userId: { not: user.id } } });
    await tx.webPushSubscription.upsert({
      where: { endpoint: device.endpoint },
      create: { userId: user.id, endpoint: device.endpoint, p256dh: "-", auth: "-", kind: "EXPO", platform: device.platform },
      update: { failureCount: 0, platform: device.platform },
    });
    const rows = await tx.webPushSubscription.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { id: true } });
    if (rows.length > PUSH_MAX_SUBSCRIPTIONS) await tx.webPushSubscription.deleteMany({ where: { userId: user.id, id: { in: rows.slice(PUSH_MAX_SUBSCRIPTIONS).map(row => row.id) } } });
  }); } catch (error) {
    if ((error as { code?: string } | null)?.code !== "P2002") throw error;
    const row = await prisma.webPushSubscription.findUnique({ where: { endpoint: device.endpoint }, select: { userId: true } });
    if (row?.userId !== user.id) throw error;
  }
  return { subscribed: true };
}

export async function removeNativePushDevice(input: unknown) {
  const user = await currentUser();
  const device = parseNativePushDevice(input);
  if (!device) throw new Error("Invalid device.");
  await prisma.webPushSubscription.deleteMany({ where: { endpoint: device.endpoint, userId: user.id, kind: "EXPO" } });
  return { subscribed: false };
}
