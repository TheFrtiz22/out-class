# Baseline log

Newest first. One line per snapshot. Counts from read-only Supabase advisors and Vercel.

| Date (ET) | main SHA | Prod deploy SHA / state | Security advisors (crit/warn/info) | Notable | Source |
| --- | --- | --- | --- | --- | --- |
| 2026-11-05 00:30 | 8d2746f | 8d2746f / READY | 0 / 54 / 43 | warn = 51 mutable search_path, 1 anon + 1 authenticated SECURITY DEFINER (`handle_new_user`), 1 leaked-password protection off; info = 43 RLS-enabled tables with no policies (deny-all by design) | Claude chat session, read-only |
