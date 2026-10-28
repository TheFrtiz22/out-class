# Reproducing the bounded-pipeline investigation

Use an isolated worktree and the explicitly disposable `outclass-onboarding-e2e` project; never load a production `.env`. Preserve the user's original checkout, unrelated containers and all existing evidence. The published directories are immutable inputs and the controllers refuse overwriting them. A repeat requires a fresh empty evidence directory in a disposable copy, fresh private snapshots/manifests, and new attempt names. These commands describe the actual entry points; they are not a command to rerun against the sealed results.

## Review existing evidence without services

From the experimental or diagnostic worktree:

```sh
node --test tests/navigation-pipeline-summary.test.cjs
node scripts/summarize-navigation-pipeline-ready.cjs
```

The summarizer validates each accepted protocol, its frozen plan and archived collector hashes before deriving52 comparisons. It excludes all warmups and the complete sleep-invalid supplement. `collector-sources/` contains accepted collector versions, not compiled apps, environment files or private fixtures. The invalid first supplement's older script version is identified by its protocol hash but is not claimed to be reconstructed. SHA256SUMS seals the delivered artifacts; the summarizer output has a new generation timestamp on regeneration.

## Application QA entry points

Candidate implementation is commit `375a00d54d95f24e7d600a56218b9bf8040a7937`; baseline is main `78402ee611f46b8764898250e46b6dcc8dab7654`. Install locked dependencies in the disposable worktree before running:

```sh
npm test
npm run typecheck
npm run lint
node scripts/run-onboarding-e2e.cjs --club-integration --selected-navigation --keep
node tests/authorization-migration.cjs
node scripts/check-migration-path.cjs
node scripts/test-decision-transactions-local.cjs
```

The onboarding runner provisions the reserved loopback project, builds with its explicit local environment and executes normal verified signup/session/MFA and selected integration tests. Its extended selected-navigation phase first runs existing cases at100 applicants, then enriches to1,000 and runs the new pagination/privacy/draft/native-snapshot cases. Use its normal cleanup path when not retaining the stack. The native transaction runner creates/removes its separate guarded PostgreSQL container at58452 and executes both the49-case transaction suite and42-case recruitment/offers/communications suite. These checks are independent of the browser benchmark and must run outside timing intervals.

## Frozen-build timing setup

The lifecycle helper `scripts/navigation-pipeline-ready-local.cjs` reads only the guarded disposable config under `path.join(os.tmpdir(), 'outclass-onboarding-e2e')`. It verifies loopback ports and PID/CWD ownership before stopping an app. Create a mode700 `outclass-pipeline-ready-builds-*` temporary directory under the same OS temporary root; write its absolute path, without a trailing newline, into the mode600 marker `/tmp/outclass-pipeline-ready-builds-path`. Save any prior inactive fixture separately before replacing it; this completed run had none. Do not print the private config, generated credentials or compiled build contents.

In the disposable comparison copy, retain the same diagnostic scripts while checking out each application revision. With the **baseline application** checked out:

```sh
node scripts/navigation-pipeline-ready-local.cjs build
node scripts/navigation-pipeline-ready-local.cjs snapshot baseline
```

With the **candidate application** checked out, after QA:

```sh
node scripts/navigation-pipeline-ready-local.cjs build
node scripts/navigation-pipeline-ready-local.cjs snapshot candidate
node scripts/navigation-pipeline-ready-fixtures.cjs
node --test tests/navigation-pipeline-ready-study.test.cjs tests/navigation-pipeline-small-study.test.cjs tests/navigation-pipeline-summary.test.cjs
```

The fixture helper reuses a verified100/1,000/5,000 current fixture and prepares missing independent cohorts using normal `navigation-audit.cjs --seed` followed by `pipeline-scale-fixture.cjs SIZE`. Seal BASELINE_SOURCE/CANDIDATE_SOURCE with actual BUILD_ID, base/tree and SHA256 hashes of tracked application/config/assets files, plus the eight new application files. Seal PLAN.json and fixture manifests before either timing profile. Do not copy old build IDs or measurements into a new run. The recorded manifests show the exact schema and861-file scope used here. Test scripts and output-directory roots are hardcoded to this experiment and must be adjusted consistently in a new copy, never by editing accepted artifacts.

Ensure no competing builds/tests and keep the Mac open. The recorded run used a temporary `caffeinate -i -w PID` assertion tied to the controller process; it did not change power settings and does not prevent lid sleep. Each protocol independently audits actual macOS sleep events and host processes. Do not accept a partial run after sleep.

```sh
node scripts/navigation-pipeline-ready-study.cjs --profile=local --attempt=1
node scripts/navigation-pipeline-ready-study.cjs --profile=constrained --attempt=1
node scripts/navigation-pipeline-ready-supplement.cjs --attempt=2
```

Primary controller invokes the unchanged existing collector with `--phase2 --phase3 --cold-warm --record-failures --source-diagnostics`, then the separate real-CTA common workflow. The supplement invokes `--only-voting` with the same cold/warm/failure/source flags, then bounded1/2/4 HTTP diagnostics. BAAB browser order, planned membership and whole-attempt exclusions are in PLAN.json and tested. The capacity order is B then A, not counterbalanced; do not infer independent statistically established throughput from it.

## Separate one-applicant follow-up

The actual follow-up used manual **additive** fixture construction after normal verified seed/signup: create a third measured club, copy61 synthetic memberships into that club with new IDs, create two club-scoped rounds, create one application for the existing synthetic Student000, and create three club-scoped essay questions/answers plus two submitted evaluations using the copied reviewer memberships/new round IDs. Preserve the enriched synthetic profile. Select that club as `clubIds[0]`, retain the two seed clubs as other memberships, and write a mode600 private `fixture-small-1.json` plus counts/SHA in SMALL_FIXTURE_MANIFEST.json. No rows with submitted reviews are deleted; the first attempted deletion was rejected/rolled back. Original measured cohorts remain unchanged.

That additive preparation was not packaged as a one-command seed; exact private fixture identities are deliberately not distributed. A repeat needs this setup step or a reviewed additive seed implementation, count/authority verification and normal live Auth; the commands below alone do not create it. This limitation is explicitly retained rather than presenting an untested setup command as reproducible evidence.

```sh
node scripts/navigation-pipeline-small-study.cjs --profile=local --attempt=1
node scripts/navigation-pipeline-small-study.cjs --profile=constrained --attempt=1
```

SMALL_PLAN fixes only cohort1 with the unchanged primary collector and same frozen builds; it does not alter the original plan or pool one-applicant rows with100. No distant-search workflow is claimed at1 because the target is already visible.

## Cleanup

Stop only the owned loopback app using the lifecycle helper. Stop the exact reserved Supabase project with the installed official CLI and `--workdir` pointing to its temporary root, `--no-backup`; verify success before removing private credentials/certificates. Delete only this run's private build directory/markers and temporary review index; compare the original21 unrelated container names/states and original checkout HEAD/status against INITIAL.json. Preserve reports, all accepted rows and excluded attempts. Never stop/reset the ordinary `out-class` or unrelated test projects.
