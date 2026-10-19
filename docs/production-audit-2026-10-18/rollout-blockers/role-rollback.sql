-- First restore the compatibility deployment and remove the new web binding.
-- Then run runtime-role/rollback.sql. No existing credential is modified.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='10s';
ALTER ROLE outclass_web_runtime NOLOGIN;
REVOKE outclass_production_app FROM outclass_web_runtime;
DROP ROLE outclass_web_runtime;
COMMIT;
