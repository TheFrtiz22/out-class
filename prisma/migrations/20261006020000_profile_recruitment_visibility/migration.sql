BEGIN;
ALTER TABLE "StudentProfile"
 ADD COLUMN "highSchool" TEXT,
 ADD COLUMN "gender" TEXT,
 ADD COLUMN "pronouns" TEXT,
 ADD COLUMN "transferStudent" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_high_school_check" CHECK (length("highSchool") <= 200),
 ADD CONSTRAINT "StudentProfile_gender_check" CHECK ("gender" IN ('Male','Female','Other','Prefer not to say')),
 ADD CONSTRAINT "StudentProfile_pronouns_check" CHECK ("pronouns" IN ('He/Him','She/Her','They/Them','Other'));
-- No scale metadata exists and every application writer already uses 4.0.
-- Preserve all historical values. NOT VALID guards new writes without inventing
-- a conversion or destroying out-of-range historical data; operators can inspect
-- and validate historical exceptions separately if any exist.
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_gpa_4_check"
 CHECK ("gpa" >= 0 AND "gpa" <= 4 AND abs("gpa" * 1000 - round("gpa" * 1000)) < 0.00000001) NOT VALID;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM "StudentProfile" WHERE "gpa" IS NOT NULL AND NOT ("gpa" >= 0 AND "gpa" <= 4 AND abs("gpa" * 1000 - round("gpa" * 1000)) < 0.00000001)) THEN
  ALTER TABLE "StudentProfile" VALIDATE CONSTRAINT "StudentProfile_gpa_4_check";
 END IF;
END $$;
CREATE OR REPLACE FUNCTION outclass_scholar_status_valid(v JSONB) RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE choices JSONB; item JSONB;
BEGIN
  IF v IS NULL THEN RETURN TRUE; END IF;
  IF jsonb_typeof(v) <> 'object' THEN RETURN FALSE; END IF;
  choices := v->'selections';
  IF choices IS NULL OR jsonb_typeof(choices) <> 'array' THEN RETURN FALSE; END IF;
  IF jsonb_array_length(choices) NOT BETWEEN 1 AND 9 THEN RETURN FALSE; END IF;
  IF (SELECT count(DISTINCT x) FROM jsonb_array_elements(choices) x) <> jsonb_array_length(choices) THEN RETURN FALSE; END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(choices) LOOP
    IF NOT item <@ '["JEFFERSON","WALENTAS","ECHOLS","RODMAN","NOT_APPLICABLE","OTHER","COLLEGE_SCIENCE","MILLER_ARTS","CORE"]'::jsonb THEN RETURN FALSE; END IF;
  END LOOP;
  IF choices ? 'NOT_APPLICABLE' AND jsonb_array_length(choices) <> 1 THEN RETURN FALSE; END IF;
  IF jsonb_typeof(v->'other') IS DISTINCT FROM 'string' OR length(v->>'other') > 200 THEN RETURN FALSE; END IF;
  RETURN CASE WHEN choices ? 'OTHER' THEN length(btrim(v->>'other')) > 0 ELSE v->>'other' = '' END;
END $$;

-- Reuse the existing public headshots architecture. A fresh Supabase project
-- must not depend on archived, production-only bucket/provider configuration.
DO $$ BEGIN
 IF to_regclass('storage.objects') IS NULL OR to_regclass('storage.buckets') IS NULL THEN
  RAISE NOTICE 'Storage is absent on plain PostgreSQL; profile photo uploads require Supabase Storage'; RETURN;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_class WHERE oid IN ('storage.objects'::regclass,'storage.buckets'::regclass) AND NOT relrowsecurity) THEN
  RAISE EXCEPTION 'Supabase Storage RLS must already be enabled';
 END IF;
 INSERT INTO storage.buckets(id,name,public) VALUES('headshots','headshots',true) ON CONFLICT(id) DO NOTHING;
 CREATE POLICY outclass_headshots_owner_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK(bucket_id='headshots' AND split_part(name,'/',1)=(SELECT auth.uid())::text);
 CREATE POLICY outclass_headshots_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO PUBLIC
  WITH CHECK(bucket_id<>'headshots' OR split_part(name,'/',1)=(SELECT auth.uid())::text);
 CREATE POLICY outclass_headshots_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO PUBLIC
  USING(bucket_id<>'headshots' OR split_part(name,'/',1)=(SELECT auth.uid())::text)
  WITH CHECK(bucket_id<>'headshots' OR split_part(name,'/',1)=(SELECT auth.uid())::text);
 CREATE POLICY outclass_headshots_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO PUBLIC
  USING(bucket_id<>'headshots' OR split_part(name,'/',1)=(SELECT auth.uid())::text);
END $$;
-- Existing application-table RLS policies and browser privileges remain unchanged.
COMMIT;
