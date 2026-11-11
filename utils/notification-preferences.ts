import type { Prisma } from "@prisma/client";
import { prisma } from "@/utils/prisma";
import { unsubscribeChanges, type UnsubscribeScope } from "@/lib/email-unsubscribe";

export type NotificationPreferenceValues = Omit<Prisma.UserNotificationPreferenceUncheckedCreateInput, "userId" | "updatedAt">;
type Tx = Prisma.TransactionClient;

// The user row lock serializes preference writes with the notification worker, which reads
// preferences under the same lock.
async function lockUser(tx: Tx, userId: string) {
  return (await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`).length > 0;
}
const upsert = (tx: Tx, userId: string, values: Partial<NotificationPreferenceValues>) =>
  tx.userNotificationPreference.upsert({ where: { userId }, create: { userId, ...values }, update: values });

/** Settings action write (all fields, signed-in user). Returns null when the user no longer exists. */
export async function writeNotificationPreferences(userId: string, values: Partial<NotificationPreferenceValues>) {
  return prisma.$transaction(async tx => (await lockUser(tx, userId)) ? upsert(tx, userId, values) : null);
}

/**
 * Signed one-click unsubscribe: applies unsubscribeChanges (optional email only) and records the
 * opt-out in the audit log, in one transaction. The token itself is never stored.
 */
export async function applyEmailUnsubscribe(userId: string, scope: UnsubscribeScope, oneClick: boolean) {
  return prisma.$transaction(async tx => {
    if (!await lockUser(tx, userId)) return null;
    const current = await tx.userNotificationPreference.findUnique({ where: { userId }, select: { emailFrequency: true } });
    const changes = unsubscribeChanges(scope, current);
    const saved = await upsert(tx, userId, changes);
    await tx.auditLog.create({ data: { actorId: userId, targetId: userId, action: "email.unsubscribe", details: { scope, method: oneClick ? "one-click" : "confirmation-page", changes } } });
    return saved;
  });
}
