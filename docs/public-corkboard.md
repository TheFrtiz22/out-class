# Public Corkboard event system

Implemented Prompt 52 using the supplied Corkboard composition as a visual reference. No mockup pixels or fictional events ship in the product. The local verification runner deliberately seeds disposable fixtures.

## Data and lifecycle

`Meeting` still maps to the existing `Event` table and remains the canonical source for club, title, description, start/end and location. New relations are:

- `EventPublication`: moderation, category/contact, RSVP configuration, selected flyer, submitted/reviewed actor/time, rejection reason, approved revision and publication time.
- `EventFlyer`: immutable private object reference, validated MIME/size and upload provenance. Replacement always creates a new UUID path and row.
- `EventRsvp`: `(eventId, userId)` primary key and RSVP time. No `Application`, `ClubMember` or `EventAttendance` write occurs when RSVPing.

Migration: `20261005010000_public_corkboard`. It adds these tables, foreign keys, status/category/template/size/capacity/phase constraints, publication and RSVP lookup indexes, an Event date index, and an audit provenance lookup index. Existing append-only `AuditLog` records saves, submission/pending, approval/publication, rejection/reason, withdrawal, cancellation/archive, upload, RSVP changes and protected queue reads. Existing support auditing preserves real and effective actors.

Draft → submit (audited) → pending → explicit administrator approval → published. Rejection requires a reason. Cancelled and archived events are excluded from public reads. Only current, pending revisions can be reviewed. Current club managers and the submitting user cannot approve/reject their own event; real actors who authored content through support impersonation also cannot review it after exiting impersonation.

**Architecture A: withdraw until reapproval.** Canonical Event edits increment the revision and withdraw publication through database triggers, including legacy meeting/platform editors. Publication configuration or selected flyer changes also withdraw approval. Club editor changes increment revision and require resubmission. Existing RSVPs remain separate intent; their owners can cancel even after withdrawal/cancellation without receiving the new unapproved event content. Nothing automatically records check-in or enrols anyone.

## Authorization, RLS and storage

Club creation/edit/upload/submit/withdraw/cancel/archive checks current `meetings.manage` capability and club ownership of the event. Attendee access requires `meetings.attendance`, is scoped to the event’s club and preserves existing anonymous-applicant identity redaction. RSVP checks verified UVA authentication. Admin review uses the existing independent platform grant, server allowlist, actual MFA and no-impersonation boundary.

All three new tables enable RLS, revoke browser privileges and have restrictive `false` policies for every operation, so an accidental permissive policy cannot open direct CRUD. Trusted server database access performs the application authorization checks.

The `event-flyers` bucket stays private **after approval too**. Restrictive policies on both provider-owned `storage.objects` and `storage.buckets` deny browser operations against the bucket, including attempts to make it public, while preserving other buckets. Runtime capability issuance checks the actual policies, their predicates/roles and both tables’ RLS, as well as the bucket’s private flag. Missing provider tables/policies fail closed.

Authenticated uploads validate signatures, declared type and a 5 MiB maximum using the existing secure image validator; the server derives `{clubId}/{eventId}/{uuid}.{ext}`. An event row lock prevents upload/edit/review races. A failed transaction attempts to remove its new private object. Superseded private objects remain retained; they are not public capabilities.

`GET /api/event-flyers?eventId=…&revision=…` streams private bytes only for current approved publication. Authorized club managers/admins can request `preview=1`. Neither public DTOs nor the client receive object paths, public Storage URLs or reusable signed URLs. The route checks revision/publication again after download, sends `private, no-store`, `nosniff` and no-referrer, and bypasses image-optimizer caching. Withdrawal, replacement, cancellation and archive deny subsequent public requests; old revisions return 404. Previously delivered/downloaded copies cannot be recalled.

If Storage is absent while deploying to plain PostgreSQL, the migration emits a notice and skips only its provider-owned storage block. Provision Storage and execute that block before enabling uploads; runtime attestation rejects uploads/reads until it is present. No alternate Supabase application migration history was introduced.

## Public consumer audit

| Consumer | Decision |
| --- | --- |
| Public Corkboard/list/detail/flyer route | Only current approved public recruitment events. Public DTO contains explicit structured fields, counts and checked proxy URL. No moderation actors/reasons/private references. |
| `getClubEvents` | Ordinary legacy public recruitment meetings remain visible; events with publication metadata require published status. No flyer relation is selected. |
| `getClubDirectory`, `getPublicClub`, saved-club projections | Same approval filter and explicit public fields. Directory club metadata remains cached, but events are read fresh so withdrawal does not wait for cache expiry. No flyer/moderation fields. |
| `listMeetings`, `getMeeting` | Public branch uses the approval filter. Current active members retain authorized internal meeting access; meeting DTO excludes flyers. |
| Public QR check-in | Reads publication and rejects unapproved public access; membership branch remains an authorized internal check-in flow. Attendance is unchanged. |
| Student dashboard/calendar/marketing projections | Public event/attendance branches use the same approval filter. Existing active-club member access remains intentional. Calendar/home consume these projections and cannot retrieve pending flyers. |
| Club overview and recruitment attendance reporting | Existing permission-scoped internal data. RSVP is not attendance and does not affect those summaries. |
| Demo Mode | New live writes are blocked; event reads are empty. Saved-club demo behavior is preserved. No generated sample board masquerades as live data. |

Existing `CorkboardClub` rows and shared optimistic saving behavior remain intact under **Saved clubs** at `/saved-clubs`, linked from Discover and Corkboard. The tutorial’s Corkboard explanation now describes campus events.

## UI and dates

Public `/corkboard` and personal-workspace Corkboard use the same pinned-flyer board, compact date/search/filter controls and accessible centered flyer dialog. The flyer remains prominent, with dimming, pin release/lift and reverse animation; Escape, keyboard activation, focus return and reduced-motion CSS are supported. Mobile uses two readable flyer columns and a scrollable detail composition. Four structured OutClass templates reuse the established UVA vector illustration system, plus validated image uploads.

Club workspace → Club → Events supports Upcoming, Past (including archived), Pending Approval, Rejected, Cancelled and Drafts; structured editor/preview/upload; RSVP configuration; submission and authorised attendee lists. `/platform/events`, linked from platform administration, shows pending count, protected previews and explicit Approve & Publish / Reject controls. The queue returns up to 100 rows at a time; processed pending rows leave the queue.

All date inputs, display and filters use `America/New_York`. All Events shows upcoming/ongoing published events. Today is local midnight to next midnight. This Week is Monday midnight through next Monday. Weekend is the upcoming/current Saturday through Monday (Sunday includes its Saturday). Exact date overrides period. Intervals are half-open and include multi-day overlaps. DST days can have 23/25 hours; nonexistent spring wall times are rejected and fall ambiguity chooses the earlier occurrence, disclosed in the editor. Name/date sorts have stable ID tie-breaking and the public board paginates 60 events at a time.

## Verification and reproduction

- `npm run validate` runs all unit tests, the existing migration suite, lint, typecheck and production build. For this task it runs through `node scripts/run-corkboard-local.cjs validate`, which supplies dedicated localhost Auth/DB/Storage variables and invokes that exact npm command.
- `tests/campus-events.test.cjs`: complete migration chain in disposable PGlite, moderation/revision/storage/immutable flyer/RLS constraints, dates/DST and strict input validation.
- `tests/campus-events-ui.test.cjs`: keyboard-trigger/dialog structure, original flyer, focus return and reduced-motion rules; existing saved-club/navigation/meeting/directory tests were updated.
- `tests/corkboard-e2e.test.cjs`: actual local Supabase Auth/MFA, production server actions, PostgreSQL, private Storage, upload validation/ownership/privacy, moderation/reapproval/rejection, public-consumer leakage, self-review including real/effective actor provenance, RSVP idempotence/cancellation/deadline, anonymity, and two independent competing database connections. The fixture-only SQL approval used for visual fixtures is confined to this guarded local test.
- Isolated Chrome verification covered desktop/mobile composition, no horizontal overflow, search, keyboard opening/Escape/focus return, real leader login and editor/draft/submission, real admin MFA/review/publication, public appearance, RSVP and cancellation. Reduced-motion rules are tested by the unit suite; the browser checks used the browser’s normal motion preference.

Reproduce in a fresh local disposable project:

```sh
node scripts/prepare-corkboard-e2e.cjs
node scripts/run-corkboard-local.cjs validate
node scripts/run-corkboard-local.cjs start
# In another terminal, use the config.json path printed by prepare:
OUTCLASS_CORKBOARD_E2E_CONFIG=/absolute/temp/path/outclass-corkboard-e2e/config.json \
  node --test tests/corkboard-e2e.test.cjs
```

The scripts use project `outclass-corkboard-e2e`, API/DB ports 56321/56322 and app 3108; they reject non-local service URLs. Test credentials/config are kept outside the repository with mode 0600. They do not load production environment files when provisioning. Stop only this project with `supabase stop --workdir /absolute/temp/path/outclass-corkboard-e2e` and terminate its app process when review is finished.

No staging/production migration, deployment, commit or push was performed. Superseded private asset retention is an operational cleanup consideration, not a publication capability; future cleanup must preserve currently selected references.

## Changed files

- Schema/migration: `prisma/schema.prisma`, `prisma/migrations/20261005010000_public_corkboard/migration.sql`.
- Actions/boundaries: `actions/campus-events.ts`, `actions/event-flyers.ts`, `actions/club-directory.ts`, `actions/events.ts`, `actions/meetings.ts`, `actions/applications.ts`, `lib/campus-events.ts`, `lib/meetings.ts`, `lib/workspace-api.ts`, `utils/event-flyer-storage.ts`, `app/api/event-flyers/route.ts`.
- Screens/navigation: `components/events/{public-event-board,event-flyer,club-events,event-approvals}.tsx`, `components/events/events.css`, `components/views/{corkboard-view,saved-clubs-view,explore-view}.tsx`, `components/clubs/corkboard-button.tsx`, `components/club-workspace.tsx`, `lib/club-workspace.ts`, `lib/product-navigation.ts`, `lib/tutorials.ts`, `app/{corkboard,saved-clubs}/page.tsx`, `app/platform/events/page.tsx`, `app/platform/page.tsx`, `next.config.mjs`, `public/images/events/{cork,paper}.svg`.
- Verification: the three new test files above, `tests/{club-directory,club-marketing,club-workspace,explore-corkboard-ui,meetings,server-boundaries}.test.cjs`, `scripts/prepare-corkboard-e2e.cjs`, `scripts/run-corkboard-local.cjs`, and this report.

Final results (2026-10-06): `npm run validate` passed: 608 tests total, 604 passed and four configuration-dependent E2E tests skipped; migration suite, lint (zero errors, 28 existing warnings), typecheck and production build passed. The separately configured Corkboard E2E passed with no skips. The final production build and final desktop/mobile Chrome checks passed. Review captures are `/tmp/outclass-corkboard-board.jpg`, `/tmp/outclass-corkboard-detail.jpg` and `/tmp/outclass-corkboard-mobile.jpg`; the dedicated local preview remains at `http://127.0.0.1:3108` for review.
