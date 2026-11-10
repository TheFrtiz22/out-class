// The demo store and seed data load on demand, never statically, so live pages
// do not ship them. Activation state lives in ./activation (no demo data).
import { DemoUnavailableError } from "./activation"
export { isDemoActive, demoGate } from "./activation"
export type DemoStoreModule = typeof import("./store")
export type DemoWorkspaceModule = typeof import("./workspace")

let loaded: DemoStoreModule | null = null
let pending: Promise<DemoStoreModule> | null = null
let workspace: Promise<DemoWorkspaceModule> | null = null

export function loadDemoStore(): Promise<DemoStoreModule> {
  pending ??= import("./store").then(
    (module) => (loaded = module),
    (error) => {
      pending = null
      throw error
    },
  )
  return pending
}

/**
 * The loaded demo store, for synchronous reads inside DemoDataProvider's
 * children, which render only after the store has loaded and started.
 */
export function loadedDemoStore(): DemoStoreModule {
  if (!loaded) throw new Error("Demo Mode is not loaded.")
  return loaded
}

export function loadDemoWorkspace(): Promise<DemoWorkspaceModule> {
  // A failed chunk (offline, or removed by a deploy) rejects this call as unavailable,
  // never falls back to live, and is retried on the next call.
  workspace ??= import("./workspace").catch((cause) => {
    workspace = null
    throw new DemoUnavailableError(undefined, { cause })
  })
  return workspace
}
