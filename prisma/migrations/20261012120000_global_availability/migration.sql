BEGIN;
-- Additive only: existing rooms, panels, slots and bookings are unchanged.
-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "interviewerEligibilityRevision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "interviewerRoles" "MembershipAccessRole"[] DEFAULT ARRAY['INTERVIEWER']::"MembershipAccessRole"[];

-- AlterTable
ALTER TABLE "ClubMember" ADD COLUMN     "interviewerEligible" BOOLEAN;

-- CreateTable
CREATE TABLE "UserAvailability" (
    "userId" TEXT NOT NULL,
    "schedule" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAvailability_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "InterviewRoundParticipation" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "eligibilityOverride" BOOLEAN,
    "availability" JSONB,
    "confirmedAt" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewRoundParticipation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterviewRoundParticipation_clubId_roundId_confirmedAt_idx" ON "InterviewRoundParticipation"("clubId", "roundId", "confirmedAt");

-- CreateIndex
CREATE INDEX "InterviewRoundParticipation_roundId_idx" ON "InterviewRoundParticipation"("roundId");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewRoundParticipation_memberId_roundId_key" ON "InterviewRoundParticipation"("memberId", "roundId");

-- CreateIndex
CREATE UNIQUE INDEX "ClubMember_id_clubId_key" ON "ClubMember"("id", "clubId");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineRound_id_clubId_key" ON "PipelineRound"("id", "clubId");

-- AddForeignKey
ALTER TABLE "UserAvailability" ADD CONSTRAINT "UserAvailability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewRoundParticipation" ADD CONSTRAINT "InterviewRoundParticipation_memberId_clubId_fkey" FOREIGN KEY ("memberId", "clubId") REFERENCES "ClubMember"("id", "clubId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewRoundParticipation" ADD CONSTRAINT "InterviewRoundParticipation_roundId_clubId_fkey" FOREIGN KEY ("roundId", "clubId") REFERENCES "PipelineRound"("id", "clubId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Club" ALTER COLUMN "interviewerRoles" SET NOT NULL;
ALTER TABLE "Club" ADD CONSTRAINT "Club_interviewer_roles_check" CHECK (
  cardinality("interviewerRoles") <= 5 AND array_position("interviewerRoles", NULL) IS NULL AND "interviewerEligibilityRevision" >= 0
);

CREATE FUNCTION public.outclass_valid_availability_ranges(ranges JSONB) RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE r JSONB; a INTEGER; b INTEGER; previous_end INTEGER := -1;
BEGIN
  IF jsonb_typeof(ranges) IS DISTINCT FROM 'array' OR jsonb_array_length(ranges) > 48 THEN RETURN FALSE; END IF;
  FOR r IN SELECT value FROM jsonb_array_elements(ranges) LOOP
    IF jsonb_typeof(r) IS DISTINCT FROM 'array' OR jsonb_array_length(r) <> 2
       OR jsonb_typeof(r->0) IS DISTINCT FROM 'number' OR jsonb_typeof(r->1) IS DISTINCT FROM 'number'
       OR r->>0 !~ '^[0-9]+$' OR r->>1 !~ '^[0-9]+$' THEN RETURN FALSE; END IF;
    a := (r->>0)::INTEGER; b := (r->>1)::INTEGER;
    IF a < 0 OR b > 1440 OR a >= b OR a % 15 <> 0 OR b % 15 <> 0 OR a < previous_end THEN RETURN FALSE; END IF;
    previous_end := b;
  END LOOP;
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN RETURN FALSE;
END $$;

CREATE FUNCTION public.outclass_valid_availability(schedule JSONB) RETURNS BOOLEAN LANGUAGE plpgsql STABLE AS $$
DECLARE day JSONB; exception RECORD;
BEGIN
  IF jsonb_typeof(schedule) IS DISTINCT FROM 'object'
     OR (SELECT count(*) FROM jsonb_object_keys(schedule)) <> 4
     OR jsonb_typeof(schedule->'timezone') IS DISTINCT FROM 'string'
     OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=schedule->>'timezone')
     OR jsonb_typeof(schedule->'weeklySubmitted') IS DISTINCT FROM 'boolean'
     OR jsonb_typeof(schedule->'weekly') IS DISTINCT FROM 'array' OR jsonb_array_length(schedule->'weekly') <> 7
     OR jsonb_typeof(schedule->'exceptions') IS DISTINCT FROM 'object'
     OR (SELECT count(*) FROM jsonb_object_keys(schedule->'exceptions')) > 400 THEN RETURN FALSE; END IF;
  FOR day IN SELECT value FROM jsonb_array_elements(schedule->'weekly') LOOP
    IF NOT public.outclass_valid_availability_ranges(day) THEN RETURN FALSE; END IF;
  END LOOP;
  FOR exception IN SELECT key, value FROM jsonb_each(schedule->'exceptions') LOOP
    IF exception.key !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR exception.key < '1900-01-01' OR exception.key > '2200-12-31'
       OR to_char(exception.key::DATE, 'YYYY-MM-DD') <> exception.key
       OR NOT public.outclass_valid_availability_ranges(exception.value) THEN RETURN FALSE; END IF;
  END LOOP;
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN RETURN FALSE;
END $$;

ALTER TABLE "UserAvailability" ADD CONSTRAINT "UserAvailability_schedule_check" CHECK (public.outclass_valid_availability(schedule) AND revision > 0);
ALTER TABLE "InterviewRoundParticipation" ADD CONSTRAINT "InterviewRoundParticipation_snapshot_check" CHECK (
  revision > 0 AND (availability IS NULL OR public.outclass_valid_availability(availability))
  AND ("confirmedAt" IS NULL OR (availability IS NOT NULL AND ((availability->>'weeklySubmitted')::BOOLEAN OR availability->'exceptions' <> '{}'::JSONB)))
);

-- Match OutClass's server-only access model. RLS plus revoked browser grants
-- protects provider Data APIs; live authorization remains in server actions.
DO $$ DECLARE t TEXT; r TEXT; had_create BOOLEAN; BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='outclass_production_app') THEN
    had_create := has_schema_privilege('outclass_production_app','public','CREATE');
    IF NOT had_create THEN GRANT CREATE ON SCHEMA public TO outclass_production_app; END IF;
  END IF;
  FOREACH t IN ARRAY ARRAY['UserAvailability','InterviewRoundParticipation'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', t);
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON public.%I FROM %I', t,r); END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='outclass_production_app') THEN EXECUTE format('ALTER TABLE public.%I OWNER TO outclass_production_app',t); END IF;
  END LOOP;
  IF had_create = FALSE THEN REVOKE CREATE ON SCHEMA public FROM outclass_production_app; END IF;
END $$;
REVOKE ALL ON FUNCTION public.outclass_valid_availability_ranges(JSONB), public.outclass_valid_availability(JSONB) FROM PUBLIC;
DO $$ DECLARE r TEXT; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION public.outclass_valid_availability_ranges(JSONB), public.outclass_valid_availability(JSONB) FROM %I',r);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='outclass_production_app') THEN
    GRANT EXECUTE ON FUNCTION public.outclass_valid_availability_ranges(JSONB), public.outclass_valid_availability(JSONB) TO outclass_production_app;
  END IF;
END $$;
COMMIT;
