-- REVIEW ONLY: not a Prisma migration and not approved for production execution.
-- Existing role/table ownership is retained. No password, owner, browser grant,
-- BYPASSRLS, SECURITY DEFINER or Auth schema/table definition changes.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10s';
DO $$ BEGIN
 IF NOT has_column_privilege(current_user,'auth.sessions','updated_at','UPDATE WITH GRANT OPTION') THEN
   RAISE EXCEPTION 'Operator cannot delegate the session-lock ACL; provider owner grant is required';
 END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='outclass_web_runtime'
   AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication)
   OR NOT pg_has_role('outclass_web_runtime','outclass_production_app','USAGE')
   OR pg_has_role('anon','outclass_web_runtime','MEMBER')
   OR pg_has_role('authenticated','outclass_web_runtime','MEMBER')
 THEN RAISE EXCEPTION 'Dedicated web role must match the reviewed role setup'; END IF;
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='outclass_production_app'
   AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication)
 THEN RAISE EXCEPTION 'Runtime role attributes differ from reviewed baseline'; END IF;
 IF has_schema_privilege('outclass_production_app','public','CREATE')
   OR has_schema_privilege('outclass_production_app','auth','CREATE')
   OR has_schema_privilege('outclass_production_app','storage','CREATE')
   OR pg_has_role('outclass_production_app','postgres','MEMBER')
   OR pg_has_role('anon','outclass_production_app','MEMBER')
   OR pg_has_role('authenticated','outclass_production_app','MEMBER')
   OR has_table_privilege('outclass_production_app','auth.users','SELECT')
 THEN RAISE EXCEPTION 'Role isolation differs from reviewed baseline'; END IF;
 IF EXISTS (SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname<>'_prisma_migrations'
   AND (pg_get_userbyid(c.relowner)<>'outclass_production_app' OR NOT c.relrowsecurity OR c.relforcerowsecurity))
 THEN RAISE EXCEPTION 'Application ownership/RLS baseline differs'; END IF;
 IF has_schema_privilege('outclass_production_app','auth','USAGE')
   OR has_schema_privilege('outclass_production_app','storage','USAGE')
   OR has_any_column_privilege('outclass_production_app','auth.sessions','SELECT,INSERT,UPDATE,REFERENCES')
   OR has_any_column_privilege('outclass_production_app','storage.objects','SELECT,INSERT,UPDATE,REFERENCES')
   OR has_table_privilege('outclass_production_app','public._prisma_migrations','SELECT')
 THEN RAISE EXCEPTION 'Existing privileges differ; capture and review a new inverse patch'; END IF;
 IF NOT EXISTS (SELECT FROM pg_class WHERE oid='auth.sessions'::regclass AND relrowsecurity AND NOT relforcerowsecurity AND pg_get_userbyid(relowner)='supabase_auth_admin')
   OR EXISTS (SELECT FROM pg_policies WHERE schemaname='auth' AND tablename='sessions')
 THEN RAISE EXCEPTION 'Auth policy baseline differs'; END IF;
 IF NOT EXISTS (SELECT FROM pg_class WHERE oid='storage.objects'::regclass AND relrowsecurity AND NOT relforcerowsecurity AND pg_get_userbyid(relowner)='supabase_storage_admin')
 THEN RAISE EXCEPTION 'Storage ownership/RLS baseline differs'; END IF;
 IF NOT EXISTS (SELECT FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
   AND policyname='outclass_club_assets_server_only' AND permissive='RESTRICTIVE' AND cmd='ALL'
   AND roles=ARRAY['public']::name[] AND qual='(bucket_id <> ''club-assets''::text)' AND with_check=qual)
 THEN RAISE EXCEPTION 'Storage guard baseline differs'; END IF;
 IF NOT EXISTS(SELECT FROM pg_class v JOIN pg_namespace n ON n.oid=v.relnamespace WHERE n.nspname='public' AND v.relname='outclass_auth_sessions' AND v.relkind='v' AND 'security_invoker=true'=ANY(v.reloptions)) THEN RAISE EXCEPTION 'Apply the reviewed session-view migration first'; END IF;
END $$;

GRANT USAGE ON SCHEMA storage TO outclass_production_app;
GRANT SELECT (id, user_id, not_after) ON auth.sessions TO outclass_production_app;
-- PostgreSQL requires UPDATE permission and an UPDATE USING policy for FOR SHARE.
-- A false WITH CHECK prevents actual writes; updated_at is the sole ACL column.
GRANT UPDATE (updated_at) ON auth.sessions TO outclass_production_app;
CREATE POLICY outclass_runtime_session_read ON auth.sessions FOR SELECT TO outclass_production_app USING (true);
CREATE POLICY outclass_runtime_session_lock ON auth.sessions FOR UPDATE TO outclass_production_app USING (true) WITH CHECK (false);
-- Keep writes denied even if a future permissive UPDATE policy is introduced.
CREATE POLICY outclass_runtime_session_no_write ON auth.sessions AS RESTRICTIVE FOR UPDATE TO outclass_production_app USING (true) WITH CHECK (false);

-- Invoker view resolves the provider relation at creation; callers still need
-- the underlying column ACLs and RLS. Auth schema USAGE is deliberately absent.
GRANT SELECT ON public.outclass_auth_sessions TO outclass_production_app;
-- Locking needs UPDATE on the view too. These columns deliberately do not
-- overlap the base-table UPDATE(updated_at) ACL, so no view update is writable.
GRANT UPDATE(id) ON public.outclass_auth_sessions TO outclass_production_app;

GRANT SELECT (bucket_id, name) ON storage.objects TO outclass_production_app;
CREATE POLICY outclass_runtime_club_asset_read ON storage.objects FOR SELECT TO outclass_production_app USING (bucket_id='club-assets');
-- Keep this scope even if legacy permissive policies or spoofed request GUCs
-- would otherwise match another bucket. This applies only to the server group.
CREATE POLICY outclass_runtime_club_asset_scope ON storage.objects AS RESTRICTIVE FOR SELECT TO outclass_production_app USING (bucket_id='club-assets');
-- Browser roles retain the exact denial. Only this named server role is exempt;
-- its column ACL and SELECT policy still exclude every other bucket and writes.
ALTER POLICY outclass_club_assets_server_only ON storage.objects
 USING (bucket_id <> 'club-assets' OR CURRENT_USER = 'outclass_web_runtime'::name)
 WITH CHECK (bucket_id <> 'club-assets' OR CURRENT_USER = 'outclass_web_runtime'::name);
DO $$ BEGIN
 IF NOT has_column_privilege('outclass_production_app','auth.sessions','updated_at','UPDATE')
   OR has_schema_privilege('outclass_production_app','auth','USAGE')
   OR NOT has_table_privilege('outclass_web_runtime','public.outclass_auth_sessions','SELECT')
 THEN RAISE EXCEPTION 'Runtime grant postconditions failed; entire transaction must roll back'; END IF;
END $$;
COMMIT;
