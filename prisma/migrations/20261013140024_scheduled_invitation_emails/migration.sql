BEGIN;
ALTER TABLE public."ScheduledCommunication" ADD COLUMN "invitationQueuedAt" TIMESTAMP(3);
ALTER TABLE public."ScheduledCommunication" DROP CONSTRAINT "ScheduledCommunication_kind_check";
ALTER TABLE public."ScheduledCommunication" ADD CONSTRAINT "ScheduledCommunication_kind_check" CHECK(kind IN ('ANNOUNCEMENT','DECISION','INVITATION_EMAIL'));
ALTER TABLE public."ScheduledCommunication" DROP CONSTRAINT "ScheduledCommunication_publication_check";
ALTER TABLE public."ScheduledCommunication" ADD CONSTRAINT "ScheduledCommunication_publication_check" CHECK (
 (kind='ANNOUNCEMENT' AND "decisionPublishedAt" IS NULL AND "invitationQueuedAt" IS NULL AND ((status='PUBLISHED')=("publicationId" IS NOT NULL))) OR
 (kind='DECISION' AND "publicationId" IS NULL AND "invitationQueuedAt" IS NULL AND ((status='PUBLISHED')=("decisionPublishedAt" IS NOT NULL))) OR
 (kind='INVITATION_EMAIL' AND "publicationId" IS NULL AND "decisionPublishedAt" IS NULL AND ((status='PUBLISHED')=("invitationQueuedAt" IS NOT NULL)))
);
CREATE INDEX "ScheduledCommunication_clubId_updatedAt_idx" ON public."ScheduledCommunication"("clubId","updatedAt");
COMMIT;
