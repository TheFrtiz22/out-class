# Authenticated floating header

`ProductShell` owns the existing navigation callbacks, search modal, notification
subscriptions, account dropdown, and sidebar. `FloatingModeNavigation` and
`FloatingSearchTrigger` provide their presentation in
`components/shell/floating-header-controls.tsx`. The public navbar is separate.

The active indicator derives its position from the incoming route mode. Managers
receive Recruiting only when `recruitmentTools(membership)` grants access;
personal workspaces retain Explore, Apply, and My Clubs. Platform workspaces
retain their sidebar without a primary mode pill.

Customize surfaces, borders, spacing, and easing in
`components/shell/floating-header.css`. The CSS spring uses transforms with
minimal overshoot and disables transitions for reduced motion. Search expands
its surface within reserved space, so focus does not move neighboring controls.
Below 900px it becomes an icon. At narrow widths the three personal modes use a
second row. Existing bottom navigation and the workspace drawer remain available.

Search dismissals restore the initiating control's focus; selecting a result
focuses the content. Notifications open the anchored `NotificationCenter` popover and retain the
existing task, invitation, and realtime counts. Expand and View all open the full
inbox. See `docs/notification-center.md` for supported interactions. Account menus use the existing
Radix portal and collision handling. No authentication or backend changes are
required.

## Browser verification

Run `node scripts/check-floating-header.cjs`, or set
`OUTCLASS_NAV_BROWSER=webkit` for WebKit. The script bundles the real shared
shell, search dialog, dropdown, and drawer using Next's existing Webpack and
project styles. Test-only providers and fictional records isolate identity and
network operations. No app route, production auth, or database is modified.
Local fonts are read from `.next`, so run the production build first.

Checks cover route/history selection, keyboard shortcuts and focus return,
search results and failure feedback, unread updates, notification expand navigation, account menus, club
switching, mobile drawer resizing, six roles at ten viewport widths, saving
guards, avatars, reduced motion, and successful/failed logout. These checks do
not replace a live authenticated backend test.
