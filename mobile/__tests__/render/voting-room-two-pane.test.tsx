/**
 * The leader's voting room on a regular-width screen (the iPhone Duo's inner display, iPad): who is in the room,
 * the applicant queue and the web links get their own pane beside the stage and host controls. Folding mid-vote
 * must not lose a half-typed reason or the room: the host controls keep their place in the tree in both layouts.
 */
import { act, fireEvent, screen, within } from "@testing-library/react-native";
import type { LayoutClass } from "~/lib/layout";
import { ids, records } from "./fixtures";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute } from "./harness";

let mockLayout: LayoutClass = "regular";
jest.mock("~/lib/layout", () => ({ ...jest.requireActual("~/lib/layout"), useLayoutClass: () => mockLayout }));

beforeEach(captureConsole);
afterEach(() => { releaseConsole(); mockLayout = "regular"; });

const room = (snapshot: Record<string, unknown> = records.roomSnapshot) =>
  renderRoute(require("~/app/voting/[sessionId]").default, { params: { sessionId: ids.session, clubId: ids.leaderClub }, overrides: { "voting.room": snapshot } });

test("regular width: the queue in its own pane beside the host controls", async () => {
  await room();
  const lists = screen.getByTestId("voting-room-lists");
  expect(within(lists).getByTestId("voting-queue")).toBeTruthy();
  expect(within(screen.getByTestId("voting-room")).queryByTestId("voting-queue")).toBeNull();
  expect(within(screen.getByTestId("voting-room")).getByTestId("voting-host-controls")).toBeTruthy();
  expect(loggedCrashes()).toEqual([]);
});

test("compact width: one scrolling page with the queue below the host controls", async () => {
  mockLayout = "compact";
  await room();
  expect(screen.queryByTestId("voting-room-lists")).toBeNull();
  expect(within(screen.getByTestId("voting-room")).getByTestId("voting-queue")).toBeTruthy();
});

test("folding and unfolding mid-vote keeps a half-typed recount reason", async () => {
  const { client } = await room({ ...records.roomSnapshot, electorateChange: { removed: 2 } });
  await fireEvent.changeText(screen.getByTestId("voting-recount-reason"), "Two members left the meeting early");
  let tick = 0;
  const rerender = async () => {
    tick += 1; // React Query keeps deep-equal data, so mark the snapshot as new, as the next poll would.
    for (const query of client.getQueryCache().findAll()) {
      const data = query.state.data;
      if (data && typeof data === "object" && !Array.isArray(data) && "participation" in data) client.setQueryData(query.queryKey, { ...data, tick });
    }
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  };
  mockLayout = "compact"; await rerender();
  expect(screen.queryByTestId("voting-room-lists")).toBeNull();
  mockLayout = "regular"; await rerender();
  expect(screen.getByTestId("voting-room-lists")).toBeTruthy();
  expect(screen.getByTestId("voting-recount-reason").props.value).toBe("Two members left the meeting early");
  expect(loggedCrashes()).toEqual([]);
});
