import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { privateRobots } from "@/lib/seo"
import { movedStudentHref } from "@/lib/student-routes"

export const metadata: Metadata = { title: "Calendar", robots: privateRobots }

/** Folded into another page by the navigation cleanup; old links (email, notifications) keep working. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item)
  redirect(movedStudentHref("/clubs/meetings", params)!)
}
