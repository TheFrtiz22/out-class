const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")

function load(file, mocks = {}, window = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  new Function("require", "module", "exports", "window", code)(name => {
    if (name in mocks) return mocks[name]
    if (name.endsWith(".css")) return {}
    if (name === "next/link") return { default: "Link" }
    if (name.startsWith("@/components/")) return new Proxy({}, { get: (_, key) => key })
    if (name.startsWith("@/")) return load(`${name.slice(2)}.ts`, mocks, window)
    return require(name)
  }, mod, mod.exports, window)
  return mod.exports
}

function hooks() {
  const values = []
  let cursor = 0
  return {
    react: {
      useState(initial) {
        const index = cursor++
        if (!(index in values)) values[index] = initial
        return [values[index], value => { values[index] = typeof value === "function" ? value(values[index]) : value }]
      },
      useEffect() {},
      useRef: value => ({ current: value }),
    },
    render(component) { cursor = 0; return component() },
  }
}

const nodes = node => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]
const submit = { preventDefault() {} }

function setup(auth = {}, props = {}, search = "") {
  const h = hooks()
  const window = { location: { origin: "http://localhost:3000", search, href: "" } }
  const C = load("components/views/auth-view.tsx", {
    react: h.react,
    "@/contexts/auth-context": { useAuth: () => ({ isImpersonating: false }) },
    "@/utils/supabase/client": { createClient: () => ({ auth }) },
  }, window).AuthView
  const render = () => nodes(h.render(() => C({ onBack() {}, onEnter() {}, ...props }))).find(n => n.type === "LoginAuthPanel").props
  return { render, window }
}

test("email stays collapsed, callback errors remain visible, and reveal retains entered credentials", () => {
  const { render } = setup({}, { initialError: "Please use your UVA account." })
  let p = render()
  assert.equal(p.emailExpanded, false)
  assert.equal(p.error, "Please use your UVA account.")
  p.onToggleEmail()
  p = render()
  p.onEmailChange("student@virginia.edu")
  p.onPasswordChange("test password")
  p.onToggleEmail()
  p = render()
  assert.equal(p.emailExpanded, false)
  assert.equal(p.email, "student@virginia.edu")
  assert.equal(p.password, "test password")
  assert.equal(p.error, "")
})

test("invalid UVA addresses never call Supabase for password or code login", async () => {
  const { render } = setup()
  render().onEmailChange("student@example.com")
  await render().onSignIn(submit)
  assert.equal(render().error, "Use your UVA email ending in @virginia.edu.")
  await render().onRequestCode()
  assert.equal(render().error, "Enter your UVA email first.")
  assert.equal(render().loading, false)
})

test("password login preserves normalized credentials, pending state, provider errors and safe return routing", async () => {
  let resolve, payload
  const { render, window } = setup({ signInWithPassword: input => { payload = input; return new Promise(done => { resolve = done }) } }, {}, "?next=%2Finterviews%2Fbook")
  render().onEmailChange(" Student@virginia.edu ")
  render().onPasswordChange("test password")
  let pending = render().onSignIn(submit)
  assert.equal(render().loading, true)
  assert.deepEqual(payload, { email: "student@virginia.edu", password: "test password" })
  resolve({ error: { message: "Invalid login credentials" } })
  await pending
  assert.equal(render().error, "Invalid login credentials")
  assert.equal(render().loading, false)
  assert.equal(window.location.href, "")
  pending = render().onSignIn(submit)
  resolve({ error: null })
  await pending
  assert.equal(window.location.href, "/interviews/book")
})

test("UVA button retains Azure OAuth, scopes, callback URL and redirect loading", async () => {
  let payload
  const { render } = setup({ signInWithOAuth: async input => { payload = input; return { error: null } } }, {}, "?next=%2Fclub-access%2Fexample")
  await render().onMicrosoftLogin()
  assert.deepEqual(payload, { provider: "azure", options: { scopes: "email", redirectTo: "http://localhost:3000/auth/callback?next=%2Fclub-access%2Fexample" } })
  assert.equal(render().microsoftLoading, true)
  const failed = setup({ signInWithOAuth: async () => { throw Error("Unavailable") } })
  await failed.render().onMicrosoftLogin()
  assert.equal(failed.render().microsoftLoading, false)
  assert.equal(failed.render().error, "Unable to start Microsoft sign-in. Please try again.")
})

test("email-code flow preserves existing-account restriction, resend cooldown, token validation and confirmed identity redirect", async () => {
  const calls = []
  const user = { id: "student-id", email: "student@virginia.edu", email_confirmed_at: "2026-01-01" }
  const { render, window } = setup({
    signInWithOtp: async input => { calls.push(input); return { error: null } },
    verifyOtp: async input => { calls.push(input); return { data: { session: { user } }, error: null } },
    getUser: async () => ({ data: { user }, error: null }),
  })
  render().onEmailChange("Student@virginia.edu")
  await render().onRequestCode()
  assert.deepEqual(calls[0], { email: "student@virginia.edu", options: { shouldCreateUser: false } })
  assert.equal(render().step, "verify")
  assert.equal(render().resendSeconds, 60)
  await render().onRequestCode()
  assert.equal(calls.length, 1)
  render().onCodeChange("12a345678")
  assert.equal(render().code, "123456")
  await render().onVerifyCode(submit)
  assert.deepEqual(calls[1], { email: "student@virginia.edu", token: "123456", type: "email" })
  assert.equal(window.location.href, "/login")
  render().onDifferentEmail()
  assert.equal(render().emailExpanded, true)
  assert.equal(render().step, "email")
  assert.equal(render().code, "")
})

test("expired OTP and identity mismatch cannot redirect, and mismatched sessions sign out", async () => {
  let mismatch = false, signedOut = false
  const { render, window } = setup({
    signInWithOtp: async () => ({ error: null }),
    verifyOtp: async () => mismatch ? { data: { session: { user: { id: "other" } } }, error: null } : { error: { code: "otp_expired" } },
    getUser: async () => ({ data: { user: { id: "student-id", email: "student@virginia.edu", email_confirmed_at: "2026-01-01" } } }),
    signOut: async () => { signedOut = true },
  })
  render().onEmailChange("student@virginia.edu")
  await render().onRequestCode()
  render().onCodeChange("123456")
  await render().onVerifyCode(submit)
  assert.match(render().error, /expired/)
  mismatch = true
  await render().onVerifyCode(submit)
  assert.equal(signedOut, true)
  assert.equal(render().error, "Unable to confirm your sign-in. Please try again.")
  assert.equal(window.location.href, "")
})

test("auth presentation keeps collapsed controls inert and callback errors announced", () => {
  const h = hooks()
  const C = load("components/auth/login-auth-panel.tsx", { react: h.react, "./email-login-form": { EmailLoginForm: "EmailLoginForm" } }).LoginAuthPanel
  const p = setup({}, { initialError: "Microsoft sign-in failed." }).render()
  const tree = nodes(C(p))
  const reveal = tree.find(n => n.props?.id === "login-email-fields")
  assert.equal(reveal.props.inert, true)
  assert.equal(reveal.props["aria-hidden"], true)
  assert.equal(tree.find(n => n.props?.role === "alert").props.children, "Microsoft sign-in failed.")
  const uva = tree.find(n => n.type === "Button")
  assert.equal(uva.props.onClick, p.onMicrosoftLogin)
  const form = load("components/auth/email-login-form.tsx").EmailLoginForm(p)
  assert.equal(form.props.onSubmit, p.onSignIn)
  assert.equal(nodes(form).find(n => n.type === "Link").props.href, "/forgot-password")
  assert.equal(nodes(form).find(n => n.type === "Button").props.disabled, true)
})

test("public login cannot enter a demo and account creation retains its existing callback", () => {
  for (const initialRole of ["student", "leader"]) {
    let entered, created = false
    const p = setup({}, { initialRole, onEnter: view => { entered = view }, onCreateAccount: () => { created = true } }).render()
    assert.equal(p.onDemo, undefined)
    p.onCreateAccount()
    assert.equal(entered, undefined)
    assert.equal(created, true)
  }
})
