-- Pin search_path on the 49 public trigger, guard and validation functions that the Supabase security
-- advisor reports as function_search_path_mutable. Uses the repo pattern for these functions
-- (search_path = pg_catalog, public), so a caller's search_path can no longer redirect the unqualified
-- table and function names inside them to objects in another schema.
--
-- ALTER FUNCTION ... SET changes only the function's configuration: bodies, owners, grants, SECURITY
-- (all are INVOKER) and the triggers and CHECK constraints that use them are untouched. Every body
-- references only public tables and pg_catalog functions, so name resolution is unchanged for callers whose
-- search_path already starts with public.
--
-- Each step is conditional so that environments without a function are unchanged. ALTER FUNCTION requires
-- ownership; a function this role does not own is reported as a WARNING and skipped (never an error, so a
-- failed ledger row cannot block later deploys) and must be pinned by its owner.
BEGIN;

DO $pin$
DECLARE
  sig text;
  fn regprocedure;
BEGIN
  FOREACH sig IN ARRAY ARRAY[
    'public.outclass_annotation_guard()',
    'public.outclass_audit_immutable()',
    'public.outclass_availability_override_guard()',
    'public.outclass_booking_panel_scope()',
    'public.outclass_cancel_booking_panel()',
    'public.outclass_collaboration_scope()',
    'public.outclass_decision_state_revision()',
    'public.outclass_disabled_room_approval()',
    'public.outclass_event_revision()',
    'public.outclass_event_withdraw()',
    'public.outclass_flyer_immutable()',
    'public.outclass_immutable_ballot()',
    'public.outclass_immutable_decision_letter()',
    'public.outclass_interview_immutable()',
    'public.outclass_interview_scope_guard()',
    'public.outclass_interview_submission_guard()',
    'public.outclass_invalidate_room_approval()',
    'public.outclass_invitation_notification()',
    'public.outclass_live_ballot_insert()',
    'public.outclass_live_presentation_snapshot()',
    'public.outclass_live_voting_candidate_scope()',
    'public.outclass_live_voting_entry_guard()',
    'public.outclass_live_voting_roster_guard()',
    'public.outclass_live_voting_scope()',
    'public.outclass_no_direct_without_vote()',
    'public.outclass_notification_email_outbox()',
    'public.outclass_notify(text,text,text,text,text,text,text)',
    'public.outclass_official_slot_panel_guard()',
    'public.outclass_panel_publication_guard()',
    'public.outclass_publication_guard()',
    'public.outclass_queue_flyer_deletion()',
    'public.outclass_reject_panel_preview_write()',
    'public.outclass_remove_replaced_flyer()',
    'public.outclass_revoke_interview_grants()',
    'public.outclass_room_booking_guard()',
    'public.outclass_room_panel_change()',
    'public.outclass_round_panel_revision_guard()',
    'public.outclass_rsvp_guard()',
    'public.outclass_scholar_status_valid(jsonb)',
    'public.outclass_task_notification()',
    'public.outclass_valid_availability(jsonb)',
    'public.outclass_valid_availability_override(text,text,text,text,text)',
    'public.outclass_valid_availability_ranges(jsonb)',
    'public.outclass_validate_changed_gpa()',
    'public.outclass_validate_panel_proposal()',
    'public.outclass_voting_candidate_setup_guard()',
    'public.outclass_voting_meeting_guard()',
    'public.outclass_voting_receipt_immutable()',
    'public.voting_display_snapshot_guard()'
  ] LOOP
    fn := to_regprocedure(sig);
    CONTINUE WHEN fn IS NULL;
    IF NOT pg_has_role(current_user, (SELECT proowner FROM pg_proc WHERE oid = fn), 'USAGE') THEN
      RAISE WARNING '% is not owned by %; pin its search_path as the owner', sig, current_user;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, public', fn);
  END LOOP;
END
$pin$;

COMMIT;
