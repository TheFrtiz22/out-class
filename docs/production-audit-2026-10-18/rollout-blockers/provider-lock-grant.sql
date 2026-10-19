    -- Provider-owner prerequisite only. The connected postgres operator has UPDATE
    -- but cannot delegate it. It can already manage the Auth/Storage RLS policies
    -- through Supabase's configured supautils.policy_grants delegation.
    -- Run as auth.sessions owner / provider-approved owner operator.
    -- No web credential, table owner, RLS setting or application-data change.
    BEGIN;
    SET LOCAL lock_timeout='3s';
    SET LOCAL statement_timeout='10s';
    GRANT UPDATE(updated_at) ON auth.sessions TO postgres WITH GRANT OPTION;
    -- GRANT can emit only a warning when the executing role cannot delegate.
    -- A successful COMMIT alone is not proof that this prerequisite took effect.
    DO $$ BEGIN
    IF NOT has_column_privilege('postgres','auth.sessions','updated_at','UPDATE WITH GRANT OPTION') THEN
    RAISE EXCEPTION 'Provider grant did not take effect: execute as auth.sessions owner or an operator with UPDATE(updated_at) WITH GRANT OPTION';
    END IF;
    END $$;
    COMMIT;

    -- Inverse, only AFTER runtime-role/rollback.sql removes dependent web grants:
    -- REVOKE GRANT OPTION FOR UPDATE(updated_at) ON auth.sessions FROM postgres;
    -- Deliberately omit CASCADE: remaining dependencies must abort the inverse.
