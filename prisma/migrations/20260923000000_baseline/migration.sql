BEGIN;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('STUDENT', 'CLUB_ADMIN');

-- CreateEnum
CREATE TYPE "ClubRole" AS ENUM ('PRESIDENT', 'RECRUITMENT_LEAD', 'GENERAL_MEMBER');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('ESSAY', 'FILE_UPLOAD', 'MULTIPLE_CHOICE');

-- CreateEnum
CREATE TYPE "AppStatus" AS ENUM ('DRAFTING', 'SUBMITTED', 'IN_REVIEW', 'INTERVIEWING', 'ACCEPTED', 'REJECTED', 'WAITLISTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "AppRole" NOT NULL DEFAULT 'STUDENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "computingId" TEXT NOT NULL,
    "major" TEXT NOT NULL,
    "gradYear" INTEGER NOT NULL,
    "gpa" DOUBLE PRECISION,
    "satScore" INTEGER,
    "linkedinUrl" TEXT,
    "bio" TEXT,
    "resumeUrl" TEXT,
    "headshotUrl" TEXT,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experience" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "period" TEXT NOT NULL,

    CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    "color" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "acceptanceRate" DOUBLE PRECISION,
    "aumValue" DOUBLE PRECISION,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "role" "ClubRole" NOT NULL DEFAULT 'GENERAL_MEMBER',
    "title" TEXT,

    CONSTRAINT "ClubMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineRound" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "PipelineRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationQuestion" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "wordLimit" INTEGER,

    CONSTRAINT "ApplicationQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "status" "AppStatus" NOT NULL DEFAULT 'DRAFTING',
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationAnswer" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "response" TEXT NOT NULL,

    CONSTRAINT "ApplicationAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "interviewerId" TEXT NOT NULL,
    "round" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAttendance" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewSlot" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "InterviewSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewBooking" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,

    CONSTRAINT "InterviewBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_computingId_key" ON "StudentProfile"("computingId");

-- CreateIndex
CREATE UNIQUE INDEX "Club_slug_key" ON "Club"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ClubMember_userId_clubId_key" ON "ClubMember"("userId", "clubId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_studentId_clubId_key" ON "Application"("studentId", "clubId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationAnswer_applicationId_questionId_key" ON "ApplicationAnswer"("applicationId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Evaluation_applicationId_interviewerId_round_key" ON "Evaluation"("applicationId", "interviewerId", "round");

-- CreateIndex
CREATE UNIQUE INDEX "EventAttendance_eventId_studentId_key" ON "EventAttendance"("eventId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewBooking_slotId_applicationId_key" ON "InterviewBooking"("slotId", "applicationId");

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubMember" ADD CONSTRAINT "ClubMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubMember" ADD CONSTRAINT "ClubMember_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineRound" ADD CONSTRAINT "PipelineRound_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationQuestion" ADD CONSTRAINT "ApplicationQuestion_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "PipelineRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationAnswer" ADD CONSTRAINT "ApplicationAnswer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationAnswer" ADD CONSTRAINT "ApplicationAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ApplicationQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "ClubMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAttendance" ADD CONSTRAINT "EventAttendance_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAttendance" ADD CONSTRAINT "EventAttendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewBooking" ADD CONSTRAINT "InterviewBooking_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "InterviewSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewBooking" ADD CONSTRAINT "InterviewBooking_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;


COMMIT;
