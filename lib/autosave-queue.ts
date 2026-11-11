import { browserOnline, connectionMessage, connectionProblem, type ConnectionProblem, type DraftWriteResult } from "@/lib/autosave-store"

/** "offline": navigator.onLine is false. "unreachable": online, but the request never reached OutClass. */
export type AutosaveState = "idle" | "pending" | "saving" | "saved" | "offline" | "unreachable" | "error"
/** Rejection used when a save could not reach the server (offline or unreachable); the edit is kept. */
export class OfflineError extends Error { name = "OfflineError" }

/**
 * Shared successor to AvailabilitySaveQueue: one writer, immutable snapshots, latest edit wins.
 * `recover` stores the unsaved copy and reports where it landed, so the offline status is accurate.
 * Offline or unreachable keeps the edit and waits for `online`/Retry. While `held` (a recovered copy is
 * being offered or reviewed), changes are refused so the offered copy is never overwritten or saved.
 */
export class AutosaveQueue<T> {
  value: T
  state: AutosaveState = "idle"
  error = ""
  private generation = 0
  private persisted = 0
  private flight: Promise<void> | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private active = true
  /** Where the newest unsaved copy landed: "device", "tab", or false. */
  stored: DraftWriteResult | undefined
  held = false
  constructor(initial: T, private save: (value: T) => Promise<void>, private notify: () => void, private recover: (value: T | null) => DraftWriteResult | void = () => {}, private delay = 850, private online: () => boolean = browserOnline) { this.value = structuredClone(initial) }
  get dirty() { return this.generation !== this.persisted }
  get saving() { return this.flight !== null }
  activate() { this.active = true }
  hold() { if (this.timer) clearTimeout(this.timer); this.timer = null; this.held = true }
  release() { this.held = false }
  change(value: T) {
    if (this.held || JSON.stringify(value) === JSON.stringify(this.value)) return
    const statusChanged = this.state !== "pending"
    this.value = structuredClone(value)
    this.generation++
    this.stored = this.recover(this.value) || false
    if (this.online()) { this.state = "pending"; this.error = "" }
    else { const changed = this.state !== "offline"; this.connection("offline"); if (changed) this.notify() }
    if (statusChanged && this.state === "pending") this.notify()
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => { this.timer = null; void this.flush().catch(() => {}) }, this.delay)
  }
  reset(value: T) {
    if (this.flight) throw Error("Wait for the current save to finish.")
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.value = structuredClone(value); this.persisted = this.generation
    this.state = "idle"; this.error = ""; this.recover(null); this.notify()
  }
  flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (this.flight) return this.flight
    if (!this.dirty) return Promise.resolve()
    if (this.held) return Promise.resolve()
    if (!this.online()) { this.connection("offline"); if (this.active) this.notify(); return Promise.reject(new OfflineError(this.error)) }
    let resolve!: () => void, reject!: (error: unknown) => void
    const flight = new Promise<void>((yes, no) => { resolve = yes; reject = no })
    this.flight = flight
    const run = async () => {
      try {
        while (this.dirty) {
          const generation = this.generation, payload = structuredClone(this.value)
          this.state = "saving"; if (this.active) this.notify()
          await this.save(payload)
          this.persisted = generation
        }
        this.state = "saved"; this.error = ""; this.recover(null)
      } catch (error) {
        const problem = connectionProblem(error, this.online())
        if (problem) { this.connection(problem); throw new OfflineError(this.error) }
        this.state = "error"
        this.error = error instanceof Error && !("digest" in error) ? error.message : "Your changes are still here. Reconnect and retry."
        throw error
      } finally { this.flight = null; if (this.active) this.notify() }
    }
    void run().then(resolve, reject)
    return flight
  }
  /** The browser reported loss of connection: show it now rather than after the next failed save. */
  markOffline() { if (this.dirty && !this.flight && this.state !== "offline") { this.connection("offline"); if (this.active) this.notify() } }
  private connection(problem: ConnectionProblem) { this.state = problem; this.error = connectionMessage(problem, this.stored) }
  dispose() { this.active = false; if (this.timer) clearTimeout(this.timer); this.timer = null }
}
