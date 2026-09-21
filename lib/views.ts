import {
  LogIn,
  Home,
  CalendarDays,
  CalendarClock,
  Table2,
  Bell,
  Compass,
  ClipboardList,
  ShieldAlert,
  MessageSquareText,
  Users2,
  Settings2,
  UserRound,
  Megaphone,
  Globe,
  type LucideIcon,
} from "lucide-react"

export type ViewId =
  | "landing"
  | "auth"
  | "student-onboarding"
  | "student-dashboard"
  | "student-profile"
  | "inbox"
  | "discover"
  | "tracker"
  | "calendar"
  | "leader-dashboard"
  | "club-manager"
  | "club-management-portal"
  | "screening-dashboard"
  | "interview-scheduler"
  | "interview-workspace"
  | "broadcast-messages"

export type NavItem = { id: ViewId; title: string; icon: LucideIcon }

export type AppMode = "student" | "admin"

/** The club the current user administers when in Admin (Executive) mode. */
export const adminClubName = "Virginia Venture Fund"

/** Standard student navigation, shown when appMode === "student". */
export const studentNav: NavItem[] = [
  { id: "landing", title: "Landing Page", icon: Globe },
  { id: "student-dashboard", title: "Dashboard", icon: Home },
  { id: "student-profile", title: "Profile", icon: UserRound },
  { id: "discover", title: "Discover", icon: Compass },
  { id: "tracker", title: "Application Tracker", icon: ClipboardList },
  { id: "inbox", title: "Inbox", icon: Bell },
  { id: "calendar", title: "Calendar", icon: CalendarDays },
]

/** Executive navigation, shown when appMode === "admin". */
export const adminNav: NavItem[] = [
  { id: "landing", title: "Landing Page", icon: Globe },
  { id: "leader-dashboard", title: "Applicant CRM", icon: Table2 },
  { id: "interview-scheduler", title: "Interview Scheduler", icon: CalendarClock },
  { id: "interview-workspace", title: "Live Workspace", icon: MessageSquareText },
  { id: "broadcast-messages", title: "Broadcast & Messages", icon: Megaphone },
  { id: "club-manager", title: "Club Settings", icon: Settings2 },
]

export const navSections: { label: string; items: NavItem[] }[] = [
  {
    label: "Account",
    items: [
      { id: "landing", title: "Landing Page", icon: Globe },
      { id: "auth", title: "Login & Sign Up", icon: LogIn },
      { id: "student-onboarding", title: "Student Onboarding", icon: UserRound },
    ],
  },
  {
    label: "Student",
    items: [
      { id: "student-dashboard", title: "Dashboard", icon: Home },
      { id: "discover", title: "Discover", icon: Compass },
      { id: "tracker", title: "Application Tracker", icon: ClipboardList },
      { id: "inbox", title: "Inbox", icon: Bell },
      { id: "calendar", title: "Calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Club Leader",
    items: [
      { id: "leader-dashboard", title: "Applicant CRM", icon: Table2 },
      { id: "screening-dashboard", title: "Screening & Auto-Filter", icon: ShieldAlert },
      { id: "interview-scheduler", title: "Interview Scheduler", icon: CalendarClock },
      { id: "interview-workspace", title: "Interview Workspace", icon: MessageSquareText },
      { id: "club-manager", title: "Club Settings", icon: Users2 },
      { id: "club-management-portal", title: "Management Portal", icon: Settings2 },
    ],
  },
]

export const viewTitles: Record<ViewId, { title: string; subtitle: string }> = {
  landing: { title: "OutClass SaaS Landing Page", subtitle: "A Common App for club recruitment." },
  auth: { title: "Welcome to OutClass", subtitle: "One profile. Every selective club." },
  "student-onboarding": { title: "Create Your Profile", subtitle: "Set up your OutClass student profile." },
  "student-dashboard": { title: "Dashboard", subtitle: "Track your profile and active applications." },
  "student-profile": { title: "Profile", subtitle: "Your identity and club memberships at a glance." },
  inbox: { title: "Notifications", subtitle: "Stay on top of club updates, interviews, and deadlines." },
  discover: { title: "Discover", subtitle: "Personalized club recommendations, curated for you." },
  tracker: { title: "Application Tracker", subtitle: "Every deadline, essay, and decision in one place." },
  calendar: { title: "Calendar", subtitle: "Deadlines, interviews, and chats for your clubs." },
  "leader-dashboard": { title: "Applicant CRM", subtitle: "Review, score, and advance your applicants." },
  "club-manager": {
    title: "Club Settings",
    subtitle: "Manage roster permissions, application questions, and your public profile.",
  },
  "club-management-portal": {
    title: "Club Management Portal",
    subtitle: "Edit your club's public page and manage your executive team.",
  },
  "screening-dashboard": {
    title: "Screening & Auto-Filter",
    subtitle: "Screen high-volume applicants with dynamic auto-reject rules.",
  },
  "interview-scheduler": {
    title: "Interview Scheduler & Booking Manager",
    subtitle: "Build the master slot schedule and preview the student booking flow.",
  },
  "interview-workspace": {
    title: "Live In-Interview Workspace",
    subtitle: "Take real-time notes and score the candidate as the interview happens.",
  },
  "broadcast-messages": {
    title: "Broadcast & Messages",
    subtitle: "Blast urgent notifications to subscribers, applicants, or members.",
  },
} satisfies Record<ViewId, { title: string; subtitle: string }>
