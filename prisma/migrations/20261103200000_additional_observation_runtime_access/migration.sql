BEGIN;
SET LOCAL lock_timeout = '5s';
-- The bounded application login is neither a superuser nor BYPASSRLS. Table
-- grants alone do not permit reference reads/inserts on this postgres-owned
-- table. Give only that existing server role row policies; end-user authority
-- remains checked by the actions and reference-scope trigger.
DO $runtime$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='outclass_production_app') THEN
  GRANT SELECT,INSERT ON "VotingObservationReference" TO outclass_production_app;
  CREATE POLICY voting_observation_runtime_read ON "VotingObservationReference"
   FOR SELECT TO outclass_production_app USING (true);
  CREATE POLICY voting_observation_runtime_insert ON "VotingObservationReference"
   FOR INSERT TO outclass_production_app WITH CHECK (true);
 END IF;
END $runtime$;
-- RLS, immutable reference guards, and the absence of browser grants are kept.
COMMIT;
