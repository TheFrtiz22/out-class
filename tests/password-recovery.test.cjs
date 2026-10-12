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
    [{ ...reset, authenticatorCode: "12" }, {}, 400],
    [{ ...reset, authenticatorCode: "1234567" }, {}, 400],
    [{ ...reset, authenticatorCode: "abcdef" }, {}, 400],
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

test('MFA-protected recovery explains the assurance requirement and revokes the isolated session', async () => {
  const h = harness({ updateUser: async () => ({ error: { code: 'insufficient_aal', status: 401, message: 'private provider detail' } }) });
  const response = await h.send(reset), body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.needsNewLink, true);
  assert.match(body.error, /multi-factor authentication/);
  assert.doesNotMatch(body.error, /private provider detail|security requirements and differ/);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.deepEqual(h.calls.at(-1), ['signOut', { scope: 'local' }]);
});

function mfaHarness(overrides = {}) {
  const actor = { id: 'recovered-user', email: 'student@virginia.edu' };
  return harness({
    verifyOtp: async () => ({ data: { session: {}, user: actor }, error: null }),
    getUser: async () => ({ data: { user: actor }, error: null }),
    mfa: {
      listFactors: async () => ({ data: { totp: [{ id: 'owned-factor', status: 'verified' }] }, error: null }),
      challengeAndVerify: async (input) => {
        assert.deepEqual(input, { factorId: 'owned-factor', code: '123456' });
        return { data: {}, error: null };
      },
      getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal2' }, error: null }),
      ...overrides.mfa,
    },
    ...Object.fromEntries(Object.entries(overrides).filter(([name]) => name !== 'mfa')),
  });
}
test('recovery plus verified owned authenticator and AAL2 permits the password change without attaching a session', async () => {
  const h = mfaHarness();
  const response = await h.send({ ...reset, authenticatorCode: '123456', factorId: 'attacker-factor', userId: 'attacker' });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.deepEqual(h.calls, [['update', { password: reset.password }], ['signOut', { scope: 'global' }]]);
  assert.deepEqual(Object.keys(await response.json()), ['message']);
});
test('MFA recovery rejects unverified factors, bad codes, wrong identity and AAL1 before changing a password', async () => {
  for (const overrides of [
    { mfa: { listFactors: async () => ({ data: { totp: [{ id: 'owned-factor', status: 'unverified' }] }, error: null }) } },
    { mfa: { listFactors: async () => ({ data: null, error: { message: 'private factor failure' } }) } },
    { mfa: { challengeAndVerify: async () => ({ data: null, error: { message: 'private bad code' } }) } },
    { getUser: async () => ({ data: { user: { id: 'attacker', email: 'student@virginia.edu' } }, error: null }) },
    { getUser: async () => ({ data: { user: { id: 'recovered-user', email: 'other@virginia.edu' } }, error: null }) },
    { mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal1' }, error: null }) } },
  ]) {
    const h = mfaHarness(overrides);
    const response = await h.send({ ...reset, authenticatorCode: '123456' });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.needsNewLink, true);
    assert.doesNotMatch(body.error, /private|attacker|owned-factor/);
    assert.deepEqual(h.calls, [['signOut', { scope: 'local' }]]);
  }
});
test('a code from a later verified authenticator works, while provider rate limits stop factor attempts', async () => {
  const attempted = [];
  const factors = async () => ({ data: { totp: [
    { id: 'not-verified', status: 'unverified' },
    { id: 'first-factor', status: 'verified' },
    { id: 'second-factor', status: 'verified' },
  ] }, error: null });
  const h = mfaHarness({ mfa: {
    listFactors: factors,
    challengeAndVerify: async ({ factorId }) => {
      attempted.push(factorId);
      return factorId === 'first-factor'
        ? { data: null, error: { code: 'mfa_verification_failed' } }
        : { data: {}, error: null };
    },
  } });
  assert.equal((await h.send({ ...reset, authenticatorCode: '123456' })).status, 200);
  assert.deepEqual(attempted, ['first-factor', 'second-factor']);
  const limited = [];
  const throttled = mfaHarness({ mfa: {
    listFactors: factors,
    challengeAndVerify: async ({ factorId }) => {
      limited.push(factorId);
      return { data: null, error: { code: 'over_request_rate_limit', status: 429 } };
    },
  } });
  assert.equal((await throttled.send({ ...reset, authenticatorCode: '123456' })).status, 400);
  assert.deepEqual(limited, ['first-factor']);
  assert.deepEqual(throttled.calls, [['signOut', { scope: 'local' }]]);
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
