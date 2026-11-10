const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")
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

// In-memory stand-in for Supabase Auth: one account, its stored password, confirmation and sessions.
function authServer({ confirmedAt = null, password = null } = {}) {
  const account = { id: "user-1", email: "student@virginia.edu", password, email_confirmed_at: confirmedAt }
  const sessions = new Set(), code = "123456"
  let next = 0
  const user = () => ({ id: account.id, email: account.email, email_confirmed_at: account.email_confirmed_at })
  const open = () => { const id = `s${++next}`; sessions.add(id); return { access_token: id, user: user() } }
  return {
    account, sessions, code,
    signUp(email, chosen) {
      // Supabase Auth keeps the first password for an address that is still unconfirmed.
      if (account.password === null) account.password = chosen
      return { session: null }
    },
    signInWithPassword(email, typed) {
      if (email !== account.email || !account.email_confirmed_at || typed !== account.password) return { error: { message: "Invalid login credentials" } }
      return { session: open() }
    },
    client() {
      let current = null
      return {
        auth: {
          verifyOtp: async ({ email, token, type }) => {
            assert.equal(type, "email")
            if (email !== account.email || token !== code) return { data: { session: null, user: null }, error: { code: "otp_expired", status: 403 } }
            if (!account.email_confirmed_at) account.email_confirmed_at = new Date().toISOString()
            current = open()
            return { data: { session: current, user: user() }, error: null }
          },
          updateUser: async ({ password: value }) => {
            if (!current || !sessions.has(current.access_token)) return { error: { code: "session_not_found", status: 403 } }
            if (value === account.password) return { error: { code: "same_password", status: 422 } }
            if (value.length > 72) return { error: { code: "weak_password", status: 422 } }
            account.password = value
            return { error: null }
          },
          signOut: async ({ scope }) => {
            if (scope === "others") for (const id of [...sessions]) { if (id !== current.access_token) sessions.delete(id) }
            if (scope === "local") sessions.delete(current?.access_token)
            return { error: null }
          },
        },
      }
    },
  }
}

function route(server, { cookies = [] } = {}) {
  const attached = []
  const { POST } = load("app/api/auth/confirm-email/route.ts", {
    "@/utils/admin-elevation": { freshAuthClient: () => server.client() },
    "@/utils/supabase/server": { createClient: async () => ({ auth: { setSession: async session => { attached.push(session.access_token); return { error: null } } } }) },
    "next/headers": { cookies: async () => ({ has: name => cookies.includes(name), get: name => cookies.includes(name) ? { value: "1" } : undefined }) },
    "@/lib/onboarding-schemas": load("lib/onboarding-schemas.ts", { "@/lib/student-profile": { gpaSchema: require("zod").z.number(), linkedinUrlSchema: require("zod").z.string() } }),
  })
  const send = body => POST(new NextRequest("https://outclass.example/api/auth/confirm-email", {
    method: "POST", headers: { origin: "https://outclass.example", host: "outclass.example", "content-type": "application/json" }, body: JSON.stringify(body),
  }))
  return { send, attached }
}

test("normal signup, email code, then password sign-in works", async () => {
  const server = authServer()
  server.signUp("student@virginia.edu", "Chosen-Pass-1!")
  const { send, attached } = route(server)
  const response = await send({ email: "student@virginia.edu", code: server.code, password: "Chosen-Pass-1!" })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { success: true, firstConfirmation: true, passwordSaved: true })
  assert.equal(attached.length, 1, "the confirmed session is attached to this browser")
  assert.ok(server.signInWithPassword("student@virginia.edu", "Chosen-Pass-1!").session, "the signup password signs in after confirmation")
})

test("first confirmation keeps only the password supplied with the code and signs out other sessions", async () => {
  const server = authServer()
  server.signUp("student@virginia.edu", "Earlier-Pass-1!")
  server.sessions.add("before-confirmation")
  const { send, attached } = route(server)
  const response = await send({ email: "student@virginia.edu", code: server.code, password: "Owner-Pass-22!" })
  assert.deepEqual(await response.json(), { success: true, firstConfirmation: true, passwordSaved: true })
  assert.ok(!server.sessions.has("before-confirmation"), "a session created before confirmation is revoked")
  assert.deepEqual([...server.sessions], attached, "only the confirming session remains")
  assert.equal(server.signInWithPassword("student@virginia.edu", "Earlier-Pass-1!").error?.message, "Invalid login credentials")
  assert.ok(server.signInWithPassword("student@virginia.edu", "Owner-Pass-22!").session)
})

test("first confirmation without a password replaces the stored one and still signs the owner in", async () => {
  const server = authServer()
  server.signUp("student@virginia.edu", "Earlier-Pass-1!")
  const { send, attached } = route(server)
  const response = await send({ email: "student@virginia.edu", code: server.code })
  assert.deepEqual(await response.json(), { success: true, firstConfirmation: true, passwordSaved: false })
  assert.equal(attached.length, 1)
  assert.equal(server.signInWithPassword("student@virginia.edu", "Earlier-Pass-1!").error?.message, "Invalid login credentials")
  assert.ok(server.account.password.length <= 72 && /[a-z]/.test(server.account.password) && /[A-Z]/.test(server.account.password) && /\d/.test(server.account.password) && /[^\w]/.test(server.account.password))
})

test("a password too short for signup is treated as not supplied", async () => {
  const server = authServer()
  server.signUp("student@virginia.edu", "Earlier-Pass-1!")
  const response = await route(server).send({ email: "student@virginia.edu", code: server.code, password: "short" })
  assert.deepEqual(await response.json(), { success: true, firstConfirmation: true, passwordSaved: false })
  assert.notEqual(server.account.password, "short")
})

test("code sign-in to an already confirmed account changes no password and keeps other sessions", async () => {
  const server = authServer({ confirmedAt: "2026-09-01T12:00:00.000Z", password: "Owner-Pass-22!" })
  server.sessions.add("phone")
  const response = await route(server).send({ email: "student@virginia.edu", code: server.code, password: "Typed-Other-3!" })
  assert.deepEqual(await response.json(), { success: true, firstConfirmation: false, passwordSaved: false })
  assert.equal(server.account.password, "Owner-Pass-22!")
  assert.ok(server.sessions.has("phone"))
})

test("a wrong code, a foreign origin and an administrator view are refused without confirming", async () => {
  const server = authServer()
  server.signUp("student@virginia.edu", "Earlier-Pass-1!")
  const wrong = await route(server).send({ email: "student@virginia.edu", code: "000000" })
  assert.equal(wrong.status, 400)
  assert.equal(server.account.email_confirmed_at, null)
  const { POST } = load("app/api/auth/confirm-email/route.ts", {
    "@/utils/admin-elevation": { freshAuthClient: () => assert.fail("no verification") },
    "@/utils/supabase/server": { createClient: async () => assert.fail("no session") },
    "next/headers": { cookies: async () => ({ has: () => false, get: () => undefined }) },
    "@/lib/onboarding-schemas": { registrationSchema: { shape: { password: { safeParse: () => ({ success: false }) } } } },
  })
  const foreign = await POST(new NextRequest("https://outclass.example/api/auth/confirm-email", {
    method: "POST", headers: { origin: "https://elsewhere.example", host: "outclass.example", "content-type": "application/json" },
    body: JSON.stringify({ email: "student@virginia.edu", code: server.code }),
  }))
  assert.equal(foreign.status, 403)
  const viewing = await route(server, { cookies: ["outclass-platform-view"] }).send({ email: "student@virginia.edu", code: server.code })
  assert.equal(viewing.status, 403)
  assert.equal(server.account.email_confirmed_at, null)
})

test("an incomplete first confirmation signs the confirming session out and asks for a reset", async () => {
  const server = authServer()
  server.signUp("student@virginia.edu", "Earlier-Pass-1!")
  const base = server.client
  server.client = () => { const c = base(); c.auth.updateUser = async () => ({ error: { code: "unexpected_failure", status: 500 } }); return c }
  const { send, attached } = route(server)
  const response = await send({ email: "student@virginia.edu", code: server.code, password: "Owner-Pass-22!" })
  assert.equal(response.status, 503)
  assert.deepEqual(attached, [])
})

test("first-confirmation detection allows for clock difference only", () => {
  const { confirmedByThisVerification } = load("lib/signup-password.ts")
  const started = Date.parse("2026-11-10T12:00:00.000Z")
  assert.equal(confirmedByThisVerification({ email_confirmed_at: "2026-11-10T12:00:01.000Z" }, started), true)
  assert.equal(confirmedByThisVerification({ email_confirmed_at: "2026-11-10T11:59:30.000Z" }, started), true)
  assert.equal(confirmedByThisVerification({ email_confirmed_at: "2026-11-10T11:55:00.000Z" }, started), false)
  assert.equal(confirmedByThisVerification({ email_confirmed_at: null }, started), false)
})

test("in-app code verification goes through the server route", async () => {
  for (const file of ["components/views/auth-view.tsx", "components/views/student-onboarding-wizard.tsx"]) {
    const source = fs.readFileSync(path.join(root, file), "utf8")
    assert.ok(!source.includes("auth.verifyOtp("), `${file} does not verify codes in the browser`)
    assert.ok(source.includes("confirmEmailCode("), `${file} uses confirmEmailCode`)
  }
  const { confirmEmailCode } = load("lib/auth-email.ts")
  const calls = []
  const ok = await confirmEmailCode(" Student@Virginia.edu ", "123456", undefined, async (url, init) => {
    calls.push([url, JSON.parse(init.body)])
    return { ok: true, json: async () => ({ success: true, firstConfirmation: true, passwordSaved: false }) }
  })
  assert.deepEqual(ok, { ok: true, firstConfirmation: true, passwordSaved: false })
  assert.deepEqual(calls, [["/api/auth/confirm-email", { email: "student@virginia.edu", code: "123456" }]])
  const failed = await confirmEmailCode("student@virginia.edu", "123456", "x", async () => ({ ok: false, json: async () => ({ error: "That code isn't valid." }) }))
  assert.deepEqual(failed, { ok: false, error: "That code isn't valid." })
})
