# Interview interactions and countdown

## Change and compatibility

Loaded questions open and focus their private editor before the protected shared
selection request. Outgoing saves retain question keys; sharing uses an ordered
single flight with the newest pending selection. Failed saves/shares preserve
input and expose retry. Completion and submission still require server success.
Approved animations remain, without holding unrelated editing controls afterward.

The personal browser-local countdown uses the exact authorized booking slot, or
an explicitly configured stable-round duration for an unscheduled panel. Missing
or invalid duration is unavailable. Start/pause/resume/reset, timestamps, refresh,
post-interview pause and zero are independent of scoring. A changed schedule is
announced; Reset deliberately adopts it. Old stopwatch state converts against the
authorized duration. It does not synchronize between different devices.

Selecting authorized PDF text and typing opens its anchored comment draft and
preserves the first character. Copy/navigation/other editors remain independent;
native composition is routed to the focused composer. Save remains explicit;
Escape cancels the draft before dismissing the overlay. Scanned PDFs retain
general notes without invented text anchors. Pinned versions and access rules
remain unchanged.

Desktop room content uses the remaining viewport below its natural header and
presence controls, with individual scroll regions. Small-height/phone/zoomed
layouts retain document scrolling. No schema change or migration is required.

## Local evidence

- Focused regression set: 49 passed. Final affected set after refinement: 35 passed.
- Full test run: 1,013 tests, 997 passed, 15 environment-gated skips, one unrelated
  existing Windows CRLF/LF mismatch in unchanged generated Auth email HTML.
  Those files were not modified. Final required Linux CI passed (see below).
- All 39 migrations passed on disposable fresh/legacy databases; 66 tables
  retained row security and browser-role CRUD denial. No hosted SQL applied.
- Type check and production build passed. Lint: zero errors, 28 existing warnings.
- Native Chrome selected-text first character and subsequent typing, no automatic
  save, Escape cancellation, copy shortcut and a two-line anchor at 125% zoom
  passed in the actual-component fixture. Interview draft remained intact.
- Countdown start/pause/reset, timestamp expiry without submission, and schedule
  change without silently resetting a running timer passed in that fixture.

Controlled timing fixture uses actual React components, explicit mocked Auth/DB,
a loaded kit, and 300 ms per request on loopback. Browser input-to-DOM timing,
not automation transport latency: baseline question openings 641.5/623.9 ms;
new openings 28.5/11.8 ms and the editable textarea receives focus. Save & close
to an enabled bank: 984.4 ms before, 318.0 ms after, still including the confirmed
server save. Results are representative samples, not statistical benchmarks or
promises for cold/slow connections. A 1366 by 768 CSS viewport now has a 768-pixel
page with visible primary controls. Earlier baseline page height was 863 pixels.

The loopback fixture lives in `tests/helpers/interview-browser-fixture.cjs` and
`interview-browser-runtime.cjs`; it is never a deployed route and rejects external
fetches. Optional `interviewTiming=1` adds numeric local DOM question timing only;
it sends no telemetry, note content, or credentials.

## Integrated main and staging prerequisites (October 13)

New scheduling work on main (`b4a9efa`) was merged without conflicts, preserving
all five newer commits. Production was already serving that revision, with all
43 migration checksums matching; this task applied no production migration.
Only email environment metadata had changed externally. Those settings remain.

The integrated interview checks now honor the current published slot's panel and
approving owner, matching official scheduling, instead of incorrectly requiring
the obsolete room-wide panel. The current applicant assignment, active owner,
club/round/booking scope, room state and peer privacy remain mandatory. New
regressions cover published versus legacy panels, exact booked duration, removed
members, foreign version authority and revoked approval. The integration set of
58 tests passed; the final affected panel set passed (10 tests).

With separate explicit staging-only approval, these existing main migrations
were applied in order to `omfcozcbpmevwolshibh`:

1. `20261012120000_global_availability`
2. `20261012160000_unpublished_panel_proposals`
3. `20261012190000_panel_schedule_publication`
4. `20261012200000_availability_collection`

All 43 migrations passed disposable fresh/legacy rehearsal (70 protected tables).
Staging received a private backup before application; exact SQL/catalog checks
preceded Prisma registration through the installation's established temporary
operator procedure. Its previous 36 ledger entries remained unchanged, and only
these four were added. Original table rows and original field digests matched.
The four new tables use the existing isolated runtime role, retain RLS, and deny
browser-role CRUD. No unrelated missing staging ledger entries were fabricated.

Earlier isolated hosted acceptance on source `adcedf5`, preview
`out-class-qr8dewbbh-outclassuva.vercel.app` (`dpl_2WfXmcD4oifjuTqaZKTrjmkst3AP`),
passed actual Auth, independent drafts/shared selection, authorized 20/35-minute
round timing, private PDF/download denial, worker assets, immutable earlier
reviews and exact 7.75 history. The hosted browser opened/focused its loaded
question editor in 26.8 ms. Initial required Linux CI run `38331141522` passed.
Final integrated preview and CI passed before merge (see below).

## Release gates and recovery

Branch: `codex/interview-interactions-countdown`. The application release completed
through protected PR #28 and the existing Vercel Git pipeline. Production rollback
recorded privately: READY deployment
`dpl_9bTaXW7QpXoYKsrhg2oZ1VfDoCFq`, source
`ce2c0141291bcb0b8683b8a3a94ad5db62c6d746`. The updated rollback matching current
main and schema is READY `dpl_6uFB7MVAdP4Ju48txqnSMP22ve9m`, source
`b4a9efa10f1f0ea2bc269907fd28bc5ea6871dbc`. Use the existing Vercel Git pipeline; no
competing production deployment or database maintenance is needed.

Physical touchscreen/mobile-keyboard and physical IME/non-English keyboard
testing are unavailable. Event-routing/Unicode tests are not a claim of physical
device testing. Hosted Auth/Storage evidence must be reported separately from
the isolated UI fixture and Demo.

## Final release evidence (October 14)

Reviewed application revision: `88c7edbd805fa1b0c65de9004e65bf2ede59587c`.
[PR #28](https://github.com/TheFrtiz22/out-class/pull/28) merged as
`54d988d13b854390dc45151df00441cf45e3aad0`. Its automatic production deployment
`dpl_7MSbhiCVgpJMkxLxA1j7yxhCfjv7` was READY and served `www.out-class.net`.
The domain now serves newer main `537119b360b14430c2ed10c551a3687190143972`,
READY deployment `dpl_8vjxWqhoUEjGfWnNkzUTXXZiq3rR`. This newer revision contains
the merge and preserves the interaction/countdown implementation; its subsequent
scheduling/timezone changes were not overwritten. Final browser acceptance below
ran on that current production deployment. Production environment metadata is
unchanged and automatic promotion remains enabled.

Required Linux CI run `38421864413` passed on the reviewed application revision:
1,064 tests, 1,049 passed, 15 existing environment-gated skips, zero failures;
type checking, lint and production build passed. All 43 migrations passed
disposable fresh/legacy checks with 70 RLS-protected tables. Final integrated
isolated preview `out-class-3noe24v1a-outclassuva.vercel.app`, deployment
`dpl_3c5ydW3ETbJNbnngQ1FC6XYv6U6z`, used staging DB/Auth/Storage only.
Hosted staging acceptance included private draft/reload recovery, 20/35-minute
timing, null then deliberate 1/1.5 scoring, independent immutable completion,
correct history, authorized empty queue and laptop fit.

Actual production checks used only the existing undiscoverable synthetic club,
synthetic Auth accounts and a bundled fictional PDF uploaded by its own synthetic
applicant. No real applicant/profile/review or leadership assignment was changed.
Production Auth, database and private Storage were exercised without mocks:

- Loaded question opens/focuses its editor; private autosave and reload retain
  the text. Countdown starts at authorized 20 minutes; start/pause/resume and
  paused reload recovery work. Separate authorized round timing remains 35 minutes.
- Selected PDF text followed by `a` opens/focuses the composer with that first
  character; subsequent `bc` stays in it. Escape cancels the draft while retaining
  the overlay and interview notes. Two-line geometry remains aligned at 125%.
  Explicit save was subsequently confirmed by the server and durable annotation
  row, with author attribution. The submitted closing review stays locked while
  separately authorized resume annotations remain editable.
- Question completion waits for save. Post-interview replaces the middle only;
  focusing the slider leaves it null. Home selects 1, ArrowRight selects 1.5;
  closing text and score survive refresh. Previous-five shows the authorized
  same-round synthetic history with exact scores.
- Final repeated-click submission produced one canonical evaluation. The other
  panel member remains unsubmitted; applicant decision is unchanged. Submitted
  text is disabled after reopening. Next candidate reaches the current authorized
  second applicant with no carried miscellaneous notes or completed questions.
- 1366 x 768 fits the viewport with essential controls visible. The 390 x 844
  responsive check has no horizontal overflow. Original private PDF access,
  forbidden applicant/outsider/cross-club access, worker assets and historical
  immutable scores were also verified by the earlier production action checks.

The first browser test incorrectly treated text in a still-saving comment composer
as save confirmation and closed the overlay early. That result is not counted as
a successful annotation save. The corrected check waited for composer closure,
server acknowledgement and the database row. Its initial 20-second next-candidate
assertion also timed out; subsequent recovery reached the authorized destination.
Protected hosted transactions can still take seconds; the local timing samples
above measure removal of UI waits, not a guarantee of instant remote persistence.
The final production recovery sample took 38.4 seconds from Next candidate click
to an enabled destination room, including authorization, loading and transition.
It showed pending feedback and completed correctly, but that remote path remains
slow; the local question-editor measurements do not establish otherwise.

Live Demo on the release deployment loaded an existing saved MII session without
clearing browser data, opened/focused questions, preserved a private draft and
captured/cancelled `a` then `abc` on the fictional resume. The actual-component
local Demo/isolated fixtures cover countdown, save failure/retry, null/half-point
score, immutable completion, next-candidate reset and mobile layouts. Browser
control disconnected before a full live Demo closing/zoom replay; that replay is
unverified. The final independent headless session used the authorized synthetic
production accounts, which are not Demo-allowlisted; access rules were not bypassed
or changed to complete a Demo test.

Screenshots and machine receipts are retained under the account-protected local
`OutClass-staging-verification` directory: `interview-interactions-live-laptop.png`,
`interview-interactions-live-post.png`, `interview-interactions-live-mobile.png`,
`interview-interactions-live-highlight-saved.png`, and the live recovery receipt.
Physical touch/mobile keyboard, physical IME and browser-level zoom remain
unverified; PDF zoom and responsive CSS viewports are separate verified checks.
The final one-hour production log sample contained unrelated `/icon` and
`/apple-icon` missing-favicon-file errors, not interview exceptions. They were
not modified as part of this release.

No production migration, maintenance setting, credential rotation or manual
competing deployment was required or performed for this feature. The four
explicitly approved staging prerequisites above were staging-only. For recovery,
prefer a compatible application rollback through Vercel; do not reverse SQL or
restore over live data. The recorded b4a9efa rollback is schema-compatible but
would also remove newer scheduling/timezone changes, so assess those changes
before using it. No club owner configuration is required beyond existing valid
panel assignments and an authoritative booked duration or explicit round duration.
