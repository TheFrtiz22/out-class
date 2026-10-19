# Compatibility security release — October 19, 2026

This branch brings `main` into line with the verified compatibility release already running at https://www.out-class.net. It preserves the existing Applicants review destinations and includes the account projection/redaction, live session revocation and expiry checks, invitation capability binding, signup privacy, scheduling state preservation, bounded communication reads, patched dependencies and existing breadcrumb cleanup.

The [source comparison](2026-10-19-compatibility-source.json) verified 943 runtime/configuration/dependency files against baseline `16c4be2` and the recorded compatibility patch, plus all 25 patch files, matching deployment `dpl_6vMuXwFiQYTHJT9NRQMpeX629t9B`. Test fixtures and this release note are separate verification artifacts.

Migration `20261019175843_outclass_auth_session_view` is the exact additive, security-invoker view migration already applied in production. Including it keeps Prisma history aligned. Browser grants remain revoked; application session queries retain direct `auth.sessions` access and the existing database binding.

The restricted-login cutover stays separate on the audit branch: no login provisioning, runtime grants, Storage policy changes, new URL precedence or view-based application queries are introduced here. The production gate continues requiring the existing `postgres` compatibility binding and read-only session-query preparation. Supabase's owner-only delegation prerequisite remains unresolved.

Validation of this branch:

- Frozen-lockfile dependency install, typecheck and lint passed (26 existing warnings, zero errors).
- Full default suite: 1,254 passed, 34 fixture-gated skips, zero failures.
- Real Next/Auth/MFA/PostgreSQL/SMTP and browser integration: 38 passed, zero failures/skips; actual Next production build passed.
- Secret scan: zero findings across changed source, release documentation and client bundles. Reserved test containers, volumes and generated secret files were removed.
- Fresh and legacy replay: all 57 migrations passed; 78 application tables retain RLS and browser CRUD denial.

Detailed restricted-role experiments and production audit evidence remain on the separate audit branch. These results do not certify production authenticated-user replay, field latency or costs. No existing credential was changed.
