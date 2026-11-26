/**
 * Explore on a regular-width screen (the iPhone Duo's inner display, iPad) shows the club list beside the chosen
 * club's page, as Apple's guidance shows Mail's list beside an email. Compact screens open the club as its own page.
 */
import { fireEvent, screen } from "@testing-library/react-native";
import { layoutClassFor, REGULAR_MIN_WIDTH } from "~/lib/layout";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute } from "./harness";
import { routerState } from "./router-state";

beforeEach(captureConsole);
afterEach(releaseConsole);

const phone = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } };
const duoOpen = { frame: { x: 0, y: 0, width: 880, height: 760 }, insets: { top: 24, left: 0, right: 52, bottom: 20 } };
const explore = () => require("~/app/(tabs)/explore").default;

test("size classes: every iPhone width is compact; the Duo's inner display and iPads are regular", () => {
  for (const width of [320, 375, 393, 430, 440]) expect(layoutClassFor(width)).toBe("compact");
  for (const width of [REGULAR_MIN_WIDTH, 744, 880, 1024, 1366]) expect(layoutClassFor(width)).toBe("regular");
});

test("regular width: the list and a 'Choose a club' pane, then the club's page beside the list", async () => {
  await renderRoute(explore(), { mode: "rich", metrics: duoOpen });
  expect(screen.getByTestId("explore-detail")).toBeTruthy();
  expect(screen.getByText("Choose a club")).toBeTruthy();
  fireEvent.press(screen.getByTestId("explore-club-0"));
  expect(await screen.findByTestId("club-pane")).toBeTruthy();
  expect(screen.getByTestId("explore-club-1")).toBeTruthy(); // the list stays beside it
  expect(routerState.router.push).not.toHaveBeenCalled();
  expect(loggedCrashes()).toEqual([]);
});

test("compact width: one pane, and a club opens as its own page", async () => {
  await renderRoute(explore(), { mode: "rich", metrics: phone });
  expect(screen.queryByTestId("explore-detail")).toBeNull();
  fireEvent.press(screen.getByTestId("explore-club-0"));
  expect(routerState.router.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: "/club/[id]" }));
  expect(loggedCrashes()).toEqual([]);
});
