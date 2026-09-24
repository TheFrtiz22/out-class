const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
function load(file, mocks = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  new Function("require", "module", "exports", code)(
    (name) => (name in mocks ? mocks[name] : require(name)),
    mod,
    mod.exports,
  )
  return mod.exports
}
const permissions = load("lib/permissions.ts"),
  authPolicy = load("lib/auth.ts")
const clubId = "00000000-0000-4000-8000-000000000001",
  memberId = "00000000-0000-4000-8000-000000000002",
  inviteId = "00000000-0000-4000-8000-000000000003"
test("capabilities never derive from legacy roles; owner and custom grants are contextual", () => {
  assert.equal(permissions.hasPermission({ role: "PRESIDENT" }, "decisions.manage"), false)
  assert.equal(
    permissions.hasPermission({ permissions: ["applications.review"] }, "decisions.manage"),
    false,
  )
  assert.equal(
    permissions.hasPermission({ permissions: ["decisions.manage"] }, "decisions.manage"),
    true,
  )
  assert.equal(permissions.hasPermission({ isOwner: true }, "leaders.manage"), true)
  assert.equal(permissions.hasWorkspace({ permissions: [] }), false)
})
test("server capability guard scopes membership, rejects legacy admin and demo writes", async () => {
  let membership = { role: "PRESIDENT", permissions: [], isOwner: false },
    demo = false
  const api = load("utils/auth.ts", {
    "@/lib/permissions": permissions,
    "@/lib/demo/access": { DEMO_COOKIE: "demo" },
    "@/lib/auth": authPolicy,
    "./supabase/server": {
      createClient: async () => ({
        auth: {
          getUser: async () => ({
            data: { user: { id: "actor", email: "actor@virginia.edu" } },
            error: null,
          }),
        },
      }),
    },
    "next/headers": { cookies: async () => ({ get: () => (demo ? { value: "1" } : undefined) }) },
    "./prisma": {
      prisma: {
        user: { upsert: async () => ({ id: "actor", role: "CLUB_ADMIN" }) },
        clubMember: {
          findUnique: async ({ where }) => {
            assert.deepEqual(where, { userId_clubId: { userId: "actor", clubId } })
            return membership
          },
        },
      },
    },
    "next/navigation": {
      redirect: () => {
        throw new Error("Unauthenticated")
      },
    },
  })
  await assert.rejects(api.requireClubPermission(clubId, ["decisions.manage"]), /permission/)
  membership = { isOwner: false, permissions: ["applications.review"] }
  await api.requireClubPermission(clubId, ["applications.review"])
  await assert.rejects(api.requireClubPermission(clubId, ["applicants.identify"]), /permission/)
  demo = true
  await assert.rejects(api.requireClubPermission(clubId, []), /Demo Mode/)
})
test("platform access requires independent server allowlist, database grant, and MFA", async () => {
  const saved = process.env.OUTCLASS_PLATFORM_ADMIN_IDS
  let grant = null,
    aal = "aal1"
  const guard = load("utils/platform-admin.ts", {
    "@/utils/auth": { requireAuth: async () => ({ user: { id: "actor", role: "CLUB_ADMIN" } }) },
    "@/utils/prisma": { prisma: { platformAdmin: { findUnique: async () => grant } } },
    "@/utils/supabase/server": {
      createClient: async () => ({
        auth: {
          mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: aal } }) },
        },
      }),
    },
    "next/headers": { cookies: async () => ({}) },
  })
  try {
    delete process.env.OUTCLASS_PLATFORM_ADMIN_IDS
    await assert.rejects(guard.requirePlatformAdmin(), /denied/)
    process.env.OUTCLASS_PLATFORM_ADMIN_IDS = "actor"
    await assert.rejects(guard.requirePlatformAdmin(), /denied/)
    grant = { active: true }
    await assert.rejects(guard.requirePlatformAdmin(), /authenticator/)
    aal = "aal2"
    assert.equal((await guard.requirePlatformAdmin()).id, "actor")
    grant.active = false
    await assert.rejects(guard.requirePlatformAdmin(), /denied/)
  } finally {
    if (saved === undefined) delete process.env.OUTCLASS_PLATFORM_ADMIN_IDS
    else process.env.OUTCLASS_PLATFORM_ADMIN_IDS = saved
  }
})
function accessHarness(actor, target, invitation) {
  let writes = 0,
    logs = 0
  const tx = {
    user: { findUnique: async () => ({ email: "target@virginia.edu" }) },
    $queryRaw: async () => [],
    clubMember: {
      findUnique: async () => actor,
      findFirst: async () => target,
      count: async () => 1,
      update: async () => {
        writes++
      },
      upsert: async () => {
        writes++
      },
    },
    clubInvitation: {
      updateMany: async ({ where, data }) => {
        assert.equal(where.acceptedAt, null)
        assert.ok(data.revokedAt instanceof Date)
      },
      findUnique: async () => invitation,
      update: async () => {
        writes++
      },
      create: async () => {
        writes++
        return { id: inviteId }
      },
    },
    auditLog: {
      create: async () => {
        logs++
      },
    },
  }
  return {
    api: load("actions/club-access.ts", {
      "@/utils/prisma": { prisma: { $transaction: async (fn) => fn(tx) } },
      "@/utils/auth": {
        requireAuth: async () => ({ user: { id: "actor", email: "actor@virginia.edu" } }),
      },
      "@/lib/permissions": permissions,
      "@/lib/auth": authPolicy,
    }),
    writes: () => writes,
    logs: () => logs,
  }
}
test("access editing cannot escalate or remove the last owner", async () => {
  let h = accessHarness(
    { isOwner: false, permissions: ["leaders.manage"] },
    { id: memberId, isOwner: false, permissions: [] },
  )
  await assert.rejects(
    h.api.updateClubAccess({ clubId, memberId, isOwner: false, permissions: ["decisions.manage"] }),
    /higher-authority/,
  )
  assert.equal(h.writes(), 0)
  h = accessHarness(
    { isOwner: true, permissions: [] },
    { id: memberId, isOwner: true, permissions: [] },
  )
  await assert.rejects(
    h.api.updateClubAccess({ clubId, memberId, isOwner: false, permissions: [] }),
    /last owner/,
  )
  assert.equal(h.writes(), 0)
  h = accessHarness(
    { isOwner: true, permissions: [] },
    { id: memberId, isOwner: false, permissions: [] },
  )
  await h.api.updateClubAccess({ clubId, memberId, isOwner: false, permissions: ["tasks.manage"] })
  assert.equal(h.writes(), 1)
  assert.equal(h.logs(), 1)
})
test("invitations bind acceptance to verified email, expiry, and current inviter authority", async () => {
  const base = {
    id: inviteId,
    clubId,
    email: "actor@virginia.edu",
    invitedBy: "owner",
    expiresAt: new Date(Date.now() + 100000),
    permissions: ["decisions.manage"],
  }
  for (const invitation of [
    { ...base, email: "someone@virginia.edu" },
    { ...base, expiresAt: new Date(0) },
    { ...base, revokedAt: new Date() },
    { ...base, acceptedAt: new Date() },
  ]) {
    const h = accessHarness({ isOwner: true }, null, invitation)
    await assert.rejects(h.api.acceptClubInvitation(inviteId), /unavailable|expired/)
    assert.equal(h.writes(), 0)
  }
  const revoked = accessHarness({ permissions: [] }, null, base)
  await assert.rejects(revoked.api.acceptClubInvitation(inviteId), /no longer/)
  assert.equal(revoked.writes(), 0)
  const valid = accessHarness({ isOwner: true, permissions: [] }, null, base)
  await valid.api.acceptClubInvitation(inviteId)
  assert.equal(valid.writes(), 2)
  assert.equal(valid.logs(), 1)
})
test("every platform action checks its guard before reading or mutating data", async () => {
  const api = load("actions/platform-admin.ts", {
    "@/utils/platform-admin": {
      requirePlatformAdmin: async () => {
        throw new Error("Denied")
      },
    },
    "@/utils/prisma": {
      prisma: new Proxy(
        {},
        {
          get() {
            throw new Error("Database accessed before authorization")
          },
        },
      ),
    },
    "@/lib/permissions": permissions,
    "@/lib/demo/validate": { readDemoTemplate: () => {} },
  })
  await assert.rejects(api.readPlatformResource("users"), /Denied/)
  await assert.rejects(api.changePlatformResource({}, "legitimate reason"), /Denied/)
  await assert.rejects(api.inspectPlatformUser("user", "legitimate reason"), /Denied/)
})
