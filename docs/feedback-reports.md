# Issue reports and feedback

Signed-in students and leaders send an issue report or feedback from the account menu
("Report an issue or send feedback"). Signed-out visitors keep the contact email.

## Flow

- **Storage:** a `PlatformReport` row, kind `ISSUE` or `FEEDBACK` (migration
  `20261113120000_platform_report_feedback`, after `20261113110000_platform_report_account_deletion_kind`). `summary` is the message (10–2000 characters);
  `targetId` is the page path; `context` is a bounded object built on the server:
  `path` (path and query only, no fragment, credential-like query parameters dropped, opaque link
  tokens masked), `userAgent` (coarse "Chrome 131 on macOS (desktop)" line from the request
  header), `viewport`, `appVersion` (the server build's commit), and `screenshotPath` when one is
  attached. Unknown fields from the browser are stripped. Same hourly allowance as every other
  platform report (10 per account per hour); support sessions and Demo Mode are refused.
- **Actions:** `actions/feedback-reports.ts` (`prepareFeedbackScreenshot`, `submitFeedbackReport`,
  admin-only `getFeedbackScreenshot`); helpers in `lib/feedback-reports.ts`.
- **Admin queue:** `/platform/reports` lists issues and feedback with the other reports, with a
  Kind filter (All / Issues / Feedback), the captured details and the screenshot on demand.
  Resolve with the existing `resolveAdminReport`. The admin rail's Reports item shows the number
  of OPEN issue and feedback reports.

## Screenshots

Optional. The browser downscales and re-encodes the chosen image as JPEG (≤ 2 MB), asks for a
signed upload URL and uploads it to the existing private `task-submissions` bucket under
`reports/<userId>/<uuid>.jpg` (or `.png`; the server issues the path and its extension follows the declared type). That bucket denies every browser role (restrictive policy in
`supabase/task-submissions.sql`) and already allows PNG and JPEG, so **no Storage change is
needed**. On submit the server checks the path belongs to the reporter, that the object has the
declared size and type, and its first bytes (the task-file check); anything else is deleted.
Admins open a 60-second signed URL (audited `platform.report.screenshot.read`).

WebP is not accepted because the bucket's `allowed_mime_types` does not list it; the browser
always converts to JPEG.

Account deletion removes every object under `reports/<userId>/` (attached or abandoned uploads)
and clears `screenshotPath` from that person's retained reports.

## Live updates

The admin shell checks a content-free pulse (`getAdminReportsPulse`: open issue/feedback count and
a queue fingerprint) every 20 seconds while an admin page is visible, and on focus. When the
fingerprint changes the Reports page refetches through the audited `listAdminReports`.

Realtime is ready but **off**: after a report is filed or resolved the server can broadcast an
empty `reports` event on the private topic `platform-reports`; admin pages then re-check at once
and stop polling. It needs a Realtime receive policy that this PR does not apply.

### Owner SQL (not applied by this PR)

Run in the Supabase SQL editor, then set `NEXT_PUBLIC_ADMIN_REPORTS_REALTIME=1` and redeploy.
Until then nothing joins or sends on the topic and polling carries the queue.

```sql
BEGIN;
-- Active platform admin check for Realtime authorization. PlatformAdmin stays server-only:
-- the browser gets a boolean for its own id, nothing else.
CREATE OR REPLACE FUNCTION public.outclass_is_active_platform_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public."PlatformAdmin" WHERE "userId" = (SELECT auth.uid())::text AND active)
$$;
REVOKE ALL ON FUNCTION public.outclass_is_active_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.outclass_is_active_platform_admin() TO authenticated;

-- Receive: only active platform admins may join the content-free reports topic.
DROP POLICY IF EXISTS outclass_admin_reports_signal_receive ON realtime.messages;
CREATE POLICY outclass_admin_reports_signal_receive ON realtime.messages
  FOR SELECT TO authenticated
  USING (extension = 'broadcast' AND (SELECT realtime.topic()) = 'platform-reports'
         AND public.outclass_is_active_platform_admin());
-- Send: no browser role may publish on it; the server sends with the service key.
DROP POLICY IF EXISTS outclass_admin_reports_signal_no_client_send ON realtime.messages;
CREATE POLICY outclass_admin_reports_signal_no_client_send ON realtime.messages
  AS RESTRICTIVE FOR INSERT TO PUBLIC
  WITH CHECK (topic <> 'platform-reports');
COMMIT;
```
