# Navigation and button consolidation plan

Branch: `design/authenticity-product-pages`, restarted from `origin/main` at `7b6fc75` (2026-11-07). The branch's earlier history (`dd4209e`) was already an ancestor of `main` and carried no unmerged commits. The personal routes this task targets (`/home`, `/explore`, `/inbox`, `/settings/*`) exist only on `main`.

Scope: UI, routing and copy only, plus the voting-session list fix in 2c. **No database schema changes and no API contract changes are needed.** The voting fix keeps every existing server-action input; `listLiveVotingRooms` gains an additive `mode` field on each row (section 2c).

---

## 1. Current map

### 1.1 Rendering and routing

| Area | Entry | Renders | Notes |
|---|---|---|---|
| Personal pages | `app/(product)/*/page.tsx` (one 10-line file each) | `components/student-workspace-page.tsx` → `HomeEntry` → `components/app-shell.tsx` → `components/dashboard-layout.tsx` → view | Path ↔ view registry `lib/student-routes.ts` (`STUDENT_ROUTES`). View switch `app-shell.tsx:205-214`. |
| Old personal URLs | `middleware.ts:16-23`, `app/page.tsx:44-48` | `legacyStudentRedirect` (307) | `/?workspace=student&view=…` from email/notifications. Aliases in `lib/student-navigation.ts:8`. |
| `/interviews`, `/decisions` | `app/interviews/page.tsx`, `app/decisions/page.tsx` | redirect to `applicantStatusHref` | currently `/applications/status` |
| `/corkboard` | `app/(product)/corkboard/page.tsx` + `layout.tsx` | `CorkboardView` | Public page; also rendered in-shell by AppShell |
| Settings | `app/settings/layout.tsx` → `components/settings/personal-settings-layout.tsx` | per section page | Sections `lib/settings-navigation.ts:1-7` |
| Club workspace | `app/club/[clubId]/workspace/page.tsx` | `components/club-workspace.tsx` | Server redirects: `legacyApplicantInterviewHref`, `legacyInterviewRoomHref`. Client rewrites in `club-workspace.tsx:77-105` (`tool=cycles`, `tool=voting/letters` → `decisionTab`, settings interviews → recruitment). |
| Interview room | `app/(focus)/club/[clubId]/interview/page.tsx` | `ClubInterviewRoom` → `interview-workspace-view.tsx` | Link builders `lib/interview-entry.ts` |
| Voting focus routes | `app/(focus)/voting/rooms/{new,[id],[id]/prepare}` | `room-setup.tsx`, `room-view.tsx`, `slide-preparation.tsx` | |

### 1.2 Titles
- Root template `app/layout.tsx:46`: `"%s | OutClass"`, default `SITE_TITLE` ("OutClass | UVA Club Applications & Recruitment").
- Client override `components/shell/product-shell.tsx:142`: `document.title = "${title} · OutClass"`. Titles come from `viewTitles` (`lib/views.ts`) via `dashboard-layout.tsx:47-48`, and from `route-workspace-shell.tsx:32` for `/corkboard` and `/settings/*`.
- Server-side, personal and settings pages have no title (they show `SITE_TITLE` until hydration). `settings/availability` and `settings/interviews` double the suffix ("My Availability | OutClass | OutClass").

### 1.3 Navigation config
- Personal rail `lib/navigation.ts:26-34` (`personalRailSections`): Home · Explore · Corkboard · Applications · Status · My Clubs · Meetings · Tasks · Calendar · Profile · Settings (11).
- Parallel older lists: `personalNavigation` (`lib/product-navigation.ts:9-13`), `studentNav` / `adminNav` (`lib/views.ts`).
- Club rail `leaderRailSections` (`lib/navigation.ts:52-64`) from `managerNavigation` (`lib/product-navigation.ts:26-46`).
- Phone bottom bar `bottomBarItems` (`lib/navigation.ts:134-141`) → `components/shell/mobile-navigation.tsx`. Personal: Home, Explore, Applications, My Clubs + More. Club: first four of whichever rail section holds the current page, so it swaps between Recruiting and Club sets.
- More drawer: `sidebar()` in `product-shell.tsx:175-182` → `workspace-navigation.tsx`.
- Workspace switcher pill `components/shell/workspace-selector.tsx`, hidden ≤759px (`floating-header.css:92-102`); phone-only copy in the account menu (`product-shell.tsx:191`, `PHONE_QUERY`).
- Rail visible ≥1024px (`navigation-rail.tsx`, `authenticated-product.css:32-41`); bottom bar ≤1023px. Already matches the ≥1024px rule in 5i.
- ⌘K `components/shell/navigation-search.tsx`, page list passed at `product-shell.tsx:213`: personal = `studentNav` + My Clubs, Notifications, Profile; club = `adminNav` (Applicants, Interviews, **Interview workspace**, **Messages**, Settings) + Notifications, Profile.
- Bell popover `components/shell/notification-center.tsx`: h2 "Notifications", footer "View all notifications".

### 1.4 Key findings that drive the work
- **Voting data bug (2c).** The Voting room (`components/live-voting/room-landing.tsx`) lists sessions from `listLiveVotingRooms` (`actions/voting-room.ts:28-45`), which filters `mode: "LIVE"`. The Applicants `voting=1` modal (`board-decision-mode.tsx`) lists "Session history" from `getVotingWorkspace` (`actions/voting.ts:48`), which filters `mode: { not: "LIVE" }`. The two lists are **disjoint**: a LEGACY DRAFT Round 1 session created from the modal can never appear in the Voting room. Club home and Recruiting overview read `op.votes` (`utils/dashboard-summary.ts:38`, both modes) and send LIVE sessions to the legacy modal, where they do not load.
- Club home "Voting is live" counts `state === "OPEN"`; "Voting session ready" covers DRAFT. Recruiting Overview builds its own "Needs you" from the same `op.votes` with different rules, so the two disagree.
- Settings → Members & Permissions renders the whole `ClubMembers` page; Settings → Interviews re-renders `InterviewManagementTabs` (`settingsOnly`).
- The "Choose an applicant" picker on Interviewers is **live** (manual applicant panel grants via `setInterviewPanelAssignment`), not dead. It stays, labelled and grouped.
- `interviewListHref` / `clubInterviewHref` (`lib/interview-entry.ts`) carry every query param except a few, so `setting=members` and similar leak into the interview room and back.
- No `pluralize`, no copy file, no `new=1` query anywhere.

---

## 2. Work by phase (files to touch)

### Phase 1 — Glossary
New `lib/copy/terms.ts`: `TERMS`, `pluralize`, `plural`, `formatDateTime` (no seconds), `membershipRoleLabel`, `documentTitle`.

| Item | Change | Files |
|---|---|---|
| Announcements | "Post update" → "New announcement"; "Club updates" card → "Announcements"; ⌘K "Messages" → "Announcements" | `club-home-actions.tsx`, `club-home-sections.tsx`, `lib/views.ts`, `inbox-view.tsx`, `lib/student-agenda.ts` |
| Inbox | page/nav/search title "Inbox"; bell footer "Open inbox"; Home card "Inbox" + "Open inbox" | `lib/views.ts`, `lib/student-routes.ts`, `notification-center.tsx`, `student-dashboard-view.tsx`, `product-shell.tsx`, `dashboard-layout.tsx` |
| Tasks | "assignment(s)" → "task(s)" in UI copy | `club-home-model.ts`, `club-home-sections.tsx`, `task-manager-workspace.tsx`, `lib/welcome.ts`, `student-dashboard-view.tsx`, `club-tasks.tsx`, `viewTitles` |
| Schedule interviews | "Open scheduler", "Finish scheduling", "Open scheduling" → "Schedule interviews" → `interviewTab=schedule` | `club-home-model.ts`, `recruiting-overview.tsx` |
| Interview room | ⌘K "Interview workspace" → "Interview room"; tab "Interview rooms" → "Rooms" | `lib/views.ts`, `interview-management-tabs.tsx`, `interview-rooms-list.tsx` |
| Voting | "Join voting" → "Open voting"; session rows "Continue" → "Open session" | `club-home-model.ts`, `recruiting-overview.tsx` |
| Clubs | "Organizations" → "Clubs" in user copy | `lib/settings-navigation.ts`, `route-workspace-shell.tsx`, `app/settings/organizations/page.tsx`, `organization-memberships.tsx`, `organization-invitations-context.tsx`, `app/club-claims/[clubId]/page.tsx` |
| Explore | "Discover" → "Explore" | `club-profile-view.tsx`, `application-tracker-view.tsx`, `app/settings/organizations/page.tsx` |
| Role label | My Clubs "Leader" → role enum label (Owner/Admin/Recruiting Lead/Interviewer/Member) shared with Settings | `personal-clubs.tsx`, `organization-memberships.tsx`, `lib/organization-authorization.ts` |
| Browse events | "Browse campus events", "Find an event to attend" → "Browse events" → `/corkboard` | `calendar-view.tsx`, `student-dashboard-view.tsx` |
| Pluralization | shared helper at "N applicants", "N applications in this selection", "N results" | `live-leader-workspace.tsx`, `explore-view.tsx`, and others found by grep |
| Timestamps | announcement times via `formatDateTime` | `club-announcements.tsx` |
| Titles | template `"%s · OutClass"`; server `title` on every personal, settings and club-workspace page | `app/layout.tsx`, `app/(product)/*/page.tsx`, `app/settings/*/page.tsx`, `app/club/[clubId]/workspace/page.tsx` |

### Phase 2 — Club recruiting
- **2a** Shared selector `components/club-home/club-home-model.ts` (`needsYou`) is the only "Needs you". Voting cards use real state labels (Draft / Open / Paused / Closed). Recruiting Overview (`recruiting-overview.tsx`) drops its "Needs you", H1 "Recruiting" (`club-workspace.tsx:209`), one "All applicants" link, one "Schedule interviews".
- **2b** Decision filter row (All / Pending / Accepted / Waitlisted / Rejected) on Applicants from `lib/application-decisions.ts` + `lib/pipeline-page.ts`; `tool=rejected` → `tool=applicants&decision=rejected`; Reconsider in the rejected applicant's detail; retention explainer once; remove "Review decisions"/"Review applicants"; Decisions tabs = Voting room + Decision letters; `decisionTab=overview` → Applicants; letters tab without the nested disclosure. Files: `live-leader-workspace.tsx`, `live-applicant-views.tsx`, `lib/pipeline-page.ts`, `club-workspace.tsx`, `decisions-navigation.tsx`, `communications/template-editor.tsx`, `lib/product-navigation.ts`, `lib/voting-navigation.ts`, new `lib/workspace-redirects.ts`.
- **2c** Fix `listLiveVotingRooms` to list both modes (same scope as the modal's history, keeping the room's stricter anonymity and leader/participant filters). Voting room opens LEGACY sessions in the ballot UI at `decisionTab=voting&sessionId=…`; LIVE rows keep the room path. One "Start voting session" (modal's "New voting session" points to the same `/voting/rooms/new` flow). All voting links via one `votingSessionHref`. "Voting history" removed from Applicants; `voting=1` redirects to the Voting room. Default voting rules move to Settings → Recruitment with a link from the room. Selection bar becomes "Add to voting session" only when rows are selected. `/voting/rooms/new` returns into the workspace. Files: `actions/voting-room.ts`, `lib/demo/voting-room.ts`, `room-landing.tsx`, `board-decision-mode.tsx`, `room-setup.tsx`, `voting-rule-defaults.tsx`, `club-settings-workspace.tsx`, `live-leader-workspace.tsx`, `recruiting-overview.tsx`, `club-home-model.ts`, `lib/voting-navigation.ts`.

### Phase 3 — Interviews
- **3a** `components/interviews/room-manager.tsx`, `panel-preview-workspace.tsx`, `booking-publication.tsx`: stepper primary; "Confirm interviewers" action → "Confirm assignments"; one "⋯" overflow (Applicant preview, Booking settings, Assignment rules, Regenerate unlocked assignments, Discard draft); remove "View interviews"; one contextual status action.
- **3b** `components/interview-access-setup.tsx`: one sticky Save / Discard bar for offices and proposed panels; Approve access stays per panel; manual grants picker gets its own labelled section.
- **3c** `club-settings-workspace.tsx`, `lib/club-settings.ts`: Settings → Interviews keeps only eligibility config; tabs removed; `setting=interviews&interviewTab=kits` → `tool=interviews&interviewTab=kits`.
- **3d** `interview-workspace-view.tsx`, `lib/interview-entry.ts`: single Exit (frame), Round select min width, clean URLs.

### Phase 4 — Club other sections
Settings (`club-settings-workspace.tsx`, `lib/club-settings.ts`), Members (`organization-member-management.tsx`), Tasks (`task-manager-workspace.tsx`), Meetings (`meeting-workspace.tsx`, `club-meetings-workspace.tsx`), Announcements (`club-announcements.tsx`), bottom bar (`lib/navigation.ts`, `mobile-navigation.tsx`), new `components/ui/section-tabs.tsx`.

### Phase 5 — Personal workspace
Rail (`lib/navigation.ts`), `STUDENT_ROUTES`, Applications (`application-tracker-view.tsx`, `application-management-card.tsx`), Corkboard (`corkboard-view.tsx`, `public-event-board.tsx`), My Clubs/Tasks/Meetings (`personal-clubs.tsx`, `club-tasks.tsx`), Calendar (`calendar-view.tsx`), Inbox (`inbox-view.tsx`), Profile (`unified-student-profile-view.tsx`), Settings (`lib/settings-navigation.ts`, `personal-settings-layout.tsx`, `app/settings/{profile,organizations}/page.tsx`), Explore (`explore-view.tsx`, `discovery-card.tsx`), switcher (`product-shell.tsx`).

### Phase 6 — Search, redirects, verification
`lib/views.ts`, `product-shell.tsx`, `tests/nav-cleanup-redirects.test.cjs`, `scripts/nav-cleanup-screens.cjs`, `docs/nav-cleanup-screens/`.

---

## 3. Progress log
(Updated per phase below.)

### Phase 1 — done
- `lib/copy/terms.ts`: `TERMS`, `pluralize`/`plural`, `formatDateTime` (no seconds), `membershipRoleLabel` (one label set, also used by `organizationRoleLabels`).
- Renamed in UI: Announcements ("New announcement" on Club home, card title, ⌘K), Inbox (page title, ⌘K, bell heading + "Open inbox", Home card), Tasks (all "assignment" copy in task UI, Club home, Home, welcome lines), "Schedule interviews" (Club home → `interviewTab=schedule`, Recruiting cards), "Interview room" (⌘K), Rooms tab, "Open voting"/"Open session", Clubs (settings, memberships, claims, invitation email copy), Explore ("Back to Explore", "Explore clubs"), "Browse events", role label (My Clubs and Settings now both show Owner/Admin/Recruiting Lead/Interviewer/Member).
- Bell popover: removed the "Expand notifications" icon (same destination as the footer link).
- Pluralization fixed in applicant/voter counts (voting launcher, room setup, presentation, drafts), Applicants totals, Inbox and ⌘K result counts.
- Announcement timestamps use `formatDateTime`.
- Titles: root template `%s · OutClass`; server `title` on all 12 personal pages, all 7 settings pages, and the club workspace (`generateMetadata` → `clubWorkspaceTitle`, `lib/workspace-routes.ts`). Fixed the doubled "| OutClass | OutClass".
- Left as is: the Inbox's "Club updates" group heading is a priority bucket (all non-urgent notifications), not club broadcast posts.
- Gates: typecheck ok; lint 0 errors (23 existing warnings); tests 1767 total, 0 fail after updating label assertions, 60 env-gated skips. New `tests/copy-terms.test.cjs`.

### Phase 2 — done
**Voting data bug (2c), root cause and fix.** `listLiveVotingRooms` (`actions/voting-room.ts`) filtered `mode: "LIVE"`, while the Applicants ballot's "Session history" (`actions/voting.ts`) filtered `mode: { not: "LIVE" }`. The lists were disjoint, so a LEGACY DRAFT Round 1 session never reached the Voting room. The room query now lists every mode and returns `mode` per row (additive field; same inputs). It keeps the room's existing access filters: cycle/round scope, the anonymous-round restriction without `applicants.identify`, and leader/participant visibility for members without `decisions.view`. The demo mirror (`lib/demo/voting-room.ts`) matches. Regression test: `tests/voting-room-foundation.test.cjs` ("lists board (LEGACY) draft sessions…").

- **2a** Club home is the only "Needs you" (`needsYou` in `club-home-model.ts`). Voting cards name the real state ("Voting is open", "Voting is paused", "Voting session · Draft") and link to the Voting room. Recruiting Overview is a "Recruiting" dashboard (H1 "Recruiting", club name as eyebrow), without "Needs you". "Browse all applicants" removed (the "All applicants" link stays). One "Schedule interviews" per page: the "Interviews to schedule" card link, or "Interviews this week" when nothing needs scheduling.
- **2b** Applicants has a decision filter row (All / Pending / Accepted / Waitlisted / Rejected, with counts) backed by the existing pipeline read (`decisionGroup` gains `"all"`, an additive enum value). The filter is in the URL as `decision=`. `tool=rejected` → `tool=applicants&decision=rejected`. Reconsider shows in the detail of any rejected applicant. The retention explainer shows once, only on the Rejected filter. "Review decisions" and "Review applicants" removed. Decisions has two tabs, Voting room and Decision letters. `decisionTab=overview` → Applicants. The Decision letters tab shows the editor inline (no nested "Decision Letters" disclosure); "Review decisions and send letters" is its single primary button.
- **2c** One voting home. Voting room rows show status (Draft / Open / Paused / Closed, Scheduled / Cancelled for live rooms) and "Open session". Board sessions open the ballot in the Voting room (`decisionTab=voting&sessionId=…`); live rooms open the room. `voting=1` on Applicants redirects there. The ballot's own "New voting session" form is replaced by the shared "Start voting session" flow (`/voting/rooms/new`). "Voting history" removed from Applicants. Default voting rules moved to Settings → Recruitment & Applications (`#voting-rules`), and the Voting room links there. The selection bar says "N selected · Add to voting session" and only shows with a selection; the per-card "Select for voting" text is gone (the checkbox keeps its accessible name). `/voting/rooms/new` and the room both return to the Voting room ("Back to Voting room").
- Redirects: `lib/workspace-routes.ts` `canonicalClubWorkspaceQuery`, applied by the server page (redirect) and the client workspace (replace). `tests/nav-cleanup-redirects.test.cjs`.
- Navigation: "Rejected Applicants" removed from the rail. The Decisions item shows only with voting or letters access, and opens the Voting room (or Decision letters).
- Gates: typecheck ok; lint 0 errors (23 warnings, same as baseline); tests 1777, 0 fail, 60 env-gated skips.
