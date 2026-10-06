# Interview-room backend handoff

> October 5 audit update: [Current audit repairs and release handoff](interview-audit-fixes.md) supersedes the stage migration counts, missing setup integration and anonymous-review exclusions below.

Implemented locally on October 4, 2026 against the contract in `interview-room-redesign.md`. This extends the existing InterviewRecord, InterviewKit and Evaluation system. No production deployment or database mutation was performed. The earlier planning document describes its original baseline, not the implementation status below.

The subsequent profile/question UI stage is described in `interview-room-ui.md`; it implements Education scholar controls, workspace questions/completion, the master-kit editor and scoped résumé entry. The rollout list below records the backend stage's original prerequisites; remaining UI and rollout work is clarified in that later handoff.

## Changed files and behavior

| Files | Responsibility |
| --- | --- |
| `lib/scholar-status.ts`, `lib/student-profile.ts`, `actions/profile.ts` | Nullable scholar selections, exclusive Not Applicable, required Other text, preservation on partial saves, safe legacy defaults. |
| `lib/interview-access.ts`, `utils/interview-access.ts` | Current membership, explicit offices, assignment, club, applicant ownership and original/current round anonymity checks. Transaction locks serialize authorization against membership changes. |
| `actions/organization-members.ts`, `actions/club-access.ts`, `lib/organization-authorization.ts` | Audited owner-authorized office and panel grants; existing role/removal safeguards also protect explicit office holders. ADMIN, RECRUITING_ADMIN and owner status do not implicitly confer leadership content access. |
| `actions/interview-kits.ts`, `lib/interview-kits.ts`, `actions/evaluations.ts` | Separate bank read/edit permissions; stable session snapshots; private question notes and completion IDs; closing drafts; transactional canonical Evaluation submission; immutable finals; previous-five and submitted-review projections. |
| `actions/interview-resumes.ts`, `app/api/interview-resumes/route.ts`, `app/api/resumes/route.ts` | Shared immutable document capture, annotations and restricted revision history; authenticated PDF/range delivery. The legacy current-resume route is now applicant self-service only. |
| `actions/crm.ts`, `actions/applicant-intelligence.ts`, `actions/platform-admin.ts`, `lib/anonymous-review.ts` | Remove private drafts/closing text from broad or platform inspection responses; preserve anonymous projections. |
| `lib/demo/interview-foundation.ts`, `lib/demo/seed.ts`, `lib/demo/store.ts`, `lib/workspace-api.ts` | Isolated local demo persistence/adapters and explicit fictional grants. |
| `prisma/schema.prisma`, `prisma/migrations/20261004000000_interview_foundation/migration.sql` | Additive persistence and database enforcement described below. |
| `tests/interview-foundation*.test.cjs`, `tests/interview-resume-download.test.cjs`, `tests/helpers/interview-harness.cjs`, existing interview/profile/privacy/demo tests | Authorization, revocation, submission retries, snapshot stability, annotation revisions, history scope and SQL enforcement. |

The existing `package.json` and `pnpm-lock.yaml` changes from the preceding dependency setup were preserved.

## Server integration

- `setMemberInterviewOffices` persists explicit PRESIDENT / VICE_PRESIDENT / BOARD assignments on the existing club membership and audits changes. Only active verified owners can manage these grants. `setInterviewPanelAssignment` manages explicit applicant/round assignments under the same authority. No migration infers offices or panel assignments from roles or room arrays.
- `getInterviewKit` permits ordinary currently assigned interviewers to read the relevant bank. `saveInterviewKit` requires an explicit qualifying office. Existing sessions retain their question snapshots after master edits.
- `openInterviewSession` and `saveInterviewSession` retain revision checks and per-interviewer ownership. Drafts include completedQuestionIds, question notes, stable off-script questions, applicantQuestions, additionalNotes and nullable score. Completion creates/links the canonical Evaluation atomically. Exact completion retries return the already completed result; conflicting subsequent writes fail.
- `getSubmittedInterviewReview` exposes closing fields only to currently authorized leadership or the assigned author. Private question notes are excluded. Historical reads survive round advancement but still enforce current authorization and privacy.
- `getPreviousInterviewScores` derives the interviewer from authentication, scopes to club and stable round ID, excludes the current application, requires a completed record and canonical evaluation, applies current assignment/privacy checks, and orders by completedAt then ID descending before taking five.
- `getInterviewApplicantPanel` returns the narrow applicant panel. `pinInterviewResume` captures a PDF once per application/round. `getInterviewResumeAnnotations`, `saveInterviewResumeAnnotation`, `deleteInterviewResumeAnnotation` and `getInterviewAnnotationHistory` enforce independent visibility, author/moderator rights and per-row revisions. Deletion is a tombstone; original content is available only through the restricted history endpoint.
- Fetch PDF bytes through `/api/interview-resumes?clubId=...&applicationId=...&roundId=...&documentId=...`. Every request, including a range request, reauthorizes; responses are private/no-store. No reusable storage URL is returned.

Documents are immutable private PostgreSQL bytea snapshots, capped at 10 MB, with source path, MIME, size and SHA-256. This avoids a mutable object reference and storage-retention races but increases database storage/backup costs. External resume URLs fail closed; the applicant must upload a private PDF before capture. Anchors persist page, offsets, quote/context and normalized rectangles with structural validation. PDF text-layer rendering and verification of offsets against extracted document text are not implemented by this backend foundation.

The subsequent [résumé UI stage](interview-resume-ui.md) implements PDF text-layer rendering, pinned-document text-anchor verification and the explicit president/VP moderation entry point. Its handoff supersedes those foundation-stage gaps; it introduces no additional migration.

## Forward-only migration

Only `20261004000000_interview_foundation` is added; applied migrations were not edited or replayed.

- Adds nullable StudentProfile scholarStatus with SQL validation and ClubMember interviewOffices with allowed-value checks.
- Adds Evaluation roundId, submittedAt and applicantQuestions. Backfills only unambiguous existing explicit InterviewRecord-to-Evaluation links; never resolves rounds solely by display name. Historical scores are preserved, including non-half-point scores. Unresolved legacy evaluations remain unmapped and block conflicting new submissions pending deliberate reconciliation.
- Replaces the name-based full unique index with stable application/interviewer/roundId uniqueness and a partial legacy-name unique index for unmapped rows.
- Creates InterviewPanelAssignment, InterviewResumeDocument, InterviewResumeAnnotation and InterviewAnnotationRevision, with foreign keys and supporting indexes.
- Adds SQL-only scope/identity checks, immutable snapshots, append-only annotation history, revision enforcement, protected submitted Evaluation/InterviewRecord update/delete behavior, and new-score validation (finite 1–10 in 0.5 increments). Protects against unlink/reset and cascading deletion of final reviews.
- Membership removal/inactivation clears offices and revokes assignments; removal of participation permissions also revokes assignments. Rejoining does not restore them automatically.
- Enables RLS and revokes PUBLIC, anon and authenticated access to the four new tables. Server access uses the existing trusted database path; browser roles receive no direct CRUD policies.

## Validation and rollout prerequisites

Migration validation used fresh, disposable **in-memory PGlite** instances, with no database connection URL or production target. All 22 repository migrations pass fresh/legacy validation; all 47 tables pass browser-role denial/RLS checks. Focused database tests preserve an 8.25 historical score and reject new invalid scores, final edits/deletes, scope violations and unsafe annotation revisions.

The complete `npm test` run passes: **500 tests, 498 passed, 0 failed, 2 skipped**. The skipped tests require external native PostgreSQL/concurrency and Next/Auth/MFA/SMTP integration services. Typecheck and Prisma client generation pass. ESLint reports no errors and 31 existing warnings. `git diff --check` passes.

Before any separately authorized deployment:

1. Reconcile release identity, checksums and exact catalog drift. The planning inspection found four earlier repository migrations absent from production history (`applicant_intelligence`, `durable_voting`, `corkboard`, `task_workflows`). Review those independently; do not blindly replay, reset, use db push, mark applied to suppress drift, or replay the Supabase archive.
2. Rehearse the complete intended migration chain on a verified disposable native PostgreSQL staging database with representative legacy data and real concurrency. PGlite and serialized action harness tests do not establish native lock scheduling or hosted Supabase behavior.
3. Obtain verified office mappings and create explicit office/panel grants through authorized membership actions. Existing room arrays do not automatically grant access. Resolve ambiguous legacy Evaluation mappings without rewriting historical scores.
4. Wire the frontend to the new narrow actions and scoped resume proxy before rollout. Existing reviewer links to `/api/resumes` now deny access. The Education controls, redesigned columns, score slider, PDF text selection/zoom and leadership reopening UI remain a separate frontend implementation. Do not deploy the backend access transition without that integration.
5. Validate real Supabase storage capture, deployment database-role permissions, bytea storage capacity, retention/backups, PDF renderer behavior, browser revocation handling, and end-to-end Auth/MFA/onboarding. Production build/browser acceptance and external service integration were not run. Previously issued legacy signed URLs cannot be recalled before expiry.

No deployment, production test mutation, database reset or db push was performed.
