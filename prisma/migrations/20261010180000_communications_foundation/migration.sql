BEGIN;
CREATE TABLE "ClubAnnouncement" (
 "id" TEXT NOT NULL, "clubId" TEXT NOT NULL, "authorId" TEXT NOT NULL,
 "title" TEXT NOT NULL, "body" TEXT NOT NULL, "audience" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ClubAnnouncement_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ClubAnnouncement_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "ClubAnnouncement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ClubAnnouncement_clubId_publishedAt_idx" ON "ClubAnnouncement"("clubId","publishedAt");
CREATE TABLE "UserNotification" (
 "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "clubId" TEXT, "announcementId" TEXT,
 "eventKey" TEXT NOT NULL, "type" TEXT NOT NULL, "title" TEXT NOT NULL,
 "body" TEXT NOT NULL, "href" TEXT NOT NULL, "readAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "UserNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "UserNotification_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE,
 CONSTRAINT "UserNotification_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "ClubAnnouncement"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UserNotification_userId_eventKey_key" ON "UserNotification"("userId","eventKey");
CREATE INDEX "UserNotification_userId_createdAt_idx" ON "UserNotification"("userId","createdAt");
CREATE INDEX "UserNotification_userId_readAt_idx" ON "UserNotification"("userId","readAt");
CREATE INDEX "UserNotification_announcementId_idx" ON "UserNotification"("announcementId");
CREATE TABLE "UserNotificationPreference" (
 "userId" TEXT NOT NULL, "emailAnnouncements" BOOLEAN NOT NULL DEFAULT true,
 "emailMessages" BOOLEAN NOT NULL DEFAULT true, "emailApplications" BOOLEAN NOT NULL DEFAULT true,
 "emailInterviews" BOOLEAN NOT NULL DEFAULT true, "emailInvitations" BOOLEAN NOT NULL DEFAULT true,
 "emailTasks" BOOLEAN NOT NULL DEFAULT true, "emailPlatform" BOOLEAN NOT NULL DEFAULT false,
 "emailFrequency" TEXT NOT NULL DEFAULT 'INSTANT',
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "UserNotificationPreference_pkey" PRIMARY KEY ("userId"),
 CONSTRAINT "UserNotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "UserNotificationPreference_emailFrequency_check" CHECK ("emailFrequency" IN ('INSTANT','DAILY','OFF'))
);
COMMIT;
