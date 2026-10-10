import "server-only";
import { createClient } from "@supabase/supabase-js";
import { prisma, type AppTransactionClient } from "@/utils/prisma";
import { clubAssetReference, clubProfileImages } from "@/lib/club-assets";
export async function privateClubAssetStorage() {
  const [policy] = await prisma.$queryRaw<{ secured: boolean }[]>`
    SELECT count(*)=2 AND (SELECT count(*)=2 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='storage' AND c.relname IN ('objects','buckets') AND c.relrowsecurity) AS secured
    FROM pg_policies WHERE schemaname='storage' AND permissive='RESTRICTIVE' AND cmd='ALL' AND roles=ARRAY['public']::name[] AND with_check=qual AND (
      (tablename='objects' AND policyname='outclass_club_assets_server_only' AND qual='(bucket_id <> ''club-assets''::text)') OR
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
