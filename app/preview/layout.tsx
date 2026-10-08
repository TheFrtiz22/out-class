import type { ReactNode } from "react"
import { notFound } from "next/navigation"
import { cookies } from "next/headers"
import { getSessionUser } from "@/utils/auth"
import { canAccessDemo, DEMO_COOKIE } from "@/lib/demo/access"
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"

/** Private presenter workspace; never an anonymous public product experience. */
export default async function PreviewLayout({ children }: { children: ReactNode }) {
  const jar = await cookies()
  if (jar.get(DEMO_COOKIE)?.value !== "1" || jar.has(PLATFORM_VIEW_COOKIE)) notFound()
  const { data: { user }, error } = await getSessionUser()
  if (error || !user?.email_confirmed_at || !canAccessDemo(user.email)) notFound()
  return children
}
