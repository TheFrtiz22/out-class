# Applicant intelligence and shared presentation (Prompt 33)

## Architecture inspected and reused

`Application` owns applicant answers and the current `PipelineRound`; `Evaluation` is the existing per-application, reviewer-membership and round-name score/review. `InterviewRecord` owns author-private question notes, a kit snapshot, draft, privacy snapshot and completion timestamp. `anonymousApplication` is the existing allowlist projection. The live applicant drawer and Interview Mode already consume the authorized CRM pipeline. The live board presentation saves application decisions; the older local voting preview is a fictional browser transport, not a production ballot service.

Prompt 31's focused interview/session UI and applicant/board views are extended in place. Prompt 32's effective-user authorization and shared Prisma audit extension remain the authorization boundary: observations use the effective reviewer identity, while support mutation audit records retain the real actor.

## Field inventory and privacy

| Existing source | Configurable fields | Anonymous review |
| --- | --- | --- |
| StudentProfile | Name, headshot, major, graduation year, GPA, SAT, ACT composite/sections, biography | Only graduation year and academic metrics survive |
| Experience | Title, subtitle, period | Withheld; no separate activity/work/research/project categories exist |
| Application / PipelineRound | Current round and status | Available |
| ApplicationAnswer / question | Prompt and non-file response | Withheld |
| Evaluation | Score and overall feedback, round and reviewer membership attribution | Score and round only; notes withheld |
| ApplicantObservation | Pros, Cons, author and timestamps | Withheld in full, including mutation access |
| Sensitive/private | Email, computing ID, résumé paths, LinkedIn, file-answer paths, appointments, private question notes | Not offered by the focused display contract at all |

The shared server action authorizes the club and submitted application, rechecks current membership and privacy, applies `anonymousApplication`, then constructs a new field allowlist. The client cannot request extra fields or turn off anonymization. Settings are presentation preferences, not permission grants. Other already-authorized CRM views continue to use their existing projections. Identified review requires both `applications.review` and `applicants.identify`; anonymous review requires `applications.review`.

## Pros and Cons

`ApplicantObservation` is new persisted state: independent multiple observations are not scored evaluations and do not belong in a private interview draft. Entries carry an application FK, author User FK, PRO/CON kind, bounded body, privacy marker and timestamps. Authors can edit/delete only their own entries while currently authorized for the application's club. User deletion cannot erase attribution through a cascading author FK. Application deletion follows existing application-owned data behavior.

The reviewer drawer manages entries. Interview and board presentations display configured entries through the same projection. Free-text observations could contain applicant identity, so anonymous review suppresses them rather than assuming automatic text scrubbing is safe. Existing entries remain intact. Students' application/dashboard queries do not include the relation. The new table has RLS and no PUBLIC/anon/authenticated CRUD grants.

## Canonical score and feedback

`Evaluation.score` (1–10) and `Evaluation.notes` are authoritative shared feedback. Attribution remains `Evaluation.interviewerId` and `Evaluation.round`; `createdAt` records original evaluation creation. Completion timestamps remain on `InterviewRecord`; edits continue to use existing authorization/audit mechanisms.

`InterviewRecord.draft` is private working state before completion and an immutable historical snapshot afterward. New completions atomically link `evaluationId` to the upserted Evaluation. Completed author views load current score/feedback through that link, leaving original questions and notes intact. Administrative record inspection includes the linked evaluation alongside historical draft data.

The additive migration links historical completed records only where application, reviewer, and current round name match an existing evaluation and that round name is unique within the club. It never rewrites historical score/review content. Unlinked records explicitly display “historical snapshot”; no evaluation is invented from ambiguous or renamed history. A NOT VALID score check enforces 1–10 for future Evaluation inserts/updates while retaining historical out-of-range values for a separate review. No new scoring table is introduced.

## Configuration and focused workflows

`PipelineRound.applicantDisplay` stores one version-1 field selection for both Interview and Voting; `displayVersion` provides optimistic concurrency. Empty historical configuration means the documented default field set. `interviews.manage` controls configuration in the existing interview-kit editor, not a new settings page. The interface distinguishes configured fields, actually available fields, and anonymous redactions.

`ApplicantDisplayPanel` is used by the applicant drawer, Interview Mode and the existing live board/decision presentation under `components/live-voting`. The server DTO is `ApplicantDisplay`; Prompt 34 consumes the same authorized `getApplicantDisplay` boundary for each viewer. Do not broadcast an identified proctor's payload to anonymous or unauthorized voters. Existing fictional local voting transport remains isolated; production records are never placed into its localStorage/BroadcastChannel session. The original Prompt 33 change added no voting persistence; Prompt 34 now supplies durable sessions, ballots, passes, and explicit publication. See [voting backend](voting-backend.md) and [final integration audit](product-integration-audit.md).

Demo Mode uses the existing workspace adapter and saved fictional demo state for observations and configuration. It never invokes live actions. Completed demo interview views resolve the corresponding evaluation while retaining their original snapshot.

## Migration and compatibility

New migration: `20261003000000_applicant_intelligence`. Apply only through the separately controlled deployment process before deploying code that reads its new columns. Previously applied migrations are untouched.

Round-name-based Evaluation uniqueness is historical architecture. The new interview FK is stable after a rename, but Prompt 34 must not infer immutable round identity from a historical name or migrate ambiguous historical evaluations automatically. The shared projection exposes actual available evaluations, without inventing a ballot score.

Validation uses mocked authorization/actions and isolated PGlite for SQL constraints, history preservation and browser-role denial. Live authenticated browser testing and production deployment are separate steps; no live database is used by the tests.

## Implementation file inventory

New files:

- `actions/applicant-intelligence.ts`
- `components/applicant-intelligence.tsx`
- `lib/applicant-display.ts`
- `prisma/migrations/20261003000000_applicant_intelligence/migration.sql`
- `tests/applicant-intelligence.test.cjs`
- `docs/applicant-intelligence.md`

Updated files:

- `actions/evaluations.ts`
- `actions/interview-kits.ts`
- `actions/platform-admin.ts`
- `components/interview-kit-editor.tsx`
- `components/interview-kit-session.tsx`
- `components/live-voting/board-decision-mode.tsx`
- `components/views/interview-workspace-view.tsx`
- `components/views/leader-dashboard/live-leader-workspace.tsx`
- `docs/interview-kits.md`
- `lib/demo/seed.ts`
- `lib/demo/store.ts`
- `lib/interview-kits.ts`
- `lib/workspace-api.ts`
- `prisma/schema.prisma`
- `tests/interview-kits.test.cjs`
