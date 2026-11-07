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

### Phase 3 — done
- **3a Scheduling.** The 4-step stepper is the way through the page. The header has "Set My Availability" (links to `/settings/availability`) and one "⋯" menu (`components/interviews/scheduling-tools.tsx`, aria-label "More scheduling actions"). The menu holds Applicant preview and Booking settings, plus the current step's items: Assignment rules, and, with a draft, Regenerate unlocked assignments and Discard draft. No modal opens from the menu. Removed "View interviews" (same as Rooms), "Team availability" (same as step 1) and the "Schedule options" modal. The step action says "Confirm assignments". Recheck availability, Review slots and Review conflicts stay in the step's Staffing issues banner; Review changes and Schedule history stay in its Schedule status banner. Both are status banners for the current step, and the browser tests rely on their focus-return behavior. When the panel step renders outside the Scheduling tab, it shows the same "⋯" menu itself.
- **3b Interviewers.** Per-person "Save offices for {name}" and per-panel "Save proposed panel" are replaced by one sticky Save / Discard bar ("N unsaved changes", `data-unsaved` so navigation guards apply). "Approve access" stays per panel (separate owner attestation). The "Choose an applicant" picker is live (manual per-applicant grants via `setInterviewPanelAssignment`), so it stays on this tab, collapsed under "Manual panel access for one applicant" with a one-line explanation.
- **3c Settings → Interviews removed.** `setting=interviews` (any `interviewTab`) redirects to `tool=interviews&interviewTab=<tab or kits>`. Interviewer eligibility, the only non-operational setting there, moved to Settings → Members & Permissions. `interviewSetupHref` always targets the Interviews tool. For access parity, interview participants and recruitment managers now see the Interviews rail item.
- **3d Interview room.** Removed both "Back to interviews" buttons; the focus frame's Exit is the single exit. The Round select has `min-w-48`. `clubInterviewHref` and `interviewListHref` keep only interview parameters (applicationId, roundId, slotId, interviewDate, …), so `setting=members` and similar never carry over.
- Gates: typecheck ok; lint 0 errors (23 warnings, baseline); tests 1779, 0 fail, 60 env-gated skips.

### Phase 4 — done
- **Settings is configuration only.** Members & Permissions shows Interviewer eligibility and a read-only "Roles and permissions" summary (from `organizationRolePermissions` and `permissionLabels`) with a "Manage members" link. It no longer renders the Members page. "General" is now "Public profile". Settings already had a side list on wide screens and a select on phones (≤1100px), so that stays. "Active members" suggests the real active roster count (members who can read the roster): an empty field shows the roster count as its placeholder, and a "Use roster count" link fills it in. *(Changed after CI: an earlier version keyed the editor on the count and remounted it when the count loaded, discarding edits in progress. The application-writing E2E caught it.)*
- **Members.** One "Add members ▾" split button: "Add member", plus Invite members, Import CSV and Create groups in its menu (aria-label "More ways to add members"). The Members "Settings" button is removed; eligibility lives in Settings → Members & Permissions. The Year filter is one class-year option set: invitation graduation years are shown as class years with `academicYear()` and sorted with `compareAcademicYears`. "Create group(s)" left the filter row.
- **Tasks.** "Create task ▾" split button with New project in its menu. The empty state's button says "Create task" and calls the same handler. The mixed view row is now **Status** (Active / Needs review / Overdue / Completed, with counts) and **Group by** (None / Project / Member). The metric buttons that repeated the status chips are gone; only the extra "Due this week" filter remains.
- **Meetings.** "See past meetings" / "See upcoming meetings" removed. Member Meetings / Corkboard Events, Upcoming / Past and Audience sit in one toolbar (`role="toolbar"`, "Meeting filters"). `section=meetings&new=1` opens the New meeting form; Club home's "New meeting" uses it. `section=announcements&compose=1` opens the composer; Club home's "New announcement" uses it.
- **Phone bottom bar.** One fixed set for club workspaces: Club home · Recruiting · Meetings · Members · More. A member without a destination gets Tasks, Announcements or Settings instead. Recruiting stays active on every recruiting page (`matches`), and those pages show their sub-tabs in-page on phones ("Recruiting sections"). Every bar link has an `aria-label`.
- **`SectionTabs`** (`components/ui/section-tabs.tsx`) is the one tab look. It is used by Decisions, the phone Recruiting tabs, and the Interviews tablist (Radix semantics, same classes).
- Gates: typecheck ok; lint 0 errors (23 warnings, baseline); ui-controls guard OK; tests 1786, 0 fail, 60 env-gated skips. New `tests/nav-cleanup-structure.test.cjs`.

### Phase 5 — done
- **5a Menu: 11 → 7.** Home · Explore · Events · Applications · My Clubs · Calendar · Profile (`personalRailSections`). Settings is in the account menu, Inbox behind the bell. Applications has the stage tabs **Drafts / In review / Interviews / Decisions**. Counting is shared with the Home "Your applications" card (`lib/application-stages.ts`), and the selected tab is in the URL (`?tab=`). The "N drafts / N submitted" stat boxes are gone. `/applications/status` → `/applications?tab=in-review`, and old `?view=status|interviews|decisions` URLs, `/interviews` and `/decisions` land there too, keeping every parameter. The Corkboard nav label is "Events", the in-page toggle is "Board / List", and the subtitle "Events on Grounds" matches the default "All" filter. Meetings and Tasks left the rail. `/clubs/meetings` → `/calendar?type=meeting`, which opens Calendar filtered to club meetings. `/clubs/tasks` stays routable and is linked from My Clubs ("Your tasks across clubs") and the Home "Needs you" card. Personal Meetings/Tasks cover every club by default, with an optional "Club" filter. Personal Tasks replaces the Due/Missing/Submitted boxes and the "Show tasks" select with a **Status** select (counts in its options) and a **Group by** control (None / Project). Tutorial steps point at existing rail items.
- **5b Inbox.** Titled Inbox and in ⌘K; the bell's footer link reads "Open inbox". The Email preferences tab is replaced by a link to `/settings/notifications`, and `/inbox?tab=preferences` redirects there (sent emails still use that URL). The default filters are All/Unread and a club filter; search, read status, sort and Announcements/Interviews/Urgent are behind one "Filter" popover. Filters are hidden when there are fewer than 5 items and nothing is filtered.
- **5c Availability.** "Set My Availability" is removed from Profile. Calendar has one outline "Availability" button and club Scheduling keeps "Set My Availability"; both link to `/settings/availability`.
- **5d Profile.** One "Edit profile" button opens the editor with a section switcher (Name & photo / Education / Experience / Links & résumé); switching flushes the autosave first. "Import from résumé" sits inside the editor. "Preview" stays. The other edit entry points are removed (Edit ×2, Edit links & résumé, Edit structured experience, Education Edit).
- **5e Settings.** Account & Security, Notifications and Availability only. `/settings/profile` → `/profile`. `/settings/organizations` → `/clubs`, and My Clubs now shows pending invitations and ownership requests (`OrganizationOwnershipRequests`) plus "Find or claim a club". Club entries are removed from personal settings. The section dropdown is gone: phones use the overview list and section pages show "← All settings".
- **5f Explore.** "Refine search" stays a collapsed `<details>`. A filter shows only with at least 2 real options; the acceptance filter and sort show only when at least 3 clubs report a rate (the filter is hidden when neither applies). Cards show one "Unclaimed" badge.
- **5g Applications closed.** A closed club's draft card says "Applications are closed, so this draft can’t be submitted", and its button is a secondary "View draft".
- **5h Calendar.** With no events, only the empty agenda shows; Month/Week/Day and the filters appear once there are events. "Club agendas and recaps" is now the "Club meetings" option in the type filter.
- **5i Workspace switcher.** The account menu lists Personal / club / Admin at every width; the header pill stays as a shortcut on wider screens. ≥1024px already used the left rail instead of the bottom bar.
- Gates: typecheck ok; lint 0 errors (23 warnings, baseline); ui-controls allowlist tightened (club-tasks no longer needs a raw-toggle entry); tests 1786, 0 fail, 60 env-gated skips.

### Phase 6 — done
- **⌘K.** "Messages" is now "Announcements" and "Interview workspace" is now "Interview room"; "Inbox" is added. Every rail destination is searchable once: `NavigationSearch` takes the shell's rail links, skips any whose title is already a view entry, and adds Settings. "Applicants" now has one entry ("All Applicants"), and Recruiting overview is listed as "Recruiting". No entry points to a removed page; `tests/nav-cleanup-structure.test.cjs` and the screenshot audit check this.
- **Redirect tests.** `tests/nav-cleanup-redirects.test.cjs` covers every removed or renamed URL and checks that other parameters are kept: `tool=rejected`, `decisionTab=overview`, `voting=1`, `setting=interviews` (every tab), the older `tool=voting|letters|cycles` and `section=events`, `/applications/status`, `/clubs/meetings`, `/settings/profile`, `/settings/organizations`, `/inbox?tab=preferences`, `/?workspace=student&view=status|my-clubs…`, `/interviews` and `/decisions`. It also checks that interview-room links start from a clean URL.
- **Screens.** `scripts/nav-cleanup-screens.cjs` visits all 8 personal and 10 club destinations at 390px and 1280px and writes 36 screenshots plus `report.json` to `docs/nav-cleanup-screens/`. Result: **0 findings** for duplicate destinations in any nav/toolbar/group, axe `button-name` / `link-name` / `aria-command-name` / `aria-toggle-field-name` (icon-only controls), and removed ⌘K entries.
  - **Limit:** this container has no Docker daemon, so the disposable Supabase stack cannot run. The screens use the isolated shell fixture: the real ProductShell, rail, phone bar, header, account menu and ⌘K, with fictional identity and placeholder page bodies. Page bodies and their H1s are therefore not exercised by the screenshots. Instead, "H1 is not the club name except Club home" holds in code: the Recruiting dashboard H1 is "Recruiting", other pages use the nav label with the club name as eyebrow, and `clubWorkspaceTitle` sets the `<title>`. "The Voting room lists the existing draft session" is covered by `tests/voting-room-foundation.test.cjs` (server query returns the LEGACY DRAFT with its mode) and `tests/voting-navigation-browser.test.cjs` (room list rendering). Re-run the screenshot script against the dashboards E2E stack (`pnpm run test:dashboards:e2e`) on a machine with Docker for full-page screens.

---

## 4. Before / after

Counts are user-facing controls on the page itself (buttons, links, tabs and filter controls in the page body), excluding the shell (rail, header, phone bar). Counts were taken from the source for the states named.

| Page | Controls before | Controls after | Routes removed or redirected |
|---|---|---|---|
| Club home (owner) | Post update, New meeting; Needs you: Join voting / Open scheduler / Open applicants…; Club updates → Announcements; Team assignments | New announcement (opens composer), New meeting (opens form); Needs you: **Open voting** (Voting room), **Schedule interviews** (Scheduling tab), Open applicants; Announcements card → All announcements; Team tasks | — |
| Recruiting overview | Club-name H1, own Needs you (up to 5 actions), All applicants + Browse all applicants, Finish scheduling ×(1 + rounds), Open scheduling, Continue/Join session per vote | "Recruiting" H1, no Needs you, All applicants once, one Schedule interviews, Open session per vote | — |
| Applicants | Quick review, Voting history, Review decisions, view toggle, filters, per-card "Select for voting" | Quick review, **Decision** filter (All/Pending/Accepted/Waitlisted/Rejected), view toggle, filters; checkboxes plus an "Add to voting session" bar only with a selection; Reconsider in a rejected applicant's detail | `tool=rejected` → `tool=applicants&decision=rejected`; `voting=1` → Voting room |
| Rejected Applicants | Separate page; retention explainer ×3 | Removed (Applicants → Rejected); explainer once | redirected |
| Decisions | Overview / Voting room / Decision letters tabs; Review applicants; letters tab with nested "Decision Letters" disclosure + outline button | Voting room / Decision letters (SectionTabs); letters inline with one primary "Review decisions and send letters" | `decisionTab=overview` → Applicants |
| Voting room | Lists LIVE rooms only ("No voting sessions available" with a DRAFT board session); Default voting rules inline; Start voting session; modal "New voting session" | Lists every session with Draft/Open/Paused/Closed; one Start voting session (also inside the ballot); Default voting rules link → Settings; board sessions open in place | — |
| Scheduling | Set My Availability, Team availability, View interviews, Schedule options (modal), Schedule tools (menu), stepper ×4, Confirm interviewers, Recheck/Review slots/Review conflicts/Review changes/Schedule history | Set My Availability, one "⋯" menu (Applicant preview, Booking settings, Assignment rules, Regenerate unlocked assignments, Discard draft), stepper ×4, **Confirm assignments**; status banners keep Recheck/Review slots/conflicts and Review changes/Schedule history | — |
| Interviewers | Save offices for {name} ×members, Save proposed panel ×rooms, Approve access ×rooms, applicant picker | One sticky Save / Discard bar, Approve access ×rooms, picker under "Manual panel access for one applicant" | — |
| Settings → Interviews | Re-rendered Interviews tabs + Interviewers sheet | Removed; eligibility moved to Members & Permissions | `setting=interviews` (+ any `interviewTab`) → `tool=interviews&interviewTab=…` |
| Interview room | Back to interviews ×2 + frame Exit | Frame Exit only | links drop non-interview params |
| Club Settings | General; Members & Permissions = full Members page | Public profile; Members & Permissions = eligibility + role summary + Manage members link | — |
| Members | Add member, Invite members, Import CSV, Settings, Create group(s) in filters | One "Add member ▾" (Invite, Import CSV, Create groups); class-year-only Year filter | — |
| Club Tasks | New project, Create task, empty-state New task, 4 metric buttons, 6-way view row | "Create task ▾" (New project), empty-state Create task (same handler), Due this week, **Status** + **Group by** | — |
| Club Meetings | Member Meetings/Corkboard Events, Upcoming/Past, Audience (3 rows), See past meetings | One toolbar with the three; empty state without a toggle duplicate | `new=1` opens the form |
| Phone bar (club) | Swapped between 4 recruiting and 4 club items | Fixed: Club home · Recruiting · Meetings · Members · More | — |
| Personal rail | 11 items | 7 items | — |
| Applications | All/Drafts/Submitted + 2 stat boxes; separate Status page with 5 filters | Drafts / In review / Interviews / Decisions (shared with Home) | `/applications/status` → `/applications?tab=in-review` |
| Personal Meetings | Required club picker | Calendar "Club meetings" filter | `/clubs/meetings` → `/calendar?type=meeting` |
| Personal Tasks | Required club picker, Due/Missing/Submitted boxes, Show tasks select | All clubs by default (optional filter), Status select with counts, Group by | — |
| Inbox | Updates / Email preferences tabs, search, read select, club select, sort, type chips | All/Unread, club filter, one Filter popover; hidden under 5 items; Email preferences link | `/inbox?tab=preferences` → `/settings/notifications` |
| Profile | Edit ×2, Edit links & résumé, Edit structured experience, Education Edit, Import PDF into profile, Set My Availability, Preview | Edit profile (sections + Import from résumé), Preview | — |
| Personal Settings | Profile, Account, Notifications, Organizations, Availability + club entries + section dropdown | Account & Security, Notifications, Availability; list on phones | `/settings/profile` → `/profile`; `/settings/organizations` → `/clubs` |
| Explore | Refine (time incl. single-option, acceptance), Availability, Sort (incl. acceptance); 2 unclaimed badges | Filters only with ≥2 options; acceptance with ≥3 reporting clubs; one "Unclaimed" | — |
| Calendar | Agenda/Month/Week/Day + type/past/declined filters when empty; Club agendas link; Set My Availability | Empty: agenda only; "Club meetings" filter; one "Availability" | — |
| Bell popover | Expand icon + View all notifications | Open inbox | — |

### Not changed (decided)
- Inbox "Club updates" group heading: it is a priority bucket for all non-urgent notifications, not club broadcast posts.
- Sent emails keep `/inbox?tab=preferences` and `/?next=%2Fsettings%2Forganizations`; both redirect.
- Club Settings already had a side list on wide screens and a select on phones.
- `/clubs/tasks` remains a page (linked from My Clubs and Home).

### CI follow-up (PR #157)
- **application-writing E2E:** the Public profile editor remounted when the roster count arrived, discarding the in-progress logo-background edit. Fixed: the count is now a suggestion only, and a regression test is in `nav-cleanup-structure`.
- **dashboards, settings-navigation, student-paths, focus-frame, onboarding and authenticated-accessibility E2E:** updated for intended changes. These are the "Open session" label, `/settings/profile` → `/profile`, `/settings/organizations` → `/clubs`, the Settings list on phones, Settings → Interviews → Interviews tool, the letters tab without the disclosure, `/applications/status` and `/clubs/meetings` redirects, and the Calendar rail item.
- `/settings/organizations` keeps its sign-in and profile-completion gate before redirecting, so invitation emails still lead first-time users through the profile wizard.
- Codex review: the profile editor reopen snapshot, résumé-import sync, and invitations for people without a club are all fixed, with tests.
