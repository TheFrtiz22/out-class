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

## Release gates and recovery

Branch: `codex/interview-interactions-countdown`. Hosted staging acceptance,
protected PR CI/merge and final production acceptance are pending at this local
checkpoint. Production rollback recorded privately: READY deployment
`dpl_9bTaXW7QpXoYKsrhg2oZ1VfDoCFq`, source
`ce2c0141291bcb0b8683b8a3a94ad5db62c6d746`. With unchanged schema, this is a
compatible application rollback. Use the existing Vercel Git pipeline; no
competing production deployment or database maintenance is needed.

Physical touchscreen/mobile-keyboard and physical IME/non-English keyboard
testing are unavailable. Event-routing/Unicode tests are not a claim of physical
device testing. Hosted Auth/Storage evidence must be reported separately from
the isolated UI fixture and Demo.
