BEGIN;
SET LOCAL lock_timeout = '5s';

-- The cleanup worker and flyer-deletion triggers run as the bounded app role.
-- RLS remains restrictive for every browser role, including with stray grants.
REVOKE ALL ON public."EventFlyerDeletion" FROM PUBLIC, anon, authenticated;
DO $migration$
DECLARE had_create BOOLEAN;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='outclass_production_app') THEN RETURN; END IF;
 had_create := has_schema_privilege('outclass_production_app','public','CREATE');
 IF NOT had_create THEN GRANT CREATE ON SCHEMA public TO outclass_production_app; END IF;
 ALTER TABLE public."EventFlyerDeletion" OWNER TO outclass_production_app;
 IF NOT had_create THEN REVOKE CREATE ON SCHEMA public FROM outclass_production_app; END IF;
END $migration$;
COMMIT;
