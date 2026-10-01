# Member roster CSV imports

The existing club workspace **Members** page exposes the importer to users with
`members.manage` (including owners). Server authorization runs on both preview and
confirmation and is rechecked under the organization transaction lock. Demo mode
does not invoke live imports. CSV imports grant only the organization-local MEMBER
role; they cannot assign management permissions or ownership.

CSV requires `name` and `computing_id`; `year` is optional. Comma-separated files
support UTF-8 BOM, CRLF/LF, quoted commas and escaped quotes. Headers are case- and
space/underscore/hyphen-insensitive, with explicit aliases: `Full Name`,
`Graduation Year`, `Grad Year`, and `Computing ID`. Unknown, ambiguous, duplicate,
or missing headers fail rather than guessing. Structural errors require reupload.
Files are capped at 1 MiB, 1,000 data rows, three columns, and 2,000 characters per
cell on both the client and server. Blank lines are ignored; explicit empty records
are validated. School identifier normalization and validation use the configured
school mapping, including the existing UVA computing-ID grammar. Unsupported or
ambiguous school email mappings require configuration before import.

Rows validate required names/identifiers, control characters, formula-like names,
identifier syntax, and the profile wizard's supported years (2025–2030). Missing
year is a warning. The first valid occurrence of an identifier can proceed; later
valid occurrences are duplicates. An invalid earlier row does not suppress a later
valid one. Existing users are matched for preview/audit only: email matching never
verifies or binds a school identity. Ambiguous/disabled accounts require review.
Active members and unexpired pending identity or legacy-email invitations are
excluded. Names, filenames, identifiers, and errors render as escaped React text.
No HTML, formula evaluation, CSV export, or raw uploaded-file hosting is involved.

`previewRosterImport` parses the original text independently of client validation,
persists `RosterImport` and immutable `RosterImportRow.input` values, and records an
audit event. It creates no identities, invitations, users, memberships or deliveries.
The request UUID plus content hash prevents a retry from changing the upload.
Reuploading uses a new UUID. A retried preview can exclude newly invalid/member/
invited rows but cannot silently include previously excluded rows.

The preview includes a summary, per-row errors/warnings, existing-account badges,
and a horizontally scrollable table paginated at 50 rows for mobile. Admins can
correct/reupload or explicitly confirm only ready rows. Confirmation is restricted
to the uploader, rechecks permission, school configuration, row eligibility,
memberships and invitations, and uses persisted input rather than browser rows.
Eligible rows create pending seven-day MEMBER invitations, with reserved school
identities and audit attribution. Expired identity-bound pending invitations are
expired/audited before replacement. No fake User is created, no membership is added,
existing invitations are not upgraded, and no email is sent or queued.

Confirmation, row outcomes, import counts, and audits commit atomically. Repeated
confirmation returns the completed result instead of creating duplicates. Rows
that became ineligible since preview are skipped and recorded. Counts represent
invitations actually created; skips include duplicates, invalid rows, existing
members and pending invitations. The transaction timeout is 60 seconds; failure
rolls the import back and allows retry. Larger background imports and email delivery
are future work.

No schema, RLS or migration changes are needed. Tests cover parser limits and
quoting, validation, authorization, state changes, idempotency, UI loading/error/
confirmation behavior, safe text rendering, and atomic rollback against all current
migrations in PGlite. Live authentication and multi-connection PostgreSQL tests are
separate deployment smoke checks.
