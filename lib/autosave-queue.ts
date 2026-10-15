export type AutosaveState = "idle" | "pending" | "saving" | "saved" | "error"

/** Shared successor to AvailabilitySaveQueue: one writer, immutable snapshots, latest edit wins. */
export class AutosaveQueue<T> {
  value: T
  state: AutosaveState = "idle"
  error = ""
  private generation = 0
  private persisted = 0
  private flight: Promise<void> | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private active = true
  constructor(initial: T, private save: (value: T) => Promise<void>, private notify: () => void, private recover: (value: T | null) => void = () => {}, private delay = 850) { this.value = structuredClone(initial) }
  get dirty() { return this.generation !== this.persisted }
  get saving() { return this.flight !== null }
  activate() { this.active = true }
  change(value: T) {
    if (JSON.stringify(value) === JSON.stringify(this.value)) return
    const statusChanged = this.state !== "pending"
    this.value = structuredClone(value)
    this.generation++
    this.recover(this.value)
    this.state = "pending"; this.error = ""
    if (statusChanged) this.notify()
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
        this.state = "error"
        this.error = error instanceof Error && !("digest" in error) ? error.message : "Your changes are still here. Reconnect and retry."
        throw error
      } finally { this.flight = null; if (this.active) this.notify() }
    }
    void run().then(resolve, reject)
    return flight
  }
  dispose() { this.active = false; if (this.timer) clearTimeout(this.timer); this.timer = null }
}
