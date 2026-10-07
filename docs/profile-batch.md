# Profile batch: implementation and review

## Read-only audit

The starting working tree was clean at `d349235` (Admin/suspension), above the four existing main commits. StudentProfile is the canonical education/profile record. There were no equivalents for high school, gender, pronouns or transfer status. `scholarStatus` JSON already supports multiple selections and is retained. Its historical Walentas/Other/Not Applicable records remain valid; the editor offers the six requested official programs with Yes/No progressive disclosure.

Every audited runtime GPA writer already used 0–4, with no stored scale discriminator. Résumé extraction accepted three decimal places; the profile viewer historically rendered two. No production/staging data was accessed. Values are preserved, not converted. New writes accept finite GPA 0–4 with at most three decimals. The additive P2 migration removes the row CHECK and installs a BEFORE INSERT / UPDATE OF GPA trigger: inserts and changed GPA values must be canonical; unchanged historical values remain untouched. API schemas reject explicitly supplied invalid GPA values. Section edits omit unchanged GPA, including Education edits, so historical GPA never prevents unrelated changes. Incompatible historical values appear as unconfirmed in the student viewer and are withheld from verified recruitment GPA/filter/rule projections until corrected. Explicitly correcting GPA requires a verified supported value, never an invented conversion.

Raw graduation year appeared in anonymous review, identified CRM/pipeline, audited identity reveal, voting filter payloads, and member/task projections. The existing task year helper had its own calculation and exposed the actual graduation year. It now delegates to the canonical academic-year helper. Existing task audience graduation cohorts remain readable/server-enforceable; new task audience choices use academic-year labels, and individual member payloads no longer carry graduation years.

The audit found public `headshots` objects and server-derived owner upload paths. The first profile migration provisions the established bucket/policies on fresh Supabase. The P2 follow-up makes that bucket private without deleting objects, converts existing owner-matching public references to stored object paths, and adds restrictive read/bucket-mutation guards. External URLs were supported by a generic validator, but no live product input requires them; actual URL-based examples are fictional presentation fixtures. New live references therefore accept only uploaded owner-scoped paths. Historical unmatched external references remain stored but are not rendered as private images.

## Canonical fields and privacy

- Own student profile: actual `gradYear`, nullable `highSchool`, `gender`, `pronouns`, boolean `transferStudent` (false default), existing `scholarStatus`, and existing GPA/scores.
- Recruitment: explicit profile allowlist preserves established identity/education fields when authorized. Actual graduation year is removed. `academicYear` is computed once on the server: academic start year advances in August UTC; level = academic start + 5 − spring graduation year. First through Eighth Year, incoming/beyond-eighth fallbacks, and `*` for transfer use the same helper. This is an estimate from expected graduation, not a measure of time enrolled.
- High school/pronouns remain personal-profile fields. Transfer status is shared only as the academic-year asterisk. Generic Admin record inspection explicitly selects its previously established fields, so adding schema columns does not disclose these new fields or gender automatically. Existing elevated, audited Admin inspection of graduation year remains an administrative oversight capability; it is not a club recruitment payload. Authorized support impersonation retains the existing student-profile path and guards.
- Gender is optional and null for unspecified profiles. Allowed values: Male, Female, Other, Prefer not to say. Pronouns are separately He/Him, She/Her, They/Them, Other; Other has no custom text and neither field is inferred.
- Gender requires the round's explicit Applicant Display selection. It is excluded from default/legacy configurations. Anonymous review may expose it only with that round selection; a voting/session/preview selection cannot independently grant it. Otherwise anonymous identity, free text, experiences, answers, appointments, photos and links retain their prior restrictions.
- Gender filters/counts require existing review permissions and an explicitly enabled club/round, with identified-applicant permission for identified rounds. Filtering occurs in the database. Counts use all authorized non-drafting applicants in that round, before the selected gender filter, and return the four categories including zero counts. Both run in one Repeatable Read transaction. The optional summary appears inside Filters, not every applicant card. Students cannot use these readers.
- Interview panels remain narrow, authorized projections; applicant display/voting use the shared privacy contract. Existing private résumé/download authorization, exports and API readers do not acquire the new fields by schema expansion. The authenticated account endpoint continues returning only the current student's own profile.

## Importer and photo editing

Résumés may conservatively propose an explicitly labeled high school and validated 4.0 GPA. Alternate denominators (including 4.33), excessive precision and malformed values never become confident compatible proposals. Imports never infer gender, pronouns, scholar or transfer status. Existing private upload, optimistic baseline and transactional selected-field confirmation remain intact.

The photo editor decodes JPEG/PNG/WebP, limits size/dimensions, and previews a square 512×512 PNG with a circular avatar treatment. Zoom and horizontal/vertical position are bounded so no empty pixels enter the crop. The existing uploader handles authentication, byte/MIME validation, owner-derived path and persistence. Saving attaches the cropped reference; re-editing uses the saved image, replacement generates another owner-scoped asset. All live image consumers resolve paths to `/api/profile-photos`, including the profile, account menu, crop re-edit, identified CRM, Applicant Display, voting/preview, interview panel and evaluation reviewer images. The route authorizes each request using owner identity or the established application/interview readers, compares the exact currently authorized photo reference, and downloads via service role only after authorization and a private-bucket check. It returns image bytes with private/no-store caching, Cookie variation and nosniff; it exposes no signed bearer download URL. Direct browser Storage reads/signed downloads are denied even under legacy permissive policies. Dialog dimensions are explicitly viewport bounded with scrolling. The original uncropped file is not separately persisted. Cancellation may leave an unattached upload, as in the existing uploader.

## Reproducible disposable checks

`node scripts/prepare-profile-e2e.cjs` provisions only `outclass-profile-p2-e2e` on localhost 58321–58329 and invokes `npm run db:deploy`. `node scripts/verify-profile-disposable.cjs` exercises real PostgreSQL constraints, RLS/role privileges, anonymous/authenticated PostgREST CRUD denial and foreign/anonymous photo upload denial; it creates fictional recruitment fixtures. `node scripts/run-profile-local.cjs validate` pins all database/Auth variables to that disposable project while running the normal validation command. `dev` starts localhost:3110.

`OUTCLASS_PLAYWRIGHT_MODULE=<installed playwright module> node scripts/verify-profile-browser.cjs` uses real Chrome, Supabase Auth cookies, server actions, database and Storage. It verifies fields, photo upload/crop/zoom/reposition/save/reload/re-edit/replacement/invalid decode, account image, desktop/tablet/mobile bounds, leader UI and API privacy/filter/counts, and anonymous/unauthorized denial. No application or Auth mocks are used in this browser check.

## Validation results

- Focused P2/profile/photo/recruitment/interview/voting/Demo compatibility suite: **71 passed, zero failed, zero skipped**.
- Normal validation, pinned to the disposable project: **723 tests, 717 passed, zero failed, six existing environment-gated integration tests skipped**. All 29 migrations apply on fresh and legacy databases; all 53 application tables enforce RLS and deny browser-role CRUD. Lint passes with 26 warnings/zero errors; TypeScript and production build pass.
- A newly created `outclass-profile-p2-e2e` Supabase project deployed through authoritative `npm run db:deploy`. The final `20261007010000_profile_gpa_private_photos` checksum matches the deployed migration. Real PostgreSQL tests prove legacy GPA survives name/photo/link edits and permits correction while rejecting out-of-range/negative/excess-precision changes. Actual Auth/Storage denies foreign/anonymous uploads; headshots are private; browser StudentProfile CRUD is denied.
- Real Chrome against the production build passes legacy-GPA name/Education/LinkedIn/photo/replacement persistence, explicit GPA correction, upload/crop/zoom/reposition/re-edit, profile/account avatar, desktop/tablet/mobile bounds, authorized leader photo retrieval, outsider/anonymous/public-URL denial, and existing recruitment/anonymous UI privacy/filter/count behavior.
- Historical Demo values and task audience targeting remain preserved.
- No remaining P0/P1/P2 identified. P3: unattached/replaced photo asset cleanup; original uncropped images are not retained. Historical external/unmatched references are retained but require a replacement upload to display privately.
- HEAD remains `d349235`; no commit, push, production or staging changes. `git diff --check` passes.

## P2 fix files changed in this follow-up

- `actions/applicant-intelligence.ts`
- `actions/evaluations.ts`
- `actions/interview-resumes.ts`
- `actions/profile.ts`
- `actions/storage.ts`
- `app/api/profile-photos/route.ts`
- `components/edit-student-profile-dialog.tsx`
- `components/shell/product-shell.tsx`
- `components/views/leader-dashboard/live-leader-workspace.tsx`
- `components/views/unified-student-profile-view.tsx`
- `docs/profile-batch.md`
- `lib/anonymous-review.ts`
- `lib/applicant-display.ts`
- `lib/demo/store.ts`
- `lib/profile-photo.ts`
- `lib/student-profile.ts`
- `lib/workspace-api.ts`
- `prisma/migrations/20261007010000_profile_gpa_private_photos/migration.sql`
- `scripts/prepare-profile-e2e.cjs`
- `scripts/run-profile-local.cjs`
- `scripts/verify-profile-browser.cjs`
- `scripts/verify-profile-disposable.cjs`
- `tests/interview-profile-kit-ui.test.cjs`
- `tests/product-integration.test.cjs`
- `tests/product-shell-focus.test.cjs`
- `tests/profile-p2.test.cjs`
- `tests/profile-presentation-cleanup.test.cjs`
- `tests/profile-upload-boundary.test.cjs`
- `tests/voting-display-snapshot.test.cjs`

## Exact changed files (complete working tree)

- `actions/applicant-intelligence.ts`
- `actions/club-access.ts`
- `actions/crm.ts`
- `actions/evaluations.ts`
- `actions/interview-resumes.ts`
- `actions/organization-members.ts`
- `actions/platform-admin.ts`
- `actions/profile.ts`
- `actions/storage.ts`
- `actions/tasks.ts`
- `actions/voting.ts`
- `app/api/profile-photos/route.ts`
- `app/api/workspace/route.ts`
- `components/club-members.tsx`
- `components/demo-workspace.tsx`
- `components/edit-student-profile-dialog.tsx`
- `components/live-voting/board-decision-mode.tsx`
- `components/organization-member-management.tsx`
- `components/profile-photo-crop.tsx`
- `components/shell/product-shell.tsx`
- `components/tasks/task-audience-builder.tsx`
- `components/tasks/task-manager-workspace.tsx`
- `components/tasks/task-review-workspace.tsx`
- `components/views/leader-dashboard/live-leader-workspace.tsx`
- `components/views/student-onboarding-wizard.tsx`
- `components/views/unified-student-profile-view.tsx`
- `docs/profile-batch.md`
- `lib/anonymous-review.ts`
- `lib/applicant-display.ts`
- `lib/club-customization-model.ts`
- `lib/demo/seed.ts`
- `lib/demo/store.ts`
- `lib/demo/task-seed.ts`
- `lib/demo/tasks.ts`
- `lib/demo/validate.ts`
- `lib/demo/voting.ts`
- `lib/onboarding-schemas.ts`
- `lib/photo-crop.ts`
- `lib/profile-photo.ts`
- `lib/recruiting-rules.ts`
- `lib/recruitment-profile.ts`
- `lib/resume-import.ts`
- `lib/scholar-status.ts`
- `lib/student-profile.ts`
- `lib/task-presentation.ts`
- `lib/tasks.ts`
- `lib/voting-presentation.ts`
- `lib/workspace-api.ts`
- `prisma/migrations/20261006020000_profile_recruitment_visibility/migration.sql`
- `prisma/migrations/20261007010000_profile_gpa_private_photos/migration.sql`
- `prisma/schema.prisma`
- `scripts/prepare-profile-e2e.cjs`
- `scripts/run-profile-local.cjs`
- `scripts/verify-profile-browser.cjs`
- `scripts/verify-profile-disposable.cjs`
- `tests/anonymous-review.test.cjs`
- `tests/campus-events.test.cjs`
- `tests/club-customization.test.cjs`
- `tests/demo-interview-workspace.test.cjs`
- `tests/durable-voting.test.cjs`
- `tests/integration-audit.test.cjs`
- `tests/interview-profile-kit-ui.test.cjs`
- `tests/member-workspace-ui.test.cjs`
- `tests/organization-members.test.cjs`
- `tests/product-integration.test.cjs`
- `tests/product-shell-focus.test.cjs`
- `tests/profile-batch.test.cjs`
- `tests/profile-p2.test.cjs`
- `tests/profile-presentation-cleanup.test.cjs`
- `tests/profile-upload-boundary.test.cjs`
- `tests/tasks-workflow.test.cjs`
- `tests/tasks.test.cjs`
- `tests/voting-board.test.cjs`
- `tests/voting-display-snapshot.test.cjs`
