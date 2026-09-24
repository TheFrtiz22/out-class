BEGIN;
ALTER TABLE "PipelineRound" ADD COLUMN "anonymousReview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Club" ADD COLUMN "testRequirement" TEXT NOT NULL DEFAULT 'OPTIONAL';
ALTER TABLE "Club" ADD CONSTRAINT "Club_testRequirement_check" CHECK ("testRequirement" IN ('OPTIONAL','SAT_OR_ACT','SAT','ACT','BOTH'));
ALTER TABLE "StudentProfile" ADD COLUMN "actScore" INTEGER, ADD COLUMN "actEnglish" INTEGER, ADD COLUMN "actMath" INTEGER, ADD COLUMN "actReading" INTEGER, ADD COLUMN "actScience" INTEGER;
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_act_check" CHECK (
("actScore" IS NULL OR "actScore" BETWEEN 1 AND 36) AND
("actEnglish" IS NULL OR "actEnglish" BETWEEN 1 AND 36) AND
("actMath" IS NULL OR "actMath" BETWEEN 1 AND 36) AND
("actReading" IS NULL OR "actReading" BETWEEN 1 AND 36) AND
("actScience" IS NULL OR "actScience" BETWEEN 1 AND 36));
ALTER TABLE "Application" ADD COLUMN "anonymousReviewText" TEXT;
COMMIT;
