# Live schema inventory

Read from PostgreSQL catalogs on 2026-10-18. No student rows or object names were exported. Full definitions are in [database-schema.json](evidence/database-schema.json).

PostgreSQL 17.6; 78 application tables plus `_prisma_migrations`; no public/storage views or materialized views observed. The public schema has 775 columns, 384 constraints and 235 indexes, including migration bookkeeping. There are 49 public functions, 58 non-internal triggers in public/auth, and 66 policies across public/storage.

| Table | Columns | Foreign keys | Indexes | RLS | Explicit policies |
|---|---:|---:|---:|---|---:|
| `AdminElevation` | 10 | 1 | 3 | Enabled | 1 |
| `AdminElevationChallenge` | 12 | 1 | 3 | Enabled | 1 |
| `ApplicantObservation` | 8 | 2 | 3 | Enabled | 0 |
| `Application` | 10 | 4 | 7 | Enabled | 0 |
| `ApplicationAnswer` | 4 | 2 | 2 | Enabled | 0 |
| `ApplicationQuestion` | 9 | 1 | 3 | Enabled | 1 |
| `AuditLog` | 10 | 0 | 4 | Enabled | 0 |
| `Club` | 29 | 1 | 3 | Enabled | 1 |
| `ClubAnnouncement` | 10 | 2 | 3 | Enabled | 1 |
| `ClubClaim` | 6 | 2 | 2 | Enabled | 0 |
| `ClubConversation` | 6 | 2 | 4 | Enabled | 1 |
| `ClubInvitation` | 27 | 6 | 8 | Enabled | 1 |
| `ClubMember` | 15 | 2 | 5 | Enabled | 1 |
| `ClubMessage` | 7 | 2 | 4 | Enabled | 1 |
| `ClubTask` | 14 | 3 | 2 | Enabled | 0 |
| `CorkboardClub` | 3 | 2 | 2 | Enabled | 0 |
| `DecisionLetter` | 7 | 2 | 3 | Enabled | 1 |
| `EditorDraft` | 8 | 1 | 2 | Enabled | 1 |
| `Evaluation` | 10 | 3 | 3 | Enabled | 0 |
| `Event` | 14 | 1 | 3 | Enabled | 0 |
| `EventAttendance` | 4 | 2 | 3 | Enabled | 0 |
| `EventFlyer` | 7 | 1 | 3 | Enabled | 1 |
| `EventFlyerDeletion` | 2 | 0 | 1 | Enabled | 1 |
| `EventPublication` | 19 | 2 | 4 | Enabled | 1 |
| `EventRsvp` | 3 | 2 | 2 | Enabled | 1 |
| `Experience` | 5 | 1 | 1 | Enabled | 0 |
| `InterviewAnnotationRevision` | 6 | 2 | 2 | Enabled | 0 |
| `InterviewAvailabilityOverride` | 14 | 4 | 2 | Enabled | 0 |
| `InterviewBooking` | 5 | 3 | 3 | Enabled | 0 |
| `InterviewCollaboration` | 9 | 4 | 3 | Enabled | 0 |
| `InterviewInvitation` | 4 | 2 | 3 | Enabled | 0 |
| `InterviewMove` | 9 | 4 | 2 | Enabled | 0 |
| `InterviewPanelAssignment` | 9 | 5 | 4 | Enabled | 0 |
| `InterviewPanelProposal` | 16 | 3 | 4 | Enabled | 0 |
| `InterviewPanelScheduleVersion` | 16 | 2 | 4 | Enabled | 0 |
| `InterviewPresence` | 5 | 2 | 3 | Enabled | 0 |
| `InterviewRecord` | 13 | 4 | 3 | Enabled | 0 |
| `InterviewResumeAnnotation` | 10 | 2 | 2 | Enabled | 0 |
| `InterviewResumeDocument` | 8 | 2 | 2 | Enabled | 0 |
| `InterviewRoom` | 17 | 3 | 3 | Enabled | 0 |
| `InterviewRoundParticipation` | 13 | 2 | 4 | Enabled | 0 |
| `InterviewSlot` | 11 | 3 | 7 | Enabled | 0 |
| `InvitationDelivery` | 16 | 2 | 7 | Enabled | 1 |
| `MeetingCheckInToken` | 6 | 1 | 3 | Enabled | 0 |
| `NotificationEmailDelivery` | 14 | 1 | 3 | Enabled | 1 |
| `NotificationEmailOutbox` | 4 | 2 | 3 | Enabled | 1 |
| `PipelineRound` | 20 | 2 | 4 | Enabled | 1 |
| `PlatformAdmin` | 3 | 1 | 1 | Enabled | 0 |
| `PlatformContent` | 4 | 0 | 2 | Enabled | 0 |
| `PlatformReport` | 12 | 1 | 3 | Enabled | 1 |
| `PlatformViewSession` | 10 | 0 | 3 | Enabled | 0 |
| `RecipientGroup` | 8 | 1 | 4 | Enabled | 1 |
| `RecipientGroupEntry` | 3 | 2 | 2 | Enabled | 1 |
| `RecruitingRule` | 6 | 1 | 1 | Enabled | 0 |
| `RecruitingRuleFlag` | 6 | 2 | 1 | Enabled | 0 |
| `RecruitmentCycle` | 5 | 1 | 3 | Enabled | 1 |
| `RosterImport` | 14 | 2 | 4 | Enabled | 1 |
| `RosterImportRow` | 16 | 4 | 3 | Enabled | 1 |
| `SavedCampusEvent` | 3 | 2 | 2 | Enabled | 1 |
| `ScheduledCommunication` | 26 | 3 | 6 | Enabled | 1 |
| `School` | 5 | 0 | 2 | Enabled | 1 |
| `SchoolIdentifierType` | 8 | 1 | 3 | Enabled | 1 |
| `SchoolIdentity` | 10 | 3 | 4 | Enabled | 1 |
| `SchoolRequest` | 14 | 1 | 4 | Enabled | 1 |
| `StudentProfile` | 23 | 1 | 3 | Enabled | 1 |
| `TaskAssignment` | 15 | 3 | 4 | Enabled | 0 |
| `TaskFile` | 8 | 1 | 3 | Enabled | 0 |
| `User` | 5 | 0 | 3 | Enabled | 1 |
| `UserAvailability` | 4 | 1 | 1 | Enabled | 0 |
| `UserNotification` | 13 | 3 | 6 | Enabled | 1 |
| `UserNotificationPreference` | 10 | 1 | 1 | Enabled | 1 |
| `UserTutorial` | 6 | 1 | 1 | Enabled | 0 |
| `VotingBallot` | 7 | 2 | 2 | Enabled | 0 |
| `VotingCandidate` | 5 | 2 | 2 | Enabled | 0 |
| `VotingParticipant` | 3 | 2 | 1 | Enabled | 0 |
| `VotingPass` | 5 | 1 | 1 | Enabled | 0 |
| `VotingPassCandidate` | 7 | 2 | 2 | Enabled | 0 |
| `VotingSession` | 19 | 2 | 2 | Enabled | 0 |
| `_prisma_migrations` | 8 | 0 | 1 | Off; no browser grants | 0 |

All application tables are owned by `outclass_production_app`; RLS is not forced. Every effective anon/authenticated SELECT/INSERT/UPDATE/DELETE privilege on public tables was false. Tables with no policies default-deny browser rows; that is intentional here. `_prisma_migrations` is owned by postgres, has RLS off and denies browser CRUD.

Foreign-key endpoints, check expressions, unique keys, index definitions, trigger bodies and function ACLs are recorded in the JSON rather than inferred from Prisma alone. Prisma `Meeting` maps to PostgreSQL `Event`; do not count both as separate tables.

The sole public SECURITY DEFINER function is `handle_new_user()`, a trigger-returning function with an empty search_path. Browser EXECUTE grants are unnecessary, but the advisor does not prove it can be called as an ordinary RPC. Other public functions are invoker functions; 41 lack a fixed search_path. Browser roles and the runtime app role have no CREATE privilege on public.

Storage: five private buckets. `resumes` and `headshots` lack bucket-level file size/MIME limits, although server upload actions enforce limits. Restrictive guards override older permissive headshot/read and club-asset policies. Task submissions and event flyers use server-only reads/writes. See all policy commands, USING and WITH CHECK expressions in JSON. No Realtime publication tables were observed.

All 56 local migration names are present and finished live, with none rolled back. Four byte checksums differ; each matches exactly after LF-to-CRLF conversion (see [migration-comparison.json](evidence/migration-comparison.json)). Do not resolve or rewrite production migration history for this.

Two CHECK constraints are NOT VALID: `Evaluation_score_range_check` and `InterviewSlot_positive_window`. New/updated rows are checked, but historical rows have not been certified by VALIDATE CONSTRAINT. Their violation counts are checked separately before proposing validation.

Catalog scope: public and storage definitions plus application triggers in auth. Exposed PostgREST schema configuration could not be established from current_setting(pgrst.db_schemas), which returned null. No blanket claim is made about arbitrary future/custom exposed schemas or provider-owned internals.
