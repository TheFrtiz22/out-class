---
name: outclass-reuse-first
description: Use before writing any new OutClass helper, hook, component, API route, email path, queue, QR or icon code, or before adding an npm dependency, to find and reuse the existing module instead of creating a competing source of truth.
---

# Reuse first

`CLAUDE.md` forbids competing sources of truth. Most "new" utilities in OutClass already exist. Spend two minutes searching before writing one.

## Steps
1. **State the need in one sentence**, for example "send a one-off email to a club leader" or "debounce an editor save".
2. **Search the repo, in this order**, with Grep or Glob on the key nouns and verbs:
   - `lib/`, `utils/`, `actions/`, `components/`, then `app/`
   - `tests/` for a test that already exercises the behavior (it shows the intended entry point)
   - `docs/` for the feature's design note
3. **Check the canonical modules below.** If the need is in this list, use the listed module. Extending it is fine; a parallel version is not.
4. **Decide and record** in your PR description: reuse (name the module), extend (name the module and the change), or new (say why nothing fits).
5. **A new npm dependency** needs a line in `docs/agent-ops/decision-log.md` (need, alternatives searched, size, license, maintenance) and the owner's approval before `pnpm add`. The permission rules ask before installs for this reason.

## Canonical modules

| Need | Use |
| --- | --- |
| Current user, club permission, membership, platform admin | `requireAuth`, `requireClubPermission`, `requireClubMembership` in `@/utils/auth`; `requirePlatformAdmin` in `@/utils/platform-admin`; `authorizeClubTransaction` in `@/lib/club-transaction-authorization` |
| Club-scoped writes with locking and suspension checks | `clubWriteTransaction` in `@/utils/club-write-transaction`; `assertClubOperational` in `@/lib/club-suspension` |
| Database access | `prisma` from `@/utils/prisma` (server only) |
| Email of any kind | `@/lib/transactional-email`, `@/lib/notification-email`, `@/lib/invitation-email`, and the outbox and delivery code in `utils/invitation-delivery.ts` and `utils/scheduled-communications.ts`. Never call Resend directly from a feature. |
| QR codes and short links | `@/components/qr/outclass-qr-code`, `@/lib/qr`, `actions/short-links.ts` |
| Interface icons | `@/components/icons` (Phosphor). Never `lucide-react`. |
| Autosave and optimistic saves | `@/lib/autosave-queue` and the availability save-queue modules in `lib/` |
| Calendar export | `@/lib/ical` |
| Public club search | PostgreSQL first; `actions/typesense-search.ts` is optional acceleration and never indexes private applicant data |
| File storage | `actions/storage.ts` and the existing Storage authorization helpers |
| Demo and preview data | `lib/demo` only; it must stay isolated from production writes |

If you find two modules that both seem canonical, do not pick one silently. Note both in the PR and ask the owner which one wins.

<!-- Adapted for OutClass from Everything Claude Code (search-first skill), MIT License, Copyright (c) 2026 Affaan Mustafa. See docs/agent-ops/decision-log.md. -->
