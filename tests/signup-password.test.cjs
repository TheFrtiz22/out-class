const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")

function load(file) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText
  new Function("require", "module", "exports", code)(require, mod, mod.exports)
  return mod.exports
}
const { setPasswordAfterConfirmation, passwordNotSavedNotice } = load("lib/signup-password.ts")

test("the verified session sets the signup password again", async () => {
  const calls = []
  const client = { auth: { updateUser: async input => { calls.push(input); return { error: null } } } }
  assert.deepEqual(await setPasswordAfterConfirmation(client, "Chosen-Pass-1!"), { saved: true })
  assert.deepEqual(calls, [{ password: "Chosen-Pass-1!" }])
  // Before the confirmation step clears the stored password, Supabase Auth answers same_password (422).
  const unchanged = { auth: { updateUser: async () => ({ error: { code: "same_password", status: 422 } }) } }
  assert.deepEqual(await setPasswordAfterConfirmation(unchanged, "Chosen-Pass-1!"), { saved: true })
})

test("a missing password, a provider error or a thrown request reports not saved without throwing", async () => {
  const never = { auth: { updateUser: async () => assert.fail("no password, no call") } }
  assert.deepEqual(await setPasswordAfterConfirmation(never, undefined), { saved: false })
  assert.deepEqual(await setPasswordAfterConfirmation(never, ""), { saved: false })
  const failing = { auth: { updateUser: async () => ({ error: { code: "weak_password", status: 422 } }) } }
  assert.deepEqual(await setPasswordAfterConfirmation(failing, "x"), { saved: false })
  const throwing = { auth: { updateUser: async () => { throw new Error("network") } } }
  assert.deepEqual(await setPasswordAfterConfirmation(throwing, "x"), { saved: false })
  assert.equal(passwordNotSavedNotice, "Email confirmed. Your password wasn't saved, so sign in with an email code or reset it.")
})

test("the signup wizard re-sets the password only after a confirmed verification and clears it", () => {
  const source = fs.readFileSync(path.join(__dirname, "../components/views/student-onboarding-wizard.tsx"), "utf8")
  const step2 = source.slice(source.indexOf("async function onStep2Submit"), source.indexOf("async function resendCode"))
  const verify = step2.indexOf("supabase.auth.verifyOtp(")
  const confirmed = step2.indexOf("confirmedEmailSession(")
  const reset = step2.indexOf("setPasswordAfterConfirmation(supabase, pendingPassword.current)")
  const cleared = step2.indexOf("pendingPassword.current = undefined")
  const advance = step2.indexOf("setStep(3)")
  assert.ok(verify > 0 && confirmed > verify && reset > confirmed && cleared > reset && advance > cleared, "verify → identity check → password → clear → next step")
  const step1 = source.slice(source.indexOf("const result = await registerStudent("), source.indexOf("async function onStep2Submit"))
  assert.ok(step1.indexOf("if (result.error)") < step1.indexOf("pendingPassword.current = values.password"), "kept only after registration succeeds")
  assert.ok(!/useState[^\n]*pendingPassword|pendingPassword[^\n]*useState/.test(source), "never in rendered state")
  assert.match(step2, /setConfirmNotice\(password\.saved \? "" : passwordNotSavedNotice\)/, "a calm status, not the global alert")
  assert.match(source, /\{confirmNotice && <p role="status"/, "rendered as a status on step 3")
  assert.match(source.slice(source.indexOf("function onStep3Submit")), /^function onStep3Submit\([^)]*\) \{\n\s*setConfirmNotice\(""\)/, "cleared on step 3 submit")
  assert.match(source, /setCodeSent\(false\)\n\s*pendingPassword\.current = undefined/, "cleared on Use a different email")
  assert.match(source, /useEffect\(\(\) => \(\) => \{ pendingPassword\.current = undefined \}, \[\]\)/, "cleared on unmount")
})
