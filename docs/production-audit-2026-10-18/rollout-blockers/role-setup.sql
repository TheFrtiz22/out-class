-- Dedicated web login, without changing any existing password or table owner.
-- Credential provisioning is a separate secure step after this reviewable SQL.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='10s';
DO $$ BEGIN
 IF EXISTS(SELECT FROM pg_roles WHERE rolname='outclass_web_runtime') THEN
   RAISE EXCEPTION 'Web role already exists; inspect rather than replace it';
 END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='outclass_production_app'
   AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication) THEN
   RAISE EXCEPTION 'Application grant role differs from baseline';
 END IF;
END $$;
CREATE ROLE outclass_web_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION INHERIT;
GRANT outclass_production_app TO outclass_web_runtime;
COMMIT;
