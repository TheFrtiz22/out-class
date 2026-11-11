const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const { execSync } = require("node:child_process")
const path = require("node:path")
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
  for (const route of ["app/(workspace)/home", "app/(workspace)/platform/events", "app/(workspace)/calendar", "app/(workspace)/profile", "app/(workspace)/explore/categories", "app/(workspace)/settings/account", "app/(workspace)/meetings"]) {
    const Loading = load(`${route}/loading.tsx`, { "@/components/outclass-loading-screen": { OutClassLoadingScreen }, "@/components/workspace-loading": { WorkspaceLoading: "WorkspaceLoading" }, "@/components/shell/workspace-route-loading": { WorkspaceRouteLoading: "WorkspaceRouteLoading" }, "@/components/ui/loading-state": { LoadingState: "LoadingState" } }).default
    assert.notEqual(Loading().type, OutClassLoadingScreen, route)
    assert.ok(["WorkspaceLoading", "WorkspaceRouteLoading", "LoadingState"].includes(Loading().type), route)
  }
  // A loading.tsx streams the persistent shell before its page runs, so a page that redirects under one loads a
  // second document instead of answering 307. Redirecting pages sit under no loader; their placeholder streams from
  // the page itself (club workspace, applications, clubs, inbox, platform overview), after the redirect check.
  const pages = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? pages(`${dir}/${entry.name}`) : entry.name === "page.tsx" ? [`${dir}/page.tsx`] : [])
  for (const page of pages("app/(workspace)").filter(page => /\bredirect\(/.test(fs.readFileSync(page, "utf8")))) {
    for (let dir = page.slice(0, page.lastIndexOf("/")); dir !== "app"; dir = dir.slice(0, dir.lastIndexOf("/"))) assert.equal(fs.existsSync(`${dir}/loading.tsx`), false, `${page} redirects under ${dir}/loading.tsx`)
  }
  for (const [page, fallback] of [["club/[clubId]/workspace", "WorkspaceRouteLoading"], ["applications", "WorkspaceLoading"], ["clubs", "WorkspaceLoading"], ["inbox", "WorkspaceLoading"], ["platform", "WorkspaceLoading"]]) {
    const source = fs.readFileSync(`app/(workspace)/${page}/page.tsx`, "utf8")
    assert.match(source, new RegExp(`<Suspense fallback={<${fallback} `.replace(/[{}()<]/g, "\\$&")), page)
    if (source.includes("redirect(")) assert.ok(source.indexOf("redirect(") < source.indexOf("<Suspense"), `${page} redirects before its placeholder streams`)
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
  // Demo data loads on demand through the shared loader, which the provider uses.
  assert.ok(staticImport(source("contexts/demo-context.tsx"), "@/lib/demo/loader"), "the demo provider loads the store through the shared loader")
  assert.match(source("lib/demo/loader.ts"), /import\("\.\/store"\)/, "demo data loads on demand")
  assert.match(source("contexts/corkboard-context.tsx"), /import\("@\/lib\/workspace-api"\)/, "corkboard adapters load on demand")
})

// Static (non-type) module specifiers of a source file: imports, side-effect imports,
// re-exports and require(), including multi-line forms. import() is excluded.
function staticSpecifiers(text) {
  const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
  const found = []
  for (const match of code.matchAll(/(?:^|[;\n])\s*(import|export)\s+(type\s+)?(?:[^"']*?\sfrom\s*)?["']([^"']+)["']/g))
    if (!match[2]) found.push(match[3])
  for (const match of code.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g)) found.push(match[1])
  return found
}
// Only modules without demo records may load statically outside lib/demo: the gate
// (loader, activation), server-side access/validation, and the monogram glyph generator (assets).
const allowedDemo = new Set(["loader", "activation", "access", "validate", "assets"])
function demoTarget(file, specifier) {
  const resolved = specifier.startsWith("@/") ? specifier.slice(2) : specifier.startsWith(".") ? path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)) : null
  const match = resolved?.match(/^lib\/demo\/([^/]+?)(\.tsx?)?$/)
  return match ? match[1] : null
}

test("the static-import scanner sees every form a regression could take", () => {
  const cases = [
    ['import { demoStore } from "@/lib/demo/store"', ["@/lib/demo/store"]],
    ['import {\n  demoStore,\n  demoUser,\n} from "@/lib/demo/store"\nimport { z } from "zod"', ["@/lib/demo/store", "zod"]],
    ['import "@/lib/demo/seed"', ["@/lib/demo/seed"]],
    ['"use client"\nimport "@/lib/demo/store"\nimport { z } from "zod"', ["@/lib/demo/store", "zod"]],
    ['export { demoDirectory } from "@/lib/demo/store"', ["@/lib/demo/store"]],
    ['export * from "@/lib/demo/workspace"', ["@/lib/demo/workspace"]],
    ['const store = require("@/lib/demo/store")', ["@/lib/demo/store"]],
  ]
  for (const [text, expected] of cases) assert.deepEqual(staticSpecifiers(text), expected, text)
  assert.equal(demoTarget("lib/x.ts", "./demo/store"), "store", "relative paths resolve")
  for (const text of ['import type { DemoState } from "@/lib/demo/seed"', 'const load = () => import("@/lib/demo/store")', '// import { demoStore } from "@/lib/demo/store"'])
    assert.deepEqual(staticSpecifiers(text).filter(s => demoTarget("components/x.tsx", s)), [], text)
})

test("live client adapters and components never statically import demo data or implementations", () => {
  const source = file => fs.readFileSync(file, "utf8")
  const files = execSync("git ls-files 'app/*.ts' 'app/*.tsx' 'components/*.ts' 'components/*.tsx' 'contexts/*.ts' 'contexts/*.tsx' 'hooks/*.ts' 'hooks/*.tsx' 'lib/*.ts' 'lib/*.tsx'", { encoding: "utf8" }).split("\n").filter(Boolean)
  for (const nested of ["components/qr/meeting-check-in.tsx", "app/layout.tsx", "lib/demo/store.ts", "components/views/explore-view.tsx"])
    assert.ok(files.includes(nested), `scanner covers ${nested}`)
  assert.ok(files.length > 300, "scanner covers the source tree")
  const imports = files.filter(file => !file.startsWith("lib/demo/")).flatMap(file => staticSpecifiers(source(file)).map(s => [file, demoTarget(file, s)]).filter(([, target]) => target))
  assert.deepEqual(imports.filter(([, target]) => !allowedDemo.has(target)), [], "load demo modules with import() behind the demo gate")
  assert.deepEqual(imports.filter(([, target]) => target === "assets").map(([file]) => file), ["components/product/design-patterns.tsx"], "the glyph generator stays limited to the design-system page")
  for (const gate of ["lib/demo/loader.ts", "lib/demo/activation.ts", "lib/demo/assets.ts"])
    assert.deepEqual(staticSpecifiers(source(gate)).filter(s => /^\.\/(store|seed|workspace|tasks|voting|interview)/.test(s)), [], `${gate} stays free of demo records`)
})

test("the root layout carries no club-customization provider or seed data", () => {
  const layout = fs.readFileSync("app/layout.tsx", "utf8")
  // Any import form (named, side-effect, re-export), including multi-line.
  const imports = [...layout.matchAll(/(?:^|[;\n])\s*(?:import|export)\s+(?:type\s+)?(?:[^"']*?\sfrom\s*)?["']([^"']+)["']/g)].map(m => m[1])
  assert.ok(imports.includes("@/contexts/corkboard-context"), "the import scan sees the layout's imports")
  assert.deepEqual(imports.filter(s => /club-customization|lib\/data$/.test(s)), [], "club customization loads only with the views that use it")
  assert.doesNotMatch(layout, /ClubCustomizationProvider/)
  assert.doesNotMatch(fs.readFileSync("lib/club-customization.tsx", "utf8"), /export function ClubCustomizationProvider/, "the store replaced the root provider")
})
