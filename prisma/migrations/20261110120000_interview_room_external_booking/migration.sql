-- Leaders can mark an interview room as also reserved through the school's own
-- room system (UVA: 25Live). OutClass never reserves rooms itself; this is a
-- tracking flag only. Additive and nullable: existing rooms read as "not marked".
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "InterviewRoom" ADD COLUMN "externallyBookedAt" TIMESTAMP(3);
COMMIT;
