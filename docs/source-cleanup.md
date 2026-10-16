# Source and dependency cleanup

16 October 2026. Baseline main: `908f77c08baeb5b39d8902d66fe7aeff2c68b89f`. Branch: `chore/source-cleanup`.

## Result and scope

Implemented the authorized source-only cleanup batch. Removed **79 files** (350,493 bytes of tracked file content), including **67 disconnected TypeScript modules**, one orphan component stylesheet, nine ad hoc root JavaScript scripts, an obsolete Prisma configuration backup and a tracked local package-store database. Removed obsolete defaults and unused imports/bindings from retained files. Kept every test file and assertion.

Removed the unused `ClubManagerView` dynamic declaration and the seven components reachable only through that unused declaration; the active Club Settings/Demo Settings paths remain in AppShell. Removed the old `lib/demo-data` / `lib/demo-utils` implementation while retaining the active cookie-gated Demo store, seed, adapters, validation and saved-state upgrades. Removed the unused generic UI/toast/sidebar clusters and duplicate mobile/toast hooks. Current Sonner, Phosphor icons and active shell remain.

Pruned **22 direct dependencies**, from 59 to 37, and **122 lockfile package/snapshot records**, from 701 to 579. Every retained package record and direct resolved version matches baseline. No package version was added or upgraded. The lockfile was regenerated with the declared **pnpm 10.17.1** and validated by a successful frozen installation and postinstall. Node was 24.19.0.

Runtime query/polling changes from the scouting report are deferred. No schema or migration changes, timeout/concurrency changes, authorization changes, provider/credential changes, queue replay, preference mutation, email enablement or production operation was performed.

## Preservation and deliberate exclusions

All **85 protected source files** matched baseline hashes: Prisma/schema/migrations, Supabase files, internal workers, scheduler/delivery implementation, core Auth/support audit, compatibility action modules, deployment configuration/workflow and fail-closed Auth installer tombstones. All **257 emitted server-action (source file, exported name) pairs** remain present; none added or removed. No page/HTTP route was deleted.

Retained `actions/events.ts` and `actions/scheduling.ts` legacy adapters, all deny-only messaging exports, `db_test9.js` / `db_test10.js`, email-template generation tooling, tested artwork infrastructure and all public branding/artwork/licenses. The original five credential-recovery files were outside this separate checkout and were not accessed or changed.

Twelve modules remain outside the conservative route import graph. They are retained for tooling, compatibility, tests or conservative deferral:

- `actions/events.ts`
- `actions/scheduling.ts`
- `components/demo-controls.tsx`
- `components/landing/recruitment-demo-data.ts`
- `components/platform-organization-onboarding.tsx`
- `components/product/campus-illustration.tsx`
- `components/shell/navigation.tsx`
- `components/ui/empty.tsx`
- `lib/auth-email-templates.ts`
- `lib/campus-illustrations.ts`
- `lib/interview-mode.ts`
- `lib/review-rule-preview.ts`

Some references are mocks or path-prefix matches rather than active UI use. Their removal is not necessary for this batch and would need a separate fixture/compatibility review. Historic documentation/manifests may still name retired paths; those records were not rewritten.

## Measured build differences

Both builds used the same pinned baseline/final source comparison, Node/pnpm toolchain and localhost-only placeholder database/Supabase configuration. Production-column attestation deliberately skipped because this was not a Vercel production build. No hosted credentials were supplied.

| Aggregate artifact metric | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| All client JS, raw bytes | 4,492,542 | 4,442,963 | 49,579 |
| All client JS, gzip bytes | 1,371,794 | 1,357,752 | 14,042 |
| All CSS, raw bytes | 446,303 | 389,886 | 56,417 |
| All CSS, gzip bytes | 89,823 | 82,127 | 7,696 |

Client JS chunk count changed from 166 to 163; CSS file count remained 28. These are sums across **all generated route chunks**, not a single page's transfer size, unique installed disk savings or a hosted speed/latency guarantee. Gzip values use Python gzip with deterministic timestamps. Already-unbundled source deletion is primarily maintenance/dependency cleanup.

## Validation

- Final full suite: **1,183 passed, 27 gated skips, zero failures** (1,210 tests). Command: `node --test --test-concurrency=2 tests/*.test.cjs`.
- Local fresh/legacy migration checks: **all 54 migrations and all 77 application tables** passed RLS/browser-CRUD-denial checks. No live migrations were applied.
- Normal TypeScript, Prisma validation, production build and diff checks passed.
- Lint: **0 errors, 26 warnings** (baseline build had 28 warnings). No lint rule or assertion was weakened.
- Frozen dependency installation/postinstall passed; retained-version and protected-file hash comparisons passed.
- Browser tests in the full suite executed rather than failing at browser launch. Official Playwright Chromium downloads failed in this container, so browser runs used **Chromium 153.0.8010.0**, provisioned outside the repository, through Playwright 1.64.0. Launch used software-rendering restrictions for the container. No runtime/browser package or launch override was committed.
- Twelve additional localhost desktop/mobile smoke cases passed: `/`, `/about`, `/login`, `/corkboard`, `/platform/login` and the signed-out profile-entry redirect, at 1440×1000 and 390×844. All returned 200 after navigation, had usable body content, no page exceptions and no horizontal document overflow. Desktop/mobile landing screenshots were visually inspected. This does **not** claim fresh authenticated hosted Admin, profile or appearance mutations; those source paths are covered by existing local fixtures and the full suite.

The first full local run inherited an explicit email-disable override from the build/server wrapper, invalidating five mocked invitation-worker expectations. Removing only that override for unit fixtures yielded 22/22 focused passes and the final all-green suite. Provider credentials stayed empty, DB/Supabase targets stayed localhost, and local build/server email remained explicitly disabled. No external email was sent. A transient early smoke assertion ran before hydration; the final smoke waits for usable content and retains the same assertions.

## Dependencies removed

- `@radix-ui/react-accordion`
- `@radix-ui/react-aspect-ratio`
- `@radix-ui/react-context-menu`
- `@radix-ui/react-hover-card`
- `@radix-ui/react-menubar`
- `@radix-ui/react-navigation-menu`
- `@radix-ui/react-scroll-area`
- `@radix-ui/react-toast`
- `@radix-ui/react-toggle`
- `@radix-ui/react-toggle-group`
- `autoprefixer`
- `cn`
- `date-fns`
- `embla-carousel-react`
- `radix-ui`
- `react-day-picker`
- `react-resizable-panels`
- `recharts`
- `shaders`
- `tailwindcss-animate`
- `vaul`
- `@radix-ui/react-radio-group`

## Review and release boundaries

The exact changed-path manifest is `docs/source-cleanup-manifest.txt`. Deletions were rechecked against imports, literal dynamic imports, scripts/tests and source symbols. No tests were deleted or weakened. The original scouting ceiling was not treated as blanket authorization to delete compatibility/tooling files.

This PR does not resolve the outstanding autosave repair, historical scheduler diagnostics, hosted provider-owner email verification, authenticated release checks or the separately scoped runtime efficiency work. No migration prerequisite is introduced. Review CI and the normal release process before merging; main pushes may trigger automatic production deployment.

Local evidence is in the separate audit workspace's `cleanup-implementation` directory: baseline/final graph and build metrics, protected-file hashes, dependency comparison, action-export comparison, test/migration/lint/build logs and browser smoke results. Evidence is not production data and is not embedded wholesale in the repository.
