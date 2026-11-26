/**
 * Folding the iPhone Duo (or narrowing iPad split view) with a club open beside Explore's list keeps that club
 * open, but only when Explore is the screen in view; otherwise the choice waits until the person comes back.
 * In the pane, a save failure's notice sits above the tab dock. (Codex review on #704.)
 */
import { act, fireEvent, screen } from "@testing-library/react-native";
import { DOCK_CLEARANCE } from "~/components/ui";
import { ApiError } from "~/lib/api";
import type { LayoutClass } from "~/lib/layout";
import { apiState } from "./api-state";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute, settle } from "./harness";
import { routerState } from "./router-state";

let mockLayout: LayoutClass = "regular";
jest.mock("~/lib/layout", () => ({ ...jest.requireActual("~/lib/layout"), useLayoutClass: () => mockLayout }));

beforeEach(captureConsole);
afterEach(() => { releaseConsole(); mockLayout = "regular"; jest.restoreAllMocks(); });

const explore = () => require("~/app/(tabs)/explore").default;
type Client = Awaited<ReturnType<typeof renderRoute>>["client"];
let tick = 0;
// A changed copy of the directory re-renders the screen, as the window change does on the device.
const rerender = async (client: Client) => {
  tick += 1;
  for (const query of client.getQueryCache().findAll()) {
    const data = query.state.data as { clubs?: object[] } | undefined;
    if (data?.clubs) client.setQueryData(query.queryKey, { ...data, clubs: data.clubs.map(club => ({ ...club })), tick });
  }
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
};
const focus = (value: boolean) => jest.spyOn(jest.requireMock<{ useIsFocused: () => boolean }>("expo-router"), "useIsFocused").mockReturnValue(value);

test("folding while Explore is in view opens the chosen club as its own page", async () => {
  const { client } = await renderRoute(explore(), { mode: "rich" });
  fireEvent.press(screen.getByTestId("explore-club-0"));
  expect(await screen.findByTestId("club-pane")).toBeTruthy();
  mockLayout = "compact"; await rerender(client);
  expect(routerState.router.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: "/club/[id]" }));
  expect(loggedCrashes()).toEqual([]);
});

test("folding while another screen is in view doesn't push the club; it opens on returning to Explore", async () => {
  const { client } = await renderRoute(explore(), { mode: "rich" });
  fireEvent.press(screen.getByTestId("explore-club-0"));
  await screen.findByTestId("club-pane");
  focus(false);
  mockLayout = "compact"; await rerender(client);
  expect(routerState.router.push).not.toHaveBeenCalled();
  focus(true); await rerender(client);
  expect(routerState.router.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: "/club/[id]" }));
});

test("unfolding again before returning drops the pending push: the club is still beside the list", async () => {
  const { client } = await renderRoute(explore(), { mode: "rich" });
  fireEvent.press(screen.getByTestId("explore-club-0"));
  await screen.findByTestId("club-pane");
  focus(false);
  mockLayout = "compact"; await rerender(client);
  mockLayout = "regular"; await rerender(client);
  focus(true); await rerender(client);
  expect(routerState.router.push).not.toHaveBeenCalled();
  expect(screen.getByTestId("club-pane")).toBeTruthy();
});

test("in the pane, a failed save's notice sits above the tab dock", async () => {
  const { client } = await renderRoute(explore(), { mode: "rich" });
  fireEvent.press(screen.getByTestId("explore-club-0"));
  await screen.findByTestId("club-pane");
  apiState.overrides["clubs.save"] = () => { throw new ApiError(500, "SERVER", "We couldn’t save this club. Please try again."); };
  fireEvent.press(screen.getByTestId("club-follow"));
  await settle(client);
  const notices = screen.getAllByTestId("notice");
  for (const notice of notices) {
    const bar = notice.parent!;
    const bottom = [bar.props.style].flat().reduce((value: number | undefined, style: { bottom?: number } | undefined) => style?.bottom ?? value, undefined);
    expect(bottom).toBeGreaterThanOrEqual(DOCK_CLEARANCE);
  }
});

test("crossing the breakpoint resizes the club list instead of remounting it (scroll position survives)", async () => {
  const { client } = await renderRoute(explore(), { mode: "rich" });
  const list = screen.getByTestId("explore-screen");
  mockLayout = "compact"; await rerender(client);
  expect(screen.getByTestId("explore-screen")).toBe(list);
  mockLayout = "regular"; await rerender(client);
  expect(screen.getByTestId("explore-screen")).toBe(list);
  expect(loggedCrashes()).toEqual([]);
});

test("the chosen club is marked selected in the list, and stays chosen after a fold opens it", async () => {
  const { client } = await renderRoute(explore(), { mode: "rich" });
  fireEvent.press(screen.getByTestId("explore-club-0"));
  await screen.findByTestId("club-pane");
  expect(screen.getByTestId("explore-club-0").props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
  expect(screen.getByTestId("explore-club-1").props.accessibilityState).toEqual(expect.objectContaining({ selected: false }));
  mockLayout = "compact"; await rerender(client);
  expect(routerState.router.push).toHaveBeenCalledTimes(1);
  await rerender(client);
  expect(routerState.router.push).toHaveBeenCalledTimes(1);
  mockLayout = "regular"; await rerender(client);
  expect(screen.getByTestId("club-pane")).toBeTruthy();
  expect(screen.getByTestId("explore-club-0").props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
  expect(loggedCrashes()).toEqual([]);
});
