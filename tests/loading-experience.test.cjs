const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")

function load(file, mocks, globals = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  new Function("require", "module", "exports", ...Object.keys(globals), code)(
    name => name in mocks ? mocks[name] : require(name), mod, mod.exports, ...Object.values(globals),
  )
  return mod.exports
}

function provider({ hasSession = true, isImpersonating = false, demo = { isDemoEnabled: false } } = {}) {
  const values = [], deps = [], effects = [], requests = [], errors = []
  let cursor = 0
  const react = {
    createContext: () => ({ Provider: "AuthProvider" }),
    useRef(initial) { const i = cursor++; if (!(i in values)) values[i] = { current: initial }; return values[i] },
    useState(initial) {
      const i = cursor++
      if (!(i in values)) values[i] = initial
      return [values[i], value => { values[i] = value }]
    },
    useCallback(callback, next) {
      const i = cursor++
      if (!deps[i] || next.some((value, j) => value !== deps[i][j])) { deps[i] = next; values[i] = callback }
      return values[i]
    },
    useEffect(effect, next) {
      const i = cursor++
      if (!deps[i] || next.some((value, j) => value !== deps[i][j])) { deps[i] = next; effects.push(effect) }
    },
  }
  const demoIdentity = { id: "demo-user", memberships: [{ clubId: "demo-club", isOwner: true }] }
  const { AuthProvider } = load("contexts/auth-context.tsx", {
    react,
    "@/lib/workspace-read-diagnostics": { recordWorkspaceRead() {} },
    "@/utils/supabase/client": { createClient: () => ({ auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } }) },
    "@/lib/permissions": { hasWorkspace: member => member.isOwner === true },
    // The demo provider computes the sample identity; auth no longer imports the demo store.
    "@/contexts/demo-context": { useDemoMode: () => ({ ...demo, demoIdentity: demo.isDemoEnabled && demo.state ? demoIdentity : null }) },
  }, {
    fetch: (...args) => new Promise((resolve, reject) => requests.push({ args, resolve, reject })),
    console: { error: (...args) => errors.push(args) },
  })
  return {
    requests, errors, demoIdentity,
    render() { cursor = 0; return AuthProvider({ children: "WORKSPACE", hasSession, isImpersonating }).props.value },
    effects() { effects.splice(0).forEach(effect => effect()) },
  }
}

const settle = () => new Promise(resolve => setImmediate(resolve))
const identity = { id: "user-id", memberships: [{ clubId: "club-a", isOwner: true }, { clubId: "club-b", isOwner: true }] }

test("anonymous entry never blocks on identity or sends a users/me request", () => {
  const h = provider({ hasSession: false })
  assert.equal(h.render().sessionPending, false)
  h.effects()
  assert.equal(h.requests.length, 0)
  assert.equal(h.render().loading, false)
})

test("known sessions stay pending only until the real identity request resolves", async () => {
  const h = provider()
  assert.equal(h.render().sessionPending, true)
  h.effects()
  assert.deepEqual(h.requests[0].args, ["/api/users/me"])
  assert.equal(h.render().sessionPending, true, "Unresolved requests keep the entry state stable")
  h.requests[0].resolve({ ok: true, json: async () => identity })
  await settle()
  assert.equal(h.render().sessionPending, false)
  assert.equal(h.render().user, identity)
  assert.equal(h.render().activeClubId, "club-a")
})

test("HTTP failures, lost connections, and invalid responses all release the entry loader", async () => {
  for (const outcome of ["unauthorized", "server-error", "network", "bad-json"]) {
    const h = provider()
    h.render(); h.effects()
    if (outcome === "network") h.requests[0].reject(new Error("Offline"))
    else if (outcome === "bad-json") h.requests[0].resolve({ ok: true, json: async () => { throw Error("Invalid response") } })
    else h.requests[0].resolve({ ok: false, status: outcome === "unauthorized" ? 401 : 503 })
    await settle()
    assert.equal(h.render().sessionPending, false, outcome)
    assert.equal(h.render().loading, false, outcome)
    assert.equal(h.render().user, null, outcome)
  }
})

test("identity refreshes and club selection keep ready workspace content mounted", async () => {
  const h = provider()
  h.render(); h.effects()
  h.requests[0].resolve({ ok: true, json: async () => identity })
  await settle()
  h.render().selectClub("club-b")
  const refresh = h.render().refreshUser()
  assert.equal(h.render().sessionPending, false)
  assert.equal(h.render().activeClubId, "club-b")
  assert.equal(h.render().user, identity)
  h.requests[1].resolve({ ok: true, json: async () => ({ ...identity, name: "Updated user" }) })
  await refresh
  assert.equal(h.render().sessionPending, false)
  assert.equal(h.render().user.name, "Updated user")
})

test("demo identity never waits for live authentication; support view retains its identity flag", async () => {
  const demo = provider({ demo: { isDemoEnabled: true, state: { perspective: { clubId: "demo-club" } } } })
  assert.equal(demo.render().sessionPending, false)
  assert.equal(demo.render().user, demo.demoIdentity)
  demo.effects()
  await demo.render().refreshUser()
  assert.equal(demo.requests.length, 0)
  const support = provider({ isImpersonating: true })
  assert.equal(support.render().sessionPending, true)
  assert.equal(support.render().isImpersonating, true)
  support.effects()
  support.requests[0].resolve({ ok: true, json: async () => ({ ...identity, impersonating: true }) })
  await settle()
  assert.equal(support.render().sessionPending, false)
  assert.equal(support.render().isImpersonating, true)
  assert.equal(support.render().user.impersonating, true)
})

test("session boundary swaps immediately and returns ready children without a wrapper", () => {
  let sessionPending = true
  const { AuthSessionBoundary } = load("components/auth-session-boundary.tsx", {
    "@/contexts/auth-context": { useAuth: () => ({ sessionPending }) },
    "@/components/outclass-loading-screen": { OutClassLoadingScreen: "OutClassLoadingScreen" },
  })
  const children = { type: "ExistingWorkspace" }
  assert.equal(AuthSessionBoundary({ children }).type, "OutClassLoadingScreen")
  sessionPending = false
  assert.equal(AuthSessionBoundary({ children }), children)
})

test("route loader uses the branded mark with a stable image box and accessible status", () => {
  const { OutClassLoadingScreen } = load("components/outclass-loading-screen.tsx", { "next/image": { default: "Image", __esModule: true } })
  const light = OutClassLoadingScreen({})
  assert.equal(light.props.role, "status")
  assert.equal(light.props["aria-busy"], "true")
  assert.equal(light.props["data-variant"], "light")
  const identity = light.props.children
  const [mark, accent, label] = identity.props.children
  assert.equal(identity.props.className, "oc-loading-identity")
  assert.equal(accent.props.className, "oc-loading-line")
  assert.equal(accent.props["aria-hidden"], "true")
  assert.equal(mark.props.src, "/brand/premium-board/07_favicon.svg")
  assert.equal(mark.props.width, 72)
  assert.equal(mark.props.height, 72)
  assert.equal(mark.props.alt, "")
  assert.equal(label.props.children, "Loading OutClass…")
  assert.equal(label.props.className, "oc-loading-caption")
  assert.equal(OutClassLoadingScreen({ variant: "navy" }).props["data-variant"], "navy")
  // Workspace routes keep the persistent shell on screen: their loaders are content-area placeholders, never the
  // full-screen cover (that stays for the first session restore, demo setup and /preview). Public routes have none.
  for (const route of ["app/(workspace)/home", "app/(workspace)/applications", "app/(workspace)/club/[clubId]/workspace", "app/(workspace)/platform", "app/(workspace)/calendar", "app/(workspace)/inbox", "app/(workspace)/profile", "app/(workspace)/clubs", "app/(workspace)/explore/categories", "app/(workspace)/club/[clubId]/tasks", "app/(workspace)/settings", "app/(workspace)/meetings"]) {
    const Loading = load(`${route}/loading.tsx`, { "@/components/outclass-loading-screen": { OutClassLoadingScreen }, "@/components/workspace-loading": { WorkspaceLoading: "WorkspaceLoading" }, "@/components/shell/workspace-route-loading": { WorkspaceRouteLoading: "WorkspaceRouteLoading" }, "@/components/ui/loading-state": { LoadingState: "LoadingState" } }).default
    assert.notEqual(Loading().type, OutClassLoadingScreen, route)
    assert.ok(["WorkspaceLoading", "WorkspaceRouteLoading", "LoadingState"].includes(Loading().type), route)
  }
  assert.equal(fs.existsSync("app/(workspace)/loading.tsx"), false, "a group loading.tsx would stream 200s for pages that call notFound()")
  assert.equal(fs.existsSync("app/loading.tsx"), false, "a root loading.tsx would cover every public page and turn 404s into 200s")
})

test("root providers keep demo data, workspace adapters and the Supabase client out of every page's bundle", () => {
  const source = file => fs.readFileSync(file, "utf8")
  const staticImport = (text, module) => new RegExp(`^import(?!\\s+type\\b)[^;\\n]*from\\s+["']${module}["']`, "m").test(text)
  for (const file of ["contexts/auth-context.tsx", "contexts/demo-context.tsx", "contexts/demo-mode.ts", "contexts/corkboard-context.tsx"]) {
    assert.equal(staticImport(source(file), "@/lib/demo/store"), false, `${file} must not statically import the demo store`)
    assert.equal(staticImport(source(file), "@/lib/workspace-api"), false, `${file} must not statically import the workspace adapters`)
  }
  for (const file of ["contexts/auth-context.tsx", "components/shell/product-shell.tsx"])
    assert.equal(staticImport(source(file), "@/utils/supabase/client"), false, `${file} must load the Supabase browser client on demand`)
  assert.match(source("contexts/auth-context.tsx"), /import\("@\/utils\/supabase\/client"\)/, "signed-in sessions load the auth listener on demand")
  assert.match(source("contexts/demo-context.tsx"), /import\("@\/lib\/demo\/store"\)/, "demo data loads on demand")
  assert.match(source("contexts/corkboard-context.tsx"), /import\("@\/lib\/workspace-api"\)/, "corkboard adapters load on demand")
})
