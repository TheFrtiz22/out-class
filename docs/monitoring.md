# Monitoring

Status (2026-11-11): the health endpoint is in the code. Sentry has **no uptime monitor** yet, and the only alert rule is the "high priority issues" issue alert. The steps below are for the owner: they are production configuration writes, so an agent does not make them.

## Health endpoint

`GET /api/health` (`app/api/health/route.ts`)

| Database | Status | Body |
| --- | --- | --- |
| `SELECT 1` answers within 2 seconds | 200 | `{ "ok": true, "version": "<first 12 characters of the deployed commit>" }` |
| Error, or no answer within 2 seconds | 503 | `{ "ok": false, "version": "..." }`, plus `Retry-After: 30` |

- Responses are `Cache-Control: no-store` and `noindex`. The CDN never serves a cached "up".
- The body never contains hostnames, error text or timings. A failure logs one fixed line, `health: database check failed`, with no cause, because Prisma errors can name the database host.
- Middleware returns it before any session refresh, cookie handling or redirect, whatever cookies the request carries. No rate limiting applies to it. If Vercel WAF rate-limit rules are added later, add an exception for `/api/health`.
- Maintenance mode applies only to product pages, so health stays 200 while maintenance mode is on.
- `version` is `dev` outside Vercel, or if Vercel's system environment variables are not exposed.
- One probe a minute from each Sentry region is about 1,440 short database queries a day per region, which is negligible next to the three every-minute crons.

Check a deployment by hand: open `https://out-class.net/api/health` and compare `version` with the commit Vercel shows for the production deployment.

## Sentry uptime monitor (owner creates)

Sentry → Alerts (or Insights → Uptime) → **Create Alert** → **Uptime Monitor**:

| Field | Value |
| --- | --- |
| Name | `OutClass production health` |
| Project / environment | `out-class` / `production` |
| URL | `https://out-class.net/api/health` |
| Method | `GET`, no headers, no body |
| Interval | 1 minute |
| Timeout | 10 seconds |
| Assertion (if offered) | status code is 200 (the default "2xx is up" is equivalent) |
| Failure tolerance | Down after **3** consecutive failures; up again after **2** consecutive successes. This rides out a single cold start or a deploy switchover. |
| Owner / notify | The owner (team or email). Add a second person if one exists. |

The monitor opens a Sentry issue when the site is down and resolves it when the site recovers. Make sure an issue alert sends uptime issues to the owner by email (and to Slack or SMS if set up later). The existing "high priority issues" rule may already cover them; check that a test outage notifies you (below).

Optional second monitor: `https://out-class.net/` with the same settings, which also catches a broken page render while the database is fine.

**Test it once:** after creating the monitor, set its URL temporarily to `https://out-class.net/api/health-test-404` (it returns 404). Confirm you get the notification within about 3 to 4 minutes, then restore the URL and confirm the recovery notification.

## Recommended Sentry alert rules (owner creates)

Sentry → Alerts → Create Alert. Send all to the owner by email.

1. **Error spike (new issue spike).** Metric alert, project `out-class`, environment `production`. Dataset: Errors. Metric: `count()`. Filter: `event.type:error`. Window: 5 minutes. Critical when above **25**; warning when above **10**; resolve below 5. Tune the thresholds after two weeks of normal traffic.
2. **New issue with volume.** Issue alert. When: *a new issue is created* **or** *an issue changes state from resolved to unresolved* (regression). If: *the issue has more than 10 events in 1 hour*. Then: notify the owner. Action interval: 30 minutes. This catches a bad deploy without paging for one-off errors.
3. **Cron failures.** The cron routes (`vercel.json`: three every minute, plus the daily `graduation` job) are reported under the transaction shape `/api/internal/[id]` (`lib/sentry-scrub.ts` keeps only the handler segment of API paths). Issue alert. When: *a new issue is created* or *the issue is seen more than 3 times in 10 minutes*. If: the event's `transaction` attribute **contains** `/api/internal/`. Then: notify the owner. Action interval: 10 minutes. Confirm the filter matches by checking the transaction field of a real event from those routes.
   - Limit: this sees only thrown errors. A cron that never runs, or returns an error status without throwing, does not create a Sentry event. Vercel → Project → Settings → Cron Jobs shows each run; check it after deploys. A follow-up code change can add Sentry Cron Monitor check-ins (`Sentry.captureCheckIn`) to the three routes so missed runs alert too.

## Not covered here

Billing and spend alerts (Vercel, Supabase, Resend, Sentry) and DMARC tightening are separate owner tasks.
