/**
 * Pre-launch stress audit of the app shell: root layout and auth gate, tapped pushes, sessions and
 * their refresh, sign-out and account switching, the networking layer, the Inbox at scale, secure
 * storage, theme switching and the not-found screen. Runs against the real expo-router.
 *
 * Tests named "S<n>" prove a finding (they failed before its fix; "actual:" notes say what happened then); the rest
 * are stress checks. S2, S4, S7 and the sign-out deadline of S8 are in stress-session.test.tsx.
 */
jest.unmock("expo-router");
jest.mock("expo-router/build/testing-library/mocks", () => {
  jest.mock("expo-linking", () => ({ ...jest.requireActual("expo-linking"), createURL: (path: string) => `outclass://${path}`, resolveScheme: () => "outclass", addEventListener: () => ({ remove() {} }) }));
  return {};
});
// A build's EAS project id, so this phone has a push token to register and unregister (app.config.ts).
jest.mock("expo-constants", () => {
  const actual = jest.requireActual("expo-constants");
  const constants = actual.default ?? actual;
  const expoConfig = { ...constants.expoConfig, extra: { ...constants.expoConfig?.extra, eas: { projectId: "23668155-43a1-4bf7-9b89-1f61a42b535b" } } };
  return { __esModule: true, ...actual, default: { ...constants, expoConfig } };
});
jest.mock("~/lib/report", () => ({ ...jest.requireActual("~/lib/report"), startReporting: () => false }));

/** The tapped push the app reads with useLastNotificationResponse, changeable while the app runs. */
const mockPush = {
  value: null as unknown,
  listeners: new Set<() => void>(),
  set(value: unknown) { mockPush.value = value; for (const listener of mockPush.listeners) listener(); },
};
jest.mock("expo-notifications", () => ({
  useLastNotificationResponse: () => require("react").useSyncExternalStore((listener: () => void) => { mockPush.listeners.add(listener); return () => { mockPush.listeners.delete(listener); }; }, () => mockPush.value),
  clearLastNotificationResponseAsync: jest.fn(async () => {}),
  getPermissionsAsync: jest.fn(async () => ({ status: "granted", granted: true, canAskAgain: true, ios: { status: 2 } })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted", granted: true, canAskAgain: true })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: "ExponentPushToken[test]" })),
  unregisterForNotificationsAsync: jest.fn(async () => {}),
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  setBadgeCountAsync: jest.fn(async () => true),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3 },
  IosAuthorizationStatus: { NOT_DETERMINED: 0, DENIED: 1, AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { focusManager, QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { act, fireEvent, renderRouter, screen, within } from "expo-router/testing-library";
import type { ReactNode } from "react";
import { INBOX_KEY, useInboxActions } from "~/components/inbox/data";
import { groupRows, filterRows } from "~/components/inbox/presentation";
import { api as mockedApi, ApiError } from "~/lib/api";
import { AuthProvider, useAuth } from "~/lib/auth";
import { useMiddleTab } from "~/lib/middle-tab";
import { createQueryClient, shouldRetry } from "~/lib/query";
import { secureStorage } from "~/lib/secure-storage";
import { signInFailure } from "~/lib/sign-in-error";
import { supabase } from "~/lib/supabase";
import type { InboxRow, InboxRows } from "~/lib/types";
import { apiState, resetApi } from "./api-state";
import { session } from "./session";

const realApi = (jest.requireActual("~/lib/api") as typeof import("~/lib/api")).api;

type NavState = { index: number; routes: { name: string; state?: NavState }[] };
const rootStack = (state: unknown) => ((state as NavState).routes[0].state as NavState).routes.map(route => route.name);
const auth = supabase.auth as unknown as Record<string, jest.Mock>;
const signedOutSession = () => Promise.resolve({ data: { session: null }, error: null });
const signedInSession = () => Promise.resolve({ data: { session }, error: null });
const sessionB = { ...session, access_token: "user-b-access-token", refresh_token: "user-b-refresh", user: { ...session.user, id: "user-2", email: "other@virginia.edu" } };

let errors: string[] = [];
beforeEach(() => {
  mockPush.value = null;
  errors = [];
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => { errors.push(args.map(String).join(" ")); });
  for (const name of ["getSession", "signOut", "refreshSession", "onAuthStateChange"]) auth[name].mockClear();
  (Notifications.unregisterForNotificationsAsync as jest.Mock).mockClear();
  auth.getSession.mockImplementation(signedInSession);
  auth.signOut.mockImplementation(() => Promise.resolve({ error: null }));
  auth.refreshSession.mockImplementation(() => Promise.resolve({ data: { session }, error: null }));
  (mockedApi.get as jest.Mock).mockClear();
  (mockedApi.post as jest.Mock).mockClear();
});
/** Undo steps a test registers as it goes, so a failing assertion never leaks a mounted hook, a cache or a mock into the next test. */
const cleanups: (() => unknown)[] = [];
afterEach(() => {
  for (const undo of cleanups.splice(0).reverse()) { try { void undo(); } catch { /* keep undoing */ } }
  const { resolveFixture } = jest.requireActual("./api-state") as typeof import("./api-state");
  (mockedApi.get as jest.Mock).mockImplementation((operation: string, input?: unknown) => resolveFixture("GET", operation, input));
  (mockedApi.post as jest.Mock).mockImplementation((operation: string, input?: unknown) => resolveFixture("POST", operation, input));
  jest.restoreAllMocks();
  jest.useRealTimers();
});

/** Lets the app run (the router's fake clock, the API's promises and the effects after them). */
async function settle(ms = 1000) {
  for (let elapsed = 0; elapsed < ms; elapsed += 100) {
    await act(async () => { jest.advanceTimersByTime(100); for (let i = 0; i < 5; i++) await Promise.resolve(); });
  }
}
const pushFor = (url: string, id = `push-${Math.random()}`) => ({ notification: { request: { identifier: id, content: { data: { url } } } } });
/** The app on Home, then (when asked) a screen pushed over it. expo-router keeps the first render's initial URL for later renders in a file, so every render starts at "/". */
async function openApp(path = "/") {
  const app = await renderRouter("./src/app", { initialUrl: "/" });
  // Unmounted while the router's fake clock still runs, so no app outlives its test.
  cleanups.push(() => app.unmount());
  await settle();
  if (path !== "/") { await act(async () => router.push(path as never)); await settle(); }
  return app;
}
const authCallback = () => auth.onAuthStateChange.mock.calls.at(-1)![0] as (event: string, next: unknown) => void;
async function signInNow() {
  auth.getSession.mockImplementation(signedInSession);
  await act(async () => authCallback()("SIGNED_IN", session));
  await settle(2000);
}

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const row = (n: number, unread: boolean): InboxRow => ({
  id: uuid(900000 + n), clubId: null, type: n % 7 ? "ANNOUNCEMENT" : "INTERVIEW", title: `Update ${n}`, body: `Body ${n}`, href: null,
  readAt: unread ? null : "2026-09-01T12:00:00.000Z", archivedAt: null, createdAt: new Date(Date.UTC(2026, 10, 20) - n * 60_000).toISOString(), club: null,
});

// =================================================================================================
// Session end, account switching, token refresh
// =================================================================================================
function wrapperWith(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}><AuthProvider>{children}</AuthProvider></QueryClientProvider>;
}
const newClient = () => { const client = createQueryClient(); client.setDefaultOptions({ ...client.getDefaultOptions(), queries: { ...client.getDefaultOptions().queries, retry: false } }); return client; };

describe("session end and account switching", () => {
  test("two requests refused together share one refresh and both succeed after it", async () => {
    let refreshed = false;
    auth.getSession.mockImplementation(() => Promise.resolve({ data: { session: refreshed ? { ...session, access_token: "fresh" } : session }, error: null }));
    auth.refreshSession.mockImplementation(async () => { await new Promise(resolve => setTimeout(resolve, 10)); refreshed = true; return { data: { session }, error: null }; });
    const realFetch = globalThis.fetch;
    globalThis.fetch = jest.fn(async (_url: string, init: RequestInit) => {
      const ok = (init.headers as Record<string, string>).Authorization === "Bearer fresh";
      return ok ? { ok: true, status: 200, json: async () => ({ data: "ok" }) } : { ok: false, status: 401, json: async () => ({ error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } }) };
    }) as never;
    try {
      await expect(Promise.all([realApi.get("me"), realApi.get("home.view"), realApi.get("inbox")])).resolves.toEqual(["ok", "ok", "ok"]);
    } finally { globalThis.fetch = realFetch; }
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  test("a refresh that can't reach Auth (offline) keeps the person signed in", async () => {
    auth.refreshSession.mockImplementation(() => Promise.resolve({ data: { session: null }, error: { name: "AuthRetryableFetchError", status: 0, message: "Network request failed" } }));
    const realFetch = globalThis.fetch;
    globalThis.fetch = jest.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } }) })) as never;
    try { await expect(realApi.get("me")).rejects.toMatchObject({ status: 401 }); } finally { globalThis.fetch = realFetch; }
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  test("retries: refusals and rate limits are not retried, outages twice, a timeout once", () => {
    expect(shouldRetry(0, new ApiError(429, "RATE_LIMITED", "Too many"))).toBe(false);
    expect(shouldRetry(0, new ApiError(401, "UNAUTHENTICATED", "x"))).toBe(false);
    expect(shouldRetry(0, new ApiError(403, "FORBIDDEN", "x"))).toBe(false);
    expect(shouldRetry(1, new ApiError(500, "UNAVAILABLE", "x"))).toBe(true);
    expect(shouldRetry(2, new ApiError(503, "UNAVAILABLE", "x"))).toBe(false);
    expect(shouldRetry(0, new ApiError(0, "TIMEOUT", "x"))).toBe(true);
    expect(shouldRetry(1, new ApiError(0, "TIMEOUT", "x"))).toBe(false);
  });

  test("a 429 answer with only a message reads as rate limited, not as a sign-out", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = jest.fn(async () => ({ ok: false, status: 429, json: async () => ({ error: "Too many requests." }) })) as never;
    try { await expect(realApi.get("me")).rejects.toMatchObject({ status: 429, code: "RATE_LIMITED" }); } finally { globalThis.fetch = realFetch; }
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  // S9: the Apply / My Clubs choice is kept on the phone under one key for every account (lib/middle-tab.ts)
  // and sign-out doesn't remove it, so the next account's dock shows the previous account's tab.
  test("S9 after sign-out the next account's dock does not start from the previous account's middle tab", async () => {
    await AsyncStorage.setItem("outclass.middle-tab", "clubs"); // what account A's phone kept
    cleanups.push(() => AsyncStorage.removeItem("outclass.middle-tab"));
    const client = newClient();
    resetApi("rich");
    const { resolveFixture } = jest.requireActual("./api-state") as typeof import("./api-state");
    (mockedApi.get as jest.Mock).mockImplementation((operation: string, input?: unknown) => operation === "me" || operation === "applications.view" ? new Promise(() => {}) : resolveFixture("GET", operation, input));
    const { result, unmount } = await renderHook(() => ({ auth: useAuth(), tab: useMiddleTab() }), { wrapper: wrapperWith(client) });
    cleanups.push(() => { unmount(); client.clear(); });
    await waitFor(() => expect(result.current.auth.session).toBeTruthy());
    await act(async () => { await result.current.auth.signOut(); });
    await act(async () => authCallback()("SIGNED_IN", sessionB));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    expect(result.current.tab).toBe("apply"); // actual: "clubs", account A's
    await AsyncStorage.removeItem("outclass.middle-tab");
    (mockedApi.get as jest.Mock).mockImplementation((operation: string, input?: unknown) => resolveFixture("GET", operation, input));
  });

  test("an account change clears the query cache (and a refresh of the same account doesn't)", async () => {
    const client = newClient();
    const { result, unmount } = await renderHook(() => useAuth(), { wrapper: wrapperWith(client) });
    cleanups.push(() => { unmount(); client.clear(); });
    await waitFor(() => expect(result.current.session).toBeTruthy());
    client.setQueryData(["me", null], { email: "a@virginia.edu" });
    await act(async () => authCallback()("TOKEN_REFRESHED", { ...session, access_token: "new" }));
    expect(client.getQueryData(["me", null])).toBeTruthy();
    await act(async () => authCallback()("SIGNED_IN", sessionB));
    expect(client.getQueryData(["me", null])).toBeUndefined();
  });
});

// =================================================================================================
// Sign-in messages
// =================================================================================================
describe("sign-in", () => {
  // S5: Supabase answers a password sign-in on an unconfirmed address with 400 email_not_confirmed. lib/sign-in-error.ts
  // treats every 400 as a wrong password; the web (lib/auth-email.ts) says to confirm the email first.
  test("S5 an account whose email isn't confirmed is not told its password is wrong", () => {
    const failure = signInFailure({ name: "AuthApiError", status: 400, code: "email_not_confirmed", message: "Email not confirmed" }, false);
    expect(failure.message).not.toBe("That email or password isn't right."); // actual: exactly that
    expect(failure.message).toBe("Confirm your UVA email before signing in."); // the web's wording (lib/auth-email.ts)
  });

  test("wrong password, rate limit and no connection keep their own wording", () => {
    expect(signInFailure({ status: 400, code: "invalid_credentials", message: "Invalid login credentials" }, false).message).toBe("That email or password isn't right.");
    expect(signInFailure({ status: 429, message: "Too many" }, false).message).toMatch(/Too many attempts/);
    expect(signInFailure({ name: "AuthRetryableFetchError", status: 0, message: "" }, false).message).toMatch(/couldn't reach/);
  });
});

// =================================================================================================
// Inbox at scale
// =================================================================================================
/** An inbox server: 50 per page newest first, cursor = last id, with read state. */
function inboxServer(total: number, isUnread: (n: number) => boolean) {
  const rows = Array.from({ length: total }, (_, index) => row(index + 1, isUnread(index + 1)));
  const unread = () => rows.filter(item => !item.readAt).length;
  return {
    unread,
    fixtures: {
      inbox: (input?: { cursor?: string }) => {
        const start = input?.cursor ? rows.findIndex(item => item.id === input.cursor) + 1 : 0;
        const items = rows.slice(start, start + 50);
        return { items, nextCursor: start + 50 < rows.length ? items.at(-1)!.id : null, unread: unread() } satisfies InboxRows;
      },
      "inbox.read": ({ ids, read }: { ids: string[]; read: boolean }) => {
        if (ids.length > 100) throw new ApiError(400, "INVALID_REQUEST", "That request was not understood.");
        for (const item of rows) if (ids.includes(item.id)) item.readAt = read ? "2026-11-24T12:00:00.000Z" : null;
        return { updated: ids.length };
      },
    },
  };
}

describe("Inbox at scale", () => {
  // S6: components/inbox/data.ts readAll pages through at most 40 pages (2,000 rows), so unread updates
  // older than the 2,000th stay unread on the server after "Mark all read".
  test("S6 Mark all read marks every unread update, also past the 2,000th", async () => {
    const server = inboxServer(2_050, n => n > 2_000);
    resetApi("rich", server.fixtures);
    const client = newClient();
    const { result, unmount } = await renderHook(() => useInboxActions(), { wrapper: wrapperWith(client) });
    cleanups.push(() => { unmount(); client.clear(); });
    await act(async () => { await result.current.readAll.mutateAsync().catch(() => {}); });
    expect(server.unread()).toBe(0); // actual: 50
  });

  test("Mark all read with 2,000 unread sends 20 requests of at most 100 ids and leaves none unread", async () => {
    const server = inboxServer(2_000, () => true);
    resetApi("rich", server.fixtures);
    const client = newClient();
    const { result, unmount } = await renderHook(() => useInboxActions(), { wrapper: wrapperWith(client) });
    cleanups.push(() => { unmount(); client.clear(); });
    await act(async () => { await result.current.readAll.mutateAsync(); });
    expect(server.unread()).toBe(0);
    expect(apiState.calls.filter(call => call.operation === "inbox.read")).toHaveLength(20);
  });

  test("grouping 2,000 rows stays cheap enough to run on every minute tick", () => {
    const items = Array.from({ length: 2_000 }, (_, index) => row(index + 1, true));
    const started = performance.now();
    for (let run = 0; run < 5; run++) groupRows(filterRows(items, "all", "All"));
    expect((performance.now() - started) / 5).toBeLessThan(100);
  });
});

// =================================================================================================
// Secure storage
// =================================================================================================
describe("secure storage of the session", () => {
  const bigSession = (name: string) => JSON.stringify({ ...session, access_token: "eyJ".padEnd(1200, "a"), user: { ...session.user, user_metadata: { firstName: name, lastName: "Smith".repeat(20) }, identities: Array.from({ length: 3 }, () => ({ provider: "email", identity_data: { email: "student@virginia.edu" } })) } });

  test("every stored piece of a large session stays under SecureStore's 2,048-byte guidance and reads back whole", async () => {
    const value = bigSession("José");
    await secureStorage.setItem("sb-test-auth-token", value);
    const set = (SecureStore.setItemAsync as jest.Mock).mock.calls.filter(([key]) => String(key).startsWith("sb-test-auth-token."));
    for (const [, piece] of set) expect(new TextEncoder().encode(String(piece)).length).toBeLessThanOrEqual(2048);
    await expect(secureStorage.getItem("sb-test-auth-token")).resolves.toBe(value);
    await secureStorage.removeItem("sb-test-auth-token");
    await expect(secureStorage.getItem("sb-test-auth-token")).resolves.toBeNull();
  });

});

// =================================================================================================
// Pushes and the auth gate
// =================================================================================================
describe("tapped pushes (Nov 21: an Inbox push stacked a second set of tabs)", () => {
  test("signed in: a push on a cold start opens one Inbox over one set of tabs", async () => {
    resetApi("rich");
    mockPush.value = pushFor("/inbox");
    const app = await openApp();
    await settle(1000);
    expect(app.getPathname()).toBe("/inbox");
    expect(rootStack(app.getRouterState())).toEqual(["(tabs)", "inbox"]);
  });

  test("signed in: pushes while the app runs reuse the Inbox and a tab push closes everything above the tabs", async () => {
    resetApi("rich");
    const app = await openApp();
    await act(async () => router.push("/settings"));
    await settle();
    await act(async () => mockPush.set(pushFor("/inbox")));
    await settle();
    await act(async () => mockPush.set(pushFor("/inbox")));
    await settle();
    expect(rootStack(app.getRouterState())).toEqual(["(tabs)", "settings/index", "inbox"]);
    await act(async () => mockPush.set(pushFor("/home")));
    await settle();
    expect(rootStack(app.getRouterState())).toEqual(["(tabs)"]);
    expect(screen.getAllByTestId("tab-dock")).toHaveLength(1);
  });

  // S1: the push effect in src/app/_layout.tsx runs as soon as `signedIn` is true, while the gate is still
  // on sign-in waiting for `me`. It navigates on top of sign-in, so the gate never replaces sign-in.
  test("S1 a push tapped while signed out opens the Inbox after sign-in without leaving sign-in underneath", async () => {
    resetApi("rich");
    auth.getSession.mockImplementation(signedOutSession);
    mockPush.value = pushFor("/inbox");
    const app = await openApp();
    expect(app.getPathname()).toBe("/sign-in");
    await signInNow();
    expect(app.getPathname()).toBe("/inbox");
    expect(rootStack(app.getRouterState())).toEqual(["(tabs)", "inbox"]); // actual: ["sign-in", "inbox"]
  });

  test("S1 a push for a tab tapped while signed out never puts the tabs (with a Back arrow) over sign-in", async () => {
    resetApi("rich");
    auth.getSession.mockImplementation(signedOutSession);
    mockPush.value = pushFor("/calendar");
    const app = await openApp();
    await signInNow();
    expect(app.getPathname()).toBe("/calendar");
    expect(rootStack(app.getRouterState())).toEqual(["(tabs)"]); // actual: ["sign-in", "(tabs)"]
    expect(screen.queryByTestId("header-back")).toBeNull(); // actual: the Calendar tab shows Back, to the sign-in screen
  });
});

describe("router: sign-out and the Inbox on the real app", () => {
  // S8 (the duplicate): Settings > Sign out (src/app/settings/account.tsx) unregistered push itself and then called
  // signOut(), which unregisters again (lib/auth.tsx). The screen now leaves that to signOut() alone.
  test("S8 Settings > Sign out leaves stopping push to signOut() and doesn't send push.unregister itself", async () => {
    resetApi("rich");
    const authModule = require("~/lib/auth") as typeof import("~/lib/auth");
    const realUseAuth = authModule.useAuth;
    const signOut = jest.fn(async () => {});
    jest.spyOn(authModule, "useAuth").mockImplementation(() => ({ ...realUseAuth(), signOut }));
    const app = await openApp("/settings/account");
    expect(app.getPathname()).toBe("/settings/account");
    await fireEvent.press(screen.getByTestId("settings-sign-out"));
    await settle(600);
    await fireEvent.press(screen.getByTestId("confirm-accept"));
    await settle(3000);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect((mockedApi.post as jest.Mock).mock.calls.filter(([operation]) => operation === "push.unregister")).toEqual([]); // actual: one, before signOut() sends its own
  });

  test("a 2,000-row Inbox renders a window of rows, filters and opens without errors", async () => {
    const items = Array.from({ length: 2_000 }, (_, index) => row(index + 1, index % 3 === 0));
    resetApi("rich", { inbox: { items, nextCursor: null, unread: items.filter(item => !item.readAt).length } });
    const app = await openApp("/inbox");
    expect(app.getPathname()).toBe("/inbox");
    const rendered = screen.queryAllByTestId(/^inbox-row-(announcement|interview)$/).length;
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(100);
    await fireEvent.press(screen.getByText(/^Unread \(/));
    await settle(300);
    expect(screen.queryAllByTestId(/^inbox-row-/).length).toBeGreaterThan(0);
    expect(errors.filter(line => /Maximum update depth|TypeError|key/.test(line))).toEqual([]);
  });

});

// =================================================================================================
// Render loops, focus storms, theme, not-found
// =================================================================================================
describe("render loops and effect storms", () => {
  test("switching Light / Dark / System thirty times keeps one dock and never loops", async () => {
    resetApi("rich");
    const app = await openApp("/settings");
    for (let round = 0; round < 10; round++) {
      for (const label of ["Dark", "Light", "System"]) {
        await fireEvent.press(within(screen.getByTestId("settings-appearance")).getByLabelText(label));
        await settle(100);
      }
    }
    expect(app.getPathname()).toBe("/settings");
    expect(errors.filter(line => /Maximum update depth|Too many re-renders/.test(line))).toEqual([]);
  });

  test("the app coming back to the foreground twenty times in a second refetches each screen at most once", async () => {
    resetApi("rich");
    await openApp();
    await settle(31_000); // everything is stale now
    const before = (mockedApi.get as jest.Mock).mock.calls.length;
    for (let flip = 0; flip < 20; flip++) {
      await act(async () => { focusManager.setFocused(false); focusManager.setFocused(true); });
      await settle(50);
    }
    await settle(1000);
    const calls = (mockedApi.get as jest.Mock).mock.calls.slice(before).map(([operation]) => operation as string);
    const perOperation = calls.reduce<Record<string, number>>((counts, operation) => ({ ...counts, [operation]: (counts[operation] ?? 0) + 1 }), {});
    for (const count of Object.values(perOperation)) expect(count).toBeLessThanOrEqual(2);
    focusManager.setFocused(undefined);
  });

  test("a dozen sign-out / sign-in cycles leave one dock, Home, and no loop", async () => {
    resetApi("rich");
    const app = await openApp();
    for (let cycle = 0; cycle < 12; cycle++) {
      auth.getSession.mockImplementation(signedOutSession);
      await act(async () => authCallback()("SIGNED_OUT", null));
      await settle(300);
      expect(app.getPathname()).toBe("/sign-in");
      await signInNow();
      expect(app.getPathname()).toBe("/");
    }
    expect(rootStack(app.getRouterState())).toEqual(["(tabs)"]);
    expect(screen.getAllByTestId("tab-dock")).toHaveLength(1);
    expect(errors.filter(line => /Maximum update depth/.test(line))).toEqual([]);
  });

  test("an unknown link lands on Not found, and Go to Home gives one set of tabs", async () => {
    resetApi("rich");
    const app = await openApp("/this/is/not/a/screen");
    expect(screen.getByTestId("not-found-screen")).toBeTruthy();
    expect(rootStack(app.getRouterState())).toEqual(["(tabs)", "+not-found"]);
    await fireEvent.press(screen.getByLabelText("Go to Home"));
    await settle(600);
    expect(app.getPathname()).toBe("/");
    expect(rootStack(app.getRouterState())).toEqual(["(tabs)"]);
  });
});

// Last in the file: a mutation left running across an account change (as in the app) disturbs later renders in this file.
describe("account switching mid-request", () => {
  // S3: queryClient.clear() on an account change does not stop a mutation already running. Its onError
  // rollback (components/inbox/data.ts rollback) then writes the previous account's Inbox pages and its
  // whole Home view back into the cache the next account reads, fresh for 30 s.
  test("S3 a mark-read that fails after the account changed never writes the previous account's Inbox and Home into the cache", async () => {
    const client = newClient();
    const homeA = { unread: 3, inboxUnread: 3, marker: "account A's home view" };
    client.setQueryData(INBOX_KEY, { pages: [{ items: [row(1, true)], nextCursor: null, unread: 3 }], pageParams: [undefined] });
    client.setQueryData(["home.view", null], homeA);
    let fail: ((error: unknown) => void) | undefined;
    resetApi("rich");
    const { resolveFixture } = jest.requireActual("./api-state") as typeof import("./api-state");
    (mockedApi.post as jest.Mock).mockImplementation((operation: string, input?: unknown) => operation === "inbox.read" ? new Promise((_, reject) => { fail = reject; }) : resolveFixture("POST", operation, input));
    const { result, unmount } = await renderHook(() => ({ auth: useAuth(), inbox: useInboxActions() }), { wrapper: wrapperWith(client) });
    cleanups.push(() => { unmount(); client.clear(); });
    await waitFor(() => expect(result.current.auth.session).toBeTruthy());
    act(() => { result.current.inbox.read.mutate({ ids: [uuid(900001)], read: true }); });
    await waitFor(() => expect(fail).toBeDefined());
    // A signs out and B signs in while the request is still out (a slow connection; POSTs wait up to 30 s).
    await act(async () => authCallback()("SIGNED_OUT", null));
    await act(async () => authCallback()("SIGNED_IN", sessionB));
    expect(client.getQueryData(["home.view", null])).toBeUndefined();
    await act(async () => { fail!(new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.")); for (let i = 0; i < 30; i++) await Promise.resolve(); });
    expect(client.getQueryData(["home.view", null])).toBeUndefined(); // actual: account A's home view
    expect(client.getQueryData(INBOX_KEY)).toBeUndefined(); // actual: account A's inbox
    (mockedApi.post as jest.Mock).mockImplementation((operation: string, input?: unknown) => resolveFixture("POST", operation, input));
  });
});
