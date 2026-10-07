BEGIN;
-- Preserve historical values without exempting new or changed GPAs.
ALTER TABLE "StudentProfile" DROP CONSTRAINT "StudentProfile_gpa_4_check";
CREATE FUNCTION outclass_validate_changed_gpa() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND NEW.gpa IS NOT DISTINCT FROM OLD.gpa THEN RETURN NEW; END IF;
 IF NEW.gpa IS NOT NULL AND NOT (NEW.gpa >= 0 AND NEW.gpa <= 4 AND abs(NEW.gpa * 1000 - round(NEW.gpa * 1000)) < 0.00000001) THEN
  RAISE EXCEPTION 'GPA must be 0–4 with at most three decimal places' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER outclass_student_profile_gpa BEFORE INSERT OR UPDATE OF gpa ON "StudentProfile"
 FOR EACH ROW EXECUTE FUNCTION outclass_validate_changed_gpa();
DO $$ BEGIN
 IF to_regclass('storage.objects') IS NULL THEN RETURN; END IF;
 UPDATE storage.buckets SET public=false WHERE id='headshots';
 -- Convert only references to existing owner-prefixed headshot objects. Other
 -- historical references remain stored, but cannot be rendered as private photos.
 UPDATE "StudentProfile" p SET "headshotUrl"=o.name FROM storage.objects o
 WHERE o.bucket_id='headshots' AND split_part(o.name,'/',1)=p."userId"
 AND p."headshotUrl" ~ '^https?://' AND p."headshotUrl" LIKE '%/storage/v1/object/public/headshots/' || o.name;
 -- No direct browser reads or signed-download capabilities, even with broad
 -- pre-existing policies. The authenticated application proxy uses service role.
 CREATE POLICY outclass_headshots_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO PUBLIC
 USING(bucket_id<>'headshots');
 CREATE POLICY outclass_headshots_bucket_mutation_guard ON storage.buckets AS RESTRICTIVE FOR ALL TO PUBLIC
 USING(id<>'headshots') WITH CHECK(id<>'headshots');
END $$;
COMMIT;
