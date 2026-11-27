-- DB-OWN-2. Table ownership: the migration operator owns every application table; the bounded
-- server role (outclass_production_app) works through explicit grants and row policies.
-- Replaces the unapplied 20261110090000_postgres_owned_tables draft (PR #200).
-- See docs/agent-ops/postgres-owned-tables-2026-11-27.md.
--
-- Before: the server role owns most application tables in production. An owner is not subject
-- to row-level security and may alter, drop or truncate its tables and rewrite their policies.
-- Tables created by later migrations are already operator-owned and reached through their own
-- narrower "<table>_runtime_<command>" grants and policies.
-- After: the server role owns nothing. On every table it owned it keeps SELECT, INSERT, UPDATE
-- and DELETE through one explicit policy, and nothing else: no DDL, TRUNCATE, REFERENCES,
-- TRIGGER or MAINTAIN, no policy or ownership changes. Browser roles stay denied.
--
-- The table list comes from the catalog when this runs:
--   * a table that already has its own server-role policy and is operator-owned is the target
--     model already. It is not locked and its grants and policies are not touched;
--   * every other ordinary table in public except _prisma_migrations is moved to the operator
--     if the server role owns it, then granted and given the policy outclass_runtime_access.
-- No row is read or written. Safe to repeat: a second run finds nothing to change and takes
-- no table lock. Without the server role (plain PostgreSQL) nothing changes.
--
-- It checks itself and aborts, changing nothing, if the server role would lose a table or
-- sequence privilege it had, would be blocked by a restrictive policy, would still own
-- anything, keeps a structural privilege, or cannot execute a CHECK or default helper.
--
-- Locks: ACCESS EXCLUSIVE on each table it changes, catalog changes only, nothing rewritten.
-- Locks are held until COMMIT so the change is all-or-nothing. Each lock waits at most 2 s and
-- the whole migration at most 15 s; on either limit, or a deadlock with a running request, it
-- fails and changes nothing. While it runs, requests touching an already locked table wait.
-- Apply in a quiet period, as the role that owns the migration ledger.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';
DO $migration$
DECLARE
  runtime CONSTANT name := 'outclass_production_app';
  runtime_oid oid;
  ledger_owner name;
  browser_roles text;
  browser_oids oid[];
  structural text := 'TRUNCATE, REFERENCES, TRIGGER';
  had_table text[];
  had_sequence text[];
  problem text;
  t record;
  p record;
  privilege text;
BEGIN
  SELECT r.oid INTO runtime_oid FROM pg_catalog.pg_roles r WHERE r.rolname = runtime;
  IF runtime_oid IS NULL THEN
    RAISE NOTICE 'Server role is absent; table ownership is unchanged.';
    RETURN;
  END IF;
  IF current_user = runtime OR pg_catalog.pg_has_role(runtime_oid, current_user, 'MEMBER') THEN
    RAISE EXCEPTION 'Run this migration as the migration operator. The server role must not be, or be a member of, the table owner.';
  END IF;
  -- One owner for every table: the role that owns the migration ledger runs the migrations.
  SELECT pg_catalog.pg_get_userbyid(c.relowner) INTO ledger_owner
  FROM pg_catalog.pg_class c WHERE c.oid = pg_catalog.to_regclass('public._prisma_migrations');
  IF ledger_owner IS NOT NULL AND ledger_owner <> current_user THEN
    RAISE EXCEPTION 'Run this migration as %, the owner of the migration ledger (current role: %).', ledger_owner, current_user;
  END IF;
  -- Only tables and their sequences are expected to belong to the server role.
  SELECT pg_catalog.string_agg(o.name, ', ' ORDER BY o.name) INTO problem FROM (
    SELECT c.relname::text AS name FROM pg_catalog.pg_class c
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('v', 'm', 'f') AND c.relowner = runtime_oid
    UNION ALL
    SELECT f.oid::regprocedure::text FROM pg_catalog.pg_proc f
    WHERE f.pronamespace = 'public'::regnamespace AND f.proowner = runtime_oid
  ) o;
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION 'The server role owns objects this migration does not move: %', problem;
  END IF;

  IF pg_catalog.current_setting('server_version_num')::int >= 170000 THEN
    structural := structural || ', MAINTAIN';
  END IF;
  SELECT pg_catalog.string_agg(pg_catalog.quote_ident(r.rolname), ', ' ORDER BY r.rolname), pg_catalog.array_agg(r.oid)
  INTO browser_roles, browser_oids
  FROM pg_catalog.pg_roles r WHERE r.rolname IN ('anon', 'authenticated');

  -- What the server role can do now, as owner or by grant. It must still be able to afterwards.
  SELECT pg_catalog.array_agg(c.oid::text || ':' || x.privilege) INTO had_table
  FROM pg_catalog.pg_class c CROSS JOIN pg_catalog.unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']) AS x(privilege)
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p') AND c.relname <> '_prisma_migrations'
    AND pg_catalog.has_table_privilege(runtime_oid, c.oid, x.privilege);
  SELECT pg_catalog.array_agg(c.oid::text || ':' || x.privilege) INTO had_sequence
  FROM pg_catalog.pg_class c CROSS JOIN pg_catalog.unnest(ARRAY['USAGE', 'SELECT', 'UPDATE']) AS x(privilege)
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'S'
    AND pg_catalog.has_sequence_privilege(runtime_oid, c.oid, x.privilege);

  FOR t IN
    SELECT c.oid, c.relname, c.relowner = runtime_oid AS runtime_owned, c.relrowsecurity,
      EXISTS (
        SELECT 1 FROM pg_catalog.pg_policy pol
        WHERE pol.polrelid = c.oid AND pol.polpermissive AND pol.polname <> 'outclass_runtime_access'
          AND runtime_oid = ANY (pol.polroles)
      ) AS has_own_policies
    FROM pg_catalog.pg_class c
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p') AND c.relname <> '_prisma_migrations'
    ORDER BY c.relname
  LOOP
    IF t.has_own_policies THEN
      -- Already the target model (operator-owned, narrower explicit access). Owning such a
      -- table as well would mean its policies never applied; that needs a person to decide.
      IF t.runtime_owned THEN
        RAISE EXCEPTION 'Table % is owned by the server role and also has its own server-role policies. Decide its intended access by hand.', t.relname;
      END IF;
      CONTINUE;
    END IF;

    -- Ownership first. A grant issued while the server role still owns the table is recorded
    -- as owner-to-itself and would move to the new owner with the table.
    IF t.runtime_owned THEN
      EXECUTE pg_catalog.format('ALTER TABLE public.%I OWNER TO %I', t.relname, current_user);
    END IF;
    IF NOT t.relrowsecurity THEN
      EXECUTE pg_catalog.format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
    END IF;
    IF NOT (pg_catalog.has_table_privilege(runtime_oid, t.oid, 'SELECT') AND pg_catalog.has_table_privilege(runtime_oid, t.oid, 'INSERT')
        AND pg_catalog.has_table_privilege(runtime_oid, t.oid, 'UPDATE') AND pg_catalog.has_table_privilege(runtime_oid, t.oid, 'DELETE')) THEN
      EXECUTE pg_catalog.format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO %I', t.relname, runtime);
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_policy pol
      WHERE pol.polrelid = t.oid AND pol.polname = 'outclass_runtime_access' AND pol.polpermissive AND pol.polcmd = '*'
        AND pol.polroles = ARRAY[runtime_oid]
        AND pg_catalog.pg_get_expr(pol.polqual, pol.polrelid) = 'true'
        AND pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid) = 'true'
    ) THEN
      EXECUTE pg_catalog.format('DROP POLICY IF EXISTS outclass_runtime_access ON public.%I', t.relname);
      EXECUTE pg_catalog.format(
        'CREATE POLICY outclass_runtime_access ON public.%I FOR ALL TO %I USING (true) WITH CHECK (true)',
        t.relname, runtime);
    END IF;

    -- Deny-everyone policies only ever let the owner through. Scope them to the browser roles
    -- they exist for, so the server role is governed by its own policy above. Naming roles,
    -- rather than adding a condition, keeps every server query plan as it is.
    FOR p IN
      SELECT pol.polname FROM pg_catalog.pg_policy pol
      WHERE pol.polrelid = t.oid AND NOT pol.polpermissive AND pol.polroles = ARRAY[0]::oid[]
        AND pg_catalog.pg_get_expr(pol.polqual, pol.polrelid) = 'false'
    LOOP
      IF browser_roles IS NULL THEN
        EXECUTE pg_catalog.format('DROP POLICY %I ON public.%I', p.polname, t.relname);
      ELSE
        EXECUTE pg_catalog.format('ALTER POLICY %I ON public.%I TO %s', p.polname, t.relname, browser_roles);
      END IF;
    END LOOP;
    -- Every such table denies the browser roles, including tables that had no deny policy:
    -- an accidental grant plus a permissive policy must not expose rows.
    IF browser_roles IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_policy pol
      WHERE pol.polrelid = t.oid AND NOT pol.polpermissive AND pol.polcmd = '*'
        AND pg_catalog.pg_get_expr(pol.polqual, pol.polrelid) = 'false'
        AND pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid) = 'false'
        AND (0 = ANY (pol.polroles) OR pol.polroles @> browser_oids)
    ) THEN
      EXECUTE pg_catalog.format('DROP POLICY IF EXISTS outclass_browser_deny ON public.%I', t.relname);
      EXECUTE pg_catalog.format(
        'CREATE POLICY outclass_browser_deny ON public.%I AS RESTRICTIVE FOR ALL TO %s USING (false) WITH CHECK (false)',
        t.relname, browser_roles);
    END IF;

    -- Sequences behind this table's columns moved with it; serial defaults call nextval as the writer.
    FOR p IN
      SELECT s.oid, s.relname FROM pg_catalog.pg_depend d
      JOIN pg_catalog.pg_class s ON s.oid = d.objid AND s.relkind = 'S'
      WHERE d.classid = 'pg_catalog.pg_class'::regclass AND d.refclassid = 'pg_catalog.pg_class'::regclass
        AND d.refobjid = t.oid AND d.deptype IN ('a', 'i')
        AND NOT (pg_catalog.has_sequence_privilege(runtime_oid, s.oid, 'USAGE') AND pg_catalog.has_sequence_privilege(runtime_oid, s.oid, 'SELECT')
             AND pg_catalog.has_sequence_privilege(runtime_oid, s.oid, 'UPDATE'))
    LOOP
      EXECUTE pg_catalog.format('GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.%I TO %I', p.relname, runtime);
    END LOOP;
  END LOOP;

  -- Free-standing sequences, and any sequence privilege the server role held another way.
  FOR t IN
    SELECT c.oid, c.relname, c.relowner = runtime_oid AS runtime_owned
    FROM pg_catalog.pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'S' ORDER BY c.relname
  LOOP
    IF t.runtime_owned THEN
      EXECUTE pg_catalog.format('ALTER SEQUENCE public.%I OWNER TO %I', t.relname, current_user);
    END IF;
    FOREACH privilege IN ARRAY ARRAY['USAGE', 'SELECT', 'UPDATE'] LOOP
      IF (t.oid::text || ':' || privilege) = ANY (had_sequence) AND NOT pg_catalog.has_sequence_privilege(runtime_oid, t.oid, privilege) THEN
        EXECUTE pg_catalog.format('GRANT %s ON SEQUENCE public.%I TO %I', privilege, t.relname, runtime);
      END IF;
    END LOOP;
  END LOOP;

  -- Structural privileges are not part of the model on any table, however they were granted.
  FOR t IN
    SELECT c.relname FROM pg_catalog.pg_class c, pg_catalog.aclexplode(c.relacl) a
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p') AND a.grantee = runtime_oid
      AND a.privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN')
    GROUP BY c.relname ORDER BY c.relname
  LOOP
    EXECUTE pg_catalog.format('REVOKE %s ON public.%I FROM %I', structural, t.relname, runtime);
  END LOOP;

  -- Self-checks. Any failure rolls the whole migration back.
  SELECT pg_catalog.string_agg(c.relname, ', ' ORDER BY c.relname) INTO problem
  FROM pg_catalog.pg_class c
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'S', 'v', 'm', 'f') AND c.relowner = runtime_oid;
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION 'The server role still owns: %', problem;
  END IF;

  SELECT pg_catalog.string_agg(pg_catalog.split_part(h, ':', 2) || ' on ' || pg_catalog.split_part(h, ':', 1)::oid::regclass::text, ', ') INTO problem
  FROM pg_catalog.unnest(had_table) AS h
  WHERE NOT pg_catalog.has_table_privilege(runtime_oid, pg_catalog.split_part(h, ':', 1)::oid, pg_catalog.split_part(h, ':', 2));
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION 'The server role would lose table privileges it had: %', problem;
  END IF;
  SELECT pg_catalog.string_agg(pg_catalog.split_part(h, ':', 2) || ' on ' || pg_catalog.split_part(h, ':', 1)::oid::regclass::text, ', ') INTO problem
  FROM pg_catalog.unnest(had_sequence) AS h
  WHERE NOT pg_catalog.has_sequence_privilege(runtime_oid, pg_catalog.split_part(h, ':', 1)::oid, pg_catalog.split_part(h, ':', 2));
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION 'The server role would lose sequence privileges it had: %', problem;
  END IF;

  -- A privilege is not enough under row-level security: wherever the server role is governed
  -- by outclass_runtime_access, row security must be on and no restrictive policy may apply to
  -- it, by name, through PUBLIC or through a role it is a member of.
  SELECT pg_catalog.string_agg(DISTINCT c.relname, ', ') INTO problem
  FROM pg_catalog.pg_policy mine
  JOIN pg_catalog.pg_class c ON c.oid = mine.polrelid AND c.relnamespace = 'public'::regnamespace
  WHERE mine.polname = 'outclass_runtime_access'
    AND (NOT c.relrowsecurity OR EXISTS (
      SELECT 1 FROM pg_catalog.pg_policy pol
      WHERE pol.polrelid = mine.polrelid AND NOT pol.polpermissive
        AND EXISTS (
          SELECT 1 FROM pg_catalog.unnest(pol.polroles) AS member_of(role_oid)
          WHERE CASE WHEN member_of.role_oid = 0 THEN true
                     ELSE pg_catalog.pg_has_role(runtime_oid, member_of.role_oid, 'MEMBER') END)));
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION 'A restrictive policy would still block the server role, or row security is off, on: %', problem;
  END IF;

  SELECT pg_catalog.string_agg(c.relname, ', ' ORDER BY c.relname) INTO problem
  FROM pg_catalog.pg_class c
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p')
    AND (pg_catalog.has_table_privilege(runtime_oid, c.oid, 'TRUNCATE') OR pg_catalog.has_table_privilege(runtime_oid, c.oid, 'REFERENCES')
      OR pg_catalog.has_table_privilege(runtime_oid, c.oid, 'TRIGGER'));
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION 'The server role keeps a structural privilege (TRUNCATE, REFERENCES or TRIGGER) on: %', problem;
  END IF;

  -- CHECK constraints and column defaults call their helper functions as the writing role.
  SELECT pg_catalog.string_agg(DISTINCT f.oid::regprocedure::text, ', ') INTO problem
  FROM pg_catalog.pg_depend d
  JOIN pg_catalog.pg_proc f ON f.oid = d.refobjid AND f.pronamespace = 'public'::regnamespace
  WHERE d.refclassid = 'pg_catalog.pg_proc'::regclass
    AND (d.classid = 'pg_catalog.pg_attrdef'::regclass
      OR (d.classid = 'pg_catalog.pg_constraint'::regclass AND EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint k WHERE k.oid = d.objid AND k.contype = 'c' AND k.connamespace = 'public'::regnamespace)))
    AND NOT pg_catalog.has_function_privilege(runtime_oid, f.oid, 'EXECUTE');
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION 'The server role cannot execute a CHECK or default helper: %', problem;
  END IF;

  IF pg_catalog.has_schema_privilege(runtime_oid, 'public', 'CREATE') THEN
    RAISE WARNING 'The server role can still create objects in schema public. Revoke CREATE on the schema from it and from PUBLIC.';
  END IF;
END
$migration$;
COMMIT;
