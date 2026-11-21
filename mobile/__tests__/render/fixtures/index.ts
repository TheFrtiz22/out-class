/**
 * Mobile API fixtures, keyed by operation name (lib/mobile-api/operations.ts). Shapes follow the
 * server actions the operations call (actions/*.ts, lib/mobile-api/views.ts, utils/current-user.ts)
 * after the JSON hop: dates are ISO strings, `undefined` results arrive as `null`.
 *
 * `rich`: long names, many rows, every optional field the server may leave null left null somewhere.
 * `empty`: a new account: empty lists, null optionals. Operations missing from `empty` use `rich`.
 * A fixture is a value or a function of the operation's input.
 */
import type {
  AgendaEvent, ApplicantSchedule, ApplicationsView, CampusEvent, ClubTask, DecisionLetterView, EventBoard, FullStudentProfile, HomeApplication, HomeView, InboxRow,
  Me, Meeting, Membership, PublicClub, StudentApplication, TaskNotification, TaskWorkspace,
} from "~/lib/types";
import { ApiError } from "~/lib/api";
import type { RoomListItem, RoomSnapshot } from "~/components/voting/room";
import type { InterviewEntry } from "~/components/leader/interviews";

export type Fixture = unknown;
export type FixtureSet = Record<string, Fixture>;

// ---- Ids --------------------------------------------------------------------------------------
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const ids = {
  user: "user-1",
  leaderClub: uuid(1), memberClub: uuid(2), alumniClub: uuid(3), applyClub: uuid(4), decidedClub: uuid(5), interviewClub: uuid(6),
  leaderMembership: uuid(11), memberMembership: uuid(12), alumniMembership: uuid(13),
  draftApplication: uuid(21), reviewApplication: uuid(22), interviewApplication: uuid(23), decidedApplication: uuid(24),
  round: uuid(31), round2: uuid(32),
  meeting: uuid(41), meeting2: uuid(42),
  task: uuid(51), project: uuid(52), assignment: uuid(53), projectAssignment: uuid(54), childTask: uuid(55), childAssignment: uuid(56),
  event: uuid(61), event2: uuid(62),
  letter: uuid(71), session: uuid(81),
  slot: uuid(91), slot2: uuid(92), room: uuid(93), booking: uuid(94),
  question: (n: number) => uuid(100 + n),
  inbox: (n: number) => uuid(200 + n),
};

// ---- Dates ------------------------------------------------------------------------------------
const DAY = 86_400_000;
const NOW = Date.now();
const at = (days: number, hours = 0) => new Date(NOW + days * DAY + hours * 3_600_000).toISOString();
export const longName = "The Undergraduate Society for Interdisciplinary Engineering, Entrepreneurship and Applied Research at the University of Virginia";
export const longPerson = "Maximiliana-Alexandria Montgomery-Vanderbilt de la Cruz";

// ---- Account ----------------------------------------------------------------------------------
const club = (id: string, name: string, color: string, extra: Partial<Membership["club"]> = {}): Membership["club"] =>
  ({ id, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40), name, shortName: null, color, logoUrl: null, category: "Engineering", ...extra });

const leaderMembership: Membership = {
  id: ids.leaderMembership, clubId: ids.leaderClub, accessRole: "OWNER", role: "PRESIDENT", title: "President and Founding Chair of the Executive Board", status: "ACTIVE", alumniSince: null, isOwner: true,
  permissions: ["meetings.attendance", "meetings.manage", "applications.review", "decisions.start", "decisions.vote", "tasks.manage"],
  club: club(ids.leaderClub, longName, "#0F2E56", { shortName: "USIEEAR" }),
};
const memberMembership: Membership = {
  id: ids.memberMembership, clubId: ids.memberClub, accessRole: "MEMBER", role: "MEMBER", title: null, status: "ACTIVE", alumniSince: null, isOwner: false, permissions: [],
  club: club(ids.memberClub, "Virginia Motorsports", "#E57200", { logoUrl: "https://out-class.test/logo.png", category: null }),
};
const alumniMembership: Membership = {
  id: ids.alumniMembership, clubId: ids.alumniClub, accessRole: "MEMBER", role: "MEMBER", title: "Treasurer", status: "ACTIVE", alumniSince: at(-200), isOwner: false, permissions: ["applications.review"],
  club: club(ids.alumniClub, "Cavalier Investment Club", "#2E7D32"),
};

const studentProfile = {
  id: "profile-1", firstName: "Maximiliana-Alexandria", lastName: "Montgomery-Vanderbilt de la Cruz", computingId: "abc2de", major: "Mechanical Engineering and Applied Mathematics (Double Major)",
  gradYear: 2030, graduatedAt: null, graduationConfirmedAt: null, pronouns: null, phone: "+14345550123", bio: null, linkedinUrl: null, resumeUrl: null, headshotUrl: null, gpa: null,
  postGradEmployer: null, postGradRole: null,
};

const me: Me & { applications: { id: string; clubId: string; roundId: string | null; status: string }[] } = {
  id: ids.user, email: "student@virginia.edu", role: "STUDENT", profile: studentProfile,
  memberships: [leaderMembership, memberMembership, alumniMembership], adminRoles: [leaderMembership],
  applications: [
    { id: ids.draftApplication, clubId: ids.applyClub, roundId: ids.round, status: "DRAFTING" },
    { id: ids.reviewApplication, clubId: ids.memberClub, roundId: null, status: "SUBMITTED" },
    { id: ids.interviewApplication, clubId: ids.interviewClub, roundId: ids.round, status: "INTERVIEWING" },
    { id: ids.decidedApplication, clubId: ids.decidedClub, roundId: ids.round2, status: "ACCEPTED" },
  ],
};
const emptyMe = { id: ids.user, email: "new@virginia.edu", role: "STUDENT", profile: null, memberships: [], adminRoles: [], applications: [] };

// ---- Calendar / Home --------------------------------------------------------------------------
const calendarEvent = (n: number, days: number, extra: Partial<AgendaEvent> = {}): AgendaEvent => {
  const start = new Date(NOW + days * DAY);
  return {
    id: `meeting-${uuid(300 + n)}`, clubId: n % 2 ? ids.leaderClub : ids.memberClub, startTime: start.toISOString(), endTime: new Date(+start + 3_600_000).toISOString(),
    date: start.toISOString().slice(0, 10), day: start.getDate(), time: "7:00 PM", title: n === 1 ? `General body meeting: ${longName}` : `Event ${n}`, club: n % 2 ? longName : "Virginia Motorsports",
    color: n % 2 ? "#0F2E56" : "#E57200", type: ["Other", "Deadline", "Interest Meeting", "Coffee Chat"][n % 4]!, location: n % 3 ? "Rice Hall 130" : undefined, description: n % 2 ? "Bring a laptop." : undefined, durationMinutes: 60, ...extra,
  };
};
const agenda: AgendaEvent[] = [
  calendarEvent(1, 0.2), calendarEvent(2, 1), calendarEvent(3, 2, { allDay: true, time: "" }), calendarEvent(4, 3, { response: "GOING" }), calendarEvent(5, 6),
  calendarEvent(6, 9, { id: `booking-${ids.booking}`, clubId: ids.interviewClub, type: "Interview", title: "Interview: Design Team", bookingSlotId: ids.slot, applicationId: ids.interviewApplication }),
  calendarEvent(7, 12, { readOnly: true }), calendarEvent(8, -3), calendarEvent(9, 40),
];
const homeApplication = (id: string, clubId: string, name: string, status: string, statusCode: string, statusLabel: string, extra: Partial<HomeApplication> = {}): HomeApplication =>
  ({ id, clubId, name, color: "#0F2E56", logoUrl: null, status, statusCode, statusLabel, draft: status === "DRAFTING", closed: false, intakeClosed: false, ...extra });
const homeApplications: HomeApplication[] = [
  homeApplication(ids.draftApplication, ids.applyClub, longName, "DRAFTING", "drafting", "Draft", { responsesSaved: 2, deadline: calendarEvent(10, 4, { type: "Deadline" }) }),
  homeApplication(ids.reviewApplication, ids.memberClub, "Virginia Motorsports", "SUBMITTED", "submitted", "Submitted", { logoUrl: "https://out-class.test/logo.png" }),
  homeApplication(ids.interviewApplication, ids.interviewClub, "Design Team", "INTERVIEWING", "interviewing", "Interview"),
  homeApplication(ids.decidedApplication, ids.decidedClub, "Hoos Coding", "DRAFTING", "drafting", "Draft", { intakeClosed: true, closed: true }),
];
const taskNotification = (n: number, extra: Partial<TaskNotification> = {}): TaskNotification => ({
  id: `task-${n}`, clubId: ids.memberClub, club: n === 1 ? longName : "Virginia Motorsports", color: "#E57200", logoUrl: null, title: n === 1 ? `Submit the ${longName} chassis design review packet before the deadline` : `Task ${n}`,
  preview: "Upload your CAD files and a one-page summary. ".repeat(4), urgent: n === 1, read: n > 2, createdAt: at(-n), cta: n === 1 ? "Open task" : undefined,
  taskHref: `/tasks?clubId=${ids.memberClub}&taskId=${ids.task}`, taskActivity: { assignmentId: ids.assignment, dueAt: n === 1 ? at(1) : null, needsSubmission: true }, ...extra,
});
const homeView: HomeView = {
  generatedAt: at(0), applications: homeApplications, agenda: agenda.slice(0, 8), agendaCount: 12,
  nextAction: { kind: "application", application: homeApplications[0]! }, tasks: [taskNotification(1), taskNotification(2), taskNotification(3), taskNotification(4)], unread: 137,
};
const emptyHome: HomeView = { generatedAt: at(0), applications: [], agenda: [], agendaCount: 0, nextAction: { kind: "explore" }, tasks: [], unread: 0 };

// ---- Clubs and events -------------------------------------------------------------------------
const publicClub = (n: number, extra: Partial<PublicClub> = {}): PublicClub => ({
  id: n === 0 ? ids.applyClub : uuid(400 + n), name: n === 0 ? longName : `Club ${n} ${["Robotics", "Debate", "A Cappella", "Finance"][n % 4]}`, logoText: "USI", logoUrl: n % 3 ? null : "https://out-class.test/logo.png", bannerUrl: null,
  color: ["#0F2E56", "#E57200", "#2E7D32", "#6A1B9A"][n % 4]!, category: ["Engineering", "Academic", "Performing Arts", "Pre-Professional"][n % 4]!, pitch: n === 0 ? "Build things that matter. ".repeat(10) : "",
  description: n === 0 ? "A long description. ".repeat(60) : "", tags: [], acceptanceRate: n % 2 ? 0.12 * n : null, aumValue: null, timeCommitment: n % 2 ? "3-5" : null, source: "database",
  marketing: n % 2 ? null : { memberCount: 120, showMembers: true, commitment: "3-5 hours a week", benefits: ["Mentorship", "Industry trips"] }, testRequirement: "OPTIONAL", claimed: n % 2 === 0, directorySource: null,
  applicationAvailable: n % 3 !== 1, applicationDeadline: n % 3 === 2 ? null : at(n % 4 === 0 ? 3 : 20 + n), rounds: n % 3 === 1 ? [] : [{ id: ids.round, name: "Written application", order: 1 }, { id: ids.round2, name: "Interviews", order: 2 }],
  requirements: n === 0 ? ["Why do you want to join?", "Upload a resume"] : [], publicEvents: n === 0 ? [{ id: ids.event, title: "Info session", date: at(2), endDate: at(2, 1), location: "Thornton Hall", description: null }] : [], ...extra,
});
const fullClub = publicClub(0, {
  marketing: {
    sections: [
      { title: "About us", kind: "about", visible: true, body: "We design, build and race. ".repeat(30), cards: [] },
      { title: "Programs", kind: "programs", visible: true, body: "", cards: [{ title: "Formula SAE", description: "Build a race car.", url: "https://example.edu/fsae", image: "" }] },
      { title: "Hidden", kind: "impact", visible: false, body: "Hidden", cards: [] },
    ],
    memberCount: null, showAcceptance: true, showMembers: true, placements: ["Tesla", "SpaceX"], accolades: [], benefits: ["Mentorship"], metrics: [{ label: "Members", value: "120" }],
    links: [{ label: "Website", url: "https://example.edu" }], faqs: [{ question: "Do I need experience?", answer: "No." }], email: "club@virginia.edu", commitment: "5+ hours", dues: "$20",
  },
});
const directory = { clubs: [fullClub, ...Array.from({ length: 11 }, (_, index) => publicClub(index + 1))] };

const campusEvent = (n: number, extra: Partial<CampusEvent> = {}): CampusEvent => ({
  id: n === 1 ? ids.event : n === 2 ? ids.event2 : uuid(500 + n), clubId: n % 2 ? ids.leaderClub : ids.memberClub, clubName: n % 2 ? longName : "Virginia Motorsports", title: n === 1 ? `Spring showcase and open house: ${longName}` : `Campus event ${n}`,
  description: n === 1 ? "Join us for demos and food. ".repeat(20) : "", allDay: n === 3, date: at(n), endDate: n === 3 ? at(n + 1) : at(n, 2), location: n === 4 ? "" : "Newcomb Hall Ballroom", category: ["Social", "Academic", "Career", "Service"][n % 4]!,
  contact: n === 1 ? "events@virginia.edu" : "", rsvpEnabled: n % 2 === 1, rsvpRequired: n === 1, capacity: n === 1 ? 150 : null, rsvpDeadline: n === 1 ? at(0.5) : null, template: "classic", flyerUrl: null, rsvpCount: n === 1 ? 149 : 0, revision: 1, ...extra,
});
const eventBoard: EventBoard = { events: Array.from({ length: 8 }, (_, index) => campusEvent(index + 1)), clubs: [{ id: ids.leaderClub, name: longName }, { id: ids.memberClub, name: "Virginia Motorsports" }], total: 23, hasMore: true };

// ---- Inbox ------------------------------------------------------------------------------------
const inboxRow = (n: number, extra: Partial<InboxRow> = {}): InboxRow => ({
  id: ids.inbox(n), clubId: n % 4 ? ids.memberClub : null, type: ["ANNOUNCEMENT", "APPLICATION", "INTERVIEW", "TASK", "DECISION", "PLATFORM", "MESSAGE", "INVITATION"][n % 8]!,
  title: n === 1 ? `Important update from ${longName} about this semester’s recruitment timeline` : `Notification ${n}`, body: n === 1 ? "Please read carefully. ".repeat(40) : `Body ${n}`,
  href: [null, "/applications", `/decision/${ids.decidedApplication}`, `/tasks?clubId=${ids.memberClub}`, "/inbox", "https://example.edu/outside", `/clubs/${ids.memberClub}`, "/calendar"][n % 8]!,
  readAt: n % 3 ? null : at(-1), archivedAt: null, createdAt: at(-n / 3), club: n % 4 ? { name: n === 1 ? longName : "Virginia Motorsports", color: "#E57200", logoUrl: null } : null,
  eventKey: null, announcementId: n === 2 ? uuid(600) : null, ownAnnouncement: n === 2, ...extra,
});
const inbox = { items: Array.from({ length: 12 }, (_, index) => inboxRow(index + 1)), nextCursor: null, unread: 8 };

// ---- Applications -----------------------------------------------------------------------------
const questions = [
  { id: ids.question(1), prompt: `Why do you want to join ${longName}?`, type: "ESSAY", required: true, options: null, wordLimit: 250 },
  { id: ids.question(2), prompt: "Upload your resume", type: "FILE_UPLOAD", required: false, options: null, wordLimit: null },
  { id: ids.question(3), prompt: "Which team?", type: "MULTIPLE_CHOICE", required: true, options: ["Chassis", "Powertrain", "Business"], wordLimit: null },
  { id: ids.question(4), prompt: "Which days can you attend?", type: "MULTI_SELECT", required: false, options: ["Mon", "Tue", "Wed"], wordLimit: null },
  { id: ids.question(5), prompt: "Anything else?", type: "ESSAY", required: false, options: null, wordLimit: null, showIf: { questionId: ids.question(3), equals: "Business" } },
];
const studentApplication = (id: string, clubId: string, name: string, status: string, extra: Partial<StudentApplication> = {}): StudentApplication => ({
  id, clubId, status, statusCode: status.toLowerCase(), statusLabel: ({ DRAFTING: "Draft", SUBMITTED: "Submitted", INTERVIEWING: "Interview", ACCEPTED: "Accepted" } as Record<string, string>)[status] ?? status,
  stage: status === "DRAFTING" ? "drafts" : status === "INTERVIEWING" ? "interviews" : status === "ACCEPTED" ? "decisions" : "in-review", submittedAt: status === "DRAFTING" ? null : at(-10),
  decision: status === "ACCEPTED", attention: status !== "SUBMITTED", nextStep: "Wait for the club to review your application.", intakeClosed: false, deadlineLabel: status === "DRAFTING" ? "Friday, March 6 at 11:59 PM" : null,
  submittedLabel: status === "DRAFTING" ? null : "Feb 20", progress: { completed: 1, total: 3, percent: 33, ready: false, nextQuestionId: ids.question(3) }, interview: null,
  statusProgress: { stages: [{ id: "SUBMITTED", name: "Submitted" }, { id: "IN_REVIEW", name: "In review" }, { id: "INTERVIEWING", name: "Interview" }, { id: "DECIDED", name: "Decision" }], current: status === "DRAFTING" ? "SUBMITTED" : status, previous: [] },
  history: [], recruitmentOffer: null, offerStatus: null, decisionLetters: [], attachments: {}, testRequirementLabel: "Test scores optional", profileNote: null,
  club: { name, color: null, logoUrl: null, applicationOpen: true, applicationDeadline: at(4), testRequirement: null, questions }, round: { id: ids.round, name: "Written application", order: 1 }, answers: [], ...extra,
});
const applications: StudentApplication[] = [
  studentApplication(ids.draftApplication, ids.applyClub, longName, "DRAFTING", { answers: [{ questionId: ids.question(1), response: "Because I love building things. ".repeat(10) }, { questionId: ids.question(4), response: JSON.stringify(["Mon", "Wed"]) }], profileNote: "Add a phone number to your profile before submitting." }),
  studentApplication(ids.reviewApplication, ids.memberClub, "Virginia Motorsports", "SUBMITTED", { round: null, club: { name: "Virginia Motorsports", color: "#E57200", logoUrl: "https://out-class.test/logo.png", applicationOpen: false, applicationDeadline: null, testRequirement: "REQUIRED", questions: [] } }),
  studentApplication(ids.interviewApplication, ids.interviewClub, "Design Team", "INTERVIEWING", {
    interview: { id: ids.booking, startTime: at(9), endTime: at(9, 0.5), location: null, past: false, label: "Mar 12, 4:00 PM" },
    history: [{ id: uuid(700), startLabel: "Feb 1, 4:00 PM", endLabel: "Feb 1, 4:30 PM", location: null }],
  }),
  studentApplication(ids.decidedApplication, ids.decidedClub, "Hoos Coding", "ACCEPTED", { recruitmentOffer: { status: "PENDING", expiresAt: at(2) }, offerStatus: "PENDING", decisionLetters: [{ id: ids.letter }], round: { id: ids.round2, name: "Final round", order: 2 } }),
];
const applicationsView: ApplicationsView = {
  generatedAt: at(0), userId: ids.user, alumni: false, alumniRefusals: { respond: "Alumni can’t respond to offers.", book: "Alumni can’t book interviews." },
  stages: [{ id: "drafts", label: "Drafts", count: 1 }, { id: "in-review", label: "In review", count: 1 }, { id: "interviews", label: "Interviews", count: 1 }, { id: "decisions", label: "Decisions", count: 1 }],
  initialStage: "drafts", applications,
};
const emptyApplicationsView: ApplicationsView = { ...applicationsView, stages: applicationsView.stages.map(stage => ({ ...stage, count: 0 })), applications: [] };

const schedule: ApplicantSchedule = {
  applicationId: ids.interviewApplication, clubName: "Design Team", roundName: "Interviews",
  rooms: [
    { id: ids.room, name: "Room A — the long conference room on the second floor of Rice Hall", location: "Rice 242", kind: "IN_PERSON", duration: 30, isOpen: true, slots: [
      { id: ids.slot, startTime: at(5), endTime: at(5, 0.5), capacity: 1, booked: 0 },
      { id: ids.slot2, startTime: at(5, 1), endTime: at(5, 1.5), capacity: 2, booked: 2 },
      { id: uuid(95), startTime: at(6), endTime: at(6, 0.5), capacity: 1, booked: 0 },
    ] },
    { id: uuid(96), name: "Zoom", location: "", kind: "VIRTUAL", duration: 30, isOpen: false, slots: [] },
  ],
  booking: null, publicationState: "PUBLISHED", allowCancellation: true, allowRescheduling: true, conflictingTimes: 1,
};
const decisionLetter: DecisionLetterView = {
  notificationId: ids.inbox(3), applicationId: ids.decidedApplication, clubId: ids.decidedClub, currentStatus: "ACCEPTED", isCurrent: true, suspended: false, offer: { status: "PENDING", expiresAt: at(2) },
  letter: { id: ids.letter, version: 1, decision: "ACCEPTED", createdAt: at(-1), content: {
    title: "Congratulations!", body: "We are delighted to offer you a place.\n\n".repeat(8), closing: "Warmly,", signer: "The Hoos Coding Board", footer: "Reply by Friday.", celebration: "confetti",
    studentName: longPerson, clubName: "Hoos Coding", logoReference: null, accent: "#0F2E56", date: "March 1, 2027",
  } },
};

// ---- Meetings and tasks -----------------------------------------------------------------------
const meeting = (id: string, clubId: string, days: number, extra: Partial<Meeting> = {}): Meeting => ({
  id, clubId, title: id === ids.meeting ? `Weekly general body meeting for all members of ${longName}` : "Officer sync", description: id === ids.meeting ? "We will plan the season. ".repeat(10) : null,
  date: at(days), endDate: id === ids.meeting ? at(days, 1.5) : null, location: id === ids.meeting ? "Rice Hall 130" : "", audience: id === ids.meeting ? "MEMBERS" : "RECRUITMENT", isPublic: id !== ids.meeting,
  agenda: id === ids.meeting ? "1. Welcome\n2. Budget\n3. Teams" : null, recap: null, resources: id === ids.meeting ? [{ id: "r1", label: "Slides", url: "https://example.edu/slides", kind: "link" }, { id: "r2", label: "Broken", url: "javascript:alert(1)", kind: "link" }] : null,
  revision: 3, club: { name: clubId === ids.leaderClub ? longName : "Virginia Motorsports" }, ...extra,
});
const meetingsFor = (input: unknown) => {
  const clubId = (input as { clubId?: string } | undefined)?.clubId ?? ids.leaderClub;
  return [meeting(ids.meeting, clubId, 0.05), meeting(ids.meeting2, clubId, 7), meeting(uuid(43), clubId, -7)];
};
type Assignment = TaskWorkspace["tasks"][number]["assignments"][number];
const assignment = (id: string, taskId: string, memberId: string, extra: Partial<Assignment> = {}): Assignment => ({
  id, taskId, memberId, userId: ids.user, assignedAt: at(-5), viewedAt: null, text: null, link: null, submittedAt: null, reviewedAt: null, revisionRequestedAt: null, groupLabel: null, feedback: null, revision: 1, files: [], ...extra,
});
const workspaceFor = (input: unknown): TaskWorkspace => {
  const clubId = (input as { clubId?: string } | undefined)?.clubId ?? ids.memberClub;
  const memberId = clubId === ids.leaderClub ? ids.leaderMembership : ids.memberMembership;
  const task = (id: string, extra: Partial<ClubTask>): ClubTask => ({
    id, clubId, kind: "TASK", projectId: null, project: null, title: "Task", description: null, status: "OPEN", dueAt: null, createdAt: at(-6), requirements: [], resources: null, revision: 1, assignments: [], ...extra,
  });
  return {
    clubId, manage: clubId === ids.leaderClub, memberId,
    tasks: [
      task(ids.task, { title: `Submit the ${longName} chassis design review packet`, description: "Upload CAD files. ".repeat(20), dueAt: at(1), requirements: ["FILE", "LINK"], resources: [{ label: "Template", url: "https://example.edu/template" }, { label: "bad", url: "ftp://x" }, null],
        assignments: [assignment(ids.assignment, ids.task, memberId)] }),
      task(ids.project, { kind: "PROJECT", title: "Spring build project", dueAt: at(-2), assignments: [assignment(ids.projectAssignment, ids.project, memberId, { submittedAt: at(-3), text: "Done", link: "https://example.edu/doc", feedback: "Great work", reviewedAt: at(-1), files: [{ id: uuid(800), name: "design-final-v12-really-final.pdf", size: 2_345_678 }] })] }),
      task(ids.childTask, { projectId: ids.project, project: { id: ids.project, title: "Spring build project" }, title: "Order parts", status: "DONE", assignments: [assignment(ids.childAssignment, ids.childTask, memberId, { revisionRequestedAt: at(-1), viewedAt: at(-2) })] }),
      task(uuid(57), { status: "DRAFT", title: "Draft (hidden)", assignments: [assignment(uuid(58), uuid(57), memberId)] }),
      task(uuid(59), { title: "Someone else’s task", assignments: [assignment(uuid(60), uuid(59), "other-member")] }),
    ],
  };
};

// ---- Profile ----------------------------------------------------------------------------------
const fullProfile: FullStudentProfile = {
  ...studentProfile, userId: ids.user, highSchool: null, gender: null, transferStudent: false, scholarStatus: null, satScore: null, actScore: null, actEnglish: null, actMath: null, actReading: null, actScience: null,
  bio: "I like cars. ".repeat(40), linkedinUrl: "https://www.linkedin.com/in/someone", resumeUrl: "resumes/user-1/resume.pdf", headshotUrl: "profile-photos/user-1/photo.jpg",
  experiences: [{ id: "x1", title: "Intern", subtitle: "A very long company name that goes on and on Incorporated", period: "Summer 2026" }, { title: "Volunteer", subtitle: "", period: "" }],
};

// ---- Leader tools -----------------------------------------------------------------------------
const interviewEntry = (n: number, extra: Partial<InterviewEntry> = {}): InterviewEntry => ({
  id: uuid(900 + n), slotId: uuid(910 + n), roomId: ids.room, bookingId: n === 3 ? null : uuid(920 + n), clubId: ids.leaderClub, roundId: ids.round, roundName: "Interviews", roomName: n === 1 ? "Room A — the long conference room" : "Room B",
  location: n === 2 ? "" : "Rice 242", timezone: "America/New_York", startTime: at(n === 4 ? -1 : n * 0.02), endTime: at(n === 4 ? -1 : n * 0.02, 0.5), applicationId: n === 3 ? null : uuid(930 + n),
  candidate: n === 3 ? null : n === 1 ? longPerson : `Candidate ${n}`, interviewers: n === 1 ? ["A. Person", "B. Person", "C. Person"] : [],
  completed: n === 4, started: n === 2, cancelled: n === 5, canOpen: n !== 3 && n !== 5, ...extra,
});
const roomListItem = (n: number, extra: Partial<RoomListItem> = {}): RoomListItem => ({
  id: n === 1 ? ids.session : uuid(1000 + n), mode: n === 4 ? "BOARD" : "LIVE", clubId: ids.leaderClub, cycleId: null, roundId: ids.round, state: ["DRAFT", "OPEN", "SCHEDULED", "COMPLETED", "OPEN"][n % 5]!, createdAt: at(-n), updatedAt: null, finalizedAt: n === 3 ? at(-1) : null,
  meeting: n === 2 ? null : { name: n === 1 ? `Final deliberation for ${longName}` : `Session ${n}`, plannedAt: n === 5 ? null : at(n - 2), timeZone: "America/New_York", status: n === 3 ? "CANCELLED" : "SCHEDULED", location: null },
  roundName: "Final round", cycleName: "Spring 2027", applicantCount: n * 7, view: (["leader", "member", "present"] as const)[n % 3]!, joined: n % 2 === 0, ...extra,
});
const roomSnapshot: RoomSnapshot = {
  id: ids.session, clubId: ids.leaderClub, cycleId: null, roundId: ids.round, revision: 12, status: "OPEN",
  meeting: { name: "Final deliberation", plannedAt: at(0), location: null, status: "LIVE" },
  currentApplicantId: uuid(1101), passNumber: 1, ballotsReceived: 4, finalizedAt: null,
  targetSummary: { pass: { kind: "ROUND", label: "Advance to Interviews" }, decisions: { pass: 3, hold: 1, notPass: 2, unreviewed: 9, total: 15 } },
  permissions: { leader: true, voter: true, observer: false, canEnd: true, canFinalize: false, canCorrect: true, canDecideWithoutVote: true },
  outcomes: [{ applicationId: uuid(1100), passNumber: 1, outcome: "ACCEPT" }],
  history: [{ number: 1, status: "OPEN", candidates: [
    { applicationId: uuid(1100), position: 0, ballotState: "CONFIRMED", outcome: "ACCEPT", ownBallot: { choice: "ACCEPT", revision: 1 }, totals: { ACCEPT: 5, HOLD: 1, REJECT: 0 } },
    { applicationId: uuid(1101), position: 1, ballotState: "OPEN", outcome: "UNREVIEWED", ownBallot: null },
    { applicationId: uuid(1102), position: 2, ballotState: "PENDING", outcome: "UNREVIEWED", ownBallot: null },
  ] }],
  roundName: "Final round", cycleName: "Spring 2027", nextRoundName: null, undo: null, rule: { mode: "MAJORITY", description: "A simple majority advances." }, ruleResult: null,
  accessVersion: "v1", ownApplicant: false, joinedSelf: true, participation: { voted: 4, eligible: 9 }, votingPaused: false, viewedAt: at(0), viewToken: null, electorateChange: null,
  joinedParticipants: [{ id: "p1", label: "A. Person", joined: true }, { id: "p2", label: "B. Person", joined: false }],
};

// ---- Sets -------------------------------------------------------------------------------------
const availabilitySchedule = { timezone: "America/New_York", weekly: [[[540, 720]], [], [[840, 1020]], [], [], [], []], weeklySubmitted: true, exceptions: {} };

const rich: FixtureSet = {
  // Public sign-up options (lib/mobile-api/auth.ts mobileSignupOptions). No Turnstile key: checks stay off in tests.
  "auth.signupOptions": { termsRequired: true, turnstileSiteKey: null, graduationYears: ["2027", "2028", "2029", "2030"] },
  // Account
  "me": me,
  "account.deletion": { pending: { requestedAt: at(-1), scheduledFor: at(29), emailSent: true }, warnings: ["You own a club. Transfer ownership first."] },
  "account.deletion.request": { requestedAt: at(0), scheduledFor: at(30), emailSent: true, warnings: [] },
  "account.deletion.cancel": null,
  "calendarFeed": { active: true, createdAt: at(-30), lastUsedAt: null },
  "calendarFeed.create": { https: "https://out-class.test/feed.ics", webcal: "webcal://out-class.test/feed.ics", google: "https://calendar.google.com/x" },
  "calendarFeed.disable": null,
  // Settings → Interests (actions/interest-survey.ts); the save echoes the answers with the next revision.
  "interests": { interests: ["tech", "consulting"], goals: ["career"], weeklyHours: "3-5", selectivity: null, revision: 3, completed: true, dismissed: false },
  "interests.save": (input: unknown) => { const { revision, ...answers } = input as { revision: number }; return { ...answers, revision: revision + 1, completed: true, dismissed: false }; },
  // Home, calendar
  "home.view": homeView,
  "calendar.view": { generatedAt: at(0), events: agenda },
  // Explore, clubs, events
  "explore.directory": directory,
  "club": (input: unknown) => ({ club: (input as { club?: string })?.club === "missing" ? null : fullClub }),
  "clubs.saved": { items: [{ club: fullClub, savedAt: at(-1) }, { club: publicClub(1), savedAt: at(-2) }, { club: publicClub(2), savedAt: at(-3) }] },
  "clubs.save": { saved: true, savedAt: at(0) },
  "events.board": eventBoard,
  "events.event": (input: unknown) => ({ ...campusEvent(1), id: (input as { eventId?: string })?.eventId ?? ids.event }),
  "events.savedIds": [ids.event],
  "events.save": { saved: true },
  "events.rsvp": { going: true },
  "events.rsvp.set": { ok: true, going: true, count: 150 },
  "events.myRsvps": [{ eventId: ids.event, title: campusEvent(1).title, available: true }, { eventId: uuid(599), title: "A cancelled event", available: false }],
  "share.shortLink": { url: "https://out-class.net/q/abc123", code: "abc123" },
  // Profile
  "profile": { profile: fullProfile },
  "profile.updateSection": { profile: fullProfile },
  "profile.upload": { reference: "profile-photos/user-1/new.jpg" },
  // Applications
  "applications.view": applicationsView,
  "applications.start": { applicationId: ids.draftApplication },
  "applications.saveDraft": null,
  "applications.submit": null,
  "interviews.schedule": schedule,
  "interviews.reserve": null,
  "interviews.cancel": null,
  "decisions.letter": decisionLetter,
  "offers.respond": { status: "ACCEPTED" },
  // Inbox
  "inbox": inbox,
  "inbox.read": null,
  "inbox.archive": null,
  "inbox.preferences": { emailAnnouncements: true, emailMessages: true, emailApplications: true, emailInterviews: false, emailInvitations: true, emailTasks: true, emailPlatform: false, emailFrequency: "DAILY" },
  "inbox.preferences.save": (input: unknown) => input,
  // Links, push
  "shortLinks.resolve": (input: unknown) => (input as { code?: string })?.code === "invalid" ? { status: "unavailable" } : { status: "valid", target: `/check-in?meetingId=${ids.meeting}#token=${"t".repeat(32)}` },
  "push.settings": { enabled: true, subscribed: false },
  "push.register": null,
  "push.unregister": null,
  // Meetings
  "meetings": meetingsFor,
  "meetings.meeting": meeting(ids.meeting, ids.memberClub, 0.05),
  "meetings.checkIn": { status: "checked-in", checkedInAt: at(0) },
  "meetings.checkIn.issue": { expiresAt: at(0, 0.25), shortCode: "abc123", shortUrl: "https://out-class.net/q/abc123" },
  "meetings.checkIn.close": null,
  "meetings.attendance": [{ id: "a1", checkedInAt: at(-0.01), name: longPerson }, { id: "a2", checkedInAt: at(-0.02), name: "B. Person" }],
  // Tasks
  "tasks.workspace": workspaceFor,
  "tasks.view": null,
  "tasks.submit": null,
  "tasks.file": { url: "https://out-class.test/file.pdf" },
  "tasks.upload": (input: unknown) => ({ id: uuid(900 + ((input as { name: string }).name.length % 90)), url: "https://storage.out-class.test/upload/sign" }),
  // Voting
  "voting.rooms": Array.from({ length: 6 }, (_, index) => roomListItem(index + 1)),
  "voting.room": roomSnapshot,
  "voting.joinInfo": { status: "READY", meeting: { name: "Final deliberation", plannedAt: at(0), location: null } },
  "voting.join": { joined: true },
  "voting.summary": { revision: 1, rounds: [{ id: ids.round2, name: "Interviews" }], labels: [{ id: "l1", label: "Strong" }] },
  "voting.presentation": { slide: { name: longPerson, anonymous: false, photo: null, showPhoto: true,
    profile: [{ field: "major", text: "Mechanical Engineering" }, { field: "year", text: "First year", accent: true }],
    facts: [{ field: "gpa", label: "GPA", value: "3.9", meta: [] }, { field: "score", label: "Average", value: "4.2", unit: "/5", meta: ["3 reviews"] }],
    notes: [{ key: "n1", label: "Interview notes", paragraphs: [{ text: "Strong candidate. ".repeat(20) }, { text: "Quote", quote: true, meta: "Reviewer" }] }] } },
  "voting.ballot": { ok: true, result: { accepted: true, ballotRevision: 2 } },
  "voting.command": { ok: true, result: { revision: 13 } },
  // Leader
  "leader.overview": { operations: { rounds: [
    { id: ids.round, name: "Written application", type: "APPLICATION", anonymous: false, count: 120, pending: 40, reviewed: 80 },
    { id: ids.round2, name: "Interviews", type: "INTERVIEW", anonymous: true, count: 30, pending: 30, reviewed: 0 },
  ] } },
  "leader.pipelinePage": {
    rounds: [{ id: ids.round, name: "Written application" }, { id: ids.round2, name: "Interviews" }],
    applications: [
      { id: uuid(1200), studentId: "s1", roundId: ids.round, status: "SUBMITTED", student: { email: "a@virginia.edu", studentProfile: { firstName: "Maximiliana-Alexandria", lastName: "Montgomery-Vanderbilt de la Cruz", major: "Mechanical Engineering", academicYear: "First year", headshotUrl: null } }, roundScore: { average: 4.25, submitted: 3, required: 3, provisional: false } },
      { id: uuid(1201), studentId: "anonymous-2", roundId: ids.round2, status: "INTERVIEWING", student: { email: "Applicant 2", studentProfile: null }, roundScore: null },
      { id: uuid(1202), studentId: "s3", roundId: ids.round, status: "WEIRD_STATUS", student: { email: "c@virginia.edu", studentProfile: { firstName: "C", lastName: "D" } }, roundScore: { average: null, submitted: 1, required: 3, provisional: true } },
      { id: uuid(1203), studentId: "s4", roundId: ids.round, status: "IN_REVIEW", student: { email: "d@virginia.edu", studentProfile: { firstName: "E", lastName: "F", major: null, academicYear: null, headshotUrl: "x" } }, roundScore: { average: null, submitted: 0, required: 0, provisional: false } },
    ],
    page: { total: 150, baseTotal: 150, next: { id: uuid(1203), direction: "after", scope: "s" } }, profileFields: { major: true, academicYear: true, photo: false },
  },
  "leader.announce.preview": { count: 42, evaluatedAt: at(0) },
  "leader.announcements": [{ id: uuid(1301), title: "General meeting moved to Rice 130", body: "See you there.", audience: "MEMBERS", publishedAt: at(-1), _count: { notifications: 42 } }],
  "leader.announce": { id: uuid(1300), recipientCount: 42 },
  "leader.interviewRooms": Array.from({ length: 5 }, (_, index) => interviewEntry(index + 1)),
  "leader.interviewSession.open": { id: uuid(1400), revision: 1, draft: { overallReview: "", additionalNotes: "" }, completedAt: null, instructions: "Be kind." },
  "leader.interviewSession.save": { session: { id: uuid(1400), revision: 2, draft: { overallReview: "", additionalNotes: "x" }, completedAt: null } },
  // Settings → Availability (actions/availability.ts): the global week, one round awaiting a response, and saves that echo the next revision.
  "availability.mine": { document: { accountId: ids.user, revision: 2, schedule: availabilitySchedule }, rounds: [
    { id: ids.round, clubId: ids.memberClub, clubName: "Virginia Motorsports", name: "First round interviews", confirmed: false, response: "AWAITING", requested: true },
    { id: ids.round2, clubId: ids.leaderClub, clubName: longName, name: "Final round", confirmed: true, response: "SUBMITTED", requested: true },
  ] },
  "availability.save": (input: unknown) => { const value = input as { revision: number }; return { ...value, revision: value.revision + 1 }; },
  "availability.round": (input: unknown) => ({ preferredWeek: "2026-11-23", name: (input as { roundId: string }).roundId === ids.round ? "First round interviews" : "Final round", confirmed: false, declined: false, global: availabilitySchedule,
    document: { accountId: ids.user, revision: 1, schedule: { ...availabilitySchedule, exceptions: { "2026-11-24": [[600, 660]] } } } }),
  "availability.round.save": (input: unknown) => { const { clubId: _c, roundId: _r, confirm, ...value } = input as { clubId: string; roundId: string; confirm: boolean; revision: number }; return { document: { ...value, revision: value.revision + 1 }, confirmed: confirm }; },
  "availability.round.decline": (input: unknown) => ({ revision: (input as { revision: number }).revision + 1 }),
};

const empty: FixtureSet = {
  "me": emptyMe,
  "account.deletion": { pending: null, warnings: [] },
  "calendarFeed": { active: false, createdAt: null, lastUsedAt: null },
  "interests": { interests: [], goals: [], weeklyHours: null, selectivity: null, revision: 0, completed: false, dismissed: false },
  "home.view": emptyHome,
  "calendar.view": { generatedAt: at(0), events: [] },
  "explore.directory": { clubs: [] },
  "club": { club: null },
  "clubs.saved": { items: [] },
  "events.board": { events: [], clubs: [], total: 0, hasMore: false },
  "events.event": null,
  "events.savedIds": [],
  "events.rsvp": { going: false },
  "events.myRsvps": [],
  "profile": { profile: null },
  "applications.view": emptyApplicationsView,
  "interviews.schedule": { applicationId: ids.interviewApplication, clubName: "Design Team", roundName: "Interviews", rooms: [], booking: null },
  "decisions.letter": null,
  "inbox": { items: [], nextCursor: null, unread: 0 },
  "shortLinks.resolve": { status: "unavailable" },
  "push.settings": { enabled: false, subscribed: false },
  "meetings": [],
  // getMeeting throws NOT_FOUND (actions/meetings.ts), which the API sends as a 404 refusal.
  "meetings.meeting": () => { throw new ApiError(404, "NOT_FOUND", "Meeting unavailable or access denied. Check the link or ask the club for a new one."); },
  "meetings.attendance": [],
  "tasks.workspace": (input: unknown) => ({ clubId: (input as { clubId?: string })?.clubId ?? ids.memberClub, manage: false, memberId: ids.memberMembership, tasks: [] }),
  "voting.rooms": [],
  "voting.room": { ...roomSnapshot, status: "DRAFT", currentApplicantId: null, history: [], outcomes: [], joinedParticipants: [], rule: null, meeting: null, roundName: null, cycleName: null,
    permissions: { leader: false, voter: true, observer: false, canEnd: false, canFinalize: false, canCorrect: false, canDecideWithoutVote: false }, participation: { voted: 0, eligible: 0 } },
  "voting.joinInfo": { status: "READY", meeting: null },
  "voting.summary": { revision: 0, rounds: [], labels: [] },
  "voting.presentation": { stale: true },
  "leader.overview": { operations: null },
  "leader.pipelinePage": { rounds: [], applications: [], page: { total: 0, baseTotal: 0, next: null }, profileFields: { major: false, academicYear: false, photo: false } },
  "leader.announce.preview": { count: 0, evaluatedAt: at(0) },
  "leader.announcements": [],
  "leader.interviewRooms": [],
  "availability.mine": { document: { accountId: ids.user, revision: 0, schedule: { timezone: "America/New_York", weekly: [[], [], [], [], [], [], []], weeklySubmitted: false, exceptions: {} } }, rounds: [] },
};

export const fixtureSets = { rich, empty };
/** Records tests reuse to build overrides (e.g. a leader account inside the empty set). */
export const records = { me, emptyMe, leaderMembership, memberMembership, alumniMembership, homeView, applicationsView, schedule, decisionLetter, roomSnapshot, fullClub, campusEvent, studentApplication, meeting };
