import { redirect } from "next/navigation"

export const metadata = { title: "My Clubs" }

/** Settings → Organizations repeated My Clubs; memberships, invitations and “Find or claim a club” live there now. Old links (email, notifications, bookmarks) keep working. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item)
  redirect(`/clubs${params.size ? `?${params}` : ""}`)
}
