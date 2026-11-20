/**
 * Signing in from a fresh clone run in Expo Go. The app had no Supabase address unless a git-ignored
 * config.local.json existed, so sign-in went to a placeholder host, failed before reaching Supabase,
 * and showed only "try again". Now production's public address and key are the defaults, a failure
 * says what kind it is (and the real error in development), and the Turnstile check is asked for
 * only when Supabase asks for it.
 */
import { act, fireEvent, screen } from "@testing-library/react-native";
import SignIn from "~/app/sign-in";
import { missingConfigMessage, signInFailure } from "~/lib/sign-in-error";
import { supabase } from "~/lib/supabase";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute } from "./harness";

// The app's config as app.config.ts builds it for a fresh clone (expo-constants has no app config under Jest).
jest.mock("~/lib/config", () => {
  const actual = jest.requireActual("~/lib/config");
  return { ...actual, config: { ...actual.config, supabaseUrl: "https://htlgjluegmdwfjkzzwic.supabase.co", supabasePublishableKey: "sb_publishable_test", turnstileSiteKey: "" } };
});

beforeEach(captureConsole);
afterEach(releaseConsole);

describe("app config", () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });
  // A fresh copy of app.config.ts per test, without resetting React for the screen tests below.
  const loadConfig = () => { let build: (context: { config: object }) => { extra: Record<string, string> } = () => ({ extra: {} }); jest.isolateModules(() => { build = require("../../app.config").default; }); return build({ config: {} }).extra; };

  test("a fresh clone with no local file or EXPO_PUBLIC_* signs in to production", () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const fs = require("node:fs");
    jest.spyOn(fs, "readFileSync").mockImplementation(() => { throw Object.assign(new Error("ENOENT"), { code: "ENOENT" }); });
    const extra = loadConfig();
    expect(extra.supabaseUrl).toBe("https://htlgjluegmdwfjkzzwic.supabase.co");
    expect(extra.supabasePublishableKey).toMatch(/^sb_publishable_/);
    expect(missingConfigMessage({ supabaseUrl: extra.supabaseUrl, supabasePublishableKey: extra.supabasePublishableKey })).toBeNull();
  });

  test("EXPO_PUBLIC_* still override the defaults", () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://staging.supabase.co";
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_staging";
    const extra = loadConfig();
    expect(extra.supabaseUrl).toBe("https://staging.supabase.co");
    expect(extra.supabasePublishableKey).toBe("sb_publishable_staging");
  });

  test("a local file copied from config.example.json, or half filled, never overrides production", () => {
    const { supabasePair } = require("../../app.config");
    const production = { url: "https://htlgjluegmdwfjkzzwic.supabase.co", source: "the built-in production settings" };
    expect(supabasePair({}, { supabaseUrl: "https://<project-ref>.supabase.co", supabasePublishableKey: "sb_publishable_..." })).toMatchObject(production);
    // The 401 "Invalid API key" case: production's address from one place, a key that isn't production's from another.
    expect(supabasePair({}, { supabaseUrl: "https://htlgjluegmdwfjkzzwic.supabase.co", supabasePublishableKey: "sb_publishable_..." })).toMatchObject(production);
    expect(supabasePair({}, { supabasePublishableKey: "sb_publishable_staging" })).toMatchObject(production);
    expect(supabasePair({ EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_staging" }, {})).toMatchObject(production);
    expect(supabasePair({}, { supabaseUrl: "https://staging.supabase.co/", supabasePublishableKey: "sb_publishable_staging" })).toEqual({ url: "https://staging.supabase.co", key: "sb_publishable_staging", source: "mobile/config.local.json" });
  });

  test("an app with no address says how to fix it instead of 'try again'", () => {
    expect(missingConfigMessage({ supabaseUrl: "", supabasePublishableKey: "" })).toMatch(/config\.local\.json/);
  });
});

describe("sign-in failures", () => {
  test("a request that never reached the server says so, and shows the real error in development", () => {
    const failure = signInFailure({ name: "AuthRetryableFetchError", status: 0, message: "Network request failed" }, true);
    expect(failure.message).toMatch(/couldn't reach OutClass/);
    expect(failure.message).toMatch(/Dev details: AuthRetryableFetchError · Network request failed/);
    expect(signInFailure({ name: "AuthRetryableFetchError", status: 0, message: "Network request failed" }, false).message).not.toMatch(/Dev details/);
  });

  test("a refused key is a setup problem, never 'wrong password', and names where the key came from", () => {
    const failure = signInFailure({ name: "AuthApiError", status: 401, message: "Invalid API key" }, true);
    expect(failure.message).not.toMatch(/isn't right/);
    expect(failure.message).toMatch(/can't reach the sign-in service/);
    expect(failure.message).toMatch(/Setup: the Supabase key from .* was refused\. Delete mobile\/config\.local\.json/);
    expect(signInFailure({ name: "AuthApiError", status: 401, message: "Invalid API key" }, false).message).not.toMatch(/Setup:/);
  });

  test("wrong password, rate limit and captcha read as the web does", () => {
    expect(signInFailure({ status: 400, code: "invalid_credentials", message: "Invalid login credentials" }, false)).toEqual({ message: "That email or password isn't right.", needsCaptcha: false });
    expect(signInFailure({ status: 429, message: "rate" }, false).message).toMatch(/Too many attempts/);
    expect(signInFailure({ status: 400, code: "captcha_failed", message: "captcha verification process failed" }, false).needsCaptcha).toBe(true);
  });
});

describe("sign-in screen", () => {
  const signInWithPassword = supabase.auth.signInWithPassword as jest.Mock;

  async function submit() {
    await fireEvent.changeText(screen.getByTestId("sign-in-email"), "test-student@virginia.edu");
    await fireEvent.changeText(screen.getByTestId("sign-in-password"), "test password 123!");
    await fireEvent.press(screen.getByTestId("sign-in-submit"));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
  }

  test("signs in without a check when Supabase doesn't ask for one", async () => {
    signInWithPassword.mockClear();
    await renderRoute(SignIn, { segments: ["sign-in"] });
    await submit();
    expect(signInWithPassword).toHaveBeenCalledTimes(1);
    expect(signInWithPassword.mock.calls[0][0]).toMatchObject({ email: "test-student@virginia.edu", options: undefined });
    expect(screen.queryByText("One quick check")).toBeNull();
    expect(loggedCrashes()).toEqual([]);
  });

  test("a network failure shows a specific message, not the generic one", async () => {
    signInWithPassword.mockClear();
    signInWithPassword.mockResolvedValueOnce({ data: { session: null, user: null }, error: { name: "AuthRetryableFetchError", status: 0, message: "Network request failed" } });
    await renderRoute(SignIn, { segments: ["sign-in"] });
    await submit();
    expect(screen.getByText(/couldn't reach OutClass/)).toBeTruthy();
    expect(loggedCrashes()).toEqual([]);
  });

  test("when Supabase asks for Turnstile, the check opens with the server's site key", async () => {
    signInWithPassword.mockClear();
    signInWithPassword.mockResolvedValueOnce({ data: { session: null, user: null }, error: { name: "AuthApiError", status: 400, code: "captcha_failed", message: "captcha verification process failed" } });
    await renderRoute(SignIn, { segments: ["sign-in"], overrides: { "auth.signupOptions": { termsRequired: true, turnstileSiteKey: "0xTEST", graduationYears: [] } } });
    await submit();
    expect(screen.getByText("One quick check")).toBeTruthy();
    expect(screen.queryByText(/isn't right/)).toBeNull();
    expect(loggedCrashes()).toEqual([]);
  });

  test("the check's own frames load inside the app instead of being handed to the phone", async () => {
    signInWithPassword.mockClear();
    signInWithPassword.mockResolvedValueOnce({ data: { session: null, user: null }, error: { name: "AuthApiError", status: 400, code: "captcha_failed", message: "captcha verification process failed" } });
    await renderRoute(SignIn, { segments: ["sign-in"], overrides: { "auth.signupOptions": { termsRequired: true, turnstileSiteKey: "0xTEST", graduationYears: [] } } });
    await submit();
    // react-native-webview's own check for each navigation (iOS checks frames too): a URL that fails
    // is sent to Linking, which logged "Can't open url: about:srcdoc" and left Turnstile on "Verifying...".
    const { createOnShouldStartLoadWithRequest } = jest.requireActual("react-native-webview/lib/WebViewShared");
    const whitelist = screen.getByTestId("webview").props.originWhitelist as string[];
    const loads = (url: string) => {
      let allowed: boolean | undefined;
      createOnShouldStartLoadWithRequest((shouldStart: boolean) => { allowed = shouldStart; }, whitelist)({ nativeEvent: { url, lockIdentifier: 1 } });
      return allowed;
    };
    expect(loads("about:srcdoc")).toBe(true);
    expect(loads("about:blank")).toBe(true);
    expect(loads("https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/turnstile/if/ov2/av0/rcv/abc/0xTEST/dark/fbE/new/normal/auto/")).toBe(true);
    expect(loads("https://www.out-class.net/")).toBe(true);
    expect(loads("javascript:alert(1)")).toBe(false);
  });
});
