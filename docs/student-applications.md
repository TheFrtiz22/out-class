# Student applications

The existing `tracker` view now presents a structured application overview and a focused per-club workspace. Routes and the DRAFTING → SUBMITTED transition are unchanged. The overview prioritizes drafts, supports status filters, shows saved responses and real interview bookings, and handles empty, loading, and retry states. Accepted, rejected, and waitlisted states are separate and do not imply membership creation or offer acceptance.

## Data and components

- `actions/applications.ts`: authenticated application read, draft save, and submission. Reads are scoped to the current student and select only student-facing club/questions/answers/round/booking data. No evaluations or interviewer notes are exposed.
- `lib/student-applications.ts`: shared answer validation, word counting, status labels, and next-step copy.
- `components/views/application-tracker-view.tsx`: overview, application focus handoffs, real status/decision presentation, submitted response view, and existing recruitment timeline.
- `components/applications/application-form.tsx`: real question rendering, explicit save state, required/word-limit validation, PDF upload/document URL responses, final confirmation, and unsaved-change warnings.
- `lib/application-state.tsx` and `lib/data.ts`: synchronize confirmed server data with the existing shared application state; remove invented question counts and deadline estimates for newly started applications.
- `tests/student-applications.test.cjs`: validation and persistence-boundary regression coverage.

Saving uses explicit Save draft; there is no pretend autosave. Failed requests retain responses in memory. Uploads reuse existing signed storage and do not attach until saved. Leaving/reloading an unsaved form warns the student. Submission changes the view only after the server confirms success. Authenticated application reads never fall back to local sample records. Unauthenticated previews clearly explain the sign-in requirement.

## Persistence protections

The existing server save action previously permitted overwriting submitted answers. Both save and submit now use a transaction and a conditional DRAFTING update, preventing a draft save or repeated submission from overwriting submitted content. Required answers and essay word limits are checked on submission; unfinished and over-limit essay drafts remain saveable. Question IDs must belong to the club and must not repeat. Document URLs allow only http/https. Submission still requires a student profile and the club's first pipeline round.

## Existing model limits

- No structured application deadline exists. The UI says deadline not provided and does not invent dates, urgency, or closing rules.
- Multiple-choice questions have no option storage. They retain text responses with instructions to use choices in the club's prompt; no choices are fabricated. A proper choice picker needs backend option data.
- Questions and shared profiles are not immutable submission snapshots. The submitted view uses current question definitions; a future snapshot feature requires a data-model change.
- No decision letter, offer-response endpoint, decision release date, semester reapplication rules, or automated notification delivery is added or implied.
- Existing résumé storage configuration governs document access. Uploading and then leaving without saving may leave an unattached storage object.
- No new dependencies or schema migrations.

## Validation

Production build succeeds. Full test suite: 41 pass, four existing club-customization fixture failures. All six new application tests pass. Type checking reports the two existing nullable-context errors in `lib/club-customization.tsx`. Lint remains blocked because ESLint is not installed/configured.

Playwright checks with isolated transport fixtures cover desktop/tablet/mobile overflow, overview and decision states, required-answer validation, failed-save recovery, explicit save feedback, confirmation, submission read-only behavior, unsaved-change cancellation, and the recruitment timeline. No real users or applications are written by these tests. Actual Supabase uploads and database transactions remain unverified end-to-end locally because services are not configured.

## Private attachment contract

FILE_UPLOAD answers support existing external http(s) links or private resumes-bucket keys in the form user-UUID/filename. Uploaded keys remain internal paths, never public URLs. Server-side draft and submission validation rejects another user's key and malformed/traversal paths. The server never fetches external document links.

GET /api/application-attachments?applicationId=…&questionId=… resolves the current saved answer and signs only that key for five minutes as a download. Owners can read their own saved drafts and submissions. Other readers require current club ownership or applicants.identify, a submitted application, and a non-anonymous round. A key need not equal the student's current profile resume: application documents and profile resumes have distinct saved references. Unknown/replaced answers and cross-club question references fail closed. Existing /api/resumes remains limited to the current profile resume.

See [database deployment](database-deployment.md) for the required private bucket migration and deployed-token checks. No database answer rewrite is performed.
