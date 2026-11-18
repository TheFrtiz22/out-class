/**
 * The parts of mobile API responses the app reads. The server (lib/mobile-api/operations.ts)
 * returns the web actions' own shapes; dates arrive as ISO strings. Unknown fields are ignored.
 */
export type ClubMarketing = { memberCount?: number; showMembers?: boolean; showAcceptance?: boolean; showAum?: boolean; dues?: string; commitment?: string; eligibility?: string; benefits?: string[]; faqs?: { question?: string; answer?: string }[]; sections?: { title?: string; body?: string }[] } | null;

export type CalendarEvent = { id: string; clubId: string; startTime: string; endTime?: string; date: string; day: number; time: string; allDay?: boolean; title: string; club: string; color: string; type: string; location?: string; description?: string; durationMinutes?: number; response?: string };

export type HomeApplication = { id: string; clubId: string; name: string; color: string; logoUrl?: string | null; status: string; statusCode: string; statusLabel: string; draft: boolean; closed: boolean; intakeClosed: boolean; responsesSaved?: number; deadline?: CalendarEvent };

export type TaskNotification = { id: string; clubId: string; club: string; color: string; logoUrl?: string | null; title: string; preview: string; urgent: boolean; read: boolean; createdAt?: string; cta?: string; taskHref?: string; taskActivity?: { assignmentId: string; dueAt?: string | null; needsSubmission?: boolean } };

export type NextAction = { kind: "application"; application: HomeApplication } | { kind: "event"; event: CalendarEvent } | { kind: "notification"; notification: TaskNotification } | { kind: "explore" };

export type HomeView = { generatedAt: string; applications: HomeApplication[]; agenda: CalendarEvent[]; agendaCount: number; nextAction: NextAction; tasks: TaskNotification[]; unread: number };

export type Membership = { id: string; clubId: string; accessRole: string; role: string; title: string | null; status: string; alumniSince: string | null; isOwner: boolean; permissions: string[]; club: { id: string; slug: string; name: string; shortName: string | null; color: string; logoUrl: string | null; category: string | null } };

export type Me = { id: string; email: string; role: string; profile: StudentProfile | null; memberships: Membership[]; adminRoles: Membership[] };

export type StudentProfile = { id: string; firstName: string; lastName: string; computingId: string | null; major: string | null; gradYear: number | null; graduatedAt: string | null; graduationConfirmedAt: string | null; pronouns: string | null; phone: string | null; bio: string | null; linkedinUrl: string | null; resumeUrl: string | null; headshotUrl: string | null; gpa: number | null; postGradEmployer: string | null; postGradRole: string | null };

export type DirectoryClub = { id: string; name: string; logoText: string; logoUrl: string | null; bannerUrl: string | null; color: string; category: string; pitch: string; description: string; tags: string[]; acceptanceRate: number | null; marketing: ClubMarketing; applicationAvailable: boolean; applicationDeadline: string | null; claimed: boolean; rounds: { name?: string; type?: string }[]; requirements: string[]; publicEvents: { id?: string; title?: string; date?: string; location?: string }[] };

export type InboxItem = { id: string; clubId: string | null; type: string; title: string; body: string; href: string | null; readAt: string | null; archivedAt: string | null; createdAt: string; club: { name: string; color: string; logoUrl: string | null } | null };
export type InboxPage = { items: InboxItem[]; nextCursor: string | null; unread: number };
