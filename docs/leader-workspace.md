# Club-leader recruitment workspace

Authenticated leaders now enter a server-backed recruitment workspace. Club selection comes from their president/recruitment-lead memberships. Each selected club mounts a separate workspace and fetches authorized data; late responses from the previous club are discarded. Unauthenticated local CRM tools remain available with an explicit local-preview label, preserving existing saved views, pipeline, leads, live-voting and local bulk workflows without passing real applicants into simulated actions.

## Interface

- Compact, horizontally contained applicant table with identity, education, round, application status, actual average evaluation score, and evaluation count.
- Search; round/status/review-state/major/year/GPA/SAT filters; sortable name/year/status/score columns; compact/comfortable density. Missing scores remain blank and sort last. Academic thresholds retain strict greater-than semantics.
- Counts for submitted applicants, applicants without evaluations, interviewing, accepted, and each existing pipeline round. These are all available applications, not a fabricated recruitment cycle. No unsupported round targets or offer counts.
- Accessible side drawer preserves table filters and scroll context. It displays actual profile/avatar, experience, links, question responses, saved scores/notes, and round/status controls. Previous/next follows the current filtered sort order. Escape closes, with unsaved-review confirmation; `/` focuses search outside editable controls.
- Manual 1–10 evaluation saving uses the existing per-reviewer/per-round upsert. Notes require a score because the backend stores them as part of an evaluation. Average scores include all saved evaluations across rounds. No new rubric is invented.
- Presidents and recruitment leads can move rounds. The existing president-only status rule is retained for every status mutation. Status changes require confirmation and do not imply email delivery. Moving a round does not change application status.

## Authorization fixes

Existing CRM actions authorized membership in a supplied club but then mutated applications by application ID alone. Round changes now verify the target round belongs to that club and condition the application write on both club ownership and non-draft state. Status updates also condition writes on the authorized club and non-draft state.

Evaluation writes now verify that the application and round belong to the authorized club, and reads scope the application relation to that club. Existing allowed-role lists and the score range remain intact. Five regression tests cover foreign round/applicant rejection, scoped status changes, president permissions, scoped evaluation reads, and reviewer identity/scoring.

## Changed areas

`components/views/leader-dashboard/live-leader-workspace.tsx` implements the live workspace. `leader-dashboard-view.tsx` routes authenticated users to it and retains labeled local tools, with improved legacy drawer semantics and keyboard row entry. `actions/crm.ts` adds profile experience/question/booking details to the authorized read and scopes mutations. `actions/evaluations.ts` enforces club isolation. `tests/leader-isolation.test.cjs` covers the security boundaries.

No schema migration or new dependencies. Persisted cycle targets, saved CRM views, bulk decisions, configurable rubrics, decision delivery, and cross-round score weighting are not added. Existing local tools are not represented as backend capabilities.

## Validation

Production build passes. Full suite: 51 passed, four existing club-customization fixture failures. Two existing nullable-context TypeScript errors remain in `lib/club-customization.tsx`; ESLint is not installed. Browser checks use isolated transport fixtures, not real applicant writes, and cover desktop/mobile layouts, search, drawer context, evaluation saving, separate round/status updates, and decision confirmation. Live Supabase/database operations remain unverified end-to-end without configured services.
