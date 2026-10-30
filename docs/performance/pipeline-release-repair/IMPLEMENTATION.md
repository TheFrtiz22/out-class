# Implementation and tradeoffs

The repair initially used `f2192e02` and is now rebased onto exact current main
`6e793dea0bd45052fa444749b26d432ae93392cd`. It retains Phase 1, PRs
85/87/88/89, the independently merged dock fix, live voting rooms, transaction
budgets, contextual loading and the current layouts. Source proof is recorded
in `SOURCE_PROOF.json`.
The held candidate was read as source material, not merged or cherry-picked.
Only its bounded paging/projection/ownership pieces were ported and revised.
Settings preload/handoff and the historical raw metadata SQL join remain out.

## Application changes

| File | Purpose |
|---|---|
| `actions/crm.ts` | Fresh guarded page/selection operations sharing the original Repeatable Read reader; canonical detail hydration bounded to selected IDs; plain round filtering retains global facet metadata. Mutation tail remains unchanged. |
| `app/api/workspace/route.ts` | Strict explicit GET kinds and argument schemas; voting optionally accepts setup-selection arguments. Existing private/no-store, Cookie, same-origin and Demo handling remain. |
| `components/selected-club-workspace.tsx` | Preserve selected code/data overlap while requesting the appropriate bounded Applicants/Decisions/Rejected mode. |
| `components/views/leader-dashboard/live-leader-workspace.tsx` | Existing owner controls a bounded page; detail fields come from that page; complete coverage supports local canonical selectors; quick-review/bulk continuations retain authority/query/revision fences and acknowledged-write refreshes. |
| `components/views/leader-dashboard/live-applicant-views.tsx` | Bounded full-detail row type and globally correct lane counts; current presentation, controls and accessibility stay in place. |
| `hooks/use-pipeline-page.ts` | Dispatch/settlement/render fencing, serialized latest-query reads, single-use adjacent-page adoption, exact-owner in-flight coalescing and complete-dataset coverage. Starting a fresh guarded read supersedes the previous coverage even after a denial/query race. |
| `hooks/use-pipeline-applicant.ts` | Fresh single-applicant reads for dashboard previews only. Ordinary on-page details do not use this hook's network operation. |
| `lib/pipeline-page.ts` | Strict query/cursor contract, canonical privacy-aware search, deterministic sorting, facets, counts and minimal complete selections. |
| `lib/pipeline-page-read.ts` | Scan scalar metadata for global ranking; hydrate at most 100 selected full projections in the same snapshot. Complete review metadata is retained when required by review/rating/score selectors. |
| `lib/pipeline-selection-read.ts` | Return IDs, round, status and advisory quick-review eligibility; avoid full reviews/assignments unless a selector actually observes them. |
| `lib/pipeline-summary.ts` | Explicit database metadata allowlist and shared canonical privacy projection. |
| `lib/pipeline-list.ts` | Narrow compatibility/list projection and deterministic reviewer references. No second UI data owner. |
| `lib/pipeline-detail.ts` | Extract the original authorized detail projector; explicit ordering makes nested answers, evaluations, experiences and bookings independent of Prisma relation plans. |
| `lib/application-review-visibility.ts` | Shared original submitted-review/assignment/self-review/closing-score rules for summary and detail projections. |
| `lib/anonymous-review.ts` | Reuse canonical anonymous identity/academic projection for metadata; hidden identities/free text cannot influence search or ranking. |
| `lib/recruitment-profile.ts` | Minimal canonical recruitment-list academic fields. |
| `lib/interview-review-summary.ts` | Deterministic numeric aggregation across relation order; preserve score visibility/required-review semantics. |
| `lib/live-applicant-sorting.ts` | Allow the narrow metadata type while preserving missing-last ordering and stable ID ties. |
| `lib/applicant-pagination.ts` | One existing visible-page bound and pagination helpers. No cohort-count rollout threshold. |
| `components/live-voting/board-decision-mode.tsx` | Remove C's serial complete-selection preloader. Pass setup query to the voting read, consume its minimal candidate set, and fence board data by complete current owner/epoch. Existing serialized polling/refresh behavior remains. |
| `actions/voting.ts` | Include setup selection inside the voting read-only Repeatable Read snapshot; preserve snapshot member checks and post-snapshot live session/member/participant checks. No voting write or locking changes. |
| `lib/voting-candidate-selection.ts` | Apply current voting authority, anonymous-round visibility and explicit gender-visibility guard to the canonical setup selection. |
| `lib/workspace-api.ts` | Same sole live/Demo boundary; page/list/selection GET adapters, full Demo page coverage, and snapshot-owned voting setup data. Writes remain Server Actions. |
| `lib/demo/voting.ts` | Match the optional snapshot-selection contract without live transport. |
| `lib/in-flight-workspace-read.ts` | Weakly owned map of only currently pending identical reads. Exact owner + kind + all arguments distinguish scope; entries disappear on success/failure. No successful-authority cache. |

The complete owner includes account/effective actor objects, session/Auth epoch,
club/campus membership and capabilities, support and Demo mode, readiness and
mutation revision. Query/cursor/filter/selection arguments remain part of the
read key. Distinct owners deliberately do not coalesce even if inputs look equal.
Existing consumers still perform their own stale-result settlement fences.

## Why a full visible page

C minimizes initial summary bytes but imposes a later detail dependency and
extra small-cohort search/selection reads. D returns the canonical full fields
for the existing visible page, one copy per row. It does not hydrate or return
the remaining thousands of applications. Complete-dataset coverage follows the
actual response, not an arbitrary club-size threshold. This makes the same
server contract work at one, 100, 1,000 and 5,000 applications.

This is a measured tradeoff, not a claim of minimum possible initial bytes.
Large essays/bookings can make 100 full rows substantially larger than C's
summaries; the comparison must assess entry bytes and complete journeys together.
An on-demand combined detail/display contract is a possible separate future
design if realistic detail sizes defeat these acceptance limits. It is not
silently substituted into this experiment.

## Verification and tooling

`scripts/pipeline-release-fixtures.cjs` makes additive one/100/1,000/5,000 cohorts
using the existing normal verified seed and scale infrastructure. It copies
memberships/rounds with new IDs, enriches synthetic answers/reviews and verifies
counts. Secondary owners preserve last-owner protections during account-disable
QA. It deletes no submitted reviews and disables no database protections.
Shared seed profiles can be enriched by multiple cohort passes; report actual
fixture contents rather than comparing them as independent populations.

`scripts/run-onboarding-e2e.cjs --club-integration --pipeline-release-repair`
extends normal Auth/settings/navigation verification with the four-cohort and
paged pipeline checks, including real mobile/touch/history and multi-round
canonical parity. The one-applicant fixture needs no hosted/manual SQL.

The lifecycle/study/workflow/capacity scripts operate only on the reserved
loopback project, refuse overwritten attempt directories, record exact source,
build and tool hashes, and keep warmups and failed/interrupted attempts separate.
Whole sleep-invalid attempts are excluded. The read-only workflow includes real
CTA entry, detail/review content, switching, global search, complete selection,
cold/warm voting and full candidate-pool setup. It accepts the real confirmation
to discard its unsaved local voting setup; it submits no ballots or decisions.

Tests retain original behavioral assertions while updating their data/Auth/hook
fixtures to the explicit contract. The score assertion remains a full-detail
score assertion. New tests cover exact projection parity, global metadata,
scope/cursor isolation, real authority denial, query races, covered-page denial
fencing, in-flight-only reuse, pagination/draft boundaries and complete voting
selection. No failure is converted into a skip.

The independent dock implementation and its separate PR are documented in
`DOCK_INTERACTION_REPORT.md`. No additional dock change appears in this pipeline diff against current main.

No schema/index/region/pool/production configuration changes, new cache
frameworks, external infrastructure or private-authorization caching are added.

The corrected CI comparison uses separate dependency installations, explicit
absolute build/start directories and served document/runtime-asset/data-contract attestation
before every timed block. The first CI attempt failed source attestation on
retrospective request inspection and is wholly excluded. See FULL_REVIEW_PLAN.md.
The earlier workflow collector is preserved as failed instrumentation; the new
full-review collector checks each build’s exact visible row count and waits for
review/attendance information before switching. Voting history is measured; new
persistent live rooms remain covered by main’s regression suite, not these timings.

Ordinary manager session/history polls now omit selection metadata. Initial
entry still includes it to avoid a serial setup request, and open setup polls
refresh it. Explicit reopening hides prior eligibility until that exact fresh
operation settles. The workflow/trigger remains mounted for focus restoration.
No eligibility or authorization cache replaces those guards. Initial large
history entry and populated booking/ballot-history performance remain unmeasured.


Evidence tooling adds `scripts/summarize-pipeline-release-repair.cjs` to rebuild
BENCHMARKS.json from retained raw rows. It requires whole-attempt completion,
source/tool/clock verification and every served-build attestation, excludes
warmups, preserves missing sizes/null milestones and calculates the unchanged
frozen gates. CONTROLLED_RESULTS.md presents the distributions without pooling
profiles or treating observer-heavy workflow durations as production timings.
CHANGED_FILES.json lists every changed code/test/tool/evidence path;
EVIDENCE_SEAL.json hashes their bytes and verifies all 963 measured application
source files still match the frozen digest. Failed/interrupted raw attempts are
part of that evidence, never successful observations restored into a distribution.
