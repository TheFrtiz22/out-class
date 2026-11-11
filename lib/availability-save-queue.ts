import type { AvailabilityDocument, AvailabilitySchedule } from "@/lib/availability"
import { OfflineError } from "@/lib/autosave-queue"
import { browserOnline, connectionMessage, connectionProblem, type ConnectionProblem, type DraftWriteResult } from "@/lib/autosave-store"

export type SaveState = "saved" | "unsaved" | "saving" | "offline" | "unreachable" | "error"
export type AvailabilityQueueOptions = { recover?: (value: AvailabilityDocument | null) => DraftWriteResult | void; online?: () => boolean }
/** Serializes autosaves and keeps edits made during an in-flight request; offline edits wait for reconnect. */
export class AvailabilitySaveQueue {
  document: AvailabilityDocument
  state: SaveState = "saved"
  error = ""
  private generation = 0
  private persisted = 0
  private flight: Promise<void> | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private disposed = false
  stored: DraftWriteResult | undefined
  private recover: NonNullable<AvailabilityQueueOptions["recover"]>
  private online: () => boolean
  constructor(initial: AvailabilityDocument, private save: (value: AvailabilityDocument) => Promise<AvailabilityDocument>, private notify: () => void, private delay = 650, options: AvailabilityQueueOptions = {}) {
    this.document = initial; this.recover = options.recover ?? (() => {}); this.online = options.online ?? browserOnline
  }
  get dirty() { return this.generation !== this.persisted }
  get saving() { return this.flight !== null }
  activate() { this.disposed = false }
  change(schedule: AvailabilitySchedule) {
    if (JSON.stringify(schedule) === JSON.stringify(this.document.schedule)) return
    this.document = { ...this.document, schedule }
    this.generation++; this.stored = this.recover(this.document) || false
    if (this.online()) { this.state = "unsaved"; this.error = "" } else this.connection("offline")
    this.notify()
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => { this.timer = null; void this.flush().catch(() => {}) }, this.delay)
  }
  async flush() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
    if (this.flight) return this.flight
    if (!this.dirty) return
    if (!this.online()) { this.connection("offline"); if (!this.disposed) this.notify(); throw new OfflineError(this.error) }
    this.flight = (async () => {
      try {
        while (this.dirty) {
          const generation = this.generation, payload = this.document
          this.state = "saving"; if (!this.disposed) this.notify()
          const saved = await this.save(payload)
          this.document = { ...saved, schedule: generation === this.generation ? saved.schedule : this.document.schedule }
          this.persisted = generation
        }
        this.state = "saved"; this.error = ""; this.recover(null)
      } catch (error) {
        const problem = connectionProblem(error, this.online())
        if (problem) { this.connection(problem); throw new OfflineError(this.error) }
        this.state = "error"; this.error = error instanceof Error ? error.message : "Could not save availability. Retry when connected."
        throw error
      } finally {
        this.flight = null; if (!this.disposed) this.notify()
      }
    })()
    return this.flight
  }
  markOffline() { if (this.dirty && !this.flight && this.state !== "offline") { this.connection("offline"); if (!this.disposed) this.notify() } }
  private connection(problem: ConnectionProblem) { this.state = problem; this.error = connectionMessage(problem, this.stored) }
  dispose() { this.disposed = true; if (this.timer) clearTimeout(this.timer) }
}
