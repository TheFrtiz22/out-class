BEGIN;
-- Existing OutClass production tables are owned by its bounded application role.
-- Keep the same access model for the tables introduced by the previous six
-- migrations. Fresh installations without that role need no adjustment.
DO $migration$
DECLARE
  table_name TEXT;
  function_signature TEXT;
  browser_role TEXT;
  runtime_had_create BOOLEAN;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'outclass_production_app') THEN
    RETURN;
  END IF;

  runtime_had_create := has_schema_privilege('outclass_production_app', 'public', 'CREATE');
  -- PostgreSQL requires CREATE on the schema when assigning table ownership.
  -- This temporary grant and its removal occur within the same transaction.
  IF NOT runtime_had_create THEN
    GRANT CREATE ON SCHEMA public TO outclass_production_app;
  END IF;

  FOREACH table_name IN ARRAY ARRAY[
    'SchoolRequest',
    'InterviewCollaboration', 'InterviewPresence', 'InterviewMove', 'InterviewInvitation',
    'ClubAnnouncement', 'UserNotification', 'UserNotificationPreference',
    'ClubConversation', 'ClubMessage', 'NotificationEmailOutbox', 'NotificationEmailDelivery'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO outclass_production_app', table_name);
  END LOOP;

  IF NOT runtime_had_create THEN
    REVOKE CREATE ON SCHEMA public FROM outclass_production_app;
  END IF;

  FOREACH function_signature IN ARRAY ARRAY[
    'public.outclass_collaboration_scope()',
    'public.outclass_notification_email_outbox()',
    'public.outclass_notify(text,text,text,text,text,text,text)',
    'public.outclass_application_notification()',
    'public.outclass_booking_notification()',
    'public.outclass_task_notification()',
    'public.outclass_invitation_notification()'
  ] LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO outclass_production_app', function_signature);
    -- Remove provider default function grants from browser database roles.
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', function_signature);
    FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = browser_role) THEN
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', function_signature, browser_role);
      END IF;
    END LOOP;
  END LOOP;
END
$migration$;
COMMIT;
