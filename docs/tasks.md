# Club tasks and projects

Semester work lives at `/club/[clubId]/tasks`, linked from club profiles, club settings, and the account workspace menu. There is no new global Tasks navigation item. The same user can do personal work and manage the club; switching the view does not change identity or authority.

## Authorization and persistence

- Every read requires a current ClubMember record. Members receive only their assigned tasks and their own submissions. `tasks.manage` allows the club's complete assignment progress, content editing, and reviews. `members.manage` separately controls group/cohort labels.
- Server actions in `actions/tasks.ts` recheck authorization. Sensitive writes and audit entries commit together. Club row locking coordinates writes with access revocation; revision checks reject stale task edits, submissions, and reviews.
- `ClubTask` retains its existing IDs, legacy assignee, status, and fields. Additions are TASK/PROJECT, an optional same-club project parent, resources, submission requirements, audience, and revision. Projects organize tasks and support manager completion per recipient; they do not require a second submission.
- `TaskAssignment` binds the existing user and membership to a task, tracks first viewed, last submitted, reviewed, reviewer, feedback, and revision. Removing a membership nulls the membership reference and preserves the user's work for authorized managers. The former member loses access. Deleting the user or club cascades dependent records.
- Targeting defaults to the existing OR union across whole club, individual membership IDs, groups, cohort/join-semester, profile graduation year, and membership role. Advanced targeting explicitly selects ANY (OR) or ALL (AND) between nonempty categories, with OR within each category. Excluded members/groups and recipients of selected same-club tasks are always removed. Each recipient is included once. Optional groups and cohort live on ClubMember; groups are exact, case-sensitive labels, and membership roles never imply permission.
- Recipients are resolved at creation. Editing labels, new members joining, or editing content does not silently change existing assignments. Managers can explicitly add recipients without replacing existing work, or duplicate a task to choose a new audience and due date. Graduation year comes from the existing student profile; unknown years do not match a year filter. Cohorts are optional and not inferred or backfilled as factual history.
- Late work is accepted while OPEN/IN_PROGRESS and not reviewed. Lateness uses the current due date and latest submission timestamp; it never creates a grade/ranking. Updating work replaces the current response and timestamp, with an audit entry. Reviews lock member edits; managers can reopen or request revisions with required feedback. A revision request retains the response, clears approval, and persists `revisionRequestedAt`; resubmission clears that flag and re-enters the review queue. Closing the task prevents further submission. Existing submitted work remains readable.
- The additive migration backfills recipients only for legacy assignees who still belong to the club. Unassigned legacy checklists remain manager-visible. No accounts or memberships are recreated.

## Create → Assign → Track → Review

Managers default to the club Tasks workspace, with Active, Needs Review, Overdue, Projects, Members, and Completed views. Nonzero metrics link to relevant views. Completed exposes reviewed submissions, including tasks with remaining recipients; closed work is also retained there. Overdue opens the affected recipients directly. Members retain their personal due/missing/submitted list and submission drawer.

The lightweight assignment builder exposes targeting, submission formats, timing, optional resources, and an exact server-validated recipient preview. Drafts have no recipients and can be retargeted until published. Publishing stores individual assignments; a changed roster fails the preview check rather than assigning an unseen list.

Random assignment uses a saved UUID seed and a stable sorted roster to sample members or divide the eligible audience into balanced groups. Regenerate is available before publication. Actual recipient IDs and each assignment's `groupLabel` are persisted; reads never rerandomize. A saved seed and preview are checked again when publishing.

Needs Review aggregates pending submissions and filters by task, project, member search, graduation year, and group/cohort. The focused review session retains a queue, supports previous/next and Alt+arrow navigation, saves feedback, and advances through remaining submissions after approval or revision requests. Approved responses remain viewable and managers can reopen them. Bulk date changes/closing (100 tasks) and approvals (50 submissions) require an affected-record confirmation and commit atomically with expected revisions and audit entries. Bulk approval excludes revision requests and unsubmitted work.

Task notifications are derived from the authenticated member's assignment records and merged into the existing inbox and bell: assigned, due soon, reviewed, or revisions requested. There is at most one current update per assignment; submitting suppresses an assignment alert until a review arrives. The shell refreshes on task writes, focus, and a 60-second interval. Existing read/delete behavior is reused. Live read/dismiss state remains session-local because the existing notification architecture has no durable delivery/read table. No email delivery, reminder endpoint, or second task store is added.

## Private files: deployment

1. Apply Prisma migrations with the deployment's normal `prisma migrate deploy` process. The original task migration is `20260924040000_member_tasks`; the workflow redesign additionally requires `20261003030000_task_workflows` before running the updated application. This adds nullable revision-request and random-group fields and a review index, preserving submissions and access controls.
2. Run `supabase/task-submissions.sql` in the Supabase SQL editor. It creates/locks down the private `task-submissions` bucket, caps objects at 10 MB, restricts MIME types, and adds a restrictive browser policy protecting this bucket even when other buckets have broad policies. Do not make this bucket public.
3. Configure `NEXT_PUBLIC_SUPABASE_URL` and the server-only `SUPABASE_SECRET_KEY` (or existing `SUPABASE_SERVICE_ROLE_KEY`). Never use a `NEXT_PUBLIC_` secret key. The application's existing authenticated Supabase setup is still required.
4. Test a real upload, submission, authorized download, denied outsider access, and membership removal in the deployed environment. Supabase storage cannot be fully exercised with database-only tests.

Uploads require the actual assigned member and an open, unreviewed task. The server records a random, assignment-bound object path without the original filename, then issues a Supabase signed upload with overwrite disabled (Supabase's two-hour upload expiry). There is a 30-upload daily limit per assignment. Submission verifies storage object existence, size, and MIME against the reserved record; arbitrary paths and other assignments' file IDs are rejected. Up to five files may accompany a submission. PDF, plain text, PNG/JPEG, DOCX/PPTX/XLSX are allowed.

Downloads recheck current membership and ownership or `tasks.manage`, then issue a 60-second signed attachment URL. Only currently submitted files can be downloaded. Short-lived URLs remain usable until expiry if access is subsequently revoked. Private bucket status is checked for file operations. Failure to configure storage fails closed; text/link submissions remain available unless a file is required.

Resources are labeled external http(s) links; a manager can link an externally hosted file. Native manager-resource uploads are not part of this implementation. Files are private attachments, never rendered as trusted HTML. Content malware scanning, version history for replaced submissions, and automatic orphan-file cleanup are not implemented. Operators should establish a retention/cleanup job for abandoned/replaced uploads and objects whose database records have been deleted; cleanup must wait beyond the signed-upload expiry. Do not delete files still marked submitted.

## Demo

Demo uses the same workspace adapter and never invokes task server actions or real storage. The demo identity is a student and an MII manager only. Fictional MII semester research, weekly market briefs, groups/cohorts, submissions, reviewed work, and overdue work persist in the existing local demo snapshot. Older snapshots gain tasks without resetting recruiting activity. Members retain one identity. Demo uploads remain disabled; seeded file-style submissions download safe bundled sample text files. Fictional text/link submissions remain editable. Reset restores the bundled examples.

## Validation

Node tests cover legacy OR and advanced AND/exclusions, deterministic random samples/groups, recipient previews, draft publishing, additional recipients, atomic bulk actions, review queues/notifications, authorization, query scoping, immutable audiences, revisions, required formats, overdue state, upload metadata, signed access, demo refresh/reset, and zero live demo calls. The optional PostgreSQL migration suite checks legacy backfill, recipient uniqueness, private table privileges, and former-member history preservation. No production migration or storage provisioning is implied by local test success.

## Retired task writer

The unused actions/club-workspace.ts saveClubTask endpoint now fails closed for old clients after checking tasks.manage. It cannot create legacy unassigned tasks or overwrite a task without a revision. Current clients continue to use actions/tasks.ts saveTask, with its membership recheck, immutable audience, assignment creation, and atomic expected-revision update. No task records are rewritten by this remediation.
