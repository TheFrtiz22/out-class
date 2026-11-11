import type { Prisma } from "@prisma/client";
import { prisma } from "@/utils/prisma";

export type NotificationPreferenceValues = Omit<Prisma.UserNotificationPreferenceUncheckedCreateInput, "userId" | "updatedAt">;

/**
 * The one write path for a user's email preferences: the settings action (all fields, signed-in
 * user) and one-click unsubscribe (one field turned off, signed token) both use it. The user row
 * lock serializes it with the notification worker, which reads preferences under the same lock.
 * Returns null when the user no longer exists.
 */
export async function writeNotificationPreferences(userId: string, values: Partial<NotificationPreferenceValues>) {
  return prisma.$transaction(async tx => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
    if (!locked.length) return null;
    return tx.userNotificationPreference.upsert({ where: { userId }, create: { userId, ...values }, update: values });
  });
}
