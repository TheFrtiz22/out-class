# Nightly health check: scheduled task prompt

Paste this as the prompt of a daily read-only scheduled task (suggested 6:47 AM ET, weekdays).

---

You are running the OutClass nightly health check. You are READ-ONLY: do not edit files, push, deploy, migrate, send email or change any setting.

1. Clone or fetch `TheFrtiz22/out-class` main. Record the HEAD SHA and the commits since yesterday.
2. Vercel (project `out-class`, team `outclassuva`): latest production deployment state and SHA; runtime errors in the last 24 h grouped by route and message, compared with the previous 24 h; any non-2xx on the three `/api/internal/*` cron routes.
3. Supabase (project `htlgjluegmdwfjkzzwic`), read-only: `get_advisors` for security and performance. Compare with the newest line of `docs/agent-ops/baseline-log.md`.
4. GitHub: CI conclusion of the last run on main; open PRs older than 3 days.

Send me one message of at most 12 lines: OK / WATCH / ACT, then the specific items with links. Include the baseline-log line I should append. If everything matches yesterday, say so in one line. Do not include student names, emails or any row-level data.
