const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const { NextRequest } = require("next/server");
function load(file, mocks = {}) {
  const mod = { exports: {} };
  new Function(
    "require",
    "module",
    "exports",
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  )(
    (n) =>
      n in mocks
        ? mocks[n]
        : n.startsWith("@/lib/")
          ? load(n.slice(2) + ".ts", mocks)
          : require(n),
    mod,
    mod.exports,
  );
  return mod.exports;
}
function harness(overrides = {}) {
  const calls = [];
  const auth = {
    resetPasswordForEmail: async (...args) => {
      calls.push(["request", ...args]);
      return { error: null };
    },
    verifyOtp: async (args) => {
      calls.push(["verify", args]);
      return {
        data: { session: {}, user: { email: "student@virginia.edu" } },
        error: null,
      };
    },
    updateUser: async (args) => {
      calls.push(["update", args]);
      return { error: null };
    },
    signOut: async (args) => {
      calls.push(["signOut", args]);
      return { error: null };
    },
    ...overrides,
  };
  const { POST } = load("app/api/auth/password-recovery/route.ts", {
    "@supabase/supabase-js": {
      createClient: (_url, _key, options) => {
        assert.equal(options.auth.persistSession, false);
        assert.equal(options.auth.autoRefreshToken, false);
        return { auth };
      },
    },
  });
  return {
    calls,
    send: (body, headers = {}) =>
      POST(
        new NextRequest("https://outclass.example/api/auth/password-recovery", {
          method: "POST",
          headers: {
            origin: "https://outclass.example",
            "content-type": "application/json",
            ...headers,
          },
          body: JSON.stringify(body),
        }),
      ),
  };
}
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-test-key";
const reset = {
  action: "reset",
  tokenHash: "a".repeat(64),
  password: "a sufficiently long password",
  confirmation: "a sufficiently long password",
};
test("recovery requests normalize email and never expose account/provider outcomes", async () => {
  const ok = harness(),
    denied = harness({
      resetPasswordForEmail: async () => ({
        error: { code: "user_not_found" },
      }),
    }),
    offline = harness({
      resetPasswordForEmail: async () => {
        throw new Error("network");
      },
    });
  const body = { action: "request", email: " Student@Virginia.edu " };
  const expected = await (await ok.send(body)).json();
  for (const h of [denied, offline]) {
    const response = await h.send(body);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), expected);
  }
  assert.deepEqual(ok.calls[0], [
    "request",
    "student@virginia.edu",
    { redirectTo: "https://outclass.example/reset-password" },
  ]);
});
test("origin, demo, view-as, UVA and password validation fail before provider calls", async () => {
  const h = harness();
  for (const [body, headers, status] of [
    [reset, { origin: "https://evil.example" }, 403],
    [reset, { cookie: "outclass-demo-session=1" }, 403],
    [reset, { cookie: "outclass-platform-view=stale" }, 403],
    [{ action: "request", email: "user@example.com" }, {}, 400],
    [{ ...reset, confirmation: "mismatch" }, {}, 400],
    [{ ...reset, password: "short", confirmation: "short" }, {}, 400],
    [{ ...reset, tokenHash: "" }, {}, 400],
  ])
    assert.equal((await h.send(body, headers)).status, status);
  assert.equal(h.calls.length, 0);
});
test("only provider recovery verification authorizes a password change; no auth cookie or token response", async () => {
  const h = harness();
  const response = await h.send(reset);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(h.calls, [
    ["verify", { token_hash: reset.tokenHash, type: "recovery" }],
    ["update", { password: reset.password }],
    ["signOut", { scope: "global" }],
  ]);
  assert.deepEqual(Object.keys(await response.json()), ["message"]);
});
test("expired/replayed token, missing session and non-UVA token never update password", async () => {
  for (const result of [
    { error: { message: "expired" }, data: {} },
    { data: { session: null, user: { email: "student@virginia.edu" } } },
    { data: { session: {}, user: { email: "outside@example.com" } } },
  ]) {
    const h = harness({ verifyOtp: async () => result });
    const response = await h.send(reset);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).needsNewLink, true);
    assert.equal(h.calls.length, 0);
  }
});
test("provider password policy failures invalidate the consumed link without exposing provider details", async () => {
  const h = harness({
    updateUser: async () => ({ error: { message: "private policy detail" } }),
  });
  const response = await h.send(reset),
    body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.needsNewLink, true);
  assert.doesNotMatch(body.error, /private policy detail/);
  assert.deepEqual(h.calls.at(-1), ["signOut", { scope: "local" }]);
});

test('a completed reset remains successful if subsequent session revocation fails', async () => {
  const h = harness({ signOut: async () => { throw new Error('provider outage') } })
  const response = await h.send(reset)
  assert.equal(response.status, 200)
  assert.match((await response.json()).message, /updated/)
})

test('missing provider configuration fails safely without attempting authentication', async () => {
  const previous = process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  try {
    const h = harness()
    assert.equal((await h.send(reset)).status, 503)
    assert.equal(h.calls.length, 0)
  } finally { process.env.NEXT_PUBLIC_SUPABASE_URL = previous }
})
