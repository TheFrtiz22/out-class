/**
 * Account deletion policy. Pure helpers shared by the request/cancel actions,
 * the platform-admin completion action and (later) a cron. No I/O here.
 *
 * Phase 1 needs no migration: the request is a PlatformReport row (kind
 * ACCOUNT_DELETION) plus an AuditLog row, and the deleted person's own User row
 * becomes the tombstone that retained club records keep pointing at.
 */

export const ACCOUNT_DELETION_REPORT_KIND = "ACCOUNT_DELETION"
export const ACCOUNT_DELETION_GRACE_DAYS = 14
const DAY = 24 * 60 * 60 * 1000
/** A sign-in this recent counts as fresh authentication for deletion. */
export const ACCOUNT_DELETION_FRESH_AUTH_WINDOW = 10 * 60 * 1000
export const ACCOUNT_DELETION_PASSWORD_ATTEMPTS = 5
/** Per network, across accounts. Held without Turnstile too (it is off until configured). */
export const ACCOUNT_DELETION_IP_ATTEMPTS = 20
export const ACCOUNT_DELETION_CONFIRM_WORD = "DELETE"

export const accountDeletionAudit = {
  requested: "account.deletion.requested",
  passwordAttempt: "account.deletion.password-attempt",
  cancelled: "account.deletion.cancelled",
  emailed: "account.deletion.email",
  completed: "account.deletion.completed",
  incomplete: "account.deletion.incomplete",
  storagePending: "account.deletion.storage-pending",
} as const

export function accountDeletionDueAt(requestedAt: Date) {
  return new Date(requestedAt.getTime() + ACCOUNT_DELETION_GRACE_DAYS * DAY)
}

/** The person can cancel until the scheduled date. */
export function accountDeletionCancellable(requestedAt: Date, now = new Date()) {
  return now.getTime() < accountDeletionDueAt(requestedAt).getTime()
}

/** Admin completion waits for the grace period so a cancellation can never be overtaken. */
export function accountDeletionDue(requestedAt: Date, now = new Date()) {
  return !accountDeletionCancellable(requestedAt, now)
}

export function accountDeletionConfirmationMatches(input: string, email: string) {
  const value = input.trim()
  return value === ACCOUNT_DELETION_CONFIRM_WORD || (!!email && value.toLowerCase() === email.trim().toLowerCase())
}

type AmrEntry = { method?: unknown; timestamp?: unknown } | string
/** Supabase's `amr` claim records when this session last authenticated (seconds). */
export function freshAuthentication(amr: unknown, now = Date.now(), window = ACCOUNT_DELETION_FRESH_AUTH_WINDOW) {
  if (!Array.isArray(amr)) return false
  const times = (amr as AmrEntry[]).map(entry => typeof entry === "object" && entry && typeof entry.timestamp === "number" ? entry.timestamp * 1000 : NaN).filter(Number.isFinite)
  if (!times.length) return false
  const latest = Math.max(...times)
  return latest <= now + 60_000 && now - latest <= window
}

/** Unique, non-deliverable, carries no personal data. */
export function tombstoneEmail(userId: string) {
  return `deleted-${userId}@deleted.outclass.invalid`
}

/** Applications still in progress are withdrawn (deleted) unless club records already depend on them. */
export const pendingApplicationStatuses = ["DRAFTING", "SUBMITTED", "IN_REVIEW", "INTERVIEWING"] as const

export type DeletionTreatment =
  /** Rows are removed (explicitly, or by ON DELETE CASCADE of a removed parent). */
  | "delete"
  /** Rows stay, personal fields are cleared, and they keep pointing at the tombstone User. */
  | "anonymize"
  /** A nullable reference to the person is cleared. */
  | "unlink"
  /** Club or platform records that others rely on; they point at the tombstone User. */
  | "retain"

/**
 * Every relation field on `model User` in prisma/schema.prisma. A source test
 * fails when the schema gains a User relation that is not mapped here.
 * `onDelete` records the FK action, i.e. what would happen on a hard delete.
 */
export const userRelationDeletionPlan: Record<string, { model: string; onDelete: "Cascade" | "Restrict" | "SetNull"; treatment: DeletionTreatment; note: string }> = {
  studentProfile: { model: "StudentProfile", onDelete: "Cascade", treatment: "delete", note: "Profile, experiences (cascade); résumé and headshot objects removed from Storage." },
  applications: { model: "Application", onDelete: "Cascade", treatment: "anonymize", note: "In-progress applications without club records are deleted; others keep the row and the club's own notes, drop answers and review text. Published DecisionLetter content and InterviewResumeDocument snapshots are trigger-immutable (needs migration)." },
  memberships: { model: "ClubMember", onDelete: "Cascade", treatment: "anonymize", note: "Deleted when nothing depends on it; otherwise LEFT with roles, titles and groups cleared (evaluations, ballots, interview records are immutable)." },
  attendances: { model: "EventAttendance", onDelete: "Cascade", treatment: "retain", note: "Attendance counts stay; rows hold no personal fields beyond the tombstone link." },
  eventRsvps: { model: "EventRsvp", onDelete: "Cascade", treatment: "delete", note: "Personal RSVPs." },
  savedEvents: { model: "SavedCampusEvent", onDelete: "Cascade", treatment: "delete", note: "Personal bookmarks." },
  corkboardClubs: { model: "CorkboardClub", onDelete: "Cascade", treatment: "delete", note: "Saved clubs." },
  tutorials: { model: "UserTutorial", onDelete: "Cascade", treatment: "delete", note: "Tutorial dismissals." },
  availability: { model: "UserAvailability", onDelete: "Cascade", treatment: "delete", note: "Personal availability." },
  editorDrafts: { model: "EditorDraft", onDelete: "Cascade", treatment: "delete", note: "Unsent drafts." },
  calendarFeedToken: { model: "CalendarFeedToken", onDelete: "Cascade", treatment: "delete", note: "Calendar subscription token." },
  notifications: { model: "UserNotification", onDelete: "Cascade", treatment: "delete", note: "Inbox; email outbox rows cascade." },
  notificationPreferences: { model: "UserNotificationPreference", onDelete: "Cascade", treatment: "delete", note: "Email preferences." },
  notificationEmails: { model: "NotificationEmailDelivery", onDelete: "Cascade", treatment: "delete", note: "Delivery log addressed to the person (after outbox rows)." },
  conversations: { model: "ClubConversation", onDelete: "Cascade", treatment: "delete", note: "Private threads with clubs, with their messages." },
  recipientGroupEntries: { model: "RecipientGroupEntry", onDelete: "Cascade", treatment: "delete", note: "Saved audience entries." },
  taskSubmissions: { model: "TaskAssignment", onDelete: "Cascade", treatment: "delete", note: "Task submissions; task-submissions Storage objects removed." },
  clubClaims: { model: "ClubClaim", onDelete: "Cascade", treatment: "anonymize", note: "Pending claims deleted; decided claims keep the row with the explanation cleared." },
  adminElevationChallenges: { model: "AdminElevationChallenge", onDelete: "Cascade", treatment: "delete", note: "Pending admin sign-in challenges." },
  platformAdmin: { model: "PlatformAdmin", onDelete: "Cascade", treatment: "delete", note: "Only an inactive grant can exist; active admins cannot request deletion." },
  assignedTasks: { model: "ClubTask", onDelete: "SetNull", treatment: "unlink", note: "Club tasks stay; assignee cleared." },
  schoolIdentities: { model: "SchoolIdentity", onDelete: "Restrict", treatment: "retain", note: "outclass_school_identity_guard forbids unlinking verified ownership; stays on the tombstone until a migration allows it." },
  matchedRosterRows: { model: "RosterImportRow", onDelete: "Restrict", treatment: "unlink", note: "Roster import history stays; match cleared." },
  claimedInvitations: { model: "ClubInvitation", onDelete: "Restrict", treatment: "retain", note: "Invitation history (claimedUser) points at the tombstone." },
  adminElevations: { model: "AdminElevation", onDelete: "Cascade", treatment: "retain", note: "Admin security audit trail." },
  platformReports: { model: "PlatformReport", onDelete: "Restrict", treatment: "retain", note: "Moderation history, including this deletion request." },
  schoolRequestReviews: { model: "SchoolRequest", onDelete: "Restrict", treatment: "retain", note: "Admin review history." },
  reviewObservations: { model: "ApplicantObservation", onDelete: "Restrict", treatment: "retain", note: "Club review notes this person wrote as a reviewer." },
  clubInvitations: { model: "ClubInvitation", onDelete: "Restrict", treatment: "retain", note: "Invitations this person sent for a club." },
  invitationDeliveries: { model: "InvitationDelivery", onDelete: "Restrict", treatment: "retain", note: "Invitation delivery audit." },
  rosterImports: { model: "RosterImport", onDelete: "Restrict", treatment: "retain", note: "Roster imports this person uploaded for a club." },
  authoredAnnouncements: { model: "ClubAnnouncement", onDelete: "Restrict", treatment: "retain", note: "Club announcements; authorship shows the tombstone." },
  sentClubMessages: { model: "ClubMessage", onDelete: "Restrict", treatment: "retain", note: "Messages sent on a club's behalf in other students' threads." },
  scheduledCommunications: { model: "ScheduledCommunication", onDelete: "Restrict", treatment: "retain", note: "Club communications this person scheduled." },
  interviewAvailabilityOverrides: { model: "InterviewAvailabilityOverride", onDelete: "Restrict", treatment: "retain", note: "Club scheduling history (guarded)." },
  publishedPanelSchedules: { model: "InterviewPanelScheduleVersion", onDelete: "Restrict", treatment: "retain", note: "Immutable published panel history." },
  createdPanelProposals: { model: "InterviewPanelProposal", onDelete: "Restrict", treatment: "retain", note: "Club panel planning history." },
  modifiedPanelProposals: { model: "InterviewPanelProposal", onDelete: "Restrict", treatment: "retain", note: "Club panel planning history." },
  approvedInterviewPanels: { model: "InterviewRoom", onDelete: "Restrict", treatment: "retain", note: "Panel approvals." },
  interviewPanelGrants: { model: "InterviewPanelAssignment", onDelete: "Restrict", treatment: "retain", note: "Panel grant audit." },
  interviewAnnotationRevisions: { model: "InterviewAnnotationRevision", onDelete: "Restrict", treatment: "retain", note: "Immutable résumé annotation history." },
}
