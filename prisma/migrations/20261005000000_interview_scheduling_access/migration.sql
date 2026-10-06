BEGIN;
ALTER TABLE "InterviewRoom" ADD COLUMN "approvedPanelMemberIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "panelApprovedBy" TEXT REFERENCES "User"(id) ON DELETE RESTRICT,
  ADD COLUMN "panelApprovalRevision" INTEGER NOT NULL DEFAULT 0 CHECK ("panelApprovalRevision" >= 0);
ALTER TABLE "InterviewPanelAssignment" ADD COLUMN "bookingManaged" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "bookingId" TEXT REFERENCES "InterviewBooking"(id) ON DELETE SET NULL;
CREATE INDEX "InterviewPanelAssignment_bookingId_idx" ON "InterviewPanelAssignment"("bookingId");
ALTER TABLE "InterviewRoom" ADD CONSTRAINT "InterviewRoom_approved_panel_check" CHECK (
  "approvedPanelMemberIds" <@ "panelMemberIds" AND ("panelApprovedBy" IS NOT NULL OR cardinality("approvedPanelMemberIds")=0));

-- No automatic grants/backfill: all existing rooms require an owner review.
CREATE FUNCTION outclass_room_panel_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."panelMemberIds" IS DISTINCT FROM OLD."panelMemberIds" OR (OLD."isOpen" AND NOT NEW."isOpen") THEN
    NEW."approvedPanelMemberIds" := ARRAY[]::TEXT[]; NEW."panelApprovedBy" := NULL;
    NEW."panelApprovalRevision" := OLD."panelApprovalRevision" + 1;
  END IF;
  IF NEW."approvedPanelMemberIds" IS DISTINCT FROM OLD."approvedPanelMemberIds" OR NEW."panelApprovedBy" IS DISTINCT FROM OLD."panelApprovedBy" OR NEW."panelMemberIds" IS DISTINCT FROM OLD."panelMemberIds" OR NEW."isOpen" IS DISTINCT FROM OLD."isOpen" THEN
    UPDATE "InterviewPanelAssignment" SET "revokedAt"=NOW() WHERE "bookingManaged" AND "revokedAt" IS NULL AND "bookingId" IN
      (SELECT b.id FROM "InterviewBooking" b JOIN "InterviewSlot" s ON s.id=b."slotId" WHERE s."roomId"=OLD.id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "InterviewRoom_panel_change" BEFORE UPDATE ON "InterviewRoom" FOR EACH ROW EXECUTE FUNCTION outclass_room_panel_change();

CREATE FUNCTION outclass_booking_panel_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."bookingManaged" AND NEW."revokedAt" IS NULL AND NOT EXISTS (
    SELECT 1 FROM "InterviewBooking" b JOIN "InterviewSlot" s ON s.id=b."slotId" JOIN "InterviewRoom" r ON r.id=s."roomId"
      JOIN "Application" a ON a.id=b."applicationId" JOIN "PipelineRound" p ON p.id=a."roundId"
      JOIN "ClubMember" m ON m.id=NEW."memberId" JOIN "User" u ON u.id=m."userId"
      JOIN "ClubMember" owner ON owner."userId"=r."panelApprovedBy" AND owner."clubId"=r."clubId" JOIN "User" ou ON ou.id=owner."userId"
    WHERE b.id=NEW."bookingId" AND b."applicationId"=NEW."applicationId" AND b."roundId"=NEW."roundId" AND a."roundId"=NEW."roundId" AND r."roundId"=NEW."roundId"
      AND a."clubId"=r."clubId" AND s."clubId"=r."clubId" AND m."clubId"=r."clubId" AND a.status='INTERVIEWING' AND NOT p."anonymousReview"
      AND r."isOpen" AND NEW."memberId"=ANY(r."panelMemberIds") AND NEW."memberId"=ANY(r."approvedPanelMemberIds") AND NEW."grantedBy"=r."panelApprovedBy"
      AND a."studentId"<>m."userId" AND m.status='ACTIVE' AND u."disabledAt" IS NULL AND (m."isOwner" OR m.permissions @> ARRAY['applications.review','applicants.identify']::TEXT[])
      AND owner.status='ACTIVE' AND owner."isOwner" AND ou."disabledAt" IS NULL
  ) THEN RAISE EXCEPTION 'Booking panel scope requires explicit current owner approval'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "InterviewPanelAssignment_booking_scope" BEFORE INSERT OR UPDATE ON "InterviewPanelAssignment" FOR EACH ROW EXECUTE FUNCTION outclass_booking_panel_scope();

CREATE FUNCTION outclass_cancel_booking_panel() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "InterviewPanelAssignment" SET "revokedAt"=NOW() WHERE "bookingManaged" AND "bookingId"=OLD.id AND "revokedAt" IS NULL;
  RETURN OLD;
END $$;
CREATE TRIGGER "InterviewBooking_revoke_panel" BEFORE DELETE ON "InterviewBooking" FOR EACH ROW EXECUTE FUNCTION outclass_cancel_booking_panel();

CREATE FUNCTION outclass_invalidate_room_approval() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status<>'ACTIVE' OR NOT NEW."isOwner" AND OLD."isOwner" OR (NOT NEW."isOwner" AND NOT NEW.permissions @> ARRAY['applications.review','applicants.identify']::TEXT[]) THEN
    UPDATE "InterviewRoom" SET "approvedPanelMemberIds"=ARRAY[]::TEXT[],"panelApprovedBy"=NULL,"panelApprovalRevision"="panelApprovalRevision"+1
      WHERE "clubId"=NEW."clubId" AND (NEW.id=ANY("approvedPanelMemberIds") OR "panelApprovedBy"=NEW."userId");
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "ClubMember_invalidate_room_panel" AFTER UPDATE ON "ClubMember" FOR EACH ROW EXECUTE FUNCTION outclass_invalidate_room_approval();
CREATE FUNCTION outclass_disabled_room_approval() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."disabledAt" IS NOT NULL AND OLD."disabledAt" IS NULL THEN
    UPDATE "InterviewPanelAssignment" SET "revokedAt"=NOW() WHERE "revokedAt" IS NULL AND "memberId" IN (SELECT id FROM "ClubMember" WHERE "userId"=NEW.id);
    UPDATE "InterviewRoom" SET "approvedPanelMemberIds"=ARRAY[]::TEXT[],"panelApprovedBy"=NULL,"panelApprovalRevision"="panelApprovalRevision"+1
      WHERE "panelApprovedBy"=NEW.id OR "approvedPanelMemberIds" && ARRAY(SELECT id FROM "ClubMember" WHERE "userId"=NEW.id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "User_invalidate_room_panel" AFTER UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION outclass_disabled_room_approval();
-- Existing table RLS remains restrictive; explicitly retain browser-role denial for added grant metadata.
ALTER TABLE "InterviewRoom" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InterviewPanelAssignment" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "InterviewRoom", "InterviewPanelAssignment" FROM PUBLIC, anon, authenticated;
COMMIT;
