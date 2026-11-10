# Dashboard request sequencing and live inbox updates (2026-11-04)

Measured with a temporary request probe in `tests/operational-dashboards-e2e.test.cjs`
(local production build, disposable Postgres, Chromium). The probe was removed after
measurement; re-create it by logging `page.on('request')` around `page.goto`.

## Page-load sequencing: no real waterfall in production

Locally, leader pages looked like a three-step waterfall (`overview` and `notifications`
started only when an earlier request finished). Each delayed request began exactly when
another ended, with five fetches plus the open `/api/communications/stream` in flight:
Chromium's six-connection-per-host limit on HTTP/1.1, which `next start` serves.
Production (`www.out-class.net`) serves HTTP/2, so all first-wave requests multiplex
concurrently. No component gates `overview` on another request. Do not "fix" this
from a local trace; check the protocol first.

## Duplicates removed

| Request | Cause | Fix |
|---|---|---|
| `/api/platform/view-as`, `corkboard` (2nd copy on cold loads) | `pageshow` fires on every normal load, re-running the mount fetch | Re-check on `pageshow` only for back/forward-cache restores (`event.persisted`) |
| `notifications` every ~48 s per open tab | The stream closes after 45 s; each reconnect re-announces the current revision, which the client treated as a change | Refresh only when the revision differs from the last one seen (`lib/communications-live.ts`) |
| `notifications` every 30 s per open tab | Fallback poll ran even with a connected stream | Poll only while the stream is not open |
| Stream + polling in hidden tabs | Nothing paused for background tabs | Hidden tabs close the stream and skip polls; becoming visible reconnects and refreshes only if the revision changed (focus also refreshes) |

The task-notification poll (60 s) also skips hidden tabs.

The first stream revision after a page load still triggers one refresh, because it can
race the initial inbox load; that duplicate is intentional.

## Result: idle leader page, 110 s, nothing changing

| | Notification refetches after load |
|---|---|
| Before (main `b6137027`) | 5 (t = 30, 49, 60, 90, 98 s) |
| After | 0 |

A hidden tab previously kept a stream function open with two snapshot queries every
2 s (~1 query/s per tab) plus ~2.7 authenticated refetches per minute; it now costs
nothing until it is visible again.

## Supabase Realtime inbox signal (follow-up)

The communications stream still held a function open per visible tab, querying the
database every 2 s. Visible tabs now join a private Supabase Realtime channel instead:

- Migration `20261104230000_inbox_realtime_signal` adds statement-level triggers on
  `UserNotification` that call `realtime.send('{}', 'inbox', 'inbox:<userId>', private)`
  once per affected user per statement. The payload is empty; the browser reloads through
  the existing authorized inbox endpoint. Signalling failures never roll back the write.
- Policies on `realtime.messages`: an `authenticated` user may receive only on
  `inbox:<auth.uid()>`; a restrictive policy forbids any browser role from sending on
  `inbox:*` topics. No application table is opened to browser roles.
- `lib/inbox-realtime.ts` must call `supabase.realtime.setAuth()` before joining; without it
  the join carries only the publishable key and Realtime refuses the private topic.
- If the join fails (migration not applied, Realtime unavailable), the tab falls back to the
  server stream for the rest of the page, so the client can ship before the migration.

Verified against the local Supabase stack (`--dashboards` e2e): own topic joins, a new
notification reloads the inbox within seconds with no stream request, another user's
topic is refused, and a client-sent `inbox` broadcast is not acknowledged and reaches no
tab. `tests/inbox-realtime-signal-native.test.cjs` (security suite) covers trigger fan-out,
idempotency, the RLS precondition, and policy behavior in plain PostgreSQL with stand-ins.
