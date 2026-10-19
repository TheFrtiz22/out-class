# Provider-owner action needed for the restricted web login

Project: `htlgjluegmdwfjkzzwic`.

Verified follow-up on October 19: running the original SQL in SQL Editor reported success, but both the Supabase connector and direct production operator connection still return `false` for `has_column_privilege('postgres','auth.sessions','updated_at','UPDATE WITH GRANT OPTION')`. The column ACL is empty. The strengthened script raises `P0001: Provider grant did not take effect` in the user's SQL Editor. Please execute through a provider-approved connection that actually owns the table or holds the grant option; repeating the grant as the existing `postgres` role does not resolve it. [Read-only verification](provider-grant-recheck.json).

The project's `postgres` operator can UPDATE `auth.sessions`, but no session column has UPDATE WITH GRANT OPTION. Existing administrator/support transactions require session `FOR SHARE` locks; PostgreSQL requires a column UPDATE ACL for those locks. The least-privilege web role must retain that locking guarantee while actual writes remain denied.

Please execute [the owner prerequisite](provider-lock-grant.sql) as the provider-approved owner operator: `GRANT UPDATE(updated_at) ON auth.sessions TO postgres WITH GRANT OPTION`.

Use the complete linked transaction, including its postcondition. It must commit only after `has_column_privilege('postgres','auth.sessions','updated_at','UPDATE WITH GRANT OPTION')` returns `true`. PostgreSQL can otherwise issue only a warning for a non-owner's unsupported grant and still commit; see [the GRANT documentation](https://www.postgresql.org/docs/17/sql-grant.html#SQL-GRANT-NOTES).

This grants delegation on one column to an operator that already has UPDATE access. It does not add application/browser privileges, change a password/table owner/RLS setting, or modify session rows. The application proposal separately constrains the web role's column ACLs, invoker view, RLS and false write checks; real concurrent locks and denied writes are tested.

After the application grant inverse removes dependent grants, the owner can reverse this prerequisite with `REVOKE GRANT OPTION FOR UPDATE(updated_at) ON auth.sessions FROM postgres`. Do not use CASCADE; any remaining dependency should abort the inverse.

No credential, session token, student identifier or data export is needed for this request. This is a draft; it has not been sent to anyone.
