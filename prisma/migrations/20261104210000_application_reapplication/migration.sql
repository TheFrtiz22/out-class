BEGIN;
SET LOCAL lock_timeout = '5s';

-- Students may apply to a club again after a rejection. Each application keeps
-- its own reviews, interviews, votes and decision letters, so a re-application
-- is a new row. At most one application per student and club may be anything
-- other than REJECTED; existing data already satisfies this because the
-- previous constraint allowed only one row per student and club.
CREATE UNIQUE INDEX "Application_one_open_per_student_club"
  ON "Application"("studentId", "clubId") WHERE status <> 'REJECTED';
CREATE INDEX "Application_studentId_clubId_idx" ON "Application"("studentId", "clubId");
DROP INDEX "Application_studentId_clubId_key";

COMMIT;
