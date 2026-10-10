-- Storage only. Club/profile records and all other buckets remain unchanged.
BEGIN;
DO $$ BEGIN
 IF to_regclass('storage.objects') IS NULL OR to_regclass('storage.buckets') IS NULL THEN
  RAISE NOTICE 'Storage absent; reapply this block after provisioning Storage before enabling club uploads.';
  RETURN;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_class WHERE oid IN ('storage.objects'::regclass,'storage.buckets'::regclass) AND NOT relrowsecurity) THEN
  RAISE EXCEPTION 'Storage objects and buckets must already enforce RLS';
 END IF;
 INSERT INTO storage.buckets(id,name,public) VALUES('club-assets','club-assets',false)
 ON CONFLICT(id) DO UPDATE SET public=false;
 -- Minimal PostgreSQL test installations need not have provider-owned limit columns.
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='storage' AND table_name='buckets' AND column_name='file_size_limit') THEN
  EXECUTE 'UPDATE storage.buckets SET file_size_limit=5242880 WHERE id=''club-assets''';
 END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='storage' AND table_name='buckets' AND column_name='allowed_mime_types') THEN
  EXECUTE 'UPDATE storage.buckets SET allowed_mime_types=ARRAY[''image/jpeg'',''image/png'',''image/webp''] WHERE id=''club-assets''';
 END IF;
 DROP POLICY IF EXISTS club_assets_insert_owner_only ON storage.objects;
 DROP POLICY IF EXISTS club_assets_update_owner_only ON storage.objects;
 DROP POLICY IF EXISTS club_assets_delete_owner_only ON storage.objects;
 DROP POLICY IF EXISTS club_assets_select_public ON storage.objects;
 DROP POLICY IF EXISTS outclass_club_assets_server_only ON storage.objects;
 CREATE POLICY outclass_club_assets_server_only ON storage.objects AS RESTRICTIVE FOR ALL TO PUBLIC
 USING(bucket_id<>'club-assets') WITH CHECK(bucket_id<>'club-assets');
 DROP POLICY IF EXISTS outclass_club_assets_bucket_server_only ON storage.buckets;
 CREATE POLICY outclass_club_assets_bucket_server_only ON storage.buckets AS RESTRICTIVE FOR ALL TO PUBLIC
 USING(id<>'club-assets') WITH CHECK(id<>'club-assets');
END $$;
COMMIT;
