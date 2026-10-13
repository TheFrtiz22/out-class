BEGIN;
-- AlterTable
ALTER TABLE "PipelineRound" ADD COLUMN     "panelScheduleRevision" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "InterviewPanelProposal" ADD COLUMN     "approvalToken" TEXT,
ADD COLUMN     "basePublishedVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "readyAt" TIMESTAMPTZ(3),
ADD COLUMN     "readyBy" TEXT;

-- AlterTable
ALTER TABLE "InterviewSlot" ADD COLUMN     "panelScheduleVersionId" TEXT,
ADD COLUMN     "publishedPanelMemberIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "InterviewPanelScheduleVersion" (
    "sourceProposalId" TEXT NOT NULL,
    "sourceProposalRevision" INTEGER NOT NULL,
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "previousVersion" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "document" JSONB NOT NULL,
    "changes" JSONB NOT NULL,
    "sourceFingerprint" TEXT NOT NULL,
    "approvalToken" TEXT NOT NULL,
    "publishedBy" TEXT NOT NULL,
    "publishedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "understaffedOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,

    CONSTRAINT "InterviewPanelScheduleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InterviewPanelScheduleVersion_approvalToken_key" ON "InterviewPanelScheduleVersion"("approvalToken");

-- CreateIndex
CREATE INDEX "InterviewPanelScheduleVersion_clubId_publishedAt_idx" ON "InterviewPanelScheduleVersion"("clubId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewPanelScheduleVersion_roundId_clubId_version_key" ON "InterviewPanelScheduleVersion"("roundId", "clubId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewPanelProposal_approvalToken_key" ON "InterviewPanelProposal"("approvalToken");

-- CreateIndex
CREATE INDEX "InterviewSlot_publishedPanelMemberIds_idx" ON "InterviewSlot" USING GIN ("publishedPanelMemberIds");

-- CreateIndex
CREATE INDEX "InterviewSlot_panelScheduleVersionId_idx" ON "InterviewSlot"("panelScheduleVersionId");

-- AddForeignKey
ALTER TABLE "InterviewPanelScheduleVersion" ADD CONSTRAINT "InterviewPanelScheduleVersion_roundId_clubId_fkey" FOREIGN KEY ("roundId", "clubId") REFERENCES "PipelineRound"("id", "clubId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewPanelScheduleVersion" ADD CONSTRAINT "InterviewPanelScheduleVersion_publishedBy_fkey" FOREIGN KEY ("publishedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSlot" ADD CONSTRAINT "InterviewSlot_panelScheduleVersionId_fkey" FOREIGN KEY ("panelScheduleVersionId") REFERENCES "InterviewPanelScheduleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "InterviewSlot" ALTER COLUMN "publishedPanelMemberIds" SET NOT NULL;
ALTER TABLE "PipelineRound" ADD CONSTRAINT "PipelineRound_panel_revision_check" CHECK ("panelScheduleRevision" >= 0);
ALTER TABLE "InterviewPanelProposal" DROP CONSTRAINT "InterviewPanelProposal_unpublished_check";
ALTER TABLE "InterviewPanelProposal" ADD CONSTRAINT "InterviewPanelProposal_unpublished_check" CHECK ((
  status IN ('UNPUBLISHED','READY_FOR_APPROVAL') AND revision > 0 AND "basePublishedVersion" >= 0 AND "sourceFingerprint" ~ '^[a-f0-9]{64}$'
  AND jsonb_typeof(document)='object' AND document->>'version'='1'
  AND jsonb_typeof(document->'sessions')='array' AND jsonb_array_length(document->'sessions') <= 500
  AND jsonb_typeof(document->'assignments')='array' AND jsonb_array_length(document->'assignments') <= 4000
  AND jsonb_typeof(validation)='object'
  AND ((status='UNPUBLISHED' AND "approvalToken" IS NULL AND "readyBy" IS NULL AND "readyAt" IS NULL)
    OR (status='READY_FOR_APPROVAL' AND "approvalToken" IS NOT NULL AND "readyBy" IS NOT NULL AND "readyAt" IS NOT NULL))
) IS TRUE);
ALTER TABLE "InterviewPanelScheduleVersion" ADD CONSTRAINT "InterviewPanelScheduleVersion_valid_check" CHECK ((
  version > 0 AND "previousVersion"=version-1 AND "sourceProposalRevision">0
  AND status IN ('PUBLISHED','SUPERSEDED') AND "sourceFingerprint" ~ '^[a-f0-9]{64}$'
  AND jsonb_typeof(document)='object' AND document->>'version'='1'
  AND jsonb_typeof(document->'sessions')='array' AND jsonb_array_length(document->'sessions') <= 5000
  AND jsonb_typeof(document->'assignments')='array' AND jsonb_array_length(document->'assignments') <= 40000
  AND jsonb_typeof(changes)='array'
  AND ((NOT "understaffedOverride" AND "overrideReason" IS NULL) OR ("understaffedOverride" AND length(trim("overrideReason")) BETWEEN 10 AND 1000))
) IS TRUE);
CREATE FUNCTION public.outclass_panel_publication_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE proposal "InterviewPanelProposal"; a JSONB;
BEGIN
  IF current_setting('outclass.panel_proposal_mode',TRUE)='unpublished' THEN RAISE EXCEPTION 'Unpublished previews cannot change publication'; END IF;
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Published panel history is immutable'; END IF;
  IF TG_OP='UPDATE' THEN
    IF NEW.status<>'SUPERSEDED' OR OLD.status<>'PUBLISHED' OR (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status')
      OR NOT EXISTS (SELECT 1 FROM "InterviewPanelScheduleVersion" next WHERE next.id=current_setting('outclass.panel_publication_id',TRUE) AND next."clubId"=OLD."clubId" AND next."roundId"=OLD."roundId" AND next."previousVersion"=OLD.version) THEN RAISE EXCEPTION 'Published panel history is immutable'; END IF;
  ELSE
    IF current_setting('outclass.panel_publication_id',TRUE) IS DISTINCT FROM NEW.id OR NEW.status<>'PUBLISHED'
      OR NOT EXISTS (SELECT 1 FROM "PipelineRound" r WHERE r.id=NEW."roundId" AND r."clubId"=NEW."clubId" AND r."panelScheduleRevision"=NEW."previousVersion" AND r."archivedAt" IS NULL AND NOT r."anonymousReview")
      OR NOT EXISTS (SELECT 1 FROM "InterviewPanelProposal" p WHERE p.id=NEW."sourceProposalId" AND p."clubId"=NEW."clubId" AND p."roundId"=NEW."roundId" AND p.revision=NEW."sourceProposalRevision" AND p.status='READY_FOR_APPROVAL' AND p."approvalToken"=NEW."approvalToken" AND p."readyBy"=NEW."publishedBy" AND p."basePublishedVersion"=NEW."previousVersion")
      OR NOT EXISTS (SELECT 1 FROM "ClubMember" m JOIN "User" u ON u.id=m."userId" WHERE m."clubId"=NEW."clubId" AND m."userId"=NEW."publishedBy" AND m."isOwner" AND m.status='ACTIVE' AND u."disabledAt" IS NULL)
      THEN RAISE EXCEPTION 'Explicit current owner approval required for panel publication'; END IF;
    SELECT * INTO proposal FROM "InterviewPanelProposal" WHERE id=NEW."sourceProposalId";
    IF NOT NEW.document @> jsonb_build_object('sessions',proposal.document->'sessions','assignments',proposal.document->'assignments')
       OR EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.document->'assignments') item
         WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(proposal.document->'sessions') session WHERE session->>'id'=item->>'slotId')
         AND NOT proposal.document->'assignments' @> jsonb_build_array(item)) THEN
      RAISE EXCEPTION 'Published positions must match the exact reviewed draft';
    END IF;
    FOR a IN SELECT value FROM jsonb_array_elements(proposal.document->'assignments') LOOP
      IF NOT EXISTS(SELECT 1 FROM "ClubMember" m JOIN "User" u ON u.id=m."userId" JOIN "Club" c ON c.id=m."clubId"
        JOIN "InterviewRoundParticipation" participation ON participation."memberId"=m.id AND participation."roundId"=NEW."roundId" AND participation."clubId"=NEW."clubId"
        WHERE m.id=a->>'memberId' AND m."clubId"=NEW."clubId" AND m.status='ACTIVE' AND u."disabledAt" IS NULL AND c."suspendedAt" IS NULL
          AND participation."confirmedAt" IS NOT NULL
          AND COALESCE(participation."eligibilityOverride",m."interviewerEligible",m."accessRole"=ANY(c."interviewerRoles"))
          AND (m."isOwner" OR m.permissions @> ARRAY['applications.review','applicants.identify']::TEXT[])) THEN
        RAISE EXCEPTION 'Publication requires eligible confirmed identified interviewers';
      END IF;
    END LOOP;

  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER outclass_panel_publication_guard BEFORE INSERT OR UPDATE OR DELETE ON "InterviewPanelScheduleVersion" FOR EACH ROW EXECUTE FUNCTION public.outclass_panel_publication_guard();
CREATE FUNCTION public.outclass_official_slot_panel_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v "InterviewPanelScheduleVersion";
BEGIN
  IF (TG_OP='INSERT' AND (NEW."panelScheduleVersionId" IS NOT NULL OR cardinality(NEW."publishedPanelMemberIds")>0))
    OR (TG_OP='UPDATE' AND (NEW."panelScheduleVersionId" IS DISTINCT FROM OLD."panelScheduleVersionId" OR NEW."publishedPanelMemberIds" IS DISTINCT FROM OLD."publishedPanelMemberIds"
       OR (OLD."panelScheduleVersionId" IS NOT NULL AND NEW."interviewersNeeded" IS DISTINCT FROM OLD."interviewersNeeded"))) THEN
    SELECT * INTO v FROM "InterviewPanelScheduleVersion" WHERE id=NEW."panelScheduleVersionId";
    IF v.id IS NULL OR current_setting('outclass.panel_publication_id',TRUE) IS DISTINCT FROM v.id OR v."clubId"<>NEW."clubId"
      OR NOT EXISTS (SELECT 1 FROM "InterviewRoom" r WHERE r.id=NEW."roomId" AND r."clubId"=v."clubId" AND r."roundId"=v."roundId")
      OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v.document->'sessions') snapshot WHERE snapshot->>'id'=NEW.id AND (snapshot->>'required')::INTEGER=NEW."interviewersNeeded")
      OR NEW."publishedPanelMemberIds" IS DISTINCT FROM ARRAY(SELECT a->>'memberId' FROM jsonb_array_elements(v.document->'assignments') a WHERE a->>'slotId'=NEW.id ORDER BY a->>'memberId')
      THEN RAISE EXCEPTION 'Official session panels require an explicitly approved publication'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER outclass_official_slot_panel_guard BEFORE INSERT OR UPDATE ON "InterviewSlot" FOR EACH ROW EXECUTE FUNCTION public.outclass_official_slot_panel_guard();
CREATE FUNCTION public.outclass_round_panel_revision_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."panelScheduleRevision" IS DISTINCT FROM OLD."panelScheduleRevision" AND
    (NEW."panelScheduleRevision" <> OLD."panelScheduleRevision"+1 OR NOT EXISTS (
      SELECT 1 FROM "InterviewPanelScheduleVersion" v WHERE v.id=current_setting('outclass.panel_publication_id',TRUE)
      AND v."clubId"=NEW."clubId" AND v."roundId"=NEW.id AND v.version=NEW."panelScheduleRevision" AND v."previousVersion"=OLD."panelScheduleRevision")) THEN
    RAISE EXCEPTION 'Active panel versions advance only through explicit approved publication';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER outclass_round_panel_revision_guard BEFORE UPDATE ON "PipelineRound" FOR EACH ROW EXECUTE FUNCTION public.outclass_round_panel_revision_guard();
-- Extend, rather than bypass, the existing booking-managed access guard.
CREATE OR REPLACE FUNCTION public.outclass_booking_panel_scope() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."bookingManaged" AND NEW."revokedAt" IS NULL AND NOT EXISTS (
    SELECT 1 FROM "InterviewBooking" b JOIN "InterviewSlot" s ON s.id=b."slotId" JOIN "InterviewRoom" r ON r.id=s."roomId"
      LEFT JOIN "InterviewPanelScheduleVersion" v ON v.id=s."panelScheduleVersionId"
      JOIN "Application" a ON a.id=b."applicationId" JOIN "PipelineRound" p ON p.id=a."roundId"
      JOIN "ClubMember" m ON m.id=NEW."memberId" JOIN "User" u ON u.id=m."userId"
      JOIN "ClubMember" owner ON owner."userId"=COALESCE(v."publishedBy",r."panelApprovedBy") AND owner."clubId"=r."clubId" JOIN "User" ou ON ou.id=owner."userId"
    WHERE b.id=NEW."bookingId" AND b."applicationId"=NEW."applicationId" AND b."roundId"=NEW."roundId" AND a."roundId"=NEW."roundId" AND r."roundId"=NEW."roundId"
      AND a."clubId"=r."clubId" AND s."clubId"=r."clubId" AND m."clubId"=r."clubId" AND a.status='INTERVIEWING' AND NOT p."anonymousReview"
      AND r."isOpen" AND NEW."grantedBy"=COALESCE(v."publishedBy",r."panelApprovedBy")
      AND ((s."panelScheduleVersionId" IS NOT NULL AND NEW."memberId"=ANY(s."publishedPanelMemberIds") AND v."clubId"=r."clubId" AND v."roundId"=r."roundId")
        OR (s."panelScheduleVersionId" IS NULL AND NEW."memberId"=ANY(r."panelMemberIds") AND NEW."memberId"=ANY(r."approvedPanelMemberIds")))
      AND a."studentId"<>m."userId" AND m.status='ACTIVE' AND u."disabledAt" IS NULL AND (m."isOwner" OR m.permissions @> ARRAY['applications.review','applicants.identify']::TEXT[])
      AND owner.status='ACTIVE' AND owner."isOwner" AND ou."disabledAt" IS NULL
  ) THEN RAISE EXCEPTION 'Booking panel scope requires explicit current owner approval'; END IF;
  RETURN NEW;
END $$;
-- Legacy room attestations cannot invalidate separately approved session panels. Room pause and actual approval-author revocation still revoke private access.
CREATE OR REPLACE FUNCTION public.outclass_room_panel_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."panelMemberIds" IS DISTINCT FROM OLD."panelMemberIds" OR (OLD."isOpen" AND NOT NEW."isOpen") THEN
    NEW."approvedPanelMemberIds" := ARRAY[]::TEXT[]; NEW."panelApprovedBy" := NULL;
    NEW."panelApprovalRevision" := OLD."panelApprovalRevision" + 1;
  END IF;
  IF NEW."approvedPanelMemberIds" IS DISTINCT FROM OLD."approvedPanelMemberIds" OR NEW."panelApprovedBy" IS DISTINCT FROM OLD."panelApprovedBy" OR NEW."panelMemberIds" IS DISTINCT FROM OLD."panelMemberIds" OR NEW."isOpen" IS DISTINCT FROM OLD."isOpen" THEN
    UPDATE "InterviewPanelAssignment" SET "revokedAt"=NOW() WHERE "bookingManaged" AND "revokedAt" IS NULL AND "bookingId" IN
      (SELECT b.id FROM "InterviewBooking" b JOIN "InterviewSlot" s ON s.id=b."slotId" WHERE s."roomId"=OLD.id AND (NEW."isOpen" IS DISTINCT FROM OLD."isOpen" OR s."panelScheduleVersionId" IS NULL));
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.outclass_invalidate_room_approval() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status<>'ACTIVE' OR NOT NEW."isOwner" AND OLD."isOwner" OR (NOT NEW."isOwner" AND NOT NEW.permissions @> ARRAY['applications.review','applicants.identify']::TEXT[]) THEN
    UPDATE "InterviewRoom" SET "approvedPanelMemberIds"=ARRAY[]::TEXT[],"panelApprovedBy"=NULL,"panelApprovalRevision"="panelApprovalRevision"+1
      WHERE "clubId"=NEW."clubId" AND (NEW.id=ANY("approvedPanelMemberIds") OR "panelApprovedBy"=NEW."userId");
  END IF;
  IF OLD."isOwner" AND (NOT NEW."isOwner" OR NEW.status<>'ACTIVE') THEN
    UPDATE "InterviewPanelAssignment" SET "revokedAt"=NOW() WHERE "bookingManaged" AND "revokedAt" IS NULL AND "bookingId" IN
      (SELECT b.id FROM "InterviewBooking" b JOIN "InterviewSlot" slot ON slot.id=b."slotId" JOIN "InterviewPanelScheduleVersion" v ON v.id=slot."panelScheduleVersionId" WHERE v."clubId"=NEW."clubId" AND v."publishedBy"=NEW."userId");
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.outclass_disabled_room_approval() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."disabledAt" IS NOT NULL AND OLD."disabledAt" IS NULL THEN
    UPDATE "InterviewPanelAssignment" SET "revokedAt"=NOW() WHERE "revokedAt" IS NULL AND "memberId" IN (SELECT id FROM "ClubMember" WHERE "userId"=NEW.id);
    UPDATE "InterviewPanelAssignment" SET "revokedAt"=NOW() WHERE "bookingManaged" AND "revokedAt" IS NULL AND "bookingId" IN
      (SELECT b.id FROM "InterviewBooking" b JOIN "InterviewSlot" slot ON slot.id=b."slotId" JOIN "InterviewPanelScheduleVersion" v ON v.id=slot."panelScheduleVersionId" WHERE v."publishedBy"=NEW.id);
    UPDATE "InterviewRoom" SET "approvedPanelMemberIds"=ARRAY[]::TEXT[],"panelApprovedBy"=NULL,"panelApprovalRevision"="panelApprovalRevision"+1
      WHERE "panelApprovedBy"=NEW.id OR "approvedPanelMemberIds" && ARRAY(SELECT id FROM "ClubMember" WHERE "userId"=NEW.id);
  END IF;
  RETURN NEW;
END $$;
ALTER TABLE "InterviewPanelScheduleVersion" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "InterviewPanelScheduleVersion" FROM PUBLIC;
REVOKE ALL ON FUNCTION public.outclass_panel_publication_guard(),public.outclass_official_slot_panel_guard(),public.outclass_round_panel_revision_guard() FROM PUBLIC;
DO $$ DECLARE r TEXT; had_create BOOLEAN; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
      EXECUTE format('REVOKE ALL ON "InterviewPanelScheduleVersion" FROM %I',r);
      EXECUTE format('REVOKE ALL ON FUNCTION public.outclass_panel_publication_guard(),public.outclass_official_slot_panel_guard(),public.outclass_round_panel_revision_guard() FROM %I',r);
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='outclass_production_app') THEN
    had_create:=has_schema_privilege('outclass_production_app','public','CREATE');
    IF NOT had_create THEN GRANT CREATE ON SCHEMA public TO outclass_production_app; END IF;
    ALTER TABLE "InterviewPanelScheduleVersion" OWNER TO outclass_production_app;
    GRANT EXECUTE ON FUNCTION public.outclass_panel_publication_guard(),public.outclass_official_slot_panel_guard(),public.outclass_round_panel_revision_guard() TO outclass_production_app;
    IF NOT had_create THEN REVOKE CREATE ON SCHEMA public FROM outclass_production_app; END IF;
  END IF;
END $$;
COMMIT;
