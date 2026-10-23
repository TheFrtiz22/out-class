# OutClass performance audit — architectural review handoff

This is a self-contained review brief for the October 21, 2026 investigation at source commit `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`. **No proposed optimization has been implemented.** Only diagnostic scripts/tests and audit documents were added. No production record/schema/index/configuration/deployment/statistics reset, release or merge was changed. Decide implementation scope after reviewing the evidence.

## What is slow and what is proved

The strongest production finding is a long authenticated server wait, amplified by serial work. Current Vercel settings and the Production Functions dashboard show **iad1 / us-east-1**, Fluid Compute, Standard 1 vCPU/2 GB. The connected Supabase OutClass project is independently confirmed in **us-west-2**, PostgreSQL 17.6. This is a confirmed cross-region architecture, not a guess from response edge headers.

The dashboard's selected Production last-12-hours window, displayed 05:08–17:08 America/New_York on October 21, showed:

| Route | Displayed volume | Duration average / p75 / p95 | Active CPU average / p95 | TTFB average / p95 |
|---|---:|---:|---:|---:|
| `/api/workspace` | ~1.6K | 1,460 / 1,580 / 2,490 ms | 123 / 204 ms | 1,490 / 2,580 ms |
| `/club/[clubId]/workspace` | ~3.7K | 2,330 / 2,590 / 3,540 ms | 76 / 222 ms | 2,320 / 3,580 ms |

Counts are rounded; exact n, p50 and maximum are **unavailable**. The API aggregates all `kind` values; the workspace route combines document/RSC/action traffic. The API's external Supabase table displayed 290 ms “Latency” over ~1.7K calls, without specifying its percentile or limiting it to Auth. Hot starts were 97.1% of API requests and 99% of workspace-route requests. A sanitized club-path cohort showed 4.18 s p75 over a displayed 445 calls, but is not a particular tab measurement. [Recorded dashboard observations and URLs](evidence/vercel-observed.json).

The difference between average duration and active CPU strongly suggests waiting dominates these routes; **it does not split waiting into Auth/network/Prisma/pool/locks**. Those spans remain necessary. The uncontended local fixture does not establish reproduction of the reported five-second production click. An exploratory superseded cross-workspace pass observed one approximately 4.31 s local result; its trace was not preserved and no cause is assigned. Do not present a clean local median as production latency or silently treat all historical traffic as real users.

## Five largest bottlenecks for review

1. **Confirmed placement/wait; strong attribution hypothesis — serial remote identity/SQL chain across regions.** `utils/auth.ts:18` verifies the token remotely and checks live `auth.sessions`; `:42` reads the enabled Prisma account; `:90` reads membership and normally suspension. The real local full-guard loaders emit 4–21 SQL/control statements and one/two Auth verifications. Function CPU is much lower than wall duration. Test a same-region function preview and shorter query chains before infrastructure additions.
2. **Confirmed locally — pure reads queue as client Server Actions.** `components/interviews/interview-rooms-list.tsx:36` uses `Promise.all` for assigned rooms, interview queue and rounds, but browser HTTP shows those POSTs sequentially. `lib/workspace-api.ts:311`, `:337`, `:390` retain action-based reads for interview/task domains; meetings/announcements also use actions. Three serial remote reads can explain seconds even if each works correctly. GET allowlist transport already exists and can carry those original guarded loaders.
3. **Confirmed — hidden scheduler fan-out and duplicate requests.** `components/interview-management-tabs.tsx:41` force-mounts Scheduling while Rooms is selected. RoomManager `:54`, `:83`, `:90`, `:107`, `:108` starts additional reads; assigned rooms is requested twice. Local cold Rooms navigation has 13 requests; warm has eight. Most hidden requests finish after useful Rooms content, but they add load and can block subsequent action dispatch.
4. **Confirmed lifecycle/cold waterfall; strongly supported retry cause.** `components/club-workspace.tsx:201` keys sections by scope/section/tool, unmounting tab contents. Dynamic chunks load before mount-only fetches. React's installed production code has a 300 ms Suspense retry threshold; the observed chunk-finish→read-start gap aligns with it. Members and Pipeline retain 30 s data (`:120`) yet unconditionally revalidate (`organization-member-management.tsx:106`, `live-leader-workspace.tsx:166`). Keep authority/privacy resets; avoid blind retention of every private tab.
5. **Confirmed shape/size; production magnitude unmeasured — wide unbounded list queries.** `actions/crm.ts:54` loads student/profile/experiences, answers/questions, evaluations, assignments/member, round and booking relations for all submitted applications. A 100-applicant fixture produces ~193 KB ordinary JSON/~201 KB wire bytes and 17 SQL/control statements. Members UI pagination still fetches all memberships and invitations (`actions/organization-members.ts:120`). Tasks loads assignments and a member targeting catalog (`actions/tasks.ts:108`). Narrow/paginate lists and defer private detail payloads.

## Local numbers and methodology

Representative production-build browser results, **20 samples in each condition**, real disposable local Supabase Auth/PostgreSQL:

| Navigation | Cold p50 / p95 / max | Warm p50 / p95 / max |
|---|---:|---:|
| Overview → Members | 381 / 416 / 426.4 ms | 31.2 / 32 / 33 ms |
| Recruitment Overview → Applicants | 406.3 / 424.6 / 429.1 ms | 31.2 / 32.7 / 33 ms |
| Applicants → Interviews | 449.3 / 481.2 / 558 ms | 129.4 / 147.4 / 162 ms |

Previously loaded members/applicants still send a fresh GET while retained content is visible. Tasks/Meetings/Announcements refetch on section remount. Representative ordinary query-only rail transitions produced no RSC navigation or `/api/users/me` call. Do not diagnose every tab as a full server render/AuthProvider reset.

Initial authenticated local document→content measurements: club overview **215.8 ms p50 / 274.2 ms p95 / 299.1 ms max**, Personal Home **454.9 / 462.1 / 464.5 ms**, each n=20 with cold browser contexts and warm server/database. They are not Vercel cold starts. The fixture has two clubs, 61 members and 100 submitted applicants per club, no answers/evaluations/active rooms/ballots, and one meeting/task/announcement per club. Desktop Chromium 1440×1000, no mobile throttling, Node 26.9.0 / Next 15.5.27 / React 19.2.0 / Prisma 6.19.3.

The accepted dataset contains **1,200 tab transitions/detail openings: 20 supported paths × cold/warm/repeated × 20 samples**, plus 40 initial authenticated entries and 240 measured original-loader invocations. All corrected final cohorts completed with zero adapter failures. The largest accepted transition was **712.6 ms**; this is a local result, not a production maximum. The structured JSON contains every per-path p50/p95/max, CPU/commit/request/byte distribution, relevant request timings, exclusions and null measurements.

Content timing is a loaded-data DOM predicate plus two animation frames, not screenshot paint timing. Interaction timing checks enabled visible controls without invoking writes. CDP CPU deltas and long tasks are recorded; standard production React render durations are null. Some supplementary passes shared the workstation/overlapped; sequential exact-click representative records are separately identified. Original nonrepresentative request offsets begin at instrumentation arming, not the click; do not use those as exact waterfalls. Corrected supplementary passes capture click-relative clocks. Failed scope/modal/predicate adapters are excluded rather than counted as application latency.

An original-loader probe adds **20 measured + two warm-up invocations per loader**, outside Next's RSC dispatcher, with real local Auth/session SQL/Prisma and adapted framework cookies:

| Loader | SQL/control statements | Auth verifications | Local p50 / p95 | JSON bytes |
|---|---:|---:|---:|---:|
| Overview | 11 | 1 | 24.11 / 37.79 ms | 684 |
| Members | 12 | 1 | 29.01 / 36.17 ms | 36,449 |
| Pipeline | 17 | 1 | 27.10 / 57.60 ms | 193,216 |
| Tasks | 16 | 1 | 23.96 / 50.73 ms | 18,856 |
| Meetings | 4 | 1 | 21.09 / 27.48 ms | 353 |
| Announcements | 6 | 1 | 22.35 / 46.47 ms | 205 |
| Empty voting | 21 | 2 | 47.32 / 85.58 ms | 479 |
| Applicant display | 19 | 1 | 25.35 / 48.63 ms | 1,231 |
| Assigned rooms | 17 | 1 | 23.88 / 63.43 ms | 2 |
| Interview queue / rounds | 13 / 13 | 1 each | 24.83 / 28.72; 25.79 / 68.43 ms | 31 / 112 |
| Room manager | 13 | 1 | 23.99 / 70.05 ms | 5,299 |

Counts include BEGIN/SET/COMMIT and generated relation batches. They are not all necessarily serial network crossings; top-level queries can overlap. Prisma event duration is integer engine telemetry, not full application connection/network attribution. The loader probe does not include middleware, Next dispatch, browser queue/render, support sessions or the production pooler.

## Database conclusions

Read-only `pg_stat_statements` history since September 21 mixes application, historical tests and system/dashboard traffic. **No SQL p95 is available.** Historical Club FOR UPDATE: n=720, mean 405.50 ms, max 8,260.74 ms; Club FOR SHARE: n=12,514, mean 19.88 ms, max 19,092.88 ms; Application FOR UPDATE: n=213, mean 134.21 ms, max 7,259.63 ms. Advisory locking: n=30,312, mean 257.99 ms, max 938.06 ms. These prove long lock acquisition histories, not a specific navigation cause.

Session-live SQL averaged 0.026 ms (n=10,672, max 0.365 ms); a common full User lookup averaged 0.087 ms (n=78,748). A sampled Application relation shape averaged 0.384 ms (n=1,340). Server-side statement execution is generally much smaller than hosted request wall time. Pool acquisition and network are absent from these execution numbers.

The first snapshot found no blocked sessions; a later snapshot had four idle-in-transaction postgres sessions without attribution. max_connections=60; track_io_timing=off. Small table estimates and existing club/member/application/round indexes do not justify speculative indexes. Safe nonexecuting plans used a nonexistent UUID, not actual user values; they cannot establish a populated-club plan. No DDL, production EXPLAIN ANALYZE, session termination or statistics reset occurred. [Sanitized DB evidence](evidence/database-readonly.json).

InterviewActor holds Club/User/ClubMember shared locks through its transaction (`utils/interview-access.ts:5`), and assigned-room generation has per-booking reads (`actions/interview-entry.ts:27`). Shared read locks can wait behind publication/admin writes. Batch work/shorten transactions only while proving equivalent revocation/privacy behavior. Members read mode deliberately avoids exclusive organization locks. Voting already uses a read-only repeatable-read snapshot plus a live post-snapshot guard; do not “fix” those protections away.

## Regions, bundles and background activity

The Vercel connector could list the project but its team detail call returned 403. The authenticated browser supplied current region/runtime metrics, so region is not an evidence gap. **Effective deployed Prisma URL/pool mode/connection limit remain gaps.** Source prefers POSTGRES_PRISMA_URL and otherwise DATABASE_URL (`utils/prisma.ts:9`); module scope reuses the client per runtime instance. Local .env used a us-west-2 Supavisor port-5432 URL without explicit pool settings; do not claim those are deployed runtime settings.

Workspace first-load JS is ~510 kB by Next build output, versus 105 kB shared baseline. The common live/Demo boundary in `lib/workspace-api.ts` contributes client logic/proxies; it does not ship Prisma action implementation code. Sample shared chunks containing Demo logic are 55.0/40.5 KB gzip; Supabase client chunk 54.2 KB; deferred PDF chunk 129.3 KB gzip is absent from the initial workspace manifest. Module-level exact attribution/mobile hydration/duplicate-dependency costs remain unmeasured.

ProductShell task polling is 60 s, durable refresh 30 s plus focus and SSE revisions. SSE performs two snapshot queries every 2 s, closes around 45 s and reconnects. A long-lived stream is not one held database transaction; 48 s stream duration is not a 48 s navigation block. Root invitation and support-session checks also react to focus/visibility; shell/switcher/tutorial initialization adds reads on cross-workspace mounts. Durable notifications resolve per-item current authorized context in a transaction. Consolidate/coalesce and batch; preserve live functionality.

## Top ten recommended changes and sequence

1. Add sanitized per-request phase/trace IDs and verify the deployed commit, kind/action, Auth, pool, SQL/network and lock phases of one real slow transition.
2. Defer hidden Scheduling/availability/publication panels until selected, preserving mounted dirty drafts.
3. Deduplicate the assigned-room read and migrate the remaining pure navigation reads to explicit guarded GETs or a narrow Rooms bootstrap; keep writes as actions.
4. Compare an explicitly authorized pdx1 preview to iad1; include browser→function RTT and the actual effective DB pool configuration before any promotion.
5. Start authorized reads and module preload concurrently on bounded navigation intent, reusing the same in-flight result at mount.
6. Add compact pipeline list DTOs, stable server pagination/filter/sort and on-demand applicant detail; tailor Decisions to its group.
7. Page member/invitation history and separate task targeting/review catalogs from first list loads.
8. Extend the existing local resource owner with complete filter/authority keys, in-flight dedupe, generations and explicit mutation invalidation; validate private authority before reuse.
9. Give notifications one session-scoped owner, coalesce timer/focus/SSE bursts, and batch repeated current-context lookups without sacrificing timeliness.
10. Batch interview per-booking lookups and bound voting history; split live/Demo domain bundles; measure mobile/list size before virtualization.

Dependencies and rollout/security acceptance are detailed in [OPTIMIZATION_ROADMAP.md](OPTIMIZATION_ROADMAP.md). Apply transport/hidden-work fixes and region experiments before a broad cache/library rewrite. The arithmetic region sensitivity model is **0.5–1.6 s** for 10–20 effective serial crossings with **assumed**, unmeasured 50–80 ms less overhead each. Three serial requests of duration L can approach max(L) when independent and concurrent. These effects overlap; do not add them into a promised total. No before/after optimization speedup was measured.

## Changes not to make

- Do not trust getSession/JWT metadata alone, remove remote verified identity or live session revocation/not_after checks, or cache a successful authorization across requests/users.
- Do not remove disabled-account, current membership/grant/suspension, anonymous-round, self-review, interview feedback, support-session or post-snapshot voting checks.
- Do not reveal stale protected content merely because its TTL is short. On authority changes, discard/hide resources and late results; distinguish identity metadata reuse from current authorization.
- Do not remove row/advisory locks wholesale, parallelize SQL “inside” one transaction as though it has many connections, or break atomic decisions/outboxes/publication fencing.
- Do not automatically add Redis, SWR/React Query, Edge functions, new indexes, larger function size, a database-region migration or a complete rebuild.
- Do not disable notifications/live updates or add loading animations/delays to improve a benchmark.
- Do not ship diagnostic probes, cookies, JWTs, environment files or raw authenticated traces.

## Still needed

A successful production-like browser/server trace for the exact five-second event; read-kind/action and method splits; deployment SHA; exact production invocation n/p50/max; Vercel→Auth/SQL/network/pool/lock spans; a measured pdx1 comparison; deployed pool settings; active ballots/bookings/large history/multi-university and revoked/support-session cohorts; low-end/mobile hydration and true paint/input metrics. The targets (<150 ms visited p50, <500 ms uncached p50, <800 ms major directory, <1.5 s initial dashboard, <1 s tab p95) remain engineering targets.

## Validation, artifacts and reproduction

The real local production build and **38 local Auth/OTP/MFA/PostgreSQL/HTTP acceptance checks passed with zero failures/skips**. **26 focused navigation/security/reader/harness checks passed**, including two harness percentile/redaction tests. Original loaders executed 240 measured local read invocations. Source was not optimized, so no full application test rerun is claimed beyond the build/setup runner and focused suites.

Primary deliverables: [full audit](OUTCLASS_NAVIGATION_AUDIT.md), [structured benchmarks](NAVIGATION_BENCHMARKS.json), [roadmap](OPTIMIZATION_ROADMAP.md), and this handoff. Exact raw sample/waterfall/loader/bundle/DB/dashboard artifact paths are referenced inside the JSON and report; large arrays are not duplicated here. No PR was created.

Reproduce with the reserved loopback fixture: `node scripts/run-onboarding-e2e.cjs --keep`; then run `node scripts/navigation-audit.cjs --samples=20`, `--only-voting --samples=20`, `--details --samples=20`, `--cross-club --samples=20`, `--initial --samples=20`, `--waterfalls --samples=20` sequentially; run `node scripts/navigation-loader-audit.cjs`. The existing supplemental runner is `node scripts/performance-audit.cjs`. After preserving its sanitized output as `evidence/static-supplement.json`, `node scripts/summarize-navigation-audit.cjs` assembles the report tables/JSON. The audit contains the exact focused test and cleanup details. Never substitute a production account/configuration into these guarded fixture scripts.
