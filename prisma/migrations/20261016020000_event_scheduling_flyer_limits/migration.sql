BEGIN;
-- Prisma is the sole migration history. Existing events remain timed.
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "allDay" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD CONSTRAINT "Event_all_day_dates" CHECK (
 NOT "allDay" OR ("endDate" IS NOT NULL AND "endDate">date
 AND (date AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')::time = '00:00:00'
 AND ("endDate" AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')::time = '00:00:00'));
ALTER TABLE "EventFlyer" DROP CONSTRAINT IF EXISTS "EventFlyer_size_check";
ALTER TABLE "EventFlyer" ADD CONSTRAINT "EventFlyer_size_check" CHECK(size>0 AND size<=10485760);
DO $$ BEGIN
 IF to_regclass('storage.buckets') IS NOT NULL THEN
  INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  VALUES('event-flyers','event-flyers',false,10485760,ARRAY['image/png','image/jpeg','image/webp'])
  ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=10485760,allowed_mime_types=EXCLUDED.allowed_mime_types;
 END IF;
END $$;
-- Storage deletion must survive failed provider requests and cascading event deletion.
CREATE TABLE "EventFlyerDeletion" (path TEXT PRIMARY KEY, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
ALTER TABLE "EventFlyerDeletion" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "EventFlyerDeletion" FROM PUBLIC;
CREATE POLICY outclass_flyer_deletions_server_only ON "EventFlyerDeletion" AS RESTRICTIVE FOR ALL TO PUBLIC USING(false) WITH CHECK(false);
CREATE FUNCTION outclass_queue_flyer_deletion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 INSERT INTO "EventFlyerDeletion"(path) VALUES(OLD.path) ON CONFLICT DO NOTHING;
 RETURN OLD;
END $$;
CREATE TRIGGER outclass_queue_flyer_deletion AFTER DELETE ON "EventFlyer" FOR EACH ROW EXECUTE FUNCTION outclass_queue_flyer_deletion();
CREATE FUNCTION outclass_remove_replaced_flyer() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF OLD."flyerId" IS DISTINCT FROM NEW."flyerId" AND OLD."flyerId" IS NOT NULL THEN
  DELETE FROM "EventFlyer" WHERE id=OLD."flyerId";
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER outclass_remove_replaced_flyer AFTER UPDATE OF "flyerId" ON "EventPublication" FOR EACH ROW EXECUTE FUNCTION outclass_remove_replaced_flyer();

-- Sweep historical replaced/removed references into the durable deletion queue.
DELETE FROM "EventFlyer" f WHERE NOT EXISTS (SELECT 1 FROM "EventPublication" p WHERE p."flyerId"=f.id);

COMMIT;
