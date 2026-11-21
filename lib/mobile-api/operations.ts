import { z } from "zod";
import { operation, type AnyMobileOperation } from "@/utils/mobile-api";
import { mobileConfirmInput, mobileRegisterInput } from "@/lib/mobile-api/auth";

/**
 * Every call the native app can make (docs/mobile/architecture.md). Each entry names an existing
 * Server Action or loader and the shape of its arguments; nothing here decides who may do what.
 * Actions are imported lazily, as app/api/workspace/route.ts does, so one request loads one module.
 */
const uuid = z.string().uuid();
const none = z.undefined().or(z.null()).or(z.object({}).strict()).transform(() => undefined);
const club = z.object({ clubId: uuid }).strict();
const clubMeeting = z.object({ clubId: uuid, meetingId: uuid }).strict();
const room = z.object({ clubId: uuid, sessionId: uuid }).strict();
// These actions validate their own input with strict schemas; the boundary only bounds its size.
const passthrough = z.unknown();
const formData = z.instanceof(FormData);

export const mobileOperations = {
  // Account creation (signed out until the code is confirmed; lib/mobile-api/auth.ts)
  "auth.signupOptions": operation("GET", none, async () => (await import("@/lib/mobile-api/auth")).mobileSignupOptions(), { public: true }),
  "auth.register": operation("POST", mobileRegisterInput, async input => (await import("@/lib/mobile-api/auth")).mobileRegister(input), { public: true }),
  "auth.confirmEmail": operation("POST", mobileConfirmInput, async (input, request) => (await import("@/lib/mobile-api/auth")).mobileConfirmEmail(input, request), { public: true }),
  "terms.accept": operation("POST", none, async () => (await import("@/lib/mobile-api/auth")).mobileAcceptTerms()),
  // Account
  "me": operation("GET", none, async () => (await import("@/utils/current-user")).getCurrentUser()),
  "account.deletion": operation("GET", none, async () => (await import("@/actions/account-deletion")).getAccountDeletionRequest()),
  "account.deletion.request": operation("POST", passthrough, async input => (await import("@/actions/account-deletion")).requestAccountDeletion(input)),
  "account.deletion.cancel": operation("POST", none, async () => (await import("@/actions/account-deletion")).cancelAccountDeletion()),
  "graduation.confirm": operation("POST", passthrough, async input => (await import("@/actions/graduation")).confirmGraduation(input)),
  "graduation.details": operation("POST", passthrough, async input => (await import("@/actions/graduation")).saveAlumniDetails(input)),

  // Settings: the student's own club-interest survey (Settings → Interests on the web)
  "interests": operation("GET", none, async () => (await import("@/actions/interest-survey")).getMyInterestSurvey()),
  "interests.save": operation("POST", passthrough, async input => (await import("@/actions/interest-survey")).saveMyInterestSurvey(input)),

  // Home, calendar
  "home.view": operation("GET", none, async () => (await import("@/lib/mobile-api/views")).getMobileHome()),
  "calendar.view": operation("GET", none, async () => (await import("@/lib/mobile-api/views")).getMobileCalendar()),
  "home.dashboard": operation("GET", none, async () => (await import("@/actions/applications")).getStudentDashboardData()),
  "home.taskNotifications": operation("GET", none, async () => (await import("@/actions/tasks")).getTaskNotifications()),
  "invitations": operation("GET", none, async () => (await import("@/actions/club-onboarding")).getOrganizationInvitations(false)),
  "calendarFeed": operation("GET", none, async () => (await import("@/actions/calendar-feed")).getCalendarFeedStatus()),
  "calendarFeed.create": operation("POST", none, async () => (await import("@/actions/calendar-feed")).createCalendarFeedLink()),
  "calendarFeed.disable": operation("POST", none, async () => (await import("@/actions/calendar-feed")).disableCalendarFeed()),

  // Explore, clubs, Corkboard
  "explore.directory": operation("GET", none, async () => (await import("@/actions/club-directory")).getClubDirectory(), { public: true }),
  "explore.search": operation("GET", z.object({ query: z.string().max(120) }).strict(), async ({ query }) => (await import("@/actions/workspace-search")).searchWorkspace(query)),
  "club": operation("GET", z.object({ club: z.string().min(1).max(200) }).strict(), async input => (await import("@/actions/club-directory")).getPublicClub(input.club), { public: true }),
  "clubs.saved": operation("GET", none, async () => (await import("@/actions/club-directory")).getCorkboard()),
  "clubs.save": operation("POST", passthrough, async input => (await import("@/actions/club-directory")).setCorkboardClub(input)),
  "events.board": operation("GET", passthrough, async input => (await import("@/actions/campus-events")).getPublicCorkboard((input ?? {}) as never), { public: true }),
  "events.event": operation("GET", z.object({ eventId: uuid }).strict(), async ({ eventId }) => (await import("@/actions/campus-events")).getPublicCampusEvent(eventId), { public: true }),
  "events.savedIds": operation("GET", none, async () => (await import("@/actions/campus-events")).getSavedCampusEventIds()),
  "events.save": operation("POST", passthrough, async input => (await import("@/actions/campus-events")).setSavedCampusEvent(input)),
  "events.rsvp": operation("GET", z.object({ eventId: uuid }).strict(), async ({ eventId }) => (await import("@/actions/campus-events")).getCampusEventRsvp(eventId)),
  "events.rsvp.set": operation("POST", passthrough, async input => (await import("@/actions/campus-events")).setCampusEventRsvp(input)),
  "events.myRsvps": operation("GET", none, async () => (await import("@/actions/campus-events")).getMyCampusEventRsvps()),
  "share.shortLink": operation("POST", z.object({ target: z.string().min(1).max(2048) }).strict(), async input => (await import("@/actions/short-links")).createShortLink(input)),

  // Profile
  "profile": operation("GET", none, async () => (await import("@/actions/profile")).getStudentProfile()),
  "profile.create": operation("POST", passthrough, async input => (await import("@/actions/profile")).upsertStudentProfile(input as never)),
  "profile.updateSection": operation("POST", z.object({ input: z.unknown(), expected: z.string().max(100_000).optional() }).strict(), async ({ input, expected }) => (await import("@/actions/profile")).updateStudentProfileSection(input, expected)),
  "profile.upload": operation("POST", formData, async input => (await import("@/actions/storage")).uploadProfileFile(input)),

  // Applications, interviews, decisions
  "applications": operation("GET", none, async () => (await import("@/actions/applications")).getStudentApplications()),
  "applications.view": operation("GET", none, async () => (await import("@/lib/mobile-api/views")).getMobileApplications()),
  "applications.start": operation("POST", club, async ({ clubId }) => (await import("@/actions/club-directory")).startClubApplication(clubId)),
  "applications.saveDraft": operation("POST", passthrough, async input => (await import("@/actions/applications")).saveApplicationDraft(input as never)),
  "applications.submit": operation("POST", passthrough, async input => (await import("@/actions/applications")).submitApplication(input as never)),
  "interviews.schedule": operation("GET", z.object({ applicationId: uuid }).strict(), async ({ applicationId }) => (await import("@/actions/interview-rooms")).getApplicantSchedule(applicationId)),
  "interviews.booking": operation("GET", z.object({ clubId: uuid, roundId: uuid }).strict(), async ({ clubId, roundId }) => (await import("@/actions/interview-rooms")).getBookingApplication(clubId, roundId)),
  "interviews.reserve": operation("POST", z.object({ applicationId: uuid, slotId: uuid }).strict(), async input => (await import("@/actions/interview-rooms")).reserveInterview(input)),
  "interviews.cancel": operation("POST", z.object({ bookingId: uuid }).strict(), async ({ bookingId }) => (await import("@/actions/interview-rooms")).cancelRoomBooking(bookingId)),
  "decisions.letter": operation("GET", z.object({ applicationId: uuid, letterId: uuid.optional() }).strict(), async ({ applicationId, letterId }) => (await import("@/actions/communications")).getDecisionLetter(applicationId, letterId)),
  "offers.respond": operation("POST", z.object({ applicationId: uuid, response: z.enum(["ACCEPT", "DECLINE"]) }).strict(), async ({ applicationId, response }) => (await import("@/actions/recruitment-offers")).respondToOffer(applicationId, response)),

  // Inbox
  "inbox": operation("GET", z.object({ cursor: uuid.optional() }).strict().optional(), async input => (await import("@/actions/communications")).getDurableNotifications(input?.cursor)),
  "inbox.read": operation("POST", z.object({ ids: z.array(uuid).min(1).max(100), read: z.boolean() }).strict(), async ({ ids, read }) => (await import("@/actions/communications")).setDurableNotificationsRead(ids, read)),
  "inbox.archive": operation("POST", z.object({ ids: z.array(uuid).min(1).max(100), archived: z.boolean() }).strict(), async ({ ids, archived }) => (await import("@/actions/communications")).setDurableNotificationsArchived(ids, archived)),
  "inbox.preferences": operation("GET", none, async () => (await import("@/actions/communications")).getNotificationPreferences()),
  "inbox.preferences.save": operation("POST", passthrough, async input => (await import("@/actions/communications")).saveNotificationPreferences(input)),

  // The scanner: the /q page's resolution, for a signed-in app (lib/mobile-api/short-links.ts)
  "shortLinks.resolve": operation("GET", z.object({ code: z.string().regex(/^[a-zA-Z0-9_-]{1,32}$/) }).strict(), async ({ code }) => (await import("@/lib/mobile-api/short-links")).resolveMobileShortLink(code)),

  // Native push: the device is another subscription of the web's push path (actions/push-subscriptions.ts)
  "push.settings": operation("GET", passthrough, async input => (await import("@/actions/push-subscriptions")).getNativePushSettings(input)),
  "push.register": operation("POST", passthrough, async input => (await import("@/actions/push-subscriptions")).saveNativePushDevice(input)),
  "push.unregister": operation("POST", passthrough, async input => (await import("@/actions/push-subscriptions")).removeNativePushDevice(input)),

  // Meetings and check-in
  "meetings": operation("GET", z.object({ clubId: uuid.optional() }).strict().optional(), async input => (await import("@/actions/meetings")).listMeetings(input?.clubId)),
  "meetings.meeting": operation("GET", z.object({ meetingId: uuid }).strict(), async ({ meetingId }) => (await import("@/actions/meetings")).getMeeting(meetingId)),
  "meetings.checkIn": operation("POST", z.object({ meetingId: uuid, token: z.string().min(16).max(256) }).strict(), async ({ meetingId, token }) => (await import("@/actions/meetings")).checkInMeeting(meetingId, token)),
  "meetings.checkIn.issue": operation("POST", clubMeeting, async ({ clubId, meetingId }) => (await import("@/actions/meetings")).issueMeetingCheckIn(clubId, meetingId)),
  "meetings.checkIn.close": operation("POST", clubMeeting, async ({ clubId, meetingId }) => (await import("@/actions/meetings")).closeMeetingCheckIn(clubId, meetingId)),
  "meetings.attendance": operation("GET", clubMeeting, async ({ clubId, meetingId }) => (await import("@/actions/meetings")).meetingAttendance(clubId, meetingId)),

  // Tasks
  "tasks.workspace": operation("GET", z.object({ clubId: uuid, focus: z.object({ taskId: uuid, assignmentId: uuid.optional() }).strict().optional() }).strict(), async ({ clubId, focus }) => (await import("@/actions/tasks")).getTaskWorkspace(clubId, focus)),
  "tasks.view": operation("POST", z.object({ assignmentId: uuid }).strict(), async ({ assignmentId }) => (await import("@/actions/tasks")).viewTask(assignmentId)),
  "tasks.submit": operation("POST", passthrough, async input => (await import("@/actions/tasks")).submitTask(input as never)),
  "tasks.file": operation("GET", z.object({ fileId: uuid }).strict(), async ({ fileId }) => (await import("@/actions/tasks")).downloadTaskFile(fileId)),

  // Live voting
  "voting.rooms": operation("GET", passthrough, async input => (await import("@/actions/voting-room")).listLiveVotingRooms(input)),
  "voting.joinInfo": operation("GET", room, async input => (await import("@/actions/voting-room-setup")).getLiveVotingJoinInfo(input)),
  "voting.join": operation("POST", room, async input => (await import("@/actions/voting-room-setup")).joinLiveVotingRoom(input)),
  "voting.room": operation("GET", passthrough, async input => (await import("@/actions/voting-room")).getLiveVotingRoom(input)),
  "voting.ballot": operation("POST", passthrough, async input => (await import("@/actions/voting-room")).castLiveVotingBallot(input)),
  "voting.command": operation("POST", passthrough, async input => (await import("@/actions/voting-room")).commandLiveVotingRoom(input)),
  // The applicant on screen: the room's own authorized slide read, laid out by the web's slide model (no new fields).
  "voting.presentation": operation("GET", passthrough, async input => {
    const data = await (await import("@/actions/voting-room")).getLiveVotingPresentation(input);
    if ("stale" in data || "ownApplication" in data) return data;
    return { slide: (await import("@/components/live-voting/slide-model")).slideModel(data) };
  }),
  // Session leaders only: applicant labels for the queue and "Next" (the leader room's own summary read).
  "voting.summary": operation("GET", room, async input => (await import("@/actions/voting-room-finalization")).getLiveVotingSummary(input)),

  // Leader tools
  "leader.overview": operation("GET", z.object({ clubId: uuid, view: z.enum(["all", "club", "recruiting", "strip"]).optional() }).strict(), async ({ clubId, view }) => (await import("@/actions/club-overview")).getClubWorkspaceOverview(clubId, view)),
  "leader.rounds": operation("GET", club, async ({ clubId }) => (await import("@/actions/club-overview")).getWorkspaceRounds(clubId, {})),
  "leader.pipelinePage": operation("GET", z.object({ clubId: uuid, query: z.unknown().optional() }).strict(), async ({ clubId, query }) => {
    const { pipelinePageQuery } = await import("@/lib/pipeline-page");
    return (await import("@/actions/crm")).getClubPipelinePage(clubId, pipelinePageQuery.parse(query ?? {}));
  }),
  "leader.announcements": operation("GET", club, async ({ clubId }) => (await import("@/actions/communications")).getClubAnnouncements(clubId)),
  "leader.announce.preview": operation("GET", z.object({ clubId: uuid, audience: z.enum(["MEMBERS", "APPLICANTS"]) }).strict(), async ({ clubId, audience }) => (await import("@/actions/recipient-groups")).previewRecipientAudience(clubId, { include: [{ source: audience }] })),
  "leader.announce": operation("POST", passthrough, async input => (await import("@/actions/communications")).publishClubAnnouncement(input)),
  "leader.interviewRooms": operation("GET", club, async ({ clubId }) => (await import("@/actions/interview-entry")).getAssignedInterviewRooms(clubId)),
  // Interview day: the interviewer's own session (opening creates their draft record, so both are POST).
  "leader.interviewSession.open": operation("POST", passthrough, async input => (await import("@/actions/interview-kits")).openInterviewSession(input as never)),
  "leader.interviewSession.save": operation("POST", passthrough, async input => (await import("@/actions/interview-kits")).saveInterviewSession(input as never)),
} satisfies Record<string, AnyMobileOperation>;

export type MobileOperations = typeof mobileOperations;
export type MobileOperationName = keyof MobileOperations;
