/**
 * States the three fixture sets don't reach: other next actions, alumni accounts, a booked
 * interview, historical or expired decisions, voting as a member or observer, refusals sent as
 * data, deep-link params. Each renders with rich fixtures plus the overrides named here.
 */
import { ApiError } from "~/lib/api";
import { fixtureSets, ids, records } from "./fixtures";
import type { FixtureSet } from "./fixtures";
import { captureConsole, loggedCrashes, missingFixtures, releaseConsole, renderRoute, screenText } from "./harness";
import { routerState } from "./router-state";

beforeEach(captureConsole);
afterEach(releaseConsole);

const DAY = 86_400_000;
const at = (days: number) => new Date(Date.now() + days * DAY).toISOString();
const alumniMe = { ...records.me, profile: { ...records.me.profile!, graduatedAt: at(-100), graduationConfirmedAt: at(-100) }, memberships: [records.alumniMembership], adminRoles: [] };
const workspace = fixtureSets.rich["tasks.workspace"] as (input: unknown) => unknown;

type Variant = { name: string; file: string; params?: Record<string, string>; overrides: FixtureSet; expect: (string | RegExp)[]; failing?: string; after?: () => void };
const variants: Variant[] = [
  { name: "home: next action is an event", file: "(tabs)/index", overrides: { "home.view": { ...records.homeView, nextAction: { kind: "event", event: records.homeView.agenda[0] } } }, expect: [/View (calendar|meeting)/] },
  { name: "home: next action is a task", file: "(tabs)/index", overrides: { "home.view": { ...records.homeView, nextAction: { kind: "notification", notification: records.homeView.tasks[1] } } }, expect: ["Task 2", "Open"] },
  { name: "home: profile not created yet", file: "(tabs)/index", overrides: { me: { ...records.me, profile: null } }, expect: ["Home"] },
  { name: "applications: alumni account", file: "applications", overrides: { me: alumniMe, "applications.view": { ...records.applicationsView, alumni: true } }, expect: ["Applications"] },
  { name: "application: alumni draft is read-only", file: "application/[id]", params: { id: ids.draftApplication }, overrides: { me: alumniMe, "applications.view": { ...records.applicationsView, alumni: true } }, expect: [/Why do you want to join/] },
  { name: "application: submitted, not a draft", file: "application/[id]", params: { id: ids.reviewApplication }, overrides: {}, expect: ["Virginia Motorsports"] },
  { name: "application: interview stage", file: "application/[id]", params: { id: ids.interviewApplication }, overrides: {}, expect: ["Design Team"] },
  { name: "application: decision with offer", file: "application/[id]", params: { id: ids.decidedApplication }, overrides: {}, expect: ["Hoos Coding"] },
  { name: "interview: already booked", file: "interview/[applicationId]", params: { applicationId: ids.interviewApplication },
    overrides: { "interviews.schedule": { ...records.schedule, booking: { id: ids.booking, applicationId: ids.interviewApplication, slotId: ids.slot, roomId: ids.room, roundId: ids.round, startTime: at(5), endTime: at(5.02), location: "Rice 242" } } }, expect: ["Your interview"] },
  { name: "interview: booking in the past", file: "interview/[applicationId]", params: { applicationId: ids.interviewApplication },
    overrides: { "interviews.schedule": { ...records.schedule, booking: { id: ids.booking, applicationId: ids.interviewApplication, slotId: ids.slot, roomId: ids.room, roundId: ids.round, startTime: at(-2), endTime: at(-1.98), location: "" } } }, expect: [/interview/i] },
  { name: "interview: scheduling paused, no cancellation", file: "interview/[applicationId]", params: { applicationId: ids.interviewApplication },
    overrides: { "interviews.schedule": { ...records.schedule, publicationState: "PAUSED", allowCancellation: false, allowRescheduling: false } }, expect: [/interview/i] },
  { name: "interview: alumni account", file: "interview/[applicationId]", params: { applicationId: ids.interviewApplication }, overrides: { me: alumniMe, "applications.view": { ...records.applicationsView, alumni: true } }, expect: [/interview/i] },
  { name: "decision: historical letter", file: "decision/[applicationId]", params: { applicationId: ids.decidedApplication }, overrides: { "decisions.letter": { ...records.decisionLetter, isCurrent: false, currentStatus: "REJECTED" } }, expect: [/historical letter/] },
  { name: "decision: suspended club", file: "decision/[applicationId]", params: { applicationId: ids.decidedApplication }, overrides: { "decisions.letter": { ...records.decisionLetter, suspended: true } }, expect: [/suspended/] },
  { name: "decision: expired offer", file: "decision/[applicationId]", params: { applicationId: ids.decidedApplication }, overrides: { "decisions.letter": { ...records.decisionLetter, offer: { status: "PENDING", expiresAt: at(-1) } } }, expect: ["Decision"] },
  { name: "decision: rejection letter, no offer", file: "decision/[applicationId]", params: { applicationId: ids.decidedApplication },
    overrides: { "decisions.letter": { ...records.decisionLetter, currentStatus: "REJECTED", offer: null, letter: { ...records.decisionLetter!.letter!, decision: "REJECTED", content: { ...records.decisionLetter!.letter!.content, title: "Thank you for applying", celebration: undefined } } } }, expect: ["Thank you for applying"] },
  { name: "decision: letter id from a notification", file: "decision/[applicationId]", params: { applicationId: ids.decidedApplication, letterId: ids.letter }, overrides: {}, expect: ["Congratulations!"] },
  { name: "voting: member view", file: "voting/[sessionId]", params: { sessionId: ids.session, clubId: ids.leaderClub, view: "member" },
    overrides: { "voting.room": { ...records.roomSnapshot, permissions: { ...records.roomSnapshot.permissions, leader: false } } }, expect: [/vote|join/i] },
  { name: "voting: observer (present) view", file: "voting/[sessionId]", params: { sessionId: ids.session, clubId: ids.leaderClub },
    overrides: { "voting.room": { ...records.roomSnapshot, permissions: { leader: false, voter: false, observer: true, canEnd: false, canFinalize: false, canCorrect: false, canDecideWithoutVote: false } } }, expect: [/applicant/i] },
  { name: "voting: completed session", file: "voting/[sessionId]", params: { sessionId: ids.session, clubId: ids.leaderClub },
    overrides: { "voting.room": { ...records.roomSnapshot, status: "COMPLETED", currentApplicantId: null, finalizedAt: at(0) } }, expect: [/./] },
  { name: "voting: own application under review", file: "voting/[sessionId]", params: { sessionId: ids.session, clubId: ids.leaderClub },
    overrides: { "voting.room": { ...records.roomSnapshot, ownApplicant: true }, "voting.presentation": { ownApplication: true } }, expect: [/./] },
  { name: "voting: undo offered after a decision", file: "voting/[sessionId]", params: { sessionId: ids.session, clubId: ids.leaderClub },
    overrides: { "voting.room": { ...records.roomSnapshot, undo: { requestId: "r1", applicationId: records.roomSnapshot.history[0]!.candidates[0]!.applicationId, passNumber: 1, choice: "ACCEPT", nextApplicationId: null, withoutVote: false, decidedBy: null } } }, expect: [/./] },
  { name: "voting: member already joined", file: "voting/[sessionId]", params: { sessionId: ids.session, clubId: ids.leaderClub, view: "member" },
    overrides: { "voting.joinInfo": { status: "JOINED", meeting: null }, "voting.room": { ...records.roomSnapshot, permissions: { ...records.roomSnapshot.permissions, leader: false } } }, expect: [/./] },
  { name: "explore: directory refusal sent as data", file: "(tabs)/explore", overrides: { "explore.directory": { clubs: [], error: "We couldn’t load the club directory. Please try again." } }, expect: ["We couldn’t load the club directory. Please try again."] },
  { name: "club: you are a member", file: "club/[id]", params: { id: ids.memberClub }, overrides: { club: { club: { ...records.fullClub, id: ids.memberClub } } }, expect: [/./] },
  { name: "club: refusal sent as data", file: "club/[id]", params: { id: ids.applyClub }, overrides: { club: { club: null, error: "We couldn’t load this club. Please try again." } }, expect: [/couldn’t load this club|no longer available/] },
  { name: "club: closed recruitment, no marketing", file: "club/[id]", params: { id: ids.applyClub }, overrides: { me: { ...records.me, applications: [] }, club: { club: { ...records.fullClub, marketing: null, applicationAvailable: false, applicationDeadline: null, rounds: [], publicEvents: [], requirements: [] } } }, expect: [/./] },
  { name: "leader tools: membership without permissions", file: "leader/[clubId]/index", params: { clubId: ids.memberClub }, overrides: {}, expect: ["No leader tools here"] },
  { name: "leader tools: alumni membership", file: "leader/[clubId]/index", params: { clubId: ids.alumniClub }, overrides: {}, expect: ["No leader tools here"] },
  { name: "leader tools: `me` refused shows an error, not “no tools”", file: "leader/[clubId]/index", params: { clubId: ids.leaderClub },
    overrides: { me: () => { throw new ApiError(0, "OFFLINE", "You're offline. Check your connection and try again."); } }, expect: [/offline|Try again/i] },
  { name: "tasks: deep link to one task opens it", file: "tasks", params: { clubId: ids.memberClub, taskId: ids.task }, overrides: {}, expect: ["Tasks"],
    after: () => expect(routerState.router.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: "/task/[assignmentId]", params: expect.objectContaining({ assignmentId: ids.assignment }) })) },
  { name: "tasks: one club's workspace refused", file: "tasks", overrides: { "tasks.workspace": (input: unknown) => { if ((input as { clubId: string }).clubId === ids.leaderClub) throw new ApiError(403, "FORBIDDEN", "No access"); return workspace(input); } }, expect: ["Tasks"] },
  { name: "task: project with child tasks and feedback", file: "task/[assignmentId]", params: { assignmentId: ids.projectAssignment, clubId: ids.memberClub }, overrides: {}, expect: ["Spring build project", "Related tasks"] },
  { name: "task: revision requested", file: "task/[assignmentId]", params: { assignmentId: ids.childAssignment, clubId: ids.memberClub }, overrides: {}, expect: ["Order parts"] },
  { name: "task: alumni account", file: "task/[assignmentId]", params: { assignmentId: ids.assignment }, overrides: { me: { ...alumniMe, memberships: [records.memberMembership, records.alumniMembership] } }, expect: [/./] },
  { name: "my club: leader membership", file: "my-club/[clubId]", params: { clubId: ids.leaderClub }, overrides: {}, expect: [/./] },
  { name: "my club: alumni membership", file: "my-club/[clubId]", params: { clubId: ids.alumniClub }, overrides: {}, expect: ["Cavalier Investment Club"] },
  { name: "inbox: opened at ?tab=preferences", file: "(tabs)/inbox", params: { tab: "preferences" }, overrides: {}, expect: [/Club announcements|Notification settings/] },
  { name: "inbox: more pages", file: "(tabs)/inbox", overrides: { inbox: (input: unknown) => ({ ...(fixtureSets.rich.inbox as object), nextCursor: (input as { cursor?: string } | undefined)?.cursor ? null : ids.inbox(12) }) }, expect: ["Inbox"] },
  { name: "inbox: alumni banner", file: "(tabs)/inbox", overrides: { me: alumniMe }, expect: ["Inbox"] },
  { name: "calendar: filtered by type", file: "(tabs)/calendar", params: { type: "interview" }, overrides: {}, expect: ["Calendar"] },
  { name: "calendar: an unknown type param", file: "(tabs)/calendar", params: { type: "nonsense" }, overrides: {}, expect: ["Calendar"] },
  { name: "profile: full profile with scholar status and scores", file: "(tabs)/profile",
    overrides: { profile: { profile: { ...(fixtureSets.rich.profile as { profile: object }).profile, scholarStatus: { selections: ["Jefferson Scholar"], other: "" }, satScore: 1500, actScore: 34, gpa: 3.9, pronouns: "they/them", highSchool: "A High School", phone: null } } }, expect: [/Jefferson Scholar/] },
  { name: "profile: alumni account", file: "(tabs)/profile", overrides: { me: alumniMe }, expect: [/./] },
  { name: "settings: password account, no deletion pending", file: "settings/account",
    overrides: { "account.deletion": { pending: null, warnings: [] } }, expect: ["Delete account"] },
  { name: "events: a full event, RSVP closed", file: "events/[id]", params: { id: ids.event }, overrides: { "events.event": { ...records.campusEvent(1), rsvpCount: 150, rsvpDeadline: at(-1) }, "events.rsvp": { going: false } }, expect: [/Spring showcase/] },
  { name: "events: no RSVP, all-day, no location", file: "events/[id]", params: { id: ids.event }, overrides: { "events.event": { ...records.campusEvent(3), location: "", contact: "", description: "" } }, expect: [/All day/] },
  { name: "meeting: past meeting with recap", file: "meeting/[id]", params: { id: ids.meeting }, overrides: { "meetings.meeting": records.meeting(ids.meeting, ids.memberClub, -2, { recap: "We built the car." }) }, expect: ["We built the car."] },
];

describe("variants", () => {
  for (const variant of variants) {
    (variant.failing ? test.failing : test)(variant.failing ? `${variant.name} (known app bug: ${variant.failing})` : variant.name, async () => {
      const Screen = require(`~/app/${variant.file}`).default;
      const { screen } = await renderRoute(Screen, { mode: "rich", params: variant.params, overrides: variant.overrides });
      const text = screenText(screen.toJSON());
      if (process.env.DUMP) process.stdout.write(`\n--- ${variant.name}\n${text}\n`);
      expect(missingFixtures()).toEqual([]);
      for (const expected of variant.expect) {
        if (!(typeof expected === "string" ? text.includes(expected) : expected.test(text))) throw new Error(`Expected ${String(expected)} in “${variant.name}”`);
      }
      variant.after?.();
      expect(loggedCrashes()).toEqual([]);
    });
  }
});
