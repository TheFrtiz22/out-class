BEGIN;
-- InvitationDelivery remains the server-only outbox; no browser grants or RLS changes.
ALTER TABLE "ClubInvitation"
  ADD COLUMN "firstEmailSentAt" TIMESTAMP(3),
  ADD COLUMN "lastEmailSentAt" TIMESTAMP(3),
  ADD COLUMN "emailSendCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ClubInvitation" ADD CONSTRAINT "ClubInvitation_email_count_check"
  CHECK ("emailSendCount" >= 0 AND (("emailSendCount" = 0 AND "firstEmailSentAt" IS NULL AND "lastEmailSentAt" IS NULL)
    OR ("emailSendCount" > 0 AND "firstEmailSentAt" IS NOT NULL AND "lastEmailSentAt" IS NOT NULL AND "lastEmailSentAt" >= "firstEmailSentAt")));
-- Backfill any previously recorded sends without touching pending/failed attempts.
UPDATE "ClubInvitation" i SET "firstEmailSentAt" = d.first_sent, "lastEmailSentAt" = d.last_sent, "emailSendCount" = d.sends
FROM (SELECT "invitationId", min("sentAt") first_sent, max("sentAt") last_sent, count(*)::integer sends
  FROM "InvitationDelivery" WHERE "sentAt" IS NOT NULL GROUP BY "invitationId") d WHERE i.id = d."invitationId";
-- Serialize old queued requests too: keep the oldest active attempt, cancel extra queued ones.
WITH duplicates AS (SELECT id, row_number() OVER (PARTITION BY "invitationId" ORDER BY (status = 'SENDING') DESC, "createdAt", id) n
  FROM "InvitationDelivery" WHERE status IN ('QUEUED', 'SENDING'))
UPDATE "InvitationDelivery" SET status = 'CANCELLED' WHERE id IN (SELECT id FROM duplicates WHERE n > 1);
CREATE UNIQUE INDEX "InvitationDelivery_one_active_invitation" ON "InvitationDelivery" ("invitationId") WHERE status IN ('QUEUED', 'SENDING');
CREATE INDEX "InvitationDelivery_requestedById_createdAt_idx" ON "InvitationDelivery" ("requestedById", "createdAt");

COMMIT;
