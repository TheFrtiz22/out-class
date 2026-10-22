# Centralized workspace navigation

The floating header now follows **Workspace → Club → Mode → Page**. Personal is a compact label for students with no other eligible workspace. Club leaders get an ivory segmented selector, their currently managed club, and the existing Recruiting / Club modes. Separately verified platform administrators also get Admin. The desktop dock contains contextual pages only; its expansion, magnification, shared highlight and flyouts are preserved. Mobile retains the selector in both the header and More navigation.

## Authorization and refresh

`useWorkspaceAccess` reads the existing AuthProvider identity and `hasWorkspace` memberships. Ordinary membership does not grant a leader workspace. One shared request to the existing `/api/platform/eligibility` endpoint verifies Admin; the route, profile fields, club ownership and client role labels grant no platform authority. Pending checks, unsuccessful responses, malformed responses, demo and support identities all exclude Admin. No restricted placeholders are rendered.

The hook cancels stale identity requests, shares eligibility between header and mobile, and does not refetch on mode, club or page changes. Existing AuthProvider refreshes immediately reconcile membership changes. Returning to the window after 30 seconds refreshes access and the deduplicated account read; `outclass:workspace-access-changed` explicitly refreshes both. Refresh events during an existing request queue a reconciliation. Revoked workspace navigation and content are removed, then the route is replaced with another eligible club or Personal. Mandatory access reconciliation cannot be canceled by an unsaved form; voluntary workspace and club navigation still uses `canLeaveWorkspace` before navigating.

Selection follows the confirmed shell route. Workspace links reuse the canonical Personal, club-workspace and platform entry routes. Club switching preserves an allowed settings category, and the club route owns data loading. No schemas, policies, permissions, server actions or API contracts changed. Existing platform allowlist, active grant, AAL2 and session-bound elevation checks remain authoritative.

## Review artifacts

All captures use the real ProductShell, Radix controls and production CSS with **fictional local identity and records**. They do not imply access to production accounts. The preview deployment is linked in the pull request.

- [Personal, one option](previews/personal.png)
- [Club leader desktop](previews/leader-desktop.png)
- [Verified Admin desktop](previews/admin-desktop.png)
- [Three options in Personal](previews/three-options-personal.png)
- [Three options in Club Leader](previews/three-options-leader.png)
- [Student mobile](previews/student-mobile.png)
- [Leader mobile](previews/owner-mobile.png)
- [Verified admin managing a club on mobile](previews/platform-mobile.png)
- [Workspace transition demonstration](previews/workspace-transitions.webm): Personal → Club Leader → change club → Recruiting → dock flyout → Admin → Personal.

Reproduce the captures with `OUTCLASS_SWITCHER_SCREENSHOTS=docs/workspace-switcher/previews node --test tests/workspace-selector-browser.test.cjs` and the video with `node scripts/record-workspace-switcher.cjs`.

## Validation

- TypeScript: passed.
- Repository ESLint: zero errors; 26 pre-existing warnings.
- Production Next.js build: passed.
- 129 navigation, authorization, notification, settings and server regression checks: passed; zero skipped.
- Centralized selector and expanding dock Playwright tests: passed in Chromium and WebKit. Covers one/two/three choices; independent Admin eligibility; unauthorized DOM/search/mobile absence; delayed and failed eligibility; direct unauthorized Admin URL; admin and leader revocation; ordinary-membership exclusion; managed clubs; settings preservation; mode and dock updates; guards; history; retained shell and zero repeated access reads while navigating; keyboard and menu focus restoration; reduced motion; long club names; 320–1920px widths including a 200% zoom equivalent.
- Existing navigation refinement, applicant navigation, global-search and tutorial browser tests: passed (four tests), plus the floating-header verification flow (six permission roles / ten widths, notifications, search, sign-out, guards and menu behavior).
- Axe WCAG 2 A/AA and 2.1 AA: no violations in student, leader and verified-admin mobile states or desktop; dock suite also checks forced colors and touch.
- Direct server page regression executes the actual page → loader → overview action → platform guard, confirming denial before any metric query for a non-allowlisted identity, revoked grant, AAL1, or missing elevation.

The database-backed native login/settings integration suite could not run locally because the Docker daemon is unavailable. It is not represented by the fictional browser captures; server guard tests run against controlled external boundaries. No failing tests were skipped or weakened.
