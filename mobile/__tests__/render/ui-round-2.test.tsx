/**
 * The Nov 19 UI round: logos fit their box, status labels are an icon and text (no filled chip),
 * the profile actions share one row and Tasks left Profile, page titles show once (in the
 * floating bar), Calendar's Subscribe sits in that bar, switches read as on in dark mode, the
 * light/dark choice in Settings sticks, and the tab dock can be dragged onto a tab.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView, State } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { Chip, ClubMark, StatusChip, toggleTrack } from "~/components/ui";
import { slotAt } from "~/lib/dock";
import { ThemeProvider, useTheme } from "~/lib/theme";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute } from "./harness";
import { routerState } from "./router-state";

beforeEach(async () => { captureConsole(); await AsyncStorage.clear(); });
afterEach(releaseConsole);

const flat = (style: unknown) => StyleSheet.flatten(style as never) ?? {};
const themed = async (node: React.ReactNode) => render(<GestureHandlerRootView style={{ flex: 1 }}><ThemeProvider>{node}</ThemeProvider></GestureHandlerRootView>);
type Json = { props?: Record<string, unknown>; children?: (Json | string)[] | null } | string | null;
function findInTree(json: Json | Json[], predicate: (props: Record<string, unknown>) => boolean): Record<string, unknown> | null {
  if (!json || typeof json === "string") return null;
  if (Array.isArray(json)) { for (const item of json) { const hit = findInTree(item, predicate); if (hit) return hit; } return null; }
  if (json.props && predicate(json.props)) return json.props;
  return findInTree((json.children ?? []) as Json[], predicate);
}
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });

describe("club logos", () => {
  test("a logo is drawn whole inside its box, not cropped", async () => {
    await themed(<ClubMark name="180 Degrees Consulting" logoUrl="https://example.org/logo.png" size={44} />);
    const image = findInTree(screen.toJSON() as Json, props => props.contentFit !== undefined);
    expect(image?.contentFit).toBe("contain");
  });
});

describe("status labels", () => {
  test("a status is an icon and plain text, with no filled capsule behind it", async () => {
    await themed(<Chip label="Urgent" tone="warning" testID="chip" />);
    const style = flat(screen.getByTestId("chip").props.style);
    expect(style.backgroundColor).toBeUndefined();
    expect(style.borderRadius).toBeUndefined();
    expect(screen.getByText("Urgent")).toBeTruthy();
  });
  test("an application status names its state", async () => {
    await themed(<StatusChip label="Draft" code="DRAFTING" testID="status" />);
    expect(flat(screen.getByTestId("status").props.style).backgroundColor).toBeUndefined();
    expect(screen.getByText("Draft")).toBeTruthy();
  });
});

describe("profile", () => {
  test("Edit, LinkedIn and Résumé share one row, and Tasks is no longer on the page", async () => {
    const Screen = require("~/app/(tabs)/profile").default;
    await renderRoute(Screen, { mode: "rich" });
    const row = screen.getByTestId("profile-actions");
    expect(flat(row.props.style).flexDirection).toBe("row");
    for (const id of ["profile-edit", "profile-linkedin-open", "profile-resume-view"]) expect(within(row).getByTestId(id)).toBeTruthy();
    expect(screen.queryByTestId("profile-tasks")).toBeNull();
    expect(screen.queryByText("Your tasks across clubs")).toBeNull();
    expect(loggedCrashes()).toEqual([]);
  });
});

describe("page titles", () => {
  const cases: [string, string][] = [
    ["(tabs)/calendar", "Calendar"], ["(tabs)/inbox", "Inbox"], ["(tabs)/explore", "Explore"], ["applications", "Applications"],
    ["tasks", "Tasks"], ["events/index", "Events"], ["saved-clubs", "Saved clubs"], ["settings/index", "Settings"],
    ["settings/notifications", "Notifications"], ["settings/account", "Account & Security"],
  ];
  test.each(cases)("%s shows its title once, in the floating bar", async (file, title) => {
    const Screen = require(`~/app/${file}`).default;
    await renderRoute(Screen, { mode: "rich" });
    expect(screen.getAllByText(title, { includeHiddenElements: true })).toHaveLength(1);
  });
  test("Home greets by name in the bar and has no check-in pass", async () => {
    const Screen = require("~/app/(tabs)/index").default;
    await renderRoute(Screen, { mode: "rich" });
    expect(screen.getAllByText(/^Hi, /)).toHaveLength(1);
    expect(screen.queryByText(/Check-in pass/i)).toBeNull();
  });
  test("Calendar's Subscribe sits in the bar beside the title", async () => {
    const Screen = require("~/app/(tabs)/calendar").default;
    await renderRoute(Screen, { mode: "rich" });
    const subscribe = screen.getByTestId("calendar-subscribe");
    // The bar is the absolutely positioned block that holds the title.
    let node = subscribe.parent;
    while (node && flat(node.props.style).position !== "absolute") node = node.parent;
    expect(node).toBeTruthy();
    expect(within(node!).getByText("Calendar")).toBeTruthy();
  });
});

describe("switches", () => {
  test("on is the accent in dark mode and navy in light mode, never the near-white primary", () => {
    const { resolveTheme } = require("@outclass/shared/tokens");
    const dark = toggleTrack({ colors: resolveTheme("dark").colors, dark: true });
    expect(dark.on.toLowerCase()).toBe("#e57200");
    expect(dark.on).not.toBe(dark.off);
    expect(dark.on).not.toBe(resolveTheme("dark").colors.primary);
    const light = toggleTrack({ colors: resolveTheme("light").colors, dark: false });
    expect(light.on.toLowerCase()).toBe("#232d4b");
  });
});

describe("appearance", () => {
  function Probe() {
    const { dark, appearance } = useTheme();
    return <View><Text testID="probe">{`${appearance}:${dark ? "dark" : "light"}`}</Text></View>;
  }
  test("choosing Dark in Settings switches the theme and is kept on the device", async () => {
    const Settings = require("~/app/settings/index").default;
    await renderRoute(() => <><Settings /><Probe /></>, { mode: "rich" });
    expect(screen.getByTestId("probe").props.children).toMatch(/^system:/);
    await act(async () => { fireEvent.press(screen.getByLabelText("Dark")); });
    expect(screen.getByTestId("probe").props.children).toBe("dark:dark");
    expect(await AsyncStorage.getItem("outclass.appearance")).toBe("dark");
    await act(async () => { fireEvent.press(screen.getByLabelText("Light")); });
    expect(screen.getByTestId("probe").props.children).toBe("light:light");
  });
  test("a saved choice is applied on the next launch", async () => {
    await AsyncStorage.setItem("outclass.appearance", "dark");
    await themed(<Probe />);
    await flush();
    expect(screen.getByTestId("probe").props.children).toBe("dark:dark");
  });
});

describe("tab dock drag", () => {
  test("the slot under a finger is clamped to the dock", () => {
    // 5 tabs across a 365pt dock with 6pt padding: each slot is 70.6pt wide.
    expect(slotAt(6 + 70.6 * 0.5, 365, 5)).toBeCloseTo(0);
    expect(Math.round(slotAt(250, 365, 5))).toBe(3);
    expect(slotAt(-40, 365, 5)).toBe(0);
    expect(slotAt(900, 365, 5)).toBe(4);
    expect(slotAt(100, 0, 5)).toBe(0);
  });

  async function renderDock() {
    const Layout = require("~/app/(tabs)/_layout").default;
    await renderRoute(Layout, { mode: "rich" });
    await act(async () => { fireEvent(screen.getByTestId("tab-dock"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 365, height: 68 } } }); });
  }

  test("dragging from Home and letting go over Calendar opens Calendar", async () => {
    await renderDock();
    expect(screen.getByTestId("tab-selection")).toBeTruthy();
    await act(async () => {
      fireGestureHandler(getByGestureTestId("tab-dock-drag"), [{ state: State.BEGAN, x: 30 }, { state: State.ACTIVE, x: 40 }, { x: 150 }, { x: 250 }, { state: State.END, x: 250 }]);
    });
    expect(routerState.router.navigate).toHaveBeenCalledTimes(1);
    expect(routerState.router.navigate).toHaveBeenCalledWith("/calendar");
    // The finger lifting over Calendar is the drop, not a second tap.
    fireEvent.press(screen.getByTestId("tab-calendar"));
    expect(routerState.router.navigate).toHaveBeenCalledTimes(1);
    expect(loggedCrashes()).toEqual([]);
  });

  test("letting go back on the current tab, or a cancelled drag, goes nowhere", async () => {
    await renderDock();
    await act(async () => {
      fireGestureHandler(getByGestureTestId("tab-dock-drag"), [{ state: State.BEGAN, x: 30 }, { state: State.ACTIVE, x: 40 }, { x: 200 }, { x: 20 }, { state: State.END, x: 20 }]);
    });
    await act(async () => {
      fireGestureHandler(getByGestureTestId("tab-dock-drag"), [{ state: State.BEGAN, x: 30 }, { state: State.ACTIVE, x: 40 }, { x: 300 }, { state: State.CANCELLED, x: 300 }]);
    });
    expect(routerState.router.navigate).not.toHaveBeenCalled();
  });

  test("a plain tap still switches tabs", async () => {
    await renderDock();
    await new Promise(resolve => setTimeout(resolve, 450));
    fireEvent.press(screen.getByTestId("tab-inbox"));
    expect(routerState.router.navigate).toHaveBeenCalledWith("/inbox");
  });
});
