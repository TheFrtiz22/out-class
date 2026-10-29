# Loading experience verification

Base: `29100f9c`. Testing uses this checkout and loopback-only disposable fixtures. Existing app stacks and the original checkout were not replaced.

## Successful checks

| Check | Result |
| --- | --- |
| Full `npm test` | **1,482 tests: 1,437 passed, 45 explicitly gated integrations skipped, 0 failed** |
| `npm run lint` | Passed; 21 existing hook-dependency warnings, no errors |
| `npm run typecheck` | Passed |
| `npm run build` and local fixture production build | Passed, including Next lint/type validation and 65 prerendered pages |
| `npm run test:migrations` | All 60 migrations applied to fresh/legacy fixtures; all 79 tables retain RLS and browser CRUD denial |
| `npm run test:a11y` | Passed actual component fixtures and public routes at desktop/320px |
| Authenticated selected-navigation integration | 16 passed on the fresh fixture, including four blocked-chunk cases, exact fresh reads, late results, revoked replay, notified authority epoch, desktop/mobile navigation and real font transport |
| Native PostgreSQL scheduler | 62 tests passed across two suites; bounded locks, polling, progress, rollback and claims exercised |
| Untouched-main publication baseline | Native publication runner passed all five constituent test groups on an isolated detached `29100f9c` worktree |
| Authenticated settings integration | 11 passed, including retained shell, role restrictions, saves/history, tablet/mobile and elevated administration |
| Source whitespace validation | `git diff --check` passed |

A fresh authenticated run also passed account serialization, onboarding/Auth/MFA/SMTP, session revocation, signup privacy, student claims and real PDF import. One settings check initially inspected a button before the new route boundary had resolved; it now awaits that exact control before retaining the same visibility assertion, and all 11 focused settings tests passed.

The full initial baseline had one browser-fixture timeout waiting for selectable PDF text. The full final run passed that test along with all other ungated tests. No PDF behavior or assertions were changed.

## Browser evidence

See [browser-results.json](evidence/browser-results.json), [layout-results.json](evidence/layout-results.json), and [behavior-results.json](evidence/behavior-results.json).

- **40 full workspace pairs**: club overview, recruiting overview, members, tasks, announcements, pipeline, scheduling, and application settings at **1440, 1280, 768, 390, and 320px**.
- Each pair uses the real production application, authenticated disposable local account, and the real authorized API response. Playwright holds delivery of that response to simulate slow transport, captures pending content, then releases it and checks that real destination content replaces it. No applicant data or successful response bodies are fabricated.
- These cases assert navigation is present, one visible busy status, no horizontal overflow in pending or ready content, and static skeletons under reduced motion. They reject an error being mislabeled as ready.
- **45 focused layout captures**: interview, voting, candidate presentation, form, document, month calendar, schedule, feed, and table at each width, rendered by the actual `/design-system` route. These are geometry/accessibility checks of shared primitives, not claims of complete authenticated interview/voting/decision workflows.
- Warm overview refresh stays mounted and disables duplicate refresh. A deliberately aborted member request removes the skeleton, reveals no records, offers Retry, and succeeds after keyboard Enter with exactly one fresh read. The same navigation DOM node survives failure and retry. See `refresh-390.png`, `failure-390.png`, and `retry-390.png`.

The screenshots were examined through review sheets, including desktop/laptop/tablet/phone/narrow-phone captures. Ready examples were also inspected. The visuals exposed a CSS cascade issue that overrode rounded avatar placeholders; its rule was removed. Comparing the applicant placeholder to the ready page also prompted a final refinement: review actions, filters/sort, a seven-column desktop table, and applicant cards below 1280px. All five pipeline pending→ready pairs were recaptured and verified afterward. Placeholder actions remain decorative and cannot receive keyboard focus.

Reproduce with this checkout running on the reserved `http://127.0.0.1:3147` and the existing strictly validated onboarding fixture copied to the local loading QA configuration:

```
node scripts/loading-visual-qa.cjs
node scripts/loading-layout-qa.cjs
node scripts/loading-behavior-qa.cjs
```

These scripts refuse a hosted destination. They preserve the original local stack and use its test account; the rendered figures are test-fixture data.

## Previous CI failures investigated

- PR #95, [validation run](https://github.com/TheFrtiz22/out-class/actions/runs/40803011057): shared component loaders guessed `.ts` for TSX, new loading imports were absent from mocks, and several tests inspected raw JSX rather than rendered loading status.
- PR #96, [validation run](https://github.com/TheFrtiz22/out-class/actions/runs/40807370231): decision-letter loading import errors, a dock browser failure and a voting snapshot assertion. Several harness fixes were already on the audited `main`; the final full suite passes these cases.
- The [#95 integration run](https://github.com/TheFrtiz22/out-class/actions/runs/40803011221) and [#96 integration run](https://github.com/TheFrtiz22/out-class/actions/runs/40807370206) failed font-face assumptions and selected-tab loading checks. The font assertions were already corrected on main. The selected-tab test now awaits the loading UI commit before asserting its single visible status; it still blocks the actual chunk, requires concurrent data dispatch, verifies one read and retains stale-result/security assertions.
- Both inspected historical integration workflows passed their native scheduler/publication jobs. Their workflow-level failure did not mean those jobs failed.
- Newly touched component harnesses now resolve the real shared loading module or expand its status output. No behavior/security assertions were weakened.

## Release limitations and unresolved checks

The local native publication runner is **not consistently green**: one run failed crash-recovery/claim and later permission assertions; a later run stalled/faulted in the mixed-backlog timing test. The untouched-main baseline passed the same runner. Its database/actions/worker/native test sources are unchanged by this branch. This is recorded as an intermittent local integration problem, not declared harmless or fixed. The stalled child was stopped and its dedicated fixture cleaned up. The first PR-head GitHub run passed every native integration job, including scheduler and publication/audiences; retain those checks on the final head as release gates.

The 45 environment-gated tests in the full suite were not all provisioned here. Separate migration, scheduler, publication, accessibility, navigation and loading browser checks cover relevant boundaries, but do not substitute for every existing authenticated end-to-end suite. No manual screen-reader session or full authenticated voting/interview/decision-letter workflow is claimed. Release remains gated on required CI. Do not merge or deploy while required checks are failing or pending.
