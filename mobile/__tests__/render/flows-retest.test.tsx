/**
 * The Nov 21 student-flows retest: a failed background refresh keeps a loaded screen (and the task
 * being typed), tabs opened from a pushed screen get Back and "leave to" links return to the tabs
 * underneath, a stale task refusal keeps the student's text, Add to Calendar adds once, Delete
 * account asks first and checks second with the server's key, documents say when they can't open,
 * a one-club task list says so, and the pull-to-refresh spinner shows only for a pull.
 */
import { act, fireEvent, renderHook, screen } from "@testing-library/react-native";
import type { QueryClient } from "@tanstack/react-query";
import { ApiError, api } from "~/lib/api";
import { SHEET_CLOSE_MS } from "~/components/sheet";
import { easternRange } from "~/lib/eastern";
import { usePullRefresh } from "~/lib/pull-refresh";
import type { ApplicationsView, TaskWorkspace } from "~/lib/types";
import { apiState, resolveFixture } from "./api-state";
import { fixtureSets, ids, records } from "./fixtures";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute, settle } from "./harness";
import { routerState } from "./router-state";
import { session } from "./session";

jest.mock("~/components/applications/calendar", () => ({ addToCalendar: jest.fn() }));
jest.mock("~/components/private-image", () => ({ ...jest.requireActual("~/components/private-image"), openPrivateDocument: jest.fn() }));
const { addToCalendar } = jest.requireMock("~/components/applications/calendar") as { addToCalendar: jest.Mock };
const { openPrivateDocument } = jest.requireMock("~/components/private-image") as { openPrivateDocument: jest.Mock };

beforeEach(captureConsole);
afterEach(releaseConsole);

const wait = (ms: number) => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)); });
const offline = () => { throw new ApiError(0, "OFFLINE", "You're offline. Check your connection and try again."); };
/** A promise the test settles by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
/** The workspace fixture, with the first task needing only a written response (so the form can submit). */
const textTask = (revision = 1) => (input: unknown) => {
  const workspace = (fixtureSets.rich["tasks.workspace"] as (input: unknown) => TaskWorkspace)(input);
  workspace.tasks[0] = { ...workspace.tasks[0]!, requirements: ["TEXT"], assignments: workspace.tasks[0]!.assignments.map(item => ({ ...item, revision })) };
  return workspace;
};
const refreshing = (testID: string) => !!screen.getByTestId(testID).props.refreshControl?.props.refreshing;
async function refetchAll(client: QueryClient, queryKey: readonly unknown[]) {
  await act(async () => { await client.refetchQueries({ queryKey }); });
  await settle(client);
}

describe("F1: a failed background refresh keeps the loaded screen", () => {
  test("task: the typed response stays and a caption says the refresh failed", async () => {
    const Screen = require("~/app/task/[assignmentId]").default;
    const { client } = await renderRoute(Screen, { params: { assignmentId: ids.assignment, clubId: ids.memberClub }, overrides: { "tasks.workspace": textTask() } });
    await fireEvent.changeText(screen.getByTestId("task-text"), "My half-written answer");
    apiState.overrides = { ...apiState.overrides, me: offline, "tasks.workspace": offline };
    await refetchAll(client, ["me"]);
    await refetchAll(client, ["tasks.workspace"]);
    expect(screen.getByTestId("task-text").props.value).toBe("My half-written answer");
    expect(screen.getByTestId("task-refresh-failed")).toBeTruthy();
    expect(screen.queryByText("You're offline")).toBeNull();
    expect(loggedCrashes()).toEqual([]);
  });

  test("tasks list: the rows stay", async () => {
    const Screen = require("~/app/tasks").default;
    const { client } = await renderRoute(Screen);
    const rows = screen.getAllByTestId(/^task-row-/).length;
    apiState.overrides = { me: offline };
    await refetchAll(client, ["me"]);
    expect(screen.getAllByTestId(/^task-row-/)).toHaveLength(rows);
    expect(screen.getByTestId("tasks-refresh-failed")).toBeTruthy();
    expect(screen.queryByText("You're offline")).toBeNull();
  });

  test("my club and a meeting: the page stays", async () => {
    const MyClub = require("~/app/my-club/[clubId]").default;
    const first = await renderRoute(MyClub, { params: { clubId: ids.memberClub } });
    apiState.overrides = { me: offline };
    await refetchAll(first.client, ["me"]);
    expect(screen.getByTestId("my-club-refresh-failed")).toBeTruthy();
    expect(screen.getByTestId("my-club-public")).toBeTruthy();
    await first.unmount();

    const Meeting = require("~/app/meeting/[id]").default;
    const second = await renderRoute(Meeting, { params: { id: ids.meeting } });
    apiState.overrides = { "meetings.meeting": offline };
    await refetchAll(second.client, ["meetings.meeting"]);
    expect(screen.getByTestId("meeting-refresh-failed")).toBeTruthy();
    expect(screen.getByTestId("meeting-agenda")).toBeTruthy();
  });

  test("a first load that fails is still an error", async () => {
    const Screen = require("~/app/tasks").default;
    await renderRoute(Screen, { overrides: { me: offline } });
    expect(screen.getByText("You're offline")).toBeTruthy();
  });
});

describe("F2: tabs opened from a pushed screen", () => {
  afterEach(() => { routerState.stackIndex = 0; });

  test("a tab on top of another screen shows Back, which closes that copy of the tabs", async () => {
    routerState.stackIndex = 1;
    const Screen = require("~/app/(tabs)/profile").default;
    await renderRoute(Screen);
    await fireEvent.press(screen.getByTestId("header-back"));
    expect(routerState.router.dismiss).toHaveBeenCalledTimes(1);
    expect(routerState.router.back).not.toHaveBeenCalled();
  });

  test("the tabs at the bottom of the stack have no Back", async () => {
    routerState.stackIndex = 0;
    const Screen = require("~/app/(tabs)/calendar").default;
    await renderRoute(Screen);
    expect(screen.queryByTestId("header-back")).toBeNull();
    expect(screen.getByTestId("header-scan")).toBeTruthy();
  });

  test("Explore clubs and Open calendar return to the tabs underneath", async () => {
    const Applications = require("~/app/applications").default;
    const first = await renderRoute(Applications, { mode: "empty" });
    await fireEvent.press(screen.getByTestId("applications-explore"));
    expect(routerState.router.dismissTo).toHaveBeenCalledWith("/explore");
    expect(routerState.router.push).not.toHaveBeenCalled();
    await first.unmount();

    const Application = require("~/app/application/[id]").default;
    await renderRoute(Application, { params: { id: ids.reviewApplication } });
    await fireEvent.press(screen.getByTestId("application-open-calendar"));
    expect(routerState.router.dismissTo).toHaveBeenCalledWith("/calendar");
    expect(routerState.router.navigate).not.toHaveBeenCalled();
  });
});

describe("F6: a stale task refusal", () => {
  test("re-reads the task, keeps the typed text across the new revision, and says so in the app's words", async () => {
    let revision = 1;
    const Screen = require("~/app/task/[assignmentId]").default;
    const { client } = await renderRoute(Screen, {
      params: { assignmentId: ids.assignment, clubId: ids.memberClub },
      overrides: {
        "tasks.workspace": (input: unknown) => textTask(revision)(input),
        "tasks.submit": () => { revision = 2; throw new ApiError(422, "STALE", "This submission changed or was reviewed. Reload the page and try again."); },
      },
    });
    await fireEvent.changeText(screen.getByTestId("task-text"), "Kept answer");
    const reads = apiState.calls.filter(call => call.operation === "tasks.workspace").length;
    await fireEvent.press(screen.getByTestId("task-submit"));
    await settle(client);
    expect(apiState.calls.filter(call => call.operation === "tasks.workspace").length).toBeGreaterThan(reads);
    expect(screen.getByTestId("task-text").props.value).toBe("Kept answer");
    expect(screen.getByTestId("task-stale").props.children).toMatch(/Your text and new files are kept/);
    expect(screen.queryByText(/Reload the page/)).toBeNull();
    expect(loggedCrashes()).toEqual([]);
  });

  test("a later save clears the draft, and the form shows the saved copy", async () => {
    const Screen = require("~/app/task/[assignmentId]").default;
    const { client } = await renderRoute(Screen, { params: { assignmentId: ids.assignment, clubId: ids.memberClub }, overrides: { "tasks.workspace": textTask(), "tasks.submit": { success: true } } });
    await fireEvent.changeText(screen.getByTestId("task-text"), "Final answer");
    await fireEvent.press(screen.getByTestId("task-submit"));
    await settle(client);
    expect(screen.getByTestId("task-saved")).toBeTruthy();
    expect(screen.queryByTestId("task-stale")).toBeNull();
  });
});

describe("F8: interview Add to Calendar", () => {
  test("a second tap while the first is running adds nothing", async () => {
    const pending = deferred<string>();
    addToCalendar.mockReset().mockReturnValue(pending.promise);
    const booking = { id: ids.booking, applicationId: ids.interviewApplication, slotId: ids.slot, roomId: ids.room, roundId: ids.round, startTime: new Date(Date.now() + 5 * 86_400_000).toISOString(), endTime: new Date(Date.now() + 5 * 86_400_000 + 1_800_000).toISOString(), location: "Rice 242" };
    const Screen = require("~/app/interview/[applicationId]").default;
    await renderRoute(Screen, { params: { applicationId: ids.interviewApplication }, overrides: { "interviews.schedule": { ...(fixtureSets.rich["interviews.schedule"] as object), booking } } });
    expect(screen.getByTestId("interview-booking")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("interview-add-calendar"));
    expect(screen.getByTestId("interview-add-calendar").props.accessibilityState).toMatchObject({ busy: true });
    // Past the buttons' double-tap window (450 ms), as on a slow Android calendar lookup.
    await wait(500);
    await fireEvent.press(screen.getByTestId("interview-add-calendar"));
    expect(addToCalendar).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve("added"); await pending.promise; });
    expect(screen.getByTestId("interview-calendar-note").props.children).toBe("Added to your calendar.");
    expect(addToCalendar).toHaveBeenCalledTimes(1);
  });

  test("the page title shows once, in the floating bar (P8)", async () => {
    const Screen = require("~/app/interview/[applicationId]").default;
    await renderRoute(Screen, { params: { applicationId: ids.interviewApplication } });
    expect(screen.getAllByText("Book your interview", { includeHiddenElements: true })).toHaveLength(1);
  });
});

describe("F3/F4: Delete account on a password account", () => {
  const metadata = session.user.app_metadata;
  beforeEach(() => { (session.user as { app_metadata: object }).app_metadata = { provider: "email" }; });
  afterEach(() => { (session.user as { app_metadata: object }).app_metadata = metadata; });

  test("asks first, then runs the check with the server's site key once the question has gone", async () => {
    const Screen = require("~/app/settings/account").default;
    const { client } = await renderRoute(Screen, { overrides: { "account.deletion": { pending: null, warnings: [] }, "auth.signupOptions": { termsRequired: true, turnstileSiteKey: "0xSERVERKEY", graduationYears: [] } } });
    await fireEvent.changeText(screen.getByTestId("account-deletion-confirm"), "DELETE");
    await fireEvent.changeText(screen.getByTestId("account-deletion-password"), "correct horse battery");
    await fireEvent.press(screen.getByTestId("account-deletion-submit"));
    await wait(0);
    expect(screen.queryByTestId("webview")).toBeNull();
    await fireEvent.press(screen.getByTestId("confirm-accept"));
    await wait(0);
    // Not yet: the confirm sheet is still sliding away.
    expect(screen.queryByTestId("webview")).toBeNull();
    await wait(SHEET_CLOSE_MS + 120);
    const check = screen.getByTestId("webview");
    expect(check.props.source.html).toContain("0xSERVERKEY");
    await fireEvent(check, "message", { nativeEvent: { data: JSON.stringify({ token: "token-1" }) } });
    await settle(client);
    const request = apiState.calls.find(call => call.operation === "account.deletion.request");
    expect(request?.input).toMatchObject({ confirmation: "DELETE", turnstileToken: "token-1" });
    expect(screen.getByTestId("account-deletion-scheduled")).toBeTruthy();
    expect(loggedCrashes()).toEqual([]);
  });

  test("No sends nothing and opens no check", async () => {
    const Screen = require("~/app/settings/account").default;
    await renderRoute(Screen, { overrides: { "account.deletion": { pending: null, warnings: [] }, "auth.signupOptions": { termsRequired: true, turnstileSiteKey: "0xSERVERKEY", graduationYears: [] } } });
    await fireEvent.changeText(screen.getByTestId("account-deletion-confirm"), "DELETE");
    await fireEvent.changeText(screen.getByTestId("account-deletion-password"), "correct horse battery");
    await fireEvent.press(screen.getByTestId("account-deletion-submit"));
    await wait(0);
    await fireEvent.press(screen.getByTestId("confirm-cancel"));
    await wait(SHEET_CLOSE_MS + 120);
    expect(screen.queryByTestId("webview")).toBeNull();
    expect(apiState.calls.some(call => call.operation === "account.deletion.request")).toBe(false);
  });
});

describe("F5: opening a submitted document", () => {
  test("shows it is opening, ignores repeat taps, and says when it couldn't open", async () => {
    const pending = deferred<boolean>();
    openPrivateDocument.mockReset().mockReturnValue(pending.promise);
    const view = records.applicationsView as ApplicationsView;
    const submitted = view.applications.find(item => item.id === ids.reviewApplication)!;
    const withFile = { ...submitted, club: { ...submitted.club, questions: [{ id: ids.question(2), prompt: "Upload your resume", type: "FILE_UPLOAD", required: false, options: null, wordLimit: null }] }, answers: [{ questionId: ids.question(2), response: "application-attachments/resume.pdf" }], attachments: { [ids.question(2)]: "application-attachments/resume.pdf" } };
    const Screen = require("~/app/application/[id]").default;
    await renderRoute(Screen, { params: { id: ids.reviewApplication }, overrides: { "applications.view": { ...view, applications: [withFile] } } });
    await fireEvent.press(screen.getByTestId("application-view-responses"));
    await fireEvent.press(screen.getByTestId("application-attachment-1"));
    await wait(0);
    expect(screen.getByText("Opening document…")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("application-attachment-1"));
    expect(openPrivateDocument).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve(false); await pending.promise; });
    expect(screen.getByTestId("application-attachment-error-1")).toBeTruthy();
  });
});

describe("F9: a task list scoped to one club", () => {
  test("names the club, and offers every club", async () => {
    const Screen = require("~/app/tasks").default;
    await renderRoute(Screen, { params: { clubId: ids.memberClub } });
    expect(screen.getByText("Virginia Motorsports tasks")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("tasks-show-all"));
    expect(routerState.router.setParams).toHaveBeenCalledWith({ clubId: undefined, taskId: undefined });
  });

  test("a club the student isn't in says so, not “no clubs yet”", async () => {
    const Screen = require("~/app/tasks").default;
    await renderRoute(Screen, { params: { clubId: ids.decidedClub } });
    expect(screen.getByText("You’re not a member of this club")).toBeTruthy();
    expect(screen.queryByText("You haven’t joined any clubs yet")).toBeNull();
  });
});

describe("F10: the pull-to-refresh spinner", () => {
  test("the hook is on only while a pull's refetches run, even one that fails", async () => {
    const pending = deferred<void>();
    const { result } = await renderHook(() => usePullRefresh(() => pending.promise, () => { throw new Error("refused"); }));
    expect(result.current.refreshing).toBe(false);
    await act(async () => { result.current.onRefresh(); });
    expect(result.current.refreshing).toBe(true);
    await act(async () => { pending.resolve(); await pending.promise; await new Promise(resolve => setTimeout(resolve, 0)); });
    expect(result.current.refreshing).toBe(false);
  });

  test("a background refetch on the meeting screen shows no spinner", async () => {
    const Screen = require("~/app/meeting/[id]").default;
    const { client } = await renderRoute(Screen, { params: { id: ids.meeting } });
    const get = api.get as jest.Mock;
    const original = get.getMockImplementation()!;
    const held = deferred<void>();
    get.mockImplementation(async (operation: string, input?: unknown) => { if (operation === "meetings.meeting") await held.promise; return resolveFixture("GET", operation, input); });
    try {
      await act(async () => { void client.invalidateQueries({ queryKey: ["meetings.meeting"] }); });
      await wait(0);
      expect(client.isFetching()).toBeGreaterThan(0);
      expect(refreshing("meeting-screen")).toBe(false);
      await act(async () => { held.resolve(); });
      await settle(client);
    } finally { get.mockImplementation(original); }
  });
});

describe("P6: a meeting that ends the same day", () => {
  test("shows the date once", () => {
    const start = "2026-11-24T20:00:00.000Z", end = "2026-11-24T21:00:00.000Z";
    expect(easternRange(start, end)).toMatch(/^Tue, Nov 24, 3:00\s?PM – 4:00\s?PM$/);
    expect(easternRange(start, "2026-11-25T21:00:00.000Z")).toContain("Nov 25");
    expect(easternRange(start, null)).not.toContain("–");
  });
});

describe("notification links to the new Settings screens", () => {
  const { routeForHref } = jest.requireActual<typeof import("~/lib/links")>("~/lib/links");
  const round = "6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b", club = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
  test("a published interview panel opens Interview schedule, not the Inbox", () => {
    expect(routeForHref(`/settings/interviews?clubId=${club}&roundId=${round}`)).toEqual({ pathname: "/settings/interviews" });
  });
  test("an availability request opens Availability on its round", () => {
    expect(routeForHref(`/settings/availability?clubId=${club}&roundId=${round}`)).toEqual({ pathname: "/settings/availability", params: { roundId: round } });
    expect(routeForHref("/settings/availability?roundId=not-an-id")).toEqual({ pathname: "/settings/availability" });
  });
  test("Interests opens in the app", () => {
    expect(routeForHref("/settings/interests")).toEqual({ pathname: "/settings/interests" });
  });
});
