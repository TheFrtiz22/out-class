BEGIN;
-- Existing club/round participation remains the sole availability snapshot.
ALTER TABLE "InterviewRoundParticipation"
 ADD COLUMN "requestedAt" TIMESTAMPTZ(3),
 ADD COLUMN "lastReminderAt" TIMESTAMPTZ(3),
 ADD COLUMN "reminderSequence" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "declinedAt" TIMESTAMPTZ(3);
ALTER TABLE "InterviewRoundParticipation" ADD CONSTRAINT "participation_response_consistent"
 CHECK ("confirmedAt" IS NULL OR "declinedAt" IS NULL);
ALTER TABLE "InterviewRoundParticipation" ADD CONSTRAINT "participation_reminder_sequence_nonnegative" CHECK ("reminderSequence" >= 0);
-- Existing [clubId, roundId, confirmedAt] / unique member-round indexes cover collection.
-- Existing private-table RLS and runtime ownership are retained; no Data API grants.

COMMIT;
