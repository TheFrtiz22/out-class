BEGIN;
-- Supabase owns the storage schema. Do not create a competing copy on plain PostgreSQL.
DO $$ BEGIN
  IF to_regclass('storage.objects') IS NULL OR to_regclass('storage.buckets') IS NULL THEN
    RAISE NOTICE 'Supabase Storage is absent. Re-run this idempotent storage patch after provisioning Storage.';
    RETURN;
  END IF;
  -- Supabase manages table-level RLS; this migration only manages bucket policies.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class
    WHERE oid = pg_catalog.to_regclass('storage.objects')
      AND relrowsecurity
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'Supabase-managed storage.objects must already have row-level security (RLS) enabled before applying the private-resume migration.',
      HINT = 'Have the Supabase-managed Storage configuration reviewed before retrying; this migration does not enable RLS on provider-owned tables.';
  END IF;
  INSERT INTO storage.buckets (id, name, public)
    VALUES ('resumes', 'resumes', false)
    ON CONFLICT (id) DO UPDATE SET public = false;
  DROP POLICY IF EXISTS resumes_select_public ON storage.objects;
  DROP POLICY IF EXISTS outclass_resumes_private_read ON storage.objects;
  -- Restrictive AND protects against unknown legacy permissive SELECT/ALL policies.
  -- All browser reads, including owners, go through the authorized signing routes.
  CREATE POLICY outclass_resumes_private_read ON storage.objects
    AS RESTRICTIVE FOR SELECT TO PUBLIC USING (bucket_id <> 'resumes');
  DROP POLICY IF EXISTS outclass_resumes_owner_insert ON storage.objects;
  CREATE POLICY outclass_resumes_owner_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'resumes' AND split_part(name, '/', 1) = (SELECT auth.uid())::text);
  DROP POLICY IF EXISTS outclass_resumes_insert_guard ON storage.objects;
  CREATE POLICY outclass_resumes_insert_guard ON storage.objects
    AS RESTRICTIVE FOR INSERT TO PUBLIC
    WITH CHECK (bucket_id <> 'resumes' OR split_part(name, '/', 1) = (SELECT auth.uid())::text);
END $$;
COMMIT;
