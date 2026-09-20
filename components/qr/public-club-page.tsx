"use client"
import { ApplicationStateProvider } from "@/lib/application-state"
import { publicClubs } from "@/lib/public-clubs"
import { ClubProfileView } from "@/components/views/club-profile-view"
import { useState } from "react"
import { ApplicationTrackerView } from "@/components/views/application-tracker-view"
import { CalendarView } from "@/components/views/calendar-view"
import type { ViewId } from "@/lib/views"
export function PublicClubPage({ clubId }: { clubId: string }) {
  const [view, setView] = useState<ViewId | "profile">("profile")
  const club = publicClubs.find(item => item.id === clubId)
  if (!club) return <p>Club not found.</p>
  return <ApplicationStateProvider><main className="min-h-svh bg-white px-5 py-10 font-sans">
    {view !== "profile" && <button className="mb-6 text-sm underline" onClick={() => setView("profile")}>Back to club profile</button>}
    {view === "tracker" ? <ApplicationTrackerView onNavigate={setView} /> : view === "calendar" ? <CalendarView onNavigate={setView} /> : <ClubProfileView club={club} onBack={() => { window.location.href = "/" }} onNavigate={setView} />}
  </main></ApplicationStateProvider>
}
