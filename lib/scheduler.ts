import type { ScheduleStudent } from "./data"

export type SchedulerSlot = {
  id: string
  time: string
  capacity: number
  bookedCount: number
  candidates: ScheduleStudent[]
}
export type ScheduleBlock = {
  id: string
  date: string
  locationName: string
  mapUrl: string
  slots: SchedulerSlot[]
}
export type ScheduleInput = {
  date: string
  locationName: string
  address: string
  startTime: string
  endTime: string
  duration: number
  capacity: number
}

export function parseTime(value: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error("Enter valid start and end times.")
  const [hours, minutes] = value.split(":").map(Number)
  return hours * 60 + minutes
}

export function generateTimeSlots(startTime: string, endTime: string, duration: number, capacity: number): SchedulerSlot[] {
  const start = parseTime(startTime)
  const end = parseTime(endTime)
  if (!Number.isInteger(duration) || duration <= 0) throw new Error("Slot duration must be a positive whole number.")
  if (!Number.isInteger(capacity) || capacity <= 0) throw new Error("Capacity must be a positive whole number.")
  if (end <= start) throw new Error("End time must be after start time on the same day.")
  if ((end - start) % duration !== 0) throw new Error("The time range must divide evenly into the slot duration.")
  return Array.from({ length: (end - start) / duration }, (_, index) => {
    const minutes = start + index * duration
    const hours = Math.floor(minutes / 60)
    return {
      id: crypto.randomUUID(),
      time: `${hours % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`,
      capacity, bookedCount: 0, candidates: [],
    }
  })
}

export function buildMapUrl(address: string, locationName: string): string {
  const query = address.trim() || locationName.trim()
  if (/^https?:\/\//i.test(query)) {
    try { return new URL(query).href } catch { throw new Error("Enter a valid maps URL or street address.") }
  }
  return `https://maps.google.com/?q=${encodeURIComponent(query)}`
}

export function createScheduleBlock(input: ScheduleInput): ScheduleBlock {
  const date = new Date(`${input.date}T12:00:00`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(date.getTime()) ||
    date.getFullYear() !== Number(input.date.slice(0, 4)) || date.getMonth() + 1 !== Number(input.date.slice(5, 7)) || date.getDate() !== Number(input.date.slice(8, 10))) {
    throw new Error("Select a valid date.")
  }
  if (!input.locationName.trim()) throw new Error("Enter a location display name.")
  return {
    id: crypto.randomUUID(), date: input.date, locationName: input.locationName.trim(),
    mapUrl: buildMapUrl(input.address, input.locationName),
    slots: generateTimeSlots(input.startTime, input.endTime, input.duration, input.capacity),
  }
}
