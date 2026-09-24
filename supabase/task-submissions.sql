-- Run in the Supabase SQL editor. Server-issued signed uploads/downloads only.
-- No browser role policies are added. Never reuse a public bucket.
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('task-submissions','task-submissions',false,10485760,ARRAY['application/pdf','text/plain','image/png','image/jpeg','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
ON CONFLICT (id) DO UPDATE SET public=false,file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;

-- Restrictive policies prevent a pre-existing broad browser policy from exposing
-- this bucket. Supabase server/service-role signed operations bypass RLS.
DROP POLICY IF EXISTS outclass_task_files_server_only ON storage.objects;
CREATE POLICY outclass_task_files_server_only ON storage.objects
AS RESTRICTIVE FOR ALL TO anon, authenticated
USING (bucket_id <> 'task-submissions')
WITH CHECK (bucket_id <> 'task-submissions');
