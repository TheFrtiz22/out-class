-- Short-answer application questions: one line with a character limit set by the club.
-- Additive: existing questions and answers are unchanged, and the new column is NULL for them.
-- ALTER TYPE ... ADD VALUE is safe in a transaction on PostgreSQL 12+ as long as
-- the new value is not used in the same transaction (it is not used here).
-- Rollback: drop the constraint and the column. The enum value stays (PostgreSQL cannot drop
-- one); no row uses it once short-answer questions are removed.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TYPE "QuestionType" ADD VALUE IF NOT EXISTS 'SHORT_ANSWER';
ALTER TABLE "ApplicationQuestion" ADD COLUMN "characterLimit" INTEGER;
ALTER TABLE "ApplicationQuestion" ADD CONSTRAINT "ApplicationQuestion_characterLimit_range" CHECK ("characterLimit" IS NULL OR "characterLimit" BETWEEN 1 AND 500);
COMMIT;
