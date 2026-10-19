# Provider-owner action needed for the restricted web login

Project: `htlgjluegmdwfjkzzwic`.

The project's `postgres` operator can UPDATE `auth.sessions`, but no session column has UPDATE WITH GRANT OPTION. Existing administrator/support transactions require session `FOR SHARE` locks; PostgreSQL requires a column UPDATE ACL for those locks. The least-privilege web role must retain that locking guarantee while actual writes remain denied.

Please execute [the owner prerequisite](provider-lock-grant.sql) as the provider-approved owner operator: `GRANT UPDATE(updated_at) ON auth.sessions TO postgres WITH GRANT OPTION`.

This grants delegation on one column to an operator that already has UPDATE access. It does not add application/browser privileges, change a password/table owner/RLS setting, or modify session rows. The application proposal separately constrains the web role's column ACLs, invoker view, RLS and false write checks; real concurrent locks and denied writes are tested.

After the application grant inverse removes dependent grants, the owner can reverse this prerequisite with `REVOKE GRANT OPTION FOR UPDATE(updated_at) ON auth.sessions FROM postgres`. Do not use CASCADE; any remaining dependency should abort the inverse.

No credential, session token, student identifier or data export is needed for this request. This is a draft; it has not been sent to anyone.
