# Empty-state audit (2026-11-06, branch `ui/status-pill-empty-states`)

**Rule.** An empty state says why it is empty and offers one next action. That action must take the person somewhere other than the view they are already looking at. Two examples:

- If nothing is filtered, do not offer "Show all".
- If the page's header already offers an action, offer a different one.

Tests: `tests/status-pill-empty-states.test.cjs` covers the rule for the screens below. For the Corkboard logic, see `eventBoardEmpty`.

## Fixed

| Screen | Reason shown | Next action |
|---|---|---|
| Corkboard (`public-event-board.tsx`, `lib/event-board-empty.ts`) | filtered, saved only, or nothing published | **Clear filters** when filtered, **Browse all events** from saved-only, **Explore clubs** when nothing is published. "Show all events" no longer appears when everything is already shown. |
| Corkboard · your RSVPs | no RSVPs | **Open your calendar** |
| Applications (`application-tracker-view.tsx`) filter with no matches | which filter is empty, and why | **Show all applications** |
| Home · applications | not started, or failed to load | **Explore clubs** or **Try again** (the header already links to Applications) |
| Home · coming up | nothing scheduled, or failed to load | **Browse events** or **Try again** (the header already links to Calendar) |
| Home · updates | caught up | **Find clubs to follow** (the header already opens the inbox) |
| Explore (`explore-view.tsx`) | search/filters, or no clubs at the school | **Clear search and filters**, or **See campus events** |
| Calendar: agenda, day panel, upcoming (`calendar-view.tsx`) | filters/hidden calendars, or nothing scheduled | **Clear filters** only when something is filtered; otherwise **Browse campus events** |
| Inbox (`inbox-view.tsx`) | filters, or nothing sent | **Clear filters**, or **Email preferences** |
| Notification popover (`notification-center.tsx`) | all read, or nothing sent | **Show all updates** from Unread, or **Choose email updates** |
| Meetings (`meeting-workspace.tsx`) | none in this period | **See past meetings** / **See upcoming meetings** |
| Saved clubs popover; organization memberships | none saved or joined, and how to join | **Browse clubs** / **Explore clubs** |
| Interview booking (`booking-picker.tsx`) | no times available | **Back to application status** |
| Interview rooms (`interview-rooms-list.tsx`) | date filter, round filter, or not assigned | **Show all dates**, **Show all rounds**, or **Back to recruiting overview** |
| Leader applicants (`live-leader-workspace.tsx`) | filters, none rejected, none awaiting a decision, or none submitted | **Clear filters**, **View all applicants**, or **Review your application form** |
| Leader review queue (`recruiting-overview.tsx`) | none in this round, or caught up | **Show all rounds** or **Browse all applicants** |
| Club overview meetings (`manager-overview.tsx`) | none in the next seven days | **Open meetings** |
| Club members (`club-members.tsx`) | search, or no members yet | **Clear search** |
| Club Corkboard events tabs (`club-events.tsx`) | none in this tab | **Create Corkboard Event** |
| Recruiting rounds (`club-workspace.tsx`) | no rounds, so nothing to review | **Set up recruitment rounds** |
| Admin directory and reports | search/filter, or none of this type | **Clear search…** or **Back to admin overview** |

Already compliant: Saved clubs page (**Browse clubs**), My clubs (**Explore clubs**), Tasks (**Clear filters** / **View all tasks**), and club Corkboard events when there are none (**Create Corkboard Event**).

## Not yet changed: inline placeholders inside a tool

The empty states below are placeholders inside an editor or panel. The button that fills them sits right beside them, or the screen is local preview or demo only. They state the reason but have no action of their own. Proposed action for each, as a follow-up:

- Board lanes, "No applicants in this lane…" (`live-applicant-views.tsx`): none. The board-level filters and actions apply.
- Leader workspace "No evaluations yet", "No data available" (`live-leader-workspace.tsx`): **Open interviews** / **Retry**.
- Interview tools:
  - `interview-access-setup` "No rooms yet", `panel-publication-history`, `room-manager` bookings, `my-panel-schedule`: **Create room**, **Publish panel**, **Clear filters**, **View schedule**.
  - The kit, resume viewer, review references and submitted-reviews panels inside the interview room: none. The room's own controls apply.
- Live voting lobby, slide preparation, room landing, board decision mode and proctor preview: **Prepare voting** / **Start session**, depending on the panel.
- Club tools:
  - `club-announcements` "No announcements published yet", `member-group-builder` "No groups yet", `meeting-workspace` resources, `task-manager-workspace` lists, `organization-member-management` "No members/invitations match", `qr/leads-table`, `recipient-audiences`, `broadcast-messages-view`: the matching **Create…** or **Clear search**.
  - `applicant-intelligence` "No observations yet": **Add observation**.
- Local or demo-only previews (`scheduler/slot-card`, `student-booking-preview`, `screening-dashboard-view`, `club-management-portal-view`): leave as they are.
