# OutClass Performance Audit

Audit date: October 6, 2026 (America/New_York). Source revision: `3108d80f1a162bd99ebf8b1dbb31c7fa1f9e9a05` plus the working tree as inspected. No application optimization, refactor, UI change, migration, deployment, import, invitation send, or permission mutation was performed.

Evidence labels used throughout:

- **OBSERVED**: directly present in the inspected implementation or browser UI. This proves structure or behavior, not its production latency.
- **MEASURED**: measured during this audit; the environment and scope are specified.
- **INFERRED**: a latency consequence of an observed mechanism, awaiting end-to-end measurement.
- **POSSIBLE**: a hypothesis requiring additional evidence.

Production navigation could not be timed successfully. The already-open authenticated workspace displayed its Overview, but clicking Members returned Vercel's `403 FORBIDDEN / This request was blocked`. Returning to the original URL also returned 403. Public HTTP probes returned 403 as well. These are access-failure observations, not measurements of OutClass application performance. Local environment variables point to a remote Supabase database; no localhost Postgres listener was available and Docker's daemon was unavailable. A final remote measurement attempt failed at Prisma initialization before returning database results. All successful SQL experiments below used an isolated, in-memory PGlite database with synthetic records and the current repository migration stack. Three read-only probes of the configured Supabase Auth settings endpoint did succeed; their separate dependency timings appear in §10. No production EXPLAIN was run. The deployed source, schema, database role, SMTP provider, and regions were not independently verified.

Deliverables: this report; [raw measurement evidence](performance-audit-evidence.json); [standalone audit runner](/Users/jesseklinger/Documents/out-class/scripts/performance-audit.cjs). The runner does not load environment files or instantiate live Prisma, Supabase, or email clients. It executes original action code with mocks for operation counts, and SQL equivalents against PGlite for local query plans.

## 1. Executive Summary

The five strongest latency mechanisms found are below. Their production impact ranking is provisional; **none is claimed to be a measured production bottleneck**.

| Finding | Evidence | Why it can affect perceived speed |
|---|---|---|
| Independent browser reads use the Next Server Action queue | OBSERVED in installed Next 15.5.26; MEASURED scheduling test runs one reducer at a time; configured Auth settings request measured 149.888–718.702 ms | Overview, members, applicants, invitations, Corkboard, task notifications and tutorials use the same queue. A slow action can delay unrelated queued reads. Invitation discovery also calls Supabase's uncached Auth settings endpoint. Actual invitation action/queue duration was not measured. |
| Warm dashboard navigation discards section data | OBSERVED keyed section subtree and mount-time effects | Members → another section → Members reconstructs the directory and fetches it again. Applicants does the same. Cached JS and a persistent outer shell do not retain these data results. |
| Auth and identity are repeatedly requested across boundaries | OBSERVED middleware `getUser`, action `requireAuth`, root auth, client `/api/users/me` | Each ordinary authenticated action incurs middleware auth and action auth, then a Prisma account lookup. Cold entry also gates workspace loading on client identity despite root session detection. |
| Members and Applicants load unbounded collections | OBSERVED queries; MEASURED synthetic member/invitation base rows serialize to 467,070 JSON bytes for 500 of each | Members paginates only after loading all records. Applicants includes profiles, experiences, answers, evaluations and bookings for the entire club. Repeated fetches repeat that work. Actual live payload sizes are unknown. |
| Large imports require sequential batches that repeatedly inspect the entire upload | MEASURED 500 new rows: 10 confirmation actions, 222 action-level DB calls; OBSERVED full reclassification each batch | The normal write path is already batched. Remaining overhead comes from repeated authorization, full-upload reads/classification and synchronous transaction completion. This is independent of email. |

Two suspected explanations are unsupported by this audit: CSV parsing was sub-millisecond for the tested 500-row input, and SMTP delivery is outside the usual send-button response path. Existing indexes already cover many of the obvious lookup patterns. Do not begin with blanket memoization, more caching, or speculative index additions.

### Architecture map

**OBSERVED:** `package.json` and installed packages agree on Next **15.5.26**, React **19.2.0**, Prisma Client **6.19.3**. This is the **App Router**; no Pages Router tree was found. Vercel Git integration is described in `.github/workflows/deploy.yml`; `vercel.json` schedules the invitation worker once a minute. The obsolete `out/` export is not the current runtime architecture.

| Layer | Structure and data responsibility |
|---|---|
| Root server layout | `app/layout.tsx`: cookies, optional support-view resolution, Supabase `getUser`, optional demo template. Supplies session booleans, **not the populated identity**, to client providers. |
| Root client providers | DemoDataProvider → AuthProvider → OrganizationInvitationsProvider → CorkboardProvider → ClubCustomizationProvider. Auth loads `/api/users/me`; invitation and Corkboard reads start when identity becomes available. Customization uses localStorage, not the database. |
| Student dashboard | Server `app/page.tsx` loads student dashboard data and onboarding presence; client `HomeEntry` dynamically loads `AppShell`; `DashboardLayout` uses `ProductShell`. Student views share `/?workspace=student&view=…`. |
| Club dashboard | Server `app/club/[clubId]/workspace/page.tsx` passes query parameters to client `ClubWorkspace` inside `AuthSessionBoundary`. **There is no club/dashboard Next layout.** `ClubWorkspace` and `ProductShell` are shared client components. |
| Shared club data | `getClubWorkspaceOverview` authorizes membership then fetches club summary, next meeting, up to five own outstanding task assignments, review count and application status counts. It gates every section on initial club entry. |
| Section data | Members → `OrganizationMemberManagement`; Applicants → `LiveLeaderWorkspace`; Settings → `ClubSettingsWorkspace`, whose general profile reuses `useAuth().memberships[].club`. Application/pipeline/interview settings have separate loaders. |
| Public/discover | Discover is client `ExploreView`; directory data is a Server Action with 60-second cached club metadata and live event reads. A card opens an already-loaded club inline. Direct `/club/[clubId]` is a separate server page plus client `PublicClubPage`. |
| Server boundary | Business operations are predominantly `actions/*.ts` with `"use server"`. `lib/workspace-api.ts` adapts those operations for demo mode; it is not a data cache or HTTP API client library. |
| Data/services | Supabase SSR/browser SDKs provide authentication and Storage capabilities. Core business tables are read through Prisma → Postgres/pooler. No Supabase `.from(table)` reads, React Query, or SWR were found in the audited paths. Live voting uses polling/BroadcastChannel; no Supabase realtime subscription was found in these flows. |
| Email | `utils/email.ts` uses Nodemailer over configured SMTP. No direct Resend API/SDK integration was found. Whether Resend supplies deployed SMTP is unknown. |
| Loading/routes | Only `app/loading.tsx` is a loading file; layouts are root and design-system. No route templates were found. The main workspace has no section-local server Suspense boundary. A separate interview-booking route uses Suspense. |

Route groups in the current tree: `/`; `/club/[clubId]`, `/workspace`, `/tasks`; `/club-access/[clubId]`, `/club-claims/[clubId]`, `/invitations/[id]`; `/settings/organizations`; `/saved-clubs`, `/corkboard`; `/meetings`, `/meetings/[id]`, `/check-in`; `/interviews`, `/interviews/book`, `/decisions`; `/live-voting`, `/vote`, `/voting/[sessionId]/join`; `/platform` with login/claims/events/view-as; login/recovery routes; preview/design-system. `/interviews` and `/decisions` redirect into the student status URL. API handlers: `/api/users/me`, demo, password recovery, platform view-as/blocked, resumes, recruiting resumes, interview resumes, application attachments, event flyers, internal invitation delivery; `/auth/callback` is also a route handler.

Source anchors: [root layout](/Users/jesseklinger/Documents/out-class/app/layout.tsx:53), [club route](/Users/jesseklinger/Documents/out-class/app/club/[clubId]/workspace/page.tsx:1), [client workspace](/Users/jesseklinger/Documents/out-class/components/club-workspace.tsx:78), [overview loader](/Users/jesseklinger/Documents/out-class/actions/club-overview.ts:6), [auth provider](/Users/jesseklinger/Documents/out-class/contexts/auth-context.tsx:35), [identity API](/Users/jesseklinger/Documents/out-class/app/api/users/me/route.ts:10).

## 2. Dashboard Navigation Trace

### Common cold-entry path

```text
Browser GET /club/:id/workspace
  → middleware → Supabase Auth getUser
  → RootLayout → cookies + separate Auth getUser
  → server workspace page → AuthSessionBoundary + client ClubWorkspace
  → hydration → AuthProvider effect → GET /api/users/me
      → middleware Auth getUser → requireAuth Auth getUser
      → Prisma User.findUnique → User.findUnique with profile/applications/memberships/clubs
  → populated Auth context → boundary releases workspace
  → selectClub synchronization if current selection differs
  → ClubWorkspace effect → getClubWorkspaceOverview Server Action POST
      → middleware Auth → requireAuth Auth → User lookup → ClubMember lookup
      → parallel nontransactional club/meeting/task/count queries
  → setData → selected section mounts → its own loader (if any)
  → response → section state update → React render
```

Invitation discovery, Corkboard, task notifications and tutorial loaders also start around identity/workspace mount. Their exact effect order was not captured in a successful live trace. They use the same client Server Action queue. The identity API is ordinary `fetch`, so it is outside that queue.

### A — Club dashboard → Members

```text
Browser Next Link /workspace?section=members
  → App Router RSC navigation/prefetch-cache lookup
  → middleware auth if a server request is needed
  → workspace page receives section=members
  → same-club ClubWorkspace state normally preserved
  → keyed section changes → previous child unmounts
  → dynamic ClubMembers chunk if not already loaded
  → ClubMembers live branch → OrganizationMemberManagement mounts
  → useEffect → getOrganizationMemberManagement Server Action POST
  → middleware getUser → requireAuth getUser → Prisma User account lookup
  → interactive transaction:
      account disabledAt → actor ClubMember → club schoolId
      → all members + brief user profiles
      → all invitations + identity + latest delivery
      → identifier types
  → commit → return Directory → setData, loading=false → filter/page rows → render
```

The live branch is important: `ClubMembers` returns `OrganizationMemberManagement`; its older `getClubAccess/getClubMembers` loading effect does not execute in live mode. Counting both would invent duplicate reads. The new directory is the active Members implementation.

### B — Members → another dashboard section → Members again

The outer club workspace and root providers normally persist for same-club navigation. The `<section key={`${section}:${active}`}>` is replaced on every section/tool change. Its directory state, filters and importer state are discarded. Returning mounts a new `OrganizationMemberManagement` and repeats A's Server Action transaction. **OBSERVED:** no reusable session cache owns this directory. **INFERRED:** warm visits still wait for auth and directory reads, even with warm JS/RSC caches. Switching to Settings → Members creates a second directory instance; revisiting that Settings subtab retains it while the outer Settings section stays mounted.

### C — Club dashboard → Applicants

```text
Browser Link /workspace?section=recruitment&tool=applicants
  → App Router → server workspace page → keyed section replacement
  → dynamic LiveLeaderWorkspace → selected membership's ClubWorkspace mounts
  → effect → workspace-api.getClubPipeline → actions/crm.getClubPipeline POST
  → middleware getUser → requireClubPermission → auth + User + membership
  → PipelineRound.findMany (active rounds, ordered)
  → Application.findMany (all nondrafts, permission-dependent anonymous-round filter)
      includes round, student/profile/experiences, evaluations, answers/questions, bookings/slots
  → anonymity projection → response → setData + loading=false
  → client filter/sort → list or Kanban
```

Opening a candidate additionally mounts attendance summary and, when permitted, applicant display. These issue separate actions and auth checks. Display rereads the candidate graph already fetched by the pipeline, then observations. Closing and opening a candidate remounts those details. This is per-open work, not an N+1 action for every row of the initial list.

### D — Club dashboard → Club Settings

```text
Next Link /workspace?section=settings
  → App Router → server route props → keyed section replacement
  → ClubSettingsWorkspace → current membership's full Club from AuthProvider
  → default permitted setting (normally General for owner/admin)
  → ClubProfileSettings → profileDraft → ClubProfileEditor renders
```

General Settings has **no initial settings action** of its own. Direct cold entry still waits for identity and overview. Application/pipeline subtabs lazily fetch their own configurations. Settings uses `pushState` and `prefetch={false}` for ordinary same-section subtab clicks, remembers visited subtabs and keeps them mounted in hidden containers. Revisits within that Settings instance generally reuse subtab state. Permission-limited users may default to another available subtab and therefore invoke that subtab's loader.

### E — Discover → open club profile

```text
Enter Discover → ExploreView mounts → getClubDirectory Server Action
  → middleware auth refresh (even though action is public)
  → cached discoverable Club metadata read (database on cache miss)
  → live public Event query for the returned club IDs
  → attach events + project DirectoryClub → response → clubs state
Click DiscoveryCard → setSelected(the already-loaded club)
  → inline ClubProfileView renders → no getPublicClub request or route navigation
```

Direct public-profile navigation differs:

```text
GET /club/:id → middleware + root auth
  → metadata getPublicClubSeo: Club id/slug lookup
  → page getPublicClub: separate Club id/slug lookup + rounds/questions/events
  → page Auth getUser
  → if logged in, getStudentDashboardData → Auth + User + applications/attendances/meetings
  → PublicClubPage + ApplicationStateProvider → profile renders
  → root AuthProvider still fetches populated /api/users/me on hydration
```

Thus a logged-in direct profile request blocks on student dashboard data; inline Discover opening does not. Returning from `PublicClubPage` uses `window.location.href` in some paths and causes a document navigation. Do not attribute that behavior to club dashboard tabs.

### Navigation answers

| Question | Answer supported by source |
|---|---|
| Entire document reload on dashboard tabs? | Normal paths use Next Link/router navigation; no explicit full reload. Successful live document-vs-RSC behavior remains unmeasured because of 403. Full reloads do exist for sign-out/demo toggling and some public-profile exits. |
| Dashboard layout remount? | There is no dashboard Next layout. Root layout normally persists. Same-club client shell normally reconciles in place; keyed **section children deliberately remount**. Club switches change the club key. |
| Auth checked again? | Any new RSC/action/API request runs middleware. Authenticated actions also call `requireAuth`. Native-history student/settings transitions without server reads do not themselves call auth. |
| Current club fetched again? | Overview effect excludes section/tool, so normally not on every same-club tab switch. Members separately reads club schoolId; configurations may read club fields. Leaving/reentering the entire workspace or retry/membership changes reload overview. |
| Profile fetched again? | `/api/users/me` owns identity/profile on initial mount and explicit refresh. Members retrieves brief member profiles; Applicants retrieves full applicant profiles. Those are separate purposes. |
| Links prefetched? | Club shell/mobile Links use default Next prefetch behavior. Settings subtabs explicitly disable it. Prefetch does not execute client `useEffect` section data loaders. Actual RSC prefetch count was not captured. |
| Large JS chunk? | Dynamic imports and a broad client adapter are present. Current production chunk bytes/hydration times were not measured; bundle size is a POSSIBLE contributor only. |
| Dynamic routes/caching? | Root cookies make request-dependent rendering. Public directory metadata, launch-clubs and sitemap have explicit data caches. Dynamic rendering does not disable all caching. Private section action results have no shared data cache. |
| Suspense/slow-query blocking? | Global route loading does not cover subsequent client effects. Initial overview waits for all of its parallel reads and gates every section. A slow overview subquery could delay Members/Settings; no subquery has been proven slow. |

Next's [navigation documentation](https://nextjs.org/docs/app/getting-started/linking-and-navigating) confirms native-history synchronization; its [layout documentation](https://nextjs.org/docs/app/getting-started/layouts-and-pages) describes persistent layout state. Code anchors: [shell Links](/Users/jesseklinger/Documents/out-class/components/shell/product-shell.tsx:87), [section key](/Users/jesseklinger/Documents/out-class/components/club-workspace.tsx:132), [directory effect](/Users/jesseklinger/Documents/out-class/components/organization-member-management.tsx:85), [applicant effect](/Users/jesseklinger/Documents/out-class/components/views/leader-dashboard/live-leader-workspace.tsx:138), [Discover open](/Users/jesseklinger/Documents/out-class/components/views/explore-view.tsx:93), [direct profile](/Users/jesseklinger/Documents/out-class/app/club/[clubId]/page.tsx:26).

## 3. Supabase Query Trace

Business queries below run through **Prisma → Postgres**, not Supabase browser REST. `include` generally selects all scalar fields at that model level unless `select`/`omit` narrows them. It can produce several SQL statements; **one ORM operation is not necessarily one database round trip**, and nested relations are not proven SQL joins here. No Prisma `relationJoins` preview configuration was found.

Sizes below are cardinality estimates from query bounds, not measured production record counts. M = club memberships including history; I = club invitations including history; A = nondraft applications; N = upload rows; S = saved clubs.

| File/function | Tables and selected data | Filters/order/bounds | Repeat/cost evidence |
|---|---|---|---|
| `utils/auth.requireAuth` | User, all scalars; Supabase Auth user | User primary key; 0–1 row; possible email-sync upsert | Every guarded action/API; independent middleware Auth call too. |
| `requireClubPermission` | ClubMember, all scalars | Unique userId+clubId; 0–1 | Every club permission check. Some transaction code rechecks membership intentionally. |
| `/api/users/me` | User, full StudentProfile, nondisplay-redacted Applications + full Clubs, ACTIVE ClubMembers + full Clubs | User ID; no application/membership limit or ordering | One cold identity fetch; explicit refresh after some writes. Duplicates earlier User lookup and some server-provided student data. |
| `getClubWorkspaceOverview` | Club id/name/tagline; next Event id/title/date/location/audience | clubId; event date≥now, date asc, first row | Club separate from full club in identity. Initial entry/retry/access-signature changes. |
| overview task reads | TaskAssignment id + task id/title/dueAt/kind; review count | own membership, unsubmitted/unreviewed/non-DONE, dueAt asc, take 5; club submitted/unreviewed count | Bounded list; no large payload concern proven. |
| overview recruitment | Application status group/count; PipelineRound predicate for anonymous-only viewers | clubId, nondrafts; groupBy status | Fetches counts despite later pipeline loading all applicants. Count and list have different uses. |
| `getOrganizationMemberManagement` | ClubMember all scalars; User email/disabledAt + Profile first/last/major/year | clubId only; joinedAt asc; **no take**, all statuses | Repeats on Members remount and directory reload. Approx M rows. |
| same directory, invitations | ClubInvitation all scalars; SchoolIdentity normalizedIdentifier; Delivery status/createdAt/failureCode | clubId only; invitation createdAt desc; newest delivery take 1 per invitation | Approx I rows, terminal history included even when hidden in UI. Relation SQL count unmeasured. |
| same directory, configuration | Club schoolId; SchoolIdentifierType id/label | club ID; active school + EMAIL_LOCAL_PART, ID asc | One club + identifier query per directory load; three directory reads await serially. |
| `getClubPipeline` | Active round id/name/order/anonymousReview; Application all scalars; full Round, User, Profile/Experiences; Evaluation excluding notes/questions; Answer+Question; Booking+Slot | clubId, status≠DRAFTING; anonymous filter by permission; rounds order asc; application list **no order/take** | Approx A plus all nested records. Repeated on remount/revision. Server-side anonymity projection occurs after graph retrieval. |
| `getApplicantDisplay` | Same one-candidate graph; membership twice inside tx; Observation + author name | candidate ID+clubId+nondraft; observations createdAt/id asc | Additional auth/membership and graph reread when detail opens; optional voting scope adds session/participants/candidates. |
| `recruitmentAttendanceSummary` | Application studentId + round anonymous flag; Event and Attendance counts | candidate scope; club public recruitment events held≤now | One candidate check then counts outside transaction in Promise.all; per-open, not per initial row. |
| `getApplicationSettings` | Club name/open/deadline/version + Question id/prompt/type/required/wordLimit/options | club PK; nonarchived questions ordered order/id | Loaded once per Settings Application mount/reload. Projection already narrowed. |
| `getPipelineSettings` | Club pipelineVersion; round id/name/type/archive/anonymous/configuration + five relation counts | club PK; rounds order/id asc, including archived | Counts needed for edit safety; generated SQL/cost unmeasured. |
| interview settings `getRoomWorkspace` | Club name, active round settings, active members/name, rooms/slots/counts, bookings/slot/candidate name | club scope; rounds order, rooms createdAt desc; no room/booking limit | Multiple nontransactional queries already grouped concurrently. Separate from general Settings. |
| `getClubDirectory` | Explicit public Club fields including marketing JSON, rounds, required question prompts; live Event id/title/date/location/description | discoverable clubs name asc; upcoming approved public meetings for those IDs, date asc | Club metadata cache 60s; events always read. No whole-directory page bound. JS event attachment filters events once per club, O(clubs×events). |
| `getPublicClub` / SEO | Explicit public fields with rounds/questions/events / SEO id,name,description,claimedAt,isDiscoverable | OR id/slug; first result | Two different projections on direct route. SEO has React request memoization; full profile has separate lookup. |
| `getStudentDashboardData` | Applications excluding anonymous text + club summary/question count, round name, answers, bookings; Attendance+Event; accessible Meetings | studentId; public or active-membership-visible events; applications submittedAt desc, meetings date asc | Queries already grouped outside transaction. Direct public profile and homepage may load data also represented in identity. Meetings query has no time bound/take. |
| `getOrganizationInvitations` | Identifier config, SchoolIdentity upsert/lock/read and optional verification write/audit; invitation public summary + club summary | verified email school identities; pending, nonexpired; createdAt desc; provider passes includeDismissed=true so no take 100 bound | Global mount/focus/visibility refresh; `requireVerifiedEmailPolicy` fetches Auth `/settings` no-store with 10s timeout. This read path can write identity binding on first encounter. |
| `getCorkboard` | CorkboardClub + same public club graph/Events | userId; savedAt desc, clubId asc; no take | Global initial/focus/pageshow refresh, S saved clubs. |
| `getTaskNotifications` / tutorial | Up to 100 own TaskAssignments + task/club summary; one UserTutorial | active membership/account, nondraft task; assignedAt desc / userId+experience | Task poll every 60s + focus; tutorial on shell mount or scope change. Not inherently every tab. |
| roster `authorize/classify` | membership; account disabledAt; full Club; identifier config+School; Identity full rows; User id/email/disabledAt raw query; member userIds; full pending Invitations | active school/config; identifiers IN; lower(email)=ANY; all active club members; pending unexpired scoped identities/emails | Preview and every confirm batch repeat this. Raw lower-email query uses existing functional index locally. |
| roster persistence | RosterImport + all Rows/input/errors; Identity createMany/read; expire lookup/update; Invitation createMany; raw Row update; AuditLog | idempotency key/importId+clubId; rows rowNumber asc; 50 VALID selected | Nested preview rows may use many SQL inserts despite one action-level create. Normal confirm uses bulk writes; fallback uses sequential per-row writes. |
| send/resend queue | account/member, club preference, invitations, deliveries/cooldown, sender/club hourly counts, outbox create/createMany, audit | invitation IDs and club; active statuses or recent timestamps; idempotency keys | Bulk queue authorizes once inside helper; caller repeats deliveryActor for roster send. Worker separately reauthorizes every delivery. |
| role/permissions | actor/account; target Member/User; owner count conditionally; member update; pending grants and queued delivery cancellation; audit | Club/User locks, scoped member ID; pending grants by identity/email | Transaction writes plus full-directory reread. Advanced permission UI adds an additional legacy access-directory reread (§4). |

No explicit `.select("*")` Supabase-table query occurs in these flows. Broad Prisma scalar selections serve the same payload concern. No application-code per-applicant fetch loop was found for initial pipeline rendering; do not describe nested includes as a proven N+1. Normal CSV confirmation is bulk, while constraint-error fallback and database triggers do contain per-row work.

## 4. Duplicate Fetches

Counts are **structural call sites**, conditional on the specified scenario. They exclude framework retries, token refresh and relation-query expansion. Do not add unrelated flows into a fictitious single-navigation count.

| Data | Fetched from | Number of times | Necessary? | Recommended owner / boundary |
|---|---|---|---|---|
| Auth identity, initial document | middleware + RootLayout | 2 explicit getUser calls | Verification required; duplication should be measured | Request auth boundary; safe request-local reuse only where verification semantics match. |
| Auth identity, one guarded action | middleware + requireAuth | 2 explicit getUser calls | Do not remove authorization; duplicated provider calls are a candidate | Same request auth boundary, with separate action permission enforcement. |
| Own account, cold `/api/users/me` | requireAuth User + populated User lookup | 2 ORM reads | Disabled/account validation required; projections overlap | Identity loader can own validated populated account. |
| User profile/club/application identity on authenticated homepage | server dashboard data + profile-existence query + client identity API | Profile presence 2 sources; applications/club fields overlap 2 sources | Onboarding check and calendar detail differ; not identical payloads | Server bootstrap and AuthProvider with explicit minimal projections. |
| Club on initial live Members | identity membership.club + overview club summary + directory club.schoolId | 3 club projections | Shell needs summary; directory needs school config | Shared club bootstrap; configuration and live permission checks remain server-owned. |
| Actor membership on initial Members | populated identity + overview requireClubMembership + directory actorFor | 3 projections | Server security checks intentionally repeat across requests | Client display identity vs live server authorization, not a long-lived permission cache. |
| Members directory in A → other → A | fresh directory on each Members mount | 2 complete loads over the two visits | Reload freshness may be needed; discard-and-block is not inherently required | Club-scoped directory state with deliberate refresh/invalidation policy. |
| Applicant graph, list then open detail | getClubPipeline + getApplicantDisplay | 2 for opened candidate | Detail observations/config need loading; graph overlaps | Minimal list + scoped authorized details, or measured shared projection. |
| Direct profile Club | metadata SEO + page public profile | 2 lookups | Different safe projections; only modest duplication | Request-scoped public record owner preserving SEO/public field boundaries. |
| Directory after ordinary role change | initial loaded directory + post-write reload | 1 additional full reload | Required to observe live authoritative grants | Directory loader; consider smaller authoritative mutation result after validation. |
| Directory after advanced custom permission save | getClubAccess in editor + getOrganizationMemberManagement in onSaved | **2 additional directory reads** after mutation | Both overlap; legacy editor needs synchronized target state | OrganizationMemberManagement owns refresh, editor receives authoritative target. |
| Identity after advanced custom permission save | parent reload(true) for self + editor finally refreshUser | **2 API reads for self**, 1 for another member | Self permissions must refresh; duplicate self refresh unnecessary | One explicit identity refresh owner. |
| Target user during updateClubAccess | disabledAt lookup + email lookup | 2 | Both fields needed; distinct round trips unnecessary in principle | One scoped target account projection inside the authorized transaction. |
| Sender authorization during sendRosterInvitations | caller deliveryActor + helper deliveryActor | 2 account + 2 membership reads inside same tx, plus requireAuth account | Security necessary; same locked transaction has overlap | Authorized queue helper with explicit caller contract. |
| Full roster classification for N=500 | preview + every 50-row confirmation | **11 classifications of 500 inputs** | Global duplicate detection/live changes intentional; implementation rescans completed inputs too | Import state/validation phase plus batch-scoped live checks preserving race protection. |

Key negative finding: General Settings already reads club settings from shared Auth context. Overview excludes `section` from effect dependencies. AuthProvider is not coded to fetch on every pathname change. Invitations already have a root session state provider. Do not recommend adding caches to solve duplicates that do not exist.

Sources: [member reload](/Users/jesseklinger/Documents/out-class/components/organization-member-management.tsx:114), [legacy editor refresh chain](/Users/jesseklinger/Documents/out-class/components/club-access-editor.tsx:38), [permission mutation](/Users/jesseklinger/Documents/out-class/actions/club-access.ts:153), [queue authorization](/Users/jesseklinger/Documents/out-class/actions/invitation-emails.ts:12).

## 5. Request Waterfalls

| Waterfall | Dependency assessment | What to investigate after this audit |
|---|---|---|
| Client Server Action queue | Installed `app-call-server.js` dispatches server actions to `app-router-instance.js`; nonnavigation actions append behind pending work. Scheduling experiment confirmed max concurrency=1 using the installed queue and a synthetic reducer. | Read transport/ownership. Independent UI reads may need aggregation or a read API; `Promise.all` around separate client actions does not fix the queue. Navigations preempt pending actions and can schedule a later refresh; it is incorrect to say every navigation waits for the queue. |
| Cold identity → overview → section loader | Workspace waits for identity, then overview, then mounts section. Overview aggregates unrelated meeting/task/recruitment data. | A minimal authorized workspace bootstrap and section-specific loading could shorten this chain; retain permission checks. |
| Members account → actor → club → members → invitations → identifier types | Actor authorization and school config have dependencies. Members/invitations do not depend on each other; identifier types depend on schoolId. `await` inside Promise.all makes all three sequential. | Read consistency and SQL/projection/transaction structure. Simply removing inner awaits is insufficient to achieve DB concurrency. |
| Prisma interactive transaction Promise.all | A single connection executes queries sequentially. Applies to member reads, roster classification, settings authorization, checklist and invitation queue counts. | Combine SQL or safely move independent reads outside a transaction only after assessing consistency. Prisma's [v6 transaction documentation](https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions) explains this restriction. |
| Pipeline rounds → applications | Both use clubId and authorized membership; applications do not consume fetched rounds. | Can be requested concurrently outside a transaction or combined; measure relation expansion first. |
| Direct profile public club → Auth → student dashboard | Public content does not need private dashboard to become visible; page currently awaits both. Metadata performs separate public read. | Isolate public profile rendering from optional private data. Preserve public projection and anonymity rules. |
| Homepage Auth → disabled account → dashboard → profile presence → launch clubs | Auth is dependency; later profile-presence and cached public launch data have independent work. Dashboard's three reads already run concurrently. | Bootstrap ownership and when private/public reads are needed; not more parallelism inside dashboard helper. |
| Invitation provider Auth → Auth settings → verified identity operations → invitation list | Identity proof is necessary; provider settings is an uncached external fetch with 10s timeout, then school-config loop/upsert/lock/read. Separate configured-endpoint probes took 718.702, 149.888 and 278.558 ms. | Measure its actual action-queue occupancy; these probe timings exclude the rest of the action. Do not remove university email verification as an optimization. |
| Permission editor mutation → legacy access read → parent directory read → identity finally | At least some reads overlap in ownership; busy remains until refresh completes. | Consolidate post-save authoritative refresh while retaining self-access revocation handling. |
| CSV confirm₁ → confirm₂ → … → confirm₁₀ → directory reload | UI intentionally waits for each committed resumable batch. Each reads all rows again; true synchronization dependency across batches. | Reduce repeated batch work rather than launch unsafe concurrent transactions against the same club lock. |
| Single invitation creation | Club lock → club/config/member → identity upsert → member/pending checks → create/audit | Identity and safety checks genuinely constrain writes; some config/member reads are independent but same tx still serial. |

Already appropriate concurrency: overview's independent nontransactional reads, student dashboard queries, room-workspace reads, attendance counts and the SMTP groups. These are not candidates for another mechanical Promise.all rewrite.

## 6. Rendering Problems

**OBSERVED:** `ClubWorkspace`, `AppShell`, `ProductShell`, member/applicant/settings workspaces and root providers are client components. Routes and root layout remain server components. Passing server-rendered `children` through a client provider does **not** convert every route module into a client component.

| Trigger | Actual render/remount consequence | Evidence strength |
|---|---|---|
| Club section/tool changes | Different keyed `<section>` destroys section component state and reruns mount effects on return | OBSERVED; production duration unmeasured. |
| AuthProvider changes user/loading/selectedClub | New context value object broadcasts to useAuth consumers; member/workspace/settings/shell recalculate. Club overview effect reruns only if listed dependencies change (including membership signature), not on every context render. | OBSERVED render dependency. No measured React commit cost. |
| Task poll/focus resolves | syncTaskNotifications constructs a new notifications array even for equivalent records; ApplicationState context changes and consumers rerender | OBSERVED. Does not necessarily refetch pipeline because its effect depends on clubId/revision. |
| Root invitation refresh | Provider sets loading and new invitation data; notification consumers update. Window focus can trigger both focus and visibility paths. | OBSERVED potential overlapping refresh; duplicate HTTP count unmeasured. |
| Member search/selection/busy updates | Entire in-memory directory is mapped/filtered and selection-derived arrays recomputed before the 50-row slice | OBSERVED O(M+I) derivation. Local payload size measured; render CPU not profiled. |
| Applicant search/filter/sort | Existing useMemo dependencies change legitimately; filtering/sorting all applicants repeats. Opening/editing triggers workspace renders and detail effects. | OBSERVED. No generic useMemo recommendation; memoization already exists. |
| Settings subtab visited | Active/visited state changes; visited children remain mounted and hidden. Returning to outer dashboard section discards the Settings instance. | OBSERVED. Memory/render overhead POSSIBLE; warm-subtab retention beneficial. |
| Demo viewAs/reset | Provider epoch key or full navigation remounts tree | OBSERVED intentional demo behavior; not the live-tab explanation. |

`lib/workspace-api.ts` is a wide client dependency importing demo fixtures, schemas and adapters across many domains. Root customization/demo contexts also import fixture code. This makes shared JS weight worth inspecting, but no fresh production chunk analysis was available. Dynamic imports already split many views, including Members/Applicants. Club Settings/profile editor and some meeting/event views are eagerly imported by the club workspace. No claim that any one chunk is oversized or hydration is a measured bottleneck.

The more direct explanation for waiting is **network/data loading boundaries and remounts**, not proven expensive React arithmetic. No memoization, callback, cache or provider change was added.

## 7. CSV Import Trace

```text
CSV selected/dropped (≤1 MB, ≤1,000 data rows)
  → file.text() → client parseRosterCsv (strict CSV structural validation)
  → previewRosterImport POST
      → middleware/auth/club permission
      → server parse + hash + transaction + Club FOR UPDATE
      → recheck account/membership/active school identifier config
      → classify identities/users/active members/pending invitations
      → persist RosterImport + every input Row + audit → commit
  → preview state, 50 visible rows at a time
Admin confirms
  → while(true) await confirmRosterImport(importId)
      → import hint read + auth/permission
      → transaction + Club lock + recheck config/uploader
      → read ALL saved rows → validate/classify ALL original inputs
      → select at most 50 remaining VALID rows
      → normal: bulk identity insert + identity lookup + expire stale invites
               + bulk invitation insert + jsonb_to_recordset row update + audit
      → constraint failures only: rollback bulk savepoint, sequential row fallback
      → reread ALL outcomes + update import progress + audit → commit
  → progress state → next batch until completed
  → onImported directory reload → busy=false
Separate explicit Send invitations button
  → queue outbox → return → background SMTP
```

**OBSERVED:** The import creates **pending MEMBER invitations**, not User records or memberships. It is additive. Normal confirmation uses `createMany` and one raw batch Row update, with at most 50 ready rows per transaction. It is synchronous per batch and resumable across commits. SMTP is never invoked by preview/confirmation. Audit/global failures roll back the current batch; earlier committed batches survive. Input-specific constraint errors use savepoints and row isolation.

### Counted operations on the normal, all-new, no-expiry/no-error path

These were counted by wrapping the existing hermetic roster fixture while executing **the original current actions**. Counts include action-level Prisma/raw calls, including savepoint statements, but exclude guarded auth internals, middleware, transaction BEGIN/COMMIT and generated nested relation/insert SQL. They must not be presented as exact TCP/database round-trip counts.

| Rows | Preview action calls | Confirmation POSTs | Confirmation action-level DB calls | Total action-level DB calls | Main auth.getUser call sites across these POSTs* | Emails / memberships created |
|---:|---:|---:|---:|---:|---:|---:|
| 10 | 1 | 1 | 24 | 36 | 4 | 0 / 0 |
| 50 | 1 | 1 | 24 | 36 | 4 | 0 / 0 |
| 100 | 1 | 2 | 46 | 58 | 6 | 0 / 0 |
| 500 | 1 | 10 | 222 | 234 | 22 | 0 / 0 |

Preview contributes 12 counted DB calls. Confirmation contributes `22 × ceil(N/50) + 2`: 24 first batch, 22 thereafter. *Auth call-site counts are source-derived (middleware+guard per POST), not measured provider HTTP counts. Normal unchanged-account guards additionally contribute approximately two Prisma lookups per action (User and ClubMember), making app-level DB-call totals 40/40/64/256 before transaction-control and generated nested SQL. The caller's final directory reload is additional.

There are `N × (1 + ceil(N/50))` row classification visits: 20, 100, 300, **5,500** respectively for preview plus confirmation. Each confirmation also reads all saved rows initially and all outcomes at the end. For 500 rows, confirmation alone visits 5,000 classification inputs and reads about 10,000 saved/outcome rows cumulatively. Those are logical processing counts, not distinct records or network requests.

On a failed bulk-write path, the attempted bulk calls are followed by rollback/release and serial row work. A successful fallback row with no stale invitation performs roughly seven action-level calls: savepoint, identity upsert, stale lookup, invitation create, row update, release, audit. Each stale invite adds update/audit work; failed row reclassification adds more. This is an exception path, not the normal architecture.

Database row triggers still run for every inserted identity/invitation/roster row, even in bulk SQL. Thus fixed action-level bulk call counts do not imply constant database CPU. The preview's nested `rows.create` is **not** proof of a single bulk SQL insert. Generated SQL was not captured.

**MEASURED local CPU:** 500 rows parsed in median **0.091 ms**, p95 **0.176 ms**; validation median **0.105 ms**, p95 **0.203 ms**. Synthetic CSV size was 17,802 bytes. At 1,000 rows, parser median 0.181 ms and validator median 0.209 ms. These Node measurements exclude browser File reading, upload, auth, DB and rendering, and do not cover worst-case 1 MB CSV content.

What blocks success: committed batch completion, required audit writes, the next awaited batch, and final directory refresh. **INFERRED main candidate:** repeated remote work/transactions, not demonstrated parser CPU or email latency.

Sources: [CSV importer](/Users/jesseklinger/Documents/out-class/components/roster-csv-importer.tsx:20), [preview](/Users/jesseklinger/Documents/out-class/actions/roster-import.ts:60), [bulk path](/Users/jesseklinger/Documents/out-class/actions/roster-import.ts:135), [confirmation](/Users/jesseklinger/Documents/out-class/actions/roster-import.ts:173).

## 8. Invitation / Resend Trace

### G — Create, send and resend are separate operations

```text
Invite form → inviteOrganizationMember → createClubIdentityInvitation POST
  → middleware/Auth → Club lock → club/config/actor checks
  → normalize university ID → derive configured delivery email
  → identity upsert → check active membership + expire/reuse pending invitation
  → create ClubInvitation (UUID, 7-day expiry, scoped role) + audit → commit
  → UI notice/link + directory reload
```

Creating an identity invitation does **not** send or enqueue email. Identity emails use a general sign-in/settings link and server-verified university identity, not a newly generated bearer invitation token. Legacy email invitations use `/invitations/:uuid`; delivery still checks live grants. Resend creates an outbox request, not a duplicate membership.

```text
Send import / Resend → sendRosterInvitations or resendOrganizationInvitation POST
  → middleware/Auth → validate SMTP configuration (no provider call)
  → lock Club/User → sender permissions + club preference
  → invitation validity + pending delivery + cooldown + hourly quotas
  → durable InvitationDelivery QUEUED (bulk for import) + audit → commit
  → scheduleInvitationDelivery using Next after()
  → browser response → UI message → optional directory refresh → busy=false

After response: processInvitationEmails(club,5)
  → select due QUEUED deliveries oldest first
  → groups of up to 3; each:
      claim transaction + club lock + live invitation/requester/inviter validation
      → SENDING, increment attempt → commit
      → SMTP outside transaction, new transport → sendMail → close transport
      → transaction SENT + invitation email timestamps/count + audit
  → leave remaining rows QUEUED
Cron every minute → earliest queued club → processInvitationEmails(club,25)
```

| Question | Evidence-based answer |
|---|---|
| Wait for Resend before browser response? | Usual UI path waits for **outbox**, not SMTP. No direct Resend integration found. Next [after()](https://nextjs.org/docs/app/api-reference/functions/after) runs after the response finishes. |
| Emails one by one? | Worker invokes up to three SMTP calls concurrently, in successive awaited groups. Claim transactions lock the same club, so authorization/claim sections serialize; external calls run outside that lock. |
| Email blocks CSV? | No. Preview/confirmation do not call it. Explicit send queuing and UI directory refresh are separate. |
| Email failure rolls back membership/import? | No import membership is created; queue and invitation/import state are already committed before delivery. SMTP failure affects outbox status. |
| Retry policy? | Cron resumes unclaimed QUEUED work. Explicit SMTP 4xx/5xx becomes FAILED. Ambiguous error stays SENDING with DELIVERY_UNCERTAIN; automatic retry would risk duplicate email and is intentionally absent. Manual resend is subject to 15-minute cooldown and active-delivery checks. |
| States? | QUEUED, SENDING, SENT, FAILED, CANCELLED; failureCode, attemptCount, nextAttemptAt, providerMessageId and timestamps. SMTP acceptance marks SENT; no delivery webhook/confirmed recipient delivery was found. |
| Duplicate prevention? | Import idempotency key; pending invitation identity uniqueness; delivery idempotency and partial unique index for active delivery; club locks/cooldown. Legacy inviteClubManager directly creates UUID invitations without the same identity dedup check; that separate path can create repeated pending records. |
| Provider on client? | No; Nodemailer/configuration are server-side. Client invokes server actions. |
| Synchronous delivery endpoint? | Exported deliverOrganizationInvitations awaits worker, but current InvitationEmailControls calls requestInvitationDelivery instead. Tests invoke synchronous API; no audited live UI caller was found. |

**INFERRED delivery-completion limitation:** a single after pass handles at most five; cron handles at most 25 candidates for one club per invocation. With 500 queued in one club, absent additional triggers/time-budget interruptions/failures, 495 remain after the initial pass and require at least 20 cron passes. That is approximately tens of minutes under the one-minute schedule, **not a measured send-button wait or delivery SLA**. Multiple clubs and the worker's 25-second soft cutoff can lengthen it. Three concurrent messages create separate SMTP transports, so connection setup repeats per email; provider timings were not measured.

### H — Member role or permission change

```text
Member details → role Save → changeOrganizationMemberRole POST
  → middleware/Auth → transaction
  → Club/User locks → account + actor membership → target membership/user
  → grant-scope + last-owner protection → member update
  → target email → cancel queued deliveries + revoke pending grants → audit
  → commit → OrganizationMemberManagement.run reloads directory
      and refreshes identity if changing self
  → data/notice state → rerender → busy=false
```

Advanced capability Save uses `ClubAccessEditor → updateClubAccess`, then `getClubAccess`, then parent's directory reload, then editor's `finally` calls `refreshUser`. Self changes can refresh identity twice. Ordinary role saves do not have that extra legacy-directory step. These refresh chains, not SMTP, belong on the UI completion critical path. No role/email mutations were executed during the audit.

Sources: [identity invitation creation](/Users/jesseklinger/Documents/out-class/actions/club-onboarding.ts:26), [send/resend actions](/Users/jesseklinger/Documents/out-class/actions/invitation-emails.ts:12), [background scheduling](/Users/jesseklinger/Documents/out-class/utils/invitation-background.ts:4), [worker](/Users/jesseklinger/Documents/out-class/utils/invitation-delivery.ts:75), [SMTP](/Users/jesseklinger/Documents/out-class/utils/email.ts:16), [role mutation](/Users/jesseklinger/Documents/out-class/actions/organization-members.ts:95).

## 9. Database Findings

Authoritative history is `prisma/migrations`; Supabase migration replay is disabled and the old remote schema is archived. The audit applied the complete committed chain to PGlite. This proves local migration contents, **not** deployed indexes. `DEPLOYED_BACKEND_STATE.md` is dated September 28 and is historical evidence; it cannot establish current production state.

| Pattern | Current schema evidence | Local plan/result | Conclusion |
|---|---|---|---|
| lower(email)=ANY import match | `User_email_lower_idx` in October 5 settings migration | Index Scan; 2 matching rows out of 10,000; execution 0.043 ms | No missing lower-email index in current migrations. Verify actual deployment before recommending one. |
| userId+clubId membership | Unique ClubMember index; additional club/status/joinedAt index | Schema observed; full Prisma authorization SQL not profiled | Appropriate obvious lookup index already exists. |
| all-status member directory by joinedAt | clubId index and `(clubId,status,joinedAt)` | Bitmap scan + in-memory sort of 500; execution 0.386 ms | Middle status key does not fully supply all-status sort. Query is fast locally; `(clubId,joinedAt)` is only a candidate after live evidence. |
| all-status invitations createdAt desc | `(clubId,status,createdAt)` | Bitmap scan + in-memory sort of 500; execution 0.318 ms | Same ordering mismatch; no demonstrated slow sort. Scope/pagination likely more useful to examine first. |
| latest delivery | `(invitationId,createdAt)`; active-delivery unique partial index | Backward Index Scan, 1 row; execution 0.006 ms | Covered lookup; per-invitation relation SQL shape remains unknown. |
| next club meeting | Event clubId index; public/date/endDate index | Reads 500 candidates + top-N sort; execution 0.200 ms | `(clubId,date)` could fit this query; no measured production need yet. |
| applicants club/status/round | clubId/status/roundId, clubId, roundId, studentId indexes | Not timed | No immediate absent club filter index. Unbounded graph retrieval is observed independently of index cost. |
| roster saved rows | unique importId+rowNumber; invitationId index | Schema observed | Ordered import-row reads already have an appropriate prefix index. Repeated entire-import retrieval is structural. |
| queued worker | status/nextAttemptAt; inviter/requester date indexes | Schema observed | Club is reached via invitation relation; createdAt ordering may still sort. Exact worker SQL plan unmeasured. |

**RLS:** migrations enable RLS, revoke browser grants and add restrictive server-only policies on key tables. Prisma uses a configured DB connection and application authorization, not a browser JWT-bound Data API session. Local owner connections bypass non-FORCE RLS; production connection role/BYPASSRLS was not queried. Therefore RLS joins/policies are **not a proven cause** of latency. Do not cache or remove authorization to avoid it.

**Triggers/locks:** migration guards lock the Club for invitation/import/member writes and check owners/identities/grants. Bulk inserts retain per-row trigger checks and foreign-key work. App-level actor checks and trigger checks can both execute, intentionally enforcing authority at two boundaries. Concurrent admin writes to the same club may wait on the same row lock. Lock-wait times and trigger CPU were not measured. Preserve these invariants in later changes.

**Region/pooler:** local configuration references a US West Supabase pooler; observed Vercel block responses carried `iad1` identifiers. This does not establish production function/database placement or a region mismatch. Treat remote network latency, cold starts, pool saturation and missing deployed migrations as **POSSIBLE**, pending provider/runtime evidence.

## 10. Performance Measurements

The local runner used Node **v26.9.0 on macOS**. Package engine minimum is Node 22.13 and CI uses Node 22; timings may differ on deployment runtime. Parser/validator statistics use 10 warmups + 100 measured samples. SQL statistics use 5 warmups + 30 measured samples on a PGlite fixture containing 10,000 users, members, invitations, deliveries and events across 20 clubs. SQL wall times include PGlite query/result handling; EXPLAIN execution times are separate single samples. Queries are base SQL equivalents, **not captured Prisma relation SQL**. No optimization variants were run.

| Operation | Current | Bottleneck / interpretation | Potential Improvement |
|---|---|---|---|
| Production Members navigation | OBSERVED 403; no valid timing | Vercel request blocked; application never successfully traced | Restore audit access and measure first/warm successful navigations. |
| Unauthenticated public-profile HTTP probe | MEASURED 403; TTFB 181.317 ms, total 181.407 ms, body 59 B | Error response only; not profile latency | No application improvement estimate from this sample. |
| Unauthenticated homepage probe | MEASURED 403; TTFB 101.157 ms, total 101.249 ms, body 59 B | Error response only | Same limitation. |
| Configured Supabase Auth `/auth/v1/settings` dependency | MEASURED 3 successful read-only requests: **718.702, 149.888, 278.558 ms**, including body read | Actual remote dependency latency; small sample includes connection/network effects. Equivalent endpoint/headers to verification policy, not an instrumented invitation action or deployed-runtime measurement. | Inspect queued provider reads and verification ownership; preserve security policy. No predicted savings asserted. |
| Configured remote database measurements | Unavailable: PrismaClientInitializationError | No live row counts, plans, role or query durations returned. Attempt was prepared for READ ONLY transaction with timeouts; no mutation attempted. | Diagnose local client/connectivity before runtime DB measurements. Do not interpret this as a production application error. |
| 500-row parse / validate | MEASURED local medians 0.091 / 0.105 ms; p95 0.176 / 0.203 ms | Not a material CPU delay in this sample | No parser optimization indicated by these results. |
| 500-row confirmation | MEASURED call count: 10 actions, 222 action-level DB calls | End-to-end duration unmeasured; repeated whole-upload work OBSERVED | Fewer repeated reads/checks if consistency preserved; no ms estimate. |
| Member directory scheduling | MEASURED original loader with delayed mock: max concurrent operations=1 | Confirms serial structure, not live latency | SQL/read-boundary redesign; removing inner await alone does not parallelize transaction. |
| Client Server Action scheduling | MEASURED installed Next queue with synthetic reducer: max concurrency=1 | Framework sequencing confirmed; request durations unmeasured | Reconsider independent read transport/aggregation. |
| Normalized email lookup | MEASURED local median 0.113 ms, p95 0.157 ms; EXPLAIN 0.043 ms | Indexed, no slow scan in synthetic fixture | Keep existing index; inspect deployed plan if needed. |
| 500 directory members, base table | MEASURED local median 2.855 ms, p95 3.404 ms; EXPLAIN 0.386 ms | 155,285 B JSON; local output handling exceeds SQL execution | Narrow/page data before transport; actual RSC payload unmeasured. |
| 500 invitations, base table | MEASURED local median 3.664 ms, p95 5.183 ms; EXPLAIN 0.318 ms | 311,785 B JSON before delivery/identity/profile nesting | Bound visible/history retrieval; no production speedup claim. |
| Newest delivery for one invitation | MEASURED local median 0.115 ms, p95 0.167 ms; EXPLAIN 0.006 ms | Existing backward index scan | No index change indicated locally. |
| Next meeting among 500 club events | MEASURED local median 0.223 ms, p95 0.293 ms; EXPLAIN 0.200 ms | Top-N sort, fast locally | Candidate index only after real workload evidence. |
| SMTP call / complete queue drain | Not measured | Provider/network unavailable; current UI queues asynchronously | Measure queue age, claim and SMTP durations before tuning throughput. |

**Browser gaps:** successful request count, route completion, TTFB, longest app request, chunk bytes, duplicate request timing, first-vs-warm Members/Applicants, React commits and full-document reload evidence are **unavailable**. The CDP event sample did not include the main Members navigation request, so no main-request network timing is reported. One favicon 403 was captured and excluded as irrelevant. Tool observation elapsed time is not browser render/navigation performance and was not used.

**Validation:** 74 focused existing tests passed, zero failures/skips, total runner duration 2,422.409 ms. Suites covered CSV/parser/import/UI/current migration execution, member authorization/database/UI, invitation queue/UI/SMTP transport, settings/database/UI and directory. Unit-suite durations are not application latency. Audit runner completed successfully, including scheduling assertions, operation-count assertions and full migration replay. ESLint for the audit runner could not initialize because existing installation cannot resolve `eslint-plugin-react-hooks`; dependencies were not modified. No production build or application code change required verification.

Reproduce isolated measurements:

```sh
node scripts/performance-audit.cjs > /tmp/outclass-performance-audit-evidence.json
```

The runner intentionally stops on an unmocked `@/utils/` dependency in its general TS loader. It also checks the reused roster fixture shape before executing it. Source changes require reviewing the audit adapters rather than silently accepting stale measurements. Remote Auth dependency probes were a separate audit command, with credentials kept in memory and only status/duration retained; the standalone runner reproduces the isolated local measurements only.

## 11. Priority Ranking

P0 = potential major perceived improvement; P1 = meaningful; P2 = cleanup/measurement-dependent. Impact estimates are hypotheses constrained by the evidence above, not demonstrated production gains. Risks concern preserving authorization, consistency and freshness.

| Priority | Issue / next optimization candidate | Evidence | Impact | Risk | Difficulty |
|---|---|---|---|---|---|
| P0 | Independent reads serialized through client Server Actions, including global background loaders | OBSERVED + MEASURED scheduling; live queue occupancy unknown | HIGH | MEDIUM | M |
| P0 | Members/Applicants warm visit discards resource data and blocks on another fresh load | OBSERVED remount/effects | HIGH | MEDIUM | M |
| P0 | Cold identity → unrelated overview → selected section waterfall | OBSERVED dependencies; stage latency unknown | HIGH | MEDIUM | M |
| P1 | Whole member/invitation history and heavy applicant graph transported repeatedly | OBSERVED; MEASURED synthetic base-row size | HIGH for large clubs | MEDIUM | M |
| P1 | Redundant middleware/action auth plus overlapping identity/bootstrap projections | OBSERVED; no auth duration | MEDIUM–HIGH | HIGH | M |
| P1 | Advanced permissions invokes two directories and sometimes two identity refreshes | OBSERVED exact chain | MEDIUM | MEDIUM | S–M |
| P1 | CSV reclassifies/rereads full upload on each sequential 50-row batch | MEASURED call counts; actual remote duration unknown | HIGH for large imports | HIGH | M |
| P1 | Queue drain throughput limited to 5 after / 25 cron per minute, one club at a time | OBSERVED capacity; INFERRED large-queue age | HIGH for bulk delivery completion; LOW for navigation | MEDIUM | M |
| P1 | Direct public profile awaits optional private dashboard | OBSERVED await chain; latency unknown | MEDIUM | MEDIUM | M |
| P2 | Settings/member read transaction structure and nominal Promise.all | OBSERVED + MEASURED serial scheduling | MEDIUM only if round-trip dominated | MEDIUM | S–M |
| P2 | Broad shared client adapter/demo dependencies, notification-driven renders | OBSERVED dependency graph, CPU/chunk cost unknown | UNKNOWN | MEDIUM | M |
| P2 | Candidate sort/meeting/worker indexes, region/pooler/lock tuning | POSSIBLE; current synthetic SQL fast and several indexes already present | UNKNOWN | MEDIUM | S–M |

The production 403 is a prerequisite for completing latency validation, not a diagnosed P0 application performance defect. Its cause was not established.

## 12. Recommended Optimization Plan

1. **Establish successful baseline traces first.** Use current deployed revision/schema confirmation and an authenticated allowed browser session. Record Overview → Members → Applicants → Members and General Settings first/warm visits. Capture RSC/action request start/end/status/bytes, Next-action queue waiting, `/api/users/me`, chunk loads and time until usable rows. Separate application time from browser tooling time.
2. **Add focused development-only stage timing if baseline access becomes available.** One request ID with auth, account, membership, overview subqueries, directory members/invitations/config, pipeline graph/anonymity, CSV DB batch and queue/SMTP phases. No raw SQL parameters, email, user names, CSV contents or access tokens. For DB use actual query duration/count and local/staging plans; for browser use Resource Timing/DevTools and React Profiler. No runtime instrumentation was added during this audit because safe local auth/backend access was unavailable.
3. **Address read scheduling and cold-entry ownership.** Choose a measured aggregate/bootstrap or independent read API design that maintains server authorization. Make selected-section data available without waiting on unrelated overview/global provider reads. Keep background notifications, invitations and Corkboard from serializing critical data. Validate navigation-preemption and authorization behavior, rather than simply wrapping client actions in Promise.all.
4. **Give warm section data an explicit owner and freshness policy.** Preserve club-scoped directory/pipeline resources or provide a deliberate refresh strategy. Validate removed memberships, self-permission changes, club switches, stale replies and post-mutation state. Do not retain uploads/unsaved forms inadvertently merely to avoid remounts.
5. **Reduce measured transport work.** Member/invitation server paging/filtering and minimal applicant list projections; load details on demand under current anonymous-review rules. Keep all-history management available through explicit queries. Compare actual payload and usable-row times before/after.
6. **Consolidate post-save refreshes.** Let member-management own its authoritative directory refresh; refresh self identity once. Keep failed refresh distinct from a failed committed mutation. Retain audit/last-owner and live-grant checks.
7. **Reduce large-import repeated work.** Preserve 50-row resumable commits, idempotency, complete-file duplicate semantics, current permissions and concurrency protection while avoiding classification of completed rows and repeated whole-upload payloads where safely possible. Capture generated preview nested-insert SQL and trigger cost before claiming normal writes are fully batched at every layer.
8. **Measure then tune email completion separately.** Record oldest queue age, count per club, claim lock wait, SMTP connection/send and final-status writes. Evaluate fair multi-club scheduling and safe bounded throughput. Retain ambiguous-delivery protection; do not add automatic retries that duplicate email.
9. **Decouple direct public-profile content from optional private dashboard data.** Keep public metadata and privacy protections explicit. Recheck account-aware controls after private data arrives.
10. **Only then change indexes, bundle boundaries or rerender behavior based on evidence.** Use current deployed schema and representative local/staging EXPLAIN. Profile shared client chunks and React commits first. Preserve useful existing concurrency/caching and avoid blanket useMemo/useCallback/cache changes.

No fixes in this plan were implemented. Application files and production data were unchanged by the audit. An unrelated `loc-history.svg` working-tree edit appeared during the audit and was left untouched.
