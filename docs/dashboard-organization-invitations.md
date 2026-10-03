# Dashboard organization invitations

`OrganizationOwnershipRequests` remains the integration point for identity-bound
MEMBER invitations and separately worded OWNER claims. The dashboard treats these
as temporary actionable notifications near the top of the page:

- No visible pending requests: return `null`, including while initial discovery is
  loading or fails. No heading, empty card, placeholder, or invitation spacing.
- One request: a compact branded attention card with invitation details, Accept
  (or Claim organization), Not now, and confirmed Decline.
- Multiple requests: a compact counted disclosure to review each invitation in a
  bounded scroll area. Handling requests updates the count immediately; the last
  visible request collapses away, then unmounts. Reduced motion skips transitions.

`OrganizationInvitationsProvider` shares one account-scoped session cache between
the dashboard, Settings, inbox, and notification bell. It uses the existing
`getOrganizationInvitations(true)` recovery query, including dismissed requests.
The dashboard filters dismissed requests; the bell counts all pending requests,
which can be reviewed in the inbox or Settings. No invitation records are copied
into the local notification store. Discovery runs on account changes, explicit
Settings refresh/retry, and tab focus/visibility restoration. In-flight discovery
results reconcile completed responses so they cannot resurrect handled requests.
Account/demo changes conceal private data immediately and cancel outdated reads
without remounting the rest of the application. Guests and demo sessions make no
invitation discovery calls.

All responses reuse the existing server actions and send only the invitation ID.
Verified identity matching, pending/expiry checks, inviter authority, organization
locking, membership upsert, role preservation, response timestamps, and audit
entries remain in the existing transaction helper and database constraints. No
schema, permission, RLS, email, or server action changes are introduced.

Accept and confirmed Decline remove a request as soon as the server commits,
without refreshing the page. Acceptance refreshes the auth context so memberships
and navigation update. A membership-refresh failure never reverses acceptance.
OWNER claims retain their existing server-returned club workspace navigation.
Each card retains independent submission/error state and duplicate-submit guards;
failed responses leave the invitation available for retry.

Not now changes only `dismissedAt`, without declining or creating a membership.
Dismissed invitations remain pending in the shared cache and notification count.
Settings includes all dismissed requests and can restore their dashboard visibility.
Settings retains explicit loading, retry, and status UI, and hides the area once
there are no pending requests. Response feedback
also appears as a toast, so successful handling does not leave a permanent success
card on the dashboard.

Regression tests cover conditional rendering, counted review, final collapse,
notification/inbox integration, guest/demo isolation, account switches, tab-focus
discovery, stale queries, acceptance/decline/dismissal/restore, failed responses,
owner routing, duplicate submissions, membership-refresh failure, and protected
Settings access. Existing backend and SQL membership/invitation tests remain intact.
