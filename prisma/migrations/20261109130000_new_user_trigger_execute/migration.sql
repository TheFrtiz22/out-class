-- public.handle_new_user() is a trigger function (auth.users AFTER INSERT -> public."User"). Firing a trigger
-- does not check EXECUTE, so browser-facing roles need no EXECUTE on it; remove the inherited and direct grants.
-- The function is created outside the Prisma ledger (Supabase Auth), so every step is conditional: environments
-- without the function or the Supabase roles are unchanged. Owners and service_role keep their grants.
DO $grants$
DECLARE r text;
BEGIN
  IF to_regprocedure('public.handle_new_user()') IS NULL THEN
    RETURN;
  END IF;
  REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM %I', r);
      -- A REVOKE by a role that does not own the function only warns; fail instead of recording a no-op.
      IF has_function_privilege(r, 'public.handle_new_user()', 'EXECUTE') THEN
        RAISE EXCEPTION 'public.handle_new_user() is still executable by %; apply as the function owner', r;
      END IF;
    END IF;
  END LOOP;
END
$grants$;
