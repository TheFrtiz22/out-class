BEGIN;
-- Existing submissions, reviews, recipients and private-table permissions are preserved.
ALTER TABLE "TaskAssignment" ADD COLUMN "revisionRequestedAt" TIMESTAMP(3), ADD COLUMN "groupLabel" TEXT;
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_revision_request_check" CHECK ("revisionRequestedAt" IS NULL OR ("submittedAt" IS NOT NULL AND "reviewedAt" IS NULL));
CREATE INDEX "TaskAssignment_review_queue_idx" ON "TaskAssignment" ("taskId", "submittedAt", "reviewedAt");
COMMIT;
