# Request rate limits

OutClass limits abusable endpoints at two layers. Each layer covers a gap the other one leaves.

| Layer | Where | Scope | Purpose |
|---|---|---|---|
| Global | Vercel Firewall custom rules (owner configures them in the dashboard) | All instances, before any function runs | Stops floods and enumeration across the fleet, at no function cost |
| Per instance | `lib/rate-limit-core.ts` (edge-safe core), `lib/rate-limit.ts` (route handlers), `lib/rate-limit-action.ts` (server actions), `middleware.ts` (`/q/*`) | One serverless instance | Bounds the cost of a burst that reaches one instance, returns a proper 429, works locally and on previews |
| Database (exports only) | `app/api/club-exports/route.ts` reads the caller's last `club.export.*` audit rows (at most 10) | All instances | Each export opens a snapshot transaction of up to 20 s, so the limit has to hold across instances. No new table or migration: every export already writes one `AuditLog` row, and `[actorId, createdAt]` is indexed |

The in-memory limits apply per instance. Vercel runs many instances and starts new ones under load, so an attacker spread across instances can make up to roughly (instances × limit) calls. The Firewall rules below are the global limit. The in-app limits are a second layer, not a replacement for the Firewall rules.

## Behaviour

- **Key.** A signed-in caller is keyed by account id where the handler already knows it (exports). Otherwise the key is the first `x-forwarded-for` hop, validated with `net.isIP` (the middleware copy is edge-safe and tested against `net.isIP`). Requests with a missing or invalid address share one `ip:unknown` bucket per policy, so dropping the header does not bypass the limit. The calendar feed is keyed by its token hash.
- **Window.** Fixed window per policy and key. Keys live in an LRU of 10,000 entries per instance.
- **Over the limit.** Routes answer `429` with `Retry-After` (seconds), `Cache-Control: private, no-store` and `{"error":"Too many requests. Please wait a moment and try again."}`. `/q/*` answers the same message as plain text. Server actions cannot set a status. Signup returns the same message as its usual `{ error }`. Club search returns `null`, so Discover falls back to its local directory filter, the same path it uses when Typesense is unavailable.
- **Logging.** One `console.warn` per key and window, with the policy name and limit only. The address and account id are never logged.
- **Never limited.** The cron routes under `app/api/internal/*` (protected by the `CRON_SECRET` bearer token), sign-out (`app/api/auth/logout`), and ending a view-as session (`action: "end"`). `tests/rate-limit.test.cjs` fails if a new `app/api` POST route neither calls the limiter nor appears on the reviewed exemption list.

## Per-route limits (in app, per instance)

Policies are defined in `RATE_LIMITS` (`lib/rate-limit-core.ts`). Keep this table in step with that file.

| Endpoint | Key | Limit |
|---|---|---|
| Club search server action (`actions/typesense-search.ts`) | IP | 60 / min |
| `GET /api/club-exports` | account | 10 / 10 min per instance, **and** 10 / 10 min across instances (audit rows) |
| `/q/[code]` short links (middleware) | IP | 120 / min (generous because a large event can put many phones behind one campus address) |
| `GET /api/club-assets` | IP | 300 / min |
| `GET /api/calendar-feed/[token]` | token | 30 / 10 min |
| `POST /api/school-requests` | IP | 10 / h (plus the existing 100/h global and 3/day per email in Postgres) |
| `POST /api/auth/password-recovery` | IP | 10 / 15 min |
| `POST /api/auth/student-claim` | IP | 10 / 15 min |
| Signup server action (`registerStudent`) | IP | 20 / h |
| `POST /api/platform/elevation` | IP | 20 / 15 min |
| `POST /api/platform/view-as` (not `end`) | IP | 60 / 10 min |
| `/api/platform/view-as/blocked` (still answers 403 when over, without another audit row) | IP | 60 / min |
| `POST /api/demo` | IP | 30 / 10 min |

Turnstile, Supabase Auth limits and the existing per-feature quotas (invitations, task files, platform reports) still apply on top of these limits.

### Caching that absorbs load

- **Published club images** (`/api/club-assets` without `preview=1`) are sent with `public, max-age=300, s-maxage=900, stale-while-revalidate=60`, so the Vercel CDN serves repeat requests without running the function or downloading from Storage. Every upload gets a new UUID reference, so a replaced image never reuses a cached URL. Unpublishing an image or suspending a club takes effect within `s-maxage` (15 minutes). Preview images and all 404s stay `private, no-store`.
- **Calendar feed.** Every request still looks up the token, so a revoked link or a disabled account stops working immediately. The built feed is then reused on that instance for 60 s. Responses carry an `ETag` and `Last-Modified` and are sent as `private, no-cache`, and a matching `If-None-Match` returns `304`. Error responses stay `no-store`.

### Not covered in the app

- **Signup code resend.** `supabase.auth.resend` and the email-code sign-in are called from the browser directly to Supabase Auth, so the app never handles them. They are bounded by Supabase's auth rate limits and by Turnstile or captcha. Owner: review **Authentication → Rate Limits** (email sent, OTP, verify) and enable Bot and Abuse Protection.
- **Email confirmation** (`app/api/auth/confirm-email`, `lib/email-confirmation.ts`) is handled by #247.
- **Other authenticated server actions** are not limited individually. They require a session, and the Firewall rule on server-action POSTs below covers them.

## Vercel Firewall rules for the owner to add

Add these in the dashboard under **Project → Firewall → Configure → Custom Rules**. Start each rule in **Log** mode for a day, check the matched traffic, then switch it to **Rate Limit** with the action shown. Use the **Fixed Window** algorithm and the **IP Address** key throughout. Each rate-limit rule needs one condition group; the conditions listed in a group are combined with AND.

| # | Name | Conditions | Window / limit | Action |
|---|---|---|---|---|
| 1 | Auth and public forms | Request Path **starts with** `/api/auth/` **AND** Method **equals** `POST` | 60 s / 10 | 429 (Too Many Requests) |
| 2 | School requests | Request Path **equals** `/api/school-requests` **AND** Method **equals** `POST` | 3600 s / 10 | 429 |
| 3 | Exports | Request Path **equals** `/api/club-exports` | 600 s / 20 | 429 |
| 4 | Short links | Request Path **starts with** `/q/` | 60 s / 120 | 429 |
| 5 | Calendar feed | Request Path **starts with** `/api/calendar-feed/` | 60 s / 30 | 429 |
| 6 | Club images | Request Path **equals** `/api/club-assets` | 60 s / 600 | 429 |
| 7 | Server actions | Method **equals** `POST` **AND** Request Header `next-action` **exists** | 60 s / 300 | 429 |
| 8 | API catch-all | Request Path **starts with** `/api/` **AND** Request Path **does not start with** `/api/internal/` | 60 s / 600 | 429 |

The same conditions in the Firewall API/CLI form, for rules that are fiddly in the dashboard:

```text
rule 7: {"type":"method","op":"eq","value":"POST"}  {"type":"header","key":"next-action","op":"ex"}
rule 8: {"type":"path","op":"pre","value":"/api/"}  {"type":"path","op":"pre","value":"/api/internal/","neg":true}
```

Notes:

- **Never limit cron.** Rule 8 excludes `/api/internal/`, and no other rule matches it. Vercel Cron calls those routes with the bearer secret.
- **Order.** Place rules 1–7 above rule 8 so the narrow limits apply first.
- **Campus networks.** Rules 4 and 7 count per IP, and many students can share one university address during an event. If the logs show legitimate check-in traffic near the limit, raise rule 4 rather than lowering the in-app limit.
- **Attack Challenge Mode** stays available as an emergency switch. It challenges every visitor, including calendar clients, so turn it off again once an attack ends.
- Leave the platform's default managed DDoS mitigation on. These rules add to it.

## Tests

`tests/rate-limit.test.cjs` covers:

- the window, reset and once-per-window logging, with no key written to logs;
- key isolation and the bounded key table;
- account, address and unknown keys;
- edge IP validation against `net.isIP`;
- the 429 response and its `Retry-After` header;
- `limitRequest`;
- the POST-route source gate and its exemption list;
- calls to the limiter from exports, assets, the calendar feed, search, signup and `/q/*`;
- cron routes never being limited;
- public and private cache headers for club images;
- a `/q/*` middleware burst;
- calendar-feed reuse, `304` responses and immediate revocation.
