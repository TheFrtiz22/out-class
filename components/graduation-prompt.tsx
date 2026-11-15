"use client"
import { useState } from "react"
import { X } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { DashboardCard } from "@/components/product/dashboard/dashboard"
import { EditStudentProfileDialog } from "@/components/edit-student-profile-dialog"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { confirmGraduation, dismissGraduationPrompt } from "@/actions/graduation"
import { unwrapAction } from "@/lib/action-result"
import { userMessage } from "@/lib/user-message"
import { showGraduationPrompt } from "@/lib/graduation"

/** Home, April–July of the student's graduation year (lib/graduation.ts). Server actions re-check. */
export function GraduationPrompt({ now }: { now: Date }) {
  const { user, refreshUser } = useAuth(), demo = useDemoMode()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  // Live accounts only: Demo Mode has no server profile to answer for.
  if (demo.isDemoEnabled || !user || user.impersonating || !showGraduationPrompt(user.profile, now)) return null
  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError("")
    try { unwrapAction(await action()); await refreshUser() }
    catch (e) { setError(userMessage(e, "We couldn’t save that. Try again.")) }
    finally { setBusy(false) }
  }
  return <DashboardCard id="home-graduation-title" title="Graduating this spring?" className="oc-home-graduation"
    aside={<Button variant="ghost" size="icon" disabled={busy} aria-label="Dismiss graduation question" onClick={() => void run(dismissGraduationPrompt)}><X className="size-4" aria-hidden="true" /></Button>}>
    <p className="text-sm text-muted-foreground">Your account stays as an alumni account from Aug 1, with your profile and history. Clubs list you as alumni.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <Button size="sm" disabled={busy} onClick={() => void run(confirmGraduation)}>Yes, I’m graduating</Button>
      <EditStudentProfileDialog section="education" onSaved={() => void refreshUser()} trigger={<Button size="sm" variant="outline" disabled={busy}>Update my year</Button>} />
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
  </DashboardCard>
}
