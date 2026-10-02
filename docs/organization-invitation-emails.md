# Organization invitation emails

CSV upload, validation and import remain email-free. After confirmation, admins
review the row outcomes and counts, including new pending invitations, matched
existing accounts (a subset of those invitations), and rows needing attention.
**Send invitations** explicitly queues only invitations newly created by that
import. Reused invitations are not emailed again. An already-emailed invitation
is skipped by the initial import campaign; intentional resends use the Members page.

## Existing email infrastructure and configuration

OutClass uses Supabase Auth email/SMTP for sign-in and recovery. The repository
previously had no application sender or provider SDK. Application emails use
Nodemailer SMTP with the same provider/account configured for Supabase Auth;
no new provider is selected. Configure these server-only environment variables:

- SMTP_HOST, SMTP_PORT (default 587; 465 uses implicit TLS)
- SMTP_USER, SMTP_PASSWORD, SMTP_FROM_EMAIL
- OUTCLASS_SITE_URL (canonical HTTPS origin; HTTP localhost is allowed for development)
- CRON_SECRET (random secret for the optional protected delivery worker endpoint)

SMTP must support verified TLS (implicit TLS or required STARTTLS). Configuration
is checked before queueing/processing; missing settings show a clear error and do
not claim successful delivery. Auth SMTP secrets are not available through the
public Supabase client: copy the existing provider configuration into these
server environment variables. Sender/domain verification remains with that provider.

The transport disables file/URL content loading and debugging. It uses bounded
connection/socket timeouts and sends one recipient per message. Templates provide
plain text and escaped HTML with the organization name and university identity
matching explanation. The button opens normal sign-in at
`/?next=%2Fsettings%2Forganizations`. It contains no invitation ID, email address,
computing identifier or bearer secret for identity-bound invitations. Legacy
email-bound workspace invitations use the existing `/invitations/<uuid>` page:
that opaque record ID is not an authentication secret, and the page/action
requires the invited verified university email. This preserves existing
email-only invitations without granting access from a URL. Existing verified-identity discovery and
acceptance logic resolves requests after authentication; email possession does
not grant membership or bypass verification.

## Durable delivery and safeguards

`InvitationDelivery` remains the outbox. The migration adds ClubInvitation
firstEmailSentAt, lastEmailSentAt and emailSendCount, backfills prior sent deliveries,
validates counters/timestamps, and enforces one active QUEUED/SENDING delivery per
invitation. Existing RLS and browser grants remain unchanged.

Initial campaigns use a permanent `roster:<importId>:<invitationId>` key. The shared
organization lock coalesces repeated/concurrent requests. Resends have a 15-minute
cooldown and a 1,000-request hourly limit per sender and organization. The sender
User row is locked during enqueueing to enforce that limit across organizations.
Counts include failures and cancellations so cancellation cannot bypass limits.
Large imports exceeding available hourly capacity retain their import outcomes
but their email request transaction fails without partially queueing a campaign.

Queueing authenticates the sender and reloads organization-specific capabilities.
Targets are organization scoped; only completed imports may send. The worker
revalidates state, expiry, recipient mapping, current requester permissions and
original inviter authority before SMTP, under the same Club lock as acceptance,
revocation, member removal and ownership changes. Revoked, accepted, declined,
expired or no-longer-authorized requests are cancelled. Existing role delegation
limits prevent ordinary admins from emailing unauthorized owner grants.

Successful SMTP acceptance updates the delivery, aggregate timestamps/count, and
audit together. SENT means accepted by SMTP, not confirmed inbox delivery. Provider
message IDs are recorded. FAILED means a definitive SMTP rejection. Ambiguous
connection outcomes or database failure after SMTP leave SENDING with
DELIVERY_UNCERTAIN; they are never retried automatically. A crash after claiming
also leaves SENDING. SMTP cannot promise exactly-once delivery across network/DB
failures. An operator must review provider logs before resolving an uncertain
attempt; blind retries could send duplicates. No automatic expiration of claims
or automatic retry of uncertain attempts is implemented.

## Processing and deployment

The explicit send UI drains the queue in bounded server action batches. It reports
sent, failed, cancelled, uncertain and still queued counts. The Members page also
has **Send queued invitations** to resume after interruption. Resend queues a
request and processes a bounded batch; the displayed per-invitation delivery
status is authoritative, not a claim that every queued message was sent.

For delivery independent of an open browser, schedule authenticated HTTP POSTs to
`/api/internal/invitation-delivery`, using `Authorization: Bearer <CRON_SECRET>`.
The endpoint processes up to two messages from the oldest queued organization's
queue per request, with a 60-second route duration. Configure frequency for the
provider's throughput limits. No production scheduler or secrets were changed.
Worker authorization is rechecked for each delivery even with a valid worker secret.

Apply migrations using the existing Prisma deployment path, then generate the
client. Do not replay the archived Supabase migration stack. The implementation
was validated against local PGlite migration stacks, not the production database.
Live inbox delivery requires the existing provider credentials and was not tested.

## Tests

Coverage includes explicit batch sending, duplicate clicks/workers, resend,
cooldown/hourly limits, unauthorized senders, revoked/accepted/expired invitations,
identity/authority changes, SMTP rejection and ambiguous outcome handling,
metadata increments, templates and encrypted transport configuration. Migration
tests verify metadata backfill, legacy queue coalescing, active-delivery uniqueness,
invalid counters, and unchanged browser isolation. UI tests verify import remains
email-free and sending requires an explicit click with progress/error/retry states.
