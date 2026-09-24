import { safeReturnPath } from "@/lib/auth"
import { canAccessDemo, DEMO_COOKIE } from "@/lib/demo/access"
import { AppShell } from "@/components/app-shell"
import { getStudentDashboardData } from "@/actions/applications"
import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"
import { prisma } from "@/utils/prisma"

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeReturnPath((await searchParams).next)
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (cookieStore.get(DEMO_COOKIE)?.value === "1" && canAccessDemo(authError ? undefined : user?.email)) return <AppShell initialView="student-dashboard" />

  let initialData = null
  let hasProfile = false
  if (user) {
    const account = await prisma.user.findUnique({ where: { id: user.id }, select: { disabledAt: true } })
    if (account?.disabledAt) return <main className="p-8">Your account is unavailable. Contact OutClass support.</main>
    try {
      initialData = await getStudentDashboardData()
    } catch (e) {
      console.error(e)
    }
    // Check if the user has completed onboarding (has a StudentProfile)
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    hasProfile = !!profile
  }

  return <AppShell initialView={!user && next !== "/" ? "auth" : "landing"} initialSession={user} initialData={initialData} hasProfile={hasProfile} />
}
