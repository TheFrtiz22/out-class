# Interview-room design verification — October 7, 2026

Implemented on `codex/interview-room-design`, starting from `b96fc4d` (the completed release receipt above production `7cab4dc`). This is a local implementation checkpoint. No main merge, push, deployment, production configuration change, or database mutation was performed for this request.

## Changes

- The active and post-interview room no longer renders the round/candidate/progress strip, club selector, timer, or previous/next candidate footer. Club, round and assigned applicant selection remain on the interview list. The slim light header provides branding, Interviews, club/round context, one save indicator and an outlined End interview action.
- Room-only CSS uses existing navy/off-white/white tokens and typography, approximately 22/53/25 desktop columns, subtle separators, restrained headings, compact controls and reduced-motion-aware transitions. Mobile stacks the same sections, adds a completed-question anchor and uses 44px action targets.
- Applicant identity, headshot/fallback and scholar names sit above the compact authorized résumé thumbnail. The existing document version, lazy PDF viewer, highlights, panel comments, moderation and overlay focus handling remain in use.
- The middle starts with directly clickable saved questions. Opening the current bank preserves private drafts and existing question snapshots. The active question has a comfortable white writing surface and Save & close. Off-script entry is collapsed until requested. Personal completion appears only after saving is acknowledged; the completed list shows only this interviewer's private note previews. Routine Save draft and duplicate save feedback were removed; failure/revision recovery remains.
- The existing middle-only closing workflow, nullable half-point slider, protected previous-five query, atomic submission, immutable completion and refreshed eligible queue are reused. End interview saves a phase change without submitting or scoring. End post-interview submits only this interviewer, and Next applicant appears only after confirmation.

Source files: `components/views/interview-workspace-view.tsx`, `components/interview-kit-session.tsx`, `components/interview-applicant-panel.tsx`, and `components/views/interview/interview-mode.css`. Regression changes: `tests/interview-session-ui.test.cjs` and new `tests/interview-room-layout.test.cjs`.

No backend action, adapter, permission, model, dependency, environment file or migration changed. There is no migration or owner setup requirement for this UI change.

## Automated evidence

All checks completed successfully, with no skipped tests:

```text
node --test tests/interview-session-ui.test.cjs tests/interview-room-layout.test.cjs tests/interview-queue.test.cjs tests/interview-profile-kit-ui.test.cjs tests/interview-anonymous-closing.test.cjs tests/interview-journey.test.cjs tests/demo-interview-workspace.test.cjs
34 passed, 0 failed, 0 skipped

Final affected session/layout rerun after rendered refinements:
18 passed, 0 failed, 0 skipped

npm run typecheck: passed
npm run lint: passed, 0 errors, 25 existing warnings
npm run build: passed
git diff --check: passed
```

Coverage includes strip removal and list selection, no active applicant navigation/timer, autosave failure/retry and retained text, bank browsing without completion, private independent notes, snapshots during kit edits, middle-only phase persistence, deliberately selected score/endpoints/half steps, submission locking and duplicate-click protection, fresh permissions/assignments and revoked access during next navigation, empty queues, anonymous score/name projections and zero live calls from Demo.

The final type/lint/build checks were repeated only after the rendered check justified a larger writing surface and removal of a visible completion-announcement spacer. Unchanged backend checks retain the initial 34-test evidence. The credential-free build uses an empty database URL and local placeholder Auth settings; its existing caught sitemap diagnostic reports the missing database URL, but generation and the build complete. No production connection is used.

Logs are outside Git under `C:\Users\arden\AppData\Local\OutClass-staging-verification`: `room-design-final-tests.log`, `room-design-final-typecheck.log`, `room-design-final-lint.log`, and `room-design-final-build.log`.

## Rendered acceptance

Working local preview: http://127.0.0.1:3218/. Fresh-fixture origin: http://localhost:3218/.

The temporary harness under `C:\Users\arden\AppData\Local\OutClass-staging-verification\interview-room-design-preview` imports the actual room components, global styles/fonts, Demo provider, store and interview foundation. Its workspace API aliases call only the Demo adapter. It imports no live database/Auth client or server action and contains no credentials. The isolated fixture adds two scholar selections to an existing fictional profile for rendering; it does not copy mockup people or modify the repository's sample profiles. One local-only control simulates a rejected save. Neither the fixture nor the helper control ships in the application.

Verified in Chrome:

- Desktop 1536×1024, laptop 1366×768 and mobile 390×844. Desktop columns measure approximately 22/53/25; mobile has one column and no horizontal page overflow. Selection controls and their spacing are absent from both room phases.
- Fresh fictional data displays multiple scholar names in the requested position. Existing saved Demo data recovers without clearing browser storage. Missing scholar selection and headshot fallback remain usable.
- Private notes autosave without marking completion. Bank browsing retains text; reload recovers it. Save & close moves the acknowledged question right. Reopening permits personal note revisions. Off-script entry uses the same notes/completion path.
- A deliberately rejected local autosave retains the full entered text and shows Retry; retry returns to All changes saved. No completion is shown before its acknowledgement.
- The résumé opens the preserved document with selectable text, anchored comment, author/controls and general notes. An anchored comment remains after reopening at 125% zoom. Minimize and Escape restore thumbnail focus, keeping both private-question and closing drafts intact.
- End interview changes the middle only. Applicant and completed-panel text, x/y position and width remain the same across transition. Focus moves to Post-interview. Notes and phase recover after reload; opening the résumé retains the closing fields and score.
- A fresh slider remains Not scored after keyboard focus, with finish disabled. Deliberate Home selects 1, ArrowRight selects 1.5, End selects 10 and half-point steps select 8.5. The existing unit checks also cover pointer selection at the initial endpoint. Optional empty closing notes can be submitted after deliberate scoring.
- Successful 8.5 submission locks the fields and removes the editable slider. Next applicant uses the refreshed queue, changing identity, résumé, question bank, personal completion, notes and score together. The next unscored review shows the preceding applicant's exact 8.5; a different round excludes that history.
- The three-person Round 1 queue follows Felix → Isla → Zoe, excludes completed reviews, and ends with No more applicants and Return to interview list.

Screenshots outside Git:

- `room-design-interview-desktop.png`
- `room-design-post-interview-desktop.png`
- `room-design-interview-laptop.png`
- `room-design-interview-mobile.png`
- `room-design-post-interview-mobile.png`
- `room-design-post-interview-history.png`

## Limits

Browser acceptance uses isolated local Demo data. Current production and hosted Auth/Storage were not accessed or tested for this task; existing backend authorization/privacy and independent-panel behavior were exercised through the focused synthetic tests. Physical touchscreen testing is unverified. The local development browser reports an extension-injected body-attribute hydration warning (Grammarly); no room load/save exception was encountered. Existing lint warnings and the caught credential-free sitemap diagnostic remain unrelated to these UI changes.

The previous production release and its migration receipts remain intact. Release of this new design remains a separate, unperformed action.
