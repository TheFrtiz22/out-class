# Immediate read-only state after review finalization

Controlled hosted verification on October 20, 2026 reproduced a stale UI capability after PR #52. An assigned synthetic interviewer saved and finalized a review successfully. The server committed exactly one submitted evaluation and rejects overwriting completed interview sessions. However, the open drawer retained its original `canEvaluate: true`, so score/feedback inputs and Finalize evaluation remained visible until applicant data was refreshed. Refresh correctly removed the editor. This is a client transition defect, not evidence of a server authorization bypass.

The successful finalization response now clears the local capability while merging the committed evaluation. This matches the next authoritative pipeline response. Draft cleanup, transaction handling, live authorization, immutable evaluations, permissions and server redaction are unchanged. A failed finalization never enters the success transition.

The existing real-browser regression now finalizes through an isolated HTTP fixture and verifies the score/feedback inputs and finalize button disappear without reload, recruitment controls stay usable, and no new autosave writes occur after cleanup. The response deliberately redacts submittedAt to null, matching supported server projections; editability must not depend on an exposed timestamp. Browser time controls the debounce check. Hosted reproduction is the negative evidence; final-source CI is required because the current local execution environment is unavailable.

## Hosted journey checkpoint

- Published future slot: October 21, 2026, 10:00–10:20 AM Eastern, one controlled synthetic interviewer.
- Student UI confirmed one reservation; read-only SQL confirmed one booking and one active panel assignment.
- Support-mode review draft saved at revision 5; final evaluation score 8 committed at 2026-10-20 16:47:56.516 UTC.
- Acceptance publication committed application decision version 1, one formal letter, and one canonical DECISION notification/outbox intent. The membership invitation is PENDING with MEMBER access and an empty permission array.
- Only synthetic records were changed through normal product commands. Original queue fingerprint and historical delivery count were preserved at the earlier checkpoint; final preservation checks and recipient-side letter/offer verification remain pending.
- No emails were sent by these test commands; outbound delivery remains disabled. Hosted provider delivery, broader voting/rejection scenarios, and historical pipeline failure diagnosis remain outside these results.

## Exact three-file manifest

- `components/views/leader-dashboard/live-leader-workspace.tsx`
- `tests/review-editor-access-browser.test.cjs`
- `docs/review-finalization-transition.md`

No migration is added. No broader production-readiness clearance is implied.
