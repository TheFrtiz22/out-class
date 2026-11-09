-- Table ownership: the migration operator owns every application table; the bounded
-- server role (outclass_production_app) gets explicit grants and row policies instead.
-- Owner decision 2026-11-09; see docs/agent-ops/postgres-owned-tables-2026-11-09.md.
--
-- Before: the server role owned 79 of 86 tables in production (53 of them moved by hand,
-- outside this ledger). An owner is not subject to row-level security and may alter, drop
-- or truncate its tables, and 36 tables carried a deny-everyone policy that the server
-- role only passed because it was the owner.
-- After: the server role owns no table. It keeps exactly SELECT, INSERT, UPDATE and DELETE
-- on the tables it used to reach as owner, through one explicit policy per table. It can
-- no longer change schema, policies, triggers or ownership. Browser roles stay denied.
--
-- Scope: every ordinary table in public except _prisma_migrations and except tables that
-- already have an explicit server-role policy (their narrower grants are kept as they are).
-- No row is read or written. Forward-only and safe to repeat. Without the server role
-- (plain PostgreSQL) nothing changes.
--
-- Locks: each table is locked ACCESS EXCLUSIVE for catalog changes only; nothing is rewritten.
-- All locks are held until COMMIT so the change is all-or-nothing. Each lock waits at most
-- 2 s and the whole migration at most 15 s; on either limit, or a deadlock with a running
-- request, it fails and changes nothing. While it runs, requests touching an already locked
-- table wait. Apply in a quiet period. The new owner is the role that runs the migration.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';
DO $migration$
DECLARE
  runtime CONSTANT name := 'outclass_production_app';
  browser_roles text;
  t record;
  p record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = runtime) THEN
    RAISE NOTICE 'Server role is absent; table ownership is unchanged.';
    RETURN;
  END IF;
  IF current_user = runtime THEN
    RAISE EXCEPTION 'Run this migration as the migration operator, not as the server role.';
  END IF;
  SELECT string_agg(quote_ident(rolname), ', ' ORDER BY rolname) INTO browser_roles
  FROM pg_catalog.pg_roles WHERE rolname IN ('anon', 'authenticated');

  FOR t IN
    SELECT c.oid, c.relname, pg_catalog.pg_get_userbyid(c.relowner) AS owner
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    WHERE c.relkind = 'r'
      AND c.relname <> '_prisma_migrations'
      AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_policy pol
        WHERE pol.polrelid = c.oid
          AND pol.polpermissive
          AND pol.polname <> 'outclass_runtime_access'
          AND (SELECT r.oid FROM pg_catalog.pg_roles r WHERE r.rolname = runtime) = ANY (pol.polroles)
      )
    ORDER BY c.relname
  LOOP
    -- Ownership first. A grant issued while the server role still owns the table is
    -- recorded as owner-to-itself and would move to the new owner with the table.
    IF t.owner = runtime THEN
      EXECUTE format('ALTER TABLE public.%I OWNER TO %I', t.relname, current_user);
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO %I', t.relname, runtime);
    EXECUTE format('DROP POLICY IF EXISTS outclass_runtime_access ON public.%I', t.relname);
    EXECUTE format(
      'CREATE POLICY outclass_runtime_access ON public.%I FOR ALL TO %I USING (true) WITH CHECK (true)',
      t.relname, runtime);

    -- Deny-everyone policies only ever let the owner through. Scope them to the browser
    -- roles they exist for, so the server role is governed by its own policy above.
    FOR p IN
      SELECT pol.polname
      FROM pg_catalog.pg_policy pol
      WHERE pol.polrelid = t.oid
        AND NOT pol.polpermissive
        AND pol.polroles = ARRAY[0]::oid[]
        AND pg_catalog.pg_get_expr(pol.polqual, pol.polrelid) = 'false'
    LOOP
      IF browser_roles IS NULL THEN
        EXECUTE format('DROP POLICY %I ON public.%I', p.polname, t.relname);
      ELSE
        EXECUTE format('ALTER POLICY %I ON public.%I TO %s', p.polname, t.relname, browser_roles);
      END IF;
    END LOOP;

    -- Every table gets the same browser denial, including the tables that had none: an
    -- accidental grant plus a permissive policy must not expose rows to a browser role.
    IF browser_roles IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_policy pol
      WHERE pol.polrelid = t.oid AND NOT pol.polpermissive AND pol.polcmd = '*'
        AND pg_catalog.pg_get_expr(pol.polqual, pol.polrelid) = 'false'
    ) THEN
      EXECUTE format(
        'CREATE POLICY outclass_browser_deny ON public.%I AS RESTRICTIVE FOR ALL TO %s USING (false) WITH CHECK (false)',
        t.relname, browser_roles);
    END IF;
  END LOOP;

  -- Nothing may be left behind: fail the whole migration rather than half-apply.
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    WHERE c.relkind IN ('r', 'p') AND pg_catalog.pg_get_userbyid(c.relowner) = runtime
  ) THEN
    RAISE EXCEPTION 'The server role still owns a table in public.';
  END IF;
  -- Ownership must not come back through role membership.
  IF pg_catalog.pg_has_role(runtime, current_user, 'MEMBER') THEN
    RAISE EXCEPTION 'The server role is a member of the table owner and would inherit ownership.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy pol
    JOIN pg_catalog.pg_class c ON c.oid = pol.polrelid
    WHERE pol.polname = 'outclass_runtime_access'
      AND NOT (pg_catalog.has_table_privilege(runtime, c.oid, 'SELECT') AND pg_catalog.has_table_privilege(runtime, c.oid, 'INSERT')
           AND pg_catalog.has_table_privilege(runtime, c.oid, 'UPDATE') AND pg_catalog.has_table_privilege(runtime, c.oid, 'DELETE'))
  ) THEN
    RAISE EXCEPTION 'The server role lost a table privilege it needs.';
  END IF;
  -- Any restrictive policy that still applies to the server role (by name or through PUBLIC)
  -- on a table it reaches through outclass_runtime_access would silently narrow or block it.
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy pol
    WHERE NOT pol.polpermissive
      AND (0 = ANY (pol.polroles) OR (SELECT r.oid FROM pg_catalog.pg_roles r WHERE r.rolname = runtime) = ANY (pol.polroles))
      AND EXISTS (SELECT 1 FROM pg_catalog.pg_policy mine WHERE mine.polrelid = pol.polrelid AND mine.polname = 'outclass_runtime_access')
  ) THEN
    RAISE EXCEPTION 'A deny-everyone policy would still block the server role.';
  END IF;
END
$migration$;
COMMIT;
