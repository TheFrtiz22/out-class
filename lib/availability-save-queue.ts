import type { AvailabilityDocument, AvailabilitySchedule } from "@/lib/availability"

export type SaveState = "saved" | "unsaved" | "saving" | "error"
/** Serializes autosaves and keeps edits made during an in-flight request. */
export class AvailabilitySaveQueue {
  document: AvailabilityDocument
  state: SaveState = "saved"
  error = ""
  private generation = 0
  private persisted = 0
  private flight: Promise<void> | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private disposed = false
  constructor(initial: AvailabilityDocument, private save: (value: AvailabilityDocument) => Promise<AvailabilityDocument>, private notify: () => void, private delay = 650) { this.document = initial }
  get dirty() { return this.generation !== this.persisted }
  get saving() { return this.flight !== null }
  activate() { this.disposed = false }
  change(schedule: AvailabilitySchedule) {
    if (JSON.stringify(schedule) === JSON.stringify(this.document.schedule)) return
    this.document = { ...this.document, schedule }
    this.generation++; this.state = "unsaved"; this.error = ""
    this.notify()
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => { this.timer = null; void this.flush().catch(() => {}) }, this.delay)
  }
  async flush() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
    if (this.flight) return this.flight
    if (!this.dirty) return
    this.flight = (async () => {
      try {
        while (this.dirty) {
          const generation = this.generation, payload = this.document
          this.state = "saving"; if (!this.disposed) this.notify()
          const saved = await this.save(payload)
          this.document = { ...saved, schedule: generation === this.generation ? saved.schedule : this.document.schedule }
          this.persisted = generation
        }
        this.state = "saved"; this.error = ""
      } catch (error) {
        this.state = "error"; this.error = error instanceof Error ? error.message : "Could not save availability. Retry when connected."
        throw error
      } finally {
        this.flight = null; if (!this.disposed) this.notify()
      }
    })()
    return this.flight
  }
  dispose() { this.disposed = true; if (this.timer) clearTimeout(this.timer) }
}
