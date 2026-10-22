# Application writing and club logo backgrounds

Draft applications now open in a compact writing workspace: smaller club identity, a four-pixel progress bar, numbered question containers, larger resizable essays, question navigation, and an explicit Save draft button. Shared-profile guidance is collapsed below the writing controls; missing profiles and required SAT/ACT scores remain actionable above the questions. The existing autosave queue, validation, question data, submission confirmation, closed-intake policy, read-only submissions, header, dock, and workspace navigation remain in use.

## Logo presentation

The existing Club.marketing JSON stores optional logoBackground settings with auto, navy, ivory, transparent, or custom modes. Custom colors accept only six-digit hexadecimal values on both the client and the server. Publishing uses updateClubSettings, its club.settings permission checks, transaction reauthorization, existing image-assignment validation, optimistic profile comparison, and audit log. No migration or asset rewrite is required.

The shared ClubLogo component samples decoded image pixels on a small canvas. Transparent light artwork receives #142D45; transparent dark artwork receives ivory. Opaque images keep their embedded background, with a warning in settings when internal contrast is poor. Manual settings always win. Existing logoOnBrand choices remain active until explicitly replaced. Analysis failures, inaccessible remote pixels, and broken images fall back safely; settings offer manual choices. Source changes invalidate the per-source presentation state.

Discover, public profiles, applications/submissions/status, student dashboards, memberships, invitations, notifications, workspace selectors, admin lists, launch participants, upload previews, and formal letters use the shared presentation. Branding travels through their existing data projections. Existing PNG/JPEG/WebP upload validation is unchanged. Supported SVG artwork is displayed and sampled only through the browser image decoder; this change does not enable raw SVG uploads or inject SVG markup into the page.

## Before and after

Comparable screenshots use the real application tracker, form, and navigation shell with fictional data and HTTP-backed action fixtures. Arial/Georgia provide deterministic font fallbacks in these comparison fixtures. Baseline source: cffb63cff78c9694b89ed7e26a82d21edb5421e5. The baseline includes its original minimum textarea height. Authenticated screenshots additionally show the production build with actual local Auth and PostgreSQL and the application fonts.

| Width | Before | After | Authenticated after |
| --- | --- | --- | --- |
| 1440 | [Before](evidence/before-1440.png) | [After](evidence/after-1440.png) | [Authenticated](evidence/authenticated-1440.png) |
| 1024 | [Before](evidence/before-1024.png) | [After](evidence/after-1024.png) | [Authenticated](evidence/authenticated-1024.png) |
| 768 | [Before](evidence/before-768.png) | [After](evidence/after-768.png) | [Authenticated](evidence/authenticated-768.png) |
| 390 | [Before](evidence/before-390.png) | [After](evidence/after-390.png) | [Authenticated](evidence/authenticated-390.png) |

At 1440px, the first response moves from y=618 to y=383, grows from 768 to 974 pixels wide, and has a 256-pixel minimum height. At 390px, its top moves from y=778 to y=445, with a 224-pixel minimum height. No editor controls float over the mobile writing area.

[Logo background controls and preview](evidence/logo-background-preview.png). [Published settings in the authenticated leader workspace](evidence/authenticated-logo-settings.png).

## Validation

- TypeScript: passed.
- ESLint: passed, with 22 existing hook-dependency warnings and zero errors.
- Production build: passed, including the isolated production build used for authenticated tests.
- Targeted application, branding, letter, launch, and persistence tests: 41 passed. Additional admin, logo-browser, and fixture-guard checks passed.
- Accessibility suite: 27 passed. The editor also passed axe checks at 1440, 1024, 768, and 390px, with zero WCAG A/AA violations in its content area. Logo settings passed axe and mobile reflow checks.
- Real integration: passed using verified local accounts, production Next actions, PostgreSQL, browser editing, publication/reload, role denials, malicious-color rejection, shared applicant/leader presentation, closed drafts, and submitted-answer immutability.
- Migration regression checks: all 57 existing migrations applied on fresh and legacy databases; all 78 tables enforce RLS and deny browser-role CRUD.
- Full suite: 1354 tests; 1316 passed, 37 skipped, 1 pre-existing failure. The unchanged workspace-reliability test expects Vary: Cookie, while the unchanged response helper returns Vary: Cookie, Accept-Encoding. This failure was reproduced independently and is not hidden or changed by this feature.

The initial real-browser resize assertion ran before the shell finished adapting from desktop to tablet. Taking a stable screenshot before measuring resolved that transient test timing; no navigation-shell CSS was changed. An initial standalone TypeScript invocation overlapped a build regenerating .next/types; it was rerun after the build and passed.

Run focused UI/action checks with node --test --test-concurrency=1 tests/application-writing-browser.test.cjs tests/logo-background-browser.test.cjs tests/club-marketing.test.cjs tests/student-applications.test.cjs tests/decision-letters.test.cjs tests/launch-clubs.test.cjs. Run the real isolated integration with npm run test:application-writing:e2e. That mode uses its own disposable project, loopback app port 3109, and service ports 57321–57327, with the existing local-only configuration guard. It never targets the application database. Default onboarding test behavior and ports remain unchanged.

The PR remains a draft because the repository-wide baseline failure is still open. Do not merge without reviewing that failure and completing the normal PR checks.
