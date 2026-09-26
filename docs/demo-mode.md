# Production-safe OutClass Demo Mode

## Enable access

Demo Mode uses the **same explicit opt-in and authenticated allowlist in Development, Preview, and Production**. Local development no longer bypasses authentication or configuration. Neither `NODE_ENV` nor `VERCEL_ENV` grants access.

Configure these **server-only** variables in each intended Vercel environment (Production and Preview are separate scopes; Preview may have branch overrides):

- `OUTCLASS_DEMO_ENABLED=true` (unset/empty/`false` disables access).
- `OUTCLASS_DEMO_ALLOWED_EMAILS`: comma-separated actual presenter UVA account emails. No wildcard, semicolon separator, trailing comma, or display-name format. Case and surrounding whitespace are normalized. Any invalid entry disables access to the whole list. Do not use `NEXT_PUBLIC_` prefixes.

Redeploy after changing Vercel variables. For local `next dev`, configure the same values in an uncommitted `.env.local` and restart, or pull the desired Vercel environment. See [Vercel environment configuration](https://vercel.com/docs/environment-variables).

The existing authentication configuration must also work in that environment: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and the existing `DATABASE_URL` for ordinary account/profile flows. Configure Supabase’s allowed redirect URLs for the actual deployment origin and `/auth/callback`. Never change `NODE_ENV` to bypass access.

Sign in with an allowlisted UVA account, then open the account menu → **Demo Mode: Off — enable demo**. On mobile, use the navigation drawer. The real account needs no production club-leader role to present the fictional clubs. Demo role switching never changes real memberships or credentials.

The toggle is hidden from everyone else. `/api/demo` returns a safe `reason`: `available`, `disabled`, `invalid-configuration`, `sign-in-required`, or `not-allowlisted`. It never returns allowlist contents, email addresses, or credentials. Invalid configuration also emits a redacted warning in server logs. An auth verification error denies access even if a user object is returned. The OFF endpoint remains usable during authentication outages.

No environment values or deployment settings were changed by this implementation. A live allowlisted login still requires your configured authentication service.

Turning ON sets an HttpOnly, same-site cookie for eight hours and reloads into the isolated workspace. OFF removes that cookie and reloads the real application, preserving the actual login/session. The original local-preview browser state is not overwritten. Disabling demo access on the server removes stale demo cookies when the user returns. Other tabs receive an ON/OFF notification and reload; the presentation itself is intended for one active editing tab.

## Presenting

The account workspace switcher exposes **Personal / Student** and **MII — Club workspace** for the same fictional student. The demo menu exposes **Reset Demo**. Demo leadership is limited to MII; other clubs remain available for discovery and applications. Perspective changes remount view-local state but retain the shared demo records. Reset reconstructs the same season using its stored date anchor, clears demo customizations, and returns to the sample student. Dates are relative to the first initialization date; reset preserves that date for deterministic presentations. To start a later season with a new anchor, remove only `outclass.presentation.v1` from this browser while demo is off.

Suggested walkthrough:

1. Student Home: priorities, mixed application states, meetings, deadlines and updates.
2. Discover: sample curated selection and 20 club profiles, questions, dates and subscriptions.
3. Applications: finish the AIF draft, save it, then submit it.
4. Switch to MII’s club workspace: find an applicant, review responses, score or advance the round.
5. Voting mode: record an accepted/not-selected decision, then switch to student to see the outcome.
6. MII club workspace → Interviews: release/reassign a slot, open its candidate in Interview Mode, save notes and an overall 1–10 evaluation.
7. Student Calendar and Applications show the same scheduled slot. Club Settings shows the fictional member directory, question set, rounds and sample offer target.
8. Reset Demo and repeat without affecting real records.

## Data and architecture

- `lib/demo/seed.ts`: deterministic canonical graph: **20 clubs (17 claimed and three unclaimed), 200 fictional students, 40–80 applications and 12–23 members per claimed club, six or five rounds, and 12 interview slots per claimed club**. Includes draft/submitted/review/interview/final decisions, prior-round evaluations, notes, varied profile completeness, question/answer sets and category-specific interview guides.
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

While the demo cookie is present, middleware also denies `/api/users/me` reads so a missed client fetch cannot mix the presenter’s real records into the demonstration. The cookie only denies live access; it never grants authorization. Legacy check-in/voting browser flags are local preview simulations, not demo access or production roles.

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

Configuration tests cover Production/Preview/Development with the same policy, malformed/missing variables, authenticated allowlist access, secure cookies, failed auth, cross-origin rejection, outage-safe exit, and live-account read blocking. Earlier workflow browser checks used the previous development shortcut; enabling the current local demo now requires a real allowlisted login.

Unit tests cover deterministic counts and joins, unique fictional identities, club isolation, score persistence, stale decisions, blocked uploads, OFF delegation, refresh/date revival, reset, corrupt storage and failed-write rollback. Browser tests cover ON/OFF, multiple leader perspectives, refresh, reset, applicant scoring, opening the scheduled candidate, application save/submit, round advancement, board acceptance visible to the student, rescheduling/calendar coherence, and responsive widths. During the demo workflow tests, **zero production server-action requests** were observed; a direct mutation request was rejected with HTTP 403.

The normal Node test suite, TypeScript, production build and available lint command are run at completion. ESLint was not installed before this change; its absence is reported rather than presented as a passing check. Live deployed allowlist/login behavior still requires configured production/staging credentials.

Configuration audit: **79/79 Node tests pass**, TypeScript passes, and the production build passes. Production browser checks also confirmed hidden/denied demo access for ordinary visitors, ignored legacy localStorage flags, cross-origin request rejection, mutation blocking, and cleanup of a revoked/unauthorized demo cookie. The available lint command still reports `eslint: command not found`.

See [authorization architecture](authorization.md) for membership capabilities, platform administration, safe migration rollout, and demo identity compatibility.

## Expanded canonical season (September 2026)

New presentations and **Reset Demo** load the expanded fixtures. Existing saved presentations retain edits until reset. Reset preserves the season anchor and returns to Student, clearing the selected workspace URL and customizations.

- Jordan Avery remains a STUDENT, owns only MII's workspace, and is a general member of TAMID alongside an accepted TAMID application. The real workspace switcher provides Student ↔ MII Leader; no platform administrator is granted.
- MII, GMG, and AIF are labeled fictional early-adopter examples. VCG, Common Cents, and Mergers & Acquisitions are unclaimed directory examples without members, meetings, or applications; application creation is blocked for them.
- Club requirements cover SAT, ACT, both, either, and optional. Jordan has both scores. Review rounds start anonymous with manager-reviewed sample content; Interview rounds retain identified kits, drafts, completed notes, additional questions, overall reviews and scores.
- Each claimed club has two historical interest meetings, an interest meeting on the anchor date, a historical member meeting and an upcoming member meeting. Jordan's historical MII interest attendance feeds the same meeting roster, student history and applicant attendance summary. Public directory events now use the canonical meeting records, so edits propagate there too.
- MII has an in-progress semester project and weekly/group/cohort tasks, including overdue, submitted and reviewed assignments. Link-required work and fictional file attachments supplement written responses. File downloads resolve only to the bundled sample text document; uploads remain disabled. Membership edits update task member labels while preserving the assigned recipient set.
- Voting mode continues to use the implemented board-decision workflow. Decisions update applications and student notifications; this does not invent a persisted ballot service.

Regression workflows exercise attendance check-in across all three projections, public meeting creation, anonymous pipeline projections, member edits, task submission/review, safe document downloads, interview completion, decision propagation, refresh and byte-for-byte canonical reset. Saved-graph validation also rejects cross-club slots, rounds, interview sessions, mismatched task recipients and duplicate attendance.

Validation for this expansion: **158/158 Node tests pass**, TypeScript passes, and the production build passes. `npm run lint` remains blocked by the existing missing ESLint dependency. Workflows were exercised through the shared workspace adapters; an authenticated browser walkthrough was not performed in this run.
