-- EMERGENCY ONLY, owner approval required. Not a migration; never add it to prisma/migrations.
-- Undoes the effect of 20261127010000_postgres_owned_tables for the server role by giving it
-- table ownership back. An owner is not subject to row-level security, so server access is
-- restored at once whatever the policies say. Grants and policies added by the migration are
-- left in place (harmless for an owner); browser roles stay denied.
-- Limits: the table list comes from the catalog (every table carrying the policy
-- outclass_runtime_access), so it also hands over any later table that uses that policy.
-- Tables with their own "<table>_runtime_<command>" policies were never moved and are not
-- touched. Deny policies stay scoped to anon, authenticated. The ledger still records the
-- migration as applied (do not edit it). Afterwards the forward migration SQL can be run
-- again with psql to return to operator ownership.
-- Run as the migration operator (the role that owns the tables):
--   psql "$OPERATOR_URL" -v ON_ERROR_STOP=1 -f scripts/db/rollback-postgres-owned-tables.sql
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';
DO $rollback$
DECLARE
  runtime CONSTANT name := 'outclass_production_app';
  t record;
  had_create boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = runtime) THEN
    RAISE EXCEPTION 'Server role is absent; there is nothing to roll back.';
  END IF;
  IF current_user = runtime THEN
    RAISE EXCEPTION 'Run this script as the migration operator, not as the server role.';
  END IF;
  -- A new owner needs CREATE on the schema for the moment of the transfer only.
  had_create := pg_catalog.has_schema_privilege(runtime, 'public', 'CREATE');
  IF NOT had_create THEN EXECUTE pg_catalog.format('GRANT CREATE ON SCHEMA public TO %I', runtime); END IF;
  FOR t IN
    SELECT c.relname FROM pg_catalog.pg_policy pol
    JOIN pg_catalog.pg_class c ON c.oid = pol.polrelid AND c.relnamespace = 'public'::regnamespace
    WHERE pol.polname = 'outclass_runtime_access' AND pg_catalog.pg_get_userbyid(c.relowner) <> runtime
    ORDER BY c.relname
  LOOP
    EXECUTE pg_catalog.format('ALTER TABLE public.%I OWNER TO %I', t.relname, runtime);
  END LOOP;
  IF NOT had_create THEN EXECUTE pg_catalog.format('REVOKE CREATE ON SCHEMA public FROM %I', runtime); END IF;
  IF pg_catalog.has_schema_privilege(runtime, 'public', 'CREATE') <> had_create THEN
    RAISE EXCEPTION 'Schema privileges of the server role changed; nothing was rolled back.';
  END IF;
END
$rollback$;
COMMIT;
