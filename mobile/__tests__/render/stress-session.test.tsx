/**
 * Pre-launch stress audit (stress-shell.test.tsx), the session-handling findings: a session that ends
 * without Sign out, a 401 retried after the account changed, the session's pieces in secure storage, and
 * Sign out's deadline. Each "S<n>" test proves a finding; "actual:" notes say what happened before its fix.
 */
// A build's EAS project id, so this phone has a push token to register and unregister (app.config.ts).
jest.mock("expo-constants", () => {
  const actual = jest.requireActual("expo-constants");
  const constants = actual.default ?? actual;
  const expoConfig = { ...constants.expoConfig, extra: { ...constants.expoConfig?.extra, eas: { projectId: "23668155-43a1-4bf7-9b89-1f61a42b535b" } } };
  return { __esModule: true, ...actual, default: { ...constants, expoConfig } };
});
jest.mock("~/lib/report", () => ({ ...jest.requireActual("~/lib/report"), startReporting: () => false }));

jest.mock("expo-notifications", () => ({
  useLastNotificationResponse: () => null,
  clearLastNotificationResponseAsync: jest.fn(async () => {}),
  getPermissionsAsync: jest.fn(async () => ({ status: "granted", granted: true, canAskAgain: true, ios: { status: 2 } })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted", granted: true, canAskAgain: true })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: "ExponentPushToken[test]" })),
  unregisterForNotificationsAsync: jest.fn(async () => {}),
  setAutoServerRegistrationEnabledAsync: jest.fn(async () => {}),
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
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import type { ReactNode } from "react";
import { api as mockedApi, ApiError } from "~/lib/api";
import { AuthProvider, useAuth } from "~/lib/auth";
import { createQueryClient } from "~/lib/query";
import { secureStorage } from "~/lib/secure-storage";
import { supabase } from "~/lib/supabase";
import { session } from "./session";

const realApi = (jest.requireActual("~/lib/api") as typeof import("~/lib/api")).api;

const auth = supabase.auth as unknown as Record<string, jest.Mock>;
const signedInSession = () => Promise.resolve({ data: { session }, error: null });
const sessionB = { ...session, access_token: "user-b-access-token", refresh_token: "user-b-refresh", user: { ...session.user, id: "user-2", email: "other@virginia.edu" } };

beforeEach(() => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
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

const authCallback = () => auth.onAuthStateChange.mock.calls.at(-1)![0] as (event: string, next: unknown) => void;

// =================================================================================================
// Session end, account switching, token refresh
// =================================================================================================
function wrapperWith(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}><AuthProvider>{children}</AuthProvider></QueryClientProvider>;
}
const newClient = () => { const client = createQueryClient(); client.setDefaultOptions({ ...client.getDefaultOptions(), queries: { ...client.getDefaultOptions().queries, retry: false } }); return client; };

describe("session end and account switching", () => {
  // S2: only the Sign out button unregisters push (lib/auth.tsx signOut). A session that ends any other way
  // (api.ts refreshAfterUnauthorized's local sign-out after a revoked/expired refresh token, or Supabase's own
  // refresh failing) goes straight to SIGNED_OUT: the device stays subscribed to the old account on the server.
  test("S2 a revoked session that signs this phone out also stops this phone receiving that account's pushes", async () => {
    await AsyncStorage.setItem("outclass:draft:user-1:application:1", JSON.stringify({ value: { answer: "kept on this phone" }, baseline: "", at: Date.now() }));
    cleanups.push(() => AsyncStorage.removeItem("outclass:draft:user-1:application:1"));
    const client = newClient();
    const { result, unmount } = await renderHook(() => useAuth(), { wrapper: wrapperWith(client) });
    cleanups.push(() => { unmount(); client.clear(); });
    await waitFor(() => expect(result.current.session).toBeTruthy());
    // The server refuses the token and Auth refuses the refresh (signed out everywhere / password changed).
    const realFetch = globalThis.fetch;
    globalThis.fetch = jest.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } }) })) as never;
    auth.refreshSession.mockImplementation(() => Promise.resolve({ data: { session: null }, error: { status: 400, message: "Invalid Refresh Token: Refresh Token Not Found" } }));
    auth.signOut.mockImplementation(async () => { await act(async () => authCallback()("SIGNED_OUT", null)); return { error: null }; });
    try {
      await expect(realApi.get("home.view")).rejects.toMatchObject({ status: 401 });
    } finally { globalThis.fetch = realFetch; }
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    await waitFor(() => expect(result.current.session).toBeNull());
    const unregistered = (mockedApi.post as jest.Mock).mock.calls.some(([operation]) => operation === "push.unregister")
      || (Notifications.unregisterForNotificationsAsync as jest.Mock).mock.calls.length > 0;
    expect(unregistered).toBe(true); // actual: nothing; the account's pushes keep arriving on this phone
    // And Expo's persisted auto-registration is off, so the next launch doesn't register the phone again.
    expect(Notifications.setAutoServerRegistrationEnabledAsync).toHaveBeenCalledWith(false);
    // Like Sign out, it takes the unsaved application answers kept on this phone with it.
    await waitFor(async () => expect(await AsyncStorage.getItem("outclass:draft:user-1:application:1")).toBeNull()); // actual: still there
  });

  // S4: lib/api.ts retries a 401 once after refreshSession(), with whatever session is current then. If the
  // account changed while the request was out, the request is replayed under the other account.
  test("S4 a request refused after the account changed is not re-sent with the other account's session", async () => {
    const sent: string[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = jest.fn(async (_url: string, init: RequestInit) => {
      const authorization = (init.headers as Record<string, string>).Authorization;
      sent.push(authorization);
      if (sent.length === 1) {
        // While A's request is out, A signs out and B signs in on this phone.
        auth.getSession.mockImplementation(() => Promise.resolve({ data: { session: sessionB }, error: null }));
        auth.refreshSession.mockImplementation(() => Promise.resolve({ data: { session: sessionB }, error: null }));
        return { ok: false, status: 401, json: async () => ({ error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } }) };
      }
      return { ok: true, status: 200, json: async () => ({ data: { cancelled: true } }) };
    }) as never;
    try {
      await realApi.post("account.deletion.cancel").catch(() => null);
    } finally { globalThis.fetch = realFetch; }
    expect(sent).toEqual([`Bearer ${session.access_token}`]); // actual: also sent as `Bearer user-b-access-token`
  });

});

// =================================================================================================
// Sign out
// =================================================================================================
describe("sign out", () => {
  // S8 (the deadline): signOut() in lib/auth.tsx stopped this device's pushes (up to 2.5 s) and only then started
  // its own 5 s deadline for Auth's sign-out, so a dead connection held Sign out for 7.5 s. Now one 5 s deadline
  // covers both. (Settings > Sign out also unregistered push itself first; that duplicate is removed with the shell fixes.)
  test("S8 signOut() on a dead connection signs this phone out within its 5 s deadline", async () => {
    const { resolveFixture } = jest.requireActual("./api-state") as typeof import("./api-state");
    // A dead connection: push.unregister never answers (api.ts would wait 30 s) and neither does Auth.
    (mockedApi.post as jest.Mock).mockImplementation((operation: string, input?: unknown) => operation === "push.unregister" ? new Promise(() => {}) : resolveFixture("POST", operation, input));
    let localAt = 0;
    auth.signOut.mockImplementation((options?: { scope?: string }) => { if (options?.scope === "local") { localAt = Date.now(); return Promise.resolve({ error: null }); } return new Promise(() => {}); });
    const client = newClient();
    const { result, unmount } = await renderHook(() => useAuth(), { wrapper: wrapperWith(client) });
    cleanups.push(() => { unmount(); client.clear(); });
    await waitFor(() => expect(result.current.session).toBeTruthy());
    jest.useFakeTimers();
    const pressedAt = Date.now();
    let done = false;
    result.current.signOut().then(() => { done = true; }, () => { done = true; });
    try {
      for (let waited = 0; !done && waited < 15_000; waited += 100) await act(async () => { jest.advanceTimersByTime(100); for (let i = 0; i < 10; i++) await Promise.resolve(); });
    } finally { (mockedApi.post as jest.Mock).mockImplementation((operation: string, input?: unknown) => resolveFixture("POST", operation, input)); }
    expect(done).toBe(true);
    expect((mockedApi.post as jest.Mock).mock.calls.filter(([operation]) => operation === "push.unregister")).toHaveLength(1); // the push step ran
    expect(localAt).toBeGreaterThan(0);
    expect(localAt - pressedAt).toBeLessThanOrEqual(5_000); // actual: 7,500 (2.5 s for push, then Auth's own 5 s)
  });
});

// =================================================================================================
// Secure storage
// =================================================================================================
describe("secure storage of the session", () => {
  const isWellFormed = (text: string) => !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(text);
  const bigSession = (name: string) => JSON.stringify({ ...session, access_token: "eyJ".padEnd(1200, "a"), user: { ...session.user, user_metadata: { firstName: name, lastName: "Smith".repeat(20) }, identities: Array.from({ length: 3 }, () => ({ provider: "email", identity_data: { email: "student@virginia.edu" } })) } });

  // S7: lib/secure-storage.ts cuts non-ASCII values every 600 UTF-16 units, which can split an emoji's
  // surrogate pair. Native SecureStore stores UTF-8, so each half becomes U+FFFD and the name in the
  // stored session no longer matches.
  test("S7 a session whose name has an emoji at a piece boundary reads back unchanged", async () => {
    const plain = bigSession("A");
    // Put an emoji (two UTF-16 units) across the 600-unit boundary.
    const start = plain.indexOf("\"firstName\":\"A") + "\"firstName\":\"".length;
    const boundary = Math.ceil((start + 1) / 600) * 600;
    const value = bigSession("A".repeat(boundary - 1 - start) + "🎉");
    expect(value.charCodeAt(boundary - 1)).toBe(0xd83c); // the emoji's first half is the last unit of a piece
    (SecureStore.setItemAsync as jest.Mock).mockClear();
    await secureStorage.setItem("sb-emoji-auth-token", value);
    const pieces = (SecureStore.setItemAsync as jest.Mock).mock.calls.filter(([key]) => /^sb-emoji-auth-token\.\d+$/.test(String(key))).map(([, piece]) => String(piece));
    expect(pieces.every(isWellFormed)).toBe(true); // actual: a piece ends in half an emoji
    // What a UTF-8 keychain gives back.
    const roundTrip = pieces.map(piece => new TextDecoder().decode(new TextEncoder().encode(piece))).join("");
    expect(roundTrip).toBe(value);
    await secureStorage.removeItem("sb-emoji-auth-token");
  });
});
