# Collaborative interview rooms

Implementation in progress on `codex/collaborative-interview-rooms`. Production has not changed for this feature.

Each authorized panel joins the server-resolved booking/room/candidate context. Manually assigned, unscheduled panels use a candidate-specific room. The existing per-interviewer InterviewRecord, canonical Evaluation submission, document snapshots and shared résumé annotations remain the source of private work and final reviews.

Collaboration uses authorized server polling every three seconds, following the existing annotation/voting refresh pattern. There are no browser database grants, public realtime channels, shared private notes or new paid services. Responses contain only current authorized presence, an ordered bank-question snapshot and an eligible invitation. Presence expires after 45 seconds and deduplicates member IDs. Every refresh and operation checks current account, membership, assignment, room approval and anonymity. Network errors retain private work and offer reconnect.

Bank selection saves existing private edits first, then updates the shared selection under the existing application lock. Room question snapshots are append-only. Other participants use their own notes; incoming changes wait behind typing/composition, unsaved work or personal completed-question review. Opening a pending question does not complete it. Post-interview and submitted screens never follow incoming selections.

Next candidate is resolved by the existing freshly authorized queue on the server. The source must already have a final review. A short-lived server receipt identifies the exact destination; the client loads that destination's own record and applicant panel before confirming arrival. Only confirmed ordinary advances invite eligible peers present in the source room. Invitation acceptance rechecks source completion, both scopes, destination eligibility and the original invitation; it never issues follow-on invitations. Declining changes no draft. Invitations expire after ten minutes, are invalidated by newer sender moves/access changes, and are represented by one persistent notice. A short browser tab lease stores only random invitation/tab IDs to avoid duplicate notices across tabs; server dismissal and confirmation remain authoritative.

Demo Mode uses the same adapter surface, fictional local state and explicitly labeled simulated Alex controls. It makes no live collaboration calls and is not evidence of real multi-user behavior.

## Database change

`20261009010000_interview_collaboration` creates InterviewCollaboration, InterviewPresence, InterviewMove and InterviewInvitation. SQL-only foreign keys, scope checks, immutable snapshot/receipt identities and revisions enforce integrity. RLS is enabled and PUBLIC/anon/authenticated CRUD is revoked. Trusted bounded server roles must own the new tables, matching the existing interview tables. It does not rewrite reviews, evaluations, assignments or existing columns; existing application writers remain compatible. Apply only this authorized SQL through the established reviewed/verified Prisma registration process when unrelated pending migrations exist; never blanket-resolve an unapplied migration.

Staging application succeeded on 2026-10-09 at 20:18 UTC; SQL SHA-256 `8e9ebb2f61dc19296443fc11124886fe7a68a29478c5051fd5e395dd007dce91`. Actual tables, triggers, RLS, browser denial and bounded-runtime ownership were verified before recording it. Existing 29 migration checksums matched and other ledger entries were unchanged. The pre-existing unrecorded `20261008000000_school_requests` and `20261009000000_recruitment_offers` were not applied by this task.

## Evidence and remaining release gates

- Isolated PGlite fresh/legacy migration checks: 32 migrations, 58 tables, all browser-role CRUD denied.
- Focused UI and Demo tests: 25 passed, including composition-safe pending selection, no auto-submission on Proceed, private draft retention, intentional endpoint/half-point scoring and isolated simulation.
- Native disposable PostgreSQL: simultaneous picks resolve to revisions 1/2, own-tab revision conflict rejects a stale writer, private records remain independent, source submission gates navigation, exact queue destination is authorized, duplicate confirmation is idempotent, invitations appear only after arrival, Stay leaves the unfinished review untouched, outsiders/applicants/revoked members are denied.
- Full suite run: 920 tests; 908 passed, 9 skipped, three old navigation harness tests needed the new prepare/confirm action stubs. Affected rerun is pending; skipped external integration checks are not passed evidence.
- Typecheck passed. ESLint has no errors; existing warnings remain. Initial production build passed, with an expected local missing DATABASE_URL diagnostic during fallback directory prerender. Final changed-code checks and hosted staging/two-browser verification remain pending.

Before merge: finish affected tests/checks, inspect two independent authenticated staging browsers and narrow network projections, test stale/duplicate/revoked invitations and independent submissions, then verify current main. Before production SQL: verify a current usable encrypted backup and restore, current ledger/catalog, backward compatibility and the prior production deployment. Apply the verified collaboration migration, confirm runtime permissions, merge through protected checks, and let the existing main-branch Vercel pipeline deploy. Check the exact source/domain, real synthetic multi-user behavior and runtime errors. Do not claim live completion based on the build or Demo.
