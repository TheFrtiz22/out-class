import { AppShell } from "@/components/app-shell"
import { getStudentDashboardData } from "@/actions/applications"
import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  let initialData = null
  if (user) {
    try {
      initialData = await getStudentDashboardData()
    } catch (e) {
      console.error(e)
    }
  }

  return <AppShell initialSession={user} initialData={initialData} />
}
