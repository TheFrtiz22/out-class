# Production readiness and UX reliability review

Reviewed October 8, 2026, against the current integrated OutClass codebase and a local production build. The requested `docs/outclass-reel-review.md` is absent; the supplied review was read in full from its attached output location. Its observations are context, not instructions to replace existing work or evidence of an untested defect.

## Outcome and scope

Preserved the established UVA imagery, split opening, typography, brand colors, Lucide integration, navigation, database architecture and authentication configuration. No dependencies, production schema changes, auth configuration changes, deployment, or production data writes were made. Browser tests use a guarded disposable local Supabase project with actual local authentication and database-backed actions. Fixtures are explicitly fictional.

The review covered loading/empty states, validation, pending/success/error feedback, refresh and deep links, navigation guards/history, mobile layouts, missing pages, public metadata/share assets, accessibility and performance. Existing SEO was inspected and tested, not reimplemented. This is a release assessment with verified fixes and explicit remaining work, not a guarantee of all production conditions.

## Verified issues and fixes

| ID | Issue confirmed before modifying its implementation | Resolution and affected files | Verification |
| --- | --- | --- | --- |
| R01 | Choosing a club in global search checked pending saves but bypassed the shared unsaved-change confirmation. A rejected confirmation still navigated. | Club selection now uses the existing `prepare()` guard, retaining the current route and search when cancelled and blocking navigation while saving. `components/shell/navigation-search.tsx`. | Failing-before/passing-after regression: declined prompt, in-flight save, then permitted selection. |
| R02 | Event permalink lookup errors were swallowed; a missing/withdrawn event produced no explanation. | Separate linked-event pending, retryable error and unavailable states; malformed UUID links are classified as unavailable without a futile request. Use shared LoadingState; keep the board usable. `components/events/public-event-board.tsx`. | Regression plus real browser failure injection, retry recovery and unknown UUID at both sizes. |
| R03 | The event query was read only on mount. Same-route link/history changes did not load the current event, and pending old lookups could win. | Observe `useSearchParams()` event ID, clear the previous detail and invalidate stale lookups with effect cleanup. Removing the event parameter closes the linked detail. Same event URL continues to open on refresh. Same component as R02. | Deferred out-of-order regression; actual history changes, Back and reload with two published local events at both sizes. |
| R04 | RSVP history displayed a zero count before its first read, with no explicit loading or real empty explanation. | Distinct loading, failed and successful-empty states. Counts are shown only when known; reuse LoadingState. Same event-board component. | Failing-before/passing-after pending/empty regression; real RSVP history, cancellation and reload. |
| R05 | A read started before cancellation could restore the cancelled RSVP after the write succeeded. Cancellation also lacked an explicit acknowledgement. | Version reads; invalidate earlier reads after a committed cancellation; clear stale errors and announce success. Existing API and storage stay authoritative; failed writes retain records. Same event-board component. | Delayed refresh/cancellation regression, actual database assertion after cancellation, then reload at both sizes. |
| R06 | A stalled workspace GET had no deadline and could leave dependent views pending indefinitely. | Abort read requests after 30 seconds, clear the timer after success/failure, and return a retryable message through the existing error handling. No automatic retry and no change to writes. `lib/workspace-read.ts`. | Failing-before/passing-after controlled deadline test; existing parallel-read, decoding, permissions and failure tests; browser 503/retry recovery for directory reads. |
| R07 | Lighthouse identified a heading-order skip: the hero preview's first H3 followed the page H1 without an H2. | Added a screen-reader H2 naming the existing preview figure and associated it with `aria-labelledby`. Its visible design and H1 copy stay intact. `components/landing/landing-hero.tsx`. | Actual pre-change Lighthouse node evidence; final Lighthouse/accessibility check. |

R01–R06 have reproductions in `tests/ux-reliability.test.cjs` and `tests/performance-regressions.test.cjs`. The new behavioral regressions failed on the original implementations before the fixes. The original flyer/modal keyboard and focus-return tests remain intact; their route-hook stub now matches the component's dependency.

## Existing capabilities verified and retained

- **Loading/skeletons and empty states:** shared LoadingState/WorkspaceLoading reserve layouts and announce once; discovery, saved clubs, tracker, booking, leader/admin tools retain their existing pending, empty and retry treatments. The previous interface consolidation was reused.
- **Forms:** application required-response and word-limit validation, unsafe/foreign attachment rejection, closed recruitment and profile/test policy checks are already implemented. Existing server tests retain ownership, draft/submission and duplicate-write guards. Real browser validation, draft save/reload and submission pass; no replacement form layer was introduced.
- **Error/success feedback:** directory 503 and event lookup failure recover by explicit retry. RSVP cancellation is acknowledged and survives refresh. Booking/rescheduling/cancel-confirmation and stored application feedback retain their existing behavior.
- **Refresh/deep links/navigation:** current student routes, legacy aliases and unified Status remain canonical. The full student journey checks search/filter persistence, profile return, saved draft, submitted detail, persisted booking and calendar. Workspace and global-search guard regressions pass. Event links now follow current history rather than only mount state.
- **Responsive/accessibility:** desktop 1440×900 and mobile 390×844 screenshot/interaction checks. Representative public, student, leader and genuinely elevated admin pages have no document overflow or unexpected browser errors. Native/Radix fields, mobile target sizes, dialog Escape/focus return, reduced motion and decorative skeleton semantics remain covered. Axe WCAG A/AA checks cover public pages, missing pages, event detail, filtered directory and the shared reference. Screen-reader/physical-device checks remain manual.
- **Missing pages:** existing branded 404, return link and actual HTTP 404 verified. Missing public event links are distinguished from transport failures. The existing root page error boundary retains retry/home actions. Root-layout/module-initialization outages were not fault-injected; a page-level error boundary is not evidence of complete root-outage recovery.
- **Metadata/social previews:** root, `/about` and `/uva` return their established titles, single H1, exact www canonicals, index/follow, consistent JSON-LD and existing OG image. The JPEG share asset returns 200 with the correct image type. Existing SEO tests cover sitemap eligibility, missing database fallback, private indexing boundaries, public club projection, structured data and footer links. No SEO helper, sitemap, robots, canonical or image was replaced. Per-platform preview caches still need external manual verification.
- **Performance:** retain deferred product bundles, cached public club data, self-hosted fonts and concurrent no-store read APIs. The new finite GET deadline improves failure recovery rather than hiding slow writes. No private-data caching or unsafe cache-header change was made to improve a score.

## Tests and evidence

`npm test`, `npm run typecheck`, `npm run lint`, the guarded local production build, and `git diff --check` were run. Existing SEO/performance/security/workflow suites are included in the full test run. No hosted schema migration was run.

Browser runners:

- `scripts/verify-student-journey-browser.cjs`: actual authenticated search/filter → club profile → invalid submission check → draft/save/reload → submission → Status → booking/reschedule/cancel-confirmation → calendar, both sizes.
- `scripts/verify-interface-consistency.cjs`: public/reference controls and overlays, leader applicants/settings/tasks and elevated admin users/reports, both sizes; field geometry, reduced motion, focus return and reference axe checks.
- `scripts/verify-ux-reliability.cjs`: public metadata/share asset/404, event missing/failure/retry/history/reload, actual RSVP/cancel/reload, directory failure/retry/no-results, screenshots, document overflow and axe checks, both sizes.

Browser artifacts are under the OS temporary directories `outclass-ux-reliability`, `outclass-interface-consistency` and `outclass-student-journey`. Credential-bearing fixture/session files remain outside the repository. Lighthouse JSON is under `/tmp/outclass-reliability-*-lighthouse.json`; results are local lab observations, not production field measurements.

## Remaining risks and manual release work

| Item | Verified evidence or verification limit | Required next action |
| --- | --- | --- |
| Privacy/Terms content | Landing footer dialogs still say this information will be published before launch; Contact describes the pilot rather than providing a concrete support channel. This was already recorded in the SEO review and is still present. | Owner-approved Privacy/Terms content and a real support destination before public launch. Do not invent legal terms or a support email. |
| Mobile LCP | The initial simulated-mobile Lighthouse run measured 4.9s LCP, performance82, zero CLS and zero blocking time, with ~653KiB transfer. The preserved campus opening imagery contributes to the LCP/image-delivery findings. Desktop measured 1.5s LCP/performance95 with zero CLS/TBT. | Validate on target networks/physical devices and production field data. Evaluate image compression/loading tradeoffs with visual comparison; preserve campus identity. Do not treat a good desktop score as a mobile release clearance. |
| Production integrations | Local authentication, DB-backed actions and admin elevation were exercised; real Microsoft SSO, email delivery, hosted storage and production concurrency were not exercised in this review. | Test a real UVA signup/sign-in/recovery and permitted mail/upload journey in the designated release environment. Confirm current deployed versions and service availability. |
| Device/assistive technology | Headless Chrome and automated axe cover representative states, not hardware keyboard/touch/VoiceOver behavior. | iOS Safari/Android, software keyboard, zoom, long-content dialogs, VoiceOver or NVDA, upload/download and offline/reconnection checks. |
| Social/crawler propagation | Local HTML and asset availability pass; social networks can cache old images/copy, and Google determines indexing. Campus-event links intentionally inherit the Corkboard's private/noindex metadata rather than generating per-event SEO. | Inspect public URLs using the intended platforms' preview tools after deployment. Decide whether event-specific share cards are a separate product requirement; do not silently change indexing boundaries. |
| Fault/load coverage | The new deadline applies to workspace GET reads; existing Server Actions still depend on provider/server timeout behavior. Root-layout failures, lengthy writes and peak recruiting load were not fault-injected. | Exercise provider interruption/slow writes and representative concurrent load before a broad release; verify root-level fallback behavior separately if an outage-handling change is proposed. |

No need for a production schema or authentication-configuration change was established by these fixes. Any later change in those areas requires its own documented rationale, rollout/rollback considerations and verification; it is not implied by this UX audit.

## Final results

- Full suite: **861 tests, 854 passed, 7 environment-dependent skips, 0 failures**. Focused reliability/flyer/performance checks: **18 passed**.
- Typecheck and local production build: **passed**. ESLint: **0 errors, 25 existing warnings**. Diff whitespace check: **passed**.
- All three browser runners passed desktop/mobile. The reliability runner additionally checks malformed event identifiers; no unexpected browser errors or document overflow, and no axe WCAG A/AA violations on the tested settled surfaces.
- Post-heading-fix Lighthouse: **accessibility100** on mobile and desktop; heading-order check passes. Performance: **83 mobile / 95 desktop**, LCP **4.75s / 1.49s**, CLS **0 / 0**, TBT **19ms / 0ms**. These single local simulated-network runs fluctuate; no image/performance redesign was made, and the mobile LCP concern remains open.

The earlier accessibility99 finding was verified and fixed. One contrast result captured during the translucent event entrance animation was checked again on the settled surface and did not persist; the existing purposeful motion was retained. Representative flows pass, but the manual release work above remains necessary.
