# Résumé selection-to-comment handoff

## Scope and diagnosis

The shared live/Demo viewer seeded the first printable key, focused the composer,
then cleared the browser selection in the PDF handler. It also focused the new
draft in a passive effect. This split focus/selection ownership across opening
and a later effect. The handoff now snapshots and clears the PDF selection first,
then synchronously mounts the composer and sets focus/caret once in its layout
effect. Typing and authorization polls do not trigger that effect. There is no
timeout, key replay, animation delay, or per-character composer creation.

The reported first-letter-only symptom did not reproduce on the current main
revision in the isolated Chrome fixture or deployed Demo before this change.
The unsafe ordering was identified by source inspection; it is not proof of the
reported browser-specific symptom. Paste from a valid PDF selection did fail in
Chrome before the change (no composer), and now follows the same handoff. Inputs,
shortcuts, native textarea editing and composition remain native.

The immutable quote/page/geometry anchor is captured before selection or focus
changes. Declining to discard an existing draft restores the PDF selection.
No authorization, persistence action, database schema, or document cache changed.

## Reproducible browser checks

Run `node tests/helpers/interview-browser-fixture.cjs`, then
`node tests/helpers/resume-comment-browser.cjs` in another terminal. The fixture
uses actual React/PDF.js/viewer/dialog components, bundled fictional PDF bytes,
mock Auth/database actions, and only loopback networking. It is not an app route.

The browser check uses real mouse drag selection and sequential keyboard events
at 35 ms and zero delay, comparing the entire textarea value and caret. It checks
spaces/case/punctuation, Backspace, multiline Enter, continued typing across the
five-second authorization poll, one composer, repeated save/reopen with the same
quote, copy without opening a composer, clipboard-event paste and continued
typing, and Chromium IME protocol composition. It runs at 1440, 900 and 390 px,
both directly embedded and in the interview's expanded dialog.

Physical touchscreen and OS-native IME hardware are not exercised by Chromium
protocol simulation. The small résumé thumbnail is a canvas preview, not a text
selection surface; its existing expand behavior is unchanged.

## Release checks

Results and deployment revision are recorded in the release PR. No migration,
maintenance, environment change, credential rotation, or production applicant
mutation is required. The existing production application is a schema-compatible
rollback. Merge only after required GitHub validation and Vercel preview succeed;
the existing main Git integration creates the production deployment.
