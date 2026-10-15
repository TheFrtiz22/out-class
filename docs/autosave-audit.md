# Universal autosave — Phase 1 audit and implementation

Audit: all 95 TSX files containing native/custom inputs or editable surfaces, plus save/draft/timer workflows in actions, hooks and libraries. No rich-text/contentEditable document editor was found. Searches included inputs, textareas, save handlers, draft buttons, timers, and unload handlers.

## Editing policy

| Surface | Before → implemented behavior |
|---|---|
| `components/applications/application-form.tsx` | Manual Save draft → account autosave. Submit stays explicit; answer compare tokens detect competing tabs. |
| `components/edit-student-profile-dialog.tsx` | Manual Save changes → section autosave. Done flushes. Each section has an independent compare token. |
| `components/interview-kit-editor.tsx` | Manual Save kit → autosave with existing kitVersion authorization/CAS. New interviews use saved kits; existing snapshots stay pinned. |
| `components/communications/template-editor.tsx` | Manual Save templates → autosave with content compare token. Sending decisions and the formal-letter setting remain separate. |
| `components/interview-kit-session.tsx` | Existing 800 ms serialized private autosave retained. Added refresh recovery, blur/online/visibility flush and navigation draining. Closing questions and finalizing remain explicit. |
| `components/availability/my-availability.tsx` | Existing specialized serialized availability autosave retained, including revision/CAS and lost-acknowledgement recovery. |
| `components/availability/interviewer-eligibility.tsx` | Existing deliberate availability/participation controls retained with their specialized persistence. |
| `components/clubs/club-profile-editor.tsx` | All marketing copy, media references, FAQs, metrics, links, sections. Private draft autosave; Publish profile remains explicit. Platform administrator editor retains its audited manual workflow. |
| `components/views/club-manager/application-builder-view.tsx` | Questions, prompts, options, required/type/word-limit settings, availability and deadline. Private draft autosave; Publish application changes applies validated live configuration. |
| `components/views/club-manager/interview-pipeline-builder-view.tsx` | Round names, instructions, duration and configuration. Private draft autosave; applying pipeline changes remains explicit. |
| `components/club-announcements.tsx` | Title, body, audience and send timing. Private draft autosave; Send now / Confirm schedule remain explicit. Scheduled content is not changed while typing. |
| `components/tasks/task-assignment-builder.tsx` | Title, instructions, project, formats, resources, audience and due date. Private draft autosave; Review & assign and assignment stay explicit. Existing issued tasks also stage changes. |
| `components/tasks/task-review-workspace.tsx` | Feedback autosaves privately per submission. Approve / Request revision remain explicit. |
| `components/club-tasks.tsx` | Member response text/link autosave privately per owned assignment. Uploads keep existing private staging; Submit remains explicit. |
| `components/events/club-events.tsx` | Event details and flyer choice autosave privately. Apply event changes / Submit for approval remain explicit, so typing cannot withdraw a published event. |
| `components/meeting-workspace.tsx` | Title, location, dates, audience, description, agenda, recap and resource links autosave privately. Saving/publishing the meeting stays explicit. |
| `components/views/leader-dashboard/live-leader-workspace.tsx` | Reviewer score/feedback autosave privately per applicant and round. Finalize evaluation, status decisions, round moves and offers remain explicit. |
| `components/interviews/panel-preview-workspace.tsx` | Discrete panel edits now validate and persist the existing proposal atomically. Removed Save Draft. Published assignments change only through Review & Publish and owner confirmation. |

## Remaining editable-interface inventory

Every scanned file is accounted for below. A manual action in this table is intentional: it publishes shared information, changes access/operations, submits a request, or controls a preview/search. It is not wired to autosave consequential actions.

| File | Policy |
|---|---|
| `app/auth/student-claim/page.tsx` | Credential/OTP/account action. Explicit authentication only; credentials are never stored by autosave. |
| `app/design-system/page.tsx` | Legacy/sample/preview surface or onboarding flow. Keep explicit demo or onboarding transitions; no automatic live publication. |
| `app/platform/login/page.tsx` | Credential/OTP/account action. Explicit authentication only; credentials are never stored by autosave. |
| `components/admin/admin-clubs.tsx` | Audited administrator operation or platform request; explicit approval/commit retained. |
| `components/admin/admin-corkboard.tsx` | Audited administrator operation or platform request; explicit approval/commit retained. |
| `components/admin/admin-directory.tsx` | Audited administrator operation or platform request; explicit approval/commit retained. |
| `components/admin/admin-onboarding.tsx` | Audited administrator operation or platform request; explicit approval/commit retained. |
| `components/admin/admin-permissions.tsx` | Audited administrator operation or platform request; explicit approval/commit retained. |
| `components/admin/admin-reports.tsx` | Audited administrator operation or platform request; explicit approval/commit retained. |
| `components/admin/admin-settings.tsx` | Audited administrator operation or platform request; explicit approval/commit retained. |
| `components/admin/school-request-review.tsx` | Audited administrator operation or platform request; explicit approval/commit retained. |
| `components/applicant-intelligence.tsx` | Pro/con observations are shared publications. Add/Save observation and Delete stay explicit. Applicant field visibility settings remain an intentional commit. |
| `components/applications/question-field.tsx` | Input primitive, selection/search/filter, media preparation, or nested field renderer. Persistence is owned by its parent editor; no independent autosave write. |
| `components/auth/email-login-form.tsx` | Credential/OTP/account action. Explicit authentication only; credentials are never stored by autosave. |
| `components/auth/login-auth-panel.tsx` | Credential/OTP/account action. Explicit authentication only; credentials are never stored by autosave. |
| `components/availability/admin-overview.tsx` | Availability requests, administrative scheduling and participation controls retain specialized workflows; no automatic scheduled send. |
| `components/availability/weekly-calendar.tsx` | Availability requests, administrative scheduling and participation controls retain specialized workflows; no automatic scheduled send. |
| `components/claim-form.tsx` | Identity/ownership request, import preview or reviewed data application. Explicit confirmation/submission retained. |
| `components/claim-review.tsx` | Identity/ownership request, import preview or reviewed data application. Explicit confirmation/submission retained. |
| `components/club-access-editor.tsx` | Operational settings, grants, invitations or schedule controls. Existing explicit commit retained; no automatic consequential action. |
| `components/club-members.tsx` | Membership/permission/role changes keep their existing deliberate persistence and destructive confirmations. |
| `components/club-settings-workspace.tsx` | Visibility and email-preference switches keep existing explicit interaction saves. Nested content editors are covered above. |
| `components/clubs/profile-image-input.tsx` | Input primitive, selection/search/filter, media preparation, or nested field renderer. Persistence is owned by its parent editor; no independent autosave write. |
| `components/communication-schedules.tsx` | Scheduling, cancellation, fixed audiences and send-time execution remain explicit. |
| `components/customization/crm-view-manager.tsx` | Legacy/sample/preview surface or onboarding flow. Keep explicit demo or onboarding transitions; no automatic live publication. |
| `components/customization/profile-builder.tsx` | Legacy/sample/preview surface or onboarding flow. Keep explicit demo or onboarding transitions; no automatic live publication. |
| `components/customization/recruitment-pipeline-builder.tsx` | Legacy/sample/preview surface or onboarding flow. Keep explicit demo or onboarding transitions; no automatic live publication. |
| `components/events/event-approvals.tsx` | Platform approvals, rejections and reasons remain explicit. |
| `components/events/public-event-board.tsx` | Input primitive, selection/search/filter, media preparation, or nested field renderer. Persistence is owned by its parent editor; no independent autosave write. |
| `components/interview-access-setup.tsx` | Grants and interview offices affect private data access; retain explicit changes. |
| `components/interview-resume-viewer.tsx` | Shared annotation comments are explicitly posted/updated and deleted; preserve sharing authorization, anchors and revision checks. |
| `components/interviews/create-room-dialog.tsx` | Creating a room creates operational sessions; retain explicit creation. |
| `components/interviews/my-panel-schedule.tsx` | Operational settings, grants, invitations or schedule controls. Existing explicit commit retained; no automatic consequential action. |
| `components/interviews/room-manager.tsx` | Room/slot changes affect bookings and staffing; retain explicit mutations. |
| `components/landing/journey-scenes.tsx` | Legacy/sample/preview surface or onboarding flow. Keep explicit demo or onboarding transitions; no automatic live publication. |
| `components/landing/school-request-form.tsx` | Identity/ownership request, import preview or reviewed data application. Explicit confirmation/submission retained. |
| `components/live-voting/board-decision-mode.tsx` | Votes, session setup, joining and decision publication remain explicit. |
| `components/live-voting/live-voting-launcher.tsx` | Votes, session setup, joining and decision publication remain explicit. |
| `components/live-voting/mobile-join-screen.tsx` | Votes, session setup, joining and decision publication remain explicit. |
| `components/organization-member-management.tsx` | Ownership, roles, permissions, invitation delivery and removal remain explicit. |
| `components/password-recovery.tsx` | Credential/OTP/account action. Explicit authentication only; credentials are never stored by autosave. |
| `components/platform-console.tsx` | Audited administrator operation or platform request; explicit approval/commit retained. |
| `components/platform-organization-onboarding.tsx` | Audited administrator operation or platform request; explicit approval/commit retained. |
| `components/profile-photo-crop.tsx` | Input primitive, selection/search/filter, media preparation, or nested field renderer. Persistence is owned by its parent editor; no independent autosave write. |
| `components/qr/leads-table.tsx` | Input primitive, selection/search/filter, media preparation, or nested field renderer. Persistence is owned by its parent editor; no independent autosave write. |
| `components/recipient-audiences.tsx` | Group membership/rules change actual recipient selection; retain explicit group commits and deletions. |
| `components/recruitment-cycles.tsx` | Cycle creation/archival and applicant reassignment remain explicit. |
| `components/recruitment-review-settings.tsx` | Privacy/anonymous review settings remain an explicit commit. |
| `components/resume-import-dialog.tsx` | Identity/ownership request, import preview or reviewed data application. Explicit confirmation/submission retained. |
| `components/reveal-applicant.tsx` | Operational settings, grants, invitations or schedule controls. Existing explicit commit retained; no automatic consequential action. |
| `components/roster-csv-importer.tsx` | Identity/ownership request, import preview or reviewed data application. Explicit confirmation/submission retained. |
| `components/student-profile-card.tsx` | Legacy/sample/preview surface or onboarding flow. Keep explicit demo or onboarding transitions; no automatic live publication. |
| `components/tasks/task-audience-builder.tsx` | Input primitive, selection/search/filter, media preparation, or nested field renderer. Persistence is owned by its parent editor; no independent autosave write. |
| `components/tasks/task-manager-workspace.tsx` | Bulk deadlines, closing, approving and adding recipients remain explicit; delegates content/feedback editors above. |
| `components/ui/input-group.tsx` | Input primitive, selection/search/filter, media preparation, or nested field renderer. Persistence is owned by its parent editor; no independent autosave write. |
| `components/ui/input.tsx` | Input primitive, selection/search/filter, media preparation, or nested field renderer. Persistence is owned by its parent editor; no independent autosave write. |
| `components/ui/search.tsx` | Input primitive, selection/search/filter, media preparation, or nested field renderer. Persistence is owned by its parent editor; no independent autosave write. |
| `components/ui/sidebar.tsx` | Input primitive, selection/search/filter, media preparation, or nested field renderer. Persistence is owned by its parent editor; no independent autosave write. |
| `components/ui/textarea.tsx` | Input primitive, selection/search/filter, media preparation, or nested field renderer. Persistence is owned by its parent editor; no independent autosave write. |
| `components/views/branding/accolade-list.tsx` | Input primitive, selection/search/filter, media preparation, or nested field renderer. Persistence is owned by its parent editor; no independent autosave write. |
| `components/views/branding/color-picker.tsx` | Input primitive, selection/search/filter, media preparation, or nested field renderer. Persistence is owned by its parent editor; no independent autosave write. |
| `components/views/branding/media-uploader.tsx` | Input primitive, selection/search/filter, media preparation, or nested field renderer. Persistence is owned by its parent editor; no independent autosave write. |
| `components/views/branding/tag-input.tsx` | Input primitive, selection/search/filter, media preparation, or nested field renderer. Persistence is owned by its parent editor; no independent autosave write. |
| `components/views/calendar-view.tsx` | Input primitive, selection/search/filter, media preparation, or nested field renderer. Persistence is owned by its parent editor; no independent autosave write. |
| `components/views/club-branding-editor-view.tsx` | Legacy/sample/preview surface or onboarding flow. Keep explicit demo or onboarding transitions; no automatic live publication. |
| `components/views/club-management-portal-view.tsx` | Legacy/sample/preview surface or onboarding flow. Keep explicit demo or onboarding transitions; no automatic live publication. |
| `components/views/club-manager/broadcast-messages-view.tsx` | Legacy/sample/preview surface or onboarding flow. Keep explicit demo or onboarding transitions; no automatic live publication. |
| `components/views/club-manager/events-meetings-view.tsx` | Legacy/sample/preview surface or onboarding flow. Keep explicit demo or onboarding transitions; no automatic live publication. |
| `components/views/club-manager/roster-roles-view.tsx` | Legacy/sample/preview surface or onboarding flow. Keep explicit demo or onboarding transitions; no automatic live publication. |
| `components/views/explore-view.tsx` | Input primitive, selection/search/filter, media preparation, or nested field renderer. Persistence is owned by its parent editor; no independent autosave write. |
| `components/views/inbox-view.tsx` | Legacy/sample/preview surface or onboarding flow. Keep explicit demo or onboarding transitions; no automatic live publication. |
| `components/views/interview/workspace-question-card.tsx` | Input primitive, selection/search/filter, media preparation, or nested field renderer. Persistence is owned by its parent editor; no independent autosave write. |
| `components/views/leader-dashboard-view.tsx` | Legacy/sample/preview surface or onboarding flow. Keep explicit demo or onboarding transitions; no automatic live publication. |
| `components/views/leader-dashboard/speed-review-mode.tsx` | Legacy/sample/preview surface or onboarding flow. Keep explicit demo or onboarding transitions; no automatic live publication. |
| `components/views/scheduler/create-schedule-dialog.tsx` | Operational settings, grants, invitations or schedule controls. Existing explicit commit retained; no automatic consequential action. |
| `components/views/screening-dashboard-view.tsx` | Sensitive score rules clear prior flags when saved; Save rules / Preview / Apply flags remain explicit. |
| `components/views/student-onboarding-wizard.tsx` | Legacy/sample/preview surface or onboarding flow. Keep explicit demo or onboarding transitions; no automatic live publication. |

## Reliability design

- Shared `AutosaveQueue` serializes immutable snapshots and drains newer edits after an acknowledgement, with an 850 ms debounce and explicit blur flush. The availability queue remains domain-specific; the interview session retains its existing tested 800 ms serializer through a shared lifecycle/recovery adapter.
- Controlled editor state is never replaced by save responses. Normalization remains server-side; typing, selection, and focus stay local.
- `EditorDraft` uses the existing Prisma/Postgres/server-action architecture. Drafts are private to the authenticated account, resource and club. Every read/write rechecks live grants inside the transaction, then serializes first creation and compares revisions. Mutation IDs make acknowledgement retries idempotent. Clearing writes a revision tombstone.
- The draft API cannot call publication, notification, email, submission, evaluation finalization, or assignment APIs. Domain validation still runs at the explicit commit. Incomplete private drafts are accepted within a bounded JSON size.
- Application answers, profile sections, public club profiles, templates, kits and existing interview drafts use their domain write paths with content tokens or existing revisions. Submitted applications and finalized reviews stay immutable.
- Tab-local sessionStorage recovery is versioned, scoped to the authenticated identity/resource (interviews use their unique owner-bound record ID), and expires after seven days. Files and credentials are excluded. Storage failures leave unload protection active. Divergent baselines offer inline Restore/Discard instead of silently overwriting newer data.
- Blur, return online and visibility changes flush pending edits. Shell links/navigation buttons wait for registered dirty editors before replaying navigation. Browser unload warns while unsaved; its asynchronous request is best-effort, so recovery is written before the request. Explicit internal close/next controls flush their editors.
- “Saved” is displayed only after acknowledgement. Failures retain the text and offer Retry. Draft cleanup failure never turns a successful domain commit into a failed one; this tab retains a consumed-revision marker.

## Boundaries and operational requirements

- The new Prisma migration is prepared and tested in disposable PGlite only. It has **not** been applied to any configured database. It must be reviewed and applied before releasing editors that use `EditorDraft`. The migration follows the repository’s restricted server table ownership/RLS pattern.
- Private staged drafts are per author, not a shared live document. Another author’s published configuration is protected by existing domain version checks where available; re-opening a staged draft against a changed baseline asks for recovery. Club-profile publication now also checks a canonical published-profile compare token under the existing club transaction lock.
- Recovery uses this tab’s sessionStorage, not permanent browser storage. Closing a tab after cancelling/ignoring an unload warning can lose edits that never reached the server. Storage denial/quota exhaustion also limits local recovery. Browser Back or programmatic unmounts retain the recovery copy; the hook also attempts a final save for shared queue editors.
- If a domain commit succeeds but remote draft cleanup fails, the consumed-revision marker prevents this tab from reopening it. A different device may still see that old private draft until it is discarded; it can never publish or submit itself.
- One new compose draft is retained per author/context (for example New announcement). Existing items, submissions, rounds and assignments use separate resource keys. New draft staging is resumed by reopening that editor; it is not a new shared Drafts listing.
- Admin operations, published shared annotations/observations, sensitive recruiting/access settings, credential forms, reviewed imports and onboarding retain deliberate commits. Their drafts are not generalized into the new store in this phase.

## Local verification

- Full regression suite: **1,138 passed, 0 failed, 24 skipped** (1,162 discovered). The existing skipped suites require a separately configured local Auth/MFA/PostgreSQL/Storage environment; no live account or production database was used.
- Final focused suite after the status-render optimization: **22 passed**, including real React/Chromium desktop and mobile tests, private draft restoration, lost acknowledgement followed by new edits, successful publication despite cleanup failure, queue timing/overlap/failure, permissions/RLS, application/section/template boundaries, and club-profile concurrent authors.
- `npm run test:migrations`: passed; all **52 migrations** applied to disposable fresh and legacy databases, with all **75 tables** enforcing RLS and denying browser-role CRUD.
- `npm run typecheck`: passed.
- `npm run lint`: passed with **0 errors and 28 existing warnings**.
- `npm run build`: passed.
- `git diff --check`: passed.

Browser tests use the real shared hooks and status component with an isolated local HTTP persistence fixture. Database tests execute the production draft actions against migrated PGlite through a test adapter and exercise the real authorization helpers. Full authenticated Next/Supabase end-to-end smoke tests remain environment-gated. No deployment or production migration was run.

## Changed files

### Shared engine, draft store and schema

- `actions/applications.ts`
- `actions/club-workspace.ts`
- `actions/communications.ts`
- `actions/editor-drafts.ts`
- `actions/profile.ts`
- `hooks/use-autosave-recovery.ts`
- `hooks/use-autosave.ts`
- `hooks/use-editor-draft.ts`
- `lib/autosave-navigation.ts`
- `lib/autosave-queue.ts`
- `lib/editor-drafts.ts`
- `lib/student-applications.ts`
- `lib/student-profile.ts`
- `lib/workspace-api.ts`
- `prisma/migrations/20261015010000_editor_drafts/migration.sql`
- `prisma/schema.prisma`

### Editor integrations

- `components/applications/application-form.tsx`
- `components/club-announcements.tsx`
- `components/club-profile-settings.tsx`
- `components/club-tasks.tsx`
- `components/clubs/club-profile-editor.tsx`
- `components/communications/template-editor.tsx`
- `components/edit-student-profile-dialog.tsx`
- `components/events/club-events.tsx`
- `components/interview-kit-editor.tsx`
- `components/interview-kit-session.tsx`
- `components/interviews/panel-preview-workspace.tsx`
- `components/meeting-workspace.tsx`
- `components/tasks/task-assignment-builder.tsx`
- `components/tasks/task-manager-workspace.tsx`
- `components/tasks/task-review-workspace.tsx`
- `components/ui/autosave-status.tsx`
- `components/views/application-tracker-view.tsx`
- `components/views/club-manager/application-builder-view.tsx`
- `components/views/club-manager/interview-pipeline-builder-view.tsx`
- `components/views/leader-dashboard/live-leader-workspace.tsx`

### Tests and harnesses

- `tests/autosave-actions.test.cjs`
- `tests/autosave-browser.test.cjs`
- `tests/autosave-queue.test.cjs`
- `tests/club-marketing.test.cjs`
- `tests/club-settings-ui.test.cjs`
- `tests/editor-drafts.test.cjs`
- `tests/helpers/autosave-ui-harness.cjs`
- `tests/interview-profile-kit-ui.test.cjs`
- `tests/interview-session-ui.test.cjs`
- `tests/live-applicant-views.test.cjs`
- `tests/personal-workspace.test.cjs`
- `tests/recruitment-round-setup.test.cjs`
- `tests/tasks-workflow.test.cjs`

### Audit/report

- `docs/autosave-audit.md`

