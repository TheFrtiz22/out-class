# Executed checks and evidence

Tests executed: 2026-10-20. Final evidence review: 2026-10-21. Base SHA and full scope are recorded in ACCESSIBILITY_AUDIT.md. Environment: macOS arm64, Node v26.9.0, pnpm 10.17.1 (invoked through npx because pnpm was not on PATH), Playwright 1.64.0 / installed Chromium 156, axe Playwright 4.14.0. CI uses Node 22 per the project configuration; that separate runtime and the GitHub Actions jobs have not been executed in this session.

## Commands actually executed

| Command | Result |
|---|---|
| `npx --yes pnpm@10.17.1 add -D @axe-core/playwright eslint-plugin-jsx-a11y` | Completed; package.json and pnpm lock updated |
| `node_modules/.bin/playwright install chromium` | Completed; required browser binaries were missing before this step |
| Read-only Playwright/axe production homepage baseline | Zero violations for the sampled page, with raw `incomplete` data retained in evidence/production-baseline.json; no authentication or form submission |
| Initial `npx --yes pnpm@10.17.1 validate` | **Failed:** 1,268 pass, 1 fail, 34 skipped of 1,303 tests. The failing UI assertion expected the removed overriding event aria-label. Validation stopped before later stages. Updated that assertion to verify the native poster name source |
| `node --test tests/campus-events-ui.test.cjs` after that update | **4 pass, 0 fail, 0 skipped** |
| Initial accessibility runs | Failed and used to find event label-in-name, signup contrast, admin overflow and text-spacing problems. Subsequent runs also exposed assertions that read state before React/resize/transition completion and incorrect event-control names. No rule was disabled to hide these failures |
| `node_modules/.bin/tsc --noEmit` after remediation | Completed, exit 0 |
| `node_modules/.bin/eslint .` after remediation | Completed, exit 0; 26 existing warnings, 0 errors |

The final successful runs are recorded below. Earlier failures are retained here to explain which defects the tests exposed; pending checks and skips are not passes.

## Visual checks

- `evidence/hero-comparison.png`: local 1440px hero before (left) and after (right); visually inspected in this session. Branding, font, imagery and layout remain intact in this representative state. The before capture occurred after initial nonvisual component edits, not at an entirely pristine checkout.
- `evidence/local-home-after-320.png`: captured and hero visually inspected at 320px. This is not a full clipping/zoom/AT acceptance review.
- Production baseline has a separate screenshot and unknown deployment SHA, so differences cannot be attributed solely to this branch.

Raw per-state JSON reports are generated under `test-results/accessibility/`; `violations` and `incomplete` are retained in the final archives under `docs/accessibility/evidence/`. Screen-reader acceptance, 200% actual text resizing, 400% browser zoom and remaining authenticated workflow coverage remain pending per the manual scripts.

## Final accessibility run

`npx --yes pnpm@10.17.1 test:a11y` — **27 passed, 0 failed, 0 skipped**, exit 0; 59.739 seconds for tests (plus local server startup). 52 per-state axe reports contained **zero violations**. There are 31 incomplete rule/state records for human triage; these are not passes. See [summary JSON](evidence/automated-summary.json) and [executed test output](evidence/accessibility-tests.txt).

## Final repository validation

`npx --yes pnpm@10.17.1 validate` — **exit 0**. Existing test suite: **1,269 passed, 0 failed, 34 skipped** of 1,303 tests. Migration checks applied **57 migrations** to fresh/legacy local test databases and verified RLS on **78 tables**. ESLint, TypeScript and production build all completed. Lint retained 26 existing warnings; PDF test output also reports a standard-font-data warning. Native/real-account tests requiring explicit isolated services/accounts remain skipped and are not represented as passes. See [full validation log](evidence/validation.txt).

Additional final source-related check: `node --test tests/campus-events-ui.test.cjs tests/campus-event-discovery.test.cjs tests/public-navigation.test.cjs tests/landing-perspective.test.cjs` — **21 passed, 0 failed, 1 skipped** of 22 tests. `node --test tests/phosphor-icons.test.cjs` — **5 passed, 0 failed**; Phosphor icons and license were preserved.

## Additional isolated account investigation

Docker was available, so the existing reserved localhost onboarding runner was used instead of leaving all account testing pending. `node scripts/run-onboarding-e2e.cjs --keep` provisioned a disposable Supabase project on ports 55321–55327, applied existing migrations and created a normally verified administrator with actual TOTP MFA. Its existing real Next HTTP/Auth/PostgreSQL/SMTP tests completed **38 passed, 0 failed, 0 skipped**. No hosted/production account, setting or data was changed.

The first authenticated axe run exposed shared label-in-name/rail contrast issues. The next iteration verified the shared fixes and actual application submission but found owner settings overflow and nested admin main landmarks. Those underlying defects were repaired; the final authenticated command and its results follow.

## Final authenticated accessibility run

`npx --yes pnpm@10.17.1 test:a11y:authenticated` — **18 passed, 0 failed, 0 skipped**, exit 0; 28.258 seconds for tests (plus isolated stack/bootstrap/build). This includes 16 actual protected page destinations at desktop and 320px and an actual invalid → review → submit application flow with PostgreSQL confirming `SUBMITTED`. **35 state scans, zero axe violations**; 67 incomplete rule/state records remain for human review. The local app/stack was cleaned up by the existing runner; its reserved containers and temporary credential configuration were confirmed absent. See [test output](evidence/authenticated-tests.txt), [summary](evidence/authenticated-summary.json) and [raw reports](evidence/authenticated-reports.zip). This is automated Chromium evidence; it does not substitute for the human AT journeys.

The public/component raw reports are retained in [this archive](evidence/public-component-reports.zip). Neither accessibility suite excludes axe rules. No production account or production data was used.

Representative final signed-in student Home, leader Recruitment and admin Users screenshots were visually inspected in this session. Layout, typography and branding remained intact in those desktop samples; this does not establish all responsive/zoom states. The mobile school/settings defects and their fixes were also validated through actual 320px browser geometry checks.

Manual scanner-review targets are retained in [manual-review-items.json](evidence/manual-review-items.json): **98 rule/state records** across both suites, including composited/gradient contrast, overlapping content, Radix lazy-content aria-controls references and focus guards. The missing availability-mode group role found in an earlier run was repaired and is absent from the final incomplete results. These records are not blanket false positives or passes; verify relevant open/closed states and AT behavior using M01–M07.

The final archives and logs were refreshed from these successful runs. All 60 source/config/test hashes still match [SOURCE_MANIFEST.json](evidence/SOURCE_MANIFEST.json); subsequent edits only reconciled documentation and retained evidence. The workflow jobs are implemented locally, but GitHub execution and required branch-protection settings remain operational follow-ups.
