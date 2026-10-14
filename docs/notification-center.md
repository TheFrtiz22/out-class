# Floating notification center

`ProductShell` keeps the existing task polling and durable notification
EventSource. `NotificationCenter` uses the existing application and invitation
contexts; opening the bell performs no fetching, navigation, scrolling, or
mark-as-read operation. The non-modal Radix popover portals above the layout,
handles viewport collisions, and restores keyboard focus without scrolling.
Explicit tab stops include native buttons and invitation controls in Safari.

The panel provides All/Unread filtering, individual read/unread and dismiss
menus, inline announcement details, existing invitation response controls,
and explicit Expand/View all actions for the full inbox. Destination-bearing
records use their saved `taskHref`/`href`. Legacy calendar and application
records use the same focus/view callbacks as the inbox. General inbox links
open details inside the panel.

## Existing backend and limits

- Durable updates use `UserNotification`, `getDurableNotifications`,
  `setDurableNotificationsRead`, and `setDurableNotificationsArchived`.
  Authentication, recipient scoping, announcement publication, email delivery,
  and the stream API are unchanged.
- The shared store applies optimistic read/archive changes and unread counts,
  preserves pending actions through stale refreshes, and rolls back failed
  writes. Action results let the panel offer Retry. A refresh reconciles any
  writes that reached the server before a transport failure.
- Mark all traverses existing owned cursor pages when unread records exist
  beyond the cached feed. Writes use batches of at most 100 IDs, the existing
  endpoint limit. The full inbox uses the same operation. Overlapping bulk clicks
  share one operation; its target IDs survive a concurrent page refresh.
- Distinct durable task updates retain their history even when they share one
  destination. Only the duplicate derived task summary is suppressed.
- Derived task updates retain their existing session-only read state; the backend
  offers no persisted read/archive record for them. The panel therefore exposes
  durable dismissal only. No database or API behavior was invented.
- Pending organization invitations use their existing provider and response card.
  They remain in All/Unread and the badge until answered; Mark all read cannot
  resolve invitations. Existing owner-claim navigation remains intact.

Presentation is scoped to `components/shell/notification-center.css`. It uses
native transform/opacity transitions, reduced-motion handling, and a scrollable
feed within a 400px-wide, 540px-tall maximum surface. Native scroll anchoring
preserves the visible feed during incoming updates where supported.

## Verification

Run `node --test tests/notification-center.test.cjs` for destination, feed,
optimistic-action, rollback, pagination, and deduplication checks. Existing
communications and invitation suites cover recipient permissions and email
behavior.

After `npm run build`, run `node scripts/check-notification-center.cjs` and
`OUTCLASS_NAV_BROWSER=webkit node scripts/check-notification-center.cjs`.
These bundle the real shared shell, application state, and Radix components with
test-only identity and backend boundaries. Fictional records persist in the
isolated browser's storage so reload behavior can be checked. Stream events are
injected into one test EventSource. No live account, database, or email is used.

The checks cover pointer and keyboard opening, no URL/scroll/read changes,
outside/Escape dismissal, focus restoration, inline reading, persisted state,
filtering, failure recovery, nested menus, invitation responses, older-page bulk
reads, realtime feed updates, exact destinations, expansion, loading/error/empty
states, responsive bounds, and reduced motion. These fixtures do not replace a
live authenticated backend integration test.
