/**
 * The whole app (every file in src/app, the real root and tab layouts) on the real expo-router, not the
 * in-memory mock the other render tests use. The dock's taps once threw on Expo Router 58 (its tab bar
 * gets `emitter`, not `navigation`), which froze the app on a phone while every mocked test passed.
 * Here a person signs in, walks every tab, comes back Home, taps the tab they are on, opens the Inbox
 * from the bell and goes Back, and nothing may throw, warn about reading navigation during render,
 * or keep working once the screen has settled.
 */
jest.unmock("expo-router");
// expo-router's testing library swaps in Reanimated's official mock, which the app's screens can't
// load here; keep the render tests' own (setup.tsx) and take only its expo-linking stand-in.
jest.mock("expo-router/build/testing-library/mocks", () => {
  jest.mock("expo-linking", () => ({ ...jest.requireActual("expo-linking"), createURL: (path: string) => `outclass://${path}`, resolveScheme: () => "outclass", addEventListener: () => ({ remove() {} }) }));
  return {};
});
// Crash reporting stays off: nothing leaves the test.
jest.mock("~/lib/report", () => ({ ...jest.requireActual("~/lib/report"), startReporting: () => false }));
import { act, fireEvent, renderRouter, screen, within } from "expo-router/testing-library";
import { api } from "~/lib/api";
import { resetApi } from "./api-state";

type NavState = { index: number; routes: { name: string; state?: NavState }[] };
/** The root stack's screens, by name. */
const rootStack = (state: unknown) => ((state as NavState).routes[0].state as NavState).routes.map(route => route.name);

let warnings: string[] = [];
let errors: string[] = [];
beforeEach(() => {
  warnings = [];
  errors = [];
  jest.spyOn(console, "warn").mockImplementation((...args: unknown[]) => { warnings.push(args.map(String).join(" ")); });
  jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => { errors.push(args.map(String).join(" ")); });
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

/** Lets the app run for a while (the router's fake clock, the API's promises and the effects after them). */
async function settle(ms = 1000) {
  for (let elapsed = 0; elapsed < ms; elapsed += 100) {
    await act(async () => { jest.advanceTimersByTime(100); for (let i = 0; i < 5; i++) await Promise.resolve(); });
  }
}
const navigationWarnings = () => warnings.filter(line => /called during render/.test(line));
const apiCalls = () => (api.get as jest.Mock).mock.calls.length + (api.post as jest.Mock).mock.calls.length;
const tap = async (testID: string) => { await fireEvent.press(screen.getAllByTestId(testID).at(-1)!); await settle(500); };

async function openApp() {
  resetApi("rich");
  // Every file in src/app, as the app bundles them (jest runs from the mobile folder).
  const app = await renderRouter("./src/app", { initialUrl: "/" });
  await settle();
  return app;
}

describe("the whole app on the real router", () => {
  test("opens on Home with one dock", async () => {
    const app = await openApp();
    expect(app.getPathname()).toBe("/");
    expect(screen.getByTestId("home-screen")).toBeTruthy();
    expect(screen.getAllByTestId("tab-dock")).toHaveLength(1);
    expect(screen.queryByTestId("header-back")).toBeNull();
    expect(errors).toEqual([]);
  });

  test("every tab opens from the dock, and Home again after them", async () => {
    const app = await openApp();
    const tour: [string, string][] = [["tab-explore", "/explore"], ["tab-clubs-apply", "/clubs"], ["tab-calendar", "/calendar"], ["tab-profile", "/profile"], ["tab-home", "/"], ["tab-calendar", "/calendar"], ["tab-home", "/"]];
    for (const [tab, pathname] of tour) {
      await fireEvent.press(within(screen.getByTestId("tab-dock")).getByTestId(tab));
      await settle(500);
      expect(app.getPathname()).toBe(pathname);
    }
    expect(rootStack(app.getRouterState())).toEqual(["(tabs)"]);
    expect(errors).toEqual([]);
    expect(navigationWarnings()).toEqual([]);
  });

  test("tapping the tab you are on keeps you there", async () => {
    const app = await openApp();
    await tap("tab-home");
    await tap("tab-explore");
    await tap("tab-explore");
    expect(app.getPathname()).toBe("/explore");
    expect(errors).toEqual([]);
  });

  test("the bell opens the Inbox over the tabs, and Back returns to the tab", async () => {
    const app = await openApp();
    await tap("tab-calendar");
    await tap("header-inbox");
    expect(app.getPathname()).toBe("/inbox");
    expect(rootStack(app.getRouterState())).toEqual(["(tabs)", "inbox"]);
    await tap("header-back");
    expect(app.getPathname()).toBe("/calendar");
    expect(rootStack(app.getRouterState())).toEqual(["(tabs)"]);
    // Home from there is the same Home, with no Back arrow.
    await tap("tab-home");
    expect(app.getPathname()).toBe("/");
    expect(screen.queryByTestId("header-back")).toBeNull();
    expect(errors).toEqual([]);
    expect(navigationWarnings()).toEqual([]);
  });

  test("once the screens have settled, nothing keeps re-loading them", async () => {
    await openApp();
    for (const tab of ["tab-explore", "tab-clubs-apply", "tab-calendar", "tab-profile", "tab-home"]) await tap(tab);
    const before = apiCalls();
    await settle(3000);
    expect(apiCalls() - before).toBe(0);
    expect(errors).toEqual([]);
  });
});
