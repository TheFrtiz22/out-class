# Dashboard organization invitations

The existing student dashboard and authenticated onboarding wizard share the
`OrganizationOwnershipRequests` integration point. It now displays all matched
identity-bound invitations, including ordinary MEMBER requests and separately
worded OWNER claims, rather than filtering exclusively to owners. Club branding,
responsive cards, buttons, typography, and focus states reuse OutClass components.
Each card has independent busy/error state and prevents overlapping submissions.

The server's `getOrganizationInvitations` discovers requests from verified school
identities. Profile existence or account age does not affect discovery, so a CSV
import can invite an existing student or someone who joins later. The browser sends
only an invitation UUID when responding, never a school/computing ID or requested
role. Server identity matching, pending/expiry checks, inviter authority, organization
locking, membership upsert, role preservation, acceptance timestamps, and audit
entries remain in the existing transaction helper and database constraints.

Member **Accept** removes the request as soon as the server commits and refreshes
the auth context so club lists/navigation update without leaving the dashboard.
A refresh failure does not undo acceptance or offer a second acceptance attempt.
OWNER cards use **Claim organization**, explain management capabilities, and open
the existing server-returned club workspace after claiming.

**Not now** changes only `dismissedAt`. It creates no membership, changes no invitation
status, and never calls decline. The dashboard hides the card after the server
confirms dismissal. A success notice and persistent link lead to
`/settings/organizations` (**Settings → Organizations → Pending Invitations**).
This authenticated recovery page includes dismissed requests and offers acceptance
or **Show on dashboard**, which clears the dismissal timestamp. Explicit decline
remains available on the existing invitation-link page; the dashboard does not add
a decline control.

Requests load on mount and identity changes, with explicit refresh/retry controls.
In-flight discovery results reconcile with completed actions so stale responses do
not resurrect accepted/hidden requests. Empty, loading, success, and error states
are announced through status/alert regions. Both controls remain disabled while
that card is submitting; other requests remain independent.

No schema/RLS changes, email sending, realtime subscription, or notification-store
rewrite are introduced. Discovery retains its existing 100-request bound. Tests
cover multiple requests, existing accounts, owner wording/routing, double clicks,
accept/dismiss/restore, errors, stale refreshes, membership refresh failure, protected
Settings access, verified identity checks, explicit terminal decline, and actual
SQL membership/dismissal transitions against all migrations in PGlite.
