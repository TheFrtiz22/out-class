# Profile and question-workflow UI handoff

Implemented locally October 5, 2026, using the existing backend foundation and OutClass components, type scale, colors and responsive conventions. No production deployment or database mutation was performed.

## Completed behavior

- Education editing puts Scholar status below graduation year and above GPA. Native labeled checkboxes support multiple selections; Not Applicable clears other selections and choosing another status clears Not Applicable. Other requires a bounded scholarship name. Clearing every selection saves unanswered/null. Existing section saves retain unrelated education, résumé and experience data. The profile Education display also shows named selections.
- The exact tab label is **Interview master kit**. Its editor identifies the selected round and supports add/edit/remove/reorder with stable IDs. Explicit presidents, vice-presidents and board members receive editing controls; ordinary assigned interviewers get a read-only bank. Failed/version-conflicted saves retain edits and offer explicit reload with a discard warning. Existing interview snapshots keep their wording.
- The interview workspace uses three columns on desktop: narrow applicant panel, widest question workspace, personal completed-question column. Smaller screens stack the same workflow and offer a direct link to completed questions. Questions expand within the middle workspace; only résumés use an overlay.
- Applicant data comes from the narrow authorized panel action. The queue now uses `getInterviewWorkspace`, a current-assignment, club and privacy-scoped action that returns names, round IDs and this interviewer's completion metadata. It does not load academic metrics, answers, closing text or another interviewer's private draft. Navigation/progress use stable round IDs. Identity changes remount the private session.
- Opening or typing does not complete a question. **Save and close** saves notes and completion together, and moves/highlights the question only after the server acknowledges success. Failed saves retain the active question and text. Completed questions reopen for personal revisions until final submission. Autosave preserves edits made during an in-flight save and uses the acknowledged next revision. A manual conflict-refresh path retains local text and existing off-script IDs/completions before an explicit retry.
- The bank fetch is available to assigned interviewers. Existing snapshot IDs open their saved wording; newly used bank questions preserve their stable ID in the per-session additional-question snapshot. Off-script questions use unique IDs and persist through the same draft flow.
- The existing closing-review step now uses the canonical backend fields, an initially unscored half-point slider, scoped previous-five history and explicit **Save and finish**. **End interview** and Ctrl/Command+Enter only open the draft review. Submitted reviews stay read only.
- The résumé thumbnail pins/reuses the shared document version. Live PDF bytes come through the authenticated scoped proxy; demo bytes come from a bundled fictional PDF. Opening rechecks access. Missing images have a fallback; unavailable résumé capture has a retry state. Radix Dialog handles focus trapping/Escape, and closing restores thumbnail focus. Full annotation controls are deferred to the next stage.
- Explicit office grants are included in workspace membership projections and enable workspace navigation without granting unrelated review/scheduling permissions. No ADMIN/recruiter/title inference was added.

## Changed files for this UI stage

| Area | Files |
| --- | --- |
| Scholar controls/display/helpers | `components/edit-student-profile-dialog.tsx`, `components/views/unified-student-profile-view.tsx`, `lib/scholar-status.ts` |
| Kit tabs/editor/access navigation | `components/interview-management-tabs.tsx`, `components/interview-kit-editor.tsx`, `components/club-workspace.tsx`, `components/club-workspace-settings.tsx`, `lib/club-workspace.ts`, `lib/product-navigation.ts`, `lib/permissions.ts` |
| Workspace and document entry | `components/interview-kit-session.tsx`, `components/interview-applicant-panel.tsx`, `components/views/interview-workspace-view.tsx`, `components/views/interview/interview-mode.css` |
| Narrow queue and membership projections | `actions/interview-kits.ts`, `actions/club-overview.ts`, `lib/workspace-api.ts`, `lib/demo/interview-foundation.ts`, `components/product/design-patterns.tsx` |
| Focused tests and updated privacy expectations | `tests/interview-session-ui.test.cjs`, `tests/interview-profile-kit-ui.test.cjs`, `tests/applicant-intelligence.test.cjs`, `tests/profile-presentation-cleanup.test.cjs` |

Existing dependency changes and the backend-stage migration remain in the working tree. This UI stage adds no dependency or migration.

## Validation

Focused component tests exercise actual event handlers and save failure/retry behavior, checkbox validation/section payloads, office-gated editing and conflicts. Action tests use two different panel identities against the same persisted mock database to verify independent completion, private notes, snapshot stability and revoked access. Narrow-queue tests assert authenticated assignment/club/privacy scope and allowed response fields. Existing backend SQL/authorization tests remain in the complete test suite.

Rendered browser checks used a temporary local fixture route with isolated fictional DemoDataProvider data, which was removed afterward. Desktop and 390 × 844 mobile checks verified the column/stacked layouts, no horizontal mobile overflow, saved completion movement, snapshot wording after master edits, scholarship selection, résumé overlay and focus restoration. These are local component checks, not a hosted Supabase or native PostgreSQL acceptance test. The browser viewport was restored and the local preview process stopped.

Final checks: `npm test` passes **508 total, 506 passed, 0 failed, 2 skipped**. The skips require external native PostgreSQL/concurrency and Next/Auth/MFA/SMTP services. Typecheck, production build and `git diff --check` pass. ESLint reports **0 errors, 30 warnings**. The build uses local compilation only; no live database credentials were configured and it is not evidence of deployed database/storage compatibility.

## Remaining work and rollout

Implement text-highlight/general-note annotation controls, author attribution/moderation UI and PDF text-anchor validation next. Leadership reopening of other interviewers' submitted reviews also needs a dedicated UI using the restricted closing-review endpoint; the workspace displays only the current interviewer's personal record.

The subsequent [résumé UI stage](interview-resume-ui.md) completes the annotation/viewer/text-validation work and adds the president/VP moderation tab. The separate leadership closing-review UI remains outside that stage.

Before deployment, complete the backend handoff prerequisites: reconcile earlier migration/catalog drift, rehearse on verified disposable native PostgreSQL, configure confirmed office/panel grants, resolve ambiguous legacy evaluation mappings, and validate real Supabase storage/access revocation. The new proxy is wired for this interview workspace; unrelated review/voting résumé links still require their own authorized integration with the owner-only legacy route transition. End-to-end live authentication and storage were not used for these UI tests.
