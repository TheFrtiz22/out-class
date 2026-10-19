-- Provider-owner prerequisite only. The connected postgres operator has UPDATE
-- but cannot delegate it. It can already manage the Auth/Storage RLS policies
-- through Supabase's configured supautils.policy_grants delegation.
-- Run as auth.sessions owner / provider-approved owner operator.
-- No web credential, table owner, RLS setting or application-data change.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='10s';
GRANT UPDATE(updated_at) ON auth.sessions TO postgres WITH GRANT OPTION;
COMMIT;

-- Inverse, only AFTER runtime-role/rollback.sql removes dependent web grants:
-- REVOKE GRANT OPTION FOR UPDATE(updated_at) ON auth.sessions FROM postgres;
-- Deliberately omit CASCADE: remaining dependencies must abort the inverse.
