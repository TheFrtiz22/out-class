/** Home never shows a Back arrow; only screens above it do. Tabs are opened without stacking a second copy of them. */
import { fireEvent, screen } from "@testing-library/react-native";
import { openRoute } from "~/lib/links";
import { ids } from "./fixtures";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute } from "./harness";
import { routerState } from "./router-state";

beforeEach(captureConsole);
afterEach(() => { routerState.tabIndex = 0; routerState.stackIndex = 0; releaseConsole(); });

/** The navigation a tab screen sees when its copy of the tabs sits at `index` in the root stack. */
const navigation = (index: number) => ({ setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()), isFocused: () => true, goBack: jest.fn(), canGoBack: () => true, dispatch: jest.fn(), getParent: () => ({ getState: () => ({ index }) }) });

describe("Home has no Back arrow", () => {
  test.each([0, 1, 3])("with %i screens under it", async index => {
    jest.spyOn(require("expo-router"), "useNavigation").mockReturnValue(navigation(index));
    const Screen = require("~/app/(tabs)/index").default;
    await renderRoute(Screen, { mode: "rich" });
    expect(screen.queryByTestId("header-back")).toBeNull();
    expect(screen.getByTestId("header-scan")).toBeTruthy();
    expect(loggedCrashes()).toEqual([]);
  });

  test("while it loads and when it fails", async () => {
    jest.spyOn(require("expo-router"), "useNavigation").mockReturnValue(navigation(1));
    const Screen = require("~/app/(tabs)/index").default;
    await renderRoute(Screen, { mode: "error" });
    expect(screen.queryByTestId("header-back")).toBeNull();
  });
});

describe("sub-pages keep their Back arrow", () => {
  test("a pushed screen", async () => {
    const Screen = require("~/app/tasks").default;
    await renderRoute(Screen, { mode: "rich" });
    await fireEvent.press(screen.getByTestId("header-back"));
    expect(routerState.router.back).toHaveBeenCalledTimes(1);
  });

  test("a copy of the tabs over another screen closes with Back", async () => {
    jest.spyOn(require("expo-router"), "useNavigation").mockReturnValue(navigation(1));
    const Screen = require("~/app/(tabs)/profile").default;
    await renderRoute(Screen, { mode: "rich" });
    await fireEvent.press(screen.getByTestId("header-back"));
    expect(routerState.router.dismiss).toHaveBeenCalledTimes(1);
  });

  test("Back with nothing left to close goes Home instead of failing", async () => {
    jest.spyOn(require("expo-router"), "useNavigation").mockReturnValue(navigation(1));
    routerState.router.canDismiss.mockReturnValueOnce(false);
    const Screen = require("~/app/(tabs)/profile").default;
    await renderRoute(Screen, { mode: "rich" });
    await fireEvent.press(screen.getByTestId("header-back"));
    expect(routerState.router.dismiss).not.toHaveBeenCalled();
    expect(routerState.router.dismissTo).toHaveBeenCalledWith("/");
  });
});

describe("the dock", () => {
  test("Home from a copy of the tabs closes the copy instead of showing Home inside it", async () => {
    routerState.tabIndex = 4;
    routerState.stackIndex = 1;
    const Layout = require("~/app/(tabs)/_layout").default;
    await renderRoute(Layout, { mode: "rich" });
    await fireEvent.press(screen.getByTestId("tab-home"));
    expect(routerState.router.dismissTo).toHaveBeenCalledWith("/");
    expect(routerState.router.navigate).not.toHaveBeenCalled();
  });

  test("other tabs switch as usual", async () => {
    const Layout = require("~/app/(tabs)/_layout").default;
    await renderRoute(Layout, { mode: "rich" });
    await fireEvent.press(screen.getByTestId("tab-explore"));
    expect(routerState.router.navigate).toHaveBeenCalledWith("/explore");
    expect(routerState.router.dismissTo).not.toHaveBeenCalled();
  });
});

describe("tabs are opened without stacking another copy of the tabs", () => {
  test("openRoute: a tab goes down to the tabs, any other screen is pushed", () => {
    const router = { push: jest.fn(), dismissTo: jest.fn() };
    openRoute(router, { pathname: "/" });
    openRoute(router, { pathname: "/calendar" });
    openRoute(router, { pathname: "/meeting/[id]", params: { id: "x" } });
    expect(router.dismissTo.mock.calls).toEqual([["/"], ["/calendar"]]);
    expect(router.push.mock.calls).toEqual([[{ pathname: "/meeting/[id]", params: { id: "x" } }]]);
  });

  test("an unknown link's Go to Home", async () => {
    const Screen = require("~/app/+not-found").default;
    await renderRoute(Screen);
    await fireEvent.press(screen.getByText("Go to Home"));
    expect(routerState.router.dismissTo).toHaveBeenCalledWith("/");
    expect(routerState.router.replace).not.toHaveBeenCalled();
  });

  test("a missing club's Browse clubs", async () => {
    const Screen = require("~/app/club/[id]").default;
    await renderRoute(Screen, { mode: "empty", params: { id: ids.applyClub } });
    await fireEvent.press(screen.getByText("Browse clubs"));
    expect(routerState.router.dismissTo).toHaveBeenCalledWith("/explore");
    expect(routerState.router.replace).not.toHaveBeenCalled();
  });
});
