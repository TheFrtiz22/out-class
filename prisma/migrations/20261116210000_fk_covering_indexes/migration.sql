-- Covering indexes for foreign keys reported by the database performance advisor as having no
-- index whose leading columns are the key's columns. Each index uses the key's own column order
-- and Prisma's default name, matching the @@index entries in schema.prisma. Purely additive: no
-- table, column, constraint, policy, grant, trigger or function change, and no index is dropped.
-- Not CONCURRENTLY: the migration runs in one transaction and every affected table holds at most
-- a few hundred rows, so each build takes milliseconds (it briefly blocks writes, not reads, on
-- that table). Composite keys that already have an index on the same columns in another order
-- are covered and left alone. Rollback: DROP INDEX for the names below.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE INDEX IF NOT EXISTS "ApplicantObservation_clubId_idx" ON "ApplicantObservation"("clubId");
CREATE INDEX IF NOT EXISTS "ApplicantObservation_cycleId_idx" ON "ApplicantObservation"("cycleId");
CREATE INDEX IF NOT EXISTS "ApplicantObservation_roundId_idx" ON "ApplicantObservation"("roundId");
CREATE INDEX IF NOT EXISTS "ApplicantRecusal_applicationId_clubId_idx" ON "ApplicantRecusal"("applicationId", "clubId");
CREATE INDEX IF NOT EXISTS "Application_recruitmentCycleId_clubId_idx" ON "Application"("recruitmentCycleId", "clubId");
CREATE INDEX IF NOT EXISTS "ApplicationAnswer_questionId_idx" ON "ApplicationAnswer"("questionId");
CREATE INDEX IF NOT EXISTS "Club_schoolId_idx" ON "Club"("schoolId");
CREATE INDEX IF NOT EXISTS "ClubAnnouncement_authorId_idx" ON "ClubAnnouncement"("authorId");
CREATE INDEX IF NOT EXISTS "ClubClaim_userId_idx" ON "ClubClaim"("userId");
CREATE INDEX IF NOT EXISTS "ClubInvitation_claimedUserId_idx" ON "ClubInvitation"("claimedUserId");
CREATE INDEX IF NOT EXISTS "ClubInvitation_clubId_schoolId_idx" ON "ClubInvitation"("clubId", "schoolId");
CREATE INDEX IF NOT EXISTS "ClubInvitation_invitedBy_idx" ON "ClubInvitation"("invitedBy");
CREATE INDEX IF NOT EXISTS "ClubInvitation_schoolId_idx" ON "ClubInvitation"("schoolId");
CREATE INDEX IF NOT EXISTS "ClubInvitation_schoolIdentityId_schoolId_idx" ON "ClubInvitation"("schoolIdentityId", "schoolId");
CREATE INDEX IF NOT EXISTS "ClubTask_assigneeId_idx" ON "ClubTask"("assigneeId");
CREATE INDEX IF NOT EXISTS "ClubTask_projectId_idx" ON "ClubTask"("projectId");
CREATE INDEX IF NOT EXISTS "Evaluation_interviewerId_idx" ON "Evaluation"("interviewerId");
CREATE INDEX IF NOT EXISTS "Evaluation_roundId_idx" ON "Evaluation"("roundId");
CREATE INDEX IF NOT EXISTS "Experience_studentProfileId_idx" ON "Experience"("studentProfileId");
CREATE INDEX IF NOT EXISTS "InterviewAnnotationRevision_actorId_idx" ON "InterviewAnnotationRevision"("actorId");
CREATE INDEX IF NOT EXISTS "InterviewAvailabilityOverride_createdBy_idx" ON "InterviewAvailabilityOverride"("createdBy");
CREATE INDEX IF NOT EXISTS "InterviewAvailabilityOverride_memberId_clubId_idx" ON "InterviewAvailabilityOverride"("memberId", "clubId");
CREATE INDEX IF NOT EXISTS "InterviewAvailabilityOverride_slotId_clubId_idx" ON "InterviewAvailabilityOverride"("slotId", "clubId");
CREATE INDEX IF NOT EXISTS "InterviewBooking_roundId_idx" ON "InterviewBooking"("roundId");
CREATE INDEX IF NOT EXISTS "InterviewCollaboration_roundId_idx" ON "InterviewCollaboration"("roundId");
CREATE INDEX IF NOT EXISTS "InterviewCollaboration_selectedBy_idx" ON "InterviewCollaboration"("selectedBy");
CREATE INDEX IF NOT EXISTS "InterviewMove_acceptedInvitationId_idx" ON "InterviewMove"("acceptedInvitationId");
CREATE INDEX IF NOT EXISTS "InterviewMove_destinationId_idx" ON "InterviewMove"("destinationId");
CREATE INDEX IF NOT EXISTS "InterviewMove_sourceId_idx" ON "InterviewMove"("sourceId");
CREATE INDEX IF NOT EXISTS "InterviewPanelAssignment_grantedBy_idx" ON "InterviewPanelAssignment"("grantedBy");
CREATE INDEX IF NOT EXISTS "InterviewPanelAssignment_roundId_idx" ON "InterviewPanelAssignment"("roundId");
CREATE INDEX IF NOT EXISTS "InterviewPanelProposal_createdBy_idx" ON "InterviewPanelProposal"("createdBy");
CREATE INDEX IF NOT EXISTS "InterviewPanelProposal_modifiedBy_idx" ON "InterviewPanelProposal"("modifiedBy");
CREATE INDEX IF NOT EXISTS "InterviewPanelScheduleVersion_publishedBy_idx" ON "InterviewPanelScheduleVersion"("publishedBy");
CREATE INDEX IF NOT EXISTS "InterviewRecord_interviewerId_idx" ON "InterviewRecord"("interviewerId");
CREATE INDEX IF NOT EXISTS "InterviewRecord_roundId_idx" ON "InterviewRecord"("roundId");
CREATE INDEX IF NOT EXISTS "InterviewResumeAnnotation_authorId_idx" ON "InterviewResumeAnnotation"("authorId");
CREATE INDEX IF NOT EXISTS "InterviewResumeDocument_roundId_idx" ON "InterviewResumeDocument"("roundId");
CREATE INDEX IF NOT EXISTS "InterviewRoom_panelApprovedBy_idx" ON "InterviewRoom"("panelApprovedBy");
CREATE INDEX IF NOT EXISTS "InterviewRoom_roundId_idx" ON "InterviewRoom"("roundId");
CREATE INDEX IF NOT EXISTS "InterviewRoundParticipation_memberId_clubId_idx" ON "InterviewRoundParticipation"("memberId", "clubId");
CREATE INDEX IF NOT EXISTS "InterviewTimer_updatedBy_idx" ON "InterviewTimer"("updatedBy");
CREATE INDEX IF NOT EXISTS "PipelineRound_bookingCycleId_clubId_idx" ON "PipelineRound"("bookingCycleId", "clubId");
CREATE INDEX IF NOT EXISTS "PlatformReport_reporterId_idx" ON "PlatformReport"("reporterId");
CREATE INDEX IF NOT EXISTS "RecipientGroupEntry_groupId_clubId_idx" ON "RecipientGroupEntry"("groupId", "clubId");
CREATE INDEX IF NOT EXISTS "RecipientGroupEntry_userId_idx" ON "RecipientGroupEntry"("userId");
CREATE INDEX IF NOT EXISTS "RecruitingRuleFlag_applicationId_idx" ON "RecruitingRuleFlag"("applicationId");
CREATE INDEX IF NOT EXISTS "RosterImport_uploadedById_idx" ON "RosterImport"("uploadedById");
CREATE INDEX IF NOT EXISTS "RosterImportRow_importId_clubId_idx" ON "RosterImportRow"("importId", "clubId");
CREATE INDEX IF NOT EXISTS "RosterImportRow_invitationId_clubId_idx" ON "RosterImportRow"("invitationId", "clubId");
CREATE INDEX IF NOT EXISTS "RosterImportRow_matchedUserId_idx" ON "RosterImportRow"("matchedUserId");
CREATE INDEX IF NOT EXISTS "RosterImportRow_schoolIdentityId_idx" ON "RosterImportRow"("schoolIdentityId");
CREATE INDEX IF NOT EXISTS "ScheduledCommunication_senderId_idx" ON "ScheduledCommunication"("senderId");
CREATE INDEX IF NOT EXISTS "SchoolRequest_reviewedBy_idx" ON "SchoolRequest"("reviewedBy");
CREATE INDEX IF NOT EXISTS "StagedDecision_stagedById_clubId_idx" ON "StagedDecision"("stagedById", "clubId");
CREATE INDEX IF NOT EXISTS "TaskAssignment_userId_idx" ON "TaskAssignment"("userId");
CREATE INDEX IF NOT EXISTS "UserNotification_clubId_idx" ON "UserNotification"("clubId");
CREATE INDEX IF NOT EXISTS "VotingBallot_sessionId_memberId_idx" ON "VotingBallot"("sessionId", "memberId");
CREATE INDEX IF NOT EXISTS "VotingCandidate_applicationId_idx" ON "VotingCandidate"("applicationId");
CREATE INDEX IF NOT EXISTS "VotingHandRaise_sessionId_memberId_idx" ON "VotingHandRaise"("sessionId", "memberId");
CREATE INDEX IF NOT EXISTS "VotingObservationReference_observationId_idx" ON "VotingObservationReference"("observationId");
CREATE INDEX IF NOT EXISTS "VotingParticipant_memberId_idx" ON "VotingParticipant"("memberId");
CREATE INDEX IF NOT EXISTS "VotingPassCandidate_confirmedBy_idx" ON "VotingPassCandidate"("confirmedBy");
CREATE INDEX IF NOT EXISTS "VotingPassCandidate_sessionId_applicationId_idx" ON "VotingPassCandidate"("sessionId", "applicationId");
CREATE INDEX IF NOT EXISTS "VotingRoomCommand_actorId_idx" ON "VotingRoomCommand"("actorId");
CREATE INDEX IF NOT EXISTS "VotingRuleDefault_roundId_idx" ON "VotingRuleDefault"("roundId");
CREATE INDEX IF NOT EXISTS "VotingSession_cycleId_clubId_idx" ON "VotingSession"("cycleId", "clubId");
CREATE INDEX IF NOT EXISTS "VotingSession_roundId_idx" ON "VotingSession"("roundId");

COMMIT;
