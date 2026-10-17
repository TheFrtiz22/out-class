# Interview composer keyboard actions

Enter uses the existing action for the active question's Save & close, off-script Add question, and résumé Save comment (highlight, general note and edit composers). Shift+Enter inserts a newline. The off-script input is now a multiline textarea. Subtle, associated keyboard hints describe the actual action.

The helper is attached only to these explicit-action fields, not the interview form. Shift/Ctrl/Alt/Meta modifiers, composing/229 IME events and handled events retain native behavior; repeated Enter events are consumed without re-running the action. The existing synchronous save-flight/revision/permission checks still guard annotation and question saves. A small synchronous off-script guard prevents concurrent keyboard/click addition while that composer closes. Submitted reviews remain immutable.

Successful question completion focuses the question-bank control after its disabled state clears; failure returns focus to the retained question notes. Successful annotation saves focus the saved annotation after its authorized refresh. No animation delay or global keyboard listener was added. Miscellaneous notes, applicant closing questions and completed-question autosave-only editors retain multiline Enter; no Enter shortcut submits a review, advances an applicant, ends an interview or sends invitations. Setup/master-kit editing is outside this change.

Local validation:

- 20 focused unit/authorization/persistence/viewer regressions passed, including composition/modifier handling, unchanged read/write counts, revision conflicts and failure/retry retention.
- Actual Chromium/PDF.js isolated browser fixture: drag-select PDF text → rapid continuous typing → Enter saves one anchored comment; Shift+Enter multiline; general-note empty validation and failed-save/retry; question Save & close failure and retry; duplicate Enter; multiline off-script addition, its private notes and completion; focus return; desktop/mobile; miscellaneous and post-interview fields keep multiline Enter and score remains null.
- Browser fixture uses mocked Auth/actions, loopback documents and denied external requests. It runs with built CSS and with source CSS compiled into disposable storage (CI runs tests before Next builds). No production test endpoint or test-only app route was added.
- Local type checking, lint (zero errors, 26 existing warnings) and optimized production build passed. Existing résumé typing browser probe now uses Shift+Enter for its multiline assertion.

No migration, dependency, server action, live authorization or storage change. The shared components serve both live and Demo Mode. Protected CI, merged revision, deployment and hosted synthetic Demo results are recorded in the release PR and private receipt at `%LOCALAPPDATA%/OutClass-staging-verification/interview-enter-20261017/`. Physical touchscreen/OS IME and real-applicant writes are not claimed tested.
