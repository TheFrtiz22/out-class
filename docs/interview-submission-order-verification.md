# Immediate interview submission ordering

2026-10-22. Separate branch: codex/interview-submit-order. Base: ab6f63c7516c3f322a78d8b35def0af6217fd536. PR #68 and its branch/worktree remain untouched. No schema, authorization, adapter, or infrastructure change.

## Confirmed cause

The form's recovery hook flushes drafts on focusout. When an autosave is pending, that flush and an explicit completion can both await the same request. If the flush resumes first, it starts another draft save for newer text. Previously completion then hit the savingRef early return, silently cleared its pending UI, and sent no complete request. This exactly reproduces the observed first-click return to editing.

Both the deterministic component test and Chromium with the actual React component and recovery hook fail against the original source: no submitted review appears after the single click. The browser test uses a controlled pending-save promise, native input focus changes and a pointer click, rather than timing sleeps to manufacture the race.

## Fix

Completion reserves the existing save queue before awaiting outstanding writes. Ordinary saves and recovery flushes yield to that reservation. After draining pending writes, completion reads the latest draft and acknowledged session revision. Its pending state lasts through the entire operation. Existing error/retry and revision-refresh controls retain text. A missing completedAt/evaluation acknowledgement is treated as failure; Next remains unavailable. No changes to the server's protected transactional canonical evaluation path, immutability guards, ownership, panel checks, or identical-retry semantics.

## Verification

- Original-source deterministic regression: fails with completedAt null.
- Original-source Chromium negative control: fails waiting for Submitted review after one click.
- Fixed Chromium regression: passes; latest applicant questions and miscellaneous notes plus score 9.5 submitted once; Next enabled only after success; zero external requests/page exceptions. Actual React and recovery hook, loopback-only fixture with mocked Auth/database. This is not hosted Auth/database verification.
- Focused component tests: 30 passed, including immediate autosave/blur completion, rapid edits, repeat clicks, failed pending save, failed completion/retry, revision conflict plus refresh preserving text, lost successful response and identical retry, and missing completion acknowledgement.
- Full checks and release gate: recorded below as results become available. Native registry checks must not be bypassed or repeatedly retried.

## Production acceptance still required

Production reproduction is retained in the existing external OutClass-real-mode-QA-findings.md report. Do not reopen the completed first-applicant/round-2 review. After protected merge and deployment, verify one-click submission using a fresh authorized synthetic interview in hidden QA club 8b4c2f74-e4b4-4865-8cfa-ee44b59d010f, preserving old submitted records. Confirm latest text/9.5 score, one evaluation, immutable reload, and Next only after acknowledgement. Restore temporary synthetic round/assignment changes through existing protected actions. No real applicant writes.

No migration is needed. Production verification and release are pending required checks; do not infer live status from local tests or a preview build.
