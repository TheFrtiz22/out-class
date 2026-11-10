import { z } from "zod";

/**
 * Registry of per-club pilot feature switches, stored in `Club.features` (nullable JSON).
 * Every key defaults to OFF. NULL, malformed JSON, unknown keys and non-boolean values all
 * read as off, so a stale or hand-edited row can never turn a feature on. Only platform
 * admins write switches (setAdminClubFeature in actions/admin-clubs.ts); feature code reads them on the
 * server with `clubHasFeature` in utils/club-features.ts and never from the client.
 */
export const clubFeatureKeys = ["csvExport", "cloneCycle", "previouslyApplied", "pushNotifications"] as const;
export type ClubFeatureKey = typeof clubFeatureKeys[number];
export type ClubFeatures = Record<ClubFeatureKey, boolean>;

export const clubFeatureLabels: Record<ClubFeatureKey, string> = {
  csvExport: "CSV export",
  cloneCycle: "Clone recruiting cycle",
  previouslyApplied: "Previously applied",
  pushNotifications: "Push notifications",
};

export function isClubFeatureKey(value: unknown): value is ClubFeatureKey {
  return typeof value === "string" && (clubFeatureKeys as readonly string[]).includes(value);
}

/** True only when the stored value for a known key is exactly `true`. */
export function isFeatureEnabled(clubFeatures: unknown, key: ClubFeatureKey): boolean {
  if (!isClubFeatureKey(key)) return false;
  if (!clubFeatures || typeof clubFeatures !== "object" || Array.isArray(clubFeatures)) return false;
  if (!Object.prototype.hasOwnProperty.call(clubFeatures, key)) return false;
  return (clubFeatures as Record<string, unknown>)[key] === true;
}

/** Every registered key with its effective state; unknown keys are dropped. */
export function normalizeClubFeatures(clubFeatures: unknown): ClubFeatures {
  return Object.fromEntries(clubFeatureKeys.map(key => [key, isFeatureEnabled(clubFeatures, key)])) as ClubFeatures;
}

export const setClubFeatureInput = z.object({
  clubId: z.string().uuid(),
  key: z.enum(clubFeatureKeys),
  enabled: z.boolean(),
  // The state the admin last saw: a concurrent change by another admin is a conflict.
  expected: z.boolean(),
  reason: z.string().trim().min(10).max(1000),
}).strict();
