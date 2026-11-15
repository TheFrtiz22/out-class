import "server-only";
import { isFeatureEnabled, type ClubFeatureKey } from "@/lib/club-features";

type ClubFeatureReader = {
  club: { findUnique(args: { where: { id: string }; select: { features: true } }): Promise<{ features: unknown } | null> };
};

/**
 * Server-side switch read for feature code. Pass `prisma` or the current transaction client.
 * A missing club, NULL or malformed JSON reads as off. Never accept a switch state from the client.
 */
export async function clubHasFeature(db: ClubFeatureReader, clubId: string, key: ClubFeatureKey): Promise<boolean> {
  if (typeof clubId !== "string" || !clubId) return false;
  const club = await db.club.findUnique({ where: { id: clubId }, select: { features: true } });
  return isFeatureEnabled(club?.features, key);
}
