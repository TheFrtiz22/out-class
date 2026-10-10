# Club leader Corkboard management

Public event management lives in **Meetings → Corkboard Events**. Member Meetings retains its existing agenda/resource/check-in tools and Meetings campus illustration. Old `section=events` links remain aliases. No additional sidebar destination, model, migration, storage system, or realtime service was added.

## Canonical operations

| Operation | Existing source |
| --- | --- |
| Event details and revision | Prisma `Meeting`, mapped to the `Event` table |
| Moderation, capacity, RSVP settings, category/contact | `EventPublication` |
| Create/edit | `saveCampusEvent` |
| Submit/pull | `commandCampusEvent` (`SUBMIT` / `WITHDRAW`) |
| Independent Admin approval/rejection | `reviewCampusEvent`, existing Admin Event Approvals |
| Private immutable flyer upload/replacement | `uploadEventFlyer`, `EventFlyer`, existing private Storage adapter |
| Flyer display | `/api/event-flyers`, event/revision-scoped no-store proxy |
| Public discovery and future club pages | `getPublicCorkboard`, `getPublicCampusEvent`, existing canonical public readers |
| RSVP creation/cancellation and capacity serialization | `setCampusEventRsvp`, unique `EventRsvp` records |
| Leader overview counts | `_count.rsvps` in the scoped event projection |
| Selected event count/capacity/attendees | `getCampusEventRsvpDashboard`, one repeatable-read transaction |

Draft, pending, rejected, stale-revision, suspended-club and pulled events remain private. Approved edits, including flyer and capacity changes, increment the revision and withdraw publication until independent reapproval. Withdrawal retains the Event, flyers, RSVP records and audit history. The canonical withdrawn state is DRAFT; it cannot reliably distinguish a pulled event from an edited draft after reload. The UI therefore shows the approval-required draft state and a specific withdrawal confirmation instead of inventing a stored removal status.

The overview separates upcoming and past records and provides pending, rejected, draft and closed filters. Detail offers edit/preview, submission, rejection feedback, review dates, withdrawal confirmation, and on-demand RSVP viewing. Capacity stays optional: unlimited means null, never an invented limit. Counts and attendees refresh explicitly and on browser-window focus; there is no realtime subscription or polling guarantee.

## Authorization and privacy

Leader overview and attendee reads reauthorize the current active identity, active club membership, capabilities, and suspension policy inside a transaction. Save, command and flyer upload use the existing `authorizeClubTransaction` pattern before locking the event. Club locks precede identity/member and event locks. Existing outer provider authentication remains required. Event ownership and optimistic revision checks remain in place. Admin allowlist, grant, MFA, fresh elevation, impersonation restrictions and independent review were not changed.

Attendee queries return only RSVP date, name and email. A submitted application in an anonymous-review round suppresses name/email as in the existing privacy policy. Only one application ID is queried as an existence check; no application answers, GPA, resumes, phone, demographic fields, or complete recruitment graph are loaded. Overview queries do not load attendees. The detail dashboard derives count from the same snapshot as the list so it cannot display a different aggregate from the returned roster.

Flyers remain private immutable objects; upload validates JPEG/PNG/WebP bytes and the existing 5 MB limit. Replace uses a new object/revision. Remove selects a structured template and saving clears the attachment. Browser clients receive only the existing proxy path, never privileged Storage URLs or base64 database blobs.

## Demo follow-up

The existing Demo adapter deliberately returns no public events and rejects event writes. A complete Demo event lifecycle would require new validated, persisted Demo graph records and relationships across student, leader, moderation and RSVP consumers. That work is deferred. Meetings displays an explicit unavailable message for Corkboard management in Demo and does not mount the live event editor. Adapter guards continue preventing live mutations. Member Meetings Demo behavior is unchanged.

## Verification

Focused tests cover local navigation/Demo isolation, confirmation and focus return, scoped narrow readers, same-snapshot counts, anonymous redaction, disabled/revoked/wrong-capability/suspended actors, and existing moderation/authorship/flyer/RSVP constraints. The local Corkboard E2E harness now performs current password + MFA elevation before Admin review.

Disposable local Auth, PostgreSQL, private Storage, genuine server actions, SQL triggers and competing RSVP connections were exercised. Chrome verified create/upload/save/preview/submit, independent Admin approval with fresh password/MFA, student RSVP/full capacity, leader attendee identity/count, student cancellation and leader refresh, material edits and withdrawal until reapproval, unlimited capacity, flyer removal, rejection feedback, past records and confirmed pull/public disappearance. Reapproval and rejected/past fixture setup used genuine local server actions; initial approval and the primary journey used Chrome UI.

Editor, detail/roster, overview/local switch and confirmation dialog were checked at widths 390, 640, 768, 1024 and 1440 with no document overflow. Existing Radix dialogs supply trapping/Escape semantics; explicit origin and post-withdrawal heading focus prevent focus loss when a remove control disappears. Native date controls required normal keyboard changes after the browser automation fill operation to commit React changes.

No production/staging connections, deployment, commit or push were performed. No migration was added.
