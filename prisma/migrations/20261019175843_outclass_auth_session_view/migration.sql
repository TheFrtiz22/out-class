-- Application reads and locks the provider session projection as its own role.
-- Invoker semantics preserve underlying column ACLs and RLS, without requiring
-- Auth schema USAGE. No credentials, Auth ownership or application data change.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='10s';
DO $$ BEGIN
 IF to_regclass('auth.sessions') IS NOT NULL THEN
   EXECUTE 'CREATE VIEW public.outclass_auth_sessions WITH (security_invoker=true) AS SELECT id,user_id,not_after FROM auth.sessions';
   EXECUTE 'REVOKE ALL ON public.outclass_auth_sessions FROM PUBLIC,anon,authenticated';
   IF EXISTS(SELECT FROM pg_roles WHERE rolname='outclass_production_app') THEN
     EXECUTE 'REVOKE ALL ON public.outclass_auth_sessions FROM outclass_production_app';
   END IF;
 END IF;
END $$;
COMMIT;
