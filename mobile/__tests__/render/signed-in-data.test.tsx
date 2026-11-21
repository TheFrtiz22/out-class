/**
 * Data after sign-in. The app called https://out-class.net, which answers every request with a 308
 * to www.out-class.net. A redirect to another host drops the Authorization header, so every
 * signed-in request reached the server without its session: "This didn't load / Sign in to
 * continue" on every tab, and a session refresh after each one. The app now calls www directly.
 */
import { apiBase, config } from "~/lib/config";

const { api, ApiError } = jest.requireActual("~/lib/api") as typeof import("~/lib/api");

/** Production as it answers: the apex redirects to www, the redirect drops Authorization, and the API needs a session. */
function production(seen: { url: string; authorized: boolean }[]) {
  const answer = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  const call = async (url: string, init: RequestInit): Promise<ReturnType<typeof answer>> => {
    const headers = { ...(init.headers as Record<string, string>) };
    const target = new URL(url);
    if (target.host === "out-class.net") {
      delete headers.Authorization;
      target.host = "www.out-class.net";
      return call(target.toString(), { ...init, headers });
    }
    seen.push({ url, authorized: !!headers.Authorization });
    return headers.Authorization ? answer(200, { data: { ok: true } }) : answer(401, { error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } });
  };
  return jest.fn(call);
}

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

test("the API address is the host that serves it, never the apex that redirects", () => {
  expect(config.apiUrl).toBe("https://www.out-class.net");
  expect(apiBase("https://out-class.net")).toBe("https://www.out-class.net");
  expect(apiBase("https://out-class.net/")).toBe("https://www.out-class.net");
  expect(apiBase(" https://OUT-CLASS.NET ")).toBe("https://www.out-class.net");
  // School subdomains, staging and a local server are left as they are.
  expect(apiBase("https://uva.out-class.net")).toBe("https://uva.out-class.net");
  expect(apiBase("https://staging.out-class.net/")).toBe("https://staging.out-class.net");
  expect(apiBase("http://localhost:3000")).toBe("http://localhost:3000");
});

test("a signed-in request reaches the server with its session and returns data", async () => {
  const seen: { url: string; authorized: boolean }[] = [];
  globalThis.fetch = production(seen) as unknown as typeof fetch;
  await expect(api.get("home.view")).resolves.toEqual({ ok: true });
  expect(seen).toEqual([{ url: "https://www.out-class.net/api/mobile/v1/home.view", authorized: true }]);
});

test("the old apex address is what lost the session (the bug this guards)", async () => {
  const seen: { url: string; authorized: boolean }[] = [];
  const fetch = production(seen);
  const response = await fetch("https://out-class.net/api/mobile/v1/home.view", { headers: { Authorization: "Bearer a.b.c" } });
  expect(response.status).toBe(401);
  expect(seen[0].authorized).toBe(false);
  expect(new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.").signedOut).toBe(true);
});
