# Reproduction

Use supported Node 22, pnpm 10.17.1, Docker's Linux engine, OpenSSL and Chromium.
Never load repository `.env` files or provide hosted credentials. The fixture
runner validates dedicated loopback addresses/ports and refuses occupied app
ports before touching its reserved project. Preserve unrelated worktrees and
services. The original one-applicant setup is now automatic.

```
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium
node scripts/run-onboarding-e2e.cjs --club-integration --pipeline-release-repair
```

This runs normal verified Auth/settings/runtime checks, selected navigation,
four-cohort preparation, canonical page/selection checks and real mobile/draft
flows, then stops its own disposable project. For manual controlled review,
append `--keep`; this intentionally retains its private local configuration and
server. Credentials in the OS temporary directory must never be committed or
uploaded. Cleanup with the owned lifecycle and Supabase CLI after review.

For the source-controlled performance protocol, use
`.github/workflows/pipeline-release-comparison.yml` on the repair PR. Add the
`run-performance-comparison` label (remove/reapply for a new attempt), or use
workflow dispatch on the intended branch. Routine documentation pushes do not
start another expensive comparison. The workflow installs
each checkout's dependencies separately, freezes exact main
`6e793dea0bd45052fa444749b26d432ae93392cd`, builds both production variants with
the same disposable fixture and runs QA before measurements. Each profile has
one isolated GitHub-hosted Linux VM. Both builds run sequential BAAB blocks on
that same VM. Completed production outputs are frozen with full runtime file
digests (build cache excluded) and restored into one owned runtime checkout;
source files never change. Both variants pass an explicit preflight step before
sampling, and each later restoration is attested again. The workflow uploads only sanitized benchmark artifacts; it does
not upload temporary Auth configuration, cookies, fixture passwords, certificates
or database records. Download artifacts before their 30-day retention expires.

Before **every** timed block the collector verifies served document build ID and required runtime JavaScript bytes
against that build's disk hash and verifies the authenticated data contract:
main returns N complete applications and rejects `pipelinePage`; repair returns
min(N,100) visible applications. A failed preflight prevents timing. Exact
source/build/tool/acceptance hashes and fixture hashes are recorded per attempt.
No builds or other tests run concurrently with timing on the same VM.

Primary navigation collector flags remain:

```
--phase2 --phase3 --cold-warm --record-failures --source-diagnostics
```

The CI study requests 15 samples/block at one applicant and five elsewhere,
with two excluded warmups/block. The strict full-review collector requests
five samples plus two excluded warmups/block at each size. Main's full-review
invocation includes `--baseline` to require its exact full-cohort row count.
The constrained profile adds 80ms latency, 200000 bytes/s down, 93750 bytes/s up
and CPU4 via CDP. Capacity uses concurrency 1/2/4, pool limit eight, BAAB waves
2/2/3/3, totaling 140 measured plus 56 excluded warmup requests.

Keep unsuccessful and interrupted attempt directories. Never reuse an output
directory or pool outcomes from different hosts, profiles, protocol revisions
or attempts. The first CI attempt and every Mac timing attempt are excluded
as whole attempts, including successful rows. See FULL_REVIEW_PLAN.md.

After placing downloaded raw CI evidence beneath this report's `ci/` directory:

```
node scripts/summarize-pipeline-release-repair.cjs
```

The summarizer also requires the diagnostic source object `980522d7` for the
historical accepted B/C comparison. It records that source's SHA256 and retains
all 52 historical comparison groups separately. It does not reclassify any
historical sleep-invalid supplement as accepted. Nearest-rank percentiles and
missing values are explicit; raw data remain unmodified.

Other repository validation commands are `pnpm validate`,
`node scripts/test-decision-transactions-local.cjs`,
`node scripts/run-disposable-postgres.cjs security`, and the existing disposable
integration workflow. Hosted check links and log summaries identify the exact
commands run for this repair. No deployment or merge is part of reproduction.


A constrained-only repeat can use `run-constrained-performance-comparison` on
the PR. It leaves the completed local comparison untouched. Future jobs allow
360 minutes overall, with a 315-minute collection step so owned cleanup and raw
upload retain time if collection reaches its budget. Upload paths include only
that run/attempt, avoiding duplicate historical raw files already committed.
These lifecycle safeguards change no application source, workload, warmups,
sampling, served-build checks or acceptance thresholds. Do not launch a repeat
unless the prior profile is incomplete/invalid or a new unresolved concern
justifies it; preserve and exclude a whole incomplete attempt.


The constrained-only label now partitions all four cohorts onto separate VMs;
each uses the same source/fixture generation and complete within-VM BAAB pair.
Commands pass `--cohort=1|100|1000|5000` and `--readiness-timeout-ms=180000` to
both builds' collectors. The no-cohort/default-all study retains its original
30-second observer wait. See FULL_REVIEW_PLAN.md for the predeclared reason,
whole-attempt exclusions, unchanged milestones and acceptance limits.


Final reproduction boundary: the recorded local source is 4d52103e and the
completed constrained cohort tools are 3d4f4128, both against main 6e793dea.
Current tools include the post-measurement characterData observer fix. Therefore
running current tools is a new comparison, not a replay of those old observer
semantics. No old times may be adjusted or pooled with it. The fixed-study
summarizer deliberately retains false strict-observer release clearance and
all recorded numeric gate outcomes. This application candidate is rejected;
no additional performance collection is requested here. Final remote main is
bc22b0a3 and was inspected, not measured by this study.
