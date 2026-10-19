-- REVIEW ONLY. Restore the previous application/secret binding BEFORE this SQL.
-- Valid only for access-proposal.sql's verified no-prior-grants baseline.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10s';
ALTER POLICY outclass_club_assets_server_only ON storage.objects
 USING (bucket_id <> 'club-assets') WITH CHECK (bucket_id <> 'club-assets');
DROP POLICY outclass_runtime_club_asset_read ON storage.objects;
DROP POLICY outclass_runtime_session_lock ON auth.sessions;
DROP POLICY outclass_runtime_session_no_write ON auth.sessions;
DROP POLICY outclass_runtime_session_read ON auth.sessions;
REVOKE SELECT (bucket_id, name) ON storage.objects FROM outclass_production_app;
REVOKE SELECT (id, user_id, not_after), UPDATE (updated_at) ON auth.sessions FROM outclass_production_app;
REVOKE USAGE ON SCHEMA auth, storage FROM outclass_production_app;
COMMIT;
