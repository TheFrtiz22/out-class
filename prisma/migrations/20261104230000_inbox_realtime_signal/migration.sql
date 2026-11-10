-- Live inbox updates over Supabase Realtime, without opening any table to the browser.
--
-- Any write to "UserNotification" broadcasts an empty "inbox" event on the private
-- topic inbox:<userId>. The payload carries no data: the browser treats it as
-- "something changed" and reloads through the existing authorized inbox endpoint.
-- Only the owner of that user id may receive on the topic, and no browser role may
-- send on it. All application tables keep their deny-all browser posture.
--
-- Supabase owns the realtime and auth schemas. On plain PostgreSQL (tests, local
-- fixtures) this migration is a no-op; re-running it is safe.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10s';
DO $migration$ BEGIN
  IF to_regclass('realtime.messages') IS NULL
    OR to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NULL
    OR to_regprocedure('realtime.topic()') IS NULL
    OR to_regprocedure('auth.uid()') IS NULL THEN
    RAISE NOTICE 'Supabase Realtime is absent; live inbox signals are not installed.';
    RETURN;
  END IF;
  -- Supabase manages realtime.messages RLS. Without it the receive policy would not
  -- confine topics, so refuse rather than install an unconfined channel.
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid = pg_catalog.to_regclass('realtime.messages') AND relrowsecurity) THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'realtime.messages must have row-level security enabled before installing live inbox signals.';
  END IF;

  -- Statement-level: a bulk insert (announcement fan-out) signals each recipient once.
  -- A signalling failure never rolls back the notification write; clients still
  -- refresh on focus and on reconnect.
  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.outclass_signal_inbox() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $body$
    DECLARE recipient text;
    BEGIN
      FOR recipient IN SELECT DISTINCT changed."userId" FROM changed LOOP
        BEGIN
          PERFORM realtime.send('{}'::jsonb, 'inbox', 'inbox:' || recipient, true);
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'live inbox signal skipped (%)', SQLSTATE;
        END;
      END LOOP;
      RETURN NULL;
    END
    $body$
  $fn$;
  REVOKE ALL ON FUNCTION public.outclass_signal_inbox() FROM PUBLIC;
  EXECUTE 'REVOKE ALL ON FUNCTION public.outclass_signal_inbox() FROM anon, authenticated';

  DROP TRIGGER IF EXISTS outclass_inbox_signal_insert ON public."UserNotification";
  DROP TRIGGER IF EXISTS outclass_inbox_signal_update ON public."UserNotification";
  DROP TRIGGER IF EXISTS outclass_inbox_signal_delete ON public."UserNotification";
  CREATE TRIGGER outclass_inbox_signal_insert AFTER INSERT ON public."UserNotification"
    REFERENCING NEW TABLE AS changed FOR EACH STATEMENT EXECUTE FUNCTION public.outclass_signal_inbox();
  CREATE TRIGGER outclass_inbox_signal_update AFTER UPDATE ON public."UserNotification"
    REFERENCING NEW TABLE AS changed FOR EACH STATEMENT EXECUTE FUNCTION public.outclass_signal_inbox();
  CREATE TRIGGER outclass_inbox_signal_delete AFTER DELETE ON public."UserNotification"
    REFERENCING OLD TABLE AS changed FOR EACH STATEMENT EXECUTE FUNCTION public.outclass_signal_inbox();

  -- Receive: a signed-in user may join only their own inbox topic.
  DROP POLICY IF EXISTS outclass_inbox_signal_receive ON realtime.messages;
  CREATE POLICY outclass_inbox_signal_receive ON realtime.messages
    FOR SELECT TO authenticated
    USING (extension = 'broadcast' AND (SELECT realtime.topic()) = 'inbox:' || (SELECT auth.uid())::text);
  -- Send: no browser role may publish on any inbox topic, even if another
  -- permissive policy is added later. The trigger's definer role bypasses RLS.
  DROP POLICY IF EXISTS outclass_inbox_signal_no_client_send ON realtime.messages;
  CREATE POLICY outclass_inbox_signal_no_client_send ON realtime.messages
    AS RESTRICTIVE FOR INSERT TO PUBLIC
    WITH CHECK (topic NOT LIKE 'inbox:%');
END $migration$;
COMMIT;
