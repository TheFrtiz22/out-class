# OutClass web app at phone width: visual and behavioural reference

Reference for the native app port. It describes what the web app renders at a 390 × 844 CSS px phone viewport for the seeded staging accounts, with exact copy, so native screens can be built without opening a browser. Screenshots live in `docs/mobile/screenshots/web/`.

- **Captured:** 2026-11-18 (Eastern), branch `mobile/foundation`, local dev server on `localhost:3000` against the disposable staging database (fictional seed data from `scripts/staging/seed.cjs`).
- **Device emulation:** Chromium (Playwright), 390 × 844 viewport, deviceScaleFactor 3, mobile user agent (iPhone 14), `isMobile` + `hasTouch`, light colour scheme, `en-US`, `America/New_York`.
- **Accounts:** seeded `student` ("Sam Staging-Student", initials SS) for every student screen; seeded `alumni` ("Alex Staging-Alumni", AS) for 63–65b; seeded `leader` ("Lee Staging-Leader", LS, Blue Ridge Consulting Collective, short label BRCC) for 66–67. Sign-in went through the real `/login` form.
- **Script:** `scripts/staging/web-screenshots.cjs` (re-runnable; `--role=`, `--only=<regex on NN-name>`). Read-only: it opens pages, sheets, menus and types into search fields. It never submits, books, responds, RSVPs or saves settings.
- **How this document was built:** layout, copy, icons and behaviour were read from source (`components/views/*`, `components/shell/*`, feature components, `styles/*`), then checked against the screenshots and against text dumps of each rendered page. Statements that no capture or source line settles are marked "(unverified)".

## How to read the screenshots

| File pattern | What it is |
|---|---|
| `NN-name.png` | Whole page. The viewport is grown to the document height (max 5400 CSS px) so the fixed header sits at the top and the dock at the bottom of the image, exactly once. Pages taller than 5400 px are cut there (Explore, Events board, Calendar agenda/week, Meetings): the rest of the list repeats the same rows. For open overlays (menus, sheets, dialogs) this is a plain 390 × 844 capture. |
| `NN-name.viewport.png` | First 390 × 844 viewport only, as a phone shows it on arrival: header and dock in their real positions. Provided for the five tabs and a few key screens. |
| `NN-name.full.png` | An open dialog or drawer whose content scrolls inside it, captured with the viewport grown so the whole content shows. |

All images are 1170 px wide (3×). Divide pixel measurements by 3 for CSS px / points.

The Next.js development indicator was hidden for the captures; it is not part of the product.

## Screenshot index

| # | File(s) | Screen | Route |
|---|---|---|---|
| 01 | `01-home.png`, `01-home.viewport.png` | Home | `/home` |
| 02 | `02-home-first-run-guide.viewport.png`, `02-home-first-run-guide-help-chip.viewport.png` | First-run tutorial card (step 1 of 8) and the "Tutorial help" chip left after skipping | `/home` |
| 03 | `03-header-search.png`, `03b-header-search-typed.png` | Header search overlay, empty and with "lawn" typed | any |
| 04 | `04-header-notifications.png` | Notification popover from the bell | any |
| 05 | `05-header-account-menu.png` | Account menu from the avatar | any |
| 06–09 | `06-applications-drafts.png` (+`.viewport`), `07-applications-in-review.png`, `08-applications-interviews.png`, `09-applications-decisions.png` | Applications, four tabs | `/applications`, `?tab=in-review`, `?tab=interviews`, `?tab=decisions` |
| 10 | `10-my-clubs.png` | My Clubs | `/clubs` |
| 11 | `11-tasks.png`, `11b-tasks-status-menu.png`, `11c-tasks-group-menu.png` | Tasks and its Status / Group by menus | `/clubs/tasks` |
| 12 | `12-task-detail.png`, `12-task-detail.full.png` | Task detail drawer | `/clubs/tasks` |
| 13 | `13-explore.png`, `13-explore.viewport.png` | Explore clubs | `/explore` |
| 14–15 | `14-explore-search-typed.png`, `15-explore-search-empty.png` | Explore search "consulting"; no-results search "zzzqqq" (empty state) | `/explore` |
| 16 | `16-explore-filter-panel.png`, `16b-explore-filter-sheet.png` | Explore inline filter panel, then the "Filter clubs" bottom sheet | `/explore` |
| 17–19 | `17-explore-more-interests.png`, `18-explore-saved-clubs-popover.png`, `19-explore-category-selected.png` | More interests expanded; Saved clubs popover; "Finance & Investing" selected | `/explore` |
| 20 | `20-explore-categories.png` | Categories route (renders the same Explore screen) | `/explore/categories` |
| 21–23 | `21-events-list.png` (+`.viewport`), `22-events-board.png`, `23-events-filters.png`, `23b-events-when-menu.png` | Events: list, board, Filters sheet, When menu | `/corkboard` |
| 24 | `24-event-detail.png`, `24-event-detail.full.png` | Event detail dialog | `/corkboard` (dialog; the card links to `/corkboard?event=<id>`) |
| 25 | `25-saved-clubs.png` | Saved clubs | `/saved-clubs` |
| 26 | `26-club-blue-ridge-consulting.png` (+`.viewport`) | Club page, student is a member | `/club/blue-ridge-consulting` |
| 27–29 | `27-club-lawn-street-capital.png`, `28-club-share-menu.png`, `29-club-report-dialog.png` | Club page with an application in the Interview round; Share sheet; Report dialog | `/club/lawn-street-capital` |
| 30–33 | `30-inbox.png` (+`.viewport`), `31-inbox-unread.png`, `32-inbox-read.png`, `33-inbox-filters.png` | Inbox: All, Unread, Read, Filters sheet | `/inbox` |
| 34 | `34-inbox-preferences.png` | Notification settings sheet | `/inbox?tab=preferences` |
| 35–38 | `35-calendar-agenda.png` (+`.viewport`), `36-calendar-month.png`, `37-calendar-week.png`, `38-calendar-day.png` | Calendar views | `/calendar` |
| 39–41 | `39-calendar-filters.png`, `40-calendar-subscribe.png`, `41-calendar-event-detail.png`, `41b-calendar-interview-detail.png` | Calendar filters, Subscribe dialog, event detail, booked-interview detail | `/calendar` |
| 42 | `42-meetings.png`, `42b-meetings-detail-sheet.png` | Club meetings list and the detail sheet a row opens | `/meetings` |
| 43 | `43-meeting-detail-live.png` | Meeting detail, live members meeting, as a member | `/meetings/<id>` |
| 44–45 | `44-profile.png` (+`.viewport`), `45-profile-edit.png` | Profile; Edit profile dialog | `/profile` |
| 47–51 | `47-settings.png`, `48-settings-account-and-delete.png`, `49-settings-availability.png`, `50-settings-interests.png`, `51-settings-interviews-empty.png` | Settings overview and subpages (51 is an empty state) | `/settings`, `/settings/account`, `/settings/availability`, `/settings/interests`, `/settings/interviews` |
| 52 | `52-application-form-draft.png` | Application form, draft at Piedmont Founders Lab | `/applications` (in-page) |
| 53 | `53-application-status-in-review.png` | Application status detail, In review | `/applications?tab=in-review` (in-page) |
| 54 | `54-interview-booking.png` | Interview booking, Lawn Street Capital (nothing booked) | `/applications?tab=interviews` (in-page) |
| 55 | `55-interview-booked.png` | Booked interview, Corner Code Collective | `/applications?tab=interviews` (in-page) |
| 56–57 | `56-decision-rejected.png`, `57-decision-letter-rejected.png` | Not-selected detail and its decision letter (Albemarle Data Science Circle) | in-page, then `/applications/<id>/decision` |
| 58–59 | `58-offer-pending.png`, `59-offer-letter.png` | Pending offer detail and its letter (Rotunda Equity Research Society); not responded to | in-page, then `/applications/<id>/decision` |
| 60–61 | `60-member-workspace.png` (+`.viewport`), `61-member-workspace-more-sheet.png` | Club workspace as a plain member; More navigation drawer | `/club/<clubId>/workspace` |
| 62 | `62-loading-skeleton-1.png`, `-2.png`, `-3.png` | Throttled Home → Calendar navigation: before, loading skeleton ("Loading your schedule…"), loaded | `/calendar` |
| 63 | `63-alumni-home.png` (+`.viewport`), `63a-alumni-first-run-guide.viewport.png`, `63a-alumni-first-run-guide-help-chip.viewport.png` | Alumni account: Home (also shows the Applications and My Clubs empty states) and its first-run guide | `/home` |
| 64–65 | `64-alumni-explore.png`, `65-alumni-club-blue-ridge-consulting.png`, `65b-alumni-member-workspace.png` | Alumni account: Explore, club page (read-only state), club workspace | `/explore`, `/club/blue-ridge-consulting`, `/club/<clubId>/workspace` |
| 66 | `66-leader-meeting-host.png` (+`.viewport`), `66a-leader-first-run-guide.viewport.png`, `66a-leader-first-run-guide-help-chip.viewport.png`, `66b-leader-check-in-qr-open.png` (+`.viewport`), `66c-leader-check-in-presenter.png` | Leader: live meeting host view with check-in closed, with the attendance QR open, and the Present dialog; leader first-run guide | `/meetings/52fd84d2-ca4e-439c-b794-03ca91eca68b` |
| 67 | `67-leader-voting-room.png` (+`.viewport`) | Leader voting room before starting (nothing pressed) | `/voting/rooms/e89ed370-6e82-4b3d-a454-091e0b109207?clubId=253d3ff8-35eb-4619-81bf-c7c195bbf4fe&view=leader` |

There is no 46: the Profile "Preview" control is disabled for the seeded student (no LinkedIn or résumé), so its menu could not be opened.

## First-run gates met

Each of the three seeded accounts met exactly one gate after sign-in: the tutorial walkthrough card titled "Your OutClass guide" (all three land on `/home`, the personal workspace, so the leader also got the student guide; the separate "Leader workspace guide" belongs to the club workspace and was not opened), shown above the dock on the first signed-in page. It was captured, then dismissed with **Skip** (saved to the account), which leaves a "Tutorial help" chip above the dock; the chip was captured and closed with its own "Hide Tutorial help" button (remembered per browser). No terms acceptance, onboarding wizard, availability requirement, interest survey or two-step prompt appeared for these accounts. The Global chrome section lists the gates that exist in source and when they trigger.

## State changes made while capturing

- Tutorial walkthrough skipped for the student, alumni and leader accounts (on the student account it was reopened once from "Tutorial help" to capture it, then skipped again).
- Leader: **Open attendance QR** was pressed on the live meeting to capture the QR host view (66b, 66c). Check-in was left open; nothing was closed.
- Nothing else was written: no application submitted, no interview booked, no offer answered, no RSVP, no setting saved, no notification opened (opening one marks it read), no vote started.

## Global chrome

Evidence note: verified against the captures in `docs/mobile/screenshots/web/` and text dumps of the rendered pages for 01, 02 (guide + help chip), 03, 03b, 04, 05, 13, 30, 35, 44, 57, 60, 61, 62-1..3, 63a, 66, 66a, 67. Seeded accounts: student `Sam Staging-Student` (SS), alumni `Alex Staging-Alumni` (AS), leader `Lee Staging-Leader` (LS). Statements still marked "(source only)" are things no capture shows.

All px values are for a 390 px wide viewport. Colours: navy `#232d4b` (`--primary`/`--foreground`), canvas `#f6f5f1` (`--background`), card `#fffefa`, muted text `#52606d`, orange `#e57200` (`--brand-orange`), border `#dfe3dd`.

### G1 · Phone header (fixed top bar)
- **Route:** every signed-in workspace route (`app/(workspace)/layout.tsx` mounts it once; it never remounts on navigation)
- **Screenshot:** `docs/mobile/screenshots/web/01-home.viewport.png` (+ `01-home.png`), same header on `13-explore.viewport.png`, `30-inbox.viewport.png`, `35-calendar-agenda.viewport.png`, `44-profile.viewport.png`; leader pill variant on `66-leader-meeting-host.viewport.png` and `66a-leader-first-run-guide.viewport.png`
- **Source:** `components/shell/product-shell.tsx`, `floating-header-controls.tsx`, `floating-header.css`, `workspace-selector.tsx`, `components/outclass-logo.tsx`, `components/account-avatar.tsx`, `styles/navigation-glass.css`
- **Layout (left to right):**
  1. `header.oc-product-header`: `position: sticky; top: 0; z-index: 40`; padding `10px 12px`; transparent itself, `pointer-events: none` (only its children take touches). Total height 68 px (row min-height 48 + 20 padding).
  2. Behind the row, a frosted band (`::before`, full header box): `linear-gradient(150deg, rgb(255 255 255 / 34%), transparent 50%), rgb(255 251 245 / 96%)`, with a mask that fades the bottom 20 px to transparent. No backdrop blur on the band itself. No border or shadow. Result: content scrolls under the header and dissolves into a cream band; page headings never show through.
  3. Row: CSS grid `minmax(0,1fr) auto`, gap 8 px, vertically centred.
  4. Left cell: **logo button** `button.oc-product-brand`, aria-label `OutClass home`, min-height 44 px, padding-right 8 px, radius 6 px. Contains `OutClassLogo` default variant `light` = `/brand/premium-board/02_primary_lockup.svg` (two-tone navy/orange wordmark with the sword; intrinsic 457x141) at height 28 px (`h-7`), width auto (about 91 px). Tap: `navigate("student-dashboard")` -> `/home`.
  5. Right cell `.oc-product-utilities`: flex, gap 6 px, three 44x44 circles in this order: search, bell, account.
- **Circle controls (`.oc-floating-circle`, all three):** 44x44 px, radius 999 px, icon 20x20, icon colour `#232d4b`.
  - Fill (`--oc-glass-light-material`): `radial-gradient(ellipse at 12% 0%, rgb(255 255 255 / 65%), transparent 55%), linear-gradient(174deg, rgb(255 255 255 / 26%), transparent 48%, rgb(152 176 201 / 10%)), rgb(255 251 245 / 78%)`; `backdrop-filter: blur(18px) saturate(135%)`. Fallback solid `#faf8f3`.
  - Border 1 px `rgb(255 255 255 / 68%)`.
  - Shadow (`--oc-glass-light-depth`): `inset 0 1px 0 rgb(255 255 255 / 95%), inset 1px 0 0 rgb(255 255 255 / 40%), inset 0 -1px 0 rgba(35,45,75,.12), 0 3px 6px rgb(12 29 47 / 5%), 0 12px 28px -12px rgb(12 29 47 / 24%)`.
  - Pressed: inset tint `color-mix(#232d4b 9%, transparent)` over the fill + `scale(.98)` (settle 90 ms ease-out, release on a 355 ms spring). Reduced motion: tint only.
  - Focus: 2 px `#c86400` outline, offset 3 px.
- **Search trigger:** `Button variant="ghost"` `.oc-floating-search`; at <=1399 px it is icon-only (label "Search OutClass" and the `kbd` hint are `display:none`). Icon `Search` size 20. aria-label `Search OutClass ⌘ K` on Apple platforms (incl. iPhone), else `Search OutClass Ctrl K`; `aria-haspopup="dialog"`, `aria-expanded`. Same glass circle as above (painted on its `::before`). While the overlay is open the circle's border darkens (navy 30%). Opens the search overlay (G3). Also opened by Cmd/Ctrl+K.
- **Bell:** `IconButton` with `Bell` (regular). aria-label: `Notifications` when nothing pending; otherwise `Notifications, {unread} unread` plus `, {n} pending invitation` / `invitations` when invitations exist. Seeded: student `Notifications, 17 unread` (16 after one was read), leader `Notifications, 3 unread`, alumni `Notifications` (no dot). Unread dot `.oc-floating-unread` shown when `unread + pendingInvitations > 0`: 6x6 px circle `#e57200`, positioned `top:10px; right:10px`, with a 2 px `#faf8f3` halo ring. No number on the bell. Opens the notification popover (G4).
- **Account avatar:** `IconButton` (`data-tour="profile"`), aria-label `Account menu for {First Last}, {initials}` (seeded: `Account menu for Sam Staging-Student, SS`; `…Lee Staging-Leader, LS`; `…Alex Staging-Alumni, AS`). Inside the 44 px glass circle: 32 px round `Avatar`; photo if `profile.headshotUrl` exists, else initials fallback: background `#eaece8`, text `#34485a`, 12 px, weight 500. Initials rule: first letter of first + last name, uppercased; with no profile name, two letters from the email local part; last resort `OC`. Opens the account menu (G5).
- **Workspace pill on phones:**
  - Student with no leader club: **no pill**. `WorkspaceSelector` returns `null` when there are fewer than 2 options; the logo button shows.
  - Plain member of a club (role Member, no leadership office or club permission): **also no pill**. The club option only exists for memberships passing `hasWorkspace` (owner, President/Vice President/Board office, or any club permission). The seeded student (Member of two clubs) sees the logo.
  - Leader (seen in `66-leader-meeting-host.viewport`, `66a-leader-first-run-guide.viewport`): the logo is gone and a two-segment pill `Personal` | `BRCC` sits at the left (about 172x50 px); `Personal` is the selected navy segment with cream text on personal routes, including `/meetings/{id}`. Controls dump has no `OutClass home` button for the leader. General rule, leader or admin: the logo is hidden and a mini pill takes its place (2 segments: 176 px wide, 3 segments: 236 px; height 50 px, padding 2 px, segments 44 px tall, 12 px weight 500 labels, club shown by its short label, navy sliding indicator with cream `#fff7ec` selected text). The account menu additionally lists workspaces by full name.
- **Hidden controls at phone width:** the "Open navigation" hamburger (`.oc-floating-drawer`) is `display:none`; the left navigation sheet is only reachable through the dock's "More" button (member-in-club and leader variants).
- **Scroll behaviour:** header stays pinned; no hide-on-scroll, no size change. On every change of section the page scrolls to top instantly and focus moves to `<main>`. `document.title` = `{page title} · OutClass`.
- **Skip link:** first focusable element, visually hidden until focused: `Skip to content` (`#workspace-content`).

### G2 · Five-tab dock (phone bottom bar)
- **Route:** all workspace routes at <=1023 px
- **Screenshot:** `01-home.viewport.png`, `13-explore.viewport.png`, `30-inbox.viewport.png`, `35-calendar-agenda.viewport.png`, `44-profile.viewport.png`, `60-member-workspace.viewport.png`, `61-member-workspace-more-sheet.png`
- **Source:** `components/shell/mobile-navigation.tsx`, `lib/navigation.ts` (`bottomBarItems`, `activeNavItem`), `components/shell/responsive-workspace.css` lines 25-40, `styles/navigation-glass.css`, `styles/pressed-states.css`
- **Tabs (personal workspace, in order):**

| # | Label | href | Icon (semantic name, size 20) | Lit on |
|---|---|---|---|---|
| 1 | `Home` | `/home` | `Home` | `/home`; plus `matches`: `applications` (`/applications`, `/applications/status`, `/applications/*`), `tasks` (`/clubs/tasks`), `clubs` (`/clubs`) |
| 2 | `Explore` | `/explore` | `Compass` | `/explore`, `/explore/categories`, `/club/{id}` (club profile); plus `matches`: `corkboard` (`/corkboard`, `/saved-clubs`) |
| 3 | `Inbox` | `/inbox` | `Inbox` (tray; the desktop rail uses `Bell`) | `/inbox` |
| 4 | `Calendar` | `/calendar` | `CalendarDays` | `/calendar`, `/clubs/meetings`, `/meetings`, `/meetings/*`, `/settings/interviews` |
| 5 | `Profile` | `/profile` | `UserCircle` | `/profile` |

  - Settings pages (`/settings*` except `/settings/interviews`, `/club-claims*`, `/invitations*`) resolve to `account-settings`, which no tab matches: **no tab is lit** there.
  - Icon weight: `regular` when inactive, `fill` when active. No "More" button when there are five items.
  - Each item is a `<Link prefetch={false}>` with `aria-label` = label and `aria-current="page"` when active. `<nav aria-label="Sections">`.
- **Geometry:**
  - Container `.oc-mobile-navigation`: `position: fixed; z-index: 35; left: 12px; right: 12px; bottom: max(8px, env(safe-area-inset-bottom))`; `display:flex; justify-content: space-around`; padding 8 px; **radius 26 px**; width 366 px; height 70 px (52 item + 16 padding + 2 border).
  - Item `.oc-mobile-destination`: `flex: 1` (about 69.6 px wide each with five), min-height 52 px, column, centred, gap 4.8 px (`.3rem`) between icon and label, radius 18 px.
  - Label: 12 px, weight 500 (600 when active), single line with ellipsis.
- **Glass treatment (resolved):**
  - Fill (`--oc-glass-navy-material`, when `backdrop-filter` is supported): `radial-gradient(ellipse at 0% 0%, rgb(147 188 224 / 16%), transparent 48%), linear-gradient(166deg, rgb(129 168 204 / 9%), transparent 38%, rgb(4 17 34 / 24%)), rgb(14 35 56 / 92%)`.
  - `backdrop-filter: blur(16px) saturate(125%)`.
  - Border: 1 px `rgb(191 216 238 / 25%)`.
  - Shadow (`--oc-glass-navy-depth`): `inset 0 1px 0 rgb(222 237 255 / 24%), inset 1px 0 0 rgb(196 220 246 / 10%), inset 0 -1px 0 rgb(4 15 29 / 44%), 0 3px 6px rgb(8 22 37 / 12%), 0 16px 32px -14px rgb(8 22 37 / 32%)`.
  - Fallback (no backdrop-filter, reduced transparency, or increased contrast): solid `#232d4b`, no blur; in the reduced-transparency/contrast case also no shadow and border `#91a8bc`.
- **Item states:**
  - Inactive: text and icon `#c5d5e2`, transparent background.
  - Active (`aria-current="page"`): text `#fff9f1`, icon `#fff7ec` filled, background `rgb(210 231 250 / 12%)` with `inset 0 1px 0 rgb(232 243 255 / 15%)`, plus the **indicator bar**: 16 px wide x 3 px tall, radius 2 px, `#e57200`, centred horizontally, 3 px from the item's top edge.
  - Pressed: full inset tint `rgb(255 255 255 / 16%)`; no scale. Transition background/colour 180 ms `cubic-bezier(.22,1,.36,1)` (none under reduced motion).
  - Focus: 2 px `#c86400` outline inset by 2 px with a 4 px inset cream `#fffefa` halo.
- **Space reserved in the page:** `main.oc-workspace-content` bottom padding = `4.75rem + 1.5rem + env(safe-area-inset-bottom)` = 100 px + safe area. Toasts sit at `bottom: 6rem + safe-area` (96 px) so they clear the dock.
- **When the dock is hidden:**
  - `data-shell-chrome="hidden"` on the shell hides header, skip link, dock and rail with CSS and removes main's padding and max-width (tree stays mounted). Set for the views `student-onboarding`, `interview-workspace`, `auth`, `landing`.
  - Focus routes use a different layout (`app/(focus)`, `FocusFrame`): no header, no dock. Seen in `67-leader-voting-room.viewport` and `57-decision-letter-rejected`: a cream bar about 60 px tall with a bottom hairline; left, the navy `OC` app-icon tile (about 28 px, radius 6); then the task name in 14 px weight 600 (`Voting controls`, `Decision letter`), optionally preceded by the club name; right, a light glass pill `Exit` with a leading `X` (about 74x44). Page content starts 16 px in, directly under the bar (the decision letter adds its own `Print letter` button). Paths: `/live-voting`, `/vote`, `/voting/{id}/join`, `/voting/rooms/new`, `/voting/rooms/{id}`, `/voting/rooms/{id}/prepare`, `/voting/rooms/{id}/history`, `/check-in`, `/interviews/book`, `/applications/{id}/decision` (task `Decision letter`), `/club/{id}/interview`, `/q/{code}`, `/auth/student-claim`, `/platform/login`. Exit returns to the last product page, fallback `/home`.
  - Terms, availability and maintenance gates replace the whole shell (see G6).
- **Variant: member inside a club workspace** (`/club/{clubId}/workspace` as a non-leader):
  - Dock has **four** tabs + `More`: `Home` (`/home`), `Explore` (`/explore`), `Inbox` (`/inbox`), `Calendar` (`/calendar`), then a button labelled `More` (aria-label `More sections`, icon `Menu` size 20, regular). Profile moves into the sheet.
  - Seen in `60-member-workspace.viewport`: `Home`, `Explore`, `Inbox`, `Calendar`, `More`, all in the inactive colour. None of the four tabs is lit on the club's own pages (active ids there are `club-home`, `club-meetings`, `club-tasks`, `alumni`, which no tab matches).
  - `More` opens a **left** sheet (`SheetContent side="left"`): width `min(88vw, 300px)` = 300 px, full height, slides in from the left (515 ms spring in, 355 ms out), overlay `rgb(12 25 43 / 42%)`, close `X` (44x44, top 8 px / right 8 px, `sr-only` text `Close`). Hidden title `Workspace navigation`, hidden description `Every section of this workspace.`
  - Sheet surface: navy frosted (`linear-gradient(155deg, rgb(142 181 215 / 10%), transparent 55%), rgb(17 39 61 / 97%)`), padding 24 px 16 px, text `#f6f5f1`, muted `#b0c1cc`.
  - Seen in `61-member-workspace-more-sheet`: the sheet covers x 0-300; the page and the dock's `More` tab stay visible, dimmed, to its right; `Club home` is the current row; the list is taller than the viewport (`Settings` is below the fold and the sheet scrolls).
  - Sheet contents, top to bottom: logo button (`OutClassLogo variant="dark"`, white/orange wordmark about 180 px wide x 44 px tall, aria-label `OutClass home`); then one `<nav>` per section, 20 px apart, items 44 px min-height, gap 13.6 px between 16 px icon and 14 px weight-500 label:
    1. `Home`
    2. `Explore`, `Events`
    3. `Applications`, `Tasks`
    4. `My Clubs`, `Calendar`
    5. heading (12 px muted) = the club's name (seeded: `Blue Ridge Consulting Collective`), then `Club home` (`?section=overview`), `Meetings` (`?section=calendar&type=meetings`), `Club tasks` (`?section=tasks`), `Alumni` (`?section=alumni`)
    6. `Profile`
    7. `Inbox`, `Settings`
  - Current item in the sheet: background `#2a4156`, text `#f6f5f1`, icon `#e57200` filled, 3 px orange bar at the left edge and a 5.6 px orange dot at the right.
  - Icons in the sheet (`navigationIcons`): `Home`, `Compass`, `CalendarStar` (Events), `FileText` (Applications), `ListChecks` (Tasks), `Users2` (My Clubs), `CalendarDays` (Calendar, Meetings), `Home` (Club home), `ListChecks` (Club tasks), `GraduationCap` (Alumni), `UserRound` (Profile), `Bell` (Inbox), `Settings`.
- **Variant: club leader workspace** (for completeness): `Home` · `Recruiting` · `Calendar` · `Members` + `More`; the sheet lists every rail item the bar does not show directly.

### G3 · Search overlay
- **Route:** overlay on any workspace route (search circle or Cmd/Ctrl+K)
- **Screenshot:** `docs/mobile/screenshots/web/03-header-search.png`, `03b-header-search-typed.png`
- **Source:** `components/shell/navigation-search.tsx`, `lib/search-destinations.ts`, `components/ui/command.tsx`, `components/ui/dialog.tsx`
- **Layout (top to bottom):** centred dialog (not a sheet), width `100% - 32px` = 358 px (x 16-374), vertically centred (y 131-713 with the 11-row list; y 310-533 while searching), max-height `100dvh - 32px`, radius 24 px, frosted cream (`linear-gradient(150deg, rgb(255 255 255 / 34%), transparent 50%), rgb(255 251 245 / 96%)` + `blur(18px) saturate(135%)`), border 1 px `rgb(255 255 255 / 68%)`, menu shadow; no padding, no close button. Overlay `rgb(12 25 43 / 42%)`. Opens with a 355 ms zoom-in from 95% (no animation under reduced motion).
  1. Input row: as rendered, content is inset about 21 px from the dialog edge and the row is about 56 px tall (source classes say 36 px and no dialog padding; the capture wins); `Search` icon 16 px, muted; text about 16 px, no field border; a hairline under the row.
  2. Result list: max-height `55dvh`, padding 8 px, scrolls.
  3. While a record search is pending: a strip with two skeleton bars (12 px tall, widths 2/3 and 1/2), padding 16 px, top border; screen-reader text `Searching records…`.
  4. Footer: padding 12 px 16 px, top border, 12 px muted text, two spans that wrap.
- **Exact copy:**
  - Hidden title `Search OutClass`; hidden description `Search pages and authorized records. Use arrow keys to browse, Enter to open, and Escape to close.`
  - Placeholder (student): `Find a page, club, or application…`. For anyone who can identify applicants in some club: `Find a page, applicant, club, or round…`. Input `aria-label="Search OutClass"`, max 120 characters.
  - Group headings (12 px, weight 500, muted): `Pages`, `Across OutClass`, `Clubs`, `Your applications`, `Applicants`, `Recruitment rounds`.
  - Empty text (centred, 14 px, 24 px vertical padding): under 2 characters and nothing listed: `Type at least two letters to search records.`; otherwise `No matches. Try a club name, applicant surname, or another page.`
  - Error strip: `Record search couldn’t load. Pages are still available.` + outline button `Retry`.
  - Footer left: `{n} result` / `{n} results` (count of everything listed; `pluralize`, thousands separated), or `Searching your workspace` while pending, or `Sign in to search records` when signed out.
  - Footer right: up-arrow icon, down-arrow icon (14 px) then ` to browse · Enter to open · Esc to close`.
- **Rows:**
  - `Pages` rows: 44 px tall, 16 px icon, label (about 15 px), trailing `ArrowUpRight` 14 px muted. The first row is pre-selected (sage highlight, radius about 6 px). With an empty query the personal workspace lists, in order (confirmed by `03-header-search`): `Home` (`Home`), `Explore` (`Compass`), `Events` (`CalendarStar`), `Applications` (`ClipboardList`), `Calendar` (`CalendarDays`), `My Clubs` (`Users2`), `Inbox` (`Bell`), `Profile` (20 px account avatar instead of an icon), `Tasks` (`ListChecks`), `Settings` (`Settings`), `Notification settings` (leading `ArrowUpRight`, no trailing arrow). Footer then reads `11 results`; about nine and a half rows fit before the list scrolls. Typing filters these by case-insensitive substring of the title.
  - `Across OutClass` rows (only after typing; pages in other workspaces, max 12): 48 px min-height, leading `ArrowUpRight`, two lines: page title, then workspace name in 12 px muted (`Personal`, the club's name, or `Platform admin`). For a plain member each club contributes `Club home`, `Tasks` and that club's Meetings/Events/Members links where allowed. Every typed word must appear in title, workspace name or keywords (e.g. `status tracker` finds Applications, `corkboard` finds Events, `notifications messages` finds Inbox, `resume account` finds Profile).
  - Record rows (`Clubs`, `Your applications`, `Applicants`, `Recruitment rounds`): 48 px, icon (`Building2`, `FileText`, `UserRound`, `Layers`), title + 12 px muted detail line, both truncated to one line.
  - Highlighted row: background `#e7ebe7`.
- **Behaviour:**
  - Record search starts at 2+ characters, debounced 200 ms, server side (`searchWorkspace`). Seen in `03b-header-search-typed` (query `lawn`): no page matches, so the list is empty, the two skeleton bars show, and the footer reads `Searching your workspace` on one line with the keyboard hint on a second line. Results for a finished search were not captured.
  - Selecting a page navigates and closes; a club result goes to `/club/{clubId}`; an application result focuses that application and opens Applications; applicants/rounds open the owning club workspace.
  - With unsaved changes on the page a confirm appears first: title `Leave this page?`, body `Your unsaved changes will be lost.`, buttons `Stay` / `Leave page` (danger). Nothing happens while a save is in flight.
  - Closing without choosing returns focus to the search circle; closing clears the query.

### G4 · Notification popover (bell)
- **Route:** overlay on any workspace route
- **Screenshot:** `docs/mobile/screenshots/web/04-header-notifications.png`
- **Source:** `components/shell/notification-center.tsx`, `notification-center.css`, `lib/notification-presentation.ts`, `components/organization-invitation-card.tsx`
- **Layout (top to bottom):** popover anchored under the bell, right aligned, 12 px below it, 12 px collision padding. Width `min(400px, 100vw - 24px)` = 366 px; max-height `min(540px, available height, 100dvh - 24px)`; radius 20 px; frosted cream material, border `rgb(255 255 255 / 68%)`, menu shadow; text `#232d4b`. No page overlay/scrim. Enter: 200 ms fade + 7 px rise; exit 140 ms.
  1. Header (padding 10/12/6/18): `h2` `Inbox` in Source Sans 15 px weight 600, followed by the count pill when `unread + pending invitations > 0`: min 22x22, radius 999, background `#f0e9de`, 12 px, aria-label `{count} unread updates and pending invitations`. Right: one 44x44 round icon button `CheckCheck` (20 px), aria-label `Mark all updates as read`, title `Mark all updates as read. Pending invitations still require a response.`; disabled (40% opacity) when nothing is unread, while busy or loading.
  2. Filter (segmented, 160 px wide, margin 0 18px 10px, track `#f0ebe3`, radius 999, padding 3 px): two buttons `All` | `Unread`, each 44 px tall, 13 px; selected text navy weight 500, others muted weight 400; a sliding thumb `#fffbf5` with 1 px navy-8% border and soft shadow (240 ms). `role="group"` `aria-label="Filter notifications"`, `aria-pressed`. Default `All`.
  3. Optional action-error strip (background `#f5eee4`, 13 px): `Couldn’t update notifications.` + `Retry`.
  4. Feed (scrolls; top border navy 9%). Seen in `04-header-notifications`: panel x 12-378, y 68-608 (540 px tall); count pill `17`; `All` selected; then the invitations block with its error strip; two and a half rows visible; footer `Open inbox`.
     - Optional load-error strip: `Couldn’t load updates. Showing saved updates.` + `Retry`.
     - Invitations banner (when pending invitations exist or the check failed), padding 12 px, bottom border: caption `Invitations await your response` (12 px muted); on failure a strip `Couldn’t check invitations.` + `Retry`; then one compact card per invitation (bordered, padding 12 px): club logo, title `You’ve been invited to join {Club}` (or `You’ve been invited to claim {Club}` for an owner invite), line `{Club} invited you as a member.` (role phrases: `an administrator`, `a recruiting administrator`, `an interviewer`, `a member`, `an owner`; owner invite reads `You’re the designated administrator for {Club}.`), then buttons: ghost link `View invitation` (`/invitations/{id}`), primary `Accept` (`Accepting…`; owner invite `Claim organization` / `Claiming…`), outline `Not now` (or `Show on dashboard` when already hidden, with the note `Hidden from your dashboard · still pending`), ghost `Decline`. Decline asks inline: `Decline the invitation from {Club}? You’ll need a new invitation to join later.` with destructive `Confirm decline` (`Declining…`) and outline `Cancel`. Accept failure: `Could not accept this invitation. It may have expired or your access may have changed. Try again.`
     - First load with no cached items: feed skeleton (3 rows: 32 px rounded square + four bars), label `Loading notifications…`.
     - Notification rows (list, hairline dividers navy 7%; unread rows tinted `rgb(238 231 218 / 24%)`).
     - Empty state (centred, padding 32/20): `CheckCheck` 24 px muted, `You’re all caught up` (14 px weight 500), then `Nothing has been sent to you yet.` with link `Choose email updates` (All filter; goes to notification settings) or `You’ve read every update.` with button `Show all updates` (Unread filter). Links are 13 px, underlined, 44 px tall.
  5. Footer (top border, padding 2/18): full-width 44 px button `Open inbox` + `ArrowUpRight` 16 px, 13 px weight 500 -> `/inbox`.
- **Row anatomy** (min-height 96 px, padding 14/4/14/16, gap 10):
  - Left: 32x32 icon tile, radius 10 px, background `#f4efe7`, 1 px navy-9% border, 16 px icon by type: Announcement `Megaphone`; Interview Invite `CalendarDays`; Application Update `FileText`; Club Invitation `Users2`; Task `ListChecks`; Decision Available `FileText`; Offer Confirmation `CheckCheck`; OutClass Update `Bell`; Private Message `Mail`.
  - Middle (gap 5): title 13 px weight 500 (wraps); preview 12 px muted, clamped to 2 lines; meta line 12 px muted: club name, then relative time (`Just now` under 45 s, otherwise `Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" })`, e.g. `5 min. ago`, `2 hr. ago`, `yesterday`, `3 days ago`, `last wk.`); `title` attribute carries the full date.
  - Unread dot: 6 px `#e57200`, to the right of the copy, 7 px from the top; screen-reader text `Unread`.
  - Hidden link text per row (screen readers only): the item's CTA, seeded values `View task`, `Book interview`, `View application`, `Review invitation`, `View Decision`, `Open update`; rows without a link target are buttons with no CTA.
  - Seeded examples: `New task: Complete new member onboarding` / `Open your task for instructions and feedback.` / `Blue Ridge Consulting Collective` · `2 hr. ago`; `Interview confirmed` / `Open your application to review your current interview schedule.` / `Corner Code Collective`; `Your offer is waiting` / `Rotunda Equity Research Society offered you membership. Review and respond before the offer expires.`; `Welcome to OutClass` / … / `OutClass` · `2 wk. ago`. Time strings seen: `2 hr. ago`, `7 hr. ago`, `yesterday`, `2 days ago`, `last wk.`, `2 wk. ago`. 24 rows in total, 17 unread.
  - Far right: 44x44 `MoreHorizontal` (20 px, muted) button, aria-label `Actions for {title}`.
- **Row "…" menu:** `Mark read` (`Check`) or `Mark unread` (`Mail`); `Dismiss` (`Archive`) only for server-stored notifications. Menu: radius 18 px, padding 6 px, items 44 px, radius 12 px, highlighted `#e7ecec`.
- **Behaviour:**
  - Tapping a row: with a link target it navigates there, closes the popover and marks it read; an announcement-style item (target is the inbox) opens an **inline detail** inside the popover instead: `Back` (`ArrowLeft`), club name, `h3` title (15 px weight 600), body paragraphs (13 px muted, line-height 1.69), optional `Updated location: {new}` / `Previously: {old}`, text buttons `Mark read`/`Mark unread` and `Dismiss`. Interview invites and location changes open Calendar focused on the event; application updates open Applications.
  - Feed is de-duplicated by id and sorted newest first; `Unread` shows only unread.
  - Count rules: `unread` = unread local items + server unread count; the dot and the header pill use `unread + pending invitations`; the aria-label reports them separately.
  - Data refresh: tasks poll every 60 s (skipped while the tab is hidden) and on window focus; durable notifications refresh on a live channel.
  - Escape or outside tap closes and returns focus to the bell (unless navigation happened).

### G5 · Account menu (avatar)
- **Route:** overlay on any workspace route
- **Screenshot:** `docs/mobile/screenshots/web/05-header-account-menu.png`
- **Source:** `components/shell/product-shell.tsx` (lines ~248), `components/feedback/feedback-dialog.tsx`, `styles/navigation-glass.css`
- **Layout:** dropdown under the avatar, right aligned (x 118-374, top y 66, about 234 px tall in `05-header-account-menu`), 10 px below, 16 px collision padding, width 256 px (`w-64`), padding 6 px, radius about 16-18 px (two rules of equal weight set 16 and 18; the 1x preview cannot tell them apart), frosted cream + blur, menu shadow. Items: 44 px min-height, radius 10-12 px, 14 px text, 8 px gap, 16 px muted icon. Fade/zoom-in 180 ms.
- **Contents for the seeded student (top to bottom; confirmed by the capture, no demo or workspace items):**
  1. Name line (not a button): `Sam Staging-Student`, 14 px weight 500, truncated. Falls back to the email, then `Your account`.
  2. Separator (1 px `#dfe3dd`).
  3. `Your profile`: leading 20 px account avatar -> `/profile`.
  4. `Settings`: icon `Settings` -> `/settings`.
  5. `Report an issue or send feedback`: icon `MessageSquare` -> opens the feedback dialog.
  6. `Sign out`: icon `LogOut`; disabled while signing out.
- **Conditional items:** demo switch items appear between the name and the separator only for accounts allowed into Demo Mode. A `Workspace` group (12 px muted caption `Workspace`, then one item per workspace with a filled `CheckCircle2` on the current one, aria-labels `Personal workspace`, `{Club} club workspace`, `Admin workspace`, then other clubs the person leads) appears only when there are 2+ workspaces, so not for the seeded student. Settings, feedback and sign-out are hidden in Demo Mode; feedback and sign-out are hidden in support (view-as) sessions.
- **Sign out behaviour:** tries to flush unsaved edits. If some cannot be saved, a confirm appears: `Sign out and discard unsaved changes?` / `Some changes have not reached OutClass yet. Signing out removes them from this device.` / confirm `Discard and sign out` (danger). Then: push unsubscribe, `POST /api/auth/logout`, Supabase sign-out, hard navigation to `/`. Failure toast: `Could not sign out. Try again.`
- **Feedback dialog** (centred dialog, width 358 px, radius 24 px, padding 24 px, close `X` 44x44 at top-right 12 px):
  - Title (Libre Caslon 22 px weight 500): `Report an issue or send feedback`. Description: `Goes to the OutClass team.`
  - Compact segmented control, group label `Type`, two options `Issue` | `Feedback`, default `Issue`.
  - Field label: `What went wrong?` (issue) or `Your feedback` (feedback); 5-row textarea, 10 to 2000 characters (server message when too short: `Add a few more words so we can follow up.`).
  - Outline small button `Attach screenshot` (`ImagePlus`), `Preparing…` while compressing; once attached: 80x56 thumbnail, `Screenshot attached`, ghost button `Remove` (`X`). Accepts PNG/JPEG/WebP, re-encoded to JPEG under 2 MB.
  - Helper (12 px muted): `We include this page, your browser and device, and the app version.` (`, plus your screenshot` is inserted before the full stop when one is attached).
  - Footer buttons (stacked on phone, primary on top): `Send` (`Sending…` while busy; disabled until the message reaches the minimum length) and outline `Cancel`.
  - After sending: description becomes `Thanks. Your report reached the OutClass team.` and the only button is `Done`.
  - Errors (14 px, `#ac3544`): `Choose an image file.`, `This image can’t be read. Choose a PNG or JPEG.`, `This image is too large to attach. Try a smaller screenshot.`, `This image can’t be attached.`, `The screenshot didn’t upload. Try again, or remove it.`, `We couldn’t send your report. Please try again.`

### G6 · First-run gates
- **Screenshot:** `docs/mobile/screenshots/web/02-home-first-run-guide.viewport.png`, `02-home-first-run-guide-help-chip.viewport.png`; alumni `63a-alumni-first-run-guide.viewport.png` / `63a-alumni-first-run-guide-help-chip.viewport.png`; leader `66a-leader-first-run-guide.viewport.png` / `66a-leader-first-run-guide-help-chip.viewport.png`
- **Source:** `components/tutorial-walkthrough.tsx`, `lib/tutorials.ts`, `app/(workspace)/layout.tsx`, `components/legal/terms-gate.tsx`, `components/availability/availability-gate.tsx`, `components/maintenance-gate.tsx`, `components/site-notices.tsx`, `components/interests/interest-survey-prompt.tsx`, `components/graduation-prompt.tsx`, `components/views/student-onboarding-wizard.tsx`
- **What the seeded accounts actually hit after sign-in:** student, alumni and leader each got ONLY the tutorial walkthrough. No terms screen, onboarding wizard, availability step, interest gate, two-step prompt, site notice or maintenance page appeared for any of the three. All three saw the same student guide on `/home` (`YOUR OUTCLASS GUIDE`, `Step 1 of 8`, `Your profile`): the leader gets the student experience in the personal workspace; the `Leader workspace guide` variant (6 steps) only loads inside a club workspace and was not captured.

**Tutorial walkthrough (student)**
- Shown when the server says the tutorial is `IN_PROGRESS` and it has not been dismissed on this device. It is a non-modal card (`role="dialog"`, `aria-modal="false"`): the page behind stays scrollable and tappable, there is no scrim.
- **Card:** fixed, `bottom: 80px; right: 16px`, width `100vw - 32px` = 358 px (max 384), max-height `65dvh` (scrolls inside), z-index 40 (above the dock's 35), radius 22 px, 1 px `#dfe3dd` border, background `#fffefa`, padding 20 px, large drop shadow. In `02-home-first-run-guide.viewport` it spans x 16-374, y 410-764, its bottom edge 2-4 px above the dock. The card takes focus when it opens; in some captures (`66a-leader-first-run-guide.viewport`, `scratchpad/x/after-login-student.png`) that shows as a 2 px `#c86400` outline around the whole card, in others (`02-home-first-run-guide.viewport`) it does not.
- **Card anatomy (top to bottom):**
  1. Row: eyebrow `Your OutClass guide` rendered uppercase (12 px, weight 500, wide tracking, muted) and a 44x44 ghost `X` button, aria-label `Dismiss tutorial`.
  2. `Step {n} of 8` (12 px muted; `aria-live="polite"`). Support previews append ` · Support preview (not saved)`.
  3. Native `<progress>` bar, full width, 6 px tall, 12 px vertical margin, aria-label `Tutorial progress`, value n of 8. Renders square-ended with a green fill on a mid-grey track in every capture.
  4. Title `h2` (Source Sans, 20 px, weight 600, line-height 1.14, tracking -0.016em).
  5. Body (14 px, relaxed line-height 1.625, muted).
  6. Link-style button `Show me where` (navy, weight 600, no padding): navigates to the step's page.
  7. Footer row: ghost `Skip` on the left; on the right outline `Back` (`ArrowLeft`, disabled on step 1) and primary navy `Next` (`ArrowRight`); on step 8 the primary reads `Finish`; while saving it reads `Saving…`.
- **Steps (title / text / "Show me where" destination / highlight anchor):**

| # | Title | Text | Opens | Anchor |
|---|---|---|---|---|
| 1 | `Your profile` | `Build one profile for your applications. Keep your education, experience, and resume up to date from your account menu.` | `/profile` | account avatar |
| 2 | `Explore OutClass` | `Browse Explore by interest, search and compare clubs, and open a club’s page for its recruitment details and public events.` | `/explore` | `nav-explore` |
| 3 | `Your clubs` | `My Clubs brings your memberships together. Open a club to find its meetings, tasks, and workspace tools available to you.` | `/clubs` | `nav-clubs` |
| 4 | `Applications` | `Start from a club’s page, answer its questions, and check your profile before submitting. Track all your applications here.` | `/applications` | `nav-applications` |
| 5 | `Application stages` | `Applications sorts your work into Drafts, In review, Interviews and Decisions. Open an application to review its next step.` | `/applications/status` (view `status`) | `nav-applications` |
| 6 | `Calendar and events` | `Find upcoming events and interview times in Calendar. Open an event for its details and attendance options.` | `/calendar` | `nav-calendar` |
| 7 | `Campus events` | `Find approved campus event flyers in Events. Filter by date or interest, open a flyer for details, and RSVP. Your saved clubs remain available through Saved clubs.` | `/corkboard` | `nav-corkboard` |
| 8 | `Stay in the loop` | `Use the bell for your Inbox: notifications and application updates. You can restart this walkthrough anytime using Tutorial help.` | `/inbox` | bell |

- **Highlight ring:** a fixed, non-interactive box over the anchor: 2 px `#e57200` ring, 4 px offset in the canvas colour, radius 16 px, height capped at 160 px, z-index 30. In the step-1 captures only the lower arc of the ring shows under the avatar circle: the sticky header (z-index 40) paints over the rest. On phones only steps 1 (avatar) and 8 (bell) have a visible anchor; the `nav-*` anchors live on the desktop rail (the dock tabs carry no anchor), so for steps 2-7 the ring falls back to the top 160 px of the main content area (source only).
- **Behaviour:** `Skip`, the `X` and Escape all dismiss immediately (stored per device, synced to the server as a skip). `Next`/`Back` save progress to the server before moving. `Finish` completes it.
- **Error copy:** `Tutorial could not load. You can keep working and retry from Tutorial help.`; `Could not save tutorial progress. Retry, or close for now and keep working.` (with link button `Close for now`); `Tutorial closed on this device. We’ll sync dismissal when you reconnect.`
- **"Tutorial help" chip** (after skipping or finishing, until hidden): fixed `bottom: 80px; left: 16px`, z-index 30; a small card (radius 10 px, 1 px border, `#fffefa`, light shadow) holding a borderless button `Tutorial help` with `CircleHelp` 16 px (restarts at step 1) and a ghost `X` button, aria-label and title `Hide Tutorial help` (hides the chip permanently on this device). Same chip for alumni and leader (`63a-…-help-chip`, `66a-…-help-chip`). In the capture the chip is about 174 px wide x 44 px tall with its bottom edge about 4 px above the dock; the `Tutorial help` label is greyed (disabled) until tutorial progress has loaded.

**Other gates that exist in source (none appeared for the seeded student)**

| Gate | Trigger | What it shows |
|---|---|---|
| Maintenance (`MaintenanceGate`) | Admin turns maintenance mode on; signed-in non-admins | Replaces the shell: `TriangleAlert` 24 px, `h1` `OutClass is undergoing maintenance` (Caslon 24 px weight 600), `Your clubs, applications and messages are safe. Changes are paused until maintenance finishes. Please check back shortly.` |
| Terms acceptance (`TermsGate`) | `TERMS_ACCEPTANCE_REQUIRED` on and the account has not accepted the current versions (off by default) | Replaces the shell: title `Before you continue`, description `Please review and accept the OutClass Terms of Service and Privacy Policy to keep using your account.`, a clickwrap checkbox, buttons `Accept and continue` and ghost `Sign out`, footnote with a contact email and an `Account settings` link. Error `Unable to save your agreement. Please try again.` |
| Availability (`AvailabilityGate`) | Student with a profile who has never saved weekly availability | Replaces the shell: title `When are you usually free?`, description `Mark the times you’re usually free each week. Your clubs use this to find meeting times that work for everyone. You can change it anytime in Settings.`, the weekly editor titled `Your usual week`; offers sign-out and a "no regular free time" finish. |
| Onboarding wizard (`student-onboarding-wizard.tsx`) | New sign-up, or an account without a student profile | Full page, shell chrome hidden. Stepper `Step {n} of 5` with labels `Account`, `Verify`, `Academic`, `Experience`, `Interests`. Step headings: `Create your account` (or `Your account` when embedded, `Let’s finish your profile` once the account exists; sub `Use your UVA email to get started.`), `Verify your email`, `Academic profile`, `Experience & assets`, `Help us suggest clubs`. |
| Interest survey prompt | Home card for students who have neither answered nor dismissed the survey | Card `Help us suggest clubs`, text `Four quick questions, about a minute. Only you see your answers.`, button `Answer`, dismiss `X` (aria-label `Dismiss`). |
| Graduation prompt | Home card, April-July of the student's graduation year | Card `Graduating this spring?`, text `Your account stays as an alumni account from Aug 1, with your profile and history. Clubs list you as alumni.`, buttons `Yes, I’m graduating`, `Update my year`; second step `Where are you going to work?` with `Confirm graduation` / `Back`. |
| Two-step auth | Route `app/(focus)/auth/two-step` exists | Not read; behaviour and copy unverified. |
| Site notices (`SiteNotices`) | Admin-set text | Strips above the page: maintenance notice (`#fbf3df` background, `TriangleAlert` 16 px in `#795617`, 14 px weight 500 text) and a campus notice. Empty by default. |
| Workspace access check | While club/admin access is being confirmed for a club or admin route | Inline spinner + `Checking workspace access…` in the content area. |
| Demo note | Demo Mode only | Pill above content: `Fictional demo data · changes stay in this browser; no messages are sent.` |

### G7 · Sign-in screen
- **Route:** `/login` (`?next=` return path)
- **Screenshot:** none captured (source only)
- **Source:** `components/views/auth-view.tsx`, `components/auth/login-auth-panel.tsx`, `email-login-form.tsx`, `login.css`
- **Layout:** public page frame; a card (max-width 440 px, padding 20 px, radius 16 px, glass card surface) inside 24 px side padding, followed by a navy brand panel.
- **Exact copy:**
  - `h1` `Welcome back` (Libre Caslon, about 32 px at 390, weight 400, line-height 1.12, tracking -0.03em).
  - Description `Sign in with your UVA account.` (12 px on phones, muted). A caller can replace it (e.g. with the club being returned to).
  - Label `Email address`, placeholder `computingid@virginia.edu`, hint `Use your @virginia.edu email address.`
  - Label `Password` with link `Forgot password?` (`/forgot-password`) on the same row; no placeholder.
  - Primary button `Sign in` (full width, 54 px tall, radius 10 px; disabled until a password is typed).
  - Link button `Use an email code instead` (`Use an email code in {s}s` during the 60 s cooldown).
  - Footer: `New to OutClass?` + link `Create your profile`.
  - Only when Microsoft sign-in is enabled at build time: button `Continue with UVA` first, then toggle `Use email instead` / `Hide email sign-in` (`ChevronDown`).
  - Code step: `h1` `Check your inbox`, `Enter the six-digit code for {email}.`, label `Verification code`, placeholder `000000` (56 px tall, 24 px digits, centred, letter-spaced), button `Verify and sign in`, links `Resend code` (`Resend in {s}s`) and `Use a different email`.
  - Inputs: 50 px tall, radius 10 px, 16 px text; labels 13 px weight 500.
- **Errors:** `Use your UVA email ending in @virginia.edu.`, `Enter your UVA email first.`, `Unable to sign in. Please try again.`, `Unable to send a code. Try signing in with your password.`, `Unable to confirm your sign-in. Please try again.`, `Unable to verify this code. Please try again.`, `Unable to start Microsoft sign-in. Please try again.` (plus server-mapped password and captcha messages, not transcribed). A Turnstile bot check sits under the form.

### G8 · Loading
- **Route:** all
- **Screenshot:** `docs/mobile/screenshots/web/62-loading-skeleton-1.png` (Home before a throttled navigation), `62-loading-skeleton-2.png` (`/calendar`, `Loading your schedule…`), `62-loading-skeleton-3.png` (Calendar loaded); Home skeleton in `02-home-first-run-guide-help-chip.viewport.png`
- **Source:** `components/ui/loading-state.tsx`, `components/workspace-loading.tsx`, `components/shell/workspace-route-loading.tsx`, `components/outclass-loading-screen.tsx`, `components/ui/skeleton.tsx`, `styles/loading.css`, `app/**/loading.tsx`
- **Principle:** the header and dock stay on screen; only the content area shows a placeholder shaped like the destination. The label is screen-reader only (`role="status"`, `aria-busy`); nothing visible is written except for the inline variant.
- **Seen on Home:** flat light-grey blocks (about `#e6e6e3` on the `#f6f5f1` canvas) with no borders; header and dock fully drawn; the bell shows no unread dot and reads `Notifications` until counts load.
- **Skeleton block:** radius 10 px unless stated, colour `rgba(35,45,75,.08)` (glass track; the non-glass variant is a mix of `#edeee9` and `#dfe3dd`). Blocks do not pulse individually. One shared sheen sweeps the whole preview left to right: a `linear-gradient(90deg, transparent, 28% canvas, transparent)` band, 2800 ms ease-in-out, infinite. Reduced motion: sheen removed, blocks static.
- **Content swap:** ready content fades from 82% to 100% opacity over about 150 ms (none under reduced motion).
- **Per-route placeholders at phone width:**

| Route | Label (sr-only) | Layout | Shape at 390 px |
|---|---|---|---|
| `/home` (seen in `02-home-first-run-guide-help-chip.viewport.png`) | `Loading your dashboard…` | `home` | Greeting block (88 px min: bars 12x160, 36x256, 16x320), then a 144 px tall card block and a 256 px tall card block, both full width, radius 16 px, 16 px gaps |
| `/calendar` (seen in `62-loading-skeleton-2`) | `Loading your schedule…` | `schedule` (3 rows) | Seen: three rows from y 90 to 390, about 105 px each, the Calendar tab already lit, rest of the page blank canvas. Rows divided by hairlines, 20 px vertical padding: left date stub (12x40 bar over a 28x36 block), then three bars (60%, 80%, 40% width); the right-hand action block is hidden on phones |
| `/meetings` | `Loading meetings…` | `schedule` (3 rows) | as Calendar |
| `/interviews` | `Loading your interviews…` | `schedule` (3 rows) | as Calendar |
| `/profile` | `Loading your profile…` | `form` (3 rows) | One card (border `#dfe3dd`, radius 16 px, padding 16 px): heading bar 28x208 + 32x96 block, three stacked fields (12x112 label + 44 px input block; the second is a 96 px textarea block), two button blocks 40 px tall left aligned |
| `/settings/account`, `/settings/availability`, `/settings/interviews` | `Loading your settings…` | `form` (3 rows) | as Profile |
| `/explore/categories` | `Loading categories…` | `explore` (3 rows) | Heading bar 36x224 + 36x112 block, a 44 px full-width search pill, five 36x80 chip pills in one clipped row, a 20x160 bar, then three stacked cards (176 px cover block, body with four bars) |
| `/decisions` | `Loading your decisions…` | `applications` (3 rows) | Heading bars, two 48x96 KPI blocks, three filter pills, then three cards (16 px padding, 48 px rounded square + three bars; action block hidden) |
| `/club/{id}/workspace` | `Opening club workspace…` | by `section`: dashboard skeleton for `overview`; `applicants` for recruitment; `table` for members; `form` for settings; else `rows` | `rows` = heading bars + a bordered list of rows (40 px circle + two bars, 16 px padding) |
| `/explore`, `/applications`, `/inbox`, `/clubs`, `/corkboard`, `/saved-clubs` | no route `loading.tsx` | handled inside each view | see those sections |

- **Default labels:** `LoadingState` `Loading…`; `WorkspaceLoading` `Loading workspace…`.
- **Inline variant** (`layout="inline"`): 16 px spinning arc (`LoaderCircle`, 1 s linear, static under reduced motion) + the label in 14 px muted text. Used for `Checking workspace access…`.
- **Feed variant** (notification popover): rows of a 32 px rounded square plus four bars, hairline dividers.
- **Whole-destination fallback** (`OutClassLoadingScreen`, session restore / first open): full-viewport canvas `#f6f5f1` with a faint blue-grey radial glow; centred OutClass favicon mark about 56 px with a soft drop shadow, breathing (scale .985 to 1.025, 2.1 s); a 164 px hairline circle around it; a 96x3 px track `rgb(232 91 25 / 18%)` with a 40% wide orange `#e57200` segment sweeping every 1.3 s; caption `Loading OutClass…` (12 px, weight 600, tracking .06em, muted). Navy variant: navy background, cream caption. Reduced motion: mark static, segment parked.
- **Buttons while loading:** label stays in layout at 0 opacity, a 14 px spinner is centred over it; the button is disabled but keeps full opacity.

### G9 · Page frame
- **Source:** `components/shell/product-shell.tsx`, `responsive-workspace.css`, `authenticated-product.css`, `components/ui/page-header.tsx`, `styles/product-components.css`, `styles/workspace-composition.css`, `styles/editorial.css`, `components/product/welcome-header.tsx/.css`, `components/student-workspace-page.tsx`, `components/shell/authenticated-page-layout.tsx`
- **Frame:**
  - Shell root: `min-height: 100dvh`, background flat `#f6f5f1`, text `#232d4b`. No texture or page-wide gradient. (Dashboard heroes add their own soft ambient glow: two radial gradients, navy 8% top-left and orange 8% top-right; that belongs to those screens.)
  - `main#workspace-content`: full width, max-width `96rem` (irrelevant on phones), padding **top 10 px, left/right 16 px, bottom 100 px + safe-area**. Content width 358 px. Long words wrap anywhere.
  - Content starts 78 px from the top of the viewport (68 px sticky header + 10 px). `scroll-margin-top` for in-page jumps is 80 px.
  - `AuthenticatedPageLayout` and `StudentWorkspacePage` are server gates only (auth, demo, disabled account -> "account unavailable" screen, redirect to `/login?next=…` when signed out); they draw nothing.
  - Page stack: screens wrap content in `.oc-workspace-stack`, a one-column grid with gap `--oc-content-gap` = 16 px at 390.
- **Page title (`PageHeader`, the only `<h1>`):**
  - `h1`: **Libre Caslon Text, 26 px** (`--oc-text-title` = `clamp(1.625rem, 2.2vw, 1.875rem)`), weight 500, line-height 1.14, letter-spacing -0.03em, colour `#232d4b`, `text-wrap: balance`.
  - Optional eyebrow above: 12 px, weight 600, muted `#52606d`; the title then gets 6 px top margin.
  - Description below: 15 px, weight 400, line-height 1.6, colour `#52606d`, 6 px top margin.
  - Optional action slot to the right of the copy; wraps under it when it does not fit. Optional status pill beside the title (bordered capsule, muted).
  - Header bottom margin 20 px, or 0 inside `.oc-workspace-stack` (the 16 px grid gap takes over).
  - Home greeting (`WelcomeHeader`): same component; on phones the `h1` reserves two lines and the subtitle two lines so the layout does not jump as the greeting changes. Captures show eyebrow `Wednesday, November 18`, title `Good morning, Sam.` / `Good afternoon, Sam.`, subtitle `You have tasks ready to work on.` (alumni: `Explore what's new in OutClass.`; leader: `Your next meeting starts on Nov 25 at 7:30 PM.`).
  - Seen: `Inbox`, `Profile`, `Explore clubs` and `Good afternoon, Sam.` all render as the 26 px Caslon title starting about 78-100 px from the top; Explore puts its `Saved clubs` action pill on the title row. The member club page (`60-member-workspace.viewport`) uses a larger title, about 40 px Caslon over two lines (`Blue Ridge Consulting Collective`).
  - Densities: `expressive` h1 = 36 px weight 400; `editorial` h1 = 40 px at 390 (`clamp(2.5rem, 9vw, 3.5rem)`), weight 400, line-height 1.04, tracking -0.045em, with an uppercase 12 px orange-ink `#a04d00` eyebrow (tracking .065em) and a 16 px description.

## Design system

Source: `styles/tokens.css`, `styles/typography.css`, `app/globals.css`, `app/layout.tsx`, `styles/interface-primitives.css`, `styles/product-components.css`, `styles/navigation-glass.css`, `styles/pressed-states.css`, `styles/filter-controls.css`, `components/ui/*`.

### Fonts
- **Source Sans 3** (`--oc-font-sans`, fallback Arial): local variable font, weights 200-900, upright and italic. Everything by default: body, labels, buttons, controls, data, section headings (`h2`-`h6`), card content.
- **Libre Caslon Text** (`--oc-font-display`, fallback Georgia; Tailwind `font-display` / `font-serif`): local variable font, weights 400-700, upright and real italic. Used for: page titles (`.oc-page-header h1`), card titles (`CardTitle` / `.oc-card-heading`), dialog and sheet titles, announcement titles (`.oc-announcement-title`, 20 px weight 500), the sign-in title, the club name on club profile headers, the student name on the profile header and its initials avatar on phones, maintenance heading.
- Loaded in `app/layout.tsx` with `next/font/local` from `app/fonts/libre-caslon-text/` and `app/fonts/source-sans-3/`; `font-synthesis: none`; body is antialiased. `--font-mono` is mapped to the sans.
- Light theme only (`color-scheme: light`); the only dark palette is the live-voting projector.

### Typography tokens

| Token | Value at 390 px | Notes |
|---|---|---|
| `--oc-text-caption` | 12 px | captions, badges, eyebrows |
| `--oc-size-13` | 13 px | form labels, row meta (`text-control`) |
| `--oc-text-small` | 14 px | buttons, labels, nav, tables, inputs (inputs become 16 px on phones) |
| `--oc-text-body` | 15 px | body default |
| `--oc-text-card` | 17 px | `h3`, card titles |
| `--oc-text-section` | 20 px | `clamp(1.25rem, 1.6vw, 1.5rem)`; `h2` |
| `--oc-text-modal` | 22 px | dialog/sheet titles |
| `--oc-text-title` | 26 px | `clamp(1.625rem, 2.2vw, 1.875rem)`; `h1` |
| `--oc-text-metric` | 28 px | metric numbers (24 px in the phone metric strip) |
| `--oc-text-display` | 32 px | `clamp(2rem, 4vw, 3.5rem)` |
| `--oc-text-hero-mobile` | about 41.7 px | `clamp(2.375rem, 10.7vw, 3.5rem)` |
| `--oc-text-hero` | 48 px | `clamp(3rem, 5.7vw, 4.75rem)` |
| `--oc-editorial-display` / `-feature` / `-section` | 44 / 28 / 22.4 px | clamp minimums apply |
| `--oc-size-7 … -96` | 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 28, 32, 36, 48, 64, 72, 96 px | raw size steps |

| Token | Value |
|---|---|
| `--oc-weight-regular` | 400 |
| `--oc-weight-medium` | 500 |
| `--oc-weight-semibold` | 600 |
| `--oc-weight-bold` | 650 |
| `--oc-weight-title` | 500 |
| `--oc-weight-display` | 500 |
| `--oc-leading-heading` | 1.14 |
| `--oc-leading-subheading` | 1.3 |
| `--oc-leading-compact` | 1.45 |
| `--oc-leading-body` | 1.6 |
| `--oc-leading-display` | 1.15 |
| `--oc-tracking-heading` | -0.03em |
| `--oc-tracking-title` | -0.022em |
| `--oc-tracking-display` | -0.025em |
| `--oc-tracking-section` | -0.016em |
| `--oc-tracking-card` | -0.01em |
| `--oc-tracking-small` | 0 |
| `--oc-tracking-caps` | 0.06em |

### Typography roles (base rules)

| Role | Font | Size | Weight | Line-height | Tracking |
|---|---|---|---|---|---|
| Page title (`.oc-page-header h1`) | Caslon | 26 | 500 | 1.14 | -0.03em |
| Bare `h1` | Sans | 26 | 500 | 1.14 | -0.022em |
| `h2` / `.oc-section-heading` | Sans | 20 | 600 | 1.14 | -0.016em |
| `h3` | Sans | 17 | 600 | 1.14 | -0.01em |
| Card title (`.oc-card-heading`) | Caslon | 17 | 600 | 1.14 | -0.01em |
| `h4`-`h6` | Sans | 14 | 600 | 1.3 | 0 |
| Dialog / sheet title | Caslon | 22 | 500 | 1.14 | -0.016em |
| Panel heading (`.oc-panel-heading h2`) | Sans | 17 | 600 | 1.4 | -0.015em |
| Body (`.oc-body`) | Sans | 15 | 400 | 1.6 | 0 |
| Body small (`.oc-body-small`, card description) | Sans | 14 | 400 | 1.6 | 0 |
| Caption (`.oc-caption`, `small`) | Sans | 12 | inherit | 1.45 | 0 |
| Label / nav / `th` | Sans | 14 | 500 | 1.45 | 0 |
| Button | Sans | 14 | 600 inside the product shell (650 outside it) | 1.45 | 0 |
| Eyebrow (`.oc-eyebrow`) | Sans | 12 | 600 | inherit | normal |
| Editorial label | Sans | 12 | 600 | 1.5 | 0.065em, uppercase, `#a04d00` |

### Colour tokens (light theme)

| Token | Hex | Use |
|---|---|---|
| `--background` | `#f6f5f1` | page canvas |
| `--foreground` / `--primary` / `--school-primary` | `#232d4b` | text, primary fills (UVA Blue) |
| `--primary-foreground` | `#ffffff` | text on solid navy |
| `--card` / `--popover` / `--oc-content-solid` | `#fffefa` | solid card and field fill |
| `--secondary` | `#eaece8` | neutral chip fill |
| `--secondary-foreground` | `#34485a` | neutral chip text |
| `--muted` | `#edeee9` | muted fill |
| `--muted-foreground` | `#52606d` | secondary text |
| `--accent` | `#e7ebe7` | highlighted list/menu row |
| `--border` | `#dfe3dd` | hairlines |
| `--input` | `#8793a0` | field borders |
| `--oc-content-edge-solid` | `#e0e5e3` | solid card edge |
| `--oc-content-soft` | `#f1f4f3` | soft panel, tab track |
| `--oc-content-soft-blue` / `--oc-surface-blue` | `#eaf0f2` | soft blue panel |
| `--oc-surface-sage` / `-lilac` / `-warm` | `#e9efe8` / `#efedf3` / `#f4ede1` | tinted panels |
| `--brand-orange` / `--school-accent` | `#e57200` | accents, indicator bars, dots (not small text) |
| `--brand-ink` / `--school-accent-text` | `#a04d00` | small orange text |
| `--brand-subtle` | `#fceadd` | orange tint fill |
| `--school-accent-on-dark` | `#f3a274` | accent text on navy |
| `--ring` / `--school-ring` | `#c86400` | focus ring |
| `--focus-halo` | `#fffefa` | halo under the ring on filled controls |
| `--success` / `--success-subtle` | `#296448` / `#edf5ef` | |
| `--warning` / `--warning-subtle` | `#795617` / `#fbf3df` | |
| `--destructive` / `--error-subtle` | `#ac3544` / `#fbeef0` | destructive text is white on the solid fill |
| `--info` / `--info-subtle` | `#295c88` / `#edf3fa` | |
| `--interview` / `--interview-subtle` | `#655080` / `#f1eef7` | interview purple |
| `--overlay` | `rgb(12 25 43 / 42%)` | dialog and sheet scrim |
| `--oc-glass-cream` | `#fff7ec` | text on navy glass and navy pills |
| `--oc-glass-light-solid` | `#faf8f3` | light glass fallback |
| `--oc-rail-text` / `--oc-rail-muted` / `--oc-rail-selected` / `--oc-rail-rule` | `#f6f5f1` / `#b0c1cc` / `#2a4156` / `#3c5365` | navy navigation surfaces |
| `--chart-1…5` | `#295c88`, `#296448`, `#795617`, `#655080`, `#14243a` | |
| `--oc-vote-fail` / `--oc-vote-track` | `#8794a3` / `#e3e6e0` | voting bars (pass = navy, held = orange) |

### Radii, elevation, spacing, motion

| Token | Value | Use |
|---|---|---|
| `--oc-radius-sm` | 6 px | chips, small controls, checkboxes |
| `--oc-radius-md` (`--radius`) | 10 px | list rows, menu surfaces by default |
| `--oc-radius-lg` | 16 px | cards, panels, inputs, toasts |
| `--oc-radius-xl` | 22 px | feature cards, raised glass |
| `--oc-radius-2xl` | 24 px | dialogs and overlays |
| `--oc-radius-full` | 999 px | pills, buttons, avatars |
| Tailwind mapping | `rounded-sm` 6, `-md` 10, `-lg` 16, `-xl` 22, `-2xl` 22, `-3xl` 24 | |

| Elevation | Value |
|---|---|
| Surface (cards; glass depth) | `inset 0 1px 0 rgb(255 255 255 / 90%), 0 1px 2px rgb(12 29 47 / 4%), 0 14px 30px -20px rgb(12 29 47 / 24%)` |
| Surface, solid fallback | `0 1px 2px rgba(35,45,75,.04), 0 10px 24px -20px rgba(35,45,75,.18)` |
| Surface hover | `0 3px 8px rgba(35,45,75,.05), 0 16px 30px -22px rgba(35,45,75,.22)` |
| Contact (`--oc-shadow-surface`) | `0 1px 3px rgba(35,45,75,.05)` |
| Popover (`--oc-shadow-popover`) | `0 6px 12px rgba(35,45,75,.06), 0 20px 56px rgba(35,45,75,.12)` |
| Menu glass (`--oc-glass-menu-depth`) | `inset 0 1px 0 rgb(255 255 255 / 95%), 0 0 0 1px rgba(35,45,75,.08), 0 8px 12px -8px rgb(8 22 37 / 14%), 0 20px 48px -16px rgb(8 22 37 / 26%)` |
| Modal (`--oc-shadow-modal`) | `0 24px 100px rgba(35,45,75,.22)` |

| Spacing token | Value at 390 px |
|---|---|
| `--oc-space-unit` (Tailwind unit) | 4 px |
| `--oc-space-control` | 12 px |
| `--oc-space-content` / `--oc-density-gap` / `--oc-density-inset` | 20 px |
| `--oc-space-section` | 24 px |
| `--oc-space-page` | 16 px (`clamp(1rem, 2.5vw, 2rem)`) |
| `--oc-content-padding` | 16 px (`clamp(1rem, 1.55vw, 1.5rem)`) |
| `--oc-content-gap` | 16 px (`clamp(1rem, 1.6vw, 1.5rem)`) |
| `--oc-density-header-gap` | 6 px |
| `--oc-density-row` | 12 px |
| `--oc-control-height` / `-compact` / `-large` | 40 / 36 / 44 px (phones force 44) |
| `--oc-shell-mobile-height` | 76 px (used for bottom padding) |

| Motion token | Value |
|---|---|
| `--oc-duration-micro` / `-ui` / `-entrance` / `-signature` | 140 / 220 / 360 / 900 ms |
| `--oc-ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| `--oc-ease-ui` | `cubic-bezier(0.2, 0, 0, 1)` |
| `--oc-spring` | critically damped spring curve (`linear()` samples), used with `--oc-spring-ui` 515 ms or `--oc-spring-quick` 355 ms |
| `--oc-spring-bounce` | slight overshoot (about 1.5%), 475 ms; only for gesture-thrown motion |
| `--oc-glass-quick` / `--oc-glass-move` | 180 / 360 ms, ease `cubic-bezier(.22, 1, .36, 1)` |
| `--oc-press-in` | 90 ms |
| `--oc-press-scale` / `-large` | 0.98 / 0.99 |
| z-index | sticky 20, dock 35, header 40, overlay 40, modal 50, popover 60, tooltip 70, toast 80 |

### Card anatomy
- **`Card`** (`components/ui/card.tsx`): flex column, **gap 20 px**, **radius 16 px**, vertical padding 16 px with each slot (`CardHeader`, `CardContent`, `CardFooter`) adding 16 px side padding.
  - Fill (default "glass", no blur on phones): `linear-gradient(172deg, rgb(255 255 255 / 72%), rgb(255 255 255 / 0%) 46%), rgb(255 253 248 / 90%)`; solid fallback `#fffefa`.
  - Border: 1 px `rgba(35,45,75,.10)`; solid fallback `#e0e5e3`.
  - Shadow: the surface elevation above.
  - `CardHeader`: grid, gap 8 px, optional action in a second column top-right. `CardTitle`: Caslon 17 px weight 600. `CardDescription`: 14 px, `#52606d`. `CardFooter`: wrapping row, gap 12 px.
- **`Panel` / `.oc-content-panel`**: same fill, border, radius and shadow with 16 px padding all round. `tone="subtle"`: `#edeee9` fill, no border or shadow.
- **Variants:** `solid` (opaque `#fffefa`, edge `#e0e5e3`, solid shadow; for dense data); `glass-raised` (radius 22 px, the header's light glass material and depth); `glass-navy` (radius 26 px, the dock's navy material, border `rgb(191 216 238 / 25%)`, text `#fff7ec`, muted text `#b0c1cc`).
- **Related surfaces:** `.oc-form-section` (grid gap 16, padding 16, radius 16, card fill, no shadow); `.oc-toolbar` (padding 12 on phones, gap 10, radius 16); `.oc-detail-panel` (card surface with a bordered header); `.oc-feedback` (info strip: `#edf3fa` fill, 3 px left rule `#295c88`, radius 16, 14 px; as `role="alert"`: `#fbeef0` fill, `#ac3544` rule and text); metric strip tiles (2 columns on phones, 10 px gap, padding 14/12, number 24 px weight 500).
- **Cards as links/buttons:** pressed = 9% navy inset tint over the fill plus `scale(.99)`.

### Buttons (`components/ui/button.tsx` + `interface-primitives.css`)
All variants are pills (radius 999), `inline-flex`, gap 8 px, 14 px text, weight 600 in the product shell, 16 px icons, 1 px border. Disabled: 50% opacity. On phones **every size is at least 44 px tall** (icon sizes also 44 px wide).

| Variant | Fill | Text | Border | Shadow |
|---|---|---|---|---|
| `default` (and `glass-primary`): navy pill | `linear-gradient(155deg, rgb(140 180 214 / 18%), transparent 60%), #232d4b` | `#fff7ec` | `rgb(212 231 248 / 18%)` | `inset 0 1px 0 rgb(222 239 255 / 20%), 0 2px 4px rgb(8 22 37 / 12%)` |
| `outline`, `secondary`, `glass`: light pill | light glass material (same as header circles, no blur) | `#232d4b` | `rgb(255 255 255 / 68%)` | light glass depth |
| `ghost` | transparent | inherits | transparent | none |
| `link` | none; height auto, no side padding | `#232d4b`; underline on hover, offset 4 px | none | none |
| `destructive` | `#ac3544` | `#ffffff` | transparent | `inset 0 1px 0 rgb(255 255 255 / 22%), 0 2px 4px rgb(8 22 37 / 12%)` |
| `accent` | `#fceadd` | `#a04d00` | transparent | none |
| tone `interview` on default | sheen over `#655080` | `#fff7ec` | `rgb(255 255 255 / 16%)` | as default |

| Size | Class height | Padding x (with icon) | On phones |
|---|---|---|---|
| `default` | 40 | 16 (12) | 44 tall |
| `sm` | 36, gap 6 | 12 (10) | 44 tall |
| `lg` | 44 | 24 (16) | 44 tall |
| `icon` / `icon-sm` / `icon-lg` | 40 / 36 / 44 square | none | 44x44 minimum |

- Pressed: navy and destructive pills take an inset `rgb(4 15 29 / 22%)` tint; light, ghost and accent take a 9% navy tint; ghost on navy glass takes `rgb(255 255 255 / 16%)`; link drops to 72% opacity. All except link also scale to 0.98 (in 90 ms, back on a 355 ms spring).
- Focus: 2 px `#c86400` outline, offset 2 px; navy pills add a 2 px cream halo between pill and ring.
- `IconButton`: ghost icon button by default; `aria-label` is mandatory.

### Inputs and search fields
- **`Input` / `Textarea` / select trigger:** border 1 px `#8793a0`, radius 16 px, fill `#fffefa`, shadow `inset 0 1px 0 rgb(255 255 255 / 80%), inset 0 1px 2px rgba(35,45,75,.06)`, padding 4/12 px (textarea 8/12, min-height 64 px, grows with content). Placeholder `#52606d`. Height 44 px on phones; **font 16 px on phones** (prevents iOS zoom), 14 px from 768 px.
- Focus: border `#232d4b` + 2 px `#c86400` outline, offset 2 px. Invalid: border `#ac3544`.
- **Native select (`.oc-native-select`):** same field look, 44 px, 16 px text, custom caret 16 px at the right.
- **Search field (`.oc-search-field`):** pill, min-height 46 px, light glass fill + depth, border `rgb(255 255 255 / 68%)`, 16 px `Search` icon in muted, borderless input 44 px tall (16 px text on phones), a 32 px round clear button, optional shortcut chip hidden on phones. Focus-within: navy border + orange ring.
- **Checkbox:** 16 px box, radius 6, border `#8793a0`; checked: navy pill gradient with cream tick; label rows are 44 px tall on phones with an enlarged hit area. **Switch:** light glass track with `#8793a0` border and grey thumb; on: track 16% navy over card, navy border, navy thumb. Native radios/checkboxes use `accent-color: #232d4b`.
- **Date picker trigger:** field-like, 40 px, 16 px muted calendar icon; grid of 40 px day buttons, selected day navy with white text, today outlined.

### Segmented control and tabs
- **`SegmentedControl`** (`components/ui/segmented-control.tsx`, re-exported from `components/product/segmented-control.tsx`): `role="group"` with `aria-pressed` buttons, roving focus (arrow keys, Home/End).
  - Track: full width on phones, min-height 54 px (compact 46), padding 4 px, gap 4 px, radius 999, light glass fill and depth, border `rgb(255 255 255 / 68%)`; scrolls horizontally when options overflow.
  - Segment: min-height 44 px (also for compact inside a page stack on phones), padding 8/16, 14 px weight 500, colour `#232d4b`, `flex: 1 0 auto`. Optional leading icon and a quiet trailing count (`Pending 1`).
  - Selected: text `#fff7ec` on the navy pill (gradient + border `rgb(212 231 248 / 18%)` + pill shadow). With up to four single-select options the navy pill is one sliding indicator (420 ms spring); with more options, or in multi-select (filter chips), each selected segment fills itself.
  - Pressed: 9% navy tint (navy tint on the selected one); no scale.
- **`Tabs`** (`components/ui/tabs.tsx`), `TabsList` variants:
  - `segmented` (default): same 54 px glass track; triggers 44 px tall, 13 px weight 500, padding-x 14 px, equal columns; active = cream text on a sliding navy pill. With three or more tabs the track becomes a horizontal scroller and labels never truncate.
  - `subtle`: track `#f1f4f3`, radius 999, 1 px edge, padding 3 px, gap 4; triggers 36 px min (44 on phones inside a page stack), 14 px weight 500; active = `#f6f5f1` fill with the 1 px contact shadow.
  - `underline`: no track, bottom hairline, gap 16 px; active trigger has a 2 px navy bottom border.
  - Tabs root: column, gap 8 px (16 px inside a page stack).

### Badges and status chips
- **`Badge`** (`components/ui/badge.tsx` + `product-components.css`): pill (radius 999), padding 2/8 px, 12 px weight 600, line-height 1.4, 12 px icons, gap 6 px. Fill = a white sheen (`linear-gradient(172deg, rgb(255 255 255 / 55%), transparent 62%)`) over the tint; border 1 px at 16% of the ink; inner top highlight.

| Variant | Tint (background) | Ink (text) | Border |
|---|---|---|---|
| `default`, `secondary` | `#eaece8` | `#34485a` | `#34485a` at 16% |
| `success` | `#edf5ef` | `#296448` | `#296448` at 16% |
| `destructive` | `#fbeef0` | `#ac3544` | `#ac3544` at 16% |
| `warning` | `#fbf3df` | `#795617` | `#795617` at 16% |
| `info` | `#edf3fa` | `#295c88` | `#295c88` at 16% |
| `accent` | `#fceadd` | `#a04d00` | `#a04d00` at 16% |
| `outline` | transparent | `#232d4b` | `#dfe3dd`, no highlight |

- **`StatusPill`** (`components/ui/status-pill.tsx`): application state is **not a capsule**: a 16 px tinted icon followed by plain text in the surrounding text colour, 12 px weight 500, gap 5 px. Labels come from `lib/application-status.ts`.

| Stored status | Label | Icon | Icon colour |
|---|---|---|---|
| `DRAFTING` | `Draft` | `FilePenLine` | `#52606d` |
| `SUBMITTED` | `Submitted` | `Send` | `#34485a` |
| `IN_REVIEW` | `In review` | `Eye` | `#295c88` |
| `INTERVIEWING` | `Interview` | `CalendarClock` | `#655080` |
| `ACCEPTED` | `Accepted` | `CheckCircle2` | `#296448` |
| `REJECTED` | `Not selected` | `XCircle` | `#ac3544` |
| `WAITLISTED` | `Waitlisted` | `Clock` | `#795617` |

- **`StatusMark`** (free-text status in the same style): tone `neutral` = `Circle` muted; `active` = `Clock` `#295c88`; `done` = `CheckCircle2` `#296448`; `strong` = filled `CheckCircle2` navy. A label that names an application state renders exactly as `StatusPill` unless `literal` is set.
- **`.oc-status-label`**: quiet annotation, no fill, 2 px left rule in the accent colour, 12 px weight 500.
- Club role labels (`lib/copy/terms.ts`): `Owner`, `Admin`, `Recruiting Lead`, `Interviewer`, `Member`.

### Overlays at phone width
All overlay surfaces (dialog, sheet, popover, dropdown, select) share the frosted cream material `linear-gradient(150deg, rgb(255 255 255 / 34%), transparent 50%), rgb(255 251 245 / 96%)` with `backdrop-filter: blur(18px) saturate(135%)`, border `rgb(255 255 255 / 68%)` and the menu glass shadow. They are the only content surfaces that blur on phones. Scrim (dialogs and sheets only): `rgb(12 25 43 / 42%)`, fades in.

| Primitive | Position and size | Radius | Close affordance | Animation |
|---|---|---|---|---|
| `Dialog` | centred both ways; width `100% - 32px` (358 px); max-height `100dvh - 32px`, scrolls inside; padding 24, gap 16 | 24 px | `X` 16 px in a 44x44 target at top-right 12 px (70% opacity), sr-only `Close`; header reserves 44 px on the right | zoom from 95% on a 355 ms spring; scrim fades; none under reduced motion |
| `DialogFooter` | buttons stacked, primary on top (`flex-col-reverse`), gap 8; 16 px top padding and a hairline above | | | |
| `Sheet` right / left | full height, width 75% (292 px); `border-l` / `border-r`; column, gap 16 | none | `X` in 44x44 at top-right 8 px | slides in 515 ms spring, out 355 ms |
| `Sheet` bottom / top | full width, height auto | none | same `X`; bottom sheets also show a grabber (40x6 px, muted at 35%, inside a 28 px drag strip) and can be dragged down to dismiss | slides from the edge |
| `SheetHeader` / `SheetFooter` | padding 16; title Caslon 22 px; description 14 px muted | | | |
| `.oc-workspace-drawer` (detail drawers) | full height `100dvh`, padding 56 / 20 / max(20, safe-area), scrolls, max-width 100vw | | | |
| `Popover` | anchored, default width 288 px, padding 16, 4 px offset | 10 px | outside tap or Escape | fade + zoom 95% + 8 px slide from the trigger side |
| `DropdownMenu` | anchored, min-width 128 px, padding 4, max-height = available space | 10 px | outside tap or Escape | same as popover |
| Dropdown item | padding 6/8 px, gap 8, 14 px, 16 px muted icon, radius 6; highlighted `#e7ebe7`; destructive items in `#ac3544`; separator 1 px `#dfe3dd` with 4 px margins; label 14 px weight 500; checkbox/radio items show a tick or 8 px dot at the left | | | |
| Header menus (account, row "…") | padding 6, items 44 px tall, highlighted `#e7ecec` | 16-18 px, items 10-12 px | | 180 ms |
| `Select` | trigger = field (44 px on phones, 16 px text, `ChevronDown` 16 px at 50%); content anchored, min-width = trigger width, padding 4 | 10 px | | as popover |
| Select item | padding 6 / 32 / 6 / 8, 14 px, tick at the right, highlighted `#e7ebe7`; group label 12 px muted | | | |
| `Tooltip` | navy frosted, cream text, navy edge | | | |
| Confirm dialog (`useConfirm`) | alert dialog; title, description, cancel and confirm (danger tone = destructive button) | | | |

- There is no `components/ui/drawer.tsx` in this repo; bottom sheets use `Sheet side="bottom"`.

### Toasts (sonner)
- Position: bottom of the viewport, 16 px from left and right, bottom offset `6rem + safe-area` inside the shell (clears the dock), 24 px elsewhere. z-index 80.
- Radius 16 px. Default toast: frosted cream material + blur, text `#232d4b`, border `rgb(255 255 255 / 68%)`, menu shadow.
- Rich colours: success `#edf5ef` / `#296448`; error `#fbeef0` / `#ac3544`; warning `#fbf3df` / `#795617`; info `#edf3fa` / `#295c88`; border `#dfe3dd` on all four.
- Icons 20 px: `CheckCircle2`, `XCircle`, `TriangleAlert`, `Info`; loading = 20 px spinner.
- Action button (e.g. Undo): navy fill, white text, pill, weight 600.

### Focus, pressed states, reduced motion
- **Focus ring:** one colour everywhere, `#c86400`, 2 px solid. Default offset 3 px for any link, button, field or focusable element. On or inside filled elements a cream `#fffefa` halo separates ring and fill: outset 2 px halo for navy pills; inset 4 px halo with the ring inset 2 px for dock tabs, menu items, segments and rail items.
- **Pressed:** tone always (inset full-cover shadow: 9% navy on light controls, `rgb(4 15 29 / 22%)` on navy and solid fills, `rgb(255 255 255 / 16%)` on transparent controls over navy glass). Scale 0.98 for standalone pills, buttons, header circles; 0.99 for large cards; no scale for items inside a track or list (tabs, segments, menu items, dock tabs, rows). Disabled and loading controls never press. Timing: in 90 ms ease-out, release on the element's own 355 ms spring.
- **Reduced motion:** all press transforms removed (tone stays); sliding indicators jump; dialogs, sheets and menus appear without animation; skeleton sheen and spinners stop; header and dock transitions off; welcome-text fade off.
- **Reduced transparency / increased contrast:** every glass material becomes solid (`#faf8f3` light, `#232d4b` navy, `#fffefa` cards), blur and glass shadows are removed, edges become `#526675` (light) or `#91a8bc` (navy), the header band is the flat canvas with a 1 px bottom rule.
- **Touch targets:** inside the shell every `button` and `select` has `min-height: 44px` at <=639 px; inputs, textareas and selects are 16 px text.

## Home tab

Scope: the personal (student) workspace screens that light the **Home** dock tab at 390 px: `/home`, `/applications`, `/clubs`, `/clubs/tasks`, and a plain member's club home `/club/<clubId>/workspace`. Seeded account: "Sam Staging-Student".

Evidence: source, text dumps of the rendered pages and the 390 px captures listed on each screen's **Screenshot** line. Things no capture shows (other states, error copy, drawers not opened) are from source.

### Shared values used below (light theme, UVA)

| Token | Value |
|---|---|
| `--foreground` / `--primary` (`--school-primary`) | `#232d4b` |
| `--muted-foreground` | `#52606d` |
| `--background` (page) | `#f6f5f1` |
| `--card` / `--oc-content-solid` | `#fffefa` |
| `--muted` | `#edeee9`; `--secondary` `#eaece8`; `--secondary-foreground` `#34485a` |
| `--border` | `#dfe3dd`; `--oc-content-edge-solid` `#e0e5e3`; glass edge = `--school-primary` at 10% |
| `--brand-orange` | `#e57200`; `--brand-ink` `#a04d00`; `--brand-subtle` `#fceadd`; `--ring` `#c86400` |
| `--info` / `--interview` / `--success` / `--warning` / `--destructive` | `#295c88` / `#655080` / `#296448` / `#795617` / `#ac3544` |
| `--interview-subtle` | `#f1eef7` |
| `--oc-glass-cream` | `#fff7ec`; navy glass solid = `#232d4b` (material: `rgb(14 35 56 / 92%)` with light gradients); navy edge `rgb(191 216 238 / 25%)` |
| Radii | sm 6, md 10, lg 16, xl 22, 2xl 24, full 999 px; `--oc-glass-row-radius` 14; `--oc-glass-chip-radius` 12 |
| Type | display = Libre Caslon Text (`--oc-font-display`); sans = Source Sans 3. `--oc-text-caption` 12, `--oc-text-small` 14, `--oc-text-body` 15, `--oc-text-card` 17, `--oc-text-modal` 22, `--oc-text-section` 20 at 390 px (clamp min), `--oc-text-title` 26 at 390 px (clamp min) |
| Weights | medium 500, semibold 600 |
| Page gutter | `main.oc-workspace-content`: 10 px top, 16 px sides, bottom = 76 px dock + 24 px + safe area |
| `--oc-content-gap` / `--oc-content-padding` | both 16 px at 390 px (clamp min) |

**Application status mark (`StatusPill`, `components/ui/status-pill.tsx`)** — not a capsule: a 16 px tinted icon + plain text, 12 px / 500, text in the inherited colour, gap 5 px, no background or border.

| Stored status | Label | Icon (semantic) | Icon colour |
|---|---|---|---|
| DRAFTING | `Draft` | `FilePenLine` | `#52606d` |
| SUBMITTED | `Submitted` | `Send` | `#34485a` |
| IN_REVIEW | `In review` | `Eye` | `#295c88` |
| INTERVIEWING | `Interview` | `CalendarClock` | `#655080` |
| ACCEPTED | `Accepted` | `CheckCircle2` | `#296448` |
| REJECTED | `Not selected` | `XCircle` | `#ac3544` |
| WAITLISTED | `Waitlisted` | `Clock` | `#795617` |

**Dashboard primitives (`components/product/dashboard/dashboard.tsx|.css`)** used by Home and club home:
- `DashboardCard`: glass panel (`#fffefa`-ish surface, 1 px edge, radius 20 px, padding 16 px sides; on Home phone padding-block 14/16 px), inner gap 14 px. Head row: `h2` (sans 17 px / 600) left, optional "more" link right, min-height 44 px.
- `DashboardMore` / `NeedsAction`: text link/button, 14 px / 600, colour `#232d4b`, followed by `ArrowRight` 14 px, min-height 44 px, no background.
- `GlassRow`: grid `auto | 1fr | auto`, gap 12 px, min-height 56 px, padding 10 px 8 px (bleeds 8 px past the card padding), radius 14 px; rows separated by a 1 px top edge. Copy: `strong` 14 px / 600 line-height 1.35 (wraps), optional note (14 px muted, 2-line clamp), `small` 12 px muted single line with ellipsis. Trailing defaults to `ArrowRight` 14 px muted when the row is a link/button.
- `DateChip`: 44 × 48 px, radius 12 px, navy (`#232d4b`), cream text; line 1 month `MMM` 12 px / 600 uppercase letter-spacing .04em; line 2 day number Caslon 18 px. `kind="interview"`: bg `#f1eef7`, text `#655080`, 1 px ring interview 18%. `kind="deadline"`: bg `#fceadd`, text `#a04d00`, ring orange 22%. Rendered in Eastern time.
- `DashboardQuiet`: paragraph 14 px muted; `<strong>` inside is foreground 600.
- Cards fade/rise 6 px on entry (360 ms, staggered 40 ms); disabled under reduced motion.

---

### 01 · Home

- **Route:** `/home`
- **Screenshot:** `docs/mobile/screenshots/web/01-home.png` (whole page), `01-home.viewport.png` (first viewport)
- **Source:** `app/(workspace)/home/page.tsx`, `components/views/student-dashboard-view.tsx` (the `phone` block; the desktop dashboard is `display:none` below 1024 px), `components/views/student-home.css`, `components/product/welcome-header.tsx|.css`, `lib/welcome.ts`, `lib/student-home.ts`, `lib/application-stages.ts`, `hooks/use-suggested-clubs.ts`, `lib/club-suggestions.ts`, `components/app-shell.tsx` (mounts the compact invitations block above the view).
- **Note on the task's source list:** `application-journey-card.tsx`, `suggested-clubs.tsx`, `dashboard-meeting.tsx`, `dashboard-task.tsx`, `dashboard-preparation.tsx` are **not** imported by Home. Home builds everything inline from the dashboard primitives. `dashboard-task` / `dashboard-meeting` are the drawers of club home (screen 60).

**Layout (top to bottom)** — single column, 18 px gap between phone sections, 16 px gap between hero and body.

1. **Pending-invitation strip (conditional, above the hero).** Only when the account has an un-dismissed club invitation; renders nothing otherwise (seeded account: nothing). One invitation = one compact card (radius 16, 1 px orange-20% border, padding 12 × 16): 44 px logo, title `You’ve been invited to join {Club}` (owner claim: `You’ve been invited to claim {Club}`) 14 px / 600, line `{Club} invited you as a member.` (roles: `an administrator`, `a recruiting administrator`, `an interviewer`, `a member`; owner: `You’re the designated administrator for {Club}.`), buttons `View invitation` (ghost link → `/invitations/{id}`), `Accept` (owner: `Claim organization`), `Not now` (outline), `Decline` (ghost). Two or more collapse into a `<details>`: `{n} invitations need your response` + `Review invitations`.
2. **Hero (`WelcomeHeader`)** with a soft decorative ambient glow behind it.
   - Eyebrow (date line): device-local date `weekday, month day` e.g. `Wednesday, November 18`; 12 px / 600, `#52606d`. Before the client clock is read: `Your OutClass`.
   - `h1` greeting: Caslon, 28 px at 390 px per `student-home.css` (`clamp(1.75rem, 1.25rem + 1vw, 2.125rem)`; in `01-home.viewport` it measures closer to 30–32 px, exact rendered size unverified), line-height 1.15, weight 500, letter-spacing −.03em, `#232d4b`; reserves 2 lines of height (wraps for long names).
   - Subtitle: one sentence, 15 px, line-height 1.6, `#52606d`, margin-top 4 px, reserves 1 line. Text swap fades 180 ms (opacity .85→1).
3. **Conditional prompt cards** (each a `DashboardCard`, hidden when not applicable; none shown for the seeded account):
   - `Interview availability` — rows `{Club} · {Round}` + response label, button `Respond to request` (primary, when awaiting) or `View response` (outline); error `Could not refresh your requests.` + `Retry`.
   - `Graduating this spring?` (April–July of grad year) — `Your account stays as an alumni account from Aug 1, with your profile and history. Clubs list you as alumni.` Buttons `Yes, I’m graduating`, `Update my year`; X `aria-label="Dismiss graduation question"`. Second step: `Where are you going to work?`, `Confirm graduation`, `Back`.
   - `Help us suggest clubs` — `Four quick questions, about a minute. Only you see your answers.` + `Answer`; X `aria-label="Dismiss"`.
4. **To-do card** (`h2` `To-do`; in the capture the card is about 335 px tall with three rows). Checklist, max 4 rows; rows separated by a 1 px top border, padding-block 10 px (first row 4 px top, no border).
5. **Coming up card** (`h2` `Coming up`, head link `Calendar →`). Rendered only when there is at least one item; max 3 rows.
6. **Furthest along** — heading outside the card (`h2` `Furthest along`, 17 px / 600, margin-bottom 8 px) then the navy status card. Rendered only when a submitted, undecided application exists.
7. **Applications card** (`h2` `Applications`, head link `View all →`). Up to 5 rows.
8. **Suggested clubs card** (`h2` `Suggested clubs`, head link `Explore →`). Rendered only when there are suggestions; up to 4 rows. It is a vertical list, not a carousel.
9. **My Clubs** — heading row outside any card: `h2` `My Clubs` left, `All clubs →` right (baseline aligned); then a 2-column tile grid (gap 10 px).
10. Fixed 5-tab dock (Home active) — covered by the shell section.

**Greeting rules** (`welcomeGreeting`, device-local hour, first name from profile):

| Local hour | With first name | Without |
|---|---|---|
| clock not yet read | `Welcome, {first}.` | `Welcome to OutClass.` |
| 21:00–04:59 | `Still up, {first}?` | `Still up?` |
| 05:00–11:59 | `Good morning, {first}.` | `Good morning.` |
| 12:00–16:59 | `Good afternoon, {first}.` (capture: `Good afternoon, Sam.`) | `Good afternoon.` |
| 17:00–20:59 | `Good evening, {first}.` | `Good evening.` |

**Summary sentence** (`welcomeSubtitle`, personal mode): every applicable candidate is collected, then the one with the lowest priority number wins; ties → earliest time → stable id. Fallback (nothing applies, applications not loaded, or clock not read): `Explore what's new in OutClass.` (straight apostrophe in source).

| Priority | Trigger | Sentence |
|---|---|---|
| 1 | a member-club task needing submission, due within 24 h or overdue | `You have an overdue task.` / `You have a task due today.` / `You have a task due tomorrow.` |
| 1 | a draft (club still accepting) whose deadline is within 24 h or passed | `An application deadline has passed. Check your draft.` / `You have an application deadline today.` / `You have an application deadline tomorrow.` |
| 2 | confirmed/RSVP’d event or member-club meeting starting within 3 h | `Your next {interview\|meeting\|club event} starts at {h:mm AM/PM}.` |
| 3 | any member-club task needing submission | `You have tasks ready to work on.` (seeded example) |
| 3 | drafts for clubs still accepting | `You have {n} application(s) to finish.` e.g. `You have 1 application to finish.` |
| 4 | such an event later today | `Your next {kind} starts at {time}.` (all-day: `Your next {kind} is today.`) |
| 5 | such an event on a later day | `Your next {kind} starts tomorrow at {time}.` / `… starts on {Mon D} at {time}.` (all-day: `is tomorrow.` / `is on {Mon D}.`) |
| 5 | any application in DRAFTING/SUBMITTED/IN_REVIEW/INTERVIEWING | `You have {n} application in progress.` / `You have {n} applications in progress.` |

Events count only when response is going/confirmed, or when it is a meeting (`type "Other"`) of a club the student belongs to; declined events and deadlines never count.

**To-do card**
- Row anatomy: left a 20 × 20 px empty square (1.5 px border `#52606d` at 70% opacity, radius 6 px, 2 px top margin). It is **decorative only** (`aria-hidden`, not a control, cannot be ticked). The row whose item is the computed "next action" (`order 0`) gets an orange (`#e57200`) full-opacity border. Right column (gap 2 px): title `strong` 14 px / 600; detail `small` 12 px `#52606d`; action link 14 px / 600 `#232d4b` + `ArrowRight` 14, min-height 36 px.
- Only the action link is tappable (the row itself is not).
- Items are built in this fixed list, sorted by `order` ascending (stable), then cut to the first **4**:

| Item | Shown when | Title | Detail | CTA → target | Order |
|---|---|---|---|---|---|
| Deadline | ≥1 draft with a future deadline event, club still accepting | one: `{Club} application due`; several: `{n} applications due` | `Application deadline: {Wed, Nov 19, 5:00 PM}` | `Continue draft` → `/applications` with that draft open | 0 if it is the next action, else 1 |
| Tasks | ≥1 overdue member-club task needing submission | `{n} club task(s) overdue` | `Submit your work or ask your club for more time.` | `Open tasks` → `/club/{clubId}/workspace?section=tasks&taskView=mine` (first overdue club) | 2 |
| Interviews | ≥1 application with status Interviewing | one: `Interview with {Club}`; several: `{n} interview invitations` | `Book your interview or view your appointment.` | `View interview` → Applications, status detail of the first interviewing application (`/applications?applicationId={id}&tab=interviews`) | 3 |
| Update | an unread urgent notification among the top 3 (skipped if it is an "Interview Invite" for a club already counted above) | notification title | notification preview | `Read update` → `/inbox` focused on it | 0 if next action, else 4 |
| Drafts | drafts without a future deadline, club still accepting | one: `Finish your {Club} application`; several: `{n} drafts in progress` | `{n} response(s) saved` or `Pick up where you left off.` | `Continue draft` → `/applications` with the first draft open | 0 if next action, else 5 |
| Event | the next agenda event is the next action and starts within 48 h | event title | `{Thu, Nov 19, 5:00 PM}` + ` · {location}` when set | `View event details` → `/calendar` focused on the event | 0 |

- "Next action" (`nextHomeAction`): earliest of (nearest draft deadline, next agenda event) if within 48 h (deadline wins ties) → else unread urgent update → else first draft → else next event → else none.
- Seeded example: `FWIT Open House` / `Thu, Nov 19, 5:00 PM · Student Union Ballroom B` / `View event details` (orange box); `2 interview invitations` / `Book your interview or view your appointment.` / `View interview`; `Finish your Piedmont Founders Lab application` / `1 response saved` / `Continue draft`.
- Date format everywhere on Home (`when`): `en-US`, Eastern time, `weekday short, month short day, h:mm AM/PM` → `Thu, Nov 19, 5:00 PM`.

**Coming up card**
- Items: up to 4 upcoming agenda events (not declined, not deadlines, start ≥ now) plus up to 2 upcoming draft deadlines, sorted by time; the phone shows the first **3**.
- Row: `DateChip` (navy; interview = purple tint; deadline = orange tint) · title 14 px / 600 (wraps) · detail 12 px muted single line with ellipsis · trailing `ArrowRight` 14 muted.
- Detail template: `{Thu, Nov 19, 5:00 PM} · {Interview | Coffee chat | Club event}[ · {location}]`. Deadline rows: title `{Club} application due`, detail `{date} · Deadline`.
- Seeded (all three chips `NOV` / `19`, navy): `FWIT Open House` — `Thu, Nov 19, 5:00 PM · Club event · Student Union Ballroom B` (renders `… · Student Un…`); `CWW Open House` — `… · Club event · Engineering Commons 204` (renders `… · Engineerin…`); `Blue Ridge Consulting Collective: Spring Info Session` (title wraps to two lines) — `Thu, Nov 19, 6:00 PM · Club event · South Lawn Tent` (renders `… · South Law…`). Every detail line is clipped at 390 px.
- Tap: event row → `/calendar` focused on that event; deadline row → opens the draft. `Calendar →` → `/calendar`.

**Furthest along (navy card)**
- Chosen application: submitted, not Accepted/Rejected, not Waitlisted; highest stage wins (Interviewing > In Review > Submitted); ties keep the Home list order.
- Card: padding 16 / 18 / 8 px, radius 22 px, navy glass, 1 px edge `rgb(191 216 238 / 25%)`, deep shadow, text cream `#fff7ec`. Presses scale to .985.
- Line 1 `small`: `Application status` — displayed uppercase, 12 px / 600, letter-spacing .14em, cream at 70%.
- Line 2: club name, Caslon 20 px / 400, line-height 1.2, 4 px top margin, 12 px bottom padding, 1 px rule cream 14%. The name is the button; its hit area covers the whole card → opens that application's status detail.
- Four steps, each row min-height 44 px, 12 px gap, 14 px text, separated by 1 px cream 10% rules:

| Step | Label (default) | Label when current |
|---|---|---|
| 0 | `Application submitted` | `Application submitted` |
| 1 | `Club review` | `Club review in progress` |
| 2 | `Interview` | `Interview stage` |
| 3 | `Decision` | (never current here) |

  Stage index: Submitted = 0, In Review = 1, Interviewing = 2. Done steps: `CheckCircle2` 20 px regular, cream, text cream 72%. Current: 20 px orange disc (`#e57200`) with a 6.4 px cream dot, text cream / 600. Upcoming: `Circle` 20 px at 45% opacity, text cream 72%.
- Seeded: `Corner Code Collective` — `Application submitted` ✓, `Club review` ✓, `Interview stage` (current), `Decision`.

**Applications card**
- First 5 of the Home list. Sort: undecided before Accepted/Rejected; drafts first; earlier deadline first; then club name A–Z.
- Row: 36 × 36 px logo tile (radius 10 px; fallback = first two letters of the name, e.g. `Pi`, on `#edeee9`) · name 14 px / 600 · note 12 px muted (one line, ellipsis) · trailing status mark (no chevron on phone). Whole row is a button.
- Note (`applicationNote`):

| State | Note |
|---|---|
| Draft with deadline event | `Deadline · {Thu, Nov 19, 5:00 PM}` |
| Draft, no deadline | `{n} response saved` / `{n} responses saved` (or `Pick up where you left off` when unknown) |
| Interviewing | `Book your interview / view appointment` |
| Accepted | `Your decision is ready` |
| Rejected | `View your decision` |
| Submitted | `Application submitted` |
| other (In Review, Waitlisted) | `Check your application for details` |

- Seeded rows: `Piedmont Founders Lab` / `1 response saved` / Draft · `Corner Code Collective` / `Book your interview / view appointment` (clipped) / Interview · `Lawn Street Capital` / same / Interview · `Women in Quant Finance Circle` / `Application submitted` / Submitted · `Albemarle Data Science Circle` / `View your decision` / Not selected.
- Tap: draft → `/applications` with the draft editor open; anything else → `/applications?applicationId={id}&tab={stage}` which opens the status detail. `View all →` → `/applications`.

**Suggested clubs card**
- Up to 4 public directory clubs ranked from saved clubs, interest-survey answers and profile major; clubs already saved or joined are excluded. Fetched once when any signal exists.
- Row: logo/monogram (`DirectoryLogo`: club abbreviation text such as `AIF` when the club has no logo) · name 14 px / 600 · reason 12 px muted · `ArrowRight` 14. Link → `/club/{clubId}` (public club page).
- Reason templates (strongest signal wins): `Similar to {saved club name}`, `Because you picked {interest}`, `Fits your {major} major`, `Because you want {goal phrase}`.
- Seeded: `Alternative Investment Fund`, `McIntire Investment Institute`, `Rotunda Equity Research Society`, `Virginia Venture Fund`, each `Similar to Lawn Street Capital`. `Explore →` → `/explore`.

**My Clubs tiles**
- One tile per active membership. Tile: padding 14 px, radius 22 px, card surface, 1 px edge, soft shadow; 36 × 36 px logo (radius 10, 8 px below); name Caslon 17 px / 400, line-height 1.25 (wraps up to several lines); role 12 px muted. Link → `/club/{clubId}/workspace`. Presses scale to .985.
- Role text: `President`, `Recruitment lead`, otherwise `Member`.
- Seeded: `Blue Ridge Consulting Collective` / `Member`; `Ragged Mountain Hiking Club` / `Member`. `All clubs →` → `/clubs`.

**Icons:** `ArrowRight` 14 (all "more"/action links, row chevrons); `CheckCircle2` 20 regular and `Circle` 20 (Furthest along); status-mark icons per the table above (16); `X` 16 (dismiss on prompts).

**Behaviour**
- No pull-to-refresh or tabs; plain vertical scroll under the floating header and above the dock.
- Agenda and deadlines come from the server render (no skeleton swap when signed in); the greeting waits for the device clock.
- Home list rows navigate inside the single-page shell (`onNavigate`); the URL carries `applicationId` and `tab` so a reload reopens the same application.

**States**
- Loading (client-only paths): hero plus two skeleton blocks (144 px and 256 px tall, radius 16); `aria-label="Loading your recruiting season"`, sr-only `Loading your recruiting season…`.
- Applications failed to load: the To-do card is replaced by a glass card: **`We couldn’t load your applications.`** `Try again to see the latest information for your account.` + button `Try again` (reloads the page).
- To-do empty: **`You’re clear for now.`** `Deadlines, interview invitations and club tasks that need you will show up here.`
- Coming up empty: card not rendered.
- Furthest along: section not rendered when no qualifying application.
- Applications empty: **`Nothing submitted yet.`** `Find clubs to apply to in Explore.` + link `Explore clubs →` (→ `/explore`).
- Suggested clubs empty: card not rendered on phone.
- My Clubs empty: glass card `Clubs you join appear here, with their meetings and tasks.` (heading row and `All clubs →` still shown).

---

### 06–09 · Applications (Drafts / In review / Interviews / Decisions)

- **Route:** `/applications` — `?tab=drafts|in-review|interviews|decisions`; `?applicationId={id}` opens one application.
- **Screenshot:** `docs/mobile/screenshots/web/06-applications-drafts.png` (+ `06-applications-drafts.viewport.png`), `07-applications-in-review.png`, `08-applications-interviews.png`, `09-applications-decisions.png`
- **Source:** `app/(workspace)/applications/page.tsx`, `components/views/application-tracker-view.tsx`, `components/applications/application-management-card.tsx`, `application-status-card.tsx`, `application-status-detail.tsx`, `application-tracker.css`, `recruitment-offer.tsx`, `components/interviews/applicant-booking.tsx`, `lib/application-stages.ts`, `lib/application-presentation.ts`, `lib/application-status.ts`, `lib/student-applications.ts`, `components/ui/underline-tabs.tsx`.

**Layout (top to bottom)** — vertical stack, 20 px gaps.
1. Page header (expressive): `h1` `Applications` — Caslon 36 px / 400 (`clamp(2.25rem, 3.2vw, 3rem)` → 36), `#232d4b`. Description `Your drafts, applications in review, interviews and decisions.` 15 px muted, 16 px below the title.
2. **Underline tabs** (`role="tablist"`, `aria-label="Application stage"`): `Drafts (n)`, `In review (n)`, `Interviews (n)`, `Decisions (n)`. One row, 24 px gap, horizontal scroll with hidden scrollbar (at 390 px the fourth tab is cut off at the right edge and reached by scrolling); 1 px `#dfe3dd` rule under the row. Tab: 14 px / 500 `#52606d`, min-height 44 px; selected: `#232d4b` text + 2 px `#232d4b` underline. A tab whose count is 0 is shown at 55% opacity but still tappable. Count format: a space then `(n)`.
3. Helper sentence — **on every tab except Drafts**: `Each club moves you between rounds. Later rounds show what comes next, not an invitation.` 12 px muted.
4. Screen-reader-only status line: `{n} application shown` / `{n} applications shown` (`pluralize`). It appears in the text dump but is **not visible**.
5. Optional sync note (12 px muted): `Couldn’t update your applications. Showing what was last loaded.`
6. Card list, 14 px gap.
7. Per-tab empty state when the selected tab has no cards.

**Tab selection:** `?tab=` when valid; otherwise the first stage that has applications in the order Drafts → In review → Interviews → Decisions (so Drafts only when a draft exists). Choosing a tab rewrites `?tab=` with `history.replaceState` (no navigation, no history entry). Stage mapping: DRAFTING → Drafts; SUBMITTED + IN_REVIEW → In review; INTERVIEWING → Interviews; ACCEPTED + REJECTED + WAITLISTED → Decisions. Seeded counts: Drafts (1), In review (1), Interviews (2), Decisions (2).

**Sorting:** Drafts by club name A–Z. Other tabs: needs-attention first, then upcoming booked interviews (earliest first), then other undecided, then decisions; ties by club name.

**Drafts card (`ApplicationManagementCard`)** — card surface, 1 px edge, radius 16, padding 16 px; grid `44px | 1fr`, gap 12 px. As rendered in `06-applications-drafts` everything, the logo included, stacks in the second column and the 44 px first column is empty (see Web issues); order top to bottom: logo, name, responses line, deadline line, progress bar, saved line, `Draft` mark, button.
- Logo 44 × 44 (rounded square, roughly 10 px radius in `06-applications-drafts`; fallback first two letters, e.g. `Pi`, on `#edeee9`).
- `h2` club name 17 px / 600.
- Line: `{completed} of {total} required responses ready` (or `No required club questions`), 12 px muted.
- Line: `Deadline · {Nov 28, 2026, 11:59 PM} · Eastern Time` (demo: `Sample deadline · …`; none: `Deadline not published`); when the club stopped accepting, appended ` · Applications closed` (500 weight).
- Progress bar: 4 px tall, max 352 px wide, track `#edeee9`, fill `#232d4b`; `aria-label="Required responses ready for {Club}"`.
- Line: `Your draft is saved; nothing has been submitted.` | when all required answers valid: `Required responses ready. Review your profile before submitting.` | when closed: `Applications are closed, so this draft can’t be submitted. You can still view or save it.`
- Status mark `Draft`.
- Button, left-aligned in column 2: `Continue draft` + `ArrowRight` 16 (primary navy pill, 40 px high); when the club is closed: `View draft` (outline).
- Seeded: `Piedmont Founders Lab` · `1 of 3 required responses ready` · `Deadline · Nov 28, 2026, 11:59 PM · Eastern Time` · `Your draft is saved; nothing has been submitted.` · `Draft` · `Continue draft`.
- There is **no withdraw or delete-draft control** anywhere on this screen or in these cards.

**Status card (`ApplicationStatusCard`) — In review, Interviews, Decisions** — card surface, radius 16, padding 16 px, 3 px left rule that is transparent normally and orange `#e57200` when the card needs the student's action.
1. Heading (wraps on phone). As rendered in `07`–`09`: the monogram is a **full-width grey bar** (44 px tall, bg `#edeee9`, initials centred) on its own line; below it the `h2` club name 17 px / 600 and the 12 px muted sub-line; below that the status mark on its own line. Source intent is a 44 × 44 logo left of the name with the mark at the right (see Web issues). Monogram = **first letters of the first two words** (`LS`, `CC`, `RE`, `AD`, and `Wi` for Women in Quant Finance Circle).
2. Round stepper (`ol`, `aria-label="Recruitment stages for {Club}"`): inline wrapping list, 12 px, items separated by `→`; each item has a 6.4 px ring dot. Stage names are the club's own pipeline round names, with `Submitted` prepended unless the club has a round named Applied/Application(s) and `Decision` appended unless it has one named Decision(s). Seeded: `Submitted → Application Review → Interview → Final Deliberation → Decision`. Earlier stages: text and filled dot `#232d4b`. Current stage (`aria-current="step"`): 600 weight, `#232d4b`, orange dot with a 3 px `#fceadd` halo. Later stages: muted `#52606d`, hollow dot. Current = the application's round (or `Submitted`), or `Decision` once decided.
3. "Next" block above a 1 px top rule (14 px padding-top): a label line (14 px / 600 foreground) + a detail line (12 px muted), then a **full-width** button (40 px).

| Situation | Sub-line under name | Label line | Detail line | Button |
|---|---|---|---|---|
| Submitted / in review | club round name, else `Submitted` / `In review` | `Submitted` or `In review` | `Your application is submitted. No further action right now.` / `The club is reviewing your application.` | `View details` (outline) |
| Interviewing, no booking for the current round (attention) | `Review interview options` | `Interview` | `You haven’t booked an interview for this round. Check available times and the club’s instructions.` | `Review interview` (primary) |
| Interviewing, upcoming booking | round name (seeded `Interview`) | `CalendarDays` 16 + `Interview · {Nov 24, 2026, 3:15 PM} · Eastern Time` | location, or `Location not provided` (seeded `Student Union 215`) | `View details` (outline) |
| Interviewing, booking already past | round name | `Interview` | `Interview · {date} · Eastern Time. Check the club’s instructions for next steps.` | `View details` |
| Accepted, offer pending and unexpired (attention) | `Membership offer ready` | `Accepted` | `Accept or decline your club offer.` | `Review offer` (primary) |
| Accepted otherwise | `Decision received` | `Accepted` | `You’ve been accepted. Check the club’s instructions for next steps.` | `View details` |
| Not selected | `Decision received` | `Not selected` | `The club has not selected your application this time.` | `View details` |
| Waitlisted | `Decision received` | `Waitlisted` | `You’re on the waitlist. A place is not confirmed yet.` | `View details` |

   All buttons end with `ArrowRight` 16. Date format: `Mon D, YYYY, h:mm AM/PM · Eastern Time` (Eastern zone).
- Seeded In review tab (`07`): `Women in Quant Finance Circle` · sub-line `Application Review` · mark `Submitted` · stepper current = `Application Review` · `Submitted` / `Your application is submitted. No further action right now.` · `View details`.
- Seeded Interviews tab: `Lawn Street Capital` (attention, `Review interview`), `Corner Code Collective` (booked `Nov 24, 2026, 3:15 PM`, `Student Union 215`, `View details`). Seeded Decisions tab (`09`): `Rotunda Equity Research Society` (orange left rule, `Membership offer ready`, `Accepted`, navy `Review offer`), `Albemarle Data Science Circle` (`Decision received`, `Not selected`, light `View details`); on both the stepper shows every earlier stage filled and `Decision` current. The stepper wraps to two lines at 390 px (`Submitted → Application Review →` / `Interview → Final Deliberation → Decision`).

**What each CTA opens** — all are in-page state changes on `/applications` (the list is replaced; no route change, no sheet):
- `Continue draft` / `View draft` → the draft writing workspace: back button `← Applications` (ghost), header with logo, eyebrow `Your application`, club name `h1`, status mark, `Deadline {date} · Eastern Time` or `Deadline not published`, then the application form (belongs to the application-form section).
- `View details` / `Review interview` / `Review offer` → **status detail** (`ApplicationStatusDetail`), reading width, 20 px gaps:
  1. Back button `← Status` (ghost, `ArrowLeft` 16) → returns to the list.
  2. Header: logo, eyebrow `Application progress` (decided: `Decision received`), club name `h1` (26 px on phone), `Submitted {date} · Eastern Time`.
  3. Status panel (card, 3 px orange left rule): heading = status label + status mark; `Current club round · {round}` (undecided only); next-step sentence; `View Decision` button → `/applications/{id}/decision` when a decision letter exists, else for decided ones `Formal letter unavailable for this historical decision.`; waitlisted without letter: `No decision date has been provided on OutClass.`; then the same round stepper.
  4. Offer box (Accepted without letter, or any offer record): pending → **`Congratulations! Join {Club}`**, `Accept your offer to become a club member. Respond by {locale date}.`, buttons `Accept Offer` (primary) and `Decline Offer` (outline). Accepted → `Your offer was accepted. Your club membership is recorded.`, `Open My Clubs` (→ `/clubs`), `Current membership access is managed by the club.` Declined → `You declined this offer. Your accepted recruitment decision remains recorded.` Revoked → `This offer has been rescinded. Contact the club with questions.` Expired → `This offer has expired. Contact the club with questions.` None → `The club has not issued an offer on OutClass. Contact the club for joining instructions.` Errors: `Your response could not be saved. Try again.`; `Your membership is inactive. Contact an organization owner about reinstatement; this offer cannot restore access.`
  5. Interviewing: section headed `Book your interview` (or `Your interview` once a future booking exists) with the slot picker (`BookingPicker`, interviews section). Loading label `Loading interview times…`; error fallback `Could not load interview times.` + `Try again`; `{n} time is hidden because it overlaps another interview you’ve booked.` / `{n} times are hidden because they overlap another interview you’ve booked.`
  6. Collapsible `Recorded interviews · {n}` (earlier-round bookings): `{date} · Eastern Time`, `Ends {date} · Eastern Time · {location | Location not provided}`.
  7. Footer buttons: `View submitted responses →` (outline) and `Open calendar` (ghost, `CalendarDays`; → `/calendar`).
- `View submitted responses` → read-only answers view: `← Applications`, header as for drafts with `Submitted {locale date time}`, strip `Your responses are saved and read-only after submission.` + `View status →`, heading `Your submitted responses`, each `Question {n}` / prompt / answer (`No response provided.`; file answers `Open submitted document`); `No club-specific questions.`
- After submitting a draft the notice `Your application was submitted successfully.` shows.

**Icons:** `FilePenLine` (empty state, Draft mark), `ArrowRight` 16 (buttons), `ArrowLeft` 16 (back), `CalendarDays` 16 (interview line, Open calendar), status-mark icons.

**Behaviour**
- Opening via `?applicationId=` selects the tab that holds the application and opens its status detail; for submitted applications the id is then removed from the URL so Back/reload returns to the list (drafts keep it).
- The list silently refetches when the tab regains focus or applications change elsewhere; an open draft is never overwritten.
- Keyboard: tabs are one tab stop; arrows/Home/End move between them.

**States**
- Loading: skeleton `Preparing your applications…` (3 rows).
- Signed out: `Sign in to manage your applications` / `Sign in to view your applications and save responses to your account. Preview activity does not submit an application to a club.` / `Go to sign in`.
- Load error (`role="alert"`): `Your applications couldn’t load` / `Your saved responses haven’t changed. Please try again.` / `Try again` (outline).
- No applications at all (tabs hidden): centred `FilePenLine` 28 px muted, title `No applications yet.`, `Explore clubs and start an application. Your drafts and submissions appear here.`, button `Explore clubs` (→ `/explore`).
- Empty tab (outlined compact card, centred): title `No applications in {Drafts|In review|Interviews|Decisions}.`; description on Drafts `You have no drafts in progress.`, elsewhere `None of your applications are at this stage right now.`
- Refresh failure notice: `Couldn’t refresh just now. Please try again in a moment.`; booking saved but list stale: `Interview saved. Your application will update shortly.`

---

### 10 · My Clubs

- **Route:** `/clubs`
- **Screenshot:** `docs/mobile/screenshots/web/10-my-clubs.png`
- **Source:** `app/(workspace)/clubs/page.tsx`, `components/personal-clubs.tsx`, `components/organization-ownership-requests.tsx`, `components/organization-invitation-card.tsx`, `contexts/organization-invitations-context.tsx`, `lib/workspace-read.ts`, `utils/verified-email-policy.ts`, `utils/school-identity.ts`, `components/dashboard-layout.tsx` (page title). `components/organization-memberships.tsx` is a different "Your clubs" block used elsewhere and is not rendered on this route.

**Layout (top to bottom)**
1. Page header `h1` `My Clubs` — Caslon 26 px / 500, `#232d4b`.
2. Text link `Your tasks across clubs` — 14 px, underlined (offset 4 px), min-height 44 px → `/clubs/tasks`.
3. **Pending invitations** block (shown only while loading, on failure, or when at least one pending invitation exists, including ones set aside with "Not now"):
   - `h2` `Pending invitations`; sub-line `Includes any you set aside with Not now.` (14 px muted).
   - Optional notice box after an action (see Behaviour).
   - Loading: skeleton `Checking organization invitations…`.
   - Failure: bordered box (radius 22, padding 16): message + outline button `Try again`.
   - Otherwise a list (12 px gaps) of invitation cards.
4. Membership cards, one column, 20 px gap.
5. **Find or claim a club** — 1 px top rule, 20 px padding-top: `h2` `Find or claim a club`; `Find your club in Explore. Unclaimed profiles include a request form for club leaders; managed clubs can invite you to join.` (14 px muted, line-height 24 px); underlined link `Explore clubs` → `/explore`.

**Invitation card (full, non-compact)** — radius 22, 1 px border, padding 16: 44 px logo; `h3` club name; `{Club} invited you as {a member | an interviewer | a recruiting administrator | an administrator}.` (owner claim: `You’re the designated administrator for {Club}.`); 12 px line `Accept to join this organization.` (owner: `Claiming lets you manage members, roles, applications, recruiting, interviews, and organization settings.`); when set aside: `Hidden from your dashboard · still pending`. Buttons (wrap, each min-height 44, the first two share the row equally on phone): `Accept` (primary; busy `Accepting…`; owner `Claim organization` / `Claiming…`), `Not now` (outline; becomes `Show on dashboard` when set aside), `Decline` (ghost). Decline opens an inline confirm box: `Decline the invitation from {Club}? You’ll need a new invitation to join later.` + `Confirm decline` (destructive; busy `Declining…`) + `Cancel`. Errors (red 14 px): `Could not accept this invitation. It may have expired or your access may have changed. Try again.` / `Could not update this request. Try again.` Alumni accounts see a read-only refusal line instead of buttons.

**The error seen on staging** — `Verify your university email through the normal email verification or password recovery flow before responding to invitations.` + `Try again`:
- The invitations list is read through `/api/workspace?kind=invitations`. The server (`utils/school-identity.ts`) first requires proof that the signed-in person controls their university mailbox (`hasConfirmedUniversityEmail`): a Microsoft (Azure) identity matching the email, or a password-recovery receipt written by the recovery endpoint, or an email confirmation that happened after a confirmation email was sent and was not flagged `email_verification_skipped`. If none holds, the API answers 403 `UNIVERSITY_VERIFICATION_REQUIRED`, the client maps that to this sentence, and the block shows its failure box. `Try again` re-runs the read.
- Seeded staging accounts are created pre-confirmed (no confirmation email round trip), so this box appears on every visit for them even though nothing is wrong and there are no invitations. For a normally verified student with no invitations the whole block is absent.
- Sibling message (503 `UNIVERSITY_VERIFICATION_UNAVAILABLE`): `University email verification is temporarily unavailable. Try again later.` Generic fallback: `Could not check organization invitations.`

**Membership card** — card surface, 1 px edge, radius 16, padding 20 px.
- Row: 64 × 64 logo (rounded square, roughly 10–12 px radius in `10-my-clubs`; fallback first two letters `Bl`, `Ra` on `#edeee9`) + `h2` club name (sans 20 px / 600, wraps) + 12 px muted role line (8 px below).
- Role line: `Owner`, `Admin`, `Recruiting Lead`, `Interviewer` or `Member`; a custom title that differs is appended as ` · {title}`.
- Divider (1 px top rule, 20 px above, 16 px padding) then the "next item" area, 14 px, line-height 28 px:
  - task first (own outstanding task due on/before the next meeting, or no meeting): 12 px muted `Your next task · Due {date}` / `Your next task · Overdue {date}` / `Your next task · No due date`, then the task title (500).
  - else meeting: `Next meeting · {Thu, Nov 19, 6:00 PM}` then the meeting title (500).
  - else `No upcoming meeting or outstanding personal work.` (muted).
  - loading: inline `Loading club activity…`; failure: `Couldn’t load the next item.` + ghost `Retry`.
  - Date format (`memberDate`): device locale and zone, `weekday short, month short day, h:mm AM/PM`.
- Link styled as a soft button (bg `#edeee9`, radius 10, padding-inline 16, min-height 44, 14 px `#232d4b`): `Open member workspace` + `ArrowRight` 16 — or `Open club workspace` for members with leader access → `/club/{clubId}/workspace`.
- Seeded: `Blue Ridge Consulting Collective` / `Member` / `Next meeting · Thu, Nov 19, 6:00 PM` / `Blue Ridge Consulting Collective: Spring Info Session`; `Ragged Mountain Hiking Club` / `Member` / `Next meeting · Fri, Dec 4, 5:00 PM` / `RMHC Open House`.

**Icons:** `ArrowRight` 16.

**Behaviour**
- Each card fetches its club overview separately after mount.
- After an invitation action a toast and an inline notice show: `You’ve joined {Club}.` / `You’ve declined the invitation from {Club}.` / `{Club} will appear on your dashboard again.` / `{Club} is hidden from your dashboard. The invitation is still pending in My Clubs.` Accepting an owner claim navigates to that club workspace. Invitations re-check on window focus.

**States**
- Loading: skeleton `Loading your clubs…` (3 cards).
- No memberships: (invitations block if any) then an outlined, left-aligned empty state: `You haven’t joined any clubs yet` / `Clubs appear here once you’re a member. An acceptance doesn’t make you a member on its own.` / outline button `Explore clubs →` (→ `/explore`). The tasks link and "Find or claim a club" are not shown in this state.

---

### 11 · Tasks (all clubs)

- **Route:** `/clubs/tasks` (optional `?taskId={id}` opens that task; `?taskStatus=week|overdue|all` presets the Status filter in the single-club variant)
- **Screenshot:** `docs/mobile/screenshots/web/11-tasks.png`, `11b-tasks-status-menu.png` (Status menu open), `11c-tasks-group-menu.png` (Group by menu open)
- **Source:** `app/(workspace)/clubs/tasks/page.tsx`, `components/personal-clubs.tsx` (`AllClubTasks`), `components/club-tasks.tsx`, `components/tasks.css`, `components/ui/pill-select.tsx`, `components/ui/search-field.tsx`, `lib/tasks.ts`, `lib/task-presentation.ts`.

**Layout (top to bottom)**
1. Page header `h1` `Tasks` (Caslon 26 px / 500).
2. Filter toolbar (`role="toolbar"`, `aria-label="Task filters"`), wrapping row, 8 px gaps. At 390 px it wraps to two lines: `All clubs` + `Status: Active`, then `Group by: None` + search.
   - **Club** pill select — `aria-label="Filter by club"`, shows `All clubs`; options `All clubs` then each club name. Present only with 2+ memberships.
   - **Status** pill select — visible prefix `Status:` then the value; options `Active` (default), `Due`, `Overdue`, `Submitted`, `Completed`, `All tasks`. Hidden while grouping by project.
   - **Group by** pill select — prefix `Group by:`; options `None` (default), `Project`.
   - **Search** field — `aria-label="Search tasks"`, placeholder `Search tasks`, leading `Search` icon 16, clear (X) button when filled; takes the remaining width.
   - Pill style: min-height 40 px (compact), radius 999, light glass (`#faf8f3`), 1 px light edge, padding 8 / 14 / 8 / 18 px, value 14 px / 500 `#232d4b`, prefix `#52606d`, chevron-down at right. When the choice narrows the list (status ≠ Active, a club chosen, grouping on) the pill turns navy with cream text. Search field: min-height 46 px, same glass pill.
   - Menus are Radix select popovers, not bottom sheets (`11b`, `11c`): a cream card (radius 16, soft shadow) that drops directly over/under its pill, about as wide as the pill (≈155 px for Status); one option per row, rows ≈44 px, 15–16 px text; the selected row has a grey-green fill (`#e7ebe7`-like) and a check mark at its right. Status menu, in order: `Active` ✓, `Due`, `Overdue`, `Submitted`, `Completed`, `All tasks`. Group by menu: `None` ✓, `Project`. The page behind is not dimmed.
3. One section per club (only clubs with at least one visible task get a heading): `h2` club name (sans 20 px / 600) then that club's task list card.
4. Combined empty state when no club shows any task.

With exactly one membership the same screen renders the single-club variant: no club pill, and the Status options carry counts — `Active`, `Due ({n})`, `Overdue ({n})`, `Submitted ({n})`, `Completed`, `All tasks`.

**Filter meaning** (own assignments of published tasks only): `Active` = outstanding (not done, not reviewed, not yet submitted or revision requested); `Due` = outstanding and not past due; `Overdue` = outstanding and past due; `Submitted` = submitted or reviewed with no revision requested; `Completed` = task closed or reviewed; `All tasks` = everything; Group by `Project` = project-type items only. Search matches title + description, case-insensitive.

**Task list card** — one card per club: card surface, 1 px edge, radius 16, rows separated by 1 px `#dfe3dd`.

**Task row** (whole row is a button) — grid `24px | 1fr`, gap 8 × 12 px, padding 14 px:
- Icon tile 24 × 24 (radius 6, bg `#edeee9`, `FilePenLine` 16 `#52606d`), top-aligned.
- Title `strong` 15 px / 600.
- Line 2 (12 px muted): `{Club name}` + ` · {Project title}` when part of a project + ` · {group label}` when assigned as a group.
- Line 3 (12 px muted): `{requirement} · {state}`.
  - Requirement: `Project` for projects; otherwise the required parts joined by ` + ` from `Written response`, `Link`, `File upload`; when nothing specific is required: `Written response, link, or file`.
  - State: `Assigned`, `Overdue`, `Submitted`, `Submitted late`, `Reviewed`, `Revisions requested`; `Closed` when the task is done.
- Line 4 (under the copy on phone): `CalendarClock` 14 + due text, 12 px muted. Due format: `Today {h:mm AM}`, `Tomorrow {h:mm AM}`, otherwise `Mon D, h:mm AM/PM` (e.g. `Nov 23, 5:00 PM`), or `No due date`.
- Overdue rows: line 3 and the due line turn `#ac3544`.
- As rendered in `11-tasks`, lines 2–4 look darker and heavier than the muted 12 px the CSS declares (they read as semibold slate); treat them as secondary text.
- Seeded (under `Blue Ridge Consulting Collective`): `Complete new member onboarding` · `Blue Ridge Consulting Collective` · `Written response, link, or file · Assigned` · `Nov 23, 5:00 PM`; `Client research brief: Rivanna Roasters (fictional)` · same · `Nov 27, 5:00 PM`.

**Icons:** `FilePenLine` (row tile, drawer tile), `CalendarClock` (due), `Search`, `X`.

**States**
- Per club loading: skeleton rows `Loading tasks…`; background refresh `Refreshing tasks…`.
- Load error (red outlined box): message (fallback `Could not load tasks.`) + `Try again`.
- Stale: `Couldn’t update tasks. Showing the last loaded list.` + `Try again`.
- Nothing to show, no filters: outlined compact empty state `You're all caught up.` / `No tasks need your attention. Choose All tasks under Status to see earlier work.` (single-club variant: `No tasks need your attention. You can still view earlier work.` + `View all tasks`, or `New tasks will appear here.` when the member has never had a task).
- Nothing matches filters: `No tasks match your filters.` / `Try another search or clear the filters.` + outline button `Clear filters`.
- No memberships: the My Clubs empty state (`You haven’t joined any clubs yet` …).

### 12 · Task detail (drawer)

- **Route:** stays on `/clubs/tasks` (opened by tapping a row, or by `?taskId=`)
- **Screenshot:** `docs/mobile/screenshots/web/12-task-detail.png` (390 × 844, drawer open), `12-task-detail.full.png` (drawer with its whole scrolled content)
- **Source:** `components/club-tasks.tsx` (`Sheet`, `TaskDetail`, `Submission`), `components/ui/sheet.tsx`, `components/shell/responsive-workspace.css`, `components/ui/autosave-status.tsx`.

**What opens** (confirmed by `12-task-detail`): a right-side sheet that is **full width and full height on phone** — it covers the header and the dock, so it reads as a full-screen page with only an X — (`w-full`, 100dvh), slides in from the right over a dimmed overlay, scrolls internally. Padding 56 px top, 20 px sides, bottom ≥ 20 px + safe area. Close button top-right (44 × 44, X icon, sr label `Close`). Opening marks the assignment as viewed.

**Layout (top to bottom)**
1. Icon tile 32 × 32 (radius 10, bg `#edeee9`, `FilePenLine` 18 `#232d4b`).
2. Title: task title, Caslon 22 px, line-height 1.14 (fallback `Task details`). Seeded: `Complete new member onboarding` (two lines).
3. Description line: `{Club name} · Assignment` (or `· Project`), 14 px muted. Seeded: `Blue Ridge Consulting Collective · Assignment`.
4. Meta row (12 px muted, wraps): `CalendarClock` 16 + `Due {Today 5:00 PM | Tomorrow … | Nov 23, 5:00 PM | No due date}`; then the state word (`Assigned`, `Overdue`, `Submitted`, `Submitted late`, `Reviewed`, `Revisions requested`).
5. Error line if a save failed (red outlined).
6. Optional `Project · {project title}`; optional `Assigned group · {label}` (500).
7. `h3` `Instructions` (renders in Caslon, ≈18 px, inside the drawer; the form's `Your submission` heading too); body 14 px, line-height 28 px, preserves line breaks; empty → `No additional instructions.` Seeded: `Read the member handbook and add your headshot to the roster.`; meta row `Due Nov 23, 5:00 PM` · `Assigned`.
8. Optional resources list (bordered box, radius 22, padding 16): each an underlined external link `{label}` + `ArrowUpRight` 14 (opens new tab).
9. **Submission form** (card, radius 22, padding 20, 20 px gaps) for assignment-type tasks:
   - Autosave status line (12 px muted): `Saving…`, `Saved`, `Offline. Changes save when you reconnect`, `Couldn’t reach OutClass` + `Retry`, `Couldn’t save. ` + `Retry`; draft recovery prompts `Unsaved changes from this device are available.` `Restore draft` · `Discard`.
   - `h3` `FilePenLine` 20 + `Your submission`.
   - Status sentence: `No submission yet. Late submissions are accepted while the task is open and are labeled late.` | `Submitted {Mon D, h:mm AM/PM} · You can update it until it is reviewed or the task closes.` | `Submitted {date}` once closed.
   - 12 px line: `Required: {text + link + file | text, a link, or a file}. Your private draft saves automatically. Submit when ready to share it.` (closed: `… This submission is closed.`)
   - Field `FileText` 16 `Written response` with right-aligned tag `Required` / `Optional`; textarea (5 rows in source; ≈64 px tall, rounded ≈16 px, 1 px slate border in the capture), max 30,000 chars.
   - Field `Link2` 16 `Website or document link` + `Required`/`Optional`; URL input, placeholder `https://…`, max 2,000 chars.
   - Attached files list: `{name} · {n} KB`, ghost `Download` (already-saved files), ghost `Remove`.
   - Upload box (1 px dashed, radius 10, padding 16): `UploadCloud` 20 `File upload` + `Required`/`Optional`; hint `Up to 5, 10 MB each. PDF, images, text, or Office documents.`; file input (accepts .pdf .txt .png .jpg .jpeg .docx .pptx .xlsx; multiple) — renders as the browser's native control inside a rounded field: `Choose Files` `No file chosen`.
   - Messages: `Choose up to five files.`; `Upload failed. Please try again.`; `Uploading securely… Keep this page open.`; `Download failed.`
   - Reviewer feedback when present: `CheckCircle2` 16 **`Review feedback`** or **`Revisions requested`** + the feedback text.
   - Success line (green `#296448`): `Your submission was saved.`
   - Seeded state in the capture: `No submission yet. …`, `Required: text, a link, or a file. …`, all three parts tagged `Optional`, button `Submit work`.
   - Submit button, full width on phone, primary navy pill (≈44 px): `Submit work` | `Update submission` | `Resubmit revisions`; busy `Submitting…`. Hidden once reviewed or the task is closed (fields disabled).
10. Project-type items instead list `h3` `Related tasks`: each child as a ghost button with its title + `Due {date}`; tapping swaps the drawer to that task.

**Behaviour**
- Closing with unsaved edits asks (confirm dialog): `Close task?` / `Unsaved changes will be lost.` / `Close task` (danger) / `Keep editing`. Opening another task with unsaved edits: `Open another task?` / `Unsaved changes will be lost.` / `Open task` / `Keep editing`. The drawer cannot close while saving or uploading.
- Submit sends text, link and uploaded file ids with the assignment revision; on success the list reloads and the form remounts on the new revision. Save errors: fallback `Could not save. Please try again.`; saved-but-reload-failed: `Your changes were saved, but the updated list could not load. Try again to see them.` Server validation: `A written response is required.`, `A link is required.`
- Focus returns to the tapped row on close.

---

### 60 · Member club workspace (club home, non-leader)

- **Route:** `/club/{clubId}/workspace` (= `?section=overview`); other member sections: `?section=calendar&type=meetings`, `?section=tasks`, `?section=alumni`
- **Screenshot:** `docs/mobile/screenshots/web/60-member-workspace.png` (whole page), `60-member-workspace.viewport.png`
- **Source:** `app/(workspace)/club/[clubId]/workspace/page.tsx`, `components/club-workspace.tsx`, `components/manager-overview.tsx` (club home body for leaders *and* members), `components/club-home/club-home-sections.tsx`, `club-home-model.ts`, `club-home.css`, `components/product/welcome-header.tsx` (`ClubOverviewHeader`), `components/product/dashboard-drawer.tsx`, `components/tasks/dashboard-task.tsx`, `components/events/dashboard-meeting.tsx`, `lib/welcome.ts`, `components/shell/workspace-shell.tsx`. `components/member-overview.tsx` now only exports the date format; `components/club-announcements.tsx` and `club-home/home-announcements.tsx` render only for members with `meetings.manage` and are not part of the plain-member view.

A plain member stays in the **personal** shell (`data-product-shell="personal"`): same floating header and navy dock, no workspace pill switch. The phone-compaction rules written for club dashboards target non-personal shells, so a member sees the default dashboard metrics (below).

**Layout (top to bottom)** — 16 px gaps.
1. **Hero** (`ClubOverviewHeader`, expressive, ambient glow):
   - `h1` = club name (`Blue Ridge Consulting Collective`, two lines), Caslon ≈36 px as rendered (the expressive header size; the same size as the Applications title), line-height ≈1.12, letter-spacing −.02em. The second line (`Consulting Collective`) runs to within a few px of the right edge.
   - Description: one "next thing due" sentence (15 px muted, reserves two lines). No greeting and no date line on club pages. Seeded: `You have tasks ready to work on.`
   - Action slot (on its own line under the copy, ≈30 px below): underlined muted 14 px link `All my clubs` → `/clubs`.
2. **Needs you** — `h2` `Needs you` (19 px / 600), then:
   - clear state (seeded): glass card (radius ≈20, padding 16 × 20) **`You’re clear for now.`** `Overdue tasks, submissions and meetings that need you will show up here.`
   - or 1–4 cards: the first is a navy card (radius 26, padding 18 / 20 / 16; orange 8 px dot with halo before the title; title 17 px / 600 cream; detail 14 px `#b0c1cc`; action link cream); the rest collapse into one light list card (radius 22, rows separated by 1 px rules).
   - Member-reachable cards: `{n} task(s) overdue` / detail = first overdue task title / `Open task` (opens the task drawer); `A task is due soon` (due within 2 days) / task title / `Open task`.
3. **Next meeting** card (hidden when the club has no meeting in the next two weeks). `h2` `Next meeting`.
   - Featured meeting: date chip 56 × 56 navy; title Caslon 22 px; `{Thu, Nov 19, 6:00 PM}[ · {location}]` 14 px muted; up to the first 3 agenda lines joined by ` · ` (2-line clamp); `RSVP open` when RSVP is available.
   - Button `Agenda & resources` (outline, 44 px) → meeting drawer. (Leader-only buttons `Take attendance · QR check-in` and `Edit` do not render for a plain member.)
   - Remaining meetings of the next 14 days as rows: date chip, title, `{date}[ · {location}]`, chevron → meeting drawer.
   - Foot link `All meetings →` → `?section=calendar&type=meetings`.
   - Seeded: chip `NOV 19`; `Blue Ridge Consulting Collective: Spring Info Session` (three lines of Caslon); `Thu, Nov 19, 6:00 PM · South Lawn Tent`; `RSVP open`; then rows `General Body Meeting` — `Wed, Nov 25, 7:30 PM · Commerce Annex 120` and `BRCC Open House` — `Sat, Nov 28, 5:00 PM · Commerce Annex 120`. The `Agenda & resources` button is a light pill, left-aligned, ≈170 × 44 px.
4. **Tasks** card — `h2` `Tasks`; three equal count tiles (grid, 8 px gap; tile: 1 px border, radius 10, padding 10 × 12; number 20 px / 600 tabular; label 12 px muted): `Due this week`, `Overdue` (warning tone when > 0), `All tasks`. Each tile links to `?section=tasks&taskView=mine&taskStatus=week|overdue|all`; `aria-label` `{n} due this week, open tasks` etc. Foot link `All tasks →` → `?section=tasks&taskView=mine`. Seeded: `1` Due this week, `0` Overdue, `2` All tasks (tiles ≈104 × 64 px).
5. **This week** card — `h2` `This week`, head link `Meetings →`. Rows for the next 7 days, soonest first: meetings (navy chip, detail `{date} · {location | Meeting}`) and own task due dates (orange deadline chip, detail `{date} · Your task due`). Tap opens the meeting or task drawer. Empty: `Nothing on the club calendar this week.` Seeded: navy `NOV 19` `Blue Ridge Consulting Collective: Spring Info Session` — `Thu, Nov 19, 6:00 PM · South Lawn Tent`; orange-tinted `NOV 23` `Complete new member onboarding` — `Mon, Nov 23, 5:00 PM · Your task due`.
6. **Announcements** card (hidden for a plain member when the club has none) — `h2` `Announcements`; the latest three as rows: leading date `Mon D` (12 px / 500 muted, min-width 52 px), title 14 px / 600, body preview 12 px muted one line, chevron. Tap → announcement drawer. A plain member gets no "New announcement" button and no "All announcements" link (both need `meetings.manage`). Seeded: `Nov 18` `Final deliberation tonight` — `Members who review applications: the live vote opens after tonight's meeting. Please be on time.`; `Nov 15` `Spring client projects are posted` — `Five client projects are open for ranking. Submit your preferences by Friday.`; `Nov 10` `Welcome to the spring semester` — `Our first general body meeting is this week. Bring a friend who is curious about consulting.` (previews clipped to one line).
7. **Members** card — only when the overview includes member counts for this member (same gate as the member directory). **Not rendered for the seeded plain member** (`60-member-workspace` ends after Announcements). When present: tiles `Active`, `Pending invitations`, `New this month` with Caslon 28 px numbers.
8. Not shown to a plain member: recruiting strip, Team pulse, Your tasks (assignments) card, setup checklist.

Phone order of cards is fixed by CSS and confirmed by the capture: Next meeting → Tasks → This week → Announcements (→ Members). The text dump lists Announcements before This week because DOM order differs from visual order.

**Hero sentence for a member** (`welcomeSubtitle`, club mode; lowest priority number wins): own task due within 24 h / overdue → `You have an overdue task.` / `You have a task due today.` / `You have a task due tomorrow.`; `You have {n} overdue task(s).`; meeting within 3 h or later → `Your next meeting starts at {time}.` / `… starts tomorrow at {time}.` / `… starts on {Mon D} at {time}.`; own open work → `You have tasks ready to work on.`; announcement published today → `There's a new update in your club today.`; fallback `Nothing due this week.`

**Drawers** (`DashboardDrawer`: right sheet, full width/height on phone, close X top-right, title in Caslon):
- Task — title = task title; description `Instructions and your saved submission.`; body = the same `TaskDetail` + submission form as screen 12. Notices: `Changes saved to your account.`; errors `This task could not load. Check your access or try again.` + `Retry task`, `This task is no longer available.`, `Could not save. Your response is still here.`; loading `Loading task…`.
- Meeting — title = meeting title; description `Meeting agenda, resources, attendance and available actions.`; optional RSVP block (`Checking event registration…`, `RSVP is no longer available for this event.`, `Event registration could not load.` + `Retry registration`) then the meeting detail (meetings section).
- Announcement — title = announcement title; description `Announcement delivered to you.`; body = published date (`memberDate`) then the full text.

**Other member sections** (reached from the More sheet): page header with eyebrow = club name, `h1` `Meetings` / `Tasks` / `Alumni`, and the `All my clubs` link. Tasks renders the single-club personal task list (screen 11 variant with count options).

**Icons:** `ArrowRight` 14 (links, rows); dock and sheet icons below.

**States**
- Opening: `Opening club workspace…` skeleton; overview loading: dashboard skeleton.
- Overview failed (glass alert card): `Could not load this workspace. Your membership may have changed. Try again.` + outline `Retry`.
- Not a member: `Club workspace unavailable` / `Sign in with a current club membership to access this workspace.` / `Return to OutClass`.
- Suspended club: `This club is suspended` / `{Club} operations are unavailable until an administrator restores the club. Your membership and existing records are preserved.` / `Return to Personal workspace` (→ `/home`).
- Section not permitted: `This section isn’t available with your current access.`
- Silent refresh when returning to the tab or after task/meeting changes.

### 61 · Member workspace dock and More sheet

- **Route:** `/club/{clubId}/workspace` with the More sheet open
- **Screenshot:** `docs/mobile/screenshots/web/61-member-workspace-more-sheet.png` (390 × 844, sheet open)
- **Source:** `lib/navigation.ts` (`memberRailSections`, `bottomBarItems`, `activeNavItem`), `components/shell/mobile-navigation.tsx`, `components/shell/product-shell.tsx`, `components/shell/authenticated-product.css`.

**Dock variant inside a member club:** four destinations + More (Profile gives up its slot):

| Slot | Label | Icon (regular; `fill` weight when active), 20 px | Target |
|---|---|---|---|
| 1 | `Home` | `Home` | `/home` (also marked current for Applications, Tasks, My Clubs) |
| 2 | `Explore` | `Compass` | `/explore` (also current for Events) |
| 3 | `Inbox` | `Inbox` | `/inbox` |
| 4 | `Calendar` | `CalendarDays` | `/calendar` |
| 5 | `More` (`aria-label="More sections"`) | `Menu` | opens the navigation sheet |

On the club's own pages the active rail id is `club-home` / `club-meetings` / `club-tasks` / `club-alumni`, which none of the four dock items match — **no dock tab is highlighted** while inside the member workspace (confirmed in `60-member-workspace`: all five items are in the resting colour).

Dock style (shared): fixed, 12 px from the sides, bottom `max(8px, safe-area)`, radius 26, padding 8, navy glass with 1 px edge; item min-height 52 px, radius 18, label 12 px / 500 `#c5d5e2`; active: text `#fff9f1` / 600, tint `rgb(210 231 250 / 12%)`, a 16 × 3 px orange bar at the top centre.

**More sheet** (confirmed by `61`): left-side drawer, width `min(88vw, 300px)` (300 px at 390), navy frosted background, slides in from the left over a dimmed page; it covers the header's left part and the dock's left part (only the `More` item stays visible at the right). Close X top-right of the drawer (cream). sr-only title `Workspace navigation`, description `Every section of this workspace.` Content (padding 16, scrolls):
1. OutClass wordmark (white/orange on navy, ≈180 px wide) as a button (`aria-label="OutClass home"`) → `/home`.
2. Navigation groups, 20 px apart; a group label (12 px, `#b0c1cc`) appears only for the club group. Items: min-height 44 px, radius 10, 14 px / 500 `#b0c1cc`, icon 16 px left with 13.6 px gap. Current item: lighter navy fill, light text, orange icon, a 3 px orange bar at the left and a small orange dot at the right.

| Group | Items (icon) |
|---|---|
| (Home) | `Home` (`Home`) → `/home` |
| (Explore) | `Explore` (`Compass`) → `/explore`; `Events` (`CalendarStar`) → `/corkboard` |
| (Applications) | `Applications` (`FileText`) → `/applications`; `Tasks` (`ListChecks`) → `/clubs/tasks` |
| (Clubs) | `My Clubs` (`Users2`) → `/clubs`; `Calendar` (`CalendarDays`) → `/calendar` |
| label = club name, e.g. `Blue Ridge Consulting Collective` | `Club home` (`Home`) → `?section=overview`; `Meetings` (`CalendarDays`) → `?section=calendar&type=meetings`; `Club tasks` (`ListChecks`) → `?section=tasks`; `Alumni` (`GraduationCap`) → `?section=alumni` |
| (Account) | `Profile` (`UserRound`) → `/profile` |
| (Inbox and settings) | `Inbox` (`Bell`) → `/inbox`; `Settings` (`Settings`) → `/settings` |

In the capture `Club home` is the current item (lighter fill, orange house icon, orange bar at the left, orange dot at the right) and the club group label reads `Blue Ridge Consulting Collective`. At 844 px height the list runs past the fold: `Inbox` is the last fully visible row and `Settings` needs a scroll.

Choosing an item closes the sheet and moves focus to the main content; dismissing without choosing returns focus to the More button.

---

## Explore tab

Evidence note: written from source, then verified against the captures and text dumps of the rendered pages for every screen listed (student "Sam Staging-Student", alumni "Alex Staging-Alumni"). Where a capture and the source disagree, the capture is described and the source value noted.

Shared tokens used below (light theme, `styles/tokens.css`, `styles/navigation-glass.css`):

| Token | Value |
|---|---|
| `--foreground` / `--primary` (UVA Blue) | `#232d4b` |
| `--muted-foreground` | `#52606d` |
| `--background` | `#f6f5f1` |
| `--card` / `--oc-content-solid` (card surface) | `#fffefa` |
| `--oc-content-edge` (card border) | `#e0e5e3` solid fallback; glass variant = 10% UVA Blue |
| `--border` | `#dfe3dd` |
| `--muted` | `#edeee9`; `--accent` `#e7ebe7`; `--oc-content-soft` `#f1f4f3`; `--oc-content-soft-blue` `#eaf0f2` |
| `--input` | `#8793a0` |
| `--brand-orange` | `#e57200`; `--brand-ink` `#a04d00`; `--brand-subtle` `#fceadd`; focus `--ring` `#c86400` |
| `--success` / `--success-subtle` | `#296448` / `#edf5ef` |
| `--info` `#295c88`, `--warning` `#795617`, `--destructive` `#ac3544` |
| `--oc-glass-cream` (text on navy pills) | `#fff7ec`; `--oc-glass-light-solid` `#faf8f3` |
| Radii | sm 6, md 10, lg 16 (`--oc-content-radius` and `-small` both 16), xl 22, 2xl 24, full 999 |
| Type | caption 12, 13, small 14, body 15, card 17, section 20 at phone (`clamp(1.25rem,1.6vw,1.5rem)`), modal 22, title 26 at phone (`clamp(1.625rem,2.2vw,1.875rem)`) |
| `--oc-content-gap` / `--oc-content-padding` | 16 px at 390 |
| Fonts | display = Libre Caslon Text (`--oc-font-display`); sans = Source Sans 3 |

The Clubs/Events switch (`components/explore-switch.tsx/.css`) heads both `/explore` and `/corkboard` below 1024 px:
- `nav[aria-label="Explore"]`, 2 equal columns, gap 4, padding 4, margin-bottom 16, radius full, background `#faf8f3`, 1 px edge `rgb(255 255 255 / 68%)`, card shadow.
- Two links: `Clubs` → `/explore`, `Events` → `/corkboard`. Each min-height 40, 14 px / 600, colour `#232d4b`.
- Current (`aria-current="page"`): navy fill (`--oc-glass-pill-navy` = `#232d4b` with a faint light-blue gradient), text `#fff7ec`. These are real navigations, not client tabs.

---

### 13 · Explore — clubs directory
- **Route:** `/explore` (query params `q`, `category`, `recruitment`, `time`, `acceptance`, `sort`)
- **Screenshot:** `docs/mobile/screenshots/web/13-explore.png`, `13-explore.viewport.png`
- **Source:** `app/(workspace)/explore/page.tsx`, `components/views/explore-view.tsx`, `components/explore-switch.tsx`, `components/clubs/discovery-card.tsx`, `corkboard-button.tsx`, `saved-clubs-popover.tsx`, `suggested-clubs.tsx`, `directory-logo.tsx`, `explore-directory.css`, `club-discovery.css`, `profile-presentation.css`, `styles/filter-controls.css`, `lib/club-directory.ts`, `lib/recruitment-presentation.ts`, `lib/club-suggestions.ts`
- **Layout (top to bottom):**
  1. Clubs/Events switch (`Clubs` current).
  2. Header row: `h1` `Explore clubs` (Libre Caslon, ~29 px at 390 from `clamp(1.75rem, 1.4rem + 1.2vw, 2.25rem)`, weight 500, line-height 1.14, tracking −.03em) on the left and, on the same row at the right edge, the pill button `Saved clubs` (Bookmark 16 px icon, min-height 44, white pill with soft shadow). Margin-bottom 16.
  3. Search row (flex, gap 8): pill search field (flex 1) + round icon button `Filter clubs`.
     - Search field: min-height 46, radius full, 1 px light edge, leading Search icon 16 px `#52606d`, input 16 px on phones (`max(1rem, 14px)`), placeholder `Search clubs, interests, or keywords` in `#52606d`, aria-label `Search clubs`. When filled a 32 px round clear button appears (X 16 px, aria `Clear search`). Focus: 1 px navy border + 2 px `#c86400` outline.
     - Filter toggle: a bare icon with no visible background when collapsed (44 px target), a navy 44 px circle with cream icon when expanded; icon `SlidersHorizontal` 20 px; aria `Filter clubs`, or `Filter clubs (N active)` with an orange count dot (16 px, `#e57200`, text `#fff7ec`, 12 px / 700, top-right). `aria-expanded` true = navy fill, cream icon.
  4. Inline tools panel (`#directory-tools`), hidden until the toggle is pressed — see screen 16.
  5. Interest chips row (margin 12 top / 16 bottom), single line, horizontal scroll with hidden scrollbar — see screens 17 and 19.
  6. "Filters applied" row — only when a query/filter other than sort is active (screens 14, 15, 19).
  7. Section `Suggested for you` — only with no active filters and at least one suggestion.
     - Heading `h2` `Suggested for you` (sans, 20 px, 600) and paragraph `Based on the clubs you saved and your major.` (14 px, `#52606d`), margin-bottom 16.
     - Horizontal snap carousel (`display:flex; overflow-x:auto; scroll-snap-type:x mandatory`, gap 12, no scrollbar); each tile is 82% of the row width, snap-align start. Up to 6 tiles.
     - Tile (button): min-height 64, padding 14, radius 16, 1 px card edge, card surface. Left: 44 px monogram tile (see card anatomy). Middle: club name (14 px / 600, wraps) and reason (12 px, `#52606d`, single line with ellipsis). Right: `ArrowRight` 16 px in `#a04d00`.
     - There are no dot/pager buttons in source. The six unlabeled buttons in the dump's control list after the suggestions are the hidden rows of the collapsed "Applications open" disclosure (item 8).
  8. Disclosure `Applications open · {N} clubs` (`<details>`, closed by default; 1 px `#dfe3dd` top and bottom borders, padding-block 8, margin-bottom 16) — only with no active filters and N > 0. Summary: min-height 44, 14 px / 600, leading `ChevronDown` 16 px rotated −90° when closed, 0° when open (150 ms). Open content: paragraph `An A–Z selection of clubs accepting applications. Check their profiles for requirements.` (14 px muted), then a 1-column list (gap 12) of the first 6 open clubs A–Z; each row is a tile like the suggestion tile with name + `Applications open` (12 px, `#296448`) + `ArrowRight`.
  9. Availability note `Availability reflects applications on OutClass. Check each club’s website for external recruitment.` — screen-reader-only while the availability filter is "All clubs"; visible (12 px muted, line-height 1.6) when another availability is selected. (The text dump includes it because innerText picks up the sr-only node.)
  10. Results heading row (flex, space-between, margin-bottom 16): `h2` `All clubs` (or `Search results` when any query/filter is active) — sans 20 px / 600 — and a live count on the right, 12 px muted: `{n} club` / `{n} clubs` (seeded: `43 clubs`).
  11. Club card list: 1 column at 390 (container ≤ 520 px), gap 16. All matching clubs render at once.
- **Club card anatomy (`DiscoveryCard`, exact order):**
  1. Card: `article`, radius 16, 1 px card edge, card surface, soft shadow. The whole card is the tap target for opening (the name button's `::after` covers the card); the arrow and save buttons sit above it.
  2. Cover: height 84 px. With no banner: `linear-gradient(120deg, {club.color or #232d4b}, #708097)`. With a banner: image, `object-fit: cover`, club-set focal point.
  3. Monogram/logo tile overlapping the cover's bottom edge: 52 × 52, left 16, hanging 22 px below the cover; 3 px `#fffefa` border, radius 16, small shadow. Monogram variant (live club with no logo): on cards the tile is white (`#fffefa`) with `#232d4b` text, weight 500, 18 px (the 44 px tiles in suggestion rows and the Saved clubs popover use the `#e7ebe7` tint), `club.logoText` (e.g. `NFV`, `O&B`, `WiQ`).
  4. Category chip on the cover, bottom-right (right 12, bottom 10): padding 3.2 × 8, radius 6, 1 px card edge, card surface, 12 px `#232d4b`, text `club.category` or `Student organization`. Max width = card − 112 px, wraps.
  5. Body padding 34 / 16 / 16.
  6. Name `h3` (button): Libre Caslon 20 px, weight 400, line-height 1.2, tracking −.01em, `#232d4b`, wraps.
  7. Tagline: `club.pitch || club.description || "Get to know this club and explore its profile."` — 14 px, `#52606d`, line-height 1.5, max 2 lines, margin 6 top / 12 bottom.
  8. (Demo profiles only) `Demo profile · not a participating organization`.
  9. Stats (`dl`, max 2, only those the club publishes): 2 equal columns, gap 14, padding-block 16, 1 px bottom border `#dfe3dd`, margin-bottom 20. The captures show a hairline above the stats as well as below. Each: label 12 px muted tracking .04em (`Club acceptance`, `AUM`, `Members`, or a custom metric label); value 22 px / 600 tracking −.035em (`30%`, `~30%` when marked approximate, `18`); detail 12 px muted `Club-reported` (or `{note} · Club-reported`). Cards with no stats (unclaimed clubs) skip this block entirely.
  10. (If the club lists placements) `Where members go` + `Club-reported` (12 px / 600 muted) and up to 6 pill chips (12 px, padding 4 × 10, radius full). Not present in seeded data.
  11. Footer row (flex, space-between, align end, gap 12):
      - Left column (grid, gap 6, 12 px, line-height 1.6): recruiting label; then either `<time>` `Deadline · {date}` / `Closed · {date}` or `Deadline not published`; then `{timeCommitment} hours / week` if set (values `1-3`, `3-5`, `5+`; not present in seeded data).
      - Right: round arrow button 44 × 44, background `#f1f4f3`, `ArrowRight` 20 px, aria `View {club.name} club page`.
  12. Save button (margin-top 12, full width, outline, pill-shaped in the capture): `Bookmark` 16 px + `Save to saved clubs`; when saved `BookmarkCheck` (fill weight) + `Remove from saved clubs`. aria-label `Save to saved clubs: {club}` / `Remove from saved clubs: {club}`, `aria-pressed` = saved. Signed out the label is `Save club`.
- **Recruiting label rules (`clubRecruitment`):**

  | Condition (first match wins) | Label | Treatment |
  |---|---|---|
  | demo/preview club | `Sample club` | plain 12 px muted |
  | `claimed === false` | `Unclaimed` | plain 12 px muted |
  | deadline in the past | `Deadline passed` | plain; second line `Closed · {date}` |
  | applications available and not expired | `Applications open` | chip: text `#296448`, background `#edf5ef`, padding 4 × 8, radius 6 |
  | `applicationAvailable === false` | `Applications unavailable` | plain 12 px muted |
  | otherwise | `Recruitment not published` | plain 12 px muted |

  Date format (`recruitmentDate`): `Nov 24, 2026, 11:59 PM · Eastern Time` (Intl `en-US`, America/New_York, short month, numeric day/year, h:mm AM/PM, then ` · Eastern Time`). Full seeded line: `Deadline · Nov 24, 2026, 11:59 PM · Eastern Time`. "Closing soon" = open with a deadline within 7 days (used by the filter and the club page, not shown on the card).
- **Seeded examples (dump):** `43 clubs`; `Applications open · 14 clubs`; saved (button reads `Remove from saved clubs`): Dawson's Row A Cappella, Lawn Street Capital, Piedmont Founders Lab, Thornton Rocketry Team. Unclaimed cards (Alternative Investment Fund, McIntire Investment Institute, Virginia Venture Fund) show tagline `University of Virginia student organization`, no stats, `Unclaimed`, `Deadline not published`. Suggestions: five `Similar to Lawn Street Capital` and one `Similar to Thornton Rocketry Team`.
- **Suggestion reason templates (strongest signal wins):** `Similar to {saved club name}`, `Because you picked {interest label}`, `Fits your {major} major`, `Because you want {goal phrase}`. Saved clubs and clubs the student is an active member of are never suggested; limit 6; ordered by score then name.
- **Icons:** `Bookmark` (Saved clubs button, save button), `BookmarkCheck` fill (saved), `SlidersHorizontal` 20 (filter toggle), `Search`/`X` (search field), `ArrowRight` (16 on tiles, 20 on card arrow), `ChevronDown` (disclosure), chip icons listed in screen 17, `Compass` (empty state).
- **Behaviour:**
  - Opening a club from Explore does not change the URL: the directory is replaced in place by the club profile view with a ghost back button `Back to Explore` (ArrowLeft 16). While the full profile loads: loading state labelled `Loading club profile…`. Back restores the list and returns focus to the element that opened it. (The dedicated `/club/<id>` page uses breadcrumbs instead; see screen 26.)
  - Filter/search state is written to the URL with `history.replaceState` (no navigation): `q`, `category`, `time` (`1-3|3-5|5+`), `acceptance` (`5|10|25|50|100`), `sort` (`name|deadline|acceptance`), `recruitment` (`open|closed|closing`). Defaults are omitted. A legacy `aum` param is stripped.
  - Search matches every whitespace-separated word (case-insensitive substring) against name, category, pitch, description, tags and placements. With 2+ characters, a Typesense lookup runs after 180 ms and, when available, replaces local matching and (in Name sort) orders by relevance; results are always intersected with the loaded directory.
  - Default sort: name A–Z (`localeCompare` en-US). `deadline`: open clubs with a deadline first, soonest first. `acceptance`: lowest reported rate first, unreported last.
  - No pagination and no infinite scroll: the list is fully rendered.
  - Save is optimistic through the shared saved-clubs context; the button is disabled while pending. Failure shows `Couldn’t save this change.` (or the server message) in red with a `Retry` link.
  - A "Featured clubs" section (`h2` `Featured clubs`, up to 3 cards) renders above the disclosure when clubs are flagged recommended, no filters are active and sort is Name; none in seeded data.
- **States:**
  - Loading: card skeletons, label `Loading clubs…` (3 rows).
  - Error: bordered card, centred: `h2` `Let’s try that again.`, message (default `We couldn’t load the club directory. Please try again.`), button `Retry directory`.
  - No clubs at all: empty state (Compass icon) `No clubs available yet.` / `No club profiles are published at your school yet.` with outline button `See campus events` (goes to Events).
  - Demo directory note: `Demo directory · fictional profiles for testing only. No real applications are submitted.`

### 14 · Explore — search typed ("consulting")
- **Route:** `/explore?q=consulting`
- **Screenshot:** `docs/mobile/screenshots/web/14-explore-search-typed.png`
- **Source:** `components/views/explore-view.tsx`, `lib/club-directory.ts`
- **Layout changes from screen 13:**
  1. Search field shows the query and the clear button.
  2. A "Filters applied" row appears under the chips (flex wrap, gap 8, 12 px, margin-bottom 24): label `Filters applied` (muted), then one outline chip-button per active filter (min-height 44, trailing X 14 px), then a link-style button `Clear all`.
  3. `Suggested for you`, `Featured clubs` and the `Applications open` disclosure are hidden.
  4. Results heading becomes `Search results`; count reads `{n} club` / `{n} clubs`.
- **Exact copy:** query chip text is the query in curly quotes: `“consulting”`; its aria-label is `Remove query filter`. Other chips: availability → `Applications open` / `Not currently open` / `Closing in 7 days` (aria `Remove recruitment filter`); all other keys → `{key}: {value}`, e.g. `category: Finance & Investing`, `time: 3-5`, `acceptance: 25`.
- **Behaviour:** results update on every keystroke. With seeded data "consulting" matches at least Blue Ridge Consulting Collective (category Consulting) and Venture Impact Fellows (pitch "Consulting for mission-driven organizations."); the capture shows exactly these two: `2 clubs`.

### 15 · Explore — search with no results ("zzzqqq")
- **Route:** `/explore?q=zzzqqq`
- **Screenshot:** `docs/mobile/screenshots/web/15-explore-search-empty.png`
- **Layout:** as screen 14, with count `0 clubs` and the list replaced by a compact, subtle-toned empty state: Compass icon (28 px, muted), `h3` title, 14 px muted description, one outline button.
- **Exact copy:** title `No clubs match this search.`; description `No club fits the current keyword or filters.`; button `Clear search and filters` (resets every filter including sort). Chip `“zzzqqq”`, link `Clear all`.

### 16 · Explore — filter controls
- **Route:** `/explore` (no URL change on open)
- **Screenshot:** `docs/mobile/screenshots/web/16-explore-filter-panel.png` (inline panel open), `16b-explore-filter-sheet.png` (bottom sheet open)
- **Source:** `components/views/explore-view.tsx`, `components/ui/filter-popover.tsx`, `components/ui/pill-select.tsx`, `styles/filter-controls.css`, `explore-directory.css`
- **Layout — two levels on phones:**
  1. Pressing the `Filter clubs` icon button toggles an inline panel directly under the search row (not an overlay): margin-top 12, padding 14, radius 16, 1 px card edge, card surface, shadow; children stacked full width, gap 10:
     - Full-width pill button `Filters` (SlidersHorizontal icon, label centred; with N active refinements its aria-label is `Filters, N active` and a navy count badge shows N; border turns navy).
     - Sort pill select: full-width pill, `Sort:` at the left in muted text (colon added by CSS), the value centred (`Name A–Z`) and a chevron at the right; min-height 46, radius full; navy fill with cream text when not the default. Options: `Name A–Z` (default), `Next deadline`, and `Reported acceptance rate` (only when at least 3 clubs report a rate; true for seeded data).
  2. Pressing `Filters` opens a bottom sheet (phones ≤ 639 px): max-height 88dvh, top corners radius 16, padding 28 / 16 / 16 + safe area. A grab handle sits at the top centre and an X close button (label `Close`) at top-right. Title `Filter clubs` (Libre Caslon, about 24 px); screen-reader description `Narrow the list. Changes apply as you choose them.` Body is a 1-column grid, gap 16, each group = uppercase label (13 px / 600, muted, tracking .02em) above a compact pill select (min-height 40):

     | Group label | Options (value) | Shown when |
     |---|---|---|
     | `Availability` | `All clubs ({n})`, `Applications open ({n})`, `Not currently open ({n})`, `Closing in 7 days ({n})` — counts reflect the other active filters | always |
     | `Time commitment` | `Any commitment`, then `1-3 hours / week`, `3-5 hours / week`, `5+ hours / week` for values present | at least 2 distinct values exist among clubs (not the case in seeded data: the captured sheet shows only Availability and Club-reported acceptance) |
     | `Club-reported acceptance` | `Any / not reported`, `Up to 5%`, `Up to 10%`, `Up to 25%`, `Up to 50%`, `Up to 100%` | at least 3 clubs report a rate |

     Seeded availability counts: `All clubs (43)`, `Applications open (14)`, `Not currently open (29)`; the "Closing in 7 days" count was not captured (the select was closed in the capture, showing `All clubs (43)` and `Any / not reported`) — unverified.
- **Behaviour:** there is no Apply and no Reset in this sheet (no footer): each choice applies immediately and updates the URL. Reset is via the "Filters applied" row (`Clear all`) or the empty state button. The toggle badge counts availability + time + acceptance + non-default sort; the `Filters` button badge counts the first three only. Sort is not listed in the "Filters applied" row.

### 17 · Explore — more interests expanded
- **Route:** `/explore`
- **Screenshot:** `docs/mobile/screenshots/web/17-explore-more-interests.png`
- **Source:** `components/views/explore-view.tsx`, `components/ui/filter-chips.tsx`, `styles/filter-controls.css`
- **Layout:** one chip row (`aria-label` `Browse categories`), gap 8, horizontally scrollable, it never wraps: expanded, it stays one line and you scroll sideways to reach the later chips and `Fewer` (confirmed by the capture).
  - Chip: min-height 36, padding 6 × 14, radius full, 1 px `#dfe3dd`, background `#fffefa`, text `#232d4b`; leading 16 px icon. Counts exist in markup but are hidden at phone width.
  - Selected chip (`aria-pressed="true"`): border `#232d4b`, background `#e7ebe7`, text `#232d4b`, icon weight `fill`.
  - Collapsed: `All` + the 5 categories with the most clubs (ties A–Z) + a dashed-border chip `+{N}` (aria `+{N} more interests`, `aria-expanded`): dashed 1 px light edge, 14 px / 600 navy.
  - Expanded: all categories inline, and the last chip reads `Fewer` (aria `Fewer browse categories`).
- **Seeded chips:** `All`, `Arts`, `Finance & Investing`, `Tech & Engineering`, `Academic`, `Sports & Recreation`, `+7`. The seven behind it (order confirmed by the capture): `Pre-Professional / Greek`, `Social`, `Business`, `Cultural`, `Impact & Social Enterprise`, `Service`, `Consulting`.
- **Icons (by category name regex, first match):** `All` → `Users`; academic/education → `BookOpen`; professional/business/finance → `BriefcaseBusiness`; cultur/international → `Globe2`; service/volunteer → `Heart`; recreat/sport/outdoor → `Mountain`; entrepreneur/startup → `Lightbulb`; consult → `ChartNoAxesCombined`; market/communication → `MessageSquare`; everything else → `Users` (so Arts, Tech & Engineering, Social, Impact & Social Enterprise use `Users`; "Pre-Professional / Greek" matches "professional" → `BriefcaseBusiness`).
- **Behaviour:** a selected category outside the first five is always kept visible while collapsed.

### 19 · Explore — category selected ("Finance & Investing")
- **Route:** `/explore?category=Finance+%26+Investing` (param value is the category label; matching is case-insensitive)
- **Screenshot:** `docs/mobile/screenshots/web/19-explore-category-selected.png`
- **Layout changes:** the chip is pressed (see styles above) and `All` is unpressed; the "Filters applied" row shows the chip `category: Finance & Investing` (aria `Remove category filter`) and `Clear all`; suggestions and the "Applications open" disclosure hide; heading `Search results`; count for seeded data `6 clubs` (Alternative Investment Fund, Lawn Street Capital, McIntire Investment Institute, Rotunda Equity Research Society, Virginia Venture Fund, Women in Quant Finance Circle — derived from the dump).
- **Behaviour:** pressing the selected chip again returns to `All`. Single-select.

### 18 · Explore — Saved clubs popover
- **Route:** `/explore` (no URL change)
- **Screenshot:** `docs/mobile/screenshots/web/18-explore-saved-clubs-popover.png`
- **Source:** `components/clubs/saved-clubs-popover.tsx`
- **Layout:** popover anchored to the `Saved clubs` button, aligned to its end, 8 px below, width `min(384px, 100vw − 32px)` (358 px at 390), no padding on the shell.
  1. Header (padding 16, bottom border): `h2` `Saved clubs` (600) and a 12 px muted line `{n} saved club` / `{n} saved clubs` (seeded `4 saved clubs`) or, when empty, `Clubs to come back to.`; right: ghost icon button 44 × 44 with X 16 px, aria `Close saved clubs`.
  2. Scroll area (max-height `min(60dvh, 448px)`, padding 8): list, 4 px between rows. Row = link (min-height 64, padding 12, gap 12, radius 10) containing a 44 px logo/monogram, name (14 px / 500, truncated) over category (12 px muted, truncated), and `ArrowUpRight` 16 px; followed by a separate ghost 44 × 44 X button, aria `Remove {club} from saved clubs`.
- **Behaviour:** row link goes to `/club/{club.id}` and closes the popover. Remove is optimistic; focus moves to the neighbouring row or the close button. Seeded rows: Lawn Street Capital (Finance & Investing), Piedmont Founders Lab (Business), Thornton Rocketry Team (Tech & Engineering), Dawson's Row A Cappella (Arts) — order as on `/saved-clubs`.
- **States:** loading `Loading saved clubs…`; signed out `Sign in to save clubs and see them here.` + button `Sign in`; error text + outline button `Retry saved clubs`; empty: `No saved clubs yet.` (500) / `You haven’t saved a club. Save one from Explore or its profile to keep it here.` / underlined link `Browse clubs` → `/explore`.

### 20 · Explore categories
- **Route:** `/explore/categories`
- **Screenshot:** `docs/mobile/screenshots/web/20-explore-categories.png`
- **Source:** `app/(workspace)/explore/categories/page.tsx` (renders the same `ExploreView`; page title "Club categories")
- **Layout / copy / behaviour:** identical to screen 13. The dump for this route matches `/explore` line for line (same heading `Explore clubs`, chips, suggestions, 43 cards). The route only sets `data-explore-section="categories"` on the wrapper. There is no separate categories grid; a native app does not need a distinct screen for it.

---

### 21 · Events — list (phone default)
- **Route:** `/corkboard` (page title "Events"; optional `?event=<uuid>` opens the detail dialog)
- **Screenshot:** `docs/mobile/screenshots/web/21-events-list.png`, `21-events-list.viewport.png`
- **Source:** `app/(workspace)/corkboard/page.tsx`, `components/views/corkboard-view.tsx`, `components/events/public-event-board.tsx`, `smart-event-card.tsx`, `event-discovery-actions.tsx`, `use-saved-campus-events.ts`, `events.css`, `lib/campus-events.ts`, `lib/event-board-empty.ts`
- **Layout (top to bottom):**
  1. Clubs/Events switch (`Events` current).
  2. Page header: `h1` `Events`, description `Events on Grounds`.
  3. Toolbar (grid at ≤ 700 px, gap 8–9): row 1 = full-width search field (aria `Search events`, placeholder `Search events…`); row 2 = three columns `auto | 1fr | auto`: `When` pill select, `Filters` pill (min-height 44), and an icon-only segmented view switch (aria-label `Event view`) with `Board` (`StickyNote`) and `List` (`Rows3`); the selected segment is a navy pill with a cream icon. In the capture the row reads: `When: Any time ⌄` | `Filters` | view switch.
  4. Result line (12 px muted, margin-block 12, live region): `{total} event` / `{total} events` + ` · Times shown in Eastern Time` (seeded `71 events · Times shown in Eastern Time`); while loading `Loading campus events…`.
  5. Event list (region `Event list`): 1 column, gap 12.
  6. Disclosure `Your RSVPs ({n})` (signed in only; seeded `Your RSVPs (3)`): bordered box, radius 10 (`rounded-lg`), padding 16, margin-top 20; summary min-height 44, 14 px / 500, leading ChevronDown (rotated −90° closed). Open content: `You can cancel here even if an event has been withdrawn or cancelled.` (12 px muted); rows of event title (underlined link to `/corkboard?event={id}` when still available, plain text otherwise) + small outline button `Cancel RSVP` (`Cancelling…` while busy). Empty: `You haven’t RSVP’d to an event. Events you RSVP to also appear on your calendar.` + link `Open your calendar` → `/calendar`. After cancelling: `Your RSVP was cancelled.` Errors: `Your RSVPs could not be loaded.` + `Retry`; `Could not cancel. Please try again.`
  7. Pagination (only when on page > 1 or more pages exist; centred, gap 20, margin-top 20): outline `Previous` (disabled on page 1), text `Page {n}`, outline `Next` (disabled on last page). Page size is 60 events (server `take: 60`), so the seeded 71 events span 2 pages.
- **Event card anatomy — list mode (`SmartEventCard`, phone):** card radius 16, 1 px card edge, card surface, shadow, column layout; whole card opens the detail (stretched title link) with the action buttons above it.
  1. Media band. With a flyer image: 16:9 area, image `object-fit: contain` with 14 px padding on a paper tint, alt `{title} event poster`. Without a flyer: an 84 px tinted band only (the text fallback is hidden on phones). Tint by template: default `#eee5d3`, `navy` `#232d4b`, `orange` `#f7d7c4`, `sage` `#dfe8d8`.
  2. Date badge on the band (top 13–14, left 14): 52 × 58, radius 16, background `#fffefa`; month `NOV` (12 px / 600, uppercase, tracking .1em, `#a04d00`) over day `19` (22 px / 500, tabular, two digits). Its screen-reader text is the full date, which is why the dump shows `THU, NOV 19, 2026` before `NOV` / `19`.
  3. Copy block, padding 14 / 16 / 16:
     - Meta row (12 px, space-between): host club name (500, muted) and category (padding 2 × 8, 2 px left rule `#dfe3dd`).
     - Title `h2`: Libre Caslon 20 px / 400, line-height 1.2, `#232d4b`, margin-bottom 6; link to `/corkboard?event={id}`.
     - Facts (14 px, gap 4): `Clock` 16 + schedule; `MapPin` 16 + location.
     - Description: 12 px muted, 2-line clamp, margin 14 top / 12 bottom.
     - Footer (column, gap 8): row of two equal-width small outline buttons (min-height 44) — `Save` / `Saved` and `Add to Calendar` — then a full-width primary pill `View Event` with `ArrowUpRight` 16 (min-height 46, radius full, background `#232d4b`, light text, 13 px / 500).
     - RSVP hint (12 px muted, margin-top 12), only when RSVP is enabled: `Event full` (capacity reached), else `RSVP required · Register in event details`, else `RSVP available in event details`.
- **Exact copy / formats:**
  - Schedule (`eventScheduleLabel`, Eastern): same-day `Thu, Nov 19, 2026 · 5:00 PM – 6:30 PM`; multi-day `{date} · {time} – {date} · {time}`; all-day `{date} · All day` or `{first} – {last} · All day`.
  - Save button: `Bookmark` 16 + `Save` (outline, aria `Save {title}`); saved = `accent` variant, `Bookmark` fill, text `Saved` — rendered as a peach pill (`#fceadd`) with `#a04d00` icon and text (aria `Saved {title}`, `aria-pressed` true); pending `Saving…`; disabled until saved IDs have loaded. Signed out it is a link `Save` to `/login?next=/corkboard?event={id}` (aria `Sign in to save {title}`).
  - `Add to Calendar` (`CalendarPlus` 16, aria `Add to Calendar: {title}`): no menu. It immediately downloads an iCalendar file `outclass-{eventId}.ics` (title, description + `Hosted by {club}`, location, start/end or all-day, URL of the event link).
- **Seeded first rows (dump):** `FWIT Open House` (Fourth Wall Improv Troupe · Arts · Student Union Ballroom B, saved), `CWW Open House` (Clemons Writers Workshop · Social · Engineering Commons 204), `Blue Ridge Consulting Collective: Spring Info Session` (Professional · South Lawn Tent), `Workshop Night with PFL` (Piedmont Founders Lab · Academic · Library Auditorium). All show `RSVP available in event details`.
- **Behaviour:**
  - View choice persists in `localStorage` key `outclass:events:view:v1` (`list` | `corkboard`); with nothing stored, below 1024 px the default is `list`.
  - Any search/filter change resets to page 1 and refetches after a 150 ms debounce. Filters are not written to the URL (only `event` is).
  - Default order: soonest first.
  - Off-screen cards use `content-visibility: auto` (the dump shows later cards with empty text for that reason).
  - `?event=<id>`: shows inline `Opening linked event…`, then opens the detail dialog. Missing/invalid id: `This event is no longer available. Browse the campus events below.` Load failure: `We couldn’t load this event. Please try again.` + outline `Retry event`.
- **States:**
  - Error: result line shows `We couldn’t load campus events. Please try again.`, and a card with the same text + button `Retry events`.
  - Saved-events load error: `Saved events couldn’t be loaded. Please retry.` + outline `Retry saved events`; save failure `Couldn’t save this event. Try again.`
  - Empty (left-aligned card, padding 24, radius 10; title in Libre Caslon 20 px; one outline button):

    | Situation | Title | Description | Button |
    |---|---|---|---|
    | Search text set | `No events match “{query}”.` | `Nothing approved fits the current search or filters.` (or `None of your saved events fit the current search or filters.` with Saved events on) | `Clear filters` (keeps Saved-only and sort) |
    | Other filters/period set | `No events match these filters.` | same as above | `Clear filters` |
    | Only Saved events on | `You haven’t saved any events yet.` | `Save an event from the board to keep it here.` | `Browse all events` (turns Saved-only off) |
    | Nothing published | `No upcoming campus events yet.` | `Clubs haven’t published upcoming events. Browse clubs to see what they do.` | `Explore clubs` → `/explore` |

### 22 · Events — board view
- **Route:** `/corkboard` with the `Board` segment selected
- **Screenshot:** `docs/mobile/screenshots/web/22-events-board.png`
- **Source:** `components/events/public-event-board.tsx`, `event-flyer.tsx`, `events.css`
- **Layout:** same header/toolbar/result line; the list is replaced by a cork board (region `Event board`): background `#be8e61` with a repeating cork texture (`/images/events/cork.svg`, 384 px tile), 1 px border `#aa7449`, radius 6, inner shadow, padding 24 × 18, min-height 430. Flyers in 2 columns (gap 26 × 18).
- **Flyer anatomy (button, screen-reader prefix `View event: `):** 3:4 paper, min-height 230, padding 16 / 10 / 10, background `#f6eedb` with paper texture, text `#0b2b47`, 12 px; rotated per position in a 6-step cycle (−3°, 1°, −1°, 2°, −2°, 3°); drop shadow; a small round pin at top centre coloured in a 4-step cycle (`#e57200`, `#295c88`, `#296448`, `#795617`). Templates: `navy` background `#0b2b47` with white text, `orange` `#f7cec0`, `sage` `#e3ead9`.
  - With an uploaded flyer: the image fills the paper (`contain`), alt `{title} flyer`.
  - Without: club name (Libre Caslon, ~12–14 px), title (Libre Caslon, 17–28 px by container width, max 3 lines), 2 px orange rule, schedule line, location (max 2 lines), then `{category} · RSVP required` or `{category} · Open to all`. The description is hidden on phones.
- **Behaviour:** tapping a flyer opens the same detail dialog; the tapped flyer fades to 30% and its pin lifts away while open. No Save / Add to Calendar on the board itself.

### 23 · Events — Filters sheet
- **Route:** `/corkboard` (no URL change)
- **Screenshot:** `docs/mobile/screenshots/web/23-events-filters.png`
- **Source:** `components/events/public-event-board.tsx`, `components/ui/filter-popover.tsx`
- **Layout:** bottom sheet (same shell as screen 16). Trigger: outline button `Filters` (SlidersHorizontal; with N active: aria `Filters, N active`, navy count badge). Sheet title `Event filters`; sr-only description `Narrow the list. Changes apply as you choose them.` Body, in order (gap 16):
  1. Toggle `Saved events` (signed in only).
  2. `Category` — pill select: `All categories`, `Academic`, `Professional`, `Social`, `Sports`, `Arts`, `Service`, `Other`.
  3. `Club` — pill select: `All clubs`, then every club with events on the current result set, by name.
  4. `Date (Eastern Time)` — date field, placeholder `Any date`, clear label `Any date`.
  5. `Location` — free-text input (pill style), no placeholder.
  6. `Sort` — pill select: `Soonest` (default), `Latest`, `Name A–Z`.
  7. Toggle `RSVP required`.
  Footer (top border): ghost small button `Reset filters` (resets everything including search, When and sort).
- **Behaviour:** every change applies immediately; there is no Apply. The badge counts category, club, date, location, RSVP required and Saved events (not sort, not When, not search).

### 23b · Events — When menu
- **Route:** `/corkboard`
- **Screenshot:** `docs/mobile/screenshots/web/23b-events-when-menu.png`
- **Layout:** compact pill select (min-height 40) reading `When: Any time` (prefix muted + colon). Opens a card-style listbox directly under the pill (about 170 px wide, radius 16, rows about 44 px) with four options: `Any time` (default), `Today`, `This week`, `Weekend`. The selected row has a soft grey-green highlight and a trailing check. Choosing anything but `Any time` turns the pill navy with cream text.

### 24 · Event detail
- **Route:** `/corkboard?event=<uuid>` (deep link) or opened in place from a card/flyer without changing the URL
- **Screenshot:** `docs/mobile/screenshots/web/24-event-detail.png` (first viewport of the dialog), `24-event-detail.full.png` (whole dialog)
- **Source:** `components/events/public-event-board.tsx` (`DialogContent.oc-event-detail`, `RsvpControls`), `event-flyer.tsx`, `components/share/event-share-button.tsx`, `components/reports/report-content-button.tsx`
- **What opens:** a centred modal dialog (not a page, not a bottom sheet): width `100% − 32px`, max-height 90dvh, scrolls as one block, radius 6, page-background fill, round white 40 px close button at top-right (8 px inset, label `Close`). The page behind is dimmed. Seeded capture: `Arts · Event`, `FWIT Open House`, `Hosted by Fourth Wall Improv Troupe`, `Thu, Nov 19, 2026 · 5:00 PM – 6:30 PM`, `Student Union Ballroom B`, `6 / 48 capacity · 42 remaining`, `RSVP optional`, orange `RSVP` button, then `Saved` (peach) and `Add to Calendar` on one row, `Share` on the next, then `Report`. Entry animation: the flyer "lifts" (380 ms; disabled with reduced motion).
- **Layout (top to bottom):**
  1. Decorative flyer (aria-hidden): max-width 260, centred, 15 px mat in `#f0e5d0`, rotated −3°; same paper as the board flyer with a 24 px title, and here the 2-line description shows.
  2. Copy block, padding 28 × 22:
     - Eyebrow `{category} · Event`.
     - Title (Libre Caslon 28 px, line-height 1.1).
     - `Hosted by {clubName}`.
     - Facts list (top border, padding-block 18, gap 16; label 12 px muted, value 13 px / 500): `Date & time` → schedule label; `Location`; `Students going` → `{rsvpCount}` or `{rsvpCount} / {capacity} capacity · {remaining} remaining`.
     - Capacity bar (only with a capacity): 10 px tall, track `#edeee9`, fill `#e57200`, aria `RSVP capacity`.
     - Description (13 px, line-height 1.7, preserves line breaks).
     - `Contact: {contact}` (if set).
     - `RSVP by {Thu, Nov 19, 2026} · {5:00 PM}` (if a deadline is set; muted).
     - One of `RSVP required` / `RSVP optional` / `No RSVP required`.
     - RSVP controls (full-width buttons):

       | State | UI |
       |---|---|
       | loading own RSVP | button `Loading RSVP…` (disabled) |
       | can RSVP | button `RSVP` — background `#c84b19`, white text, min-height 44 |
       | going | `You’re going` + `Check` 16 (600, `#296448`) and outline button `Cancel RSVP` |
       | RSVP not enabled, event started, or deadline passed | disabled button `RSVP closed` |
       | at capacity | disabled button `Event full` |
       | signed out | button-link `Sign in to RSVP` → `/login?next=/corkboard?event={id}` (or plain text `RSVP closed` / `Event full`) |
       | alumni account | `You’re going ✓` (no cancel) or `Alumni accounts can’t RSVP.` |

       Errors: `Could not load your RSVP. Retry before continuing.` + outline `Retry RSVP`; `Could not update RSVP.` or the server's message. RSVP is optimistic and reverts on refusal; the "Students going" count and the "Your RSVPs" list update afterwards.
     - Action row (wrap, gap 8, margin-top 16): `Save`/`Saved`, `Add to Calendar`, `Share`.
     - Row of low-emphasis links (gap 16, margin-top 12): `Report` (aria `Report event`) and, when there is a flyer image, a second `Report` (aria `Report flyer`). Hidden for staff of the hosting club.
- **Share (event):** same share sheet as screen 28 with heading `Share {event title}`, subtitle `Hosted by {club} · {schedule}`, message text `{title} ({schedule}), hosted by {club}`, link `/corkboard?event={id}`; no QR target.
- **Behaviour:** closing returns focus to the card/flyer that opened it.

---

### 25 · Saved clubs
- **Route:** `/saved-clubs`
- **Screenshot:** `docs/mobile/screenshots/web/25-saved-clubs.png`
- **Source:** `app/(workspace)/saved-clubs/page.tsx`, `components/views/saved-clubs-view.tsx`
- **Layout (top to bottom, 24 px between blocks):**
  1. Page header: `h1` `Saved clubs`; description `Saving a club doesn’t apply, join or subscribe you.`; header action: underlined 14 px link `Explore clubs` → `/explore`.
  2. Row (space-between): count `{n} saved club` / `{n} saved clubs` (14 px muted; seeded `4 saved clubs`) and a ghost small button `Refresh` with `RefreshCw` 16.
  3. Card list: the same `DiscoveryCard` as Explore (1 column, gap 16), each with the `Remove from saved clubs` button. Seeded order: Lawn Street Capital, Piedmont Founders Lab, Thornton Rocketry Team, Dawson's Row A Cappella.
- **Behaviour:** tapping a card swaps the page content for the club profile view in place with back button `Back to saved clubs` (URL unchanged). Removing a club removes its card (optimistic). There is no Clubs/Events switch on this page.
- **States:** loading `Loading Saved clubs…` (card skeletons); empty: Bookmark icon, `No saved clubs yet.` / `Save a club from Explore or its profile, and you’ll find it here.` / button `Browse clubs` + ArrowRight; load error with nothing cached: `Couldn’t load your saved clubs.` + message + outline `Retry Saved clubs`; error with cached items: inline red message + ghost `Retry Saved clubs`; signed out: `Sign in to see your saved clubs.` / `Sign in to save clubs and revisit them across devices.` / buttons `Sign in`, `Browse Explore`.

---

### 26 · Club page — Blue Ridge Consulting Collective (student is a member)
- **Route:** `/club/<slug-or-id>` (seeded `/club/blue-ridge-consulting`; `?follow=<clubId>` completes a follow after sign-in)
- **Screenshot:** `docs/mobile/screenshots/web/26-club-blue-ridge-consulting.png`, `26-club-blue-ridge-consulting.viewport.png`
- **Source:** `app/(workspace)/club/[clubId]/page.tsx`, `components/qr/public-club-page.tsx`, `components/views/club-profile-view.tsx`, `components/clubs/marketing-profile.tsx`, `profile-presentation.css`, `club-discovery.css`, `recruitment-timeline.tsx`, `corkboard-button.tsx`, `share-club-button.tsx`, `unclaimed-profile-notice.tsx`, `components/reports/report-content-button.tsx`, `components/ui/status-pill.tsx`
- **Layout (top to bottom):**
  1. Breadcrumb (replaces the back button on this route): link `Explore` → `/explore`, `ChevronRight` 14, then the club name as the current page (not a link). Margin-bottom 12.
  2. Hero block (source: radius 16 container with a glass surface; in the capture the surface is indistinguishable from the page, so it reads as a rounded cover followed by content on the page background, inset 16 px):
     - Cover 88 px: `linear-gradient(120deg, {club colour}, #8793a0)`, or the banner image (cover, club focal point).
     - Logo/monogram 80 × 80, pulled up 40 px over the cover, 4 px `#fffefa` border, radius 16, margin-bottom 16; monogram = first letters of up to 3 words (`BRC`, `LSC`); image alt `{name} logo`.
     - Name `h1`: serif display face, 30 px, weight 600, tight tracking (class `font-serif text-3xl font-semibold tracking-tight`; rendered as the Caslon display face in the capture).
     - Tagline: 16 px, line-height 28, `#52606d`, margin-top 8.
     - Category pill (margin-top 12): min-height 28, padding 2 × 12, radius full, 13 px, `#232d4b` on a 6% navy tint with a light edge; preceded by sr-only `Category: `.
     - Stat tiles (margin-top 24, top border, padding-top 20; grid `auto-fit, minmax(130px, 1fr)`, gap 16 → 2 columns at 390): label 12 px muted tracking .04em; value 26 px / 600 tracking −.035em; detail 12 px muted. Seeded: `Club acceptance` `32%` `Club-reported`; `Members` `35` `Club-reported`. Possible tiles in order: `Club acceptance` (`~` prefix if approximate), `AUM` (compact USD, e.g. `$1.2M`), `Members`, then custom metrics.
     - Action area (margin-top 24, top border, padding-top 16, stacked): the action block (below), then, if the club has links, a row of 44 px round icon links: `Globe` Website, `Linkedin` LinkedIn, `Instagram` Instagram, `Mail` Email (aria `{club} Website (opens in a new tab)` etc.; Email has no suffix).
  3. Action block (1-column grid, gap 8) — seeded for this member:
     - Primary button `Start application` + `ArrowRight` 16, full width, min-height 46.
     - `Follow` (outline, full width, min-height 46, `Bookmark` 16; aria `Follow Blue Ridge Consulting Collective`, `aria-pressed` false).
     - `Share` (outline, left-aligned, natural width, min-height 44, `Share` icon 16).
     - Note (12 px muted): `Closing soon · Application deadline: Nov 24, 2026, 11:59 PM · Eastern Time`.
     - `Report` (link-style, 12 px muted, `Flag` 14; aria `Report Blue Ridge Consulting Collective`), centred on its own row in the capture.
     - In the capture the stats block has a hairline above and below it, and the apply button is a navy pill with centred label and arrow; `Follow` is a white pill; `Share` is a small white pill at the left.
  4. (Unclaimed clubs only) notice strip — see States.
  5. Sections. Below 1024 px each section is its own card: margin-top 12, padding 16, radius 16, 1 px card edge, card surface, shadow; section `h2` is sans 17 px / 600, margin-bottom 10; body prose 14 px, line-height 1.55, `#52606d`. Order:
     1. `About` — description paragraph; then any club "about" sections (seeded sub-heading `What we do`, `h3` 17 px / 600, + body); then outbound links (`Watch our introduction` with `Play` icon for a video; other links by their label or `Club website`, each with `ExternalLink` 14); then a `Club pages` link row (underlined 15 px links, min-height 44, `ArrowUpRight` 14): `Meetings, agendas and recaps` → `/meetings?clubId={id}` and, for members only, `Open club workspace` → `/club/{id}/workspace`.
     2. `What members do` — club sections of kind programs/people/impact (seeded: `How members spend their time`, body `A mix of project work, training and community.`, then cards `Project teams`, `Training`, `Community`, each a bordered card: padding 20, radius 16, title 16 px / 600, text 15 px muted, optional 4:3 image and `Learn more about {title}` link); `Projects and highlights` list; `Where members go` + `Club-reported` with pill chips; `Recognition` bullet list; `A look inside` 2-column photo grid (4:3, radius 10, captions 12 px, a `Report` link per image with aria `Report image {n}`).
     3. `Recruitment and requirements` — shown when there is a deadline, an expired deadline, an application, requirements, or a club recruitment section:
        - `Application deadline: {date}` (+ ` The deadline has passed. Existing drafts remain available.` when expired).
        - "Your application" stage tracker when the student has an application (see screen 27).
        - Club recruitment sections (a section titled "Recruitment" gets no extra heading).
        - `Before you apply` (`h3`): `Your OutClass profile is the starting point for your application.`; `Standardized tests: SAT and ACT optional. Scores come from your student profile.` (or `Standardized tests: {REQUIREMENT} required. Scores come from your student profile.`); `Time commitment: {1-3|3-5|5+} hours per week.` (if set); then `Required club questions` (`h4`, 15 px / 600) as a bulleted list (16 px, disc bullets, gap 8). Seeded questions: `Why do you want to join Blue Ridge Consulting Collective?`, `Tell us about a time you worked on a team to get something difficult done. What was your part?`, `How many hours a week can you commit this semester?`
     4. `Life in the club` — bulleted benefits (seeded: `Hands-on experience from the first month`, `A mentor in your first semester`, `A community that shows up for each other`), then a facts list (gap 16; term 15 px / 600, value 16 px muted): `Who can join` → `Open to all undergraduates in any school or year.`; `Time commitment` → `Two meetings a week`; `Membership dues` → `$35 per year`. Missing facts are omitted.
     5. `Frequently asked questions` — accordion of native disclosures separated by 1 px rules; question row min-height 52, 16 px / 500; answer 16 px muted, line-height 1.7. Seeded questions: `Do I need experience?`, `How do I join?` (answers were collapsed in the dump; not captured). Several can be open at once.
     6. `Events` — upcoming public events only: each row = `CalendarDays` 16 (muted) + block: title link (17 px / 500, underlined) → `/corkboard?event={id}`; schedule line 14 px muted; `MapPin` 14 + location; description. Rows separated by 1 px rules, padding-block 18. Seeded: `Blue Ridge Consulting Collective: Spring Info Session` — `Thu, Nov 19, 2026 · 6:00 PM – 7:00 PM` — `South Lawn Tent` — `Meet current members, hear what a semester looks like, and ask anything about joining.`; `BRCC Open House` — `Sat, Nov 28, 2026 · 5:00 PM – 6:30 PM` — `Commerce Annex 120` — `Drop in, grab a snack and meet the group. No sign-up needed, but an RSVP helps us plan.`
     7. `Leadership` — demo/sample clubs only (avatar + name + role).
- **Primary action variants (from `club-profile-view.tsx`):**

  | Condition | What shows |
  |---|---|
  | Live club, student has no application, applications not available ("closed") | No apply button. `Follow`/`Following` becomes the filled primary button (full width). Then `Share`. Note: `Applications aren’t open yet · Follow to keep this club in your saved clubs` |
  | No application, applications open | `Start application` |
  | Application whose status contains "draft" | `Continue draft` |
  | Any other application status | `View status` |
  | Application status REJECTED and applications open | `Apply again` |
  | While opening | `Opening…` (disabled) |
  | Alumni account with no application (or eligible to re-apply) | `Alumni can’t apply` (disabled) |
  | Signed out | `Start application` opens the join prompt (below) |

  In the non-closed cases the outline `Follow`/`Following` and `Share` follow the apply button; the note appears only when a deadline exists: `Application deadline: {date}`, prefixed `Closing soon · ` when within 7 days. When the student has an application, a status mark (icon + text, 12 px / 500) follows — see screen 27. Errors render in red below: the server's "unavailable" message, or `We couldn’t open your application. Please try again.`
  Destinations: `View status` → the applications "status" view; start/continue/apply again → the application tracker/draft view (on this route these are full navigations to the student applications pages; exact URLs are owned by another section — unverified here). Starting creates the application on the server first.
- **Follow semantics:** identical record to "Saved clubs" — `Follow` = save, `Following` = saved (`BookmarkCheck` fill). aria `Follow {club}` / `Following {club}`, `aria-pressed`. No notifications or email subscription are attached. Tapping `Following` removes the club from saved clubs.
- **Member-specific differences (as implemented):** the only member-only element is the `Open club workspace` link in About. The CTA does not change for members: the seeded member still sees `Start application` and `Follow` (see Web issues). The label "Open member workspace" does not occur on this page (it is used on My Clubs). `Report` is hidden only for members with leader/staff workspace access; an ordinary member still sees it (confirmed by the dump).
- **Icons:** `ChevronRight`, `ArrowRight`, `Bookmark`/`BookmarkCheck`, `Share`, `Flag`, `ArrowUpRight`, `CalendarDays`, `MapPin`, `Play`, `ExternalLink`, `Globe`, `Linkedin`, `Instagram`, `Mail`, `Check` (timeline), `Info` (unclaimed notice).
- **States:**
  - Unclaimed club (live, not claimed): strip under the hero (margin-block 20, padding 12 × 16, radius 6, muted tint): badge `Unclaimed profile` (12 px / 500), optional `Info` button (aria `About this directory profile`) opening a popover `OutClass includes public university directory information to help students discover this organization.` + link `View university directory source`; text `This organization hasn’t claimed its OutClass page yet.`; outline small button `Claim this club` → `/club-claims/{id}`.
  - Load error: `h1` `Club profile unavailable`, the error text, link `Try again`. Unknown club: 404.
  - Signed-out join prompt (bottom sheet on phones): title `Apply to {club}` with `Create a free OutClass account to start your application. One profile covers the basics for every club you apply to, and you’ll come right back here.`, or title `Follow {club}` with `Create a free OutClass account to save this club and keep its events, deadlines and application in one place. You’ll come right back here.`; buttons `Create your account`, `I already have an account`; note `Free for UVA students. Use your @virginia.edu email.` After returning with `?follow=`, a toast: `You’re following {club}` / `It’s in your saved clubs.`

### 27 · Club page — Lawn Street Capital (application in Interview round; following)
- **Route:** `/club/lawn-street-capital`
- **Screenshot:** `docs/mobile/screenshots/web/27-club-lawn-street-capital.png`
- **Differences from screen 26:**
  1. Hero: `Lawn Street Capital`, tagline `A student-run long-only equity fund.`, category `Finance & Investing`, stats `Club acceptance` `16%` `Club-reported` and `Members` `43` `Club-reported`. Cover gradient starts dark green for this club.
  2. Action block: `View status` (navy pill) → `Following` (white pill, filled bookmark, pressed, aria `Following Lawn Street Capital`) → `Share` → status mark `Interview` (calendar-clock icon, left-aligned) → `Report` (centred). No deadline note (no deadline published).
  3. About: only `Meetings, agendas and recaps` (not a member, so no workspace link).
  4. `Recruitment and requirements` starts with the stage tracker:
     - Line `Your application` (12 px muted) with the status label below it (12 px / 500, `#232d4b`): `Interview`.
     - Ordered steps (aria `Application recruitment timeline`): one per club round in order — seeded `Application Review`, `Interview`, `Final Deliberation`. Without club rounds the defaults are `Submitted`, `In review`, `Interview`, `Decision`.
     - Step = 27 px circle + label below (12 px; current label 600), joined by a 1 px `#dfe3dd` line. Base CSS: completed = `Check` 14 in `#296448` on `#edf5ef`; current = filled `#232d4b` with light number; upcoming = number in muted text, 1 px border. In the capture the current step actually renders as a pale peach circle with an orange ring and the number `2` (not the navy fill the base CSS describes; a later theme rule appears to override it), the completed step is a navy circle with a light check, and upcoming steps are white with a grey ring.
     - Current step = the round the application is in; accepted/rejected/waitlisted → last step. Draft → no current step and note `Your draft hasn’t been submitted yet.`; unknown stage → `The club is using a custom stage. See your application for details.`
     - The grid is fixed at 4 equal columns, so 3 rounds occupy the left three quarters.
  5. Life in the club: `Time commitment` → `About 3 hours a week`.
  6. Events: `LSC Open House` — `Tue, Nov 24, 2026 · 5:00 PM – 6:30 PM` — `Recreation Center Court 2`; `Workshop Night with LSC` — `Thu, Dec 3, 2026 · 7:00 PM – 8:15 PM` — `Science Hall 101` — `A hands-on session led by members. Beginners welcome; bring a laptop if you have one.`
- **Application status marks (`StatusPill`: 16 px icon tinted, plain text, no capsule):**

  | Status | Label | Icon | Icon colour |
  |---|---|---|---|
  | DRAFTING | `Draft` | `FilePenLine` | `#52606d` |
  | SUBMITTED | `Submitted` | `Send` | `--secondary-foreground` (value not looked up) |
  | IN_REVIEW | `In review` | `Eye` | `#295c88` |
  | INTERVIEWING | `Interview` | `CalendarClock` | `--interview` (value not looked up) |
  | ACCEPTED | `Accepted` | `CheckCircle2` | `#296448` |
  | REJECTED | `Not selected` | `XCircle` | `#ac3544` |
  | WAITLISTED | `Waitlisted` | `Clock` | `#795617` |

### 28 · Club page — Share
- **Route:** `/club/<slug>` (no URL change)
- **Screenshot:** `docs/mobile/screenshots/web/28-club-share-menu.png`
- **Source:** `components/clubs/share-club-button.tsx`, `components/share/share-sheet.tsx/.css`, `lib/share-links.ts`
- **What opens:** a dialog styled as a bottom sheet at ≤ 640 px (full width, square bottom corners, bottom padding ≥ 24 + safe area), 20 px between blocks.
- **Layout:**
  1. Title `Share {club name}` (Libre Caslon 22 px, line-height 1.2); subtitle `Anyone with the link can see the club’s public profile.` (14 px muted).
  2. Targets grid, 4 columns (seeded capture: row 1 `Messages`, `Instagram`, `WhatsApp`, `Email`; row 2 `LinkedIn`, `X`, `QR code`; `More` did not appear in the capture browser). An X close button sits at the top-right of the sheet. Grid: 4 columns (gap 12 × 8). Each = 52 px circle (1 px `#dfe3dd`, background `#edeee9`, 24 px icon) with a 13 px label below:

     | Label | Icon | Action |
     |---|---|---|
     | `Messages` | `MessageSquareText` | `sms:?&body={text} {url}` |
     | `Instagram` | `Instagram` | copies the link, opens Instagram DMs in a new tab; status `Link copied. Paste it in an Instagram message or story.` |
     | `WhatsApp` | `WhatsApp` | `https://wa.me/?text=…` (new tab) |
     | `Email` | `Mail` | `mailto:?subject={club}&body={text}\n\n{url}` |
     | `LinkedIn` | `Linkedin` | LinkedIn share-offsite URL (new tab) |
     | `X` | `XLogo` | `https://x.com/intent/post?text=…&url=…` (new tab) |
     | `More` | `MoreHorizontal` | system share sheet; only where the browser supports it |
     | `QR code` | `QrCode` | closes the sheet and opens the full-screen QR presenter; label `Loading…` while the short link resolves (4 s timeout, falls back to the page URL) |

  3. Link row (stacked on phones): read-only input (aria `Link`) with the absolute URL, and, below it at full width, a navy pill button `Copy link` (`Copy` 16) which becomes `Copied` (`Check`) for 2.5 s.
  4. Status line (14 px muted; red for errors): `Link copied.`; `Couldn’t copy automatically. The link is selected, so copy it from the box.`; `Your device couldn’t open its share menu. Copy the link instead.`
- **Copy sent:** text `Check out {club} on OutClass`; link `/club/{id}`. QR presenter title = club name, description `Scan to see the club, follow it and apply on OutClass.`, aria `QR code for {club}`; it uses a first-party short link (`/q/…`) for signed-in users.

### 29 · Club page — Report dialog
- **Route:** `/club/<slug>` (no URL change)
- **Screenshot:** `docs/mobile/screenshots/web/29-club-report-dialog.png`
- **Source:** `components/reports/report-content-button.tsx`, `lib/content-reports.ts`
- **What opens:** a centred modal card (not a bottom sheet), 16 px side margins, radius about 24, padding about 20, X close at top-right; the page behind is dimmed. Title in Libre Caslon about 24 px, wrapping to two lines (`Report Lawn Street` / `Capital`). Focus starts on the Reason select (orange focus ring).
- **Layout / copy:**
  1. Title `Report {club name}`; description `Reports go to the OutClass team. We don’t tell the person or club who reported them.`
  2. Field `Reason` (required native select; placeholder option `Choose a reason`): `Spam`, `Harassment or bullying`, `Inappropriate content`, `Impersonation`, `Copyright infringement`, `Something else`.
  3. Field `Details (optional)`: textarea, max 1000 characters, counter `{n}/1000` (12 px muted; seeded `0/1000`). The textarea is about 64 px tall and resizable.
  4. Footer, stacked full-width pills on phones: `Submit report` on top (filled navy; greyed while no reason is chosen; `Sending…` while busy), then `Cancel` (white).
  5. Success: description changes to `Thanks. Our team will review this.`; for copyright reports an extra line `For copyright claims, also send a notice as described in the Terms.` (link `Terms` → `/terms#legal-6-reporting-content`); single button `Done`.
- **States:** failure `We couldn’t send your report. Please try again.` or the server message, in red above the footer.
- **Visibility:** signed-in live accounts only; hidden in Demo Mode, during support sessions, and for the club's own leaders/staff.

---

### 63–65b · Alumni account (read-only)
- **Routes:** `/home` (63), `/explore` (64), `/club/blue-ridge-consulting` (65), `/club/<clubId>/workspace` (65b)
- **Screenshots:** `docs/mobile/screenshots/web/63-alumni-home.png` (+ `63-alumni-home.viewport.png`), `63a-alumni-first-run-guide.viewport.png`, `63a-alumni-first-run-guide-help-chip.viewport.png`, `64-alumni-explore.png`, `65-alumni-club-blue-ridge-consulting.png`, `65b-alumni-member-workspace.png`
- **Source:** `lib/graduation.ts`, `lib/permissions.ts`, `components/clubs/corkboard-button.tsx`, `components/views/club-profile-view.tsx`, `components/events/public-event-board.tsx`, `event-discovery-actions.tsx`, `components/views/student-dashboard-view.tsx`, `components/organization-memberships.tsx`, `components/club-workspace.tsx`, `components/interests/interest-survey-prompt.tsx`
- **Rule:** an account is alumni when `profile.graduatedAt` is set and in the past. Alumni can sign in and see their profile and history and keep personal settings; every other write is refused by the server and the controls are hidden. A club membership with `alumniSince` stays on the roster but is not an "active" membership and carries no club capabilities.
- **No alumni badge, banner or notice appears on Home, Explore or the club page** (confirmed by all four captures). The only alumni wording on these screens is the disabled button `Alumni can’t apply`. Elsewhere, the word appears as the role line `Alumni` on the Settings organizations list (link `View club` → `/club/{id}` instead of `Open club`), and as the `Alumni` item in a club workspace's navigation.
- **Seeded account:** `Alex Staging-Alumni` (avatar initials `AS`; account button aria `Account menu for Alex Staging-Alumni, AS`); notifications button reads `Notifications` (no unread count, no dot).

**63 · Alumni Home (`/home`)** — same structure as the student Home, top to bottom as captured:
1. Date line `Wednesday, November 18`, greeting `Good afternoon, Alex.` (Libre Caslon), sub-line `Explore what's new in OutClass.`
2. Card `To-do`: one unchecked row `FWIT Open House` / `Thu, Nov 19, 5:00 PM · Student Union Ballroom B` with link-button `View event details` → (an event the account is already going to).
3. Card `Coming up` with header link `Calendar` →: rows with a navy date badge (`NOV` / `19`), title, and meta, each with a trailing arrow: `FWIT Open House` — `Thu, Nov 19, 5:00 PM · Club event · Student Union Ballroom B`; `CWW Open House` — `… · Club event · Engineering Commons 204`; `Blue Ridge Consulting Collective: Spring Info Session` — `Thu, Nov 19, 6:00 PM · Club event · South Lawn Tent` (meta truncates with an ellipsis).
4. Card `Applications` with header link `View all` →: `Nothing submitted yet.` (bold) `Find clubs to apply to in Explore.` + inline link `Explore clubs` →.
5. Card `Suggested clubs` with header link `Explore` →: rows = monogram text, name, reason, arrow; each row links to `/club/{id}`. Seeded: `Alternative Investment Fund`, `Lawn Street Capital`, `McIntire Investment Institute`, `Virginia Venture Fund`, each with `Because you picked Finance & investing`.
6. `My Clubs` heading with link `All clubs` →, and an empty card: `Clubs you join appear here, with their meetings and tasks.` The two clubs the account is alumni of are not listed (Home counts active memberships only).
7. Dock: Home (current), Explore, Inbox, Calendar, Profile.
- What is absent compared with a current student: no interest-survey prompt, no club rows under My Clubs, no application rows. The first-run guide still shows for a new alumni account (`63a-…`): `YOUR OUTCLASS GUIDE`, `Step 1 of 8`, `Your profile`, `Build one profile for your applications. Keep your education, experience, and resume up to date from your account menu.`, `Show me where`, `Skip`, `Back` (disabled), `Next`; close aria `Dismiss tutorial`.

**64 · Alumni Explore (`/explore`)** — identical to screen 13 except:
- No save button on any card: each card ends at the footer row (recruiting label + arrow). The dump contains zero `Save to saved clubs` / `Remove from saved clubs` controls.
- The `Saved clubs` header button is still present. Its popover's per-row remove (X) buttons are not hidden in source; the server would refuse (popover not captured for alumni — unverified).
- Suggestions (same caption `Based on the clubs you saved and your major.`): `Alternative Investment Fund`, `Lawn Street Capital`, `McIntire Investment Institute`, `Virginia Venture Fund`, `Women in Quant Finance Circle` — each `Because you picked Finance & investing` — and `Albemarle Data Science Circle` — `Because you picked Tech & engineering`. Clubs the account is alumni of (Blue Ridge Consulting Collective, Rotunda Equity Research Society) are not suggested but still appear in the main list like any other club.
- Counts unchanged: `Applications open · 14 clubs`, `All clubs`, `43 clubs`.

**65 · Alumni club page (`/club/blue-ridge-consulting`)** — identical to screen 26 except the action block:
1. `Alumni can’t apply` + arrow: full-width pill, disabled (greyed navy, light text).
2. No `Follow` button at all.
3. `Share` (unchanged). Creating a short link is refused for alumni, so the QR code falls back to the page's own address (source).
4. Note `Closing soon · Application deadline: Nov 24, 2026, 11:59 PM · Eastern Time`.
5. `Report` (centred), aria `Report Blue Ridge Consulting Collective`.
- Everything below is the same as for a student, including the About links `Meetings, agendas and recaps` and `Open club workspace` → `/club/{clubId}/workspace` (still offered to the alumni member), the `Recruitment and requirements` section with `Before you apply`, FAQ and Events.
- From source, other cases: an alumni with an existing application still sees `Continue draft` / `View status`; on a club that is closed to applications only `Share` and the note `Applications aren’t open yet · Follow to keep this club in your saved clubs` remain.

**65b · Alumni member workspace (`/club/<clubId>/workspace`)** — a dead end, as captured:
1. Large title: the club name `Blue Ridge Consulting Collective` (Libre Caslon, about 40 px, two lines), with a blank line where the greeting/sub-line would be.
2. Underlined muted link `All my clubs` → `/clubs`.
3. Card (radius 16, padding about 16): `Could not load this workspace. Your membership may have changed. Try again.` and a white pill button `Retry`.
4. The dock switches to the club set: `Home`, `Explore`, `Inbox`, `Calendar`, `More` (aria `More sections`; nothing is marked current). The shell still exposes the member links `Club home` (`?section=overview`), `Meetings` (`?section=calendar&type=meetings`), `Club tasks` (`?section=tasks`) and `Alumni` (`?section=alumni`); what those show for an alumni was not captured (unverified).
- Why (source): the page finds the roster membership, so it does not show `Club workspace unavailable`; the server then refuses the overview read because an alumni membership is not active, which surfaces as this generic error. There is no alumni-specific message here. A graduate still kept as owner would instead see `You’ve graduated. Hand this club to a current member to keep it running.` + link `Transfer ownership`.

**Events for alumni (source only; no alumni capture of `/corkboard`):** `Save` is hidden; an already-saved event shows a static `Saved` label with a filled bookmark. The RSVP area shows `Alumni accounts can’t RSVP.` or, if already going, `You’re going ✓` without `Cancel RSVP`. `Add to Calendar` and `Share` remain. Saved clubs page: cards without the remove button.

- **Server refusal messages (shown as written when an action is attempted):**
  - apply: `Congratulations on graduating. Alumni accounts can’t submit new applications; your past applications stay in your history.`
  - rsvp: `Alumni accounts can’t RSVP to events or change an RSVP. Your past RSVPs stay in your history.`
  - save: `Alumni accounts can’t save or remove clubs and events. Your saved items stay as they are.`
  - share: `Alumni accounts can’t create share links. The full page address still works.`
  - join: `Alumni accounts can’t join clubs. Your past memberships stay in your history.`
  - check-in: `Alumni accounts can’t check in to meetings. Your past attendance stays in your history.`
  - manage (graduate owner): `You’ve graduated, so this club is read-only for you. Hand it to a current member to keep it running.`

---

## Inbox tab

Evidence note: written from source, then checked against the captures and text dumps of the rendered pages for 30–43 and 66/66b/66c. Not shown by any capture (source-only): the in-page notification detail panel, bulk-selection bar, inbox empty/error states, the Subscribe dialog after a link is created, the `/check-in` page, the push row, and the `Discard changes?` bar. Sizes marked "in the capture" are read off the 390px previews and override the class-derived value; phone CSS enlarges several small text sizes.

Shared tokens used below (light theme, `styles/tokens.css`): foreground/primary `#232d4b` (UVA Blue), background `#f6f5f1`, card / content surface `#fffefa`, content edge `#e0e5e3`, border `#dfe3dd`, secondary `#eaece8`, muted `#edeee9`, muted-foreground `#52606d`, destructive `#ac3544`, warning `#795617` on warning-subtle `#fbf3df`, focus ring `#c86400`, overlay `rgb(12 25 43 / 42%)`, glass cream `#fff7ec`. Radii: sm 6, md 10, lg 16 (cards, panels, sheets), full 999. Display font = Libre Caslon Text (`--oc-font-display`), sans = Source Sans 3. `oc-card-heading` = Libre Caslon 17px / 600 / lh 1.14 / tracking -.01em. `oc-section-heading` = sans 20px at 390 (`clamp(1.25rem,1.6vw,1.5rem)`) / 600 / lh 1.14 / tracking -.016em. Page `h1` (PageHeader) = Libre Caslon 26px at 390 (`clamp(1.625rem,2.2vw,1.875rem)`) / 500 / lh 1.14 / tracking -.03em.

Segmented control (`components/ui/segmented-control.tsx`, `styles/filter-controls.css`): pill track, 1px edge `rgb(255 255 255 / 68%)`, light glass fill, padding 4, gap 4, min-height 54 (compact 46); segments min-height 44 (compact 36), padding 8×16 (compact 6×16), 14px / 500, text `#232d4b`; selected segment = navy pill (`#232d4b` with a faint blue gradient) with cream `#fff7ec` text, a sliding indicator animates between segments (420 ms; none under reduced motion). `count` renders after the label at 72% opacity (90% when selected), e.g. `Unread 17`. Each segment is an `aria-pressed` toggle button inside `role="group"`.

### 30 · Inbox (also 31 unread, 32 read)
- **Route:** `/inbox` (deep link `?tab=preferences` opens the settings sheet, see 34). No URL params for filter state; all filter state is local and resets on reload.
- **Screenshot:** `docs/mobile/screenshots/web/30-inbox.png`, `30-inbox.viewport.png`, `31-inbox-unread.png`, `32-inbox-read.png`
- **Source:** `app/(workspace)/inbox/page.tsx`, `components/dashboard-layout.tsx` (page header), `components/views/inbox-view.tsx`, `components/communications-inbox.tsx`, `lib/student-agenda.ts` (`notificationGroups`, `notificationPriority`), `lib/communications-client.ts`, `lib/inbox-realtime.ts`, `lib/communications-live.ts`, `styles/product-components.css` (phone rules at `max-width: 1023px`).
- **Layout (top to bottom):**
  1. Page header (`.oc-page-header.oc-notifications-header`, flex wrap, margin-bottom 20): `h1` `Inbox`; under it description `Announcements, application updates and tasks from your clubs.` (12px, muted `#52606d`, margin-top ~5.6px). At 390px the action wraps to its own row below the description, left-aligned: a round 44px glass icon button, aria-label and title `Notification settings`, `Settings` (gear) icon, `aria-haspopup="dialog"`. Hidden in Demo Mode.
  2. (Only when the user has pending organization ownership invitations) `OrganizationOwnershipRequests` block. Not present for the seeded student.
  3. Toolbar card (`.oc-toolbar`: 1px `#e0e5e3`, radius 16, surface `#fffefa`, padding 12, gap 10, wraps). Shown only when there are 5 or more notifications or a filter/search/sort is active. Each control lands on its own row at 390px (seen in `30-inbox.viewport.png`): row 1 search field (full width, pill, magnifier icon at left); row 2 `All / Unread {n} / Read` compact segmented control stretched to full width with three equal segments; row 3 `Filters` pill button at the left and, only while filtering, a text button `Clear filters` beside it (seen in `31`/`32`).
  4. Notification list card (`section[aria-label="Notification list"]`: 1px `#e0e5e3`, radius 16, surface, soft shadow, overflow hidden):
     - Header bar (min-height 56, padding 12×16, gap 12, bottom border): checkbox `Select all visible notifications` (tri-state), status text (12px muted) `{n} results` / `1 result`, or `{n} selected` when rows are checked; then bulk buttons when anything is checked; then right-aligned outline small button `Mark all as read` with `MailOpen` 16px icon (disabled when unread = 0).
     - Groups (`space-y-6` = 24px apart). Group heading row at phone width: padding 12/16/6, no bottom border, `h3` in sans 16px / 600 / `#232d4b` (about 17px in the capture), not uppercase (desktop uses uppercase muted caps). The count line `{unread} unread · {total} notifications` (`notification` when total is 1; 12px muted) sits beside the `Club updates` heading, or beside the first group heading when there is no `Club updates` group.
     - Rows separated by 1px `#dfe3dd` dividers.
  5. `Load older updates` outline button below the card, only when the server returned a next cursor (pages of 50).
  6. When a row is opened, the list card is replaced (at <1024px the list gets `hidden`) by the detail panel (see Behaviour).
- **Row anatomy** (flex, gap 12, padding 14 top/bottom × 12 sides, 2px left border):

  | Part | Detail |
  |---|---|
  | Left border / tint | Unread: 2px left border `#232d4b` and background `#eaece8` at 20%. Read: transparent border, no tint. Open row: `#eaece8` at 50%. |
  | Checkbox | 16px, margin-top 4, aria-label `Select {title}`. Renders as a circle outline in the capture. |
  | Line 1 | Club monogram tile 28×28, radius 6, 12px text (first two letters of the club name, e.g. `Co`, `Bl`; `OC` for OutClass; club logo image when set), then club name 12px muted. Unread only: 8px navy dot right-aligned with sr-only text `Unread`. |
  | Line 2 | Title, 14px, lh 1.375, 600 when unread / 500 when read. Wraps. |
  | Line 3 | Preview (first 160 chars of body), 12px muted, lh 1.625, clamped to 2 lines with ellipsis. |
  | Line 4 | 12px muted (semibold in the capture), gap 8, wraps: optional `Urgent` pill badge (warning: text `#795617` on `#fbf3df` with a thin warm border), type label, `·`, timestamp. On Urgent rows the timestamp wraps to a fifth line at 390px, leaving a trailing `·`; rows without the badge fit on one line. |
  | Right | Ghost icon button 44×44, `Trash2` 14px muted (destructive `#ac3544` on hover), aria-label `Delete {title}`. |

  Lines 1–4 are one `<button>` (8px vertical gaps between lines).
- **Timestamp format:** absolute, not relative: `Nov 18, 2026, 10:55 AM` (`Intl` en-US, `month: short, day, year, hour numeric, minute 2-digit`, always America/New_York). The header bell popover uses relative times; the Inbox page does not.
- **Type labels** (server `type` → label): `DECISION` → `Decision Available`; `OFFER_RESPONSE` → `Offer Confirmation`; `ANNOUNCEMENT` → `Announcement`; `INTERVIEW` → `Interview Invite`; `APPLICATION` → `Application Update`; `INVITATION` → `Club Invitation`; `TASK` → `Task`; `PLATFORM` → `OutClass Update`; `MESSAGE` → `Private Message`; anything else → `OutClass Update`. `Urgent` is shown for every `INTERVIEW` notification.
- **Grouping** (default sort `Recruiting priority`): two groups, in the order they first occur: `Recruitment & schedule updates` (urgent, i.e. all Interview Invite rows, or rows with a location change) and `Club updates` (everything else). Within the sort, urgent first, then interview/location, then the rest, newest first inside each. Sort `Club A–Z` groups by club name (heading = club name). Any other sort gives a single group `All updates`. There is no grouping by date.
- **Exact copy:**
  - Search: aria-label `Search notifications`, placeholder `Search notifications, clubs, or keywords` (matches title, preview, club, sender and body, case-insensitive; has a clear control).
  - Read status group label `Read status`: `All`, `Unread` + count (count omitted at 0), `Read`. Default `All`.
  - Bulk bar (replaces the result count text with `{n} selected`): ghost small buttons `Mark read`, `Mark unread`, `Delete` (destructive text, `Trash2` 16px). `Mark all as read` stays at the right. Bulk actions apply only to checked rows that are in the current filtered results; selection clears after Mark read / Mark unread.
  - Delete toast: `1 notification deleted` / `{n} notifications deleted` with action `Undo` (restores them).
  - Pagination: `Load older updates` → `Loading…`; error `Could not load more updates. Please try again.` (`role="alert"`, destructive text).
  - Seeded header values: `24 results`, `17 unread · 24 notifications`, segment `Unread 17`. With `Unread` selected (`31`): `17 results`, both groups remain. With `Read` selected (`32`): `7 results`, single group `Club updates`; the count line still reads `17 unread · 24 notifications` (it is the overall total, not the filtered count). Selecting Unread or Read makes `Clear filters` appear.
  - The page has no sticky elements; the header bar, toolbar and list scroll together under the floating app header, and the floating dock overlays the bottom of the list.
- **Icons:** `Settings` (header gear), `SlidersHorizontal` (Filters), `MailOpen` (Mark all as read, Mark read in detail), `Mail` (Mark unread in detail), `Trash2` (row delete 14px; bulk/detail delete 16px), `Bell` (empty state, 28px muted), `ArrowLeft`, `MapPin`, `CalendarDays` (detail).
- **Behaviour:**
  - Tapping a row does not navigate. It marks the notification read and opens the detail panel in place of the list (same page, no URL change, focus moves to the detail heading).
  - Detail panel (`.oc-detail-panel`, card as above), top block padding 20 with bottom border: ghost `Back to notifications` (`ArrowLeft`; returns focus to the row); club monogram 40×40 radius 10 + club name (14px 600) + sender line 12px muted (`Club update`, or `Private message` for messages); meta line 12px muted `{Type} · {Nov 18, 2026, 10:55 AM}`; `h2` title (section heading, sans 20px 600); action row: outline `Mark unread` / `Mark read`, ghost destructive `Delete`, and `Report announcement` for announcements the viewer did not write. Body block padding 20: body paragraphs 14px, lh 28px, pre-wrap; optional location-change box (muted fill, radius 10, padding 16: `MapPin` + new location, then `Previously: {old location}` 12px muted); then one outline call-to-action:

    | Notification | Button | Destination |
    |---|---|---|
    | Task | `View task` | its `href` (`/club/{clubId}/workspace?section=tasks&taskView=mine&taskId={id}`) |
    | Interview booking (`/interviews/book?clubId=&roundId=`) | `View interview` when the event key contains `:confirmed:`, else `Book interview` | the `href` |
    | Interviewer assignment (`interview-assignment:` key) | `Open interview room` | the `href` |
    | Decision | `View Decision` | `href` (decision page under `/applications/{id}/decision…`) |
    | Offer response | `View response` | `href` |
    | Message | `Open conversation` | `href` |
    | Application / other Interview | `View application` | `href` (usually `/applications`) |
    | Invitation | `Review invitation` | `href` |
    | Announcement, OutClass update | none (announcement `href` is `/inbox`; it is read inline) | |
    | Legacy items without `href` | `View calendar` (with `CalendarDays`), or `Continue application` / `View status` | Calendar / Applications |
  - Sorting and filters are client-side over the loaded items. `Mark all as read` marks every notification, not only the visible ones.
  - Live updates: a private Supabase Realtime broadcast channel `inbox:{userId}` (event `inbox`) signals any notification change and the list re-syncs; fallbacks are an EventSource stream `/api/communications/stream` and a 30 s poll while the tab is visible (`lib/communications-live.ts`; exact fallback order unverified).
- **States:**
  - Loading (route): `WorkspaceLoading` skeleton, label `Loading your inbox…`, feed layout, 3 rows.
  - No notifications at all: toolbar hidden; list header shows `0 results`, a heading row `CLUB UPDATES` with `0 unread · 0 notifications`, then a compact centred empty state: `Bell` icon, title `No notifications yet`, text `Nothing has been sent to you yet. Choose which updates you want by email.`, outline button `Notification settings` (link to `/inbox?tab=preferences`).
  - Filters/search hide everything (same for Unread, Read, type, club and search; there is no per-filter copy): title `No matching notifications`, text `Your keyword or filters hide every notification.`, outline button `Clear filters` (this one resets search, type, read status and club but keeps the sort; the toolbar `Clear filters` also resets the sort).
  - Load-more failure: see pagination copy above. There is no dedicated full-page error state in `InboxView`.

### 33 · Inbox filters
- **Route:** `/inbox`, `Filters` pressed
- **Screenshot:** `docs/mobile/screenshots/web/33-inbox-filters.png`
- **Source:** `components/ui/filter-popover.tsx`, `components/views/inbox-view.tsx`, `styles/filter-controls.css`
- **Layout:** At <640px the "popover" is a bottom sheet (`.oc-filter-sheet`: max-height 88dvh, top corners radius 16, padding 28 top / 16 sides / 16 + safe-area bottom, dimmed overlay, a grab handle bar at the top centre, close `X` button at top right with sr-only `Close`). In `33-inbox-filters.png` the sheet covers roughly the lower 45% of the screen. Title `Notification filters` (Libre Caslon, about 24px in the capture); sr-only description `Narrow the list. Changes apply as you choose them.` Body is a grid with 16px gaps of three fields; each field has an uppercase label (13px / 600 / muted / tracking .02em) with the control 8px below.

  | Field label | Control | Options (default first) |
  |---|---|---|
  | `TYPE` | compact segmented control, full width, group label `Notification type` | `All`, `Announcements`, `Interviews`, `Urgent` (the four segments just fit 358px; `Urgent` touches the right edge) |
  | `CLUB` | pill select (min-height 40, pill radius), aria-label `Filter by club` | `All clubs`, then every club name present in the loaded notifications, A–Z (seed: Albemarle Data Science Circle, Blue Ridge Consulting Collective, Corner Code Collective, Lawn Street Capital, OutClass, Piedmont Founders Lab, Ragged Mountain Hiking Club, Rotunda Equity Research Society, Women in Quant Finance Circle) |
  | `SORT` | pill select, aria-label `Sort notifications` | `Recruiting priority`, `Newest first`, `Oldest first`, `Unread first`, `Urgent first`, `Club A–Z` |
- **Behaviour:** changes apply immediately; there is no Apply/Reset footer. `Announcements` = type Announcement only; `Interviews` = type Interview Invite only; `Urgent` = urgent flag. Pill selects show the current value with a `ChevronDown` (`All clubs`, `Recruiting priority` in the capture). A pill select that is not on its default turns navy with cream text. The `Filters` trigger shows a navy count bubble (20px, 12px 600 cream text) with the number of active filters among type / club / sort, gets a navy border, and its accessible name becomes `Filters, {n} active`. Read status and search are not counted there.

### 34 · Notification settings
- **Route:** `/inbox?tab=preferences`. `/settings/notifications` server-redirects here, and Settings → `Notifications` links here. The Inbox gear opens the same sheet without changing the URL.
- **Screenshot:** `docs/mobile/screenshots/web/34-inbox-preferences.png` (390×844, sheet open)
- **Source:** `components/inbox/inbox-notification-settings.tsx`, `components/communications-preferences.tsx`, `components/inbox/push-notifications-toggle.tsx`, `lib/notification-settings-sheet.ts`, `lib/settings-navigation.ts`
- **Presentation:** a right-side Sheet over the Inbox; at phone width it is full width and full height (`w-full`, max-width 100vw, scrolls internally), so it reads as a full-screen view with a close `X` (sr-only `Close`) at top right. The Inbox stays mounted underneath.
- **Layout (top to bottom):**
  1. Title row (min-height 44, right padding 48 for the X): `Notification settings` (sheet title; Libre Caslon, about 22px in the capture). Sheet padding is about 21px each side; the close X is a 44px button at the top right (it shows the orange focus ring on open). While saving, `Saving…` (12px muted) appears beside it. Sr-only description: `Choose which club updates reach your email and this device.`
  2. Discard bar, only after trying to close with unsaved edits: bordered row (radius 6, padding 8×12) `Discard changes?` (14px 500) with ghost `Keep editing` and destructive `Discard`.
  3. Push section (hidden while loading, when the server has no push keys, or when no service worker is active; it is absent in `34-inbox-preferences.png`): bordered row (radius 6, padding 12×16, min-height 44) with label `Push notifications on this device` and a switch at the right; below it `Sent for the updates you get by instant email.` (12px muted). Unsupported browser instead shows only: `Push notifications need the installed app. On iPhone, add OutClass to your Home Screen first (iOS 16.4 or later).` Blocked permission: switch disabled plus `Notifications are blocked in your browser settings.` Errors: `Could not turn on push notifications.` / `Could not turn off push notifications on this device.`
  4. Intro paragraph (14px, lh 28, muted): `Choose the updates you want by email. In-app updates and security emails are always available. Daily summaries are prepared after midnight UTC.`
  5. Six checkbox rows, 16px apart; each is a full-width bordered label (1px border, radius 6, padding 12×16, min-height 44, 14px) with the checkbox at the left:
     - `Club announcements`
     - `Application updates and decisions`
     - `Interview updates`
     - `Club invitations`
     - `Tasks and deadlines`
     - `Optional OutClass news`
  6. `Frequency` label (14px) with a native select below (full sheet width at 390px, about 44px tall, radius 16, 1px grey border): `Instant`, `Daily digest`, `Off`. (`34-inbox-preferences.png` shows all six unchecked and `Off` selected.)
  7. Primary button `Save preferences` (navy pill, white 600 text, about 44px tall, left-aligned, content width) → `Saving…` while saving.
  8. Status line (14px): `Preferences saved.` / `Could not save preferences.` / `Could not load preferences.`
- **Not present:** no per-club rows, no per-channel (push vs email) matrix, no digest time picker. There is one global set of six email categories and one frequency.
- **Behaviour:**
  - Explicit save, not auto-save: edits mark the form dirty; nothing is sent until `Save preferences`. The push switch is the exception: it acts immediately (asks for browser permission inside the tap, then stores the subscription).
  - Closing (X, Escape, overlay) with unsaved edits shows the inline `Discard changes?` bar instead of closing. Closing while a save is in flight closes immediately and shows a toast `Saving notification settings…`, then `Notification settings saved.` or `Could not save notification settings.`
  - Opened from the URL, closing replaces the URL with `/inbox` (no new history entry). Opened from the gear, no history entry is created.
  - Focus is trapped in the sheet and returns to the gear on close. Reloading with unsaved edits triggers the browser's leave prompt.
  - Hidden entirely in Demo Mode.
- **States:** loading = `Loading notification settings…` skeleton (form layout, 3 rows); load error = `Could not load preferences.` with outline `Retry`.

### Notification catalogue (what a student can receive)
Titles and bodies are stored on the notification row; the Inbox shows them verbatim. Templates found in source:

| Trigger | Type label | Title | Body | Opens |
|---|---|---|---|---|
| Application status changes to Interviewing (DB trigger) | Interview Invite (Urgent) | `You have an interview invitation` | `Your application status is interviewing. Open your application for the latest details.` | `/applications` |
| Other submitted-application status change | Application Update | `Application update` | `Your application status is {status lower-case, underscores as spaces}. Open your application for the latest details.` (seed: `submitted`) | `/applications` |
| Interview booking created / moved / deleted (DB trigger) | Interview Invite (Urgent) | `Interview confirmed` / `Interview booking updated` / `Interview booking cancelled` | `Open your application to review your current interview schedule.` | `/interviews/book?clubId={id}&roundId={id}` or `/applications` |
| Round booking published | Interview Invite (Urgent) | `Book your interview` | `Interview times are open for your round. Choose one from your application.` | `/interviews/book?…` |
| Booking notice whose round/booking no longer applies (fallback at read time) | Interview Invite | `Interview update` | `Open your current application to review its interview details.` | `/applications` |
| Decision released | Decision Available | `Your decision from {Club} is available` | `Open your decision on OutClass.` | decision page |
| Offer accepted / declined | Offer Confirmation | `You’re now a member of {Club}.` / `You declined {Club}’s offer.` (straight apostrophes in source) | `Your response has been recorded.` | decision page |
| Club announcement published | Announcement | announcement title | announcement body | read inline in Inbox |
| Leader "Invite people" on a meeting | Announcement | `Meeting: {meeting title}` | `{Wed, Nov 18, 10:41 AM} · {location}` blank line `Join us for {title}.` then the `/meetings/{id}` URL | read inline |
| Task assigned / revisions requested / reviewed (DB trigger) | Task | `New task: {title}` / `Revisions requested: {title}` / `Submission reviewed: {title}` | `Open your task for instructions and feedback.` | task in club workspace |
| Club invitation pending | Club Invitation | `You have a club invitation` | `Review your invitation in organization settings. Joining is your choice.` | `/settings/organizations` |
| Voting session (members who vote) | Club Invitation | `Voting session invitation` / `Voting session updated` / `Voting session cancelled` | `{session name}. Open the session for its current details.` | `/voting/rooms/{id}?clubId={id}&view=member` |
| Availability request (members who interview) | Interview Invite | `Availability requested · {Club}` (prefix `Reminder: ` on reminders) | `Submit availability or decline participation for {round}. Your global schedule will be prefilled.` | `/settings/availability…` |
| Interview assignment / panel schedule (interviewers) | Interview Invite | `Interview assignment`, `Interview assignment changed`, `Interview assignment · {round}`, `Interview panel schedule updated`, `Interview panel schedule changed`, `Confirm interviewers` | see `utils/interview-assignment-notifications.ts`, `actions/panel-publication.ts` | interview room / `/settings/interviews` |

Seed-only rows in the staging data (no product template found for these exact strings by grep of `actions/`, `utils/`, migrations; treat as sample content): `Interview reminder` / `Your interview with {Club} is coming up. Open your application for the time and room.`; `Interview times are open` / `{Club} has opened interview booking. Choose a time that works for you.`; `Your offer is waiting` / `{Club} offered you membership. Review and respond before the offer expires.`; `Finish your application` / `Your application to {Club} is still a draft. Applications close soon.`; `Application received` / `{Club} received your application. You will hear about next steps here.`; `Due soon: {task}`; `Add your calendar feed` / `Subscribe once and your meetings, interviews and events stay in your calendar.`; `Welcome to OutClass` / `Your profile is complete. Explore clubs, save the ones you like, and apply when you are ready.`

## Calendar tab

### 35 · Calendar, Agenda (default)
- **Route:** `/calendar`. `?type=meeting` preselects the event-type filter `Club meetings` (`/clubs/meetings` redirects there). No `section` param is read by `CalendarView` (unverified whether anything else uses it).
- **Screenshot:** `docs/mobile/screenshots/web/35-calendar-agenda.png`, `35-calendar-agenda.viewport.png`
- **Source:** `app/(workspace)/calendar/page.tsx`, `components/views/calendar-view.tsx`, `components/calendar-subscribe.tsx`, `components/availability/availability-button.tsx`, `lib/calendar.ts`, `lib/student-agenda.ts` (`agendaGroups`), `lib/student-calendar-data.ts`, `styles/product-components.css`
- **Layout (top to bottom, 16px gaps):**
  1. Page header `h1` `Calendar` (no description shown).
  2. Header row (flex wrap, space-between, gap 12): `Times shown in Eastern Time.` (12px muted). Then, on the next row at 390px, left-aligned: glass pill button `Availability` (min-height 48, padding-x 20, `CalendarDays` 20px, 600 text) and glass pill button `Subscribe` (`CalendarPlus` 16px), 12px apart. A third outline button `Book or change interview` appears only when bookable interview blocks exist in local state (demo path; not shown for the seeded student).
  3. View switch: segmented control stretched to full width (54px tall, four segments), group label `Calendar view`: `Agenda`, `Month`, `Week`, `Day`. Default `Agenda` at every width. The choice is local state only: not stored, not in the URL, resets on reload/navigation.
  4. `Filters` button (phones/tablets only): a full-width pill, 44px tall, icon and label centred; navy fill with cream text while expanded. See 39.
  5. Agenda card (`.oc-content-panel`: padding 16, radius 16, 1px `#e0e5e3`, surface `#fffefa`, soft shadow), groups 24px apart. Each group: `h3` label (Libre Caslon 600, about 20px in the capture) with a bottom border and 12px padding below; then rows divided by 1px `#dfe3dd`.
  6. `Your club calendars` section (top border, padding 20 top/bottom): `h3` `Your club calendars` (card heading), then one checkbox row per club that has events (14px, 12px apart; all checked by default; 40 clubs in the seed). Unchecking hides that club's events. Empty: `Clubs appear here when they have events on your calendar.`
- **Group labels (in time order):** `Earlier` (past events, only with the toggle on), `Today`, `Tomorrow`, `Next 7 days`, `Later`. Events are sorted by start time; past events (ended before now) are dropped unless `Include past events` is on; declined events are dropped unless `Include declined` is on. An event in progress stays under `Today`.
- **Agenda row anatomy** (a full-width button; padding 12 top/bottom, 12 sides, radius 10, gap 16; hover fill `#eaf0f2`):

  | Column | Content |
  |---|---|
  | Left, fixed 64px | Time `10:41 AM` (500, tabular, about 15px in the capture; Eastern; `All day` for all-day events). Under it the date `Nov 18` (muted semibold, about 13px, margin-top 4; `month: short, day: numeric`). |
  | Middle, flexible | Type line (12px 500 muted, margin-bottom 4): the event type, plus ` · Confirmed` or ` · Declined` when it has that response, e.g. `Interest Meeting`, `Other`, `Interview · Confirmed`. Title (600, about 16px in the capture, lh 24, wraps to 2 lines). Then `{Club} · {Location}` (muted semibold, about 13px, lh 24, usually wraps to 2 lines at 390px; location omitted when empty). |
  | Right | `ChevronRight` 16px muted, top-aligned (margin-top 8). |
- **Event types and where they come from:** recruitment-audience club meetings → `Interest Meeting`; member-audience club meetings → `Other`; RSVP'd campus events → `Other`; interview bookings → `Interview` titled `{Club} interview` with response `confirmed`; interviewer panel assignments → `Interview` titled `{Club} interview panel`. `Deadline` and `Coffee Chat` exist as types (filter options, demo data) but are not produced by the live student data builder.
- **Seeded examples:** `Today` → `10:41 AM / Nov 18 / Other / General Body Meeting (happening now) / Blue Ridge Consulting Collective · Commerce Annex 120`; `Tomorrow` → `5:00 PM / Nov 19 / Interest Meeting / FWIT Open House / Fourth Wall Improv Troupe · Student Union Ballroom B`; `Next 7 days` → `3:15 PM / Nov 24 / Interview · Confirmed / Corner Code Collective interview / Corner Code Collective · Student Union 215`.
- **Icons:** `CalendarDays` (Availability button, empty state, detail dialog), `CalendarPlus` (Subscribe), `SlidersHorizontal` (Filters), `ChevronRight` (rows, next period), `ChevronLeft` (previous period), `MapPin`, `Download` (detail dialog), `Copy` (Subscribe dialog).
- **Behaviour:**
  - `Availability` navigates to `/settings/availability` (adds `?clubId=&roundId=` only if both are already in the URL). It first flushes any autosaving editors.
  - Tapping a row opens the event detail dialog (41) and sets the calendar's current date to that event's date.
  - All times are displayed in Eastern Time (America/New_York) regardless of device zone; "today" is the Eastern date, anchored to server time.
  - With no events at all, the view switch, Filters button and toolbar are not rendered; only the empty agenda card and `Your club calendars` show.
- **States:**
  - Nothing upcoming (no filters): empty state, left-aligned, compact, `CalendarDays` icon: title `Nothing coming up`, text `You have no interviews or RSVP’d events coming up.`, outline small button `Browse events` (goes to Events / corkboard).
  - Filters hide everything: title `No events match these filters`, text `Your search, type filter or hidden club calendars leave nothing to show.`, outline small button `Clear filters` (clears search, type and hidden clubs; does not reset the two toggles).

### 36 · Calendar, Month
- **Route:** `/calendar`, `Month` selected
- **Screenshot:** `docs/mobile/screenshots/web/36-calendar-month.png`
- **Layout:**
  1. Period row (flex wrap, gap 12) under the view switch: outline icon button (40×40) aria-label `Previous period` (`ChevronLeft`); `h2` month title `November 2026` (`month: long, year: numeric`; section heading 20px 600); outline icon button `Next period` (`ChevronRight`); ghost button `Today`; date field labelled `Go to date` (placeholder `Choose a date`, its clear action is labelled `Today`). At 390px the first four fit on one row and the date field wraps to its own row as a navy pill showing the current date, e.g. `Wed, Nov 18, 2026`, with a calendar icon.
  2. `Filters` button.
  3. Month grid inside a card (`.oc-data-surface`: radius 16, 1px edge, `#fffefa`, horizontal scroll). The grid has a fixed minimum width of 650px, so at 390px it scrolls sideways (`36-calendar-month.png` shows only Sun–Wed; Thu–Sat are off-screen); it is not reflowed into dots.
     - Weekday header row on muted `#edeee9`: `Sun Mon Tue Wed Thu Fri Sat` (12px muted, centred, padding 12).
     - 7 columns × 4–6 week rows. Each cell: min-height 128, padding 8, right and bottom 1px borders; days outside the month have muted fill and muted text.
     - Cell content: day number in a 28px circle (12px; today = navy `#232d4b` fill with white text), aria-label `Show events on {YYYY-MM-DD}`; up to 3 event chips (block buttons, radius 4, padding 6, fill `#eaece8` for Interview/Deadline or `#eaece8` at 60% for Other / Interest Meeting / Coffee Chat, navy text; first line time in 600, e.g. `5:00 PM` or `All day`, then title clamped to 2 lines; declined events at 50% opacity; `title` tooltip `{time} · {title}`); then a link-style `+{n} more` (12px) when a day has more than 3 (seed: `+1 more` on Nov 24). Chip titles truncate hard at this width (`Blue Ridge…`, `Workshop Night…`).
  4. `Your club calendars`, then `Up next` (see 37).
- **Behaviour:** tapping a day number or `+n more` switches to Day view for that date. Tapping an event chip opens the detail dialog. Previous/Next move one month. There is no selected-day list under the grid and no dot indicators.

### 37 · Calendar, Week
- **Route:** `/calendar`, `Week` selected
- **Screenshot:** `docs/mobile/screenshots/web/37-calendar-week.png`
- **Layout:** same period row as Month (title is still `November 2026`; Previous/Next move 7 days). The week is a vertical list, not an hour grid: one card (`.oc-data-surface`) with 7 day sections, Sunday to Saturday, separated by dividers, each padding 16×20:
  - `h3` (card heading): `Wednesday, Nov 18` (`weekday: long, month: short, day: numeric`), with ` · Today` appended for today.
  - Event buttons 8px apart (radius 10, padding 12, 14px, fill by type as in Month, wraps): time `10:41 AM` or `All day` (fixed 96px, 500); then bold title with `{Club} · {Location}` (12px) under it; then a trailing 12px label = the response (`confirmed`, `going`, `declined`, lower-case) or else the type (`Interest Meeting`, `Other`…). In `38-calendar-day.png` the three parts sit on one row: time left, title block centre (wrapping to 4 lines), type label right. Seeded week (Nov 15–21): `Sunday, Nov 15` two events, `Monday, Nov 16` and `Tuesday, Nov 17` `Nothing scheduled.`, `Wednesday, Nov 18 · Today` one event.
  - Empty day: `Nothing scheduled.` (14px muted), or `No events on this day match your filters.` when filtering.
- Below: `Your club calendars`, then `Up next` section (top border): `h3` `Up next`, up to 6 upcoming non-declined events as bordered cards (radius 16, padding 12): line 1 `Nov 19 · 5:00 PM` (12px muted), line 2 title (14px 500). Seed: `Nov 18 · 10:41 AM` / `General Body Meeting (happening now)` first. Empty: `Nothing upcoming on your calendar.` + `Browse events`, or `No upcoming events match your filters.` + `Clear filters`.
- There is no hour range or time grid in any view; the "8 AM–9 PM" boundary belongs to the availability editor, not this page.

### 38 · Calendar, Day
- **Route:** `/calendar`, `Day` selected
- **Screenshot:** `docs/mobile/screenshots/web/38-calendar-day.png`
- **Layout:** as Week but one day section. Period title is the full date `November 18, 2026`; Previous/Next move one day. On an empty day the section also shows the empty action button (`Browse events`, or `Clear filters` when filtering).

### 39 · Calendar filters
- **Route:** `/calendar`, `Filters` pressed
- **Screenshot:** `docs/mobile/screenshots/web/39-calendar-filters.png`
- **Layout:** not a sheet. The `Filters` button (`aria-controls="calendar-tools"`, `aria-expanded`) reveals an inline toolbar card directly below it (`.oc-toolbar`, padding 12, gap 10), pushing the agenda down; each control is on its own row, left-aligned (`39-calendar-filters.png`):
  1. Search field: aria-label `Search calendar`, placeholder `Search events, clubs, or locations` (matches title, club, location).
  2. Pill select, aria-label `Filter event type`: `All event types` (default), `Club meetings`, `Other`, `Deadline`, `Interview`, `Interest Meeting`, `Coffee Chat`. `Club meetings` = any club meeting regardless of audience.
  3. Agenda view only: pill switches `Include past events` and `Include declined` (pill, min-height 46, label 14px 500 navy at left, switch at right; both off by default).
- **Behaviour:** applies immediately. The button's count bubble = number active among search, type, include past, include declined (accessible name `Filters, {n} active`). Club filtering is not here: it is the `Your club calendars` checkbox list at the bottom of the page. There is no "saved" filter.

### 40 · Calendar subscribe
- **Route:** `/calendar`, `Subscribe` pressed
- **Screenshot:** `docs/mobile/screenshots/web/40-calendar-subscribe.png`
- **Source:** `components/calendar-subscribe.tsx`, `lib/calendar-feed.ts`
- **Presentation:** a centred modal card (full width at 390px, radius about 22, padding about 21, dimmed overlay, close X at top right), not a popover. Title in Libre Caslon about 22px wrapping to two lines; description 15px muted; full-width navy pill button. Only the initial state (`Create my calendar link`) is captured; the link was not created. Hidden in Demo Mode.
- **Exact copy and states:**
  - Title `Add OutClass to your calendar`
  - Description `Your meetings, interviews and RSVPs show up in Google, Apple or Outlook calendar and stay up to date.`
  - Before a link is made: primary full-width button `Create my calendar link`. If a feed is already active: note `Your calendar is subscribed. A new link replaces the current one, which then stops updating.`, primary `Create a new link`, and ghost full-width `Turn off calendar link` (then status `Calendar link turned off.`).
  - After creating: primary full-width `Add to Google Calendar` (opens `https://calendar.google.com/calendar/r?cid={webcal url}` in a new tab); outline full-width `Open in Apple or Outlook calendar` (the `webcal://…/api/calendar-feed/{token}` link); a read-only input (aria-label `Private calendar link`, the `https://…/api/calendar-feed/{token}` URL, selects itself on focus) with an outline icon button aria-label `Copy link` (`Copy`); note `Keep this link private: anyone with it can see your OutClass schedule. This is the only time it’s shown.` (12px muted).
  - Status messages: `Link copied.` / `Select the link and copy it.` / error `Couldn’t update your calendar link. Try again.`
- **Behaviour:** opening the dialog checks whether a feed is active. The link is shown once only; reopening the dialog returns to the create state.

### 41 · Calendar event detail (and 41b interview detail)
- **Route:** `/calendar` with an event tapped (no URL change)
- **Screenshot:** `docs/mobile/screenshots/web/41-calendar-event-detail.png`, `41b-calendar-interview-detail.png`
- **Presentation:** centred modal card, 16px side margins (358px wide), radius about 22, padding about 21, cream surface, dimmed overlay, max-height 85vh with internal scroll, close X at top right. Title in Libre Caslon about 24px (wraps to two lines for the interview); buttons are glass pills about 44px tall with 600 text. Seeded `41`: `FWIT Open House` / `Fourth Wall Improv Troupe · Interest Meeting` / `Thursday, November 19, 2026 · 5:00 PM` / `Student Union Ballroom B` / `Drop in, grab a snack and meet the group. No sign-up needed, but an RSVP helps us plan.` / buttons `Open agenda and recap`, `Export event`, `Open map`. Seeded `41b`: `Tuesday, November 24, 2026 · 3:15 PM` / `Student Union 215` / `Application status: Interviewing` / buttons `View application`, `Export event`, `Open map`.
- **Layout (top to bottom):**
  1. Title = event title. Description line `{Club} · {Type}` (e.g. `Fourth Wall Improv Troupe · Interest Meeting`, `Corner Code Collective · Interview`).
  2. Date line (14px, `CalendarDays` 16px): `Thursday, November 19, 2026 · 5:00 PM` (`weekday long, month long, day, year` then ` · ` and the Eastern start time, or `All day`). No end time is shown.
  3. Location line (14px, `MapPin` 16px): the location, else `Location not announced` (`Online application` for deadlines).
  4. If the student has an application with that club: `Application status: {status}` (12px muted).
  5. Body text (14px, lh 24, muted): the event description, else for live (read-only) events `Review your scheduled event details below.` (other fallbacks: `Open your application to review your progress and next steps before this deadline.` / `Review this club event and manage your attendance below.`).
  6. Live events are read-only, so this line always follows: `Contact the club if you need to change these arrangements.` (14px muted).
  7. Response status (14px 500), when set: `Interview confirmed` (interviews), `You're going`, or `Attendance cancelled`.
  8. Button row (wraps, gap 8), in this order, each shown only when it applies:

     | Button | Style | When / action |
     |---|---|---|
     | `Open agenda and recap` | outline link | club meetings; goes to `/meetings/{meetingId}` |
     | `View application` | outline | student has an application with the club; opens Applications focused on it |
     | `View notification` | outline | a notification is linked to the event; opens Inbox on it |
     | `Export event` | outline, `Download` 16px | always; downloads `outclass-event.ics` |
     | `Open map` | outline link, new tab | has a location; `https://www.google.com/maps/search/?api=1&query={location}` |
     | `Join online` | outline link, new tab | event has an `https://` meeting URL |
- **RSVP:** for the live student data every calendar event is read-only, so there are no RSVP buttons here. The non-read-only path (demo/local events) adds primary `RSVP · Going` (or `Confirm interview`), outline `Cancel attendance`, and for self-booked slots outline `Cancel booking` and primary `Change interview time`, which opens a second dialog `Book an interview` / `Available times from the club's interview scheduler. Booking another slot replaces your previous reservation.` / `No future interview slots have been published.`
- **Interview item (41b):** title `{Club} interview`, description `{Club} · Interview`, date/time and room location, `Review your scheduled event details below.`, `Contact the club if you need to change these arrangements.`, status `Interview confirmed`, buttons `View application`, `View notification` (if linked), `Export event`, `Open map`.

### 42 · Club meetings list
- **Route:** `/meetings` (all clubs the student can see); `/meetings?clubId={id}` limits to one club. `/clubs/meetings` redirects to `/calendar?type=meeting`, so this list is not reached from the student tab bar.
- **Screenshot:** `docs/mobile/screenshots/web/42-meetings.png` (capped at 5400px), `42b-meetings-detail-sheet.png` (card tapped)
- **Source:** `app/(workspace)/meetings/page.tsx`, `components/meeting-workspace.tsx` (`MeetingList`), `lib/meeting-presentation.ts`
- **Layout (top to bottom, 16px gaps):**
  1. Title row (flex wrap, space-between): `h2` `Club meetings` (sans 20px 600; there is no `h1` on this page) and an underlined 14px link `All available meetings` → `/meetings`.
  2. Filter row (`role="toolbar"`, aria-label `Meeting filters`, bottom border, padding-bottom 16, gap 12): pill switch `Show past` (off = upcoming) and a compact pill select with prefix, reading `Audience: All` (aria-label `Audience`). Options: `All`, `Recruitment / Interest`, `Members`.
  3. List (`ul`, 8px gaps) of meeting cards.
- **Card anatomy** (a full-width button; `.oc-content-panel`: padding 16, radius 16, 1px `#e0e5e3`, `#fffefa`, soft shadow; gap 12; border turns navy on hover):

  | Part | Detail |
  |---|---|
  | Left | `CalendarDays` 20px navy, top-aligned |
  | Line 1 | 12px muted: `{Club} · Members` or `{Club} · Recruitment / Interest` (club name omitted when `clubId` is set), plus ` · Recap available` when the meeting has a recap |
  | Line 2 | Title, Libre Caslon 17px 600, margin-top 4, wraps |
  | Line 3 | 14px navy: `Wed, Nov 18, 10:41 AM – Wed, Nov 18, 12:56 PM` (start, then ` – ` and the end when there is one; each side `weekday short, month short, day, hour, minute`, in the device's local time zone and locale) |
  | Line 4 | `MapPin` 14px + location, 14px muted (wraps under line 3 at 390px) |
  | Hidden text | sr-only `Open agenda, resources and attendance` (in the text dump; not visible) |
  | Right | `ArrowRight` 16px, top-aligned |
- **Behaviour:**
  - Upcoming list is sorted soonest first; a meeting stays "upcoming" until its end time. `Show past` switches to past meetings, newest first.
  - Tapping a card does not navigate: it opens a right-side sheet (full width on phones; sr-only title `Meeting details`, description `Agenda, resources, and attendance.`) containing the same meeting detail as screen 43, without the `All meetings` link.
  - Members with attendance permission also get a line under each card: `Attendance not loaded` + ghost `Check attendance`; then `Loading attendance…`; then `{n} recorded check-in(s)` (with ` · updating live` while the meeting is live, polled every 20 s, or ` · Couldn’t update`); failure `Attendance unavailable.` + `Try again`. Plain students do not see this.
  - Leaders with `meetings.manage` and a `clubId` also get `Find a meeting time` and `New meeting` buttons.
- **States:** loading skeleton `Loading meetings…` (schedule layout, 3 rows); error `Could not load meetings. Please sign in and try again.` with outline `Retry`; empty: title `No upcoming meetings for this audience` / `No past meetings for this audience`, text `Nothing is scheduled for this audience yet.` / `No meetings for this audience have happened yet.`
- **Seeded first row:** while the live meeting is running, `Blue Ridge Consulting Collective · Members` / `General Body Meeting (happening now)` / `Wed, Nov 18, 10:41 AM – Wed, Nov 18, 12:56 PM` / `Commerce Annex 120` (earlier dump). `42-meetings.png` was taken after it ended, so its first row is `Fourth Wall Improv Troupe · Recruitment / Interest` / `FWIT Open House` / `Thu, Nov 19, 5:00 PM – Thu, Nov 19, 6:30 PM` / `Student Union Ballroom B`.
- **Detail sheet (`42b-meetings-detail-sheet.png`):** full-screen sheet, close X top right, about 21px padding: `Fourth Wall Improv Troupe · Recruitment / Interest` (muted) / title `FWIT Open House` (Libre Caslon about 26px) / `Thu, Nov 19, 5:00 PM – Thu, Nov 19, 6:30 PM · Student Union Ballroom B` (600, wraps) / description / `Agenda` `No agenda has been added yet.` / `Recap` `No recap has been added yet.` / `Resources` `No resources added yet.`
- The floating dock highlights `Calendar` on `/meetings` and `/meetings/{id}`.

### 43 · Meeting detail, live meeting, as a member
- **Route:** `/meetings/{id}`
- **Screenshot:** `docs/mobile/screenshots/web/43-meeting-detail-live.png`
- **Source:** `app/(workspace)/meetings/[id]/page.tsx`, `components/meeting-workspace.tsx` (`MeetingDetail`), `components/qr/meeting-check-in.tsx`, `app/(focus)/check-in/page.tsx`, `actions/meetings.ts`
- **Layout (top to bottom):**
  1. Header block (bottom border, padding-bottom 20, 12px gaps):
     - Eyebrow line (14px muted): `{Club} · Member meeting` or `{Club} · Recruitment / Interest`.
     - Page header: `h1` = meeting title (Libre Caslon 26px 500, two lines for the seeded title); at 390px the action wraps onto its own row below the title, left-aligned: underlined link `All meetings` → `/meetings`.
     - Time and place (14px 500): `Wed, Nov 18, 10:41 AM – Wed, Nov 18, 12:56 PM · Commerce Annex 120`.
     - Description, when present (14px, lh 24, pre-wrap). Seed: `Staging meeting kept current by the seed so QR check-in can be issued.`
     - Two hairlines about 24px apart separate the header from `Agenda` (the header's bottom border and the section's top border).
  2. `Agenda` section (top border, padding-top 16): `h2` `Agenda` (sans 20px 600) and the agenda text (14px, lh 28, pre-wrap) or `No agenda has been added yet.` Seed agenda (four lines): `1. Welcome` / `2. Client project updates` / `3. Recruitment: final deliberation tonight` / `4. Announcements`.
  3. `Recap` section, same pattern: `No recap has been added yet.`
  4. `Resources` section: `h2` `Resources`; each resource is an underlined 14px link row (min-height 44) `{label} · {link|file|slides}` opening in a new tab (sr-only ` (opens in a new tab)`); or `No resources added yet.` (14px muted).
- **What a plain member does not get:** there are no RSVP controls, no live/"happening now" badge, no countdown, and no attendance or check-in status on this page. The `Attendance` section renders only for members with the `meetings.attendance` permission (leaders, see 66). The only "live" signal in the seed is the literal title text `General Body Meeting (happening now)`.
- **States:** loading `Loading meeting…` (form skeleton, 3 rows); error: the server message or `Meeting unavailable.` in destructive text with outline small `Retry`.
- **Member check-in flow (`/check-in`, focus layout, reached by scanning the leader's QR with the phone camera):** the QR encodes a rotating first-party short link (`{origin}{/q/...}`) that resolves to `/check-in?meetingId={id}#token={64 hex}`; the page reads the token from the URL fragment and then removes the fragment from the address bar. There is no in-app scanner and no manual code entry field on the web.
  1. `h1` `Meeting check-in`.
  2. One of:

     | Condition | What shows |
     |---|---|
     | Checking session | skeleton `Checking your session…` |
     | Signed out | `This records your attendance at a club meeting. Sign in with your UVA account, then scan the current code again. Codes expire quickly to protect attendance.` + primary `Sign in` → `/login?next=/check-in?meetingId={id}` (the token is not carried through sign-in) |
     | Alumni account | `Alumni accounts can’t check in to meetings. Your past attendance stays in your history.` |
     | No meeting id or token in the link | `This link does not contain a current meeting code. Scan the QR displayed by the meeting leader. Static attendance links are no longer accepted.` |
     | Ready | meeting title as a paragraph (or `Confirm your attendance at this meeting.` until it loads) + primary `Check in` (disabled until the title loads) → `Checking in…` |
     | Success | `h2` `You’re checked in`, then the meeting title, then `Recorded {date, time in device locale}. Your original attendance timestamp is preserved.` (14px muted) |
     | Already checked in | `h2` `You’re already checked in`, same two lines (original time) |
  3. Error line (`role="alert"`), server messages:
     - Expired or closed code: `This code has expired or was closed. Scan the current QR code at the meeting.`
     - Not a member / meeting not visible to this account / unknown meeting (deliberately the same): `Meeting unavailable. Scan the current QR code at the meeting.`
     - Malformed token: `Invalid check-in code. Scan the current QR code at the meeting.`
     - Issuer lost permission: `This check-in session is no longer available. Ask a meeting manager to reopen it.`
     - Meeting title could not be loaded: `Meeting unavailable or access denied. Check the link or ask the club for a new one.`
     - Generic: `Check-in failed. Please try again.`
  4. Underlined 14px link (min-height 44) `Meeting agenda and resources` → `/meetings/{id}` (or `/meetings`).
  - Check-in is identity-bound: it requires a signed-in account that may read the meeting, and a token that is unexpired (90 s lifetime) and issued by someone who still has attendance permission.

### 66 · Meeting detail as club leader: attendance QR host
- **Route:** `/meetings/{id}` signed in as a member with `meetings.attendance` (and `meetings.manage` for the edit/invite actions); the same content also appears in the sheet opened from a meeting card.
- **Screenshot:** `docs/mobile/screenshots/web/66-leader-meeting-host.png` + `.viewport.png` (check-in closed), `66b-leader-check-in-qr-open.png` + `.viewport.png` (QR card open), `66c-leader-check-in-presenter.png` (Present dialog). `66a-leader-first-run-guide*.viewport.png` are the leader tutorial, not part of this screen.
- **Source:** `components/meeting-workspace.tsx` (`MeetingDetail`, `MeetingAttendance`), `components/meeting-group-invitation.tsx`, `components/qr/outclass-qr-code.tsx`, `components/qr/qr-presenter-dialog.tsx`, `components/qr/qr-code-card.tsx`, `lib/qr/constants.ts`, `lib/qr/renderer.ts`, `lib/meetings.ts`
- **Shell:** the leader's header shows a `Personal` / `BRCC` workspace switch at the top left in place of the logo, and avatar `LS`.
- **Additions to screen 43 for a leader:**
  1. Action row under the title: `All meetings` link plus glass pill button `Edit meeting` (opens the editor workflow titled `Edit meeting` / `Update the meeting details, agenda, recap, or shared resources.` with tabs `Details`, `Description & agenda`, `Resources`, buttons `Cancel` / `Save changes`).
  2. Under the header, between hairlines: glass pill button `Invite people` (sheet titled `Invite people` / `Choose a group and send a meeting announcement.`; `Preview recipients`; note `Sends a club announcement with the meeting details and link. Each person’s notification preferences apply.`; `Send meeting announcement · {count}`).
  3. After Resources, the `Attendance` section (top border, padding-top 20, 16px gaps):
     - `h2` `Attendance`.
     - `Attendees must sign in. Closing revokes all current codes.` (14px muted). In Demo Mode also `Demo check-in works in this browser only.`
     - Outline button `Open attendance QR`; while open it reads `Close check-in`.
     - While open with a valid code: the QR card, then the status line `Current code expires in {n} seconds. Codes refresh every minute.` (14px muted; the `{n} seconds` part is 600 navy and counts down each second; `84 seconds` in `66b`).
     - While open without a valid code: `Waiting for a current code…`
     - Error line (`role="alert"`): `Could not refresh QR code.` (or the server message), `Could not close check-in. Existing codes will expire within 90 seconds.`, `Could not load attendance.`
     - History header row (flex, gap 16): `h3` `Attendance history · {count}` (Libre Caslon 17px; the count is omitted while loading or on error), ghost button `Refresh`, link `Export CSV` (not rendered for the seeded leader in `66`/`66b`; only `Refresh` shows). Seed: `Attendance history · 9`.
     - List (dividers): per check-in, name (14px 500), email when available, and the check-in time (muted; device locale date and time with seconds, e.g. `11/18/2026, 10:43:45 AM`). Seed first row: `Avery Dunmore` / `avery.dunmore.040@staging.test`.
     - `Loading attendance…` while loading; `No check-ins yet.` (14px muted) when empty.
- **QR card at phone width** (`OutClassQRCode`, `variant="default"`, `size={220}`): white card, radius 16, 1px border, padding 24, stacked vertically below 640px with 24px gaps:
  1. QR tile 220×220: radius 16, 1px border, white, padding 12. Modules navy `#142d4e` on white `#ffffff`, error correction level H (30% recovery), 4-module quiet zone, centred OutClass "OC" interlocking monogram in an Apple-style squircle badge (corner radius ratio 37/180), logo kept under about 5% of the modules. While generating: `Preparing QR code…`
  2. Title = meeting title (Libre Caslon 18px 700).
  3. `Scan with your phone camera to check in.` (14px muted).
  4. The check-in link as a single-line truncated underlined link (14px 500, dark blue), opening in a new tab. Capture: `http://localhost:3000/q/bYKtNP` (short link `/q/{6-char code}`).
  5. Action row (wraps to two rows of two at 390px: PNG + SVG, then Copy link + Present; gap 8; small pill buttons, height 36, 14px icons): `Download PNG` (`Download`; exports 2048px PNG), `Download SVG` (`Download`), `Copy link` (`Copy`; becomes `Copied` with a green `Check` for 2 s), `Present` (`Maximize2`).
  6. Status text (12px muted): `Link copied to clipboard.` / `Could not copy link automatically. Please copy the URL below.` / `Download failed. Please retry.`
  - Export filename: `check-in-{meeting title lower-cased, non-alphanumerics → hyphens}`. QR accessible label: `Check in to {meeting title}`.
- **Rotation and expiry:** opening issues a token immediately and re-issues every 60 s; each token is valid for 90 s (so consecutive codes overlap by 30 s). The encoded link is the rotating first-party short link when available, else `{origin}/check-in?meetingId={id}#token={token}`. `Close check-in` deletes all tokens and closes the short links server-side.
- **Presenter dialog** (`Present`): near-full-screen white dialog (viewport minus 8px margins, padding 16, centred column, 16px gaps, scrolls if needed, close X; stays mounted while check-in is open so it survives a failed refresh):
  1. Title = meeting title (Libre Caslon 24px 700).
  2. `Scan with your phone camera to check in.` (16px muted; default line elsewhere is `Scan with your phone camera.`).
  3. QR only, sized to the viewport: `min(width − 48, height − 280)` clamped to 240–1200px (342px on a 390×844 phone, as in `66c`: white rounded tile with rounded-dot modules, ring-style finder corners and a navy rounded-square monogram badge in the centre).
  4. The link without scheme or trailing slash (`localhost:3000/q/bYKtNP` in the capture), 18px 600 (source asks for monospace; the capture renders it in the sans face), breaks anywhere.
  5. Buttons (pill outline, height 40, white, 16px icons, centred, two rows of two at 390px): `Copy link` / `Copied`, `Download PNG`, `Download SVG`, and, only where the Fullscreen API exists (not iPhone Safari), `Full screen` (`Maximize2`) / `Exit full screen` (`Minimize2`).
  6. Live status line (14px muted): `Link copied.` / `Could not copy automatically. Copy the link shown above.` / `Full screen is not available in this browser.` / `Download failed. Please retry.`
  - While the code is being replaced or has expired: the QR area becomes a same-size bordered box with `Refreshing code…` (18px 500), and on failure the error text plus outline `Try again`.
- **Icons:** `Download`, `Copy`, `Check`, `Maximize2`, `Minimize2`; `CalendarClock` and `Plus` on the list-level leader buttons.

## Profile tab

Evidence note for the Profile and Settings sections: verified against the captures `44-profile.png` (+ `.viewport.png`), `45-profile-edit.png`, `47-settings.png`, `48-settings-account-and-delete.png`, `49-settings-availability.png`, `50-settings-interests.png`, `51-settings-interviews-empty.png` and text dumps of the rendered pages. There is no `46` capture. Only the first section of the Edit profile dialog (`Name & photo`) was captured; the other four dialog sections, the crop block, the import dialog, the Preview menu, the delete confirm dialog and all error/pending states are from source only.

Shared tokens used below (light theme, `styles/tokens.css`, `styles/navigation-glass.css`):

| Token | Value |
|---|---|
| Canvas `--background` | `#f6f5f1` |
| Text / `--primary` / `--foreground` | `#232d4b` (UVA Blue) |
| `--muted-foreground` | `#52606d` |
| `--card` | `#fffefa` |
| `--secondary` | `#eaece8`; `--muted` `#edeee9`; `--accent` `#e7ebe7` |
| `--border` | `#dfe3dd`; `--input` (field border) `#8793a0` |
| `--destructive` | `#ac3544` |
| Focus ring | `#c86400`, 2px, offset 2px |
| Cream on navy `--oc-glass-cream` | `#fff7ec` |
| Light pill `--oc-glass-light-solid` | `#faf8f3` |
| Panel (`Panel` / `.oc-content-panel` / `.oc-glass-surface`) | padding `clamp(1rem,1.55vw,1.5rem)` = 16px at 390; radius 16px; 1px edge navy at 10%; fill near-white glass (`rgb(255 253 248 / 90%)` with a white top gradient; solid fallback `#fffefa`); soft shadow `0 14px 30px -20px rgb(12 29 47 / 24%)` |
| Stack gap `--oc-content-gap` | 16px at 390 |
| Body | Source Sans 3, 15px / 1.6, 400 |
| Page `h1` (`PageHeader`) | Libre Caslon Text, 26px at 390 (`clamp(1.625rem,2.2vw,1.875rem)`), weight 500, line-height 1.14, tracking −.03em |
| `oc-section-heading` | Source Sans, 20px at 390, weight 600, lh 1.14 |
| `oc-card-heading` | Libre Caslon, 17px, weight 600 |
| Dialog title (`oc-modal-title`) | 22px, weight 600; renders in Libre Caslon in the capture |
| Buttons | pill (radius 999px), 14px, weight 650; every size is min-height 44px at ≤767px. `default` = navy `#232d4b` with faint blue sheen, cream text `#fff7ec`; `outline` = light `#faf8f3`, navy text, white edge + soft shadow; `ghost` = transparent, inherits colour; `destructive` = `#ac3544` fill; disabled = 50% opacity |
| Inputs | height 44px and font 16px at ≤767px; native selects (`.oc-native-select`) 1px `#8793a0` border, radius 16px, `#fffefa` fill, min-height 44px, 16px text |
| Dialog | centered card (not a bottom sheet), `#fffefa`, radius 24px, padding 24px, 1px `#dfe3dd` border, overlay `rgb(12 25 43 / 42%)`, zoom-in 95% → 100% (reduced motion: none), close `X` 44×44 at top-right 12px with sr text `Close` |

### 44 · Profile
- **Route:** `/profile` (`/settings/profile` redirects here, keeping query params). Dock tab "Profile" is active.
- **Screenshot:** `docs/mobile/screenshots/web/44-profile.png`, `44-profile.viewport.png`
- **Source:** `app/(workspace)/profile/page.tsx`, `components/views/unified-student-profile-view.tsx`, `components/alumni-details-panel.tsx`, `lib/student-profile.ts`, `lib/phone.ts`, `lib/scholar-status.ts`, `styles/product-components.css` (phone rules at `max-width: 1023px`)
- **Layout (top to bottom):**
  1. Shell page title `Profile` (h1, Libre Caslon 26px, navy), 16px side gutter.
  2. **Identity card** (`header.oc-profile-identity`). At ≤1023px it is a navy card: fill `#232d4b`, 1px edge `rgb(191 216 238 / 25%)`, radius 16px, padding 18px, margin-bottom 16px, text cream `#fff7ec`. Row with 20px gap:
     - Left: avatar 64×64. As rendered: a rounded-square frame (radius 16px) drawn as a 2px cream ring at 60%, with a cream `#fff7ec` circle inside it. Photo if set; otherwise initials (first letter of first + last name; seeded `SS`) in Libre Caslon 20px weight 500, navy on the cream circle.
     - Right column: name `{firstName} {lastName}` (h2, Libre Caslon 24px, weight 400, lh 1.15, wraps); 12px below, one line `{major} · Class of {gradYear}` (14px, cream at 75%; the middot has 8px padding each side); 16px below, a wrapping row (gap 12px) with two 44px-high pill buttons: `Edit profile` (leading `Pencil` 14px) and `Preview` (leading `Eye` 16px, trailing `ChevronDown` 14px).
     - As captured (`44-profile.png`): `Edit profile` is a navy pill with a lighter edge and cream text; `Preview` is a light pill at 50% opacity (reads grey on the navy card) because it is disabled for the seeded student. Both sit on one row at 390px.
  3. **Education** panel (`section` aria-label `Education`): heading `Education` (Libre Caslon 17px/600, 12px below it), then:
     - Row: `University of Virginia` (h4, 14px, weight 500) left; `Class of {gradYear}` right (14px muted, tabular numerals); wraps if needed.
     - `{major}` (14px muted, 8px above).
     - Optional lines, each 14px with 8px above: `High school: {highSchool}`; `Gender: {gender} · Pronouns: {pronouns}` (either part alone if only one is set); `Transfer student`.
     - `Scholar status: ` (muted) + program names, or muted `Not provided`. (Always shown.) In the capture the major and the scholar line are muted grey; `Pronouns: They/Them` is navy.
     - If any of GPA / ACT / SAT is set: a wrapping row 16px below, 24px gap, 14px: `GPA` (muted) `{gpa} / 4.00`; `ACT` (muted) over `{actScore}` (stacked, unlike the other two); `SAT` (muted) `{satScore}`.
  4. **Phone** panel: heading `Phone`; helper (14px muted, lh 1.625, 16px below); then the number (14px, tabular) or the muted empty line.
  5. **After graduation** panel: only for alumni or confirmed-graduating students (not rendered for the seeded student). See States.
  6. **Profile details** panel (`aside`; below the sections at phone width; hidden once all four items are complete): heading `Profile details` (Libre Caslon 17px); 8px below, 12px muted sentence; progress bar 4px high, full radius, track `#eaece8`, fill `#232d4b`, 16px above and below, width = completed/total; list with 10px gaps, each item 12px muted: 16px circle + label. Complete = circle filled `#eaece8` with navy `Check` 14px; incomplete = empty circle with 1px `#dfe3dd` border. Seeded: bar half filled, Name and Education checked.
  7. Dock (Profile tab active). Whole page is about 1020px tall for the seeded student.
- **Exact copy:**

| Element | Copy (seeded example) |
|---|---|
| Page title | `Profile` |
| Name | `Sam Staging-Student` |
| Subline | `{major}·Class of {gradYear}` → `Commerce · Class of 2029` |
| Buttons | `Edit profile`; `Preview` (aria-label `Preview links and résumé`; group aria-label `Links and résumé`) |
| Education rows | `University of Virginia` / `Class of 2029` / `Commerce` / `Pronouns: They/Them` / `Scholar status: Not provided` |
| Scholar value when set | program labels joined with `, ` (labels listed under screen 45; an "Other" entry shows the typed scholarship name); answered "No" shows `Not a scholar`; unanswered shows muted `Not provided` |
| GPA | `GPA` `3.7 / 4.00` (template `{gpa} / 4.00`; an out-of-range stored value shows `{gpa} · Confirm a GPA out of 4.0 in Education`) |
| Scores | `ACT` `{n}`; `SAT` `{n}` |
| Phone heading / helper | `Phone` / `Clubs call applicants they accept. Only a club that accepts you sees your number.` |
| Phone value | `(434) 555-0001` (US/Canada formatted `(AAA) EEE-NNNN`; other countries shown as stored `+…`) |
| Phone empty | `Not added. Required before you submit an application.` |
| Checklist heading | `Profile details` |
| Checklist sentence | `{completed} of {total} profile details added. These are suggestions, not application requirements.` → `2 of 4 profile details added. …` |
| Checklist items | `Name`, `Education`, `Résumé`, `LinkedIn`; screen-reader suffix ` added` / ` not yet added` (seeded: Name added, Education added, Résumé not yet added, LinkedIn not yet added) |
| Progress bar aria-label | `Profile details added` |
| Live region after a save | `Profile changes saved.` (sr-only) |

  Checklist rules: Name = first and last name non-empty; Education = major non-empty and a graduation year; Résumé = a resolvable résumé reference; LinkedIn = a safe LinkedIn URL.
- **Icons:** `Pencil` (size 14) in Edit profile; `Eye` (16) and `ChevronDown` (14) in Preview; `Check` (14) in completed checklist circles.
- **Behaviour:**
  - No experiences, activities or skills section is rendered on the page. Experiences exist only inside the Edit profile dialog ("Experience" section). There is no résumé row or LinkedIn row on the page either; those are reached through Preview and edited in the dialog.
  - `Edit profile` opens the dialog (screen 45). `Preview` opens a small dropdown menu (screen 46) and is disabled when the profile has neither a valid LinkedIn URL nor a résumé.
  - Data loads client-side after sign-in (`getStudentProfile`); saving in the dialog updates the page in place without reload.
  - No links on the page itself; nothing is sticky.
- **States:**
  - Route loading: placeholder labelled `Loading your profile…` (form layout, 3 rows).
  - Component loading: two skeleton blocks (112px and 208px high, 32px apart), sr text `Loading profile`.
  - Error: heading `Your profile couldn’t load`, text `Your saved details haven’t changed.`, outline button `Try again`.
  - No profile: heading `Complete your student profile.` with `Complete student onboarding to create your recruiting profile.` (signed in) or `Sign in to see your saved education, experience, and résumé. This preview contains no sample personal details.` (signed out).
  - Alumni "After graduation" panel: heading `After graduation`, outline button `Edit`; rows `Working at` → `{role} at {employer}` or `Not added`; `Clubs’ alumni list` → `Shown to current members` / `Hidden`; `“Where members go”` → `Company name added` / `Not added`. Edit mode has `Save` (`Saving…`) and `Cancel`; error `We couldn’t save that. Try again.`; sr status `Saved.`.

### 45 · Edit profile (dialog)
- **Route:** `/profile` with the dialog open (no URL change)
- **Screenshot:** `docs/mobile/screenshots/web/45-profile-edit.png`
- **Source:** `components/edit-student-profile-dialog.tsx`, `components/profile-photo-crop.tsx`, `components/resume-import-dialog.tsx`, `components/ui/autosave-status.tsx`, `components/ui/dialog.tsx`, `components/ui/segmented-control.tsx`, `lib/graduation-years.ts`, `lib/scholar-status.ts`
- **Layout (top to bottom):** It is a centered modal card, not a full-screen sheet: width `min(36rem, 100vw − 2rem)` = 358px at 390, max-height `100dvh − 2rem`, scrolls inside itself, 24px padding, 16px gap between blocks. Tapping outside does not close it.
  1. Title `Edit profile` (renders in Libre Caslon, about 22px, navy) and description (14px muted). Close `X` top-right (hidden while an upload is running).
  2. Section switcher: segmented control (aria-label `Profile section`, compact: 46px track, 36px segments, full width, scrolls horizontally because five labels do not fit). Options in order, default first: `Name & photo` · `Education` · `Experience` · `Links & résumé` · `Phone`. Selected segment = navy pill with cream text; others navy text on the light track. Five options means no sliding indicator. At 390px only `Name & photo`, `Education` and `Experience` are visible; `Links & résumé` and `Phone` are off-screen to the right with no scroll hint.
  3. Outline button `Import from résumé`, stretched to the full dialog width, 44px high (opens the import dialog below).
  4. Error line (14px, `#ac3544`) when present.
  5. Autosave status line (12px muted) when not idle.
  6. The fields of the selected section (20px vertical gap; labels 14px/500 above each field with 8px gap).
  7. Footer, top border, right-aligned, 8px gap: ghost `Close`, primary navy `Done`.
  As captured (`45-profile-edit.png`, section `Name & photo`): the card spans roughly y 75–768 of the 844px viewport over a dimmed page with the dock still visible beneath the overlay. Text inputs are 44px high with a 1px grey-blue border and radius about 16px, 16px text; seeded values `Sam` and `Staging-Student`. The file input shows the browser's `Choose File` / `No file chosen`. `Re-edit photo` is absent (no photo); `Remove photo` is present.
- **Exact copy:**
  - Header: `Edit profile` / `Choose a section. Changes save as you go.`
  - Footer: `Close`; `Done` (shows `Working…` during an upload). There is no "Save" or "Cancel" button.
  - **Name & photo:**
    - `First name` (required), `Last name` (required): text inputs, no placeholders.
    - `Profile photo (JPEG, PNG or WebP, up to 5 MB)`: file input (accepts JPEG/PNG/WebP).
    - Crop block appears after choosing a file (bordered box, radius ~10px, 12px padding): title `Crop & preview`; circular preview (max 256px, aria-label `Final profile photo preview`); three sliders `Zoom` (1–4), `Horizontal position` (−1–1), `Vertical position` (−1–1), step 0.01; buttons ghost `Cancel crop` and primary `Use cropped photo` (`Preparing photo…` while busy). Output is a 512×512 PNG.
    - Outline `Re-edit photo` (only when a photo exists); ghost `Remove photo` (always shown).
    - Helper `Save changes to update your photo.`
    - Note `Your computing ID is managed by your university account.`
  - **Education:**
    - `Major / intended major` (required text).
    - `Graduation year` (required native select; options = current Eastern calendar year −1 through +6, plus the stored year if outside that range; in 2026: 2025–2032).
    - `High school (optional)` (text).
    - `Gender` select: `Not provided`, `Male`, `Female`, `Other`, `Prefer not to say`. `Pronouns` select: `Not provided`, `He/Him`, `She/Her`, `They/Them`, `Other`. Stacked at phone width.
    - Note `Gender is shared with recruitment reviewers only when explicitly enabled for the round. Pronouns and high school stay on your personal profile.`
    - Checkbox row (44px) `Transfer student`.
    - `Are you a scholar?` select: `Not provided`, `Yes`, `No`. When `Yes`: checkboxes (one column at phone width, 44px rows) `Echols Scholars Program`, `Jefferson Scholars Program`, `Walentas Scholar`, `College Science Scholars Program`, `Rodman Scholars Program`, `Miller Arts Scholars Program`, `CORE Scholars Program`, `Other`; ticking `Other` adds text field `Scholarship name` (aria-label `Other scholarship name`, max 200). Note `Clubs you apply to may see this.`
    - Two-column grid of number inputs: `GPA out of 4.0 (optional)` (0–4, step .001), `SAT (optional)` (400–1600), `ACT composite (optional)`, `ACT English (optional)`, `ACT Math (optional)`, `ACT Reading (optional)`, `ACT Science (optional)` (each 1–36).
  - **Experience:**
    - Intro `Include internships, research, projects, or leadership. Add your most recent work first; dates are displayed as you enter them.`
    - Per entry (fieldset with bottom border): legend `Experience {n}`; `Role or project` (required), `Organization / context` (required), `Dates` (optional, free text); ghost small `Remove experience {n}` with `Trash2` 16px.
    - Outline `Add experience` with `Plus` 16px (disabled at 50 entries). No explicit empty-state copy: with zero entries only the intro and the Add button show.
  - **Links & résumé:**
    - `LinkedIn URL`, `Résumé URL` (text, URL keyboard, no placeholders).
    - `Or upload a résumé (PDF, up to 10 MB)` (file input, PDF only).
    - Note `The document attachment saves automatically. Clear the résumé URL to remove the attachment. LinkedIn and résumé details are not imported automatically.`
  - **Phone:**
    - `Phone number` (required, tel keyboard, placeholder `(434) 555-0123`).
    - Note `Required to apply. Clubs call applicants they accept; only a club that accepts you sees it.`
  - Validation and error messages:
    - Photo type/size: `Choose a JPEG, PNG or WebP image up to 5 MB.`
    - Photo cannot open: `This image could not be opened. Choose another image.`; crop save fallback `Unable to save photo.`
    - Upload failure fallback: `Upload failed. Your saved profile has not changed.`
    - Scholar set to Yes with no program: `Choose at least one scholar program.`; Other without a name: `Describe Other scholar status.`
    - GPA precision: `Use at most three decimal places for GPA (out of 4.0).`
    - Graduation year: `Choose a graduation year between {min} and {max}`
    - Phone: `Enter a 10-digit US number, or start with + and your country code.`
    - Generic save fallback: `Unable to save.`
    - Dialog load problems: `Loading profile…`; `We couldn’t load your profile. Close this window and try again.` then `Close this window to return to your profile.`; `Complete student onboarding before editing your profile.`; signed out: `Sign in to edit your saved profile.`
  - Autosave status line: `Saving…` (with spinner) → `Saved`; `Couldn’t save. ` + link `Retry` + server message; `Offline. Changes save when you reconnect` + `Retry`; `Couldn’t reach OutClass` + `Retry`. Recovery prompts: `Unsaved changes from this device are available.` `Restore draft` · `Discard`; `A draft from an earlier version is available.` `Restore draft` · `Discard old draft`; `This device has changes from before a newer version was saved elsewhere.` `Keep newer version` · `Review my copy` (read-only textarea aria-label `Your earlier copy (read-only)`).
  - **Import from résumé** dialog (opens over the edit dialog; centered card, max-height 85dvh):
    - Title `Import your résumé`; description `Upload a text-based PDF, review the suggestions, then confirm. Nothing changes in your profile before confirmation.`
    - Step 1: label `PDF résumé · up to 10 MB and 10 pages` (file input); note `Scanned/image-only PDFs are unsupported. The document is stored privately after extraction; attaching it to your profile is optional.`; status `Processing PDF and preparing suggestions…`
    - Step 2 (review): `Select only the changes you want. Checked profile fields replace their existing values; unchecked fields stay unchanged.` One bordered box per field: checkbox `Change {field}` where field is `First name`, `Last name`, `High school`, `Major`, `Graduation year`, `GPA`, `SAT`, `ACT composite`; line `Current: {value or Not set} · {Found | Needs verification | Not found}. {note}`; editable proposed value.
    - `Experience · append selected entries` with `Your {n} existing entries will stay. Exact duplicates are skipped. Work, internships, research and projects use the same title, organization and period fields.`; per entry checkbox `Append entry {n}`, fields `Title`, `Organization`, `Period`, ghost `Remove entry`; outline `Add experience manually`.
    - Checkbox `Also attach this PDF to my profile.` (with ` (replaces my current résumé reference)` when one exists); warnings list; primary `Confirm selected changes` (disabled until something is selected); status `Saving confirmed changes…`; ghost `Cancel`.
    - Errors: `Could not process this résumé. Please try again.`; `Check selected values: names and major are required; use valid years and scores.`; `Could not save. Your proposed changes remain here; please try again.`
    - Demo Mode: button disabled with `PDF importing is unavailable in Demo Mode; sample profiles stay isolated.`
- **Icons:** `XIcon` (close), `Trash2` 16 (remove experience), `Plus` 16 (add experience).
- **Behaviour:**
  - Autosave: edits save on blur and before switching section; switching section first flushes pending changes and stays put if that save fails. Each section saves independently with its own conflict check.
  - `Close`, `Done`, the `X` and Escape all do the same thing: flush pending changes, then close. If the flush fails the dialog stays open with `Retry`.
  - Photo flow: choose file → crop block → `Use cropped photo` uploads it → it is written to the profile by the normal autosave. `Done` is disabled while the crop block is open.
  - Résumé upload stores the PDF and puts its reference in `Résumé URL`.
  - The dialog always reopens on `Name & photo`.
- **States:** covered in Exact copy (loading, load error, signed out, autosave/offline/recovery).

### 46 · Preview (dropdown menu)
- **Route:** `/profile` with the Preview menu open
- **Screenshot:** none (not captured; see States)
- **Source:** `components/views/unified-student-profile-view.tsx` (`DropdownMenu`)
- **Layout:** Not an overlay or in-page preview: a small dropdown menu anchored to the start edge of the `Preview` button, with up to two rows. Each row: leading icon 16px, label, trailing `ArrowUpRight` 14px pushed to the right.
- **Exact copy:** `LinkedIn` (sr suffix ` (opens in a new tab)`); `View résumé` (sr suffix ` (opens in a new tab)`). Each row appears only if that item exists.
- **Icons:** `Linkedin` 16, `FileText` 16, `ArrowUpRight` 14.
- **Behaviour:** both rows are external links opened in a new tab (`target="_blank"`): the LinkedIn URL and the résumé URL (server-authorized résumé endpoint or the student's own link). No in-app résumé viewer is used on this page (`resume-viewer-dialog.tsx` is the leader-side viewer: title `Résumé · {name}`, `Download` / `Open link`, close aria-label `Close résumé`).
- **States:** with neither LinkedIn nor résumé the button is disabled, so the menu cannot open. That is the case for the seeded student (dump: `Preview` `disabled`), so no `46` capture exists; this section is from source only.

## Settings

### 47 · Settings (overview)
- **Route:** `/settings`
- **Screenshot:** `docs/mobile/screenshots/web/47-settings.png`
- **Source:** `app/(workspace)/settings/layout.tsx`, `page.tsx`, `components/settings/personal-settings-layout.tsx`, `personal-settings-overview.tsx`, `lib/settings-navigation.ts`, `components/clubs/club-settings.css`, `components/shell/product-shell.tsx` (account menu)
- **Layout (top to bottom):**
  1. Page header: h1 `Settings` (Libre Caslon 26px), description 6px below (15px muted). No breadcrumb on the overview.
  2. One card (`section` aria-label `Settings overview`): panel fill and edge as above, 20px horizontal padding, rows separated by 1px `#dfe3dd` dividers. Each row is a full-width link with 20px vertical padding: label (h2, 14px, weight 600, navy), description 4px below (14px / 24px, muted). No icons, no chevrons, no badges.
  3. Dock (no tab highlighted). Card radius renders at about 16px; the five rows fill y 160–650 of the page.
- **Exact copy:** title `Settings`; subtitle `Your account, notifications, availability and interests.`

| # | Label | Description | Icon | Destination |
|---|---|---|---|---|
| 1 | `Account & Security` | `Your sign-in information and account security.` | none | `/settings/account` |
| 2 | `Notifications` | `Choose which club updates and reminders reach your email.` | none | `/inbox?tab=preferences` (leaves Settings; opens the Inbox preferences sheet; `/settings/notifications` redirects to the same address) |
| 3 | `Availability` | `Keep one availability schedule across all your clubs.` | none | `/settings/availability` |
| 4 | `Interests` | `What you’re into, so we can suggest clubs. Only you see this.` | none | `/settings/interests` |
| 5 | `Interview schedule` | `Your approved interview panels across all your clubs.` | none | `/settings/interviews` |

- **Icons:** none in the list. `Settings` (gear) is used in the account menu entry.
- **Behaviour:**
  - How Settings is reached on a phone: header avatar button (aria-label `Account menu for {name}, {initials}`) opens the account menu (width 256px): name line, optional `Workspace` group, then `Your profile` (small avatar), `Settings` (`Settings` icon), `Report an issue or send feedback` (`MessageSquare`), `Sign out` (`LogOut`). Settings is not in the dock.
  - Demo Mode hides rows 2, 4 and 5 and hides the Settings menu entry.
  - Sub-pages at phone width (`/settings/account`, `/settings/availability`, `/settings/interests`): the side menu "Personal settings" is hidden at ≤1100px, so there is no row of section links. The only back affordance is a breadcrumb above the title: link `Settings` → `/settings`, `ChevronRight` 14px separator at 60% opacity, then the current section label (14px; link muted, current page navy weight 500; link tap height 44px). Below it the h1 is the section label and the description is the same sentence as in the table.
  - `/settings/interviews` is exempt from this layout: no breadcrumb, its own header (screen 51).
  - Other legacy addresses: `/settings/profile` → `/profile`; `/settings/organizations` → `/clubs`.
- **States:** none specific; sub-pages show `Loading your settings…` placeholders while loading.

### 48 · Account & Security (with Delete account)
- **Route:** `/settings/account`
- **Screenshot:** `docs/mobile/screenshots/web/48-settings-account-and-delete.png`
- **Source:** `app/(workspace)/settings/account/page.tsx`, `components/settings/account-settings.tsx`, `account-deletion.tsx`, `two-step-settings.tsx`, `lib/account-deletion.ts`, `actions/account-deletion.ts`
- **Layout (top to bottom):**
  1. Breadcrumb `Settings › Account & Security`; h1 `Account & Security`; description.
  2. One card, 20px horizontal padding, sections divided by 1px lines, each section 20px vertical padding, section headings 20px/600 Source Sans:
     - **Sign-in information**: three label/value pairs, 16px apart; label 14px muted, value 4px below (email is weight 500 and may break anywhere).
     - **Password & security**: paragraph (14px/24px muted), optional bot-check widget, outline button.
     - **Two-step sign-in**: only when the server feature flag is on; not present in the staging capture.
     - As captured the page is about 1320px tall; the reset button is a light outline pill; both delete fields are empty 44px inputs with radius about 16px.
     - **Delete account**: bulleted list (disc bullets, 20px indent, 14px/24px muted, 4px between items), two labelled fields (label 14px/500, 6px above a 44px input), destructive pill button. Section spacing 12px.
- **Exact copy:**
  - Sign-in information: `University email` → `student.staging@virginia.edu`; `University` → `University of Virginia`; `Sign-in method` → `Email and password` (or `University sign-in` for provider accounts).
  - Password & security: `Request a secure reset link at your university email to change your password.`; button `Send password reset email` (`Sending…` while busy). Provider accounts instead see `Your sign-in provider manages your password. Use your university account’s security settings to update it.` and no button.
    - Success: server message or `Check your university email for password reset instructions.` Error fallback: `Could not request a password reset.`
    - Support session: `Exit the administrator support session before changing account security.`
  - Two-step sign-in (flagged): heading `Two-step sign-in`; `Off. Add a code from an authenticator app to every sign-in.` / `On. Signing in asks for a code from your authenticator app.`; buttons `Turn on` (`Starting…`), `Turn off` (`Turning off…`), `Continue` (`Checking…`), `Verify and turn on` (`Verifying…`), `Cancel`; field `Current password`; `Current authenticator code`; setup text `Scan with an authenticator app such as Google Authenticator, 1Password or Authy, then enter the 6-digit code it shows.`; note `OutClass can’t show backup codes. Keep your authenticator app backed up; if you lose your phone, contact OutClass support from your university email to restore access.`; statuses `Two-step sign-in is on.` / `Two-step sign-in is off.`; `Required for platform administrators.`; errors `Two-step sign-in is temporarily unavailable.` / `Something went wrong.`
  - Delete account heading: `Delete account`. Bullets, in order:
    1. `Your profile, résumé, headshot, files and in-progress applications are deleted.`
    2. `For decided applications, the club keeps its own review notes and the decision, linked to an anonymized placeholder. Your answers are removed.`
    3. `Decision letters and interview copies of your résumé that a club already holds stay with that club’s records.`
    4. `Attendance and audit history keep only the anonymized placeholder.`
    5. `You can cancel within 14 days.`
  - Fields: `Type your university email or DELETE` (text, no autocomplete or spellcheck, no placeholder); `Current password` (password). Provider accounts get no password field, only `If you signed in more than 10 minutes ago, sign out and back in first.`
  - Button: `Delete account` (destructive `#ac3544`, white text; `Requesting…` while busy).
  - Confirm dialog after tapping it: title `Delete your OutClass account?`; body `Your account will be deleted in 14 days. You can cancel any time before then from this page.`; confirm `Delete account` (danger styling, focus starts on cancel); cancel button `Cancel`.
  - After a successful request: `Request received. We sent a confirmation to your university email.`
  - Pending state (replaces bullets, fields and button): `Your account is scheduled for deletion on {Month D, YYYY}.` (date bold, Eastern, long format); if the email failed: `We couldn’t send the confirmation email. Your request is saved, and you can cancel here until that date.`; outline button `Cancel deletion` (`Cancelling…`). After cancelling: `Deletion cancelled. Your account stays as it is.`
  - Leadership warnings (muted lines under the block when they apply): `You’re the only {starting decisions | president | recruitment lead, comma-joined} in {club}. Hand that off so the club isn’t stuck.`
  - Errors: `Type your university email or DELETE to confirm.`; `Enter your current password.`; `That password isn’t right.`; `Password verification is unavailable right now. Try again later.`; `Too many attempts. Try again in 15 minutes.`; `Too many attempts from this network. Try again in 15 minutes.`; `For your security, sign out and sign back in, then delete your account within 10 minutes.`; `Transfer ownership of {club} before deleting your account.`; `The other owner of {club} has also asked to delete their account. Add another owner before deleting yours.`; `Platform administrators must hand off administrator access before deleting their account.`; `There’s no pending deletion request.`; `This request is past its 14-day window and can no longer be cancelled.`; `The request changed. Reload and try again.`; fallbacks `Could not request deletion.` / `Could not cancel the request.`
- **Icons:** `ChevronRight` 14 in the breadcrumb only.
- **Behaviour:**
  - `Delete account` stays disabled (50% opacity; renders pale pink with white text in `48-settings-account-and-delete.png`, dump `disabled`) until the first field equals `DELETE` exactly or the account email (case-insensitive, trimmed) and, for password accounts, the password field is non-empty.
  - Deletion is a request with a 14-day grace period; nothing is deleted immediately.
  - The Delete block is not shown in Demo Mode or a support session.
  - When bot checks are configured, a Turnstile widget sits under the reset paragraph and under the password field; submitting before it completes shows its pending message (copy in `lib/turnstile`, not read).
- **States:** loading placeholder `Loading your settings…`; pending-deletion and error states as above.

### 49 · Availability
- **Route:** `/settings/availability` (optional `?clubId=…&roundId=…` selects a club round instead of the global schedule)
- **Screenshot:** `docs/mobile/screenshots/web/49-settings-availability.png`
- **Source:** `app/(workspace)/settings/availability/page.tsx`, `components/availability/my-availability.tsx`, `weekly-calendar.tsx`, `availability.css`, `outlook-busy-import.tsx`, `dashboard-requests.tsx`, `lib/scheduling-config.ts`, `lib/availability.ts`
- **Layout (top to bottom):**
  1. Breadcrumb `Settings › Availability`; h1 `Availability`; description `Keep one availability schedule across all your clubs.`
  2. `Editing` (14px/500) above a full-width pill dropdown (46px high, light `#faf8f3` pill, navy text, chevron; aria-label `Choose an interview round`) showing `My global availability · all clubs`.
  3. Underlined text link `View my published interviews` (44px tap height) → `/settings/interviews`.
  4. Explainer line (12px muted).
  5. Editor panel (16px padding, 20px gaps between blocks):
     1. Heading `Your weekly rhythm` (20px/600) with helper paragraph (14px/24px muted); save status text beside or below it (weight 500, muted; red when failed).
     2. `8:00 AM–9:00 PM · Eastern Time` (12px muted).
     3. Mode segmented control (aria-label `Availability editing mode`, full width, 54px track, sliding navy indicator, two equal halves): `Recurring week` (with `CalendarDays` 16px; default, navy pill) | `Specific dates`.
     4. Legend row (12px, wraps): navy 12px square `Available`; bordered white square `Unavailable`; striped square `Unknown`; then muted sentence.
     5. Status line `Selections save after you release.` (12px muted).
     6. Day picker segmented control (phone only; aria-label `Day to edit`, compact, full width): `Mon` `Tue` `Wed` `Thu` `Fri` `Sat` `Sun`, default `Mon`; selected = navy pill. At 390px the track shows Mon–Fri and a clipped `Sa`; Sat and Sun need a sideways scroll.
     7. Instructions paragraph (12px muted) and checkbox row `Enable touch dragging (turn off to scroll)` (unchecked by default, 44px row).
     8. The grid: bordered box, radius 16px, max-height 520px, scrolls vertically inside itself with a sticky header row. At ≤639px it has two columns only: `Time` (88px) and the one selected day (rest of the width; header shows the three-letter day). 52 rows, one per 15 minutes from 8:00 AM to 8:45 PM; every row shows its start time on phones (`8:00 AM`, `8:15 AM`, …; 12px muted, tabular). Each cell is a 44px-high button. In the capture the 520px box shows the header plus 8:00 AM to 10:30 AM; the rest is reached by scrolling inside the box.
     9. Copy/clear row (wraps, 8px gaps): select (aria-label `Copy from day`, default Monday), `to`, select (`Copy to day`, default Tuesday), outline `Copy day`, select (`Day to clear`, default Monday), outline `Clear day`, outline `Clear entire week`. Selects are 44px, radius 10px, 16px text, options Monday–Sunday.
     10. Only while the recurring week has never been submitted: outline `Submit this recurring week (including an empty week)`.
- **Exact copy:**
  - Explainer: `Save your usual week once. Round requests prefill this schedule and require a separate submission.` (round selected: `This response belongs only to this club and round. It does not change your global schedule.`)
  - Helper: `Enter your usual free time once. Your schedule follows local clock time, including daylight saving changes.` (round: `Your global schedule is prefilled. Adjust specific dates here and confirm your participation for this club and round.`)
  - Save status (one of): `All changes saved` · `Unsaved changes` · `Saving…` · `Save failed · edits retained` · `No schedule saved` (never saved) · or the offline/unreachable message from the save queue.
  - Legend sentence: `Unmarked times on submitted days are unavailable. Striped days are unknown.` plus, in Specific dates mode, ` Date changes replace the editable hours on that day.`
  - Grid status: `Selections save after you release.` / during a drag `Editing selection · release to save.`
  - Instructions: `Click or tap a time to add or remove it. Arrow keys move; Space or Enter toggles; Shift + arrows extends. You can also drag; Escape cancels a drag.`
  - Grid aria-label `Weekly availability by quarter hour`; cell aria-label `{Weekday}, {start}–{end}: available | unavailable | unknown` (e.g. `Monday, 10:00 AM–10:15 AM: available`); cell sr text `Available` / `Not marked`.
  - Specific dates mode adds a row: icon button (aria-label `Previous week`), `Week of` with a date field, icon button (`Next week`), outline `Copy previous week`; day headers gain the date as `MM-DD`; and, per day that has a date-specific change, ghost buttons `Use recurring on {Mon}` (aria-label `Use recurring availability on {Monday}`).
  - Outlook import (Specific dates mode only, and only when the Outlook feature flag is on; not present in the staging dump): outline button `Check Outlook`. Results: `Outlook shows no conflicts with your availability this week.` + `Done`; or `Outlook shows you busy during {1 available quarter hour | N available quarter hours} this week.` + `Mark unavailable` + `Keep as is`; then `Outlook busy times marked unavailable.` Errors: `Your university needs to approve OutClass for Outlook access before calendars can be checked.` / `Outlook access wasn’t granted. Nothing changed.` / `The Outlook check expired. Try again.` / `Your OutClass sign-in expired. Reload the page, sign in, and try again.` / `Outlook check cancelled. Nothing changed.` / `Outlook couldn’t be checked right now. Nothing changed.` / `Allow pop-ups for OutClass to check Outlook.`
  - Per-club round requests: the dropdown lists, after the global option, one entry per round as `{club} · {round} · {Not requested | Awaiting response | Submitted | Declined participation}`. Choosing one swaps the editor to that round (heading = round name, Specific dates mode only, no mode switch) and adds a block above the grid:
    - Status: `Not submitted for this round. Saved edits are excluded from confirmed staffing counts until you submit.` / `Submitted · Participation confirmed. Your club can use this availability for staffing.` / `Declined participation. You are excluded from confirmed staffing counts.`
    - Buttons: primary `Submit round availability` (`Update submitted availability` once submitted; `Check` icon), outline `Use current global schedule`, outline `Withdraw confirmation` (enabled only when submitted), ghost `Decline participation`, and, when nothing at all has been entered, outline `Declare no availability`.
    - Notices: `Already using your current global schedule. Your response is unchanged.`; `Could not confirm participation.`; `Could not refresh the global schedule.`; `Could not withdraw confirmation.`; `Could not decline participation.`; `Could not load this round.` + `Retry loading round`; loading `Loading round availability…`.
  - Home dashboard card for requests (`dashboard-requests.tsx`, not on this page): title `Interview availability`; rows `{club} · {round}` with the response label and button `Respond to request` (awaiting) or `View response`, linking to this route with `clubId`/`roundId`; error `Could not refresh your requests.` + `Retry`.
  - Other notices: `The source day has no submitted availability.` (Copy day from an unknown day); alumni: `Alumni accounts can’t edit availability. Your saved availability stays as it is.`
- **Icons:** `CalendarDays` 16 (Recurring week), `ChevronLeft` / `ChevronRight` 16 (week buttons), `Copy` 16 (Copy previous week), `Check` 16 (submit), `CalendarClock` 16 (Check Outlook).
- **Behaviour:**
  - Fixed window 8:00 AM–9:00 PM, 15-minute slots, Eastern Time; no timezone control.
  - Phone shows one day at a time, chosen with the Mon–Sun control.
  - Touch: a tap toggles that single 15-minute cell. Finger-dragging scrolls the grid by default; ticking `Enable touch dragging (turn off to scroll)` makes a drag paint a range instead (the first cell touched decides whether the drag adds or removes), saved on release.
  - Colours: available = solid navy `#232d4b`; unavailable = card `#fffefa`; unknown (day never submitted) = 135° stripes of `#fffefa` and `#edeee9`. Cells have a 1px `#dfe3dd` left border, a faint bottom border, and a full-strength top border on each hour.
  - Seeded Monday: available 10:00 AM–12:00 PM and 3:00 PM–6:00 PM; status reads `All changes saved`; no `Submit this recurring week…` button (week already submitted).
  - There are no Save or Discard buttons: every change is queued and saved automatically; the status text reports progress. Leaving with unsaved changes triggers the browser's leave warning.
  - "No regular free time" is expressed by `Submit this recurring week (including an empty week)` (global) or `Declare no availability` (round).
  - Choosing a round updates the URL (`?clubId=&roundId=`) and browser Back returns to the previous choice.
- **States:**
  - Save failure: red message plus outline `Retry save` and `Reload saved version`.
  - Offline/unreachable: message plus `Retry save`.
  - Draft recovery: `Unsaved availability from this device is available.` + `Restore edits` / `Discard`; conflict: `This device has changes from before a newer version was saved elsewhere.` + `Keep newer version` / `Review my copy` (read-only grid labelled `Your earlier availability (read-only)`).

### 50 · Interests
- **Route:** `/settings/interests`
- **Screenshot:** `docs/mobile/screenshots/web/50-settings-interests.png`
- **Source:** `app/(workspace)/settings/interests/page.tsx`, `components/interests/interest-settings.tsx`, `interest-survey-form.tsx`, `components/ui/filter-chips.tsx`, `lib/interest-survey.ts`, `styles/filter-controls.css`
- **Layout (top to bottom):**
  1. Breadcrumb `Settings › Interests`; h1 `Interests`; description `What you’re into, so we can suggest clubs. Only you see this.`
  2. One panel with four questions. Source intends 24px between them, but as rendered there is no gap: each question heading sits directly under the previous chip row. Each question: a row with the question (14px/600, navy) left and an optional note right (12px muted), then 10px below a single row of chips that scrolls horizontally (chips do not wrap; the row is clipped at the panel edge). At 390px the first row shows `Consulting`, `Finance & investing` and a cut-off `Business`; the second shows `Career`, `Community and friends` and a cut-off `Service`; the last two rows fit.
  3. Row with primary navy `Save` button directly under the last chip row and, after a save, the word `Saved` (14px muted) beside it.
- **Exact copy:**

| Question | Right note | Options, in order | Selection |
|---|---|---|---|
| `What are you into?` | `{n} of 6` (seeded `3 of 6`) | `Consulting`, `Finance & investing`, `Business & startups`, `Tech & engineering`, `Social impact`, `Pre-professional`, `Greek life`, `Sports & recreation`, `Arts & performance`, `Academic & research`, `Social` | multi, max 6 |
| `What do you want from a club?` | none | `Career`, `Community and friends`, `Service`, `Creative outlet`, `Competition`, `Leadership` | multi, no limit |
| `How much time?` | `per week` | `1–2 hours`, `3–5 hours`, `6+ hours` | single |
| `Open to applying to selective clubs?` | none | `Yes`, `No`, `Either` | single |

  Seeded selection: Consulting, Finance & investing, Tech & engineering; Career, Community and friends; 3–5 hours; Either.
  Other copy: button `Save`; status `Saved`; error `Couldn’t save your interests. Try again.` (in a feedback box with a red left bar); alumni `Alumni accounts can’t edit the interest survey. Your answers stay as they are.`; support session `Interest answers are private to the student and are not shown in a support session.`
- **Icons:** none (breadcrumb `ChevronRight` only).
- **Behaviour / chip states:**
  - Chip: pill, 1px border, 14px/500, padding 6px × 14px, 8px gap, about 46px tall at phone width (16px label). Unselected: `#fffefa` fill, `#dfe3dd` border, navy text. Selected: `#e7ebe7` fill, navy `#232d4b` border, navy text (never the solid navy pill). Disabled: 50% opacity.
  - Minimum: none; every question is optional and an empty survey can be saved. Maximum: 6 interests; at 6, the unselected interest chips are disabled.
  - Single-select questions keep one chip selected at a time; tapping the selected chip again leaves it selected (the control re-sends the same value), so once answered these two questions cannot be cleared from this screen (from source; not exercised in a capture).
  - Nothing saves until `Save`; changing any chip clears the `Saved` word. The button shows a spinner while saving. Saving refreshes club suggestions on Home and Explore.
- **States:** no skeleton of its own (server-rendered); error and alumni states as above.

### 51 · Interview schedule (empty)
- **Route:** `/settings/interviews`
- **Screenshot:** `docs/mobile/screenshots/web/51-settings-interviews-empty.png`
- **Source:** `app/(workspace)/settings/interviews/page.tsx`, `components/interviews/my-panel-schedule.tsx`
- **Layout (top to bottom):** no breadcrumb and no Settings chrome on this page; blocks are 24px apart.
  1. Eyebrow `My interviews` (12px/600 muted); h1 `My Interview Schedule` (Libre Caslon 26px); description (15px muted).
  2. Checkbox row `Include past interviews` (native checkbox, 14px label, 44px row, unchecked by default).
  3. Empty state: full-width bordered box (1px border, radius about 16–20px as rendered, 24px padding, no fill) with one 14px muted paragraph on three lines.
  4. Underlined text link `Update My Availability` (14px, 44px tap height) → `/settings/availability`.
  5. Dock, with the Calendar tab highlighted (`51-settings-interviews-empty.png`).
- **Exact copy:** `My interviews` / `My Interview Schedule` / `Your approved panel assignments across all your clubs.` / `Include past interviews` / `You have no upcoming official panel assignments. Draft suggestions appear here after the owner publishes them.` / `Update My Availability`. List aria-label `Official interview assignments`.
- **Populated row anatomy (from source):** each assignment is a panel card, cards 16px apart:
  - Heading `{club} · {round}` (Libre Caslon 17px/600).
  - `{room} · {location}` (weight 500, 8px above).
  - `{Weekday, Month D, YYYY} · {h:mm AM}–{h:mm PM}` (14px), Eastern Time.
  - Meta line (12px muted): `Eastern Time` + optional ` · {n} minute buffer` + ` · Official assignment` + optional ` · Availability overridden` + optional ` · Published version {n}`.
  - Top-right status label `Published`: 12px/500, emerald text (`text-emerald-800`) on pale emerald (`bg-emerald-50`), 2px left accent bar, square corners.
  - Actions row 16px below: underlined link `Add to Google Calendar` (new tab; event title `{club} interview panel`) and outline button `Download calendar event` (downloads `interview-panel.ics`).
- **Icons:** none.
- **Behaviour:** by default only assignments whose end time is in the future are listed; the checkbox adds past ones. The list reloads when the user returns to the page or a panel publish is announced.
- **States:** empty as above (also shown when only past assignments exist and the box is unchecked); error `Could not load your latest schedule.` with small outline button `Try again`; route loading `Loading your settings…`.

## Flows

Evidence note: written from source, then checked against the captures `52`–`59` and `67` (previews and text dumps). Seeded strings quoted as "seeded" come from those dumps. Pixel values are resolved from CSS at 390 px, not measured from the images. Each capture shows one state only: no dialog, selection footer, validation error, cancel confirm or post-response state was captured, so those are from source.

What the captures show for every in-page flow screen (52–56, 58): the product header (OutClass wordmark, search, notifications, `SS` avatar) stays on top and the five-tab dock (`Home`, `Explore`, `Inbox`, `Calendar`, `Profile`) stays at the bottom with **`Home` highlighted**, because Applications has no dock tab.

Rendered control shapes seen in the captures (they apply to every screen below):

| Control | Rendering |
|---|---|
| Primary button | navy `#232d4b` pill (fully rounded), white label |
| Outline button | cream/white pill with a soft drop shadow, no visible border, navy label |
| Ghost button | label and icon only, no surface |
| Club logo fallback | about 44 px rounded square, pale grey fill, navy initials (first two characters, e.g. `Pi`, `Wo`, `La`, `Co`, `Al`, `Ro`); not filled with the club colour |

Shared values used throughout (from `styles/tokens.css`, resolved at 390 px):

| Token | Value |
|---|---|
| `--foreground` / `--primary` | `#232d4b` |
| `--muted-foreground` | `#52606d` |
| `--background` (page) | `#f6f5f1` |
| `--card` / `--oc-content-solid` | `#fffefa` |
| `--border` | `#dfe3dd` |
| `--input` (field border) | `#8793a0` |
| `--brand-orange` | `#e57200`; `--brand-subtle` `#fceadd`; `--brand-ink` `#a04d00` |
| `--success` / subtle | `#296448` / `#edf5ef` |
| `--destructive` | `#ac3544` |
| `--warning` / subtle | `#795617` / `#fbf3df` |
| `--info` | `#295c88`; `--interview` `#655080`; `--secondary-foreground` `#34485a` |
| `--ring` (focus) | `#c86400` |
| `--oc-content-padding` | 16 px; `--oc-space-page` 16 px; `--oc-content-radius` 16 px; `--oc-radius-md` 10 px; `--oc-radius-sm` 6 px |
| Type | body 15 px/1.6; small 14 px; caption 12 px; card heading 17 px; section heading 20 px; page title (`h1` in `PageHeader`) 26 px Libre Caslon weight 500, line-height 1.14 |
| Fonts | Source Sans 3 default; Libre Caslon Text = `--oc-font-display` (page `h1`, `oc-card-heading`, the whole decision letter) |
| Buttons at ≤767 px | every `Button` min-height 44 px; label 14 px weight 650 (inside `.vr-page` weight 500) |

Application status label (`StatusPill`, `components/ui/status-pill.tsx`): a 16 px tinted icon plus plain 12 px weight-500 text, no capsule/background. Text colour is inherited; only the icon is tinted.

| Stored status | Label | Icon | Icon colour |
|---|---|---|---|
| `DRAFTING` | `Draft` | `FilePenLine` | `#52606d` |
| `SUBMITTED` | `Submitted` | `Send` | `#34485a` |
| `IN_REVIEW` | `In review` | `Eye` | `#295c88` |
| `INTERVIEWING` | `Interview` | `CalendarClock` | `#655080` |
| `ACCEPTED` | `Accepted` | `CheckCircle2` | `#296448` |
| `REJECTED` | `Not selected` | `XCircle` | `#ac3544` |
| `WAITLISTED` | `Waitlisted` | `Clock` | `#795617` |

Date format used by all student flow screens: `schedulingDateTime` = `Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })` → `Nov 28, 2026, 11:59 PM`. `applicantDate` / `recruitmentDate` append ` · Eastern Time`.

How the flow screens are opened: all of 52, 53, 54 (in-page), 55, 56 and 58 are **in-page state of `/applications`** (`ApplicationTrackerView`), not routes. The list is replaced by the detail; the product shell (header, bottom dock) stays. Only the standalone booking link (`/interviews/book`) and the decision letter (`/applications/<id>/decision`) are routes, and both render in the focus frame (no dock).

- Drafts tab card button → `activeId` set → **form**.
- Other tabs' card button (`View details` / `Review interview` / `Review offer`) → `activeId` + `statusId` set → **status detail**.
- Deep link `/applications?applicationId=<id>`: opens that application (draft → form; submitted → status detail). For a submitted application the URL is rewritten with `history.replaceState` to `?tab=<stage>` and `applicationId` removed, so reload returns to the list. A draft keeps `applicationId` in the URL so reload returns to the form.
- Tab selection is mirrored to `?tab=drafts|in-review|interviews|decisions` via `replaceState`.
- On open, focus moves to the detail `h1`; on back, focus returns to the card button that opened it.

---

### 52 · Application form (draft)

- **Route:** `/applications` (in-page state; `?applicationId=<id>` deep-links and persists for drafts)
- **Screenshot:** `docs/mobile/screenshots/web/52-application-form-draft.png`
- **Source:** `components/views/application-tracker-view.tsx`, `components/applications/application-form.tsx`, `question-field.tsx`, `application-tracker.css`, `lib/student-applications.ts`, `components/ui/autosave-status.tsx`
- **Layout (top to bottom):** container `.oc-writing-workspace` (grid, gap 12 px, bottom padding 32 px)
  1. Back button: ghost, small, pulled left 12 px; `ArrowLeft` 16 px + `Applications`. Disabled while a save/submit is running.
  2. Identity header (flex, centred, gap 12 px): club logo (`ClubLogo` size `md`; fallback = first two characters of the club name on the club colour, seeded `Pi`) | column: eyebrow `Your application` (12 px, weight 500, `#52606d`); `h1` club name (Libre Caslon, 20 px, line-height 1.25); row (wraps, gap 12 px / 4 px): `StatusPill` `Draft` + 12 px muted deadline line.
  3. Notice line (`role="status"`, 14 px muted; visually hidden when empty).
  4. Progress row (12 px text, space-between): left `1 of 3 required responses ready`; right the autosave status (nothing when idle, as in the capture). No progress bar on this screen.
  Seeded form (capture): five questions. Q1 `Question 1 · Required` `Why do you want to join Piedmont Founders Lab?` essay, filled, `31 words · 150 maximum`. Q2 `Question 2 · Required` `Tell us about a time you worked on a team to get something difficult done. What was your part?` essay, empty, `0 words · 400 maximum`. Q3 `Question 3 · Required` `How many hours a week can you commit this semester?` select: `Select an option`, `1 to 3 hours`, `3 to 5 hours`, `More than 5 hours`. Q4 `Question 4 · Optional` `Which areas interest you most? Choose any that apply.` checkboxes `Project work`, `Training and workshops`, `Events and community`, `Leadership`. Q5 `Question 5 · Optional` `Résumé (optional, PDF)` link field + file input (`Choose File No file chosen`). Number buttons `1`–`5` render as circles; the page is about 2,450 px tall.
  5. Profile warning strip (only when the profile is incomplete): 3 px left rule `#795617`, background `#fbf3df`, padding 8 px 14 px, 13 px text, with a link-style button `Update profile`.
  6. Error alert (only after a failed validation/save): border 1 px `#ac3544` at 30 % opacity, radius 10 px, padding 16 px, 14 px text in `#ac3544`; optional bulleted list of links `{question prompt}: {error}` that focus the field.
  7. Status message (`role="status"`, 14 px; hidden when empty).
  8. Closed note (only when the club no longer takes applications): `Applications are closed. You can still save your draft.`
  9. Question cards, one per visible question (grid gap 16 px). Card: padding 16 px, background glass/`#fffefa`, 1 px edge, radius 16 px, soft shadow; border turns `#c86400` while a field inside has focus. Inside (gap 12 px):
     - Meta line, 12 px weight 500 muted: `Question {n} · Required` or `Question {n} · Optional`.
     - Prompt as the field label: 16 px, weight 500, line-height 28 px, preserves line breaks.
     - Field (see table).
     - Help line, 14 px muted (`text-control`), followed by the field error in `#ac3544` when present.
  10. Navigation row (flex wrap, space-between, gap 12 px): label `Questions` (12 px muted) + one 36 px square outline button per question showing its number (`aria-label` `Go to question {n}`; min 44 px at phone width); then link-style button `Continue to next response` (only while some response is missing/invalid; focuses the first such field).
  11. Actions block (top border, padding-block 16 px): helper `Your draft saves automatically. Nothing is submitted until you confirm.` (12 px muted, max-width 320 px); below it a two-column equal grid, full width: `Save draft` (outline) | `Review & submit` (primary; disabled when the club is closed). Buttons min-height 44 px, text may wrap, centred.
  12. Disclosure `Shared profile & requirements` (`<details>`, top border, summary 14 px weight 600). Open: two 14 px muted paragraphs and link-style button `Review your profile`.
- **Question types (`QuestionField`):**

| `type` | Control | Placeholder / options | Help line |
|---|---|---|---|
| `ESSAY` | Textarea, 9 rows, min-height 224 px, resizable vertically, 16 px text, line-height 28 px, padding 12 px, background `#f6f5f1`; hard limit 100,000 characters | `Take your time. Write in your own voice.` | `{n} words · {limit} maximum` or `{n} words · No word limit specified` (word count = whitespace-separated; there is no character counter) |
| `MULTIPLE_CHOICE` (with options) | Native select, full width, min-height 44 px, 1 px `#8793a0` border, radius 10 px | First option `Select an option`, then the club's options | `Select one option. If no choices are listed, ask the club for clarification.` |
| `MULTI_SELECT` (with options) | Stack of bordered rows (gap 8 px): each min-height 44 px, radius 10 px, padding 8 px 16 px, checkbox + option text 14 px. Screen-reader legend `Select all that apply`. Stored in the club's option order. | — | `Enter your response.` |
| `FILE_UPLOAD` | Single-line text input for a document link, then label `Or upload a PDF (up to 10 MB)` and a native file input (`accept="application/pdf"`) | `https://…` | `Use a document link the club can access. Attachments save automatically; uploading never submits your application.` |
| Choice type with no options, or any other | Single-line text input | `Your response` | as per its type above |

  There is no separate short-text or links question type in the data model; only the four types above. Required questions set `required` / `aria-required`; the only visible marker is the word `Required` in the meta line (no asterisk).
  Conditional questions (`showIf`) appear only once their parent choice question has a matching answer; numbering and the required count follow the visible set.
- **Exact copy:**
  - Deadline line in this header: `Deadline {date} · Eastern Time` — seeded `Deadline Nov 28, 2026, 11:59 PM · Eastern Time` (no middot after "Deadline" here; the list card writes `Deadline · Nov 28, …`). No deadline: `Deadline not published`. Demo: `Sample deadline …`.
  - Progress: `{completed} of {required} required responses ready`; no required questions: `No required questions`. "Ready" counts required answers that are non-empty and valid (word limit, valid option, valid file reference).
  - Autosave status (12 px muted, right of progress): `Saving…` (with spinner), `Saved`, `Couldn’t save. ` + `Retry`, `Offline. Changes save when you reconnect` + `Retry`, `Couldn’t reach OutClass` + `Retry`. Recovery variants: `Unsaved changes from this device are available. ` `Restore draft` ` · ` `Discard`; `A draft from an earlier version is available. ` `Restore draft` ` · ` `Discard old draft`; `This device has changes from before a newer version was saved elsewhere. ` `Keep newer version` ` · ` `Review my copy` (opens a read-only 6-row textarea labelled `Your earlier copy (read-only)`).
  - Profile warning, one of: `Complete your shared profile before submitting.` / `Add a phone number to your profile before submitting. Clubs call applicants they accept.` / `{requirement}. Add the missing scores to your profile before submitting.` where requirement is `SAT and ACT optional`, `SAT or ACT required`, `SAT required`, `ACT required`, `SAT and ACT required`.
  - Manual save success: `Draft saved to your account.` Upload success: `Document uploaded. Your attachment will save automatically.`
  - No questions: `This club has not added application questions. Your submission will use your shared profile.`
  - Disclosure body: `Your shared profile gives the club your academic and experience details.` / `{requirement}. Scores are taken from your profile; SAT and ACT are never converted.`
  - The copy `Your draft is saved; nothing has been submitted.` belongs to the Drafts list card, not the form.
- **Validation copy:**
  - Banner after `Review & submit` with problems: `A few responses need your attention. Your draft can still be saved.`
  - Banner after `Save draft` with problems: `Check the highlighted responses before continuing.`
  - Per-field: `This question needs a response before you submit.` / `Keep your answer within {limit} words.` / `Choose one of the available options.` / `Choose from the available options.` / `Use an uploaded PDF or a valid document URL.` / `The application questions have changed. Reload before continuing.`
  - Upload: field `Choose a PDF up to 10 MB, or add a document link.` with banner `The selected document could not be uploaded.`; failure `The document upload failed. Your previous response has not changed.`
  - Save/submit failure fallback: `We couldn’t save your application. Your responses are still here. Please try again.` Server messages shown as written: `This application changed in another tab. Your responses are retained. Reopen it to compare before saving.` (conflict), `Applications are closed for this club. Your saved draft is retained.`, `You must complete your unified profile before applying.`, `Update your profile to meet this club's SAT/ACT requirement before submitting.`, `This club has not set up their application pipeline yet.` (list from `actions/applications.ts`; may not be exhaustive).
- **Confirm dialog (`Review & submit` with no errors):** modal dialog, cannot be dismissed by tapping outside; close button hidden while submitting.
  - Title: `Ready to send your application?`
  - Body: `You’re applying to {club name}. Your answers cannot be edited after submission.`
  - Line with `Check` 16 px: `{completed} of {required} required responses added`
  - Buttons, right-aligned, wrap: `Keep editing` (outline) | `Submit application` (primary; `Submitting…` while busy)
- **After submit:** the view stays on the same application, which is now read-only (see States), and the notice line under the header shows `Your application was submitted successfully.`
- **Icons:** `ArrowLeft` (back, 16 px), `FilePenLine` (Draft status), `Check` (dialog line).
- **Behaviour:**
  - Autosave on change and on blur; draft restore from the device if a save was interrupted. Leaving (back button, profile links) first flushes pending saves.
  - `Save draft` validates without the "required" rule, saves, then shows `Draft saved to your account.`
  - Editing a field clears its error and any banner.
  - Number buttons and `Continue to next response` move focus only; nothing paginates. All questions are on one scrolling page.
  - Whole fieldset is disabled while saving/uploading/submitting.
  - No delete-draft or withdraw action exists anywhere in the student application UI.
- **States:**
  - Loading the page: skeleton with label `Preparing your applications…`.
  - Load error: heading `Your applications couldn’t load`, text `Your saved responses haven’t changed. Please try again.`, outline button `Try again`.
  - Signed out: heading `Sign in to manage your applications`, text `Sign in to view your applications and save responses to your account. Preview activity does not submit an application to a club.`, button `Go to sign in`.
  - Closed / deadline passed: note `Applications are closed. You can still save your draft.`; `Review & submit` disabled; `Save draft` still works. (On the list the card shows `Deadline · … · Applications closed`, text `Applications are closed, so this draft can’t be submitted. You can still view or save it.` and the button becomes outline `View draft`.)
  - Read-only submitted responses (same slot as the form, reached after submit or via `View submitted responses`): header shows `StatusPill` and `Submitted {date}` (device locale and device time zone, e.g. `Nov 12, 2026, 4:05 PM`, no "Eastern Time"); a bordered row `Your responses are saved and read-only after submission.` with outline button `View status` + `ArrowRight`; section heading `Your submitted responses`; per question: `Question {n}` (12 px muted), prompt (Libre Caslon 17 px weight 600), answer (14 px, line-height 28 px, muted) or `No response provided.`; file answers render the link `Open submitted document` (new tab); none: `No club-specific questions.`

---

### 53 · Application status detail (In review)

- **Route:** `/applications?tab=in-review` (in-page state after `View details`)
- **Screenshot:** `docs/mobile/screenshots/web/53-application-status-in-review.png`
- **Source:** `components/applications/application-status-detail.tsx`, `application-status-card.tsx` (`ApplicationStatusProgress`, `applicantDate`), `application-tracker.css`, `lib/application-presentation.ts`, `lib/student-applications.ts` (`applicationNextStep`), `lib/application-status.ts`
- **Layout (top to bottom):** container `.oc-application-detail`, max-width 768 px, vertical gap 20 px, bottom padding 24 px
  1. Back button: ghost, small; `ArrowLeft` 16 px + `Status`.
  2. Header (flex, top-aligned, gap 16 px): club logo (first two characters of the name as fallback) | eyebrow `Application progress` (12 px weight 600 muted) / `h1` club name (Libre Caslon 26 px) / `Submitted {date} · Eastern Time` (12 px muted, 8 px above).
  3. Notice line (`role="status"`, hidden when empty).
  Seeded (capture): logo `Wo`, eyebrow `Application progress`, `h1` `Women in Quant Finance Circle` (wraps to two lines), `Submitted Nov 13, 2026, 11:55 PM · Eastern Time`; card `h2` `Submitted` + pill `Submitted` (`Send` icon), `Current club round · Application Review`, `Your application is submitted. No further action right now.`; stepper `Submitted → Application Review → Interview → Final Deliberation → Decision` on two lines with `Application Review` current. No recorded-interviews box. The application sits on the `In review` tab but its status is `Submitted`.
  4. Status card (`.oc-status-detail-update`): padding 16 px, 1 px edge, **3 px left rule `#e57200`** (always, on every status), radius 16 px, glass/`#fffefa` surface, soft shadow.
     - Row: `h2` status label (20 px weight 600) + `StatusPill` (same label again with icon).
     - `Current club round · {round name}` (14 px muted; only for non-decision statuses with a round).
     - Next-step sentence (14 px, line-height 24 px, muted).
     - Stage stepper (20 px above).
  5. `Recorded interviews · {n}` disclosure (only when the application has bookings; for an Interview-round application only bookings from earlier rounds). Rounded 16 px bordered box, summary min-height 44 px 14 px weight 500. Rows: `CalendarDays` 16 px, start `{date} · Eastern Time`, then 12 px muted `Ends {date} · Eastern Time · {location}` (or `Location not provided`).
  6. Footer actions (top border, 16 px padding-top, wrap, gap 8 px): `View submitted responses` + `ArrowRight` (outline) | `CalendarDays` + `Open calendar` (ghost).
- **Stepper (`.oc-status-stages`):** a wrapping inline list, 12 px text, gap 6 px × 14 px, 16 px margin above and below. Each stage = 6.4 px dot + name; a `→` separates stages. Stages = `Submitted` (unless the club has a round literally named "Applied"/"Application(s)") + the club's pipeline rounds in order + `Decision` (unless a round is named "Decision(s)"). Seeded: `Submitted → Application Review → Interview → Final Deliberation → Decision`.

| Stage state | Text | Dot |
|---|---|---|
| Earlier than current | `#232d4b` | filled `#232d4b` |
| Current (`aria-current="step"`) | `#232d4b`, weight 600 | filled `#e57200` with 3 px `#fceadd` halo |
| Later | `#52606d` | 1 px outline, empty |

- **Status copy per status:**

| Status | `h2` / pill | Next-step sentence |
|---|---|---|
| `SUBMITTED` | `Submitted` | `Your application is submitted. No further action right now.` |
| `IN_REVIEW` | `In review` | `The club is reviewing your application.` |
| `INTERVIEWING` | `Interview` | `Check your interview details and calendar.` |
| `ACCEPTED` | `Accepted` | `You’ve been accepted. Check the club’s instructions for next steps.` |
| `REJECTED` | `Not selected` | `The club has not selected your application this time.` |
| `WAITLISTED` | `Waitlisted` | `You’re on the waitlist. A place is not confirmed yet.` (+ `No decision date has been provided on OutClass.` when no letter) |

- **Icons:** `ArrowLeft`, `ArrowRight`, `CalendarDays`, plus the status icon.
- **Behaviour:**
  - `Status` returns to the list on the same tab.
  - `View submitted responses` swaps to the read-only responses view (described under 52 States); its `View status` button returns here.
  - `Open calendar` navigates to `/calendar`.
  - There is no "Refresh status" button and no withdraw action. The list and this detail re-read quietly when the tab regains focus or applications change elsewhere.
- **States:** background refresh failure shows on the list only: `Couldn’t update your applications. Showing what was last loaded.` (12 px muted).

---

### 54 · Interview booking (not yet booked)

- **Route:** in-page on `/applications?tab=interviews` after `Review interview`; standalone link `/interviews/book?clubId=<uuid>&roundId=<uuid>` (focus frame)
- **Screenshot:** `docs/mobile/screenshots/web/54-interview-booking.png` (+ `54b…` if captured)
- **Source:** `components/applications/application-status-detail.tsx`, `components/interviews/applicant-booking.tsx`, `booking-picker.tsx`, `scheduling.css`, `booking-link-page.tsx`, `app/(focus)/interviews/book/page.tsx`, `lib/interview-rooms.ts` (`slotTime`, `dayKey`), `actions/interview-rooms.ts` (error copy)
- **Layout, in-page version (top to bottom):** items 1–4 of screen 53 with: eyebrow `Application progress`, status `h2` `Interview` + pill `Interview`, `Current club round · Interview`, sentence `Check your interview details and calendar.`, stepper with `Interview` current. Then:
  5. Section heading `h2` `Book your interview` (20 px weight 600, 16 px below; 28 px margin above and below the section).
  6. Optional line (14 px muted): `{n} time is hidden because it overlaps another interview you’ve booked.` / `{n} times are hidden because they overlap another interview you’ve booked.`
  7. Booking card (`.ir-booking`): single column at phone width, 1 px edge, radius 16 px, hairline shadow, overflow hidden.
     - Intro block: padding 16 px, bottom border; renders as a pale blue-grey band in the capture (CSS: 30 % `#edeee9` over `#fffefa`, on the glass surface). All text `#232d4b`.
       - `h2` = round name (seeded `Interview`; fallback `Your interview`), 15 px weight 600. (Club-name eyebrow and the calendar symbol are hidden in this in-page version.)
       - `Choose a day, select a time, then confirm your interview.` (14 px, 6 px above)
       - Inline details, 14 px, each with a 16 px icon, 10 px above, 16 px apart: `Clock3` `{duration} minute interviews` (several durations joined with ` / `, e.g. `20 / 30 minute interviews`); `MapPin` room name when one room, else `{n} rooms available`.
       - `Eastern Time` (12 px weight 500, 10 px above).
     - Body block, padding 20 px:
       - Notice line (14 px; empty until an action completes).
       - `Location` filter (only when more than one open room): label `Location` (14 px weight 500) then compact pill group: `All rooms` (default) + one pill per room name.
       - Date section (`aria-label` `Choose interview date`): row with month title (Libre Caslon 17 px weight 600, e.g. `November 2026`) and two ghost icon buttons `ChevronLeft` / `ChevronRight` (`aria-label` `Previous month` / `Next month`). Below: 7-column grid, gap 5 px; weekday row `Su Mo Tu We Th Fr Sa` (12 px muted); day buttons are circles (aspect 1:1) showing the day number, 14 px weight 600.
       - Time section (`aria-label` `Choose interview time`), below the calendar with 16 px gap: title = selected day as `Tue, Nov 24` (weekday short, month short, day; Libre Caslon 17 px) or `Select a date`; then `.ir-times`: **two-column grid**, gap 9 px, max-height 360 px with its own vertical scroll.
       - Selection footer (appears once a time is tapped): top border, 20 px padding-top, 24 px above. Left: bold `{Tue, Nov 24} · {3:15 PM} – {3:45 PM}` (14 px), `Eastern Time` (12 px muted), room location (14 px muted). Then a full-width 44 px primary button `Confirm interview`.
       - Error line (`role="alert"`, 14 px `#ac3544`).
  8. `Recorded interviews · n` and footer actions as in 53.
- **Seeded (capture, Lawn Street Capital):** logo `La`; `Submitted Nov 14, 2026, 7:55 AM · Eastern Time`; card `Interview` + pill `Interview`, `Current club round · Interview`, stepper with `Interview` current; heading `Book your interview`; `1 time is hidden because it overlaps another interview you’ve booked.`; intro `Interview` / `Choose a day, select a time, then confirm your interview.` / `30 minute interviews` / `Interview Room` / `Eastern Time`; month `November 2026`; only the 24th (selected) and 26th are enabled; times under `Tue, Nov 24`: `10:00 AM`, `10:45 AM`, `11:30 AM`, `1:00 PM`, `1:45 PM`, `2:30 PM` all `Full` (dashed, faded), and `4:00 PM` available. Nothing is selected, so no footer or `Confirm interview` button is on screen until a time is tapped. The selected day shows an orange ring around the navy circle in the capture (the focus ring colour; whether it shows without keyboard focus is unverified).
- **Calendar day and time button states:**

| Element | State | Treatment |
|---|---|---|
| Day | Has open times | background 8 % `#232d4b` over `#fffefa`, text `#232d4b` |
| Day | Selected (`aria-pressed`) | background `#232d4b`, text `#ffffff` |
| Day | No times / disabled | transparent, muted text at 40 % opacity |
| Time | Available | 1 px border (45 % `#232d4b` mixed into `#dfe3dd`), radius 10 px, padding 12 px 8 px, centred, text `#232d4b`; bold time 14 px; optional 12 px second line |
| Time | Selected | background `#232d4b`, text `#ffffff` |
| Time | Full | disabled, 40 % opacity, dashed border, second line `Full` |
| Time | The student's current booking | border `#296448`, background `#edf5ef`, text `#296448`, second line `Your interview` |

  Time label = `toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true })` → `3:15 PM`. Second line = room name (only when more than one room is open) and/or `Your interview` / `Full`, joined with ` · `. The first day with open times in the shown month is selected by default. Only future times are listed; days are Eastern calendar days.
- **Exact copy:**
  - Confirm button: `Confirm interview`; while saving `Saving…`.
  - Success notice (and screen-reader announcement): `Interview confirmed for {Nov 24, 2026, 3:15 PM} at {location}.`
  - No times at all and not booked: boxed note `No interview times are available right now. Your invitation is still recorded; check again later or contact the club. ` + underlined link `Back to application status` (to `/applications?tab=interviews`).
  - Nothing in the shown month: `No available times this month. Try another month or location.` (12 px muted)
  - Times not open: `Interview times aren’t open yet. Check back later or contact the club.` Paused: `The club has paused new interview times. Your interview is still booked.`
  - Alumni account: `Alumni accounts can’t book, move or cancel interviews. Your past interviews stay in your history.` (no times shown)
  - Load failure: `Could not load interview times.` + outline `Try again`. Loading: `Loading interview times…`.
  - Save failure fallback: `Could not confirm your booking update. Check your reservation and available times, or reload and retry.`
  - Server messages shown as written: `That time was just booked. Choose another slot.` / `This slot is no longer available.` / `You already have an interview at that time.` / `You already have an interview with this club. Contact the club before booking another time.` / `Interview times aren’t open for your round right now.` / `An interview invitation is required to book a time.` / `Many people are booking right now. Please try again in a moment.` / `This time can no longer provide an approved, fully staffed interview. Your current reservation is retained. Choose another time or contact the club.`
  - There is no free-text "club instructions" block in the booking UI; the only instruction line is the fixed intro sentence.
- **Icons:** `Clock3`, `MapPin`, `ChevronLeft`, `ChevronRight` (16 px); `CalendarDays` 22 px in a 44 px rounded tile (standalone route only).
- **Behaviour:**
  - Tap day → times for that day; tap time → footer with `Confirm interview`; changing month, day or room clears the selection.
  - After a successful reserve the schedule is re-read; if the re-read fails twice the saved time is shown from the response. The Applications list refreshes (`Interview saved. Your application will update shortly.` if that refresh fails).
  - A failed reserve re-reads the times so taken slots disappear.
- **Standalone route `/interviews/book`:** focus frame (see 67 for the chrome): bar task label `Book your interview`, `Exit` goes to the last product page or `/home`. Page `h1` `Book your interview`. The booking card is the same, with the club name as an uppercase 12 px eyebrow (letter-spacing .08em), the 44 px `CalendarDays` tile, 28 px intro padding and no extra section heading.
  - Signed out: `This is an invitation to choose an interview time with a club you applied to. Sign in with the account you applied with to see the available times.` + button `Sign in` → `/login?next=/interviews/book?clubId=…&roundId=…` (URL-encoded).
  - Invalid/expired link: panel heading `Interview invitation unavailable`, text `This invitation has expired, or it’s no longer available for this round. Check your applications for your current interview.`, link `Your applications` → `/applications`.
  - Error: `Could not load this invitation. Please retry.` + link-style `Retry invitation`. Loading: `Loading your invitation…`.

---

### 55 · Interview booked

- **Route:** in-page on `/applications?tab=interviews` after `View details` (Corner Code Collective)
- **Screenshot:** `docs/mobile/screenshots/web/55-interview-booked.png`
- **Source:** same as 54
- **Layout (top to bottom):** as 54, with these differences:
  1. Section heading `h2` becomes `Your interview`.
  2. Intro sentence: `Your time is reserved. You can reschedule before the interview starts.` (rescheduling allowed) or `Your time is reserved. Contact the club if you need a different time.` (not allowed). Past booking: `Your recorded interview details are below.`
  3. Confirmed card at the top of the body (`.ir-confirmed`): flex, gap 12 px, padding 16 px, margin-bottom 22 px, 1 px `#dfe3dd` border, radius 10 px, background `#edf5ef`, all text `#296448`, 14 px. `CheckCircle2` 20 px, then:
     - bold `Interview confirmed` (past: `Recorded interview`)
     - `{date}` → seeded `Nov 24, 2026, 3:15 PM` (no "Eastern Time" on this line; the zone label is in the intro block)
     - location → seeded `Student Union 215`
     - `Choose another time below to reschedule.` (12 px; only when rescheduling is allowed and the interview has not started)
     - ghost small button `Cancel interview` (only when the club allows cancelling and the interview has not started)
  4. Calendar and times as in 54; the booked slot is the green `Your interview` time button.
- **Seeded (capture, Corner Code Collective):** logo `Co`; `Submitted Nov 3, 2026, 8:55 PM · Eastern Time`; heading `Your interview`; intro `Interview` / `Your time is reserved. You can reschedule before the interview starts.` / `30 minute interviews` / `Interview Room` / `Eastern Time`; green card `Interview confirmed` / `Nov 24, 2026, 3:15 PM` / `Student Union 215` / `Choose another time below to reschedule.` / `Cancel interview`; times under `Tue, Nov 24`: six `Full`, then `3:15 PM` + `Your interview` (green) and `4:00 PM` (available). The intro names the room (`Interview Room`) while the card shows its location (`Student Union 215`).
- **Exact copy:**
  - The Interviews-tab list card line (not this detail) is `Interview · Nov 24, 2026, 3:15 PM · Eastern Time` with `CalendarDays` 16 px, then `Student Union 215`.
  - Cancel is an inline confirm inside the green card, not a dialog: text `Release your reserved time?` then `Yes, cancel` (destructive, small) and `Keep interview` (outline, small). Tapping `Cancel interview` again toggles it closed.
  - After cancelling: notice `Booking cancelled. Your reserved time has been released.`; the section returns to the 54 state.
  - Reschedule: pick another time → footer button reads `Confirm new time` (disabled when the selected time is the current booking, or when rescheduling is not allowed). Success: `Interview rescheduled for {date} at {location}.`
  - Rescheduling not allowed: extra line `This club requires you to contact them to reschedule.`
  - Server refusals: `This interview has already started. Contact the club to change it.` / `This club does not allow self-service cancellation. Contact the club; your reservation is retained.` / `This club does not allow self-service rescheduling. Your original reservation is retained; contact the club.` / `We couldn’t find that interview.`
- **Icons:** `CheckCircle2` 20 px; others as 54.
- **Behaviour:**
  - Rules: reschedule and cancel are per-round club settings (`bookingAllowRescheduling`, `bookingAllowCancellation`); both stop once the start time has passed. There is no hours-before cutoff in the client.
  - "Booked" means the booking's end time is still in the future; after that the heading returns to `Book your interview` and the card reads `Recorded interview`.
  - There is no add-to-calendar/.ics control here. The only calendar affordance is the footer button `Open calendar` (→ `/calendar`).
- **States:** as 54.

---

### 56 · Decision: not selected (status detail)

- **Route:** in-page on `/applications?tab=decisions` after `View details` (Albemarle Data Science Circle)
- **Screenshot:** `docs/mobile/screenshots/web/56-decision-rejected.png`
- **Source:** `components/applications/application-status-detail.tsx`
- **Layout (top to bottom):** same frame as 53 with:
  1. Back button `Status`.
  2. Header eyebrow `Decision received`; `h1` club name; `Submitted {date} · Eastern Time`.
  3. Status card: `h2` `Not selected` + pill `Not selected` (`XCircle`, icon `#ac3544`); no "Current club round" line; sentence `The club has not selected your application this time.`; then either
     - primary button `View Decision` → `/applications/{applicationId}/decision` (when a published letter exists), or
     - `Formal letter unavailable for this historical decision.` (12 px muted) when there is none;
     then the stepper with `Decision` current and all earlier stages filled navy.
  4. `Recorded interviews · n` (all bookings), footer actions `View submitted responses`, `Open calendar`.
- **Exact copy:** as above. The Decisions-tab list card for this application shows sub-line `Decision received`, label `Not selected`, sentence `The club has not selected your application this time.`, outline button `View details`.
- **Icons:** `ArrowLeft`, `XCircle`, `ArrowRight`, `CalendarDays`.
- **Seeded (capture):** logo `Al`; `h1` `Albemarle Data Science Circle` (two lines); `Submitted Nov 10, 2026, 7:55 PM · Eastern Time`; card `Not selected` + pill, the sentence, then the navy pill `View Decision` → `/applications/37972775-…/decision` (the letter exists, so the "letter unavailable" line is not shown); stepper with all four earlier stages filled navy and `Decision` current.

### 57 · Decision letter (not selected)

- **Route:** `/applications/<applicationId>/decision` (optional `?letterId=<id>` for a historical letter); focus frame
- **Screenshot:** `docs/mobile/screenshots/web/57-decision-letter-rejected.png`
- **Source:** `app/(focus)/applications/[applicationId]/decision/page.tsx`, `components/communications/decision-letter.tsx`, `decision-letter.css`, `lib/decision-letters.ts`, `components/shell/focus-frame.tsx`
- **Layout (top to bottom):**
  1. Focus bar (sticky, 56 px): OutClass mark 28 px, task label `Decision letter` (14 px weight 600), pill `Exit` with `X` 16 px → `/applications?tab=decisions`. No dock, no page `h1` outside the letter. Content padding 10 px top, 16 px sides and bottom.
  2. Actions row (24 px below): outline button `Print letter`.
  3. Letter paper (`article`, `aria-label` `Formal decision letter`): background `#fffefa`, 1 px `#e0e5e3` border, **4 px top border in the club accent colour** (club colour, else `#232d4b`), soft shadow, square corners, padding 36 px 24 px 28 px. A second hairline frame sits 8 px inside the edge (20 % accent). Whole letter is **Libre Caslon**, 15.5 px, line-height 1.8, ink `#1f2a3a`; sans-serif details use Source Sans in `#5b6676`.
     - Masthead (centred, gap 8 px): club logo 56 px (only when the letter has a logo); club name in small caps, 18 px weight 600, letter-spacing .12em, accent colour; `RECRUITMENT CORRESPONDENCE` (Source Sans 12 px weight 600, uppercase, letter-spacing .24em); a double rule in the accent colour (2 px over 1 px, 20 px above).
     - Meta row (Source Sans 13 px, space-between, wraps; 26 px above, 34 px below): left `TO` (12 px weight 600 uppercase, letter-spacing .18em) + recipient full name; right the date, `November 18, 2026` style (`en-US`, long month, UTC).
     - Title `h1`: centred, 25 px weight 500, line-height 1.25, 34 px below. Default `Your recruitment decision`.
     - Salutation: `Dear {full name},`
     - Body paragraphs (18 px vertical margin, hyphenated). The first paragraph has a drop cap (3.35 em, accent colour).
     - Close row (40 px above, bottom-aligned, wraps): signature block = closing line, a 240 px signature rule (46 px above), signer in small caps weight 600 | club seal 88 px, rotated −8°, 82 % opacity, accent colour: ring text `{CLUB NAME} · RECRUITMENT · ` and up to three initials (minor words skipped).
     - Optional footer note (Source Sans 13.5 px muted).
     - Bottom line (top rule `#e4ded2`, 40 px above): `DELIVERED SECURELY THROUGH OUTCLASS` (Source Sans 12 px, uppercase, letter-spacing .16em, centred).
  4. For a rejection there is no response section below the letter (it appears only for acceptances, historical letters, a suspended club, or an error).
- **Seeded (capture):** accent is the club colour, a teal (top border, club name, double rule, drop cap `T`, seal). No logo in the masthead. Club name wraps to two centred lines. Meta row: `TO Sam Staging-Student` left, `November 18, 2026` right. Title on two lines. The seal (`ALBEMARLE DATA SCIENCE CIRCLE · RECRUITMENT ·`, initials `ADS`) wraps below the signature block, left-aligned. Body text is hyphenated mid-word at this width (`re-cruitment`, `ef-fort`, `appreci-ate`, `in-spire`). The seeded letter uses the default template text below verbatim.
- **Exact copy (default rejection template; a club may replace title, body, closing, signer, footer):**
  - Title: `Your recruitment decision`
  - Body: `Thank you for your interest in {club} and for sharing your time and experiences with us.` / `After careful consideration, we are unable to offer you membership through this recruitment process. We recognize the effort that goes into applying and appreciate the opportunity to learn about you.` / `We wish you every success in finding communities and opportunities that inspire you.`
  - Closing: `Sincerely,`; signer: `{club}`; footer: empty.
  - Waitlist default: title `Your recruitment decision`; body `Thank you for your interest in {club} and for the time you devoted to your application.` / `We are writing to let you know that you have been placed on our waitlist. We appreciate the opportunity to learn about you. A place on the waitlist does not guarantee a future offer of membership.` / `If your decision changes, we will share an update through OutClass. Thank you for your patience and continued interest.`; closing `Sincerely,`.
- **Icons:** `X` (Exit). The seal is custom SVG.
- **Behaviour:** opening the letter marks its notification read. `Print letter` calls the browser print dialog (letter-only print stylesheet). The letter stays light in every theme.
- **States:**
  - Loading: `Opening your decision letter…` (document skeleton).
  - Unavailable: `h1` `Decision letter unavailable`; alert `This letter could not be loaded. Sign in to the account that submitted the application and try again.` or `A formal letter is unavailable for this historical decision.`; link `Return to Status` → `/applications?tab=decisions`.
  - Decision without a letter: paper with `h1` `Your decision` and `Your application is {status in lower case}. A formal letter was not issued for this decision.`
  - Historical letter: `This is a historical letter. Your current decision is {status}. Offer controls reflect your current record.`
  - Read-state failure: `Your letter is available, but notification read state could not be saved. Please try again.`

---

### 58 · Offer pending (status detail)

- **Route:** in-page on `/applications?tab=decisions` after `Review offer` (Rotunda Equity Research Society)
- **Screenshot:** `docs/mobile/screenshots/web/58-offer-pending.png`
- **Source:** `components/applications/application-status-detail.tsx`, `recruitment-offer.tsx`, `application-status-card.tsx`
- **Layout (top to bottom):** same frame as 56 with eyebrow `Decision received`, `h2` `Accepted` + pill `Accepted` (`CheckCircle2`, icon `#296448`), sentence `You’ve been accepted. Check the club’s instructions for next steps.`, then one of two variants:
  - **A. A published acceptance letter exists:** primary button `View Decision` → the letter route (screen 59). No inline accept/decline here.
  - **B. No letter:** line `Formal letter unavailable for this historical decision.` then an inline offer box (`aria-label` `Club offer`): 16 px above, 1 px border, radius 16 px, background `#f6f5f1`, padding 16 px:
    - `h3` `Congratulations! Join {club name}` (weight 600)
    - `Accept your offer to become a club member. Respond by {date}.` (14 px muted)
    - buttons (16 px above, wrap, gap 8 px): `Accept Offer` (primary) | `Decline Offer` (outline)
  Then the stepper (`Decision` current) and the usual footer actions.
- **Seeded (capture): variant A.** Logo `Ro`; `h1` `Rotunda Equity Research Society` (two lines); `Submitted Nov 3, 2026, 6:55 AM · Eastern Time`; card `Accepted` + pill, `You’ve been accepted. Check the club’s instructions for next steps.`, navy pill `View Decision` → `/applications/84f4f4dc-…/decision`; stepper; footer actions. The screen reached by `Review offer` therefore shows no offer wording, no deadline and no Accept/Decline; those are one more tap away on the letter (59).
- **Exact copy:**
  - List card (Decisions tab, from the dump): sub-line `Membership offer ready`, label `Accepted`, sentence `Accept or decline your club offer.`, primary button `Review offer` + `ArrowRight`; the card has a 3 px left rule `#e57200` because it needs action.
  - Expiry date format: `new Date(expiresAt).toLocaleDateString()` = device locale short date in the device time zone, e.g. `11/25/2026`. Not the Eastern format used elsewhere.
  - **No confirm dialog** for Accept or Decline: one tap sends the response. Buttons disable while saving.
  - After accept: `Your offer was accepted. Your club membership is recorded.` + outline button `Open My Clubs` (→ `/clubs`) + `Current membership access is managed by the club.` (12 px muted)
  - After decline: `You declined this offer. Your accepted recruitment decision remains recorded.`
  - Expired: `This offer has expired. Contact the club with questions.` Rescinded: `This offer has been rescinded. Contact the club with questions.` No offer issued: `The club has not issued an offer on OutClass. Contact the club for joining instructions.`
  - Errors (`role="alert"`): `Your response could not be saved. Try again.` / `Your membership is inactive. Contact an organization owner about reinstatement; this offer cannot restore access.`
  - Alumni account: buttons replaced by `Alumni accounts can’t accept or decline offers or invitations. Your past decisions stay in your history.`
- **Icons:** `CheckCircle2`, `ArrowLeft`, `ArrowRight`, `CalendarDays`.
- **Behaviour:** an offer counts as pending only while `expiresAt` is in the future; once past, the list card loses its orange rule and reads `Decision received` / `View details`.

### 59 · Offer letter (acceptance)

- **Route:** `/applications/<applicationId>/decision`; focus frame as 57
- **Screenshot:** `docs/mobile/screenshots/web/59-offer-letter.png`
- **Source:** as 57, plus `components/communications/decision-celebration.tsx`
- **Layout (top to bottom):**
  1. Focus bar as 57.
  2. `Print letter` (outline).
  3. Acceptance banner (current, live acceptances only): card with 1 px border, radius 16 px, padding 18 px 22 px, 20 px below; `PartyPopper` 30 px in `#232d4b`; title `Congratulations, {first name}!` (Libre Caslon 22 px); text `{club} would love to have you. Read your letter, then respond below.` (14 px muted); outline button `RotateCcw` + `Celebrate again` (hidden when the club chose no celebration).
  4. **Response box, placed before the letter while the offer is pending** (1 px border, radius 16 px, padding 20 px, 24 px below, left-aligned column, gap 16 px): `h2` `Your invitation`; `Please respond by {device-locale short date}.`; buttons `Accept Offer` (primary) | `Decline Offer` (outline), gap 12 px.
  5. Letter paper as 57, with the title in the accent colour for acceptances.
  6. When the offer is no longer pending, the response box moves **below** the letter and shows a single sentence instead of buttons.
- **Seeded (capture):** banner `Congratulations, Sam!` / `Rotunda Equity Research Society would love to have you. Read your letter, then respond below.` with the party icon at the left and `Celebrate again` on its own row beneath; box `Your invitation` / `Please respond by 12/9/2026.` / `Accept Offer` (navy pill) `Decline Offer` (cream pill) side by side; letter accent is a dark brick red (top border, club name, rule, title, drop cap `O`, seal `ROTUNDA EQUITY RESEARCH SOCIETY · RECRUITMENT ·` / `RER`); date `November 18, 2026`; title on three lines; body paragraph 3 reads `Please review your offer below and respond by December 9, 2026. …`. Default template text, verbatim. Page is about 1,770 px tall.
- **Exact copy:**
  - Default acceptance letter: title `Congratulations, and welcome to {club}`; body `On behalf of everyone at {club}, it is our great pleasure to offer you membership. Congratulations!` / `Your application, and the care and thought you brought to every stage of recruitment, stood out to us. We are genuinely excited about the perspective, curiosity, and energy you will bring to our community.` / `Please review your offer below and respond by {Month D, YYYY}. We very much hope you will say yes, and we look forward to welcoming you.`; closing `With warm congratulations,`; signer `{club}`. (The template says "review your offer below" but the response box is above the letter while pending.)
  - No confirm dialogs: Accept and Decline act on one tap.
  - After accept: `Your offer was accepted. Your membership is recorded. Current access is managed by the club.` + link `Open My Clubs` with `ArrowRight` → `/clubs`. A celebration animation plays (confetti by default; fireworks/sparkles/none per club; skipped under reduced motion).
  - After decline: `You declined this offer. Your letter remains available.`
  - Expired: `This offer has expired.` Revoked: `This offer is no longer active. Contact the club with questions.` None: `There is no active offer associated with this decision.` Suspended club: `This club is suspended. Offer responses are currently unavailable.`
  - Errors: `Your response could not be saved. Refresh and try again.` / `Your membership is inactive. Contact the club about reinstatement.` / `Your response was recorded. Reload My Clubs to refresh membership access.`
- **Icons:** `PartyPopper`, `RotateCcw`, `ArrowRight`, `X`.
- **Behaviour:** the celebration auto-plays once per letter per device (remembered in local storage), only for a current, un-expired acceptance.

---

### 67 · Leader voting room (before starting)

- **Route:** `/voting/rooms/<sessionId>?clubId=<uuid>&view=leader` (optional `&cycleId=…&roundId=…`; `view` omitted = member ballot, `view=present` = projector). Both ids must be UUIDs, otherwise the page is just `h1` `Invalid voting session link`.
- **Screenshot:** `docs/mobile/screenshots/web/67-leader-voting-room.png` (+ `.viewport.png`)
- **Source:** `app/(focus)/voting/rooms/[sessionId]/page.tsx`, `components/live-voting/room-view.tsx`, `leader-room.tsx`, `room-meeting.tsx` (`LeaderControls`), `round-tracker.tsx`, `vote-status.tsx`, `session-details.tsx`, `room-back-link.tsx`, `ballot-privacy-note.tsx`, `audience-slide.tsx` (`LeaderApplicant`), `room-names.ts`, `room.css`, `components/qr/qr-code-card.tsx`, `components/shell/focus-frame.tsx/.css`, `lib/focus-routes.ts`, `lib/voting-room.ts`
- **Focus-frame chrome:** no product header and no dock. Sticky bar: min-height 56 px, background `#fffefa`, bottom border `#dfe3dd`, padding 8 px 16 px, gap 12 px. Left: OutClass mark 28 px. Middle: task label **`Voting controls`** (14 px weight 600, single line, ellipsis); the club name + accent dot is hidden at ≤640 px. Right: `Exit` pill (min-height 44 px, 1 px border, radius 999 px, padding 0 14 px, 14 px weight 500, `X` 16 px) → last visited product page, else `/home`. Content padding 10 px top, 16 px sides/bottom. Page background `#f6f5f1`.
- **Layout (top to bottom), session in `DRAFT` (not started):** single column at phone width
  1. Back link: `Back to Voting room` (underlined text link, 14 px, min-height 44 px) → `/club/<clubId>/workspace?section=recruitment&tool=decisions&decisionTab=voting` (+ `cycleId`, `roundId`).
  2. Page header: `h1` **`Lead voting`** (Libre Caslon, 23 px, weight 500) with a status line beside/below it: `{round name} · {cycle name}` (15 px muted).
  3. Toolbar (wraps, gap 8 px, all min-height 44 px):
     - `Show on projector` (outline, small; opens `…&view=present` in a new tab)
     - `Vote on my phone` (outline, small; → `…&view=member`)
     - segmented control, `aria-label` `Projector theme`: `Dark` (default) | `Light`
     - `More` + `ChevronDown` 16 px (ghost; chevron rotates when open) → popover
  4. Top border, then the main column (padding-block 24 px, gap 24 px):
     - Waiting-room block: `h2` `Ready when your leader is` (Libre Caslon 20 px weight 400); `Voting has not started.`; the **join QR card**: a white card with large radius (about 24 px) and 1 px border, containing, top to bottom, left-aligned: the 184 px navy OutClass QR with centre monogram in its own rounded white tile; title `Join this voting session` (Libre Caslon); `Sign in with your club account.` (muted); the short link as underlined text (seeded `http://localhost:3000/q/MOitxH`, i.e. `{origin}/q/{code}`); then small pill buttons in two rows: `Download PNG`, `Download SVG` (`Download` icon) and `Copy link` (`Copy` icon; → `Copied`), `Present` (expand icon; opens the full-screen presenter dialog). The QR encodes that first-party short link to the member view.
     - `Preview applicant` label + native select, options `Applicant 1`, `Applicant 2`, … (first selected).
     - Applicant slide for the previewed applicant (leader variant, normal page flow): optional position line (15 px muted), optional photo 96 px radius 16 px, name `h2` (Libre Caslon 28 px weight 400, line-height 1.05), profile line (18 px, items separated by ` · `), facts grid (label 14 px, value 30 px, unit 16 px; top and bottom borders, vertical dividers), then notes in one column (16 px, line-height 1.5). Which fields appear is set per session in setup.
     - Discussion panel (only when the session has discussion enabled).
     - Status panel (top border, 20 px padding-top, 18 px text): bold `Voting has not started`; right side = position (empty before the start).
     - Leader controls: primary button **`Start session`** (full width, min-height 52 px, 17 px), then disclosure `More actions` with `MoreHorizontal` 18 px (14.4 px muted summary, min-height 44 px) containing `End voting` (outline, small) when the leader may end.
  5. Session overview (top border, padding-block 24 px, sections separated by borders with 22 px padding, each gap 10 px; section `h2` Libre Caslon 20 px weight 400):
     - **`Round progress`**: four counts in a 4-column grid, number above label (number 28 px weight 700, label 14 px muted): `Passed`, `Did not pass`, `Held`, `To go`; an 8 px segmented bar in the same order with 3 px gaps and a 2 px × 18 px target marker; meta line (14 px muted) `Target {n} to pass · {m} more to reach it · {k} sessions this round` / `No target set · 1 session this round` / when reached `Target of {n} reached · voting can continue` (weight 600, `#a04d00`); optional `Includes only voting sessions you can open.` While loading: `Loading…`; on failure: `Round totals unavailable.` Then disclosure `Session and round totals` → target line, pass-meaning note, `Guidance only. Reaching the target does not stop voting or reject anyone.`, and two groups `Decisions · This session` and `Decisions · Entire round · {k} sessions`, each with `Pass`, `Hold`, `Do not pass`, `Unreviewed` counts.
     - **`In the room`**: `**{n}** member joined` / `**{n}** members joined`; outline small button `Show join QR`; disclosure `Joined participants · {n}` listing `{name} · Joined` or `{name} · Waiting`.
     - **`Applicants`**: ordered queue, 15 px, rows `{position} · {applicant label}` left and state right (muted): `Voting now` / `Current` / `Up next` / `Passed` / `Held` (in `#a04d00`) / `Not passed`. Current row: background `#edeee9`, weight 600. Empty: `No applicants in this pass.`
- **Seeded (capture, nothing pressed):** bar `Voting controls` + `Exit` (here → `/meetings/<id>`, the last product page visited); `Back to Voting room`; `Lead voting`; `Final Deliberation · Spring 2027 Recruitment` on its own line under the title; toolbar on two rows: `Show on projector`, `Vote on my phone`, then `Dark` (selected, navy) / `Light` and `More ⌄`; divider; waiting block and QR card; `Preview applicant` select showing `Applicant 1` (options `Applicant 1`–`Applicant 8`); slide = name `Hana Stonebridge` and `Statistics · Second Year` only (no photo, facts or notes), followed by a large empty area (the stage has a 300 px minimum height); divider; `Voting has not started`; full-width navy pill `Start session`; `··· More actions`; divider; `Round progress` with `0` Passed, `0` Did not pass, `0` Held, `8` To go, an all-grey bar with the orange-brown target marker at 5/8, `Target 5 to pass · 5 more to reach it · 1 session this round`, `▸ Session and round totals`; `In the room`: `0 members joined`, `Show join QR`, `▸ Joined participants · 0`; `Applicants`: `No applicants in this pass.` (the queue is empty until the session starts, although eight applicants are in the session). Page is about 2,100 px tall; the first viewport ends inside the QR card, so `Start session` is roughly 1.5 screens down.
- **`More` popover** (`aria-label` `More session options`; width min(480 px, viewport − 32 px), max-height 70 dvh, padding 16 px, radius 6 px, gap 10 px): link `Prepare slides` (→ `/voting/rooms/<id>/prepare?clubId=…`); outline small button `Join QR`; session details block: session name (`h2` 16 px), time line (optionally ` · {n} minutes expected`), location, instructions, then link `Edit session` and outline small button `Cancel session` (`Cancelling…` / `Retry cancellation`), and, when voters were already told, a checkbox `Notify previously announced voters of cancellation · In-app; existing email preferences apply`.
  - Cancel confirm dialog: title `Cancel this voting session?`, body `It has not started. Applicant decisions and audit history are preserved.`, buttons `Keep session` | `Cancel this session` (danger).
- **Join QR dialog** (`Show join QR` / `Join QR`): title `Join live voting` and the same QR card; max-height 90 dvh, scrolls.
- **Controls by phase (listed from source; none were pressed):**

| Phase | Controls |
|---|---|
| Not started (`DRAFT`) | `Start session` (if scheduled for later, confirm: `Start this session early?` / `It is scheduled for later. Voting begins only when you open a ballot.` / `Start early`) |
| Applicant shown, ballot not open | `Open voting`; `Previous`; `Next: {name}` or `Next` (disabled until an outcome is confirmed) |
| Ballot open | `Close vote` (if ballots missing, confirm: `Close voting early?` / `{n} ballot is missing from members in the room. Missing ballots are not Do not pass votes.` (plural `{n} ballots are missing…`) / `Close voting now`); help line `After you close the vote, the totals show on the projector and you confirm Pass, Hold or Do not pass.` or, with a threshold rule, `After you close the vote, the rule decides ({rule}) and the result shows on the projector.` |
| Ballot closed, no rule | heading `Confirm outcome`; `Pass {a} · Hold {h} · Do not pass {r} · {m} missing`; `Leading choice: {Pass/Hold/Do not pass}` or `Tie or no ballots. Choose an outcome and record a reason.`; field `Decision reason`; buttons `Pass`, `Hold`, `Do not pass` (non-leading choices need a reason) |
| Ballot closed, rule applies | heading `Voting rule result`; totals line; rule summary; `Confirm Pass` / `Confirm Hold` / `Confirm Do not pass`; or, with no rule outcome, `Hold the applicant for another vote, or decide explicitly with a reason.` + `Hold for another vote`, `Pass`, `Do not pass` |
| Any open phase, under `More actions` | `Pass without vote`, `Do not pass without vote` (need `Reason for deciding without a vote`; confirm titles `Pass {name} without a vote?` / `Do not pass {name} without a vote?`, confirm buttons `Pass, no vote` / `Do not pass, no vote`); `End voting` (confirm `End voting?` / `{h} Hold and {u} Unreviewed applicants will remain unresolved. No messages will be sent.` / `End voting now`); `Correct an outcome` → `Applicant to return to Hold` select, `Correction reason`, `Return to Hold` |
| After a decision | line `{name} {Passed/Held/Not passed} by {leader}` + ghost `Undo`; `Previous` undoes the last decision |
| Between passes (`PAUSED`) | `Review held applicants`; `End voting`; `Voting summary` lists `Passed · Provisional`, `Hold`, `Do not pass`, `Unreviewed` (`None` when empty); disclosure `Voting-pass history` |
| Ended (`COMPLETED`) | `Session ended. Unresolved applicants and saved votes are preserved. No applicant notifications were sent.`; `Finalize decisions` (`Passing means` select: `Choose recruitment mapping`, `Advance to {round}`, `Final club admission (membership offer)`; `Preview final decisions` → dialog `Confirm recruitment changes` with `Confirm and finalize decisions` / `Back to summary`); after finalizing `Decisions finalized. Finalization did not send applicant messages.` + link `Open applicant communications` + `Send applicant notifications` |

  At ≤700 px the navigation row stacks full width with the primary action first, then `Previous`, then `Next`.
  Status panel labels: `Voting has not started`, `Waiting for voting`, `Voting open`, `Voting paused`, `Vote closed` (+ ` · next: {name}`), `Waiting for the leader`, `Voting ended`. While open the right side becomes an 8 px meter (track `#e3e6e0`, fill `#232d4b`) and `**{voted}** of {eligible} in the room voted`.
- **Vote vocabulary and colours:** three ballot choices only. There is no "Fringe" choice anywhere in the voting source.

| Code | Ballot / button label | Recorded-outcome word | Tracker count label | Icon | Bar colour (light) | Projector dark theme |
|---|---|---|---|---|---|---|
| `ACCEPT` | `Pass` | `Passed` | `Passed` | `Check` | `--oc-vote-pass` `#232d4b` | `#f6f5f1` |
| `HOLD` | `Hold` | `Held` | `Held` | `Pause` | `--oc-vote-held` `#e57200` | `#f3a274` |
| `REJECT` | `Do not pass` | `Not passed` (queue, undo line) / `Did not pass` (tracker, slide) | `Did not pass` | `XIcon` | `--oc-vote-fail` `#8794a3` | `#7d8fa0` |
| `UNREVIEWED` | `Unreviewed` | — | `To go` | — | `--oc-vote-track` `#e3e6e0` | `#22364b` |
| target marker | — | — | — | — | `--oc-vote-marker` `#a04d00` | `#f3a274` |

  Counts are always written as numbers; colour never carries the meaning alone. Vote buttons on the member ballot are ordinary outline buttons (selected = primary navy fill), not colour-coded.
- **Ballot privacy note (member ballot, shown while voting is open; not on the leader screen):** `Your choice is hidden from club members and leaders.` then disclosure `Who can see ballots` with bullets:
  - `You can see your own choice and change it while voting is open.`
  - `Everyone else, including session leaders, sees only how many ballots are in while voting is open, and only the Pass, Hold and Do not pass totals after it closes.`
  - `In a small group, totals or outcomes can still let people work out how someone voted.`
  - `Your ballot is stored with your account so OutClass can keep one vote per person. OutClass platform administrators can technically see stored ballots, through direct database access or an audited support session that views the app as you. Club leaders cannot.`
  - `Leaders’ final decisions, overrides, interview comments and observations remain attributed to their authors.`
- **Icons:** `X` (Exit), `ChevronDown` (More), `MoreHorizontal` (More actions), `Check` / `Pause` / `XIcon` (outcomes), `Download`, `Copy`, `Check` (QR card).
- **Behaviour:**
  - The room polls the server; counts, joined participants and the queue update live. Controls lock while a command is saving (`Saving…` after 250 ms; `Updating…` while waiting for the newer snapshot).
  - Applicant changes animate horizontally (crossfade under reduced motion).
  - Applicant names in the queue and `Next:` come from a leader-only summary; until it loads they read `Applicant {n}`.
  - Projector theme choice is per device (local storage), default Dark; it affects the projector window, not this leader page.
- **States:**
  - Route loading: `Opening voting workspace…`; then `Checking sign-in…`; then `Restoring voting session…`.
  - Signed out: `h1` `Join live voting`, `Sign in to see if you can vote.`, link `Sign in and return to this session`.
  - No access (server check): `h1` `Live voting` + `You don’t have access to this voting session. Ask a club leader if you think that’s wrong.` or `This session link is expired or unavailable.` + link `Return to OutClass`.
  - Not a leader: `h1` `Leader controls unavailable` + link `Open member view`.
  - Connection error: alert with the message and outline `Retry connection`. Applicant slide error: `Applicant information unavailable. ` + `Retry presentation`. Command errors: `The room changed since this view loaded. The latest state is shown below; check it and try again.` / `Command could not be confirmed. Reconnecting before retry; your decision may already be saved.` (+ `Retry command`).
  - Demo/live mismatch: `h1` `Voting link unavailable in this workspace`, `Use the matching Live or Demo link. This page will not switch environments.`

---

## Web issues seen

Observed on the web app at phone width on 2026-11-18 against staging. Screenshot names refer to `docs/mobile/screenshots/web/`. These are notes for the web team and things the native app should not copy; nothing was changed in the web app.

### Highest impact

1. **Invitation check fails in normal use.** My Clubs shows an error box under "Pending invitations" (`Verify your university email through the normal email verification or password recovery flow before responding to invitations.` / `Try again`) and the bell popover shows `Couldn’t check invitations.` / `Retry` for a student with no invitations. Retrying cannot succeed. (`10-my-clubs`, `04-header-notifications`)
2. **Alumni dead end.** The alumni account's club page still offers `Open club workspace`, which lands on `Could not load this workspace. Your membership may have changed. Try again.` (reproduced twice). Alumni Home says `Clubs you join appear here…` and invites applying, though alumni cannot apply or save. (`65-alumni-club-blue-ridge-consulting`, `65b-alumni-member-workspace`, `63-alumni-home`)
3. **Broken monogram layout on Applications cards.** On status cards the fallback logo stretches into a full-width grey bar; on the draft card it sits in the second column with an empty left column. (`06`–`09`)
4. **Clipped or hidden controls at 390 px with no scroll hint.** The fourth Applications tab `Decisions (2)`; Sat/Sun in the Availability day picker; 8 of 11 interest chips (a selected one is invisible); two of five Edit profile sections; `Settings` in the More sheet; Home "Coming up" locations. (`06`–`09`, `49`, `50`, `45`, `61`, `01`)
5. **Counts and states that disagree between screens.** Home says `2 interview invitations` though one is already booked; the pending Rotunda Equity Research Society offer is missing from Home but the club is listed under Suggested clubs; Home and the member club home say `You have tasks ready to work on.` above a To-do with no task / a card saying `You’re clear for now.`; Lawn Street Capital's Explore card says `Applications unavailable` while the student is in its Interview round; the voting room says `No applicants in this pass.` with `To go 8`; the Inbox group count still reads `17 unread · 24 notifications` under the Read filter. (`01`, `08`, `09`, `60`, `13`, `27`, `67`, `32`)
6. **A member is treated as a prospect on the club page.** Blue Ridge Consulting Collective shows `Start application` and `Follow` to a current member. (`26-club-blue-ridge-consulting`)
7. **`Review offer` opens a detail with no offer controls**; Accept / Decline live only on the letter page and record the response on a single tap with no confirmation. (`58-offer-pending`, `59-offer-letter`)
8. **Visible test or developer wording.** `Staging meeting kept current by the seed so QR check-in can be issued.`, `General Body Meeting (happening now)` (seed title, not a live indicator), `Client research brief: Rivanna Roasters (fictional)`, `Book your interview / view appointment`, raw filter keys (`category: Finance & Investing`), raw status values in notification bodies (`Your application status is submitted.`), `Daily summaries are prepared after midnight UTC.`, a raw `http://localhost:3000/q/…` join link, keyboard instructions on phones in Availability and Search. (`43`, `66`, `35`, `11`, `01`, `14`, `19`, `30`, `34`, `67`, `49`, `03`)
9. **No location cue in the dock on several pages.** No tab is lit inside a member's club workspace; Applications detail screens light Home; `/settings/interviews` and meeting pages light Calendar. (`60`, `52`–`58`, `51`, `43`)
10. **Tutorial card.** Progress bar renders browser-default green; step 1's highlight ring is hidden under the header; copy is written for desktop; leader and alumni get the student guide on Home. (`02-home-first-run-guide.viewport`, `63a`, `66a`)

Capture notes that are not product bugs: the header unread count reads 17 in some captures and 16 in others (the staging student account was also in use by another test session during the run, which is also why "Sam Staging-Student" appears in the leader's attendance history at 12:43 PM); the live meeting's seeded window (10:41 AM – 12:56 PM) had ended before screens 42, 43 and 66 were captured, so the Meetings list no longer starts with it; `49-settings-availability.png` has blank canvas below the content because the page reports a taller scroll height than its content fills when the viewport is grown.

### Global chrome and design system

- The notification popover shows `Invitations await your response` with the error strip `Couldn’t check invitations.` / `Retry` in normal use, for a student with no pending invitations. (`04-header-notifications`)
- Tutorial progress bar renders with the browser's default green fill on a grey track, not brand orange: `accent-orange-600` has no effect on the native `<progress>`. (`02-home-first-run-guide.viewport`, `66a-leader-first-run-guide.viewport`)
- Tutorial step 1's highlight ring around the avatar is mostly hidden: only its lower arc shows below the header circle because the sticky header paints over it. (`02-home-first-run-guide.viewport`, `66a-leader-first-run-guide.viewport`)
- The tutorial card sometimes shows a 2 px orange focus outline around the whole card on open, which reads as a second highlight ring. (`66a-leader-first-run-guide.viewport`; absent in `02-home-first-run-guide.viewport`)
- The tutorial card sits 2-4 px above the dock and covers the lower half of the first viewport, including the second To-do row, until dismissed. (`02-home-first-run-guide.viewport`)
- Tutorial highlight anchors `nav-explore`, `nav-clubs`, `nav-applications`, `nav-calendar`, `nav-corkboard` exist only on the desktop rail; on phones steps 2-7 would ring the top of the page content, not a dock tab (source only; only step 1 was captured).
- Tutorial copy is written for desktop: step 1 says the profile is reached "from your account menu" while the dock has a `Profile` tab; step 7 mentions "Saved clubs", which has no dock entry. A leader and an alumni account get the identical student guide on Home. (`02-home-first-run-guide.viewport`, `63a-alumni-first-run-guide.viewport`, `66a-leader-first-run-guide.viewport`)
- Inbox uses two different icons: a tray in the dock and a bell in the header, the search list and the More sheet. (`03-header-search`, `61-member-workspace-more-sheet`)
- Search footer shows keyboard hints (`to browse · Enter to open · Esc to close`) and the trigger's accessible name includes `⌘ K` on a phone. (`03-header-search`, `03b-header-search-typed`)
- No dock tab is lit on a member's club workspace pages (and, per source, on Settings pages), so the bar gives no location cue there. (`60-member-workspace.viewport`)
- The More sheet's last items (`Settings`) are below the fold with no scroll hint, and the dimmed `More` tab stays visible beside the sheet. (`61-member-workspace-more-sheet`)
- For a leader the header has no logo or home button at all on phones; the pill's `Personal` segment is the only way "home" from the header. (`66-leader-meeting-host.viewport`)
- The leader meeting page lights the `Calendar` tab while the pill shows `Personal`, although the meeting belongs to the BRCC club workspace. (`66-leader-meeting-host.viewport`)
- Account menu radius is declared twice with different values (16 px in `floating-header.css`, 18 px in `navigation-glass.css`; item radius 10 vs 12). (`05-header-account-menu`, source)
- Unread count differs between captures (17 in `01`-`05`, 16 in `60`-`62`) because one notification was opened in between; not a product bug.

### Home tab

- `01-home`: the summary sentence says `You have tasks ready to work on.` while the To-do card lists no task at all — To-do only includes *overdue* club tasks, so assigned, not-yet-due tasks are announced in the hero but have no row or link on Home.
- `01-home`: a pending membership offer is absent from Home. `Rotunda Equity Research Society` (Accepted, `Review offer` on `09-applications-decisions`) is the sixth application, so it is cut by the 5-row limit, and no To-do item exists for offers.
- `01-home` vs `09-applications-decisions`: `Rotunda Equity Research Society` is listed under "Suggested clubs" although the student already holds an accepted application there (suggestions exclude only saved and joined clubs).
- `01-home` vs `08-applications-interviews`: To-do says `2 interview invitations` / `Book your interview or view your appointment.`, but one of the two (`Corner Code Collective`) already has a booked interview on Nov 24; only `Lawn Street Capital` needs booking. `View interview` always opens the first interviewing application, not the one that needs action.
- `01-home`: the To-do square looks like a checkbox but is decorative and cannot be ticked.
- `01-home`: long notes and details are clipped with an ellipsis at 390 px (`Book your interview / view appoint…`, `Thu, Nov 19, 6:00 PM · Club event · South Law…`).
- `01-home`: developer-style slash copy `Book your interview / view appointment`; Home labels use different wording from the Applications page for the same state (Home step `Club review` vs tab `In review`; Home note `Application submitted`).
- `01-home`: status label casing/wording differs between surfaces — Home row mark `Interview` vs To-do `interview invitations` vs tab `Interviews`.
- `06-applications-drafts`: the draft card's logo renders in the second grid column above the club name, leaving an empty 44 px column on the left (the phone rule `.oc-application-management-row > div { grid-column: 2 }` also catches the logo fallback `div`).
- `08-applications-interviews`, `09-applications-decisions`, `07-applications-in-review`: on status cards the monogram logo stretches into a full-width grey bar above the club name (the phone rule `.oc-status-card-heading > div { flex-basis: calc(100% - 4rem) }` also catches the logo fallback `div`). Confirmed in `07`, `08`, `09`; the status mark also drops to its own line.
- `06`–`09` vs `01-home`: monograms are inconsistent for the same club — Drafts cards and Home use the first two letters (`Pi`, `Co`, `La`, `Wo`), status cards use word initials (`LS`, `CC`), which gives `Wi` for Women in Quant Finance Circle (it counts "in").
- `06`–`09`: the fourth tab `Decisions (2)` is cut off at the right edge at 390 px with no scroll affordance.
- `06`–`09`: the status-detail back button is labelled `← Status` although it returns to the page titled `Applications` (the answers view uses `← Applications`).
- `08-applications-interviews`: the stepper shows the club's internal round names (`Application Review`, `Final Deliberation`) next to the status mark `Interview` and a sub-line `Interview`, so "Interview" appears three times in one card.
- `10-my-clubs`: an error box (`Verify your university email through the normal email verification or password recovery flow before responding to invitations.` + `Try again`) shows in normal use for the seeded account, under a "Pending invitations" heading, although there are no invitations; `Try again` cannot succeed. The wording is developer-oriented.
- `10-my-clubs`: user-facing copy says "organization" (`Accept to join this organization.`, `Claim organization`, `Checking organization invitations…`) where the product term is "club".
- `10-my-clubs` vs `01-home`: role label sets differ (`Recruiting Lead` / `Owner` / `Admin` on My Clubs; `Recruitment lead` / `President` on Home tiles).
- `11-tasks`: the empty-state title uses a straight apostrophe (`You're all caught up.`) while the rest of the product uses curly ones; the hero fallback `Explore what's new in OutClass.` and `There's a new update in your club today.` do too.
- `11-tasks`: seeded task title contains visible test wording: `Client research brief: Rivanna Roasters (fictional)`.
- `11-tasks`: each row repeats the club name directly under a section heading that already names the club.
- `60-member-workspace`: no dock tab is highlighted while a member is inside a club workspace.
- `60-member-workspace`: the page offers two different "tasks" destinations with near-identical labels (`Tasks` personal vs `Club tasks`) and two "home" entries (`Home`, `Club home`) in the More sheet (`61-member-workspace-more-sheet`).
- `61-member-workspace-more-sheet`: Inbox uses the `Bell` icon in the sheet but the `Inbox` tray icon in the dock; Profile uses `UserRound` in the sheet and `UserCircle` in the dock.
- `01-home`: every "Coming up" detail line is clipped (`… · Student Un…`, `… · Engineerin…`, `… · South Law…`), so the location is never readable on phone.
- `60-member-workspace`: the hero says `You have tasks ready to work on.` directly above a "Needs you" card that says `You’re clear for now.`
- `60-member-workspace`: the club name heading (≈36 px Caslon) runs to the right edge of the screen on its second line; the next-meeting title wraps to three large lines and repeats the club name.
- `60-member-workspace`: a plain member is shown the announcement `Final deliberation tonight` — `Members who review applications: the live vote opens after tonight's meeting…`, which is recruiting-staff content.
- `60-member-workspace`: announcement previews are clipped to one line with an ellipsis; the same meeting appears twice on the page (Next meeting and This week).
- `61-member-workspace-more-sheet`: at 844 px height `Settings` is below the fold of the sheet with no scroll hint.
- `12-task-detail.full`: the file input is the unstyled browser control (`Choose Files No file chosen`); all three submission parts are tagged `Optional` while the line above says `Required: text, a link, or a file.`
- `11-tasks`: secondary row lines render heavier/darker than the muted caption style used elsewhere (compare the task row with Home rows).

### Explore tab and alumni account

- `26-club-blue-ridge-consulting`: a current member of the club is offered `Start application` and `Follow` as if they were a prospective applicant; the only member cue is the `Open club workspace` link inside About. The CTA has no member state.
- `26-club-blue-ridge-consulting`, `27-club-lawn-street-capital`: the About section prints the same paragraph twice — once as the description and again under `What we do` (seed content duplicates the description).
- `27-club-lawn-street-capital` vs `13-explore` / `25-saved-clubs`: the Explore and Saved-clubs cards for Lawn Street Capital read `Applications unavailable` / `Deadline not published` while the student has a live application in the Interview round; the card has no "you applied" state.
- `27-club-lawn-street-capital`: the stage tracker is a fixed 4-column grid, so the club's 3 rounds sit left-aligned with an empty fourth column (visible in the capture); and the `Interview` status mark floats alone between `Share` and `Report` in the action stack.
- `13-explore`: "Follow" on the club page and "Save to saved clubs" on cards are the same record under two names; the pressed label on cards is the action (`Remove from saved clubs`) rather than a state.
- `13-explore`: cards for closed clubs stack two negative lines (`Applications unavailable`, `Deadline not published`); unclaimed clubs show `Unclaimed` in the slot where recruiting status goes.
- `13-explore`: the "Suggested for you" caption always says `Based on the clubs you saved and your major.` even when the reasons shown are only saved-club matches.
- `14-explore-search-typed`, `19-explore-category-selected`: filter chips expose raw keys — `category: Finance & Investing`, `time: 3-5`, `acceptance: 25` — and aria-labels such as `Remove query filter` / `Remove recruitment filter` (developer wording).
- `16-explore-filter-sheet`: filtering takes two taps on phones (icon toggle reveals a panel that holds a second `Filters` button which opens the sheet), and the two badges count different things (the toggle includes sort; the `Filters` button does not).
- `20-explore-categories`: `/explore/categories` is indistinguishable from `/explore`.
- `21-events-list`: label casing is inconsistent (`View Event`, `Add to Calendar` vs sentence case elsewhere); `Previous` / `Page 1` / `Next` pagination sits below the `Your RSVPs` box rather than directly under the list.
- `65b-alumni-member-workspace`: an alumni member who follows the club page's `Open club workspace` link lands on a generic failure — `Could not load this workspace. Your membership may have changed. Try again.` with a `Retry` that cannot succeed — under a title with an empty sub-line. There is no alumni explanation, and the dock still offers club sections.
- `65-alumni-club-blue-ridge-consulting`: `Open club workspace` is still offered to the alumni member (it leads to the error above); the disabled `Alumni can’t apply` button is the only explanation of the account's state; nothing tells the alumni they are an alumnus of this club.
- `63-alumni-home`: My Clubs says `Clubs you join appear here, with their meetings and tasks.` to an account that is alumni of two clubs and cannot join any; `Applications` invites `Find clubs to apply to in Explore.` although alumni cannot apply; `Suggested clubs` still recommends clubs the account can neither save nor apply to.
- `64-alumni-explore`: the caption `Based on the clubs you saved and your major.` sits above reasons that are all `Because you picked …` (interest survey); the `Saved clubs` button remains although saving is impossible (and, from source, its remove buttons are not hidden).
- `24-event-detail`: the dialog repeats every fact twice — once on the decorative flyer (club, title, time, place, description, category) and again in the copy block directly below it — pushing `RSVP` below the first viewport.
- `29-club-report-dialog`: the disabled `Submit report` sits above `Cancel` and looks like a muted primary button; the title wraps to two lines for an ordinary club name.
- `19-explore-category-selected`: `Clear all` wraps onto its own line under the `category: Finance & Investing` chip.
- `16-explore-filter-panel`: with the panel open the page shows three stacked filter affordances (navy toggle, `Filters` pill, `Sort` pill) before the chips.

### Inbox, Calendar, meetings and check-in

- `34-inbox-preferences`: on a cold load of `/inbox?tab=preferences`, the Inbox behind the sheet briefly shows `0 results`, `CLUB UPDATES 0 unread · 0 notifications` and the empty state `No notifications yet` for a user who has 24 notifications, and the header bell shows no unread count (seen in an earlier dump of that URL, not in the final capture).
- `34-inbox-preferences`: helper text exposes implementation timing: `Daily summaries are prepared after midnight UTC.`
- `34-inbox-preferences`: the seeded student has all six email categories unchecked and frequency `Off`, yet the push helper says pushes are `Sent for the updates you get by instant email.` (with that state nothing would be pushed; push row itself is hidden in dev).
- `30-inbox`: every Interview Invite row carries an `Urgent` badge (the flag is simply `type === INTERVIEW`), so five of five rows in the first group are "Urgent", including a plain `Interview confirmed`.
- `30-inbox`: type label `Interview Invite` is used for confirmations, reminders and booking notices; `Club Invitation` is used for an offer (`Your offer is waiting`) and for voting sessions.
- `30-inbox`: body copy speaks in raw status values: `Your application status is submitted.` / `…is interviewing.`
- `30-inbox`: phone group heading rule turns the empty-state heading into upper-case `CLUB UPDATES` while populated groups show `Club updates` in sentence case.
- `30-inbox`: two different `Clear filters` buttons behave differently (toolbar one also resets sort; empty-state one does not).
- `35-calendar-agenda`: member (general body) meetings and RSVP'd events are labelled with the type `Other`.
- `30-inbox`: on Urgent rows the meta line wraps and leaves a dangling `·` at the end of the first line (`Urgent  Interview Invite ·` then the date below).
- `32-inbox-read`: with `Read` selected (`7 results`) the group count still says `17 unread · 24 notifications`.
- `43-meeting-detail-live` / `66-leader-meeting-host`: visible test content in the description: `Staging meeting kept current by the seed so QR check-in can be issued.`
- `43-meeting-detail-live`: doubled divider lines between the header and `Agenda`; the dock highlights `Calendar` although the page is not reachable from the Calendar tab UI except via the event dialog.
- `66-leader-meeting-host`: attendance timestamps use a different format from the rest of the app (`11/18/2026, 10:43:45 AM`, device locale with seconds).
- `66c-leader-check-in-presenter`: the link is specified as monospace but renders in the sans face.
- `35-calendar-agenda` / `42-meetings`: seeded title contains state text, `General Body Meeting (happening now)`; neither screen has a real live indicator.
- `35-calendar-agenda`: `Your club calendars` lists 40 clubs as a long checkbox list at the bottom of the page on phones, far below the agenda it filters, and it is not part of the `Filters` panel or its count.
- `36-calendar-month`: the month grid has a fixed 650px minimum width and scrolls horizontally at 390px.
- `37-calendar-week`: week view title shows only `November 2026`, not the week range; trailing response labels are raw lower-case values (`confirmed`, `going`, `declined`).
- `41-calendar-event-detail`: shows start time only (no end time or duration); the meeting button says `Open agenda and recap` while the meetings list says `Open agenda, resources and attendance`.
- `42-meetings`: date range repeats the full date on both sides (`Wed, Nov 18, 10:41 AM – Wed, Nov 18, 12:56 PM`) and is formatted in the device time zone, while Calendar states `Times shown in Eastern Time.`
- `42-meetings`: `All available meetings` links to the page the user is already on; the page has an `h2` but no `h1`.
- `42-meetings`: tapping a card opens a sheet rather than the `/meetings/{id}` page, so the same detail has two presentations.
- `43-meeting-detail-live`: a member of a live meeting sees no check-in prompt, attendance status or RSVP; the notification `General body meeting is starting` / `Check in with the QR code on the screen when you arrive.` is the only pointer.
- `43-meeting-detail-live` (check-in page): success text uses developer-flavoured wording, `Your original attendance timestamp is preserved.`; no-token text says `Static attendance links are no longer accepted.`
- `66-leader-meeting-host`: `Codes refresh every minute.` while codes live 90 seconds; the countdown therefore restarts from about 90 each minute and never reaches 0 in normal use.

### Profile and Settings

- `44-profile.png`: `Preview` is disabled for the seeded student (no LinkedIn, no résumé) with no explanation; no `46` capture could be made.
- `44-profile.png`: the phone rule that should make the identity-card buttons cream (`.oc-profile-identity [data-slot="button"]`) does not take effect; `Edit profile` shows as the navy pill and `Preview` as the light pill. Likely because the dialog/menu triggers replace `data-slot` (cause inferred from source; rendering confirmed in the capture).
- `44-profile.png`: experiences can be entered in the dialog but are never displayed on the Profile page; there is also no résumé or LinkedIn row. The first-run guide text says `Keep your education, experience, and resume up to date from your account menu.` (also spells `resume` without accents, unlike the rest of the app).
- `44-profile.png`: the checklist tracks Name/Education/Résumé/LinkedIn but not Phone, although Phone is the only item actually required to apply (`Not added. Required before you submit an application.`).
- `44-profile.png`: `ACT` is stacked label-over-value while `GPA` and `SAT` are inline. `University of Virginia` is hard-coded in the Education block and on the account page.
- `45-profile-edit.png`: helper `Save changes to update your photo.` refers to a Save action that does not exist (buttons are `Close` and `Done`, both of which save and close; header says `Changes save as you go.`).
- `45-profile-edit.png`: `Remove photo` is shown even when there is no photo; only three of the five section labels are visible (`Links & résumé` and `Phone` are off-screen with no scroll hint); the dialog exposes two controls named `Close` (footer button and the X).
- `45-profile-edit.png`: note `LinkedIn and résumé details are not imported automatically.` sits in a dialog that also offers `Import from résumé`.
- Preview (no capture): "Preview" is only a two-link menu that opens new tabs; nothing is previewed in the app.
- `47-settings.png`: the `Notifications` row leaves Settings for the Inbox; rows have no chevron or icon to signal navigation.
- `48-settings-account-and-delete.png`: the disabled destructive button gives no hint about what is missing; the two-step section is absent on staging (flag off).
- `49-settings-availability.png`: the day picker clips at `Sa`; Saturday and Sunday are off-screen with no scroll hint.
- `49-settings-availability.png`: the full-page capture is 3236px tall but content ends near 1630px, leaving about 1500px of empty canvas above the dock (may be a capture artefact; cause unverified).
- `49-settings-availability.png`: keyboard and mouse instructions (`Arrow keys move; Space or Enter toggles; Shift + arrows extends… Escape cancels a drag.`) are shown on phones; three unlabeled day selects in the copy/clear row; the same cell is called `Unavailable` (legend), `unavailable` (aria-label) and `Not marked` (sr text).
- `49-settings-availability.png`: status wording is developer-leaning (`Save failed · edits retained`, `Submit this recurring week (including an empty week)`).
- `50-settings-interests.png`: chip rows do not wrap; 8 of the 11 interest chips and 3 of the 6 goal chips are off-screen, with a chip cut at the panel edge and no scroll hint, so a selected `Tech & engineering` is invisible while the counter says `3 of 6`.
- `50-settings-interests.png`: no vertical spacing between questions or above `Save`; headings touch the chip row above (the form's spacing does not reach the sections because they sit inside a `display: contents` fieldset).
- `51-settings-interviews-empty.png`: inconsistent naming and casing for one destination: row `Interview schedule`, eyebrow `My interviews`, title `My Interview Schedule`, link `View my published interviews`, title-case link `Update My Availability`. No breadcrumb or other way back to Settings; the dock highlights Calendar although the page lives under Settings.
- `51-settings-interviews-empty.png`: empty-state wording is internal (`official panel assignments`, `Draft suggestions appear here after the owner publishes them.`) and is shown to every student, most of whom are never interviewers. The `Published` chip uses hard-coded emerald utility colours rather than tokens.
- `48-settings-account-and-delete.png` vs the others: the header bell reports `Notifications, 17 unread` in this capture and `16 unread` in 44/45/47/49/50/51 (captured about 15 minutes apart; may be real change).

### Application, interview, decision flows and voting room

- `52-application-form-draft.png` vs `53…`–`58…`: the back button says `Applications` on the form but `Status` on every status detail, although both return to the same `/applications` list (the separate Status page no longer exists). The letter's error state link also says `Return to Status`.
- `52-application-form-draft.png`: deadline is written `Deadline Nov 28, 2026, 11:59 PM · Eastern Time` in the form header but `Deadline · Nov 28, 2026, 11:59 PM · Eastern Time` on the Drafts card (missing middot).
- `52-application-form-draft.png`: two different success strings for one submit (`Application submitted.` set inside the form, which unmounts at once, and `Your application was submitted successfully.` in the header notice); only the second is seen.
- `52-application-form-draft.png`: multi-select questions show the generic help line `Enter your response.`; a choice question with no options tells the applicant `If no choices are listed, ask the club for clarification.` (club-setup wording shown to students).
- `52-application-form-draft.png` (read-only state): `Submitted {date}` in the submitted-responses header uses the device locale and time zone with no zone label, while the status detail and cards use Eastern with `· Eastern Time`.
- `53-application-status-in-review.png`: the status label appears twice side by side (`h2` `In review` and the `In review` pill).
- `55-interview-booked.png`: the confirmed card shows `Nov 24, 2026, 3:15 PM` without `Eastern Time`, while the list card for the same booking shows `… · Eastern Time`.
- `56-decision-rejected.png` (from source; not in the capture, where the letter exists): a current decision with no letter is described as `Formal letter unavailable for this historical decision.` ("historical" is wrong for a current decision).
- `58-offer-pending.png` / `59-offer-letter.png`: the offer deadline uses the device locale short date (`11/25/2026`) while the letter body prints the long UTC date; near midnight the two can differ by a day. Accept/Decline are capitalised `Accept Offer` / `Decline Offer` and `View Decision`, unlike the sentence case used everywhere else.
- `58-offer-pending.png` / `59-offer-letter.png`: Accept and Decline have no confirmation step; a single tap records an irreversible response.
- `59-offer-letter.png`: the default letter says "review your offer below" but the response box is placed above the letter while the offer is pending.
- `67-leader-voting-room.png`: the leader's own screen shows the member-facing heading `Ready when your leader is`.
- `67-leader-voting-room.png`: three different words for the same outcome (`Do not pass`, `Not passed`, `Did not pass`) appear on one screen (totals, queue, tracker); the primary action is `Close vote` while confirms and status say `Close voting` / `Voting open`.
- `67-leader-voting-room.png`: before the start the status panel's right side is empty (no position), and the same join QR is reachable three ways on one phone screen (inline card, `Show join QR`, `More` → `Join QR`).
- `67-leader-voting-room.png`: `Applicants` says `No applicants in this pass.` while `To go` is `8` and the preview select lists eight applicants.
- `67-leader-voting-room.png`: a blank gap of roughly 200 px sits under the previewed applicant's name before the status line; with the QR card above it, `Start session` is far below the first viewport (`67-leader-voting-room.viewport.png`).
- `67-leader-voting-room.png`: the join link is shown as a raw `http://localhost:3000/q/…` URL (environment origin, with scheme).
- `52`–`56`, `58`: the dock highlights `Home` on every Applications screen.
- `53-application-status-in-review.png`: the application listed under the `In review` tab reads `Submitted` twice on its detail; the words "In review" never appear.
- `54-interview-booking.png`: no `Confirm interview` button or hint is visible until a time is tapped, and six of the seven listed times are `Full`.
- `55-interview-booked.png`: the intro block says `Interview Room` (room name) while the confirmed card says `Student Union 215` (location) for the same booking.
- `57-decision-letter-rejected.png`, `59-offer-letter.png`: letter body hyphenates mid-word at phone width (`re-cruitment`, `ef-fort`, `cu-riosity`, `re-spond`).
- `58-offer-pending.png`: the list card says `Membership offer ready` / `Review offer`, but the detail it opens has no offer, deadline or response controls, only `View Decision`; the generic sentence `Check the club’s instructions for next steps.` shows instead.
