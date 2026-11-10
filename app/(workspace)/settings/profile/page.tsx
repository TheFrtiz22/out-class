import { redirect } from "next/navigation"

export const metadata = { title: "Profile" }

/** Settings → Profile re-rendered the Profile page; Profile is the one place to edit it. Old links (email, notifications, bookmarks) keep working. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item)
  redirect(`/profile${params.size ? `?${params}` : ""}`)
}
