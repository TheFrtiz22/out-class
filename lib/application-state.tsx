"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import {
  trackedApplications as seedTrackedApplications,
  notifications as seedNotifications,
  events as seedEvents,
  type TrackedApplication,
  type Notification,
  type ClubEvent,
} from "@/lib/data"

/**
 * Single source of truth for "did the student apply to this club".
 * Discover's Apply/Save action writes here once, and the Application Hub
 * (tracker), Notification Center (inbox), and Calendar all read from this
 * same context — so they update together instead of drifting out of sync.
 */

type ClubRef = {
  id: string
  name: string
  logoText: string
  color: string
}

type ApplicationStateValue = {
  trackedApps: TrackedApplication[]
  notifications: Notification[]
  events: ClubEvent[]
  appliedClubIds: Set<string>
  isApplied: (clubId: string) => boolean
  applyToClub: (club: ClubRef) => void
  markNotificationRead: (id: string) => void
  /** clubId of the application the Dashboard wants the Tracker to open, if any. */
  focusApplicationClubId: string | null
  focusApplication: (clubId: string) => void
  clearApplicationFocus: () => void
}

const ApplicationStateContext = createContext<ApplicationStateValue | null>(null)

// Fallback placement for the auto-generated deadline reminder when a club
// doesn't have a real deadline day yet — near the end of the visible month.
const DEFAULT_DEADLINE_DAY = 27

export function ApplicationStateProvider({ children }: { children: ReactNode }) {
  const [trackedApps, setTrackedApps] = useState<TrackedApplication[]>(seedTrackedApplications)
  const [notifications, setNotifications] = useState<Notification[]>(seedNotifications)
  const [events, setEvents] = useState<ClubEvent[]>(seedEvents)
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
          id: `trk-${timestamp}`,
          clubId: club.id,
          clubName: club.name,
          logoText: club.logoText,
          color: club.color,
          status: "Drafting",
          questionsCompleted: 0,
          questionsTotal: 3,
          nextDeadline: "Application opens",
          dueInHours: 336,
        },
      ])

      setNotifications((prev) => [
        {
          id: `n-${timestamp}`,
          type: "Announcement",
          urgent: false,
          club: club.name,
          color: club.color,
          logoText: club.logoText,
          senderName: "Recruitment Team",
          senderTitle: `${club.name} — Recruitment`,
          title: `${club.name} has received your application`,
          preview: "Your OutClass profile, resume, and responses were submitted successfully.",
          body: ["Your OutClass profile, resume, and responses were submitted successfully."],
          timestamp: "Just now",
          fullDate: "Just now",
          read: false,
        },
        ...prev,
      ])

      setEvents((prev) => [
        ...prev,
        {
          id: `e-${timestamp}`,
          day: DEFAULT_DEADLINE_DAY,
          title: `${club.name} Application Due`,
          club: club.name,
          color: club.color,
          type: "Deadline",
          time: "11:59 PM",
        },
      ])
    },
    [appliedClubIds],
  )

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }, [])

  const value = useMemo(
    () => ({
      trackedApps,
      notifications,
      events,
      appliedClubIds,
      isApplied,
      applyToClub,
      markNotificationRead,
      focusApplicationClubId,
      focusApplication,
      clearApplicationFocus,
    }),
    [
      trackedApps,
      notifications,
      events,
      appliedClubIds,
      isApplied,
      applyToClub,
      markNotificationRead,
      focusApplicationClubId,
      focusApplication,
      clearApplicationFocus,
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
