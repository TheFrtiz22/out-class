import { ids, longName, longPerson } from "./fixtures";

type Params = Record<string, string | undefined>;
type Expect = string | RegExp;
export type RouteCase = {
  /** Path of the route file under src/app, without the extension. */
  file: string;
  params?: Params;
  segments?: string[];
  /** Text that must appear once the data settled, per fixture mode. */
  rich?: Expect[];
  empty?: Expect[];
  error?: Expect[];
  /** The route mounts its own providers (the root layout). */
  ownProviders?: boolean;
  /** Known app bugs: the mode's test is marked `test.failing` with the reason (see the report). */
  failing?: Partial<Record<"rich" | "empty" | "error" | "missing" | "malformed" | "presses", string>>;
};

const error = [/test refusal|couldn.t|could not|try again|unavailable|went wrong/i];

/** Every route file in src/app, with the params a real navigation passes. */
export const routes: RouteCase[] = [
  { file: "_layout", ownProviders: true, segments: ["(tabs)"] },
  { file: "+not-found", rich: ["This page isn’t in the app", "Go to Home"], empty: ["This page isn’t in the app"], error: ["This page isn’t in the app"] },
  { file: "(tabs)/_layout", rich: ["Home", "Explore", "Apply", "Calendar", "Profile"], empty: ["Home", "Apply"], error: ["Home"] },
  { file: "(tabs)/index", rich: [/^(Good (morning|afternoon|evening)|Still up), Maximiliana-Alexandria\??$/, "Leading", "My Clubs", "Coming Up", "Applications"], empty: [/^(Good (morning|afternoon|evening)|Still up)\??$/, "Find clubs"], error },
  { file: "(tabs)/explore", rich: ["Explore", "12 clubs"], empty: ["No clubs available yet."], error },
  { file: "(tabs)/clubs", rich: ["Apply", "Applications"], empty: ["Apply", "No applications yet."], error },
  { file: "inbox", rich: ["Inbox", "Notification 2"], empty: ["Inbox"], error },
  { file: "my-clubs", rich: ["My clubs"], empty: ["My clubs", "No clubs yet"], error },
  { file: "(tabs)/calendar", rich: ["Calendar", "Availability"], empty: ["Calendar", "Availability"], error },
  { file: "(tabs)/profile", rich: [/Maximiliana-Alexandria/], empty: ["Profile"], error },
  { file: "application/[id]", params: { id: ids.draftApplication }, rich: [`Why do you want to join ${longName}?`], empty: ["Application unavailable"], error },
  { file: "applications", rich: ["Applications"], empty: ["Applications"], error },
  { file: "club/[id]", params: { id: ids.applyClub }, rich: [longName], empty: ["This club is no longer available."], error },
  { file: "decision/[applicationId]", params: { applicationId: ids.decidedApplication }, rich: ["Congratulations!"], empty: ["Decision letter unavailable"], error },
  { file: "events/[id]", params: { id: ids.event }, rich: [`Spring showcase and open house: ${longName}`], empty: [/not available|unavailable|couldn|find|no longer/i], error },
  { file: "events/index", rich: ["Events", "Campus event 2"], empty: ["Events"], error },
  { file: "interview/[applicationId]", params: { applicationId: ids.interviewApplication }, rich: ["Book your interview"], empty: [/interview/i], error },
  { file: "leader/[clubId]/announce", params: { clubId: ids.leaderClub }, rich: ["Announce"], empty: ["Announce"], error: ["Announce"] },
  { file: "leader/[clubId]/applicants", params: { clubId: ids.leaderClub }, rich: [longPerson], empty: ["Applicants"], error },
  { file: "leader/[clubId]/check-in/[meetingId]", params: { clubId: ids.leaderClub, meetingId: ids.meeting }, rich: ["checked in", "Close check-in"], empty: ["checked in"], error },
  { file: "leader/[clubId]/index", params: { clubId: ids.leaderClub }, rich: ["Leader tools"], empty: ["Leader tools"], error: ["Leader tools"] },
  { file: "leader/[clubId]/interviews", params: { clubId: ids.leaderClub }, rich: [longPerson], empty: ["Interview day"], error },
  { file: "leader/[clubId]/voting", params: { clubId: ids.leaderClub }, rich: [`Final deliberation for ${longName}`], empty: ["No active sessions."], error },
  { file: "meeting/[id]", params: { id: ids.meeting }, rich: [`Weekly general body meeting for all members of ${longName}`, "Slides"], empty: ["Meeting"], error },
  { file: "my-club/[clubId]", params: { clubId: ids.memberClub }, rich: ["Virginia Motorsports"], empty: ["My club"], error },
  { file: "q/[code]", params: { code: "abc123" }, rich: [/checked in|check-in|Checked/i], empty: [/isn.t|unavailable|not valid|expired/i], error },
  { file: "reset-password", segments: ["reset-password"], params: { "#": "token_hash=pkce_0123456789abcdefABCDEF" }, rich: ["Set a new password", "Update password"], empty: ["Set a new password"], error: ["Set a new password"] },
  { file: "saved-clubs", rich: ["Saved clubs", longName], empty: ["Saved clubs"], error },
  { file: "scan", rich: [/scan/i], empty: [/scan/i], error: [/scan/i] },
  { file: "settings/account", rich: ["Account & Security", "Delete account"], empty: ["Account & Security"], error: ["Delete account"] },
  { file: "settings/availability", rich: ["Availability", "Saved", "My global availability · all clubs"], empty: ["No schedule saved"], error },
  { file: "settings/index", rich: ["Settings"], empty: ["Settings"], error: ["Settings"] },
  { file: "settings/interests", rich: ["Interests", "What are you into?", "2 of 6"], empty: ["0 of 6"], error },
  { file: "settings/interviews", rich: ["Interview schedule", "Include past interviews", "Virginia Motorsports · First round interviews"], empty: ["No upcoming panels"], error },
  { file: "settings/notifications", rich: ["Notifications"], empty: ["Notifications"], error: ["Notifications"] },
  { file: "sign-in", segments: ["sign-in"], rich: ["Sign in", "Terms of Service", "Privacy Policy"], empty: ["Sign in"], error: ["Sign in"] },
  { file: "task/[assignmentId]", params: { assignmentId: ids.assignment, clubId: ids.memberClub }, rich: [`Submit the ${longName} chassis design review packet`], empty: ["Task"], error },
  { file: "tasks", rich: ["Tasks", `Submit the ${longName} chassis design review packet`], empty: ["Tasks"], error },
  { file: "voting/[sessionId]", params: { sessionId: ids.session, clubId: ids.leaderClub }, rich: ["Applicant 2 of 3", "Close vote"], empty: [/vot|join|room/i], error },
];
