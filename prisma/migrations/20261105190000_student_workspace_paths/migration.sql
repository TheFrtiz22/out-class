-- Student workspace views moved from `/?workspace=student&view=…` to real paths.
-- New notifications link to /applications. Existing rows keep their old href;
-- middleware redirects it, so no data is rewritten here.
--
-- Bodies are copied verbatim from the latest definitions
-- (outclass_application_notification: 20261028180000_live_voting_without_ballot,
--  outclass_booking_notification: 20261014230000_interview_self_booking)
-- with only the href literal changed. CREATE OR REPLACE keeps owner, grants
-- and the triggers that call them.

BEGIN;
CREATE OR REPLACE FUNCTION outclass_application_notification() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='UPDATE' AND EXISTS (
  SELECT 1 FROM "VotingSession" s JOIN "VotingCandidate" c ON c."sessionId"=s.id
  WHERE s.id=current_setting('outclass.voting_finalization',true) AND s.mode='LIVE' AND s.state='COMPLETED' AND s."finalizedAt" IS NULL
   AND s."clubId"=OLD."clubId" AND s."roundId"=OLD."roundId" AND s."cycleId"=OLD."recruitmentCycleId" AND c."applicationId"=OLD.id
 ) THEN RETURN NEW; END IF;
 IF NEW.status IN ('ACCEPTED','WAITLISTED','REJECTED') AND NEW."decisionVersion">0 THEN RETURN NEW; END IF;
 IF NEW.status='DRAFTING' OR NEW."submittedAt" IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND NEW.status=OLD.status AND NEW."roundId"=OLD."roundId" THEN RETURN NEW; END IF;
 PERFORM outclass_notify(NEW."studentId",NEW."clubId",'application:'||NEW.id||':'||gen_random_uuid()::text,
 CASE WHEN NEW.status='INTERVIEWING' THEN 'INTERVIEW' ELSE 'APPLICATION' END,
 CASE WHEN NEW.status='INTERVIEWING' THEN 'You have an interview invitation' ELSE 'Application update' END,
 'Your application status is '||replace(lower(NEW.status::text),'_',' ')||'. Open your application for the latest details.',
 '/applications');
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION outclass_booking_notification() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE app "Application"; BEGIN
  SELECT * INTO app FROM "Application" WHERE id=COALESCE(NEW."applicationId",OLD."applicationId");
  IF app.id IS NULL THEN RETURN COALESCE(NEW,OLD); END IF;
  PERFORM outclass_notify(app."studentId",app."clubId",'booking:'||COALESCE(NEW.id,OLD.id)||':'||TG_OP||':'||gen_random_uuid()::text,'INTERVIEW',
    CASE WHEN TG_OP='DELETE' THEN 'Interview booking cancelled' WHEN TG_OP='INSERT' THEN 'Interview confirmed' ELSE 'Interview booking updated' END,
    'Open your application to review your current interview schedule.',CASE WHEN COALESCE(NEW."roundId",OLD."roundId") IS NULL THEN '/applications' ELSE '/interviews/book?clubId='||app."clubId"||'&roundId='||COALESCE(NEW."roundId",OLD."roundId") END);
  RETURN COALESCE(NEW,OLD);
END $$;
COMMIT;
