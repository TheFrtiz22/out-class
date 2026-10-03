# Protected platform administration

The platform console is separate from student and club workspaces at `/platform`, with administrator sign-in at `/platform/login`. Every server read, inspection, and mutation requires all of:

1. A current authenticated UVA user who is not suspended.
2. That exact Supabase user UUID in server-only `OUTCLASS_PLATFORM_ADMIN_IDS`.
3. An active `PlatformAdmin` database grant for that UUID.
4. A verified MFA session at `aal2`.

Neither profile roles, club ownership, client state, demo state, nor navigation grants platform access. Admin provisioning, grant revocation, migrations, storage policies, backups, and arbitrary SQL remain operator responsibilities; the console cannot promote a user into a platform administrator. No credentials are embedded in source or sent to the console.

## Records and management

The console has server-side search and paginated resource views for users, clubs, claims, memberships/capabilities, recruitment rounds/questions/interview slots, applications, meetings, tasks/projects, task submissions, demo/platform content, audit logs, and view sessions. Relevant filters include club/user UUIDs, status, capability, date range, and audit action. Text search varies by resource: names/email for identities, titles/content for assignments, and action/actor/target/reason for audit records. UTC date filters apply to creation time except meeting date, interview start, assignment time, and content update time. Results are limited to 100 per page, with deterministic tie-break sorting. Offset pagination can shift during concurrent writes.

Inspect fetches detailed application responses/evaluations/interviews, user profile/membership records, meeting attendance, or task submissions only after an explicit audited request. User/account results exclude password hashes. Session results exclude token hashes. Private attachments remain private; the platform console shows file metadata rather than impersonating a member to generate downloads.

Management uses structured forms backed by the existing closed Zod operation schema. The exact payload is reviewable, a reason is required, and the UI requires typing APPLY. Claim approvals retain their existing explicit confirmation and manual review. Changes commit with their audit record. Existing safeguards preserve the last club owner, prevent self-suspension, block suspension of platform-grant accounts, prevent suspension of a last active club owner, preserve answered questions, and require expected application status for decisions. Administrator task edits increment task revision. No bulk deletion or arbitrary model-field update interface is exposed.

Club claim approvals and membership changes are searchable in the audit log; claim events include their club context. Audit storage remains append-only through the existing database trigger. Content-change audit records log key and size rather than duplicating potentially large payloads. `demo.seed` continues to use the existing demo-template validator.

## Customer-service impersonation

The current `/platform/view-as` flow opens the customer's real application workspace using a server-validated effective identity. Starting it requires the existing administrator allowlist, active grant, MFA AAL2, support reason, and `LOG IN AS` confirmation. Original Supabase login cookies remain intact; no customer token is minted. A hashed random support-session token binds the original actor, target and 30-minute lifetime.

Every sensitive operation uses the target's current capabilities; the administrator does not gain extra club access through impersonation. The persistent banner identifies the target and provides Exit. Support writes and sensitive reads use the existing audit infrastructure with original/effective identities and reason. Privileged authentication/admin/ownership actions are blocked, target provider verification is checked where required, and expired/revoked/forged sessions fail closed. Tutorial previews do not consume the customer's progress. See [support impersonation and tutorials](support-impersonation-tutorials.md) and the [final integration audit](product-integration-audit.md) for current behavior. The earlier read-only snapshot mode is historical and does not describe current support access.

## Deployment and verification

Apply `20260925000000_platform_view_sessions` through the established migration process. It adds only the server-private session table with RLS, unique token hashes, and revoked browser grants. It preserves existing data. Configure `OUTCLASS_PLATFORM_ADMIN_IDS` on each intended deployment and provision active database grants and TOTP MFA through the existing process. No new environment variables or public keys are required.

Local tests exercise authorization, search scoping, read-only guards, token binding, origin checks, session expiry/revocation, audit attribution, suspension safeguards, and migration isolation. Live Supabase MFA/session refresh, multiple browser tabs, and deployment cookie behavior require a provisioned administrator account. Run the deployed smoke test: start a member-club view, refresh, attempt a write from an already-open tab (must fail), revoke the session from a second admin, verify target data stops loading, exit, and confirm the original account remains authenticated. Never test using real target credentials.
