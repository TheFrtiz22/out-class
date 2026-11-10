-- On an account's first email confirmation, clear any password that was stored while the address was
-- still unconfirmed. Passwords that sign in are then the ones set by a confirmed session: the signup
-- wizard sets the chosen password again right after the code is verified, and recovery and student claim
-- already set it after verification.
--
-- Deploy order: the signup-wizard change must be live before this is applied, or new students' signup
-- passwords are cleared at confirmation (they can still sign in with an email code or reset).
--
-- Scope:
-- - acts only when auth.users.email_confirmed_at changes from NULL to a value;
-- - keeps the password when this same transaction created the user or set its password (Supabase Auth's
--   admin create with email_confirm, or an admin update that sets a password and confirms);
-- - already-confirmed accounts, later password changes and sign-ins are untouched;
-- - an empty encrypted_password never matches at password sign-in; email-code sign-in still works.
-- Supabase Auth creates auth.users outside the Prisma ledger, so the trigger step is conditional:
-- environments without auth.users are unchanged. Without the TRIGGER privilege it raises a WARNING (not an
-- error, so a failed ledger row cannot block later deploys) and must be checked after applying:
--   SELECT tgenabled FROM pg_trigger WHERE tgname = 'outclass_clear_unproven_password'
--     AND tgrelid = 'auth.users'::regclass;   -- expect 'O'
BEGIN;

SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.outclass_clear_unproven_password() RETURNS trigger
  LANGUAGE plpgsql SET search_path = '' AS $fn$
DECLARE
  trusted text := coalesce(pg_catalog.current_setting('outclass.auth_password_set', true), '');
BEGIN
  -- Transaction-local list of users created, or given a password, by this transaction.
  IF TG_OP = 'INSERT' OR NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password THEN
    PERFORM pg_catalog.set_config('outclass.auth_password_set', trusted || ',' || NEW.id::text || ',', true);
    RETURN NEW;
  END IF;
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL
     AND pg_catalog.strpos(trusted, ',' || OLD.id::text || ',') = 0 THEN
    NEW.encrypted_password := '';
  END IF;
  RETURN NEW;
END
$fn$;
REVOKE ALL ON FUNCTION public.outclass_clear_unproven_password() FROM PUBLIC;

DO $trg$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION public.outclass_clear_unproven_password() FROM %I', r);
    END IF;
  END LOOP;
  IF to_regclass('auth.users') IS NULL THEN
    RETURN;
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'auth' AND table_name = 'users'
        AND column_name IN ('id', 'email_confirmed_at', 'encrypted_password')) <> 3 THEN
    RAISE WARNING 'auth.users lacks id, email_confirmed_at or encrypted_password; outclass_clear_unproven_password not attached';
    RETURN;
  END IF;
  IF NOT has_table_privilege(current_user, 'auth.users', 'TRIGGER') THEN
    RAISE WARNING '% cannot create triggers on auth.users; attach outclass_clear_unproven_password as a role that can', current_user;
    RETURN;
  END IF;
  DROP TRIGGER IF EXISTS outclass_clear_unproven_password ON auth.users;
  CREATE TRIGGER outclass_clear_unproven_password
    BEFORE INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.outclass_clear_unproven_password();
END
$trg$;

COMMIT;
