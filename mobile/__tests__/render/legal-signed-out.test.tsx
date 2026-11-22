/**
 * The Terms and Privacy Policy open from Sign in, so the root layout's sign-in gate must let a signed-out
 * person reach them (and come back), on the real expo-router with every file in src/app, while every
 * other screen still sends them to Sign in.
 */
jest.unmock("expo-router");
// As in whole-app.test.tsx: keep the render tests' own Reanimated mock, take only the expo-linking stand-in.
jest.mock("expo-router/build/testing-library/mocks", () => {
  jest.mock("expo-linking", () => ({ ...jest.requireActual("expo-linking"), createURL: (path: string) => `outclass://${path}`, resolveScheme: () => "outclass", addEventListener: () => ({ remove() {} }) }));
  return {};
});
jest.mock("~/lib/report", () => ({ ...jest.requireActual("~/lib/report"), startReporting: () => false }));
jest.mock("expo-status-bar", () => ({ StatusBar: jest.fn(() => null) }));
import { act, fireEvent, renderRouter, screen } from "expo-router/testing-library";
import { supabase } from "~/lib/supabase";
import { resetApi } from "./api-state";

let errors: string[] = [];
beforeEach(() => {
  errors = [];
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => { errors.push(args.map(String).join(" ")); });
  // Signed out: no stored session.
  (supabase.auth.getSession as jest.Mock).mockImplementation(() => Promise.resolve({ data: { session: null }, error: null }));
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); (supabase.auth.getSession as jest.Mock).mockReset(); });

async function settle(ms = 1000) {
  for (let elapsed = 0; elapsed < ms; elapsed += 100) {
    await act(async () => { jest.advanceTimersByTime(100); for (let i = 0; i < 5; i++) await Promise.resolve(); });
  }
}

async function open(initialUrl: string) {
  resetApi("rich");
  const app = await renderRouter("./src/app", { initialUrl });
  await settle();
  return app;
}

describe("signed out", () => {
  test("a screen that needs an account still goes to Sign in", async () => {
    const app = await open("/settings");
    expect(app.getPathname()).toBe("/sign-in");
  });

  test.each([["/legal/terms", "Our Terms of Service are being finalized"], ["/legal/privacy", "Our Privacy Policy is being finalized"]])("%s opens and stays open", async (path, heading) => {
    const app = await open(path);
    expect(app.getPathname()).toBe(path);
    expect(screen.getByText(heading)).toBeTruthy();
  });

  test("Sign in's links open the Terms and Privacy Policy, and Back returns to Sign in", async () => {
    const app = await open("/sign-in");
    expect(app.getPathname()).toBe("/sign-in");
    await fireEvent.press(screen.getByTestId("sign-in-terms"));
    await settle(500);
    expect(app.getPathname()).toBe("/legal/terms");
    await fireEvent.press(screen.getAllByTestId("header-back").at(-1)!);
    await settle(500);
    expect(app.getPathname()).toBe("/sign-in");
    await fireEvent.press(screen.getByTestId("sign-in-privacy"));
    await settle(500);
    expect(app.getPathname()).toBe("/legal/privacy");
    expect(errors.filter(line => /TypeError|ReferenceError|is not a function/.test(line))).toEqual([]);
  });
});
