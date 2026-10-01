BEGIN;
-- Additive onboarding foundation. Prisma remains the only migration history.
-- CreateEnum
CREATE TYPE "MembershipAccessRole" AS ENUM ('OWNER', 'ADMIN', 'RECRUITING_ADMIN', 'INTERVIEWER', 'MEMBER');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'LEFT');

-- CreateEnum
CREATE TYPE "IdentifierNormalization" AS ENUM ('TRIM_LOWERCASE', 'TRIM');

-- CreateEnum
CREATE TYPE "IdentityVerification" AS ENUM ('UNCONFIGURED', 'EMAIL_LOCAL_PART', 'INSTITUTIONAL_SSO');

-- CreateEnum
CREATE TYPE "InvitationPurpose" AS ENUM ('OWNER_DESIGNATION', 'MEMBERSHIP', 'ACCESS_GRANT');

-- CreateEnum
CREATE TYPE "InvitationAuthoritySource" AS ENUM ('PLATFORM_ADMIN', 'CLUB_MEMBER');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RosterImportStatus" AS ENUM ('VALIDATED', 'INVALID', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RosterRowStatus" AS ENUM ('PENDING', 'VALID', 'INVALID', 'DUPLICATE_ROW', 'ALREADY_MEMBER', 'INVITATION_REUSED', 'INVITATION_CREATED', 'FAILED');

-- CreateEnum
CREATE TYPE "InvitationDeliveryStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "ClubInvitation" DROP CONSTRAINT "ClubInvitation_clubId_fkey";

-- DropForeignKey
ALTER TABLE "ClubInvitation" DROP CONSTRAINT "ClubInvitation_invitedBy_fkey";

-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "schoolId" TEXT NOT NULL DEFAULT 'school-uva';

-- AlterTable
ALTER TABLE "ClubMember" ADD COLUMN     "accessRole" "MembershipAccessRole" NOT NULL DEFAULT 'MEMBER',
ADD COLUMN     "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ClubInvitation" ADD COLUMN     "authoritySource" "InvitationAuthoritySource" NOT NULL DEFAULT 'CLUB_MEMBER',
ADD COLUMN     "claimedAt" TIMESTAMP(3),
ADD COLUMN     "claimedUserId" TEXT,
ADD COLUMN     "dismissedAt" TIMESTAMP(3),
ADD COLUMN     "expiredAt" TIMESTAMP(3),
ADD COLUMN     "invitedName" TEXT,
ADD COLUMN     "invitedYear" TEXT,
ADD COLUMN     "purpose" "InvitationPurpose" NOT NULL DEFAULT 'ACCESS_GRANT',
ADD COLUMN     "requestedRole" "MembershipAccessRole" NOT NULL DEFAULT 'MEMBER',
ADD COLUMN     "schoolId" TEXT NOT NULL DEFAULT 'school-uva',
ADD COLUMN     "schoolIdentityId" TEXT,
ADD COLUMN     "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolIdentifierType" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "normalization" "IdentifierNormalization" NOT NULL DEFAULT 'TRIM_LOWERCASE',
    "validationRegex" TEXT,
    "verification" "IdentityVerification" NOT NULL DEFAULT 'UNCONFIGURED',
    "emailDomain" TEXT,

    CONSTRAINT "SchoolIdentifierType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolIdentity" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "identifierTypeId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "normalizedIdentifier" TEXT NOT NULL,
    "userId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationMethod" "IdentityVerification",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterImport" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileHash" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "status" "RosterImportStatus" NOT NULL DEFAULT 'VALIDATED',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "successfulRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "validationVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RosterImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterImportRow" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "input" JSONB NOT NULL,
    "invitedName" TEXT,
    "invitedYear" TEXT,
    "identifier" TEXT,
    "normalizedIdentifier" TEXT,
    "schoolIdentityId" TEXT,
    "matchedUserId" TEXT,
    "invitationId" TEXT,
    "status" "RosterRowStatus" NOT NULL DEFAULT 'PENDING',
    "errors" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RosterImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvitationDelivery" (
    "id" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" TEXT NOT NULL,
    "status" "InvitationDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvitationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "School_key_key" ON "School"("key");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolIdentifierType_schoolId_key_key" ON "SchoolIdentifierType"("schoolId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolIdentifierType_id_schoolId_key" ON "SchoolIdentifierType"("id", "schoolId");

-- CreateIndex
CREATE INDEX "SchoolIdentity_userId_schoolId_idx" ON "SchoolIdentity"("userId", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolIdentity_schoolId_identifierTypeId_normalizedIdentifi_key" ON "SchoolIdentity"("schoolId", "identifierTypeId", "normalizedIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolIdentity_id_schoolId_key" ON "SchoolIdentity"("id", "schoolId");

-- CreateIndex
CREATE INDEX "RosterImport_clubId_createdAt_idx" ON "RosterImport"("clubId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RosterImport_clubId_idempotencyKey_key" ON "RosterImport"("clubId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "RosterImport_id_clubId_key" ON "RosterImport"("id", "clubId");

-- CreateIndex
CREATE INDEX "RosterImportRow_invitationId_idx" ON "RosterImportRow"("invitationId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterImportRow_importId_rowNumber_key" ON "RosterImportRow"("importId", "rowNumber");

-- CreateIndex
CREATE UNIQUE INDEX "InvitationDelivery_idempotencyKey_key" ON "InvitationDelivery"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "InvitationDelivery_providerMessageId_key" ON "InvitationDelivery"("providerMessageId");

-- CreateIndex
CREATE INDEX "InvitationDelivery_status_nextAttemptAt_idx" ON "InvitationDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "InvitationDelivery_invitationId_createdAt_idx" ON "InvitationDelivery"("invitationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Club_id_schoolId_key" ON "Club"("id", "schoolId");

-- CreateIndex
CREATE INDEX "ClubInvitation_schoolIdentityId_status_idx" ON "ClubInvitation"("schoolIdentityId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClubInvitation_id_clubId_key" ON "ClubInvitation"("id", "clubId");

-- Preserve legacy campus keys without guessing another institution's identity mapping.
INSERT INTO "School" (id, key, name) VALUES ('school-uva', 'uva', 'University of Virginia');
INSERT INTO "School" (id, key, name)
SELECT 'school-' || md5("campusKey"), "campusKey", "campusKey"
FROM "Club" WHERE "campusKey" <> 'uva' GROUP BY "campusKey";
UPDATE "Club" SET "schoolId" = 'school-' || md5("campusKey") WHERE "campusKey" <> 'uva';
UPDATE "ClubInvitation" i SET "schoolId" = c."schoolId" FROM "Club" c WHERE c.id = i."clubId";
INSERT INTO "SchoolIdentifierType" (id, "schoolId", key, label, normalization, "validationRegex", verification, "emailDomain")
VALUES ('school-uva-computing-id', 'school-uva', 'computing_id', 'UVA Computing ID', 'TRIM_LOWERCASE', '^[a-z0-9]+([._+-][a-z0-9]+)*$', 'EMAIL_LOCAL_PART', 'virginia.edu');

-- Preserve permissions and legacy titles exactly. These labels never grant capabilities.
UPDATE "ClubMember" SET "accessRole" = CASE
  WHEN "isOwner" THEN 'OWNER'
  WHEN 'leaders.manage' = ANY(permissions) THEN 'ADMIN'
  WHEN role = 'RECRUITMENT_LEAD' THEN 'RECRUITING_ADMIN'
  WHEN 'applications.review' = ANY(permissions) THEN 'INTERVIEWER'
  ELSE 'MEMBER' END::"MembershipAccessRole";
-- Existing accepted records may outlive their recipient account; do not invent that identity.
UPDATE "ClubInvitation" SET status = CASE
  WHEN "acceptedAt" IS NOT NULL THEN 'ACCEPTED'
  WHEN "declinedAt" IS NOT NULL THEN 'DECLINED'
  WHEN "revokedAt" IS NOT NULL THEN 'REVOKED'
  WHEN "expiresAt" <= CURRENT_TIMESTAMP THEN 'EXPIRED'
  ELSE 'PENDING' END::"InvitationStatus",
  "claimedAt" = "acceptedAt",
  "expiredAt" = CASE WHEN "acceptedAt" IS NULL AND "declinedAt" IS NULL AND "revokedAt" IS NULL AND "expiresAt" <= CURRENT_TIMESTAMP THEN "expiresAt" END;
UPDATE "ClubInvitation" i SET "claimedUserId" = u.id
FROM "User" u WHERE i."acceptedAt" IS NOT NULL AND lower(trim(u.email)) = lower(trim(i.email))
  AND (SELECT count(*) FROM "User" candidate WHERE lower(trim(candidate.email)) = lower(trim(i.email))) = 1;

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubInvitation" ADD CONSTRAINT "ClubInvitation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubInvitation" ADD CONSTRAINT "ClubInvitation_schoolIdentityId_schoolId_fkey" FOREIGN KEY ("schoolIdentityId", "schoolId") REFERENCES "SchoolIdentity"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubInvitation" ADD CONSTRAINT "ClubInvitation_claimedUserId_fkey" FOREIGN KEY ("claimedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubInvitation" ADD CONSTRAINT "ClubInvitation_clubId_schoolId_fkey" FOREIGN KEY ("clubId", "schoolId") REFERENCES "Club"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubInvitation" ADD CONSTRAINT "ClubInvitation_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolIdentifierType" ADD CONSTRAINT "SchoolIdentifierType_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolIdentity" ADD CONSTRAINT "SchoolIdentity_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolIdentity" ADD CONSTRAINT "SchoolIdentity_identifierTypeId_schoolId_fkey" FOREIGN KEY ("identifierTypeId", "schoolId") REFERENCES "SchoolIdentifierType"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolIdentity" ADD CONSTRAINT "SchoolIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterImport" ADD CONSTRAINT "RosterImport_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterImport" ADD CONSTRAINT "RosterImport_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterImportRow" ADD CONSTRAINT "RosterImportRow_importId_clubId_fkey" FOREIGN KEY ("importId", "clubId") REFERENCES "RosterImport"("id", "clubId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterImportRow" ADD CONSTRAINT "RosterImportRow_schoolIdentityId_fkey" FOREIGN KEY ("schoolIdentityId") REFERENCES "SchoolIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterImportRow" ADD CONSTRAINT "RosterImportRow_matchedUserId_fkey" FOREIGN KEY ("matchedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterImportRow" ADD CONSTRAINT "RosterImportRow_invitationId_clubId_fkey" FOREIGN KEY ("invitationId", "clubId") REFERENCES "ClubInvitation"("id", "clubId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationDelivery" ADD CONSTRAINT "InvitationDelivery_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "ClubInvitation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationDelivery" ADD CONSTRAINT "InvitationDelivery_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing (userId, clubId) uniqueness is deliberately stronger than active-only uniqueness:
-- reactivate the same membership rather than create a second identity/history record.
ALTER TABLE "ClubMember" ADD CONSTRAINT "ClubMember_owner_role_check"
  CHECK ("isOwner" = ("accessRole" = 'OWNER'));
ALTER TABLE "ClubMember" ADD CONSTRAINT "ClubMember_inactive_access_check"
  CHECK (status = 'ACTIVE' OR (NOT "isOwner" AND cardinality(permissions) = 0));
ALTER TABLE "SchoolIdentity" ADD CONSTRAINT "SchoolIdentity_verification_check" CHECK (
  ("userId" IS NULL AND "verifiedAt" IS NULL AND "verificationMethod" IS NULL) OR
  ("userId" IS NOT NULL AND "verifiedAt" IS NOT NULL AND "verificationMethod" IS NOT NULL AND "verificationMethod" <> 'UNCONFIGURED')
);
ALTER TABLE "SchoolIdentifierType" ADD CONSTRAINT "SchoolIdentifierType_email_mapping_check"
  CHECK (verification <> 'EMAIL_LOCAL_PART' OR ("emailDomain" IS NOT NULL AND "emailDomain" ~ '^[a-z0-9]+([.-][a-z0-9]+)*\.[a-z]+$'));
ALTER TABLE "ClubInvitation" ADD CONSTRAINT "ClubInvitation_owner_purpose_check"
  CHECK (("requestedRole" = 'OWNER') = (purpose = 'OWNER_DESIGNATION'));
ALTER TABLE "ClubInvitation" ADD CONSTRAINT "ClubInvitation_owner_identity_check"
  CHECK (purpose <> 'OWNER_DESIGNATION' OR "schoolIdentityId" IS NOT NULL);
ALTER TABLE "ClubInvitation" ADD CONSTRAINT "ClubInvitation_state_check" CHECK (
  (status = 'PENDING' AND "acceptedAt" IS NULL AND "declinedAt" IS NULL AND "revokedAt" IS NULL AND "expiredAt" IS NULL AND "claimedAt" IS NULL AND "claimedUserId" IS NULL) OR
  (status = 'ACCEPTED' AND "acceptedAt" IS NOT NULL AND "claimedAt" IS NOT NULL AND "claimedAt" = "acceptedAt" AND ("schoolIdentityId" IS NULL OR "claimedUserId" IS NOT NULL)) OR
  (status = 'DECLINED' AND "declinedAt" IS NOT NULL AND "acceptedAt" IS NULL AND "claimedAt" IS NULL AND "claimedUserId" IS NULL) OR
  (status = 'REVOKED' AND "revokedAt" IS NOT NULL AND "acceptedAt" IS NULL AND "claimedAt" IS NULL AND "claimedUserId" IS NULL) OR
  (status = 'EXPIRED' AND "expiredAt" IS NOT NULL AND "acceptedAt" IS NULL AND "claimedAt" IS NULL AND "claimedUserId" IS NULL)
);
ALTER TABLE "ClubInvitation" ADD CONSTRAINT "ClubInvitation_names_check" CHECK (
  ("invitedName" IS NULL OR length("invitedName") <= 200) AND
  ("invitedYear" IS NULL OR length("invitedYear") <= 80)
);
-- Legacy invitations retain their historical links and capability sets; only the new
-- identity-bound lifecycle deduplicates pending invitations. No records are discarded.
CREATE UNIQUE INDEX "ClubInvitation_pending_identity_key"
  ON "ClubInvitation" ("clubId", "schoolIdentityId") WHERE status = 'PENDING' AND "schoolIdentityId" IS NOT NULL;
ALTER TABLE "RosterImport" ADD CONSTRAINT "RosterImport_counts_check" CHECK (
  "rowCount" BETWEEN 0 AND 10000 AND "successfulRows" >= 0 AND "failedRows" >= 0 AND
  "successfulRows" + "failedRows" <= "rowCount" AND "validationVersion" > 0 AND
  length(filename) BETWEEN 1 AND 255 AND length("idempotencyKey") BETWEEN 1 AND 100
);
ALTER TABLE "RosterImportRow" ADD CONSTRAINT "RosterImportRow_input_check" CHECK (
  "rowNumber" BETWEEN 1 AND 10000 AND jsonb_typeof(input) = 'object' AND jsonb_typeof(errors) = 'array' AND
  (status NOT IN ('INVITATION_CREATED', 'INVITATION_REUSED') OR "invitationId" IS NOT NULL)
);
ALTER TABLE "InvitationDelivery" ADD CONSTRAINT "InvitationDelivery_attempt_check"
  CHECK ("attemptCount" >= 0 AND "templateVersion" > 0 AND length("idempotencyKey") BETWEEN 1 AND 100);

-- Canonicalization is enforced even on writes made outside the app. Never rebind a
-- claimed identity or mutate the key beneath pending invitations.
CREATE FUNCTION outclass_school_identity_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE config "SchoolIdentifierType";
BEGIN
  SELECT * INTO STRICT config FROM "SchoolIdentifierType" WHERE id = NEW."identifierTypeId" AND "schoolId" = NEW."schoolId";
  NEW."normalizedIdentifier" := CASE WHEN config.normalization = 'TRIM_LOWERCASE' THEN lower(btrim(NEW.identifier)) ELSE btrim(NEW.identifier) END;
  IF length(NEW."normalizedIdentifier") NOT BETWEEN 1 AND 128 OR NEW."normalizedIdentifier" ~ '[[:cntrl:]]' OR
     (config."validationRegex" IS NOT NULL AND NEW."normalizedIdentifier" !~ config."validationRegex") THEN
    RAISE EXCEPTION 'Invalid school identifier';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW."schoolId" <> OLD."schoolId" OR NEW."identifierTypeId" <> OLD."identifierTypeId" OR
    NEW."normalizedIdentifier" <> OLD."normalizedIdentifier" OR
    (OLD."userId" IS NOT NULL AND NEW."userId" IS DISTINCT FROM OLD."userId")
  ) THEN RAISE EXCEPTION 'School identity keys and verified ownership are immutable'; END IF;
  NEW."updatedAt" := CURRENT_TIMESTAMP;
  RETURN NEW;
END $$;
CREATE TRIGGER outclass_school_identity_guard BEFORE INSERT OR UPDATE ON "SchoolIdentity"
  FOR EACH ROW EXECUTE FUNCTION outclass_school_identity_guard();

CREATE FUNCTION outclass_identifier_type_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (NEW."schoolId", NEW.normalization, NEW."validationRegex", NEW.verification, NEW."emailDomain") IS DISTINCT FROM
     (OLD."schoolId", OLD.normalization, OLD."validationRegex", OLD.verification, OLD."emailDomain") AND
     EXISTS (SELECT 1 FROM "SchoolIdentity" WHERE "identifierTypeId" = OLD.id) THEN
    RAISE EXCEPTION 'Identity mapping changes require an explicit reconciliation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER outclass_identifier_type_guard BEFORE UPDATE ON "SchoolIdentifierType"
  FOR EACH ROW EXECUTE FUNCTION outclass_identifier_type_guard();

-- Keep legacy isOwner writes compatible; role labels never grant permissions.
CREATE FUNCTION outclass_membership_onboarding_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM id FROM "Club" WHERE id = COALESCE(NEW."clubId", OLD."clubId") FOR UPDATE;
  IF TG_OP <> 'INSERT' AND OLD."isOwner" AND (TG_OP = 'DELETE' OR NOT NEW."isOwner" OR NEW.status <> 'ACTIVE') AND
    NOT EXISTS (SELECT 1 FROM "ClubMember" m JOIN "User" u ON u.id = m."userId"
      WHERE m."clubId" = OLD."clubId" AND m.id <> OLD.id AND m."isOwner" AND m.status = 'ACTIVE' AND u."disabledAt" IS NULL)
  THEN RAISE EXCEPTION 'Assign another active owner first'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF TG_OP = 'UPDATE' AND (NEW."clubId" <> OLD."clubId" OR NEW."userId" <> OLD."userId") THEN
    RAISE EXCEPTION 'Membership identity is immutable';
  END IF;
  IF NEW."isOwner" THEN NEW."accessRole" := 'OWNER';
  ELSIF NEW."accessRole" = 'OWNER' THEN
    IF TG_OP = 'UPDATE' AND OLD."isOwner" THEN NEW."accessRole" := 'MEMBER';
    ELSE RAISE EXCEPTION 'Owner role requires explicit ownership'; END IF;
  END IF;
  NEW."updatedAt" := CURRENT_TIMESTAMP;
  RETURN NEW;
END $$;
CREATE TRIGGER outclass_membership_onboarding_guard BEFORE INSERT OR UPDATE OR DELETE ON "ClubMember"
  FOR EACH ROW EXECUTE FUNCTION outclass_membership_onboarding_guard();

-- Timestamp-based legacy actions continue working. Identity-bound acceptance also
-- requires a verified recipient and a membership in the same organization.
CREATE FUNCTION outclass_invitation_onboarding_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE recipient "SchoolIdentity"; actor "ClubMember"; permitted boolean;
BEGIN
  PERFORM id FROM "Club" WHERE id = NEW."clubId" FOR UPDATE;
  NEW.email := lower(btrim(NEW.email));
  IF NEW."schoolIdentityId" IS NULL AND TG_OP = 'INSERT' THEN
    SELECT "schoolId" INTO NEW."schoolId" FROM "Club" WHERE id = NEW."clubId";
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW."clubId" <> OLD."clubId" OR NEW."schoolId" <> OLD."schoolId" OR
    NEW."schoolIdentityId" IS DISTINCT FROM OLD."schoolIdentityId" OR
    NEW."invitedBy" <> OLD."invitedBy" OR NEW."authoritySource" <> OLD."authoritySource" OR
    NEW.purpose <> OLD.purpose OR NEW."requestedRole" <> OLD."requestedRole" OR
    NEW.permissions <> OLD.permissions OR NEW.email <> lower(btrim(OLD.email))
  ) THEN RAISE EXCEPTION 'Invitation recipient and grant are immutable; revoke and reissue'; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status <> 'PENDING' THEN
    IF NEW.status <> OLD.status OR NEW."acceptedAt" IS DISTINCT FROM OLD."acceptedAt" OR
       NEW."claimedUserId" IS DISTINCT FROM OLD."claimedUserId" OR NEW."claimedAt" IS DISTINCT FROM OLD."claimedAt" THEN
      RAISE EXCEPTION 'Terminal invitations cannot be reopened or reassigned';
    END IF;
    NEW.status := OLD.status;
  ELSE
    IF NEW."acceptedAt" IS NOT NULL THEN NEW.status := 'ACCEPTED';
    ELSIF NEW."declinedAt" IS NOT NULL THEN NEW.status := 'DECLINED';
    ELSIF NEW."revokedAt" IS NOT NULL THEN NEW.status := 'REVOKED';
    ELSIF NEW."expiresAt" <= CURRENT_TIMESTAMP THEN NEW.status := 'EXPIRED'; END IF;
  END IF;
  IF NEW.status = 'ACCEPTED' THEN NEW."claimedAt" := NEW."acceptedAt"; END IF;
  IF NEW.status = 'DECLINED' THEN NEW."declinedAt" := COALESCE(NEW."declinedAt", CURRENT_TIMESTAMP); END IF;
  IF NEW.status = 'REVOKED' THEN NEW."revokedAt" := COALESCE(NEW."revokedAt", CURRENT_TIMESTAMP); END IF;
  IF NEW.status = 'EXPIRED' THEN NEW."expiredAt" := COALESCE(NEW."expiredAt", NEW."expiresAt"); END IF;
  IF NEW."schoolIdentityId" IS NOT NULL THEN
    SELECT * INTO STRICT recipient FROM "SchoolIdentity" WHERE id = NEW."schoolIdentityId" AND "schoolId" = NEW."schoolId";
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status = 'PENDING' AND NEW.status = 'ACCEPTED') THEN
      IF NOT EXISTS (SELECT 1 FROM "User" WHERE id = NEW."invitedBy" AND "disabledAt" IS NULL) THEN
        RAISE EXCEPTION 'Inviter account unavailable';
      END IF;
      IF NEW."authoritySource" = 'PLATFORM_ADMIN' THEN
        permitted := EXISTS (SELECT 1 FROM "PlatformAdmin" WHERE "userId" = NEW."invitedBy" AND active);
      ELSE
        SELECT * INTO actor FROM "ClubMember" WHERE "clubId" = NEW."clubId" AND "userId" = NEW."invitedBy" AND status = 'ACTIVE';
        permitted := FOUND AND (actor."isOwner" OR (
          NEW."requestedRole" <> 'OWNER' AND
          ((NEW.purpose = 'MEMBERSHIP' AND NEW."requestedRole" = 'MEMBER' AND cardinality(NEW.permissions) = 0 AND 'members.manage' = ANY(actor.permissions)) OR
           ('leaders.manage' = ANY(actor.permissions) AND NEW.permissions <@ actor.permissions))
        ));
      END IF;
      IF NOT COALESCE(permitted, false) THEN RAISE EXCEPTION 'Invitation grant is not authorized'; END IF;
    END IF;
    IF NEW.status = 'ACCEPTED' THEN
      IF NEW."expiresAt" <= CURRENT_TIMESTAMP AND (TG_OP = 'INSERT' OR OLD.status = 'PENDING') THEN RAISE EXCEPTION 'Invitation expired'; END IF;
      IF recipient."userId" IS NULL OR recipient."verifiedAt" IS NULL OR NEW."claimedUserId" IS DISTINCT FROM recipient."userId" OR
         NOT EXISTS (SELECT 1 FROM "ClubMember" m JOIN "User" u ON u.id = m."userId"
           WHERE m."clubId" = NEW."clubId" AND m."userId" = NEW."claimedUserId" AND m.status = 'ACTIVE' AND u."disabledAt" IS NULL
           AND (NEW."requestedRole" <> 'OWNER' OR m."isOwner")) THEN
        RAISE EXCEPTION 'Invitation acceptance requires its verified identity and active membership';
      END IF;
    END IF;
  END IF;
  NEW."updatedAt" := CURRENT_TIMESTAMP;
  RETURN NEW;
END $$;
CREATE TRIGGER outclass_invitation_onboarding_guard BEFORE INSERT OR UPDATE ON "ClubInvitation"
  FOR EACH ROW EXECUTE FUNCTION outclass_invitation_onboarding_guard();

CREATE FUNCTION outclass_roster_row_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW."importId", NEW."clubId", NEW."rowNumber", NEW.input) IS DISTINCT FROM
    (OLD."importId", OLD."clubId", OLD."rowNumber", OLD.input) THEN
    RAISE EXCEPTION 'Original roster rows are immutable';
  END IF;
  IF NEW."schoolIdentityId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "SchoolIdentity" s JOIN "Club" c ON c."schoolId" = s."schoolId"
    WHERE s.id = NEW."schoolIdentityId" AND c.id = NEW."clubId"
  ) THEN RAISE EXCEPTION 'Roster identity belongs to another school'; END IF;
  IF NEW."invitationId" IS NOT NULL AND NEW."schoolIdentityId" IS DISTINCT FROM
    (SELECT "schoolIdentityId" FROM "ClubInvitation" WHERE id = NEW."invitationId") THEN
    RAISE EXCEPTION 'Roster invitation must belong to the row identity';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER outclass_roster_row_guard BEFORE INSERT OR UPDATE ON "RosterImportRow"
  FOR EACH ROW EXECUTE FUNCTION outclass_roster_row_guard();

CREATE FUNCTION outclass_roster_import_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM id FROM "Club" WHERE id = NEW."clubId" FOR UPDATE;
  IF TG_OP = 'INSERT' AND NOT EXISTS (
    SELECT 1 FROM "ClubMember" m JOIN "User" u ON u.id = m."userId"
    WHERE m."clubId" = NEW."clubId" AND m."userId" = NEW."uploadedById" AND m.status = 'ACTIVE' AND u."disabledAt" IS NULL
      AND (m."isOwner" OR 'members.manage' = ANY(m.permissions))
  ) THEN RAISE EXCEPTION 'Roster upload requires member-management access'; END IF;
  IF TG_OP = 'UPDATE' AND (NEW."clubId", NEW."uploadedById", NEW.filename, NEW."fileHash", NEW."idempotencyKey", NEW."rowCount") IS DISTINCT FROM
    (OLD."clubId", OLD."uploadedById", OLD.filename, OLD."fileHash", OLD."idempotencyKey", OLD."rowCount") THEN
    RAISE EXCEPTION 'Roster upload provenance is immutable';
  END IF;
  NEW."updatedAt" := CURRENT_TIMESTAMP;
  RETURN NEW;
END $$;
CREATE TRIGGER outclass_roster_import_guard BEFORE INSERT OR UPDATE ON "RosterImport"
  FOR EACH ROW EXECUTE FUNCTION outclass_roster_import_guard();

-- Same server-only boundary as all existing application tables. No browser access
-- is granted: recipient/manager reads and privileged writes go through server guards.
DO $$ DECLARE tbl text; api_role text; BEGIN
  FOREACH tbl IN ARRAY ARRAY['School','SchoolIdentifierType','SchoolIdentity','RosterImport','RosterImportRow','InvitationDelivery','ClubInvitation','ClubMember'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC', tbl);
    EXECUTE format('CREATE POLICY outclass_onboarding_server_only ON %I AS RESTRICTIVE FOR ALL TO PUBLIC USING (false) WITH CHECK (false)', tbl);
    FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
        EXECUTE format('REVOKE ALL ON TABLE %I FROM %I', tbl, api_role);
      END IF;
    END LOOP;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION outclass_school_identity_guard(), outclass_identifier_type_guard(),
  outclass_membership_onboarding_guard(), outclass_invitation_onboarding_guard(), outclass_roster_row_guard(), outclass_roster_import_guard() FROM PUBLIC;
COMMIT;
