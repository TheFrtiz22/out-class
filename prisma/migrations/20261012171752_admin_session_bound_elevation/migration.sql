BEGIN;
-- Preserve existing deadlines and revocations. NULL is a session-bound elevation;
-- legacy sessions require normal reauthentication to opt into the new behavior.
ALTER TABLE public."AdminElevation" DROP CONSTRAINT "AdminElevation_check";
ALTER TABLE public."AdminElevation" ALTER COLUMN "expiresAt" DROP NOT NULL;
ALTER TABLE public."AdminElevation" ADD CONSTRAINT "AdminElevation_expiry_check"
  CHECK ("expiresAt" IS NULL OR "expiresAt" > "createdAt");
-- Ownership, RLS, grants, challenge expiry and support-session expiry are unchanged.
COMMIT;
