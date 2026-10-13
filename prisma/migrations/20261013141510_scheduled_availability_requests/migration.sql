BEGIN;
ALTER TABLE public."ScheduledCommunication" ADD COLUMN "availabilityPublishedAt" TIMESTAMP(3);
ALTER TABLE public."ScheduledCommunication" DROP CONSTRAINT "ScheduledCommunication_kind_check";
ALTER TABLE public."ScheduledCommunication" ADD CONSTRAINT "ScheduledCommunication_kind_check" CHECK(kind IN ('ANNOUNCEMENT','DECISION','INVITATION_EMAIL','AVAILABILITY_REQUEST'));
ALTER TABLE public."ScheduledCommunication" DROP CONSTRAINT "ScheduledCommunication_publication_check";
ALTER TABLE public."ScheduledCommunication" ADD CONSTRAINT "ScheduledCommunication_publication_check" CHECK (
 (kind='ANNOUNCEMENT' AND "decisionPublishedAt" IS NULL AND "invitationQueuedAt" IS NULL AND "availabilityPublishedAt" IS NULL AND ((status='PUBLISHED')=("publicationId" IS NOT NULL))) OR
 (kind='DECISION' AND "publicationId" IS NULL AND "invitationQueuedAt" IS NULL AND "availabilityPublishedAt" IS NULL AND ((status='PUBLISHED')=("decisionPublishedAt" IS NOT NULL))) OR
 (kind='AVAILABILITY_REQUEST' AND "publicationId" IS NULL AND "decisionPublishedAt" IS NULL AND "invitationQueuedAt" IS NULL AND ((status='PUBLISHED')=("availabilityPublishedAt" IS NOT NULL))) OR
 (kind='INVITATION_EMAIL' AND "availabilityPublishedAt" IS NULL AND "publicationId" IS NULL AND "decisionPublishedAt" IS NULL AND ((status='PUBLISHED')=("invitationQueuedAt" IS NOT NULL)))
);
COMMIT;
