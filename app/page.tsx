import { AppShell } from "@/components/app-shell"
import { getStudentDashboardData } from "@/actions/applications"
import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"
import { prisma } from "@/utils/prisma"

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  let initialData = null
  let hasProfile = false
  if (user) {
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

  return <AppShell initialSession={user} initialData={initialData} hasProfile={hasProfile} />
}
