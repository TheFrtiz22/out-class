-- Additive and compatible with old writers: legacy NULL snapshots stay private.
-- No backfill from private drafts. Existing immutable-review triggers prevent retroactive publication.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "InterviewRecord" ADD COLUMN "submittedQuestions" JSONB;
ALTER TABLE "InterviewRecord" ADD CONSTRAINT "InterviewRecord_submitted_questions_check"
  CHECK ("submittedQuestions" IS NULL OR ("completedAt" IS NOT NULL AND jsonb_typeof("submittedQuestions") = 'array' AND jsonb_array_length("submittedQuestions") <= 80));
-- Existing server-only table RLS, browser-role denial and completed-review guards remain in force.
COMMIT;
