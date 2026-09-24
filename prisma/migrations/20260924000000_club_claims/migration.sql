BEGIN;
ALTER TABLE "Club" ADD COLUMN "campusKey" TEXT NOT NULL DEFAULT 'uva', ADD COLUMN "directorySource" TEXT, ADD COLUMN "claimedAt" TIMESTAMP(3);
ALTER TABLE "ClubInvitation" ADD COLUMN "declinedAt" TIMESTAMP(3);
UPDATE "Club" c SET "claimedAt" = CURRENT_TIMESTAMP WHERE EXISTS (SELECT 1 FROM "ClubMember" m WHERE m."clubId" = c.id AND m."isOwner");
-- Source-linked basic entries only. Never overwrite existing profiles or import demo statistics.
-- Lock against concurrent inserts while reconciling existing names/slugs.
LOCK TABLE "Club" IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO "Club" (id, slug, name, tagline, description, color, category, "campusKey", "directorySource")
SELECT seed.id, seed.slug, seed.name, 'University of Virginia student organization', 'Basic directory listing provided by OutClass. Club leadership has not yet claimed this profile.', '#14243B', 'Finance & Investing', 'uva', seed.source
FROM (VALUES
 ('b90c1444-45ea-45bc-9b05-1f5a73c63301','mii','McIntire Investment Institute','https://mcintireinvestmentinstitute.org/','MII'),
 ('b90c1444-45ea-45bc-9b05-1f5a73c63302','vvf','Virginia Venture Fund','https://economics.virginia.edu/business-consulting-and-finance-clubs','VVF'),
 ('b90c1444-45ea-45bc-9b05-1f5a73c63303','aif','Alternative Investment Fund','https://atuva.student.virginia.edu/organization/alternativeinvestmentfundatmcintire','AIF')
) AS seed(id,slug,name,source,alias)
WHERE NOT EXISTS (SELECT 1 FROM "Club" c WHERE c.slug = seed.slug OR c.id = seed.id OR (c."campusKey" = 'uva' AND (lower(trim(c.name)) IN (lower(seed.name), lower(seed.alias)) OR lower(c.slug) = lower(replace(seed.name, ' ', '-')))));
COMMIT;
