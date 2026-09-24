# Interview kits

Managers with `interviews.manage` configure ordered questions and optional guidance under **Interview kits** in the recruitment workspace, Interview Mode, or Club settings. Questions can be added, edited, deleted, and moved using keyboard-accessible controls. Kit version checks reject stale edits instead of overwriting another manager’s work. Saving a kit is audited.

## Sessions and persistence

Opening a candidate creates or resumes one `InterviewRecord` per applicant, interviewer membership, and recruitment-round ID. It snapshots the configured questions and guidance. Subsequent kit edits do not rewrite an existing interview. An empty kit supports off-script questions and an overall review; it does not fabricate questions.

Question notes appear directly beneath each prompt. Off-script questions and their notes are saved separately under Additional Questions. Closing review includes an additional-question summary, Overall Review, and the existing overall 1–10 score. No new scoring rubric formula is invented; optional question guidance supports that existing score.

Drafts autosave after an 800ms pause and have an explicit Save draft control. Edits made during a save are queued for a subsequent save. Revision checks reject stale saves from other tabs. Failures keep the current text onscreen and show an error; retry or copy unsaved text before reloading. Navigation/unload warnings cover unsaved changes. There is no claim of offline persistence: a disconnected browser cannot save to the server. Click Add question to attach an off-script prompt before completing.

Completion validates the score, freezes the interview record, and upserts the existing overall evaluation in one transaction, with an audit record. Question-specific notes never replace overall evaluation notes. Complete & next advances only after a successful response. Completion does not change application round/status/decision. The existing scheduled-interview agenda remains unchanged; session identity follows the existing per-reviewer/per-round evaluation model rather than creating new bookings.

Completed records remain readable by their author while the applicant is in that round. Previous-round records are retained in the database, but this version does not add a cross-round interview-record browser or team-wide question-note sharing. Existing prior-round overall evaluations remain available under their existing permissions. Later edits to an overall evaluation elsewhere do not rewrite the frozen original interview record.

## Authorization and anonymous review

Session APIs require `applications.review` and recheck the current membership, club, applicant, and round within the transaction. Identified rounds additionally require `applicants.identify`. Drafts and completed question notes are accessible only through the author-scoped session API; they are not attached to general pipeline, search, or other-reviewer responses. Anonymous completion redacts overall evaluation notes in its shared response; authors can resume their own session notes.

Each session snapshots its privacy mode. If the round privacy mode changes, that session becomes inaccessible until its original privacy mode is restored. This prevents an identified interview’s saved notes from becoming an anonymous-review backdoor. No destructive automatic redaction/reset occurs. Original candidate content continues through the existing anonymous projection and audited reveal flow. Managers should configure privacy before interviews begin.

`InterviewRecord` has RLS enabled and no browser API grants. Membership deletion is blocked when interview history exists; revoke capabilities instead. The résumé-download route was also tightened to require identified-applicant access and a non-anonymous round. Password hashes are omitted from live pipeline/attendance payloads.

## Migration and deployment

Apply `20260924020000_interview_kits` after the existing authorization, claiming, and anonymous-review migrations. It adds JSON kit configuration/version to `PipelineRound` and a separate `InterviewRecord` table. Existing evaluations/applications are not rewritten. Existing rounds default to an empty kit.

The repository schema had drifted from existing migrations: authorization/admin/claims, ACT, and anonymous-review definitions were missing. Those definitions were restored to match the migration history rather than generating destructive schema changes. Missing profile validation imports were restored as well.

The existing `InterviewSlot.club` relation now has its corresponding foreign key, added conditionally as NOT VALID to preserve legacy orphan slots. New writes are enforced; deployment operators should reconcile any legacy orphan slots and then validate that constraint separately. No existing slots are deleted by this migration.

Live deployment requires Prisma `DATABASE_URL` and the baseline procedure in `authorization.md` for pre-migration installations. No live database was changed in this task.

## Demo and validation

Fictional kits, additional questions, saved drafts, completed interviews, scores, and scheduled slots are included for MII and other demo clubs. Completed sample bookings occur in the past. Only MII management remains accessible through the demo identity; the change does not grant leadership to other clubs. Existing saved presentations receive kit defaults without resetting their applications; reset the demo to see the new completed-session fixtures. Demo operations use the isolated local adapter and invoke no live interview actions.

Tests cover kit order/version checks, stable snapshots, resume/autosave persistence, off-script notes, atomic completion, stale revisions, changed rounds, permission revocation, privacy-mode changes, anonymous responses, and demo isolation. An isolated PostgreSQL migration test checks preserved evaluations, session uniqueness, and browser-role denial. Real database/Supabase and concurrent-browser verification still require deployment configuration.
