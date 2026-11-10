// Demo Mode activation state shared by the demo store, DemoDataProvider and the
// live client adapters. It holds no demo data, so live bundles can import it.
//
// - "active" is set only by demoStore.start()/stop(), however the store was loaded.
// - "requested" is set by DemoDataProvider during its browser render, from the
//   server-verified demo cookie, so adapter calls made before the store finishes
//   loading wait for it instead of reaching a live server action.
export const DEMO_READY_TIMEOUT_MS = 10_000

export class DemoUnavailableError extends Error {
  constructor(message = "Demo Mode could not load. Check your connection and try again.", options?: { cause?: unknown }) {
    super(message, options)
    this.name = "DemoUnavailableError"
  }
}

type Waiter = { resolve: () => void; reject: (error: Error) => void }
let active = false
let requested = false
// Latched when a requested Demo Mode is turned off. Exiting clears the demo cookie
// before the page navigates away, so until that full reload every adapter call
// must fail closed rather than reach a live action.
let exited = false
let failure: Error | null = null
let waiters: Waiter[] = []

function settle(error?: Error) {
  const pending = waiters
  waiters = []
  for (const waiter of pending) {
    if (error) waiter.reject(error)
    else waiter.resolve()
  }
}

export function isDemoActive(): boolean {
  return active
}

export function isDemoRequested(): boolean {
  return requested
}

/** Called by demoStore.start() and stop() only. */
export function setDemoActive(value: boolean) {
  active = value
  if (value) {
    failure = null
    settle()
  }
}

/**
 * Records whether this page runs in Demo Mode. Browser only and idempotent, so a
 * server render, StrictMode's double render or a discarded concurrent render
 * cannot leave stale module state. Turning it off rejects pending waits.
 */
export function setDemoRequested(value: boolean) {
  if (typeof window === "undefined" || requested === value) return
  requested = value
  failure = null
  if (!value) {
    exited = true
    settle(turnedOff())
  }
}

const turnedOff = () => new DemoUnavailableError("Demo Mode was turned off. Reload the page to continue.")

/** Rejects pending and later demo calls until the provider retries. */
export function failDemoActivation(error: Error = new DemoUnavailableError()) {
  if (active) return
  failure = error
  settle(error)
}

/** Clears a recorded failure before the provider retries loading. */
export function retryDemoActivation() {
  failure = null
}

/**
 * True when the demo implementation must handle a call, false when the live
 * action may. While Demo Mode is requested but not yet started it waits, and on
 * failure or timeout it throws: it never falls through to the live API.
 */
export async function demoGate(timeoutMs = DEMO_READY_TIMEOUT_MS): Promise<boolean> {
  if (active) return true
  if (exited) throw turnedOff()
  if (!requested) return false
  if (failure) throw failure
  await new Promise<void>((resolve, reject) => {
    const waiter: Waiter = {
      resolve: () => {
        clearTimeout(timer)
        resolve()
      },
      reject: (error) => {
        clearTimeout(timer)
        reject(error)
      },
    }
    const timer = setTimeout(() => {
      waiters = waiters.filter((entry) => entry !== waiter)
      reject(new DemoUnavailableError())
    }, timeoutMs)
    waiters.push(waiter)
  })
  return true
}
