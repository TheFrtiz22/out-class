# Platform visual unification — implementation and QA

Status: historical broad-migration record. The approved V2 implementation and current verification results are in [Editorial Campus OS QA](../editorial-campus-os/README.md). PR #90 remains draft for human review. No merge or deployment was performed.

## Implementation

Baseline: `795e92c1` on `design/platform-wide-visual-unification`, including latest main at `f2192e02`. The original working tree was clean. No performance branches were merged. Navigation components, optical material CSS, routes and permission filtering remain unchanged.

The content system now defines solid operational surfaces, an 80rem content maximum, bounded grid tracks, consistent adaptive padding and spacing, a clear edge/elevation hierarchy, readable field labels and contained data scrolling. Shared Card, Surface, Table, Tabs, Dialog and checkbox presentation retain their existing APIs. New explicit composition recipes live in `styles/workspace-composition.css`; screen owners adopt them instead of depending on another layer of descendant overrides.

Explore's overlapping style patches were consolidated into one stylesheet. Its display title uses Libre Caslon Text rather than the stray Georgia override. Calendar, notifications, profile and memberships share content framing. Recruitment gains a deliberate action group and toolbar, with compact data tables and mobile applicant cards. Settings, member management, meetings, tasks, announcement/decision schedules, event controls, administration and supporting forms use the same materials. Admin's real attention queue precedes summary metrics. Dense tools retain row density and local scrolling. Corkboard paper/artwork, formal letters, immersive voting/interviews and public editorial pages retain their distinct purpose.

The migration also removes the profile editor's unnecessary backdrop filter, consolidates badge precedence without `!important`, keeps mobile save bars above the existing dock, preserves square checkboxes with larger touch areas, and reserves dialog close-button space. No dependencies, fonts, interface icon families or data-fetching boundaries were added.

## Functional defect found during verification

The baseline operational dashboard test failed to open a submitted task. The drawer already supplied a task/assignment focus, but `/api/workspace?kind=tasks` accepted only a single club UUID and rejected the existing focused request. The endpoint now validates either its original one-argument request or the existing strict task/assignment object. Authorization still runs in the original task reader, arbitrary identity fields are rejected, and the response remains private/no-store. Regression checks cover valid focus, invalid IDs, extra identity fields and revoked access. The authenticated task review/submission workflow passes after this repair.

## Evidence and reproducibility

All browser records are synthetic and confined to the guarded local `outclass-dashboards-e2e` fixture. The scripts reject arbitrary application/database hosts. Authenticated screenshots use actual Next routes, Auth sessions, server actions and PostgreSQL. They do not substitute decorative page mockups for product screens.

- [Discovered routes/components/overlay titles](inventory.json)
- [Domain coverage and remaining work](coverage.md)
- `scripts/seed-visual-unification.cjs`: synthetic identities, clubs and operational records
- `scripts/extend-visual-fixture.cjs`: explicit interview offices, dense inbox and voting session
- `scripts/publish-visual-interview-fixture.cjs`: actual interviewer confirmation and owner panel publication
- `scripts/check-platform-visual-unification.cjs`: page/role/viewport screenshots, overflow, browser errors and axe
- `scripts/check-platform-workflows.cjs`: writing, drawers, board/filter selection, creation forms, failure/retry and loading
- `scripts/make-visual-contact-sheets.cjs`: inspectable groups of actual screenshots
- `tests/workspace-materials-browser.test.cjs`: responsive data containment, controls, dialog geometry, focus and accessibility regression

Before captures use the unchanged baseline production build. Iteration and final captures are kept separately under ignored `test-results/platform-visual-unification/`. Representative before/after images and machine-readable summaries are copied beside this report after verification. Native fixtures can add records while tests run; comparisons of layouts are not a pixel-identical data snapshot.

Required widths: 1440×900, 1280×800, 1024×768, 768×1024, 390×844 and 320×844. The 200% reflow check uses a 720×450 CSS viewport at double pixel density, matching the layout space of a 1440×900 browser zoomed to 200%; it is not a claim of testing browser chrome or physical devices. All primary page captures use reduced motion for deterministic inspection. The shared control test also exercises keyboard selection, Escape and focus restoration.

## Acceptance results

Final result counts and selected screenshots will be recorded in `evidence/verification.json` after the running checks finish. Do not interpret an earlier capture or a route discovered in the source inventory as a passed gate.

Verified so far: production build, TypeScript, lint with 21 existing warnings, application writing through real saves/reloads, operational dashboards through task review/submission/RSVP/authorization/retry, and shared-control responsive/axe checks. The initial full suite exposed a malformed pre-existing CSS assertion; that assertion now matches actual CSS syntax. Admin guard tests retain their real authorization checks and isolate the newly imported visual icons in their existing test harnesses.

## Open acceptance exceptions

- Re-run the navigation browser suite in isolation after CPU-heavy tests: its moving-dock interaction timed out under concurrent validation. The navigation implementation has not been changed to work around the timing failure.
- Diagnose intermittent production hydration error 418 observed during larger navigation sweeps. A separate development run through tasks, meetings, members and settings did not reproduce it. Its cause and regression status remain unresolved; successful screenshots alone do not close this exception.
- The broad authenticated settings suite timed out locating Decline after creating a second identity invitation. Other personal settings, organization saves, access denials and responsive navigation subtests passed. Keep the invitation/claim flow open until it passes or the exact underlying failure is documented.
- Finish inspecting the final screenshot sets after the latest layout fixes, including authorized interview/voting states and the supporting-route gates. Earlier intermediate screenshots exposed admin grid overflow, Corkboard overflow at 320px and low-contrast adjacent-month dates; these have source fixes awaiting the final captured result.

No authentication, schema/migration, Supabase query, publication or autosave behavior was relaxed to make a visual check pass. Production verification, a merge to main and deployment remain outside this local work.
