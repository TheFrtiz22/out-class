BEGIN;
-- Additive, server-only metadata: no changes to reviews, assignments or old writers.
CREATE TABLE "InterviewCollaboration" (
  id TEXT PRIMARY KEY, "clubId" TEXT NOT NULL REFERENCES "Club"(id) ON DELETE CASCADE,
  "applicationId" TEXT NOT NULL REFERENCES "Application"(id) ON DELETE CASCADE,
  "roundId" TEXT NOT NULL REFERENCES "PipelineRound"(id) ON DELETE RESTRICT,
  "roomKey" TEXT NOT NULL, questions JSONB NOT NULL CHECK (jsonb_typeof(questions) = 'array'),
  "selectedQuestionId" TEXT, "selectedBy" TEXT REFERENCES "ClubMember"(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  CHECK (("selectedQuestionId" IS NULL) = ("selectedBy" IS NULL))
);
CREATE UNIQUE INDEX "InterviewCollaboration_applicationId_roundId_roomKey_key" ON "InterviewCollaboration"("applicationId","roundId","roomKey");
CREATE INDEX "InterviewCollaboration_clubId_roundId_idx" ON "InterviewCollaboration"("clubId","roundId");
CREATE TABLE "InterviewPresence" (
  id TEXT PRIMARY KEY, "sessionId" TEXT NOT NULL REFERENCES "InterviewCollaboration"(id) ON DELETE CASCADE,
  "memberId" TEXT NOT NULL REFERENCES "ClubMember"(id) ON DELETE CASCADE,
  "clientId" TEXT NOT NULL, "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "InterviewPresence_memberId_clientId_key" ON "InterviewPresence"("memberId","clientId");
CREATE INDEX "InterviewPresence_sessionId_seenAt_idx" ON "InterviewPresence"("sessionId","seenAt");
CREATE TABLE "InterviewMove" (
  id TEXT PRIMARY KEY, "sourceId" TEXT NOT NULL REFERENCES "InterviewCollaboration"(id) ON DELETE CASCADE,
  "destinationId" TEXT NOT NULL REFERENCES "InterviewCollaboration"(id) ON DELETE CASCADE,
  "memberId" TEXT NOT NULL REFERENCES "ClubMember"(id) ON DELETE RESTRICT,
  invited BOOLEAN NOT NULL DEFAULT false, "acceptedInvitationId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3) NOT NULL,
  CHECK ("sourceId" <> "destinationId"), CHECK ("expiresAt" > "createdAt"), CHECK (invited = ("acceptedInvitationId" IS NOT NULL))
);
CREATE INDEX "InterviewMove_memberId_confirmedAt_idx" ON "InterviewMove"("memberId","confirmedAt");
CREATE TABLE "InterviewInvitation" (
  id TEXT PRIMARY KEY, "moveId" TEXT NOT NULL REFERENCES "InterviewMove"(id) ON DELETE CASCADE,
  "recipientId" TEXT NOT NULL REFERENCES "ClubMember"(id) ON DELETE CASCADE, "dismissedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "InterviewInvitation_moveId_recipientId_key" ON "InterviewInvitation"("moveId","recipientId");
CREATE INDEX "InterviewInvitation_recipientId_dismissedAt_idx" ON "InterviewInvitation"("recipientId","dismissedAt");
ALTER TABLE "InterviewMove" ADD CONSTRAINT "InterviewMove_acceptedInvitationId_fkey" FOREIGN KEY ("acceptedInvitationId") REFERENCES "InterviewInvitation"(id) ON DELETE RESTRICT;

CREATE FUNCTION outclass_collaboration_scope() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE s "InterviewCollaboration"; d "InterviewCollaboration"; m TEXT;
BEGIN
  IF TG_TABLE_NAME = 'InterviewCollaboration' THEN
    IF NOT EXISTS(SELECT 1 FROM "Application" a JOIN "PipelineRound" r ON r.id=NEW."roundId" AND r."clubId"=a."clubId" WHERE a.id=NEW."applicationId" AND a."clubId"=NEW."clubId") THEN RAISE EXCEPTION 'Collaboration scope mismatch'; END IF;
    IF TG_OP='UPDATE' AND (NEW.id<>OLD.id OR NEW."clubId"<>OLD."clubId" OR NEW."applicationId"<>OLD."applicationId" OR NEW."roundId"<>OLD."roundId" OR NEW."roomKey"<>OLD."roomKey" OR NEW.revision<>OLD.revision+1) THEN RAISE EXCEPTION 'Collaboration identity/revision mismatch'; END IF;
    IF NEW."selectedQuestionId" IS NOT NULL AND (NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.questions) q WHERE q->>'id'=NEW."selectedQuestionId") OR NOT EXISTS(SELECT 1 FROM "ClubMember" WHERE id=NEW."selectedBy" AND "clubId"=NEW."clubId")) THEN RAISE EXCEPTION 'Invalid shared question'; END IF;
    IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM jsonb_array_elements(OLD.questions) q WHERE NOT NEW.questions @> jsonb_build_array(q)) THEN RAISE EXCEPTION 'Shared question snapshots are immutable'; END IF;
    RETURN NEW;
  ELSIF TG_TABLE_NAME='InterviewPresence' THEN
    SELECT * INTO s FROM "InterviewCollaboration" WHERE id=NEW."sessionId"; m:=NEW."memberId";
  ELSIF TG_TABLE_NAME='InterviewMove' THEN
    SELECT * INTO s FROM "InterviewCollaboration" WHERE id=NEW."sourceId";
    SELECT * INTO d FROM "InterviewCollaboration" WHERE id=NEW."destinationId"; m:=NEW."memberId";
    IF s."clubId"<>d."clubId" OR s."roundId"<>d."roundId" THEN RAISE EXCEPTION 'Move scope mismatch'; END IF;
    IF TG_OP='UPDATE' AND (NEW.id<>OLD.id OR NEW."sourceId"<>OLD."sourceId" OR NEW."destinationId"<>OLD."destinationId" OR NEW."memberId"<>OLD."memberId" OR NEW.invited<>OLD.invited OR NEW."acceptedInvitationId" IS DISTINCT FROM OLD."acceptedInvitationId" OR NEW."createdAt"<>OLD."createdAt" OR NEW."expiresAt"<>OLD."expiresAt" OR OLD."confirmedAt" IS NOT NULL) THEN RAISE EXCEPTION 'Move receipt is immutable'; END IF;
  ELSE
    SELECT c.* INTO s FROM "InterviewMove" v JOIN "InterviewCollaboration" c ON c.id=v."sourceId" WHERE v.id=NEW."moveId"; m:=NEW."recipientId";
    IF TG_OP='UPDATE' AND (NEW.id<>OLD.id OR NEW."moveId"<>OLD."moveId" OR NEW."recipientId"<>OLD."recipientId" OR OLD."dismissedAt" IS NOT NULL) THEN RAISE EXCEPTION 'Invitation identity is immutable'; END IF;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM "ClubMember" WHERE id=m AND "clubId"=s."clubId") THEN RAISE EXCEPTION 'Collaboration member scope mismatch'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER collaboration_scope BEFORE INSERT OR UPDATE ON "InterviewCollaboration" FOR EACH ROW EXECUTE FUNCTION outclass_collaboration_scope();
CREATE TRIGGER collaboration_presence_scope BEFORE INSERT OR UPDATE ON "InterviewPresence" FOR EACH ROW EXECUTE FUNCTION outclass_collaboration_scope();
CREATE TRIGGER collaboration_move_scope BEFORE INSERT OR UPDATE ON "InterviewMove" FOR EACH ROW EXECUTE FUNCTION outclass_collaboration_scope();
CREATE TRIGGER collaboration_invitation_scope BEFORE INSERT OR UPDATE ON "InterviewInvitation" FOR EACH ROW EXECUTE FUNCTION outclass_collaboration_scope();
DO $$ DECLARE t TEXT; r TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['InterviewCollaboration','InterviewPresence','InterviewMove','InterviewInvitation'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON %I FROM PUBLIC', t);
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON %I FROM %I', t,r); END IF;
    END LOOP;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION outclass_collaboration_scope() FROM PUBLIC;
COMMIT;
