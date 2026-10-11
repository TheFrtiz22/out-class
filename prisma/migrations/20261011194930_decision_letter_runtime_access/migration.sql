BEGIN;
-- Match the bounded server-role ownership model without changing browser grants,
-- restrictive RLS, immutable history, or any unrelated table.
DO $migration$
DECLARE runtime_had_create BOOLEAN;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'outclass_production_app') THEN
    RETURN;
  END IF;
  runtime_had_create := has_schema_privilege('outclass_production_app', 'public', 'CREATE');
  IF NOT runtime_had_create THEN
    GRANT CREATE ON SCHEMA public TO outclass_production_app;
  END IF;
  ALTER TABLE public."DecisionLetter" OWNER TO outclass_production_app;
  IF NOT runtime_had_create THEN
    REVOKE CREATE ON SCHEMA public FROM outclass_production_app;
  END IF;
END
$migration$;
COMMIT;
