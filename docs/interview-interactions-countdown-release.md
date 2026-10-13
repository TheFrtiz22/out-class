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
  Those files were not modified. Required Linux CI must pass before merge.
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
Final integrated preview and CI must pass before merge.

## Release gates and recovery

Branch: `codex/interview-interactions-countdown`. Hosted staging acceptance,
protected PR CI/merge and final production acceptance are pending at this local
checkpoint. Production rollback recorded privately: READY deployment
`dpl_9bTaXW7QpXoYKsrhg2oZ1VfDoCFq`, source
`ce2c0141291bcb0b8683b8a3a94ad5db62c6d746`. The updated rollback matching current
main and schema is READY `dpl_6uFB7MVAdP4Ju48txqnSMP22ve9m`, source
`b4a9efa10f1f0ea2bc269907fd28bc5ea6871dbc`. Use the existing Vercel Git pipeline; no
competing production deployment or database maintenance is needed.

Physical touchscreen/mobile-keyboard and physical IME/non-English keyboard
testing are unavailable. Event-routing/Unicode tests are not a claim of physical
device testing. Hosted Auth/Storage evidence must be reported separately from
the isolated UI fixture and Demo.
