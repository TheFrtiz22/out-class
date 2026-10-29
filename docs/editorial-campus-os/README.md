# OutClass — Editorial Campus OS V2

Implemented on `design/platform-wide-visual-unification` for draft PR #90. Ready for
human design review; no merge or deployment performed.

## Reference and scope

The exact approved Figma frames are retained under `references/`:
[Home](references/home.png), [Recruitment](references/recruitment.png),
[Applicant dossier](references/applicant.png).
They correspond to nodes **8:7, 8:67 and 8:129** in
[the V2 file](https://www.figma.com/design/kfkYwNCkwLIIhPe6BeFnQF).

Figma MCP session creation worked, but design-context and editable-node inspection
were blocked by the account's Starter MCP quota. The fallback was to export these
exact frames through Figma's browser UI and inspect the exports. Geometry and type
hierarchy were judged from those images; this is not a claim of measured editable
node values or an updated Figma file.

Current main was incorporated with merge `03e48a19`, including dock interception
fix #92 and persistent voting #94 at `e666f5c2`. Held performance PR #93 was not
merged. Existing broad platform adoption in the branch was retained and extended.

`vercel.json` disables automatic Git deployment only for this design branch,
following [Vercel’s documented branch guard](https://vercel.com/docs/project-configuration/git-configuration).
This lets the requested PR update stay within the no-deployment instruction.
Remove that branch-specific guard if a preview is later authorized.

## What changed

**Home.** A confident Caslon masthead, a restrained orbital accent, and one navy
featured action replace the metric strip and repeated cards. Applications and
updates use ruled lists; the blue calendar column has a different role. The action
uses actual deadlines, appointments, drafts and unread urgent notifications. An
imminent deadline/appointment still wins over a notification. No applications is
an honest empty list, with an event or discovery action as appropriate.

**Recruitment.** The masthead and actual intake/review context share one header.
Navy provides structure for the live round filters and counts. Booking follow-up
precedes the review queue; pipeline labels expose booking and review bottlenecks
only with the existing access. The warm agenda stays secondary. Long round names,
multiple rounds, empty states and thousands of applicants do not dictate a fixed
number of columns or inflate the bounded review query.

**Dossier.** The candidate header and responses lead the document column. The
navy evaluation zone starts alongside it on desktop. Narrow layouts stack the
zones and include a keyboard jump to review. Existing fields, finalization,
autosave, decisions, interview links, history, uploads and anonymous projections
remain in their original workflows. Anonymous reviewers see neither private
responses nor an identity-reveal action. Privileged reveal remains permission gated.

**Shared system and expansion.** Added editorial `PageHeader` density and a
presentational `FeaturedAction`; centralized editorial geometry and navy/field
colors. Consolidated Home styling. Discovery, Applications, club overview and admin
adopt the smaller expressive hierarchy. Admin pairs a ruled attention list with a
blue metrics column. Existing shared controls, dense tables, writing, scheduling,
settings and supporting screens retain their purpose-specific compositions.
Public artwork, Corkboard identity, navigation and the Phosphor adapter are preserved.
No dependency, font, schema or data-fetching boundary was added by this V2 pass.

## Before and after

| Experience | Before, 1440px | After, 1440px | After, 390px |
| --- | --- | --- | --- |
| Home | [Before](evidence/before/home-1440.png) | [After](evidence/after/home-1440.png) | [Mobile](evidence/after/home-390.png) |
| Recruitment | [Before](evidence/before/recruitment-1440.png) | [After](evidence/after/recruitment-1440.png) | [Mobile](evidence/after/recruitment-390.png) |
| Identified dossier | [Before](evidence/before/applicant-1440.png) | [After](evidence/after/applicant-1440.png) | [Mobile](evidence/after/applicant-390.png) |
| Anonymous dossier | — | [After](evidence/after/anonymous-applicant-1440.png) | [Mobile](evidence/after/anonymous-applicant-390.png) |

Before images were captured from the pre-edit local development app; after images
use the production build. Fixtures gained anonymous/long-response states and live
tests added synthetic campus records, so these compare composition rather than
pixel-identical content. Before coverage is desktop only. The original before
filename incorrectly called the assigned identified reviewer “anonymous”; it has
been corrected without altering the screenshot.

## Visual QA

All records are synthetic and restricted to the guarded local dashboard fixture.
Playwright visits actual authenticated routes with local Auth, server actions and
PostgreSQL; no HTML mockups or replacement response data drive the main captures.

The [39-state reference matrix](evidence/after/results.json) covers Home,
Recruitment, assigned-review Recruitment, identified dossiers, anonymous-only
Recruitment/dossiers, and no-application Home. Populated reference screens and both
review roles cover **1440×900, 1280×800, 1024×768, 768×1024, 390×844, 320×844**.
No-application Home covers 1440, 390 and 320. Each recorded region passed axe WCAG
A/AA checks, with no browser errors or document overflow. Dossier checks include
its actual enabled form, document beginning and evaluation end. Scans target the
active workspace/dialog, excluding the inert background behind a modal.

Screenshots were inspected directly and in contact sheets. Refinements from that
inspection included shortening the draft headline for 320px, placing recruitment
context beside the masthead, moving the dossier title into the document column,
stacking booking controls on narrow screens, and preserving readable navy fields.
Long responses wrap and remain scrollable; the review jump has a visible outline.
Internal pipeline/tab scrolling is intentional and does not widen the page.

The [expanded matrix](evidence/expanded/results.json) contains **79** route/viewport
states across discovery, Applications, calendar, club overview, applicants, tasks,
interviews, organization settings, admin overview/users, Corkboard and login.
All had zero document overflow and zero browser exceptions; the eleven designated
390px accessibility scans passed. Contact sheets for every tested route and full
1440/390 captures are retained in `evidence/expanded/`. Admin overview has desktop
and mobile coverage; the other eleven routes include all six required widths and
a 720×450 reflow check at double pixel density. This approximates the layout space
of 200% zoom; it does not test browser chrome or physical devices.

The [scale fixture](evidence/scale/results.json) verifies **1,200 actual database
applications across six rounds**, a **12-item** queue and a **4,286-byte** private
summary response. Its single local read took 63ms; this is a local sanity check,
not a production benchmark. Screens at 1440/390/320 have no page overflow and the
last round remains keyboard selectable. No query implementation was changed.

## Functional and engineering checks

| Gate | Result |
| --- | --- |
| Full `node --test --test-concurrency=4 tests/*.test.cjs` | 1,432 passed, 0 failed, 45 conditional suites skipped |
| Live application-writing integration | Passed: actual saves, server validation, database and reload |
| Live operational dashboard integration | Passed: permissions, anonymous projection, bounded queries, keyboard/reduced motion, evaluation finalization, voting, tasks, RSVP, concurrency, loading/error/retry |
| Live settings/navigation integration | 11 passed: invitations accept/decline, claim submission, saves/reload/history, role guards, responsive navigation and admin elevation |
| [Dossier interaction verification](evidence/interactions/results.json) | Keyboard jump and visible focus, saved review in PostgreSQL, reload restoration, Escape and focus return all passed |
| Final focused regression checks | 14 passed after final copy/token cleanup |
| TypeScript | Passed |
| ESLint | 0 errors; 21 existing warnings |
| Final production build | Passed |
| Migration/RLS verification | Passed: 60 migrations, fresh/legacy paths, 79 protected tables |

The first development test run caught a missing icon import; it was fixed before
the passing production checks. A source test that required identical Home panels
was updated to assert the approved distinct V2 compositions and shared tokens.
The existing server-render harness gained a PageHeader mock for the new import.
The live loading test now requires exactly one **visible** skeleton and then zero;
Next can retain the previous route's hidden tree. Authorization/data assertions
were preserved. The full live operations run subsequently passed.

## Reproduction

Use the existing local fixture/setup and `scripts/serve-visual-unification.cjs`;
the new scripts call `readConfig` and reject arbitrary database/application hosts.
Never point these fixture writers at production.

1. `node scripts/seed-editorial-campus.cjs` adds a long response and an anonymous-only reviewer.
2. `OUTCLASS_EDITORIAL_AXE=1 node scripts/check-editorial-campus.cjs` captures the reference matrix.
3. `node scripts/check-editorial-scale.cjs` verifies the separate large local club.
4. `node scripts/check-editorial-interactions.cjs` verifies review autosave/focus and resets its synthetic draft.
5. Use `scripts/check-platform-visual-unification.cjs` with the route list in the expanded results and `OUTCLASS_VISUAL_MATRIX=1 OUTCLASS_VISUAL_AXE=1` for broad reflow checks.
6. Set `OUTCLASS_ONBOARDING_E2E_CONFIG` to the guarded local config for the live
   writing, operational-dashboard and settings-navigation test files.

## Review boundaries and remaining work

- Figma editable-node measurements remain unavailable due to the MCP quota;
  visual direction was verified against exact exported frames.
- This is Chromium/local production-build verification, not Safari/Firefox,
  physical-device testing, screen-reader certification or a production load test.
- The 45 skipped conditional suites were not all configured and run. The three
  relevant live suites above were explicitly enabled and passed separately.
- The earlier broad migration recorded an intermittent hydration 418. It did not
  recur in the current 118 reference/expanded states or the live workflows. Its
  original cause has not been identified; retain it as a watch item during review.
- Earlier navigation and invitation-test exceptions passed in the current full
  suite and the explicit settings run. The complete earlier route/overlay
  inventory remains in [the platform report](../visual-unification/report.md);
  this pass does not claim every possible overlay/state has a new screenshot.
- Final human design review and any merge/deployment decision remain outstanding.
