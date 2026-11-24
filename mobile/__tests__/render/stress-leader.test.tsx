/**
 * Leader tools stress audit (Nov 24): scale, double taps, polling, conflicts, malformed codes and
 * refusals. Tests named "L<n>" demonstrate a finding and FAIL until it is fixed; the rest are
 * stress checks that pass today and guard the behavior.
 */
import { act, fireEvent, screen } from "@testing-library/react-native";
import type { InterviewEntry } from "~/components/leader/interviews";
import { interviewClock, interviewDay, timeRange } from "~/components/leader/interviews";
import { ApiError, api } from "~/lib/api";
import { classifyScan, redeemShortLink } from "~/lib/scan";
import type { Me, Membership } from "~/lib/types";
import { apiState, resolveFixture } from "./api-state";
import { ids, records } from "./fixtures";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute, settle } from "./harness";

beforeEach(captureConsole);
afterEach(releaseConsole);

const wait = (ms: number) => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)); });
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const calls = (operation: string) => apiState.calls.filter(call => call.operation === operation);
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
/** Swap api.post / api.get for one test, restoring the harness's fixture resolver afterwards. */
function intercept(method: "get" | "post", handler: (operation: string, input: unknown, fallback: () => Promise<unknown>) => Promise<unknown> | undefined) {
  const mock = api[method] as unknown as jest.Mock;
  const original = mock.getMockImplementation()!;
  mock.mockImplementation((operation: string, input?: unknown) => handler(operation, input, () => resolveFixture(method === "get" ? "GET" : "POST", operation, input)) ?? resolveFixture(method === "get" ? "GET" : "POST", operation, input));
  return () => mock.mockImplementation(original);
}
const leaderWith = (permissions: string[]): Me => {
  const membership: Membership = { ...records.leaderMembership, isOwner: false, accessRole: "MEMBER", role: "MEMBER", permissions };
  return { ...records.me, memberships: [membership, records.memberMembership], adminRoles: [] };
};

// ---- Applicants ------------------------------------------------------------------------------
type Applicant = { id: string; studentId: string; roundId: string; status: string; student: { email: string; studentProfile: { firstName: string; lastName: string; major: string | null; academicYear: string | null; headshotUrl: null } | null }; roundScore: null };
const applicant = (n: number): Applicant => ({ id: uuid(20_000 + n), studentId: `s${n}`, roundId: ids.round, status: "SUBMITTED", student: { email: `s${n}@virginia.edu`, studentProfile: { firstName: `First${n}`, lastName: `Last${n}`, major: "Physics", academicYear: "Second year", headshotUrl: null } }, roundScore: null });
const TOTAL = 1000, PAGE = 100;
/** The server's pagePipeline for 1,000 applicants, 100 a page (lib/pipeline-page.ts), including its `reset` when the cursor's anchor left the selection. */
function pipeline(options: { anchorGone?: boolean; nextFails?: boolean } = {}) {
  return (input: unknown) => {
    const cursor = (input as { query: { cursor?: { id: string } } }).query.cursor;
    if (cursor && options.nextFails) throw new ApiError(400, "INVALID_REQUEST", "That request was not understood.");
    const anchor = cursor ? Array.from({ length: TOTAL }, (_, i) => applicant(i).id).indexOf(cursor.id) : -1;
    const reset = !!cursor && (anchor < 0 || !!options.anchorGone);
    const start = reset || anchor < 0 ? 0 : anchor + 1;
    const applications = Array.from({ length: Math.min(PAGE, TOTAL - start) }, (_, i) => applicant(start + i));
    return {
      rounds: [{ id: ids.round, name: "Written application" }], applications, profileFields: { major: true, academicYear: true, photo: false },
      page: { total: TOTAL, baseTotal: TOTAL, start, reset, next: start + applications.length < TOTAL ? { id: applications.at(-1)!.id, direction: "after", scope: "s" } : null },
    };
  };
}
const applicantsScreen = (overrides: Record<string, unknown>) => renderRoute(require("~/app/leader/[clubId]/applicants").default, { params: { clubId: ids.leaderClub }, overrides });
const pageKey = ["leader", "leader.pipelinePage", ids.leaderClub, null, ""];
const loadedIds = (client: { getQueryData: (key: unknown[]) => unknown }) => ((client.getQueryData(pageKey) as { pages: { applications: Applicant[] }[] } | undefined)?.pages ?? []).flatMap(page => page.applications.map(app => app.id));
async function endReached(client: Parameters<typeof settle>[0]) {
  await act(async () => { fireEvent(screen.getByTestId("applicants-screen"), "onEndReached"); });
  await settle(client);
}

describe("applicants at scale", () => {
  test("1,000 applicants: the count is the server's and the list is virtualized (not every row rendered)", async () => {
    const started = Date.now();
    await applicantsScreen({ "leader.pipelinePage": pipeline() });
    expect(screen.getByTestId("applicants-total").props.children.join("")).toBe("1000 applicants");
    const rendered = screen.queryAllByTestId(/^applicant-/).length;
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(PAGE);
    expect(Date.now() - started).toBeLessThan(5000);
    expect(loggedCrashes()).toEqual([]);
  });

  test("paging follows the server's cursor: 10 pages, 1,000 distinct applicants", async () => {
    const { client } = await applicantsScreen({ "leader.pipelinePage": pipeline() });
    for (let page = 1; page < 10; page += 1) await endReached(client);
    const loaded = loadedIds(client);
    expect(loaded).toHaveLength(TOTAL);
    expect(new Set(loaded).size).toBe(TOTAL);
    await endReached(client); // nothing more: no 11th request
    expect(calls("leader.pipelinePage")).toHaveLength(10);
  });

  test("typing a search sends one request for the settled text (350 ms debounce)", async () => {
    await applicantsScreen({ "leader.pipelinePage": pipeline() });
    const before = calls("leader.pipelinePage").length;
    for (const text of ["P", "Ph", "Phy", "Phys", "Physi"]) await fireEvent.changeText(screen.getByTestId("applicants-search"), text);
    await wait(500);
    const sent = calls("leader.pipelinePage").slice(before).map(call => (call.input as { query: { query: string } }).query.query);
    expect(sent).toEqual(["Physi"]);
  });

  // L1: the server answers a cursor whose anchor left the selection (an applicant rejected or moved by another
  // leader, or a refetch with a stored cursor) with the FIRST page again and `page.reset: true`
  // (lib/pipeline-page.ts pagePipeline). The app ignores `reset` and appends it: the list repeats applicants.
  test("L1 a reset page is not appended as more applicants (no duplicate rows)", async () => {
    const { client } = await applicantsScreen({ "leader.pipelinePage": pipeline({ anchorGone: true }) });
    await endReached(client);
    const loaded = loadedIds(client);
    expect(new Set(loaded).size).toBe(loaded.length);
  });

  // L2: a failed next page (400 for a changed cursor scope, offline, 429) leaves no error, no Retry, nothing.
  test("L2 a failed next page says so and offers Retry", async () => {
    const { client } = await applicantsScreen({ "leader.pipelinePage": pipeline({ nextFails: true }) });
    await endReached(client);
    expect(calls("leader.pipelinePage").length).toBe(2);
    expect(screen.queryAllByText(/Retry|Try again|Couldn.t load/i).length).toBeGreaterThan(0);
  });

  // L3: after the server refuses this leader (role removed, 403) the applicants already on screen stay, with no notice.
  test("L3 a refusal on refresh clears applicant rows instead of leaving them on screen", async () => {
    const { client } = await applicantsScreen({});
    expect(screen.getByText("Maximiliana-Alexandria Montgomery-Vanderbilt de la Cruz")).toBeTruthy();
    apiState.overrides = { "leader.pipelinePage": () => { throw new ApiError(403, "FORBIDDEN", "You don't have access to applicants."); } };
    await act(async () => { await client.refetchQueries({ queryKey: ["leader", "leader.pipelinePage"] }); });
    await settle(client);
    expect(screen.queryByText("Maximiliana-Alexandria Montgomery-Vanderbilt de la Cruz")).toBeNull();
  });
});

// ---- Interview day ---------------------------------------------------------------------------
const MIN = 60_000;
const entry = (n: number, startOffsetMin: number, extra: Partial<InterviewEntry> = {}): InterviewEntry => ({
  id: uuid(30_000 + n), slotId: uuid(31_000 + n), roomId: ids.room, bookingId: uuid(32_000 + n), clubId: ids.leaderClub, roundId: ids.round, roundName: "Interviews", roomName: "Room B",
  location: "Rice 242", timezone: "America/New_York", startTime: new Date(Date.now() + startOffsetMin * MIN).toISOString(), endTime: new Date(Date.now() + (startOffsetMin + 10) * MIN).toISOString(),
  applicationId: uuid(33_000 + n), candidate: `Candidate ${n}`, interviewers: [], completed: false, started: false, cancelled: false, canOpen: true, ...extra,
});
const interviews = (rows: InterviewEntry[]) => renderRoute(require("~/app/leader/[clubId]/interviews").default, { params: { clubId: ids.leaderClub }, overrides: { "leader.interviewRooms": rows } });
const notesField = () => screen.getByTestId("interview-notes-field");

describe("interview day", () => {
  test("100 interviews: one focus card, every booked one listed once", async () => {
    // Inside the current Eastern day: 100 back-to-back starting 5 minutes ago (each 10 minutes; some spill past midnight near its end).
    const rows = Array.from({ length: 100 }, (_, i) => entry(i, -5 + i * 0.1));
    const day = interviewDay(rows, Date.now());
    expect(day.next?.id).toBe(rows[0]!.id);
    expect(day.booked.length + day.later.length).toBe(100);
    await interviews(rows);
    expect(screen.getAllByTestId("interview-next")).toHaveLength(1);
    expect(loggedCrashes()).toEqual([]);
  });

  test("the countdown is absolute: Eastern DST end (Nov 1 2026) neither adds nor loses an hour", () => {
    const start = Date.UTC(2026, 10, 1, 6, 30); // 1:30 AM EST, after clocks fell back from 2:00 EDT
    const row = { startTime: new Date(start).toISOString(), endTime: new Date(start + 30 * MIN).toISOString() };
    expect(timeRange(row)).toBe("1:30–2:00 AM");
    expect(interviewClock(row, start - 90 * MIN).digits).toBe("1:30:00"); // 90 real minutes, across the repeated hour
    expect(interviewClock(row, start + 29 * MIN + 30_000)).toMatchObject({ phase: "during", digits: "00:30" });
    expect(interviewClock(row, start + 31 * MIN)).toMatchObject({ phase: "after", label: "Time’s up" });
  });

  // L4: every row builds new Intl.DateTimeFormat objects on every render, and the whole screen re-renders every second.
  test("L4 the 1 s tick does not rebuild date formatters for every interview row", async () => {
    await interviews(Array.from({ length: 100 }, (_, i) => entry(i, -5 + i * 0.1)));
    const Original = Intl.DateTimeFormat;
    let built = 0;
    const spy = jest.spyOn(Intl, "DateTimeFormat").mockImplementation(((...args: ConstructorParameters<typeof Intl.DateTimeFormat>) => { built += 1; return new Original(...args); }) as never);
    try {
      await wait(1100); // one tick of the countdown
    } finally { spy.mockRestore(); }
    expect(built).toBeLessThan(20);
  });

  test("a 20,000-character note is saved whole against its revision", async () => {
    const { client } = await interviews([entry(1, -5)]);
    await fireEvent.press(screen.getByTestId("interview-enter"));
    await settle(client);
    const long = "n".repeat(20_000);
    await fireEvent.changeText(notesField(), long);
    expect(notesField().props.maxLength).toBe(20_000);
    await wait(1700);
    const saves = calls("leader.interviewSession.save");
    expect(saves).toHaveLength(1);
    expect(saves[0]!.input).toMatchObject({ revision: 1, draft: { additionalNotes: long } });
    expect(screen.getByTestId("interview-save-status").props.children).toBe("All changes saved");
  });

  // L5: text typed while an autosave is in flight is dropped when the notes close (row tapped, Back) before the save returns.
  test("L5 notes typed during an in-flight save are still saved when the editor closes", async () => {
    const row = entry(1, -5);
    const { client } = await interviews([row]);
    await fireEvent.press(screen.getByTestId("interview-enter"));
    await settle(client);
    const held = deferred<unknown>();
    const post = api.post as unknown as jest.Mock;
    const already = post.mock.calls.length;
    let first = true;
    const restore = intercept("post", (operation, _input, fallback) => {
      if (operation !== "leader.interviewSession.save") return undefined;
      if (first) { first = false; return held.promise; }
      return fallback();
    });
    try {
      await fireEvent.changeText(notesField(), "Strong answer on the budget question.");
      await wait(1700); // the autosave starts and waits on the network
      await fireEvent.changeText(notesField(), "Strong answer on the budget question. Asked about the spring build.");
      await fireEvent.press(screen.getByTestId(`interview-row-${row.id}`)); // closes the notes
      expect(screen.queryByTestId("interview-notes")).toBeNull();
      await act(async () => { held.resolve({ session: { id: uuid(1400), revision: 2, draft: { overallReview: "", additionalNotes: "Strong answer on the budget question." }, completedAt: null } }); });
      await wait(50);
    } finally { restore(); }
    const texts = post.mock.calls.slice(already).filter(([operation]) => operation === "leader.interviewSession.save").map(([, input]) => (input as { draft: { additionalNotes: string } }).draft.additionalNotes);
    expect(texts).toContain("Strong answer on the budget question. Asked about the spring build.");
  });

  test("a revision conflict stops saving and locks the field until Reload", async () => {
    const { client } = await interviews([entry(1, -5)]);
    await fireEvent.press(screen.getByTestId("interview-enter"));
    await settle(client);
    apiState.overrides = { ...apiState.overrides, "leader.interviewSession.save": () => { throw new ApiError(409, "STALE", "A newer draft exists. Reload before saving."); } };
    await fireEvent.changeText(notesField(), "Phone notes");
    await wait(1700);
    expect(screen.getByTestId("interview-save-message").props.children).toBe("A newer draft exists. Reload before saving.");
    expect(screen.getByTestId("interview-reload")).toBeTruthy();
    expect(notesField().props.editable).toBe(false);
    await wait(1700);
    expect(calls("leader.interviewSession.save")).toHaveLength(1); // no retry loop against the newer draft
  });

  // L6: Reload after a conflict replaces the field with the server's draft; what was typed on the phone is gone
  // (the web room keeps a recovery copy: components/interview-kit-session.tsx useInterviewOfflineNotes).
  test("L6 Reload after a conflict keeps the phone's unsaved notes somewhere the interviewer can copy them", async () => {
    const { client } = await interviews([entry(1, -5)]);
    await fireEvent.press(screen.getByTestId("interview-enter"));
    await settle(client);
    apiState.overrides = {
      ...apiState.overrides,
      "leader.interviewSession.save": () => { throw new ApiError(409, "STALE", "A newer draft exists. Reload before saving."); },
      "leader.interviewSession.open": { id: uuid(1400), revision: 5, draft: { overallReview: "", additionalNotes: "Web notes" }, completedAt: null },
    };
    await fireEvent.changeText(notesField(), "Phone-only notes about the candidate");
    await wait(1700);
    await fireEvent.press(screen.getByTestId("interview-reload"));
    await settle(client);
    expect(notesField().props.value).toBe("Web notes");
    expect(screen.queryAllByText(/Phone-only notes about the candidate/).length + (String(notesField().props.value).includes("Phone-only") ? 1 : 0)).toBeGreaterThan(0);
  });

  // L3 (interview day): a refusal (access removed) keeps every candidate's name under "Couldn't refresh".
  test("L3 a refused refresh does not keep candidates' names on screen", async () => {
    const { client } = await interviews([entry(1, -5), entry(2, 20)]);
    expect(screen.getAllByText("Candidate 1").length).toBeGreaterThan(0);
    apiState.overrides = { "leader.interviewRooms": () => { throw new ApiError(403, "REFUSED", "This is not available."); } };
    await act(async () => { await client.refetchQueries({ queryKey: ["leader", "leader.interviewRooms"] }); });
    await settle(client);
    expect(screen.queryAllByText("Candidate 1")).toHaveLength(0);
  });
});

// ---- Live voting -----------------------------------------------------------------------------
const bigRoom = () => {
  const candidates = Array.from({ length: 150 }, (_, i) => ({ applicationId: uuid(40_000 + i), position: i, ballotState: i < 10 ? "CONFIRMED" : i === 10 ? "PENDING" : "PENDING", outcome: i < 10 ? "ACCEPT" : "UNREVIEWED", ownBallot: null, ...(i < 10 ? { totals: { ACCEPT: 30, HOLD: 5, REJECT: 5 } } : {}) }));
  return {
    ...records.roomSnapshot, currentApplicantId: uuid(40_010), participation: { voted: 0, eligible: 40 },
    outcomes: candidates.map(c => ({ applicationId: c.applicationId, passNumber: 1, outcome: c.outcome })),
    history: [{ number: 1, status: "OPEN", candidates }],
    joinedParticipants: Array.from({ length: 40 }, (_, i) => ({ id: `p${i}`, label: `Voter ${i}`, joined: i % 3 !== 0 })),
  };
};
const room = (snapshot: unknown, extra: Record<string, unknown> = {}) => renderRoute(require("~/app/voting/[sessionId]").default, { params: { sessionId: ids.session, clubId: ids.leaderClub, ...extra }, overrides: { "voting.room": snapshot } });

describe("live voting at scale", () => {
  test("150 applicants and 40 voters: the queue lists all, In the room collapses past 8", async () => {
    const started = Date.now();
    await room(bigRoom());
    expect(screen.getAllByText("Applicant 11 of 150").length).toBeGreaterThan(0);
    expect(screen.getByText("26 members joined of 40 who can vote")).toBeTruthy();
    expect(screen.getByText("Show all 40")).toBeTruthy();
    expect(screen.getByText("150 · Applicant 150")).toBeTruthy();
    expect(Date.now() - started).toBeLessThan(5000);
    expect(loggedCrashes()).toEqual([]);
  });

  test("double-tapping Open voting sends one command", async () => {
    const { client } = await room(bigRoom());
    const before = calls("voting.command").length;
    const open = screen.getByTestId("voting-open");
    await fireEvent.press(open);
    await fireEvent.press(open);
    await settle(client);
    const sent = calls("voting.command").slice(before);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.input).toMatchObject({ action: "OPEN_VOTING", revision: 12 });
  });

  test("double-tapping a ballot choice casts one vote", async () => {
    const { client } = await room({ ...records.roomSnapshot, permissions: { ...records.roomSnapshot.permissions, leader: false } });
    const pass = screen.getByTestId("voting-choice-accept");
    await fireEvent.press(pass);
    await fireEvent.press(pass);
    await settle(client);
    expect(calls("voting.ballot")).toHaveLength(1);
  });

  test("a slow command keeps every host control locked until the server answers", async () => {
    const { client } = await room(bigRoom());
    const held = deferred<unknown>();
    const post = api.post as unknown as jest.Mock;
    const already = post.mock.calls.length;
    const restore = intercept("post", operation => operation === "voting.command" ? held.promise : undefined);
    try {
      await fireEvent.press(screen.getByTestId("voting-open"));
      expect(screen.getByTestId("voting-open").props.accessibilityState).toMatchObject({ disabled: true });
      await fireEvent.press(screen.getByTestId("voting-open"));
      await act(async () => { held.resolve({ ok: true, result: { revision: 13 } }); });
    } finally { restore(); }
    await settle(client);
    expect(post.mock.calls.slice(already).filter(([operation]) => operation === "voting.command")).toHaveLength(1);
  });
});

// ---- Check-in: host and door -----------------------------------------------------------------
describe("check-in host", () => {
  const host = (extra: Record<string, unknown> = {}) => renderRoute(require("~/app/leader/[clubId]/check-in/[meetingId]").default, { params: { clubId: ids.leaderClub, meetingId: ids.meeting }, overrides: extra });

  test("300 members checked in shows 300", async () => {
    await host({ "meetings.attendance": Array.from({ length: 300 }, (_, i) => ({ id: `a${i}`, checkedInAt: new Date().toISOString(), name: `Member ${i}` })) });
    expect(screen.getByTestId("host-count").props.children).toBe(300);
  });

  test("double-tapping Close check-in closes once", async () => {
    const { client } = await host();
    // The confirm sheet answers its earlier question "no" when asked again, so only one close can follow.
    await fireEvent.press(screen.getByTestId("host-close"));
    await fireEvent.press(screen.getByTestId("host-close"));
    const accept = screen.getByTestId("confirm-accept");
    await fireEvent.press(accept);
    await fireEvent.press(accept);
    await settle(client);
    expect(calls("meetings.checkIn.close")).toHaveLength(1);
  });

  // L7: host mode keeps polling attendance every 4 s (and issuing codes every 60 s, at full brightness and awake)
  // while another screen covers it, e.g. a tapped push or the Scan quick action pushed over it.
  test("L7 host mode stops polling while another screen covers it", async () => {
    const router = jest.requireMock<{ useIsFocused: () => boolean }>("expo-router");
    const focused = jest.spyOn(router, "useIsFocused").mockReturnValue(false);
    try {
      await host();
      const before = calls("meetings.attendance").length;
      await wait(4500);
      expect(calls("meetings.attendance").length).toBe(before);
    } finally { focused.mockRestore(); }
  });
});

describe("scanner and short links", () => {
  test.each([
    ["javascript: URL", "javascript:alert(document.cookie)//out-class.net/q/abc"],
    ["another site", "https://evil.example/q/abc123"],
    ["look-alike host", "https://out-class.net.evil.example/q/abc123"],
    ["userinfo trick", "https://out-class.net@evil.example/q/abc123"],
    ["data URL", "data:text/html,<script>1</script>"],
    ["code too long", `https://out-class.net/q/${"a".repeat(33)}`],
    ["bad characters", "https://out-class.net/q/abc%2F..%2F"],
    ["extra path", "https://out-class.net/q/abc/def"],
    ["very long text", "x".repeat(1_000_000)],
    ["plain text", "OutClass check-in"],
  ])("%s is declined without a request", (_name, text) => {
    expect(classifyScan(text)).toEqual({ kind: "other" });
  });

  test("a first-party link is accepted, case-insensitive host, query and trailing slash ignored", () => {
    expect(classifyScan(" https://OUT-CLASS.NET/q/Ab_9-z/?utm=x ")).toEqual({ kind: "short-link", code: "Ab_9-z" });
  });

  test("scanning the same check-in code twice: checked in, then already checked in", async () => {
    let checkedIn: string | null = null;
    apiState.overrides = {
      "shortLinks.resolve": { status: "valid", target: `/check-in?meetingId=${ids.meeting}#token=${"a".repeat(64)}` },
      "meetings.checkIn": () => { const first = !checkedIn; checkedIn ??= new Date().toISOString(); return { status: first ? "checked-in" : "already-checked-in", checkedInAt: checkedIn }; },
    };
    await expect(redeemShortLink("abc123")).resolves.toMatchObject({ kind: "check-in", outcome: { status: "checked-in" } });
    await expect(redeemShortLink("abc123")).resolves.toMatchObject({ kind: "check-in", outcome: { status: "already-checked-in" } });
  });

  test("a malformed /q deep link is answered on the phone without asking the server", async () => {
    await renderRoute(require("~/app/q/[code]").default, { params: { code: "<script>" } });
    expect(screen.getByText("This code isn't available")).toBeTruthy();
    expect(calls("shortLinks.resolve")).toHaveLength(0);
  });

  test("a rate-limited scan says so and can scan again", async () => {
    await renderRoute(require("~/app/q/[code]").default, { params: { code: "abc123" }, overrides: { "shortLinks.resolve": () => { throw new ApiError(429, "RATE_LIMITED", "Too many requests. Wait a moment and try again."); } } });
    expect(screen.getByText("Too many requests. Wait a moment and try again.")).toBeTruthy();
    expect(screen.getByTestId("scan-again")).toBeTruthy();
  });
});

// ---- Announce --------------------------------------------------------------------------------
describe("announce", () => {
  const announce = (me: Me = records.me) => renderRoute(require("~/app/leader/[clubId]/announce").default, { params: { clubId: ids.leaderClub }, overrides: { me } });

  test("publishing twice (double tap, or retry after a lost answer) reuses one request key", async () => {
    const { client } = await announce();
    await fireEvent.changeText(screen.getByTestId("announce-title"), "Moved");
    await fireEvent.changeText(screen.getByTestId("announce-body"), "Rice 130");
    await fireEvent.press(screen.getByTestId("announce-review"));
    await settle(client);
    const publish = screen.getByTestId("announce-publish");
    await fireEvent.press(publish);
    await fireEvent.press(publish);
    await settle(client);
    const keys = calls("leader.announce").map(call => (call.input as { requestKey: string }).requestKey);
    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(1);
    expect(screen.getByTestId("announce-done")).toBeTruthy();
  });

  test("a 429 on publish keeps the draft and the same key for the retry", async () => {
    const { client } = await announce();
    await fireEvent.changeText(screen.getByTestId("announce-title"), "Moved");
    await fireEvent.changeText(screen.getByTestId("announce-body"), "Rice 130");
    apiState.overrides = { ...apiState.overrides, "leader.announce": () => { throw new ApiError(429, "RATE_LIMITED", "Too many requests. Wait a moment and try again."); } };
    await fireEvent.press(screen.getByTestId("announce-review"));
    await settle(client);
    await fireEvent.press(screen.getByTestId("announce-publish"));
    await settle(client);
    expect(screen.getByText("Too many requests. Wait a moment and try again.")).toBeTruthy();
    expect(screen.getByTestId("announce-title").props.value).toBe("Moved");
  });

  // L8: opened by a link (or a stale screen) without meetings.manage, Announce offers the whole composer and only
  // refuses at "Publish announcement"; the hub and the server both say this role cannot announce.
  test("L8 a member without meetings.manage is told before writing, not after", async () => {
    await announce(leaderWith(["applications.review"]));
    expect(screen.queryByTestId("announce-title")).toBeNull();
  });
});
