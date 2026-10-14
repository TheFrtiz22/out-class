BEGIN;
CREATE TABLE public."RecruitmentCycle" (
 id TEXT PRIMARY KEY,"clubId" TEXT NOT NULL REFERENCES public."Club"(id) ON DELETE CASCADE,
 name TEXT NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 100),"archivedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(id,"clubId"),UNIQUE("clubId",name)
);
ALTER TABLE public."Application" ADD COLUMN "recruitmentCycleId" TEXT;
ALTER TABLE public."Application" ADD CONSTRAINT "Application_recruitmentCycleId_clubId_fkey" FOREIGN KEY("recruitmentCycleId","clubId") REFERENCES public."RecruitmentCycle"(id,"clubId") ON DELETE RESTRICT;
ALTER TABLE public."RecruitmentCycle" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."RecruitmentCycle" FROM PUBLIC,anon,authenticated;
CREATE POLICY outclass_recruitment_cycle_server_only ON public."RecruitmentCycle" AS RESTRICTIVE FOR ALL TO PUBLIC USING(false) WITH CHECK(false);
DO $migration$
DECLARE had_create BOOLEAN;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='outclass_production_app') THEN RETURN; END IF;
 had_create := has_schema_privilege('outclass_production_app','public','CREATE');
 IF NOT had_create THEN GRANT CREATE ON SCHEMA public TO outclass_production_app; END IF;
 ALTER TABLE public."RecruitmentCycle" OWNER TO outclass_production_app;
 IF NOT had_create THEN REVOKE CREATE ON SCHEMA public FROM outclass_production_app; END IF;
END $migration$;
COMMIT;
