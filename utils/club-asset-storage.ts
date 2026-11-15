import "server-only";
import { createClient } from "@supabase/supabase-js";
import { prisma, type AppTransactionClient } from "@/utils/prisma";
import { clubAssetReference, clubProfileImages } from "@/lib/club-assets";
export async function privateClubAssetStorage() {
  const [policy] = await prisma.$queryRaw<{ secured: boolean }[]>`
    SELECT count(*)=2 AND (SELECT count(*)=2 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='storage' AND c.relname IN ('objects','buckets') AND c.relrowsecurity) AS secured
    FROM pg_policies WHERE schemaname='storage' AND permissive='RESTRICTIVE' AND cmd='ALL' AND roles=ARRAY['public']::name[] AND with_check=qual AND (
      (tablename='objects' AND policyname='outclass_club_assets_server_only' AND qual IN (
        '(bucket_id <> ''club-assets''::text)',
        '((bucket_id <> ''club-assets''::text) OR (CURRENT_USER = ''outclass_production_app''::name))',
        '((bucket_id <> ''club-assets''::text) OR (CURRENT_USER = ''outclass_web_runtime''::name))')) OR
      (tablename='buckets' AND policyname='outclass_club_assets_bucket_server_only' AND qual='(id <> ''club-assets''::text)'))`;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!policy?.secured || !secret) throw Error("Club image storage is unavailable.");
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.storage.getBucket("club-assets");
  if (error || !data || data.public) throw Error("Club image storage is unavailable.");
  return client.storage.from("club-assets");
}
export async function assertClubImageAssignment(tx: AppTransactionClient, clubId: string, next: Parameters<typeof clubProfileImages>[0], previous: Parameters<typeof clubProfileImages>[0] = {}) {
  const previousImages = new Set(clubProfileImages(previous));
  for (const reference of new Set(clubProfileImages(next))) {
    if (!clubAssetReference.safeParse(reference).success) {
      if (previousImages.has(reference)) continue; // Preserve existing URLs/base64; never introduce new ones.
      throw Error("Upload new club images through the image controls.");
    }
    if (reference.split('/')[1] !== clubId) throw Error("Club image ownership mismatch.");
    const path = reference.slice('club-assets/'.length);
    const rows = await tx.$queryRaw<{ name: string }[]>`SELECT name FROM storage.objects WHERE bucket_id='club-assets' AND name=${path}`;
    if (!rows.length) throw Error("Club image is unavailable. Upload it again before saving.");
  }
}

type ClubImages = Parameters<typeof clubProfileImages>[0];
const errorCode = (error: unknown) => error instanceof Error ? error.name : typeof error === "object" && error && "message" in error ? "StorageError" : "Unknown";

/** Storage paths of this club's own uploaded images that a profile references. */
export function ownedClubAssetPaths(clubId: string, value: ClubImages) {
  return [...new Set(clubProfileImages(value))]
    .filter(reference => clubAssetReference.safeParse(reference).success && reference.split('/')[1] === clubId)
    .map(reference => reference.slice('club-assets/'.length));
}

/**
 * Bytes of the images the club profile currently references, for the per-club byte cap.
 * Runs outside the upload transaction: on any error it logs and returns null, and the caller
 * skips the byte cap (the hourly audit-row limits still apply).
 */
export async function referencedClubAssetBytes(clubId: string): Promise<number | null> {
  try {
    const club = await prisma.club.findUnique({ where: { id: clubId }, select: { logoUrl: true, bannerUrl: true, marketing: true } });
    const paths = club ? ownedClubAssetPaths(clubId, club) : [];
    if (!paths.length) return 0;
    const [row] = await prisma.$queryRaw<{ bytes: bigint | number | null }[]>`SELECT COALESCE(SUM((metadata->>'size')::bigint), 0) AS bytes FROM storage.objects WHERE bucket_id='club-assets' AND name = ANY(${paths})`;
    return Number(row?.bytes ?? 0);
  } catch (error) {
    console.error("club.asset.quota.bytes.failure", { clubId, code: errorCode(error) });
    return null;
  }
}

/**
 * After a profile save commits, deletes this club's images that the previous profile referenced
 * and the saved one no longer does. Best effort: failures are logged and never fail the save.
 */
export async function releaseReplacedClubImages(clubId: string, previous: ClubImages, next: ClubImages) {
  const kept = new Set(ownedClubAssetPaths(clubId, next));
  const replaced = ownedClubAssetPaths(clubId, previous).filter(path => !kept.has(path));
  if (!replaced.length) return;
  try {
    const { error } = await (await privateClubAssetStorage()).remove(replaced);
    if (error) console.error("club.asset.release.failure", { clubId, paths: replaced, code: errorCode(error) });
  } catch (error) {
    console.error("club.asset.release.failure", { clubId, paths: replaced, code: errorCode(error) });
  }
}
