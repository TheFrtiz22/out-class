# Contextual Loading — second cleanup pass

Branch: `fix/loading-state-polish-and-coverage-20261029`. Builds on the loading system merged in PR #95.

## What changed
- Gave form editors and decision letters page-appropriate skeletons instead of generic lists.
- Moved list skeleton headings outside the bordered row container, removed duplicate CSS, improved mobile stacking and reduced repeated shimmer loops on long lists.
- Converted remaining plain loading text in application settings, interview pipeline editing, event approvals, decision letters, live voting setup/workspaces/presentation, recipient groups, member management, interview review and résumé panels, question banks, saved documents, meeting attendance, notification preferences and scheduled communication lists.
- Fixed the notification-preferences failure state: when the read fails, it now shows the real error with retry rather than simultaneously looking indefinitely busy.
- Fixed the interview-session error view to use `role="alert"`, with the skeleton used **only** while a request is pending.
- Expanded shared skeleton tests to exercise `form` and `document` layouts, single accessible loading statuses, decorative placeholders and motion limits.

## Not changed
No database, API, permissions, auth, asynchronous fetch ownership, polling cadence, business actions, autosave or routing were modified. No artificial loading duration, fake progress percentage, new network request or full-screen blocker was introduced.

## Manual verification required before production
- Throttle network on club application / pipeline editors, member management, scheduled communications, applicant sidebar, voting workspace and decision letter.
- Confirm brief loads do not flash a large overlay; no skeleton remains after a failed request; retry works; no layout clipping at 320px/390px/mobile landscape/tablet/desktop; zoom to 200%.
- Check reduced motion, high contrast, screen reader announcement, keyboard focus and CSS selector overlap with the current editorial theme.
- Run tests (`pnpm test`), typecheck, lint, production build and integration CI. Identify baseline failures separately rather than disabling tests.
- Compare with held performance work before any unrelated merge. The loaders improve *perceived* waiting, not server latency.

## Remaining targeted audit
Nested highly interactive flows may still have text-only **action feedback** (e.g. Saving…/Uploading…). These should generally remain inline next to the affected control, with accurate button busy/disabled state, rather than a page-level skeleton. This PR targets initial/fresh-read states only.
