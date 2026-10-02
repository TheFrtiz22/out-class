# Guided organization onboarding

First-time authenticated users continue through the existing student profile
wizard. `InvitationProfileSuggestions` calls the existing verified-identity
invitation action, including dismissed requests so known details are available.
There is no new identity input, auth system, or invitation acceptance endpoint.

The wizard suggests first/last name and a supported graduation year only for
blank, untouched fields. Owner designation data is preferred; missing fields may
come from another invitation for the same verified identity. Metadata, existing
values and edits (including deliberately cleared fields) remain unchanged.
Suggestions are editable and names are split using the existing profile model.
Major is still required; academic tests and experience remain optional according
to the current profile schema. The authenticated email is read-only, and returning
to account review after signup no longer asks for a password again.

While completing a profile, users see a welcome/designation explanation rather
than actionable invitation cards that would take them away mid-profile. Saving
uses the existing profile action and reload/return-path handling. The dashboard
and Settings subsequently show the existing pending member/owner invitations.
Dismissal rules remain unchanged. Owners see “You’re the designated administrator
for <organization>” and **Claim organization**. The existing atomic claim action
routes them into Club Overview without a new client-local onboarding flag.

## Organization setup checklist

Club Overview shows a responsive checklist to authenticated active owners, using
the centralized ownership capability. Demo Mode is unchanged. The server action
requires current club-settings access, rechecks the membership, and scopes every
query to that organization. Progress derives from saved state:

| Step | Completion evidence | Existing destination |
| --- | --- | --- |
| Claim organization | claimedAt or an active owner with an enabled account | Club Overview |
| Complete organization profile | Name, tagline and description present | Club Settings profile editor |
| Upload member roster | Completed import with at least one created/reused invitation or already-member row | Members CSV importer |
| Assign administrators | An active enabled non-owner member with member management, leadership delegation or recruiting management capabilities | Members role management |
| Configure recruiting | At least one saved recruitment round | Recruiting privacy and requirements |

Empty/invalid-only imports, pending administrator invitations, inactive/disabled
members and global/legacy User role labels do not satisfy the checklist. Setup is
suggested guidance; it does not block normal workspace activity. Progress refreshes
from the server on returning to Overview or choosing Refresh progress. Completed
setup collapses into a reviewable list. Links honor existing unsaved-change guards.

The current recruiting interface edits existing rounds; initial round creation is
an OutClass administration function. The checklist says to contact OutClass when
no rounds exist and links to the existing recruiting settings. It does not create
placeholder rounds or rebuild recruiting features. No schema/migration is needed.

Tests cover verified suggestions, unavailable/unverified discovery, editable form
prefill and preserved email/edits, deferred invitation actions, server access and
query scope, saved-state completion, role/capability distinctions, and checklist
links/loading/retry/refresh. Existing claim/profile/dashboard suites remain active.
