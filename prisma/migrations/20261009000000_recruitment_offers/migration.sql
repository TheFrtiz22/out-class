BEGIN;
-- Existing invitations remain unchanged; historical decisions are not backfilled.
ALTER TABLE "ClubInvitation" ADD COLUMN "applicationId" TEXT;
CREATE UNIQUE INDEX "Application_id_clubId_key" ON "Application"("id", "clubId");
CREATE UNIQUE INDEX "ClubInvitation_applicationId_key" ON "ClubInvitation"("applicationId");
ALTER TABLE "ClubInvitation" ADD CONSTRAINT "ClubInvitation_applicationId_clubId_fkey"
  FOREIGN KEY ("applicationId", "clubId") REFERENCES "Application"("id", "clubId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClubInvitation" ADD CONSTRAINT "ClubInvitation_recruitment_member_only"
  CHECK ("applicationId" IS NULL OR (purpose = 'MEMBERSHIP' AND "requestedRole" = 'MEMBER' AND NOT cardinality(permissions) > 0 AND "schoolIdentityId" IS NULL AND "authoritySource" = 'CLUB_MEMBER'));

CREATE UNIQUE INDEX "ClubInvitation_applicationId_clubId_key" ON "ClubInvitation"("applicationId", "clubId");
COMMIT;
