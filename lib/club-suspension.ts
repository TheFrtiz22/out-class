import type { AppTransactionClient } from "@/utils/prisma";
export const CLUB_SUSPENDED_MESSAGE = "This club is suspended. Club operations are unavailable until an administrator restores it.";
/** Additional club-state gate; never substitutes for membership/capability authorization. */
export async function assertClubOperational(tx: Pick<AppTransactionClient, "$queryRaw">, clubId: string) {
  await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${clubId} FOR SHARE`;
  const suspended = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Club" WHERE id=${clubId} AND "suspendedAt" IS NOT NULL`;
  if (suspended.length) throw new Error(CLUB_SUSPENDED_MESSAGE);
}
/** Serialize an operation with Admin suspension/restoration before checking current state. */
export async function lockOperationalClub(tx: Pick<AppTransactionClient, "$queryRaw">, clubId: string) {
  await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${clubId} FOR UPDATE`;
  await assertClubOperational(tx, clubId);
}
