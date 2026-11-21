/**
 * Club profile (Nov 21): the full club name stays on one line in the floating bar, shrinking to
 * fit rather than being cut off, and "Where members go" drifts on its own like the web's carousel.
 */
import { act, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PlacementCarousel } from "~/components/explore/placement-carousel";
import { Header } from "~/components/header";
import { ThemeProvider } from "~/lib/theme";
import { records } from "./fixtures";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute } from "./harness";

type FrameCallback = { callback: (frame: { timeSincePreviousFrame: number | null }) => void; isActive: boolean };
const frameCallbacks = (jest.requireMock("react-native-reanimated") as { __frameCallbacks: FrameCallback[] }).__frameCallbacks;

beforeEach(() => { captureConsole(); frameCallbacks.length = 0; });
afterEach(releaseConsole);

const LONG = "Black Commerce Student Network at McIntire";
const FIRMS = ["Citadel", "Blackstone", "Ares", "Morgan Stanley", "Point72", "KKR", "Oaktree", "PJT Partners", "D. E. Shaw", "Apollo", "Goldman Sachs"];
const metrics = { frame: { x: 0, y: 0, width: 375, height: 667 }, insets: { top: 20, left: 0, right: 0, bottom: 0 } };
const themed = (node: React.ReactNode) => render(<GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider initialMetrics={metrics}><ThemeProvider>{node}</ThemeProvider></SafeAreaProvider></GestureHandlerRootView>);
const flat = (style: unknown) => StyleSheet.flatten(style as never) ?? {};

describe("club name in the top bar", () => {
  test("a long name is shown whole on one line, shrinking to fit instead of truncating", async () => {
    await themed(<Header title={LONG} back fitTitle />);
    const title = screen.getByRole("header");
    expect(screen.getByText(LONG)).toBeTruthy();
    expect(title.props.numberOfLines).toBe(1);
    expect(title.props.adjustsFontSizeToFit).toBe(true);
    expect(title.props.minimumFontScale).toBeGreaterThanOrEqual(0.5);
    expect(flat(title.props.style).fontSize).toBe(20);
  });

  test("other bars keep their usual title", async () => {
    await themed(<Header title="Saved clubs" back />);
    expect(screen.getByRole("header").props.adjustsFontSizeToFit).toBeFalsy();
  });

  test.each([["long", LONG], ["short", "ACM"]])("the club page fits a %s name in the bar", async (_kind, name) => {
    const Screen = require("~/app/club/[id]").default;
    await renderRoute(Screen, { mode: "rich", params: { id: records.fullClub.id }, overrides: { club: { club: { ...records.fullClub, name } } } });
    const bar = screen.getAllByRole("header").find(node => node.props.adjustsFontSizeToFit);
    expect(bar?.props.children).toBe(name);
    expect(loggedCrashes()).toEqual([]);
  });
});

describe("Where members go", () => {
  test("every rail starts drifting as soon as it mounts", async () => {
    await themed(<PlacementCarousel names={FIRMS} />);
    expect(frameCallbacks.length).toBe(3);
    expect(frameCallbacks.every(rail => rail.isActive)).toBe(true);
    // A frame before the rail is measured must not throw.
    await act(async () => frameCallbacks.forEach(rail => rail.callback({ timeSincePreviousFrame: 16 })));
  });

  test("rows split the names evenly and every firm is listed for screen readers", async () => {
    await themed(<PlacementCarousel names={FIRMS} />);
    expect(screen.getByLabelText(`Where members go: ${FIRMS.join(", ")}`)).toBeTruthy();
  });

  test.each([["one firm", ["Tesla"]], ["a few firms", ["Tesla", "SpaceX", "NASA", "Boeing", "Lockheed Martin"]]])("%s shows a still list with nothing to scroll", async (_kind, names) => {
    await themed(<PlacementCarousel names={names} />);
    expect(frameCallbacks.length).toBe(0);
    names.forEach(name => expect(screen.getByText(name)).toBeTruthy());
  });

  test("the club page drifts its firms", async () => {
    const Screen = require("~/app/club/[id]").default;
    const marketing = { ...records.fullClub.marketing!, placements: FIRMS };
    await renderRoute(Screen, { mode: "rich", params: { id: records.fullClub.id }, overrides: { club: { club: { ...records.fullClub, marketing } } } });
    expect(frameCallbacks.length).toBeGreaterThan(0);
    expect(frameCallbacks.every(rail => rail.isActive)).toBe(true);
    expect(loggedCrashes()).toEqual([]);
  });
});
