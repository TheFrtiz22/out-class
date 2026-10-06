BEGIN;
ALTER TABLE "StudentProfile" ADD COLUMN "scholarStatus" JSONB;
ALTER TABLE "ClubMember" ADD COLUMN "interviewOffices" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ClubMember" ADD CONSTRAINT "ClubMember_interview_offices_check" CHECK (
  "interviewOffices" <@ ARRAY['PRESIDENT','VICE_PRESIDENT','BOARD']::TEXT[] AND cardinality("interviewOffices") <= 3);

CREATE FUNCTION outclass_scholar_status_valid(v JSONB) RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE choices JSONB; item JSONB;
BEGIN
  IF v IS NULL THEN RETURN TRUE; END IF;
  IF jsonb_typeof(v) <> 'object' THEN RETURN FALSE; END IF;
  choices := v->'selections';
  IF choices IS NULL OR jsonb_typeof(choices) <> 'array' THEN RETURN FALSE; END IF;
  IF jsonb_array_length(choices) NOT BETWEEN 1 AND 6 THEN RETURN FALSE; END IF;
  IF (SELECT count(DISTINCT x) FROM jsonb_array_elements(choices) x) <> jsonb_array_length(choices) THEN RETURN FALSE; END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(choices) LOOP
    IF NOT item <@ '["JEFFERSON","WALENTAS","ECHOLS","RODMAN","NOT_APPLICABLE","OTHER"]'::jsonb THEN RETURN FALSE; END IF;
  END LOOP;
  IF choices ? 'NOT_APPLICABLE' AND jsonb_array_length(choices) <> 1 THEN RETURN FALSE; END IF;
  IF jsonb_typeof(v->'other') IS DISTINCT FROM 'string' OR length(v->>'other') > 200 THEN RETURN FALSE; END IF;
  RETURN CASE WHEN choices ? 'OTHER' THEN length(btrim(v->>'other')) > 0 ELSE v->>'other' = '' END;
END $$;
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_scholar_status_check" CHECK(outclass_scholar_status_valid("scholarStatus"));

ALTER TABLE "Evaluation" ADD COLUMN "roundId" TEXT REFERENCES "PipelineRound"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD COLUMN "submittedAt" TIMESTAMP(3), ADD COLUMN "applicantQuestions" TEXT;
-- Only existing explicit record links establish a stable round, never names alone.
UPDATE "Evaluation" e SET "roundId" = r."roundId", "submittedAt" = r."completedAt"
FROM "InterviewRecord" r WHERE r."evaluationId" = e.id AND r."completedAt" IS NOT NULL
AND e.score BETWEEN 1 AND 10
AND (SELECT count(*) FROM "InterviewRecord" r2 WHERE r2."evaluationId" = e.id) = 1;
DROP INDEX "Evaluation_applicationId_interviewerId_round_key";
CREATE UNIQUE INDEX "Evaluation_applicationId_interviewerId_roundId_key" ON "Evaluation"("applicationId","interviewerId","roundId");
-- Retain legacy uniqueness without preventing two stable rounds with the same display name.
CREATE UNIQUE INDEX "Evaluation_legacy_round_key" ON "Evaluation"("applicationId","interviewerId",round) WHERE "roundId" IS NULL;

CREATE TABLE "InterviewPanelAssignment" (
  id TEXT PRIMARY KEY, "applicationId" TEXT NOT NULL REFERENCES "Application"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "roundId" TEXT NOT NULL REFERENCES "PipelineRound"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "memberId" TEXT NOT NULL REFERENCES "ClubMember"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "grantedBy" TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "revokedAt" TIMESTAMP(3),
  UNIQUE("applicationId","roundId","memberId")
);
CREATE INDEX "InterviewPanelAssignment_memberId_roundId_revokedAt_idx" ON "InterviewPanelAssignment"("memberId","roundId","revokedAt");
CREATE TABLE "InterviewResumeDocument" (
  id TEXT PRIMARY KEY, "applicationId" TEXT NOT NULL REFERENCES "Application"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "roundId" TEXT NOT NULL REFERENCES "PipelineRound"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "sourcePath" TEXT NOT NULL, "contentHash" TEXT NOT NULL CHECK("contentHash" ~ '^[a-f0-9]{64}$'),
  content BYTEA NOT NULL CHECK(octet_length(content) BETWEEN 1 AND 10485760),
  "mimeType" TEXT NOT NULL DEFAULT 'application/pdf' CHECK("mimeType" = 'application/pdf'),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE("applicationId","roundId")
);
CREATE TABLE "InterviewResumeAnnotation" (
  id TEXT PRIMARY KEY, "documentId" TEXT NOT NULL REFERENCES "InterviewResumeDocument"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "authorId" TEXT NOT NULL REFERENCES "ClubMember"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('TEXT_HIGHLIGHT','GENERAL_NOTE')), anchor JSONB,
  comment TEXT NOT NULL CHECK(length(btrim(comment)) BETWEEN 1 AND 10000),
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "deletedAt" TIMESTAMP(3),
  CHECK (COALESCE((kind = 'GENERAL_NOTE' AND anchor IS NULL) OR (kind = 'TEXT_HIGHLIGHT' AND anchor IS NOT NULL AND jsonb_typeof(anchor) = 'object'
    AND (anchor->>'page')::integer > 0 AND (anchor->>'start')::integer >= 0 AND (anchor->>'end')::integer > (anchor->>'start')::integer
    AND length(anchor->>'quote') > 0), FALSE))
);
CREATE INDEX "InterviewResumeAnnotation_documentId_createdAt_idx" ON "InterviewResumeAnnotation"("documentId","createdAt");
CREATE TABLE "InterviewAnnotationRevision" (
  id TEXT PRIMARY KEY, "annotationId" TEXT NOT NULL REFERENCES "InterviewResumeAnnotation"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "actorId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL, content JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("annotationId",revision)
);

CREATE FUNCTION outclass_interview_scope_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE app_club TEXT; round_club TEXT; member_club TEXT;
BEGIN
  SELECT "clubId" INTO app_club FROM "Application" WHERE id=NEW."applicationId";
  SELECT "clubId" INTO round_club FROM "PipelineRound" WHERE id=NEW."roundId";
  IF app_club IS DISTINCT FROM round_club OR app_club IS NULL THEN RAISE EXCEPTION 'Interview club scope mismatch'; END IF;
  IF TG_TABLE_NAME = 'InterviewPanelAssignment' THEN
    SELECT "clubId" INTO member_club FROM "ClubMember" WHERE id=NEW."memberId";
    IF member_club IS DISTINCT FROM app_club THEN RAISE EXCEPTION 'Panel club scope mismatch'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER interview_panel_scope BEFORE INSERT OR UPDATE ON "InterviewPanelAssignment" FOR EACH ROW EXECUTE FUNCTION outclass_interview_scope_guard();
CREATE TRIGGER interview_document_scope BEFORE INSERT ON "InterviewResumeDocument" FOR EACH ROW EXECUTE FUNCTION outclass_interview_scope_guard();

CREATE FUNCTION outclass_interview_immutable() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME IN ('InterviewResumeDocument','InterviewAnnotationRevision') THEN
    RAISE EXCEPTION 'Interview evidence is immutable';
  ELSIF TG_TABLE_NAME = 'InterviewRecord' THEN
    IF OLD."completedAt" IS NOT NULL THEN RAISE EXCEPTION 'Submitted interview is immutable'; END IF;
    IF TG_OP = 'UPDATE' AND (NEW.questions IS DISTINCT FROM OLD.questions OR NEW."applicationId" <> OLD."applicationId" OR NEW."roundId" <> OLD."roundId" OR NEW."interviewerId" <> OLD."interviewerId" OR NEW."anonymousReview" <> OLD."anonymousReview") THEN
      RAISE EXCEPTION 'Interview snapshot is immutable';
    END IF;
  ELSIF TG_TABLE_NAME = 'Evaluation' THEN
    IF OLD."submittedAt" IS NOT NULL OR EXISTS(SELECT 1 FROM "InterviewRecord" WHERE "evaluationId"=OLD.id AND "completedAt" IS NOT NULL) THEN
      RAISE EXCEPTION 'Submitted evaluation is immutable';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER interview_record_immutable BEFORE UPDATE OR DELETE ON "InterviewRecord" FOR EACH ROW EXECUTE FUNCTION outclass_interview_immutable();
CREATE TRIGGER interview_evaluation_immutable BEFORE UPDATE OR DELETE ON "Evaluation" FOR EACH ROW EXECUTE FUNCTION outclass_interview_immutable();
CREATE TRIGGER interview_document_immutable BEFORE UPDATE OR DELETE ON "InterviewResumeDocument" FOR EACH ROW EXECUTE FUNCTION outclass_interview_immutable();
CREATE TRIGGER interview_revision_immutable BEFORE UPDATE OR DELETE ON "InterviewAnnotationRevision" FOR EACH ROW EXECUTE FUNCTION outclass_interview_immutable();

CREATE FUNCTION outclass_interview_submission_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE e "Evaluation";
BEGIN
  IF TG_TABLE_NAME = 'Evaluation' THEN
    -- Apply new increment rules to new/changed scores, never rewrite historical values.
    IF TG_OP = 'INSERT' OR NEW.score IS DISTINCT FROM OLD.score OR (NEW."submittedAt" IS NOT NULL AND OLD."submittedAt" IS NULL) THEN
      IF NEW.score < 1 OR NEW.score > 10 OR NEW.score * 2 <> floor(NEW.score * 2) OR NEW.score = 'NaN'::float8 THEN RAISE EXCEPTION 'Score must be 1-10 in half points'; END IF;
    END IF;
    IF NEW."roundId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "Application" a JOIN "PipelineRound" r ON r.id=NEW."roundId" AND r."clubId"=a."clubId" JOIN "ClubMember" m ON m.id=NEW."interviewerId" AND m."clubId"=a."clubId" WHERE a.id=NEW."applicationId") THEN RAISE EXCEPTION 'Evaluation scope mismatch'; END IF;
  ELSIF NEW."completedAt" IS NOT NULL THEN
    SELECT * INTO e FROM "Evaluation" WHERE id=NEW."evaluationId";
    IF e.id IS NULL OR e."submittedAt" IS NULL OR e."applicationId" <> NEW."applicationId" OR e."interviewerId" <> NEW."interviewerId" OR e."roundId" IS DISTINCT FROM NEW."roundId" THEN RAISE EXCEPTION 'Completion requires canonical submitted evaluation'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER interview_evaluation_score BEFORE INSERT OR UPDATE ON "Evaluation" FOR EACH ROW EXECUTE FUNCTION outclass_interview_submission_guard();
CREATE TRIGGER interview_record_submission BEFORE INSERT OR UPDATE ON "InterviewRecord" FOR EACH ROW EXECUTE FUNCTION outclass_interview_submission_guard();

CREATE FUNCTION outclass_annotation_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Annotations must be tombstoned with audit history'; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD."deletedAt" IS NOT NULL OR NEW.id <> OLD.id OR NEW."documentId" <> OLD."documentId" OR NEW."authorId" <> OLD."authorId" OR NEW."createdAt" <> OLD."createdAt" OR NEW.revision <> OLD.revision + 1 THEN RAISE EXCEPTION 'Annotation identity/revision is immutable'; END IF;
    IF NOT EXISTS(SELECT 1 FROM "InterviewAnnotationRevision" WHERE "annotationId"=OLD.id AND revision=OLD.revision) THEN RAISE EXCEPTION 'Annotation edit requires preserved history'; END IF;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM "InterviewResumeDocument" d JOIN "Application" a ON a.id=d."applicationId" JOIN "ClubMember" m ON m.id=NEW."authorId" AND m."clubId"=a."clubId" WHERE d.id=NEW."documentId") THEN RAISE EXCEPTION 'Annotation club scope mismatch'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER interview_annotation_identity BEFORE INSERT OR UPDATE OR DELETE ON "InterviewResumeAnnotation" FOR EACH ROW EXECUTE FUNCTION outclass_annotation_guard();

-- Revocation cannot resurrect old grants if a member subsequently rejoins.
CREATE FUNCTION outclass_revoke_interview_grants() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status <> 'ACTIVE' THEN
    NEW."interviewOffices" := ARRAY[]::TEXT[];
  END IF;
  IF NEW.status <> 'ACTIVE' OR (NOT NEW."isOwner" AND NOT (NEW.permissions @> ARRAY['applications.review','applicants.identify']::TEXT[])) THEN
    UPDATE "InterviewPanelAssignment" SET "revokedAt"=CURRENT_TIMESTAMP WHERE "memberId"=NEW.id AND "revokedAt" IS NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER interview_membership_revocation BEFORE UPDATE ON "ClubMember" FOR EACH ROW EXECUTE FUNCTION outclass_revoke_interview_grants();

DO $$ DECLARE t TEXT; role_name TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['InterviewPanelAssignment','InterviewResumeDocument','InterviewResumeAnnotation','InterviewAnnotationRevision'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON %I FROM PUBLIC',t);
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE ALL ON %I FROM %I',t,role_name); END IF;
    END LOOP;
  END LOOP;
END $$;
COMMIT;
