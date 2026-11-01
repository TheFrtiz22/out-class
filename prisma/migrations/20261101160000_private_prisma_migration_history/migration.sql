BEGIN;
SET LOCAL lock_timeout = '5s';

-- Prisma creates its ledger before deploying application migrations. Some isolated
-- SQL rehearsals intentionally have no ledger; do not create a competing one.
DO $migration$
DECLARE api_role text;
BEGIN
  IF to_regclass('public._prisma_migrations') IS NULL THEN RETURN; END IF;

  ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public._prisma_migrations FROM PUBLIC;
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON public._prisma_migrations FROM %I', api_role);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public._prisma_migrations', 'prisma_ledger_deny_' || api_role);
      EXECUTE format('CREATE POLICY %I ON public._prisma_migrations AS RESTRICTIVE FOR ALL TO %I USING (false) WITH CHECK (false)', 'prisma_ledger_deny_' || api_role, api_role);
    END IF;
  END LOOP;
END
$migration$;

-- Keep the migration owner, trusted-role grants and BYPASSRLS behavior intact.
-- No FORCE RLS: normal owner-operated Prisma history writes must keep working.
COMMIT;
