SET local check_function_bodies = off;

CREATE TABLE "public"."ApplicationAnswer" (
  "id"            text NOT NULL,
  "applicationId" text NOT NULL,
  "questionId"    text NOT NULL,
  "response"      text NOT NULL,
  CONSTRAINT "ApplicationAnswer_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."ApplicationAnswer"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."ApplicationQuestion" (
  "id"        text    NOT NULL,
  "clubId"    text    NOT NULL,
  "prompt"    text    NOT NULL,
  "required"  boolean NOT NULL DEFAULT true,
  "wordLimit" integer,
  CONSTRAINT "ApplicationQuestion_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."ApplicationQuestion"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."Application" (
  "id"          text                           NOT NULL,
  "studentId"   text                           NOT NULL,
  "clubId"      text                           NOT NULL,
  "roundId"     text                           NOT NULL,
  "submittedAt" timestamp(3) without time zone,
  CONSTRAINT "Application_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."Application"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."ClubMember" (
  "id"     text NOT NULL,
  "userId" text NOT NULL,
  "clubId" text NOT NULL,
  "title"  text,
  CONSTRAINT "ClubMember_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."ClubMember"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."Club" (
  "id"             text             NOT NULL,
  "slug"           text             NOT NULL,
  "name"           text             NOT NULL,
  "tagline"        text             NOT NULL,
  "description"    text             NOT NULL,
  "logoUrl"        text,
  "bannerUrl"      text,
  "color"          text             NOT NULL,
  "category"       text             NOT NULL,
  "acceptanceRate" double precision,
  "aumValue"       double precision,
  CONSTRAINT "Club_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."Club"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."Evaluation" (
  "id"            text                           NOT NULL,
  "applicationId" text                           NOT NULL,
  "interviewerId" text                           NOT NULL,
  "round"         text                           NOT NULL,
  "score"         double precision               NOT NULL,
  "notes"         text,
  "createdAt"     timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Evaluation_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."Evaluation"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."EventAttendance" (
  "id"          text                           NOT NULL,
  "eventId"     text                           NOT NULL,
  "studentId"   text                           NOT NULL,
  "checkedInAt" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventAttendance_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."EventAttendance"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."Event" (
  "id"          text                           NOT NULL,
  "clubId"      text                           NOT NULL,
  "title"       text                           NOT NULL,
  "date"        timestamp(3) without time zone NOT NULL,
  "location"    text                           NOT NULL,
  "description" text,
  "isPublic"    boolean                        NOT NULL DEFAULT true,
  CONSTRAINT "Event_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."Event"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."Experience" (
  "id"               text NOT NULL,
  "studentProfileId" text NOT NULL,
  "title"            text NOT NULL,
  "subtitle"         text NOT NULL,
  "period"           text NOT NULL,
  CONSTRAINT "Experience_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."Experience"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."InterviewBooking" (
  "id"            text NOT NULL,
  "slotId"        text NOT NULL,
  "applicationId" text NOT NULL,
  CONSTRAINT "InterviewBooking_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."InterviewBooking"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."InterviewSlot" (
  "id"        text                           NOT NULL,
  "clubId"    text                           NOT NULL,
  "startTime" timestamp(3) without time zone NOT NULL,
  "endTime"   timestamp(3) without time zone NOT NULL,
  "location"  text                           NOT NULL,
  "capacity"  integer                        NOT NULL DEFAULT 1,
  CONSTRAINT "InterviewSlot_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."InterviewSlot"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."PipelineRound" (
  "id"     text    NOT NULL,
  "clubId" text    NOT NULL,
  "name"   text    NOT NULL,
  "order"  integer NOT NULL,
  CONSTRAINT "PipelineRound_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."StudentProfile" (
  "id"          text             NOT NULL,
  "userId"      text             NOT NULL,
  "firstName"   text             NOT NULL,
  "lastName"    text             NOT NULL,
  "computingId" text             NOT NULL,
  "major"       text             NOT NULL,
  "gradYear"    integer          NOT NULL,
  "gpa"         double precision,
  "satScore"    integer,
  "linkedinUrl" text,
  "bio"         text,
  "resumeUrl"   text,
  "headshotUrl" text,
  CONSTRAINT "StudentProfile_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."StudentProfile"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."User" (
  "id"           text                           NOT NULL,
  "email"        text                           NOT NULL,
  "passwordHash" text,
  "createdAt"    timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."User"
  ENABLE ROW LEVEL SECURITY;

CREATE TYPE "public"."AppRole" AS ENUM (
  'STUDENT',
  'CLUB_ADMIN'
);

ALTER TABLE "public"."User"
  ADD COLUMN "role" public."AppRole" NOT NULL DEFAULT 'STUDENT'::public."AppRole";

CREATE TYPE "public"."AppStatus" AS ENUM (
  'DRAFTING',
  'SUBMITTED',
  'IN_REVIEW',
  'INTERVIEWING',
  'ACCEPTED',
  'REJECTED',
  'WAITLISTED'
);

ALTER TABLE "public"."Application"
  ADD COLUMN "status" public."AppStatus" NOT NULL DEFAULT 'DRAFTING'::public."AppStatus";

CREATE TYPE "public"."ClubRole" AS ENUM (
  'PRESIDENT',
  'RECRUITMENT_LEAD',
  'GENERAL_MEMBER'
);

ALTER TABLE "public"."ClubMember"
  ADD COLUMN "role" public."ClubRole" NOT NULL DEFAULT 'GENERAL_MEMBER'::public."ClubRole";

CREATE TYPE "public"."QuestionType" AS ENUM (
  'ESSAY',
  'FILE_UPLOAD',
  'MULTIPLE_CHOICE'
);

ALTER TABLE "public"."ApplicationQuestion"
  ADD COLUMN "type" public."QuestionType" NOT NULL;

CREATE TYPE "public"."app_role" AS ENUM (
  'STUDENT',
  'CLUB_ADMIN'
);

CREATE TYPE "public"."app_status" AS ENUM (
  'DRAFTING',
  'SUBMITTED',
  'IN_REVIEW',
  'INTERVIEWING',
  'ACCEPTED',
  'REJECTED',
  'WAITLISTED'
);

CREATE TYPE "public"."club_role" AS ENUM (
  'PRESIDENT',
  'RECRUITMENT_LEAD',
  'GENERAL_MEMBER'
);

CREATE TYPE "public"."question_type" AS ENUM (
  'ESSAY',
  'FILE_UPLOAD',
  'MULTIPLE_CHOICE'
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'auth', 'pg_catalog'
  AS $function$
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
$function$;

ALTER TABLE "public"."ApplicationAnswer"
  ADD CONSTRAINT "ApplicationAnswer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES public."Application"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."ApplicationAnswer"
  ADD CONSTRAINT "ApplicationAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES public."ApplicationQuestion"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."Application"
  ADD CONSTRAINT "Application_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES public."Club"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."ApplicationQuestion"
  ADD CONSTRAINT "ApplicationQuestion_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES public."Club"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."ClubMember"
  ADD CONSTRAINT "ClubMember_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES public."Club"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."Evaluation"
  ADD CONSTRAINT "Evaluation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES public."Application"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."Evaluation"
  ADD CONSTRAINT "Evaluation_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES public."ClubMember"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."Event"
  ADD CONSTRAINT "Event_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES public."Club"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."EventAttendance"
  ADD CONSTRAINT "EventAttendance_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES public."Event"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."InterviewBooking"
  ADD CONSTRAINT "InterviewBooking_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES public."Application"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."InterviewBooking"
  ADD CONSTRAINT "InterviewBooking_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES public."InterviewSlot"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."PipelineRound"
  ADD CONSTRAINT "PipelineRound_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES public."Club"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."Application"
  ADD CONSTRAINT "Application_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES public."PipelineRound"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."Experience"
  ADD CONSTRAINT "Experience_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES public."StudentProfile"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."Application"
  ADD CONSTRAINT "Application_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."ClubMember"
  ADD CONSTRAINT "ClubMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."EventAttendance"
  ADD CONSTRAINT "EventAttendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."StudentProfile"
  ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE UNIQUE INDEX "ApplicationAnswer_applicationId_questionId_key" ON public."ApplicationAnswer" USING btree ("applicationId", "questionId");

CREATE UNIQUE INDEX "Application_studentId_clubId_key" ON public."Application" USING btree ("studentId", "clubId");

CREATE UNIQUE INDEX "ClubMember_userId_clubId_key" ON public."ClubMember" USING btree ("userId", "clubId");

CREATE UNIQUE INDEX "Club_slug_key" ON public."Club" USING btree (slug);

CREATE UNIQUE INDEX "Evaluation_applicationId_interviewerId_round_key" ON public."Evaluation" USING btree ("applicationId", "interviewerId", round);

CREATE UNIQUE INDEX "EventAttendance_eventId_studentId_key" ON public."EventAttendance" USING btree ("eventId", "studentId");

CREATE UNIQUE INDEX "InterviewBooking_slotId_applicationId_key" ON public."InterviewBooking" USING btree ("slotId", "applicationId");

CREATE UNIQUE INDEX "StudentProfile_computingId_key" ON public."StudentProfile" USING btree ("computingId");

CREATE UNIQUE INDEX "StudentProfile_userId_key" ON public."StudentProfile" USING btree ("userId");

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "club_assets_delete_owner_only" ON "storage"."objects"
  FOR DELETE
  TO PUBLIC
  USING
    (((bucket_id = 'club-assets'::text) AND (auth.role() = 'authenticated'::text) AND (array_length(storage.foldername(name), 1) >= 1) AND ((storage.foldername(name))[1] =
    (auth.uid())::text)));

CREATE POLICY "club_assets_insert_owner_only" ON "storage"."objects"
  FOR INSERT
  TO PUBLIC
  WITH
    CHECK
    (((bucket_id = 'club-assets'::text) AND (auth.role() = 'authenticated'::text) AND (array_length(storage.foldername(name), 1) >= 1) AND ((storage.foldername(name))[1] =
    (auth.uid())::text)));

CREATE POLICY "club_assets_select_public" ON "storage"."objects"
  FOR SELECT
  TO PUBLIC
  USING ((bucket_id = 'club-assets'::text));

CREATE POLICY "club_assets_update_owner_only" ON "storage"."objects"
  FOR UPDATE
  TO PUBLIC
  USING
    (((bucket_id = 'club-assets'::text) AND (auth.role() = 'authenticated'::text) AND (array_length(storage.foldername(name), 1) >= 1) AND ((storage.foldername(name))[1] =
    (auth.uid())::text)))
  WITH
    CHECK
    (((bucket_id = 'club-assets'::text) AND (auth.role() = 'authenticated'::text) AND (array_length(storage.foldername(name), 1) >= 1) AND ((storage.foldername(name))[1] =
    (auth.uid())::text)));

CREATE POLICY "headshots_delete_owner_only" ON "storage"."objects"
  FOR DELETE
  TO PUBLIC
  USING
    (((bucket_id = 'headshots'::text) AND (auth.role() = 'authenticated'::text) AND (array_length(storage.foldername(name), 1) >= 1) AND ((storage.foldername(name))[1] =
    (auth.uid())::text)));

CREATE POLICY "headshots_insert_owner_only" ON "storage"."objects"
  FOR INSERT
  TO PUBLIC
  WITH
    CHECK
    (((bucket_id = 'headshots'::text) AND (auth.role() = 'authenticated'::text) AND (array_length(storage.foldername(name), 1) >= 1) AND ((storage.foldername(name))[1] =
    (auth.uid())::text)));

CREATE POLICY "headshots_select_public" ON "storage"."objects"
  FOR SELECT
  TO PUBLIC
  USING ((bucket_id = 'headshots'::text));

CREATE POLICY "headshots_update_owner_only" ON "storage"."objects"
  FOR UPDATE
  TO PUBLIC
  USING
    (((bucket_id = 'headshots'::text) AND (auth.role() = 'authenticated'::text) AND (array_length(storage.foldername(name), 1) >= 1) AND ((storage.foldername(name))[1] =
    (auth.uid())::text)))
  WITH
    CHECK
    (((bucket_id = 'headshots'::text) AND (auth.role() = 'authenticated'::text) AND (array_length(storage.foldername(name), 1) >= 1) AND ((storage.foldername(name))[1] =
    (auth.uid())::text)));

CREATE POLICY "resumes_delete_owner_only" ON "storage"."objects"
  FOR DELETE
  TO PUBLIC
  USING
    (((bucket_id = 'resumes'::text) AND (auth.role() = 'authenticated'::text) AND (array_length(storage.foldername(name), 1) >= 1) AND ((storage.foldername(name))[1] =
    (auth.uid())::text)));

CREATE POLICY "resumes_insert_owner_only" ON "storage"."objects"
  FOR INSERT
  TO PUBLIC
  WITH
    CHECK
    (((bucket_id = 'resumes'::text) AND (auth.role() = 'authenticated'::text) AND (array_length(storage.foldername(name), 1) >= 1) AND ((storage.foldername(name))[1] =
    (auth.uid())::text)));

CREATE POLICY "resumes_select_public" ON "storage"."objects"
  FOR SELECT
  TO PUBLIC
  USING ((bucket_id = 'resumes'::text));

CREATE POLICY "resumes_update_owner_only" ON "storage"."objects"
  FOR UPDATE
  TO PUBLIC
  USING
    (((bucket_id = 'resumes'::text) AND (auth.role() = 'authenticated'::text) AND (array_length(storage.foldername(name), 1) >= 1) AND ((storage.foldername(name))[1] =
    (auth.uid())::text)))
  WITH
    CHECK
    (((bucket_id = 'resumes'::text) AND (auth.role() = 'authenticated'::text) AND (array_length(storage.foldername(name), 1) >= 1) AND ((storage.foldername(name))[1] =
    (auth.uid())::text)));

GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."Application" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."ApplicationAnswer" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."ApplicationQuestion" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."Club" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."ClubMember" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."Evaluation" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."Event" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."EventAttendance" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."Experience" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."InterviewBooking" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."InterviewSlot" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."PipelineRound" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."StudentProfile" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."User" TO "anon", "authenticated", "postgres", "service_role";

GRANT USAGE ON TYPE "public"."AppRole" TO "postgres";

GRANT USAGE ON TYPE "public"."AppStatus" TO "postgres";

GRANT USAGE ON TYPE "public"."ClubRole" TO "postgres";

GRANT USAGE ON TYPE "public"."QuestionType" TO "postgres";

GRANT USAGE ON TYPE "public"."app_role" TO "postgres";

GRANT USAGE ON TYPE "public"."app_status" TO "postgres";

GRANT USAGE ON TYPE "public"."club_role" TO "postgres";

GRANT USAGE ON TYPE "public"."question_type" TO "postgres";

