import { CalendarStar, LogIn, Home, CalendarDays, CalendarClock, Table2, Bell, Compass, ClipboardList, ShieldAlert, MessageSquareText, Settings2, UserRound, Megaphone, Globe, type IconComponent } from "@/components/icons";

export type ViewId =
  | "my-clubs"
  | "landing"
  | "auth"
  | "student-onboarding"
  | "student-dashboard"
  | "student-profile"
  | "inbox"
  | "explore"
  | "corkboard"
  | "status"
  | "tracker"
  | "calendar"
  | "leader-dashboard"
  | "club-manager"
  | "screening-dashboard"
  | "interview-scheduler"
  | "interview-workspace"
  | "broadcast-messages"

export type NavItem = { id: ViewId; title: string; icon: IconComponent }

export type AppMode = "student" | "admin"

/** The club the current user administers when in Admin (Executive) mode. */
export const adminClubName = "Virginia Venture Fund"

/** Standard student navigation, shown when appMode === "student". */
export const studentNav: NavItem[] = [
  { id: "student-dashboard", title: "Home", icon: Home },
  { id: "explore", title: "Explore", icon: Compass },
  { id: "corkboard", title: "Events", icon: CalendarStar },
  { id: "tracker", title: "Applications", icon: ClipboardList },
  { id: "calendar", title: "Calendar", icon: CalendarDays },
  { id: "student-profile", title: "Profile", icon: UserRound },
]

/** Same visual structure, with task-oriented labels for club leaders. */
export const adminNav: NavItem[] = [
  { id: "leader-dashboard", title: "Applicants", icon: Table2 },
  { id: "interview-scheduler", title: "Interviews", icon: CalendarClock },
  { id: "interview-workspace", title: "Interview room", icon: MessageSquareText },
  { id: "broadcast-messages", title: "Announcements", icon: Megaphone },
  { id: "club-manager", title: "Settings", icon: Settings2 },
]

export const navSections: { label: string; items: NavItem[] }[] = [
  {
    label: "Account",
    items: [
      { id: "landing", title: "Landing Page", icon: Globe },
      { id: "auth", title: "Sign in & sign up", icon: LogIn },
      { id: "student-onboarding", title: "Student Onboarding", icon: UserRound },
    ],
  },
  {
    label: "Student",
    items: [
      { id: "student-dashboard", title: "Dashboard", icon: Home },
      { id: "explore", title: "Explore", icon: Compass },
      { id: "corkboard", title: "Corkboard", icon: CalendarStar },
      { id: "tracker", title: "Application Tracker", icon: ClipboardList },
      { id: "inbox", title: "Inbox", icon: Bell },
      { id: "calendar", title: "Calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Club workspace",
    items: [
      { id: "leader-dashboard", title: "Applicant CRM", icon: Table2 },
      { id: "screening-dashboard", title: "Screening & Auto-Filter", icon: ShieldAlert },
      { id: "interview-scheduler", title: "Interview Scheduler", icon: CalendarClock },
      { id: "interview-workspace", title: "Interview room", icon: MessageSquareText },
      { id: "club-manager", title: "Settings", icon: Settings2 },
    ],
  },
]

export const viewTitles: Record<ViewId, { title: string; subtitle: string }> = {
  "my-clubs": { title: "My Clubs", subtitle: "Your clubs, meetings, and tasks." },
  landing: { title: "OutClass home", subtitle: "Discover and apply to participating university clubs." },
  auth: { title: "Welcome to OutClass", subtitle: "One profile. Every selective club." },
  "student-onboarding": { title: "Create Your Profile", subtitle: "Set up your OutClass student profile." },
  "student-dashboard": { title: "Home", subtitle: "Your applications, next steps, and upcoming events." },
  "student-profile": { title: "Profile", subtitle: "Your identity and club memberships at a glance." },
  inbox: { title: "Inbox", subtitle: "Stay on top of club updates, interviews, and deadlines." },
  explore: { title: "Explore", subtitle: "Browse clubs, interests, and campus opportunities." },
  corkboard: { title: "Events", subtitle: "Events on Grounds." },
  tracker: { title: "Applications", subtitle: "Manage your drafts, responses, and submissions." },
  status: { title: "Applications", subtitle: "Your drafts, applications in review, interviews and decisions." },
  calendar: { title: "Calendar", subtitle: "Deadlines, interviews, and chats for your clubs." },
  "leader-dashboard": { title: "Applicant CRM", subtitle: "Review, score, and advance your applicants." },
  "club-manager": {
    title: "Settings",
    subtitle: "Manage roster permissions, application questions, and your public profile.",
  },
  "screening-dashboard": {
    title: "Screening & Auto-Filter",
    subtitle: "Preview saved recruiting thresholds and mark applicants for review.",
  },
  "interview-scheduler": {
    title: "Interview scheduling",
    subtitle: "Set interview times and preview what applicants see.",
  },
  "interview-workspace": {
    title: "Interview room",
    subtitle: "Take real-time notes and score the candidate as the interview happens.",
  },
  "broadcast-messages": {
    title: "Announcements",
    subtitle: "Announcements for your club, sent from its workspace.",
  },
} satisfies Record<ViewId, { title: string; subtitle: string }>
