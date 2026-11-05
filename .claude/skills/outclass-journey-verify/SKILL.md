---
name: outclass-journey-verify
description: Use when asked whether an OutClass student, leader, admin or school-onboarding journey works, before calling any feature "done", or when updating the feature preservation matrix.
---

# Verify one OutClass journey

Every claim gets one of four labels: **implemented** (code path + passing test that exercises it), **partially implemented**, **demo-only**, **unverified**. Code review alone never earns "implemented".

## Inputs
- Journey name, from the pilot definition of done in `docs/CLAUDE_CODE_HANDOFF_2026-11-04.md` §5 and §9.

## Steps
1. List the steps a real user takes, as numbered screens or actions.
2. For each step, find the route in `app/`, the server action in `actions/`, the guard in `lib/`, and the Prisma models touched. Record file paths.
3. Find tests in `tests/` and E2E scripts in `scripts/run-*-e2e.cjs` that exercise that step. Note if they are skipped or gated by environment.
4. Check the five states for each screen: loading, empty, error, success, recovery (retry or back).
5. Check demo isolation: a demo or preview path must not write real bookings, ballots, attendance, decisions or emails.
6. Run only the targeted tests that apply (`node --test tests/<file>.test.cjs`). Record the exact command and the pass, fail and skip counts.

## Output
A table appended to `docs/agent-ops/journey-matrix.md`:

| Step | Route / action | Guard | Test | Skips | Label | Evidence (command + result) |

Then a 3-line summary: what is proven, what is not, and the smallest next test that would move one row up.

## Stop conditions
- A step that needs production data or real email delivery to verify: mark it **unverified** and name the disposable setup needed (`docs/disposable-integration-ci.md`). Do not test against production.
