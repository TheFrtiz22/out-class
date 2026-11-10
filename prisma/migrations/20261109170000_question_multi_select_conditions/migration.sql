-- "Select all that apply" questions and follow-up questions shown only for
-- certain earlier answers. Additive: existing questions and answers are unchanged.
-- ALTER TYPE ... ADD VALUE is safe in a transaction on PostgreSQL 12+ as long as
-- the new value is not used in the same transaction.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TYPE "QuestionType" ADD VALUE IF NOT EXISTS 'MULTI_SELECT';
ALTER TABLE "ApplicationQuestion" ADD COLUMN "showIf" JSONB,
 ADD CONSTRAINT "ApplicationQuestion_showIf_shape" CHECK (
  "showIf" IS NULL OR (
   jsonb_typeof("showIf") = 'object'
   AND jsonb_typeof("showIf"->'questionId') = 'string'
   AND jsonb_typeof("showIf"->'anyOf') = 'array'
   AND jsonb_array_length("showIf"->'anyOf') BETWEEN 1 AND 30
  )
 );
COMMIT;
