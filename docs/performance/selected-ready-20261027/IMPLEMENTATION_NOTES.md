# Isolated selected-workspace startup

Base: current main `06d3e93110d09fc564de7e28cf7dc3a71f081fe4`. This ports the selected-tab startup mechanism from Phase 2 and synchronous client Auth epoch fencing from Phase 12, while preserving the newer main navigation UI and already merged font/logo changes. The original full pipeline endpoint remains. Pagination/projections, later module deferral and rejected Phase 14/15 Settings experiments are excluded.

Exactly nine application files differ, listed in `CANDIDATE_SOURCE.json`. Four selected tabs—Members, Applicants/Decisions, Tasks and Announcements—start their public module import and existing guarded private GET together. The result is consumed once by the mounted child, avoiding a second mount read. The previous 30-second retained directory/pipeline reveal is removed: each visit must complete a fresh live read before exposing private content. Warm latency against the old early reveal is an explicit security/freshness cost, reported separately.

Auth publishes an opaque client epoch ref synchronously before scheduling its React context update. The selected loader checks that epoch before dispatch, on settlement and during render. An already known Auth change cannot cause an obsolete request followed by a replacement; a genuinely later change still triggers fresh validation. Leaving, switching club/account/privacy/support mode, retries or Demo changes prevent old results from appearing. Fixed-label diagnostic events contain no identities, tokens, cookies, query values or authorization results and cannot block a read or Auth event if an observer throws.

No Server Action, API handler, remote identity verification, live session/revocation/not_after check, account enablement, capability/membership/suspension guard, support restriction, anonymous/self-review projection, voting authority, transaction, query, schema, index, dependency, infrastructure setting or region changes. Protected GETs keep private no-store and Cookie handling. Demo follows the existing local path. Draft persistence, mutation actions, necessary live updates and production animations remain unchanged.

Verification before measurements:

- Full ordinary rerun: **1,367 passed / 44 gated skips / 0 failures**, 1,411 total.
- Serialized real Auth/browser selection: **45 passed / 0 failures/skips**, including Phase 1 transport/concurrency/security, four selected-tab overlap cases, late results/revoked revisit, desktop/mobile, constrained Auth epoch/revisit acceptance, settings/drafts/history, account data and signup privacy.
- Dedicated native security/concurrency: **three passed**.
- Fresh verified signup/Auth/TOTP baseline provisioning: **38 passed**. These overlap the live selection and are not added together.
- Both production builds, types and all 57 fresh/legacy migrations/78 RLS tables pass. Lint: **0 errors / 22 pre-existing warnings**.
- Focused startup/scope/transport checks: 24 passed. Diagnostic/output guards: four passed. Analysis edge checks preserve zero/null/nonfinite accounting and pending snapshots.

The initial focused run fails one obsolete retained-directory test because the implementation deliberately removes that early reveal; it is replaced by explicit fresh-visit and scope/late-result checks. The first full ordinary run records 1,358 passes, five failures and 44 skips. All five failures are the loading-experience harness failing to resolve the new diagnostic module alias. One explicit no-op mock repairs that harness; all original assertions remain, its seven checks pass, and the complete rerun passes. No application change follows the candidate build/source freeze. All failures/logs are retained and excluded from performance membership.

The frozen comparison plan is `PLAN.json`: local and constrained profiles, BA then AB, one excluded warmup plus five measured visits per block/path/condition. This yields n=10 per variant/path/condition/profile, 320 measured and 64 warmup outcomes. Cold/warm refers to destination browser state with warm local services, not hosted cold starts. Constrained CDP is 80ms latency, 200,000B/s down, 93,750B/s up and CPU4×. One synthetic 100-applicant fixture is identical across builds. Small-group p95 is the observed maximum; it cannot establish production tails or multi-user capacity.

Host/source/fixture/tool/plan controls and independent actual sleep audit must pass before results are accepted. No builds or tests run during collection. All outcomes, errors, unknown bodies and aborted/pending request snapshots remain recorded; no slow row is replaced. No performance adoption decision is made in this implementation note; the completed comparison/report supplies that decision.
