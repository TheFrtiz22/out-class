import { AppShell } from "@/components/app-shell"
import { getStudentDashboardData } from "@/actions/applications"
import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { session } } = await supabase.auth.getSession()

  let initialData = null
  if (session) {
    try {
      initialData = await getStudentDashboardData()
    } catch (e) {
      console.error(e)
    }
  }

  return <AppShell initialSession={session} initialData={initialData} />
}
