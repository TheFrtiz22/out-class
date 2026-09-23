# Interview Mode

Interview Mode is a dedicated application view with the ordinary dashboard navigation removed. The existing view ID remains unchanged. Exiting returns to recruitment. The shared application provider remains mounted so changing layout does not discard unrelated application state.

## Focused workflow

Choose an authorized club, a real pipeline round, and a submitted applicant. The initial round prefers one containing interviewing applicants. The queue is the selected round's applicants, sorted by name; it is not an invented appointment schedule or assignment system.

Candidate identity/photo, academic context, experience, résumé/LinkedIn, application answers, and evaluations from other rounds remain beside the scoring workspace on large screens. Narrow layouts stack naturally with direct context/evaluation anchors. No tabs hide essential interview context.

Evaluations use the existing server action, 1–10 overall score, notes, and per-application/per-reviewer/per-round uniqueness. The previous screen's local 5-point question rubric and toast-only submission are replaced with real persistence. The backend has no structured rubric storage, so no question-level criteria or rubric scores are invented.

- Save evaluation saves in place. Cmd/Ctrl + Enter does the same.
- Save & Next advances only after server success. Save & Finish on the final candidate keeps the saved evaluation visible and confirms the end of the list.
- Returning to a candidate loads that reviewer's saved notes and score for the chosen round.
- Failed saves retain entries and never advance.
- Unsaved-change guards cover candidate/round changes, exit, and reload. Club changes and exit are blocked during a save.
- Progress counts actual saved evaluations for the current reviewer and round. Saving does not change the applicant's pipeline round or decision.
- The optional timer is a local elapsed stopwatch, stopped by default, with no invented deadline or persisted interview status.

Candidate entry uses a short opacity/transform transition. Reduced-motion preferences disable it. Focus moves to the incoming candidate heading. Native scrolling and keyboard controls remain available.

## Data and authorization

Reads reuse `getClubPipeline`; saves reuse `submitEvaluation`. The existing active-member read/evaluation permissions and club isolation guards remain enforced on the server. No local sample applicants, transcript, recording, AI feature, new dependencies, or schema changes are introduced. Profiles/questions are current records rather than immutable historical snapshots, matching the existing model. The queue is intentionally stable during an interview rather than refreshing beneath the interviewer.

## Files

- `components/views/interview-workspace-view.tsx`: focused session, candidate context, review state, controls and persistence.
- `components/views/interview/interview-mode.css`: reduced-motion-aware candidate transition.
- `lib/interview-mode.ts`: reviewer/round selection, saved-review progress, elapsed-time formatting.
- `components/app-shell.tsx`: dedicated layout with shared provider preserved.
- `tests/interview-mode.test.cjs`: reviewer/round isolation and progress/timer tests.

## Validation

Production build passes. Full suite: 54 passed, four existing club-customization fixture failures. Two existing nullable-context TypeScript errors remain in `lib/club-customization.tsx`. Lint cannot run because ESLint is missing.

Isolated Playwright fixtures cover responsive layouts, absence of dashboard navigation, dirty-navigation cancellation, failed-save retention, save-before-advance, notes isolated per candidate, keyboard saving, progress, and reduced motion. Existing evaluation authorization regression tests also pass. Actual database/Supabase persistence remains unverified end-to-end locally without configured services.
