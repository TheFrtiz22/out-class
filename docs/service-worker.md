# Service worker (installable app, S1-7)

`public/sw.js` exists so OutClass can be installed to the home screen and show a branded page when a navigation fails offline. It is not an offline mode. Since S1-8 it also shows Web Push notifications (see [Push notifications](#push-notifications-s1-8)).

## What it does

| Request | Behavior |
| --- | --- |
| `GET /_next/static/*` (content-hashed build assets) | Cache-first in `outclass-static-<VERSION>`. Only a `200`, same-origin response without `no-store` or `private` is stored, so a `206` range response never is. Up to 300 entries. A cache failure still returns the network response. |
| Top-level page navigation | Network only, never cached. If the browser is offline or `fetch` fails with a network `TypeError`, the worker serves `/offline.html` (static, no user data, precached in `outclass-offline-<VERSION>`). An aborted navigation passes through. |
| Everything else | Not intercepted: non-GET, cross-origin (Supabase Auth and Storage), any `Authorization` header, `/api/*`, `/_next/data`, `/_next/image`, RSC fetches, server actions, and navigations to `/api`, `/auth`, `/q`, `/check-in`, `/platform`, `/preview`, `/demo` or any path with a file extension (`.ics`, `.csv` downloads). |

The worker uses `skipWaiting` and `clients.claim`. Activation deletes every `outclass-*` cache from another version. Bump `VERSION` in `sw.js` to drop the caches. `/sw.js` is served with `Cache-Control: no-cache` (`next.config.mjs`), so browsers pick up a new worker on their next navigation.

`components/service-worker-registration.tsx` registers it after page load. The root layout renders the component only in production, outside Demo Mode and support sessions, and the component also skips `/platform`.

## Turning it off

1. **Env flag (normal path).** Set `OUTCLASS_SERVICE_WORKER=off` for the Vercel environment and redeploy. The layout then stops registering the worker. On the next page load, the component unregisters every worker for the origin and deletes the `outclass-*` caches.
2. **Self-unregistering worker (if page JavaScript cannot be trusted to run).** Copy `public/sw-kill.js` over `public/sw.js` and deploy, keeping the env flag on. Browsers fetch the new `/sw.js` on their next navigation. The new worker skips waiting, deletes the `outclass-*` caches, calls `registration.unregister()` and reloads each open tab.

To turn the worker back on later, restore `sw.js` with a higher `VERSION` and remove the flag.

## Verifying

- `node --test tests/web-push.test.cjs tests/web-push-migration.test.cjs` covers push: subscription authorization and server-side status, payload privacy, email isolation, the cron deadline, 410 cleanup and the failure cap, idempotency, retention, sign-out, the worker's push and click handlers, and the migration (including REVOKE against Supabase-style default grants).
- `node --test tests/installable-app.test.cjs` covers the manifest, icon sizes, caching rules in a fake worker scope (including a throwing `cache.put` and a `206`), the registration gates, and both kill paths.
- On a preview deploy, check Chrome DevTools > Application. The Manifest pane should show no errors. Under Service workers, `/sw.js` should be activated. Cache storage should hold only `_next/static` files plus `offline.html` and one icon.
- Go offline in DevTools and open a page: you should see "You're offline". Open `/q/<code>` and an `.ics` link: the browser's own network error appears, which shows the worker did not intercept them.
- After the kill switch, Application > Service workers should be empty and Cache storage should have no `outclass-*` entries.

## Push notifications (S1-8)

Web Push is an extra delivery channel on top of the notification email outbox. Email and in-app notifications are unchanged.

- **Opt-in.** Inbox > Notification settings > "Push notifications on this device" (`components/inbox/push-notifications-toggle.tsx`). The browser permission prompt appears only from that switch; a dismissed or denied prompt shows "Notifications are blocked in your browser settings." On/off is read from the server row for this browser's endpoint. Where the Push API is missing (iPhone Safari outside the installed app, iOS below 16.4), the sheet says to install the app first. The switch is hidden without an active service worker (for example `OUTCLASS_SERVICE_WORKER=off`) and in Demo Mode; the server actions also refuse Demo and support (view-as) sessions. Signing out from the account menu unsubscribes this device first (best effort, at most 2 s).
- **Storage.** `WebPushSubscription` (endpoint, p256dh, auth, userId, createdAt, lastSuccessAt, failureCount; unique endpoint) and `WebPushDelivery` (one row per notification and subscription), migration `20261111090000_web_push_subscriptions`. Server-only: RLS on, no `anon`/`authenticated` access. Only endpoints on known browser push services are accepted (`lib/web-push.ts`), since the server posts to them. Up to 10 devices per user; a re-used endpoint moves to the account that subscribed last.
- **What is pushed.** In `utils/notification-delivery.ts`, after the email grouping transaction commits a notification to instant (non-digest) email, a push is queued for each of the user's subscriptions, outside that transaction, so a push-table error cannot hold back an email. Before sending, the email delivery must still be live (QUEUED, SENDING or SENT) and the email claim's own access checks (`utils/notification-currency.ts`) must still pass. So push follows the same category toggles, Instant frequency, currency, archive and suspended-club checks as email, and needs the email worker enabled (`COMMUNICATIONS_EMAIL_ENABLED`). Daily-digest and Off users get no pushes. Pushes older than 24 hours are skipped, as are read or archived notifications.
- **Sending.** The same cron (`/api/internal/notification-delivery`) then sends queued pushes with `web-push`, after email and within the same 60 s budget: no push starts after 40 s and no send runs past 48 s. A push failure is logged (and sent to Sentry when a DSN is set) and reported as `push.error`; the email result and 200 stand. Each row is claimed PENDING to SENDING once and never reclaimed: at most one push per notification and subscription. The stored endpoint is re-validated before every send. 404/410 deletes the subscription. Other 4xx responses increment `failureCount`; 429, 5xx and timeouts do not. A subscription stops receiving pushes at 5, and a success resets it. Delivery rows older than 7 days are deleted, up to 500 per run.
- **Payload.** Only `{ title, body, url }`: a category title ("Application update"), the club name for announcements, invitations and tasks, otherwise "Open OutClass for details.", and a same-origin path. Never the notification's own title or body. `sw.js` shows it and, on click, focuses an open tab at that URL or opens one; a non-same-origin URL falls back to `/inbox`.

### Turning push on (owner)

1. Apply migration `20261111090000_web_push_subscriptions` to production through the normal approved migration path, before deploying the code that sets the keys.
2. Generate keys once: `npx web-push generate-vapid-keys`. Keep the private key secret; never commit it.
3. In Vercel (Production, and Preview only if wanted), set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` (for example `mailto:hello@out-class.net`), then redeploy. With any of the three missing, push is off: no switch is shown, nothing is queued and nothing is sent.
4. To turn it off, remove `VAPID_PRIVATE_KEY` and redeploy. Rotating keys invalidates every existing subscription; users turn the switch on again.

### Rolling back

Revert the code first (or remove the VAPID keys and redeploy), so nothing reads or writes the push tables. Then, if the tables should go, add a new forward migration that runs `DROP TABLE "WebPushDelivery"; DROP TABLE "WebPushSubscription";`. Never edit or delete the applied migration.

## iOS caveat and pending checks

On iOS, an app installed from Safari's Add to Home Screen runs with its own cookie and storage jar, separate from Safari. A user signs in once inside the installed app. Links in email (magic links, invitations, password reset) open in Safari, not the installed app, so a sign-in finished from an email link lands in Safari's session.

**Pending:** real-device install on iPhone (Safari) and Android (Chrome), and a check of the live layout markup on a preview deploy. Only the static-harness Chrome check and unit tests have run so far. Push (S1-8) has been tested only with a fake worker scope and a stubbed push service: a real delivery to Chrome, Firefox and an installed iOS 16.4+ app is still unverified.
