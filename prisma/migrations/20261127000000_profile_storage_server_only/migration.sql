-- Profile files (resumes, headshots) are written only by the server key, after the
-- upload action has checked the file's bytes. Browser roles keep no Storage access to
-- these buckets, so a student cannot store unchecked bytes under their own folder with
-- their session token. Also removes dashboard-era permissive policies that today are
-- neutralized only by the restrictive guards, and the anon/authenticated EXECUTE grant on
-- a CHECK helper. Catalog changes only; safe to repeat; no-op without Storage.
BEGIN;
DO $$ DECLARE p TEXT; BEGIN
  IF to_regclass('storage.objects') IS NULL THEN RETURN; END IF;
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

REVOKE ALL ON FUNCTION public.outclass_scholar_status_valid(JSONB) FROM PUBLIC;
DO $$ DECLARE r TEXT; BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION public.outclass_scholar_status_valid(JSONB) FROM %I', r);
    END IF;
  END LOOP;
  -- The StudentProfile CHECK constraint calls this helper as the writing role.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'outclass_production_app') THEN
    GRANT EXECUTE ON FUNCTION public.outclass_scholar_status_valid(JSONB) TO outclass_production_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.outclass_scholar_status_valid(JSONB) TO service_role;
  END IF;
END $$;
COMMIT;
