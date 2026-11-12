-- Private resumes: no browser role may change or delete a stored resume.
-- docs/agent-ops/migration-reconciliation-2026-11-09.md, decision D2.
--
-- 20260928000000_private_resume_storage guards SELECT and INSERT on the resumes bucket.
-- Production still carries dashboard-era permissive policies that let a signed-in user
-- UPDATE or DELETE objects under their own folder, and nothing restrictive covered those
-- two commands. A resume attached to a submitted application must not be replaced or
-- removed behind the server's back.
--
-- The application never updates or deletes resume objects with a browser session: uploads
-- use a signed upload URL to a new random path with upsert disabled, and reads use
-- service-role signing. Service-role access is not subject to these policies.
--
-- Supabase owns the storage schema. On plain PostgreSQL this is a no-op; safe to repeat.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10s';
DO $migration$ BEGIN
  IF to_regclass('storage.objects') IS NULL OR to_regclass('storage.buckets') IS NULL THEN
    RAISE NOTICE 'Supabase Storage is absent; the resume mutation guard is not installed.';
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class
    WHERE oid = pg_catalog.to_regclass('storage.objects') AND relrowsecurity
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'storage.objects must have row-level security enabled before installing the resume mutation guard.';
  END IF;
  DROP POLICY IF EXISTS outclass_resumes_update_guard ON storage.objects;
  CREATE POLICY outclass_resumes_update_guard ON storage.objects
    AS RESTRICTIVE FOR UPDATE TO PUBLIC
    USING (bucket_id <> 'resumes') WITH CHECK (bucket_id <> 'resumes');
  DROP POLICY IF EXISTS outclass_resumes_delete_guard ON storage.objects;
  CREATE POLICY outclass_resumes_delete_guard ON storage.objects
    AS RESTRICTIVE FOR DELETE TO PUBLIC
    USING (bucket_id <> 'resumes');
END $migration$;
COMMIT;
