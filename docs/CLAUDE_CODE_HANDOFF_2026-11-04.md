# OutClass → Claude Code engineering handoff

**Snapshot:** 2026-11-04, America/New_York. **Purpose:** transfer product intent and tested engineering constraints, then identify and close the real launch blockers. This is a point-in-time handoff, not an assertion that every feature has been live-tested. Always favor current `main`, actual deployment, database catalog, CI and browser behavior over old audit notes.

## 1. Verified project identities and repository state

- GitHub: `TheFrtiz22/out-class`, default branch `main`.
- Observed `main` head: `969eadc4bfb70f10707de4a089e29b7f437b80af`, "Complete observation runtime access and applicant-review entry (#116)".
- Vercel: project `out-class`, team `outclassuva`. Latest production deployment `dpl_EkUMoFePnfyn2hpP86Jq36wiitz4` was `READY` and identified that exact GitHub SHA as its source. Configured domains include `out-class.net`, `www.out-class.net`, `uva.out-class.net` and Vercel aliases. READY is **not** evidence that authenticated user flows all succeed.
- Supabase: project `OutClass`, `us-west-2`, reported `ACTIVE_HEALTHY`. It contains real application data; **do not modify it to test handoff**. Its public schema contained the application tables for users, clubs, recruitment, interviews, voting, availability, notifications, school identity, events and the Prisma migration ledger.
- GitHub search of open PRs at handoff found no open PRs. Re-query on every new session; teammates and Codex can continue making changes.
- Recent main includes the universal branded QR/short-link implementation, applicant observations, submitted interview thoughts, voting UI and server permissions; inspect recent commits #106–#116 before making assumptions.
- Root `CLAUDE.md` is introduced in this handoff PR. `AGENTS.md` already exists and imposes the authoritative Phosphor icon convention. Existing `.claude/skills/` contains Prisma-related skills.
- No user-local Claude installation, authenticated Claude account, Git CLI identity, OAuth connection, dev environment, or runtime tests could be verified from this remote inspection.

## 1a. Status update — 2026-11-04 evening (Claude Code)

Sections 1 and 4 describe the morning snapshot. Current verified state (main `7957952c`; production DB checked read-only after the last migration):

**Production database.** All 67 repository migrations are applied, none unfinished; `prisma migrate status` reports up to date. Applied today with owner approval: `20261101160000` (ledger RLS hardening), `20261104210000` (re-application after rejection), `20261104230000` (live inbox Realtime signal). `public._prisma_migrations` now has RLS enabled with RESTRICTIVE deny-all policies for `anon` and `authenticated`, and neither role holds SELECT/INSERT/UPDATE/DELETE on it. Every `public` table has RLS enabled.

**Runtime.** Vercel functions moved from `iad1` to `pdx1` (`vercel.json`), next to the `us-west-2` database: signed-in reads p50 1.2–2.5 s → 0.23–0.31 s (`docs/performance/region-co-location-20261104.md`).

**Merged to main (each validated in full; browser suites where the area is covered):**

| Merge | Change |
|---|---|
| `1bbef02a` | Short links require a session and are limited to shareable targets; meeting check-in links are issued and closed server-side |
| `abc7f161` | Attachment downloads denied for reviewers of suspended clubs |
| `688a4cd8` | Invitation cron: a suspended club no longer stalls invitation email for every club; bounded, oldest-first, stops when the provider pauses |
| `5b6ac3a3` | Notification worker: one bad user/payload no longer blocks the batch; suspended clubs skipped |
| `ea317357` | Application autosaves no longer serialize club-wide (38/50 → 0/50 failures at 70 ms RTT, `docs/performance/club-write-contention.md`) |
| `d099cfb8` | Functions pinned to `pdx1` |
| `1a34adc6` | Rejected students may re-apply in a later active cycle; submissions auto-join the single active cycle |
| `30967a74`, `c669117d`, `b6137027` | Root JS 426 → 200 kB gzip: demo store, workspace API and Supabase client load on demand; per-icon modules |
| `94cd7376` | Explore directory list payload 117 → 46 kB (38 clubs); full profile loads on open |
| `8504bf5f`, `7957952c` | Idle/hidden tabs stop refetching the inbox; live inbox over private Supabase Realtime signals with SSE fallback (`docs/performance/dashboard-requests-20261104.md`) |

**Incident.** WIP commit `9a7bbf2b` was auto-pushed to main by the VS Code Git extension (branch tracked `origin/main`) and deployed briefly; reverted by `829467d7` (tree identical to `969eadc4`). Working branches are now created with `--no-track`; setting VS Code `git.confirmSync` to `true` is recommended.

**Still open.** Voting ballots and interview booking serialize per club (mitigated by co-location); RSVP uses Prisma's default 5 s transaction timeout; no "previously applied" indicator for re-applicants in the leader pipeline; Privacy/Terms pages, self-service account deletion and data export need owner/legal content. The P0/P1 inventory in section 5 has not been re-run end to end since this morning.

## 2. Product vision and constraints

OutClass is one platform into which schools can be onboarded rapidly (target: within 48 hours), **not** separate copies of the codebase per school. UVA is the initial launch; support school-specific identity, branding, directory, membership and subdomain routing while keeping strong tenant isolation.

**Students:** minimal-friction first login via verified email, profile completion, Explore/search/filter clubs, save clubs to Corkboard, discover events, apply with frequently autosaved drafts and attachments, see application statuses and interview invitations, confirm/reschedule interviews, manage availability, view personalized home/calendar/notifications, scan codes to check in to meetings and information sessions.

**Leaders:** claim and set up organizations, import rosters and invite members, manage capabilities, profiles and public discovery, configure applications and rounds, review applicants, build interview kits, collect availability, create rooms/panels and auto-fill suggestions, **review and approve** assignments before publication, run interviews with private and collaborative records, vote and issue explicitly reviewed decisions/letters, create events and optional flyers, manage announcement emails/notification preferences, track attendance and recruiting outcomes.

**Cross-cutting:** no direct-message feature expansion; announcements and transactional notifications are the communication model. Timely, context-aware greetings should remain subtle. Dense discovery and high-utility dashboards should surface the next meaningful action instead of decorative statistics. Navigation should be fast, persistent and intuitive. Preserve mobile-friendly layouts, keyboard/accessibility support, thoughtful motion and the established premium editorial/Apple-like visual identity without visual clutter, generic clip art or gratuitous AI copy. Preserve the current official wordmark/assets rather than inventing new ones.

**QR identity:** all generated codes are centralized through `@/components/qr/outclass-qr-code` / `@/lib/qr` and first-party compact `/q/[code]` links. Maintain OutClass navy, rounded finder/modules, centered monogram, H error correction and export/print reliability. **Visually complete QR is not proof of a working authenticated check-in:** track event ID, approved user identity, duplicate prevention, server authorization, persisted attendance and leader-facing CRM analytics across devices. The first section of `docs/qr-attendance.md` is a design/backend boundary; confirm exactly which of those steps current code implements before marking live.

**Time and school behavior:** current scheduling UI deliberately uses Eastern time and availability editor limits; do not add generic timezone selectors throughout the product. Separate scheduled-communications timezone handling may differ. School branding and time policies should eventually be explicit configuration, not hard-coded in a way that breaks UVA.

**Mobile extension:** native iOS/Android via a shared, secured API approach (Expo/React Native is a candidate), including camera QR scanner, check-in, login, push notifications, interview calendar and possibly home-screen widgets. Do not duplicate business rules in a disconnected mobile backend or treat a no-backend Xcode prototype as a production client.

## 3. Confirmed technical stack and code map

- `package.json`: Node `>=22.13.0`, `pnpm@10.17.1`, Next `15.5.27`, React `19.2.0`, TypeScript, Prisma `6.19.3`, Supabase SSR/JS, Playwright `1.64.0`, Phosphor icon package, QR modules, email modules.
- Vercel project uses Node `24.x` in reported project configuration; investigate host vs local Node differences rather than forcing unreviewed upgrades.
- `app/`: Next routes, public, student, admin, authenticated workspaces and server handlers.
- `actions/`: server actions for guarded business workflows.
- `lib/` and `utils/prisma.ts`: shared business logic, authorization, database access and QR/search/email modules.
- `components/` and `styles/`: product/public UI, shared design and existing interactive navigation.
- `prisma/schema.prisma` and `prisma/migrations/`: authoritative application database model and ordered migrations.
- `tests/`, `scripts/` and `.github/workflows/`: unit, migration, disposable integration, authenticated browser, load, accessibility and CI checks.
- `supabase/`: Supabase local config/Auth templates and auxiliary files; **not** a substitute for canonical Prisma migration deployment.
- `vercel.json` defines three every-minute protected worker routes: `/api/internal/invitation-delivery`, `/api/internal/notification-delivery` and `/api/internal/scheduled-communications`.

**Important architectural boundaries:**
- Server-owned identity and capability checks, owner/club/school scope, RLS/privilege defense, audited administration and optimistic revisions must not regress.
- Demo mode is isolated. Client previews do not create real bookings, ballots, attendance or decisions.
- Search uses authoritative database visibility filters; Typesense is optional and restricted to public directory documents. See `docs/typesense-integration.md`. Server-only Typesense admin key must never be in Vercel runtime/frontend.
- Auth SMTP/invitations, notification outbox/Resend and cron delivery already have documented implementations; do not replace or introduce duplicate send paths.
- Multi-user scheduling, evaluations, voting, decisions and attendance require real transaction/race tests.

## 4. Production security and migration checkpoint

> **Superseded 2026-11-04 evening (see 1a):** the production ledger hardening was applied with owner approval (`20261101160000`). Verified read-only afterwards: RLS enabled, RESTRICTIVE deny policies for `anon`/`authenticated`, no browser-role privileges. The paragraph below is the morning snapshot.

The current Supabase table summary flagged `public._prisma_migrations` because **RLS is disabled**. A separate read-only permission check found `anon` lacks SELECT/INSERT and `authenticated` lacks UPDATE, consistent with `docs/staging-security-rls-20261101.md`, which records production browser-role privileges as revoked. Therefore **do not characterize this as a proven current anonymous CRUD exposure**. It remains a hardening/advisor-compliance issue.

The reviewed staging remediation enabled RLS, revoked grants and retained owner Prisma migration access; staging verification was documented on November 1. Production did **not** receive that change. Require independent production authorization, full migration/privilege review, backup/rollback procedure and post-deploy auth check before a production rollout. **Never auto-run the staging SQL, restore broad grants, or disable RLS to fix a failing migration.**

Supabase Management API `list_migrations` and Prisma's `_prisma_migrations` are separate histories. Do not mistake a single Supabase remote-schema migration for only one Prisma application migration. Compare the repository migration directories and Prisma ledger precisely before making a deployment decision. Do not run `supabase db reset`, baseline by guesswork, replay archived SQL, or rotate credentials without explicit approval.

## 5. Gaps and priorities to verify (not presumed defects)

### P0 — Inventory, connection, security and operational safety
1. Confirm correct branch, current main SHA, open PRs, CI state, Vercel source/deploy target, and stage vs production database identities.
2. Enumerate routes, app/server actions, feature flags, table models, migrations, job workers, Storage buckets, email/auth provider settings by **names and metadata only**. Record connected, missing, or unknown; never expose secret values.
3. Validate per-school/per-club permissions, JWT identity, owner/admin MFA, applicant/club-member cross-access, anonymous review, direct Storage reads, resume/file access, admin impersonation, invitation replays and revocation.
4. Reconcile staging migration history and protected production ledger hardening separately. Test migration rehearsal in disposable PostgreSQL before any approved rollout.
5. Confirm controlled observability, errors, logs, rollback, privacy/terms/support, accessibility and compliance readiness. Accessibility scans alone are not legal clearance.

### P0 — Complete real end-to-end student and club journeys
1. Student signup/email OTP, identity matching, profile, school identity, search/save, draft/autosave/upload, submission, status/decision letters and rejection/withdrawal.
2. Club claim/setup, roster CSV normalization/invites, memberships/roles, recruiting rules, questions, rounds, applications and reviewer permissions.
3. Interview availability, requested/declined responders, room planning, auto-fill review, approved publication, conflict rescheduling, applicant booking, private/collaborative notes, submission and review.
4. Voting sessions, ballots, race/finality rules, anonymous/permission boundaries and explicitly reviewed result publication.
5. Announcement and notification persistence, preferences, optional email, retries/digests, exact-once or idempotent delivery where designed, and the three cron workers.
6. Real QR-to-check-in path: first-party link resolution, signed-out redirect preserving intent, scanner input, authorization, one check-in per user/event, cross-device persistence and leader-side attendance/CRM.
7. Verify each screen with real authenticated disposable sessions at desktop and phone widths, including disabled/error/empty/loading/slow-network states.

### P1 — Product and performance polish
- Make Explore much faster to scan: compact controls, strong search focus, useful sorting, saved club access, fewer competing cards and less page-height waste. Preserve current authoritative filtering and accessibility.
- Make student/club dashboard overviews action-oriented: upcoming deadlines, interviews, tasks, invitations, new events, notifications and relevant decisions; remove decorative filler.
- Preserve floating/expanding navigation/docks and carefully applied liquid-glass treatment, with sufficient contrast, reduced motion and no pointer interception.
- Benchmark first/authenticated load, tab switches, query payload sizes, middleware/auth duplication, and small vs large club workloads. Compare p50/p95 and cold/warm timings; do not repeat a rejected optimization without proving both cohorts benefit.
- Finish authentic touch/keyboard/VoiceOver and responsive audits, including overlays, PDF/resume editors, calendar, QR scanning and sign-in.

### P2 — Growth and native clients
- Define tenant onboarding automation: school record and identifiers, custom domain/subdomain, branded assets, directory import, permissions, email templates, test tenant and rollout checks. **Target: onboard a requested school in 48 hours** without data duplication or manual code fork.
- Prepare secure mobile API contracts and separate Expo/React Native workstream for iOS and Android, push notifications and camera QR. Do not delay UVA web launch merely to build native apps or home-screen widgets.

## 6. Tests and evidence

Use `pnpm install --frozen-lockfile` in a trusted local checkout. For baseline review:

```bash
node --version
pnpm --version
git status --short
git log -8 --oneline
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run test:migrations
node scripts/check-disposable-integration-coverage.cjs
```

Run `pnpm run build` and `pnpm run validate` with the repo's required **nonproduction** configuration. Do not point test scripts at hosted production. Inspect the install/postinstall scripts (Prisma generate and PDF asset copy) before use, and never print env values.

For guarded integration tests use `docs/disposable-integration-ci.md` and `.github/workflows/disposable-integrations.yml`. Local requirements include Docker, isolated Supabase/Postgres, Mailpit, Chromium and reserved ports. Inspect whether skips are environmental or real coverage gaps; never report all tests passing as proof that skipped production pathways ran. Manual release verification must include test accounts and cross-role/cross-school cases in a safe environment.

Some older documents report "announcement persistence missing" or "voting demo-only"; newer code/docs show persisted notifications and server voting. Treat their dates and commits as historical; test the **current** implementation. No runtime test suite was executed during creation of this handoff.

## 7. Setup: connect Claude Code on the developer Mac

With a trusted checkout of the GitHub repo and your own Claude Ultra subscription:

```bash
# macOS, official native Claude Code installer:
curl -fsSL https://claude.ai/install.sh | bash
claude --version
claude doctor
cd /path/to/out-class
git status --short
gh auth status
node --version
pnpm --version
claude
```

Sign in to Claude Code with the **Claude subscription account**, not Claude Console PAYG. Check `/status`. If an `ANTHROPIC_API_KEY` environment variable is set, Claude Code may bill that API key rather than the Ultra subscription; inspect the **name/presence** without displaying its value and remove it from the launch environment if not intended.

Configure scoped local MCP integrations (these commands configure **your** local client; this handoff did not run them on your Mac):

```bash
claude mcp add --scope local --transport http vercel https://mcp.vercel.com
claude mcp add --scope local --transport http supabase "https://mcp.supabase.com/mcp?project_ref=htlgjluegmdwfjkzzwic&read_only=true&features=docs,database,debugging"
claude mcp list
```

Inside Claude Code run `/mcp`, complete each provider's OAuth and verify the Vercel and **read-only production** Supabase server can list metadata. Do not grant production write access for agent experimentation. If a writable database connection is required, create/verify a **separate staging-only** connection first, with its own approvals and safeguards.

For repository operations use `git` and `gh`. Authenticate `gh auth login` if needed. Vercel CLI is optional when MCP suffices for read-only inspection; if needed, use `vercel login` then `vercel link` only after checking that it targets the intended team/project. A successful MCP connection is not proof that local `.env` or Vercel/Typesense/email credentials are present. Compare required variable **names** in `.env.example`, `docs/typesense-integration.md` and hosting settings without printing values. Never upload keys to Claude chat, GitHub or shell history.

Read: https://code.claude.com/docs/en/quickstart ; https://code.claude.com/docs/en/mcp ; https://supabase.com/docs/guides/ai-tools/mcp ; https://vercel.com/docs/agent-resources/vercel-mcp

## 8. First prompt to paste into Claude Code

> You are taking over development of OutClass from an existing Codex/ChatGPT workflow. Read root CLAUDE.md, AGENTS.md, this dated handoff, the latest main commits, open PRs, package scripts, Prisma schema/migrations, current server actions, relevant UI routes, and existing test/doc evidence. Do not assume October audit gaps are still open. First perform a **read-only launch readiness audit**. Verify your repository, Vercel and read-only Supabase identities and permissions. Build a feature-preservation matrix for real student, club-leader, admin and school-onboarding journeys, labeling each implemented, partially implemented, demo-only or unverified. Give the smallest prioritized P0/P1/P2 closure plan with concrete files, test coverage, release hazards, and expected impact. Do not make production writes, migrations, sends, deployments, role changes, forced merges or credential changes. After reporting, implement the highest-priority approved fixes on small branches with disposable integration tests and show before/after evidence. Maintain OutClass's established product identity and do not rewrite working systems merely to simplify them. Tell me exactly which local/cloud connections still need my OAuth action or permission.

## 9. Definition of done for the UVA pilot

Claude may call the project pilot-ready only when:
- A real student can join, complete onboarding, discover/apply, receive status and book interviews without broken links or stale UI;
- A real authorized club can onboard/invite, configure recruiting, review/interview/vote and publish decisions with correct roles and auditability;
- Event/meeting QR codes scan, authenticate when required and persist the correct identity-bound check-in across devices (or any unsupported scope is clearly disclosed and excluded from launch);
- Notification/announcement emails, jobs, permissions, RLS/Storage, uploads and important failure/retry cases are tested;
- Staging migrations and release gates are documented and run, appropriate integration skips resolved or explicitly accepted, cross-tenant denial verified, and performance/accessibility/mobile smoke tests completed;
- The owner has approved production database/auth changes and the final deployment separately. Provide rollback instructions and an accurate outstanding-issues register.

**Never hide unimplemented functionality behind visually polished demo states, and never claim production-safe solely because a build says READY.**

