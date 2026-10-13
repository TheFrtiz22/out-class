BEGIN;
-- AlterTable
ALTER TABLE "InterviewRoom" ADD COLUMN     "interviewersNeeded" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "staffingRevision" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "InterviewSlot" ADD COLUMN     "interviewersNeeded" INTEGER,
ADD COLUMN     "staffingRevision" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "InterviewPanelProposal" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNPUBLISHED',
    "document" JSONB NOT NULL,
    "validation" JSONB NOT NULL,
    "sourceFingerprint" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "modifiedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewPanelProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterviewPanelProposal_clubId_updatedAt_idx" ON "InterviewPanelProposal"("clubId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewPanelProposal_roundId_clubId_key" ON "InterviewPanelProposal"("roundId", "clubId");

-- AddForeignKey
ALTER TABLE "InterviewPanelProposal" ADD CONSTRAINT "InterviewPanelProposal_roundId_clubId_fkey" FOREIGN KEY ("roundId", "clubId") REFERENCES "PipelineRound"("id", "clubId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewPanelProposal" ADD CONSTRAINT "InterviewPanelProposal_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewPanelProposal" ADD CONSTRAINT "InterviewPanelProposal_modifiedBy_fkey" FOREIGN KEY ("modifiedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InterviewRoom" ADD CONSTRAINT "InterviewRoom_staffing_check" CHECK ("interviewersNeeded" BETWEEN 1 AND 8 AND "staffingRevision" >= 0);
ALTER TABLE "InterviewSlot" ADD CONSTRAINT "InterviewSlot_staffing_check" CHECK (("interviewersNeeded" IS NULL OR "interviewersNeeded" BETWEEN 1 AND 8) AND "staffingRevision" >= 0);
CREATE INDEX "InterviewRoom_approved_members_gin" ON "InterviewRoom" USING GIN ("approvedPanelMemberIds");
ALTER TABLE "InterviewPanelProposal" ADD CONSTRAINT "InterviewPanelProposal_unpublished_check" CHECK (
  (status = 'UNPUBLISHED' AND revision > 0 AND "sourceFingerprint" ~ '^[a-f0-9]{64}$'
  AND jsonb_typeof(document) = 'object' AND document->>'version' = '1'
  AND jsonb_typeof(document->'sessions') = 'array' AND jsonb_array_length(document->'sessions') <= 500
  AND jsonb_typeof(document->'assignments') = 'array' AND jsonb_array_length(document->'assignments') <= 4000
  AND jsonb_typeof(validation) = 'object') IS TRUE
);
-- Validate references in JSON without inventing another session or official panel model.
CREATE FUNCTION public.outclass_validate_panel_proposal() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE s JSONB; a JSONB; prior JSONB := '{}'::JSONB;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    prior := OLD.document;
    IF (NEW.id, NEW."clubId", NEW."roundId", NEW."createdBy", NEW."createdAt") IS DISTINCT FROM
       (OLD.id, OLD."clubId", OLD."roundId", OLD."createdBy", OLD."createdAt") OR NEW.revision <> OLD.revision + 1 THEN
      RAISE EXCEPTION 'Proposal identity is immutable and revision must advance once';
    END IF;
  END IF;
  FOR s IN SELECT value FROM jsonb_array_elements(NEW.document->'sessions') LOOP
    IF NOT EXISTS (SELECT 1 FROM "InterviewSlot" slot JOIN "InterviewRoom" room ON room.id=slot."roomId"
      WHERE slot.id=s->>'id' AND room.id=s->>'roomId' AND room."clubId"=NEW."clubId" AND room."roundId"=NEW."roundId")
      AND NOT COALESCE(prior->'sessions' @> jsonb_build_array(s), FALSE) THEN
      RAISE EXCEPTION 'Proposal session must belong to this round';
    END IF;
  END LOOP;
  FOR a IN SELECT value FROM jsonb_array_elements(NEW.document->'assignments') LOOP
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.document->'sessions') snapshot WHERE snapshot->>'id'=a->>'slotId') THEN
      RAISE EXCEPTION 'Proposal assignment must reference a snapshot session';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM "ClubMember" m WHERE m.id=a->>'memberId' AND m."clubId"=NEW."clubId")
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(prior->'assignments','[]'::JSONB)) olda
        WHERE olda->>'slotId'=a->>'slotId' AND olda->>'memberId'=a->>'memberId') THEN
      RAISE EXCEPTION 'Proposal interviewer must belong to this club';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER outclass_panel_proposal_scope BEFORE INSERT OR UPDATE ON "InterviewPanelProposal"
  FOR EACH ROW EXECUTE FUNCTION public.outclass_validate_panel_proposal();
-- Every proposal action enables this transaction-local guard. An accidental call to
-- an existing publishing or notification helper then rolls back the whole transaction.
CREATE FUNCTION public.outclass_reject_panel_preview_write() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('outclass.panel_proposal_mode', TRUE) = 'unpublished' THEN
    RAISE EXCEPTION 'Unpublished panel proposals cannot write official scheduling or notifications';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['InterviewRoom','InterviewSlot','InterviewBooking','InterviewPanelAssignment','UserNotification','NotificationEmailOutbox','NotificationEmailDelivery'] LOOP
    EXECUTE format('CREATE TRIGGER outclass_panel_preview_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.outclass_reject_panel_preview_write()',t);
  END LOOP;
END $$;
ALTER TABLE "InterviewPanelProposal" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "InterviewPanelProposal" FROM PUBLIC;
REVOKE ALL ON FUNCTION public.outclass_validate_panel_proposal(), public.outclass_reject_panel_preview_write() FROM PUBLIC;
DO $$ DECLARE r TEXT; had_create BOOLEAN; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=r) THEN
      EXECUTE format('REVOKE ALL ON public."InterviewPanelProposal" FROM %I',r);
      EXECUTE format('REVOKE ALL ON FUNCTION public.outclass_validate_panel_proposal(), public.outclass_reject_panel_preview_write() FROM %I',r);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='outclass_production_app') THEN
    had_create := has_schema_privilege('outclass_production_app','public','CREATE');
    IF NOT had_create THEN GRANT CREATE ON SCHEMA public TO outclass_production_app; END IF;
    ALTER TABLE "InterviewPanelProposal" OWNER TO outclass_production_app;
    GRANT EXECUTE ON FUNCTION public.outclass_validate_panel_proposal(), public.outclass_reject_panel_preview_write() TO outclass_production_app;
    IF NOT had_create THEN REVOKE CREATE ON SCHEMA public FROM outclass_production_app; END IF;
  END IF;
END $$;
COMMIT;
