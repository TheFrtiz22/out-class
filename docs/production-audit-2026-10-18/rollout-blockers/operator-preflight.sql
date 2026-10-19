-- READ ONLY. Run with the separately approved operator connection, never the
-- web runtime. Returns aggregate readiness, no Auth tokens, emails or user IDs.
BEGIN READ ONLY;
SET LOCAL statement_timeout='5s';
SELECT jsonb_build_object(
  'pending_app_invites', (SELECT count(*) FROM auth.users a JOIN public."User" u ON u.id=a.id::text
    WHERE a.invited_at IS NOT NULL AND a.email_confirmed_at IS NULL AND a.confirmation_token<>''),
  'pending_without_binding', (SELECT count(*) FROM auth.users a JOIN public."User" u ON u.id=a.id::text
    WHERE a.invited_at IS NOT NULL AND a.email_confirmed_at IS NULL AND a.confirmation_token<>''
      AND NOT EXISTS(SELECT FROM public."AuditLog" l WHERE l."targetId"=u.id
        AND l.action='platform.student.invitation.binding'
        AND l.details->>'fingerprint'=encode(sha256(convert_to('outclass-student-invite-v1','UTF8')
          ||decode('00','hex')||convert_to(a.confirmation_token,'UTF8')),'hex'))),
  'operator_lock_grant_delegable', has_column_privilege(current_user,'auth.sessions','updated_at','UPDATE WITH GRANT OPTION'),
  'auth_policy_management_delegated', coalesce((coalesce(nullif(current_setting('supautils.policy_grants',true),''),'{}')::jsonb->current_user::text) ? 'auth.sessions',false),
  'storage_policy_management_delegated', coalesce((coalesce(nullif(current_setting('supautils.policy_grants',true),''),'{}')::jsonb->current_user::text) ? 'storage.objects',false),
  'view_migrated', EXISTS(SELECT FROM pg_class v JOIN pg_namespace n ON n.oid=v.relnamespace WHERE n.nspname='public' AND v.relname='outclass_auth_sessions' AND 'security_invoker=true'=ANY(v.reloptions)),
  'auth_owner_inherited', pg_has_role(current_user,'supabase_auth_admin','USAGE'),
  'auth_owner_settable', pg_has_role(current_user,'supabase_auth_admin','SET'),
  'storage_owner_inherited', pg_has_role(current_user,'supabase_storage_admin','USAGE'),
  'storage_owner_settable', pg_has_role(current_user,'supabase_storage_admin','SET'),
  'runtime_auth_usage', has_schema_privilege('outclass_production_app','auth','USAGE'),
  'runtime_session_read', has_column_privilege('outclass_production_app','auth.sessions','id','SELECT')
    AND has_column_privilege('outclass_production_app','auth.sessions','user_id','SELECT')
    AND has_column_privilege('outclass_production_app','auth.sessions','not_after','SELECT')
) AS readiness;
COMMIT;
