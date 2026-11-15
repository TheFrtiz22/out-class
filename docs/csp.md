# Content-Security-Policy

Status: implemented on branch `security/csp-nonce`, shipped in **Report-Only** mode. Nothing is blocked until the owner sets `OUTCLASS_CSP_ENFORCE=1`.

## How it works

- `middleware.ts` makes a 128-bit nonce for every page request (`lib/csp.ts` `createNonce`), builds the policy (`buildCsp`), and puts both on the forwarded request headers (`x-nonce` and the policy header). Next.js 15.5 reads the nonce from either `Content-Security-Policy` or `Content-Security-Policy-Report-Only` and adds it to its own framework and chunk scripts. Client-sent copies of those headers are deleted first.
- The same policy goes on the response as `Content-Security-Policy-Report-Only`, or as `Content-Security-Policy` when `OUTCLASS_CSP_ENFORCE=1`.
- Inline scripts read the nonce with `cspNonce()` (`utils/csp-nonce.ts`): the homepage's audience boot script and the JSON-LD blocks on `/`, `/about` and `/uva`. JSON-LD is not executable, so it is nonced only for consistency. `tests/csp.test.cjs` fails if a page or component adds another `<script>` tag or `next/script`.
- Vercel Analytics and Speed Insights add their scripts from the bundle, which `'strict-dynamic'` trusts. They load from and post to same-origin `/_vercel/*`.
- `next.config.mjs` still sends the enforced `Content-Security-Policy: frame-ancestors 'self'` on every path. Browsers ignore `frame-ancestors` in Report-Only policies, so that header still protects framing during rollout.

## Policy (production, Report-Only)

```
default-src 'self';
script-src 'self' 'nonce-…' 'strict-dynamic' 'wasm-unsafe-eval' [https://challenges.cloudflare.com];
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:;
font-src 'self';
connect-src 'self' <NEXT_PUBLIC_SUPABASE_URL> <wss:// same host> [<Sentry ingest origin>];
frame-src 'self' [https://challenges.cloudflare.com];
worker-src 'self'; manifest-src 'self'; media-src 'self';
object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self';
[upgrade-insecure-requests;]   (enforce mode only)
report-uri /api/csp-report
```

Items in brackets are added only when configured: Turnstile when `TURNSTILE_ENABLED` (both keys set at build time), Sentry when `NEXT_PUBLIC_SENTRY_DSN` is set, and `upgrade-insecure-requests` when enforcing (browsers ignore it in Report-Only and print a warning). Development adds `'unsafe-eval'` for React Refresh.

### Origin inventory

| Origin | Why | Directive |
| --- | --- | --- |
| Supabase project URL | Browser auth client; Realtime for inbox and communications live updates | connect-src https + wss |
| Sentry ingest (from the DSN) | Browser error reports | connect-src |
| `/_vercel/insights/*`, `/_vercel/speed-insights/*` | Vercel Analytics and Speed Insights, same origin | covered by `'self'` |
| `challenges.cloudflare.com` | Turnstile `api.js` and its challenge frame, only when enabled | script-src, frame-src |
| `/pdfjs/pdf.worker.min.mjs`, `/sw.js` | pdf.js worker for the résumé viewer; service worker | worker-src `'self'` |
| Self-hosted fonts (`next/font/local`) | Caslon and Source Sans | font-src `'self'` |

Not needed in the browser policy:
- **Typesense** is queried only from the server action `actions/typesense-search.ts`.
- **Microsoft sign-in and Outlook** start with `window.location` navigations and a popup to OutClass routes that redirect server-side. No form posts to Microsoft, so `form-action 'self'` is enough.
- **Storage files** reach the browser through OutClass routes (`/api/club-assets`, `/api/event-flyers`, `/api/profile-photos`, `/api/recruiting-resumes`), which are same-origin. The `/api/resumes` signed-URL redirect is used only as a new-tab link.

### Accepted allowances

- `style-src 'unsafe-inline'`: React `style={…}` attributes, Radix positioning and the landing audience gate need inline styles. Inline styles cannot run script, and every script still needs the nonce.
- `img-src https:`: club logos, banners and gallery images can be legacy https links that leaders entered before uploads existed. Image loads cannot run script.
- `'wasm-unsafe-eval'`: pdf.js decodes some scanned-PDF images with WebAssembly. It allows compiling WebAssembly only, not JavaScript `eval`.

### Routes without the document policy

`lib/csp.ts` `cspAppliesTo` skips `/api/*`, `/_next/*`, `/_vercel/*`, metadata routes (robots, sitemap, manifest, icons, link-preview images), `/sw.js`, `/offline.html` and any path with a file extension (public files, the pdf.js worker). They are not HTML pages, and a document policy with `object-src 'none'` on the framed résumé PDF (`/api/recruiting-resumes`) could stop the browser's PDF viewer. They keep the `frame-ancestors` header.

### Static rendering

Nonces need per-request HTML, so a statically prerendered page cannot carry one. **No page is static today:** the root layout (`app/layout.tsx`) reads `cookies()` for the session, Demo Mode and site notices, so Next.js already renders every page, including `/about`, `/uva`, `/privacy` and `/terms`, on each request. The nonce policy therefore costs no static page, and no route needs a hash-based fallback. If a public page is made static later (for example by moving the cookie reads out of the root layout), it must either get a hash-based policy or stay out of `cspAppliesTo`. The `/og/outclass.png` route is `force-static`, but it is an image route outside the policy.

## Report endpoint

`POST /api/csp-report` (`app/api/csp-report/route.ts`, `lib/csp-report.ts`):
- Accepts `application/csp-report` (report-uri) and `application/reports+json` (Reporting API). Other content types get 415. Bodies over 8 KB get 413, checked from `Content-Length` and again while reading.
- Logs `console.warn("CSP violation", { directive, blocked, path, disposition })` to the Vercel runtime log. `blocked` is reduced to an origin or a keyword (`inline`, `eval`, `data`, `blob`). `path` has no query string, and ids, long numbers and tokens are masked as `:id`. Script samples, referrers, full URLs and user agents are never logged.
- Each distinct violation is logged once per minute per instance, with at most 20 lines per minute and 200 tracked keys. When the window rolls over, a `CSP violations repeated` line gives the counts of repeats and dropped reports.
- The middleware skips session refresh for this endpoint and lets Demo Mode browsers report. The maintenance write guard exempts it because it writes no data.
- The policy uses only `report-uri`. Chrome ignores `report-uri` when `report-to` is present, and Reporting API delivery (batched, through `Reporting-Endpoints`) was not observed in local headless Chrome testing, so `report-to` is left out until it can be verified on a deployment.

## Rollout (owner)

1. Merge with `OUTCLASS_CSP_ENFORCE` unset. Every page then sends `Content-Security-Policy-Report-Only`.
2. Run for a few days that cover real use: sign-in, signup with Turnstile if it is on, Explore, a leader workspace with Realtime inbox, the interview résumé viewer (including a scanned PDF), QR export, and installing or updating the PWA.
3. Read the reports in Vercel runtime logs (search `CSP violation`). For each distinct `directive` + `blocked`, either add the origin to `buildCsp` with a reason in the inventory above, or fix the code that caused it. Expected noise: browser extensions (`blocked` values such as `chrome-extension`), which need no change.
4. Known item to watch: a non-private, external https résumé link opened in the leader workspace frame will report `frame-src`. Under enforcement it would not render inline (the link still opens in a new tab).
5. When a full day has no reports caused by the app, set `OUTCLASS_CSP_ENFORCE=1` in Vercel Production (and Preview first if you want) and redeploy. Middleware reads it at runtime on Vercel, but a redeploy makes the change explicit. To roll back, unset the variable and redeploy.

## Verification done

- `tests/csp.test.cjs`: fresh nonce per request, the nonce forwarded to rendering, client-sent nonce headers dropped, the header switching with the flag, the origin inventory, Turnstile origins only when enabled, nonced inline scripts (rendered and checked in source), report-endpoint size, type and PII bounds, and dedupe and rate limits.
- Real Chrome through Playwright, with the generated policy on a synthetic page. Next.js pages could not render locally without a generated Prisma client. Results: the nonced inline script, a strict-dynamic injected same-origin script, a module worker, a self-hosted font, an inline style attribute and a data: image all loaded with **zero violations** in both modes. A control script without a nonce was reported in Report-Only and blocked under enforcement, and the report reached the endpoint in the `application/csp-report` format the parser expects.
- Not yet verified: a real deployment with Supabase Realtime, Sentry, Vercel Analytics, Turnstile and the résumé viewer. Step 2 above covers these.
