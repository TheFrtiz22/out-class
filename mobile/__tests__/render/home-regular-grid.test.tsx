/**
 * Home on a regular-width screen (the iPhone Duo's inner display, iPad): the club carousel stays full width and
 * the other sections share two even columns in the student's section order. Compact width stays one column.
 * The compact test runs first and records that order for the regular one (Jest runs a file's tests in order).
 */
import { screen, within } from "@testing-library/react-native";
import type { LayoutClass } from "~/lib/layout";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute } from "./harness";

let mockLayout: LayoutClass = "regular";
jest.mock("~/lib/layout", () => ({ ...jest.requireActual("~/lib/layout"), useLayoutClass: () => mockLayout }));

beforeEach(captureConsole);
afterEach(() => { releaseConsole(); mockLayout = "regular"; });
const Home = () => require("~/app/(tabs)/index").default;
const sectionIds = (root: ReturnType<typeof screen.getByTestId>) =>
  within(root).queryAllByTestId(/^home-section-/).map(node => String(node.props.testID).replace("home-section-", ""));
let compactOrder: string[] = [];

test("compact width: one column, no grid", async () => {
  mockLayout = "compact";
  await renderRoute(Home(), { mode: "rich" });
  expect(screen.queryByTestId("home-columns")).toBeNull();
  compactOrder = sectionIds(screen.getByTestId("home-screen"));
  expect(compactOrder.length).toBeGreaterThanOrEqual(3);
});

test("regular width: sections alternate across two even columns in the same order; the carousel stays full width", async () => {
  await renderRoute(Home(), { mode: "rich" });
  const [left, right] = screen.getAllByTestId(/^home-column-/);
  const rest = compactOrder.filter(id => id !== "myClubs");
  expect(sectionIds(left)).toEqual(rest.filter((_, index) => index % 2 === 0));
  expect(sectionIds(right)).toEqual(rest.filter((_, index) => index % 2 === 1));
  if (compactOrder.includes("myClubs")) {
    expect(sectionIds(screen.getByTestId("home-columns"))).not.toContain("myClubs");
    expect(screen.getByTestId("home-section-myClubs")).toBeTruthy();
  }
  expect(loggedCrashes()).toEqual([]);
});
