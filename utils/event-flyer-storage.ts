import "server-only";
import { prisma } from "@/utils/prisma";
import { createClient } from "@supabase/supabase-js";
export async function privateFlyerStorage() {
  const secret =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw Error("Private flyer storage is unavailable.");
  // Storage may be installed after a plain-PostgreSQL migration. Do not issue
  // capabilities until the actual provider tables retain both restrictive policies.
  const [policy] = await prisma.$queryRaw<{ secured: boolean }[]>`
    SELECT count(*)=2 AND (
      SELECT count(*)=2 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='storage' AND c.relname IN ('objects','buckets') AND c.relrowsecurity
    ) AS secured FROM pg_policies
    WHERE schemaname='storage' AND permissive='RESTRICTIVE' AND cmd='ALL'
      AND roles=ARRAY['public']::name[] AND with_check=qual AND (
        (tablename='objects' AND policyname='outclass_event_flyers_server_only'
          AND qual='(bucket_id <> ''event-flyers''::text)') OR
        (tablename='buckets' AND policyname='outclass_event_bucket_server_only'
          AND qual='(id <> ''event-flyers''::text)')
      )
  `;
  if (!policy?.secured)
    throw Error("Private flyer storage policies are unavailable.");
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    secret,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await client.storage.getBucket("event-flyers");
  if (error || !data || data.public)
    throw Error("Private flyer storage is unavailable.");
  return client.storage.from("event-flyers");
}
