# Service worker (installable app, S1-7)

`public/sw.js` exists so OutClass can be installed to the home screen and show a branded page when a navigation fails offline. It is not an offline mode and it carries no push code (S1-8 adds push).

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

- `node --test tests/installable-app.test.cjs` covers the manifest, icon sizes, caching rules in a fake worker scope (including a throwing `cache.put` and a `206`), the registration gates, and both kill paths.
- On a preview deploy, check Chrome DevTools > Application. The Manifest pane should show no errors. Under Service workers, `/sw.js` should be activated. Cache storage should hold only `_next/static` files plus `offline.html` and one icon.
- Go offline in DevTools and open a page: you should see "You're offline". Open `/q/<code>` and an `.ics` link: the browser's own network error appears, which shows the worker did not intercept them.
- After the kill switch, Application > Service workers should be empty and Cache storage should have no `outclass-*` entries.

## iOS caveat and pending checks

On iOS, an app installed from Safari's Add to Home Screen runs with its own cookie and storage jar, separate from Safari. A user signs in once inside the installed app. Links in email (magic links, invitations, password reset) open in Safari, not the installed app, so a sign-in finished from an email link lands in Safari's session.

**Pending:** real-device install on iPhone (Safari) and Android (Chrome), and a check of the live layout markup on a preview deploy. Only the static-harness Chrome check and unit tests have run so far.
