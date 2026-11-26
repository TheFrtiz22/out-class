/**
 * Leader tools on a regular-width screen (the iPhone Duo's inner display, iPad): Run the club in the leading
 * column, check-in, sharing and web links in the trailing one. Compact width keeps one column in its usual order.
 */
import { screen, within } from "@testing-library/react-native";
import type { LayoutClass } from "~/lib/layout";
import { ids } from "./fixtures";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute, screenText } from "./harness";

let mockLayout: LayoutClass = "regular";
jest.mock("~/lib/layout", () => ({ ...jest.requireActual("~/lib/layout"), useLayoutClass: () => mockLayout }));

beforeEach(captureConsole);
afterEach(() => { releaseConsole(); mockLayout = "regular"; });
const hub = () => renderRoute(require("~/app/leader/[clubId]/index").default, { mode: "rich", params: { clubId: ids.leaderClub } });

test("regular width: Run the club beside check-in, sharing and the web links", async () => {
  await hub();
  const left = screen.getByTestId("leader-column-0"), right = screen.getByTestId("leader-column-1");
  expect(within(left).getByTestId("leader-run")).toBeTruthy();
  expect(within(left).queryByTestId("leader-club-qr")).toBeNull();
  expect(within(right).getByTestId("leader-club-qr")).toBeTruthy();
  expect(within(right).getByText("On the web")).toBeTruthy();
  expect(loggedCrashes()).toEqual([]);
});

test("compact width: one column in the usual order", async () => {
  mockLayout = "compact";
  await hub();
  expect(screen.queryByTestId("leader-columns")).toBeNull();
  const text = screenText(screen.toJSON());
  expect(text.indexOf("Share the club")).toBeLessThan(text.indexOf("Run the club"));
  expect(text.indexOf("Run the club")).toBeLessThan(text.indexOf("On the web"));
});
