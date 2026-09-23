


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."AppRole" AS ENUM (
    'STUDENT',
    'CLUB_ADMIN'
);


ALTER TYPE "public"."AppRole" OWNER TO "postgres";


CREATE TYPE "public"."AppStatus" AS ENUM (
    'DRAFTING',
    'SUBMITTED',
    'IN_REVIEW',
    'INTERVIEWING',
    'ACCEPTED',
    'REJECTED',
    'WAITLISTED'
);


ALTER TYPE "public"."AppStatus" OWNER TO "postgres";


CREATE TYPE "public"."ClubRole" AS ENUM (
    'PRESIDENT',
    'RECRUITMENT_LEAD',
    'GENERAL_MEMBER'
);


ALTER TYPE "public"."ClubRole" OWNER TO "postgres";


CREATE TYPE "public"."QuestionType" AS ENUM (
    'ESSAY',
    'FILE_UPLOAD',
    'MULTIPLE_CHOICE'
);


ALTER TYPE "public"."QuestionType" OWNER TO "postgres";


CREATE TYPE "public"."app_role" AS ENUM (
    'STUDENT',
    'CLUB_ADMIN'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."app_status" AS ENUM (
    'DRAFTING',
    'SUBMITTED',
    'IN_REVIEW',
    'INTERVIEWING',
    'ACCEPTED',
    'REJECTED',
    'WAITLISTED'
);


ALTER TYPE "public"."app_status" OWNER TO "postgres";


CREATE TYPE "public"."club_role" AS ENUM (
    'PRESIDENT',
    'RECRUITMENT_LEAD',
    'GENERAL_MEMBER'
);


ALTER TYPE "public"."club_role" OWNER TO "postgres";


CREATE TYPE "public"."question_type" AS ENUM (
    'ESSAY',
    'FILE_UPLOAD',
    'MULTIPLE_CHOICE'
);


ALTER TYPE "public"."question_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_catalog'
    AS $$
begin
  if new.id is null then
    return new;
  end if;

  insert into public."User"(id, email, role, "createdAt")
  values (
    new.id,
    lower(new.email),
    'STUDENT',
    coalesce(new.created_at, now())
  )
  on conflict (id) do update
    set email = excluded.email,
        "createdAt" = coalesce(public."User"."createdAt", excluded."createdAt");

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."Application" (
    "id" "text" NOT NULL,
    "studentId" "text" NOT NULL,
    "clubId" "text" NOT NULL,
    "roundId" "text" NOT NULL,
    "status" "public"."AppStatus" DEFAULT 'DRAFTING'::"public"."AppStatus" NOT NULL,
    "submittedAt" timestamp(3) without time zone
);


ALTER TABLE "public"."Application" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ApplicationAnswer" (
    "id" "text" NOT NULL,
    "applicationId" "text" NOT NULL,
    "questionId" "text" NOT NULL,
    "response" "text" NOT NULL
);


ALTER TABLE "public"."ApplicationAnswer" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ApplicationQuestion" (
    "id" "text" NOT NULL,
    "clubId" "text" NOT NULL,
    "prompt" "text" NOT NULL,
    "type" "public"."QuestionType" NOT NULL,
    "required" boolean DEFAULT true NOT NULL,
    "wordLimit" integer
);


ALTER TABLE "public"."ApplicationQuestion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Club" (
    "id" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "tagline" "text" NOT NULL,
    "description" "text" NOT NULL,
    "logoUrl" "text",
    "bannerUrl" "text",
    "color" "text" NOT NULL,
    "category" "text" NOT NULL,
    "acceptanceRate" double precision,
    "aumValue" double precision
);


ALTER TABLE "public"."Club" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ClubMember" (
    "id" "text" NOT NULL,
    "userId" "text" NOT NULL,
    "clubId" "text" NOT NULL,
    "role" "public"."ClubRole" DEFAULT 'GENERAL_MEMBER'::"public"."ClubRole" NOT NULL,
    "title" "text"
);


ALTER TABLE "public"."ClubMember" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Evaluation" (
    "id" "text" NOT NULL,
    "applicationId" "text" NOT NULL,
    "interviewerId" "text" NOT NULL,
    "round" "text" NOT NULL,
    "score" double precision NOT NULL,
    "notes" "text",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."Evaluation" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Event" (
    "id" "text" NOT NULL,
    "clubId" "text" NOT NULL,
    "title" "text" NOT NULL,
    "date" timestamp(3) without time zone NOT NULL,
    "location" "text" NOT NULL,
    "description" "text",
    "isPublic" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."Event" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."EventAttendance" (
    "id" "text" NOT NULL,
    "eventId" "text" NOT NULL,
    "studentId" "text" NOT NULL,
    "checkedInAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."EventAttendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Experience" (
    "id" "text" NOT NULL,
    "studentProfileId" "text" NOT NULL,
    "title" "text" NOT NULL,
    "subtitle" "text" NOT NULL,
    "period" "text" NOT NULL
);


ALTER TABLE "public"."Experience" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."InterviewBooking" (
    "id" "text" NOT NULL,
    "slotId" "text" NOT NULL,
    "applicationId" "text" NOT NULL
);


ALTER TABLE "public"."InterviewBooking" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."InterviewSlot" (
    "id" "text" NOT NULL,
    "clubId" "text" NOT NULL,
    "startTime" timestamp(3) without time zone NOT NULL,
    "endTime" timestamp(3) without time zone NOT NULL,
    "location" "text" NOT NULL,
    "capacity" integer DEFAULT 1 NOT NULL
);


ALTER TABLE "public"."InterviewSlot" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."PipelineRound" (
    "id" "text" NOT NULL,
    "clubId" "text" NOT NULL,
    "name" "text" NOT NULL,
    "order" integer NOT NULL
);


ALTER TABLE "public"."PipelineRound" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."StudentProfile" (
    "id" "text" NOT NULL,
    "userId" "text" NOT NULL,
    "firstName" "text" NOT NULL,
    "lastName" "text" NOT NULL,
    "computingId" "text" NOT NULL,
    "major" "text" NOT NULL,
    "gradYear" integer NOT NULL,
    "gpa" double precision,
    "satScore" integer,
    "linkedinUrl" "text",
    "bio" "text",
    "resumeUrl" "text",
    "headshotUrl" "text"
);


ALTER TABLE "public"."StudentProfile" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."User" (
    "id" "text" NOT NULL,
    "email" "text" NOT NULL,
    "passwordHash" "text",
    "role" "public"."AppRole" DEFAULT 'STUDENT'::"public"."AppRole" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "public"."User" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ApplicationAnswer"
    ADD CONSTRAINT "ApplicationAnswer_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ApplicationQuestion"
    ADD CONSTRAINT "ApplicationQuestion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Application"
    ADD CONSTRAINT "Application_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ClubMember"
    ADD CONSTRAINT "ClubMember_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Club"
    ADD CONSTRAINT "Club_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Evaluation"
    ADD CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."EventAttendance"
    ADD CONSTRAINT "EventAttendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Event"
    ADD CONSTRAINT "Event_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Experience"
    ADD CONSTRAINT "Experience_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."InterviewBooking"
    ADD CONSTRAINT "InterviewBooking_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."InterviewSlot"
    ADD CONSTRAINT "InterviewSlot_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."PipelineRound"
    ADD CONSTRAINT "PipelineRound_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."StudentProfile"
    ADD CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "ApplicationAnswer_applicationId_questionId_key" ON "public"."ApplicationAnswer" USING "btree" ("applicationId", "questionId");



CREATE UNIQUE INDEX "Application_studentId_clubId_key" ON "public"."Application" USING "btree" ("studentId", "clubId");



CREATE UNIQUE INDEX "ClubMember_userId_clubId_key" ON "public"."ClubMember" USING "btree" ("userId", "clubId");



CREATE UNIQUE INDEX "Club_slug_key" ON "public"."Club" USING "btree" ("slug");



CREATE UNIQUE INDEX "Evaluation_applicationId_interviewerId_round_key" ON "public"."Evaluation" USING "btree" ("applicationId", "interviewerId", "round");



CREATE UNIQUE INDEX "EventAttendance_eventId_studentId_key" ON "public"."EventAttendance" USING "btree" ("eventId", "studentId");



CREATE UNIQUE INDEX "InterviewBooking_slotId_applicationId_key" ON "public"."InterviewBooking" USING "btree" ("slotId", "applicationId");



CREATE UNIQUE INDEX "StudentProfile_computingId_key" ON "public"."StudentProfile" USING "btree" ("computingId");



CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "public"."StudentProfile" USING "btree" ("userId");



CREATE UNIQUE INDEX "User_email_key" ON "public"."User" USING "btree" ("email");



ALTER TABLE ONLY "public"."ApplicationAnswer"
    ADD CONSTRAINT "ApplicationAnswer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "public"."Application"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ApplicationAnswer"
    ADD CONSTRAINT "ApplicationAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."ApplicationQuestion"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ApplicationQuestion"
    ADD CONSTRAINT "ApplicationQuestion_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Application"
    ADD CONSTRAINT "Application_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Application"
    ADD CONSTRAINT "Application_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "public"."PipelineRound"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."Application"
    ADD CONSTRAINT "Application_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ClubMember"
    ADD CONSTRAINT "ClubMember_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ClubMember"
    ADD CONSTRAINT "ClubMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Evaluation"
    ADD CONSTRAINT "Evaluation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "public"."Application"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Evaluation"
    ADD CONSTRAINT "Evaluation_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "public"."ClubMember"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."EventAttendance"
    ADD CONSTRAINT "EventAttendance_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."Event"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."EventAttendance"
    ADD CONSTRAINT "EventAttendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Event"
    ADD CONSTRAINT "Event_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Experience"
    ADD CONSTRAINT "Experience_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "public"."StudentProfile"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."InterviewBooking"
    ADD CONSTRAINT "InterviewBooking_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "public"."Application"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."InterviewBooking"
    ADD CONSTRAINT "InterviewBooking_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "public"."InterviewSlot"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PipelineRound"
    ADD CONSTRAINT "PipelineRound_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "public"."Club"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."StudentProfile"
    ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE "public"."Application" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ApplicationAnswer" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ApplicationQuestion" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Club" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ClubMember" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Evaluation" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Event" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."EventAttendance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Experience" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."InterviewBooking" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."InterviewSlot" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."StudentProfile" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."User" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON TABLE "public"."Application" TO "anon";
GRANT ALL ON TABLE "public"."Application" TO "authenticated";
GRANT ALL ON TABLE "public"."Application" TO "service_role";



GRANT ALL ON TABLE "public"."ApplicationAnswer" TO "anon";
GRANT ALL ON TABLE "public"."ApplicationAnswer" TO "authenticated";
GRANT ALL ON TABLE "public"."ApplicationAnswer" TO "service_role";



GRANT ALL ON TABLE "public"."ApplicationQuestion" TO "anon";
GRANT ALL ON TABLE "public"."ApplicationQuestion" TO "authenticated";
GRANT ALL ON TABLE "public"."ApplicationQuestion" TO "service_role";



GRANT ALL ON TABLE "public"."Club" TO "anon";
GRANT ALL ON TABLE "public"."Club" TO "authenticated";
GRANT ALL ON TABLE "public"."Club" TO "service_role";



GRANT ALL ON TABLE "public"."ClubMember" TO "anon";
GRANT ALL ON TABLE "public"."ClubMember" TO "authenticated";
GRANT ALL ON TABLE "public"."ClubMember" TO "service_role";



GRANT ALL ON TABLE "public"."Evaluation" TO "anon";
GRANT ALL ON TABLE "public"."Evaluation" TO "authenticated";
GRANT ALL ON TABLE "public"."Evaluation" TO "service_role";



GRANT ALL ON TABLE "public"."Event" TO "anon";
GRANT ALL ON TABLE "public"."Event" TO "authenticated";
GRANT ALL ON TABLE "public"."Event" TO "service_role";



GRANT ALL ON TABLE "public"."EventAttendance" TO "anon";
GRANT ALL ON TABLE "public"."EventAttendance" TO "authenticated";
GRANT ALL ON TABLE "public"."EventAttendance" TO "service_role";



GRANT ALL ON TABLE "public"."Experience" TO "anon";
GRANT ALL ON TABLE "public"."Experience" TO "authenticated";
GRANT ALL ON TABLE "public"."Experience" TO "service_role";



GRANT ALL ON TABLE "public"."InterviewBooking" TO "anon";
GRANT ALL ON TABLE "public"."InterviewBooking" TO "authenticated";
GRANT ALL ON TABLE "public"."InterviewBooking" TO "service_role";



GRANT ALL ON TABLE "public"."InterviewSlot" TO "anon";
GRANT ALL ON TABLE "public"."InterviewSlot" TO "authenticated";
GRANT ALL ON TABLE "public"."InterviewSlot" TO "service_role";



GRANT ALL ON TABLE "public"."PipelineRound" TO "anon";
GRANT ALL ON TABLE "public"."PipelineRound" TO "authenticated";
GRANT ALL ON TABLE "public"."PipelineRound" TO "service_role";



GRANT ALL ON TABLE "public"."StudentProfile" TO "anon";
GRANT ALL ON TABLE "public"."StudentProfile" TO "authenticated";
GRANT ALL ON TABLE "public"."StudentProfile" TO "service_role";



GRANT ALL ON TABLE "public"."User" TO "anon";
GRANT ALL ON TABLE "public"."User" TO "authenticated";
GRANT ALL ON TABLE "public"."User" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







