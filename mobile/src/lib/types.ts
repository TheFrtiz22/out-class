/**
 * The parts of mobile API responses the app reads. The server (lib/mobile-api/operations.ts)
 * returns the web actions' own shapes; dates arrive as ISO strings. Unknown fields are ignored.
 */
export type ClubMarketing = { memberCount?: number; showMembers?: boolean; showAcceptance?: boolean; showAum?: boolean; dues?: string; commitment?: string; eligibility?: string; benefits?: string[]; faqs?: { question?: string; answer?: string }[]; sections?: { title?: string; body?: string }[] } | null;

export type CalendarEvent = { id: string; clubId: string; startTime: string; endTime?: string; date: string; day: number; time: string; allDay?: boolean; title: string; club: string; color: string; type: string; location?: string; description?: string; durationMinutes?: number; response?: string; meetingId?: string };

export type HomeApplication = { id: string; clubId: string; name: string; color: string; logoUrl?: string | null; status: string; statusCode: string; statusLabel: string; draft: boolean; closed: boolean; intakeClosed: boolean; responsesSaved?: number; deadline?: CalendarEvent };

export type TaskNotification = { id: string; clubId: string; club: string; color: string; logoUrl?: string | null; title: string; preview: string; urgent: boolean; read: boolean; createdAt?: string; cta?: string; taskHref?: string; taskActivity?: { assignmentId: string; dueAt?: string | null; needsSubmission?: boolean } };

export type NextAction = { kind: "application"; application: HomeApplication } | { kind: "event"; event: CalendarEvent } | { kind: "notification"; notification: TaskNotification } | { kind: "explore" };

export type HomeView = { generatedAt: string; applications: HomeApplication[]; agenda: CalendarEvent[]; agendaCount: number; ongoing?: CalendarEvent[]; nextAction: NextAction; tasks: TaskNotification[]; unread: number; inboxUnread?: number };

export type Membership = { id: string; clubId: string; accessRole: string; role: string; title: string | null; status: string; alumniSince: string | null; isOwner: boolean; permissions: string[]; club: { id: string; slug: string; name: string; shortName: string | null; color: string; logoUrl: string | null; category: string | null; bannerUrl?: string | null } };

export type Me = { id: string; email: string; role: string; profile: StudentProfile | null; memberships: Membership[]; adminRoles: Membership[] };

export type StudentProfile = { id: string; firstName: string; lastName: string; computingId: string | null; major: string | null; gradYear: number | null; graduatedAt: string | null; graduationConfirmedAt: string | null; pronouns: string | null; phone: string | null; bio: string | null; linkedinUrl: string | null; resumeUrl: string | null; headshotUrl: string | null; gpa: number | null; postGradEmployer: string | null; postGradRole: string | null };

export type DirectoryClub = { id: string; name: string; logoText: string; logoUrl: string | null; bannerUrl: string | null; color: string; category: string; pitch: string; description: string; tags: string[]; acceptanceRate: number | null; marketing: ClubMarketing; applicationAvailable: boolean; applicationDeadline: string | null; claimed: boolean; rounds: { name?: string; type?: string }[]; requirements: string[]; publicEvents: { id?: string; title?: string; date?: string; location?: string }[] };

export type InboxItem = { id: string; clubId: string | null; type: string; title: string; body: string; href: string | null; readAt: string | null; archivedAt: string | null; createdAt: string; club: { name: string; color: string; logoUrl: string | null } | null };
export type InboxPage = { items: InboxItem[]; nextCursor: string | null; unread: number };

// Applications, interviews, decisions (applications.view, interviews.schedule, decisions.letter)
export type ApplicationQuestion = { id: string; prompt: string; type: "ESSAY" | "SHORT_ANSWER" | "FILE_UPLOAD" | "MULTIPLE_CHOICE" | "MULTI_SELECT" | (string & {}); required: boolean; options?: string[] | null; wordLimit: number | null; characterLimit?: number | null; showIf?: unknown };
export type ApplicationAnswer = { questionId: string; response: string };
export type ApplicationStageId = "drafts" | "in-review" | "interviews" | "decisions";
export type StudentApplication = {
  id: string; clubId: string; status: string; statusCode: string; statusLabel: string; stage: ApplicationStageId | null; submittedAt: string | null;
  decision: boolean; attention: boolean; nextStep: string; intakeClosed: boolean; deadlineLabel: string | null; submittedLabel: string | null;
  progress: { completed: number; total: number; percent: number; ready: boolean; nextQuestionId?: string };
  interview: { id: string; startTime: string; endTime: string; location: string | null; past: boolean; label: string } | null;
  statusProgress: { stages: { id: string; name: string }[]; current: string; previous: string[] };
  history: { id: string; startLabel: string; endLabel: string; location: string | null }[];
  recruitmentOffer: { status: string; expiresAt: string } | null; offerStatus: string | null;
  decisionLetters: { id: string }[]; attachments: Record<string, string>; testRequirementLabel: string; profileNote: string | null;
  club: { name: string; color: string | null; logoUrl: string | null; applicationOpen: boolean; applicationDeadline: string | null; testRequirement: string | null; questions: ApplicationQuestion[] };
  round: { id: string; name: string; order: number } | null; answers: ApplicationAnswer[];
};
export type ApplicationsView = { generatedAt: string; userId: string; alumni: boolean; alumniRefusals: { respond: string; book: string }; stages: { id: ApplicationStageId; label: string; count: number }[]; initialStage: ApplicationStageId; applications: StudentApplication[] };

export type InterviewSlot = { id: string; startTime: string; endTime: string; capacity: number; booked: number };
export type InterviewRoom = { id: string; name: string; location: string; kind: string; duration: number; isOpen: boolean; slots: InterviewSlot[] };
export type InterviewBooking = { id: string; applicationId: string; slotId: string; roomId: string; roundId: string; startTime: string; endTime: string; location: string };
export type ApplicantSchedule = { applicationId: string; clubName: string; roundName: string; rooms: InterviewRoom[]; booking: InterviewBooking | null; publicationState?: "NOT_PUBLISHED" | "PAUSED" | "PUBLISHED"; allowCancellation?: boolean; allowRescheduling?: boolean; conflictingTimes?: number };

export type LetterContent = { title: string; body: string; closing: string; signer: string; footer: string; celebration?: string; studentName: string; clubName: string; logoReference: string | null; accent: string; date: string };
export type DecisionLetterView = { notificationId?: string; applicationId: string; clubId: string; currentStatus: string; isCurrent: boolean; suspended: boolean; offer: { status: string; expiresAt: string } | null; letter: { id: string; version: number; decision: string; content: LetterContent; createdAt: string } | null } | null;

// Explore, club pages, saved clubs, Corkboard events (explore.directory, club, clubs.saved, events.*)
export type PublicMarketingSection = { title: string; kind: "about" | "programs" | "people" | "impact" | "recruitment"; visible: boolean; body: string; cards: { title: string; description: string; url: string; image: string }[] };
/** `club` returns the full public marketing; `explore.directory` only the fields cards use. Every field may be absent. */
export type PublicMarketing = { sections?: PublicMarketingSection[]; acceptanceNote?: string; acceptanceApproximate?: boolean; memberCount?: number | null; showAcceptance?: boolean; showAum?: boolean; showMembers?: boolean; placements?: string[]; accolades?: string[]; benefits?: string[]; metrics?: { label: string; value: string }[]; links?: { label: string; url: string }[]; email?: string; website?: string; linkedin?: string; instagram?: string; commitment?: string; eligibility?: string; dues?: string; videoUrl?: string; faqs?: { question: string; answer: string }[]; features?: { title: string; description: string; url: string }[]; gallery?: { url: string; caption: string }[] } | null;
export type PublicClubEvent = { id: string; title: string; date: string; endDate?: string; allDay?: boolean; location: string; description: string | null };
export type PublicClub = { id: string; name: string; logoText: string; logoUrl: string | null; bannerUrl: string | null; color: string; category: string; pitch: string; description: string; tags: string[]; acceptanceRate: number | null; aumValue: number | null; timeCommitment: string | null; source: "database" | "preview"; marketing: PublicMarketing; testRequirement?: string; claimed: boolean; directorySource: string | null; applicationAvailable: boolean; applicationDeadline: string | null; rounds: { id: string; name: string; order: number }[]; requirements: string[]; publicEvents: PublicClubEvent[] };
export type ClubDirectory = { clubs: PublicClub[]; error?: string };
export type SavedClubs = { items: { club: PublicClub; savedAt: string }[] };
export type CampusEvent = { id: string; clubId: string; clubName: string; title: string; description: string; allDay?: boolean; date: string; endDate: string; location: string; category: string; contact: string; rsvpEnabled: boolean; rsvpRequired: boolean; capacity: number | null; rsvpDeadline: string | null; template: string; flyerUrl: string | null; rsvpCount: number; revision: number };
export type EventBoard = { events: CampusEvent[]; clubs: { id: string; name: string }[]; total: number; hasMore: boolean };
export type EventRsvpResult = { ok: true; going: boolean; count: number } | { ok: false; error: string };
/** `me` also carries the account's applications, which the club page reads to pick its primary action. */
export type MyApplicationSummary = { id: string; clubId: string; roundId: string | null; status: string };

// Inbox, calendar, meetings, tasks, profile, settings (inbox*, calendar.view, meetings.*, tasks.*, profile*, account.deletion, calendarFeed*)
export type InboxRow = InboxItem & { eventKey?: string | null; announcementId?: string | null; ownAnnouncement?: boolean };
export type InboxRows = { items: InboxRow[]; nextCursor: string | null; unread: number };
export type NotificationPreferences = { emailAnnouncements: boolean; emailMessages: boolean; emailApplications: boolean; emailInterviews: boolean; emailInvitations: boolean; emailTasks: boolean; emailPlatform: boolean; emailFrequency: "INSTANT" | "DAILY" | "OFF" };
export type AgendaEvent = CalendarEvent & { readOnly?: boolean; bookingSlotId?: string; applicationId?: string };
export type CalendarView = { generatedAt: string; events: AgendaEvent[] };
export type MeetingResource = { id: string; label: string; url: string; kind: string };
export type Meeting = { id: string; clubId: string; title: string; description: string | null; date: string; endDate: string | null; location: string; audience: "MEMBERS" | "RECRUITMENT" | string; isPublic: boolean; agenda: string | null; recap: string | null; resources: unknown; revision: number; club: { name: string } };
export type TaskFile = { id: string; name: string; size: number };
export type TaskAssignment = { id: string; taskId: string; memberId: string | null; userId: string; assignedAt: string; viewedAt: string | null; text: string | null; link: string | null; submittedAt: string | null; reviewedAt: string | null; revisionRequestedAt: string | null; groupLabel: string | null; feedback: string | null; revision: number; files: TaskFile[] };
export type ClubTask = { id: string; clubId: string; kind: "TASK" | "PROJECT"; projectId: string | null; project: { id: string; title: string } | null; title: string; description: string | null; status: "DRAFT" | "OPEN" | "DONE" | string; dueAt: string | null; createdAt: string; requirements: string[]; resources: unknown; revision: number; assignments: TaskAssignment[] };
export type TaskWorkspace = { clubId: string; manage: boolean; memberId: string; tasks: ClubTask[] };
export type ProfileExperience = { id?: string; title: string; subtitle: string; period: string };
export type ScholarStatus = { selections: string[]; other: string } | null;
export type FullStudentProfile = StudentProfile & { userId: string; highSchool: string | null; gender: string | null; transferStudent: boolean; scholarStatus: ScholarStatus; satScore: number | null; actScore: number | null; actEnglish: number | null; actMath: number | null; actReading: number | null; actScience: number | null; alumniDirectoryVisible?: boolean; alumniPlacementShare?: boolean; experiences: ProfileExperience[] };
export type ProfileSectionId = "identity" | "education" | "experience" | "links" | "contact";
export type AccountDeletionStatus = { pending: { requestedAt: string; scheduledFor: string; emailSent: boolean } | null; warnings: string[] };
export type CalendarFeedStatus = { active: boolean; createdAt: string | null; lastUsedAt: string | null };
export type CalendarFeedLinks = { https: string; webcal: string; google: string };
