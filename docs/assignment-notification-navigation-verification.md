# Assignment notification navigation verification

This is a narrow presentation/navigation repair. No schema, notification ownership checks, interview authorization, booking, or review logic changes.

## Reproduction and change

The production QA record (`OutClass-real-mode-QA-findings.md`, controlled real-mode QA club) reproduced an unread assignment becoming read without leaving Recruitment Overview. Clicking the same now-read notification opened the exact submitted review.

The notification Link called `read(item)` before Next Link dispatched navigation. For unread durable items this starts a route-bound Server Action as well as optimistic feed/badge changes and closing the popover, all before navigation is dispatched. Already-read items do not take that mutation path. Unlike other club navigation controls, this link also bypassed the workspace's existing query-only navigation helper.

The normal activation now explicitly commits the destination first: `navigateWithinClub` for the same club workspace, or `router.push` elsewhere. It prevents Link's duplicate navigation, closes the popover, then starts the existing nonblocking read update. A ref guards repeated activation. Modified clicks retain the original anchor behavior. Saving/unsaved-work guards and the original complete href remain intact. Read failure keeps the existing rollback/error/retry handling and cannot veto the already-dispatched navigation.

This removes the observed coupling; no claim is made about a particular Next.js internal queue cancellation. A minimal isolated Next fixture did not reproduce the hosted transient failure with the old handler, so the hosted before/after check is necessary.

## Focused checks

- `node --test tests/notification-center.test.cjs`: 17 passing checks, including unread navigation ordering, already-read items without another write, false/rejected read results, retry state, rapid activation, full query preservation, router fallback, modified-click behavior and draft guard.
- Negative control: supplying the original source through `OUTCLASS_NOTIFICATION_SOURCE` makes the focused unread-activation regression fail; fixed source passes.
- `node scripts/check-notification-navigation.cjs`: creates an isolated production Next.js build using the real NotificationCenter, Next Link/router and a local Server Action. Seven browser scenarios pass: unread mouse, already-read, read failure, Enter, emulated touch, double activation and saving guard. Identity/data boundaries are mocked; no production credentials, database or notifications are used.
- Required full project validation and protected checks must be green before merge. Full build uses the unchanged production schema; no migration is needed.

Physical touchscreen input is not tested. The local browser checks emulate touch. Existing synthetic production accounts/club are reused for hosted acceptance; no reviews may be reopened or recreated to test this change. The unconfirmed closing-review submission race is outside scope.

## Release and live acceptance

Use the normal PR checks and Vercel Git deployment from main. Retain the previous production deployment as an application-only rollback option. No environment changes or database operations are required.

With QA one in the existing hidden synthetic club, mark an existing assignment notification unread if needed. Activate it once and verify the exact club/application/round/room/slot/booking destination opens, then verify it remains read after returning/reloading. Repeat with an already-read notification. Use submitted synthetic reviews read-only. Hosted mutation-failure injection is not required; that case is covered in the isolated real-router fixture. Record the actual merge SHA, deployment identity and hosted results in the release receipt.

## Existing-check harness reconciliation

Current main's validation already fails `product-shell-focus.test.cjs` because its fake DOM ref was hardcoded to hook slot 3 before the floating-dock hooks were added. The test now locates the actual rendered workspace-content ref and retains all original focus/scroll assertions.

The native security suite also expected exactly one successful call when accepting the same invitation concurrently. Current main deliberately permits idempotent accepted retries. The test now checks both calls resolve to the same club, exactly one membership and exactly one acceptance audit; foreign-user denial, distinct-invitation races, and owner safeguards are unchanged. No invitation runtime code is changed. These are test harness corrections needed to run existing release checks, not additional product features.

The existing native Events browser check also referenced obsolete accessible labels (`Unsave …` and `Add … to calendar`) although current main exposes `Saved …` with aria-pressed and `Add to Calendar: …`. Its selectors now target those existing controls and explicitly verify the saved pressed state. No Events application code changes. The disposable security test's mocked email transport is explicitly enabled inside that test, restoring the inherited value afterward, because the broader runner correctly pauses real email by default. Auth/SMTP guard behavior is unchanged.

The disposable Auth runner had an ECR-only Mailpit guard, while Supabase CLI supports ECR/GHCR/Docker Hub fallbacks (https://github.com/supabase/cli/pull/5660; official package https://github.com/supabase/cli/pkgs/container/mailpit). The guard now permits only versioned `supabase/mailpit` images at those official registries, rejects arbitrary registries/repositories/tags/arguments, and logs the selected public image for diagnosis. Localhost port bindings, TLS, project identity checks and production isolation are unchanged. This is test-runner compatibility only; no production infrastructure or SMTP configuration changes. Two pure positive/negative guard checks pass (21 focused checks including notification/shell tests).

The Members browser check now waits for its existing eligibility control to finish saving and become clean before pressing Escape. Its success message is set before the subsequent read/refresh completes; the workflow correctly ignores dismissal while saving. The isolated original check passed, but integrated CI exposed this timing race. The test retains its dialog-close assertion and does not change member-management runtime behavior.

## Minimal accessibility unblock and harness review

A focused real-ProductShell browser fixture reproduces the five authenticated Admin accessibility failures: the empty decorative caption has `aria-label="Current workspace: Admin"`, producing `aria-prohibited-attr`. Only captions that actually render text now receive that label. The Admin link retains its accessible name and `aria-current="page"`; no access checks or navigation behavior change. The regression scans the unchanged Axe rule at desktop and 320px and checks the current Admin link. The original source fails the regression.

Reviewed all prior harness changes against current main: actual content-ref lookup retains focus/scroll assertions; idempotent invitation retries require the same club plus one membership and one audit; email activation is confined to the mocked transport and restored afterward; Events selectors retain save/unsave, download, RSVP and detail assertions; the Members wait targets saved/clean state instead of a delay; the official versioned Mailpit allowlist retains loopback, TLS and project boundaries and rejects arbitrary images. All are retained as justified corrections; no assertions are disabled.


## Coordinated #68 / #77 release verification - 2026-10-23

Merged current main4f29429 into this branch without conflicts, retaining the newer operational dashboards and their isolated test runner. Reused the existing idempotent-invitation, event-label, bounded SMTP-image and Admin-caption corrections.

A fresh, reserved localhost PostgreSQL17.11 cluster reproduced the communications-native failure: the exact settings projection omitted the already-supported marketing field. Correcting that one expected key makes all8 communications tests pass; the later undefined-template error was cascading setup failure, not a reproduced application defect. No communications runtime or concurrency/immutability/authorization assertions were weakened.

Focused local checks after integration: security/interview native3 passed; native Events plus real-browser5 passed; communications8 passed; notification/SMTP/Admin-caption checks22 passed. Original communications negative control retained privately. These tests used synthetic identities on isolated local databases, not hosted applicant records. CI and live acceptance remain release gates. Merge #68 first, then #77, whose integrated tree must retain these corrections. No migration or environment change.
