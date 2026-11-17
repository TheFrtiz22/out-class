BEGIN;
SET LOCAL lock_timeout = '5s';
-- Attendance rule for recruiting rounds. Additive only: existing rules get an
-- empty list, which means "no attendance requirement". Event ownership is
-- checked by the server action; deleted events are ignored at evaluation.
ALTER TABLE "RecruitingRule" ADD COLUMN "requiredEventIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "RecruitingRule" ADD CONSTRAINT "RecruitingRule_requiredEventIds_check"
 CHECK (cardinality("requiredEventIds") <= 50 AND array_position("requiredEventIds", NULL) IS NULL);
COMMIT;
