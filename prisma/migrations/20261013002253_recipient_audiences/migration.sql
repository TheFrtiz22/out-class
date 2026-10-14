BEGIN;
ALTER TABLE public."ClubAnnouncement" ADD COLUMN "audienceSpec" JSONB;
ALTER TABLE public."ClubAnnouncement" DROP CONSTRAINT "ClubAnnouncement_audience_check";
ALTER TABLE public."ClubAnnouncement" ADD CONSTRAINT "ClubAnnouncement_audience_check" CHECK (audience IN ('MEMBERS','APPLICANTS','CUSTOM'));
ALTER TABLE public."ClubAnnouncement" ADD CONSTRAINT "ClubAnnouncement_audience_spec_check" CHECK (
 (audience='CUSTOM' AND "audienceSpec" IS NOT NULL AND jsonb_typeof("audienceSpec")='object')
 OR (audience<>'CUSTOM' AND "audienceSpec" IS NULL)
);
CREATE TABLE public."RecipientGroup" (
 "id" TEXT PRIMARY KEY, "clubId" TEXT NOT NULL REFERENCES public."Club"(id) ON DELETE CASCADE,
 "name" TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
 "kind" TEXT NOT NULL CHECK (kind IN ('MANUAL','RULES')), "rules" JSONB,
 "revision" INTEGER NOT NULL DEFAULT 0 CHECK (revision>=0),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CHECK ((kind='MANUAL' AND rules IS NULL) OR (kind='RULES' AND rules IS NOT NULL AND jsonb_typeof(rules)='object')),
 UNIQUE (id,"clubId"), UNIQUE ("clubId",name)
);
CREATE UNIQUE INDEX "RecipientGroup_club_name_normalized" ON public."RecipientGroup" ("clubId", lower(name));
CREATE TABLE public."RecipientGroupEntry" (
 "groupId" TEXT NOT NULL, "clubId" TEXT NOT NULL, "userId" TEXT NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
 PRIMARY KEY ("groupId","userId"),
 FOREIGN KEY ("groupId","clubId") REFERENCES public."RecipientGroup"(id,"clubId") ON DELETE CASCADE
);
CREATE INDEX "RecipientGroupEntry_clubId_userId_idx" ON public."RecipientGroupEntry" ("clubId","userId");
ALTER TABLE public."RecipientGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RecipientGroupEntry" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."RecipientGroup",public."RecipientGroupEntry" FROM PUBLIC,anon,authenticated;
CREATE POLICY outclass_recipient_groups_server_only ON public."RecipientGroup" AS RESTRICTIVE FOR ALL TO PUBLIC USING(false) WITH CHECK(false);
CREATE POLICY outclass_recipient_entries_server_only ON public."RecipientGroupEntry" AS RESTRICTIVE FOR ALL TO PUBLIC USING(false) WITH CHECK(false);
-- Match existing bounded server ownership; preserve schema CREATE privilege state.
DO $migration$
DECLARE had_create BOOLEAN;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='outclass_production_app') THEN RETURN; END IF;
 had_create := has_schema_privilege('outclass_production_app','public','CREATE');
 IF NOT had_create THEN GRANT CREATE ON SCHEMA public TO outclass_production_app; END IF;
 ALTER TABLE public."RecipientGroup" OWNER TO outclass_production_app;
 ALTER TABLE public."RecipientGroupEntry" OWNER TO outclass_production_app;
 IF NOT had_create THEN REVOKE CREATE ON SCHEMA public FROM outclass_production_app; END IF;
END $migration$;
COMMIT;
