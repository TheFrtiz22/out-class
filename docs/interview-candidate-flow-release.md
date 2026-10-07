# Interview phase and next-candidate motion — October 7, 2026

Starts from main `47b10476624daac91371c8f2458898f962dc984f`, on `codex/interview-phase-candidate-motion`. Production release is authorized by the user's request; merge/deployment and hosted acceptance remain pending at this checkpoint.

## Change

The existing per-interviewer, per-application, stable-round JSON draft already restores post-interview only for `postInterview === true`. Missing/legacy phase values and existing score/text alone do not enter closing. This behavior is preserved, with regression coverage for fresh, legacy, saved and prepared destinations. No draft is erased, no default score is assigned, and submitted records remain read-only.

`End current interview` still saves the latest draft/phase before the approved existing 1040ms question flight and 320ms landing crossfade. `Next candidate →` appears only after confirmed personal submission. Navigation refreshes the authorized queue and awaits the destination's authorized session and applicant panel before switching a keyed subtree. It keeps the submitted screen during loading and failures; refs guard overlapping requests, navigation epochs ignore stale responses, and a destination completed elsewhere is rejected for retry. Prepared sessions avoid an additional reopen overwriting early typing.

Native candidate motion coordinates all three content panes, with stable header/borders and a temporary stable stage height: 56px left/fade out for 487.5ms; 56px right/fade in for 600ms after 150ms; cubic-bezier(.4,0,.16,1). There is no scaling, bounce or swipe. Outgoing copies preserve displayed text, omit duplicate field IDs/names, and remain inert and aria-hidden. Incoming content is inert until settling; resize, reduced-motion changes and unmount cancel safely. Reduced motion changes immediately. After arrival, a live announcement identifies the authorized candidate and focus moves to their own screen heading. One persistent right-column miscellaneous-notes field is replaced with that destination's saved value.

Shared components use the existing live/Demo adapters. No backend permission, score/history query, canonical submission, résumé anchor, model, migration or dependency changes are needed. No production migrations or credential rotation are part of this release.

## Verification

Focused session, layout, motion, Demo queue and synthetic journey tests pass. Type checking and production build pass; lint has zero errors and the same 25 existing warnings. The local credential-free build logs the existing unavailable DATABASE_URL prerender fallback and completes successfully; that does not prove hosted database behavior.

Rendered isolated Demo: fresh interview has no closing fields/history; personal completion and notes persist before ending; explicit ending restores closing after reload without submitting; résumé opening retains draft; deliberate keyboard 1.5 submission locks; advancement opens a fresh candidate with empty notes and no score/history, focuses Interview questions, and removes outgoing copies. A Chrome reconnect interrupted initial motion inspection; in-app browser resumes inspection. Physical touchscreen hardware is unavailable.

## Release isolation and recovery

This branch's preview is https://out-class-git-codex-interview-phase-candidate-motion-outclassuva.vercel.app. Sixteen branch-only overrides use staging `omfcozcbpmevwolshibh` for database/Auth/private Storage, strict TLS and the existing packaged CA. Existing encrypted Windows CurrentUser runtime material was reused in memory. Other environment scopes were verified unchanged. An initial binding attempt correctly refused the not-yet-pushed branch; after creating the remote branch, binding succeeded before the feature push. Do not test the pre-binding baseline artifact as an isolated candidate.

Previous compatible production: READY `dpl_4SFd3zSah95NaL53hn5jvnoSAhRa`, source `47b10476624daac91371c8f2458898f962dc984f`, https://out-class-5ce6m45d0-outclassuva.vercel.app. The schema and draft format are unchanged; this application is a compatible rollback for this release. Existing retired-artifact writer protections stay intact. Main deploys automatically through Vercel Git integration; no competing manual production build or maintenance/schema change is required. Inspect current remote main before merge, wait for normal CI/preview acceptance, then confirm the production alias matches the merged source and perform bounded synthetic checks.

Remaining at checkpoint: midpoint/mobile motion inspection, final normal CI, isolated hosted acceptance, protected merge, matching production deployment and live acceptance. Production Demo requires an existing allowlisted presenter sign-in; no allowlist expansion is authorized or performed. Hosted synthetic checks and Demo browser checks must be reported separately.
