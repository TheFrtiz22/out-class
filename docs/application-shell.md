# Shared application shell

`DashboardLayout` retains the existing `AppShell` view callbacks and providers.
No URLs, view identifiers, server actions, or page content were migrated. The
application tracker sticky action bar consumes a shell bottom-inset variable so
mobile navigation cannot obscure its controls.

- Desktop (1024px+): a persistent 232px warm-neutral sidebar, visible icon labels,
  bottom account menu, and a quiet contextual utility header.
- Student navigation: Home, Discover, Applications, Calendar, Profile. These map
  to the original student-dashboard, discover, tracker, calendar, student-profile
  view IDs. Notifications remain available through the header.
- Mobile students: five labeled bottom destinations, safe-area padding, and a
  modal drawer for workspace/account controls. No icon-only collapsed sidebar.
- Mobile leaders: a labeled drawer rather than squeezing dense navigation into
  a bottom bar. Shared tokens and controls, with tighter content spacing.
- `ShellNavigation` renders desktop/drawer/mobile navigation from shared metadata.
- `NavigationSearch` searches accessible page destinations only. It does not
  claim to search applicants or clubs. Enter opens the first match; Tab moves
  through native result buttons; Escape dismisses the Radix dialog.
- Header notifications use the existing application context and open the inbox;
  notification persistence remains subject to the audit's existing limitations.
- Account identity uses AuthProvider, with neutral loading/preview labels rather
  than another student's fixture identity. Authenticated sign-out calls Supabase;
  errors keep the user in place and show feedback.
- Workspace switching is available to actual leaders and anonymous previews.
  This is not an authorization boundary. There is intentionally no misleading
  per-club selector while leader pages still operate on a fixed demo club.
- No subscribed-club list: the persisted schema has memberships but no supported
  subscription model. The profile view continues to expose existing memberships.
- Content entrance uses opacity and a five-pixel translation for 300ms. Active
  indicators fade/scale subtly. Global reduced-motion handling applies.
- The content provider is never keyed/remounted on navigation. Only the view
  wrapper gets the entrance animation. View changes update the document title,
  focus the main region, and reset scroll; navigation remains state-based.

Validation checklist: desktop/mobile, narrow viewport and 200% zoom; every
student/leader destination; opening inbox from leader mode; profile/menu actions;
search empty/matching queries; Escape and focus return; resize while drawer open;
keyboard skip link and visible focus; reduced motion; short and long account
names; loading and anonymous previews; Supabase sign-out success/error.
