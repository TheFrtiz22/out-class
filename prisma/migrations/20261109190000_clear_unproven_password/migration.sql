-- On an account's first email confirmation, clear any password that was stored while the address was
-- still unconfirmed. Passwords that sign in are then the ones set by a confirmed session: the signup
-- wizard sets the chosen password again right after the code is verified, and recovery and student claim
-- already set it after verification.
--
-- Scope:
-- - fires only when auth.users.email_confirmed_at changes from NULL to a value;
-- - keeps a password written in that same statement (an operator setting it while confirming);
-- - already-confirmed accounts, later password changes and sign-ins are untouched;
-- - an empty encrypted_password never matches at password sign-in; email-code sign-in still works.
-- Supabase Auth creates auth.users outside the Prisma ledger, so the trigger step is conditional:
-- environments without auth.users are unchanged. Without the TRIGGER privilege it raises a WARNING (not an
-- error, so a failed ledger row cannot block later deploys) and must be checked after applying.
BEGIN;

CREATE OR REPLACE FUNCTION public.outclass_clear_unproven_password() RETURNS trigger
  LANGUAGE plpgsql SET search_path = '' AS $fn$
BEGIN
  IF NEW.encrypted_password IS NOT DISTINCT FROM OLD.encrypted_password THEN
    NEW.encrypted_password := '';
  END IF;
  RETURN NEW;
END
$fn$;
REVOKE ALL ON FUNCTION public.outclass_clear_unproven_password() FROM PUBLIC;

DO $trg$
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RETURN;
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'auth' AND table_name = 'users'
        AND column_name IN ('email_confirmed_at', 'encrypted_password')) <> 2 THEN
    RAISE WARNING 'auth.users lacks email_confirmed_at or encrypted_password; outclass_clear_unproven_password not attached';
    RETURN;
  END IF;
  IF NOT has_table_privilege(current_user, 'auth.users', 'TRIGGER') THEN
    RAISE WARNING '% cannot create triggers on auth.users; attach outclass_clear_unproven_password as a role that can', current_user;
    RETURN;
  END IF;
  DROP TRIGGER IF EXISTS outclass_clear_unproven_password ON auth.users;
  CREATE TRIGGER outclass_clear_unproven_password
    BEFORE UPDATE ON auth.users
    FOR EACH ROW
    WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
    EXECUTE FUNCTION public.outclass_clear_unproven_password();
END
$trg$;

COMMIT;
