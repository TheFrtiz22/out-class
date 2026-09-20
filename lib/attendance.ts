"use client"

import { useSyncExternalStore } from "react"

export type LeadStudent = { id: string; name: string; email: string; year: string; major: string }
export type Attendance = { student: LeadStudent; studentId: string; clubId: string; eventId: string; checkedInAt: string }
const KEY = "outclass-demo-attendance-v1"
const CHANGE = "outclass-attendance-change"
const EMPTY: Attendance[] = []
let cachedRaw: string | null = null
let cached: Attendance[] = EMPTY

function snapshot() {
  let raw: string | null
  try { raw = localStorage.getItem(KEY) } catch { return cached }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    try {
      const parsed = JSON.parse(raw ?? "[]")
      cached = Array.isArray(parsed) ? parsed.filter(row => row && typeof row.studentId === "string" && typeof row.clubId === "string" && typeof row.eventId === "string" && row.student && ["id", "name", "email", "year", "major"].every(key => typeof row.student[key] === "string")) : EMPTY
    } catch { cached = EMPTY }
  }
  return cached
}
function subscribe(notify: () => void) {
  window.addEventListener("storage", notify)
  window.addEventListener(CHANGE, notify)
  return () => { window.removeEventListener("storage", notify); window.removeEventListener(CHANGE, notify) }
}
export function useAttendance() {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY)
}
/** Preview repository only. Production must derive student identity from a verified session. */
export function recordDemoAttendance(student: LeadStudent, clubId: string, eventId: string) {
  const rows = snapshot()
  if (rows.some(row => row.studentId === student.id && row.clubId === clubId && row.eventId === eventId)) return
  const row: Attendance = { student, studentId: student.id, clubId, eventId, checkedInAt: new Date().toISOString() }
  localStorage.setItem(KEY, JSON.stringify([...rows, row]))
  window.dispatchEvent(new Event(CHANGE))
}
export function eventsAttended(rows: Attendance[], clubId: string, studentId: string) {
  return new Set(rows.filter(row => row.clubId === clubId && row.studentId === studentId).map(row => row.eventId)).size
}
