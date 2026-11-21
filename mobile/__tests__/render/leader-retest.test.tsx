/**
 * The Nov 21 leader retest: a slow poll keeps the voting room, a failed refresh keeps interview day,
 * Announce and Start voting follow the web's permission rules, and the leader entries, gates and
 * stale-message fixes around them.
 */
import { act, fireEvent, screen } from "@testing-library/react-native";
import { interviewClock } from "~/components/leader/interviews";
import { ApiError, TIMEOUT_MESSAGE } from "~/lib/api";
import type { Me, Membership } from "~/lib/types";
import { ids, records } from "./fixtures";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute, settle } from "./harness";
import { routerState } from "./router-state";

beforeEach(captureConsole);
afterEach(releaseConsole);

const DAY = 86_400_000;
const at = (days: number) => new Date(Date.now() + days * DAY).toISOString();
/** The account with one non-owner membership in the leader club holding exactly these permissions. */
const leaderWith = (permissions: string[], extra: Partial<Me> = {}): Me => {
  const membership: Membership = { ...records.leaderMembership, isOwner: false, accessRole: "ADMIN", permissions };
  return { ...records.me, memberships: [membership, records.memberMembership], adminRoles: [membership], ...extra };
};
/** A read that answers once, then fails the way `failure` says. */
const thenFail = (value: unknown, failure: () => Error) => { let calls = 0; return () => { calls += 1; if (calls > 1) throw failure(); return value; }; };

describe("live voting room", () => {
  const room = (overrides: Record<string, unknown>) => renderRoute(require("~/app/voting/[sessionId]").default, { params: { sessionId: ids.session, clubId: ids.leaderClub }, overrides });

  test.each([
    ["a timed-out poll", () => new ApiError(0, "TIMEOUT", TIMEOUT_MESSAGE)],
    ["a rate-limited poll", () => new ApiError(429, "RATE_LIMITED", "Too many requests. Wait a moment and try again.")],
  ])("%s keeps the room and the host controls under a reconnecting notice", async (_name, failure) => {
    const { client } = await room({ "voting.room": thenFail(records.roomSnapshot, failure) });
    expect(screen.getByTestId("voting-host-controls")).toBeTruthy();
    await act(async () => { await client.refetchQueries(); });
    await settle(client);
    expect(screen.getByTestId("voting-reconnecting")).toBeTruthy();
    expect(screen.getByTestId("voting-host-controls")).toBeTruthy();
    expect(screen.queryByText("Voting room unavailable", { exact: false })).toBeNull();
    expect(loggedCrashes()).toEqual([]);
  });

  test("a refusal still clears the room, without a retry first", async () => {
    let calls = 0;
    const { client } = await room({ "voting.room": () => { calls += 1; if (calls > 1) throw new ApiError(403, "FORBIDDEN", "No access"); return records.roomSnapshot; } });
    await act(async () => { await client.refetchQueries(); });
    await settle(client);
    expect(calls).toBe(2);
    expect(screen.queryByTestId("voting-host-controls")).toBeNull();
    expect(screen.queryByTestId("voting-reconnecting")).toBeNull();
  });

  test("a threshold room that lost voters offers only Recount and close", async () => {
    await room({ "voting.room": { ...records.roomSnapshot, rule: { mode: "THRESHOLD", description: "Two thirds advance." }, electorateChange: { removed: 1 } } });
    expect(screen.queryByTestId("voting-close")).toBeNull();
    expect(screen.getByTestId("voting-recount-close")).toBeTruthy();
  });

  test("a majority room that lost voters keeps both ways to close", async () => {
    await room({ "voting.room": { ...records.roomSnapshot, electorateChange: { removed: 2 } } });
    expect(screen.getByTestId("voting-close")).toBeTruthy();
    expect(screen.getByTestId("voting-recount-close")).toBeTruthy();
  });

  test("finalized decisions hide Review held applicants", async () => {
    await room({ "voting.room": { ...records.roomSnapshot, status: "COMPLETED", currentApplicantId: null, finalizedAt: at(0) } });
    expect(screen.queryByTestId("voting-next-pass")).toBeNull();
  });
});

describe("interview day", () => {
  test("a failed background refresh keeps the schedule and the open notes", async () => {
    const rooms = (require("./fixtures").fixtureSets.rich["leader.interviewRooms"]) as unknown;
    const { client } = await renderRoute(require("~/app/leader/[clubId]/interviews").default, {
      params: { clubId: ids.leaderClub }, overrides: { "leader.interviewRooms": thenFail(rooms, () => new ApiError(0, "OFFLINE", "You're offline.")) },
    });
    await fireEvent.press(screen.getByTestId("interview-enter"));
    await settle(client);
    expect(screen.getByTestId("interview-notes")).toBeTruthy();
    await act(async () => { await client.refetchQueries({ queryKey: ["leader", "leader.interviewRooms"] }); });
    await settle(client);
    expect(screen.getByTestId("interview-refresh-failed")).toBeTruthy();
    expect(screen.getByTestId("interview-next")).toBeTruthy();
    expect(screen.getByTestId("interview-notes")).toBeTruthy();
    expect(screen.queryByText(/Couldn’t load your interviews/)).toBeNull();
  });

  test("an interview more than a day out shows its day, not a 49-hour countdown", () => {
    const start = Date.UTC(2026, 10, 25, 17);
    expect(interviewClock({ startTime: new Date(start).toISOString(), endTime: new Date(start + 1_800_000).toISOString() }, start - 49 * 3_600_000)).toMatchObject({ label: "Starts", digits: "Wed, Nov 25" });
    expect(interviewClock({ startTime: new Date(start).toISOString(), endTime: new Date(start + 1_800_000).toISOString() }, start - 3_600_000).digits).toBe("1:00:00");
  });
});

describe("announce", () => {
  const announce = (me: Me) => renderRoute(require("~/app/leader/[clubId]/announce").default, { params: { clubId: ids.leaderClub }, overrides: { me } });

  test("without identified-recipient access, only Members is offered", async () => {
    const { client } = await announce(leaderWith(["meetings.manage"]));
    expect(screen.queryByLabelText("Active applicants")).toBeNull();
    expect(screen.getByTestId("announce-members-only")).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("announce-title"), "Moved");
    await fireEvent.changeText(screen.getByTestId("announce-body"), "Rice 130");
    await fireEvent.press(screen.getByTestId("announce-review"));
    await settle(client);
    const { apiState } = require("./api-state");
    expect(apiState.calls.find((call: { operation: string }) => call.operation === "leader.announce.preview")?.input).toMatchObject({ audience: "MEMBERS" });
  });

  test("with applicants.identify and applications.review, Active applicants is offered", async () => {
    await announce(leaderWith(["meetings.manage", "applicants.identify", "applications.review"]));
    expect(screen.getByLabelText("Active applicants")).toBeTruthy();
  });

  test("Next on the title is wired to move on, keeping the keyboard up", async () => {
    await announce(records.me);
    // Refs to native inputs are null under Jest, so this checks the wiring, not the focus itself.
    const title = screen.getByTestId("announce-title");
    expect(title.props.returnKeyType).toBe("next");
    expect(title.props.submitBehavior).toBe("submit");
    await fireEvent(title, "submitEditing");
  });

  test("a failed pull keeps the recent announcements", async () => {
    const { client } = await renderRoute(require("~/app/leader/[clubId]/announce").default, {
      params: { clubId: ids.leaderClub }, overrides: { "leader.announcements": thenFail(require("./fixtures").fixtureSets.rich["leader.announcements"], () => new ApiError(0, "OFFLINE", "offline")) },
    });
    await act(async () => { await client.refetchQueries({ queryKey: ["leader", "leader.announcements"] }); });
    await settle(client);
    expect(screen.getByText("General meeting moved to Rice 130")).toBeTruthy();
  });
});

describe("live voting list", () => {
  const list = (me: Me) => renderRoute(require("~/app/leader/[clubId]/voting").default, { params: { clubId: ids.leaderClub }, overrides: { me } });

  test.each([["a voter", ["applications.review", "decisions.vote"]], ["an observer", ["applications.review", "decisions.view"]]])("Start voting session is hidden from %s", async (_name, permissions) => {
    await list(leaderWith(permissions));
    expect(screen.getByText(/Final deliberation for/)).toBeTruthy();
    expect(screen.queryByTestId("voting-start-web")).toBeNull();
  });

  test("Start voting session is offered with review, manage and start", async () => {
    await list(leaderWith(["applications.review", "decisions.manage", "decisions.start"]));
    expect(screen.getByTestId("voting-start-web")).toBeTruthy();
  });

  test("the page's name shows once, in the bar", async () => {
    await list(records.me);
    expect(screen.getAllByText("Live voting", { includeHiddenElements: true })).toHaveLength(1);
    expect(screen.queryByText("Voting room")).toBeNull();
  });
});

describe("leader hub", () => {
  const hub = (me: Me) => renderRoute(require("~/app/leader/[clubId]/index").default, { params: { clubId: ids.leaderClub }, overrides: { me } });

  test("a check-in-only role has no empty Run the club card", async () => {
    await hub(leaderWith(["meetings.attendance"]));
    expect(screen.getByText("Check-in")).toBeTruthy();
    expect(screen.queryByText("Run the club")).toBeNull();
    expect(screen.queryByText("Recruiting settings and application builder")).toBeNull();
  });

  test("a graduate whose membership is still current gets no tools", async () => {
    await hub({ ...records.me, profile: { ...records.me.profile!, graduatedAt: at(-1) } });
    expect(screen.getByText("No leader tools here")).toBeTruthy();
  });

  test("the next meeting opens its page", async () => {
    await hub(records.me);
    await fireEvent.press(screen.getByTestId("leader-next-meeting"));
    expect(routerState.router.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: "/meeting/[id]" }));
  });
});

describe("leader entries", () => {
  test("My club offers Leader tools to a leader", async () => {
    await renderRoute(require("~/app/my-club/[clubId]").default, { params: { clubId: ids.leaderClub } });
    await fireEvent.press(screen.getByTestId("my-club-leader-tools"));
    expect(routerState.router.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: "/leader/[clubId]", params: { clubId: ids.leaderClub } }));
  });

  test("My club offers no Leader tools to a plain member", async () => {
    await renderRoute(require("~/app/my-club/[clubId]").default, { params: { clubId: ids.memberClub } });
    expect(screen.queryByTestId("my-club-leader-tools")).toBeNull();
  });

  test("the meeting page lets a leader host check-in while attendance is open", async () => {
    await renderRoute(require("~/app/meeting/[id]").default, { params: { id: ids.meeting }, overrides: { "meetings.meeting": records.meeting(ids.meeting, ids.leaderClub, 0.02) } });
    await fireEvent.press(screen.getByTestId("meeting-host-check-in"));
    expect(routerState.router.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: "/leader/[clubId]/check-in/[meetingId]", params: { clubId: ids.leaderClub, meetingId: ids.meeting } }));
    expect(screen.getByTestId("meeting-scan")).toBeTruthy();
  });

  test("a member's meeting page has no host button", async () => {
    await renderRoute(require("~/app/meeting/[id]").default, { params: { id: ids.meeting } });
    expect(screen.queryByTestId("meeting-host-check-in")).toBeNull();
  });
});

describe("check-in host", () => {
  test("a timed-out code reads as reconnecting, not as check-in closed", async () => {
    await renderRoute(require("~/app/leader/[clubId]/check-in/[meetingId]").default, {
      params: { clubId: ids.leaderClub, meetingId: ids.meeting }, overrides: { "meetings.checkIn.issue": () => { throw new ApiError(0, "TIMEOUT", TIMEOUT_MESSAGE); } },
    });
    expect(await screen.findByText("Reconnecting…", {}, { timeout: 5000 })).toBeTruthy();
    expect(screen.queryByText("Check-in isn't available")).toBeNull();
  });
});
