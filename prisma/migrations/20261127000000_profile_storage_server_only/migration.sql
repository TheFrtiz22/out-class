-- Profile files (resumes, headshots) are written only by the server key, after the
-- upload action has checked the file's bytes. Browser roles keep no Storage access to
-- these buckets, so a student cannot store unchecked bytes under their own folder with
-- their session token. Also removes dashboard-era permissive policies that today are
-- neutralized only by the restrictive guards, and the anon/authenticated EXECUTE grant on
-- a CHECK helper. Catalog changes only; safe to repeat; no-op without Storage.
--
-- ORDER: deploy the code first, then apply this migration. This is the reverse of the usual
-- order. The previous upload action signed with the owner's session, which this migration
-- denies, so applying it first breaks every profile upload until the new code is live.
-- The new code works both before and after the migration.
--
-- Locks: each policy statement takes ACCESS EXCLUSIVE on storage.objects for a catalog
-- change only. Each lock waits at most 3 s and the whole migration at most 10 s; on either
-- limit it fails and changes nothing.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10s';
DO $$ DECLARE p TEXT; BEGIN
  IF to_regclass('storage.objects') IS NULL THEN
    RAISE NOTICE 'Supabase Storage is absent; the profile-file server-only policy is not installed.';
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class
    WHERE oid = pg_catalog.to_regclass('storage.objects') AND relrowsecurity
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'storage.objects must have row-level security enabled before making profile files server-only.';
  END IF;
  DROP POLICY IF EXISTS outclass_profile_files_server_only ON storage.objects;
  CREATE POLICY outclass_profile_files_server_only ON storage.objects
    AS RESTRICTIVE FOR ALL TO PUBLIC
    USING (bucket_id NOT IN ('resumes', 'headshots'))
    WITH CHECK (bucket_id NOT IN ('resumes', 'headshots'));
  FOREACH p IN ARRAY ARRAY[
    'headshots_select_public', 'headshots_insert_owner_only', 'headshots_update_owner_only', 'headshots_delete_owner_only',
    'Users upload own headshots', 'Users update own headshots', 'Users delete own headshots', 'outclass_headshots_owner_insert',
    'resumes_insert_owner_only', 'resumes_update_owner_only', 'resumes_delete_owner_only',
    'Users upload own resumes', 'Users update own resumes', 'Users delete own resumes', 'Users read own resumes', 'outclass_resumes_owner_insert',
    'Users upload own club assets', 'Users update own club assets', 'Users delete own club assets'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p);
  END LOOP;
END $$;

-- The StudentProfile CHECK constraint calls this helper as the writing role, so every server
-- role that writes profiles keeps EXECUTE; only the browser roles (and PUBLIC) lose it.
DO $$ DECLARE r TEXT; BEGIN
  IF to_regprocedure('public.outclass_scholar_status_valid(jsonb)') IS NULL THEN
    RETURN;
  END IF;
  -- Grant before revoking PUBLIC, so no writer is ever without it.
  FOR r IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname NOT IN ('anon', 'authenticated') AND rolname !~ '^pg_'
      AND (rolname IN ('outclass_production_app', 'outclass_web_runtime', 'service_role')
        OR CASE WHEN to_regclass('public."StudentProfile"') IS NULL THEN false
                ELSE has_table_privilege(oid, to_regclass('public."StudentProfile"'), 'INSERT')
                  OR has_table_privilege(oid, to_regclass('public."StudentProfile"'), 'UPDATE') END)
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.outclass_scholar_status_valid(JSONB) TO %I', r);
  END LOOP;
  REVOKE ALL ON FUNCTION public.outclass_scholar_status_valid(JSONB) FROM PUBLIC;
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION public.outclass_scholar_status_valid(JSONB) FROM %I', r);
      IF has_function_privilege(r, 'public.outclass_scholar_status_valid(jsonb)', 'EXECUTE') THEN
        RAISE WARNING 'public.outclass_scholar_status_valid(jsonb) is still executable by % (a grant made by another role); revoke it as that role', r;
      END IF;
    END IF;
  END LOOP;
END $$;
COMMIT;
