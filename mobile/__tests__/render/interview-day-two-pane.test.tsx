/**
 * Interview day on a regular-width screen (the iPhone Duo's inner display, iPad): the schedule beside the
 * interview in focus. Folding or unfolding mid-interview must not lose half-typed notes or reopen the session
 * (the brief's "an interview in progress" case): the focus card keeps its place in the tree in both layouts.
 */
import { act, fireEvent, screen } from "@testing-library/react-native";
import type { LayoutClass } from "~/lib/layout";
import { apiState } from "./api-state";
import { ids } from "./fixtures";
import { captureConsole, loggedCrashes, pinEasternMorning, releaseConsole, renderRoute, settle } from "./harness";

let mockLayout: LayoutClass = "regular";
jest.mock("~/lib/layout", () => ({ ...jest.requireActual("~/lib/layout"), useLayoutClass: () => mockLayout }));

beforeEach(captureConsole);
afterEach(() => { releaseConsole(); jest.useRealTimers(); mockLayout = "regular"; });

async function openDay() {
  const moved = pinEasternMorning();
  const shift = (iso: unknown) => typeof iso === "string" ? new Date(Date.parse(iso) + moved).toISOString() : iso;
  const rooms = (require("./fixtures").fixtureSets.rich["leader.interviewRooms"] as Record<string, unknown>[]).map(row => ({ ...row, startTime: shift(row.startTime), endTime: shift(row.endTime) }));
  return renderRoute(require("~/app/leader/[clubId]/interviews").default, { params: { clubId: ids.leaderClub }, overrides: { "leader.interviewRooms": rooms } });
}
const opens = () => apiState.calls.filter(call => call.operation === "leader.interviewSession.open").length;

test("regular width: the schedule in its own pane beside the interview in focus", async () => {
  await openDay();
  expect(screen.getByTestId("interview-schedule")).toBeTruthy();
  expect(screen.getByTestId("interview-today")).toBeTruthy();
  expect(screen.getByTestId("interview-next")).toBeTruthy();
  expect(loggedCrashes()).toEqual([]);
});

test("compact width: one scrolling page, schedule below the focus card", async () => {
  mockLayout = "compact";
  await openDay();
  expect(screen.queryByTestId("interview-schedule")).toBeNull();
  expect(screen.getByTestId("interview-today")).toBeTruthy();
});

test("folding and unfolding mid-interview keeps half-typed notes and the open session", async () => {
  const { client } = await openDay();
  await fireEvent.press(screen.getByTestId("interview-enter"));
  await settle(client);
  expect(opens()).toBe(1);
  await fireEvent.changeText(screen.getByTestId("interview-notes-field"), "Strong on the market-sizing case; ask about");
  // Fold (regular → compact), then unfold again. A fresh copy of the schedule re-renders the screen, as the
  // window change does on the device.
  let tick = 0;
  const rerender = async () => {
    tick += 1; // React Query keeps deep-equal data, so mark the copy as new.
    for (const query of client.getQueryCache().findAll()) if (Array.isArray(query.state.data)) client.setQueryData(query.queryKey, (query.state.data as object[]).map(row => ({ ...row, tick })));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  };
  mockLayout = "compact"; await rerender();
  expect(screen.queryByTestId("interview-schedule")).toBeNull();
  mockLayout = "regular"; await rerender();
  expect(screen.getByTestId("interview-schedule")).toBeTruthy();
  expect(screen.getByTestId("interview-notes-field").props.value).toBe("Strong on the market-sizing case; ask about");
  expect(opens()).toBe(1);
  expect(loggedCrashes()).toEqual([]);
});
