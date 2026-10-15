BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE "PipelineRound"
 ADD COLUMN "bookingPublishedAt" TIMESTAMP(3),
 ADD COLUMN "bookingPaused" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "bookingRevision" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "bookingSlots" JSONB NOT NULL DEFAULT '[]',
 ADD COLUMN "bookingCycleId" TEXT,
 ADD COLUMN "bookingAllowCancellation" BOOLEAN NOT NULL DEFAULT true,
 ADD COLUMN "bookingAllowRescheduling" BOOLEAN NOT NULL DEFAULT true,
 ADD CONSTRAINT "PipelineRound_booking_revision_check" CHECK ("bookingRevision">=0),
 ADD CONSTRAINT "PipelineRound_booking_slots_check" CHECK (jsonb_typeof("bookingSlots")='array' AND jsonb_array_length("bookingSlots")<=500),
 ADD CONSTRAINT "PipelineRound_bookingCycleId_clubId_fkey" FOREIGN KEY ("bookingCycleId","clubId") REFERENCES "RecruitmentCycle"(id,"clubId") ON DELETE RESTRICT ON UPDATE NO ACTION;
CREATE UNIQUE INDEX "InterviewSlot_id_clubId_key" ON "InterviewSlot"(id,"clubId");
CREATE TABLE "InterviewAvailabilityOverride" (
 id TEXT PRIMARY KEY, "clubId" TEXT NOT NULL, "roundId" TEXT NOT NULL,
 "slotId" TEXT NOT NULL, "memberId" TEXT NOT NULL, "createdBy" TEXT NOT NULL,
 "startTime" TIMESTAMP(3) NOT NULL, "endTime" TIMESTAMP(3) NOT NULL,
 duration INTEGER NOT NULL, buffer INTEGER NOT NULL, conditions TEXT[] NOT NULL,
 reason TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "revokedAt" TIMESTAMP(3),
 CONSTRAINT "InterviewAvailabilityOverride_roundId_clubId_fkey" FOREIGN KEY ("roundId","clubId") REFERENCES "PipelineRound"(id,"clubId") ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT "InterviewAvailabilityOverride_slotId_clubId_fkey" FOREIGN KEY ("slotId","clubId") REFERENCES "InterviewSlot"(id,"clubId") ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT "InterviewAvailabilityOverride_memberId_clubId_fkey" FOREIGN KEY ("memberId","clubId") REFERENCES "ClubMember"(id,"clubId") ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT "InterviewAvailabilityOverride_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"(id) ON DELETE RESTRICT,
 CONSTRAINT "InterviewAvailabilityOverride_conditions_check" CHECK (cardinality(conditions)>0 AND conditions <@ ARRAY['UNCONFIRMED','UNKNOWN_AVAILABILITY','UNAVAILABLE']::TEXT[] AND "endTime">"startTime" AND duration BETWEEN 5 AND 180 AND buffer BETWEEN 0 AND 60 AND (reason IS NULL OR length(reason)<=1000))
);
CREATE INDEX "InterviewAvailabilityOverride_clubId_roundId_slotId_revokedAt_idx" ON "InterviewAvailabilityOverride"("clubId","roundId","slotId","revokedAt");
CREATE FUNCTION public.outclass_valid_availability_override(override_id TEXT, club_id TEXT, round_id TEXT, slot_id TEXT, member_id TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
 SELECT EXISTS (
 SELECT 1 FROM "InterviewAvailabilityOverride" o JOIN "InterviewSlot" s ON s.id=o."slotId"
 JOIN "InterviewRoom" r ON r.id=s."roomId" JOIN "PipelineRound" p ON p.id=r."roundId"
 JOIN "ClubMember" president ON president."userId"=o."createdBy" AND president."clubId"=o."clubId"
 JOIN "User" author ON author.id=president."userId"
 JOIN "ClubMember" m ON m.id=o."memberId" JOIN "User" u ON u.id=m."userId"
 JOIN "Club" c ON c.id=o."clubId"
 LEFT JOIN "InterviewRoundParticipation" participation ON participation."memberId"=m.id AND participation."roundId"=o."roundId"
 WHERE o.id=override_id AND o."clubId"=club_id AND o."roundId"=round_id AND o."slotId"=slot_id AND o."memberId"=member_id
 AND o."revokedAt" IS NULL AND s."clubId"=club_id AND r."clubId"=club_id AND r."roundId"=round_id AND p."archivedAt" IS NULL
 AND o."startTime"=s."startTime" AND o."endTime"=s."endTime" AND o.duration=r.duration AND o.buffer=r.buffer
 AND president.status='ACTIVE' AND 'PRESIDENT'=ANY(president."interviewOffices") AND author."disabledAt" IS NULL
 AND m.status='ACTIVE' AND u."disabledAt" IS NULL AND c."suspendedAt" IS NULL
 AND COALESCE(participation."eligibilityOverride",m."interviewerEligible",m."accessRole"=ANY(c."interviewerRoles"))
 AND (m."isOwner" OR m.permissions @> ARRAY['applications.review','applicants.identify']::TEXT[])
 );
$$;
CREATE FUNCTION public.outclass_availability_override_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Availability override history is retained'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "ClubMember" m JOIN "User" u ON u.id=m."userId" JOIN "Club" c ON c.id=m."clubId"
   WHERE m."clubId"=NEW."clubId" AND m."userId"=current_setting('outclass.override_actor',TRUE)
   AND m.status='ACTIVE' AND u."disabledAt" IS NULL AND c."suspendedAt" IS NULL
   AND 'PRESIDENT'=ANY(m."interviewOffices") AND (m."isOwner" OR 'interviews.manage'=ANY(m.permissions))) THEN
   RAISE EXCEPTION 'An authorized current president must explicitly confirm availability overrides';
 END IF;
 IF TG_OP='UPDATE' THEN
   IF OLD."revokedAt" IS NOT NULL OR NEW."revokedAt" IS NULL OR (to_jsonb(NEW)-'revokedAt') IS DISTINCT FROM (to_jsonb(OLD)-'revokedAt') THEN RAISE EXCEPTION 'Availability override history is immutable'; END IF;
 ELSIF NEW."createdBy" IS DISTINCT FROM current_setting('outclass.override_actor',TRUE) OR NEW."revokedAt" IS NOT NULL
   OR NOT EXISTS (SELECT 1 FROM "InterviewSlot" s JOIN "InterviewRoom" r ON r.id=s."roomId" WHERE s.id=NEW."slotId" AND s."clubId"=NEW."clubId" AND r."roundId"=NEW."roundId" AND s."startTime"=NEW."startTime" AND s."endTime"=NEW."endTime" AND r.duration=NEW.duration AND r.buffer=NEW.buffer) THEN
   RAISE EXCEPTION 'Availability override must match its exact current session';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER outclass_availability_override_guard BEFORE INSERT OR UPDATE OR DELETE ON "InterviewAvailabilityOverride" FOR EACH ROW EXECUTE FUNCTION public.outclass_availability_override_guard();
ALTER TABLE "InterviewAvailabilityOverride" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "InterviewAvailabilityOverride" FROM PUBLIC;
REVOKE ALL ON FUNCTION public.outclass_valid_availability_override(TEXT,TEXT,TEXT,TEXT,TEXT),public.outclass_availability_override_guard() FROM PUBLIC;
DO $$ DECLARE r TEXT; had_create BOOLEAN; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
   EXECUTE format('REVOKE ALL ON "InterviewAvailabilityOverride" FROM %I',r);
   EXECUTE format('REVOKE ALL ON FUNCTION public.outclass_valid_availability_override(TEXT,TEXT,TEXT,TEXT,TEXT),public.outclass_availability_override_guard() FROM %I',r);
  END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='outclass_production_app') THEN
  had_create:=has_schema_privilege('outclass_production_app','public','CREATE');
  IF NOT had_create THEN GRANT CREATE ON SCHEMA public TO outclass_production_app; END IF;
  ALTER TABLE "InterviewAvailabilityOverride" OWNER TO outclass_production_app;
  GRANT EXECUTE ON FUNCTION public.outclass_valid_availability_override(TEXT,TEXT,TEXT,TEXT,TEXT),public.outclass_availability_override_guard() TO outclass_production_app;
  IF NOT had_create THEN REVOKE CREATE ON SCHEMA public FROM outclass_production_app; END IF;
 END IF;
END $$;
-- Publication and reservation guards below are extended in this forward-only migration.
CREATE OR REPLACE FUNCTION public.outclass_panel_publication_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
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
        LEFT JOIN "InterviewRoundParticipation" participation ON participation."memberId"=m.id AND participation."roundId"=NEW."roundId" AND participation."clubId"=NEW."clubId"
        WHERE m.id=a->>'memberId' AND m."clubId"=NEW."clubId" AND m.status='ACTIVE' AND u."disabledAt" IS NULL AND c."suspendedAt" IS NULL
          AND (participation."confirmedAt" IS NOT NULL OR public.outclass_valid_availability_override(a->>'availabilityOverrideId',NEW."clubId",NEW."roundId",a->>'slotId',a->>'memberId'))
          AND COALESCE(participation."eligibilityOverride",m."interviewerEligible",m."accessRole"=ANY(c."interviewerRoles"))
          AND (m."isOwner" OR m.permissions @> ARRAY['applications.review','applicants.identify']::TEXT[])) THEN
        RAISE EXCEPTION 'Publication requires eligible confirmed identified interviewers';
      END IF;
    END LOOP;

  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION outclass_booking_notification() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE app "Application"; BEGIN
  SELECT * INTO app FROM "Application" WHERE id=COALESCE(NEW."applicationId",OLD."applicationId");
  IF app.id IS NULL THEN RETURN COALESCE(NEW,OLD); END IF;
  PERFORM outclass_notify(app."studentId",app."clubId",'booking:'||COALESCE(NEW.id,OLD.id)||':'||TG_OP||':'||gen_random_uuid()::text,'INTERVIEW',
    CASE WHEN TG_OP='DELETE' THEN 'Interview booking cancelled' WHEN TG_OP='INSERT' THEN 'Interview confirmed' ELSE 'Interview booking updated' END,
    'Open your application to review your current interview schedule.',CASE WHEN COALESCE(NEW."roundId",OLD."roundId") IS NULL THEN '/?workspace=student&view=tracker' ELSE '/interviews/book?clubId='||app."clubId"||'&roundId='||COALESCE(NEW."roundId",OLD."roundId") END);
  RETURN COALESCE(NEW,OLD);
END $$;
COMMIT;
