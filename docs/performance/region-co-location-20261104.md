# Function region co-location (2026-11-04)

Production Vercel functions ran in `iad1` (Washington, D.C.) while Supabase
(database and Auth) runs in `us-west-2` (Oregon), so every serial Auth and SQL
round trip crossed the country (`OUTCLASS_NAVIGATION_AUDIT.md`).

On 2026-11-04 the owner switched the production Function Region to `pdx1`
(Portland) and redeployed the same code. `vercel.json` now pins `pdx1`.

## Measurement

Same signed-in account, browser console on https://www.out-class.net, 12 timed
`GET /api/workspace` reads per kind after one discarded warm-up (read-only).
`x-vercel-id` confirmed `iad1::iad1` before and `iad1::pdx1` after.

| Read | iad1 p50 | pdx1 p50 | iad1 p90 | pdx1 p90 |
|---|---|---|---|---|
| studentDashboard | 2528 ms | 314 ms | 2971 ms | 351 ms |
| notifications | 2112 ms | 233 ms | 3462 ms | 301 ms |
| corkboard | 1404 ms | 253 ms | 1729 ms | 281 ms |
| taskNotifications | 1215 ms | 264 ms | 2126 ms | 326 ms |

All responses were HTTP 200. A 4.6–9.1× reduction at p50. The browser → Oregon
hop is included in the pdx1 numbers.

## Consequences

- Lock hold time per statement drops from ~70 ms to ~2 ms, which removes most
  of the club-wide write contention risk for voting, bookings and RSVPs
  (`club-write-contention.md`). The student application lock change is still
  needed for large bursts (50 concurrent saves: p95 2.4 s on main at 2 ms).
- Cron workers also run in pdx1 against the same database.
- Rollback: set Function Region to `iad1` and redeploy, or Instant Rollback.
