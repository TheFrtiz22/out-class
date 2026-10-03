import { redirect } from "next/navigation"
import { applicantStatusHref } from "@/lib/student-navigation"

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item)
  }
  redirect(applicantStatusHref(params))
}
