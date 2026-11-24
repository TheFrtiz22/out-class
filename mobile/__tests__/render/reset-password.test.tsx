/**
 * The emailed password reset link opens the app's own set-new-password screen. The token comes
 * from the link's fragment, goes only to the server's auth.resetPassword operation (sent without
 * the session), and the screen never redirects away while the link is open, signed in or out.
 */
import { act, fireEvent, screen } from "@testing-library/react-native";
import * as WebBrowser from "expo-web-browser";
import ResetPassword from "~/app/reset-password";
import { ApiError } from "~/lib/api";
import { pendingLinkFor } from "~/lib/pending-link";
import { authenticatorIssue, resetTokenFrom } from "~/lib/password-reset";
import { scrubBreadcrumb, stripUrl } from "~/lib/report";
import { supabase } from "~/lib/supabase";
import { apiState } from "./api-state";
import { captureConsole, loggedCrashes, releaseConsole, renderRoute } from "./harness";
import { routerState } from "./router-state";

const TOKEN = "pkce_0123456789abcdefABCDEF";
const link = { "#": `token_hash=${TOKEN}` };
const GOOD = "correcthorse42";

beforeEach(() => { captureConsole(); jest.mocked(supabase.auth.signOut).mockClear(); jest.mocked(WebBrowser.openBrowserAsync).mockClear(); });
afterEach(releaseConsole);

const fill = async (password: string, confirmation = password) => {
  await fireEvent.changeText(screen.getByTestId("reset-password-password"), password);
  await fireEvent.changeText(screen.getByTestId("reset-password-confirmation"), confirmation);
};
// The button treats taps closer than 450 ms as one (a double tap never submits twice), so each submit here comes a moment later.
let clock = Date.now();
const submit = async () => {
  clock += 1000;
  jest.spyOn(Date, "now").mockReturnValue(clock);
  await act(async () => { await fireEvent.press(screen.getByTestId("reset-password-submit")); });
};
const resets = () => apiState.calls.filter(call => call.operation === "auth.resetPassword");

describe("the token from the emailed link", () => {
  test("is read from the fragment, the query or the link's own URL, and anything malformed is refused", () => {
    expect(resetTokenFrom(link)).toBe(TOKEN);
    expect(resetTokenFrom({ "#": `#token_hash=${TOKEN}&type=recovery` })).toBe(TOKEN);
    expect(resetTokenFrom({ token_hash: TOKEN })).toBe(TOKEN);
    expect(resetTokenFrom({}, `https://www.out-class.net/reset-password#token_hash=${TOKEN}`)).toBe(TOKEN);
    expect(resetTokenFrom({}, `https://www.out-class.net/q/abc#token_hash=${TOKEN}`)).toBeNull();
    for (const bad of ["", "short", "has spaces in it here", "<script>alert(1)</script>xx", "a".repeat(513), `${TOKEN}/../x`]) expect(resetTokenFrom({ "#": `token_hash=${bad}` })).toBeNull();
    expect(resetTokenFrom({})).toBeNull();
    expect(resetTokenFrom({}, "not a url")).toBeNull();
  });

  test("an authenticator code is six digits or nothing", () => {
    expect(authenticatorIssue("")).toBeNull();
    expect(authenticatorIssue("123456")).toBeNull();
    expect(authenticatorIssue("12345")).toMatch(/6-digit/);
  });

  test("crash reports never carry the token", () => {
    expect(stripUrl(`https://www.out-class.net/reset-password#token_hash=${TOKEN}`)).toBe("https://www.out-class.net/reset-password");
    expect(JSON.stringify(scrubBreadcrumb({ category: "navigation", data: { to: `/reset-password#token_hash=${TOKEN}`, from: "/sign-in" } }))).not.toContain(TOKEN);
  });

  test("the reset screen is never remembered as a link to reopen after sign-in", () => {
    expect(pendingLinkFor("/reset-password", "reset-password", link, ["reset-password"])).toBeNull();
  });
});

describe("set a new password", () => {
  test("a good password is sent once, with the link's token, without the session, and ends on sign-in", async () => {
    await renderRoute(ResetPassword, { params: link, segments: ["reset-password"], overrides: { "auth.resetPassword": { message: "Your password has been updated. Sign in with your new password." } } });
    await fill(GOOD);
    await submit();
    expect(resets()).toEqual([{ method: "POST", operation: "auth.resetPassword", input: { tokenHash: TOKEN, password: GOOD, confirmation: GOOD } }]);
    // The server signed the reset account out everywhere; the phone drops only its own session,
    // so a phone signed in to another account never ends that account's other sessions.
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(supabase.auth.signOut).not.toHaveBeenCalledWith();
    expect(supabase.auth.signOut).not.toHaveBeenCalledWith({ scope: "global" });
    expect(screen.getByTestId("reset-password-done")).toBeTruthy();
    expect(screen.queryByTestId("reset-password-password")).toBeNull();
    await fireEvent.press(screen.getByTestId("reset-password-sign-in"));
    expect(routerState.router.replace).toHaveBeenCalledWith("/sign-in");
    expect(loggedCrashes()).toEqual([]);
  });

  test("the request goes without the session, so a signed-in phone can't change someone else's password", async () => {
    const { api } = jest.requireMock<typeof import("~/lib/api")>("~/lib/api");
    await renderRoute(ResetPassword, { params: link, segments: ["reset-password"], overrides: { "auth.resetPassword": { message: "ok" } } });
    await fill(GOOD);
    await submit();
    expect(api.post).toHaveBeenCalledWith("auth.resetPassword", expect.objectContaining({ tokenHash: TOKEN }), { anonymous: true });
  });

  test("a weak or mismatched password is caught on the phone and nothing is sent", async () => {
    await renderRoute(ResetPassword, { params: link, segments: ["reset-password"] });
    await fill("short");
    await submit();
    expect(screen.getByText(/at least|characters/i)).toBeTruthy();
    await fill(GOOD, `${GOOD}x`);
    await submit();
    expect(screen.getByText("The passwords don't match.")).toBeTruthy();
    expect(resets()).toEqual([]);
  });

  test("an account with an authenticator sends the six-digit code", async () => {
    await renderRoute(ResetPassword, { params: link, segments: ["reset-password"], overrides: { "auth.resetPassword": { message: "ok" } } });
    await fireEvent.press(screen.getByTestId("reset-password-use-code"));
    await fill(GOOD);
    await fireEvent.changeText(screen.getByTestId("reset-password-code"), "12 34-5");
    await submit();
    expect(screen.getByText(/6-digit code from your authenticator/)).toBeTruthy();
    expect(resets()).toEqual([]);
    await fireEvent.changeText(screen.getByTestId("reset-password-code"), "123456");
    await submit();
    expect(resets()[0].input).toEqual({ tokenHash: TOKEN, password: GOOD, confirmation: GOOD, authenticatorCode: "123456" });
  });

  test("an expired link says so and offers a new one on the website; other refusals show the server's words", async () => {
    let refusal = new ApiError(422, "RESET_LINK_INVALID", "This reset link is invalid or has expired. Request a new one.");
    await renderRoute(ResetPassword, { params: link, segments: ["reset-password"], overrides: { "auth.resetPassword": () => { throw refusal; } } });
    await fill(GOOD);
    await submit();
    expect(screen.getByTestId("reset-password-error").props.children).toMatch(/expired/);
    await fireEvent.press(screen.getByTestId("reset-password-new-link"));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(expect.stringMatching(/\/forgot-password$/));
    refusal = new ApiError(429, "RATE_LIMITED", "Too many attempts. Please wait a minute and try again.");
    await submit();
    expect(screen.getByTestId("reset-password-error").props.children).toMatch(/Too many attempts/);
    expect(screen.queryByTestId("reset-password-new-link")).toBeNull();
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
    expect(screen.getByTestId("reset-password-form")).toBeTruthy();
  });

  test("a link with no token never shows the form and points to a new link", async () => {
    await renderRoute(ResetPassword, { params: {}, segments: ["reset-password"] });
    expect(screen.getByTestId("reset-password-no-link")).toBeTruthy();
    expect(screen.queryByTestId("reset-password-submit")).toBeNull();
    await fireEvent.press(screen.getByTestId("reset-password-new-link"));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(expect.stringMatching(/\/forgot-password$/));
    await fireEvent.press(screen.getByTestId("reset-password-back"));
    expect(routerState.router.replace).toHaveBeenCalledWith("/sign-in");
    expect(resets()).toEqual([]);
  });
});
