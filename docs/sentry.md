# Sentry error reports

Status: implemented, off until a DSN is set. Branch `ops/sentry`. `@sentry/nextjs` 11.8.0.

## What is sent

Errors only: no tracing, no session replay, no feedback widget, no logs. Each report is rebuilt
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

Source maps are not uploaded (no `withSentryConfig`, no auth token), so browser stack traces are
minified. Adding upload later needs `SENTRY_AUTH_TOKEN` and a build-config change.

If a Content Security Policy is added later, allow `connect-src https://*.ingest.us.sentry.io`.

## Verification still needed

With a test DSN: one thrown error per runtime (server, edge middleware, browser, each boundary)
arrives once, and the received payload matches the allowlist. Confirm with a production build that
`.next/static` contains no Sentry chunk when the DSN is unset.
