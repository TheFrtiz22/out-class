# OutClass performance improvements

Implemented October 6, 2026 against baseline `3108d80f1a162bd99ebf8b1dbb31c7fa1f9e9a05`. No deployment or production data mutation was performed. [Original audit](performance-audit.md), [before/after evidence](performance-improvements-evidence.json), [measurement runner](/Users/jesseklinger/Documents/out-class/scripts/performance-audit.cjs).

Production browser navigation was blocked by Vercel during the audit. There is no successful production baseline or end-to-end browser comparison here. Timings below are clearly labeled local measurements. For navigation and ownership changes, success means a specific blocking operation was removed, verified by regression tests; no unmeasured production milliseconds are claimed.

## Before / after / difference

| Workflow | Before | After | Improvement |
|---|---|---|---|
| Same-club dashboard tabs | Next route transition plus queued Server Action reads | Native history transition; frequent reads use independent GET requests | Removes the same-route RSC navigation path and Server Action queue barrier. Modified clicks and cross-club links retain normal navigation. |
| Cold Members / Applicants / Settings entry | Browser `/api/users/me` → Overview → selected section loader | Validated identity supplied by server; selected section starts independently | Removes one browser identity request when bootstrap succeeds and the unrelated Overview dependency. Identity/DB work still runs on the server. |
| Members → another tab → Members | Remount loses data; directory response blocks rows | Recent workspace-owned rows render immediately; fresh authorization/data read runs in background | Removes the blocking warm directory reload. Reuse is limited to 30 seconds; stale/access-failure responses clear the resource. |
| Applicants → another tab → Applicants | Pipeline state discarded and reload blocks list | Recent pipeline survives in the scoped parent; background read refreshes it | Removes the blocking warm pipeline reload; account, membership, permission and privacy changes invalidate ownership. |
| Guarded read / Server Action authentication | Middleware and loader both invoke `getUser` | Guarded API/Action owns verification and cookie refresh | Two explicit call sites → one. Middleware demo/support guards remain first. Root/page server-render calls also share request-local verified identity. |
| Applicants: round/application reads | **11.385 ms** controlled median, queries serial | **6.304 ms** controlled median, two independent queries overlap | **−5.081 ms / 44.6%** in the same 5-ms-per-query harness. Not production query latency. |
| Open applicant details | Two same-transaction membership reads; **18.954 ms** controlled median | One transaction membership read; **12.647 ms** controlled median | One redundant read removed; **−6.307 ms / 33.3%** in the controlled harness. The initial permission guard and transaction recheck remain. |
| Members: 500 invitation base rows | **311,785 JSON bytes** | **98,285 JSON bytes** | **−213,500 bytes / 68.5%** for the synthetic base projection; relation/wire/HTTP encoding bytes are not included. |
| Discover: attach 5,000 events to 250 clubs | **7.929 ms** local median; filter all events per club | **1.913 ms** local median; group once by club | **−6.016 ms / 75.9%** local CPU; preserves event ordering and all records. |
| Direct club profile | Public server page waits on private dashboard loader; **6.335 ms** controlled median | Public server page does not invoke that loader; **0.007 ms** controlled median | One private loader removed from page critical path; private calendar/application data loads after rendering. **−6.328 ms** in the controlled harness, not actual profile response time. |
| CSV: 500 new members | 5,500 live identity/account candidate checks across preview/batches; 222 confirmation ORM/raw calls; **13.332 ms** single local sample | 1,000 candidate checks; 212 confirmation ORM/raw calls; **9.856 ms** single local sample | **−4,500 checks / 81.8%; −10 confirmation calls.** The single CPU sample is supporting evidence, not a statistical production speed claim. |
| Advanced self-permission save | Two directory reads and potentially two identity refreshes | Parent owns one directory read and one identity refresh | Removes one directory read and one duplicate identity refresh from the completion chain. |
| Ordinary role change | Label waits for mutation response | Immediate ordinary-role label, with rollback on rejection | Removes mutation waiting from label feedback; ownership/self changes remain authoritative. Completion still waits for the server and refresh. |
| Send / resend invitations | Durable queue, background SMTP | Same durable queue, background SMTP | Unchanged: no synchronous email operation was present to remove. Idempotency, cooldowns and uncertain-delivery handling remain. |

Controlled query/page measurements use 2 warmups + 10 timed samples with 5 ms injected into each mock dependency. Discover CPU uses 3 warmups + 10 samples of the actual loader with immediate mock database results. CSV timings execute the actual action code with existing hermetic fixtures and are single samples. Payload size uses an isolated PGlite database with all 26 repository migrations. These are not deployed Vercel/Supabase/SMTP measurements.

The nominal `Promise.all` inside the member read transaction was corrected, but **no database parallelism or speedup is claimed**: Prisma interactive transactions still execute SQL on one connection. The JavaScript-only mock can overlap promises and therefore cannot establish transaction SQL latency.

## Implementation, in priority order

1. **Read transport and navigation.** [Workspace read route](/Users/jesseklinger/Documents/out-class/app/api/workspace/route.ts) explicitly permits only known readers and delegates to their existing server loaders. Each private reader retains its authentication/authorization. [Client read transport](/Users/jesseklinger/Documents/out-class/lib/workspace-read.ts) uses uncached, same-origin GETs rather than the browser's Server Action queue. Reads include overview, members, applicants, rounds, configuration, applicant display/attendance and the global invitation/Corkboard/tutorial/task notification providers. Writes continue to use Server Actions. Same-club sidebar/mobile links use [native history](/Users/jesseklinger/Documents/out-class/lib/workspace-navigation.ts); `useSearchParams` now owns the selected club section. Redundant RSC prefetch for those query-only links is disabled.
2. **Authentication and bootstrap.** Middleware still runs demo/support guards before delegating session refresh to handlers that own authentication. It does not forward or trust a client-provided identity. `getSessionUser` uses React request-local memoization across server-render callers; DB permissions are not memoized. Root supplies [validated current-user data](/Users/jesseklinger/Documents/out-class/utils/current-user.ts), eliminating the successful bootstrap's hydration-dependent identity request. Concurrent identity refreshes coalesce; generation checks prevent old-account replies from replacing a new bootstrap or demo perspective. Private read/identity responses declare `Cache-Control: private, no-store` and `Vary: Cookie`.
3. **Workspace ownership.** [ClubWorkspace](/Users/jesseklinger/Documents/out-class/components/club-workspace.tsx) owns recent member/pipeline snapshots. Their key includes live/demo mode, user, club, membership, access role, permissions, interview offices, application/pipeline versions and privacy revision. They are component state, never module-global, persistent browser storage or a cross-request server cache. Warm mounts still revalidate; errors clear retained data; late replies from an old scope are ignored. Overview is loaded only by views that need overview data. Forms/imports continue to unmount on section changes, preserving existing unsaved-change behavior.
4. **Independent operations / duplicate readers.** Round and application queries run in parallel outside a transaction. Applicant display reuses the membership already validated inside its repeatable-read transaction instead of querying it twice. Permission editors delegate refresh to their parent where one is provided; standalone editors retain their own refresh behavior. Self-access changes still refresh identity.
5. **High-frequency query payloads.** Member-directory invitations select only the scalar fields actually used by that interface, plus identifier and latest delivery status. Discover builds an event map once rather than scanning every event per club. No speculative index was added: current lookup indexes already exist, and the audit's local plans did not establish an index bottleneck.
6. **CSV bulk work.** Preview explicitly requests nested `createMany`. Confirmation retains 50-row resumable transactions, club locks, savepoints, audits and scoped invitation bulk inserts. It rechecks live identities/accounts/invitations only for the selected batch, and checks memberships only for matched user IDs. The complete immutable file is still validated in memory every batch so cross-batch duplicate and changed-normalization behavior remains correct. No recipient User or membership is created and no import sends email automatically.
7. **Public profile / feedback.** Optional private dashboard data loads after the public page renders, under its own identity scope. Ordinary other-member role labels update optimistically and roll back on rejected grants; client optimism never grants server authority. Existing SMTP outbox delivery remains outside the response path.

## CSV operation comparison

All-new, no-expiry/no-error fixture. Counts are action-level ORM/raw calls, **not exact SQL statements or network round trips**. Authentication internals, transaction BEGIN/COMMIT, generated relation SQL and final directory refresh are excluded.

| Rows | Before confirmation calls | After confirmation calls | Before DB candidate rows checked, including preview | After DB candidate rows checked | Confirmation actions |
|---:|---:|---:|---:|---:|---:|
| 10 | 24 | 23 | 20 | 20 | 1 |
| 50 | 24 | 23 | 100 | 100 | 1 |
| 100 | 46 | 44 | 300 | 200 | 2 |
| 500 | 222 | 212 | 5,500 | 1,000 | 10 |

Preview adds 12 calls before and 11 afterward, making total application-level counts 36→34, 36→34, 58→55 and 234→223. Membership lookups are skipped only when no candidate matches an existing account/identity. Matched users still receive the live scoped active-membership check.

Explicit `createMany` establishes the preview bulk-write contract. No generated Prisma SQL was captured, so **no 500-insert-to-one-insert performance claim is made**; Prisma may already have coalesced some original nested creates. Existing row/foreign-key triggers still run for every record. Full roster/outcome reads per batch remain; this change reduces live candidate queries without changing durable outcome/duplicate semantics.

## Validation and practical limits

- Typecheck: passed.
- Lint: passed, zero errors; 26 pre-existing warnings remain (baseline had 27).
- Full test suite: 670 passed, zero failures; five existing environment-dependent tests skipped.
- Migration checks: all 26 migrations applied to fresh and legacy local databases; all 50 tables retain RLS and deny browser-role CRUD.
- Production build: passed with type/lint checks enabled. No build checks were bypassed.
- New regressions cover private response isolation, date preservation, input allowlisting, independent fetches, bootstrap request removal, request-local identity reuse with live membership checks, stale identity replies, preserved middleware guards, local/cross-club navigation, workspace scope changes, warm revalidation failures, consolidated permission refresh, optimistic rollback and changed CSV normalization across batches.

No application-schema, RLS, grant, invitation-token or SMTP lifecycle change was made. Dependency installation was restored from the unchanged lockfile and Prisma Client regenerated to resolve stale local generated types before validation.

Large member/applicant collections still load as collections; server pagination and a minimal-applicant-list/detail redesign are not included. Existing filtering, bulk selection and full inline applicant review retain their behavior. Shared client bundle weight and React commit costs remain unmeasured; no blanket memoization or unverified bundle/index optimization was added. Root middleware's refresh remains on document/RSC paths where server components cannot persist refreshed cookies themselves. Thus this change does not claim that every authentication call in every route was removed.

Reproduce current local measurements:

```sh
node scripts/performance-audit.cjs > /tmp/outclass-performance-after.json
node scripts/performance-audit.cjs --profile-only
node scripts/performance-audit.cjs --directory-only
node scripts/performance-audit.cjs --applicant-only
```

The evidence artifact preserves baselines captured before each corresponding implementation change. The runner reads current source; checkout the recorded baseline revision and use compatible fixture adapters to regenerate historical comparisons. Actual first/warm browser timings, auth network counts and deployed database query durations still require a successful authenticated environment.
