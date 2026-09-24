-- AlterTable
ALTER TABLE "ClubMember" ADD COLUMN     "cohort" TEXT,
ADD COLUMN     "groups" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "ClubTask" ADD COLUMN     "audience" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'TASK',
ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "requirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "resources" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "TaskAssignment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "memberId" TEXT,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewedAt" TIMESTAMP(3),
    "text" TEXT NOT NULL DEFAULT '',
    "link" TEXT NOT NULL DEFAULT '',
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "feedback" TEXT NOT NULL DEFAULT '',
    "revision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TaskAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskFile" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mime" TEXT NOT NULL,
    "submitted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskAssignment_memberId_idx" ON "TaskAssignment"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskAssignment_taskId_memberId_key" ON "TaskAssignment"("taskId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskFile_path_key" ON "TaskFile"("path");

-- CreateIndex
CREATE INDEX "TaskFile_assignmentId_idx" ON "TaskFile"("assignmentId");

-- AddForeignKey
ALTER TABLE "ClubTask" ADD CONSTRAINT "ClubTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ClubTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ClubTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "ClubMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskFile" ADD CONSTRAINT "TaskFile_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TaskAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Preserve legacy explicit assignees only when they are still club members.
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
INSERT INTO "TaskAssignment" (id,"taskId","memberId","userId")
SELECT md5(t.id || ':' || m.id)::uuid::text,t.id,m.id,m."userId" FROM "ClubTask" t JOIN "ClubMember" m ON m."clubId"=t."clubId" AND m."userId"=t."assigneeId";
ALTER TABLE "TaskAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskFile" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "TaskAssignment", "TaskFile" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON "TaskAssignment", "TaskFile" FROM anon; END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON "TaskAssignment", "TaskFile" FROM authenticated; END IF;
END $$;
ALTER TABLE "ClubTask" ADD CONSTRAINT "ClubTask_kind_check" CHECK (kind IN ('TASK','PROJECT'));
ALTER TABLE "ClubTask" ADD CONSTRAINT "ClubTask_not_own_project" CHECK (id IS DISTINCT FROM "projectId");
