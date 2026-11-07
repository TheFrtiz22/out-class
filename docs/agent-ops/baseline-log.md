# Baseline log

Newest first. One line per snapshot. Counts from read-only Supabase advisors and Vercel.

| Date (ET) | main SHA | Prod deploy SHA / state | Security advisors (crit/warn/info) | Notable | Source |
| --- | --- | --- | --- | --- | --- |
| 2026-11-05 00:30 | 8d2746f | 8d2746f / READY | 0 / 54 / 43 | warn = 51 mutable search_path, 1 anon + 1 authenticated SECURITY DEFINER (`handle_new_user`), 1 leaked-password protection off; info = 43 RLS-enabled tables with no policies (deny-all by design) | Claude chat session, read-only |
| 2026-11-05 20:00 | 4d531bd | 4d531bd / READY (dpl_HTURG3Eak7…) | 0 / 52 / 43 | warn = 49 mutable search_path (−2: the notification trigger functions pinned by 20261105190000), 1 anon + 1 authenticated SECURITY DEFINER (`handle_new_user`), 1 leaked-password protection off; info = 43 RLS-enabled tables. Runtime errors: no new class; scheduled-communications cron 29 runs/30 min, no errors | release-verifier on #131/#132 (WATCH → OK after advisors and cron logs collected) |
| 2026-11-07 05:10 | 41be2908 | 41be2908 / READY (dpl_DuYz6ZHnQXrefMU9pfbYGhUawzRk) | 0 / 52 / 43 (unchanged, per the pre-merge check) | runtime errors 7h: ZodError `prompt` too_small on /club/[clubId]/workspace (baseline class, last seen on the previous deployment); "Additional observations are unavailable…" authorization denial on /club/[clubId]/workspace, 2 events / 1 user, first seen 2026-11-05 (pre-merge; add to baseline). No new classes. Rollback target dpl_6ziCv6srrPfzErUzM33Nxo9sieaa not needed. | Claude Code session, read-only |
