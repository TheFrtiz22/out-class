BEGIN;
-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "decisionLetterTemplates" JSONB;

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "decisionVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DecisionLetter" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "decision" "AppStatus" NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionLetter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DecisionLetter_clubId_createdAt_idx" ON "DecisionLetter"("clubId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionLetter_applicationId_version_key" ON "DecisionLetter"("applicationId", "version");

-- AddForeignKey
ALTER TABLE "DecisionLetter" ADD CONSTRAINT "DecisionLetter_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionLetter" ADD CONSTRAINT "DecisionLetter_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "Application" ADD CONSTRAINT "Application_decisionVersion_check" CHECK ("decisionVersion" >= 0);
ALTER TABLE "DecisionLetter" ADD CONSTRAINT "DecisionLetter_final_check" CHECK (decision IN ('ACCEPTED','WAITLISTED','REJECTED') AND version > 0);
ALTER TABLE "DecisionLetter" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "DecisionLetter" FROM PUBLIC, anon, authenticated;
CREATE POLICY outclass_decision_letters_server_only ON "DecisionLetter" AS RESTRICTIVE FOR ALL TO PUBLIC USING(false) WITH CHECK(false);
CREATE FUNCTION public.outclass_immutable_decision_letter() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Published decision letters are immutable'; END $$;
REVOKE ALL ON FUNCTION public.outclass_immutable_decision_letter() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER "DecisionLetter_immutable" BEFORE UPDATE OR DELETE ON "DecisionLetter" FOR EACH ROW EXECUTE FUNCTION public.outclass_immutable_decision_letter();
CREATE OR REPLACE FUNCTION outclass_application_notification() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  -- Canonical final publication inserts its immutable letter and availability notification.
  -- Keep legacy/unversioned events and all non-final application producers unchanged.
  IF NEW.status IN ('ACCEPTED','WAITLISTED','REJECTED') AND NEW."decisionVersion">0 THEN RETURN NEW; END IF;
  IF NEW.status='DRAFTING' OR NEW."submittedAt" IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND NEW.status=OLD.status AND NEW."roundId"=OLD."roundId" THEN RETURN NEW; END IF;
  PERFORM outclass_notify(NEW."studentId",NEW."clubId",'application:'||NEW.id||':'||gen_random_uuid()::text,
    CASE WHEN NEW.status='INTERVIEWING' THEN 'INTERVIEW' ELSE 'APPLICATION' END,
    CASE WHEN NEW.status='INTERVIEWING' THEN 'You have an interview invitation' ELSE 'Application update' END,
    'Your application status is '||replace(lower(NEW.status::text),'_',' ')||'. Open your application for the latest details.',
    '/?workspace=student&view=tracker');
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION outclass_invitation_notification() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE recipient TEXT; BEGIN
  IF NEW."applicationId" IS NOT NULL THEN RETURN NEW; END IF;
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
COMMIT;
