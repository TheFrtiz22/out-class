const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")
const { z } = require("zod")
const { NextRequest } = require("next/server")

const root = path.join(__dirname, "..")
function load(file, mocks = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  new Function("require", "module", "exports", code)(
    n => n in mocks ? mocks[n] : n.startsWith("@/lib/") ? load(n.slice(2) + ".ts", mocks) : require(n),
    mod, mod.exports,
  )
  return mod.exports
}

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-test-key"
process.env.SUPABASE_SECRET_KEY = "server-test-key"

const EMAIL = "student@virginia.edu"
const schemas = load("lib/onboarding-schemas.ts", { "@/lib/student-profile": { gpaSchema: z.number(), linkedinUrlSchema: z.string() } })

// In-memory stand-in for Supabase Auth: one account, its stored password, confirmation, metadata and sessions.
// `skewMs` sets the Auth server's clock relative to this process.
function authServer({ confirmedAt = null, password = null, appMetadata = {}, skewMs = 0 } = {}) {
  const account = { id: "user-1", email: EMAIL, password, email_confirmed_at: confirmedAt, app_metadata: { provider: "email", ...appMetadata } }
  const sessions = new Set(), code = "123456", failures = {}, forwardedIps = []
  let next = 0
  const authNow = () => new Date(Date.now() + skewMs).toISOString()
  const user = () => ({ id: account.id, email: account.email, email_confirmed_at: account.email_confirmed_at, app_metadata: { ...account.app_metadata } })
  const open = () => { const id = `s${++next}`; sessions.add(id); return { access_token: id, user: user() } }
  const server = {
    account, sessions, code, failures, forwardedIps, verifies: 0,
    // Called before each server step so a test can act as another party between steps.
    beforeStep: async () => {},
    signUp(chosen) {
      // Supabase Auth keeps the first password for an address that is still unconfirmed.
      if (account.password === null) account.password = chosen
    },
    signInWithPassword(typed) {
      if (!account.email_confirmed_at || typed !== account.password) return { error: { message: "Invalid login credentials" } }
      return { session: open() }
    },
    client() {
      let current = null
      return {
        auth: {
          verifyOtp: async ({ email, token, type }) => {
            assert.equal(type, "email")
            server.verifies++
            if (email !== account.email || token !== code) return { data: { session: null, user: null }, error: { code: "otp_expired", status: 403 } }
            if (!account.email_confirmed_at) account.email_confirmed_at = authNow()
            current = open()
            return { data: { session: current, user: user() }, error: null }
          },
          updateUser: async ({ password: value }) => {
            if (failures.updateUser) throw new Error("network")
            if (!current || !sessions.has(current.access_token)) return { error: { code: "session_not_found", status: 403 } }
            if (value === account.password) return { error: { code: "same_password", status: 422 } }
            account.password = value
            return { error: null }
          },
          signOut: async ({ scope }) => {
            if (scope === "others") await server.beforeStep("signOut")
            if (scope === "others" && failures.signOut) return { error: { status: 500 } }
            if (scope === "others") for (const id of [...sessions]) { if (id !== current.access_token) sessions.delete(id) }
            if (scope === "local") sessions.delete(current?.access_token)
            return { error: null }
          },
        },
      }
    },
    admin: {
      auth: { admin: { updateUserById: async (id, input) => {
        assert.equal(id, account.id)
        await server.beforeStep(input.password ? "adminPassword" : "adminRecord")
        if (input.app_metadata && failures.record) return { error: { status: 500 } }
        if (input.password) account.password = input.password
        if (input.app_metadata) account.app_metadata = { ...account.app_metadata, ...input.app_metadata }
        return { error: null }
      } } },
    },
  }
  return server
}

// Stand-in for prisma: AuditLog rows plus transaction-scoped advisory locks, with a yield between
// statements so concurrent requests interleave.
function attemptStore() {
  const rows = [], locks = new Map()
  const tick = () => new Promise(resolve => setImmediate(resolve))
  const auditLog = {
    count: async ({ where }) => { await tick(); return rows.filter(r => r.targetId === where.targetId && r.action === where.action && r.createdAt > where.createdAt.gt).length },
    create: async ({ data }) => { await tick(); rows.push({ ...data, createdAt: new Date() }); return data },
  }
  return {
    rows,
    $transaction: async run => {
      const held = []
      const tx = {
        auditLog,
        $queryRaw: async (strings, key) => {
          assert.match(strings.join("?"), /pg_advisory_xact_lock/)
          while (locks.has(key)) await locks.get(key).promise
          let release
          const promise = new Promise(resolve => { release = resolve })
          locks.set(key, { promise, release })
          held.push(key)
          await tick()
        },
      }
      try { return await run(tx) } finally { for (const key of held) { const lock = locks.get(key); locks.delete(key); lock.release() } }
    },
  }
}

function route(server, { cookies = [], signedIn = null, db = attemptStore() } = {}) {
  const attached = []
  const { POST } = load("app/api/auth/confirm-email/route.ts", {
    "@/utils/admin-elevation": { forwardedAuthClient: ip => { server.forwardedIps.push(ip); return server.client() } },
    "@supabase/supabase-js": { createClient: (_url, key) => { assert.equal(key, "server-test-key"); return server.admin } },
    "@/utils/supabase/server": { createClient: async () => ({ auth: {
      getUser: async () => ({ data: { user: signedIn }, error: null }),
      setSession: async session => { attached.push(session.access_token); return { error: null } },
    } }) },
    "@/utils/prisma": { prisma: db },
    "next/headers": { cookies: async () => ({ has: name => cookies.includes(name), get: name => cookies.includes(name) ? { value: "1" } : undefined }) },
    "@/lib/onboarding-schemas": schemas,
  })
  const send = (body, ip = "198.51.100.7") => POST(new NextRequest("https://outclass.example/api/auth/confirm-email", {
    method: "POST",
    headers: { origin: "https://outclass.example", host: "outclass.example", "content-type": "application/json", "x-forwarded-for": `${ip}, 10.0.0.1` },
    body: JSON.stringify(body),
  }))
  return { send, attached, db }
}

const REJECTED = "That code isn't valid or has expired. Check it or send yourself a new one."

test("normal signup, email code, then password sign-in works", async () => {
  const server = authServer()
  server.signUp("Chosen-Pass-1!")
  const { send, attached } = route(server)
  const response = await send({ email: EMAIL, code: server.code, password: "Chosen-Pass-1!" })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { success: true, passwordUpdated: true, passwordSaved: true })
  assert.equal(attached.length, 1, "the confirmed session is attached to this browser")
  assert.ok(server.signInWithPassword("Chosen-Pass-1!").session, "the signup password signs in after confirmation")
  assert.equal(server.account.app_metadata.outclass_password_secured.email, EMAIL, "the password state is recorded")
})

test("a verified code keeps only the password sent with it and signs out other sessions", async () => {
  const server = authServer()
  server.signUp("Earlier-Pass-1!")
  server.sessions.add("before-confirmation")
  const { send, attached } = route(server)
  const response = await send({ email: EMAIL, code: server.code, password: "Owner-Pass-22!" })
  assert.deepEqual(await response.json(), { success: true, passwordUpdated: true, passwordSaved: true })
  assert.ok(!server.sessions.has("before-confirmation"), "a session created before confirmation is revoked")
  assert.deepEqual([...server.sessions], attached, "only the confirming session remains")
  assert.equal(server.signInWithPassword("Earlier-Pass-1!").error?.message, "Invalid login credentials")
  assert.ok(server.signInWithPassword("Owner-Pass-22!").session)
})

test("without a password the stored one is replaced and the owner is still signed in", async () => {
  const server = authServer()
  server.signUp("Earlier-Pass-1!")
  const { send, attached } = route(server)
  const response = await send({ email: EMAIL, code: server.code })
  assert.deepEqual(await response.json(), { success: true, passwordUpdated: true, passwordSaved: false })
  assert.equal(attached.length, 1)
  assert.equal(server.signInWithPassword("Earlier-Pass-1!").error?.message, "Invalid login credentials")
  const stored = server.account.password
  assert.ok(stored.length <= 72 && /[a-z]/.test(stored) && /[A-Z]/.test(stored) && /\d/.test(stored) && /[^\w]/.test(stored))
})

test("a password too short for signup is treated as not supplied", async () => {
  const server = authServer()
  server.signUp("Earlier-Pass-1!")
  const response = await route(server).send({ email: EMAIL, code: server.code, password: "short" })
  assert.deepEqual(await response.json(), { success: true, passwordUpdated: true, passwordSaved: false })
  assert.notEqual(server.account.password, "short")
})

test("an incomplete update leaves the earlier password unusable and a later code finishes it", async () => {
  const server = authServer()
  server.signUp("Earlier-Pass-1!")
  server.failures.updateUser = true
  server.failures.signOut = true
  const first = route(server)
  const failed = await first.send({ email: EMAIL, code: server.code, password: "Owner-Pass-22!" })
  assert.equal(failed.status, 503)
  assert.deepEqual(first.attached, [])
  assert.equal(server.signInWithPassword("Earlier-Pass-1!").error?.message, "Invalid login credentials", "the server sets the password when the session cannot")
  assert.equal(server.account.app_metadata.outclass_password_secured, undefined, "nothing is recorded until every step succeeds")
  server.sessions.add("left-over")
  // 61 seconds later, with the same code still valid in this stand-in.
  server.failures.updateUser = false
  server.failures.signOut = false
  const realNow = Date.now
  Date.now = () => realNow() + 61_000
  try {
    const retry = await route(server).send({ email: EMAIL, code: server.code, password: "Owner-Pass-22!" })
    assert.deepEqual(await retry.json(), { success: true, passwordUpdated: true, passwordSaved: true })
  } finally { Date.now = realNow }
  assert.ok(!server.sessions.has("left-over"))
  assert.ok(server.signInWithPassword("Owner-Pass-22!").session)
  assert.equal(server.account.app_metadata.outclass_password_secured.email, EMAIL)
})

test("a password change from another session between the server steps does not remain", async () => {
  const server = authServer()
  server.signUp("Earlier-Pass-1!")
  server.sessions.add("other")
  const events = []
  server.beforeStep = async step => {
    events.push(step)
    // Before other sessions end, the other session changes the password; after they end, it signs in again with it.
    if (step === "signOut" && server.sessions.has("other")) server.account.password = "Other-Pass-33!"
    if (step === "adminPassword") { const again = server.signInWithPassword("Other-Pass-33!"); if (again.session) events.push("other signed in") }
  }
  const response = await route(server).send({ email: EMAIL, code: server.code, password: "Owner-Pass-22!" })
  assert.deepEqual(await response.json(), { success: true, passwordUpdated: true, passwordSaved: true })
  assert.deepEqual(events, ["signOut", "adminPassword", "other signed in", "signOut", "adminRecord"], "server password after sign-out, sign-out again, record last")
  assert.equal(server.account.password, "Owner-Pass-22!", "the owner's password wins")
  assert.equal(server.signInWithPassword("Other-Pass-33!").error?.message, "Invalid login credentials")
  assert.equal(server.sessions.size, 1, "only the confirming session remains")
})

test("without the Supabase secret key the route refuses before using the code", async () => {
  const server = authServer()
  server.signUp("Earlier-Pass-1!")
  const saved = process.env.SUPABASE_SECRET_KEY
  delete process.env.SUPABASE_SECRET_KEY
  const errors = [], realError = console.error
  console.error = message => errors.push(message)
  try {
    const response = await route(server).send({ email: EMAIL, code: server.code, password: "Owner-Pass-22!" })
    assert.equal(response.status, 503)
  } finally { process.env.SUPABASE_SECRET_KEY = saved; console.error = realError }
  assert.equal(server.verifies, 0)
  assert.equal(server.account.email_confirmed_at, null)
  assert.equal(errors.length, 1)
})

test("a failed record write returns 503 and logs an error; the next code tries again", async () => {
  const server = authServer()
  server.signUp("Earlier-Pass-1!")
  server.failures.record = true
  const errors = [], realError = console.error
  console.error = message => errors.push(message)
  let failed
  try { failed = await route(server).send({ email: EMAIL, code: server.code, password: "Owner-Pass-22!" }) } finally { console.error = realError }
  assert.equal(failed.status, 503)
  assert.deepEqual(errors, ["Email code verified; password state not recorded"])
  server.failures.record = false
  const retry = await route(server).send({ email: EMAIL, code: server.code, password: "Owner-Pass-22!" })
  assert.deepEqual(await retry.json(), { success: true, passwordUpdated: true, passwordSaved: true })
  const later = await route(server).send({ email: EMAIL, code: server.code })
  assert.deepEqual(await later.json(), { success: true, passwordUpdated: false, passwordSaved: false }, "no further password change once recorded")
  assert.ok(server.signInWithPassword("Owner-Pass-22!").session)
})

test("once recorded, a code sign-in changes no password and keeps other sessions", async () => {
  const server = authServer({ confirmedAt: "2026-11-20T12:00:00.000Z", password: "Owner-Pass-22!", appMetadata: { outclass_password_secured: { userId: "user-1", email: EMAIL } } })
  server.sessions.add("phone")
  const response = await route(server).send({ email: EMAIL, code: server.code, password: "Typed-Other-3!" })
  assert.deepEqual(await response.json(), { success: true, passwordUpdated: false, passwordSaved: false })
  assert.equal(server.account.password, "Owner-Pass-22!")
  assert.ok(server.sessions.has("phone"))
})

test("accounts confirmed earlier, reset through recovery, or invited keep their password", async () => {
  const { passwordAlreadySecured } = load("lib/email-confirmation.ts")
  const base = { id: "user-1", email: EMAIL, email_confirmed_at: "2026-11-20T12:00:00.000Z", app_metadata: {} }
  assert.equal(passwordAlreadySecured(base), false)
  assert.equal(passwordAlreadySecured({ ...base, email_confirmed_at: "2026-10-01T12:00:00.000Z" }), true)
  assert.equal(passwordAlreadySecured({ ...base, app_metadata: { outclass_verified_email: { method: "password_recovery_v1", userId: "user-1", email: EMAIL } } }), true)
  assert.equal(passwordAlreadySecured({ ...base, invited_at: "2026-11-19T12:00:00.000Z" }), true)
  assert.equal(passwordAlreadySecured({ ...base, app_metadata: { outclass_password_secured: { userId: "user-1", email: "other@virginia.edu" } } }), false, "a record for another address does not count")
  assert.equal(passwordAlreadySecured({ ...base, app_metadata: { outclass_password_secured: { userId: "user-2", email: EMAIL } } }), false, "a record for another account does not count")
})

for (const skewMs of [90_000, -90_000]) {
  test(`behaviour does not depend on the Auth server clock (${skewMs > 0 ? "ahead" : "behind"} by 90 s)`, async () => {
    const server = authServer({ skewMs })
    server.signUp("Earlier-Pass-1!")
    server.sessions.add("before-confirmation")
    const first = await route(server).send({ email: EMAIL, code: server.code, password: "Owner-Pass-22!" })
    assert.deepEqual(await first.json(), { success: true, passwordUpdated: true, passwordSaved: true })
    assert.ok(!server.sessions.has("before-confirmation"))
    server.sessions.add("tablet")
    const again = await route(server).send({ email: EMAIL, code: server.code })
    assert.deepEqual(await again.json(), { success: true, passwordUpdated: false, passwordSaved: false })
    assert.ok(server.sessions.has("tablet"))
    assert.ok(server.signInWithPassword("Owner-Pass-22!").session)
  })
}

test("a wrong code, a foreign origin and an administrator view are refused without confirming", async () => {
  const server = authServer()
  server.signUp("Earlier-Pass-1!")
  const wrong = await route(server).send({ email: EMAIL, code: "000000" })
  assert.equal(wrong.status, 400)
  assert.deepEqual(await wrong.json(), { error: REJECTED })
  assert.equal(server.account.email_confirmed_at, null)
  const { POST } = load("app/api/auth/confirm-email/route.ts", {
    "@/utils/admin-elevation": { freshAuthClient: () => assert.fail("no verification") },
    "@/utils/supabase/server": { createClient: async () => assert.fail("no session") },
    "@/utils/prisma": { prisma: {} },
    "next/headers": { cookies: async () => ({ has: () => false, get: () => undefined }) },
    "@/lib/onboarding-schemas": schemas,
  })
  const foreign = await POST(new NextRequest("https://outclass.example/api/auth/confirm-email", {
    method: "POST", headers: { origin: "https://elsewhere.example", host: "outclass.example", "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, code: server.code }),
  }))
  assert.equal(foreign.status, 403)
  const viewing = await route(server, { cookies: ["outclass-platform-view"] }).send({ email: EMAIL, code: server.code })
  assert.equal(viewing.status, 403)
  assert.equal(server.account.email_confirmed_at, null)
})

test("a browser signed in to another account gets 409 and keeps its session", async () => {
  const server = authServer()
  server.signUp("Earlier-Pass-1!")
  const { send, attached, db } = route(server, { signedIn: { id: "user-2", email: "other@virginia.edu" } })
  const response = await send({ email: EMAIL, code: server.code })
  assert.equal(response.status, 409)
  assert.deepEqual(attached, [])
  assert.equal(server.account.email_confirmed_at, null, "the code is not used")
  assert.equal(db.rows.length, 0)
  const same = await route(server, { signedIn: { id: "user-1", email: EMAIL } }).send({ email: EMAIL, code: server.code, password: "Owner-Pass-22!" })
  assert.equal(same.status, 200, "the same account may verify a code")
})

test("code attempts are limited per address with the same response as a wrong code", async () => {
  const { EMAIL_CODE_LIMIT_PER_EMAIL } = load("lib/email-confirmation.ts")
  const server = authServer()
  server.signUp("Earlier-Pass-1!")
  const db = attemptStore()
  for (let i = 0; i < EMAIL_CODE_LIMIT_PER_EMAIL; i++) {
    const wrong = await route(server, { db }).send({ email: EMAIL, code: "000000" }, `203.0.113.${i}`)
    assert.deepEqual(await wrong.json(), { error: REJECTED })
  }
  let verifies = 0
  const base = server.client
  server.client = () => { const c = base(); const verify = c.auth.verifyOtp; c.auth.verifyOtp = input => { verifies++; return verify(input) }; return c }
  const limited = await route(server, { db }).send({ email: EMAIL, code: server.code }, "203.0.113.200")
  assert.equal(limited.status, 400)
  assert.deepEqual(await limited.json(), { error: REJECTED })
  assert.equal(verifies, 0, "a limited attempt never reaches Supabase Auth")
  assert.equal(server.account.email_confirmed_at, null)
  assert.ok(db.rows.every(r => !r.targetId.includes(EMAIL) && !r.targetId.includes("203.0.113")), "attempt rows hold digests only")
  const other = authServer()
  other.account.email = "classmate@virginia.edu"
  const unaffected = await route(other, { db }).send({ email: "classmate@virginia.edu", code: other.code, password: "Owner-Pass-22!" }, "203.0.113.201")
  assert.equal(unaffected.status, 200, "another address is not limited")
})

test("code attempts are limited per client network", async () => {
  const { EMAIL_CODE_LIMIT_PER_IP } = load("lib/email-confirmation.ts")
  const db = attemptStore()
  const server = authServer()
  for (let i = 0; i < EMAIL_CODE_LIMIT_PER_IP; i++) {
    const wrong = await route(server, { db }).send({ email: `s${i}@virginia.edu`, code: "000000" }, "198.51.100.9")
    assert.deepEqual(await wrong.json(), { error: REJECTED })
  }
  server.signUp("Earlier-Pass-1!")
  const limited = await route(server, { db }).send({ email: EMAIL, code: server.code }, "198.51.100.9")
  assert.deepEqual(await limited.json(), { error: REJECTED })
  assert.equal(server.account.email_confirmed_at, null)
  const elsewhere = await route(server, { db }).send({ email: EMAIL, code: server.code, password: "Owner-Pass-22!" }, "198.51.100.10")
  assert.equal(elsewhere.status, 200, "another network is not limited")
})

test("concurrent wrong codes for one address reach Supabase Auth at most the limit", async () => {
  const { EMAIL_CODE_LIMIT_PER_EMAIL } = load("lib/email-confirmation.ts")
  const server = authServer()
  server.signUp("Earlier-Pass-1!")
  const db = attemptStore()
  const responses = await Promise.all(Array.from({ length: 30 }, (_, i) => route(server, { db }).send({ email: EMAIL, code: "000000" }, `203.0.113.${i}`)))
  for (const response of responses) assert.deepEqual(await response.json(), { error: REJECTED })
  assert.ok(server.verifies <= EMAIL_CODE_LIMIT_PER_EMAIL, `${server.verifies} verifications`)
  assert.equal(server.verifies, EMAIL_CODE_LIMIT_PER_EMAIL)
  assert.equal(db.rows.filter(r => r.targetId.startsWith("email:")).length, EMAIL_CODE_LIMIT_PER_EMAIL, "attempts over the limit are not recorded")
})

test("attempt digests are keyed with the server secret", () => {
  const { attemptKey } = load("lib/email-confirmation.ts")
  const saved = process.env.SUPABASE_SECRET_KEY
  try {
    const keyed = attemptKey("email", EMAIL)
    process.env.SUPABASE_SECRET_KEY = "another-server-key"
    assert.notEqual(attemptKey("email", EMAIL), keyed)
    assert.equal(attemptKey("email", " Student@Virginia.edu "), attemptKey("email", EMAIL))
    assert.notEqual(attemptKey("ip", EMAIL).slice(3), attemptKey("email", EMAIL).slice(6))
    delete process.env.SUPABASE_SECRET_KEY
    assert.match(attemptKey("email", EMAIL), /^email:[0-9a-f]{64}$/, "without a secret, a plain digest")
    assert.ok(!keyed.includes(EMAIL))
  } finally { process.env.SUPABASE_SECRET_KEY = saved }
})

test("the end-user address is forwarded to Supabase Auth with a secret key", async () => {
  const server = authServer()
  server.signUp("Earlier-Pass-1!")
  await route(server).send({ email: EMAIL, code: server.code, password: "Owner-Pass-22!" }, "192.0.2.44")
  assert.deepEqual(server.forwardedIps, ["192.0.2.44"], "the first x-forwarded-for hop")
  const made = []
  const mocks = {
    "@supabase/supabase-js": { createClient: (url, key, options) => { made.push({ key, headers: options.global?.headers }); return {} } },
    "@/lib/admin-failure": {}, "@/lib/admin-elevation": {}, "@/utils/supabase/server": {}, "@/utils/prisma": {}, "next/headers": {},
  }
  const { forwardedAuthClient } = load("utils/admin-elevation.ts", mocks)
  const saved = process.env.SUPABASE_SECRET_KEY
  try {
    process.env.SUPABASE_SECRET_KEY = "sb_secret_example"
    forwardedAuthClient("192.0.2.44")
    forwardedAuthClient(undefined)
    process.env.SUPABASE_SECRET_KEY = "legacy-service-role-jwt"
    forwardedAuthClient("192.0.2.44")
  } finally { process.env.SUPABASE_SECRET_KEY = saved }
  assert.deepEqual(made, [
    { key: "sb_secret_example", headers: { "sb-forwarded-for": "192.0.2.44" } },
    { key: "public-test-key", headers: undefined },
    { key: "public-test-key", headers: undefined },
  ])
})

test("attempts older than the window no longer count", async () => {
  const { recordEmailCodeAttempt, EMAIL_CODE_LIMIT_PER_EMAIL, EMAIL_CODE_WINDOW_MS } = load("lib/email-confirmation.ts")
  const db = attemptStore()
  for (let i = 0; i < EMAIL_CODE_LIMIT_PER_EMAIL; i++) assert.equal(await recordEmailCodeAttempt(db, EMAIL, undefined), true)
  assert.equal(await recordEmailCodeAttempt(db, EMAIL, undefined), false)
  assert.equal(db.rows.length, EMAIL_CODE_LIMIT_PER_EMAIL, "a refused attempt adds no row")
  assert.equal(await recordEmailCodeAttempt(db, EMAIL, undefined, Date.now() + EMAIL_CODE_WINDOW_MS + 1000), true)
})

test("in-app code verification goes through the server route", async () => {
  for (const file of ["components/views/auth-view.tsx", "components/views/student-onboarding-wizard.tsx"]) {
    const source = fs.readFileSync(path.join(root, file), "utf8")
    assert.ok(!source.includes("auth.verifyOtp("), `${file} does not verify codes in the browser`)
    assert.ok(source.includes("confirmEmailCode("), `${file} uses confirmEmailCode`)
  }
  assert.ok(!fs.readFileSync(path.join(root, "lib/signup-password.ts"), "utf8").includes("node:"), "the browser-shared module stays free of server imports")
  const { confirmEmailCode } = load("lib/auth-email.ts")
  const calls = []
  const ok = await confirmEmailCode(" Student@Virginia.edu ", "123456", undefined, async (url, init) => {
    calls.push([url, JSON.parse(init.body)])
    return { ok: true, json: async () => ({ success: true, passwordUpdated: true, passwordSaved: false }) }
  })
  assert.deepEqual(ok, { ok: true, passwordUpdated: true, passwordSaved: false })
  assert.deepEqual(calls, [["/api/auth/confirm-email", { email: EMAIL, code: "123456" }]])
  const failed = await confirmEmailCode(EMAIL, "123456", "x", async () => ({ ok: false, json: async () => ({ error: REJECTED }) }))
  assert.deepEqual(failed, { ok: false, error: REJECTED })
})

test("a link sign-in to an email-and-password account without a recorded password goes to the code flow", async () => {
  const run = async user => {
    const calls = []
    const { GET } = load("app/auth/callback/route.ts", {
      "next/headers": { cookies: async () => ({ has: () => false }) },
      "@/lib/auth-features": { MICROSOFT_AUTH_ENABLED: true },
      "@/utils/supabase/server": { createClient: async () => ({ auth: {
        exchangeCodeForSession: async () => { calls.push("exchange"); return { data: { user }, error: null } },
        signOut: async () => { calls.push("signOut"); return { error: null } },
      } }) },
      "@/utils/prisma": { prisma: { user: { upsert: async () => { calls.push("upsert") } } } },
    })
    const response = await GET(new Request("https://outclass.test/auth/callback?code=valid&next=%2Fhome"))
    return { location: response.headers.get("location"), calls }
  }
  const base = { id: "user-1", email: EMAIL, email_confirmed_at: "2026-11-20T12:00:00.000Z", app_metadata: {} }
  const pending = await run({ ...base, identities: [{ provider: "email" }, { provider: "azure" }] })
  assert.deepEqual(pending.calls, ["exchange", "signOut"], "signed out before any account record is written")
  assert.equal(pending.location, "https://outclass.test/login?error=email-code-required&next=%2Fhome")
  const recorded = await run({ ...base, identities: [{ provider: "email" }], app_metadata: { outclass_password_secured: { userId: "user-1", email: EMAIL } } })
  assert.deepEqual(recorded.calls, ["exchange", "upsert"])
  assert.equal(recorded.location, "https://outclass.test/home")
  const microsoftOnly = await run({ ...base, identities: [{ provider: "azure" }] })
  assert.deepEqual(microsoftOnly.calls, ["exchange", "upsert"], "an account without a password is unaffected")
  const { authenticationError } = load("lib/auth.ts")
  assert.match(authenticationError("email-code-required"), /code sent to your UVA email/)
})
