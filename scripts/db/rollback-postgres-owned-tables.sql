-- EMERGENCY ONLY, owner approval required. Not a migration; never add it to prisma/migrations.
-- Undoes the effect of 20261110090000_postgres_owned_tables for the server role by giving it
-- table ownership back. An owner is not subject to row-level security, so server access is
-- restored at once whatever the policies say. Grants and policies added by the migration are
-- left in place (harmless for an owner); browser roles stay denied.
-- Limits: it selects tables by the policy name outclass_runtime_access, so it also hands over
-- any later table that uses that policy; deny policies stay scoped to anon, authenticated; the
-- ledger still records the migration as applied (do not edit it). Afterwards the forward
-- migration SQL can be run again with psql to return to operator ownership.
-- Run as the migration operator:  psql "$OPERATOR_URL" -v ON_ERROR_STOP=1 -f scripts/db/rollback-postgres-owned-tables.sql
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';
DO $rollback$
DECLARE t record; had_create boolean;
BEGIN
  had_create := has_schema_privilege('outclass_production_app', 'public', 'CREATE');
  IF NOT had_create THEN GRANT CREATE ON SCHEMA public TO outclass_production_app; END IF;
  FOR t IN
    SELECT c.relname FROM pg_catalog.pg_policy pol JOIN pg_catalog.pg_class c ON c.oid = pol.polrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    WHERE pol.polname = 'outclass_runtime_access' ORDER BY c.relname
  LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO outclass_production_app', t.relname);
  END LOOP;
  IF NOT had_create THEN REVOKE CREATE ON SCHEMA public FROM outclass_production_app; END IF;
END
$rollback$;
COMMIT;
