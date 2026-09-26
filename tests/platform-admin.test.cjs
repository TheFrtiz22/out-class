const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  ts = require("typescript"),
  { NextRequest } = require("next/server");
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
        : n === "./supabase/server" && mocks["@/utils/supabase/server"] ? mocks["@/utils/supabase/server"]
        : n === "./prisma" && mocks["@/utils/prisma"] ? mocks["@/utils/prisma"]
        : n.startsWith("@/lib/")
          ? load(n.slice(2) + ".ts", mocks)
          : require(n),
    mod,
    mod.exports,
  );
  return mod.exports;
}
const actor = "00000000-0000-4000-8000-000000000001",
  target = "00000000-0000-4000-8000-000000000002",
  clubId = "00000000-0000-4000-8000-000000000003",
  cookie = "outclass-platform-view";
function sessionHarness() {
  let rows = [],
    logs = [],
    token,
    allowed = true,
    identity = actor,
    targetAdmin = false,
    member = true;
  const tx = {
    $queryRaw: async () => [],
    user: { findUnique: async () => ({ id: target, disabledAt: null }) },
    platformAdmin: {
      findUnique: async () => (targetAdmin ? { active: true } : null),
    },
    clubMember: { findUnique: async () => (member ? { id: "member" } : null) },
    platformViewSession: {
      findMany: async () => rows.filter((r) => !r.endedAt),
      findUnique: async ({ where }) =>
        rows.find(
          (r) => r.tokenHash === where.tokenHash || r.id === where.id,
        ) || null,
      create: async ({ data }) => {
        const r = { id: "session-" + rows.length, ...data, endedAt: null };
        rows.push(r);
        return r;
      },
      update: async ({ where, data }) =>
        Object.assign(
          rows.find((r) => r.id === where.id),
          data,
        ),
      updateMany: async ({ where, data }) => {
        const r = rows.find((r) => r.id === where.id && !r.endedAt);
        if (!r) return { count: 0 };
        Object.assign(r, data);
        return { count: 1 };
      },
    },
    auditLog: { create: async ({ data }) => logs.push(data) },
  };
  const prisma = { ...tx, $transaction: async (fn) => fn(tx) },
    jar = {
      get: () => (token ? { value: token } : undefined),
      has: () => !!token,
    };
  const admin = {
    requirePlatformAdmin: async (options = {}) => {
      if (!allowed || (token && !options.allowViewAs)) throw Error("Denied");
      return { id: identity };
    },
  };
  const mocks = {
    "@/utils/prisma": { prisma },
    "@/utils/platform-admin": admin,
    "next/headers": { cookies: async () => jar },
    "@/utils/supabase/server": {
      createClient: async () => ({
        auth: {
          getUser: async () => ({
            data: { user: { id: identity } },
            error: null,
          }),
        },
      }),
    },
  };
  const helper = load("utils/platform-view-as.ts", mocks);
  mocks["@/utils/platform-view-as"] = helper;
  return {
    api: load("app/api/platform/view-as/route.ts", mocks),
    helper,
    mocks,
    rows: () => rows,
    logs: () => logs,
    setToken: (t) => (token = t),
    revoke: () => (allowed = false),
    otherActor: () => (identity = target),
    targetAdmin: () => (targetAdmin = true),
    noMember: () => (member = false),
  };
}
const req = (body, origin = "https://outclass.test") =>
  new NextRequest("https://outclass.test/api/platform/view-as", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const start = {
  action: "start",
  userId: target,
  clubId,
  reason: "Investigating reported missing tasks.",
  confirmation: "VIEW ONLY",
};
test("view-as validates MFA guard, origin, explicit confirmation, target and membership before starting", async () => {
  for (const prepare of [
    (h) => h.revoke(),
    (h) => h.targetAdmin(),
    (h) => h.noMember(),
  ]) {
    const h = sessionHarness();
    prepare(h);
    assert.equal((await h.api.POST(req(start))).status, 403);
    assert.equal(h.rows().length, 0);
  }
  const h = sessionHarness();
  assert.equal((await h.api.POST(req(start, "https://evil.test"))).status, 403);
  assert.equal(
    (await h.api.POST(req({ ...start, confirmation: "" }))).status,
    403,
  );
  assert.equal(
    (await h.api.POST(req({ ...start, userId: actor }))).status,
    403,
  );
  assert.equal(h.rows().length, 0);
});
test("view-as stores only hashed tokens, binds original actor, preserves auth cookies, and audits explicit end", async () => {
  const h = sessionHarness(),
    response = await h.api.POST(req(start));
  assert.equal(response.status, 200);
  assert.equal(response.cookies.getAll().length, 1);
  const token = response.cookies.get(cookie).value;
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.notEqual(h.rows()[0].tokenHash, token);
  assert.equal(h.rows()[0].actorId, actor);
  assert.equal(h.logs()[0].action, "platform.view-as.start");
  h.setToken(token);
  assert.equal((await h.helper.platformViewSession()).targetUserId, target);
  h.otherActor();
  assert.equal(await h.helper.platformViewSession(), null);
  assert.equal((await h.api.POST(req({ action: "end" }))).status, 200);
  assert.equal(
    h.rows()[0].endedAt,
    null,
    "foreign actor cannot end another session record",
  );
  const owner = sessionHarness(),
    issued = await owner.api.POST(req(start));
  owner.setToken(issued.cookies.get(cookie).value);
  const ended = await owner.api.POST(req({ action: "end" }));
  assert.equal(ended.cookies.get(cookie).value, "");
  assert.ok(owner.rows()[0].endedAt);
  assert.equal(owner.logs().at(-1).action, "platform.view-as.end");
  assert.equal(ended.cookies.getAll().length, 1);
});
test("expiry, revoked grants, newly privileged targets and replaced sessions fail closed", async () => {
  const h = sessionHarness(),
    issued = await h.api.POST(req(start));
  h.setToken(issued.cookies.get(cookie).value);
  h.rows()[0].expiresAt = new Date(0);
  assert.equal(await h.helper.platformViewSession(), null);
  assert.equal(h.logs().at(-1).reason, "Session expired");
  const revoked = sessionHarness(),
    token = (await revoked.api.POST(req(start))).cookies.get(cookie).value;
  revoked.setToken(token);
  revoked.revoke();
  await assert.rejects(revoked.helper.platformViewSession(), /Denied/);
  const targetGrant = sessionHarness(),
    t = (await targetGrant.api.POST(req(start))).cookies.get(cookie).value;
  targetGrant.setToken(t);
  targetGrant.targetAdmin();
  assert.equal(await targetGrant.helper.platformViewSession(), null);
  const replaced = sessionHarness();
  await replaced.api.POST(req(start));
  await replaced.api.POST(req(start));
  assert.ok(replaced.rows()[0].endedAt);
  assert.equal(
    replaced.logs().filter((l) => l.action === "platform.view-as.end").length,
    1,
  );
});
test("middleware redirects normal navigation and routes all impersonated writes to audited denial", async () => {
  let live = 0;
  const { middleware } = load("middleware.ts", {
    "@/utils/supabase/middleware": {
      createClient: async () => {
        live++;
        return new Response("normal");
      },
    },
  });
  const headers = { cookie: `${cookie}=token` };
  assert.equal(
    (
      await middleware(
        new NextRequest("https://outclass.test/api/users/me", { headers }),
      )
    ).status,
    403,
  );
  assert.equal(
    new URL(
      (
        await middleware(
          new NextRequest("https://outclass.test/club/x/workspace", {
            headers,
          }),
        )
      ).headers.get("location"),
    ).pathname,
    "/platform/view-as",
  );
  for (const method of ["POST", "PATCH", "DELETE"]) {
    const response = await middleware(
      new NextRequest("https://outclass.test/platform", { method, headers }),
    );
    assert.equal(
      new URL(response.headers.get("x-middleware-rewrite")).pathname,
      "/api/platform/view-as/blocked",
    );
  }
  await middleware(
    new NextRequest("https://outclass.test/api/platform/view-as", {
      method: "POST",
      headers,
    }),
  );
  assert.equal(live, 1);
});
test("blocked mutation attempts produce attributed audit events and never execute a target mutation", async () => {
  const h = sessionHarness(),
    token = (await h.api.POST(req(start))).cookies.get(cookie).value;
  h.setToken(token);
  const endpoint = load("app/api/platform/view-as/blocked/route.ts", h.mocks);
  const response = await endpoint.POST(
    new NextRequest("https://outclass.test/api/platform/view-as/blocked", {
      method: "POST",
      headers: { "x-outclass-blocked-path": "/club/task" },
    }),
  );
  assert.equal(response.status, 403);
  assert.equal(h.logs().at(-1).action, "platform.view-as.write-blocked");
  assert.equal(h.logs().at(-1).actorId, actor);
  assert.equal(h.logs().at(-1).targetId, target);
});
test("search filters remain server-side and exclude password hashes and view-session tokens", async () => {
  let query,
    logs = [];
  const capture = async (q) => {
    query = q;
    return [];
  };
  const api = load("actions/platform-admin.ts", {
    "@/utils/platform-admin": {
      requirePlatformAdmin: async () => ({ id: actor }),
    },
    "@/utils/prisma": {
      prisma: {
        auditLog: { create: async (d) => logs.push(d), findMany: capture },
        user: { findMany: capture },
        platformViewSession: { findMany: capture },
        clubMember: { findMany: capture },
      },
    },
    "@/lib/demo/validate": { readDemoTemplate: () => {} },
  });
  await api.readPlatformResource("users", 2, {
    query: "student",
    status: "SUSPENDED",
  });
  assert.equal(query.skip, 200);
  assert.equal(query.select.passwordHash, undefined);
  assert.deepEqual(query.where.disabledAt, { not: null });
  assert.equal(query.where.OR[1].email.contains, "student");
  await api.readPlatformResource("view-sessions", 0, { status: "ACTIVE" });
  assert.equal(query.select.tokenHash, undefined);
  assert.equal(query.where.endedAt, null);
  assert.ok(query.where.expiresAt.gt instanceof Date);
  await api.readPlatformResource("audit", 0, {
    clubId,
    userId: actor,
    action: "view-as",
    from: "2026-09-01T00:00:00Z",
    to: "2026-09-25T23:59:59Z",
  });
  assert.equal(query.where.actorId, actor);
  assert.equal(query.where.clubId, clubId);
  assert.equal(query.where.action.contains, "view-as");
  assert.ok(query.where.createdAt.gte instanceof Date);
  await assert.rejects(
    api.readPlatformResource("users", 0, { status: "ACCEPTED" }),
    /valid status/,
  );
  await assert.rejects(
    api.readPlatformResource("audit", 0, {
      from: "2026-09-25T00:00:00Z",
      to: "2026-09-01T00:00:00Z",
    }),
  );
  assert.equal(logs.length, 3);
});

test("admin suspension protects self, privileged administrators, and the last active club owner", async () => {
  let writes = 0,
    privileged = false,
    owned = [],
    others = 0;
  const tx = {
    $queryRaw: async () => [],
    platformAdmin: {
      findUnique: async () => (privileged ? { active: true } : null),
    },
    clubMember: { findMany: async () => owned, count: async () => others },
    user: {
      update: async () => {
        writes++;
      },
    },
    auditLog: { create: async () => {} },
  };
  const api = load("actions/platform-admin.ts", {
    "@/utils/platform-admin": {
      requirePlatformAdmin: async () => ({ id: actor }),
    },
    "@/utils/prisma": { prisma: { $transaction: (fn) => fn(tx) } },
    "@/lib/demo/validate": { readDemoTemplate: () => {} },
  });
  await assert.rejects(
    api.changePlatformResource(
      { kind: "user", id: actor, disabled: true },
      "Valid support reason.",
    ),
    /own administrator/,
  );
  privileged = true;
  await assert.rejects(
    api.changePlatformResource(
      { kind: "user", id: target, disabled: true },
      "Valid support reason.",
    ),
    /protected grant/,
  );
  privileged = false;
  owned = [{ clubId }];
  await assert.rejects(
    api.changePlatformResource(
      { kind: "user", id: target, disabled: true },
      "Valid support reason.",
    ),
    /another active club owner/,
  );
  assert.equal(writes, 0);
  others = 1;
  await api.changePlatformResource(
    { kind: "user", id: target, disabled: true },
    "Valid support reason.",
  );
  assert.equal(writes, 1);
});
test("ordinary auth and platform mutations reject view context even if middleware is bypassed", async () => {
  const jar = { has: () => true, get: () => undefined };
  const auth = load("utils/auth.ts", {
    "next/headers": { cookies: async () => jar },
    "@/utils/supabase/server": {
      createClient: async () => {
        throw Error("Must not reach Supabase");
      },
    },
    "@/utils/prisma": { prisma: {} },
    "next/navigation": {
      redirect: () => {
        throw Error("redirect");
      },
    },
  });
  await assert.rejects(auth.requireAuth(), /Exit read-only/);
  const previous = process.env.OUTCLASS_PLATFORM_ADMIN_IDS;
  process.env.OUTCLASS_PLATFORM_ADMIN_IDS = actor;
  try {
    const guard = load("utils/platform-admin.ts", {
      "@/utils/auth": { requireAuth: async () => ({ user: { id: actor } }) },
      "@/utils/prisma": {
        prisma: {
          platformAdmin: { findUnique: async () => ({ active: true }) },
        },
      },
      "next/headers": { cookies: async () => jar },
      "@/utils/supabase/server": {
        createClient: async () => ({
          auth: {
            mfa: {
              getAuthenticatorAssuranceLevel: async () => ({
                data: { currentLevel: "aal2" },
              }),
            },
          },
        }),
      },
    });
    await assert.rejects(guard.requirePlatformAdmin(), /Exit read-only/);
    assert.equal(
      (await guard.requirePlatformAdmin({ allowViewAs: true })).id,
      actor,
    );
  } finally {
    if (previous === undefined) delete process.env.OUTCLASS_PLATFORM_ADMIN_IDS;
    else process.env.OUTCLASS_PLATFORM_ADMIN_IDS = previous;
  }
});
test("normal account API explicitly omits password hashes", async () => {
  const api = load("app/api/users/me/route.ts", {
    "next/headers": { cookies: async () => ({get:()=>undefined,has:()=>false}) },
    "@/utils/supabase/server": {
      createClient: async () => ({
        auth: {
          getUser: async () => ({
            data: { user: { id: actor, email: "admin@virginia.edu" } },
          }),
        },
      }),
    },
    "@/utils/prisma": {
      prisma: {
        user: {
          findUnique: async (query) => {
            assert.deepEqual(query.omit, { passwordHash: true });
            assert.deepEqual(query.include.applications.omit, { anonymousReviewText: true });
            return {
              id: actor,
              email: "admin@virginia.edu",
              memberships: [],
              applications: [],
              studentProfile: null,
            };
          },
        },
      },
    },
  });
  const response = await api.GET();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).passwordHash, undefined);
});
