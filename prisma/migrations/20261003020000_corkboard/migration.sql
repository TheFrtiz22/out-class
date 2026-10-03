BEGIN;
-- CreateTable
CREATE TABLE "CorkboardClub" (
    "userId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorkboardClub_pkey" PRIMARY KEY ("userId","clubId")
);

-- CreateIndex
CREATE INDEX "CorkboardClub_clubId_idx" ON "CorkboardClub"("clubId");

-- AddForeignKey
ALTER TABLE "CorkboardClub" ADD CONSTRAINT "CorkboardClub_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorkboardClub" ADD CONSTRAINT "CorkboardClub_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "CorkboardClub" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "CorkboardClub" FROM PUBLIC;
DO $$ DECLARE api_role text; BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN EXECUTE format('REVOKE ALL ON "CorkboardClub" FROM %I',api_role); END IF;
  END LOOP;
END $$;
COMMIT;
