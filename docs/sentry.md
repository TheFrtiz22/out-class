# Sentry error reports

Status: enabled; first event received Nov 10, 2026. `@sentry/nextjs` 11.8.0. Org `outclass-ot`,
project `out-class`.

## What is sent

Errors, plus timings for 10% of production requests and page loads. No session replay, no
feedback widget, no logs. Previews and development send errors only. Each error report is rebuilt
from an allowlist in `lib/sentry-scrub.ts`:

- error type, message (emails and long tokens redacted, 1,000 characters max), mechanism type
- stack frames: file, function, line, column only (no variables or source context)
- route shape: path with IDs, share codes and invitation identifiers replaced by `[id]`; API paths
  keep only the handler name; no query string or fragment
- browser user agent, environment, release
- the opaque account ID, if one was set (none is set today)
- browser breadcrumbs: navigation, clicks (category only) and fetch/XHR URL shape, method, status

Never sent: request bodies, cookies, other headers, IP address, email, contexts, tags, server name,
`extra`, console output, typed input, server breadcrumbs (outbound Supabase, Storage, email calls).
`tests/sentry-scrub.test.cjs` walks a realistic event full of canary values and fails if any leaves.

Performance events (`scrubTransaction`) keep timings, operation names, status, web-vital numbers
and route shapes. Span data and attributes are always dropped (URLs with query strings, SQL,
headers, element selectors). Database and cache spans keep no name, only timing. Calls to other
services keep the host and service name only (`https://<project>.supabase.co/storage/[id]`), since
later segments are table filters and Storage object keys. The server adds no trace headers to
outbound calls (`tracePropagationTargets: []`). The same test file checks a realistic performance
event against the canaries.

## Where errors come from

- Server Components, route handlers, Server Actions, middleware: `onRequestError` in `instrumentation.ts`.
- Browser: global handlers once the SDK loads, plus `app/error.tsx`, `app/(focus)/error.tsx` and
  `app/global-error.tsx`, which skip errors with a digest (already reported by the server).

Without a DSN, `instrumentation.ts` loads nothing and the browser SDK is removed from the build.
With one, the browser SDK loads in its own chunk after the page starts, so errors in the first
moments of a page load can be missed.

## Turning it on (owner)

1. Create a free Sentry project (platform Next.js). Data region: US. In project settings turn on
   **Data Scrubber** and **Use Default Scrubbers**, and turn off **Store Native Crash Reports** and
   IP address storage (Security & Privacy → "Prevent Storing of IP Addresses").
2. Vercel env (Production, optionally Preview): `NEXT_PUBLIC_SENTRY_DSN=<dsn>`. Redeploy.
   `SENTRY_DSN` alone enables server-side reports only.

3. Source maps (readable stack traces): add `SENTRY_AUTH_TOKEN` (a Sentry organization auth
   token with release and source map upload scope) to Vercel Production, and Preview if wanted.

On a Vercel build with that token, `next.config.mjs` wraps the config in `withSentryConfig`
(from `@sentry/nextjs/config`): browser maps are generated hidden (no `sourceMappingURL`), uploaded
to Sentry with the commit SHA as the release, then deleted. Build-time wrapping of server code is
off. `scripts/check-no-public-sourcemaps.cjs` runs after `next build` on every build and fails it if
any `.map` file or `sourceMappingURL` comment is left in the public static folder, so a failed upload
cannot publish maps. Without the token (local, CI) the config is unchanged and nothing is uploaded.

Browser timings depend on `NEXT_PUBLIC_VERCEL_ENV` being `production`, which needs Vercel's
"Automatically expose System Environment Variables" setting (on by default). Without it the browser
reports errors only. Navigations and the page load before the SDK finishes loading are not timed.

Error reports keep the trace and span IDs, so an error links to the timed request it happened in.
Both error and performance reports keep a reduced trace header (IDs, sample rate, environment,
release, route-shaped transaction name) so Sentry scales sampled counts correctly.

If a Content Security Policy is added later, allow `connect-src https://*.ingest.us.sentry.io`.

## Verification still needed

With a test DSN: one thrown error per runtime (server, edge middleware, browser, each boundary)
arrives once, and the received payload matches the allowlist. Confirm with a production build that
`.next/static` contains no Sentry chunk when the DSN is unset.
