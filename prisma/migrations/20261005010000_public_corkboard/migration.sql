BEGIN;
CREATE TABLE "EventFlyer" (
 id TEXT PRIMARY KEY, "eventId" TEXT NOT NULL REFERENCES "Event"(id) ON DELETE CASCADE,
 path TEXT NOT NULL UNIQUE, mime TEXT NOT NULL CHECK(mime IN ('image/jpeg','image/png','image/webp')),
 size INTEGER NOT NULL CHECK(size>0 AND size<=5242880), "createdBy" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "EventPublication" (
 "eventId" TEXT PRIMARY KEY REFERENCES "Event"(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PENDING','PUBLISHED','REJECTED','CANCELLED','ARCHIVED')),
 category TEXT NOT NULL DEFAULT 'Social' CHECK(category IN ('Academic','Professional','Social','Sports','Arts','Service','Other')),
 contact TEXT NOT NULL DEFAULT '', "rsvpEnabled" BOOLEAN NOT NULL DEFAULT true,
 "rsvpRequired" BOOLEAN NOT NULL DEFAULT false, capacity INTEGER CHECK(capacity>0 AND capacity<=100000),
 "rsvpDeadline" TIMESTAMP(3), template TEXT NOT NULL DEFAULT 'academic' CHECK(template IN ('academic','orange','navy','sage')),
 "flyerId" TEXT UNIQUE REFERENCES "EventFlyer"(id) ON DELETE RESTRICT,
 "submittedAt" TIMESTAMP(3), "submittedBy" TEXT, "reviewedAt" TIMESTAMP(3), "reviewedBy" TEXT,
 "rejectionReason" TEXT, "approvedRevision" INTEGER, "publishedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CHECK(NOT "rsvpRequired" OR "rsvpEnabled"),
 CHECK(status<>'PENDING' OR ("submittedAt" IS NOT NULL AND "submittedBy" IS NOT NULL)),
 CHECK(status<>'REJECTED' OR length(trim(COALESCE("rejectionReason", '')))>0),
 CHECK(status<>'PUBLISHED' OR ("approvedRevision" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "reviewedBy" IS NOT NULL AND "publishedAt" IS NOT NULL))
);
CREATE TABLE "EventRsvp" (
 "eventId" TEXT NOT NULL REFERENCES "Event"(id) ON DELETE CASCADE,
 "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY("eventId","userId")
);
CREATE INDEX "AuditLog_targetId_action_createdAt_idx" ON "AuditLog"("targetId",action,"createdAt");
CREATE INDEX "EventFlyer_eventId_idx" ON "EventFlyer"("eventId");
CREATE INDEX "EventPublication_status_submittedAt_idx" ON "EventPublication"(status,"submittedAt");
CREATE INDEX "EventPublication_category_status_idx" ON "EventPublication"(category,status);
CREATE INDEX "EventRsvp_userId_createdAt_idx" ON "EventRsvp"("userId","createdAt");
CREATE INDEX "Event_public_date_endDate_idx" ON "Event"("isPublic",date,"endDate");
DO $$ DECLARE tbl text; api_role text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['EventPublication','EventFlyer','EventRsvp'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC',tbl);
  EXECUTE format('CREATE POLICY outclass_events_server_only ON %I AS RESTRICTIVE FOR ALL TO PUBLIC USING(false) WITH CHECK(false)',tbl);
  FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN EXECUTE format('REVOKE ALL ON %I FROM %I',tbl,api_role); END IF;
  END LOOP;
 END LOOP;
END $$;
-- All editors, including legacy meeting/platform editors, invalidate public approval.
CREATE FUNCTION outclass_event_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW IS DISTINCT FROM OLD AND NEW.revision<=OLD.revision THEN NEW.revision:=OLD.revision+1; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER outclass_event_revision BEFORE UPDATE ON "Event" FOR EACH ROW EXECUTE FUNCTION outclass_event_revision();
CREATE FUNCTION outclass_event_withdraw() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW IS DISTINCT FROM OLD THEN
  UPDATE "EventPublication" SET status=CASE WHEN status IN ('CANCELLED','ARCHIVED') THEN status ELSE 'DRAFT' END,
   "approvedRevision"=NULL,"publishedAt"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE "eventId"=NEW.id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER outclass_event_withdraw AFTER UPDATE ON "Event" FOR EACH ROW EXECUTE FUNCTION outclass_event_withdraw();
CREATE FUNCTION outclass_publication_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e "Event"; BEGIN
 SELECT * INTO e FROM "Event" WHERE id=NEW."eventId" FOR UPDATE;
 IF TG_OP='UPDATE' AND ROW(NEW.category,NEW.contact,NEW."rsvpEnabled",NEW."rsvpRequired",NEW.capacity,NEW."rsvpDeadline",NEW.template,NEW."flyerId") IS DISTINCT FROM ROW(OLD.category,OLD.contact,OLD."rsvpEnabled",OLD."rsvpRequired",OLD.capacity,OLD."rsvpDeadline",OLD.template,OLD."flyerId") THEN
  NEW.status:='DRAFT'; NEW."approvedRevision":=NULL; NEW."publishedAt":=NULL;
 END IF;
 IF NEW."flyerId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "EventFlyer" WHERE id=NEW."flyerId" AND "eventId"=NEW."eventId") THEN RAISE EXCEPTION 'Flyer belongs to another event'; END IF;
 IF NEW.status='PUBLISHED' AND (NOT e."isPublic" OR e.audience<>'RECRUITMENT' OR NEW."approvedRevision" IS DISTINCT FROM e.revision) THEN RAISE EXCEPTION 'Publication requires current approved public event revision'; END IF;
 IF NEW.capacity IS NOT NULL AND NEW.capacity<(SELECT count(*) FROM "EventRsvp" WHERE "eventId"=NEW."eventId") THEN RAISE EXCEPTION 'Capacity is below existing RSVPs'; END IF;
 IF NEW.status IN ('PENDING','PUBLISHED') AND NEW."rsvpDeadline" IS NOT NULL AND NEW."rsvpDeadline">e.date THEN RAISE EXCEPTION 'RSVP deadline must not follow event start'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER outclass_publication_guard BEFORE INSERT OR UPDATE ON "EventPublication" FOR EACH ROW EXECUTE FUNCTION outclass_publication_guard();
-- References never change underneath an approved flyer; replacement creates a new object/row.
CREATE FUNCTION outclass_flyer_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Flyer metadata is immutable; upload a replacement'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER outclass_flyer_immutable BEFORE UPDATE ON "EventFlyer" FOR EACH ROW EXECUTE FUNCTION outclass_flyer_immutable();
-- Database-level RSVP locking also protects against accidental future writers.
CREATE FUNCTION outclass_rsvp_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e "Event"; p "EventPublication"; BEGIN
 SELECT * INTO e FROM "Event" WHERE id=NEW."eventId" FOR UPDATE;
 SELECT * INTO p FROM "EventPublication" WHERE "eventId"=NEW."eventId";
 IF p.status IS DISTINCT FROM 'PUBLISHED' OR p."approvedRevision" IS DISTINCT FROM e.revision OR NOT e."isPublic" OR NOT p."rsvpEnabled" OR e.date<=CURRENT_TIMESTAMP OR (p."rsvpDeadline" IS NOT NULL AND p."rsvpDeadline"<=CURRENT_TIMESTAMP) THEN RAISE EXCEPTION 'RSVP is unavailable'; END IF;
 IF p.capacity IS NOT NULL AND (SELECT count(*) FROM "EventRsvp" WHERE "eventId"=NEW."eventId")>=p.capacity THEN RAISE EXCEPTION 'Event is full'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER outclass_rsvp_guard BEFORE INSERT ON "EventRsvp" FOR EACH ROW EXECUTE FUNCTION outclass_rsvp_guard();
-- Provider-owned Storage is optional in disposable PostgreSQL; never create it here.
DO $$ BEGIN
 IF to_regclass('storage.objects') IS NULL OR to_regclass('storage.buckets') IS NULL THEN
  RAISE NOTICE 'Storage is absent; provision it and reapply the storage block before enabling uploads.'; RETURN;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_class WHERE oid IN ('storage.objects'::regclass,'storage.buckets'::regclass) AND NOT relrowsecurity) THEN RAISE EXCEPTION 'Storage objects and buckets RLS must already be enabled'; END IF;
 INSERT INTO storage.buckets(id,name,public) VALUES('event-flyers','event-flyers',false) ON CONFLICT(id) DO UPDATE SET public=false;
 DROP POLICY IF EXISTS outclass_event_bucket_server_only ON storage.buckets;
 CREATE POLICY outclass_event_bucket_server_only ON storage.buckets AS RESTRICTIVE FOR ALL TO PUBLIC USING(id<>'event-flyers') WITH CHECK(id<>'event-flyers');
 DROP POLICY IF EXISTS outclass_event_flyers_server_only ON storage.objects;
 CREATE POLICY outclass_event_flyers_server_only ON storage.objects AS RESTRICTIVE FOR ALL TO PUBLIC USING(bucket_id<>'event-flyers') WITH CHECK(bucket_id<>'event-flyers');
END $$;
COMMIT;
