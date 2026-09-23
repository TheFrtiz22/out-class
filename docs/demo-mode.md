# Production-safe OutClass Demo Mode

## Enable access

Demo Mode is available automatically on the local **development** server. Open `/preview`, then the account menu → **Demo Mode: Off — enable demo**. On mobile, open the navigation drawer to reach the account menu.

For a production deployment, configure these **server-only** environment variables:

- `OUTCLASS_DEMO_ENABLED=true`
- `OUTCLASS_DEMO_ALLOWED_EMAILS`: comma-separated presenter emails. The presenter must sign in with their actual authorized account first.

The toggle is hidden from other production users. Browser flags, demo roles, and localStorage cannot grant access. No environment file or secret was added to this repository. Production access cannot be exercised as a real allowlisted presenter here without the deployed authentication environment.

Turning ON sets an HttpOnly, same-site cookie for eight hours and reloads into the isolated workspace. OFF removes that cookie and reloads the real application, preserving the actual login/session. The original local-preview browser state is not overwritten. Disabling demo access on the server removes stale demo cookies when the user returns. Other tabs receive an ON/OFF notification and reload; the presentation itself is intended for one active editing tab.

## Presenting

The account menu exposes **View As · Sample Student**, **View As · Club Leader** (all 20 clubs), and **Reset Demo**. Perspective changes remount view-local state but retain the shared demo records. Reset reconstructs the same season using its stored date anchor, clears demo customizations, and returns to the sample student. Dates are relative to the first initialization date; reset preserves that date for deterministic presentations. To start a later season with a new anchor, remove only `outclass.presentation.v1` from this browser while demo is off.

Suggested walkthrough:

1. Student Home: priorities, mixed application states, meetings, deadlines and updates.
2. Discover: sample curated selection and 20 club profiles, questions, dates and subscriptions.
3. Applications: finish the AIF draft, save it, then submit it.
4. View As AIF leader: find Jordan Avery, review responses, score or advance the round.
5. Voting mode: record an accepted/not-selected decision, then switch to student to see the outcome.
6. View As MII leader → Interviews: release/reassign a slot, open its candidate in Interview Mode, save notes and an overall 1–10 evaluation.
7. Student Calendar and Applications show the same scheduled slot. Club Settings shows the fictional member directory, question set, rounds and sample offer target.
8. Reset Demo and repeat without affecting real records.

## Data and architecture

- `lib/demo/seed.ts`: deterministic canonical graph: **20 clubs, 200 fictional students, 40–80 applications per club (1,168 total), 12–23 members per club, six or five rounds, 12 interview slots per club**. Includes draft/submitted/review/interview/final decisions, prior-round evaluations, notes, varied profile completeness, question/answer sets and category-specific interview guides.
- Club names come from the requested list. Descriptions, statistics, targets, schedules, questions, experiences and people are explicitly sample data. No real student records or photos are used. Fictional identities use `@demo.invalid` addresses; they are not real sign-in credentials.
- `lib/demo/assets.ts` creates safe SVG monograms; existing OutClass branding is unchanged. `/demo/sample-resume.txt` is an explicitly fictional local résumé placeholder. No scraped/hotlinked imagery or fabricated LinkedIn identities.
- `lib/demo/store.ts`: normalized browser store, joined projections, isolated `outclass.presentation.v1` persistence, rollback on failed saves, reset, notifications, deadlines and subscriptions.
- `lib/demo/validate.ts`: validates saved snapshots and relationships before hydration; incompatible/damaged snapshots regenerate safely.
- `lib/workspace-api.ts`: typed adapter around existing server actions. OFF forwards to the original functions; ON uses the local graph and never calls those actions. Draft validation and word limits, 1–10 scores, independent round/status changes, expected-status decision conflicts and club scoping remain intact.
- `contexts/demo-context.tsx` manages readiness, mode/perspective/reset and storage errors. `AuthProvider` presents a synthetic identity only inside demo; Supabase identity and credentials are untouched.
- Existing student/application/profile/discovery/CRM/interview/board-review components consume the adapter. `components/demo-workspace.tsx` provides compact demo-only schedule, question-guide, offer-target and membership projections where the real legacy builders lack connected persistence.
- `ApplicationStateProvider` derives demo calendar/notifications from the shared records and never reads/writes the normal preview key while demo is active. Subscriptions/read states/RSVP state persist in the canonical demo snapshot. Customization uses a separate demo key.

The normalized records are the source of truth: application answers, status, current round, evaluations and interview slot ownership are shared across perspectives. Scheduling an applicant changes their interview status/round and calendar booking; opening that slot targets the same candidate in the existing Interview Mode. Decisions update the student record and notification projection. Past slots remain history; decisions do not silently erase bookings.

## Isolation boundaries

`/api/demo` checks the actual server-verified email against the server allowlist, validates inputs and rejects cross-origin changes. Middleware refuses all non-GET/HEAD requests while the demo cookie is active, except the independently protected demo-mode endpoint. This also blocks accidentally missed server-action paths. The client upload adapter explains that real uploads are disabled. There is no Prisma seeding, database write, real email delivery or auth impersonation endpoint.

Public club deep links redirect into the demo directory while authorized demo mode is active. The global array-swapping mechanism is removed from `lib/data.ts`; the old demo-data modules are no longer used by the new presentation. The server middleware uses the cookie only to **deny** writes; it never treats it as authentication or authorization to production data.

## Honest implementation boundaries

- Voting Mode demonstrates the existing president's board-decision workflow. It does **not** create real-time ballots, real member votes, transcripts, recording or AI.
- Rubric guidance is category-specific sample text. Persistence uses the actual overall 1–10 evaluation + notes model; there are no invented weighted criterion scores.
- Offer targets and sample deadlines are demo-only fields, clearly labeled. They do not add a real recruitment-cycle or eligibility backend.
- Scheduling is local slot assignment, not a connected availability/email/calendar service. The member directory reflects canonical fictional memberships; it does not send invitations or edit real permissions.
- LinkedIn import, résumé parsing and real file uploads are not simulated as working. A safe sample résumé document is provided.
- Legacy broadcast/screening/publishing builders remain labeled previews, not newly implemented production functionality. The demo includes application-driven updates/notifications; external delivery remains absent.
- Reset/persistence applies to the canonical presentation and view-local state, not a real multi-presenter transactional backend. Use one active presentation tab for edits.

## Validation

Unit tests cover deterministic counts and joins, unique fictional identities, club isolation, score persistence, stale decisions, blocked uploads, OFF delegation, refresh/date revival, reset, corrupt storage and failed-write rollback. Browser tests cover ON/OFF, multiple leader perspectives, refresh, reset, applicant scoring, opening the scheduled candidate, application save/submit, round advancement, board acceptance visible to the student, rescheduling/calendar coherence, and responsive widths. During the demo workflow tests, **zero production server-action requests** were observed; a direct mutation request was rejected with HTTP 403.

The normal Node test suite, TypeScript, production build and available lint command are run at completion. ESLint was not installed before this change; its absence is reported rather than presented as a passing check. Live deployed allowlist/login behavior still requires configured production/staging credentials.

Final results: **70/70 Node tests pass**, TypeScript passes, and the production build passes. Production browser checks also confirmed hidden/denied demo access for ordinary visitors, ignored legacy localStorage flags, cross-origin request rejection, mutation blocking, and cleanup of a revoked/unauthorized demo cookie. The available lint command still reports `eslint: command not found`.
