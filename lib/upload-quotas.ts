/**
 * Upload quotas for files a user or club stores outside task submissions (task files keep
 * their own 30-per-assignment-per-day limit in actions/tasks.ts).
 *
 * Counts come from records that already exist, so no schema change is needed:
 * - profile résumé/headshot: Storage object metadata under the owner's folder (created_at)
 * - event flyers: "event.flyer.upload" audit rows (hourly) and live EventFlyer sizes (bytes)
 * - club images: "club.asset.upload" audit rows (hourly) and the storage.objects sizes of the
 *   images the club profile currently references (bytes; replaced images are deleted on save)
 */
export const UPLOAD_WINDOW_MS = 60 * 60 * 1000;

export const UPLOAD_QUOTAS = {
  /** Per user, per kind (résumé and headshot are counted separately). */
  profile: { perUserHour: 10 },
  flyer: { perUserHour: 10, perClubHour: 30, clubBytes: 250 * 1024 * 1024 },
  clubAsset: { perUserHour: 10, perClubHour: 20, clubBytes: 100 * 1024 * 1024 },
} as const;

export const UPLOAD_QUOTA_MESSAGES = {
  hourly: "Hourly upload limit reached. Try again later.",
  flyerStorage: "This club has reached its flyer storage limit. Remove flyers from past events, then try again.",
  clubAssetStorage: "This club has reached its image storage limit. Remove images the club no longer uses, then try again.",
} as const;

export function uploadWindowStart(now = Date.now()) {
  return new Date(now - UPLOAD_WINDOW_MS);
}

/** clubBytes null means the size could not be read; the byte cap is then skipped. */
type Usage = { userRecent: number; clubRecent?: number; clubBytes?: number | null; incomingBytes?: number };
type Limits = { perUserHour: number; perClubHour?: number; clubBytes?: number };

/** The friendly error for the first quota this upload would exceed, or null. */
export function uploadQuotaError(usage: Usage, limits: Limits, storageMessage: string = UPLOAD_QUOTA_MESSAGES.clubAssetStorage) {
  if (usage.userRecent >= limits.perUserHour) return UPLOAD_QUOTA_MESSAGES.hourly;
  if (limits.perClubHour !== undefined && (usage.clubRecent ?? 0) >= limits.perClubHour) return UPLOAD_QUOTA_MESSAGES.hourly;
  if (limits.clubBytes !== undefined && usage.clubBytes != null && usage.clubBytes + (usage.incomingBytes ?? 0) > limits.clubBytes) return storageMessage;
  return null;
}

/** Counts Storage objects (from a service-role list, newest first) created inside the window. */
export function recentObjectCount(objects: { created_at?: string | null }[] | null | undefined, since: Date) {
  return (objects ?? []).filter(o => o.created_at && new Date(o.created_at).getTime() >= since.getTime()).length;
}
