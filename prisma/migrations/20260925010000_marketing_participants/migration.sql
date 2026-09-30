-- Null by default: existing directory entries are not confirmed partners.
ALTER TABLE "Club" ADD COLUMN "marketingApprovedAt" TIMESTAMP(3);
