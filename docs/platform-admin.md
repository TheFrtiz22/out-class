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

## Safe view-as (read-only impersonation)

The current architecture does **not** safely support delegating writable user sessions. View-as is an explicitly labeled, permission-aware support snapshot, not the complete target app UI and not a Supabase impersonation token.

- Start from a user row, supply a support reason, optionally select a club UUID, and type VIEW ONLY.
- The target must be an available non-admin account, different from the actor. A selected club must be one of the target's memberships. Target admin grants are rechecked during session reads.
- The server records a 30-minute `PlatformViewSession` bound to the original authenticated administrator and the target. It stores only a SHA-256 hash of a random 256-bit token. Starting a new session ends/audits previous actor sessions.
- A separate HttpOnly, SameSite=Strict cookie carries the token; it is Secure in production. Original Supabase session cookies are never replaced or deleted by this feature.
- The persistent banner identifies the target and provides Exit view-as. Ordinary page navigation returns to the dedicated snapshot. Account reads and all other mutations are blocked; original normal/admin server guards enforce the block independently of middleware.
- Snapshot reads recheck actor allowlist, active grant, MFA, expiry, and token/actor binding. Target suspension and selected-club membership are rechecked before displaying data. Recruitment aggregates reflect the target's review/identity permissions; private evaluations and identified applicants are not exposed through the target snapshot.
- The cookie marker intentionally persists beyond the view's expiry until explicit exit, so an expired view never silently becomes a writable admin context. Stale, invalid, ended, or foreign-actor sessions reveal no target data.
- Start, successful snapshot reads, explicit/expired/superseded/administrator-ended sessions, and blocked write attempts are audited with the original administrator and session ID. Middleware routes attempted mutations to an audited denial endpoint; it never executes the original action. If audit storage is unavailable, writes remain denied. Ending a verified session fails closed on database/audit failure. Unauthenticated or foreign actors can clear a stale local marker but cannot end another actor's database session; remaining expired rows can be terminated from the console.
- Exit is a same-origin POST and does not require a still-active admin grant or MFA; it verifies the original authenticated actor before ending a database session. This allows recovery after revocation without granting access. Endpoints reject cross-origin requests.

Read-only means there are no sensitive *successful* mutations under a target identity. To make a change, exit view-as and use the audited platform controls as yourself.

## Deployment and verification

Apply `20260925000000_platform_view_sessions` through the established migration process. It adds only the server-private session table with RLS, unique token hashes, and revoked browser grants. It preserves existing data. Configure `OUTCLASS_PLATFORM_ADMIN_IDS` on each intended deployment and provision active database grants and TOTP MFA through the existing process. No new environment variables or public keys are required.

Local tests exercise authorization, search scoping, read-only guards, token binding, origin checks, session expiry/revocation, audit attribution, suspension safeguards, and migration isolation. Live Supabase MFA/session refresh, multiple browser tabs, and deployment cookie behavior require a provisioned administrator account. Run the deployed smoke test: start a member-club view, refresh, attempt a write from an already-open tab (must fail), revoke the session from a second admin, verify target data stops loading, exit, and confirm the original account remains authenticated. Never test using real target credentials.
