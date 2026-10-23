# OutClass navigation optimization roadmap

Audit date: October 21, 2026. **Proposals only. No optimization, deployment, schema change or production-record change was performed.** Read [the audit](OUTCLASS_NAVIGATION_AUDIT.md) and [benchmark data](NAVIGATION_BENCHMARKS.json) before estimating a release. Source baseline: `3017e01d5b55bc8fb38d4f8fbec4906dd93bf619`.

## Implementation order and acceptance contract

1. Add bounded phase measurements and confirm an exact deployed commit/request cohort.
2. Remove hidden interview work and duplicate assigned-room reads.
3. Move remaining navigation reads off the client Server Action queue, preserving the original guards.
4. Run a controlled `pdx1` preview comparison against `iad1`, using the same Supabase region and fixtures.
5. Start authorized tab reads alongside intent-based code loading; retain appropriate clean UI state.
6. Shrink pipeline/directory payloads and SQL round trips.
7. Consolidate background refresh ownership and reduce redundant polling work.
8. Reassess large-list rendering and bundle boundaries after the preceding changes.

Each change should have its own before/after measurement on the same fixtures/build/browser. Collect click→useful content, interaction readiness, request count, bytes and server phases. Do not add fixed loading delays or animation masks. Keep the five engineering targets from the audit as targets, not promises.

For every private read, retain remotely verified identity, live `auth.sessions` revocation/expiry validation, enabled-account checks, current club membership/capabilities, suspension/privacy projection, and support-session restrictions. Recheck authority after lock waits and where the existing snapshot-release boundary requires it. A cache hit cannot replace these decisions. Include revoked-session, changed-membership, anonymous-round, overlapping-club and support-session cases in acceptance tests.

## Level 1 — quick wins

### 1. Stop mounting the unused interview scheduler

**Evidence:** `components/interview-management-tabs.tsx:41` force-mounts Scheduling even while Rooms is selected. `components/interviews/room-manager.tsx:54`, `:83`, `:90`, `:107` and `:108` initiate room, assigned-room, staffing, booking-publication and hidden availability work. A cold Applicants→Interviews visit generated 13 requests; warm visits still generated eight. Three visible-room reads precede additional scheduler actions.

**Proposal:** Mount Scheduling on its first actual selection. Retain it only while a scheduling editor/draft needs continuity. Mount availability/booking panels on demand within Scheduling. Share the assigned-room resource between visible Rooms and Scheduling with an identical authority scope and in-flight deduplication.

**Impact:** Remove the five scheduler-related requests observed on the Rooms path, including the second identical assigned-room action. These are mostly after the first visible room result in the settled local test, so distinguish reduced background work/backlog from immediate content latency. A rapid next navigation can otherwise queue behind them.

**Effort/risk:** Small–medium; preserve draft/autosave, back/forward, round/week/session bookmarks, visibility refresh and live interview updates. Do not unmount an active dirty scheduler or remove the existing assignment checks.

### 2. Replace pure read Server Action transports selectively

**Evidence:** `InterviewRoomsList` issues `Promise.all` at `:36`, but browser requests for `getAssignedInterviewRooms`, `getInterviewWorkspace` and `getInterviewRounds` are sequential. Tasks, Meetings and Announcements still use action transports through `lib/workspace-api.ts:390`, its meetings adapters, and direct communications imports. The installed Next action queue also serializes synthetic reducers in the existing audit harness.

**Proposal:** Add explicit GET allowlist entries for those read loaders, following `/api/workspace`. First test three independent requests concurrently; consider a narrow Rooms bootstrap that performs common identity verification once and returns only the visible projection. Keep mutations as Server Actions. Do not expose arbitrary action dispatch.

**Impact assumption:** If three independent read requests each take `L`, a serialized path costs approximately `3L`; a concurrent path approaches the longest request, subject to pool capacity. This is a model, not a measured production speedup. Combining a guard and projection can also remove duplicate work. Avoid a single huge endpoint that reunites hidden scheduler data with Rooms.

**Effort/risk:** Medium. Preserve allowlist validation, private/no-store and `Vary: Cookie`, error classification, Demo isolation, cookie refresh and per-read authorization. Concurrency can increase connection demand; bound it and measure acquisition time.

### 3. Remove avoidable code→mount→effect delay

**Evidence:** Cold Members, Tasks, Announcements and Applicants load dynamic chunks before a mount effect can initiate their data request. In the first Members sample the chunk finished well before the read started; React's installed production scheduler contains a 300 ms fallback retry threshold. Warm visits remove the chunk/fallback path.

**Proposal:** Begin the *authorized data request* and the component preload on explicit navigation intent, with one owner for the result. Reuse the in-flight promise when the component mounts. Limit prefetch to accessible destinations, cap concurrency and suppress bulk hover prefetching. Measure keyboard, pointer and touch paths. Do not modify React internals or replace the entire router.

**Impact:** Approximately the observed code-to-effect gap can be removed on those cold paths if the same retry/mount sequence is avoided; no guaranteed 300 ms saving on every device or route. Keep code splitting for large tools.

**Effort/risk:** Medium. Discard responses after account/session/club/grant/privacy scope changes. Aborting or ignoring a client result is not server cancellation. Prefetching must not execute writes, create interview sessions or reveal unauthorized fields.

### 4. Deduplicate existing refresh owners

**Evidence:** Members and Pipeline have parent-retained data but unconditional mount revalidation. Notifications have mount + focus + timer refreshes; SSE emits an initial revision that can immediately repeat the durable-notification action. Hidden interview components duplicate assigned-room reads.

**Proposal:** Share in-flight reads by complete authority/resource key; coalesce SSE/focus/timer bursts. Use a monotonic invalidation generation so pre-mutation responses cannot overwrite post-mutation data. Reuse `serializedWorkspaceRead` semantics where appropriate.

**Impact:** Remove redundant requests and action-queue contention. Cached Members already render quickly locally, so its first gain is fewer requests and less contention, not a speculative large rendering speedup.

**Effort/risk:** Medium. Never merge requests across accounts/support sessions or silently suppress important live updates. Revocation/account disablement must invalidate private resources immediately when learned; opening a private cached tab requires live authority validation if the current security contract requires immediate revocation.

## Level 2 — architectural optimizations

### 5. Compare functions beside the database

**Evidence:** Current Vercel settings and production telemetry show `iad1`; Supabase metadata shows `us-west-2`. API function duration averages 1.46 s while active CPU averages 123 ms; workspace route duration averages 2.33 s while active CPU averages 76 ms. The dashboard shows 290 ms Supabase external-API latency, without a precise statistic label. Local loaders require 4–21 SQL/control statements and one or two provider verifications.

**Proposal:** Deploy an explicitly authorized diagnostic preview in `pdx1` and compare the same guarded requests to `iad1`, including Auth, Prisma pool acquisition, each SQL span, cold/hot function startup, server rendering and browser latency. No database migration is needed for the experiment. Confirm effective deployment region, not only project settings. Production promotion is a later separate decision.

**Impact model:** Reducing a serial round-trip component by 50–80 ms across 10–20 effective serial crossings saves roughly 0.5–1.6 s. Effective crossings are fewer than raw SQL count when queries overlap. This is a sensitivity range, not measured RTT or a promised improvement. East-coast users also pay a browser→west-function hop; compare the total path, including long-lived streams.

**Effort/risk:** Small configuration experiment, medium validation. Do not move Supabase, add Edge functions, or change production regions during this audit. Verify runtime environment parity and provider limits before rollout.

### 6. Shrink the pipeline list contract before adding a cache

**Evidence:** `actions/crm.ts:54` includes student/profile/experiences, answers/questions, evaluations, assignments/members, bookings/slots and round rows for the entire submitted pipeline. The 100-applicant fixture produces approximately 193 KB ordinary JSON and 201 KB workspace wire data, even with no answers or evaluation history. The real Prisma read emits 17 SQL/control statements including authentication in the local loader probe.

**Proposal:** Define a compact list projection plus aggregates and a separate detail contract. Move filters/sort/pagination to the server with stable cursor ordering and explicit permission/privacy projection. Keep counts consistent with filters. Fetch academic details, answer bodies, observations and interview evidence when the corresponding authorized panel opens. Decisions should request their required outcome group, instead of loading all applications and filtering client-side.

**Impact:** Lower relation work, serialization, transfer, JSON decoding and client sorting. Payload should grow with page size, not total applicants. Measure 100/1,000/5,000 applicants, multiple rounds and real historical relations before choosing a page size. A linear 10× payload extrapolation is a capacity warning, not a measured 1,000-applicant timing.

**Effort/risk:** Medium–large. Preserve anonymous labels, withheld free text, gender visibility, self-review exclusions, private feedback, quick-review sequencing and optimistic concurrency. Avoid list/detail permission divergence.

### 7. Improve directory and task query boundaries

**Evidence:** Member UI pagination still fetches every membership and invitation/history projection (`actions/organization-members.ts:120`). `Promise.all` inside its interactive transaction still uses one database connection. Task workspace loads all task assignments and the member targeting catalog before returning (`actions/tasks.ts:108`).

**Proposal:** Page/search active memberships server-side; fetch invitation history when opened; preserve bulk selection by stable server IDs and explicit filter semantics. Separate task list/summary from assignment review and targeting catalogs. Trim repeated relation projections. Keep transactional authority checks where required and retain appropriate consistency; benchmark a scoped SQL/join projection versus Prisma relation batches.

Tailor overview projections to their actual cards: `actions/club-overview.ts:13` waits for meeting/work/review counts that RecruitingOverview does not consume. A mode-specific projection can remove that work without caching an authorization result.

**Impact:** Less payload and fewer serial relation statements on large clubs. Existing indexes already cover common club/member/application lookups; do not create a speculative index batch. Benchmark candidate plans on representative distributions first.

**Effort/risk:** Medium–large. Preserve last-owner, disabled-account, membership-history and bulk-write fencing semantics. A shared connection cannot execute independent SQL concurrently just because JavaScript uses `Promise.all`.

### 8. Evolve the lightweight resource cache with an authority contract

**Evidence:** `ClubWorkspace` already retains Members/Pipeline for 30 seconds under a user/club/grant/version/privacy key. Other section keys intentionally discard local state. Settings retains visited panels under a narrower authorization key. No React Query/SWR dependency exists.

**Proposal:** Prefer extending the existing resource owner first: canonical query keys (including filters), in-flight deduplication, explicit invalidation after writes, response-generation fencing and identity/support-session authority epochs. Retain only clean view state or bounded resources. For sensitive cached content, obtain a fresh authorized scope/version response before revealing it after navigation; optionally reuse bytes with an application-managed validator after that check. Keep private HTTP responses non-public.

**Comparison:** A library would help retries, cancellation plumbing, observer lifecycles and devtools once the number of resources becomes hard to maintain. It cannot solve authorization, query shape, cross-region RTT or the action queue by itself. Add one only after a small proof demonstrates a maintenance/measurement benefit over this owner. Neither global indefinite caching nor retaining all large tabs is justified.

**Effort/risk:** Medium. Keys must distinguish live/Demo, real/effective user, session authority, support session, club, capabilities, interview grants, privacy/display versions and filters. TTL alone does not provide revocation safety. Do not turn an intentional post-snapshot voting recheck into a stale cached authorization result.

### 9. Consolidate notification ownership without losing timeliness

**Evidence:** ProductShell polls tasks every 60 s, durable notifications every 30 s, reacts to focus and opens an SSE stream. SSE polls two database statements every two seconds, reconnects after roughly 45 s and emits an initial revision. Shell remounts on cross-club/personal transitions repeat initialization. Durable notification projection can perform per-notification context queries in an interactive transaction (`actions/communications.ts:61`).

**Proposal:** One session/authority-scoped refresh coordinator above transient shells; share unread/revision state and coalesce event bursts. Skip unchanged projections when a revision has not changed. Batch repeated current-context checks, including booking/panel/availability contexts, while preserving fresh grants. Evaluate hidden-tab stream behavior and a measured fallback cadence before changing intervals.

**Impact:** Fewer repeated identity checks, action queue entries and pooled reads. One continuously active stream currently implies about 60 SQL statements/minute for snapshots, plus reconnect authentication and other refreshes; scale this model by simultaneous tabs/users. The 48 s stream duration in Vercel is connection lifetime, not 48 s of blocked navigation or a held DB transaction.

**Effort/risk:** Medium. Preserve notifications, explicit refreshes, reconnect recovery and current-access content projection. Do not disable SSE or notification functionality merely to improve a benchmark.

## Level 3 — scalability and later work

### 10. Bound interview/voting projections and frontend cost

**Evidence:** Assigned-room reads include per-booking assignment, panel, record and colleague queries (`actions/interview-entry.ts:27`). Voting includes candidates, all passes and ballots (`actions/voting.ts:15`, `:45`). Applicant tables filter/sort full arrays. Workspace build reports about 510 kB first-load JS, and the common live/Demo adapter remains broad.

**Proposal:** Batch assigned-room lookups by booking/application/member, keeping authorization on each returned row. Separate voting session summary/current candidate from historical passes and ballots. Preserve the read-only consistent voting snapshot and post-snapshot live authorization. Split live/Demo adapters by domain without weakening the Demo mutation boundary. Measure low-end/mobile parse, hydration and list scrolling before introducing virtualization; paginate first. Treat PDF code as on-demand where the existing split already works.

**Capacity tests:** Larger memberships and multiple universities must keep school/club keys in queries and caches. Thousands of applications need stable server pagination and bounded list DTOs. Concurrent scheduling/voting needs connection-acquisition, transaction-duration and lock-wait budgets; multiple clubs should progress independently. Notification volume needs batched context projection and an observable refresh budget.

**Impact/risk:** Medium–large work; measured scalability protection rather than a supported claim of seconds saved today. Do not replace transactions or remove row/advisory locks wholesale. For any read-lock reduction, prove equal disablement/revocation/privacy behavior with disposable PostgreSQL concurrency tests. Keep atomic decisions, idempotent publication and durable outboxes.

## Required measurements before rollout

- Correlated production-like browser and server trace for a reported five-second transition, including the exact read kind or action and deployed commit.
- Effective Prisma production endpoint/pool mode and `connection_limit`/timeouts, obtained through an approved redacted configuration read; no secrets in evidence.
- Vercel→Supabase Auth and DB spans by region, pool acquisition versus execution, and lock waits for the same request.
- Rapid tab switching while earlier noncritical actions remain pending; hidden scheduler enabled versus proposed deferred version.
- Active interviews, real ballot histories, larger invitation directories, multiple tabs, revoked sessions/grants and support sessions.
- Target mobile device CPU/hydration and field click→content telemetry. Commit counts alone are not React render durations.

No Redis, Edge migration, new cache library, database-region move, schema/index deployment, broad rewrite or larger function size is justified as an automatic first step by this evidence.
