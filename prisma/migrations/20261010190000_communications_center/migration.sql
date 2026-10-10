BEGIN;
-- AlterTable
ALTER TABLE "ClubAnnouncement" ADD COLUMN "requestKey" TEXT;
UPDATE "ClubAnnouncement" SET "requestKey"=id;
ALTER TABLE "ClubAnnouncement" ALTER COLUMN "requestKey" SET NOT NULL;

-- AlterTable
ALTER TABLE "UserNotification" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "ClubConversation" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderKind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationEmailOutbox" (
    "notificationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "deliveryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationEmailOutbox_pkey" PRIMARY KEY ("notificationId")
);

-- CreateTable
CREATE TABLE "NotificationEmailDelivery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "payload" JSONB NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstAttemptAt" TIMESTAMP(3),
    "leaseUntil" TIMESTAMP(3),
    "leaseToken" TEXT,
    "providerMessageId" TEXT,
    "failureCode" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationEmailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClubConversation_studentId_updatedAt_idx" ON "ClubConversation"("studentId", "updatedAt");

-- CreateIndex
CREATE INDEX "ClubConversation_clubId_updatedAt_idx" ON "ClubConversation"("clubId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClubConversation_clubId_studentId_key" ON "ClubConversation"("clubId", "studentId");

-- CreateIndex
CREATE INDEX "ClubMessage_conversationId_createdAt_id_idx" ON "ClubMessage"("conversationId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ClubMessage_senderId_createdAt_idx" ON "ClubMessage"("senderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClubMessage_conversationId_senderId_requestKey_key" ON "ClubMessage"("conversationId", "senderId", "requestKey");

-- CreateIndex
CREATE INDEX "NotificationEmailOutbox_status_createdAt_idx" ON "NotificationEmailOutbox"("status", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationEmailOutbox_deliveryId_idx" ON "NotificationEmailOutbox"("deliveryId");

-- CreateIndex
CREATE INDEX "NotificationEmailDelivery_status_nextAttemptAt_idx" ON "NotificationEmailDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "NotificationEmailDelivery_userId_createdAt_idx" ON "NotificationEmailDelivery"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClubAnnouncement_clubId_requestKey_key" ON "ClubAnnouncement"("clubId", "requestKey");

-- CreateIndex
CREATE INDEX "UserNotification_userId_updatedAt_idx" ON "UserNotification"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "ClubConversation" ADD CONSTRAINT "ClubConversation_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubConversation" ADD CONSTRAINT "ClubConversation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubMessage" ADD CONSTRAINT "ClubMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ClubConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubMessage" ADD CONSTRAINT "ClubMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEmailOutbox" ADD CONSTRAINT "NotificationEmailOutbox_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "UserNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEmailOutbox" ADD CONSTRAINT "NotificationEmailOutbox_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "NotificationEmailDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEmailDelivery" ADD CONSTRAINT "NotificationEmailDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClubAnnouncement" ADD CONSTRAINT announcement_request_length CHECK(length("requestKey") <= 100);
ALTER TABLE "ClubConversation" ADD CONSTRAINT conversation_subject_length CHECK(length(trim(subject)) BETWEEN 1 AND 200);
ALTER TABLE "ClubMessage" ADD CONSTRAINT message_body_length CHECK(length(trim(body)) BETWEEN 1 AND 10000), ADD CONSTRAINT message_sender_kind CHECK("senderKind" IN ('CLUB','STUDENT'));
ALTER TABLE "NotificationEmailOutbox" ADD CONSTRAINT email_outbox_status CHECK(status IN ('PENDING','ASSIGNED','SUPPRESSED'));
ALTER TABLE "NotificationEmailDelivery" ADD CONSTRAINT email_delivery_status CHECK(status IN ('QUEUED','SENDING','SENT','FAILED','SUPPRESSED','UNCERTAIN')), ADD CONSTRAINT email_attempt_count CHECK("attemptCount" BETWEEN 0 AND 8);

DO $$ DECLARE t TEXT; r TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['ClubConversation','ClubMessage','NotificationEmailOutbox','NotificationEmailDelivery'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON %I FROM PUBLIC',t);
    EXECUTE format('CREATE POLICY outclass_communications_server_only ON %I AS RESTRICTIVE FOR ALL TO PUBLIC USING(false) WITH CHECK(false)',t);
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON %I FROM %I',t,r); END IF;
    END LOOP;
  END LOOP;
END $$;

CREATE FUNCTION outclass_notification_email_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  INSERT INTO "NotificationEmailOutbox" ("notificationId") VALUES (NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER notification_email_outbox AFTER INSERT ON "UserNotification" FOR EACH ROW EXECUTE FUNCTION outclass_notification_email_outbox();
REVOKE ALL ON FUNCTION outclass_notification_email_outbox() FROM PUBLIC;

-- Runs with the caller's existing transaction/permissions; no security definer.
-- Only new events are captured. Migration never sends or queues historical mail.
CREATE FUNCTION outclass_notify(recipient TEXT, club TEXT, event_key TEXT, event_type TEXT, event_title TEXT, event_body TEXT, event_href TEXT) RETURNS void LANGUAGE sql AS $$
  INSERT INTO "UserNotification" (id,"userId","clubId","eventKey",type,title,body,href)
  SELECT gen_random_uuid()::text, recipient, club, event_key, event_type, event_title, event_body, event_href
  WHERE EXISTS(SELECT 1 FROM "User" WHERE id=recipient AND "disabledAt" IS NULL)
    AND EXISTS(SELECT 1 FROM "Club" WHERE id=club AND "suspendedAt" IS NULL)
  ON CONFLICT ("userId","eventKey") DO NOTHING;
$$;
REVOKE ALL ON FUNCTION outclass_notify(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;

CREATE FUNCTION outclass_application_notification() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.status='DRAFTING' OR NEW."submittedAt" IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND NEW.status=OLD.status AND NEW."roundId"=OLD."roundId" THEN RETURN NEW; END IF;
  PERFORM outclass_notify(NEW."studentId",NEW."clubId",'application:'||NEW.id||':'||gen_random_uuid()::text,
    CASE WHEN NEW.status='INTERVIEWING' THEN 'INTERVIEW' ELSE 'APPLICATION' END,
    CASE WHEN NEW.status='INTERVIEWING' THEN 'You have an interview invitation' ELSE 'Application update' END,
    'Your application status is '||replace(lower(NEW.status::text),'_',' ')||'. Open your application for the latest details.',
    '/?workspace=student&view=tracker');
  RETURN NEW;
END $$;
CREATE TRIGGER application_notification AFTER INSERT OR UPDATE OF status,"roundId","submittedAt" ON "Application" FOR EACH ROW EXECUTE FUNCTION outclass_application_notification();
REVOKE ALL ON FUNCTION outclass_application_notification() FROM PUBLIC;

CREATE FUNCTION outclass_booking_notification() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE app "Application"; BEGIN
  SELECT * INTO app FROM "Application" WHERE id=COALESCE(NEW."applicationId",OLD."applicationId");
  IF app.id IS NULL THEN RETURN COALESCE(NEW,OLD); END IF;
  PERFORM outclass_notify(app."studentId",app."clubId",'booking:'||COALESCE(NEW.id,OLD.id)||':'||TG_OP||':'||gen_random_uuid()::text,'INTERVIEW',
    CASE WHEN TG_OP='DELETE' THEN 'Interview booking cancelled' ELSE 'Interview booking updated' END,
    'Open your application to review your current interview schedule.','/?workspace=student&view=tracker');
  RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER booking_notification AFTER INSERT OR DELETE OR UPDATE OF "slotId" ON "InterviewBooking" FOR EACH ROW EXECUTE FUNCTION outclass_booking_notification();
REVOKE ALL ON FUNCTION outclass_booking_notification() FROM PUBLIC;

CREATE FUNCTION outclass_task_notification() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE task "ClubTask"; label TEXT; BEGIN
  SELECT * INTO task FROM "ClubTask" WHERE id=NEW."taskId";
  IF task.kind<>'TASK' OR task.status='DRAFT' OR NEW."memberId" IS NULL OR NOT EXISTS(SELECT 1 FROM "ClubMember" WHERE id=NEW."memberId" AND status='ACTIVE') THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN label='New task';
  ELSIF NEW."revisionRequestedAt" IS DISTINCT FROM OLD."revisionRequestedAt" AND NEW."revisionRequestedAt" IS NOT NULL THEN label='Revisions requested';
  ELSIF NEW."reviewedAt" IS DISTINCT FROM OLD."reviewedAt" AND NEW."reviewedAt" IS NOT NULL THEN label='Submission reviewed';
  ELSE RETURN NEW; END IF;
  PERFORM outclass_notify(NEW."userId",task."clubId",'task:'||NEW.id||':'||gen_random_uuid()::text,'TASK',label||': '||task.title,
    'Open your task for instructions and feedback.','/club/'||task."clubId"||'/workspace?section=tasks&taskView=mine&taskId='||task.id);
  RETURN NEW;
END $$;
CREATE TRIGGER task_notification AFTER INSERT OR UPDATE OF "reviewedAt","revisionRequestedAt" ON "TaskAssignment" FOR EACH ROW EXECUTE FUNCTION outclass_task_notification();
REVOKE ALL ON FUNCTION outclass_task_notification() FROM PUBLIC;

CREATE FUNCTION outclass_invitation_notification() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE recipient TEXT; BEGIN
  IF NEW.status<>'PENDING' OR NEW."expiresAt"<=CURRENT_TIMESTAMP THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND NEW.status=OLD.status THEN RETURN NEW; END IF;
  SELECT id INTO recipient FROM "User" WHERE lower(email)=lower(NEW.email) AND "disabledAt" IS NULL;
  IF recipient IS NOT NULL THEN
    PERFORM outclass_notify(recipient,NEW."clubId",'invitation:'||NEW.id,'INVITATION','You have a club invitation',
      'Review your invitation in organization settings. Joining is your choice.','/settings/organizations');
    -- Existing explicit invitation delivery remains authoritative; avoid a second email.
    UPDATE "NotificationEmailOutbox" SET status='SUPPRESSED' WHERE "notificationId" IN (SELECT id FROM "UserNotification" WHERE "userId"=recipient AND "eventKey"='invitation:'||NEW.id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER invitation_notification AFTER INSERT OR UPDATE OF status ON "ClubInvitation" FOR EACH ROW EXECUTE FUNCTION outclass_invitation_notification();
REVOKE ALL ON FUNCTION outclass_invitation_notification() FROM PUBLIC;

COMMIT;
