"use client"

import { useDemoMode } from "@/contexts/demo-context"
import { demoStore, demoDashboard, demoNotifications, demoDeadlines } from "@/lib/demo/store"
import { createContext, useCallback, useContext, useMemo, useState, useEffect, type Dispatch, type SetStateAction, type ReactNode } from "react"
import {
  managedEvents as seedManagedEvents, currentStudent, clubs, studentMemberships,
  type ManagedEvent,
  trackedApplications as seedTrackedApplications,
  notifications as seedNotifications,
  events as seedEvents,
  type TrackedApplication,
  type Notification,
  type ClubEvent,
} from "@/lib/data"

import { studentCalendarEvents } from "@/lib/student-calendar-data"
import { dateKey, dateFromKey, timeMinutes, managedOccurrences } from "@/lib/calendar"
import { buildMapUrl, type ScheduleBlock } from "@/lib/scheduler"

/**
 * Single source of truth for "did the student apply to this club".
 * Discover's Apply/Save action writes here once, and the Application Hub
 * (tracker), Notification Center (inbox), and Calendar all read from this
 * same context — so they update together instead of drifting out of sync.
 */

type ClubRef = {
  applicationId?: string
  applicationStatus?: TrackedApplication["status"]
  id: string
  name: string
  logoUrl?: string | null
  logoText: string
  color: string
}

type LeaderFocus = { clubId: string; applicantId?: string; roundId?: string }
type ApplicationStateValue = {
  leaderFocus: LeaderFocus | null
  focusLeader: (value: LeaderFocus) => void
  clearLeaderFocus: () => void
  hydrated: boolean
  syncApplications: (apps: TrackedApplication[]) => void
  trackedApps: TrackedApplication[]
  notifications: Notification[]
  events: ClubEvent[]
  appliedClubIds: Set<string>
  isApplied: (clubId: string) => boolean
  applyToClub: (club: ClubRef) => void
  markNotificationRead: (id: string) => void
  setNotificationsRead: (ids: string[], read: boolean) => void
  deleteNotifications: (ids: string[]) => void
  restoreNotifications: (items: Notification[]) => void
  /** clubId of the application the Dashboard wants the Tracker to open, if any. */
  focusApplicationClubId: string | null
  focusApplication: (clubId: string) => void
  clearApplicationFocus: () => void
  focusEventId: string | null
  focusEvent: (id: string | null) => void
  focusNotificationId: string | null
  focusNotification: (id: string | null) => void
  respondToEvent: (id: string, response: "going" | "confirmed" | "declined") => void
  managedEvents: ManagedEvent[]
  setManagedEvents: Dispatch<SetStateAction<ManagedEvent[]>>
  scheduleBlocks: ScheduleBlock[]
  setScheduleBlocks: Dispatch<SetStateAction<ScheduleBlock[]>>
  bookInterview: (blockId: string, slotId: string) => string | null
  submitApplication: (id: string) => void
  calendarYear: number
  setCalendarYear: (year: number) => void
  cancelInterview: () => void
  notifyEventChange: (event: ManagedEvent, cancelled?: boolean) => void
}

const ApplicationStateContext = createContext<ApplicationStateValue | null>(null)

// Persist the demo across navigation and reloads on this browser only.
const STORAGE_KEY = "outclass-platform-v2"

export function ApplicationStateProvider({ children, initialData, persistLocalState = initialData == null }: { children: ReactNode, initialData?: any, persistLocalState?: boolean }) {
  const demo = useDemoMode()
  if (demo.isDemoEnabled) { initialData = demoDashboard(); persistLocalState = false }
  // Map Prisma database models back to the UI's TrackedApplication structure
  const serverApps = initialData?.applications?.map((app: any) => ({
    id: app.id,
    clubId: app.clubId,
    clubName: app.club?.name || app.clubId,
    logoText: app.club?.logoText || "OC",
    logoUrl: app.club?.logoUrl,
    color: app.club?.color || "#051B3D",
    status: ({ DRAFTING: "Drafting", SUBMITTED: "Submitted", IN_REVIEW: "In Review", INTERVIEWING: "Interviewing", ACCEPTED: "Accepted", REJECTED: "Rejected", WAITLISTED: "Waitlisted" } as Record<string, string>)[app.status] || app.round?.name || "In Review",
    questionsCompleted: app.answers?.length || 0,
    questionsTotal: app.club?._count?.questions ?? 0,
    nextDeadline: app.status === "DRAFTING" ? "Finish draft" : "Under review",
    dueInHours: 0
  })) || []

  const [leaderFocus, focusLeader] = useState<LeaderFocus | null>(null)
  const clearLeaderFocus = useCallback(() => focusLeader(null), [])
  const [trackedApps, setTrackedApps] = useState<TrackedApplication[]>(initialData ? serverApps : seedTrackedApplications)
  const [notifications, setNotifications] = useState<Notification[]>(initialData ? [] : seedNotifications)
  
  const serverEvents = studentCalendarEvents(initialData)

  const [baseEvents, setEvents] = useState<ClubEvent[]>(initialData ? serverEvents : seedEvents)
  const [managedEvents, setManagedEvents] = useState<ManagedEvent[]>(initialData ? [] : seedManagedEvents)
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([])
  const [responses, setResponses] = useState<Record<string, ClubEvent["response"]>>({})
  const [focusEventId, focusEvent] = useState<string | null>(null)
  const [focusNotificationId, focusNotification] = useState<string | null>(null)
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear())
  const [hydrated, setHydrated] = useState(false)

  const activeStorageKey = STORAGE_KEY

  useEffect(() => {
    if (!persistLocalState) { setHydrated(true); return }
    try {
      const saved = JSON.parse(localStorage.getItem(activeStorageKey) ?? "null")
      if (saved && Array.isArray(saved.trackedApps) && Array.isArray(saved.notifications) && Array.isArray(saved.baseEvents) && Array.isArray(saved.managedEvents) && Array.isArray(saved.scheduleBlocks)) {
        setTrackedApps(saved.trackedApps); setNotifications(saved.notifications); setEvents(saved.baseEvents)
        setManagedEvents(saved.managedEvents); setScheduleBlocks(saved.scheduleBlocks); setResponses(saved.responses ?? {})
      }
    } catch { /* Keep the sample data if browser storage is unavailable. */ }
    setHydrated(true)
  }, [persistLocalState, activeStorageKey])
  
  useEffect(() => {
    if (!hydrated || !persistLocalState) return
    try { localStorage.setItem(activeStorageKey, JSON.stringify({ trackedApps, notifications, baseEvents, managedEvents, scheduleBlocks, responses })) } catch { /* State remains usable for this session. */ }
  }, [hydrated, persistLocalState, activeStorageKey, trackedApps, notifications, baseEvents, managedEvents, scheduleBlocks, responses])
  useEffect(() => {
    if (!demo.isDemoEnabled || !demo.state) return
    setTrackedApps(serverApps)
    setEvents([...studentCalendarEvents(demoDashboard()).map(event => event.type === "Other" && !event.id.startsWith("meeting-") ? { ...event, type: event.title.includes("coffee chat") ? "Coffee Chat" as const : "Interest Meeting" as const } : event), ...demoDeadlines()])
    setNotifications(demoNotifications())
    setResponses(demo.state.responses)
  }, [demo.state, demo.isDemoEnabled])
  const events = useMemo(() => baseEvents.map((event) => ({ ...event, response: responses[event.id] ?? event.response })), [baseEvents, responses])
  const [focusApplicationClubId, setFocusApplicationClubId] = useState<string | null>(null)

  const focusApplication = useCallback((clubId: string) => {
    setFocusApplicationClubId(clubId)
  }, [])

  const clearApplicationFocus = useCallback(() => {
    setFocusApplicationClubId(null)
  }, [])

  const appliedClubIds = useMemo(() => new Set(trackedApps.map((a) => a.clubId)), [trackedApps])

  const isApplied = useCallback((clubId: string) => appliedClubIds.has(clubId), [appliedClubIds])

  const applyToClub = useCallback(
    (club: ClubRef) => {
      if (appliedClubIds.has(club.id)) return

      const timestamp = Date.now()

      setTrackedApps((prev) => [
        ...prev,
        {
          id: club.applicationId ?? `trk-${timestamp}`,
          clubId: club.id,
          clubName: club.name,
          logoText: club.logoText,
          logoUrl: club.logoUrl,
          color: club.color,
          status: club.applicationStatus ?? "Drafting",
          questionsCompleted: 0,
          questionsTotal: 0,
          nextDeadline: "Deadline not provided",
          dueInHours: 0,
        },
      ])

      setNotifications((prev) => [
        {
          id: `n-${timestamp}`,
          type: "Announcement",
          urgent: false,
          club: club.name,
          clubId: club.id,
          color: club.color,
          logoText: club.logoText,
          logoUrl: club.logoUrl,
          senderName: "Recruitment Team",
          senderTitle: `${club.name} — Recruitment`,
          title: `${club.name} application ${club.applicationId ? "ready" : "started"}`,
          preview: club.applicationId ? "Open your application from Application Tracker." : "Your draft is ready. Complete and submit it from Application Tracker.",
          body: [club.applicationId ? "Open your application from Application Tracker." : "Your draft is ready. Complete and submit it from Application Tracker."],
          timestamp: "Just now",
          fullDate: "Just now",
          createdAt: new Date(timestamp).toISOString(),
          read: false,
        },
        ...prev,
      ])


    },
    [appliedClubIds],
  )

  const markNotificationRead = useCallback((id: string) => {
    if (demoStore.active()) { demoStore.mutate(s => { if (!s.readNotifications.includes(id)) s.readNotifications.push(id) }); return }
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }, [])

  const setNotificationsRead = useCallback((ids: string[], read: boolean) => {
    if (demoStore.active()) { demoStore.mutate(s => { s.readNotifications = [...s.readNotifications.filter(id => !ids.includes(id)), ...(read ? ids : [])] }); return }
    const targets = new Set(ids)
    setNotifications((prev) => prev.map((item) => targets.has(item.id) ? { ...item, read } : item))
  }, [])

  const deleteNotifications = useCallback((ids: string[]) => {
    if (demoStore.active()) { demoStore.mutate(s => { s.deletedNotifications.push(...ids) }); return }
    const targets = new Set(ids)
    setNotifications((prev) => prev.filter((item) => !targets.has(item.id)))
  }, [])

  const restoreNotifications = useCallback((items: Notification[]) => {
    if (demoStore.active()) { demoStore.mutate(s => { s.deletedNotifications = s.deletedNotifications.filter(id => !items.some(n => n.id === id)) }); return }
    setNotifications((prev) => [...prev, ...items.filter((item) => !prev.some((existing) => existing.id === item.id))])
  }, [])

  const respondToEvent = useCallback((id: string, response: "going" | "confirmed" | "declined") => {
    if (demoStore.active()) { demoStore.mutate(s => { s.responses[id] = response }); return }
    if (events.find(event => event.id === id)?.readOnly) return
    setResponses((previous) => ({ ...previous, [id]: response }))
    const event = events.find((item) => item.id === id)
    const managed = managedEvents.find((item) => id.startsWith(`managed-${item.id}-`))
    if (!event && !managed) return
    const title = event?.title ?? managed?.title ?? "Club event"
    const clubId = event?.clubId ?? managed?.clubId ?? ""
    const club = clubs.find((item) => item.id === clubId)
    const body = `${title}: ${response === "declined" ? "attendance cancelled" : response === "confirmed" ? "interview confirmed" : "RSVP confirmed"}.`
    setNotifications((previous) => [{ id: `response-${id}`, eventId: id, clubId, type: "Announcement", urgent: false, club: club?.name ?? studentMemberships.find((member) => member.clubId === clubId)?.clubName ?? event?.club ?? "Club event", color: club?.color ?? "#051B3D", logoText: club?.logoText ?? "OC", senderName: "OutClass", senderTitle: "Calendar update", title: body, preview: body, body: [body], timestamp: "Just now", fullDate: new Date().toLocaleString(), createdAt: new Date().toISOString(), read: false }, ...previous.filter((item) => item.id !== `response-${id}`)])
  }, [events, managedEvents])

  const bookInterview = useCallback((blockId: string, slotId: string): string | null => {
    const block = scheduleBlocks.find((item) => item.id === blockId)
    const slot = block?.slots.find((item) => item.id === slotId)
    if (!block || !slot) return "This interview slot is no longer available."
    const alreadyBooked = slot.candidates.some((candidate) => candidate.email === currentStudent.email)
    if (!alreadyBooked && slot.bookedCount >= slot.capacity) return "This slot is full. Choose another time."
    const start = dateFromKey(block.date)
    start.setHours(0, timeMinutes(slot.time), 0, 0)
    if (start <= new Date()) return "Choose a future interview time."
    setScheduleBlocks((previous) => previous.map((entry) => ({ ...entry, slots: entry.slots.map((entrySlot) => {
      const candidates = entrySlot.candidates.filter((candidate) => candidate.email !== currentStudent.email)
      if (entry.id === blockId && entrySlot.id === slotId) candidates.push({ name: currentStudent.name, email: currentStudent.email, initials: currentStudent.initials })
      return { ...entrySlot, candidates, bookedCount: candidates.length }
    }) })))
    const id = "interview-vvf-current"
    setEvents((previous) => [...previous.filter((event) => event.id !== id), { id, date: block.date, day: Number(block.date.slice(-2)), clubId: "vvf", club: "Virginia Venture Fund", color: "#051B3D", type: "Interview", title: "Virginia Venture Fund · Round 1 interview", time: slot.time, location: block.locationName, bookingSlotId: slotId, description: "Your reserved interview slot. To change it, choose another available time.", response: "confirmed" }])
    setResponses((previous) => ({ ...previous, [id]: "confirmed" }))
    setTrackedApps((previous) => previous.map((app) => app.clubId === "vvf" ? { ...app, status: "1st Round Interview", nextDeadline: `${block.date} at ${slot.time}` } : app))
    const body = `Your interview is booked for ${block.date} at ${slot.time}, ${block.locationName}.`
    setNotifications((previous) => [{ id: "booking-vvf", eventId: id, clubId: "vvf", type: "Interview Invite", urgent: false, club: "Virginia Venture Fund", color: "#051B3D", logoText: "VVF", senderName: "Recruitment Team", senderTitle: "Interview booking", title: "Interview booking confirmed", preview: body, body: [body], timestamp: "Just now", fullDate: new Date().toLocaleString(), createdAt: new Date().toISOString(), read: false }, ...previous.filter((item) => item.id !== "booking-vvf")])
    return null
  }, [scheduleBlocks])

  const cancelInterview = useCallback(() => {
    setScheduleBlocks((previous) => previous.map((block) => ({ ...block, slots: block.slots.map((slot) => {
      const candidates = slot.candidates.filter((candidate) => candidate.email !== currentStudent.email)
      return { ...slot, candidates, bookedCount: candidates.length }
    }) })))
    setEvents((previous) => previous.filter((event) => event.id !== "interview-vvf-current"))
    setTrackedApps((previous) => previous.map((app) => app.clubId === "vvf" ? { ...app, nextDeadline: "Choose a new interview time" } : app))
    setNotifications((previous) => previous.map((item) => item.id === "booking-vvf" ? { ...item, eventId: undefined, title: "Interview booking cancelled", preview: "Your interview slot was released. Choose a new time from Calendar.", body: ["Your interview slot was released. Choose a new time from Calendar."], read: false, createdAt: new Date().toISOString(), fullDate: new Date().toLocaleString() } : item))
  }, [])

  const notifyEventChange = useCallback((event: ManagedEvent, cancelled = false) => {
    if (event.scope === "Members Only" && !studentMemberships.some((membership) => membership.clubId === event.clubId)) return
    const club = clubs.find((item) => item.id === event.clubId)
    const body = cancelled ? `${event.title} has been cancelled.` : `${event.title} · ${event.date} at ${event.time}. Location: ${event.location}.`
    const eventId = !cancelled && !event.recurring ? `managed-${event.id}-${event.date}` : undefined
    setNotifications((previous) => [{ id: `managed-update-${event.id}`, eventId, clubId: event.clubId, type: "Announcement", urgent: cancelled, club: club?.name ?? studentMemberships.find((member) => member.clubId === event.clubId)?.clubName ?? event.clubId, color: club?.color ?? "#051B3D", logoText: club?.logoText ?? "OC", senderName: "Club leadership", senderTitle: "Club calendar update", title: `${event.title} ${cancelled ? "cancelled" : "scheduled / updated"}`, preview: body, body: [body], timestamp: "Just now", fullDate: new Date().toLocaleString(), createdAt: new Date().toISOString(), read: false }, ...previous.filter((item) => item.id !== `managed-update-${event.id}`)])
  }, [])

  const submitApplication = useCallback((id: string) => {
    const app = trackedApps.find((item) => item.id === id)
    if (!app || app.status !== "Drafting") return
    setTrackedApps((previous) => previous.map((app) => app.id === id ? { ...app, status: "Submitted", questionsCompleted: app.questionsTotal } : app))
    const body = `Your application to ${app.clubName} has been submitted.`
    setNotifications((previous) => [{ id: `submission-${id}`, clubId: app.clubId, type: "Announcement", urgent: false, club: app.clubName, color: app.color, logoText: app.logoText, senderName: "OutClass", senderTitle: "Application update", title: "Application submitted", preview: body, body: [body], timestamp: "Just now", fullDate: new Date().toLocaleString(), createdAt: new Date().toISOString(), read: false }, ...previous.filter((item) => item.id !== `submission-${id}`)])
  }, [trackedApps])

  const calendarEvents = useMemo(() => {
    const now = new Date()
    const meetings = managedOccurrences(managedEvents, new Date(Math.min(now.getFullYear(), calendarYear) - 1, 0, 1), new Date(Math.max(now.getFullYear(), calendarYear) + 1, 11, 31), new Set(studentMemberships.map((membership) => membership.clubId)))
    return [...events, ...meetings.map((event) => ({ ...event, club: clubs.find((club) => club.id === event.clubId)?.name ?? studentMemberships.find((member) => member.clubId === event.clubId)?.clubName ?? event.club, response: responses[event.id] }))]
  }, [events, managedEvents, responses, calendarYear])

  const value = useMemo(
    () => ({
      hydrated,
      leaderFocus, focusLeader, clearLeaderFocus,
      syncApplications: setTrackedApps,
      trackedApps,
      notifications,
      events: calendarEvents,
      appliedClubIds,
      isApplied,
      applyToClub,
      markNotificationRead,
      setNotificationsRead,
      deleteNotifications,
      restoreNotifications,
      focusApplicationClubId,
      focusApplication,
      clearApplicationFocus,
      focusEventId, focusEvent, focusNotificationId, focusNotification, respondToEvent,
      managedEvents, setManagedEvents, scheduleBlocks, setScheduleBlocks, bookInterview, submitApplication, cancelInterview, notifyEventChange, calendarYear, setCalendarYear,
    }),
    [
      leaderFocus, clearLeaderFocus,
      hydrated,
      trackedApps,
      notifications,
      calendarEvents,
      appliedClubIds,
      isApplied,
      applyToClub,
      markNotificationRead,
      setNotificationsRead,
      deleteNotifications,
      restoreNotifications,
      focusApplicationClubId,
      focusApplication,
      clearApplicationFocus,
      focusEventId, focusEvent, focusNotificationId, focusNotification, respondToEvent,
      managedEvents, setManagedEvents, scheduleBlocks, setScheduleBlocks, bookInterview, submitApplication, cancelInterview, notifyEventChange, calendarYear, setCalendarYear,
    ],
  )

  return <ApplicationStateContext.Provider value={value}>{children}</ApplicationStateContext.Provider>
}

export function useApplicationState() {
  const ctx = useContext(ApplicationStateContext)
  if (!ctx) {
    throw new Error("useApplicationState must be used within an ApplicationStateProvider")
  }
  return ctx
}
